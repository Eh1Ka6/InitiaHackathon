#!/usr/bin/env bash
set -euo pipefail

export HOME_DIR="${HOME_DIR:-/root/.minitia}"

/usr/local/bin/init-chain.sh

echo ">> starting minitiad"
exec minitiad start --home "$HOME_DIR"
