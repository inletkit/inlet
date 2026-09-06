import type { IntentRecord, Route } from "@inletkit/sdk";
import type { Address, Hex } from "viem";

export interface Destination {
  id: string;
  name: string;
  description?: string;
  destinationDomain: number;
  receiver: Address;
  adapterId: Hex;
  adapterData: (context: { beneficiary: Address; amount: bigint }) => Hex;
  positionLabel: string;
  explorer: string;
  price?: PriceHint;
}

export interface PriceHint {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  tokenOutSymbol: string;
  tokenOutDecimals: number;
  venue: string;
}

export interface SourceChain {
  domain: number;
  chainId: number;
  name: string;
  usdc: Address;
  tokenMessenger: Address;
  gatewayWallet: Address;
  explorer: string;
}

export type RoutePreference = Route | "auto";

export interface Quote {
  route: Route;
  sendAmount: bigint;
  intentAmount: bigint;
  circleFee: bigint;
  walletUsdc: bigint;
  gatewayAvailable: bigint;
  needsGas: boolean;
}

export type Phase = "idle" | "quoting" | "ready" | "creating" | "signing" | "sending" | "tracking" | "done" | "error";

export interface DepositState {
  phase: Phase;
  quote?: Quote;
  record?: IntentRecord;
  sourceTx?: Hex;
  error?: string;
}
