import { testnetChains, testnetDeployments } from "@inletkit/sdk";
import type { Address, Hex } from "viem";

export interface RelayerConfig {
  privateKey: Hex;
  port: number;
  dbPath: string;
  pollIntervalMs: number;
  irisApi: string;
  gatewayApi: string;
  rpc: Record<number, string>;
  hub: Address;
  hubDomain: number;
  receivers: Record<number, Address>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayerConfig {
  const privateKey = (env.RELAYER_PRIVATE_KEY ?? env.PRIVATE_KEY) as Hex | undefined;
  if (!privateKey) throw new Error("RELAYER_PRIVATE_KEY is not set");
  return {
    privateKey,
    port: Number(env.PORT ?? 8787),
    dbPath: env.DB_PATH ?? "data/inlet.db",
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 3000),
    irisApi: env.IRIS_API ?? testnetChains.circle.irisApi,
    gatewayApi: env.GATEWAY_API ?? testnetChains.circle.gatewayApi,
    rpc: {
      26: env.ARC_RPC ?? testnetChains.arcTestnet.rpc,
      6: env.BASE_SEPOLIA_RPC ?? testnetChains.baseSepolia.rpc,
      3: env.ARBITRUM_SEPOLIA_RPC ?? testnetChains.arbitrumSepolia.rpc,
    },
    hub: testnetDeployments.arcTestnet.inletHub as Address,
    hubDomain: 26,
    receivers: { 3: testnetDeployments.arbitrumSepolia.inletReceiver as Address },
  };
}
