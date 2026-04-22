// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title IRandomnessConsumer
/// @notice Receives a fulfilled random word from a RandomnessAdapter.
interface IRandomnessConsumer {
    function fulfillRandomWord(uint256 requestId, uint256 randomWord) external;
}
