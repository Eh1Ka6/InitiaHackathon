#!/bin/bash
export PATH=$HOME/.local/go/bin:$HOME/go/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
echo "=== WEAVE ROLLUP LAUNCH (WSL) ==="
echo "When prompted:"
echo "  - Network: Testnet (initiation-2)"
echo "  - VM: EVM"
echo "  - Accept defaults for everything else"
echo ""
weave rollup launch --force
