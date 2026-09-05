# Inlet relayer

The service that completes deposits. It watches deposit addresses on Arc, mints incoming CCTP transfers, sweeps the hub, waits for Circle's attestation, and executes the adapter on the destination chain. Every step checks the chain before acting, so the process can restart at any point.

```
pnpm install
cp .env.example .env
pnpm dev
```

`RELAYER_PRIVATE_KEY` pays gas on Arc (USDC) and on the destination chains. State lives in a SQLite file at `DB_PATH`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | hub and relayer addresses |
| POST | `/intents` | register an intent, returns its hash and deposit address |
| POST | `/intents/:hash/source-tx` | report the CCTP burn on the source chain |
| GET | `/intents/:hash` | current state and transaction hashes |

States: created, funded, swept, attested, executed, claimable, refunded, expired.

## End to end on testnet

`pnpm e2e` burns one USDC on Base Sepolia, routes it through Arc, and deposits it into the demo vault on Arbitrum Sepolia, printing every transaction hash.
