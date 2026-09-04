// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Turns USDC approved by the receiver into a position for the beneficiary.
interface IInletAdapter {
    function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
        external
        returns (bytes memory result);
}
