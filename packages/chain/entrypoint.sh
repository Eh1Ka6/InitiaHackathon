#!/usr/bin/env bash
# Deliberately no `set -e` — we want to stay alive on init failure so the
# container logs stay reachable from Coolify.

export HOME_DIR="${HOME_DIR:-/root/.minitia}"

echo ">> entrypoint.sh starting (pid=$$)"
echo ">> minitiad version: $(minitiad version 2>&1 || echo '<version check failed>')"
echo ">> HOME_DIR=$HOME_DIR"

# Run init with full tracing
bash -x /usr/local/bin/init-chain.sh
INIT_EXIT=$?
echo ">> init-chain.sh exited with code $INIT_EXIT"

if [ $INIT_EXIT -ne 0 ] || [ ! -f "$HOME_DIR/config/genesis.json" ]; then
  echo ">> ERROR: chain was not initialized. Keeping container alive for log inspection."
  echo ">> Re-run the deploy after fixing init-chain.sh."
  exec sleep infinity
fi

echo ">> starting minitiad..."
exec minitiad start --home "$HOME_DIR"
