import {
  GATEWAY_EXPIRY_BLOCKS,
  InletRelayerClient,
  adapterId,
  burnIntentTypedData,
  createBurnIntent,
  demoVaultAbi,
  erc4626AdapterData,
  testnetChains,
  testnetDeployments,
  toBytes32,
  type DepositIntent,
} from "@inletkit/sdk";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, baseSepolia } from "viem/chains";
import { loadConfig } from "../src/config.js";
import { createRelayer } from "../src/relayer.js";

const amount = BigInt(process.env.E2E_AMOUNT ?? "1000000");
const config = loadConfig({ ...process.env, DB_PATH: `data/e2e-gateway-${Date.now()}.db`, PORT: "0" });
const user = privateKeyToAccount((process.env.USER_PRIVATE_KEY ?? config.privateKey) as Hex);
const receiver = testnetDeployments.arbitrumSepolia.inletReceiver as Address;
const vault = testnetDeployments.arbitrumSepolia.demoVault as Address;
const base = createPublicClient({ chain: baseSepolia, transport: http(config.rpc[6]) });
const signer = createWalletClient({ account: user, chain: baseSepolia, transport: http(config.rpc[6]) });
const arbitrum = createPublicClient({ chain: arbitrumSepolia, transport: http(config.rpc[3]) });

const relayer = await createRelayer(config).start();
const client = new InletRelayerClient(relayer.url);
const started = Date.now();
const stamp = () => `${Math.round((Date.now() - started) / 1000)}s`;

try {
  const sharesBefore = await arbitrum.readContract({ address: vault, abi: demoVaultAbi, functionName: "balanceOf", args: [user.address] });

  const intent: DepositIntent = {
    owner: user.address,
    sourceDomain: 6,
    destinationDomain: 3,
    adapterId: adapterId("erc4626:v1"),
    receiver: toBytes32(receiver),
    beneficiary: toBytes32(user.address),
    adapterData: erc4626AdapterData(vault, 0n),
    amount,
    nonce: BigInt(Date.now()),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 2 * 3600),
    refundRecipient: toBytes32(user.address),
    feeBps: 0,
  };
  const record = await client.createIntent(intent, "gateway");
  console.log(`${stamp()} intent ${record.hash} deposit address ${record.depositAddress}`);

  const block = await base.getBlockNumber();
  const burnIntent = createBurnIntent({
    sourceDomain: 6,
    destinationDomain: 26,
    sourceWallet: testnetChains.baseSepolia.gatewayWallet as Address,
    destinationMinter: testnetChains.arcTestnet.gatewayMinter as Address,
    sourceToken: testnetChains.baseSepolia.usdc as Address,
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

  const sharesAfter = await arbitrum.readContract({ address: vault, abi: demoVaultAbi, functionName: "balanceOf", args: [user.address] });
  console.log(`${stamp()} vault shares before ${sharesBefore} after ${sharesAfter}`);
} finally {
  await relayer.stop();
}
