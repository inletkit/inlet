import { adapterId, erc4626AdapterData, testnetChains, testnetDeployments } from "@inletkit/sdk";
import type { Address } from "viem";
import type { Destination, SourceChain } from "./types.js";

export const explorers: Record<number, string> = {
  0: "https://sepolia.etherscan.io/tx/",
  3: "https://sepolia.arbiscan.io/tx/",
  6: "https://sepolia.basescan.org/tx/",
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

export const demoVaultDestination = erc4626Destination({
  id: "demo-vault",
  name: "Inlet Demo Vault",
  description: "An ERC 4626 vault over USDC on Arbitrum Sepolia.",
  destinationDomain: 3,
  receiver: testnetDeployments.arbitrumSepolia.inletReceiver as Address,
  vault: testnetDeployments.arbitrumSepolia.demoVault as Address,
});
