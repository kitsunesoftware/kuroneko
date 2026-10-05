#!/usr/bin/env bash
# Wrapper — o script oficial fica na raiz do repositório.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$ROOT/create-project.sh" "$@"
