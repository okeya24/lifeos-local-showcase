export type DomainId = "learning" | "work" | "body" | "mind" | "life" | "future";

export interface Domain {
  id: DomainId;
  label: string;
  subtitle: string;
  color: string;
  value: string;
  metric: string;
  summary: string;
  position: [number, number, number];
}

export interface Metric {
  label: string;
  value: string;
  detail: string;
}

export interface LifeEvent {
  time: string;
  domain: DomainId;
  title: string;
  detail: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  date: string;
  domain: DomainId;
  tags: string[];
  excerpt: string;
  modifiedAt: string;
}

export interface DashboardData {
  profile: { name: string; owner: string; mark: string };
  today: { date: string; label: string; title: string; subtitle: string };
  metrics: Metric[];
  domains: Domain[];
  events: LifeEvent[];
  noteCount: number;
  recentNotes: NoteSummary[];
}

export interface ModelStatus {
  online: boolean;
  model: string;
  modelAvailable: boolean;
  models: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; id: string; date: string }>;
}

export type ChatStreamEvent =
  | {
      type: "sources";
      sources: Array<{ title: string; id: string; date: string }>;
    }
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };
