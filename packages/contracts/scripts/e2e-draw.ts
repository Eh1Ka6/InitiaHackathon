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
  const adapter = await ethers.getContractAt(
    "RandomnessAdapter",
    draws.contracts.RandomnessAdapter
  );
  const escrow = await ethers.getContractAt("WeezEscrow", draws.base.WeezEscrow);

  const drawId = BigInt(process.env.DRAW_ID || "1776900670628");
  console.log("Using drawId:", drawId.toString());

  const onchain = await drawHub.getDraw(drawId);
  // getDraw returns: [status, configId, deadline, entryFee, vrfReqId, winner, multiplier, payout]
  console.log("Draw status pre-deposit:", Number(onchain[0]), "entryFee:", onchain[3].toString());
  const entryFee = onchain[3];

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
    const needed = entryFee + ethers.parseEther("0.0001");
    if (bal < needed) {
      const tx = await deployer.sendTransaction({
        to: p.address,
        value: needed - bal,
      });
      await tx.wait();
      console.log(`   Funded ${p.address}: ${ethers.formatEther(needed - bal)} INIT`);
    }
  }

  console.log("\n2. Each player deposits...");
  for (const p of players) {
    const hub = drawHub.connect(p) as any;
    const tx = await hub.depositLocal(drawId, { value: entryFee });
    const r = await tx.wait();
    console.log(`   ${p.address.slice(0, 8)} deposited in tx ${r.hash}`);
  }

  const parts = await drawHub.getParticipants(drawId);
  console.log("After deposits — participants:", parts.length);

  console.log("\n3. RecordQualifiers (deployer has RESOLVER_ROLE)...");
  const qualifiers = [players[0].address, players[2].address];
  try {
    const txq = await drawHub.recordQualifiers(drawId, qualifiers);
    await txq.wait();
    console.log("   Recorded 2 qualifiers:", qualifiers);
  } catch (err: any) {
    console.log("   recordQualifiers failed:", err.message?.slice(0, 200));
    console.log("   Deadline may not have passed — fast-forward...");
  }

  const d3 = await drawHub.getDraw(drawId);
  const quals = await drawHub.getQualifiers(drawId);
  console.log("After qualifiers — status:", Number(d3[0]), "qualifiersCount:", quals.length);

  console.log("\n4. Request randomness...");
  const txr = await drawHub.requestRandomness(drawId);
  const rcpt = await txr.wait();
  console.log("   Randomness requested, tx:", rcpt.hash);

  console.log("\n5. Fulfill mock VRF...");
  const nextId = await mockVrf.nextRequestId();
  const requestId = nextId - 1n;
  console.log("   requestId:", requestId.toString());
  const randomWord = BigInt("0x" + "7f".repeat(32));
  const txf = await mockVrf.fulfill(requestId, randomWord);
  const rfcpt = await txf.wait();
  console.log("   Fulfilled, tx:", rfcpt.hash);

  const d4 = await drawHub.getDraw(drawId);
  console.log("\nFinal draw state:");
  console.log("   status:     ", Number(d4[0]), "(5 = Settled)");
  console.log("   winner:     ", d4[5]);
  console.log("   multiplier: ", Number(d4[6]));
  console.log("   payout:     ", ethers.formatEther(d4[7]), "INIT");

  console.log("\nPlayer balances after:");
  for (const p of players) {
    const bal = await ethers.provider.getBalance(p.address);
    const isWinner = d4[5].toLowerCase() === p.address.toLowerCase();
    console.log(`   ${p.address.slice(0, 10)}${isWinner ? " (WINNER)" : ""}: ${ethers.formatEther(bal)} INIT`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
