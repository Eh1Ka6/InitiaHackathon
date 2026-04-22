import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the draw system on top of an existing base deployment
 * (AccessRegistry, FeeRouter, WeezEscrow).
 *
 * Reads base addresses from `deployed.json`. Writes draws addresses to
 * `deployments/<network>/draws.json`.
 *
 * If `deployed.json` is missing, this script will deploy the base stack too.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying draws with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );

  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? `chain-${network.chainId}` : network.name;

  // ─── Base deployment: either load from deployed.json or deploy fresh ───
  const deployedJsonPath = path.join(__dirname, "..", "deployed.json");
  let accessRegistryAddr: string;
  let feeRouterAddr: string;
  let escrowAddr: string;

  if (fs.existsSync(deployedJsonPath)) {
    const existing = JSON.parse(fs.readFileSync(deployedJsonPath, "utf-8"));
    accessRegistryAddr = existing.contracts.AccessRegistry;
    feeRouterAddr = existing.contracts.FeeRouter;
    escrowAddr = existing.contracts.WeezEscrow;
    console.log("\nUsing existing base deployment from deployed.json:");
    console.log("   AccessRegistry:", accessRegistryAddr);
    console.log("   FeeRouter:     ", feeRouterAddr);
    console.log("   WeezEscrow:    ", escrowAddr);
  } else {
    console.log("\nNo deployed.json found — deploying base stack first.");

    const AccessRegistryFactory = await ethers.getContractFactory("AccessRegistry");
    const accessRegistry = await upgrades.deployProxy(
      AccessRegistryFactory,
      [deployer.address],
      { kind: "uups" }
    );
    await accessRegistry.waitForDeployment();
    accessRegistryAddr = await accessRegistry.getAddress();
    console.log("   AccessRegistry:", accessRegistryAddr);

    const FeeRouterFactory = await ethers.getContractFactory("FeeRouter");
    const feeRouter = await upgrades.deployProxy(
      FeeRouterFactory,
      [accessRegistryAddr, deployer.address],
      { kind: "uups" }
    );
    await feeRouter.waitForDeployment();
    feeRouterAddr = await feeRouter.getAddress();
    console.log("   FeeRouter:     ", feeRouterAddr);

    const WeezEscrowFactory = await ethers.getContractFactory("WeezEscrow");
    const escrow = await WeezEscrowFactory.deploy(accessRegistryAddr, 86400);
    await escrow.waitForDeployment();
    escrowAddr = await escrow.getAddress();
    console.log("   WeezEscrow:    ", escrowAddr);
  }

  const accessRegistry = await ethers.getContractAt("AccessRegistry", accessRegistryAddr);

  // ─── 1. Deploy MockBandVRF (stand-in until real Band VRF is integrated) ───
  console.log("\n1. Deploying MockBandVRF (HACKATHON: replace with real Band VRF address)...");
  const MockBandVRFFactory = await ethers.getContractFactory("MockBandVRF");
  const mockVrf = await MockBandVRFFactory.deploy();
  await mockVrf.waitForDeployment();
  const mockVrfAddr = await mockVrf.getAddress();
  console.log("   MockBandVRF:", mockVrfAddr);

  // ─── 2. Deploy RandomnessAdapter ───
  console.log("\n2. Deploying RandomnessAdapter...");
  const RandomnessAdapterFactory = await ethers.getContractFactory("RandomnessAdapter");
  const adapter = await RandomnessAdapterFactory.deploy(mockVrfAddr);
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log("   RandomnessAdapter:", adapterAddr);

  // ─── 3. Deploy DrawHub ───
  console.log("\n3. Deploying DrawHub...");
  const DrawHubFactory = await ethers.getContractFactory("DrawHub");
  const drawHub = await DrawHubFactory.deploy(
    accessRegistryAddr,
    escrowAddr,
    feeRouterAddr,
    adapterAddr
  );
  await drawHub.waitForDeployment();
  const drawHubAddr = await drawHub.getAddress();
  console.log("   DrawHub:", drawHubAddr);

  // ─── 4. Register DrawHub as active module ───
  console.log("\n4. Registering DrawHub as active module in AccessRegistry...");
  const regTx = await accessRegistry.registerModule(drawHubAddr);
  await regTx.wait();
  console.log("   Registered.");

  // ─── 5. Wire adapter consumer → DrawHub ───
  console.log("\n5. Wiring RandomnessAdapter.setConsumer(DrawHub)...");
  const setTx = await adapter.setConsumer(drawHubAddr);
  await setTx.wait();
  console.log("   Consumer set.");

  // ─── 6. Ensure deployer has RESOLVER_ROLE (for testing / demo) ───
  const RESOLVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RESOLVER_ROLE"));
  const hasResolver = await accessRegistry.hasRole(RESOLVER_ROLE, deployer.address);
  if (!hasResolver) {
    console.log("\n6. Granting RESOLVER_ROLE to deployer...");
    const grantTx = await accessRegistry.grantRole(RESOLVER_ROLE, deployer.address);
    await grantTx.wait();
    console.log("   Granted.");
  } else {
    console.log("\n6. Deployer already has RESOLVER_ROLE, skipping.");
  }

  // ─── 7. Save addresses ───
  const outDir = path.join(__dirname, "..", "deployments", networkName);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "draws.json");

  const draws = {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    base: {
      AccessRegistry: accessRegistryAddr,
      FeeRouter: feeRouterAddr,
      WeezEscrow: escrowAddr,
    },
    contracts: {
      MockBandVRF: mockVrfAddr,
      RandomnessAdapter: adapterAddr,
      DrawHub: drawHubAddr,
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(draws, null, 2));

  console.log("\n════════════════════════════════════════");
  console.log("  Draw System Deployment Complete");
  console.log("════════════════════════════════════════");
  console.log("  MockBandVRF:       ", mockVrfAddr);
  console.log("  RandomnessAdapter: ", adapterAddr);
  console.log("  DrawHub:           ", drawHubAddr);
  console.log("════════════════════════════════════════");
  console.log(`\nAddresses saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
