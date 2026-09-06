import { aaveV3AdapterData, adapterId, compoundV3AdapterData, erc4626AdapterData, fromBytes32, testnetChains, testnetDeployments, testnetProtocols, type IntentRecord } from "@inletkit/sdk";
import type { Address } from "viem";
import type { Destination, SourceChain } from "./types.js";

export const explorers: Record<number, string> = {
  0: "https://sepolia.etherscan.io/tx/",
  3: "https://sepolia.arbiscan.io/tx/",
  6: "https://sepolia.basescan.org/tx/",
  10: "https://sepolia.uniscan.xyz/tx/",
  26: "https://testnet.arcscan.app/tx/",
  27: "https://stellar.expert/explorer/testnet/tx/",
};

export const irisApi = testnetChains.circle.irisApi;
export const gatewayApi = testnetChains.circle.gatewayApi;
export const hubDomain = 26;
export const arcGatewayMinter = testnetChains.arcTestnet.gatewayMinter as Address;
export const arcUsdc = testnetChains.arcTestnet.usdc as Address;

export const defaultSources: SourceChain[] = [
  {
    domain: 6,
    chainId: testnetChains.baseSepolia.chainId,
    name: "Base Sepolia",
    usdc: testnetChains.baseSepolia.usdc as Address,
    tokenMessenger: testnetChains.baseSepolia.tokenMessengerV2 as Address,
    gatewayWallet: testnetChains.baseSepolia.gatewayWallet as Address,
    explorer: explorers[6],
  },
  {
    domain: 3,
    chainId: testnetChains.arbitrumSepolia.chainId,
    name: "Arbitrum Sepolia",
    usdc: testnetChains.arbitrumSepolia.usdc as Address,
    tokenMessenger: testnetChains.arbitrumSepolia.tokenMessengerV2 as Address,
    gatewayWallet: testnetChains.arbitrumSepolia.gatewayWallet as Address,
    explorer: explorers[3],
  },
];

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

export const demoVaultDestination = erc4626Destination({
  id: "demo-vault",
  name: "Inlet Demo Vault",
  description: "An ERC 4626 vault over USDC on Arbitrum Sepolia.",
  destinationDomain: 3,
  receiver: testnetDeployments.arbitrumSepolia.inletReceiver as Address,
  vault: testnetDeployments.arbitrumSepolia.demoVault as Address,
});

export const aaveArbitrumSepoliaDestination = aaveV3Destination({
  id: "aave-v3-arbitrum-sepolia",
  name: "Aave V3 on Arbitrum Sepolia",
  description: "Supplies USDC to Aave's Arbitrum Sepolia market. You receive aArbSepUSDC.",
  destinationDomain: 3,
  receiver: testnetDeployments.arbitrumSepolia.inletReceiver as Address,
  pool: testnetProtocols.arbitrumSepolia.aaveV3Pool as Address,
  positionLabel: "aArbSepUSDC",
});

export const compoundBaseSepoliaDestination = compoundV3Destination({
  id: "compound-v3-base-sepolia",
  name: "Compound III on Base Sepolia",
  description: "Supplies USDC to Compound's Base Sepolia USDC market, credited to your account.",
  destinationDomain: 6,
  receiver: testnetDeployments.baseSepolia.inletReceiver as Address,
  comet: testnetProtocols.baseSepolia.compoundV3Comet as Address,
  positionLabel: "Compound USDC balance",
});

export const morphoBaseSepoliaDestination = erc4626Destination({
  id: "morpho-oneshot-base-sepolia",
  name: "Morpho Oneshot Vault on Base Sepolia",
  description: "Deposits into the Oneshot MetaMorpho vault over USDC. You receive vUSDC shares.",
  destinationDomain: 6,
  receiver: testnetDeployments.baseSepolia.inletReceiver as Address,
  vault: testnetProtocols.baseSepolia.morphoOneshotVault as Address,
  positionLabel: "vUSDC shares",
});

export const testnetDestinations: Destination[] = [aaveArbitrumSepoliaDestination, compoundBaseSepoliaDestination, morphoBaseSepoliaDestination, demoVaultDestination];

export function findDestination(record: Pick<IntentRecord, "intent">, candidates: Destination[] = testnetDestinations): Destination | undefined {
  const sameRoute = candidates.filter(
    (entry) => entry.destinationDomain === record.intent.destinationDomain && entry.adapterId.toLowerCase() === record.intent.adapterId.toLowerCase(),
  );
  const beneficiary = fromBytes32(record.intent.beneficiary);
  const amount = record.intent.amount;
  return sameRoute.find((entry) => entry.adapterData({ beneficiary, amount }).toLowerCase() === record.intent.adapterData.toLowerCase()) ?? sameRoute[0];
}
