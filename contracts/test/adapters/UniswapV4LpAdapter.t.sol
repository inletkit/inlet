// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {UniswapV4LpAdapter} from "../../src/adapters/UniswapV4LpAdapter.sol";
import {InletReceiver} from "../../src/InletReceiver.sol";
import {InletTypes} from "../../src/libraries/InletTypes.sol";
import {CctpMessages} from "../CctpMessages.sol";
import {MockMessageTransmitterV2} from "../mocks/MockCctp.sol";
import {MockPermit2, MockPositionManager, MockStateView} from "../mocks/MockUniswapV4.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract UniswapV4LpAdapterTest is Test {
    uint32 constant ARC = 26;
    uint32 constant UNICHAIN_SEPOLIA = 10;
    bytes32 constant UNISWAP_ID = keccak256("uniswap-v4-lp:v1");

    MockUSDC usdc;
    MockPermit2 permit2;
    MockStateView stateView;
    MockPositionManager positionManager;
    UniswapV4LpAdapter adapter;
    MockMessageTransmitterV2 transmitter;
    InletReceiver receiver;

    address hub = address(0x4B);
    address beneficiary = address(0xBEEF);
    PoolKey ethUsdc;

    function setUp() public {
        usdc = new MockUSDC();
        permit2 = new MockPermit2();
        stateView = new MockStateView();
        stateView.setTick(-193383);
        positionManager = new MockPositionManager(permit2);
        positionManager.setStateView(stateView);
        adapter = new UniswapV4LpAdapter(address(positionManager), address(stateView), address(permit2), address(usdc));
        transmitter = new MockMessageTransmitterV2(usdc);
        receiver = new InletReceiver(address(usdc), address(transmitter), ARC, hub, address(this));
        receiver.setAdapter(UNISWAP_ID, address(adapter));
        ethUsdc = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(usdc)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function _data(int24 rangeTicks, uint128 minLiquidity) internal view returns (bytes memory) {
        return abi.encode(ethUsdc, rangeTicks, minLiquidity);
    }

    function _message(bytes32 nonce, uint256 amount, bytes memory adapterData)
        internal
        view
        returns (bytes memory)
    {
        bytes memory payload = InletTypes.encodeHookPayload(
            keccak256(abi.encode(nonce)), UNISWAP_ID, CctpMessages.toBytes32(beneficiary), adapterData
        );
        bytes memory body = CctpMessages.burnBody(
            CctpMessages.toBytes32(address(usdc)),
            CctpMessages.toBytes32(address(receiver)),
            amount,
            CctpMessages.toBytes32(hub),
            0,
            0,
            payload
        );
        return CctpMessages.header(
            ARC,
            UNICHAIN_SEPOLIA,
            nonce,
            keccak256("token messenger on arc"),
            CctpMessages.toBytes32(address(receiver)),
            bytes32(0),
            body
        );
    }

    function test_constructorApprovesPermit2AndThePositionManager() public view {
        assertEq(usdc.allowance(address(adapter), address(permit2)), type(uint256).max);
        (uint160 amount, uint48 expiration,) = permit2.allowance(address(adapter), address(usdc), address(positionManager));
        assertEq(amount, type(uint160).max);
        assertEq(expiration, type(uint48).max);
    }

    function test_mintsAUsdcOnlyPositionBelowThePrice() public {
        usdc.mint(address(this), 100e6);
        usdc.approve(address(adapter), 100e6);

        bytes memory result = adapter.deposit(address(usdc), 100e6, CctpMessages.toBytes32(beneficiary), _data(1200, 1));
        (uint256 tokenId, uint128 liquidity, int24 tickLower, int24 tickUpper) =
            abi.decode(result, (uint256, uint128, int24, int24));

        assertEq(tokenId, 1);
        assertEq(positionManager.ownerOf(tokenId), beneficiary);
        assertEq(positionManager.getPositionLiquidity(tokenId), liquidity);
        assertGt(liquidity, 0);
        assertEq(tickUpper, -193500);
        assertEq(tickLower, -193500 - 1200);
        (,,,,,,, uint256 amount0, uint256 amount1) = positionManager.minted(tokenId);
        assertEq(amount0, 0);
        assertLe(amount1, 100e6);
        assertGe(amount1, 100e6 - 1);
        assertEq(usdc.balanceOf(address(adapter)), 0);
        assertEq(usdc.balanceOf(address(positionManager)) + usdc.balanceOf(beneficiary), 100e6);
    }

    function test_positiveTickAlignsDownward() public {
        stateView.setTick(1234);
        usdc.mint(address(this), 10e6);
        usdc.approve(address(adapter), 10e6);
        bytes memory result = adapter.deposit(address(usdc), 10e6, CctpMessages.toBytes32(beneficiary), _data(600, 0));
        (,, int24 tickLower, int24 tickUpper) = abi.decode(result, (uint256, uint128, int24, int24));
        assertEq(tickUpper, 1140);
        assertEq(tickLower, 540);
    }

    function test_usdcAsCurrency0GoesAboveThePrice() public {
        MockUSDC low = new MockUSDC();
        vm.etch(address(0x1000), address(low).code);
        UniswapV4LpAdapter other = new UniswapV4LpAdapter(address(positionManager), address(stateView), address(permit2), address(0x1000));
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(address(0))
        });
        stateView.setTick(-5);
        MockUSDC(address(0x1000)).mint(address(this), 10e6);
        MockUSDC(address(0x1000)).approve(address(other), 10e6);
        bytes memory result = other.deposit(address(0x1000), 10e6, CctpMessages.toBytes32(beneficiary), abi.encode(key, int24(100), uint128(0)));
        (uint256 tokenId,, int24 tickLower, int24 tickUpper) = abi.decode(result, (uint256, uint128, int24, int24));
        assertEq(tickLower, 10);
        assertEq(tickUpper, 110);
        (,,,,,,, uint256 amount0, uint256 amount1) = positionManager.minted(tokenId);
        assertLe(amount0, 10e6);
        assertEq(amount1, 0);
    }

    function test_receiverDeliversThePosition() public {
        receiver.receiveAndExecute(_message(keccak256("nonce 1"), 25e6, _data(1200, 0)), "");
        assertEq(positionManager.ownerOf(1), beneficiary);
        assertEq(receiver.claimable(beneficiary), 0);
    }

    function test_minLiquidityFallsBackToClaimable() public {
        receiver.receiveAndExecute(_message(keccak256("nonce 2"), 25e6, _data(1200, type(uint128).max)), "");
        assertEq(receiver.claimable(beneficiary), 25e6);
    }

    function test_poolWithoutUsdcReverts() public {
        PoolKey memory key = ethUsdc;
        key.currency1 = Currency.wrap(address(0x9999));
        usdc.mint(address(this), 1e6);
        usdc.approve(address(adapter), 1e6);
        vm.expectRevert(UniswapV4LpAdapter.PoolWithoutUsdc.selector);
        adapter.deposit(address(usdc), 1e6, CctpMessages.toBytes32(beneficiary), abi.encode(key, int24(600), uint128(0)));
    }
}
