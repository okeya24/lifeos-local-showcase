import {
  Activity,
  Brain,
  Briefcase,
  CalendarDays,
  CirclePlus,
  Database,
  LayoutDashboard,
  Network,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Target
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getDashboard, getModelStatus, getNotes } from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { QuickCapture } from "./components/QuickCapture";
import { UniverseScene } from "./components/UniverseScene";
import type { DashboardData, DomainId, ModelStatus, NoteSummary } from "./types";

const navItems = [
  { id: "universe", label: "人生宇宙", icon: Orbit },
  { id: "body", label: "身体", icon: Activity },
  { id: "learning", label: "学习", icon: Brain },
  { id: "work", label: "工作", icon: Briefcase },
  { id: "network", label: "知识网络", icon: Network },
  { id: "calendar", label: "时间轨迹", icon: CalendarDays },
  { id: "data", label: "本地数据", icon: Database }
] as const;

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainId>("learning");
  const [activeNav, setActiveNav] = useState("universe");
  const [paused, setPaused] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [error, setError] = useState("");

  async function refreshNotes(domain?: DomainId) {
    const nextNotes = await getNotes(domain);
    setNotes(nextNotes);
  }

  useEffect(() => {
    Promise.all([getDashboard(), getModelStatus(), getNotes("learning")])
      .then(([nextDashboard, nextStatus, nextNotes]) => {
        setDashboard(nextDashboard);
        setModelStatus(nextStatus);
        setNotes(nextNotes);
      })
      .catch((nextError) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "无法连接本地 LifeOS 服务。"
        );
      });
  }, []);

  useEffect(() => {
    if (!dashboard) return;
    void refreshNotes(selectedDomain).catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "读取资料失败。");
    });
  }, [dashboard, selectedDomain]);

  if (!dashboard) {
    return (
      <main className="boot-screen">
        <div className="boot-orb">
          <Orbit size={28} />
        </div>
        <span className="eyebrow">LIFE//OS</span>
        <h1>{error ? "本地宇宙没有启动" : "正在聚集你的星点…"}</h1>
        <p>
          {error ||
            "正在读取本地资料，并连接你的私人成长模型。"}
        </p>
        {error && (
          <code>在项目目录运行：pnpm dev</code>
        )}
      </main>
    );
  }

  const domain =
    dashboard.domains.find((item) => item.id === selectedDomain) ?? dashboard.domains[0];

  return (
    <div className="lifeos-shell">
      <aside className="space-rail" aria-label="主导航">
        <div className="space-logo" aria-label="LifeOS">
          L
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activeNav === item.id ? "is-active" : ""}
                onClick={() => {
                  setActiveNav(item.id);
                  if (item.id === "body" || item.id === "learning" || item.id === "work") {
                    setSelectedDomain(item.id);
                  }
                }}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={18} strokeWidth={1.7} />
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className="rail-add"
          onClick={() => setCaptureOpen(true)}
          aria-label="新建记录"
          title="新建记录"
        >
          <CirclePlus size={19} strokeWidth={1.6} />
        </button>
      </aside>

      <main className="space-main">
        <header className="space-header">
          <div>
            <div className="header-meta">
              <span>{dashboard.today.label}</span>
              <span className="header-separator" />
              <span>LOCAL · {dashboard.noteCount} NOTES</span>
            </div>
            <h1>{dashboard.today.title}</h1>
            <p>{dashboard.today.subtitle}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="search-button">
              <Search size={15} />
              <span>搜索记忆星球</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              type="button"
              className="capture-button"
              onClick={() => setCaptureOpen(true)}
            >
              <CirclePlus size={15} />
              记录
            </button>
          </div>
        </header>

        <div className="universe-stage">
          <UniverseScene
            domains={dashboard.domains}
            selected={selectedDomain}
            paused={paused}
            onSelect={setSelectedDomain}
          />
          <div className="scene-actions">
            <button
              type="button"
              className="glass-button"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? "继续自转" : "暂停自转"}
            </button>
            <button
              type="button"
              className="glass-button"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={13} />
              重置视角
            </button>
          </div>
          <div className="domain-orbit-nav" aria-label="切换领域">
            {dashboard.domains.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === selectedDomain ? "is-active" : ""}
                onClick={() => setSelectedDomain(item.id)}
                style={{ "--domain-color": item.color } as CSSProperties}
              >
                <span />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <section className="metric-strip" aria-label="总体数据">
          {dashboard.metrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="event-strip" aria-label="今日轨迹">
          <div className="event-heading">
            <span className="eyebrow">TODAY'S ORBIT</span>
            <strong>今天的轨迹</strong>
          </div>
          <div className="event-list">
            {dashboard.events.map((event) => (
              <article key={`${event.time}-${event.title}`}>
                <time>{event.time}</time>
                <div>
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside className="insight-panel">
        <section className="selected-planet">
          <div className="selected-topline">
            <span className="eyebrow">SELECTED PLANET</span>
            <span
              className="domain-signal"
              style={{ backgroundColor: domain.color }}
            />
          </div>
          <div className="selected-value">{domain.value}</div>
          <h2>
            {domain.label} · {domain.metric}
          </h2>
          <p>{domain.summary}</p>
        </section>

        <section className="recent-notes">
          <header>
            <div>
              <span className="eyebrow">RECENT TRACES</span>
              <h3>{domain.label}的最近资料</h3>
            </div>
            <span>{notes.length}</span>
          </header>
          <div>
            {notes.slice(0, 3).map((note) => (
              <article key={note.id}>
                <span>{note.date}</span>
                <strong>{note.title}</strong>
                <p>{note.excerpt}</p>
              </article>
            ))}
            {notes.length === 0 && (
              <p className="empty-notes">
                这里还没有记录。留下第一条后，AI 就能围绕它与你对话。
              </p>
            )}
          </div>
        </section>

        <ChatPanel
          domain={domain}
          selectedDomain={selectedDomain}
          modelStatus={modelStatus}
        />
      </aside>

      {captureOpen && (
        <QuickCapture
          domains={dashboard.domains}
          initialDomain={selectedDomain}
          onClose={() => setCaptureOpen(false)}
          onSaved={async () => {
            await refreshNotes(selectedDomain);
            const refreshed = await getDashboard();
            setDashboard(refreshed);
          }}
        />
      )}
    </div>
  );
}
