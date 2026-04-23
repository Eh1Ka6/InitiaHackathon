import { ethers, upgrades } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, player1, player2] = signers;

  console.log("=== WeezDraw Local Smoke Test ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Player1: ", player1.address);
  console.log("Player2: ", player2.address);

  // ─── Deploy all contracts ───

  console.log("\n--- Deploying contracts ---");

  const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
  const accessRegistry = await upgrades.deployProxy(
    AccessRegistry,
    [deployer.address],
    { kind: "uups" }
  );
  await accessRegistry.waitForDeployment();
  const accessRegistryAddr = await accessRegistry.getAddress();
  console.log("AccessRegistry:", accessRegistryAddr);

  const FeeRouter = await ethers.getContractFactory("FeeRouter");
  const feeRouter = await upgrades.deployProxy(
    FeeRouter,
    [accessRegistryAddr, deployer.address],
    { kind: "uups" }
  );
  await feeRouter.waitForDeployment();
  const feeRouterAddr = await feeRouter.getAddress();
  console.log("FeeRouter:     ", feeRouterAddr);

  const WeezEscrow = await ethers.getContractFactory("WeezEscrow");
  const escrow = await WeezEscrow.deploy(accessRegistryAddr, 86400);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("WeezEscrow:    ", escrowAddr);

  const WeezWager = await ethers.getContractFactory("WeezWager");
  const wager = await WeezWager.deploy(accessRegistryAddr, escrowAddr, feeRouterAddr);
  await wager.waitForDeployment();
  const wagerAddr = await wager.getAddress();
  console.log("WeezDraw:      ", wagerAddr);

  // ─── Configure roles & modules ───

  console.log("\n--- Configuring roles ---");

  await (await accessRegistry.registerModule(wagerAddr)).wait();
  console.log("WeezDraw registered as module");

  // Grant escrow module status so it can receive funds
  await (await accessRegistry.registerModule(escrowAddr)).wait();
  console.log("WeezEscrow registered as module");

  const RESOLVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RESOLVER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  await (await accessRegistry.grantRole(RESOLVER_ROLE, deployer.address)).wait();
  await (await accessRegistry.grantRole(OPERATOR_ROLE, deployer.address)).wait();
  console.log("RESOLVER_ROLE and OPERATOR_ROLE granted to deployer");

  // Set protocol fee to 0% for testing
  await (await feeRouter.setProtocolFeeBps(0)).wait();
  console.log("Protocol fee set to 0%");

  // ─── Smoke Test: Duel Wager ───

  console.log("\n--- Running smoke test ---");

  const entryFee = ethers.parseEther("1");
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // Record balances before
  const p1BalanceBefore = await ethers.provider.getBalance(player1.address);
  const p2BalanceBefore = await ethers.provider.getBalance(player2.address);
  console.log("\nBalances BEFORE:");
  console.log("  Player1:", ethers.formatEther(p1BalanceBefore), "ETH");
  console.log("  Player2:", ethers.formatEther(p2BalanceBefore), "ETH");

  // 1. Create a duel wager (1 ETH entry)
  const createParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint8", "uint256", "uint256", "uint256", "string"],
    [0, entryFee, deadline, 2, "Smoke test duel"] // 0 = DUEL
  );

  const createTx = await wager.createCompetition(createParams);
  const createReceipt = await createTx.wait();
  const competitionId = 1; // First competition (nextCompetitionId starts at 1)
  console.log("\n1. Created duel wager (id:", competitionId, ")");

  // 2. Player 1 enters
  await (await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee })).wait();
  console.log("2. Player1 entered (1 ETH)");

  // 3. Player 2 enters (auto-locks the duel)
  await (await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee })).wait();
  console.log("3. Player2 entered (1 ETH) — duel auto-locked");

  // 4. Start the game
  await (await wager.startGame(competitionId)).wait();
  console.log("4. Game started");

  // 5. Settle with player2 as winner
  await (await wager.settle(competitionId, [player2.address])).wait();
  console.log("5. Settled — Player2 wins!");

  // Record balances after
  const p1BalanceAfter = await ethers.provider.getBalance(player1.address);
  const p2BalanceAfter = await ethers.provider.getBalance(player2.address);
  console.log("\nBalances AFTER:");
  console.log("  Player1:", ethers.formatEther(p1BalanceAfter), "ETH");
  console.log("  Player2:", ethers.formatEther(p2BalanceAfter), "ETH");

  const p1Diff = p1BalanceAfter - p1BalanceBefore;
  const p2Diff = p2BalanceAfter - p2BalanceBefore;
  console.log("\nBalance changes:");
  console.log("  Player1:", ethers.formatEther(p1Diff), "ETH (lost entry + gas)");
  console.log("  Player2:", ethers.formatEther(p2Diff), "ETH (won pot - gas)");

  // Verify player2 gained approximately 1 ETH (entry minus gas)
  // Player2 paid 1 ETH entry + gas but won 2 ETH, net ~+1 ETH minus gas
  if (p2Diff > 0n) {
    console.log("\n✓ Smoke test passed! Player2 balance increased as expected.");
  } else {
    console.error("\n✗ Smoke test FAILED — Player2 balance did not increase.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
