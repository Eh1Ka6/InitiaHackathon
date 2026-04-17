import { ethers } from "ethers";
import * as fs from "fs";

// Read Gas Station mnemonic from weave config
const configPath = process.env.WEAVE_CONFIG || `${process.env.HOME || process.env.USERPROFILE}/.weave/data/minitia.config.json`;

let mnemonic: string;
if (process.argv[2]) {
  mnemonic = process.argv.slice(2).join(" ");
} else {
  // Try to read from weave config if passed as file
  const configFile = process.env.WEAVE_CONFIG_FILE;
  if (!configFile) {
    console.error("Usage: ts-node derive-key.ts 'word1 word2 ... word24'");
    console.error("Or: WEAVE_CONFIG_FILE=/path/to/config.json npx ts-node derive-key.ts");
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
  // Use operator or validator mnemonic
  mnemonic = config.system_keys?.validator?.mnemonic;
  if (!mnemonic) {
    console.error("No mnemonic found in config");
    process.exit(1);
  }
}

// Derive EVM key from mnemonic (standard Ethereum path)
const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");

console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
