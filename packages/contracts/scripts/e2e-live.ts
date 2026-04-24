import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const BACKEND = "https://h7jalhe67td58srqdixfzgnk.138.201.153.194.sslip.io";
const ADMIN_TOKEN = "weezdraw-admin-prod-a7f9c2";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const draws = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "deployments", "initia", "draws.json"),
      "utf8"
    )
  );
  const drawHub = await ethers.getContractAt("DrawHub", draws.contracts.DrawHub);
  const mockVrf = await ethers.getContractAt("MockBandVRF", draws.contracts.MockBandVRF);

  const entryFee = 1_000_000n;
  const fundPerPlayer = 10_000_000n;
  const deadline = new Date(Date.now() + 40_000).toISOString();
  const configId = 0;

  console.log("\n1. Create draw via LIVE backend API...");
  const createRes = await fetch(`${BACKEND}/api/draws`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
    },
    body: JSON.stringify({
      entryFee: entryFee.toString(),
      deadline,
      multiplierConfigId: configId,
      gameSeed: "e2e-live",
    }),
  });
  if (!createRes.ok) {
    console.error("backend createDraw failed:", createRes.status, await createRes.text());
    process.exit(1);
  }
  const draw = await createRes.json();
  console.log("   DB id:          ", draw.id);
  console.log("   onChainDrawId:  ", draw.onChainDrawId);
  console.log("   txHashCreate:   ", draw.txHashCreate);
  const drawId = BigInt(draw.onChainDrawId);

  console.log("\n2. Fund 3 players + deposit...");
  const playerKeys = [
    "0x" + "aa".repeat(32),
    "0x" + "bb".repeat(32),
    "0x" + "cc".repeat(32),
  ];
  const players = playerKeys.map((k) => new ethers.Wallet(k, ethers.provider));

  for (const p of players) {
    const bal = await ethers.provider.getBalance(p.address);
    if (bal < fundPerPlayer) {
      const tx = await deployer.sendTransaction({
        to: p.address,
        value: fundPerPlayer - bal,
      });
      await tx.wait();
    }
  }
  for (const p of players) {
    const hub = drawHub.connect(p) as any;
    const tx = await hub.depositLocal(drawId, { value: entryFee });
    await tx.wait();
    console.log(`   ${p.address.slice(0, 10)} deposited`);
  }

  console.log("\n3. Wait for deadline...");
  const now = Math.floor(Date.now() / 1000);
  const wait = Math.floor(new Date(deadline).getTime() / 1000) - now + 3;
  if (wait > 0) {
    console.log(`   Waiting ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }

  console.log("\n4. Record qualifiers (2 of 3) + request randomness + fulfill...");
  const qualifiers = [players[0].address, players[2].address];
  await (await drawHub.recordQualifiers(drawId, qualifiers)).wait();
  await (await drawHub.requestRandomness(drawId)).wait();
  const reqId = (await mockVrf.nextRequestId()) - 1n;
  const randomWord = BigInt("0x" + "7f".repeat(32));
  await (await mockVrf.fulfill(reqId, randomWord)).wait();
  console.log("   Settled on-chain.");

  console.log("\n5. Query LIVE backend for updated draw state...");
  const getRes = await fetch(`${BACKEND}/api/draws/${draw.id}`);
  const updated = await getRes.json();
  const statusNames = ["None", "Open", "AwaitingQualifiers", "Qualified", "RandomnessRequested", "Settled", "Cancelled"];
  console.log("   DB status:            ", updated.status);
  console.log("   onChain status:       ", statusNames[updated.onChain?.status]);
  console.log("   onChain winner:       ", updated.onChain?.winner);
  console.log("   onChain multiplier:   x" + updated.onChain?.multiplier);
  console.log("   onChain payout (wei): ", updated.onChain?.payout);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
