// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {InletReceiver} from "../src/InletReceiver.sol";
import {ERC4626Adapter} from "../src/adapters/ERC4626Adapter.sol";
import {InletTypes} from "../src/libraries/InletTypes.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockMessageTransmitterV2} from "./mocks/MockCctp.sol";
import {MockVault} from "./mocks/MockVault.sol";
import {FailingAdapter} from "./mocks/FailingAdapter.sol";
import {CctpMessages} from "./CctpMessages.sol";

contract InletReceiverTest is Test {
    uint32 constant ARC = 26;
    uint32 constant ARBITRUM_SEPOLIA = 3;

    MockUSDC usdc;
    MockMessageTransmitterV2 transmitter;
    InletReceiver receiver;
    MockVault vault;
    ERC4626Adapter adapter;
    FailingAdapter failing;

    address hub = address(0x4B);
    address beneficiary = address(0xBEEF);
    bytes32 constant ERC4626_ID = keccak256("erc4626:v1");
    bytes32 constant FAILING_ID = keccak256("failing:v1");

    function setUp() public {
        usdc = new MockUSDC();
        transmitter = new MockMessageTransmitterV2(usdc);
        receiver = new InletReceiver(address(usdc), address(transmitter), ARC, hub, address(this));
        vault = new MockVault(usdc);
        adapter = new ERC4626Adapter();
        failing = new FailingAdapter();
        receiver.setAdapter(ERC4626_ID, address(adapter));
        receiver.setAdapter(FAILING_ID, address(failing));
    }

    function _message(
        bytes32 nonce,
        uint32 sourceDomain,
        bytes32 messageSender,
        uint256 amount,
        uint256 feeExecuted,
        bytes32 intentHash,
        bytes32 adapterId,
        bytes memory adapterData
    ) internal view returns (bytes memory) {
        bytes memory payload = InletTypes.encodeHookPayload(
            intentHash, adapterId, CctpMessages.toBytes32(beneficiary), adapterData
        );
        bytes memory body = CctpMessages.burnBody(
            CctpMessages.toBytes32(address(usdc)),
            CctpMessages.toBytes32(address(receiver)),
            amount,
            messageSender,
            0,
            feeExecuted,
            payload
        );
        return CctpMessages.header(
            sourceDomain,
            ARBITRUM_SEPOLIA,
            nonce,
            keccak256("token messenger on arc"),
            CctpMessages.toBytes32(address(receiver)),
            bytes32(0),
            body
        );
    }

    function _vaultData(uint256 minShares) internal view returns (bytes memory) {
        return abi.encode(address(vault), minShares);
    }

    function test_receiveAndExecuteDepositsIntoVault() public {
        bytes32 intentHash = keccak256("intent 1");
        bytes memory message = _message(
            keccak256("nonce 1"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            intentHash,
            ERC4626_ID,
            _vaultData(0)
        );

        receiver.receiveAndExecute(message, "");

        assertEq(vault.balanceOf(beneficiary), 100e6);
        assertEq(vault.totalAssets(), 100e6);
        assertEq(usdc.balanceOf(address(receiver)), 0);
        assertTrue(receiver.executed(intentHash));
        assertEq(usdc.allowance(address(receiver), address(adapter)), 0);
    }

    function test_executeAfterSeparateReceive() public {
        bytes memory message = _message(
            keccak256("nonce 2"),
            ARC,
            CctpMessages.toBytes32(hub),
            50e6,
            0,
            keccak256("intent 2"),
            ERC4626_ID,
            _vaultData(0)
        );
        transmitter.receiveMessage(message, "");
        receiver.execute(message);
        assertEq(vault.balanceOf(beneficiary), 50e6);
    }

    function test_feeExecutedReducesTheDeposit() public {
        bytes memory message = _message(
            keccak256("nonce 3"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            10e6,
            keccak256("intent 3"),
            ERC4626_ID,
            _vaultData(0)
        );
        receiver.receiveAndExecute(message, "");
        assertEq(vault.balanceOf(beneficiary), 90e6);
    }

    function test_executeRejectsMessageCircleHasNotMinted() public {
        bytes memory message = _message(
            keccak256("nonce 4"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            keccak256("intent 4"),
            ERC4626_ID,
            _vaultData(0)
        );
        vm.expectRevert(InletReceiver.MessageNotReceived.selector);
        receiver.execute(message);
    }

    function test_executeRejectsMessagesNotFromTheHub() public {
        bytes memory message = _message(
            keccak256("nonce 5"),
            ARC,
            CctpMessages.toBytes32(address(0xBAD)),
            100e6,
            0,
            keccak256("intent 5"),
            ERC4626_ID,
            _vaultData(0)
        );
        vm.expectRevert(InletReceiver.WrongOrigin.selector);
        receiver.receiveAndExecute(message, "");

        message = _message(
            keccak256("nonce 6"),
            7,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            keccak256("intent 6"),
            ERC4626_ID,
            _vaultData(0)
        );
        vm.expectRevert(InletReceiver.WrongOrigin.selector);
        receiver.receiveAndExecute(message, "");
    }

    function test_executeRejectsDuplicateIntent() public {
        bytes memory message = _message(
            keccak256("nonce 7"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            keccak256("intent 7"),
            ERC4626_ID,
            _vaultData(0)
        );
        receiver.receiveAndExecute(message, "");
        vm.expectRevert(InletReceiver.AlreadyExecuted.selector);
        receiver.execute(message);
    }

    function test_failingAdapterMakesFundsClaimable() public {
        bytes32 intentHash = keccak256("intent 8");
        bytes memory message = _message(
            keccak256("nonce 8"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            intentHash,
            FAILING_ID,
            ""
        );
        receiver.receiveAndExecute(message, "");

        assertEq(receiver.claimable(beneficiary), 100e6);
        assertTrue(receiver.executed(intentHash));
        assertEq(usdc.balanceOf(address(receiver)), 100e6);

        vm.prank(beneficiary);
        receiver.claim(beneficiary);
        assertEq(usdc.balanceOf(beneficiary), 100e6);
        assertEq(receiver.claimable(beneficiary), 0);
    }

    function test_unknownAdapterMakesFundsClaimable() public {
        bytes memory message = _message(
            keccak256("nonce 9"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            keccak256("intent 9"),
            keccak256("missing:v1"),
            ""
        );
        receiver.receiveAndExecute(message, "");
        assertEq(receiver.claimable(beneficiary), 100e6);
    }

    function test_minSharesFailureFallsBackToClaimable() public {
        bytes memory message = _message(
            keccak256("nonce 10"),
            ARC,
            CctpMessages.toBytes32(hub),
            100e6,
            0,
            keccak256("intent 10"),
            ERC4626_ID,
            _vaultData(101e6)
        );
        receiver.receiveAndExecute(message, "");
        assertEq(vault.balanceOf(beneficiary), 0);
        assertEq(receiver.claimable(beneficiary), 100e6);
    }

    function test_claimRevertsWithNothing() public {
        vm.expectRevert(InletReceiver.NothingToClaim.selector);
        receiver.claim(address(this));
    }
}
