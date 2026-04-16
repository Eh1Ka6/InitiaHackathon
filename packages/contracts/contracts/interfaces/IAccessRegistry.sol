// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IAccessRegistry {
    function isModuleActive(address module) external view returns (bool);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function isProtocolPaused() external view returns (bool);
}
