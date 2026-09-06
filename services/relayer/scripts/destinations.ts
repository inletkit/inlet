import { aaveV3AdapterData, adapterId, demoVaultAbi, erc4626AdapterData, testnetChains, testnetDeployments, testnetProtocols, toBytes32 } from "@inletkit/sdk";
import { createPublicClient, erc20Abi, http, type Address, type Chain, type Hex } from "viem";
import { arbitrumSepolia, baseSepolia, sepolia, unichainSepolia } from "viem/chains";

export interface E2eDestination {
  name: string;
  domain: number;
  chain: Chain;
  receiver: Address;
  adapterId: Hex;
  adapterData: Hex;
  positionLabel: string;
  position(user: Address): Promise<bigint>;
}

const rpc = (key: keyof typeof testnetChains) => (testnetChains[key] as { rpc: string }).rpc;

const arbitrum = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc("arbitrumSepolia")) });

function balanceReader(client: ReturnType<typeof createPublicClient>, token: Address) {
  return (user: Address) => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] });
}

export const destinations: Record<string, E2eDestination> = {
  "demo-vault": {
    name: "Inlet demo vault on Arbitrum Sepolia",
    domain: 3,
    chain: arbitrumSepolia,
    receiver: testnetDeployments.arbitrumSepolia.inletReceiver as Address,
    adapterId: adapterId("erc4626:v1"),
    adapterData: erc4626AdapterData(testnetDeployments.arbitrumSepolia.demoVault as Address, 0n),
    positionLabel: "vault shares",
    position: (user) => arbitrum.readContract({ address: testnetDeployments.arbitrumSepolia.demoVault as Address, abi: demoVaultAbi, functionName: "balanceOf", args: [user] }),
  },
  aave: {
    name: "Aave V3 on Arbitrum Sepolia",
    domain: 3,
    chain: arbitrumSepolia,
    receiver: testnetDeployments.arbitrumSepolia.inletReceiver as Address,
    adapterId: adapterId("aave-v3:v1"),
    adapterData: aaveV3AdapterData(testnetProtocols.arbitrumSepolia.aaveV3Pool as Address, 0n),
    positionLabel: "aArbSepUSDC",
    position: balanceReader(arbitrum, testnetProtocols.arbitrumSepolia.aaveV3AUsdc as Address),
  },
};

export function pickDestination(): E2eDestination {
  const key = process.env.DESTINATION ?? "demo-vault";
  const destination = destinations[key];
  if (!destination) throw new Error(`DESTINATION must be one of ${Object.keys(destinations).join(", ")}`);
  return destination;
}

export const sourceChains: Record<number, { key: keyof typeof testnetChains; chain: Chain }> = {
  6: { key: "baseSepolia", chain: baseSepolia },
  3: { key: "arbitrumSepolia", chain: arbitrumSepolia },
  10: { key: "unichainSepolia", chain: unichainSepolia },
  0: { key: "ethereumSepolia", chain: sepolia },
};

export function pickSource() {
  const domain = Number(process.env.SOURCE ?? 6);
  const source = sourceChains[domain];
  if (!source) throw new Error(`SOURCE must be one of ${Object.keys(sourceChains).join(", ")}`);
  const config = testnetChains[source.key] as { rpc: string; usdc: Address; tokenMessengerV2: Address; gatewayWallet: Address };
  return { domain, chain: source.chain, ...config };
}

export function intentReceiver(destination: E2eDestination) {
  return toBytes32(destination.receiver);
}
