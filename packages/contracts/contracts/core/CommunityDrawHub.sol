// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IAccessRegistry.sol";
import "../interfaces/IRandomnessConsumer.sol";
import "./WeezEscrow.sol";
import "./FeeRouter.sol";
import "./RandomnessAdapter.sol";

contract CommunityDrawHub is IRandomnessConsumer {
    enum Status {
        None,
        Open,
        RandomnessRequested,
        Settled,
        Cancelled
    }

    struct CommunityDraw {
        Status status;
        address creator;
        bytes32 title;
        uint256 prizeAmount;
        uint256 ticketPrice;
        uint32 maxTickets;
        uint32 ticketsSold;
        uint16 winnerCount;
        uint64 endTimestamp;
        uint256 vrfRequestId;
    }

    // ─── Immutables ───
    IAccessRegistry public immutable accessRegistry;
    WeezEscrow public immutable escrow;
    FeeRouter public immutable feeRouter;
    RandomnessAdapter public immutable randomnessAdapter;

    // ─── Roles ───
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant COMMUNITY_CREATOR_ROLE = keccak256("COMMUNITY_CREATOR_ROLE");

    // WeezEscrow competition ids are shared globally across all modules;
    // namespace community-draw ids with a deterministic prefix so they can
    // never collide with DrawHub or WeezWager ids.
    bytes32 private constant ESCROW_NAMESPACE = keccak256("CommunityDrawHub.v1");

    // ─── State ───
    uint256 public nextDrawId = 1;
    mapping(uint256 => CommunityDraw) private _draws;
    mapping(uint256 => address[]) private _tickets;
    mapping(uint256 => uint256) public vrfRequestIdToDrawId;

    // ─── Errors ───
    error Unauthorized(address caller);
    error InvalidParams();
    error BadStatus(uint256 drawId, Status expected, Status actual);
    error NotCreator();
    error IncorrectTicketPrice(uint256 expected, uint256 actual);
    error IncorrectStake(uint256 expected, uint256 actual);
    error SoldOut();
    error SaleClosed();
    error EndNotReached();
    error TicketsAlreadySold();
    error NotAdapter();

    // ─── Events ───
    event CommunityDrawCreated(
        uint256 indexed drawId,
        address indexed creator,
        bytes32 title,
        uint256 prizeAmount,
        uint256 ticketPrice,
        uint32 maxTickets,
        uint16 winnerCount,
        uint64 endTimestamp
    );
    event CommunityDrawTicketPurchased(
        uint256 indexed drawId,
        address indexed buyer,
        uint32 ticketIndex,
        uint256 amount
    );
    event CommunityDrawRandomnessRequested(uint256 indexed drawId, uint256 indexed requestId);
    event CommunityDrawSettled(
        uint256 indexed drawId,
        address[] winners,
        uint256[] payouts,
        uint256 creatorProceeds,
        uint256 platformFee
    );
    event CommunityDrawCancelled(uint256 indexed drawId, bool adminForced);

    // ─── Modifiers ───
    modifier onlyRole(bytes32 role) {
        if (!accessRegistry.hasRole(role, msg.sender)) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyAdapter() {
        if (msg.sender != address(randomnessAdapter)) revert NotAdapter();
        _;
    }

    // ─── Constructor ───
    constructor(
        address _accessRegistry,
        address _escrow,
        address _feeRouter,
        address _randomnessAdapter
    ) {
        accessRegistry = IAccessRegistry(_accessRegistry);
        escrow = WeezEscrow(_escrow);
        feeRouter = FeeRouter(_feeRouter);
        randomnessAdapter = RandomnessAdapter(_randomnessAdapter);
    }

    // ─── Create ───
    function createCommunityDraw(
        bytes32 title,
        uint256 prizeAmount,
        uint256 ticketPrice,
        uint32 maxTickets,
        uint64 endTimestamp,
        uint16 winnerCount
    ) external payable onlyRole(COMMUNITY_CREATOR_ROLE) returns (uint256 drawId) {
        if (
            prizeAmount == 0 ||
            ticketPrice == 0 ||
            maxTickets == 0 ||
            winnerCount == 0 ||
            winnerCount > maxTickets ||
            endTimestamp <= block.timestamp
        ) revert InvalidParams();
        if (msg.value != prizeAmount) revert IncorrectStake(prizeAmount, msg.value);

        drawId = nextDrawId++;

        _draws[drawId] = CommunityDraw({
            status: Status.Open,
            creator: msg.sender,
            title: title,
            prizeAmount: prizeAmount,
            ticketPrice: ticketPrice,
            maxTickets: maxTickets,
            ticketsSold: 0,
            winnerCount: winnerCount,
            endTimestamp: endTimestamp,
            vrfRequestId: 0
        });

        escrow.lock{value: msg.value}(_escrowId(drawId), msg.sender);

        emit CommunityDrawCreated(
            drawId,
            msg.sender,
            title,
            prizeAmount,
            ticketPrice,
            maxTickets,
            winnerCount,
            endTimestamp
        );
    }

    // ─── Buy Ticket ───
    function buyTicket(uint256 drawId) external payable {
        CommunityDraw storage d = _draws[drawId];
        if (d.status != Status.Open) revert BadStatus(drawId, Status.Open, d.status);
        if (block.timestamp >= d.endTimestamp) revert SaleClosed();
        if (d.ticketsSold >= d.maxTickets) revert SoldOut();
        if (msg.value != d.ticketPrice) revert IncorrectTicketPrice(d.ticketPrice, msg.value);

        uint32 idx = d.ticketsSold;
        d.ticketsSold = idx + 1;
        _tickets[drawId].push(msg.sender);

        escrow.lock{value: msg.value}(_escrowId(drawId), msg.sender);

        emit CommunityDrawTicketPurchased(drawId, msg.sender, idx, msg.value);
    }

    // ─── Settle ───
    function settleCommunityDraw(uint256 drawId) external {
        CommunityDraw storage d = _draws[drawId];
        if (d.status != Status.Open) revert BadStatus(drawId, Status.Open, d.status);
        if (block.timestamp < d.endTimestamp) revert EndNotReached();

        // Zero-ticket outcome: refund creator stake, mark cancelled, no VRF needed.
        if (d.ticketsSold == 0) {
            d.status = Status.Cancelled;

            address[] memory recipient = new address[](1);
            uint256[] memory amount = new uint256[](1);
            recipient[0] = d.creator;
            amount[0] = d.prizeAmount;
            escrow.releaseToWinners(_escrowId(drawId), recipient, amount);

            emit CommunityDrawCancelled(drawId, false);
            return;
        }

        uint256 requestId = randomnessAdapter.requestRandomWord(drawId);
        d.vrfRequestId = requestId;
        vrfRequestIdToDrawId[requestId] = drawId;
        d.status = Status.RandomnessRequested;

        emit CommunityDrawRandomnessRequested(drawId, requestId);
    }

    // ─── VRF Callback ───
    function fulfillRandomWord(uint256 requestId, uint256 randomWord) external onlyAdapter {
        uint256 drawId = vrfRequestIdToDrawId[requestId];
        CommunityDraw storage d = _draws[drawId];
        if (d.status != Status.RandomnessRequested)
            revert BadStatus(drawId, Status.RandomnessRequested, d.status);

        d.status = Status.Settled;

        uint16 wc = d.winnerCount;
        uint32 sold = d.ticketsSold;
        if (wc > sold) wc = uint16(sold);

        address[] memory winners = _pickWinners(drawId, randomWord, wc, sold);
        uint256[] memory payouts = new uint256[](wc);

        // Fees on the prize side.
        (uint256 prizeProtocolFee, uint256 prizeOperatorFee, uint256 prizeCreatorFee, uint256 prizeNet) =
            feeRouter.calculateFees(_escrowId(drawId), d.prizeAmount);
        uint256 prizeFees = prizeProtocolFee + prizeOperatorFee + prizeCreatorFee;

        uint256 perWinner = prizeNet / wc;
        uint256 distributed = perWinner * wc;
        for (uint256 i = 0; i < wc; ) {
            payouts[i] = perWinner;
            unchecked { ++i; }
        }
        // Dust → first winner.
        if (distributed < prizeNet) {
            payouts[0] += prizeNet - distributed;
        }

        // Fees on the ticket-sales side.
        uint256 ticketGross = uint256(d.ticketPrice) * sold;
        (uint256 tProtocolFee, uint256 tOperatorFee, uint256 tCreatorFee, uint256 ticketNet) =
            feeRouter.calculateFees(_escrowId(drawId), ticketGross);
        uint256 ticketFees = tProtocolFee + tOperatorFee + tCreatorFee;

        uint256 totalFees = prizeFees + ticketFees;

        // One batched release from escrow: winners + creator + (this contract for fee forwarding).
        uint256 outLen = wc + 1 + (totalFees > 0 ? 1 : 0);
        address[] memory recipients = new address[](outLen);
        uint256[] memory amounts = new uint256[](outLen);
        for (uint256 i = 0; i < wc; ) {
            recipients[i] = winners[i];
            amounts[i] = payouts[i];
            unchecked { ++i; }
        }
        recipients[wc] = d.creator;
        amounts[wc] = ticketNet;
        if (totalFees > 0) {
            recipients[wc + 1] = address(this);
            amounts[wc + 1] = totalFees;
        }
        escrow.releaseToWinners(_escrowId(drawId), recipients, amounts);

        if (totalFees > 0) {
            feeRouter.depositFees{value: totalFees}(_escrowId(drawId));
        }

        emit CommunityDrawSettled(drawId, winners, payouts, ticketNet, totalFees);
    }

    // ─── Cancel ───
    /// @notice Creator can cancel only while no tickets have been sold. Admin can force-cancel at any open-state.
    function cancelCommunityDraw(uint256 drawId) external {
        CommunityDraw storage d = _draws[drawId];
        bool isAdmin = accessRegistry.hasRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        bool isCreator = msg.sender == d.creator;
        if (!isAdmin && !isCreator) revert Unauthorized(msg.sender);

        if (d.status != Status.Open && d.status != Status.RandomnessRequested) {
            revert BadStatus(drawId, Status.Open, d.status);
        }

        if (!isAdmin && d.ticketsSold > 0) revert TicketsAlreadySold();

        d.status = Status.Cancelled;

        address[] storage buyers = _tickets[drawId];
        uint256 n = buyers.length;
        uint256 outLen = n + 1;
        address[] memory recipients = new address[](outLen);
        uint256[] memory amounts = new uint256[](outLen);

        for (uint256 i = 0; i < n; ) {
            recipients[i] = buyers[i];
            amounts[i] = d.ticketPrice;
            unchecked { ++i; }
        }
        recipients[n] = d.creator;
        amounts[n] = d.prizeAmount;

        escrow.releaseToWinners(_escrowId(drawId), recipients, amounts);

        emit CommunityDrawCancelled(drawId, isAdmin && !isCreator);
    }

    // ─── Internal ───
    function _escrowId(uint256 drawId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(ESCROW_NAMESPACE, drawId)));
    }

    function _pickWinners(
        uint256 drawId,
        uint256 randomWord,
        uint16 wc,
        uint32 sold
    ) internal view returns (address[] memory winners) {
        winners = new address[](wc);
        address[] storage tix = _tickets[drawId];

        // Sampling without replacement via repeated hashing. wc is bounded by winnerCount
        // which at creation must be <= maxTickets, so this loop is bounded by a value
        // the creator committed to. For large wc this is O(wc^2) on the seen-check;
        // acceptable given hackathon constraints and per-draw gas bounds.
        uint256 picked;
        uint256 i;
        while (picked < wc) {
            uint256 roll = uint256(keccak256(abi.encode(randomWord, drawId, i))) % sold;
            address candidate = tix[roll];
            bool seen;
            for (uint256 j = 0; j < picked; ) {
                if (winners[j] == candidate) { seen = true; break; }
                unchecked { ++j; }
            }
            if (!seen) {
                winners[picked] = candidate;
                unchecked { ++picked; }
            }
            unchecked { ++i; }
        }
    }

    // ─── Views ───
    function getCommunityDraw(uint256 drawId)
        external
        view
        returns (
            Status status,
            address creator,
            bytes32 title,
            uint256 prizeAmount,
            uint256 ticketPrice,
            uint32 maxTickets,
            uint32 ticketsSold,
            uint16 winnerCount,
            uint64 endTimestamp,
            uint256 vrfRequestId
        )
    {
        CommunityDraw storage d = _draws[drawId];
        return (
            d.status,
            d.creator,
            d.title,
            d.prizeAmount,
            d.ticketPrice,
            d.maxTickets,
            d.ticketsSold,
            d.winnerCount,
            d.endTimestamp,
            d.vrfRequestId
        );
    }

    function getTickets(uint256 drawId) external view returns (address[] memory) {
        return _tickets[drawId];
    }

    function escrowIdOf(uint256 drawId) external pure returns (uint256) {
        return _escrowId(drawId);
    }

    receive() external payable {}
}
