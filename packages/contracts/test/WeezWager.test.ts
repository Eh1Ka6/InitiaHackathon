import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AccessRegistry, FeeRouter, WeezEscrow, WeezWager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("WeezDraw", function () {
  // ─── Fixture ───
  async function deployAllFixture() {
    const [deployer, player1, player2, resolver, nonResolver] = await ethers.getSigners();

    // Deploy AccessRegistry (UUPS proxy)
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    const accessRegistry = (await upgrades.deployProxy(
      AccessRegistry,
      [deployer.address],
      { kind: "uups" }
    )) as unknown as AccessRegistry;
    await accessRegistry.waitForDeployment();
    const accessRegistryAddr = await accessRegistry.getAddress();

    // Deploy FeeRouter (UUPS proxy)
    const FeeRouter = await ethers.getContractFactory("FeeRouter");
    const feeRouter = (await upgrades.deployProxy(
      FeeRouter,
      [accessRegistryAddr, deployer.address],
      { kind: "uups" }
    )) as unknown as FeeRouter;
    await feeRouter.waitForDeployment();
    const feeRouterAddr = await feeRouter.getAddress();

    // Deploy WeezEscrow
    const WeezEscrow = await ethers.getContractFactory("WeezEscrow");
    const escrow = (await WeezEscrow.deploy(accessRegistryAddr, 86400)) as unknown as WeezEscrow;
    await escrow.waitForDeployment();
    const escrowAddr = await escrow.getAddress();

    // Deploy WeezWager
    const WeezWagerFactory = await ethers.getContractFactory("WeezWager");
    const wager = (await WeezWagerFactory.deploy(
      accessRegistryAddr,
      escrowAddr,
      feeRouterAddr
    )) as unknown as WeezWager;
    await wager.waitForDeployment();
    const wagerAddr = await wager.getAddress();

    // Register WeezWager as active module
    await accessRegistry.registerModule(wagerAddr);

    // Grant roles
    const RESOLVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RESOLVER_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    await accessRegistry.grantRole(RESOLVER_ROLE, resolver.address);
    await accessRegistry.grantRole(OPERATOR_ROLE, deployer.address);

    // Set protocol fee to 0% for testing simplicity
    await feeRouter.setProtocolFeeBps(0);

    return { deployer, player1, player2, resolver, nonResolver, accessRegistry, feeRouter, escrow, wager, RESOLVER_ROLE, OPERATOR_ROLE };
  }

  // Helper to create a duel competition
  async function createDuel(
    wager: WeezWager,
    creator: HardhatEthersSigner,
    entryFee: bigint,
    deadlineOffset: number = 3600
  ): Promise<bigint> {
    const deadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + BigInt(deadlineOffset);
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint256", "uint256", "uint256", "string"],
      [0, entryFee, deadline, 2, "Test Duel"] // WagerType.DUEL = 0
    );
    const tx = await wager.connect(creator).createCompetition(params);
    const receipt = await tx.wait();
    // competitionId is nextCompetitionId - 1 after creation; read from events
    const event = receipt!.logs.find((log) => {
      try {
        return wager.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "WagerCreated";
      } catch {
        return false;
      }
    });
    const parsed = wager.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
    return parsed!.args.competitionId;
  }

  // ─── Tests ───

  describe("Core Flow", function () {
    it("should deploy all contracts correctly", async function () {
      const { accessRegistry, feeRouter, escrow, wager } = await loadFixture(deployAllFixture);
      expect(await accessRegistry.getAddress()).to.be.properAddress;
      expect(await feeRouter.getAddress()).to.be.properAddress;
      expect(await escrow.getAddress()).to.be.properAddress;
      expect(await wager.getAddress()).to.be.properAddress;
    });

    it("should create a DUEL competition", async function () {
      const { wager, deployer } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);
      expect(competitionId).to.equal(1n);

      const status = await wager.getCompetitionStatus(competitionId);
      expect(status).to.equal(1); // CompetitionStatus.Open
    });

    it("should allow two players to enter with correct entry fee", async function () {
      const { wager, deployer, player1, player2 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      const players = await wager.getWagerPlayers(competitionId);
      expect(players).to.have.lengthOf(2);
      expect(players[0]).to.equal(player1.address);
      expect(players[1]).to.equal(player2.address);
    });

    it("should auto-lock when both players enter a duel", async function () {
      const { wager, deployer, player1, player2 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      // After first player: still Open
      expect(await wager.getCompetitionStatus(competitionId)).to.equal(1); // Open

      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });
      // After second player: Locked
      expect(await wager.getCompetitionStatus(competitionId)).to.equal(2); // Locked
    });

    it("should allow resolver to start game", async function () {
      const { wager, deployer, player1, player2, resolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      await expect(wager.connect(resolver).startGame(competitionId))
        .to.emit(wager, "GameStarted")
        .withArgs(competitionId);

      expect(await wager.getCompetitionStatus(competitionId)).to.equal(3); // Playing
    });

    it("should settle with player1 as winner and transfer funds", async function () {
      const { wager, deployer, player1, player2, resolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });
      await wager.connect(resolver).startGame(competitionId);

      const balanceBefore = await ethers.provider.getBalance(player1.address);

      // Settle: player1 wins
      await expect(wager.connect(resolver).settle(competitionId, [player1.address]))
        .to.emit(wager, "CompetitionSettled");

      const balanceAfter = await ethers.provider.getBalance(player1.address);

      // With 0% fees, winner should receive the full pot (2 ETH)
      const totalPot = entryFee * 2n;
      expect(balanceAfter - balanceBefore).to.equal(totalPot);

      expect(await wager.getCompetitionStatus(competitionId)).to.equal(4); // Settled
    });

    it("should settle with zero fees and winner gets full pot", async function () {
      const { wager, deployer, player1, player2, resolver } = await loadFixture(deployAllFixture);

      // Protocol fee is 0% in fixture (hackathon default)
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });
      await wager.connect(resolver).startGame(competitionId);

      const balanceBefore = await ethers.provider.getBalance(player1.address);

      await wager.connect(resolver).settle(competitionId, [player1.address]);

      const balanceAfter = await ethers.provider.getBalance(player1.address);

      // 0% fee, winner gets full pot (2 ETH)
      const totalPot = entryFee * 2n;
      expect(balanceAfter - balanceBefore).to.equal(totalPot);
    });
  });

  describe("Cancel Flow", function () {
    it("should cancel and refund all players", async function () {
      const { wager, deployer, player1, player2 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      const p1BalanceBefore = await ethers.provider.getBalance(player1.address);
      const p2BalanceBefore = await ethers.provider.getBalance(player2.address);

      await expect(wager.connect(deployer).cancel(competitionId))
        .to.emit(wager, "CompetitionCancelled")
        .withArgs(competitionId);

      const p1BalanceAfter = await ethers.provider.getBalance(player1.address);
      const p2BalanceAfter = await ethers.provider.getBalance(player2.address);

      expect(p1BalanceAfter - p1BalanceBefore).to.equal(entryFee);
      expect(p2BalanceAfter - p2BalanceBefore).to.equal(entryFee);

      expect(await wager.getCompetitionStatus(competitionId)).to.equal(5); // Cancelled
    });

    it("should cancel with single player and refund", async function () {
      const { wager, deployer, player1 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });

      const balanceBefore = await ethers.provider.getBalance(player1.address);
      await wager.connect(deployer).cancel(competitionId);
      const balanceAfter = await ethers.provider.getBalance(player1.address);

      expect(balanceAfter - balanceBefore).to.equal(entryFee);
    });
  });

  describe("Access Control", function () {
    it("should revert if non-resolver tries to settle", async function () {
      const { wager, deployer, player1, player2, nonResolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      await expect(
        wager.connect(nonResolver).settle(competitionId, [player1.address])
      ).to.be.revertedWithCustomError(wager, "Unauthorized");
    });

    it("should revert if non-resolver tries to start game", async function () {
      const { wager, deployer, player1, player2, nonResolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      await expect(
        wager.connect(nonResolver).startGame(competitionId)
      ).to.be.revertedWithCustomError(wager, "Unauthorized");
    });

    it("should revert if non-creator/non-admin tries to cancel", async function () {
      const { wager, deployer, player1, player2, nonResolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });

      await expect(
        wager.connect(nonResolver).cancel(competitionId)
      ).to.be.revertedWithCustomError(wager, "Unauthorized");
    });
  });

  describe("Edge Cases", function () {
    it("should reject incorrect entry fee", async function () {
      const { wager, deployer, player1 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await expect(
        wager.connect(player1).enter(competitionId, player1.address, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(wager, "IncorrectEntryFee");
    });

    it("should reject double entry", async function () {
      const { wager, deployer, player1 } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });

      await expect(
        wager.connect(player1).enter(competitionId, player1.address, { value: entryFee })
      ).to.be.revertedWithCustomError(wager, "AlreadyEntered");
    });

    it("should reject entry after duel is full", async function () {
      const { wager, deployer, player1, player2, nonResolver } = await loadFixture(deployAllFixture);
      const entryFee = ethers.parseEther("1");
      const competitionId = await createDuel(wager, deployer, entryFee);

      await wager.connect(player1).enter(competitionId, player1.address, { value: entryFee });
      await wager.connect(player2).enter(competitionId, player2.address, { value: entryFee });

      // Duel auto-locks after 2 players, so third entry gets CompetitionNotOpen
      await expect(
        wager.connect(nonResolver).enter(competitionId, nonResolver.address, { value: entryFee })
      ).to.be.revertedWithCustomError(wager, "CompetitionNotOpen");
    });
  });
});
