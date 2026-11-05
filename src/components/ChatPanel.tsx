import {
  ArrowUpRight,
  AudioLines,
  Bot,
  LoaderCircle,
  Mic,
  MicOff,
  Sparkles
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getVoiceStatus, streamChat } from "../api";
import { useVoiceConversation } from "../hooks/useVoiceConversation";
import type { ChatMessage, Domain, DomainId, ModelStatus } from "../types";

interface ChatPanelProps {
  domain: Domain;
  selectedDomain: DomainId;
  modelStatus: ModelStatus | null;
}

const voiceLabels = {
  off: "语音已关闭",
  requesting: "正在请求麦克风",
  listening: "正在聆听，直接说话即可",
  hearing: "听到了，请继续说",
  transcribing: "正在理解你的话",
  thinking: "正在查找资料",
  speaking: "正在回答，随时可以插话",
  error: "语音需要处理"
} as const;

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function stripForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "代码示例已省略。")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/【来源：[^】]+】/g, "")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function takeSentences(text: string) {
  const matches = text.match(/[^。！？!?；;\n]+[。！？!?；;\n]+/g) ?? [];
  const used = matches.join("");
  return {
    sentences: matches.map(stripForSpeech).filter(Boolean),
    rest: text.slice(used.length)
  };
}

function chooseChineseVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return (
    voices.find((voice) => /Tingting|Meijia|婷婷|美佳/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ??
    null
  );
}

export function ChatPanel({ domain, selectedDomain, modelStatus }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceServiceOnline, setVoiceServiceOnline] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const activeAssistantTextRef = useRef("");

  function interruptResponse() {
    abortRef.current?.abort();
    globalThis.speechSynthesis?.cancel();
    setBusy(false);
    voice.setAgentBusy(false);
    voice.setAgentSpeaking(false);
  }

  async function handleVoiceTranscript(text: string) {
    await send(text);
  }

  const voice = useVoiceConversation({
    onTranscript: handleVoiceTranscript,
    onBargeIn: interruptResponse
  });

  function speakSentence(rawText: string) {
    if (!voice.enabled || !globalThis.speechSynthesis) return;
    const text = stripForSpeech(rawText).slice(0, 500);
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = chooseChineseVoice();
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.lang = "zh-CN";
    utterance.rate = 1.04;
    utterance.pitch = 0.98;
    utterance.onstart = () => voice.setAgentSpeaking(true);
    utterance.onend = () => {
      if (!speechSynthesis.speaking && !speechSynthesis.pending) {
        voice.setAgentSpeaking(false);
        voice.setAgentBusy(false);
      }
    };
    speechSynthesis.speak(utterance);
  }

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

  useEffect(() => {
    void getVoiceStatus()
      .then((status) => setVoiceServiceOnline(status.online))
      .catch(() => setVoiceServiceOnline(false));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    globalThis.speechSynthesis?.cancel();
    activeAssistantTextRef.current = "";
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
    voice.setAgentBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let speechBuffer = "";

    const flushSpeechBuffer = (force = false) => {
      if (!voice.enabled) return;
      const result = takeSentences(speechBuffer);
      if (result.sentences.length) {
        speechBuffer = result.rest;
        result.sentences.forEach(speakSentence);
      }
      if (force && speechBuffer.trim()) {
        speakSentence(speechBuffer);
        speechBuffer = "";
      }
    };

    try {
      await streamChat({
        message,
        history,
        domain: selectedDomain,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "delta") {
            activeAssistantTextRef.current += event.content;
            speechBuffer += event.content;
            flushSpeechBuffer();
          }
          if (event.type === "done") {
            flushSpeechBuffer(true);
          }
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
      if (
        voice.enabled &&
        !globalThis.speechSynthesis?.speaking &&
        !globalThis.speechSynthesis?.pending
      ) {
        voice.setAgentBusy(false);
      }
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
        <button
          type="button"
          className={`voice-toggle ${voice.enabled ? "is-active" : ""}`}
          onClick={voice.toggleVoice}
          aria-pressed={voice.enabled}
          title={voice.enabled ? "关闭语音对话" : "开启连续语音对话"}
        >
          {voice.enabled ? <Mic size={14} /> : <MicOff size={14} />}
        </button>
        <div
          className={`model-pulse ${modelStatus?.online ? "is-online" : ""}`}
          title="模型状态"
        />
      </header>

      {voice.enabled && (
        <div className={`voice-console ${voice.phase === "error" ? "is-error" : ""}`} aria-live="polite">
          <div className="voice-state-line">
            <AudioLines size={13} />
            <span>{voiceLabels[voice.phase]}</span>
            {voiceServiceOnline === false && <small>Whisper 未连接</small>}
          </div>
          <div className="voice-level" aria-hidden="true">
            {[0.52, 0.84, 1, 0.72, 0.94, 0.61, 0.8].map((factor, index) => (
              <span
                key={index}
                style={{ transform: `scaleY(${Math.max(0.12, voice.level * factor)})` }}
              />
            ))}
          </div>
          {voice.error && <p>{voice.error}</p>}
          {voice.previewText && (
            <p className="voice-preview">{voice.previewText}</p>
          )}
        </div>
      )}

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
                  <LoaderCircle className="spin" size={13} />
                  {voice.phase === "transcribing" ? "正在理解你的话" : "正在阅读你的宇宙"}
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
          placeholder={voice.enabled ? "正在语音对话，也可以直接输入…" : "问你的资料、轨迹或下一步…"}
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="发送">
          {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />}
        </button>
      </form>
    </section>
  );
}
