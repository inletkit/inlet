import { testnetChains } from "@inletkit/sdk";
import { createPublicClient, createWalletClient, http, type Address, type Chain, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { arbitrumSepolia, arcTestnet, baseSepolia } from "viem/chains";
import type { RelayerConfig } from "./config.js";

export interface ChainContext {
  domain: number;
  chain: Chain;
  publicClient: PublicClient;
  walletClient: WalletClient;
  usdc: Address;
  tokenMessenger: Address;
  messageTransmitter: Address;
  gatewayWallet: Address;
  gatewayMinter: Address;
  fixedGas?: bigint;
}

const chainByDomain: Record<number, { chain: Chain; key: keyof typeof testnetChains }> = {
  26: { chain: arcTestnet, key: "arcTestnet" },
  6: { chain: baseSepolia, key: "baseSepolia" },
  3: { chain: arbitrumSepolia, key: "arbitrumSepolia" },
};

export function buildChains(config: RelayerConfig): { account: PrivateKeyAccount; byDomain: Record<number, ChainContext> } {
  const account = privateKeyToAccount(config.privateKey);
  const byDomain: Record<number, ChainContext> = {};
  for (const [domainText, entry] of Object.entries(chainByDomain)) {
    const domain = Number(domainText);
    const addresses = testnetChains[entry.key] as { usdc: Address; tokenMessengerV2: Address; messageTransmitterV2: Address; gatewayWallet: Address; gatewayMinter: Address };
    const transport = http(config.rpc[domain]);
    byDomain[domain] = {
      domain,
      chain: entry.chain,
      publicClient: createPublicClient({ chain: entry.chain, transport }),
      walletClient: createWalletClient({ account, chain: entry.chain, transport }),
      usdc: addresses.usdc,
      tokenMessenger: addresses.tokenMessengerV2,
      messageTransmitter: addresses.messageTransmitterV2,
      gatewayWallet: addresses.gatewayWallet,
      gatewayMinter: addresses.gatewayMinter,
      fixedGas: domain === 26 ? 1_500_000n : undefined,
    };
  }
  return { account, byDomain };
}
