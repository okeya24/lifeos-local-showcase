#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  print -r -- "请先安装 pnpm：https://pnpm.io/installation"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  pnpm install
fi

open "http://127.0.0.1:5173"
pnpm dev
