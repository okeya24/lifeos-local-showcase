import type {
  ChatMessage,
  ChatStreamEvent,
  DashboardData,
  DomainId,
  ModelStatus,
  NoteSummary
} from "./types";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getDashboard() {
  return requestJson<DashboardData>("/api/dashboard");
}

export function getModelStatus() {
  return requestJson<ModelStatus>("/api/status");
}

export function getVoiceStatus() {
  return requestJson<{ online: boolean; language: string; url: string }>(
    "/api/voice/status"
  );
}

export async function transcribeAudio(blob: Blob) {
  const response = await fetch("/api/voice/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "application/octet-stream"
    },
    body: blob
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail || detail?.error || "本地语音识别失败。");
  }
  return response.json() as Promise<{ text: string; language: string }>;
}

export function getNotes(domain?: DomainId) {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return requestJson<NoteSummary[]>(`/api/notes${query}`);
}

export function saveNote(input: {
  title: string;
  body: string;
  domain: DomainId;
  tags?: string[];
}) {
  return requestJson<{ ok: true; path: string; title: string; domain: DomainId }>(
    "/api/notes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
}

export async function streamChat(input: {
  message: string;
  history: ChatMessage[];
  domain: DomainId;
  signal?: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      domain: input.domain,
      history: input.history.map(({ role, content }) => ({ role, content }))
    }),
    signal: input.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`对话请求失败：${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseLine = (line: string) => {
    if (!line.trim()) return;
    input.onEvent(JSON.parse(line) as ChatStreamEvent);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      parseLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  parseLine(buffer);
}
