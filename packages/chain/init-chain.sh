#!/usr/bin/env bash
set -uo pipefail
# Deliberately NOT `set -e` — individual command failures print but don't kill
# the container; entrypoint.sh decides whether to stay alive for log inspection.

# Bump this whenever this script changes in a way that REQUIRES regenerating
# genesis (e.g. genesis-structure fixes). On next container start, if the
# recorded version in $HOME_DIR/.init-version doesn't match, we wipe and
# re-init. This avoids needing a manual volume wipe or container recreate.
INIT_VERSION="2026-04-24.1"

HOME_DIR="${HOME_DIR:-/root/.minitia}"
CHAIN_ID="${CHAIN_ID:-weezdraw-1}"
# NOTE: minievm does NOT have a user-settable EVM chain_id field in genesis.
# The EVM chain_id is derived deterministically from the Cosmos CHAIN_ID via
#   ConvertCosmosChainIDToEthereumChainID(chainID) =
#     uint64(keccak256(chainID)[:8]) % 4503599627370476
# (see initia-labs/minievm x/evm/types/chain_config.go).
# So EVM_CHAIN_ID is informational only; whatever the chain reports via
# eth_chainId IS the truth. We keep this var so downstream UI configs can
# optionally pin a known value, but we no longer write it into genesis.
EVM_CHAIN_ID="${EVM_CHAIN_ID:-}"
MONIKER="${MONIKER:-weezdraw-validator}"
DENOM="${DENOM:-GAS}"
KEY_NAME="${KEY_NAME:-validator}"

# Deterministic mnemonic — used to derive the deployer/Gas Station account.
# Pre-fund this address with a huge GAS balance at genesis so the deployer
# can fund test wallets freely.
MNEMONIC="${VALIDATOR_MNEMONIC:-soap someone mountain melody slight surprise input grunt ribbon flip obscure echo ecology pudding now strong sunny banner have steel avocado skull alone throw}"

# How much GAS to mint into the deployer/validator account at genesis.
GENESIS_SUPPLY="${GENESIS_SUPPLY:-100000000000000000000000000}"

echo ">> init-chain.sh starting (INIT_VERSION=$INIT_VERSION)"
echo "   HOME_DIR=$HOME_DIR"
echo "   CHAIN_ID=$CHAIN_ID"
echo "   EVM_CHAIN_ID=${EVM_CHAIN_ID:-<auto-derived from CHAIN_ID>}"
echo "   DENOM=$DENOM"

VERSION_FILE="$HOME_DIR/.init-version"

if [ -f "$HOME_DIR/config/genesis.json" ]; then
  existing_version=""
  if [ -f "$VERSION_FILE" ]; then
    existing_version="$(cat "$VERSION_FILE" 2>/dev/null || true)"
  fi
  if [ "$existing_version" = "$INIT_VERSION" ]; then
    echo ">> Genesis already exists and INIT_VERSION matches ($INIT_VERSION) — skipping init."
    exit 0
  fi
  echo ">> Stale genesis detected (existing='$existing_version', expected='$INIT_VERSION')."
  echo ">> Wiping $HOME_DIR contents and re-initializing."
  # Wipe everything *inside* the mounted volume but keep the mount point.
  # shellcheck disable=SC2115
  rm -rf "$HOME_DIR"/* "$HOME_DIR"/.[!.]* "$HOME_DIR"/..?* 2>/dev/null || true
fi

mkdir -p "$HOME_DIR"

# NOTE: minievm's `init` takes --denom (NOT --default-denom). Using the wrong
# flag makes init fail silently and no genesis.json is created.
echo ">> minitiad init $MONIKER --chain-id $CHAIN_ID --denom $DENOM"
minitiad init "$MONIKER" \
  --chain-id "$CHAIN_ID" \
  --home "$HOME_DIR" \
  --denom "$DENOM"

if [ ! -f "$HOME_DIR/config/genesis.json" ]; then
  echo ">> FATAL: minitiad init did not produce a genesis.json. Aborting."
  exit 1
fi

echo ">> importing deployer/validator mnemonic into keyring ($KEY_NAME)"
echo "$MNEMONIC" | minitiad keys add "$KEY_NAME" \
  --recover --keyring-backend test --home "$HOME_DIR"

VAL_BECH32=$(minitiad keys show "$KEY_NAME" -a --keyring-backend test --home "$HOME_DIR")
VAL_HEX=$(minitiad debug addr "$VAL_BECH32" 2>&1 | awk '/Address \(hex\):/ {print tolower($3)}')
echo "   validator bech32: $VAL_BECH32"
echo "   validator hex:    0x$VAL_HEX"

# minievm genesis flow is: add-genesis-account + add-genesis-validator.
# There is NO collect-gentxs / gentx flow — minievm is a single-validator
# rollup so add-genesis-validator bakes the validator directly into genesis.
# Both commands accept either a key name (from the keyring) or a bech32 addr.
echo ">> add-genesis-account: $KEY_NAME <- ${GENESIS_SUPPLY}${DENOM}"
minitiad genesis add-genesis-account "$KEY_NAME" "${GENESIS_SUPPLY}${DENOM}" \
  --keyring-backend test --home "$HOME_DIR"

echo ">> add-genesis-validator: $KEY_NAME"
minitiad genesis add-genesis-validator "$KEY_NAME" \
  --keyring-backend test --home "$HOME_DIR"

echo ">> validating genesis"
minitiad genesis validate --home "$HOME_DIR"

# NOTE: we intentionally do NOT edit app_state.evm.params.chain_id — that field
# does not exist in minievm's EVM Params proto (x/evm/types/types.proto). Any
# unknown field here makes InitGenesis panic with:
#   panic: unknown field "chain_id" in types.Params
# The EVM chain_id is derived automatically from the Cosmos CHAIN_ID by
# ConvertCosmosChainIDToEthereumChainID() and exposed via eth_chainId RPC.

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
sed -i 's|^allow_duplicate_ip\s*=.*|allow_duplicate_ip = true|' "$CFG_TOML"

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

# Record the INIT_VERSION so future restarts know this genesis is fresh.
echo "$INIT_VERSION" > "$VERSION_FILE"

echo ">> init-chain.sh complete (INIT_VERSION=$INIT_VERSION)"
