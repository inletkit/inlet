import { GATEWAY_EXPIRY_BLOCKS, InletRelayerClient, burnIntentTypedData, createBurnIntent, testnetChains, toBytes32, type DepositIntent } from "@inletkit/sdk";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "../src/config.js";
import { createRelayer } from "../src/relayer.js";
import { pickDestination, pickSource } from "./destinations.js";

const amount = BigInt(process.env.E2E_AMOUNT ?? "1000000");
const config = loadConfig({ ...process.env, DB_PATH: `data/e2e-gateway-${Date.now()}.db`, PORT: "0" });
const user = privateKeyToAccount((process.env.USER_PRIVATE_KEY ?? config.privateKey) as Hex);
const destination = pickDestination();
const source = pickSource();
const publicClient = createPublicClient({ chain: source.chain, transport: http(config.rpc[source.domain] ?? source.rpc) });
const signer = createWalletClient({ account: user, chain: source.chain, transport: http(config.rpc[source.domain] ?? source.rpc) });

const remote = process.env.RELAYER_URL;
const relayer = remote ? { url: remote, stop: async () => {} } : await createRelayer(config).start();
const client = new InletRelayerClient(relayer.url);
console.log(`relayer ${relayer.url}${remote ? " (remote)" : ""}, user ${user.address}, ${source.chain.name} into ${destination.name}`);
const started = Date.now();
const stamp = () => `${Math.round((Date.now() - started) / 1000)}s`;

try {
  const before = await destination.position(user.address);

  const intent: DepositIntent = {
    owner: user.address,
    sourceDomain: source.domain,
    destinationDomain: destination.domain,
    adapterId: destination.adapterId,
    receiver: toBytes32(destination.receiver),
    beneficiary: toBytes32(user.address),
    adapterData: destination.adapterData,
    amount,
    nonce: BigInt(Date.now()),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 2 * 3600),
    refundRecipient: toBytes32(user.address),
    feeBps: 0,
  };
  const record = await client.createIntent(intent, "gateway");
  console.log(`${stamp()} intent ${record.hash} deposit address ${record.depositAddress}`);

  const block = await publicClient.getBlockNumber();
  const burnIntent = createBurnIntent({
    sourceDomain: source.domain,
    destinationDomain: config.hubDomain,
    sourceWallet: source.gatewayWallet,
    destinationMinter: testnetChains.arcTestnet.gatewayMinter as Address,
    sourceToken: source.usdc,
    destinationToken: testnetChains.arcTestnet.usdc as Address,
    depositor: user.address,
    recipient: record.depositAddress,
    value: amount,
    maxBlockHeight: block + GATEWAY_EXPIRY_BLOCKS,
  });
  const signature = await signer.signTypedData(burnIntentTypedData(burnIntent));
  await client.submitGateway(record.hash, { burnIntent, signature });
  console.log(`${stamp()} signed burn intent submitted, max fee ${burnIntent.maxFee}`);

  let last = "";
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const current = await client.getIntent(record.hash);
    const line = `${current.state} ${current.arcMintTx ?? ""} ${current.sweepTx ?? ""} ${current.destinationTx ?? ""} ${current.error ?? ""}`.trim();
    if (line !== last) {
      console.log(`${stamp()} ${line}`);
      last = line;
    }
    if (["executed", "claimable", "refunded", "expired"].includes(current.state)) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const after = await destination.position(user.address);
  console.log(`${stamp()} ${destination.positionLabel} before ${before} after ${after}`);
} finally {
  await relayer.stop();
}
