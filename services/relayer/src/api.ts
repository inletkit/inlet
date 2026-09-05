import cors from "@fastify/cors";
import { hashIntent, inletHubAbi, parseIntent, serializeIntent, toBytes32, type Route } from "@inletkit/sdk";
import Fastify from "fastify";
import type { Hex } from "viem";
import type { ChainContext } from "./chains.js";
import type { RelayerConfig } from "./config.js";
import type { IntentStore, StoredIntent } from "./db.js";

export async function buildApp(config: RelayerConfig, chains: Record<number, ChainContext>, store: IntentStore) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  const arc = chains[config.hubDomain];

  app.get("/health", async () => ({ ok: true, hub: config.hub, relayer: arc.walletClient.account?.address }));

  app.post<{ Body: { intent: Record<string, unknown>; route: Route } }>("/intents", async (request, reply) => {
    const intent = parseIntent(request.body.intent);
    const route = request.body.route;
    if (route !== "cctp" && route !== "gateway") return reply.code(400).send({ error: "route must be cctp or gateway" });
    if (intent.feeBps !== 0) return reply.code(400).send({ error: "feeBps must be 0" });
    if (intent.amount <= 0n) return reply.code(400).send({ error: "amount must be positive" });
    if (intent.deadline <= BigInt(Math.floor(Date.now() / 1000))) return reply.code(400).send({ error: "deadline is in the past" });
    const receiver = config.receivers[intent.destinationDomain];
    if (!receiver) return reply.code(400).send({ error: `unsupported destination domain ${intent.destinationDomain}` });
    if (intent.receiver.toLowerCase() !== toBytes32(receiver).toLowerCase()) return reply.code(400).send({ error: "receiver does not match the registered receiver" });

    const hash = hashIntent(intent, config.hub, arc.chain.id);
    const existing = store.get(hash);
    if (existing) return present(existing);

    const depositAddress = await arc.publicClient.readContract({ address: config.hub, abi: inletHubAbi, functionName: "depositAddress", args: [hash] });
    const block = Number(await arc.publicClient.getBlockNumber());
    return present(store.insert(hash, intent, route, depositAddress, block));
  });

  app.post<{ Params: { hash: Hex }; Body: { sourceTx: Hex } }>("/intents/:hash/source-tx", async (request, reply) => {
    const record = store.get(request.params.hash);
    if (!record) return reply.code(404).send({ error: "unknown intent" });
    return present(store.update(record.hash, { source_tx: request.body.sourceTx }));
  });

  app.get<{ Params: { hash: Hex } }>("/intents/:hash", async (request, reply) => {
    const record = store.get(request.params.hash);
    if (!record) return reply.code(404).send({ error: "unknown intent" });
    return present(record);
  });

  return app;
}

function present(record: StoredIntent) {
  const { message: _message, attestation: _attestation, ...rest } = record;
  return { ...rest, intent: serializeIntent(record.intent) };
}
