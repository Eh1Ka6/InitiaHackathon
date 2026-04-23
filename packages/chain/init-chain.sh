#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME_DIR:-/root/.minitia}"
CHAIN_ID="${CHAIN_ID:-weezdraw-1}"
EVM_CHAIN_ID="${EVM_CHAIN_ID:-1776970000}"
MONIKER="${MONIKER:-weezdraw-validator}"
DENOM="${DENOM:-GAS}"

# Deterministic mnemonic — used to derive both the Tendermint validator key
# and the deployer/Gas Station account. Pre-fund this address with a huge
# GAS balance at genesis so the deployer can fund test wallets freely.
MNEMONIC="${VALIDATOR_MNEMONIC:-soap someone mountain melody slight surprise input grunt ribbon flip obscure echo ecology pudding now strong sunny banner have steel avocado skull alone throw}"

# How much GAS to mint into the deployer/validator account at genesis
GENESIS_SUPPLY="${GENESIS_SUPPLY:-100000000000000000000000000}"

echo ">> init-chain.sh starting"
echo "   HOME_DIR=$HOME_DIR"
echo "   CHAIN_ID=$CHAIN_ID"
echo "   EVM_CHAIN_ID=$EVM_CHAIN_ID"

if [ -f "$HOME_DIR/config/genesis.json" ]; then
  echo ">> Genesis already exists — skipping init."
  exit 0
fi

mkdir -p "$HOME_DIR"

echo ">> minitiad init $MONIKER --chain-id $CHAIN_ID"
minitiad init "$MONIKER" --chain-id "$CHAIN_ID" --home "$HOME_DIR" --default-denom "$DENOM" >/dev/null

echo ">> importing validator/deployer mnemonic"
echo "$MNEMONIC" | minitiad keys add validator \
  --recover --keyring-backend test --home "$HOME_DIR" >/dev/null

VAL_BECH32=$(minitiad keys show validator -a --keyring-backend test --home "$HOME_DIR")
VAL_HEX=$(minitiad debug addr "$VAL_BECH32" 2>&1 | awk '/Address \(hex\):/ {print tolower($3)}')
echo "   validator bech32: $VAL_BECH32"
echo "   validator hex:    0x$VAL_HEX"

echo ">> add-genesis-account: $VAL_BECH32 <- ${GENESIS_SUPPLY}${DENOM}"
minitiad genesis add-genesis-account "$VAL_BECH32" "${GENESIS_SUPPLY}${DENOM}" --home "$HOME_DIR"

echo ">> gentx for validator"
minitiad genesis gentx validator "1000000000000${DENOM}" \
  --chain-id "$CHAIN_ID" --keyring-backend test --home "$HOME_DIR" >/dev/null

echo ">> collect-gentxs + validate"
minitiad genesis collect-gentxs --home "$HOME_DIR" >/dev/null
minitiad genesis validate --home "$HOME_DIR" >/dev/null

echo ">> setting EVM chain id to $EVM_CHAIN_ID in genesis"
tmp=$(mktemp)
jq --argjson cid "$EVM_CHAIN_ID" '.app_state.evm.params.chain_id = ($cid | tostring)' \
    "$HOME_DIR/config/genesis.json" > "$tmp" && mv "$tmp" "$HOME_DIR/config/genesis.json"

echo ">> rewriting bind addresses to 0.0.0.0"
APP_TOML="$HOME_DIR/config/app.toml"
CFG_TOML="$HOME_DIR/config/config.toml"

# EVM JSON-RPC HTTP + WS
sed -i 's|127\.0\.0\.1:8545|0.0.0.0:8545|g' "$APP_TOML"
sed -i 's|127\.0\.0\.1:8546|0.0.0.0:8546|g' "$APP_TOML"
sed -i 's|localhost:8545|0.0.0.0:8545|g'    "$APP_TOML"
sed -i 's|localhost:8546|0.0.0.0:8546|g'    "$APP_TOML"

# enable JSON-RPC if gated behind a flag (some builds default to enable=true)
python3 - <<'PY' || true
import os, re
p = os.environ["HOME_DIR"] + "/config/app.toml"
s = open(p).read()
# Ensure [json-rpc] enable = true
s = re.sub(r'(\[json-rpc\][\s\S]*?)(?=\n\[|\Z)',
           lambda m: re.sub(r'(^\s*enable\s*=\s*)(?:false|true)', r'\1true', m.group(0), count=1, flags=re.M)
           if re.search(r'^\s*enable\s*=', m.group(0), flags=re.M) else m.group(0),
           s, count=1)
open(p, "w").write(s)
PY

# Tendermint RPC
sed -i 's|tcp://127\.0\.0\.1:26657|tcp://0.0.0.0:26657|g' "$CFG_TOML"
sed -i 's|tcp://localhost:26657|tcp://0.0.0.0:26657|g'    "$CFG_TOML"

# Cosmos REST + gRPC
sed -i 's|localhost:1317|0.0.0.0:1317|g' "$APP_TOML"
sed -i 's|localhost:9090|0.0.0.0:9090|g' "$APP_TOML"

# disable seeds/peers for a 1-node testnet
sed -i 's|^persistent_peers\s*=.*|persistent_peers = ""|' "$CFG_TOML"
sed -i 's|^seeds\s*=.*|seeds = ""|'                       "$CFG_TOML"
sed -i 's|^addr_book_strict\s*=.*|addr_book_strict = false|' "$CFG_TOML"

# permissive CORS
sed -i 's|^cors_allowed_origins\s*=.*|cors_allowed_origins = ["*"]|' "$CFG_TOML"
sed -i 's|^enabled-unsafe-cors\s*=.*|enabled-unsafe-cors = true|' "$APP_TOML" || true

# minimum-gas-prices in app.toml — keep zero for hackathon
sed -i "s|^minimum-gas-prices\s*=.*|minimum-gas-prices = \"0${DENOM}\"|" "$APP_TOML"

# enable API server
python3 - <<'PY' || true
import os, re
p = os.environ["HOME_DIR"] + "/config/app.toml"
s = open(p).read()
# [api] enable = true
s = re.sub(r'(\[api\][\s\S]*?)(?=\n\[|\Z)',
           lambda m: re.sub(r'(^\s*enable\s*=\s*)(?:false|true)', r'\1true', m.group(0), count=1, flags=re.M)
           if re.search(r'^\s*enable\s*=', m.group(0), flags=re.M) else m.group(0),
           s, count=1)
open(p, "w").write(s)
PY

echo ">> init-chain.sh complete"
