// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AaveV3Adapter} from "../../src/adapters/AaveV3Adapter.sol";
import {InletReceiver} from "../../src/InletReceiver.sol";
import {InletTypes} from "../../src/libraries/InletTypes.sol";
import {CctpMessages} from "../CctpMessages.sol";
import {MockAavePool, MockAToken} from "../mocks/MockAave.sol";
import {MockMessageTransmitterV2} from "../mocks/MockCctp.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract AaveV3AdapterTest is Test {
    uint32 constant ARC = 26;
    uint32 constant ARBITRUM_SEPOLIA = 3;
    bytes32 constant AAVE_ID = keccak256("aave-v3:v1");

    MockUSDC usdc;
    MockAavePool pool;
    MockAToken aToken;
    AaveV3Adapter adapter;
    MockMessageTransmitterV2 transmitter;
    InletReceiver receiver;

    address hub = address(0x4B);
    address beneficiary = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        pool = new MockAavePool();
        aToken = pool.listReserve(address(usdc));
        adapter = new AaveV3Adapter();
        transmitter = new MockMessageTransmitterV2(usdc);
        receiver = new InletReceiver(address(usdc), address(transmitter), ARC, hub, address(this));
        receiver.setAdapter(AAVE_ID, address(adapter));
    }

    function _message(bytes32 nonce, uint256 amount, bytes memory adapterData)
        internal
        view
        returns (bytes memory)
    {
        bytes memory payload = InletTypes.encodeHookPayload(
            keccak256(abi.encode(nonce)), AAVE_ID, CctpMessages.toBytes32(beneficiary), adapterData
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
            ARBITRUM_SEPOLIA,
            nonce,
            keccak256("token messenger on arc"),
            CctpMessages.toBytes32(address(receiver)),
            bytes32(0),
            body
        );
    }

    function test_directDepositSuppliesForTheBeneficiary() public {
        usdc.mint(address(this), 100e6);
        usdc.approve(address(adapter), 100e6);

        bytes memory result =
            adapter.deposit(address(usdc), 100e6, CctpMessages.toBytes32(beneficiary), abi.encode(address(pool), 100e6));

        (address reported, uint256 received) = abi.decode(result, (address, uint256));
        assertEq(reported, address(aToken));
        assertEq(received, 100e6);
        assertEq(aToken.balanceOf(beneficiary), 100e6);
        assertEq(usdc.balanceOf(address(pool)), 100e6);
        assertEq(usdc.balanceOf(address(adapter)), 0);
    }

    function test_receiverDeliversATokens() public {
        receiver.receiveAndExecute(_message(keccak256("nonce 1"), 25e6, abi.encode(address(pool), 0)), "");
        assertEq(aToken.balanceOf(beneficiary), 25e6);
        assertEq(receiver.claimable(beneficiary), 0);
    }

    function test_minATokensFallsBackToClaimable() public {
        receiver.receiveAndExecute(_message(keccak256("nonce 2"), 25e6, abi.encode(address(pool), 26e6)), "");
        assertEq(aToken.balanceOf(beneficiary), 0);
        assertEq(receiver.claimable(beneficiary), 25e6);
    }

    function test_pausedReserveFallsBackToClaimable() public {
        pool.setPaused(true);
        receiver.receiveAndExecute(_message(keccak256("nonce 3"), 25e6, abi.encode(address(pool), 0)), "");
        assertEq(receiver.claimable(beneficiary), 25e6);
    }

    function test_unknownReserveReverts() public {
        MockUSDC other = new MockUSDC();
        other.mint(address(this), 1e6);
        other.approve(address(adapter), 1e6);
        vm.expectRevert(AaveV3Adapter.NoReserve.selector);
        adapter.deposit(address(other), 1e6, CctpMessages.toBytes32(beneficiary), abi.encode(address(pool), 0));
    }
}
