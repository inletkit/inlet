// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice One deposit from a source chain into a position on a destination chain.
struct DepositIntent {
    address owner;
    uint32 sourceDomain;
    uint32 destinationDomain;
    bytes32 adapterId;
    bytes32 receiver;
    bytes32 beneficiary;
    bytes adapterData;
    uint256 amount;
    uint256 nonce;
    uint64 deadline;
    bytes32 refundRecipient;
    uint16 feeBps;
}

library InletTypes {
    bytes32 internal constant INTENT_TYPEHASH = keccak256(
        "DepositIntent(address owner,uint32 sourceDomain,uint32 destinationDomain,bytes32 adapterId,bytes32 receiver,bytes32 beneficiary,bytes adapterData,uint256 amount,uint256 nonce,uint64 deadline,bytes32 refundRecipient,uint16 feeBps)"
    );

    bytes32 internal constant HOOK_TAG = keccak256("inlet/v1");

    uint32 internal constant STANDARD_FINALITY = 2000;

    function structHash(DepositIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.owner,
                intent.sourceDomain,
                intent.destinationDomain,
                intent.adapterId,
                intent.receiver,
                intent.beneficiary,
                keccak256(intent.adapterData),
                intent.amount,
                intent.nonce,
                intent.deadline,
                intent.refundRecipient,
                intent.feeBps
            )
        );
    }

    function encodeHookPayload(
        bytes32 intentHash,
        bytes32 adapterId,
        bytes32 beneficiary,
        bytes memory adapterData
    ) internal pure returns (bytes memory) {
        return abi.encode(HOOK_TAG, intentHash, adapterId, beneficiary, adapterData);
    }

    /// @notice Circle's CctpForwarder frame: 24 reserved bytes, version, recipient length, recipient, payload.
    function encodeStellarHook(bytes memory forwardRecipientStrkey, bytes memory payload)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            bytes24(0),
            uint32(0),
            uint32(forwardRecipientStrkey.length),
            forwardRecipientStrkey,
            payload
        );
    }
}
