import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const PORT = Number(process.env.PORT || 3001);
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'admin';
const AGY_BIN = process.env.AGY_BIN || 'agy';
const AGY_DEFAULT_CWD = process.env.AGY_DEFAULT_CWD || process.cwd();
const AGY_DATA_DIR =
  process.env.AGY_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity-cli');
const DEFAULT_EXEC_MODE = (process.env.AGY_EXEC_MODE || 'local') as 'local' | 'ssh';

const SSH_HOST = process.env.SSH_HOST || 'host.docker.internal';
const SSH_PORT = process.env.SSH_PORT || '22';
const SSH_USER = process.env.SSH_USER || 'root';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH || '';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(AUTH_PASSWORD + '_antigravity_secret_salt')
  .digest('hex');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface AgyModelOption {
  id: string;
  label: string;
  provider: string;
}

const DEFAULT_AGY_MODELS: AgyModelOption[] = [
  { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)', provider: 'Google' },
  { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon (High)', provider: 'Google' },
  { id: 'gemini-4-argon-low', label: 'Gemini 4 Argon (Low)', provider: 'Google' },
  { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', provider: 'Google' },
  { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)', provider: 'Google' },
  { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)', provider: 'Google' },
  { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)', provider: 'Anthropic' },
  { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 (Medium)', provider: 'Anthropic' },
  { id: 'claude-opus-5-5-low', label: 'Claude Opus 5.5 (Low)', provider: 'Anthropic' },
  { id: 'claude-sonnet-5-5-high', label: 'Claude Sonnet 5.5 (High)', provider: 'Anthropic' },
  { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 (Medium)', provider: 'Anthropic' },
  { id: 'claude-sonnet-5-5-low', label: 'Claude Sonnet 5.5 (Low)', provider: 'Anthropic' },
  { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)', provider: 'OpenAI' },
];

let cachedModels: AgyModelOption[] = [...DEFAULT_AGY_MODELS];

async function refreshAgyModels(): Promise<AgyModelOption[]> {
  try {
    const { stdout } = await execAsync(`${AGY_BIN} models 2>/dev/null`, { timeout: 10000 });
    // Strip ANSI escape codes and carriage-return spinner lines
    const clean = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const parsed: AgyModelOption[] = [];
    for (const rawLine of clean.split('\n')) {
      // Take the segment after the last \r in case spinner output is on the same line
      const line = (rawLine.split('\r').pop() || '').trim();
      if (!line || line.startsWith('Fetching') || line.startsWith('Usage:')) continue;
      const match = line.match(/^([a-z0-9._-]+)\s+(.+)$/i);
      if (match) {
        const id = match[1].trim();
        const label = match[2].trim();
        let provider = 'Other';
        if (id.startsWith('gemini')) provider = 'Google';
        else if (id.startsWith('claude')) provider = 'Anthropic';
        else if (id.startsWith('gpt')) provider = 'OpenAI';
        parsed.push({ id, label, provider });
      }
    }
    if (parsed.length > 0) {
      cachedModels = parsed;
    }
  } catch {
    // Fallback to cached/default models
  }
  return cachedModels;
}

// Kick off an non-blocking model refresh on startup
refreshAgyModels();

export interface ToolCallItem {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  output?: string;
  taskId?: string;
}

export interface BackgroundTaskItem {
  id: string;
  command: string;
  status: 'running' | 'done' | 'error';
  logTail: string;
  updatedAt: string;
}

export interface BrainArtifactItem {
  name: string;
  relativePath: string;
  content: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface RunningProcessItem {
  pid: number;
  command: string;
  cwd: string;
  elapsedSeconds: number;
  ports: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCallItem[];
  timestamp: string;
  model?: string;
  durationSeconds?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    thinking_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  agyConversationId?: string;
  cwd: string;
  execMode: 'local' | 'ssh';
  model: string;
  effort: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

function loadSessions(): ChatSession[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load sessions.json:', err);
  }
  return [];
}

function saveSessions(sessions: ChatSession[]) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save sessions.json:', err);
  }
}

let sessions: ChatSession[] = loadSessions();
const activeProcesses = new Map<string, ChildProcess>();

function createAuthToken(): string {
  return crypto.createHmac('sha256', SECRET_KEY).update('authorized_session').digest('hex');
}

function verifyToken(token?: string | null): boolean {
  if (!AUTH_PASSWORD) return true;
  if (!token) return false;
  return token === createAuthToken();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Public Auth Routes
app.get('/api/auth/status', (req, res) => {
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  res.json({
    authRequired: Boolean(AUTH_PASSWORD),
    authenticated: verifyToken(authHeader),
  });
});

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!AUTH_PASSWORD || password === AUTH_PASSWORD) {
    return res.json({ token: createAuthToken() });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// Auth Middleware for protected API routes
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Get default server config
app.get('/api/config', (_req, res) => {
  res.json({
    defaultCwd: AGY_DEFAULT_CWD,
    defaultExecMode: DEFAULT_EXEC_MODE,
    agyBin: AGY_BIN,
    sshHost: `${SSH_USER}@${SSH_HOST}:${SSH_PORT}`,
  });
});

// Get available Antigravity models
app.get('/api/models', async (req, res) => {
  if (req.query.refresh === 'true') {
    await refreshAgyModels();
  }
  res.json({
    models: cachedModels,
  });
});

// Sessions CRUD
app.get('/api/sessions', (_req, res) => {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  res.json(sorted);
});

app.post('/api/sessions', (req, res) => {
  const { title, cwd, execMode, model, effort } = req.body || {};
  const now = new Date().toISOString();
  const newSession: ChatSession = {
    id: crypto.randomUUID(),
    title: title || 'New Server Session',
    cwd: cwd || AGY_DEFAULT_CWD,
    execMode: execMode || DEFAULT_EXEC_MODE,
    model: model || '',
    effort: effort || 'medium',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions.unshift(newSession);
  saveSessions(sessions);
  res.json(newSession);
});

app.patch('/api/sessions/:id', (req, res) => {
  const session = sessions.find((s) => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { title, cwd, execMode, model, effort, agyConversationId } = req.body || {};
  if (title !== undefined) session.title = title;
  if (cwd !== undefined) session.cwd = cwd;
  if (execMode !== undefined) session.execMode = execMode;
  if (model !== undefined) session.model = model;
  if (effort !== undefined) session.effort = effort;
  if (agyConversationId !== undefined) session.agyConversationId = agyConversationId;
  session.updatedAt = new Date().toISOString();

  saveSessions(sessions);
  res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  const target = sessions.find((s) => s.id === req.params.id);
  killSessionRunner(req.params.id);
  if (target?.agyConversationId) {
    const brainPath = path.join(AGY_DATA_DIR, 'brain', target.agyConversationId);
    try {
      if (fs.existsSync(brainPath)) {
        fs.rmSync(brainPath, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  }
  sessions = sessions.filter((s) => s.id !== req.params.id);
  saveSessions(sessions);
  res.json({ ok: true });
});

app.delete('/api/sessions', (_req, res) => {
  for (const id of [...activeProcesses.keys(), ...persistentRunners.keys()]) {
    killSessionRunner(id);
  }
  sessions = [];
  saveSessions(sessions);
  res.json({ ok: true });
});

// Stop active agy run for a session
app.post('/api/sessions/:id/stop', (req, res) => {
  const hadProcess =
    activeProcesses.has(req.params.id) || persistentRunners.has(req.params.id);
  killSessionRunner(req.params.id);
  res.json({ stopped: hadProcess });
});

function cleanTerminalLog(raw: string, maxChars = 4000): string {
  const stripped = raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\r\n/g, '\n');
  const lines = stripped
    .split('\n')
    .map((l) => (l.includes('\r') ? l.split('\r').filter(Boolean).pop() || '' : l))
    .filter((l, i, arr) => l.trim() !== '' || (i > 0 && arr[i - 1].trim() !== ''));
  return lines.slice(-80).join('\n').slice(-maxChars);
}

function getConversationTasksAndArtifacts(conversationId?: string): {
  tasks: BackgroundTaskItem[];
  artifacts: BrainArtifactItem[];
} {
  if (!conversationId) return { tasks: [], artifacts: [] };
  const brainDir = path.join(AGY_DATA_DIR, 'brain', conversationId);
  if (!fs.existsSync(brainDir)) return { tasks: [], artifacts: [] };

  const tasksMap = new Map<string, BackgroundTaskItem>();
  const transcriptPath = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');

  if (fs.existsSync(transcriptPath)) {
    try {
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        const content = typeof entry.content === 'string' ? entry.content : '';

        // Detect background task launch
        const launchMatch = content.match(
          /Tool is running as a background task with task id:\s*[^\s/]+\/(task-\d+)/
        );
        if (launchMatch) {
          const taskId = launchMatch[1];
          const descMatch = content.match(/Task Description:\s*(.+)/);
          tasksMap.set(taskId, {
            id: taskId,
            command: descMatch ? descMatch[1].trim() : taskId,
            status: 'running',
            logTail: '',
            updatedAt: entry.created_at || new Date().toISOString(),
          });
        }

        // Detect background task completion in SYSTEM_MESSAGE
        const finishMatch = content.match(
          /Task id "[^"]+\/(task-\d+)" finished with result:\s*Command exited with code (\d+)/
        );
        if (finishMatch) {
          const taskId = finishMatch[1];
          const exitCode = Number(finishMatch[2]);
          const existing = tasksMap.get(taskId);
          if (existing) {
            existing.status = exitCode === 0 ? 'done' : 'error';
            existing.updatedAt = entry.created_at || existing.updatedAt;
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // Read task log files from .system_generated/tasks
  const tasksDir = path.join(brainDir, '.system_generated', 'tasks');
  if (fs.existsSync(tasksDir)) {
    try {
      for (const file of fs.readdirSync(tasksDir)) {
        if (!file.endsWith('.log')) continue;
        const taskId = file.replace(/\.log$/, '');
        const fullPath = path.join(tasksDir, file);
        const stat = fs.statSync(fullPath);
        const rawLog = fs.readFileSync(fullPath, 'utf-8');
        const logTail = cleanTerminalLog(rawLog);
        const existing = tasksMap.get(taskId);
        if (existing) {
          existing.logTail = logTail;
          existing.updatedAt = stat.mtime.toISOString();
        } else {
          tasksMap.set(taskId, {
            id: taskId,
            command: taskId,
            status: 'done',
            logTail,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // Scan brainDir & brainDir/scratch for generated markdown / code artifacts
  const artifacts: BrainArtifactItem[] = [];
  const scanDir = (dir: string, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name === 'scratch') scanDir(full, rel);
        } else if (entry.isFile() && /\.(md|txt|json|html|sh|py|ts|js)$/i.test(entry.name)) {
          const stat = fs.statSync(full);
          const content = fs.readFileSync(full, 'utf-8').slice(0, 25000);
          artifacts.push({
            name: entry.name,
            relativePath: rel,
            content,
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      // ignore
    }
  };
  scanDir(brainDir);

  return {
    tasks: Array.from(tasksMap.values()).reverse(),
    artifacts,
  };
}

async function detectRunningDevProcesses(): Promise<RunningProcessItem[]> {
  try {
    // Map PID -> listening ports using ss -tulpn
    const pidPorts = new Map<number, Set<number>>();
    try {
      const { stdout: ssOut } = await execAsync('ss -tulpn 2>/dev/null || true');
      for (const line of ssOut.split('\n')) {
        if (!line.includes('LISTEN')) continue;
        const portMatch = line.match(/:(\d+)\s+/);
        const pidMatches = [...line.matchAll(/pid=(\d+)/g)];
        if (portMatch && pidMatches.length > 0) {
          const port = Number(portMatch[1]);
          for (const pm of pidMatches) {
            const p = Number(pm[1]);
            if (!pidPorts.has(p)) pidPorts.set(p, new Set());
            pidPorts.get(p)!.add(port);
          }
        }
      }
    } catch {
      // ignore ss errors
    }

    const { stdout: psOut } = await execAsync('ps -eo pid,ppid,etimes,args --no-headers');
    const results: RunningProcessItem[] = [];
    const selfPid = process.pid;
    const selfPpid = process.ppid;

    for (const rawLine of psOut.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (!m) continue;
      const pid = Number(m[1]);
      const ppid = Number(m[2]);
      const elapsedSeconds = Number(m[3]);
      const cmd = m[4].trim();

      if (pid === selfPid || pid === selfPpid || ppid === selfPid) continue;
      if (cmd.includes('server/index.ts') && cmd.includes('antigravity-web')) continue;

      const isDevServerOrTask =
        /\b(npm run|pnpm run|pnpm dev|yarn dev|vite|next dev|next start|tsx watch|nodemon|python3?\s+-m\s+http\.server|flask run|uvicorn|gunicorn|go run|cargo run|bun run|bun dev)\b/i.test(
          cmd
        );

      if (!isDevServerOrTask) continue;

      let cwd = '';
      try {
        cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      } catch {
        cwd = '';
      }

      const ports = Array.from(pidPorts.get(pid) || []);
      results.push({
        pid,
        command: cmd.slice(0, 180),
        cwd,
        elapsedSeconds,
        ports,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// Get running tasks, artifacts, and dev server processes for a session
app.get('/api/sessions/:id/artifacts', async (req, res) => {
  const session = sessions.find((s) => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { tasks, artifacts } = getConversationTasksAndArtifacts(session.agyConversationId);
  const processes = await detectRunningDevProcesses();

  res.json({
    tasks,
    artifacts,
    processes,
  });
});

// Stop/kill a running background dev server process by PID
app.post('/api/processes/:pid/kill', (req, res) => {
  const pid = Number(req.params.pid);
  if (!pid || pid === process.pid) {
    return res.status(400).json({ error: 'Invalid PID' });
  }
  try {
    process.kill(pid, 'SIGTERM');
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Live Server & Docker Telemetry
app.get('/api/system', async (_req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    let diskInfo = { size: 'N/A', used: 'N/A', avail: 'N/A', usePercent: '0%' };
    try {
      const { stdout: dfOut } = await execAsync('df -h / | tail -n 1');
      const parts = dfOut.trim().split(/\s+/);
      if (parts.length >= 5) {
        diskInfo = {
          size: parts[1],
          used: parts[2],
          avail: parts[3],
          usePercent: parts[4],
        };
      }
    } catch {
      // ignore df error
    }

    let containers: Array<{
      id: string;
      name: string;
      image: string;
      status: string;
      state: string;
      ports: string;
    }> = [];
    let dockerAvailable = false;
    try {
      const { stdout: dockerOut } = await execAsync(
        "docker ps -a --format '{{json .}}' 2>/dev/null"
      );
      dockerAvailable = true;
      containers = dockerOut
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parsed = JSON.parse(line);
          return {
            id: parsed.ID,
            name: parsed.Names,
            image: parsed.Image,
            status: parsed.Status,
            state: parsed.State,
            ports: parsed.Ports,
          };
        });
    } catch {
      dockerAvailable = false;
    }

    let agyAvailable = false;
    try {
      await execAsync(`${AGY_BIN} --help >/dev/null 2>&1`);
      agyAvailable = true;
    } catch {
      agyAvailable = false;
    }

    res.json({
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptimeSeconds: os.uptime(),
      cpuCount: os.cpus().length,
      loadAvg: loadAvg.map((n) => Number(n.toFixed(2))),
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        percent: Math.round((usedMem / totalMem) * 100),
      },
      disk: diskInfo,
      docker: {
        available: dockerAvailable,
        containers,
      },
      agy: {
        available: agyAvailable,
        bin: AGY_BIN,
        defaultExecMode: DEFAULT_EXEC_MODE,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Serve frontend static assets in production
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function sendWs(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getTranscriptLineCount(conversationId?: string): number {
  if (!conversationId) return 0;
  try {
    const transcriptPath = path.join(
      AGY_DATA_DIR,
      'brain',
      conversationId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );
    if (!fs.existsSync(transcriptPath)) return 0;
    const raw = fs.readFileSync(transcriptPath, 'utf-8').trim();
    if (!raw) return 0;
    return raw.split('\n').length;
  } catch {
    return 0;
  }
}

// Helper to extract rich tool call details from transcript.jsonl ONLY for the current turn
function readCurrentTurnTranscriptToolCalls(
  conversationId: string,
  startLineOffset: number,
  minStepIndex: number
): ToolCallItem[] {
  try {
    const transcriptPath = path.join(
      AGY_DATA_DIR,
      'brain',
      conversationId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );
    if (!fs.existsSync(transcriptPath)) return [];
    const raw = fs.readFileSync(transcriptPath, 'utf-8').trim();
    if (!raw) return [];
    const allLines = raw.split('\n');

    // Only look at lines added during this turn (from startLineOffset onwards)
    const turnLines = allLines.slice(startLineOffset);
    if (turnLines.length === 0) return [];

    const parsedEntries = turnLines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Also find the latest USER_INPUT within these lines so we only take steps after it
    let lastUserInputIdx = -1;
    for (let i = 0; i < parsedEntries.length; i++) {
      const e = parsedEntries[i];
      if (e.type === 'USER_INPUT' || e.source === 'USER_EXPLICIT') {
        lastUserInputIdx = i;
      }
    }

    const relevantEntries =
      lastUserInputIdx >= 0 ? parsedEntries.slice(lastUserInputIdx + 1) : parsedEntries;

    const items: ToolCallItem[] = [];
    for (let i = 0; i < relevantEntries.length; i++) {
      const entry = relevantEntries[i];
      if (typeof entry.step_index === 'number' && entry.step_index <= minStepIndex) {
        continue;
      }
      if (Array.isArray(entry.tool_calls)) {
        // Look ahead for the corresponding GENERIC output step
        const nextEntry = relevantEntries[i + 1];
        const nextContent =
          nextEntry && nextEntry.type === 'GENERIC' && typeof nextEntry.content === 'string'
            ? nextEntry.content
            : typeof entry.content === 'string'
            ? entry.content
            : '';

        const bgTaskMatch = nextContent.match(
          /Tool is running as a background task with task id:\s*[^\s/]+\/(task-\d+)/
        );
        const taskId = bgTaskMatch ? bgTaskMatch[1] : undefined;

        let taskLogPreview = '';
        if (taskId) {
          const logFile = path.join(
            AGY_DATA_DIR,
            'brain',
            conversationId,
            '.system_generated',
            'tasks',
            `${taskId}.log`
          );
          if (fs.existsSync(logFile)) {
            try {
              taskLogPreview = cleanTerminalLog(fs.readFileSync(logFile, 'utf-8'), 1500);
            } catch {
              // ignore
            }
          }
        }

        // Check if a later SYSTEM_MESSAGE marked this background task as finished
        let bgFinished = false;
        if (taskId) {
          bgFinished = relevantEntries.some(
            (e) =>
              typeof e.content === 'string' &&
              e.content.includes(`/${taskId}" finished with result:`)
          );
        }

        for (const tc of entry.tool_calls) {
          const name = tc.name || tc.tool_name || 'tool';
          let args = tc.args || tc.arguments || {};
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch {
              args = { raw: args };
            }
          }
          const isRunning = taskId
            ? !bgFinished
            : nextEntry
            ? nextEntry.status === 'RUNNING'
            : entry.status !== 'DONE';

          items.push({
            id: tc.id || `${entry.step_index || 0}_${name}`,
            name,
            args,
            status: isRunning ? 'running' : 'done',
            taskId,
            output: taskLogPreview || (nextContent ? nextContent.slice(0, 1500) : undefined),
          });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

interface PersistentSessionRunner {
  child: ChildProcess;
  configKey: string;
  onJsonLine?: (line: string) => void;
  onStderr?: (text: string) => void;
  onClose?: (code: number | null) => void;
}

const persistentRunners = new Map<string, PersistentSessionRunner>();

function killSessionRunner(sessionId: string) {
  const runner = persistentRunners.get(sessionId);
  if (runner) {
    try {
      runner.child.kill('SIGTERM');
    } catch {
      // ignore
    }
    persistentRunners.delete(sessionId);
  }
  const proc = activeProcesses.get(sessionId);
  if (proc) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
    activeProcesses.delete(sessionId);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (!verifyToken(token)) {
    sendWs(ws, { type: 'error', error: 'Unauthorized WebSocket connection' });
    ws.close();
    return;
  }

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.type === 'stop' && msg.sessionId) {
        killSessionRunner(msg.sessionId);
        sendWs(ws, { type: 'stopped', sessionId: msg.sessionId });
        return;
      }

      if (msg.type === 'chat') {
        const { sessionId, prompt } = msg;
        const session = sessions.find((s) => s.id === sessionId);
        if (!session || !prompt?.trim()) {
          sendWs(ws, { type: 'error', error: 'Invalid session or empty prompt' });
          return;
        }

        // Save user message
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString(),
        };
        session.messages.push(userMsg);

        // Auto-title on first prompt
        if (session.messages.length === 1 && session.title === 'New Server Session') {
          session.title = prompt.slice(0, 48) + (prompt.length > 48 ? '...' : '');
        }

        const assistantMsgId = crypto.randomUUID();
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          thinking: '',
          toolCalls: [],
          model: session.model || 'default',
          timestamp: new Date().toISOString(),
        };
        session.messages.push(assistantMsg);
        session.updatedAt = new Date().toISOString();
        saveSessions(sessions);

        sendWs(ws, {
          type: 'turn_start',
          sessionId,
          userMessage: userMsg,
          assistantMessageId: assistantMsgId,
          sessionTitle: session.title,
        });

        const cwd = fs.existsSync(session.cwd) ? session.cwd : process.cwd();
        const desiredConfigKey = `${session.execMode}|${cwd}|${session.model || ''}|${session.effort || ''}`;

        let runner = persistentRunners.get(sessionId);
        if (
          runner &&
          (runner.child.killed ||
            runner.child.exitCode !== null ||
            runner.configKey !== desiredConfigKey)
        ) {
          killSessionRunner(sessionId);
          runner = undefined;
        }

        if (!runner) {
          // Spawn persistent stream-json agy process so background tasks (e.g. npm run dev) stay alive across turns!
          const agyArgs: string[] = [
            '-p=',
            '--input-format',
            'stream-json',
            '--output-format',
            'stream-json',
            '--dangerously-skip-permissions',
          ];

          if (session.agyConversationId) {
            agyArgs.push('--conversation', session.agyConversationId);
          }
          if (session.model && session.model.trim()) {
            agyArgs.push('--model', session.model.trim());
          }
          if (session.effort && session.effort.trim()) {
            agyArgs.push('--effort', session.effort.trim());
          }

          let child: ChildProcess;
          if (session.execMode === 'ssh') {
            const sshArgs: string[] = ['-o', 'StrictHostKeyChecking=no', '-p', String(SSH_PORT)];
            if (SSH_KEY_PATH && fs.existsSync(SSH_KEY_PATH)) {
              sshArgs.push('-i', SSH_KEY_PATH);
            }
            const escapedAgyArgs = agyArgs
              .map((a) => `'${a.replace(/'/g, `'\\''`)}'`)
              .join(' ');
            const remoteCmd = `cd '${cwd.replace(/'/g, `'\\''`)}' && ${AGY_BIN} ${escapedAgyArgs}`;
            sshArgs.push(`${SSH_USER}@${SSH_HOST}`, remoteCmd);

            child = spawn('ssh', sshArgs, {
              env: { ...process.env },
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          } else {
            child = spawn(AGY_BIN, agyArgs, {
              cwd,
              env: { ...process.env },
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          }

          const newRunner: PersistentSessionRunner = {
            child,
            configKey: desiredConfigKey,
          };

          let stdoutBuffer = '';
          child.stdout?.on('data', (chunk: Buffer) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            for (const line of lines) {
              newRunner.onJsonLine?.(line);
            }
          });

          child.stderr?.on('data', (chunk: Buffer) => {
            newRunner.onStderr?.(chunk.toString());
          });

          child.on('close', (code) => {
            if (stdoutBuffer.trim()) {
              newRunner.onJsonLine?.(stdoutBuffer);
              stdoutBuffer = '';
            }
            persistentRunners.delete(sessionId);
            activeProcesses.delete(sessionId);
            newRunner.onClose?.(code);
          });

          child.on('error', (err) => {
            persistentRunners.delete(sessionId);
            activeProcesses.delete(sessionId);
            assistantMsg.error = `Failed to launch Antigravity CLI (${AGY_BIN}): ${err.message}`;
            saveSessions(sessions);
            sendWs(ws, {
              type: 'turn_error',
              sessionId,
              messageId: assistantMsgId,
              error: assistantMsg.error,
            });
          });

          persistentRunners.set(sessionId, newRunner);
          activeProcesses.set(sessionId, child);
          runner = newRunner;
        }

        const initialTranscriptLines = getTranscriptLineCount(session.agyConversationId);
        let currentTurnUserStepIndex = -1;
        let stderrBuffer = '';
        let turnCompleted = false;

        runner.onJsonLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          try {
            const parsed = JSON.parse(trimmed);

            if (parsed.event === 'init') {
              if (parsed.conversation_id) {
                session.agyConversationId = parsed.conversation_id;
                saveSessions(sessions);
              }
              sendWs(ws, {
                type: 'agy_init',
                sessionId,
                conversationId: parsed.conversation_id,
                init: parsed.init,
              });
              return;
            }

            if (parsed.event === 'step_update' && parsed.step_update) {
              const su = parsed.step_update;
              if (su.conversation_id && !session.agyConversationId) {
                session.agyConversationId = su.conversation_id;
              }

              if (su.step_type === 'user_input' && typeof su.step_index === 'number') {
                currentTurnUserStepIndex = su.step_index;
                return;
              }

              if (su.thinking_delta || su.thinking) {
                const delta = su.thinking_delta || su.thinking || '';
                assistantMsg.thinking = (assistantMsg.thinking || '') + delta;
                sendWs(ws, {
                  type: 'thinking_delta',
                  sessionId,
                  messageId: assistantMsgId,
                  delta,
                });
              }

              if (su.text_delta) {
                assistantMsg.content += su.text_delta;
                sendWs(ws, {
                  type: 'text_delta',
                  sessionId,
                  messageId: assistantMsgId,
                  delta: su.text_delta,
                });
              }

              // Detect action/tool fields on step_update
              const actionKeys = [
                'run_command',
                'edit_file',
                'create_file',
                'view_file',
                'list_directory',
                'find_file',
                'search_directory',
                'mcp_tool',
                'search_web',
                'read_url_content',
                'custom_tool',
                'skill_lookup',
                'run_workflow',
                'invoke_subagent',
              ];

              for (const key of actionKeys) {
                if (su[key]) {
                  const tcId = `step_${su.step_index}_${key}`;
                  const existingIdx = (assistantMsg.toolCalls || []).findIndex(
                    (t) => t.id === tcId
                  );
                  const tcItem: ToolCallItem = {
                    id: tcId,
                    name: key,
                    args: typeof su[key] === 'object' ? su[key] : { detail: su[key] },
                    status: su.state === 'DONE' ? 'done' : 'running',
                  };
                  if (!assistantMsg.toolCalls) assistantMsg.toolCalls = [];
                  if (existingIdx >= 0) {
                    assistantMsg.toolCalls[existingIdx] = tcItem;
                  } else {
                    assistantMsg.toolCalls.push(tcItem);
                  }
                  sendWs(ws, {
                    type: 'tool_calls_update',
                    sessionId,
                    messageId: assistantMsgId,
                    toolCalls: assistantMsg.toolCalls,
                  });
                }
              }

              // Also check transcript.jsonl for rich tool call metadata ONLY for the current turn
              if (session.agyConversationId && su.step_type !== 'user_input') {
                const transcriptTools = readCurrentTurnTranscriptToolCalls(
                  session.agyConversationId,
                  initialTranscriptLines,
                  currentTurnUserStepIndex
                );
                if (transcriptTools.length > 0) {
                  assistantMsg.toolCalls = transcriptTools;
                  sendWs(ws, {
                    type: 'tool_calls_update',
                    sessionId,
                    messageId: assistantMsgId,
                    toolCalls: assistantMsg.toolCalls,
                  });
                }
              }

              if (su.usage) {
                assistantMsg.usage = su.usage;
              }
              if (su.duration_seconds) {
                assistantMsg.durationSeconds = su.duration_seconds;
              }
              return;
            }

            if (parsed.event === 'result' && parsed.result) {
              const res = parsed.result;
              if (res.conversation_id) {
                session.agyConversationId = res.conversation_id;
              }
              if (!assistantMsg.content && typeof res.response === 'string') {
                assistantMsg.content = res.response;
              }
              if (res.error && !assistantMsg.content) {
                assistantMsg.error = res.error;
              }
              if (res.duration_seconds) {
                assistantMsg.durationSeconds = res.duration_seconds;
              }
              if (res.usage) {
                assistantMsg.usage = res.usage;
              }
              if (session.agyConversationId) {
                const transcriptTools = readCurrentTurnTranscriptToolCalls(
                  session.agyConversationId,
                  initialTranscriptLines,
                  currentTurnUserStepIndex
                );
                if (transcriptTools.length > 0) {
                  assistantMsg.toolCalls = transcriptTools;
                }
              }
              turnCompleted = true;
              session.updatedAt = new Date().toISOString();
              saveSessions(sessions);

              sendWs(ws, {
                type: 'turn_result',
                sessionId,
                messageId: assistantMsgId,
                message: assistantMsg,
                conversationId: session.agyConversationId,
              });
              sendWs(ws, {
                type: 'turn_complete',
                sessionId,
                messageId: assistantMsgId,
                exitCode: 0,
                message: assistantMsg,
                conversationId: session.agyConversationId,
              });
              return;
            }
          } catch {
            // Non-JSON line emitted on stdout
            assistantMsg.content += line + '\n';
            sendWs(ws, {
              type: 'text_delta',
              sessionId,
              messageId: assistantMsgId,
              delta: line + '\n',
            });
          }
        };

        runner.onStderr = (text: string) => {
          stderrBuffer += text;
          sendWs(ws, {
            type: 'stderr_log',
            sessionId,
            messageId: assistantMsgId,
            text,
          });
        };

        runner.onClose = (code: number | null) => {
          if (turnCompleted) return;
          if (code !== 0 && code !== null && !assistantMsg.content) {
            assistantMsg.error =
              stderrBuffer.trim() || `Antigravity CLI exited with code ${code}`;
          }
          session.updatedAt = new Date().toISOString();
          saveSessions(sessions);

          sendWs(ws, {
            type: 'turn_complete',
            sessionId,
            messageId: assistantMsgId,
            exitCode: code,
            message: assistantMsg,
            conversationId: session.agyConversationId,
          });
        };

        // Send user turn as NDJSON over stdin to the persistent agy process
        const ndjsonInput = JSON.stringify({
          event: 'user',
          message: { content: prompt },
        });
        runner.child.stdin?.write(ndjsonInput + '\n');
      }
    } catch (err) {
      sendWs(ws, { type: 'error', error: String(err) });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `🚀 Antigravity Server Control Center listening on http://0.0.0.0:${PORT} (mode: ${DEFAULT_EXEC_MODE})`
  );
});
