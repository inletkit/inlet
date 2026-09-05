import { hashIntent, inletHubAbi, parseIntent } from "@inletkit/sdk";
import { readFileSync } from "node:fs";
import { createPublicClient, erc20Abi, http } from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { testnetChains } from "@inletkit/sdk";
import { loadConfig } from "../src/config.js";
import { createRelayer } from "../src/relayer.js";

const config = loadConfig({ ...process.env, DB_PATH: `data/refund-${Date.now()}.db`, PORT: "0" });
const intent = parseIntent(JSON.parse(readFileSync(process.env.INTENT_FILE ?? "data/stuck-intent.json", "utf8")));
const arc = createPublicClient({ chain: arcTestnet, transport: http(config.rpc[26]) });
const base = createPublicClient({ chain: baseSepolia, transport: http(config.rpc[6]) });
const hash = hashIntent(intent, config.hub, arcTestnet.id);
const depositAddress = await arc.readContract({ address: config.hub, abi: inletHubAbi, functionName: "depositAddress", args: [hash] });
const usdc = testnetChains.baseSepolia.usdc as `0x${string}`;

console.log(`intent ${hash} deposit address ${depositAddress} deadline ${intent.deadline} now ${Math.floor(Date.now() / 1000)}`);
console.log(`arc balance at deposit address ${await arc.readContract({ address: testnetChains.arcTestnet.usdc as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [depositAddress] })}`);
const baseBefore = await base.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [intent.owner] });

const relayer = createRelayer(config);
relayer.store.insert(hash, intent, "cctp", depositAddress, Number(await arc.getBlockNumber()) - 20_000);
const running = await relayer.start();
const started = Date.now();
let last = "";
try {
  while (Date.now() - started < 15 * 60 * 1000) {
    const record = relayer.store.get(hash)!;
    const line = `${record.state} ${record.refundTx ?? ""} ${record.refundMintTx ?? ""} ${record.error ?? ""}`.trim();
    if (line !== last) {
      console.log(`${Math.round((Date.now() - started) / 1000)}s ${line}`);
      last = line;
    }
    if (["refunded", "expired", "executed"].includes(record.state)) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
} finally {
  await running.stop();
}
const baseAfter = await base.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [intent.owner] });
console.log(`base sepolia usdc before ${baseBefore} after ${baseAfter}`);
