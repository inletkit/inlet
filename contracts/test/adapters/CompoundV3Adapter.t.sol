// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CompoundV3Adapter} from "../../src/adapters/CompoundV3Adapter.sol";
import {InletReceiver} from "../../src/InletReceiver.sol";
import {InletTypes} from "../../src/libraries/InletTypes.sol";
import {CctpMessages} from "../CctpMessages.sol";
import {MockComet} from "../mocks/MockComet.sol";
import {MockMessageTransmitterV2} from "../mocks/MockCctp.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract CompoundV3AdapterTest is Test {
    uint32 constant ARC = 26;
    uint32 constant BASE_SEPOLIA = 6;
    bytes32 constant COMPOUND_ID = keccak256("compound-v3:v1");

    MockUSDC usdc;
    MockComet comet;
    CompoundV3Adapter adapter;
    MockMessageTransmitterV2 transmitter;
    InletReceiver receiver;

    address hub = address(0x4B);
    address beneficiary = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        comet = new MockComet(address(usdc));
        adapter = new CompoundV3Adapter();
        transmitter = new MockMessageTransmitterV2(usdc);
        receiver = new InletReceiver(address(usdc), address(transmitter), ARC, hub, address(this));
        receiver.setAdapter(COMPOUND_ID, address(adapter));
    }

    function _message(bytes32 nonce, uint256 amount, bytes memory adapterData)
        internal
        view
        returns (bytes memory)
    {
        bytes memory payload = InletTypes.encodeHookPayload(
            keccak256(abi.encode(nonce)), COMPOUND_ID, CctpMessages.toBytes32(beneficiary), adapterData
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
            BASE_SEPOLIA,
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
            adapter.deposit(address(usdc), 100e6, CctpMessages.toBytes32(beneficiary), abi.encode(address(comet), 100e6));

        (address reported, uint256 gained) = abi.decode(result, (address, uint256));
        assertEq(reported, address(comet));
        assertEq(gained, 100e6);
        assertEq(comet.balanceOf(beneficiary), 100e6);
        assertEq(usdc.balanceOf(address(adapter)), 0);
    }

    function test_receiverDeliversTheSupply() public {
        receiver.receiveAndExecute(_message(keccak256("nonce 1"), 25e6, abi.encode(address(comet), 0)), "");
        assertEq(comet.balanceOf(beneficiary), 25e6);
        assertEq(receiver.claimable(beneficiary), 0);
    }

    function test_wrongBaseTokenFallsBackToClaimable() public {
        MockComet other = new MockComet(address(0x1234));
        receiver.receiveAndExecute(_message(keccak256("nonce 2"), 25e6, abi.encode(address(other), 0)), "");
        assertEq(receiver.claimable(beneficiary), 25e6);
    }

    function test_pausedSupplyFallsBackToClaimable() public {
        comet.pauseSupply(true);
        receiver.receiveAndExecute(_message(keccak256("nonce 3"), 25e6, abi.encode(address(comet), 0)), "");
        assertEq(receiver.claimable(beneficiary), 25e6);
    }
}
