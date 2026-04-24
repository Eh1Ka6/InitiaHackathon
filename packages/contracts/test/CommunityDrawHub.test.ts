import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type {
  AccessRegistry,
  FeeRouter,
  WeezEscrow,
  RandomnessAdapter,
  CommunityDrawHub,
  MockBandVRF,
} from "../typechain-types";

describe("CommunityDrawHub", function () {
  async function deployAllFixture() {
    const [deployer, creator, nonCreator, buyer1, buyer2, buyer3, admin] =
      await ethers.getSigners();

    const AccessRegistryFactory = await ethers.getContractFactory("AccessRegistry");
    const accessRegistry = (await upgrades.deployProxy(
      AccessRegistryFactory,
      [deployer.address],
      { kind: "uups" }
    )) as unknown as AccessRegistry;
    await accessRegistry.waitForDeployment();
    const accessRegistryAddr = await accessRegistry.getAddress();

    const FeeRouterFactory = await ethers.getContractFactory("FeeRouter");
    const feeRouter = (await upgrades.deployProxy(
      FeeRouterFactory,
      [accessRegistryAddr, deployer.address],
      { kind: "uups" }
    )) as unknown as FeeRouter;
    await feeRouter.waitForDeployment();
    const feeRouterAddr = await feeRouter.getAddress();

    const WeezEscrowFactory = await ethers.getContractFactory("WeezEscrow");
    const escrow = (await WeezEscrowFactory.deploy(accessRegistryAddr, 86400)) as unknown as WeezEscrow;
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();

    const MockBandVRFFactory = await ethers.getContractFactory("MockBandVRF");
    const mockVrf = (await MockBandVRFFactory.deploy()) as unknown as MockBandVRF;
    await mockVrf.waitForDeployment();
    const mockVrfAddr = await mockVrf.getAddress();

    const RandomnessAdapterFactory = await ethers.getContractFactory("RandomnessAdapter");
    const adapter = (await RandomnessAdapterFactory.deploy(mockVrfAddr)) as unknown as RandomnessAdapter;
    await adapter.waitForDeployment();
    const adapterAddr = await adapter.getAddress();

    const HubFactory = await ethers.getContractFactory("CommunityDrawHub");
    const hub = (await HubFactory.deploy(
      accessRegistryAddr,
      escrowAddr,
      feeRouterAddr,
      adapterAddr
    )) as unknown as CommunityDrawHub;
    await hub.waitForDeployment();
    const hubAddr = await hub.getAddress();

    await accessRegistry.registerModule(hubAddr);
    await adapter.setConsumer(hubAddr);

    const COMMUNITY_CREATOR_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("COMMUNITY_CREATOR_ROLE")
    );
    const PROTOCOL_ADMIN_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("PROTOCOL_ADMIN_ROLE")
    );
    await accessRegistry.grantRole(COMMUNITY_CREATOR_ROLE, creator.address);
    await accessRegistry.grantRole(PROTOCOL_ADMIN_ROLE, admin.address);

    await feeRouter.setProtocolFeeBps(0);

    return {
      deployer,
      creator,
      nonCreator,
      buyer1,
      buyer2,
      buyer3,
      admin,
      accessRegistry,
      feeRouter,
      escrow,
      mockVrf,
      adapter,
      hub,
      COMMUNITY_CREATOR_ROLE,
      PROTOCOL_ADMIN_ROLE,
    };
  }

  async function createDraw(
    hub: CommunityDrawHub,
    who: HardhatEthersSigner,
    prize: bigint,
    ticketPrice: bigint,
    maxTickets: number,
    winnerCount: number,
    deadlineOffset: number = 3600
  ) {
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const endTs = now + BigInt(deadlineOffset);
    const title = ethers.encodeBytes32String("Test Draw");
    const tx = await hub
      .connect(who)
      .createCommunityDraw(title, prize, ticketPrice, maxTickets, endTs, winnerCount, {
        value: prize,
      });
    await tx.wait();
    return { endTs, title };
  }

  describe("Access control", function () {
    it("whitelisted creator can create a draw", async function () {
      const { hub, creator } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("5");
      const { endTs } = await createDraw(hub, creator, prize, ethers.parseEther("1"), 10, 1);

      const d = await hub.getCommunityDraw(1n);
      expect(d.status).to.equal(1n); // Open
      expect(d.creator).to.equal(creator.address);
      expect(d.prizeAmount).to.equal(prize);
      expect(d.endTimestamp).to.equal(endTs);
    });

    it("non-whitelisted caller cannot create a draw", async function () {
      const { hub, nonCreator } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("1");
      const title = ethers.encodeBytes32String("x");
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      await expect(
        hub
          .connect(nonCreator)
          .createCommunityDraw(title, prize, ethers.parseEther("0.1"), 5, now + 3600n, 1, {
            value: prize,
          })
      ).to.be.revertedWithCustomError(hub, "Unauthorized");
    });

    it("creator must post full prize as stake", async function () {
      const { hub, creator } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("5");
      const title = ethers.encodeBytes32String("x");
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      await expect(
        hub
          .connect(creator)
          .createCommunityDraw(title, prize, ethers.parseEther("1"), 10, now + 3600n, 1, {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(hub, "IncorrectStake");
    });

    it("invalid params rejected", async function () {
      const { hub, creator } = await loadFixture(deployAllFixture);
      const title = ethers.encodeBytes32String("x");
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      // winnerCount > maxTickets
      await expect(
        hub.connect(creator).createCommunityDraw(title, 1n, 1n, 1, now + 100n, 2, { value: 1n })
      ).to.be.revertedWithCustomError(hub, "InvalidParams");
      // zero prize
      await expect(
        hub.connect(creator).createCommunityDraw(title, 0n, 1n, 1, now + 100n, 1, { value: 0n })
      ).to.be.revertedWithCustomError(hub, "InvalidParams");
      // end in past
      await expect(
        hub.connect(creator).createCommunityDraw(title, 1n, 1n, 1, 1n, 1, { value: 1n })
      ).to.be.revertedWithCustomError(hub, "InvalidParams");
    });
  });

  describe("Ticket purchase", function () {
    it("anyone can buy a ticket while open; escrow balance grows", async function () {
      const { hub, creator, buyer1, buyer2, escrow } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("2");
      const tp = ethers.parseEther("0.5");
      await createDraw(hub, creator, prize, tp, 10, 1);

      const drawId = 1n;
      const escrowId = await hub.escrowIdOf(drawId);

      await hub.connect(buyer1).buyTicket(drawId, { value: tp });
      await hub.connect(buyer2).buyTicket(drawId, { value: tp });

      const bal = await escrow.getCompetitionBalance(escrowId);
      expect(bal).to.equal(prize + tp * 2n);

      const tix = await hub.getTickets(drawId);
      expect(tix.length).to.equal(2);
      expect(tix[0]).to.equal(buyer1.address);
      expect(tix[1]).to.equal(buyer2.address);

      const d = await hub.getCommunityDraw(drawId);
      expect(d.ticketsSold).to.equal(2n);
    });

    it("incorrect ticket price reverts", async function () {
      const { hub, creator, buyer1 } = await loadFixture(deployAllFixture);
      await createDraw(hub, creator, ethers.parseEther("1"), ethers.parseEther("0.5"), 5, 1);
      await expect(
        hub.connect(buyer1).buyTicket(1n, { value: ethers.parseEther("0.25") })
      ).to.be.revertedWithCustomError(hub, "IncorrectTicketPrice");
    });

    it("cannot buy after endTimestamp", async function () {
      const { hub, creator, buyer1 } = await loadFixture(deployAllFixture);
      await createDraw(hub, creator, ethers.parseEther("1"), ethers.parseEther("0.5"), 5, 1, 100);
      await time.increase(101);
      await expect(
        hub.connect(buyer1).buyTicket(1n, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(hub, "SaleClosed");
    });

    it("cannot buy once sold out", async function () {
      const { hub, creator, buyer1, buyer2 } = await loadFixture(deployAllFixture);
      const tp = ethers.parseEther("0.1");
      await createDraw(hub, creator, ethers.parseEther("1"), tp, 1, 1);
      await hub.connect(buyer1).buyTicket(1n, { value: tp });
      await expect(
        hub.connect(buyer2).buyTicket(1n, { value: tp })
      ).to.be.revertedWithCustomError(hub, "SoldOut");
    });
  });

  describe("Settlement", function () {
    it("settles via VRF, picks winner, pays winner + creator proceeds", async function () {
      const { hub, creator, buyer1, buyer2, buyer3, mockVrf } =
        await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("3");
      const tp = ethers.parseEther("1");
      await createDraw(hub, creator, prize, tp, 5, 1);

      const drawId = 1n;
      await hub.connect(buyer1).buyTicket(drawId, { value: tp });
      await hub.connect(buyer2).buyTicket(drawId, { value: tp });
      await hub.connect(buyer3).buyTicket(drawId, { value: tp });

      const d = await hub.getCommunityDraw(drawId);
      await time.increaseTo(Number(d.endTimestamp) + 1);

      const creatorBalBefore = await ethers.provider.getBalance(creator.address);
      const b1Before = await ethers.provider.getBalance(buyer1.address);
      const b2Before = await ethers.provider.getBalance(buyer2.address);
      const b3Before = await ethers.provider.getBalance(buyer3.address);

      // Anyone can call settle
      await hub.connect(buyer1).settleCommunityDraw(drawId);
      const dAfterReq = await hub.getCommunityDraw(drawId);
      expect(dAfterReq.status).to.equal(2n); // RandomnessRequested
      const requestId = dAfterReq.vrfRequestId;

      await mockVrf.fulfill(requestId, 777n);

      const dFinal = await hub.getCommunityDraw(drawId);
      expect(dFinal.status).to.equal(3n); // Settled

      const creatorBalAfter = await ethers.provider.getBalance(creator.address);
      const b1After = await ethers.provider.getBalance(buyer1.address);
      const b2After = await ethers.provider.getBalance(buyer2.address);
      const b3After = await ethers.provider.getBalance(buyer3.address);

      // Creator proceeds = ticketGross (protocol fee = 0)
      expect(creatorBalAfter - creatorBalBefore).to.equal(tp * 3n);

      // Exactly one of the buyers received the prize
      const deltas = [b1After - b1Before, b2After - b2Before, b3After - b3Before];
      const payouts = deltas.filter((x) => x > 0n);
      expect(payouts.length).to.equal(1);
      expect(payouts[0]).to.equal(prize);
    });

    it("with multiple winners, prize is split equally", async function () {
      const { hub, creator, buyer1, buyer2, buyer3, mockVrf } =
        await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("3");
      const tp = ethers.parseEther("0.1");
      const title = ethers.encodeBytes32String("multi");
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      await hub
        .connect(creator)
        .createCommunityDraw(title, prize, tp, 5, now + 3600n, 2, { value: prize });

      const drawId = 1n;
      await hub.connect(buyer1).buyTicket(drawId, { value: tp });
      await hub.connect(buyer2).buyTicket(drawId, { value: tp });
      await hub.connect(buyer3).buyTicket(drawId, { value: tp });

      await time.increase(3601);
      await hub.settleCommunityDraw(drawId);
      const d = await hub.getCommunityDraw(drawId);
      await mockVrf.fulfill(d.vrfRequestId, 42n);

      const dAfter = await hub.getCommunityDraw(drawId);
      expect(dAfter.status).to.equal(3n);
      // 2 unique winners, each gets prize/2
    });

    it("zero-ticket settlement refunds creator stake, marks Cancelled", async function () {
      const { hub, creator } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("2");
      await createDraw(hub, creator, prize, ethers.parseEther("0.5"), 5, 1, 200);

      await time.increase(201);

      const creatorBalBefore = await ethers.provider.getBalance(creator.address);
      const tx = await hub.connect(creator).settleCommunityDraw(1n);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const creatorBalAfter = await ethers.provider.getBalance(creator.address);

      // Creator got prize back minus the gas they paid to call settle.
      expect(creatorBalAfter - creatorBalBefore + gasCost).to.equal(prize);

      const d = await hub.getCommunityDraw(1n);
      expect(d.status).to.equal(4n); // Cancelled
    });

    it("cannot settle before endTimestamp", async function () {
      const { hub, creator, buyer1 } = await loadFixture(deployAllFixture);
      await createDraw(hub, creator, ethers.parseEther("1"), ethers.parseEther("0.1"), 5, 1);
      await hub.connect(buyer1).buyTicket(1n, { value: ethers.parseEther("0.1") });
      await expect(hub.settleCommunityDraw(1n)).to.be.revertedWithCustomError(
        hub,
        "EndNotReached"
      );
    });
  });

  describe("Cancel", function () {
    it("creator can cancel before any ticket sold; full stake refunded", async function () {
      const { hub, creator } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("2");
      await createDraw(hub, creator, prize, ethers.parseEther("0.5"), 5, 1);

      const balBefore = await ethers.provider.getBalance(creator.address);
      const tx = await hub.connect(creator).cancelCommunityDraw(1n);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(creator.address);

      expect(balAfter - balBefore + gasCost).to.equal(prize);

      const d = await hub.getCommunityDraw(1n);
      expect(d.status).to.equal(4n); // Cancelled
    });

    it("creator cannot cancel once tickets are sold", async function () {
      const { hub, creator, buyer1 } = await loadFixture(deployAllFixture);
      const tp = ethers.parseEther("0.5");
      await createDraw(hub, creator, ethers.parseEther("2"), tp, 5, 1);
      await hub.connect(buyer1).buyTicket(1n, { value: tp });
      await expect(hub.connect(creator).cancelCommunityDraw(1n)).to.be.revertedWithCustomError(
        hub,
        "TicketsAlreadySold"
      );
    });

    it("admin can force-cancel after tickets sold; buyers + creator refunded", async function () {
      const { hub, creator, admin, buyer1, buyer2 } = await loadFixture(deployAllFixture);
      const prize = ethers.parseEther("3");
      const tp = ethers.parseEther("1");
      await createDraw(hub, creator, prize, tp, 5, 1);

      await hub.connect(buyer1).buyTicket(1n, { value: tp });
      await hub.connect(buyer2).buyTicket(1n, { value: tp });

      const cBefore = await ethers.provider.getBalance(creator.address);
      const b1Before = await ethers.provider.getBalance(buyer1.address);
      const b2Before = await ethers.provider.getBalance(buyer2.address);

      await hub.connect(admin).cancelCommunityDraw(1n);

      expect((await ethers.provider.getBalance(creator.address)) - cBefore).to.equal(prize);
      expect((await ethers.provider.getBalance(buyer1.address)) - b1Before).to.equal(tp);
      expect((await ethers.provider.getBalance(buyer2.address)) - b2Before).to.equal(tp);

      const d = await hub.getCommunityDraw(1n);
      expect(d.status).to.equal(4n);
    });

    it("non-creator non-admin cannot cancel", async function () {
      const { hub, creator, buyer1 } = await loadFixture(deployAllFixture);
      await createDraw(hub, creator, ethers.parseEther("1"), ethers.parseEther("0.1"), 5, 1);
      await expect(hub.connect(buyer1).cancelCommunityDraw(1n)).to.be.revertedWithCustomError(
        hub,
        "Unauthorized"
      );
    });
  });
});
