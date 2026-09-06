// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAaveV3Pool} from "../interfaces/IAaveV3.sol";
import {IInletAdapter} from "../interfaces/IInletAdapter.sol";

/// @notice Supplies USDC to an Aave V3 pool so the beneficiary holds the aToken. Adapter data is abi.encode(pool, minATokens).
contract AaveV3Adapter is IInletAdapter {
    using SafeERC20 for IERC20;

    error NoReserve();
    error TooFewATokens(uint256 received, uint256 minATokens);

    function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
        external
        returns (bytes memory)
    {
        (address pool, uint256 minATokens) = abi.decode(data, (address, uint256));
        address aToken = IAaveV3Pool(pool).getReserveData(usdc).aTokenAddress;
        if (aToken == address(0)) revert NoReserve();

        address to = address(uint160(uint256(beneficiary)));
        uint256 before = IERC20(aToken).balanceOf(to);

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(usdc).forceApprove(pool, amount);
        IAaveV3Pool(pool).supply(usdc, amount, to, 0);

        uint256 received = IERC20(aToken).balanceOf(to) - before;
        if (received < minATokens) revert TooFewATokens(received, minATokens);
        return abi.encode(aToken, received);
    }
}
