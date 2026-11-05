# Development

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

## Main folders

| Folder | Purpose |
| --- | --- |
| `src/` | React UI and Three.js scene |
| `server/` | Local Express API and model adapters |
| `data/` | Demo dashboard data |
| `vault/` | Demo Markdown notes |
| `docs/` | Architecture and product documentation |

## Add a model provider

1. Add an adapter under `server/providers/`.
2. Implement status checking and streaming chat.
3. Register it in `server/providers/index.mjs`.
4. Select it with `MODEL_PROVIDER`.

Do not couple React components directly to a model provider.

## Add a note domain

Update:

- `src/types.ts`
- `data/seed.json`
- the domain-folder map in `server/index.mjs`

Keep Markdown frontmatter backward compatible.
