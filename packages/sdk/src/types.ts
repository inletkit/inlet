import type { Address, Hex } from "viem";

export interface DepositIntent {
  owner: Address;
  sourceDomain: number;
  destinationDomain: number;
  adapterId: Hex;
  receiver: Hex;
  beneficiary: Hex;
  adapterData: Hex;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  refundRecipient: Hex;
  feeBps: number;
}

export type Route = "cctp" | "gateway";

export type IntentState =
  | "created"
  | "funded"
  | "swept"
  | "attested"
  | "executed"
  | "claimable"
  | "refunded"
  | "expired"
  | "failed";

export interface IntentRecord {
  hash: Hex;
  state: IntentState;
  route: Route;
  intent: DepositIntent;
  depositAddress: Address;
  sourceTx?: Hex;
  arcMintTx?: Hex;
  sweepTx?: Hex;
  destinationTx?: Hex;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
