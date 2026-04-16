// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IWeezCompetition.sol";

library PayoutStructureLib {
    error InvalidTierOrder();
    error TierSharesNotComplete(uint32 totalBps);
    error RankGap(uint16 expectedRank, uint16 actualRank);
    error ZeroShare();
    error WinnerCountMismatch(uint256 expected, uint256 actual);

    /// @notice Validate that a payout tier array is well-formed and sums to 10000 bps
    /// @param tiers The payout tiers to validate
    /// @return totalWinners The total number of winning positions
    function validate(IWeezCompetition.PayoutTier[] calldata tiers)
        internal
        pure
        returns (uint16 totalWinners)
    {
        uint32 totalBps;
        uint16 nextExpectedRank = 1;

        for (uint256 i = 0; i < tiers.length; i++) {
            if (tiers[i].rankFrom != nextExpectedRank) {
                revert RankGap(nextExpectedRank, tiers[i].rankFrom);
            }
            if (tiers[i].rankTo < tiers[i].rankFrom) revert InvalidTierOrder();
            if (tiers[i].shareBps == 0) revert ZeroShare();

            totalBps += tiers[i].shareBps;
            nextExpectedRank = tiers[i].rankTo + 1;
        }

        if (totalBps != 10000) revert TierSharesNotComplete(totalBps);
        totalWinners = nextExpectedRank - 1;
    }

    /// @notice Compute payout amounts for each ranked winner from a net prize pool
    /// @param tiers The payout tiers
    /// @param rankedWinners Ordered array of winner addresses (index 0 = rank 1)
    /// @param netPrizePool The total amount to distribute (after fees)
    /// @return amounts Array of payout amounts corresponding to each winner
    function computePayouts(
        IWeezCompetition.PayoutTier[] storage tiers,
        address[] calldata rankedWinners,
        uint256 netPrizePool,
        uint16 totalWinners
    ) internal view returns (uint256[] memory amounts) {
        if (rankedWinners.length != totalWinners) revert WinnerCountMismatch(totalWinners, rankedWinners.length);
        amounts = new uint256[](rankedWinners.length);
        uint256 distributed;

        for (uint256 i = 0; i < tiers.length; i++) {
            uint16 rankFrom = tiers[i].rankFrom;
            uint16 rankTo = tiers[i].rankTo;
            uint16 shareBps = tiers[i].shareBps;
            uint16 winnersInTier = rankTo - rankFrom + 1;

            uint256 tierTotal = (netPrizePool * shareBps) / 10000;
            uint256 perWinner = tierTotal / winnersInTier;

            for (uint16 r = rankFrom; r <= rankTo; r++) {
                uint256 idx = r - 1;
                if (idx < rankedWinners.length) {
                    amounts[idx] = perWinner;
                    distributed += perWinner;
                }
            }
        }

        if (distributed < netPrizePool && rankedWinners.length > 0) {
            amounts[0] += netPrizePool - distributed;
        }
    }
}
