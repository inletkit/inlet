// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {IInletAdapter} from "../interfaces/IInletAdapter.sol";
import {IPermit2, IPositionManager, IStateView} from "../interfaces/IUniswapV4.sol";
import {LiquidityMath} from "../libraries/LiquidityMath.sol";

/// @notice Mints a single sided USDC liquidity position in a Uniswap v4 pool, owned by the beneficiary.
/// @dev The range sits just outside the current price on the USDC side, so only USDC is needed.
/// Adapter data is abi.encode(PoolKey key, int24 rangeTicks, uint128 minLiquidity).
contract UniswapV4LpAdapter is IInletAdapter {
    using SafeERC20 for IERC20;

    struct Plan {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        bool usdcIsCurrency1;
    }

    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant SETTLE_PAIR = 0x0d;

    IPositionManager public immutable positionManager;
    IStateView public immutable stateView;
    IERC20 public immutable usdc;

    error WrongAsset();
    error PoolWithoutUsdc();
    error EmptyRange();
    error TooLittleLiquidity(uint128 liquidity, uint128 minLiquidity);

    constructor(address positionManager_, address stateView_, address permit2_, address usdc_) {
        positionManager = IPositionManager(positionManager_);
        stateView = IStateView(stateView_);
        usdc = IERC20(usdc_);
        usdc.forceApprove(permit2_, type(uint256).max);
        IPermit2(permit2_).approve(usdc_, positionManager_, type(uint160).max, type(uint48).max);
    }

    function deposit(address token, uint256 amount, bytes32 beneficiary, bytes calldata data)
        external
        returns (bytes memory)
    {
        if (token != address(usdc)) revert WrongAsset();
        (PoolKey memory key, int24 rangeTicks, uint128 minLiquidity) =
            abi.decode(data, (PoolKey, int24, uint128));

        Plan memory plan = this.plan(key, rangeTicks, amount);
        if (plan.liquidity == 0 || plan.liquidity < minLiquidity) {
            revert TooLittleLiquidity(plan.liquidity, minLiquidity);
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        address owner = address(uint160(uint256(beneficiary)));
        uint256 tokenId = positionManager.nextTokenId();
        _mint(key, plan, amount, owner);

        uint256 left = usdc.balanceOf(address(this));
        if (left > 0) usdc.safeTransfer(owner, left);
        return abi.encode(tokenId, plan.liquidity, plan.tickLower, plan.tickUpper);
    }

    /// @notice The range and liquidity a deposit of amount USDC would mint right now.
    function plan(PoolKey calldata key, int24 rangeTicks, uint256 amount)
        external
        view
        returns (Plan memory result)
    {
        result.usdcIsCurrency1 = Currency.unwrap(key.currency1) == address(usdc);
        if (!result.usdcIsCurrency1 && Currency.unwrap(key.currency0) != address(usdc)) {
            revert PoolWithoutUsdc();
        }
        (, int24 tick,,) = stateView.getSlot0(key.toId());
        (result.tickLower, result.tickUpper) =
            range(tick, key.tickSpacing, rangeTicks, result.usdcIsCurrency1);
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(result.tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(result.tickUpper);
        result.liquidity = result.usdcIsCurrency1
            ? LiquidityMath.forAmount1(sqrtLower, sqrtUpper, amount)
            : LiquidityMath.forAmount0(sqrtLower, sqrtUpper, amount);
    }

    function _mint(PoolKey memory key, Plan memory plan_, uint256 amount, address owner) internal {
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            key,
            plan_.tickLower,
            plan_.tickUpper,
            uint256(plan_.liquidity),
            plan_.usdcIsCurrency1 ? uint128(0) : uint128(amount),
            plan_.usdcIsCurrency1 ? uint128(amount) : uint128(0),
            owner,
            bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        positionManager.modifyLiquidities(
            abi.encode(abi.encodePacked(MINT_POSITION, SETTLE_PAIR), params), block.timestamp
        );
    }

    /// @notice A range about rangeTicks wide entirely on the USDC side of the current tick, aligned to the spacing.
    function range(int24 tick, int24 spacing, int24 rangeTicks, bool below)
        public
        pure
        returns (int24 lower, int24 upper)
    {
        int24 aligned = floorTick(tick, spacing);
        int24 width = rangeTicks < spacing ? spacing : floorTick(rangeTicks, spacing);
        if (below) {
            upper = aligned - spacing;
            lower = upper - width;
        } else {
            lower = aligned + 2 * spacing;
            upper = lower + width;
        }
        int24 min = TickMath.minUsableTick(spacing);
        int24 max = TickMath.maxUsableTick(spacing);
        if (lower < min) lower = min;
        if (upper > max) upper = max;
        if (lower >= upper) revert EmptyRange();
    }

    function floorTick(int24 tick, int24 spacing) public pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && tick % spacing != 0) compressed--;
        return compressed * spacing;
    }
}
