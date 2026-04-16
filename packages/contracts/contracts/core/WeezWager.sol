// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IWeezCompetition.sol";
import "../interfaces/IAccessRegistry.sol";
import "../libraries/PayoutStructureLib.sol";
import "./WeezEscrow.sol";
import "./FeeRouter.sol";

/// @title WeezWager
/// @notice Social wagering contract for 1v1 duels and group pools.
/// @dev Implements IWeezCompetition. Integrates with WeezEscrow for stake custody
///      and FeeRouter for platform fee collection.
contract WeezWager is IWeezCompetition {
    using PayoutStructureLib for IWeezCompetition.PayoutTier[];

    // ──────────────────────────────────────────────── Types
    enum WagerType { DUEL, POOL }

    struct Wager {
        address creator;
        WagerType wagerType;
        CompetitionStatus status;
        uint256 entryFee;
        uint256 deadline;
        uint256 maxPlayers;
        uint256 playerCount;
        uint16 totalWinners;
        string description;
    }

    // ──────────────────────────────────────────────── Immutables
    IAccessRegistry public immutable accessRegistry;
    WeezEscrow public immutable escrow;
    FeeRouter public immutable feeRouter;

    // ──────────────────────────────────────────────── Roles
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant GAME_CREATOR_ROLE = keccak256("GAME_CREATOR_ROLE");

    // ──────────────────────────────────────────────── State
    uint256 public nextCompetitionId = 1;
    mapping(uint256 => Wager) public wagers;
    mapping(uint256 => address[]) public wagerPlayers;
    mapping(uint256 => mapping(address => bool)) public hasEntered;
    mapping(uint256 => mapping(address => uint8)) public playerSide; // 0=N/A, 1=sideA, 2=sideB
    mapping(uint256 => PayoutTier[]) internal _payoutTiers;

    // ──────────────────────────────────────────────── Errors
    error Unauthorized(address caller);
    error AlreadyEntered(uint256 competitionId, address player);
    error WagerFull(uint256 competitionId);
    error DeadlinePassed(uint256 competitionId);
    error DeadlineNotPassed(uint256 competitionId);
    error IncorrectEntryFee(uint256 expected, uint256 actual);
    error InvalidSide(uint8 side);
    error NotDuel(uint256 competitionId);
    error NotPool(uint256 competitionId);
    error ZeroEntryFee();
    error ZeroDeadline();

    // ──────────────────────────────────────────────── Events
    event WagerCreated(uint256 indexed competitionId, address indexed creator, WagerType wagerType, uint256 entryFee, string description);
    event PlayerJoinedSide(uint256 indexed competitionId, address indexed player, uint8 side);
    event GameStarted(uint256 indexed competitionId);

    // ──────────────────────────────────────────────── Modifiers
    modifier onlyResolver() {
        if (!accessRegistry.hasRole(RESOLVER_ROLE, msg.sender)) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyCreatorOrAdmin(uint256 competitionId) {
        Wager storage w = wagers[competitionId];
        bool isCreator = msg.sender == w.creator;
        bool isAdmin = accessRegistry.hasRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        if (!isCreator && !isAdmin) revert Unauthorized(msg.sender);
        _;
    }

    // ──────────────────────────────────────────────── Constructor

    constructor(address _accessRegistry, address _escrow, address _feeRouter) {
        accessRegistry = IAccessRegistry(_accessRegistry);
        escrow = WeezEscrow(_escrow);
        feeRouter = FeeRouter(_feeRouter);
    }

    // ──────────────────────────────────────────────── Create

    /// @notice Create a new wager (duel or pool)
    /// @param params ABI-encoded: (WagerType, uint256 entryFee, uint256 deadline, uint256 maxPlayers, string description)
    /// @return competitionId The new wager ID
    function createCompetition(bytes calldata params) external override returns (uint256 competitionId) {
        (WagerType wagerType, uint256 entryFee, uint256 deadline, uint256 maxPlayers, string memory description) =
            abi.decode(params, (WagerType, uint256, uint256, uint256, string));

        if (entryFee == 0) revert ZeroEntryFee();
        if (deadline <= block.timestamp) revert ZeroDeadline();

        competitionId = nextCompetitionId++;

        // For duels: winner-takes-all payout
        PayoutTier[] storage tiers = _payoutTiers[competitionId];
        if (wagerType == WagerType.DUEL) {
            maxPlayers = 2;
            tiers.push(PayoutTier({rankFrom: 1, rankTo: 1, shareBps: 10000}));
        } else {
            // Pool: equal split among winners (configured at settlement)
            tiers.push(PayoutTier({rankFrom: 1, rankTo: 1, shareBps: 10000}));
        }

        uint16 totalWinners = 1; // Updated at settlement for pools

        wagers[competitionId] = Wager({
            creator: msg.sender,
            wagerType: wagerType,
            status: CompetitionStatus.Open,
            entryFee: entryFee,
            deadline: deadline,
            maxPlayers: maxPlayers,
            playerCount: 0,
            totalWinners: totalWinners,
            description: description
        });

        PayoutTier[] memory emitTiers = new PayoutTier[](1);
        emitTiers[0] = tiers[0];
        emit CompetitionCreated(competitionId, msg.sender, entryFee, emitTiers);
        emit WagerCreated(competitionId, msg.sender, wagerType, entryFee, description);
    }

    // ──────────────────────────────────────────────── Enter (Duel)

    /// @notice Enter a duel wager by depositing the entry fee
    function enter(uint256 competitionId, address player) external payable override {
        Wager storage w = wagers[competitionId];
        if (w.status != CompetitionStatus.Open) revert CompetitionNotOpen(competitionId);
        if (block.timestamp > w.deadline) revert DeadlinePassed(competitionId);
        if (hasEntered[competitionId][player]) revert AlreadyEntered(competitionId, player);
        if (w.playerCount >= w.maxPlayers) revert WagerFull(competitionId);
        if (msg.value != w.entryFee) revert IncorrectEntryFee(w.entryFee, msg.value);

        hasEntered[competitionId][player] = true;
        wagerPlayers[competitionId].push(player);
        w.playerCount++;

        // Lock funds in escrow
        escrow.lock{value: msg.value}(competitionId, player);

        emit PlayerEntered(competitionId, player, msg.value);

        // Auto-lock duels when both players have entered
        if (w.wagerType == WagerType.DUEL && w.playerCount == 2) {
            w.status = CompetitionStatus.Locked;
        }
    }

    // ──────────────────────────────────────────────── Enter Pool (with side)

    /// @notice Enter a pool wager by depositing and picking a side (1 or 2)
    function enterPool(uint256 competitionId, address player, uint8 side) external payable {
        Wager storage w = wagers[competitionId];
        if (w.wagerType != WagerType.POOL) revert NotPool(competitionId);
        if (w.status != CompetitionStatus.Open) revert CompetitionNotOpen(competitionId);
        if (block.timestamp > w.deadline) revert DeadlinePassed(competitionId);
        if (hasEntered[competitionId][player]) revert AlreadyEntered(competitionId, player);
        if (w.maxPlayers > 0 && w.playerCount >= w.maxPlayers) revert WagerFull(competitionId);
        if (msg.value != w.entryFee) revert IncorrectEntryFee(w.entryFee, msg.value);
        if (side != 1 && side != 2) revert InvalidSide(side);

        hasEntered[competitionId][player] = true;
        playerSide[competitionId][player] = side;
        wagerPlayers[competitionId].push(player);
        w.playerCount++;

        escrow.lock{value: msg.value}(competitionId, player);

        emit PlayerEntered(competitionId, player, msg.value);
        emit PlayerJoinedSide(competitionId, player, side);
    }

    // ──────────────────────────────────────────────── Start Game

    /// @notice Transition a fully-funded duel to Playing state (game begins)
    /// @param competitionId The wager to start
    function startGame(uint256 competitionId) external onlyResolver {
        Wager storage w = wagers[competitionId];
        if (w.status != CompetitionStatus.Locked) revert CompetitionNotSettleable(competitionId);
        w.status = CompetitionStatus.Playing;
        emit GameStarted(competitionId);
    }

    // ──────────────────────────────────────────────── Settle

    /// @notice Settle a wager and distribute winnings. Called automatically after both players submit scores.
    /// @param competitionId The wager to settle
    /// @param rankedWinners Ordered array of winners (for duels: [winner], for pools: all winning-side players)
    function settle(uint256 competitionId, address[] calldata rankedWinners) external override onlyResolver {
        Wager storage w = wagers[competitionId];
        if (w.status != CompetitionStatus.Playing && w.status != CompetitionStatus.Locked && w.status != CompetitionStatus.Open)
            revert CompetitionNotSettleable(competitionId);
        if (rankedWinners.length == 0) revert InvalidWinnerCount();

        w.status = CompetitionStatus.Settled;

        // Calculate total pot and fees
        uint256 grossAmount = w.entryFee * w.playerCount;
        (uint256 protocolFee, uint256 operatorFee, uint256 creatorFee, uint256 netAmount) =
            feeRouter.calculateFees(competitionId, grossAmount);

        uint256 totalFees = protocolFee + operatorFee + creatorFee;

        // Update payout tiers for actual winner count
        delete _payoutTiers[competitionId];
        _payoutTiers[competitionId].push(PayoutTier({
            rankFrom: 1,
            rankTo: uint16(rankedWinners.length),
            shareBps: 10000
        }));
        w.totalWinners = uint16(rankedWinners.length);

        // Compute per-winner payouts
        uint256[] memory payouts = _payoutTiers[competitionId].computePayouts(
            rankedWinners, netAmount, w.totalWinners
        );

        // Send fees to FeeRouter
        if (totalFees > 0) {
            feeRouter.depositFees{value: totalFees}(competitionId);
        }

        // Release winnings from escrow
        escrow.releaseToWinners(competitionId, rankedWinners, payouts);

        emit CompetitionSettled(competitionId, rankedWinners, payouts);
    }

    // ──────────────────────────────────────────────── Cancel

    /// @notice Cancel a wager and refund all players
    function cancel(uint256 competitionId) external override onlyCreatorOrAdmin(competitionId) {
        Wager storage w = wagers[competitionId];
        if (w.status != CompetitionStatus.Open && w.status != CompetitionStatus.Locked)
            revert CompetitionNotSettleable(competitionId);

        w.status = CompetitionStatus.Cancelled;

        address[] storage players = wagerPlayers[competitionId];
        if (players.length > 0) {
            escrow.refundAll(competitionId, players);
        }

        emit CompetitionCancelled(competitionId);
    }

    // ──────────────────────────────────────────────── Views

    function getCompetitionStatus(uint256 competitionId) external view override returns (CompetitionStatus) {
        return wagers[competitionId].status;
    }

    function getWagerPlayers(uint256 competitionId) external view returns (address[] memory) {
        return wagerPlayers[competitionId];
    }

    function getWagerDetails(uint256 competitionId) external view returns (
        address creator,
        WagerType wagerType,
        CompetitionStatus status,
        uint256 entryFee,
        uint256 deadline,
        uint256 maxPlayers,
        uint256 playerCount,
        string memory description
    ) {
        Wager storage w = wagers[competitionId];
        return (w.creator, w.wagerType, w.status, w.entryFee, w.deadline, w.maxPlayers, w.playerCount, w.description);
    }
}
