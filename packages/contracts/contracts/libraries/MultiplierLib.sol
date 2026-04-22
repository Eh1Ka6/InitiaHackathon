// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title MultiplierLib
/// @notice Pure library holding 4 cumulative-threshold arrays (out of 100_000_000)
///         for multiplier selection on draw settlement. 10^-8 precision.
/// @dev Thresholds copied verbatim from MULTICHAIN_PLAN.md Section 3.
///      Order of multipliers (indexed 0..5): [300, 100, 50, 20, 10, 8].
library MultiplierLib {
    // ─── Errors ───
    error InvalidConfigId(uint8 configId);
    error Unreachable();

    /// @notice Picks a multiplier given a config id and a random entropy word.
    /// @param configId One of 0..3.
    /// @param entropy Arbitrary uint256 — a slice of the random word from VRF.
    /// @return Multiplier (integer, e.g. 300 for 3.00x).
    function pickMultiplier(uint8 configId, uint256 entropy) internal pure returns (uint16) {
        if (configId >= 4) revert InvalidConfigId(configId);

        uint32 roll = uint32(entropy % 100_000_000);

        // Cumulative thresholds per config (inline to keep this a pure library).
        uint32[6] memory thresholds;
        if (configId == 0) {
            thresholds = [uint32(60), 2_008_060, 8_128_060, 20_128_060, 64_128_060, 100_000_000];
        } else if (configId == 1) {
            thresholds = [uint32(60), 8_060, 128_060, 6_128_060, 60_128_060, 100_000_000];
        } else if (configId == 2) {
            thresholds = [uint32(40), 4_040, 44_040, 3_244_040, 49_244_040, 100_000_000];
        } else {
            // configId == 3
            thresholds = [uint32(30), 3_030, 33_030, 2_533_030, 44_533_030, 100_000_000];
        }

        uint16[6] memory values = [uint16(300), 100, 50, 20, 10, 8];

        // Linear scan — 6 elements, gas is noise.
        for (uint256 i = 0; i < 6; ) {
            if (roll < thresholds[i]) {
                return values[i];
            }
            unchecked { ++i; }
        }

        // Guaranteed to return in the loop because thresholds[5] == 100_000_000
        // and roll < 100_000_000 by construction.
        revert Unreachable();
    }

    /// @notice Exposes the last cumulative threshold for a config (for invariant tests).
    function lastThreshold(uint8 configId) internal pure returns (uint32) {
        if (configId >= 4) revert InvalidConfigId(configId);
        // By construction, every config's last entry is 100_000_000.
        return 100_000_000;
    }

    /// @notice Exposes the full cumulative threshold array for a config (for tests).
    function getThresholds(uint8 configId) internal pure returns (uint32[6] memory thresholds) {
        if (configId >= 4) revert InvalidConfigId(configId);
        if (configId == 0) {
            thresholds = [uint32(60), 2_008_060, 8_128_060, 20_128_060, 64_128_060, 100_000_000];
        } else if (configId == 1) {
            thresholds = [uint32(60), 8_060, 128_060, 6_128_060, 60_128_060, 100_000_000];
        } else if (configId == 2) {
            thresholds = [uint32(40), 4_040, 44_040, 3_244_040, 49_244_040, 100_000_000];
        } else {
            thresholds = [uint32(30), 3_030, 33_030, 2_533_030, 44_533_030, 100_000_000];
        }
    }
}
