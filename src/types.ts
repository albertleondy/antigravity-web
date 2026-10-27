export interface AgyModelOption {
  id: string;
  label: string;
  provider: string;
}

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

export interface SessionArtifactsResponse {
  tasks: BackgroundTaskItem[];
  artifacts: BrainArtifactItem[];
  processes: RunningProcessItem[];
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

export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
}

export interface SystemTelemetry {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpuCount: number;
  loadAvg: number[];
  memory: {
    totalBytes: number;
    usedBytes: number;
    percent: number;
  };
  disk: {
    size: string;
    used: string;
    avail: string;
    usePercent: string;
  };
  docker: {
    available: boolean;
    containers: DockerContainerInfo[];
  };
  agy: {
    available: boolean;
    bin: string;
    defaultExecMode: 'local' | 'ssh';
  };
}
