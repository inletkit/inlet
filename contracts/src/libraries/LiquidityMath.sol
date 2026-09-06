// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Liquidity for a single sided amount between two sqrt prices, as in Uniswap's LiquidityAmounts.
library LiquidityMath {
    uint256 internal constant Q96 = 2 ** 96;

    error LiquidityOverflow();

    function forAmount0(uint160 sqrtLower, uint160 sqrtUpper, uint256 amount0)
        internal
        pure
        returns (uint128)
    {
        uint256 intermediate = Math.mulDiv(sqrtLower, sqrtUpper, Q96);
        return toUint128(Math.mulDiv(amount0, intermediate, sqrtUpper - sqrtLower));
    }

    function forAmount1(uint160 sqrtLower, uint160 sqrtUpper, uint256 amount1)
        internal
        pure
        returns (uint128)
    {
        return toUint128(Math.mulDiv(amount1, Q96, sqrtUpper - sqrtLower));
    }

    function amount0For(uint160 sqrtLower, uint160 sqrtUpper, uint128 liquidity)
        internal
        pure
        returns (uint256)
    {
        uint256 numerator = uint256(liquidity) << 96;
        return Math.mulDiv(numerator, sqrtUpper - sqrtLower, sqrtUpper, Math.Rounding.Ceil) / sqrtLower + 1;
    }

    function amount1For(uint160 sqrtLower, uint160 sqrtUpper, uint128 liquidity)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(liquidity, sqrtUpper - sqrtLower, Q96, Math.Rounding.Ceil);
    }

    function toUint128(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert LiquidityOverflow();
        return uint128(value);
    }
}
