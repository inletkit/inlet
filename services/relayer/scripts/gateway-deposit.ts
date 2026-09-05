import { gatewayWalletAbi, testnetChains } from "@inletkit/sdk";
import { createPublicClient, createWalletClient, erc20Abi, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { loadConfig } from "../src/config.js";

const config = loadConfig();
const user = privateKeyToAccount((process.env.USER_PRIVATE_KEY ?? config.privateKey) as Hex);
const amount = BigInt(process.env.GATEWAY_DEPOSIT ?? "5000000");
const usdc = testnetChains.baseSepolia.usdc as Address;
const wallet = testnetChains.baseSepolia.gatewayWallet as Address;
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(config.rpc[6]) });
const walletClient = createWalletClient({ account: user, chain: baseSepolia, transport: http(config.rpc[6]) });

async function balances() {
  const response = await fetch(`${testnetChains.circle.gatewayApi}/v1/balances`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources: [{ domain: 6, depositor: user.address }] }),
  });
  return response.json();
}

console.log("gateway balance before", JSON.stringify(await balances()));

if (process.env.SKIP_DEPOSIT !== "1") {
  const approve = await walletClient.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [wallet, amount] });
  await publicClient.waitForTransactionReceipt({ hash: approve });
  for (let attempt = 0; attempt < 30; attempt++) {
    const allowance = await publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [user.address, wallet] });
    if (allowance >= amount) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const deposit = await walletClient.writeContract({ address: wallet, abi: gatewayWalletAbi, functionName: "deposit", args: [usdc, amount], gas: 250_000n });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deposit });
  console.log(`deposited ${amount} into the Gateway wallet on Base Sepolia in ${deposit} (${receipt.status})`);
}

const started = Date.now();
while (Date.now() - started < 30 * 60 * 1000) {
  const body = await balances();
  console.log(`${Math.round((Date.now() - started) / 1000)}s`, JSON.stringify(body));
  const available = (body.balances ?? []).reduce((sum: bigint, entry: { balance?: string }) => sum + BigInt(Math.floor(Number(entry.balance ?? "0") * 1_000_000)), 0n);
  if (available >= amount) break;
  await new Promise((resolve) => setTimeout(resolve, 60_000));
}
