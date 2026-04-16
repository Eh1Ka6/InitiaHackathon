// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IAccessRegistry.sol";

/// @title WeezEscrow (Native-Only)
/// @notice Universal escrow vault that holds native token (INIT) stakes for wagers.
/// @dev Adapted from Weezdraw — token paths removed for Initia native-only operation.
contract WeezEscrow {
    // ──────────────────────────────────────────────── Reentrancy Guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus = _NOT_ENTERED;

    error ReentrancyGuardViolation();

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyGuardViolation();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ──────────────────────────────────────────────── Constants
    uint256 public constant MAX_BATCH_SIZE = 100;

    // ──────────────────────────────────────────────── Immutables
    IAccessRegistry public immutable accessRegistry;
    uint256 public immutable emergencyWithdrawDelay;

    // ──────────────────────────────────────────────── Roles
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");

    // ──────────────────────────────────────────────── State
    mapping(uint256 => uint256) public competitionBalance;
    mapping(uint256 => mapping(address => uint256)) public playerDeposit;
    mapping(bytes32 => uint256) public emergencyRequests;
    mapping(address => uint256) public failedTransfers;

    // ──────────────────────────────────────────────── Errors
    error UnauthorizedModule(address caller);
    error UnauthorizedAdmin(address caller);
    error InsufficientBalance(uint256 requested, uint256 available);
    error EmergencyTimelockNotExpired(uint256 executeAfter);
    error EmergencyRequestNotFound();
    error TransferFailed();
    error ZeroAmount();
    error ArrayLengthMismatch(uint256 winnersLength, uint256 amountsLength);
    error ZeroAddress();
    error ProtocolPaused();
    error ModuleNotActive(address module);
    error BatchTooLarge(uint256 size, uint256 maxSize);
    error NoFailedTransfer();

    // ──────────────────────────────────────────────── Events
    event FundsLocked(uint256 indexed competitionId, address indexed player, uint256 amount);
    event FundsReleased(uint256 indexed competitionId, address indexed recipient, uint256 amount);
    event FundsRefunded(uint256 indexed competitionId, address indexed player, uint256 amount);
    event EmergencyWithdrawRequested(uint256 indexed competitionId, uint256 executeAfter);
    event EmergencyWithdrawExecuted(uint256 indexed competitionId, address indexed recipient, uint256 amount);
    event NativeTransferFailed(address indexed recipient, uint256 amount);
    event FailedTransferWithdrawn(address indexed recipient, uint256 amount);

    // ──────────────────────────────────────────────── Modifiers
    modifier onlyActiveModule() {
        if (!accessRegistry.isModuleActive(msg.sender)) revert ModuleNotActive(msg.sender);
        _;
    }

    modifier onlyProtocolAdmin() {
        if (!accessRegistry.hasRole(PROTOCOL_ADMIN_ROLE, msg.sender)) revert UnauthorizedAdmin(msg.sender);
        _;
    }

    modifier whenProtocolNotPaused() {
        if (accessRegistry.isProtocolPaused()) revert ProtocolPaused();
        _;
    }

    // ──────────────────────────────────────────────── Constructor
    constructor(address _accessRegistry, uint256 _emergencyDelay) {
        if (_accessRegistry == address(0)) revert ZeroAddress();
        accessRegistry = IAccessRegistry(_accessRegistry);
        emergencyWithdrawDelay = _emergencyDelay;
    }

    // ──────────────────────────────────────────────── Lock

    function lock(uint256 competitionId, address player) external payable onlyActiveModule nonReentrant whenProtocolNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        playerDeposit[competitionId][player] += msg.value;
        competitionBalance[competitionId] += msg.value;
        emit FundsLocked(competitionId, player, msg.value);
    }

    // ──────────────────────────────────────────────── Release

    function releaseToWinners(
        uint256 competitionId,
        address[] calldata winners,
        uint256[] calldata amounts
    ) external onlyActiveModule nonReentrant whenProtocolNotPaused {
        if (winners.length != amounts.length) revert ArrayLengthMismatch(winners.length, amounts.length);
        if (winners.length > MAX_BATCH_SIZE) revert BatchTooLarge(winners.length, MAX_BATCH_SIZE);

        uint256 totalPayout;
        for (uint256 i; i < amounts.length;) {
            totalPayout += amounts[i];
            unchecked { ++i; }
        }

        if (totalPayout > competitionBalance[competitionId])
            revert InsufficientBalance(totalPayout, competitionBalance[competitionId]);
        competitionBalance[competitionId] -= totalPayout;

        for (uint256 i; i < winners.length;) {
            (bool success,) = winners[i].call{value: amounts[i]}("");
            if (!success) {
                failedTransfers[winners[i]] += amounts[i];
                emit NativeTransferFailed(winners[i], amounts[i]);
            } else {
                emit FundsReleased(competitionId, winners[i], amounts[i]);
            }
            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────── Refund

    function refundAll(
        uint256 competitionId,
        address[] calldata players
    ) external onlyActiveModule nonReentrant whenProtocolNotPaused {
        if (players.length > MAX_BATCH_SIZE) revert BatchTooLarge(players.length, MAX_BATCH_SIZE);

        for (uint256 i; i < players.length;) {
            uint256 deposit = playerDeposit[competitionId][players[i]];
            if (deposit > 0) {
                playerDeposit[competitionId][players[i]] = 0;
                competitionBalance[competitionId] -= deposit;
                (bool success,) = players[i].call{value: deposit}("");
                if (!success) {
                    failedTransfers[players[i]] += deposit;
                    emit NativeTransferFailed(players[i], deposit);
                } else {
                    emit FundsRefunded(competitionId, players[i], deposit);
                }
            }
            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────── Pull-based recovery

    function withdrawFailedTransfer() external nonReentrant {
        uint256 amount = failedTransfers[msg.sender];
        if (amount == 0) revert NoFailedTransfer();
        failedTransfers[msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit FailedTransferWithdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────── Emergency

    function requestEmergencyWithdraw(uint256 competitionId) external onlyProtocolAdmin {
        bytes32 requestHash = keccak256(abi.encodePacked(competitionId));
        emergencyRequests[requestHash] = block.timestamp;
        emit EmergencyWithdrawRequested(competitionId, block.timestamp + emergencyWithdrawDelay);
    }

    function executeEmergencyWithdraw(uint256 competitionId, address recipient) external onlyProtocolAdmin nonReentrant {
        bytes32 requestHash = keccak256(abi.encodePacked(competitionId));
        uint256 requestTime = emergencyRequests[requestHash];
        if (requestTime == 0) revert EmergencyRequestNotFound();

        uint256 executeAfter = requestTime + emergencyWithdrawDelay;
        if (block.timestamp < executeAfter) revert EmergencyTimelockNotExpired(executeAfter);

        delete emergencyRequests[requestHash];

        uint256 balance = competitionBalance[competitionId];
        competitionBalance[competitionId] = 0;
        (bool success,) = recipient.call{value: balance}("");
        if (!success) revert TransferFailed();
        emit EmergencyWithdrawExecuted(competitionId, recipient, balance);
    }

    // ──────────────────────────────────────────────── Views

    function getCompetitionBalance(uint256 competitionId) external view returns (uint256) {
        return competitionBalance[competitionId];
    }

    function getPlayerDeposit(uint256 competitionId, address player) external view returns (uint256) {
        return playerDeposit[competitionId][player];
    }
}
