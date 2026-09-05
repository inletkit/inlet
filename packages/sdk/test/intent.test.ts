import { createPublicClient, http, keccak256, stringToBytes, type Address } from "viem";
import { arbitrumSepolia, arcTestnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import {
  adapterId,
  erc4626AdapterData,
  fromBytes32,
  hashIntent,
  inletHubAbi,
  inletReceiverAbi,
  testnetDeployments,
  toBytes32,
  type DepositIntent,
} from "../src/index.js";

const hub = testnetDeployments.arcTestnet.inletHub as Address;
const receiver = testnetDeployments.arbitrumSepolia.inletReceiver as Address;
const vault = testnetDeployments.arbitrumSepolia.demoVault as Address;

const intent: DepositIntent = {
  owner: "0x31b1610Ec633Ed09Ce15dfDf697DD631daa3Bd02",
  sourceDomain: 6,
  destinationDomain: 3,
  adapterId: adapterId("erc4626:v1"),
  receiver: toBytes32(receiver),
  beneficiary: toBytes32("0x31b1610Ec633Ed09Ce15dfDf697DD631daa3Bd02"),
  adapterData: erc4626AdapterData(vault, 0n),
  amount: 1_000_000n,
  nonce: 42n,
  deadline: 1_800_000_000n,
  refundRecipient: toBytes32("0x31b1610Ec633Ed09Ce15dfDf697DD631daa3Bd02"),
  feeBps: 0,
};

describe("intent helpers", () => {
  it("round trips addresses through bytes32", () => {
    const address: Address = "0x912c690f95a381e72F63a378fd906C6294412Fc9";
    expect(fromBytes32(toBytes32(address)).toLowerCase()).toBe(address.toLowerCase());
  });

  it("derives adapter ids the way the contracts do", () => {
    expect(adapterId("erc4626:v1")).toBe(keccak256(stringToBytes("erc4626:v1")));
  });
});

describe("parity with the deployed contracts", () => {
  it("hashes an intent exactly like the hub on Arc testnet", async () => {
    const client = createPublicClient({ chain: arcTestnet, transport: http("https://rpc.testnet.arc.io") });
    const onChain = await client.readContract({ address: hub, abi: inletHubAbi, functionName: "hashIntent", args: [intent] });
    expect(hashIntent(intent, hub, arcTestnet.id)).toBe(onChain);
  }, 30_000);

  it("uses the adapter id the receiver has registered", async () => {
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });
    const adapter = await client.readContract({ address: receiver, abi: inletReceiverAbi, functionName: "adapters", args: [adapterId("erc4626:v1")] });
    expect(adapter.toLowerCase()).toBe(testnetDeployments.arbitrumSepolia.erc4626Adapter.toLowerCase());
  }, 30_000);
});
