// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IWeezCompetition {
    enum CompetitionStatus {
        None,
        Open,
        Locked,
        Playing,
        Settled,
        Cancelled
    }

    struct PayoutTier {
        uint16 rankFrom;
        uint16 rankTo;
        uint16 shareBps;
    }

    event CompetitionCreated(
        uint256 indexed competitionId,
        address indexed creator,
        uint256 entryFee,
        PayoutTier[] payoutTiers
    );
    event PlayerEntered(uint256 indexed competitionId, address indexed player, uint256 amount);
    event CompetitionSettled(
        uint256 indexed competitionId, address[] rankedWinners, uint256[] payouts
    );
    event CompetitionCancelled(uint256 indexed competitionId);

    error CompetitionNotOpen(uint256 competitionId);
    error CompetitionNotSettleable(uint256 competitionId);
    error InvalidPayoutStructure();
    error InvalidWinnerCount();

    function createCompetition(bytes calldata params) external returns (uint256 competitionId);
    function enter(uint256 competitionId, address player) external payable;
    function settle(uint256 competitionId, address[] calldata rankedWinners) external;
    function cancel(uint256 competitionId) external;
    function getCompetitionStatus(uint256 competitionId) external view returns (CompetitionStatus);
}
