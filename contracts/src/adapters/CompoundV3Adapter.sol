// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IComet} from "../interfaces/ICompoundV3.sol";
import {IInletAdapter} from "../interfaces/IInletAdapter.sol";

/// @notice Supplies USDC to a Compound III market whose base asset is USDC, credited to the beneficiary. Adapter data is abi.encode(comet, minBalanceGain).
contract CompoundV3Adapter is IInletAdapter {
    using SafeERC20 for IERC20;

    error WrongBaseToken();
    error TooLittleSupplied(uint256 gained, uint256 minimum);

    function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
        external
        returns (bytes memory)
    {
        (address comet, uint256 minimum) = abi.decode(data, (address, uint256));
        if (IComet(comet).baseToken() != usdc) revert WrongBaseToken();

        address to = address(uint160(uint256(beneficiary)));
        uint256 before = IComet(comet).balanceOf(to);

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(usdc).forceApprove(comet, amount);
        IComet(comet).supplyTo(to, usdc, amount);

        uint256 gained = IComet(comet).balanceOf(to) - before;
        if (gained < minimum) revert TooLittleSupplied(gained, minimum);
        return abi.encode(comet, gained);
    }
}
