// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IRandomnessConsumer.sol";

/// @notice Minimal Band VRF interface used by the adapter. Shape is
///         Chainlink-VRFv2-inspired (requestId returned from request,
///         single-word callback on fulfillment).
/// @dev TODO (spike agent): replace with the real Band VRF interface once
///      `SPIKE_FINDINGS.md` is published at the repo root. The adapter accepts
///      the VRF address via constructor, so only the interface shape may change.
interface IBandVRF {
    function requestRandomness(bytes32 seed) external returns (uint256);
}

/// @title RandomnessAdapter
/// @notice Wraps the Band VRF contract and exposes a Chainlink-VRFv2-shaped API
///         to a single registered consumer (the DrawHub). Stores the
///         `requestId → drawId` mapping so the consumer can resolve context.
/// @dev HACKATHON: single-owner admin, single consumer. Swap Band VRF address
///      in the constructor for mocks in tests.
contract RandomnessAdapter {
    // ─── State ───
    address public owner;
    IBandVRF public immutable bandVrf;
    address public consumer;

    // requestId => drawId (so the consumer can look up context on callback).
    mapping(uint256 => uint256) public requestIdToDrawId;
    // requestId => fulfilled?
    mapping(uint256 => bool) public fulfilled;

    // ─── Errors ───
    error NotOwner();
    error NotConsumer();
    error NotBandVRF();
    error ConsumerNotSet();
    error ZeroAddress();
    error AlreadyFulfilled(uint256 requestId);

    // ─── Events ───
    event ConsumerUpdated(address indexed oldConsumer, address indexed newConsumer);
    event RandomWordRequested(uint256 indexed drawId, uint256 indexed requestId);
    event RandomWordFulfilled(uint256 indexed requestId, uint256 indexed drawId, uint256 randomWord);

    // ─── Modifiers ───
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyConsumer() {
        if (consumer == address(0)) revert ConsumerNotSet();
        if (msg.sender != consumer) revert NotConsumer();
        _;
    }

    // ─── Constructor ───
    /// @param _bandVrf The Band VRF contract (or MockBandVRF in tests).
    constructor(address _bandVrf) {
        if (_bandVrf == address(0)) revert ZeroAddress();
        owner = msg.sender;
        bandVrf = IBandVRF(_bandVrf);
    }

    // ─── Admin ───
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Wire which contract receives fulfilled random words. Only one
    ///         consumer at a time.
    function setConsumer(address newConsumer) external onlyOwner {
        if (newConsumer == address(0)) revert ZeroAddress();
        emit ConsumerUpdated(consumer, newConsumer);
        consumer = newConsumer;
    }

    // ─── Request ───
    /// @notice Requests a random word for `drawId`. Callable only by the
    ///         registered consumer.
    function requestRandomWord(uint256 drawId) external onlyConsumer returns (uint256 requestId) {
        bytes32 seed = keccak256(abi.encode(block.chainid, address(this), drawId, block.timestamp));
        requestId = bandVrf.requestRandomness(seed);
        requestIdToDrawId[requestId] = drawId;
        emit RandomWordRequested(drawId, requestId);
    }

    // ─── Callback from Band VRF ───
    /// @notice Band VRF invokes this when a random word is ready.
    /// @dev Only the configured Band VRF contract may call. Forwards to consumer.
    function rawFulfillRandomness(uint256 requestId, uint256 randomWord) external {
        if (msg.sender != address(bandVrf)) revert NotBandVRF();
        if (fulfilled[requestId]) revert AlreadyFulfilled(requestId);
        fulfilled[requestId] = true;

        uint256 drawId = requestIdToDrawId[requestId];
        emit RandomWordFulfilled(requestId, drawId, randomWord);

        // Forward to consumer — consumer resolves drawId from requestId itself
        // (it keeps its own mapping) or via `requestIdToDrawId` view.
        IRandomnessConsumer(consumer).fulfillRandomWord(requestId, randomWord);
    }

    // ─── Views ───
    function getDrawIdForRequest(uint256 requestId) external view returns (uint256) {
        return requestIdToDrawId[requestId];
    }
}
