import type { Hex } from "viem";
import { parseIntent, serializeIntent } from "./intent.js";
import { serializeBurnIntent, type SignedBurnIntent } from "./gateway.js";
import type { DepositIntent, IntentRecord, Route } from "./types.js";

export interface RelayerHealth {
  ok: boolean;
  hub: Hex;
  relayer: Hex;
}

export class InletRelayerClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 10_000) {}

  get url() {
    return this.baseUrl;
  }

  async health(): Promise<RelayerHealth> {
    const response = await this.fetch("/health", { method: "GET" });
    return (await response.json()) as RelayerHealth;
  }

  async createIntent(intent: DepositIntent, route: Route): Promise<IntentRecord> {
    return this.request("POST", "/intents", { intent: serializeIntent(intent), route });
  }

  async reportSourceTransaction(hash: Hex, sourceTx: Hex): Promise<IntentRecord> {
    return this.request("POST", `/intents/${hash}/source-tx`, { sourceTx });
  }

  async submitGateway(hash: Hex, signed: SignedBurnIntent): Promise<IntentRecord> {
    return this.request("POST", `/intents/${hash}/gateway`, { burnIntent: serializeBurnIntent(signed.burnIntent), signature: signed.signature });
  }

  async getIntent(hash: Hex): Promise<IntentRecord> {
    return this.request("GET", `/intents/${hash}`);
  }

  private async request(method: string, path: string, body?: unknown): Promise<IntentRecord> {
    const response = await this.fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = (await response.json()) as Record<string, unknown>;
    return { ...(raw as unknown as IntentRecord), intent: parseIntent(raw.intent as Record<string, unknown>) };
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "is unreachable";
      throw new Error(`Relayer at ${this.baseUrl} ${reason}`);
    }
    if (!response.ok) {
      let detail = "";
      try {
        detail = ((await response.json()) as { error?: string }).error ?? "";
      } catch {
        detail = "";
      }
      throw new Error(`Relayer ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return response;
  }
}
