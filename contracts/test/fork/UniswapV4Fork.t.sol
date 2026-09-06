// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {UniswapV4LpAdapter} from "../../src/adapters/UniswapV4LpAdapter.sol";
import {IPositionManager} from "../../src/interfaces/IUniswapV4.sol";

/// @notice Runs against Unichain Sepolia when UNICHAIN_SEPOLIA_RPC is set, otherwise skips.
contract UniswapV4ForkTest is Test {
    address constant USDC = 0x31d0220469e10c4E71834a79b1f276d740d3768F;
    address constant POSITION_MANAGER = 0xf969Aee60879C54bAAed9F3eD26147Db216Fd664;
    address constant STATE_VIEW = 0xc199F1072a74D4e905ABa1A84d9a45E2546B6222;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address beneficiary = address(0xBEEF);

    function test_mintsAPositionInTheEthUsdcPool() public {
        string memory rpc = vm.envOr("UNICHAIN_SEPOLIA_RPC", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc);

        UniswapV4LpAdapter adapter = new UniswapV4LpAdapter(POSITION_MANAGER, STATE_VIEW, PERMIT2, USDC);
        deal(USDC, address(this), 5e6);
        IERC20(USDC).approve(address(adapter), 5e6);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        uint256 expectedId = IPositionManager(POSITION_MANAGER).nextTokenId();

        bytes memory result = adapter.deposit(USDC, 5e6, bytes32(uint256(uint160(beneficiary))), abi.encode(key, int24(1200), uint128(1)));
        (uint256 tokenId, uint128 liquidity,,) = abi.decode(result, (uint256, uint128, int24, int24));

        assertEq(tokenId, expectedId);
        assertEq(IPositionManager(POSITION_MANAGER).ownerOf(tokenId), beneficiary);
        assertEq(IPositionManager(POSITION_MANAGER).getPositionLiquidity(tokenId), liquidity);
        assertGt(liquidity, 0);
        assertLe(IERC20(USDC).balanceOf(address(adapter)), 0);
        assertLe(IERC20(USDC).balanceOf(beneficiary), 1);
    }
}
