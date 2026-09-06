import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  pad,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import type { DepositIntent } from "./types.js";

export const STANDARD_FINALITY = 2000;
export const FAST_FINALITY = 1000;

export const intentTypes = {
  DepositIntent: [
    { name: "owner", type: "address" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "adapterId", type: "bytes32" },
    { name: "receiver", type: "bytes32" },
    { name: "beneficiary", type: "bytes32" },
    { name: "adapterData", type: "bytes" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint64" },
    { name: "refundRecipient", type: "bytes32" },
    { name: "feeBps", type: "uint16" },
  ],
} as const;

export function hubDomain(hub: Address, chainId: number) {
  return { name: "Inlet", version: "1", chainId, verifyingContract: hub } as const;
}

export function hashIntent(intent: DepositIntent, hub: Address, chainId: number): Hex {
  return hashTypedData({
    domain: hubDomain(hub, chainId),
    types: intentTypes,
    primaryType: "DepositIntent",
    message: intent,
  });
}

export function adapterId(name: string): Hex {
  return keccak256(stringToBytes(name));
}

export function toBytes32(address: Address): Hex {
  return pad(address, { size: 32 });
}

export function fromBytes32(value: Hex): Address {
  return `0x${value.slice(-40)}` as Address;
}

export function erc4626AdapterData(vault: Address, minShares: bigint = 0n): Hex {
  return encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [vault, minShares]);
}

export function aaveV3AdapterData(pool: Address, minATokens: bigint = 0n): Hex {
  return encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [pool, minATokens]);
}

export function compoundV3AdapterData(comet: Address, minSupplied: bigint = 0n): Hex {
  return encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [comet, minSupplied]);
}

export function serializeIntent(intent: DepositIntent) {
  return {
    ...intent,
    amount: intent.amount.toString(),
    nonce: intent.nonce.toString(),
    deadline: intent.deadline.toString(),
  };
}

export function parseIntent(raw: Record<string, unknown>): DepositIntent {
  return {
    owner: raw.owner as Address,
    sourceDomain: Number(raw.sourceDomain),
    destinationDomain: Number(raw.destinationDomain),
    adapterId: raw.adapterId as Hex,
    receiver: raw.receiver as Hex,
    beneficiary: raw.beneficiary as Hex,
    adapterData: raw.adapterData as Hex,
    amount: BigInt(raw.amount as string),
    nonce: BigInt(raw.nonce as string),
    deadline: BigInt(raw.deadline as string),
    refundRecipient: raw.refundRecipient as Hex,
    feeBps: Number(raw.feeBps),
  };
}
