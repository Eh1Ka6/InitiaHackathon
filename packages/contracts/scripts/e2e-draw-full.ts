import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

  // Create a new draw with near-term deadline (~40s)
  const drawId = BigInt(Date.now());
  const entryFee = ethers.parseEther("0.00001"); // 0.00001 INIT to conserve chain gas funds
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 40);
  const configId = 0;

  console.log("Creating draw", drawId, "entryFee", ethers.formatEther(entryFee), "deadline", deadline);
  const txc = await drawHub.createDraw(drawId, entryFee, deadline, configId);
  await txc.wait();
  console.log("   Draw created.");

  const playerKeys = [
    "0x" + "aa".repeat(32),
    "0x" + "bb".repeat(32),
    "0x" + "cc".repeat(32),
  ];
  const players = playerKeys.map((k) => new ethers.Wallet(k, ethers.provider));
  for (const p of players) console.log("Player:", p.address);

  console.log("\n1. Fund players from deployer...");
  for (const p of players) {
    const bal = await ethers.provider.getBalance(p.address);
    const needed = entryFee + ethers.parseEther("0.00002");
    if (bal < needed) {
      const tx = await deployer.sendTransaction({ to: p.address, value: needed });
      await tx.wait();
      console.log(`   Funded ${p.address.slice(0, 10)}`);
    }
  }

  console.log("\n2. Each player deposits...");
  for (const p of players) {
    const hub = drawHub.connect(p) as any;
    const tx = await hub.depositLocal(drawId, { value: entryFee });
    await tx.wait();
    console.log(`   ${p.address.slice(0, 10)} deposited`);
  }

  const parts = await drawHub.getParticipants(drawId);
  console.log("   Participants on-chain:", parts.length);

  console.log("\n3. Wait for deadline to pass...");
  const now = Math.floor(Date.now() / 1000);
  const wait = Number(deadline) - now + 3;
  if (wait > 0) {
    console.log(`   Waiting ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }

  console.log("\n4. Record qualifiers (2 of 3)...");
  const qualifiers = [players[0].address, players[2].address];
  const txq = await drawHub.recordQualifiers(drawId, qualifiers);
  await txq.wait();
  console.log("   Recorded:", qualifiers);

  console.log("\n5. Request randomness...");
  const txr = await drawHub.requestRandomness(drawId);
  await txr.wait();
  console.log("   Requested.");

  console.log("\n6. Fulfill mock VRF...");
  const nextId = await mockVrf.nextRequestId();
  const requestId = nextId - 1n;
  const randomWord = BigInt("0x" + "7f".repeat(32));
  const txf = await mockVrf.fulfill(requestId, randomWord);
  await txf.wait();
  console.log("   Fulfilled.");

  const d4 = await drawHub.getDraw(drawId);
  const statusNames = ["None", "Open", "AwaitingQualifiers", "Qualified", "RandomnessRequested", "Settled", "Cancelled"];
  console.log("\n════ FINAL STATE ════");
  console.log("   status:     ", statusNames[Number(d4[0])]);
  console.log("   winner:     ", d4[5]);
  console.log("   multiplier: ", "x" + Number(d4[6]));
  console.log("   payout:     ", ethers.formatEther(d4[7]), "INIT");
  console.log("═════════════════════");

  console.log("\nPlayer balances after settlement:");
  for (const p of players) {
    const bal = await ethers.provider.getBalance(p.address);
    const isWinner = d4[5].toLowerCase() === p.address.toLowerCase();
    console.log(`   ${p.address.slice(0, 10)}${isWinner ? " 🏆 WINNER" : ""}: ${ethers.formatEther(bal)} INIT`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
