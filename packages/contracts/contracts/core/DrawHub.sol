// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IAccessRegistry.sol";
import "../interfaces/IRandomnessConsumer.sol";
import "../libraries/MultiplierLib.sol";
import "./WeezEscrow.sol";
import "./FeeRouter.sol";
import "./RandomnessAdapter.sol";

/// @title DrawHub
/// @notice Single-chain draw state machine on Initia. Tracks participants,
///         qualifier list, multiplier config, VRF request, winner, and settled
///         payout. Integrates with AccessRegistry (roles), WeezEscrow (custody),
///         FeeRouter (fees), RandomnessAdapter (VRF), and MultiplierLib.
/// @dev HACKATHON: plain (non-upgradeable) contract. Simpler to reason about.
contract DrawHub is IRandomnessConsumer {
    using MultiplierLib for uint8;

    // ─── Types ───
    enum DrawStatus {
        None,                 // 0
        Open,                 // 1
        AwaitingQualifiers,   // 2
        Qualified,            // 3
        RandomnessRequested,  // 4
        Settled,              // 5
        Cancelled             // 6
    }

    struct Draw {
        DrawStatus status;
        uint8 multiplierConfigId;
        uint64 deadline;
        uint256 entryFee;
        uint256 vrfRequestId;
        address winner;
        uint16 multiplier;
        uint256 payout;
    }

    // ─── Immutables ───
    IAccessRegistry public immutable accessRegistry;
    WeezEscrow public immutable escrow;
    FeeRouter public immutable feeRouter;
    RandomnessAdapter public immutable randomnessAdapter;

    // ─── Roles ───
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    // ─── Constants ───
    uint256 public constant VRF_RESET_GRACE = 1 hours;

    // ─── State ───
    mapping(uint256 => Draw) private _draws;
    mapping(uint256 => address[]) private _participants;
    mapping(uint256 => address[]) private _qualifiers;
    mapping(uint256 => mapping(address => bool)) public hasEntered;
    mapping(uint256 => uint256) public vrfRequestedAt; // drawId => timestamp of requestRandomness
    mapping(uint256 => uint256) public vrfRequestIdToDrawId; // requestId => drawId (for callback routing)

    // ─── Errors ───
    error Unauthorized(address caller);
    error DrawExists(uint256 drawId);
    error InvalidConfigId(uint8 configId);
    error ZeroEntryFee();
    error DeadlineInPast();
    error BadStatus(uint256 drawId, DrawStatus expected, DrawStatus actual);
    error IncorrectEntryFee(uint256 expected, uint256 actual);
    error AlreadyEntered(uint256 drawId, address player);
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NotAdapter();
    error VrfResetTooEarly(uint256 elapsed, uint256 required);

    // ─── Events ───
    event DrawCreated(uint256 indexed drawId, uint256 entryFee, uint256 deadline, uint8 multiplierConfigId);
    event ParticipantEnrolled(uint256 indexed drawId, address indexed participant, uint256 amount);
    event QualifiersRecorded(uint256 indexed drawId, address[] qualifiers);
    event RandomnessRequested(uint256 indexed drawId, uint256 indexed requestId);
    event DrawSettled(uint256 indexed drawId, address indexed winner, uint16 multiplier, uint256 payout);
    event DrawCancelled(uint256 indexed drawId);
    event MultiplierCapped(uint256 indexed drawId, uint16 multiplier, uint256 boosted, uint256 payout);
    event VrfReset(uint256 indexed drawId);

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
    function createDraw(
        uint256 drawId,
        uint256 entryFee,
        uint256 deadline,
        uint8 multiplierConfigId
    ) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        if (_draws[drawId].status != DrawStatus.None) revert DrawExists(drawId);
        if (entryFee == 0) revert ZeroEntryFee();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (multiplierConfigId >= 4) revert InvalidConfigId(multiplierConfigId);

        _draws[drawId] = Draw({
            status: DrawStatus.Open,
            multiplierConfigId: multiplierConfigId,
            deadline: uint64(deadline),
            entryFee: entryFee,
            vrfRequestId: 0,
            winner: address(0),
            multiplier: 0,
            payout: 0
        });

        emit DrawCreated(drawId, entryFee, deadline, multiplierConfigId);
    }

    // ─── Deposit ───
    function depositLocal(uint256 drawId) external payable {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Open) revert BadStatus(drawId, DrawStatus.Open, d.status);
        if (msg.value != d.entryFee) revert IncorrectEntryFee(d.entryFee, msg.value);
        if (hasEntered[drawId][msg.sender]) revert AlreadyEntered(drawId, msg.sender);
        if (block.timestamp >= d.deadline) revert DeadlinePassed();

        hasEntered[drawId][msg.sender] = true;
        _participants[drawId].push(msg.sender);

        escrow.lock{value: msg.value}(drawId, msg.sender);

        emit ParticipantEnrolled(drawId, msg.sender, msg.value);
    }

    // ─── Record Qualifiers ───
    /// @notice Backend calls this with the addresses that passed the off-chain
    ///         80% qualifier filter. If zero qualifiers, the draw is cancelled
    ///         and everyone is refunded.
    function recordQualifiers(uint256 drawId, address[] calldata qualifiers_)
        external
        onlyRole(RESOLVER_ROLE)
    {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Open) revert BadStatus(drawId, DrawStatus.Open, d.status);
        // HACKATHON: require deadline has passed before recording qualifiers
        // to match the lifecycle in MULTICHAIN_PLAN Section 3.
        if (block.timestamp < d.deadline) revert DeadlineNotPassed();

        // If nobody qualified, cancel + refund.
        if (qualifiers_.length == 0) {
            _cancelDraw(drawId);
            return;
        }

        // Transition Open → AwaitingQualifiers → Qualified in one call for simplicity.
        // (The intermediate state only exists conceptually between deadline and this call.)
        d.status = DrawStatus.Qualified;

        address[] storage q = _qualifiers[drawId];
        for (uint256 i = 0; i < qualifiers_.length; ) {
            q.push(qualifiers_[i]);
            unchecked { ++i; }
        }

        emit QualifiersRecorded(drawId, qualifiers_);
    }

    // ─── Request Randomness ───
    function requestRandomness(uint256 drawId) external onlyRole(RESOLVER_ROLE) {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Qualified) revert BadStatus(drawId, DrawStatus.Qualified, d.status);

        uint256 requestId = randomnessAdapter.requestRandomWord(drawId);
        d.vrfRequestId = requestId;
        vrfRequestIdToDrawId[requestId] = drawId;
        vrfRequestedAt[drawId] = block.timestamp;
        d.status = DrawStatus.RandomnessRequested;

        emit RandomnessRequested(drawId, requestId);
    }

    // ─── VRF Callback ───
    /// @notice Called by the RandomnessAdapter when Band VRF fulfills the request.
    function fulfillRandomWord(uint256 requestId, uint256 randomWord) external onlyAdapter {
        uint256 drawId = vrfRequestIdToDrawId[requestId];
        Draw storage d = _draws[drawId];
        // Status check catches unknown requestId (status would be None).
        if (d.status != DrawStatus.RandomnessRequested)
            revert BadStatus(drawId, DrawStatus.RandomnessRequested, d.status);

        address[] storage q = _qualifiers[drawId];

        // Two independent entropy slices so winner pick and multiplier pick
        // are uncorrelated.
        uint256 wEntropy = uint256(keccak256(abi.encode(randomWord, "winner")));
        uint256 mEntropy = uint256(keccak256(abi.encode(randomWord, "multiplier")));

        address winner = q[wEntropy % q.length];
        uint16 mult = MultiplierLib.pickMultiplier(d.multiplierConfigId, mEntropy);

        // Pot math.
        uint256 gross = d.entryFee * _participants[drawId].length;
        (uint256 protocolFee, uint256 operatorFee, uint256 creatorFee, uint256 net) =
            feeRouter.calculateFees(drawId, gross);
        uint256 totalFees = protocolFee + operatorFee + creatorFee;

        uint256 boosted = net * mult;
        uint256 payout = boosted > gross ? gross : boosted;

        if (boosted > gross) {
            emit MultiplierCapped(drawId, mult, boosted, payout);
        }

        // Fees: recompute so winner payout + fees never exceeds gross.
        // HACKATHON: if payout was capped at gross (most common case because
        // mult is >= 8x), there is no room for fees. Only send fees when
        // payout < gross.
        uint256 feeToSend = 0;
        if (payout + totalFees <= gross) {
            feeToSend = totalFees;
        }

        d.status = DrawStatus.Settled;
        d.winner = winner;
        d.multiplier = mult;
        d.payout = payout;

        // Release payout to winner from escrow.
        address[] memory winners = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        winners[0] = winner;
        payouts[0] = payout;
        escrow.releaseToWinners(drawId, winners, payouts);

        // Forward fees (if any) to FeeRouter. Funds come from this contract's
        // balance — escrow released only the payout; the remaining gross - payout
        // is still sitting in escrow. Use a second releaseToWinners call that
        // sends the fee slice to this contract, then forward to FeeRouter.
        if (feeToSend > 0) {
            address[] memory feeRecipient = new address[](1);
            uint256[] memory feeAmt = new uint256[](1);
            feeRecipient[0] = address(this);
            feeAmt[0] = feeToSend;
            escrow.releaseToWinners(drawId, feeRecipient, feeAmt);
            feeRouter.depositFees{value: feeToSend}(drawId);
        }

        emit DrawSettled(drawId, winner, mult, payout);
    }

    // ─── Cancel ───
    function cancelDraw(uint256 drawId) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _cancelDraw(drawId);
    }

    function _cancelDraw(uint256 drawId) internal {
        Draw storage d = _draws[drawId];
        if (
            d.status != DrawStatus.Open &&
            d.status != DrawStatus.AwaitingQualifiers &&
            d.status != DrawStatus.Qualified
        ) {
            revert BadStatus(drawId, DrawStatus.Open, d.status);
        }

        d.status = DrawStatus.Cancelled;

        // Refund every participant their own stake via releaseToWinners.
        address[] storage parts = _participants[drawId];
        uint256 n = parts.length;
        if (n > 0) {
            address[] memory recipients = new address[](n);
            uint256[] memory amounts = new uint256[](n);
            for (uint256 i = 0; i < n; ) {
                recipients[i] = parts[i];
                amounts[i] = d.entryFee;
                unchecked { ++i; }
            }
            escrow.releaseToWinners(drawId, recipients, amounts);
        }

        emit DrawCancelled(drawId);
    }

    // ─── Admin recovery ───
    /// @notice Resets a stuck RandomnessRequested draw back to Qualified so the
    ///         VRF can be re-requested. Only after VRF_RESET_GRACE elapsed.
    function adminResetVrf(uint256 drawId) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.RandomnessRequested)
            revert BadStatus(drawId, DrawStatus.RandomnessRequested, d.status);

        uint256 requestedAt = vrfRequestedAt[drawId];
        uint256 elapsed = block.timestamp - requestedAt;
        if (elapsed < VRF_RESET_GRACE) revert VrfResetTooEarly(elapsed, VRF_RESET_GRACE);

        d.status = DrawStatus.Qualified;
        d.vrfRequestId = 0;
        emit VrfReset(drawId);
    }

    // ─── Views ───
    function getDraw(uint256 drawId)
        external
        view
        returns (
            DrawStatus status,
            uint8 multiplierConfigId,
            uint64 deadline,
            uint256 entryFee,
            uint256 vrfRequestId,
            address winner,
            uint16 multiplier,
            uint256 payout
        )
    {
        Draw storage d = _draws[drawId];
        return (
            d.status,
            d.multiplierConfigId,
            d.deadline,
            d.entryFee,
            d.vrfRequestId,
            d.winner,
            d.multiplier,
            d.payout
        );
    }

    function getParticipants(uint256 drawId) external view returns (address[] memory) {
        return _participants[drawId];
    }

    function getQualifiers(uint256 drawId) external view returns (address[] memory) {
        return _qualifiers[drawId];
    }

    // ─── Fallback to accept the fee slice forwarded from escrow ───
    receive() external payable {}
}
