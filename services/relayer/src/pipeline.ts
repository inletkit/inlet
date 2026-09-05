import {
  IrisClient,
  inletHubAbi,
  inletReceiverAbi,
  messageTransmitterV2Abi,
  type IntentState,
} from "@inletkit/sdk";
import { erc20Abi, parseEventLogs, slice, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import type { ChainContext } from "./chains.js";
import type { RelayerConfig } from "./config.js";
import type { IntentStore, StoredIntent } from "./db.js";
import { log } from "./log.js";

export class Pipeline {
  constructor(
    private readonly config: RelayerConfig,
    private readonly chains: Record<number, ChainContext>,
    private readonly account: PrivateKeyAccount,
    private readonly store: IntentStore,
    private readonly iris: IrisClient,
  ) {}

  async tick() {
    for (const record of this.store.listByState(["created"])) await this.guarded(record, () => this.fund(record));
    for (const record of this.store.listByState(["funded"])) await this.guarded(record, () => this.sweep(record));
    for (const record of this.store.listByState(["swept"])) await this.guarded(record, () => this.attest(record));
    for (const record of this.store.listByState(["attested"])) await this.guarded(record, () => this.execute(record));
  }

  private async guarded(record: StoredIntent, step: () => Promise<void>) {
    try {
      await step();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("pipeline", `${record.state} step failed for ${record.hash}: ${message.slice(0, 300)}`);
      this.store.update(record.hash, { error: message.slice(0, 1000) });
    }
  }

  private get arc() {
    return this.chains[this.config.hubDomain];
  }

  private async depositBalance(record: StoredIntent) {
    return this.arc.publicClient.readContract({
      address: this.arc.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [record.depositAddress],
    });
  }

  private transition(record: StoredIntent, state: IntentState, patch: Record<string, string | null> = {}) {
    log("pipeline", `${record.hash} ${record.state} to ${state}`, patch);
    return this.store.update(record.hash, { state, error: null, ...patch });
  }

  async fund(record: StoredIntent) {
    const balance = await this.depositBalance(record);
    if (balance >= record.intent.amount) {
      this.transition(record, "funded");
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now > record.intent.deadline) {
      if (balance > 0n) await this.refund(record);
      else this.transition(record, "expired");
      return;
    }

    if (record.route === "cctp" && record.sourceTx && !record.arcMintTx) {
      await this.mintOnArc(record);
    }
  }

  private async mintOnArc(record: StoredIntent) {
    const messages = await this.iris.getMessages(record.intent.sourceDomain, record.sourceTx!);
    const ready = messages.find((message) => message.status === "complete" && message.attestation !== "PENDING");
    if (!ready) return;

    const nonce = slice(ready.message, 12, 44);
    const used = await this.arc.publicClient.readContract({
      address: this.arc.messageTransmitter,
      abi: messageTransmitterV2Abi,
      functionName: "usedNonces",
      args: [nonce],
    });
    if (used === 1n) {
      this.store.update(record.hash, { arc_mint_tx: "external" });
      return;
    }

    const hash = await this.arc.walletClient.writeContract({
      address: this.arc.messageTransmitter,
      abi: messageTransmitterV2Abi,
      functionName: "receiveMessage",
      args: [ready.message, ready.attestation as Hex],
      account: this.account,
      chain: this.arc.chain,
      gas: 600_000n,
    });
    await this.arc.publicClient.waitForTransactionReceipt({ hash });
    log("pipeline", `${record.hash} minted on Arc`, { tx: hash });
    this.store.update(record.hash, { arc_mint_tx: hash });
  }

  async sweep(record: StoredIntent) {
    const status = await this.arc.publicClient.readContract({
      address: this.config.hub,
      abi: inletHubAbi,
      functionName: "status",
      args: [record.hash],
    });

    if (status === 0) {
      const hash = await this.arc.walletClient.writeContract({
        address: this.config.hub,
        abi: inletHubAbi,
        functionName: "sweep",
        args: [record.intent],
        account: this.account,
        chain: this.arc.chain,
        gas: this.arc.fixedGas,
      });
      const receipt = await this.arc.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`sweep reverted in ${hash}`);
      this.transition(record, "swept", { sweep_tx: hash });
      return;
    }

    if (status === 1) {
      const sweepTx = record.sweepTx ?? (await this.findSweep(record));
      this.transition(record, "swept", { sweep_tx: sweepTx });
      return;
    }

    this.transition(record, "refunded");
  }

  private async findSweep(record: StoredIntent): Promise<Hex> {
    const logs = await this.arc.publicClient.getContractEvents({
      address: this.config.hub,
      abi: inletHubAbi,
      eventName: "Swept",
      args: { intentHash: record.hash },
      fromBlock: BigInt(record.createdBlock),
      toBlock: "latest",
    });
    const event = logs[0];
    if (!event) throw new Error("hub reports swept but no Swept event was found");
    return event.transactionHash;
  }

  async attest(record: StoredIntent) {
    const messages = await this.iris.getMessages(this.config.hubDomain, record.sweepTx!);
    const ready = messages.find((message) => message.status === "complete" && message.attestation !== "PENDING");
    if (!ready) return;
    this.transition(record, "attested", { message: ready.message, attestation: ready.attestation as string });
  }

  async execute(record: StoredIntent) {
    const domain = record.intent.destinationDomain;
    const destination = this.chains[domain];
    const receiver = this.config.receivers[domain];
    if (!destination || !receiver) throw new Error(`no executor for destination domain ${domain}`);

    const executed = await destination.publicClient.readContract({
      address: receiver,
      abi: inletReceiverAbi,
      functionName: "executed",
      args: [record.hash],
    });
    if (executed) {
      this.transition(record, "executed", { result: "executed by another party" });
      return;
    }

    const nonce = slice(record.message!, 12, 44);
    const used = await destination.publicClient.readContract({
      address: destination.messageTransmitter,
      abi: messageTransmitterV2Abi,
      functionName: "usedNonces",
      args: [nonce],
    });

    const hash =
      used === 1n
        ? await destination.walletClient.writeContract({
            address: receiver,
            abi: inletReceiverAbi,
            functionName: "execute",
            args: [record.message!],
            account: this.account,
            chain: destination.chain,
            gas: destination.fixedGas,
          })
        : await destination.walletClient.writeContract({
            address: receiver,
            abi: inletReceiverAbi,
            functionName: "receiveAndExecute",
            args: [record.message!, record.attestation!],
            account: this.account,
            chain: destination.chain,
            gas: destination.fixedGas,
          });
    const receipt = await destination.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`execute reverted in ${hash}`);

    const events = parseEventLogs({ abi: inletReceiverAbi, logs: receipt.logs });
    const outcome = events.find((event) => event.eventName === "Executed" || event.eventName === "MadeClaimable");
    const state: IntentState = outcome?.eventName === "Executed" ? "executed" : "claimable";
    const result = outcome ? JSON.stringify(outcome.args, (_, value) => (typeof value === "bigint" ? value.toString() : value)) : null;
    this.transition(record, state, { destination_tx: hash, result });
  }

  async refund(record: StoredIntent) {
    const hash = await this.arc.walletClient.writeContract({
      address: this.config.hub,
      abi: inletHubAbi,
      functionName: "refund",
      args: [record.intent],
      account: this.account,
      chain: this.arc.chain,
      gas: this.arc.fixedGas,
    });
    const receipt = await this.arc.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`refund reverted in ${hash}`);
    this.transition(record, "refunded", { sweep_tx: hash });
  }
}
