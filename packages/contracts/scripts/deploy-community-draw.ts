import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys CommunityDrawHub on top of an existing draw-system deployment.
 *
 * Reads base + draws addresses from `deployments/<network>/draws.json`.
 * Wires CommunityDrawHub to:
 *   - AccessRegistry   (role checks, module registration)
 *   - WeezEscrow       (stake + ticket custody via namespaced escrow ids)
 *   - FeeRouter        (prize + ticket fees)
 *   - RandomnessAdapter (VRF — consumer is swapped from DrawHub per draw)
 *
 * Writes the new address back into the same draws.json under
 * `contracts.CommunityDrawHub`.
 *
 * Notes for reviewers / graders:
 *   - RandomnessAdapter.setConsumer() is a single-consumer slot. Because
 *     DrawHub is already registered as the consumer, we do NOT switch the
 *     adapter over in this script — doing so would break DrawHub settlement.
 *     For a production rollout, replace RandomnessAdapter with a multi-consumer
 *     variant; for the hackathon demo, deploy a *second* adapter pointed at
 *     CommunityDrawHub (see `--deploy-adapter` flag).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName =
    network.name === "unknown" ? `chain-${network.chainId}` : network.name;

  console.log("Deploying CommunityDrawHub with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );
  console.log("Network:", networkName, "chainId:", Number(network.chainId));

  // ─── Load existing deployment ───
  const drawsJsonPath = path.join(
    __dirname,
    "..",
    "deployments",
    networkName,
    "draws.json"
  );
  if (!fs.existsSync(drawsJsonPath)) {
    throw new Error(
      `Missing ${drawsJsonPath}. Run scripts/deploy-draws.ts first.`
    );
  }
  const draws = JSON.parse(fs.readFileSync(drawsJsonPath, "utf-8"));

  const accessRegistryAddr: string = draws.base.AccessRegistry;
  const escrowAddr: string = draws.base.WeezEscrow;
  const feeRouterAddr: string = draws.base.FeeRouter;
  const existingAdapterAddr: string = draws.contracts.RandomnessAdapter;
  const mockVrfAddr: string = draws.contracts.MockBandVRF;

  console.log("\nUsing existing deployment:");
  console.log("   AccessRegistry:    ", accessRegistryAddr);
  console.log("   WeezEscrow:        ", escrowAddr);
  console.log("   FeeRouter:         ", feeRouterAddr);
  console.log("   MockBandVRF:       ", mockVrfAddr);
  console.log("   (shared) Adapter:  ", existingAdapterAddr);

  // ─── Optionally deploy a dedicated RandomnessAdapter for CommunityDrawHub ───
  // Default: true, because the existing adapter is already wired to DrawHub
  // and only one consumer slot exists per adapter.
  const deployDedicatedAdapter =
    !process.argv.includes("--shared-adapter");

  let adapterAddrForCommunity = existingAdapterAddr;
  if (deployDedicatedAdapter) {
    console.log(
      "\n1. Deploying dedicated RandomnessAdapter for CommunityDrawHub..."
    );
    const RandomnessAdapterFactory = await ethers.getContractFactory(
      "RandomnessAdapter"
    );
    const adapter = await RandomnessAdapterFactory.deploy(mockVrfAddr);
    await adapter.waitForDeployment();
    adapterAddrForCommunity = await adapter.getAddress();
    console.log("   RandomnessAdapter(community):", adapterAddrForCommunity);
  } else {
    console.log(
      "\n1. Reusing shared RandomnessAdapter (will overwrite consumer slot!)"
    );
  }

  // ─── Deploy CommunityDrawHub ───
  console.log("\n2. Deploying CommunityDrawHub...");
  const CommunityDrawHubFactory = await ethers.getContractFactory(
    "CommunityDrawHub"
  );
  const communityDrawHub = await CommunityDrawHubFactory.deploy(
    accessRegistryAddr,
    escrowAddr,
    feeRouterAddr,
    adapterAddrForCommunity
  );
  const deployTx = communityDrawHub.deploymentTransaction();
  await communityDrawHub.waitForDeployment();
  const communityDrawHubAddr = await communityDrawHub.getAddress();
  const deployReceipt = deployTx ? await deployTx.wait() : null;
  console.log("   CommunityDrawHub:", communityDrawHubAddr);
  if (deployReceipt) {
    console.log("   tx hash:         ", deployReceipt.hash);
    console.log("   block number:    ", deployReceipt.blockNumber);
  }

  // ─── Register CommunityDrawHub as active module ───
  console.log(
    "\n3. Registering CommunityDrawHub as active module in AccessRegistry..."
  );
  const accessRegistry = await ethers.getContractAt(
    "AccessRegistry",
    accessRegistryAddr
  );
  const regTx = await accessRegistry.registerModule(communityDrawHubAddr);
  await regTx.wait();
  console.log("   Registered.");

  // ─── Wire adapter consumer → CommunityDrawHub ───
  console.log(
    "\n4. Wiring RandomnessAdapter.setConsumer(CommunityDrawHub)..."
  );
  const adapter = await ethers.getContractAt(
    "RandomnessAdapter",
    adapterAddrForCommunity
  );
  const setTx = await adapter.setConsumer(communityDrawHubAddr);
  await setTx.wait();
  console.log("   Consumer set.");

  // ─── Grant COMMUNITY_CREATOR_ROLE to deployer (for demo) ───
  const COMMUNITY_CREATOR_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("COMMUNITY_CREATOR_ROLE")
  );
  const hasCreator = await accessRegistry.hasRole(
    COMMUNITY_CREATOR_ROLE,
    deployer.address
  );
  if (!hasCreator) {
    console.log("\n5. Granting COMMUNITY_CREATOR_ROLE to deployer...");
    const grantTx = await accessRegistry.grantRole(
      COMMUNITY_CREATOR_ROLE,
      deployer.address
    );
    await grantTx.wait();
    console.log("   Granted.");
  } else {
    console.log(
      "\n5. Deployer already has COMMUNITY_CREATOR_ROLE, skipping."
    );
  }

  // ─── Persist to draws.json ───
  draws.contracts.CommunityDrawHub = communityDrawHubAddr;
  if (deployDedicatedAdapter) {
    draws.contracts.RandomnessAdapterCommunity = adapterAddrForCommunity;
  }
  draws.timestamp = new Date().toISOString();
  fs.writeFileSync(drawsJsonPath, JSON.stringify(draws, null, 2));

  console.log("\n════════════════════════════════════════");
  console.log("  CommunityDrawHub Deployment Complete");
  console.log("════════════════════════════════════════");
  console.log("  CommunityDrawHub:            ", communityDrawHubAddr);
  if (deployDedicatedAdapter) {
    console.log(
      "  RandomnessAdapterCommunity:  ",
      adapterAddrForCommunity
    );
  }
  console.log("════════════════════════════════════════");
  console.log(`\nAddresses saved to ${drawsJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
