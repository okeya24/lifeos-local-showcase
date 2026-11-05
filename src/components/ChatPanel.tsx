import { ArrowUpRight, Bot, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamChat } from "../api";
import type { ChatMessage, Domain, DomainId, ModelStatus } from "../types";

interface ChatPanelProps {
  domain: Domain;
  selectedDomain: DomainId;
  modelStatus: ModelStatus | null;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function ChatPanel({ domain, selectedDomain, modelStatus }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: newId(),
        role: "assistant",
        content: domain.summary
      }
    ]);
  }, [domain.id, domain.summary]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content: message
    };
    const assistantId = newId();
    const history = [...messages, userMessage];

    setMessages([
      ...history,
      {
        id: assistantId,
        role: "assistant",
        content: ""
      }
    ]);
    setDraft("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        message,
        history,
        domain: selectedDomain,
        signal: controller.signal,
        onEvent: (event) => {
          setMessages((current) =>
            current.map((item) => {
              if (item.id !== assistantId) return item;
              if (event.type === "delta") {
                return { ...item, content: item.content + event.content };
              }
              if (event.type === "sources") {
                return { ...item, sources: event.sources };
              }
              if (event.type === "error") {
                return {
                  ...item,
                  content: event.message
                };
              }
              return item;
            })
          );
        }
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content: `暂时无法连接本地模型。${
                    (error as Error).message || "请确认 Ollama 正在运行。"
                  }`
                }
              : item
          )
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <section className="chat-panel" aria-label="生命宇宙助手">
      <header className="chat-head">
        <div className="chat-mark">
          <Sparkles size={16} />
        </div>
        <div className="chat-identity">
          <strong>Cove</strong>
          <span>
            {modelStatus?.online
              ? `${modelStatus.model} · 本地`
              : "本地模型未连接"}
          </span>
        </div>
        <div className={`model-pulse ${modelStatus?.online ? "is-online" : ""}`} title="模型状态" />
      </header>

      <div className="chat-thread" ref={threadRef}>
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.role}`}>
            {message.role === "assistant" && (
              <div className="message-author">
                <Bot size={13} />
                <span>Cove</span>
              </div>
            )}
            <div className="message-body">
              {message.content || (
                <span className="typing">
                  <LoaderCircle size={13} />
                  正在阅读你的宇宙
                </span>
              )}
            </div>
            {message.sources && message.sources.length > 0 && (
              <div className="message-sources">
                {message.sources.map((source) => (
                  <span key={source.id} title={source.id}>
                    {source.title}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="quick-questions">
        <button type="button" onClick={() => void send("总结这个领域最近发生了什么。")}>
          总结最近
        </button>
        <button type="button" onClick={() => void send("找出一条最值得调整的事情。")}>
          找一条洞察
        </button>
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          aria-label="向 Cove 提问"
          placeholder="问你的资料、轨迹或下一步…"
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="发送">
          {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />}
        </button>
      </form>
    </section>
  );
}
