// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IAccessRegistry.sol";

/// @title FeeRouter (Native-Only)
/// @notice Simplified fee collection for WeezWager on Initia. Native INIT only, no token paths.
/// @dev Adapted from Weezdraw — removed ERC20 paths and staking split for hackathon scope.
contract FeeRouter is Initializable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ──────────────────────────────────────────────── State
    IAccessRegistry public accessRegistry;

    uint16 public protocolFeeBps;
    address public treasury;

    struct FeeConfig {
        uint16 operatorFeeBps;
        uint16 creatorRoyaltyBps;
        address operator;
        address creator;
        bool isSet;
    }

    mapping(uint256 => FeeConfig) public competitionFeeConfigs;
    mapping(address => uint256) public accumulatedFees;

    uint256[48] private __gap;

    // ──────────────────────────────────────────────── Roles
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ──────────────────────────────────────────────── Errors
    error FeeTooHigh(uint16 bps, uint16 maxBps);
    error NoFeesToWithdraw(address recipient);
    error ZeroAddress();
    error UnauthorizedAdmin(address caller);
    error UnauthorizedOperator(address caller);
    error ModuleNotActive(address caller);
    error ProtocolPaused();
    error TransferFailed();
    error FeeRecipientZeroAddress();

    // ──────────────────────────────────────────────── Events
    event FeesCollected(uint256 indexed competitionId, uint256 protocolFee, uint256 operatorFee, uint256 creatorFee);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event ProtocolFeeUpdated(uint16 oldBps, uint16 newBps);
    event CompetitionFeeConfigSet(uint256 indexed competitionId, uint16 operatorFeeBps, uint16 creatorRoyaltyBps);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ──────────────────────────────────────────────── Modifiers
    modifier onlyProtocolAdmin() {
        if (!accessRegistry.hasRole(PROTOCOL_ADMIN_ROLE, msg.sender)) revert UnauthorizedAdmin(msg.sender);
        _;
    }

    modifier onlyOperator() {
        if (!accessRegistry.hasRole(OPERATOR_ROLE, msg.sender)) revert UnauthorizedOperator(msg.sender);
        _;
    }

    modifier onlyActiveModule() {
        if (!accessRegistry.isModuleActive(msg.sender)) revert ModuleNotActive(msg.sender);
        _;
    }

    modifier whenProtocolNotPaused() {
        if (accessRegistry.isProtocolPaused()) revert ProtocolPaused();
        _;
    }

    // ──────────────────────────────────────────────── Constructor
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ──────────────────────────────────────────────── Initializer

    function initialize(address _accessRegistry, address _treasury) external initializer {
        if (_accessRegistry == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        accessRegistry = IAccessRegistry(_accessRegistry);
        treasury = _treasury;
        protocolFeeBps = 200; // 2%
    }

    // ──────────────────────────────────────────────── Admin Functions

    function setProtocolFeeBps(uint16 bps) external onlyProtocolAdmin {
        if (bps > 1000) revert FeeTooHigh(bps, 1000);
        uint16 oldBps = protocolFeeBps;
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(oldBps, bps);
    }

    function setTreasury(address newTreasury) external onlyProtocolAdmin {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // ──────────────────────────────────────────────── Operator Functions

    function setCompetitionFeeConfig(
        uint256 competitionId,
        uint16 operatorFeeBps,
        uint16 creatorRoyaltyBps,
        address operator,
        address creator
    ) external onlyOperator {
        if (operatorFeeBps > 500) revert FeeTooHigh(operatorFeeBps, 500);
        if (creatorRoyaltyBps > 500) revert FeeTooHigh(creatorRoyaltyBps, 500);
        if (operatorFeeBps > 0 && operator == address(0)) revert FeeRecipientZeroAddress();
        if (creatorRoyaltyBps > 0 && creator == address(0)) revert FeeRecipientZeroAddress();

        competitionFeeConfigs[competitionId] = FeeConfig({
            operatorFeeBps: operatorFeeBps,
            creatorRoyaltyBps: creatorRoyaltyBps,
            operator: operator,
            creator: creator,
            isSet: true
        });

        emit CompetitionFeeConfigSet(competitionId, operatorFeeBps, creatorRoyaltyBps);
    }

    // ──────────────────────────────────────────────── Fee Calculation

    function calculateFees(uint256 competitionId, uint256 grossAmount)
        external
        view
        returns (uint256 protocolFee, uint256 operatorFee, uint256 creatorFee, uint256 netAmount)
    {
        protocolFee = (grossAmount * protocolFeeBps) / 10000;

        FeeConfig storage config = competitionFeeConfigs[competitionId];
        if (config.isSet) {
            operatorFee = (grossAmount * config.operatorFeeBps) / 10000;
            creatorFee = (grossAmount * config.creatorRoyaltyBps) / 10000;
        }

        netAmount = grossAmount - protocolFee - operatorFee - creatorFee;
    }

    // ──────────────────────────────────────────────── Fee Deposits

    function depositFees(uint256 competitionId)
        external
        payable
        onlyActiveModule
        whenProtocolNotPaused
    {
        uint256 totalDeposit = msg.value;
        _splitAndAccumulate(competitionId, totalDeposit);
    }

    // ──────────────────────────────────────────────── Fee Withdrawals

    function withdrawFees() external nonReentrant {
        uint256 amount = accumulatedFees[msg.sender];
        if (amount == 0) revert NoFeesToWithdraw(msg.sender);

        accumulatedFees[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────── Internal

    function _splitAndAccumulate(uint256 competitionId, uint256 totalDeposit) internal {
        FeeConfig storage config = competitionFeeConfigs[competitionId];

        uint256 operatorAmount;
        uint256 creatorAmount;

        if (config.isSet) {
            uint16 totalBps = protocolFeeBps + config.operatorFeeBps + config.creatorRoyaltyBps;
            if (totalBps > 0) {
                operatorAmount = (totalDeposit * config.operatorFeeBps) / totalBps;
                creatorAmount = (totalDeposit * config.creatorRoyaltyBps) / totalBps;
            }
        }

        // Treasury gets the remainder (collects rounding dust)
        uint256 treasuryAmount = totalDeposit - operatorAmount - creatorAmount;
        accumulatedFees[treasury] += treasuryAmount;

        if (config.isSet && operatorAmount > 0) {
            accumulatedFees[config.operator] += operatorAmount;
        }
        if (config.isSet && creatorAmount > 0) {
            accumulatedFees[config.creator] += creatorAmount;
        }

        uint256 protocolFee = treasuryAmount;
        emit FeesCollected(competitionId, protocolFee, operatorAmount, creatorAmount);
    }

    // ──────────────────────────────────────────────── Upgrade Authorization

    function _authorizeUpgrade(address) internal override onlyProtocolAdmin {}
}
