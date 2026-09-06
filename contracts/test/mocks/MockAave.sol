// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAaveV3Pool} from "../../src/interfaces/IAaveV3.sol";

contract MockAToken is ERC20 {
    address public immutable pool;
    address public immutable underlying;

    constructor(address pool_, address underlying_) ERC20("Aave USDC", "aUSDC") {
        pool = pool_;
        underlying = underlying_;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        _mint(to, amount);
    }
}

contract MockAavePool is IAaveV3Pool {
    mapping(address asset => MockAToken) public aTokens;
    bool public paused;

    function listReserve(address asset) external returns (MockAToken aToken) {
        aToken = new MockAToken(address(this), asset);
        aTokens[asset] = aToken;
    }

    function setPaused(bool value) external {
        paused = value;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(!paused, "RESERVE_PAUSED");
        MockAToken aToken = aTokens[asset];
        require(address(aToken) != address(0), "RESERVE_INACTIVE");
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function getReserveData(address asset) external view returns (ReserveData memory data) {
        data.aTokenAddress = address(aTokens[asset]);
    }
}
