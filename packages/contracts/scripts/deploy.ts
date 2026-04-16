import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // ─── 1. Deploy AccessRegistry (UUPS proxy) ───
  console.log("\n1. Deploying AccessRegistry (UUPS proxy)...");
  const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
  const accessRegistry = await upgrades.deployProxy(
    AccessRegistry,
    [deployer.address],
    { kind: "uups" }
  );
  await accessRegistry.waitForDeployment();
  const accessRegistryAddr = await accessRegistry.getAddress();
  console.log("   AccessRegistry proxy:", accessRegistryAddr);

  // ─── 2. Deploy FeeRouter (UUPS proxy) ───
  console.log("\n2. Deploying FeeRouter (UUPS proxy)...");
  const FeeRouter = await ethers.getContractFactory("FeeRouter");
  const feeRouter = await upgrades.deployProxy(
    FeeRouter,
    [accessRegistryAddr, deployer.address],
    { kind: "uups" }
  );
  await feeRouter.waitForDeployment();
  const feeRouterAddr = await feeRouter.getAddress();
  console.log("   FeeRouter proxy:", feeRouterAddr);

  // ─── 3. Deploy WeezEscrow (non-upgradeable) ───
  console.log("\n3. Deploying WeezEscrow...");
  const WeezEscrow = await ethers.getContractFactory("WeezEscrow");
  const emergencyDelay = 86400; // 1 day
  const escrow = await WeezEscrow.deploy(accessRegistryAddr, emergencyDelay);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("   WeezEscrow:", escrowAddr);

  // ─── 4. Deploy WeezWager (non-upgradeable) ───
  console.log("\n4. Deploying WeezWager...");
  const WeezWager = await ethers.getContractFactory("WeezWager");
  const wager = await WeezWager.deploy(accessRegistryAddr, escrowAddr, feeRouterAddr);
  await wager.waitForDeployment();
  const wagerAddr = await wager.getAddress();
  console.log("   WeezWager:", wagerAddr);

  // ─── 5. Register WeezWager as a module in AccessRegistry ───
  console.log("\n5. Registering WeezWager as active module...");
  const registerTx = await accessRegistry.registerModule(wagerAddr);
  await registerTx.wait();
  console.log("   WeezWager registered as module");

  // ─── 6. Grant RESOLVER_ROLE and OPERATOR_ROLE to deployer ───
  console.log("\n6. Granting roles to deployer...");
  const RESOLVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RESOLVER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  const grantResolverTx = await accessRegistry.grantRole(RESOLVER_ROLE, deployer.address);
  await grantResolverTx.wait();
  console.log("   RESOLVER_ROLE granted");

  const grantOperatorTx = await accessRegistry.grantRole(OPERATOR_ROLE, deployer.address);
  await grantOperatorTx.wait();
  console.log("   OPERATOR_ROLE granted");

  // ─── 7. Set competition fee config on FeeRouter (0% for hackathon) ───
  console.log("\n7. Setting hackathon fee config (0% operator, 0% creator)...");
  // Set protocol fee to 0% for hackathon as well
  const setFeeTx = await feeRouter.setProtocolFeeBps(0);
  await setFeeTx.wait();
  console.log("   Protocol fee set to 0%");

  // ─── 8. Log all deployed addresses ───
  console.log("\n════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("════════════════════════════════════════");
  console.log("  AccessRegistry:", accessRegistryAddr);
  console.log("  FeeRouter:     ", feeRouterAddr);
  console.log("  WeezEscrow:    ", escrowAddr);
  console.log("  WeezWager:     ", wagerAddr);
  console.log("════════════════════════════════════════");

  // ─── 9. Save addresses to deployed.json ───
  const deployed = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AccessRegistry: accessRegistryAddr,
      FeeRouter: feeRouterAddr,
      WeezEscrow: escrowAddr,
      WeezWager: wagerAddr,
    },
  };

  const outputPath = path.join(__dirname, "..", "deployed.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployed, null, 2));
  console.log(`\nAddresses saved to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
