import {
  GATEWAY_EXPIRY_BLOCKS,
  GatewayClient,
  InletRelayerClient,
  IrisClient,
  burnIntentTypedData,
  createBurnIntent,
  gatewayMaxFee,
  gatewayWalletAbi,
  toBytes32,
  tokenMessengerV2Abi,
  type DepositIntent,
  type IntentRecord,
} from "@inletkit/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi, parseUnits, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { arcGatewayMinter, arcUsdc, gatewayApi, hubDomain, irisApi } from "./config.js";
import type { DepositState, Destination, Quote, RoutePreference, SourceChain } from "./types.js";

const terminal = new Set(["executed", "claimable", "refunded", "expired", "failed"]);

export function useDeposit(params: { relayerUrl: string; source: SourceChain; destination: Destination }) {
  const { relayerUrl, source, destination } = params;
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: source.chainId });
  const { data: walletClient } = useWalletClient({ chainId: source.chainId });
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState<DepositState>({ phase: "idle" });
  const poller = useRef<ReturnType<typeof setInterval>>(undefined);

  const relayer = useMemo(() => new InletRelayerClient(relayerUrl), [relayerUrl]);
  const iris = useMemo(() => new IrisClient(irisApi), []);
  const gateway = useMemo(() => new GatewayClient(gatewayApi), []);

  useEffect(() => () => clearInterval(poller.current), []);

  const quote = useCallback(
    async (amountInput: string, preference: RoutePreference): Promise<Quote | undefined> => {
      if (!address || !publicClient) return undefined;
      const sendAmount = parseUnits(amountInput || "0", 6);
      if (sendAmount <= 0n) return undefined;
      setState({ phase: "quoting" });
      try {
        const [walletUsdc, balances, ethBalance] = await Promise.all([
          publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
          gateway.balances(address, [source.domain]).catch(() => []),
          publicClient.getBalance({ address }),
        ]);
        const gatewayAvailable = parseUnits(balances[0]?.balance ?? "0", 6);
        const gatewayFee = gatewayMaxFee(source.domain, sendAmount);
        const gatewayPossible = gatewayAvailable >= sendAmount + gatewayFee;
        const route = preference === "auto" ? (gatewayPossible ? "gateway" : "cctp") : preference;
        let next: Quote;
        if (route === "gateway") {
          next = { route, sendAmount, intentAmount: sendAmount, circleFee: gatewayFee, walletUsdc, gatewayAvailable, needsGas: false };
        } else {
          const maxFee = await iris.fastTransferMaxFee(source.domain, hubDomain, sendAmount);
          next = { route, sendAmount, intentAmount: sendAmount - maxFee, circleFee: maxFee, walletUsdc, gatewayAvailable, needsGas: ethBalance === 0n };
        }
        setState({ phase: "ready", quote: next });
        return next;
      } catch (error) {
        setState({ phase: "error", error: message(error) });
        return undefined;
      }
    },
    [address, publicClient, source, gateway, iris],
  );

  const track = useCallback(
    (hash: Hex) => {
      clearInterval(poller.current);
      poller.current = setInterval(async () => {
        try {
          const record = await relayer.getIntent(hash);
          setState((previous) => ({ ...previous, phase: terminal.has(record.state) ? "done" : "tracking", record }));
          if (terminal.has(record.state)) clearInterval(poller.current);
        } catch (error) {
          setState((previous) => ({ ...previous, error: message(error) }));
        }
      }, 2000);
    },
    [relayer],
  );

  const deposit = useCallback(
    async (current: Quote) => {
      if (!address || !walletClient || !publicClient) return;
      try {
        if (chainId !== source.chainId) await switchChainAsync({ chainId: source.chainId });

        setState({ phase: "creating", quote: current });
        const intent: DepositIntent = {
          owner: address,
          sourceDomain: source.domain,
          destinationDomain: destination.destinationDomain,
          adapterId: destination.adapterId,
          receiver: toBytes32(destination.receiver),
          beneficiary: toBytes32(address),
          adapterData: destination.adapterData({ beneficiary: address, amount: current.intentAmount }),
          amount: current.intentAmount,
          nonce: BigInt(Date.now()),
          deadline: BigInt(Math.floor(Date.now() / 1000) + 2 * 3600),
          refundRecipient: toBytes32(address),
          feeBps: 0,
        };
        const record: IntentRecord = await relayer.createIntent(intent, current.route);
        setState({ phase: "signing", quote: current, record });

        if (current.route === "gateway") {
          const block = await publicClient.getBlockNumber();
          const burnIntent = createBurnIntent({
            sourceDomain: source.domain,
            destinationDomain: hubDomain,
            sourceWallet: source.gatewayWallet,
            destinationMinter: arcGatewayMinter,
            sourceToken: source.usdc,
            destinationToken: arcUsdc,
            depositor: address,
            recipient: record.depositAddress,
            value: current.sendAmount,
            maxFee: current.circleFee,
            maxBlockHeight: block + GATEWAY_EXPIRY_BLOCKS,
          });
          const signature = await walletClient.signTypedData({ account: address, ...burnIntentTypedData(burnIntent) });
          setState({ phase: "sending", quote: current, record });
          await relayer.submitGateway(record.hash, { burnIntent, signature });
        } else {
          const allowance = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [address, source.tokenMessenger] });
          if (allowance < current.sendAmount) {
            const approve = await walletClient.writeContract({ account: address, chain: walletClient.chain, address: source.usdc, abi: erc20Abi, functionName: "approve", args: [source.tokenMessenger, current.sendAmount] });
            await publicClient.waitForTransactionReceipt({ hash: approve });
            for (let attempt = 0; attempt < 30; attempt++) {
              const visible = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [address, source.tokenMessenger] });
              if (visible >= current.sendAmount) break;
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          setState({ phase: "sending", quote: current, record });
          const burn = await walletClient.writeContract({
            account: address,
            chain: walletClient.chain,
            address: source.tokenMessenger,
            abi: tokenMessengerV2Abi,
            functionName: "depositForBurn",
            args: [current.sendAmount, hubDomain, toBytes32(record.depositAddress), source.usdc, toBytes32("0x0000000000000000000000000000000000000000"), current.circleFee, 1000],
            gas: 350_000n,
          });
          await publicClient.waitForTransactionReceipt({ hash: burn });
          await relayer.reportSourceTransaction(record.hash, burn);
          setState({ phase: "tracking", quote: current, record, sourceTx: burn });
        }

        setState((previous) => ({ ...previous, phase: "tracking" }));
        track(record.hash);
      } catch (error) {
        setState((previous) => ({ ...previous, phase: "error", error: message(error) }));
      }
    },
    [address, walletClient, publicClient, chainId, source, destination, relayer, switchChainAsync, track],
  );

  const fundGateway = useCallback(
    async (amountInput: string): Promise<Hex | undefined> => {
      if (!address || !walletClient || !publicClient) return undefined;
      const amount = parseUnits(amountInput || "0", 6);
      if (amount <= 0n) return undefined;
      try {
        if (chainId !== source.chainId) await switchChainAsync({ chainId: source.chainId });
        setState((previous) => ({ ...previous, phase: "signing", error: undefined }));
        const allowance = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [address, source.gatewayWallet] });
        if (allowance < amount) {
          const approve = await walletClient.writeContract({ account: address, chain: walletClient.chain, address: source.usdc, abi: erc20Abi, functionName: "approve", args: [source.gatewayWallet, amount] });
          await publicClient.waitForTransactionReceipt({ hash: approve });
          for (let attempt = 0; attempt < 30; attempt++) {
            const visible = await publicClient.readContract({ address: source.usdc, abi: erc20Abi, functionName: "allowance", args: [address, source.gatewayWallet] });
            if (visible >= amount) break;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        setState((previous) => ({ ...previous, phase: "sending" }));
        const deposit = await walletClient.writeContract({ account: address, chain: walletClient.chain, address: source.gatewayWallet, abi: gatewayWalletAbi, functionName: "deposit", args: [source.usdc, amount], gas: 250_000n });
        await publicClient.waitForTransactionReceipt({ hash: deposit });
        setState((previous) => ({ ...previous, phase: "ready", sourceTx: deposit }));
        return deposit;
      } catch (error) {
        setState((previous) => ({ ...previous, phase: "error", error: message(error) }));
        return undefined;
      }
    },
    [address, walletClient, publicClient, chainId, source, switchChainAsync],
  );

  const reset = useCallback(() => {
    clearInterval(poller.current);
    setState({ phase: "idle" });
  }, []);

  return { state, quote, deposit, fundGateway, reset, address, chainId, connectedToSource: chainId === source.chainId };
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message.split("\n")[0].slice(0, 240);
  return String(error).slice(0, 240);
}
