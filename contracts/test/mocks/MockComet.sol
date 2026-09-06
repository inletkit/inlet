// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IComet} from "../../src/interfaces/ICompoundV3.sol";

contract MockComet is IComet {
    address public immutable baseToken;
    bool public supplyPaused;
    mapping(address account => uint256) public balanceOf;

    constructor(address baseToken_) {
        baseToken = baseToken_;
    }

    function pauseSupply(bool value) external {
        supplyPaused = value;
    }

    function supplyTo(address dst, address asset, uint256 amount) external {
        require(!supplyPaused, "paused");
        require(asset == baseToken, "not base");
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        balanceOf[dst] += amount;
    }
}
