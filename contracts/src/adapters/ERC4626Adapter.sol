// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IInletAdapter} from "../interfaces/IInletAdapter.sol";

/// @notice Deposits into any ERC 4626 vault over USDC. Adapter data is abi.encode(vault, minShares).
contract ERC4626Adapter is IInletAdapter {
    using SafeERC20 for IERC20;

    error WrongAsset();
    error TooFewShares(uint256 shares, uint256 minShares);

    function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
        external
        returns (bytes memory)
    {
        (address vault, uint256 minShares) = abi.decode(data, (address, uint256));
        if (IERC4626(vault).asset() != usdc) revert WrongAsset();

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(usdc).forceApprove(vault, amount);
        uint256 shares = IERC4626(vault).deposit(amount, address(uint160(uint256(beneficiary))));
        if (shares < minShares) revert TooFewShares(shares, minShares);
        return abi.encode(shares);
    }
}
