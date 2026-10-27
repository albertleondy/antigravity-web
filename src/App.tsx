import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Terminal,
  Send,
  Square,
  Plus,
  Trash2,
  Server,
  ShieldAlert,
  Cpu,
  HardDrive,
  Container,
  FolderGit2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Lock,
  LogOut,
  RefreshCw,
  Check,
  Copy,
  Activity,
  Wrench,
  Menu,
  Zap,
  Play,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  Bot,
} from 'lucide-react';
import type {
  ChatSession,
  ChatMessage,
  ToolCallItem,
  SystemTelemetry,
  AgyModelOption,
  SessionArtifactsResponse,
  BackgroundTaskItem,
  BrainArtifactItem,
} from './types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const FALLBACK_MODELS: AgyModelOption[] = [
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

const QUICK_PRESETS = [
  {
    label: 'Docker Status & Health',
    icon: Container,
    prompt:
      'Check all running and exited Docker containers on this server, summarize their health/status, and highlight any issues.',
  },
  {
    label: 'System Resource Audit',
    icon: Cpu,
    prompt:
      'Check CPU load, memory usage, top resource-consuming processes, and disk usage across mounted filesystems.',
  },
  {
    label: 'Restart Unhealthy Containers',
    icon: RotateCcw,
    prompt:
      'Inspect all Docker containers. If any container is unhealthy or exited unexpectedly, check its recent logs and restart it.',
  },
  {
    label: 'Clean Docker Cache',
    icon: HardDrive,
    prompt:
      'Show how much disk space Docker images, containers, and build cache are using (`docker system df`), and prune dangling images/cache safely.',
  },
  {
    label: 'Check Systemd & Logs',
    icon: FileText,
    prompt:
      'Check for any failed systemd services and inspect recent critical errors in journalctl or system logs.',
  },
  {
    label: 'Network & Open Ports',
    icon: Activity,
    prompt:
      'List all listening TCP/UDP ports on the server and which services/containers own them.',
  },
];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const text = String(children || '').replace(/\n$/, '');
  const isInline = !className && !text.includes('\n');

  if (isInline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-indigo-300 font-mono text-[0.85em] border border-zinc-700/60 break-all">
        {children}
      </code>
    );
  }

  const lang = className?.replace('language-', '') || 'shell';

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/90">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
        <span>{lang}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className="h-6 px-2 text-zinc-400 hover:text-zinc-100"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs sm:text-sm font-mono text-zinc-200 leading-relaxed">
        <code>{text}</code>
      </pre>
    </div>
  );
};

const ToolCallsDisplay: React.FC<{ toolCalls: ToolCallItem[] }> = ({ toolCalls }) => {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mb-3 space-y-1.5">
      {toolCalls.map((tc) => {
        const isOpen = Boolean(openMap[tc.id]);
        const cmdPreview =
          (tc.args?.CommandLine as string) ||
          (tc.args?.Path as string) ||
          (tc.args?.toolSummary as string) ||
          (tc.args?.query as string) ||
          '';

        return (
          <Collapsible
            key={tc.id}
            open={isOpen}
            onOpenChange={(open) => setOpenMap((prev) => ({ ...prev, [tc.id]: open }))}
            className="rounded-xl border border-zinc-800/90 bg-zinc-900/60 overflow-hidden text-xs"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      tc.status === 'running'
                        ? 'bg-amber-400 animate-pulse'
                        : tc.status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <Wrench className="size-3.5 text-indigo-400 shrink-0" />
                  <span className="font-mono font-medium text-zinc-200 shrink-0">{tc.name}</span>
                  {tc.taskId && (
                    <Badge variant={tc.status === 'running' ? 'warning' : 'secondary'} className="font-mono">
                      {tc.taskId}
                    </Badge>
                  )}
                  {cmdPreview && (
                    <span className="font-mono text-zinc-400 truncate">{String(cmdPreview)}</span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronDown className="size-3.5 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 text-zinc-500 shrink-0" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 py-2.5 border-t border-zinc-800/80 bg-zinc-950/80 font-mono space-y-2">
              {tc.args && Object.keys(tc.args).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Arguments
                  </div>
                  <pre className="text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(tc.args, null, 2)}
                  </pre>
                </div>
              )}
              {tc.output && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Output
                  </div>
                  <pre className="text-[11px] text-emerald-300/90 overflow-x-auto whitespace-pre-wrap max-h-48">
                    {tc.output}
                  </pre>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

const ThinkingAccordion: React.FC<{ thinking: string; isStreaming?: boolean }> = ({
  thinking,
  isStreaming,
}) => {
  const [open, setOpen] = useState(false);
  if (!thinking) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mb-3 rounded-xl border border-indigo-500/25 bg-indigo-950/15 overflow-hidden text-xs"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-1.5 text-indigo-300/90 hover:bg-indigo-950/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`size-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
            <span className="font-medium">Agent Reasoning</span>
          </div>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2.5 border-t border-indigo-500/20 text-zinc-300/90 whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto">
        {thinking}
      </CollapsibleContent>
    </Collapsible>
  );
};

// Memoized Chat Message Bubble so typing or sidebar updates never re-parse Markdown!
const ChatMessageBubble = memo<{
  msg: ChatMessage;
  isStreaming: boolean;
}>(({ msg, isStreaming }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-3 sm:py-3.5 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900/90 border border-zinc-800/90 text-zinc-100 w-full min-w-0'
        }`}
      >
        {!isUser && (
          <>
            {msg.thinking && (
              <ThinkingAccordion thinking={msg.thinking} isStreaming={isStreaming} />
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <ToolCallsDisplay toolCalls={msg.toolCalls} />
            )}
          </>
        )}

        {isUser ? (
          <div className="text-sm whitespace-pre-wrap leading-relaxed break-words">
            {msg.content}
          </div>
        ) : (
          <div className="markdown-body text-sm break-words overflow-x-hidden">
            {msg.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    return <CodeBlock className={className}>{children}</CodeBlock>;
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400 py-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Antigravity is executing on the server...</span>
              </div>
            ) : null}
          </div>
        )}

        {msg.error && (
          <div className="mt-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-300 font-mono whitespace-pre-wrap break-words">
            {msg.error}
          </div>
        )}

        {!isUser && (msg.durationSeconds || msg.usage?.total_tokens || msg.model) && (
          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-zinc-500 font-mono">
            <span>{msg.model && msg.model !== 'default' ? msg.model : ''}</span>
            <div className="flex items-center gap-3">
              {msg.durationSeconds && <span>{msg.durationSeconds.toFixed(1)}s</span>}
              {msg.usage?.total_tokens && (
                <span>{msg.usage.total_tokens.toLocaleString()} tok</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
ChatMessageBubble.displayName = 'ChatMessageBubble';

const SLASH_COMMANDS = [
  { cmd: '/usage', desc: 'View model quota usage and reset times', instant: true },
  { cmd: '/credits', desc: 'Show remaining G1 credits and upgrade link', instant: true },
  { cmd: '/help', desc: 'Show available Antigravity CLI commands', instant: true },
  { cmd: '/skills', desc: 'List installed Antigravity skills', instant: true },
  { cmd: '/agents', desc: 'List available custom subagents', instant: true },
  { cmd: '/compact', desc: 'Compact and summarize conversation context', instant: false },
  { cmd: '/plan', desc: 'Create a step-by-step plan before execution', instant: false },
  { cmd: '/goal', desc: 'Run thoroughly until the goal is fully achieved', instant: false },
  { cmd: '/boost', desc: 'Deep thinking, multi-perspective planning & verification', instant: false },
  { cmd: '/config', desc: 'View Antigravity CLI settings', instant: true },
  { cmd: '/permissions', desc: 'Inspect tool permission rules', instant: true },
  { cmd: '/plugin', desc: 'List installed plugins', instant: true },
  { cmd: '/changelog', desc: 'Show Antigravity CLI release notes', instant: true },
];

// Isolated Chat Input Bar component so typing has 0ms lag and doesn't re-render the parent App!
const ChatPromptBar = memo<{
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  mobileControls?: React.ReactNode;
}>(({ isStreaming, onSend, onStop, mobileControls }) => {
  const [text, setText] = useState('');

  const matchingSlashCommands = useMemo(() => {
    const trimmed = text.trimStart();
    if (!trimmed.startsWith('/') || trimmed.includes(' ')) return [];
    const q = trimmed.toLowerCase();
    return SLASH_COMMANDS.filter((item) => item.cmd.startsWith(q));
  }, [text]);

  const handleSubmit = (overrideText?: string) => {
    const trimmed = (overrideText ?? text).trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="p-2.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/30 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto space-y-2 relative">
        {matchingSlashCommands.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-md p-1.5 max-h-56 overflow-y-auto z-30">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Antigravity Slash Commands
            </div>
            {matchingSlashCommands.map((item) => (
              <button
                key={item.cmd}
                type="button"
                onClick={() => {
                  if (item.instant) {
                    handleSubmit(item.cmd);
                  } else {
                    setText(`${item.cmd} `);
                  }
                }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-indigo-600/20 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold text-indigo-400 shrink-0">
                    {item.cmd}
                  </span>
                  <span className="text-zinc-400 truncate">{item.desc}</span>
                </div>
                <Badge variant={item.instant ? 'secondary' : 'outline'} className="shrink-0">
                  {item.instant ? 'Run' : 'Prompt'}
                </Badge>
              </button>
            ))}
          </div>
        )}
        {mobileControls}
        <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 focus-within:border-indigo-500/70 transition-colors">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 1024) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask Antigravity or type /usage, /credits, /skills, /compact..."
            className="min-h-11 resize-none border-0 bg-transparent px-2 py-1 text-sm focus-visible:ring-0 max-h-36"
          />
          {isStreaming ? (
            <Button variant="destructive" size="icon" onClick={onStop} title="Stop Execution">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={() => handleSubmit()}
              disabled={!text.trim()}
              title="Send Command"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
ChatPromptBar.displayName = 'ChatPromptBar';

export function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('agy_auth_token') || '');
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);
  const [stderrLogs, setStderrLogs] = useState<string>('');

  const [models, setModels] = useState<AgyModelOption[]>(FALLBACK_MODELS);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const [sessionArtifacts, setSessionArtifacts] = useState<SessionArtifactsResponse>({
    tasks: [],
    artifacts: [],
    processes: [],
  });
  const [selectedTaskModal, setSelectedTaskModal] = useState<BackgroundTaskItem | null>(null);
  const [selectedArtifactModal, setSelectedArtifactModal] = useState<BrainArtifactItem | null>(
    null
  );

  // Desktop docked sidebars vs Mobile/Tablet Radix Sheet drawers
  const [desktopLeftOpen, setDesktopLeftOpen] = useState(true);
  const [desktopRightOpen, setDesktopRightOpen] = useState(true);
  const [mobileLeftSheetOpen, setMobileLeftSheetOpen] = useState(false);
  const [mobileRightSheetOpen, setMobileRightSheetOpen] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [cwdDraft, setCwdDraft] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialLoadDoneRef = useRef(false);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // Group models by provider for Radix Select
  const groupedModels = useMemo(() => {
    const groups: Record<string, AgyModelOption[]> = {};
    for (const m of models) {
      const p = m.provider || 'Other';
      if (!groups[p]) groups[p] = [];
      groups[p].push(m);
    }
    return groups;
  }, [models]);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  // Verify authentication on mount
  useEffect(() => {
    fetch('/api/auth/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.authRequired || data.authenticated) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, [token]);

  const fetchModels = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshingModels(true);
      try {
        const res = await apiFetch(`/api/models${refresh ? '?refresh=true' : ''}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
          }
        }
      } finally {
        setRefreshingModels(false);
      }
    },
    [apiFetch]
  );

  const fetchTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      const res = await apiFetch('/api/system');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } finally {
      setLoadingTelemetry(false);
    }
  }, [apiFetch]);

  const fetchSessionArtifacts = useCallback(
    async (sessionId?: string | null) => {
      const targetId = sessionId ?? activeSessionId;
      if (!targetId) return;
      try {
        const res = await apiFetch(`/api/sessions/${targetId}/artifacts`);
        if (res.ok) {
          const data: SessionArtifactsResponse = await res.json();
          setSessionArtifacts(data);
          setSelectedTaskModal((prev) =>
            prev ? data.tasks.find((t) => t.id === prev.id) || prev : null
          );

          // Sync any stopped/completed background task status into message toolCalls
          const taskMap = new Map(data.tasks.map((t) => [t.id, t]));
          if (taskMap.size > 0) {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== targetId) return s;
                let changed = false;
                const nextMessages = s.messages.map((m) => {
                  if (!m.toolCalls || m.toolCalls.length === 0) return m;
                  let msgChanged = false;
                  const nextTc = m.toolCalls.map((tc) => {
                    if (tc.taskId && taskMap.has(tc.taskId)) {
                      const liveTask = taskMap.get(tc.taskId)!;
                      if (tc.status === 'running' && liveTask.status !== 'running') {
                        msgChanged = true;
                        changed = true;
                        return {
                          ...tc,
                          status: liveTask.status,
                          output: liveTask.logTail || tc.output,
                        };
                      }
                    }
                    return tc;
                  });
                  return msgChanged ? { ...m, toolCalls: nextTc } : m;
                });
                return changed ? { ...s, messages: nextMessages } : s;
              })
            );
          }
        }
      } catch {
        // ignore
      }
    },
    [apiFetch, activeSessionId]
  );

  const killProcess = useCallback(
    async (pid: number) => {
      await apiFetch(`/api/processes/${pid}/kill`, { method: 'POST' });
      fetchSessionArtifacts();
    },
    [apiFetch, fetchSessionArtifacts]
  );

  const stopTask = useCallback(
    async (taskId: string) => {
      if (!activeSessionId) return;
      await apiFetch(`/api/sessions/${activeSessionId}/tasks/${taskId}/stop`, {
        method: 'POST',
      });
      fetchSessionArtifacts(activeSessionId);
    },
    [apiFetch, activeSessionId, fetchSessionArtifacts]
  );

  useEffect(() => {
    if (!authenticated || !activeSessionId) return;
    fetchSessionArtifacts(activeSessionId);
    const interval = setInterval(() => fetchSessionArtifacts(activeSessionId), 4000);
    return () => clearInterval(interval);
  }, [authenticated, activeSessionId, fetchSessionArtifacts]);

  const createNewSession = useCallback(async () => {
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Server Session',
        model: 'gemini-4-argon-medium',
        effort: 'medium',
      }),
    });
    if (res.ok) {
      const created: ChatSession = await res.json();
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setCwdDraft(created.cwd);
      setMobileLeftSheetOpen(false);
      return created;
    }
    return null;
  }, [apiFetch]);

  // Initial load of sessions and telemetry (only runs once when authenticated becomes true)
  useEffect(() => {
    if (!authenticated) {
      initialLoadDoneRef.current = false;
      return;
    }

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      fetchModels(false);

      apiFetch('/api/sessions')
        .then((r) => r.json())
        .then(async (list: ChatSession[]) => {
          if (Array.isArray(list) && list.length > 0) {
            setSessions(list);
            setActiveSessionId((prev) => prev || list[0].id);
            setCwdDraft(list[0].cwd);
          } else {
            await createNewSession();
          }
        });
    }

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, [authenticated, apiFetch, createNewSession, fetchTelemetry, fetchModels]);

  // Connect WebSocket
  useEffect(() => {
    if (!authenticated) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'turn_start') {
          setStreamingSessionId(data.sessionId);
          setStderrLogs('');
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== data.sessionId) return s;
              const assistantPlaceholder: ChatMessage = {
                id: data.assistantMessageId,
                role: 'assistant',
                content: '',
                thinking: '',
                toolCalls: [],
                model: s.model || 'default',
                timestamp: new Date().toISOString(),
              };
              return {
                ...s,
                title: data.sessionTitle || s.title,
                messages: [...s.messages, data.userMessage, assistantPlaceholder],
              };
            })
          );
        } else if (data.type === 'agy_init') {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === data.sessionId
                ? { ...s, agyConversationId: data.conversationId || s.agyConversationId }
                : s
            )
          );
        } else if (data.type === 'thinking_delta') {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== data.sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === data.messageId
                    ? { ...m, thinking: (m.thinking || '') + data.delta }
                    : m
                ),
              };
            })
          );
        } else if (data.type === 'text_delta') {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== data.sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === data.messageId ? { ...m, content: m.content + data.delta } : m
                ),
              };
            })
          );
        } else if (data.type === 'tool_calls_update') {
          fetchSessionArtifacts(data.sessionId);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== data.sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === data.messageId ? { ...m, toolCalls: data.toolCalls } : m
                ),
              };
            })
          );
        } else if (data.type === 'stderr_log') {
          setStderrLogs((prev) => (prev + data.text).slice(-1500));
        } else if (
          data.type === 'turn_result' ||
          data.type === 'turn_complete' ||
          data.type === 'turn_error'
        ) {
          if (data.type === 'turn_complete' || data.type === 'turn_error') {
            setStreamingSessionId(null);
            fetchTelemetry();
            fetchSessionArtifacts(data.sessionId);
          }
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== data.sessionId) return s;
              return {
                ...s,
                agyConversationId: data.conversationId || s.agyConversationId,
                messages: s.messages.map((m) => {
                  if (m.id !== data.messageId) return m;
                  if (data.message) return data.message;
                  if (data.error) return { ...m, error: data.error };
                  return m;
                }),
              };
            })
          );
        } else if (data.type === 'stopped') {
          setStreamingSessionId(null);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [authenticated, token, fetchTelemetry]);

  // Auto-scroll chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('agy_auth_token', data.token);
      setToken(data.token);
      setAuthenticated(true);
    } else {
      setLoginError('Invalid password. Check AUTH_PASSWORD in your .env file.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agy_auth_token');
    setToken('');
    setAuthenticated(false);
  };

  const sendPrompt = useCallback(
    (textToSend: string) => {
      const prompt = textToSend.trim();
      if (!prompt || !activeSessionId || !wsRef.current) return;

      wsRef.current.send(
        JSON.stringify({
          type: 'chat',
          sessionId: activeSessionId,
          prompt,
        })
      );
      setMobileLeftSheetOpen(false);
      setMobileRightSheetOpen(false);
    },
    [activeSessionId]
  );

  const stopGeneration = useCallback(() => {
    if (!activeSessionId || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'stop',
        sessionId: activeSessionId,
      })
    );
  }, [activeSessionId]);

  const updateSessionSettings = async (patch: Partial<ChatSession>) => {
    if (!activeSession) return;
    const res = await apiFetch(`/api/sessions/${activeSession.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  const deleteSession = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
        setCwdDraft(remaining[0].cwd);
      } else {
        createNewSession();
      }
    }
  };

  const clearAllSessions = async () => {
    if (!window.confirm('Delete all conversations?')) return;
    await apiFetch('/api/sessions', { method: 'DELETE' });
    setSessions([]);
    setActiveSessionId(null);
    await createNewSession();
  };

  const activeModelObj = models.find((m) => m.id === activeSession?.model);
  const currentModelDisplay = activeModelObj
    ? activeModelObj.label
    : activeSession?.model || 'Default CLI Model';

  // Reusable Left Sidebar Content (Constrained width so cards never overflow)
  const renderLeftSidebarContent = () => (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between pr-12 lg:pr-3.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Terminal className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">Antigravity</div>
            <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">root/auto-approve</span>
            </div>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" onClick={createNewSession} className="shrink-0">
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Conversation</TooltipContent>
        </Tooltip>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 w-full min-w-0">
        <div className="p-2 w-full min-w-0 overflow-hidden">
          <div className="px-2 py-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Conversations ({sessions.length})
            </span>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={clearAllSessions}
                className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-1 mt-1 w-full min-w-0">
            {sessions.map((s) => {
              const isSelected = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setCwdDraft(s.cwd);
                    setMobileLeftSheetOpen(false);
                  }}
                  className={`group w-full min-w-0 overflow-hidden flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/15 text-indigo-200 border border-indigo-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2 overflow-hidden">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                      {s.agyConversationId
                        ? `agy:${s.agyConversationId.slice(0, 8)}`
                        : 'new thread'}{' '}
                      • {s.model ? s.model.replace(/-medium|-high|-low$/, '') : 'default'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete conversation"
                    onClick={(e) => deleteSession(s.id, e)}
                    className="size-7 shrink-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Quick Server Actions */}
      <div className="p-2.5 border-t border-zinc-800/80 bg-zinc-950/40 shrink-0 w-full min-w-0 overflow-hidden">
        <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Quick Server Commands
        </div>
        <div className="grid grid-cols-1 gap-1 w-full min-w-0">
          {QUICK_PRESETS.slice(0, 4).map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                onClick={() => sendPrompt(preset.prompt)}
                disabled={Boolean(streamingSessionId)}
                className="w-full min-w-0 justify-start text-zinc-300 hover:text-white font-normal overflow-hidden"
              >
                <Icon className="size-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">{preset.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 shrink-0 w-full min-w-0">
        <span className="font-mono truncate pr-2">{telemetry?.hostname || 'home-server'}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleLogout}
          className="text-zinc-400 hover:text-rose-400 shrink-0"
        >
          <LogOut className="size-3.5" />
          <span>Lock</span>
        </Button>
      </div>
    </div>
  );

  // Reusable Right Telemetry Content (Constrained width so cards never overflow)
  const renderTelemetryContent = () => (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="h-14 px-4 border-b border-zinc-800/80 flex items-center justify-between pr-12 lg:pr-4 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 min-w-0">
          <Server className="size-4 text-indigo-400 shrink-0" />
          <span className="truncate">Server Telemetry</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={fetchTelemetry} className="shrink-0">
              <RefreshCw className={`size-3.5 ${loadingTelemetry ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh Telemetry</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1 w-full min-w-0">
        <div className="p-3.5 w-full min-w-0 overflow-hidden">
          {telemetry ? (
            <div className="space-y-4 text-xs w-full min-w-0">
              {/* Host Summary Card */}
              <Card className="p-3 gap-2 bg-zinc-950/60 w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-zinc-400 shrink-0">Host</span>
                  <span className="font-mono font-medium text-zinc-200 truncate">
                    {telemetry.hostname}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-zinc-400 shrink-0">Uptime</span>
                  <span className="font-mono text-zinc-300 truncate">
                    {formatUptime(telemetry.uptimeSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-zinc-400 shrink-0">CPU Load</span>
                  <span className="font-mono text-zinc-300 truncate">
                    {telemetry.loadAvg.join(' / ')} ({telemetry.cpuCount}c)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-zinc-400 shrink-0">AGY CLI</span>
                  <Badge variant={telemetry.agy.available ? 'success' : 'destructive'}>
                    {telemetry.agy.available ? 'Connected' : 'Not Found'}
                  </Badge>
                </div>
              </Card>

              {/* RAM & Disk Bars using Radix Progress */}
              <div className="space-y-3 w-full min-w-0">
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                    <span className="text-zinc-400 shrink-0">Memory</span>
                    <span className="font-mono text-zinc-300 text-[11px] truncate">
                      {formatBytes(telemetry.memory.usedBytes)} /{' '}
                      {formatBytes(telemetry.memory.totalBytes)} ({telemetry.memory.percent}%)
                    </span>
                  </div>
                  <Progress
                    value={telemetry.memory.percent}
                    indicatorClassName={
                      telemetry.memory.percent > 85 ? 'bg-rose-500' : 'bg-indigo-500'
                    }
                  />
                </div>

                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                    <span className="text-zinc-400 shrink-0">Root Disk (/)</span>
                    <span className="font-mono text-zinc-300 text-[11px] truncate">
                      {telemetry.disk.used} / {telemetry.disk.size} ({telemetry.disk.usePercent})
                    </span>
                  </div>
                  <Progress
                    value={parseInt(telemetry.disk.usePercent, 10) || 0}
                    indicatorClassName="bg-emerald-500"
                  />
                </div>
              </div>

              <Separator />

              {/* Docker Containers */}
              <div className="space-y-2.5 w-full min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-semibold uppercase tracking-wider text-zinc-400 text-[10px] truncate">
                    Docker Containers ({telemetry.docker.containers.length})
                  </span>
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() =>
                      sendPrompt('Run `docker ps -a` and summarize the status of all containers.')
                    }
                    className="h-auto p-0 text-[11px] shrink-0"
                  >
                    Ask AGY
                  </Button>
                </div>

                {!telemetry.docker.available ? (
                  <Card className="p-3 bg-zinc-950/50 text-zinc-500 w-full min-w-0">
                    Docker socket not detected or Docker daemon is not running.
                  </Card>
                ) : telemetry.docker.containers.length === 0 ? (
                  <Card className="p-3 bg-zinc-950/50 text-zinc-500 w-full min-w-0">
                    No containers found on host.
                  </Card>
                ) : (
                  <div className="space-y-2 w-full min-w-0">
                    {telemetry.docker.containers.map((c) => {
                      const isRunning = c.state === 'running';
                      return (
                        <Card
                          key={c.id}
                          className="p-2.5 gap-2 bg-zinc-950/60 rounded-xl w-full min-w-0 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isRunning ? 'bg-emerald-400' : 'bg-zinc-500'
                                }`}
                              />
                              <span className="font-mono font-medium text-zinc-200 truncate">
                                {c.name}
                              </span>
                            </div>
                            <Badge variant={isRunning ? 'success' : 'secondary'} className="shrink-0">
                              {c.state}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate w-full min-w-0">
                            {c.image} • {c.status}
                          </div>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={Boolean(streamingSessionId)}
                              onClick={() =>
                                sendPrompt(
                                  `Restart the Docker container "${c.name}" and verify it starts cleanly.`
                                )
                              }
                            >
                              <Play className="size-3 text-emerald-400" />
                              Restart
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={Boolean(streamingSessionId)}
                              onClick={() =>
                                sendPrompt(
                                  `Check the last 80 lines of logs for Docker container "${c.name}" and explain if there are any errors.`
                                )
                              }
                            >
                              <FileText className="size-3 text-indigo-400" />
                              Logs
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-zinc-500 py-8 text-center text-xs">Loading server stats...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Reusable Radix Select for choosing Antigravity Model
  const renderModelSelect = (triggerClassName?: string) => {
    if (!activeSession) return null;
    const selectVal = activeSession.model || '__default__';
    return (
      <Select
        value={selectVal}
        onValueChange={(val) =>
          updateSessionSettings({ model: val === '__default__' ? '' : val })
        }
      >
        <SelectTrigger className={triggerClassName}>
          <div className="flex items-center gap-1.5 truncate">
            <Bot className="size-3.5 text-indigo-400 shrink-0" />
            <SelectValue placeholder="Default CLI Model" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">Default CLI Model</SelectItem>
          <SelectSeparator />
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {providerModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const mobileControlsNode = activeSession ? (
    <div className="flex sm:hidden items-center justify-between gap-2">
      <div className="flex-1 min-w-0">{renderModelSelect('h-7 text-[11px]')}</div>
      <div className="w-28 shrink-0">
        <Select
          value={activeSession.effort || 'medium'}
          onValueChange={(val) => updateSessionSettings({ effort: val })}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue placeholder="Effort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="xhigh">X-High</SelectItem>
            <SelectItem value="max">Max</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ) : null;

  if (!authChecked) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Loading Antigravity Control Center...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl backdrop-blur">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Terminal className="size-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Antigravity Server UI</CardTitle>
                <CardDescription className="mt-1">
                  Connected to{' '}
                  <code className="text-amber-400">--dangerously-skip-permissions</code>
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Server Access Password</Label>
                <div className="relative">
                  <Lock className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password from .env (default: admin)"
                    autoFocus
                    className="pl-10 h-10 text-sm"
                  />
                </div>
              </div>
              {loginError && <p className="text-xs text-rose-400">{loginError}</p>}
              <Button type="submit" size="lg" className="w-full">
                Unlock Control Center
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-zinc-950 text-zinc-100 relative">
      {/* Mobile/Tablet Left Drawer using Radix Sheet */}
      <Sheet open={mobileLeftSheetOpen} onOpenChange={setMobileLeftSheetOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations & Presets</SheetTitle>
            <SheetDescription>Switch sessions or trigger quick server commands</SheetDescription>
          </SheetHeader>
          {renderLeftSidebarContent()}
        </SheetContent>
      </Sheet>

      {/* Mobile/Tablet Right Drawer using Radix Sheet */}
      <Sheet open={mobileRightSheetOpen} onOpenChange={setMobileRightSheetOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Server Telemetry & Docker</SheetTitle>
            <SheetDescription>Live system stats and container controls</SheetDescription>
          </SheetHeader>
          {renderTelemetryContent()}
        </SheetContent>
      </Sheet>

      {/* Desktop Left Sidebar */}
      {desktopLeftOpen && (
        <aside className="hidden lg:flex w-72 shrink-0 border-r border-zinc-800/80 bg-zinc-900/50 flex-col overflow-hidden">
          {renderLeftSidebarContent()}
        </aside>
      )}

      {/* Center Column: Chat Interface */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        {/* Top Header */}
        <header className="h-14 shrink-0 border-b border-zinc-800/80 px-3 sm:px-4 flex items-center justify-between gap-2 bg-zinc-900/30">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileLeftSheetOpen(true);
                } else {
                  setDesktopLeftOpen(!desktopLeftOpen);
                }
              }}
            >
              <Menu className="size-4" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100 truncate">
                  {activeSession?.title || 'Server Session'}
                </h2>
                <Badge variant="warning" className="hidden xl:inline-flex font-mono">
                  <ShieldAlert className="size-3" />
                  --dangerously-skip-permissions
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono truncate sm:hidden">
                {currentModelDisplay} • {activeSession?.execMode || 'local'}
              </div>
            </div>
          </div>

          {/* Header Controls */}
          {activeSession && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Desktop Radix Model Selector */}
              <div className="hidden sm:block w-52">{renderModelSelect()}</div>

              {/* Desktop Radix Effort Selector */}
              <div className="hidden md:block w-32">
                <Select
                  value={activeSession.effort || 'medium'}
                  onValueChange={(val) => updateSessionSettings({ effort: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Effort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Effort: Low</SelectItem>
                    <SelectItem value="medium">Effort: Medium</SelectItem>
                    <SelectItem value="high">Effort: High</SelectItem>
                    <SelectItem value="xhigh">Effort: X-High</SelectItem>
                    <SelectItem value="max">Effort: Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Session Config Dialog Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCwdDraft(activeSession.cwd);
                  setShowSettingsDialog(true);
                }}
              >
                <SlidersHorizontal className="size-3.5 text-indigo-400" />
                <span className="hidden lg:inline">Session Config</span>
              </Button>

              {/* Delete Current Session Button */}
              <Button
                variant="outline"
                size="icon-sm"
                title="Delete Current Conversation"
                onClick={() => deleteSession(activeSession.id)}
                className="text-zinc-400 hover:text-rose-400 hover:border-rose-500/40"
              >
                <Trash2 className="size-4" />
              </Button>

              {/* Toggle Server Telemetry */}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileRightSheetOpen(true);
                  } else {
                    setDesktopRightOpen(!desktopRightOpen);
                  }
                }}
                className={
                  desktopRightOpen
                    ? 'lg:bg-indigo-600/20 lg:border-indigo-500/40 lg:text-indigo-300'
                    : ''
                }
              >
                <Server className="size-4" />
              </Button>
            </div>
          )}
        </header>

        {/* In-Chat Running Dev Servers, Background Tasks & Brain Artifacts Bar */}
        {(sessionArtifacts.processes.length > 0 ||
          sessionArtifacts.tasks.some((t) => t.status === 'running') ||
          sessionArtifacts.artifacts.length > 0) && (
          <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-900/60 px-3 sm:px-4 py-2">
            <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 shrink-0 flex items-center gap-1">
                <Activity className="size-3 text-emerald-400" />
                Running / Artifacts:
              </span>

              {/* Running Dev Servers / Processes */}
              {sessionArtifacts.processes.map((proc) => (
                <div
                  key={proc.pid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-mono text-[11px] max-w-[180px] truncate" title={proc.command}>
                    {proc.command}
                  </span>
                  {proc.ports.length > 0 && (
                    <Badge variant="success" className="font-mono px-1.5 py-0">
                      :{proc.ports.join(', :')}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => killProcess(proc.pid)}
                    title={`Stop PID ${proc.pid}`}
                    className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    Stop
                  </button>
                </div>
              ))}

              {/* Active Background Tasks from AGY */}
              {sessionArtifacts.tasks
                .filter((task) => task.status === 'running')
                .map((task) => (
                  <div
                    key={task.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-amber-950/40 border-amber-500/40 text-amber-200 text-xs shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTaskModal(task)}
                      className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 bg-amber-400 animate-pulse" />
                      <span className="font-mono font-medium text-[11px]">{task.id}</span>
                      <span className="font-mono text-[11px] text-zinc-400 max-w-[150px] truncate">
                        {task.command}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => stopTask(task.id)}
                      title={`Stop ${task.id}`}
                      className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                ))}

              {/* Generated Brain Artifacts */}
              {sessionArtifacts.artifacts.map((art) => (
                <button
                  key={art.relativePath}
                  type="button"
                  onClick={() => setSelectedArtifactModal(art)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/30 hover:bg-indigo-950/60 text-xs text-indigo-200 shrink-0 transition-colors cursor-pointer"
                >
                  <FileText className="size-3 text-indigo-400 shrink-0" />
                  <span className="font-mono text-[11px] max-w-[150px] truncate">{art.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {(!activeSession || activeSession.messages.length === 0) && (
              <div className="py-6 sm:py-12 text-center space-y-5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                  <Zap className="size-6 sm:size-7" />
                </div>
                <div className="space-y-2 px-2">
                  <h3 className="text-lg sm:text-xl font-semibold text-zinc-100">
                    What should Antigravity do on your server?
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                    Running <code className="text-indigo-300">{currentModelDisplay}</code> with{' '}
                    <code className="text-amber-300">--dangerously-skip-permissions</code>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left max-w-2xl mx-auto pt-1">
                  {QUICK_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <Card
                        key={preset.label}
                        onClick={() => sendPrompt(preset.prompt)}
                        className="p-3.5 gap-1.5 bg-zinc-900/50 hover:bg-zinc-900 hover:border-indigo-500/40 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-indigo-400 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-200">
                            {preset.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{preset.prompt}</p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSession?.messages.map((msg, idx) => {
              const isLastAssistant =
                msg.role === 'assistant' && idx === activeSession.messages.length - 1;
              return (
                <ChatMessageBubble
                  key={msg.id}
                  msg={msg}
                  isStreaming={isLastAssistant && streamingSessionId === activeSession.id}
                />
              );
            })}

            {streamingSessionId === activeSession?.id && stderrLogs && (
              <Card className="p-3 gap-1 bg-zinc-950 text-[11px] font-mono text-zinc-400">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Live CLI Stream
                </div>
                <pre className="whitespace-pre-wrap overflow-x-auto max-h-28">{stderrLogs}</pre>
              </Card>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Isolated Bottom Prompt Bar (Zero input lag!) */}
        <ChatPromptBar
          isStreaming={Boolean(streamingSessionId)}
          onSend={sendPrompt}
          onStop={stopGeneration}
          mobileControls={mobileControlsNode}
        />
      </main>

      {/* Desktop Right Sidebar */}
      {desktopRightOpen && (
        <aside className="hidden lg:flex w-80 shrink-0 border-l border-zinc-800/80 bg-zinc-900/40 flex-col overflow-hidden">
          {renderTelemetryContent()}
        </aside>
      )}

      {/* Session Settings & Model Dialog using Radix Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-indigo-400" />
              Model & Session Configuration
            </DialogTitle>
            <DialogDescription>
              Choose any model provided by Antigravity CLI, adjust reasoning effort, or switch
              between Local and Host SSH execution.
            </DialogDescription>
          </DialogHeader>

          {activeSession && (
            <div className="space-y-4 py-1">
              {/* Antigravity Model Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Antigravity Model</Label>
                  <Button
                    variant="link"
                    size="xs"
                    type="button"
                    onClick={() => fetchModels(true)}
                    className="h-auto p-0 text-[11px]"
                  >
                    <RefreshCw className={`size-3 ${refreshingModels ? 'animate-spin' : ''}`} />
                    <span>Sync from CLI (`agy models`)</span>
                  </Button>
                </div>

                {renderModelSelect('h-9')}

                {/* Custom model ID override */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Or enter custom model ID (e.g. gemini-4-argon-high)"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (customModelInput.trim()) {
                        updateSessionSettings({ model: customModelInput.trim() });
                        setCustomModelInput('');
                      }
                    }}
                  >
                    Apply ID
                  </Button>
                </div>
              </div>

              {/* Reasoning Effort & Execution Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Reasoning Effort</Label>
                  <Select
                    value={activeSession.effort || 'medium'}
                    onValueChange={(val) => updateSessionSettings({ effort: val })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Fastest)</SelectItem>
                      <SelectItem value="medium">Medium (Balanced)</SelectItem>
                      <SelectItem value="high">High (Thorough)</SelectItem>
                      <SelectItem value="xhigh">X-High (Deep Reasoning)</SelectItem>
                      <SelectItem value="max">Max (Maximum Compute)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Execution Mode</Label>
                  <Select
                    value={activeSession.execMode}
                    onValueChange={(val) =>
                      updateSessionSettings({ execMode: val as 'local' | 'ssh' })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local / Container Mounts</SelectItem>
                      <SelectItem value="ssh">Host OS via SSH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Working Directory */}
              <div className="space-y-1.5">
                <Label>Server Working Directory (cwd)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FolderGit2 className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      value={cwdDraft}
                      onChange={(e) => setCwdDraft(e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => updateSessionSettings({ cwd: cwdDraft })}
                  >
                    Save CWD
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setShowSettingsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background Task Live Log Viewer Dialog */}
      <Dialog
        open={Boolean(selectedTaskModal)}
        onOpenChange={(open) => !open && setSelectedTaskModal(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Terminal className="size-4 text-amber-400" />
              <span>{selectedTaskModal?.id}</span>
              <Badge
                variant={selectedTaskModal?.status === 'running' ? 'warning' : 'success'}
              >
                {selectedTaskModal?.status === 'running' ? 'Running' : 'Completed'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs break-all">
              {selectedTaskModal?.command}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 max-h-[60dvh] overflow-y-auto">
            <pre className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {selectedTaskModal?.logTail || 'Waiting for task output...'}
            </pre>
          </div>
          <DialogFooter>
            {selectedTaskModal?.status === 'running' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => stopTask(selectedTaskModal.id)}
              >
                <Square className="size-3.5" />
                Stop Task
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSessionArtifacts(activeSessionId)}
            >
              <RefreshCw className="size-3.5" />
              Refresh Log
            </Button>
            <Button size="sm" onClick={() => setSelectedTaskModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brain Artifact Viewer Dialog */}
      <Dialog
        open={Boolean(selectedArtifactModal)}
        onOpenChange={(open) => !open && setSelectedArtifactModal(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <FileText className="size-4 text-indigo-400" />
              <span>{selectedArtifactModal?.name}</span>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {selectedArtifactModal?.relativePath}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 max-h-[65dvh] overflow-y-auto markdown-body text-sm">
            {selectedArtifactModal?.name.endsWith('.md') ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedArtifactModal.content}
              </ReactMarkdown>
            ) : (
              <pre className="text-xs font-mono text-zinc-200 whitespace-pre-wrap">
                {selectedArtifactModal?.content}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setSelectedArtifactModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
