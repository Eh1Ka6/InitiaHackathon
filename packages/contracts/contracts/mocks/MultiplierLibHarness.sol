// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/MultiplierLib.sol";

/// @title MultiplierLibHarness
/// @notice Test-only wrapper that exposes MultiplierLib's internal functions
///         to Hardhat tests.
contract MultiplierLibHarness {
    // Re-export the error so tests can match it via revertedWithCustomError on
    // the harness contract (Solidity exposes imported errors automatically for
    // revert matching).
    error InvalidConfigId(uint8 configId);

    function pick(uint8 configId, uint256 entropy) external pure returns (uint16) {
        return MultiplierLib.pickMultiplier(configId, entropy);
    }

    function getThresholds(uint8 configId) external pure returns (uint32[6] memory) {
        return MultiplierLib.getThresholds(configId);
    }

    function lastThreshold(uint8 configId) external pure returns (uint32) {
        return MultiplierLib.lastThreshold(configId);
    }
}
