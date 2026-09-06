// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Subset of Compound III's Comet used by Inlet.
interface IComet {
    function baseToken() external view returns (address);

    function supplyTo(address dst, address asset, uint256 amount) external;

    function balanceOf(address account) external view returns (uint256);
}
