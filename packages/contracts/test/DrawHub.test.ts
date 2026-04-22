import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type {
  AccessRegistry,
  FeeRouter,
  WeezEscrow,
  RandomnessAdapter,
  DrawHub,
  MockBandVRF,
} from "../typechain-types";

describe("DrawHub", function () {
  async function deployAllFixture() {
    const [deployer, p1, p2, p3, resolver, nonResolver] = await ethers.getSigners();

    // AccessRegistry (UUPS)
    const AccessRegistryFactory = await ethers.getContractFactory("AccessRegistry");
    const accessRegistry = (await upgrades.deployProxy(
      AccessRegistryFactory,
      [deployer.address],
      { kind: "uups" }
    )) as unknown as AccessRegistry;
    await accessRegistry.waitForDeployment();
    const accessRegistryAddr = await accessRegistry.getAddress();

    // FeeRouter (UUPS)
    const FeeRouterFactory = await ethers.getContractFactory("FeeRouter");
    const feeRouter = (await upgrades.deployProxy(
      FeeRouterFactory,
      [accessRegistryAddr, deployer.address],
      { kind: "uups" }
    )) as unknown as FeeRouter;
    await feeRouter.waitForDeployment();
    const feeRouterAddr = await feeRouter.getAddress();

    // WeezEscrow
    const WeezEscrowFactory = await ethers.getContractFactory("WeezEscrow");
    const escrow = (await WeezEscrowFactory.deploy(accessRegistryAddr, 86400)) as unknown as WeezEscrow;
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();

    // MockBandVRF
    const MockBandVRFFactory = await ethers.getContractFactory("MockBandVRF");
    const mockVrf = (await MockBandVRFFactory.deploy()) as unknown as MockBandVRF;
    await mockVrf.waitForDeployment();
    const mockVrfAddr = await mockVrf.getAddress();

    // RandomnessAdapter
    const RandomnessAdapterFactory = await ethers.getContractFactory("RandomnessAdapter");
    const adapter = (await RandomnessAdapterFactory.deploy(mockVrfAddr)) as unknown as RandomnessAdapter;
    await adapter.waitForDeployment();
    const adapterAddr = await adapter.getAddress();

    // DrawHub
    const DrawHubFactory = await ethers.getContractFactory("DrawHub");
    const drawHub = (await DrawHubFactory.deploy(
      accessRegistryAddr,
      escrowAddr,
      feeRouterAddr,
      adapterAddr
    )) as unknown as DrawHub;
    await drawHub.waitForDeployment();
    const drawHubAddr = await drawHub.getAddress();

    // Register DrawHub as active module
    await accessRegistry.registerModule(drawHubAddr);

    // Wire adapter consumer
    await adapter.setConsumer(drawHubAddr);

    // Roles
    const RESOLVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RESOLVER_ROLE"));
    await accessRegistry.grantRole(RESOLVER_ROLE, resolver.address);
    await accessRegistry.grantRole(RESOLVER_ROLE, deployer.address);

    // Zero protocol fee to simplify balance math
    await feeRouter.setProtocolFeeBps(0);

    return {
      deployer,
      p1,
      p2,
      p3,
      resolver,
      nonResolver,
      accessRegistry,
      feeRouter,
      escrow,
      mockVrf,
      adapter,
      drawHub,
      RESOLVER_ROLE,
    };
  }

  async function createDraw(
    drawHub: DrawHub,
    admin: HardhatEthersSigner,
    drawId: bigint,
    entryFee: bigint,
    deadlineOffset: number = 3600,
    configId: number = 0
  ) {
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const deadline = now + BigInt(deadlineOffset);
    await drawHub.connect(admin).createDraw(drawId, entryFee, deadline, configId);
    return deadline;
  }

  // ─── MultiplierLib tests ───
  describe("MultiplierLib", function () {
    // Deploy a tiny harness contract that exposes pickMultiplier for testing.
    async function deployHarness() {
      const HarnessFactory = await ethers.getContractFactory("MultiplierLibHarness");
      const harness = await HarnessFactory.deploy();
      await harness.waitForDeployment();
      return harness;
    }

    it("all 4 configs have lastThreshold == 100_000_000", async function () {
      const harness = await deployHarness();
      for (let cfg = 0; cfg < 4; cfg++) {
        const thresholds = await harness.getThresholds(cfg);
        expect(thresholds[5]).to.equal(100_000_000n);
      }
    });

    it("entropy=0 picks the first bucket (x300)", async function () {
      const harness = await deployHarness();
      const mult = await harness.pick(0, 0);
      expect(mult).to.equal(300n);
    });

    it("entropy near end of range picks the last bucket (x8)", async function () {
      const harness = await deployHarness();
      // roll = (100_000_000 - 1), which is the last bucket (x8)
      const mult = await harness.pick(0, 99_999_999n);
      expect(mult).to.equal(8n);
    });

    it("reverts on configId >= 4", async function () {
      const harness = await deployHarness();
      await expect(harness.pick(4, 0)).to.be.revertedWithCustomError(
        harness,
        "InvalidConfigId"
      );
    });

    it("config 1: entropy=5_000 picks x50 (threshold 128_060 from start 8_060)", async function () {
      // Config 1 thresholds: [60, 8_060, 128_060, 6_128_060, 60_128_060, 100_000_000]
      // roll=5000 → between 60 and 8060 → x100
      const harness = await deployHarness();
      const mult = await harness.pick(1, 5000n);
      expect(mult).to.equal(100n);
    });
  });

  // ─── DrawHub happy path ───
  describe("Full lifecycle", function () {
    it("creates draw, 3 deposits, 2 qualifiers, winner receives payout", async function () {
      const { drawHub, deployer, p1, p2, p3, resolver, mockVrf, adapter, escrow } =
        await loadFixture(deployAllFixture);

      const drawId = 1n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee, 3600, 0);

      // 3 deposits
      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await drawHub.connect(p2).depositLocal(drawId, { value: entryFee });
      await drawHub.connect(p3).depositLocal(drawId, { value: entryFee });

      const participants = await drawHub.getParticipants(drawId);
      expect(participants.length).to.equal(3);

      // Advance past deadline
      await time.increaseTo(Number(deadline) + 1);

      // Record qualifiers (p1, p2)
      await drawHub.connect(resolver).recordQualifiers(drawId, [p1.address, p2.address]);
      const qualifiers = await drawHub.getQualifiers(drawId);
      expect(qualifiers.length).to.equal(2);

      const drawBefore = await drawHub.getDraw(drawId);
      expect(drawBefore.status).to.equal(3n); // Qualified

      // Request randomness
      await drawHub.connect(resolver).requestRandomness(drawId);
      const drawMid = await drawHub.getDraw(drawId);
      expect(drawMid.status).to.equal(4n); // RandomnessRequested
      const requestId = drawMid.vrfRequestId;
      expect(requestId).to.be.greaterThan(0n);

      // Track balances of qualifiers before fulfillment
      const p1BalBefore = await ethers.provider.getBalance(p1.address);
      const p2BalBefore = await ethers.provider.getBalance(p2.address);

      // Admin fulfills with a seed — winner is deterministic:
      // wEntropy = keccak256(randomWord, "winner") % 2
      const randomWord = 12345n;
      await mockVrf.fulfill(requestId, randomWord);

      const drawAfter = await drawHub.getDraw(drawId);
      expect(drawAfter.status).to.equal(5n); // Settled

      const winner = drawAfter.winner;
      expect([p1.address, p2.address]).to.include(winner);

      const multiplier = drawAfter.multiplier;
      expect([300n, 100n, 50n, 20n, 10n, 8n]).to.include(multiplier);

      // Winner balance should increase by exactly `payout`.
      const p1BalAfter = await ethers.provider.getBalance(p1.address);
      const p2BalAfter = await ethers.provider.getBalance(p2.address);
      const p1Delta = p1BalAfter - p1BalBefore;
      const p2Delta = p2BalAfter - p2BalBefore;

      // One of them receives the payout, the other receives 0.
      if (winner === p1.address) {
        expect(p1Delta).to.equal(drawAfter.payout);
        expect(p2Delta).to.equal(0n);
      } else {
        expect(p2Delta).to.equal(drawAfter.payout);
        expect(p1Delta).to.equal(0n);
      }

      // With protocol fee = 0, payout should equal gross (min(net*mult, gross) = gross).
      const gross = entryFee * 3n;
      expect(drawAfter.payout).to.equal(gross);
    });

    it("zero qualifiers → cancelDraw path refunds all participants", async function () {
      const { drawHub, deployer, p1, p2, resolver } = await loadFixture(deployAllFixture);

      const drawId = 2n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee);

      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await drawHub.connect(p2).depositLocal(drawId, { value: entryFee });

      await time.increaseTo(Number(deadline) + 1);

      const p1BalBefore = await ethers.provider.getBalance(p1.address);
      const p2BalBefore = await ethers.provider.getBalance(p2.address);

      await drawHub.connect(resolver).recordQualifiers(drawId, []);

      const p1BalAfter = await ethers.provider.getBalance(p1.address);
      const p2BalAfter = await ethers.provider.getBalance(p2.address);

      expect(p1BalAfter - p1BalBefore).to.equal(entryFee);
      expect(p2BalAfter - p2BalBefore).to.equal(entryFee);

      const d = await drawHub.getDraw(drawId);
      expect(d.status).to.equal(6n); // Cancelled
    });

    it("cannot deposit after deadline", async function () {
      const { drawHub, deployer, p1 } = await loadFixture(deployAllFixture);
      const drawId = 3n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee, 100);

      await time.increaseTo(Number(deadline) + 1);

      await expect(
        drawHub.connect(p1).depositLocal(drawId, { value: entryFee })
      ).to.be.revertedWithCustomError(drawHub, "DeadlinePassed");
    });

    it("cannot deposit twice", async function () {
      const { drawHub, deployer, p1 } = await loadFixture(deployAllFixture);
      const drawId = 4n;
      const entryFee = ethers.parseEther("1");
      await createDraw(drawHub, deployer, drawId, entryFee);

      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await expect(
        drawHub.connect(p1).depositLocal(drawId, { value: entryFee })
      ).to.be.revertedWithCustomError(drawHub, "AlreadyEntered");
    });

    it("cannot recordQualifiers as non-resolver", async function () {
      const { drawHub, deployer, p1, nonResolver } = await loadFixture(deployAllFixture);
      const drawId = 5n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee);

      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await time.increaseTo(Number(deadline) + 1);

      await expect(
        drawHub.connect(nonResolver).recordQualifiers(drawId, [p1.address])
      ).to.be.revertedWithCustomError(drawHub, "Unauthorized");
    });

    it("cannot settle twice (second fulfill on same requestId rejected by mock)", async function () {
      const { drawHub, deployer, p1, p2, resolver, mockVrf } = await loadFixture(deployAllFixture);
      const drawId = 6n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee);

      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await drawHub.connect(p2).depositLocal(drawId, { value: entryFee });
      await time.increaseTo(Number(deadline) + 1);

      await drawHub.connect(resolver).recordQualifiers(drawId, [p1.address, p2.address]);
      await drawHub.connect(resolver).requestRandomness(drawId);
      const d = await drawHub.getDraw(drawId);
      const requestId = d.vrfRequestId;

      await mockVrf.fulfill(requestId, 999n);

      // Second fulfill on the same requestId → mock rejects
      await expect(mockVrf.fulfill(requestId, 999n)).to.be.revertedWithCustomError(
        mockVrf,
        "AlreadyFulfilled"
      );
    });

    it("adminResetVrf works after grace period", async function () {
      const { drawHub, deployer, p1, p2, resolver } = await loadFixture(deployAllFixture);
      const drawId = 7n;
      const entryFee = ethers.parseEther("1");
      const deadline = await createDraw(drawHub, deployer, drawId, entryFee);

      await drawHub.connect(p1).depositLocal(drawId, { value: entryFee });
      await drawHub.connect(p2).depositLocal(drawId, { value: entryFee });
      await time.increaseTo(Number(deadline) + 1);

      await drawHub.connect(resolver).recordQualifiers(drawId, [p1.address, p2.address]);
      await drawHub.connect(resolver).requestRandomness(drawId);

      // Too early
      await expect(drawHub.connect(deployer).adminResetVrf(drawId))
        .to.be.revertedWithCustomError(drawHub, "VrfResetTooEarly");

      // Advance > 1h
      await time.increase(3601);
      await drawHub.connect(deployer).adminResetVrf(drawId);

      const d = await drawHub.getDraw(drawId);
      expect(d.status).to.equal(3n); // Qualified
      expect(d.vrfRequestId).to.equal(0n);
    });
  });
});
