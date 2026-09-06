import { InletRelayerClient, IrisClient, toBytes32, tokenMessengerV2Abi, type DepositIntent } from "@inletkit/sdk";
import { createPublicClient, createWalletClient, erc20Abi, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "../src/config.js";
import { createRelayer } from "../src/relayer.js";
import { pickDestination, pickSource } from "./destinations.js";

const burnAmount = BigInt(process.env.E2E_AMOUNT ?? "1000000");
const config = loadConfig({ ...process.env, DB_PATH: `data/e2e-${Date.now()}.db`, PORT: "0" });
const user = privateKeyToAccount((process.env.USER_PRIVATE_KEY ?? config.privateKey) as Hex);
const destination = pickDestination();
const source = pickSource();

const publicClient = createPublicClient({ chain: source.chain, transport: http(config.rpc[source.domain] ?? source.rpc) });
const walletClient = createWalletClient({ account: user, chain: source.chain, transport: http(config.rpc[source.domain] ?? source.rpc) });
const iris = new IrisClient(config.irisApi);

const remote = process.env.RELAYER_URL;
const relayer = remote ? { url: remote, stop: async () => {} } : await createRelayer(config).start();
const client = new InletRelayerClient(relayer.url);
console.log(`relayer ${relayer.url}${remote ? " (remote)" : ""}, user ${user.address}, ${source.chain.name} into ${destination.name}`);
const started = Date.now();
const stamp = () => `${Math.round((Date.now() - started) / 1000)}s`;

try {
  const before = await destination.position(user.address);

  const maxFee = await iris.fastTransferMaxFee(source.domain, config.hubDomain, burnAmount);
  const amount = burnAmount - maxFee;

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

  const record = await client.createIntent(intent, "cctp");
  console.log(`${stamp()} intent ${record.hash} deposit address ${record.depositAddress}`);

  const allowance = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [user.address, source.tokenMessengerV2] });
  if (allowance < burnAmount) {
    const approve = await walletClient.writeContract({ address: source.usdc, abi: erc20Abi, functionName: "approve", args: [source.tokenMessengerV2, burnAmount] });
    await publicClient.waitForTransactionReceipt({ hash: approve });
    for (let attempt = 0; attempt < 30; attempt++) {
      const visible = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [user.address, source.tokenMessengerV2] });
      if (visible >= burnAmount) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const burn = await walletClient.writeContract({
    address: source.tokenMessengerV2,
    abi: tokenMessengerV2Abi,
    functionName: "depositForBurn",
    args: [burnAmount, config.hubDomain, toBytes32(record.depositAddress), source.usdc, toBytes32("0x0000000000000000000000000000000000000000"), maxFee, 1000],
    gas: 350_000n,
  });
  await publicClient.waitForTransactionReceipt({ hash: burn });
  console.log(`${stamp()} burned ${burnAmount} on ${source.chain.name} in ${burn}, max fee ${maxFee}, intent amount ${amount}`);
  await client.reportSourceTransaction(record.hash, burn);

  let last = "";
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    const current = await client.getIntent(record.hash);
    const line = `${current.state} ${current.arcMintTx ?? ""} ${current.sweepTx ?? ""} ${current.destinationTx ?? ""} ${current.error ?? ""}`.trim();
    if (line !== last) {
      console.log(`${stamp()} ${line}`);
      last = line;
    }
    if (["executed", "claimable", "refunded", "expired"].includes(current.state)) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  let after = await destination.position(user.address);
  for (let attempt = 0; attempt < 10 && after === before; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    after = await destination.position(user.address);
  }
  console.log(`${stamp()} ${destination.positionLabel} before ${before} after ${after}`);
} finally {
  await relayer.stop();
}
