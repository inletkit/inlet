// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @notice Subset of Uniswap v4's PositionManager used by Inlet.
interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;

    function nextTokenId() external view returns (uint256);

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity);

    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice Subset of Uniswap v4's StateView used by Inlet.
interface IStateView {
    function getSlot0(PoolId poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

/// @notice Subset of Permit2's AllowanceTransfer used by Inlet.
interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;

    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce);

    function transferFrom(address from, address to, uint160 amount, address token) external;
}
