import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseBurnIntent, parseIntent, serializeBurnIntent, serializeIntent, type DepositIntent, type GatewayAttestation, type IntentRecord, type IntentState, type Route, type SignedBurnIntent } from "@inletkit/sdk";
import type { Address, Hex } from "viem";

interface Row {
  hash: string;
  state: string;
  route: string;
  intent_json: string;
  deposit_address: string;
  created_block: number;
  source_tx: string | null;
  arc_mint_tx: string | null;
  sweep_tx: string | null;
  message: string | null;
  attestation: string | null;
  destination_tx: string | null;
  gateway_json: string | null;
  gateway_attestation: string | null;
  refund_tx: string | null;
  refund_mint_tx: string | null;
  result: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

export interface StoredIntent extends IntentRecord {
  createdBlock: number;
  message?: Hex;
  attestation?: Hex;
  gatewayRequest?: SignedBurnIntent;
  gatewayAttestation?: GatewayAttestation;
}

export class IntentStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      create table if not exists intents (
        hash text primary key,
        state text not null,
        route text not null,
        intent_json text not null,
        deposit_address text not null,
        created_block integer not null,
        source_tx text,
        arc_mint_tx text,
        sweep_tx text,
        message text,
        attestation text,
        destination_tx text,
        result text,
        error text,
        created_at integer not null,
        updated_at integer not null
      )
    `);
    for (const column of ["gateway_json text", "gateway_attestation text", "refund_tx text", "refund_mint_tx text"]) {
      try {
        this.db.exec(`alter table intents add column ${column}`);
      } catch {
        continue;
      }
    }
  }

  setGatewayRequest(hash: Hex, signed: SignedBurnIntent) {
    return this.update(hash, { gateway_json: JSON.stringify({ burnIntent: serializeBurnIntent(signed.burnIntent), signature: signed.signature }) });
  }

  insert(hash: Hex, intent: DepositIntent, route: Route, depositAddress: Address, createdBlock: number): StoredIntent {
    const now = Date.now();
    this.db
      .prepare(
        `insert into intents (hash, state, route, intent_json, deposit_address, created_block, created_at, updated_at)
         values (?, 'created', ?, ?, ?, ?, ?, ?)`,
      )
      .run(hash, route, JSON.stringify(serializeIntent(intent)), depositAddress, createdBlock, now, now);
    return this.get(hash)!;
  }

  get(hash: Hex): StoredIntent | undefined {
    const row = this.db.prepare("select * from intents where hash = ?").get(hash) as unknown as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  listByState(states: IntentState[]): StoredIntent[] {
    const marks = states.map(() => "?").join(",");
    const rows = this.db.prepare(`select * from intents where state in (${marks}) order by created_at`).all(...states) as unknown as Row[];
    return rows.map(toRecord);
  }

  update(hash: Hex, patch: Partial<Record<"state" | "source_tx" | "arc_mint_tx" | "sweep_tx" | "message" | "attestation" | "destination_tx" | "gateway_json" | "gateway_attestation" | "refund_tx" | "refund_mint_tx" | "result" | "error", string | null>>): StoredIntent {
    const keys = Object.keys(patch);
    if (keys.length === 0) return this.get(hash)!;
    const sets = keys.map((key) => `${key} = ?`).join(", ");
    this.db.prepare(`update intents set ${sets}, updated_at = ? where hash = ?`).run(...keys.map((key) => patch[key as keyof typeof patch] ?? null), Date.now(), hash);
    return this.get(hash)!;
  }

  close() {
    this.db.close();
  }
}

function toRecord(row: Row): StoredIntent {
  return {
    hash: row.hash as Hex,
    state: row.state as IntentState,
    route: row.route as Route,
    intent: parseIntent(JSON.parse(row.intent_json)),
    depositAddress: row.deposit_address as Address,
    createdBlock: row.created_block,
    sourceTx: (row.source_tx ?? undefined) as Hex | undefined,
    arcMintTx: (row.arc_mint_tx ?? undefined) as Hex | undefined,
    sweepTx: (row.sweep_tx ?? undefined) as Hex | undefined,
    message: (row.message ?? undefined) as Hex | undefined,
    attestation: (row.attestation ?? undefined) as Hex | undefined,
    destinationTx: (row.destination_tx ?? undefined) as Hex | undefined,
    refundTx: (row.refund_tx ?? undefined) as Hex | undefined,
    refundMintTx: (row.refund_mint_tx ?? undefined) as Hex | undefined,
    gatewayRequest: row.gateway_json ? parseGatewayRequest(JSON.parse(row.gateway_json)) : undefined,
    gatewayAttestation: row.gateway_attestation ? (JSON.parse(row.gateway_attestation) as GatewayAttestation) : undefined,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseGatewayRequest(raw: { burnIntent: Record<string, unknown>; signature: Hex }): SignedBurnIntent {
  return { burnIntent: parseBurnIntent(raw.burnIntent), signature: raw.signature };
}
