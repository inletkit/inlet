import type { Hex } from "viem";
import { parseIntent, serializeIntent } from "./intent.js";
import type { DepositIntent, IntentRecord, Route } from "./types.js";

export class InletRelayerClient {
  constructor(private readonly baseUrl: string) {}

  async createIntent(intent: DepositIntent, route: Route): Promise<IntentRecord> {
    return this.request("POST", "/intents", { intent: serializeIntent(intent), route });
  }

  async reportSourceTransaction(hash: Hex, sourceTx: Hex): Promise<IntentRecord> {
    return this.request("POST", `/intents/${hash}/source-tx`, { sourceTx });
  }

  async getIntent(hash: Hex): Promise<IntentRecord> {
    return this.request("GET", `/intents/${hash}`);
  }

  private async request(method: string, path: string, body?: unknown): Promise<IntentRecord> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Relayer ${response.status}: ${await response.text()}`);
    const raw = (await response.json()) as Record<string, unknown>;
    return { ...(raw as unknown as IntentRecord), intent: parseIntent(raw.intent as Record<string, unknown>) };
  }
}
