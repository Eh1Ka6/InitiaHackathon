#!/usr/bin/env bash
set -euo pipefail
MD="/home/ehuak/.weave/data/minievm@v1.2.15/minitiad"
HM="/home/ehuak/.minitia"
CMD="${1:-balances}"

case "$CMD" in
  balances)
    for addr in init1as7jnu9xr9p96zzwgy7casxg696xvfh9p8pdfs init16xqndtkd0mr7uy7pq38kfe7x6x40guvw8qu5v6; do
      echo "=== $addr ==="
      "$MD" --home "$HM" q bank balances "$addr"
      echo
    done
    ;;
  hexaddr)
    # Convert bech32 to hex
    for addr in init1as7jnu9xr9p96zzwgy7casxg696xvfh9p8pdfs init16xqndtkd0mr7uy7pq38kfe7x6x40guvw8qu5v6; do
      echo "=== $addr ==="
      "$MD" --home "$HM" debug addr "$addr" 2>&1 | tail -6
      echo
    done
    ;;
  send)
    FROM_KEY="${2:-Validator}"
    TO="${3:-0xE65460ae5DF23f0Ea2c88590f7b16F4703843898}"
    AMOUNT_UINIT="${4:-100000000000000}"   # 0.0001 INIT in uinit (1 INIT = 1e6 uinit here)
    # Use EVM-style via hex if target is hex. Send bank coins by converting hex->bech32.
    echo "FROM key: $FROM_KEY"
    echo "TO (hex): $TO"
    echo "AMOUNT:   $AMOUNT_UINIT uinit"
    # First, derive bech32 for recipient from hex
    HEX_NO_PREFIX="${TO#0x}"
    # minitiad debug addr accepts hex and prints bech32
    "$MD" --home "$HM" debug addr "$HEX_NO_PREFIX" 2>&1 | tail -6
    ;;
  send-exec)
    FROM_KEY="${2:?from key}"
    TO_BECH32="${3:?to bech32}"
    AMOUNT="${4:?amount (with denom)}"
    "$MD" --home "$HM" tx bank send "$FROM_KEY" "$TO_BECH32" "$AMOUNT" \
      --keyring-backend test \
      --chain-id minimove-1 \
      --gas auto --gas-adjustment 1.3 \
      --yes --output json 2>&1 | tail -30
    ;;
  chain-info)
    "$MD" --home "$HM" status 2>&1 | head -20
    ;;
  export-key)
    KEY="${2:-Validator}"
    echo "y" | "$MD" --home "$HM" keys export "$KEY" --keyring-backend test --unarmored-hex --unsafe 2>&1 | tail -5
    ;;
  debug-addr)
    ADDR="${2:?bech32 or hex}"
    "$MD" --home "$HM" debug addr "$ADDR" 2>&1 | tail -10
    ;;
  *)
    echo "Unknown cmd: $CMD" >&2
    exit 1
    ;;
esac
