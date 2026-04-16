import * as fs from "fs";
import * as path from "path";

async function main() {
  const artifactPath = path.resolve(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "core",
    "WeezWager.sol",
    "WeezWager.json"
  );

  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found at:", artifactPath);
    console.error("Run `npx hardhat compile` first.");
    process.exitCode = 1;
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  const abiJson = JSON.stringify(abi, null, 2);

  // Target 1: miniapp
  const miniappTarget = path.resolve(
    __dirname,
    "..",
    "..",
    "miniapp",
    "src",
    "lib",
    "WeezWagerABI.json"
  );

  // Target 2: backend
  const backendAbiDir = path.resolve(
    __dirname,
    "..",
    "..",
    "backend",
    "src",
    "abi"
  );
  const backendTarget = path.join(backendAbiDir, "WeezWagerABI.json");

  // Create backend abi directory if it doesn't exist
  if (!fs.existsSync(backendAbiDir)) {
    fs.mkdirSync(backendAbiDir, { recursive: true });
    console.log("Created directory:", backendAbiDir);
  }

  // Write ABI files
  fs.writeFileSync(miniappTarget, abiJson);
  console.log("Wrote ABI to:", miniappTarget);

  fs.writeFileSync(backendTarget, abiJson);
  console.log("Wrote ABI to:", backendTarget);

  console.log(`\nExported ${abi.length} ABI entries from WeezWager.`);
  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
