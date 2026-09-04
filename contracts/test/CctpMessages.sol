// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Builds CCTP V2 messages with the layout documented by Circle, for tests.
library CctpMessages {
    function header(
        uint32 sourceDomain,
        uint32 destinationDomain,
        bytes32 nonce,
        bytes32 sender,
        bytes32 recipient,
        bytes32 destinationCaller,
        bytes memory body
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint32(1),
            sourceDomain,
            destinationDomain,
            nonce,
            sender,
            recipient,
            destinationCaller,
            uint32(2000),
            uint32(2000),
            body
        );
    }

    function burnBody(
        bytes32 burnToken,
        bytes32 mintRecipient,
        uint256 amount,
        bytes32 messageSender,
        uint256 maxFee,
        uint256 feeExecuted,
        bytes memory hookData
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint32(1),
            burnToken,
            mintRecipient,
            amount,
            messageSender,
            maxFee,
            feeExecuted,
            uint256(0),
            hookData
        );
    }

    function toBytes32(address account) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }
}
