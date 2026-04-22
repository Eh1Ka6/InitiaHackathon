// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IBandVRFCallback {
    /// @notice Callback shape invoked by the VRF provider when a random word is ready.
    /// @dev Shape mirrors Chainlink VRFv2's rawFulfillRandomWords, condensed to a single word.
    function rawFulfillRandomness(uint256 requestId, uint256 randomWord) external;
}

/// @title MockBandVRF
/// @notice Minimal admin-triggerable mock of the Band VRF contract used for local tests
///         and demo rehearsal. The owner calls `fulfill(requestId, randomWord)` to
///         deliver randomness to the requesting adapter.
/// @dev DO NOT DEPLOY TO PRODUCTION — randomness is controlled by the owner.
contract MockBandVRF {
    address public owner;
    uint256 public nextRequestId = 1;

    // requestId => requester (the RandomnessAdapter)
    mapping(uint256 => address) public requesters;
    // requestId => fulfilled?
    mapping(uint256 => bool) public fulfilled;

    error NotOwner();
    error UnknownRequest(uint256 requestId);
    error AlreadyFulfilled(uint256 requestId);

    event RandomnessRequested(uint256 indexed requestId, address indexed requester, bytes32 seed);
    event RandomnessFulfilled(uint256 indexed requestId, address indexed requester, uint256 randomWord);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Requests a random word. Returns a monotonically-increasing requestId.
    function requestRandomness(bytes32 seed) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        requesters[requestId] = msg.sender;
        emit RandomnessRequested(requestId, msg.sender, seed);
    }

    /// @notice Admin delivers the random word for `requestId` by calling back the requester.
    function fulfill(uint256 requestId, uint256 randomWord) external onlyOwner {
        address requester = requesters[requestId];
        if (requester == address(0)) revert UnknownRequest(requestId);
        if (fulfilled[requestId]) revert AlreadyFulfilled(requestId);
        fulfilled[requestId] = true;
        emit RandomnessFulfilled(requestId, requester, randomWord);
        IBandVRFCallback(requester).rawFulfillRandomness(requestId, randomWord);
    }
}
