// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IPermit2, IPositionManager, IStateView} from "../../src/interfaces/IUniswapV4.sol";
import {LiquidityMath} from "../../src/libraries/LiquidityMath.sol";

contract MockPermit2 is IPermit2 {
    struct Allowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    mapping(address user => mapping(address token => mapping(address spender => Allowance))) public allowances;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        allowances[msg.sender][token][spender] = Allowance(amount, expiration, 0);
    }

    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160, uint48, uint48)
    {
        Allowance memory a = allowances[user][token][spender];
        return (a.amount, a.expiration, a.nonce);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        Allowance storage a = allowances[from][token][msg.sender];
        require(a.amount >= amount && a.expiration >= block.timestamp, "permit2 allowance");
        if (a.amount != type(uint160).max) a.amount -= amount;
        IERC20(token).transferFrom(from, to, amount);
    }
}

contract MockStateView is IStateView {
    int24 public tick;

    function setTick(int24 value) external {
        tick = value;
    }

    function getSlot0(PoolId) external view returns (uint160, int24, uint24, uint24) {
        return (TickMath.getSqrtPriceAtTick(tick), tick, 0, 3000);
    }
}

contract MockPositionManager is IPositionManager {
    struct Minted {
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        address owner;
        uint256 amount0;
        uint256 amount1;
    }

    IPermit2 public immutable permit2;
    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => Minted) public minted;
    mapping(uint256 tokenId => address) public ownerOf;

    constructor(IPermit2 permit2_) {
        permit2 = permit2_;
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return uint128(minted[tokenId].liquidity);
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        require(deadline >= block.timestamp, "deadline");
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == 2 && uint8(actions[0]) == 0x02 && uint8(actions[1]) == 0x0d, "actions");

        uint256 tokenId = nextTokenId++;
        Minted memory m = _decodeMint(params[0]);
        _checkSettle(params[1], m.key);
        require(m.tickLower < m.tickUpper, "ticks");
        require(m.tickLower % m.key.tickSpacing == 0 && m.tickUpper % m.key.tickSpacing == 0, "alignment");

        (m.amount0, m.amount1) = _amounts(m.tickLower, m.tickUpper, uint128(m.liquidity));
        require(m.amount0 <= m.amount0Max, "MaximumAmountExceeded 0");
        require(m.amount1 <= m.amount1Max, "MaximumAmountExceeded 1");
        if (m.amount0 > 0) permit2.transferFrom(msg.sender, address(this), uint160(m.amount0), Currency.unwrap(m.key.currency0));
        if (m.amount1 > 0) permit2.transferFrom(msg.sender, address(this), uint160(m.amount1), Currency.unwrap(m.key.currency1));
        minted[tokenId] = m;
        ownerOf[tokenId] = m.owner;
    }

    function _decodeMint(bytes memory data) internal pure returns (Minted memory m) {
        (m.key, m.tickLower, m.tickUpper, m.liquidity, m.amount0Max, m.amount1Max, m.owner,) =
            abi.decode(data, (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
    }

    function _checkSettle(bytes memory params, PoolKey memory key) internal pure {
        (Currency c0, Currency c1) = abi.decode(params, (Currency, Currency));
        require(Currency.unwrap(c0) == Currency.unwrap(key.currency0), "settle currency0");
        require(Currency.unwrap(c1) == Currency.unwrap(key.currency1), "settle currency1");
    }

    function _amounts(int24 tickLower, int24 tickUpper, uint128 liquidity)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        int24 tick = stateView.tick();
        if (tick < tickLower) {
            amount0 = LiquidityMath.amount0For(sqrtLower, sqrtUpper, liquidity);
        } else if (tick < tickUpper) {
            uint160 sqrtCurrent = TickMath.getSqrtPriceAtTick(tick);
            amount0 = LiquidityMath.amount0For(sqrtCurrent, sqrtUpper, liquidity);
            amount1 = LiquidityMath.amount1For(sqrtLower, sqrtCurrent, liquidity);
        } else {
            amount1 = LiquidityMath.amount1For(sqrtLower, sqrtUpper, liquidity);
        }
    }

    MockStateView public stateView;

    function setStateView(MockStateView value) external {
        stateView = value;
    }
}
