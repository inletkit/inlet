// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Lives at a deposit address and moves everything it receives to the hub.
contract InletForwarder {
    using SafeERC20 for IERC20;

    address public immutable hub;
    IERC20 public immutable token;

    error OnlyHub();

    constructor(address token_) {
        hub = msg.sender;
        token = IERC20(token_);
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) token.safeTransfer(hub, balance);
    }

    function flush() external returns (uint256 moved) {
        if (msg.sender != hub) revert OnlyHub();
        moved = token.balanceOf(address(this));
        if (moved > 0) token.safeTransfer(hub, moved);
    }
}
