# LifeOS Local v0.1.0 — Developer Preview

第一版可运行的个人成长 3D 驾驶舱。

## Highlights

- Interactive 3D life universe powered by Three.js
- Six life domains with selectable planets
- Local Markdown note storage
- Quick capture directly into the selected domain
- Streaming local AI chat through Ollama
- Relevant-note context and source labels
- Model-provider adapter for future Dify or cloud models
- Responsive desktop and mobile layouts
- No cloud account or API key required

## Start

```bash
pnpm install
ollama pull qwen2.5:7b
pnpm dev
```

Open <http://127.0.0.1:5173>.

## Requirements

- Node.js 20+
- pnpm 10+
- Ollama

## Known limitations

- Developer preview, not a one-click consumer app
- Lightweight recent-note selection instead of full vector retrieval
- No PDF, Pages, Word, image OCR or Apple Health import yet
- No account, multi-device sync or cloud deployment yet

Feedback and feature requests are welcome in GitHub Issues.
