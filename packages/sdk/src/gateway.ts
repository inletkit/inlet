import { toHex, type Address, type Hex } from "viem";
import { toBytes32 } from "./intent.js";

export const gatewayDomain = { name: "GatewayWallet", version: "1" } as const;

export const gatewayTypes = {
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
} as const;

export interface TransferSpec {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: Hex;
  destinationContract: Hex;
  sourceToken: Hex;
  destinationToken: Hex;
  sourceDepositor: Hex;
  destinationRecipient: Hex;
  sourceSigner: Hex;
  destinationCaller: Hex;
  value: bigint;
  salt: Hex;
  hookData: Hex;
}

export interface BurnIntent {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: TransferSpec;
}

export interface SignedBurnIntent {
  burnIntent: BurnIntent;
  signature: Hex;
}

export interface GatewayAttestation {
  attestation: Hex;
  signature: Hex;
  transferId?: string;
}

const gatewayGasFee: Record<number, bigint> = {
  0: 1_000_000n,
  1: 20_000n,
  2: 1_500n,
  3: 10_000n,
  6: 10_000n,
  7: 1_500n,
  10: 1_000n,
  13: 10_000n,
  14: 10_000n,
  16: 1_000n,
  19: 50_000n,
  26: 10_000n,
};

export function gatewayMaxFee(sourceDomain: number, value: bigint): bigint {
  const transferFee = (value * 5n) / 100_000n + 1n;
  return transferFee + (gatewayGasFee[sourceDomain] ?? 20_000n) * 2n;
}

export function randomSalt(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function createBurnIntent(params: {
  sourceDomain: number;
  destinationDomain: number;
  sourceWallet: Address;
  destinationMinter: Address;
  sourceToken: Address;
  destinationToken: Address;
  depositor: Address;
  recipient: Address;
  value: bigint;
  maxFee?: bigint;
  maxBlockHeight: bigint;
  destinationCaller?: Address;
  salt?: Hex;
}): BurnIntent {
  return {
    maxBlockHeight: params.maxBlockHeight,
    maxFee: params.maxFee ?? gatewayMaxFee(params.sourceDomain, params.value),
    spec: {
      version: 1,
      sourceDomain: params.sourceDomain,
      destinationDomain: params.destinationDomain,
      sourceContract: toBytes32(params.sourceWallet),
      destinationContract: toBytes32(params.destinationMinter),
      sourceToken: toBytes32(params.sourceToken),
      destinationToken: toBytes32(params.destinationToken),
      sourceDepositor: toBytes32(params.depositor),
      destinationRecipient: toBytes32(params.recipient),
      sourceSigner: toBytes32(params.depositor),
      destinationCaller: toBytes32(params.destinationCaller ?? "0x0000000000000000000000000000000000000000"),
      value: params.value,
      salt: params.salt ?? randomSalt(),
      hookData: "0x",
    },
  };
}

export function burnIntentTypedData(burnIntent: BurnIntent) {
  return {
    domain: gatewayDomain,
    types: gatewayTypes,
    primaryType: "BurnIntent" as const,
    message: burnIntent,
  };
}

export function serializeBurnIntent(burnIntent: BurnIntent) {
  return {
    maxBlockHeight: burnIntent.maxBlockHeight.toString(),
    maxFee: burnIntent.maxFee.toString(),
    spec: { ...burnIntent.spec, value: burnIntent.spec.value.toString() },
  };
}

export function parseBurnIntent(raw: Record<string, unknown>): BurnIntent {
  const spec = raw.spec as Record<string, unknown>;
  return {
    maxBlockHeight: BigInt(raw.maxBlockHeight as string),
    maxFee: BigInt(raw.maxFee as string),
    spec: { ...(spec as unknown as TransferSpec), version: Number(spec.version), sourceDomain: Number(spec.sourceDomain), destinationDomain: Number(spec.destinationDomain), value: BigInt(spec.value as string) },
  };
}

export interface GatewayBalance {
  domain: number;
  depositor: Hex;
  balance: string;
}

export class GatewayClient {
  constructor(private readonly baseUrl: string) {}

  async balances(depositor: Address, domains: number[]): Promise<GatewayBalance[]> {
    const response = await fetch(`${this.baseUrl}/v1/balances`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "USDC", sources: domains.map((domain) => ({ domain, depositor })) }),
    });
    if (!response.ok) throw new Error(`Gateway ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { balances?: GatewayBalance[] };
    return body.balances ?? [];
  }

  async transfer(requests: SignedBurnIntent[]): Promise<GatewayAttestation> {
    const response = await fetch(`${this.baseUrl}/v1/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requests.map((request) => ({ burnIntent: serializeBurnIntent(request.burnIntent), signature: request.signature }))),
    });
    if (!response.ok) throw new Error(`Gateway ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as GatewayAttestation;
    if (!body.attestation || !body.signature) throw new Error(`Gateway returned no attestation: ${JSON.stringify(body)}`);
    return body;
  }
}
