/**
 * Derive the deployer EVM private key from the validator mnemonic baked into
 * the chain's init-chain.sh. Runs purely locally — no chain access needed.
 *
 * Output: logs the key + address; if `--write` is passed, also rewrites
 * ../.env with DEPLOYER_PRIVATE_KEY set.
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const MNEMONIC =
  "garment leader smile clutch remember inflict regret clinic hollow inspire shop exercise spot oval smoke liquid flock illegal absent recipe carry embody mystery relief";

// Try both common derivation paths and print which one is sensible.
// Cosmos uses coin_type 118; EVM-ish Cosmos chains like Evmos use 60.
// minievm inherits Cosmos-SDK default (118) unless the builder overrides.
const PATHS = [
  { name: "cosmos (118)", path: "m/44'/118'/0'/0/0" },
  { name: "ethereum (60)", path: "m/44'/60'/0'/0/0" },
];

async function main() {
  for (const p of PATHS) {
    const node = ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, p.path);
    console.log(`\n== ${p.name} (${p.path}) ==`);
    console.log("  privateKey:", node.privateKey);
    console.log("  address:   ", node.address);
  }

  const writeFlag = process.argv.includes("--write");
  if (writeFlag) {
    // Default to coin_type 118 since that's minitiad's default
    const picked = ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, PATHS[0].path);
    const envPath = path.resolve(__dirname, "..", ".env");
    let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const line = `DEPLOYER_PRIVATE_KEY=${picked.privateKey}`;
    if (contents.match(/^DEPLOYER_PRIVATE_KEY=.*/m)) {
      contents = contents.replace(/^DEPLOYER_PRIVATE_KEY=.*$/m, line);
    } else {
      if (!contents.endsWith("\n") && contents.length > 0) contents += "\n";
      contents += line + "\n";
    }
    fs.writeFileSync(envPath, contents);
    console.log("\nWrote DEPLOYER_PRIVATE_KEY to", envPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
