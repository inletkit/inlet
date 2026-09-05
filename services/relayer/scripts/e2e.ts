import {
  InletRelayerClient,
  IrisClient,
  adapterId,
  demoVaultAbi,
  erc4626AdapterData,
  testnetChains,
  testnetDeployments,
  toBytes32,
  tokenMessengerV2Abi,
  type DepositIntent,
} from "@inletkit/sdk";
import { createPublicClient, createWalletClient, erc20Abi, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, baseSepolia } from "viem/chains";
import { loadConfig } from "../src/config.js";
import { createRelayer } from "../src/relayer.js";

const burnAmount = BigInt(process.env.E2E_AMOUNT ?? "1000000");
const config = loadConfig({ ...process.env, DB_PATH: `data/e2e-${Date.now()}.db`, PORT: "0" });
const user = privateKeyToAccount((process.env.USER_PRIVATE_KEY ?? config.privateKey) as Hex);
const receiver = testnetDeployments.arbitrumSepolia.inletReceiver as Address;
const vault = testnetDeployments.arbitrumSepolia.demoVault as Address;

const base = {
  publicClient: createPublicClient({ chain: baseSepolia, transport: http(config.rpc[6]) }),
  walletClient: createWalletClient({ account: user, chain: baseSepolia, transport: http(config.rpc[6]) }),
};
const arbitrum = createPublicClient({ chain: arbitrumSepolia, transport: http(config.rpc[3]) });
const iris = new IrisClient(config.irisApi);

const relayer = await createRelayer(config).start();
const client = new InletRelayerClient(relayer.url);
const started = Date.now();
const stamp = () => `${Math.round((Date.now() - started) / 1000)}s`;

try {
  const sharesBefore = await arbitrum.readContract({ address: vault, abi: demoVaultAbi, functionName: "balanceOf", args: [user.address] });

  const maxFee = await iris.fastTransferMaxFee(6, 26, burnAmount);
  const amount = burnAmount - maxFee;

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

  const record = await client.createIntent(intent, "cctp");
  console.log(`${stamp()} intent ${record.hash} deposit address ${record.depositAddress}`);

  const usdc = testnetChains.baseSepolia.usdc as Address;
  const messenger = testnetChains.baseSepolia.tokenMessengerV2 as Address;
  const approve = await base.walletClient.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [messenger, burnAmount] });
  await base.publicClient.waitForTransactionReceipt({ hash: approve });
  for (let attempt = 0; attempt < 30; attempt++) {
    const allowance = await base.publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [user.address, messenger] });
    if (allowance >= burnAmount) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const burn = await base.walletClient.writeContract({
    address: messenger,
    abi: tokenMessengerV2Abi,
    functionName: "depositForBurn",
    args: [burnAmount, 26, toBytes32(record.depositAddress), usdc, toBytes32("0x0000000000000000000000000000000000000000"), maxFee, 1000],
    gas: 350_000n,
  });
  await base.publicClient.waitForTransactionReceipt({ hash: burn });
  console.log(`${stamp()} burned ${burnAmount} on Base Sepolia in ${burn}, max fee ${maxFee}, intent amount ${amount}`);
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

  const sharesAfter = await arbitrum.readContract({ address: vault, abi: demoVaultAbi, functionName: "balanceOf", args: [user.address] });
  console.log(`${stamp()} vault shares before ${sharesBefore} after ${sharesAfter}`);
} finally {
  await relayer.stop();
}
