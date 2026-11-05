import { X } from "lucide-react";
import { useState } from "react";
import { saveNote } from "../api";
import type { Domain, DomainId } from "../types";

interface QuickCaptureProps {
  domains: Domain[];
  initialDomain: DomainId;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickCapture({ domains, initialDomain, onClose, onSaved }: QuickCaptureProps) {
  const [domain, setDomain] = useState<DomainId>(initialDomain);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveNote({ title, body, domain });
      onSaved();
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">LOCAL NOTE</span>
            <h2 id="capture-title">留下今天的星点</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </header>
        <label>
          <span>归入领域</span>
          <select value={domain} onChange={(event) => setDomain(event.target.value as DomainId)}>
            {domains.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.subtitle}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>标题</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="今天发生了什么？"
          />
        </label>
        <label>
          <span>内容</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            placeholder="不用写得完整，真实比漂亮更重要。"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <span>资料保存在本机 Markdown 文件中</span>
          <button
            type="button"
            className="primary-action"
            disabled={saving || !title.trim() || !body.trim()}
            onClick={() => void submit()}
          >
            {saving ? "正在保存…" : "保存到 LifeOS"}
          </button>
        </footer>
      </section>
    </div>
  );
}
