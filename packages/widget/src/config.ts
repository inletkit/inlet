import {
  aaveV3AdapterData,
  adapterId,
  compoundV3AdapterData,
  erc4626AdapterData,
  explorers as sdkExplorers,
  fromBytes32,
  testnetChains,
  testnetDestinations as catalog,
  testnetSources,
  uniswapV4LpAdapterData,
  type DestinationSpec,
  type IntentRecord,
  type PoolKey,
} from "@inletkit/sdk";
import type { Address } from "viem";
import type { Destination, PriceHint, SourceChain } from "./types.js";

export const explorers = sdkExplorers;

export const irisApi = testnetChains.circle.irisApi;
export const gatewayApi = testnetChains.circle.gatewayApi;
export const hubDomain = 26;
export const arcGatewayMinter = testnetChains.arcTestnet.gatewayMinter as Address;
export const arcUsdc = testnetChains.arcTestnet.usdc as Address;

export const defaultSources: SourceChain[] = testnetSources.filter((entry) => entry.domain === 6 || entry.domain === 3);

export function erc4626Destination(params: {
  id: string;
  name: string;
  description?: string;
  destinationDomain: number;
  receiver: Address;
  vault: Address;
  positionLabel?: string;
}): Destination {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    destinationDomain: params.destinationDomain,
    receiver: params.receiver,
    adapterId: adapterId("erc4626:v1"),
    adapterData: () => erc4626AdapterData(params.vault, 0n),
    positionLabel: params.positionLabel ?? "vault shares",
    explorer: explorers[params.destinationDomain] ?? "",
  };
}

export function aaveV3Destination(params: {
  id: string;
  name: string;
  description?: string;
  destinationDomain: number;
  receiver: Address;
  pool: Address;
  positionLabel?: string;
}): Destination {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    destinationDomain: params.destinationDomain,
    receiver: params.receiver,
    adapterId: adapterId("aave-v3:v1"),
    adapterData: () => aaveV3AdapterData(params.pool, 0n),
    positionLabel: params.positionLabel ?? "aTokens",
    explorer: explorers[params.destinationDomain] ?? "",
  };
}

export function compoundV3Destination(params: {
  id: string;
  name: string;
  description?: string;
  destinationDomain: number;
  receiver: Address;
  comet: Address;
  positionLabel?: string;
}): Destination {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    destinationDomain: params.destinationDomain,
    receiver: params.receiver,
    adapterId: adapterId("compound-v3:v1"),
    adapterData: () => compoundV3AdapterData(params.comet, 0n),
    positionLabel: params.positionLabel ?? "supply balance",
    explorer: explorers[params.destinationDomain] ?? "",
  };
}

export function uniswapV4LpDestination(params: {
  id: string;
  name: string;
  description?: string;
  destinationDomain: number;
  receiver: Address;
  pool: PoolKey;
  rangeTicks?: number;
  positionLabel?: string;
  price?: PriceHint;
}): Destination {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    destinationDomain: params.destinationDomain,
    receiver: params.receiver,
    adapterId: adapterId("uniswap-v4-lp:v1"),
    adapterData: () => uniswapV4LpAdapterData(params.pool, params.rangeTicks ?? 1200, 1n),
    positionLabel: params.positionLabel ?? "liquidity position",
    explorer: explorers[params.destinationDomain] ?? "",
    price: params.price,
  };
}

const uniswapPrice: PriceHint = {
  chainId: testnetChains.unichainSepolia.chainId,
  tokenIn: testnetChains.unichainSepolia.usdc as Address,
  tokenOut: "0x0000000000000000000000000000000000000000",
  tokenOutSymbol: "ETH",
  tokenOutDecimals: 18,
  venue: "Uniswap Trading API",
};

export function fromSpec(spec: DestinationSpec): Destination {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    destinationDomain: spec.destinationDomain,
    receiver: spec.receiver,
    adapterId: spec.adapterId,
    adapterData: () => spec.adapterData,
    positionLabel: spec.positionLabel,
    explorer: spec.explorer,
    price: spec.adapterName === "uniswap-v4-lp:v1" ? uniswapPrice : undefined,
  };
}

export const testnetDestinations: Destination[] = catalog.map(fromSpec);

const preset = (id: string) => testnetDestinations.find((entry) => entry.id === id)!;
export const aaveArbitrumSepoliaDestination = preset("aave-v3-arbitrum-sepolia");
export const compoundBaseSepoliaDestination = preset("compound-v3-base-sepolia");
export const morphoBaseSepoliaDestination = preset("morpho-oneshot-base-sepolia");
export const uniswapUnichainSepoliaDestination = preset("uniswap-v4-eth-usdc-unichain-sepolia");
export const demoVaultDestination = preset("demo-vault");

export function findDestination(record: Pick<IntentRecord, "intent">, candidates: Destination[] = testnetDestinations): Destination | undefined {
  const sameRoute = candidates.filter(
    (entry) => entry.destinationDomain === record.intent.destinationDomain && entry.adapterId.toLowerCase() === record.intent.adapterId.toLowerCase(),
  );
  const beneficiary = fromBytes32(record.intent.beneficiary);
  const amount = record.intent.amount;
  return sameRoute.find((entry) => entry.adapterData({ beneficiary, amount }).toLowerCase() === record.intent.adapterData.toLowerCase()) ?? sameRoute[0];
}
