// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IAccessRegistry.sol";

/// @title AccessRegistry
/// @notice UUPS-upgradeable role-based access control with module allowlist and pause functionality
contract AccessRegistry is
    Initializable,
    AccessControlEnumerableUpgradeable,
    UUPSUpgradeable,
    IAccessRegistry
{
    // ──────────────────────────────────────────────── Roles
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_CREATOR_ROLE = keccak256("GAME_CREATOR_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant COMMUNITY_CREATOR_ROLE = keccak256("COMMUNITY_CREATOR_ROLE");

    // ──────────────────────────────────────────────── State
    mapping(address => bool) private _registeredModules;
    mapping(address => bool) private _pausedModules;
    bool private _protocolPaused;

    // ──────────────────────────────────────────────── Errors
    error ModuleAlreadyRegistered(address module);
    error ModuleNotRegistered(address module);
    error ModuleAlreadyPaused(address module);
    error ModuleNotPaused(address module);
    error ProtocolIsPaused();
    error ZeroAddress();

    // ──────────────────────────────────────────────── Events
    event ModuleRegistered(address indexed module);
    event ModuleUnregistered(address indexed module);
    event ModulePaused(address indexed module);
    event ModuleUnpaused(address indexed module);
    event ProtocolPaused();
    event ProtocolUnpaused();

    // ──────────────────────────────────────────────── Initializer

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROTOCOL_ADMIN_ROLE, admin);

        _setRoleAdmin(OPERATOR_ROLE, PROTOCOL_ADMIN_ROLE);
        _setRoleAdmin(GAME_CREATOR_ROLE, PROTOCOL_ADMIN_ROLE);
        _setRoleAdmin(RESOLVER_ROLE, PROTOCOL_ADMIN_ROLE);
        _setRoleAdmin(COMMUNITY_CREATOR_ROLE, PROTOCOL_ADMIN_ROLE);
    }

    // ──────────────────────────────────────────────── Module Management

    function registerModule(address module) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        if (module == address(0)) revert ZeroAddress();
        if (_registeredModules[module]) revert ModuleAlreadyRegistered(module);
        _registeredModules[module] = true;
        emit ModuleRegistered(module);
    }

    function unregisterModule(address module) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        if (!_registeredModules[module]) revert ModuleNotRegistered(module);
        _registeredModules[module] = false;
        _pausedModules[module] = false;
        emit ModuleUnregistered(module);
    }

    // ──────────────────────────────────────────────── Module Pause

    function pauseModule(address module) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        if (!_registeredModules[module]) revert ModuleNotRegistered(module);
        if (_pausedModules[module]) revert ModuleAlreadyPaused(module);
        _pausedModules[module] = true;
        emit ModulePaused(module);
    }

    function unpauseModule(address module) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        if (!_registeredModules[module]) revert ModuleNotRegistered(module);
        if (!_pausedModules[module]) revert ModuleNotPaused(module);
        _pausedModules[module] = false;
        emit ModuleUnpaused(module);
    }

    // ──────────────────────────────────────────────── Protocol Pause

    function pauseProtocol() external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _protocolPaused = true;
        emit ProtocolPaused();
    }

    function unpauseProtocol() external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _protocolPaused = false;
        emit ProtocolUnpaused();
    }

    // ──────────────────────────────────────────────── Views

    function isModuleActive(address module) external view override returns (bool) {
        return _registeredModules[module] && !_pausedModules[module] && !_protocolPaused;
    }

    function isProtocolPaused() external view override returns (bool) {
        return _protocolPaused;
    }

    function hasRole(bytes32 role, address account)
        public
        view
        override(AccessControlUpgradeable, IAccessControlUpgradeable, IAccessRegistry)
        returns (bool)
    {
        return super.hasRole(role, account);
    }

    // ──────────────────────────────────────────────── Upgrade Authorization

    function _authorizeUpgrade(address) internal override onlyRole(PROTOCOL_ADMIN_ROLE) {}

    // ──────────────────────────────────────────────── Storage Gap
    uint256[50] private __gap;
}
