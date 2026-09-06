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
| POST | `/intents/:hash/gateway` | submit the signed Gateway burn intent |
| GET | `/intents/:hash` | current state and transaction hashes |

States: created, funded, swept, attested, executed, claimable, refunding, refunded, expired.

## End to end on testnet

`pnpm e2e` burns one USDC on the source chain, routes it through Arc, and deposits it into the chosen destination, printing every transaction hash. `pnpm gateway:deposit` funds a Gateway balance once, and `pnpm e2e:gateway` runs the same deposit from that balance without a source chain wait. Both scripts read `DESTINATION` (one of the keys in `scripts/destinations.ts`, default `demo-vault`), `SOURCE` (a CCTP domain, default 6 for Base Sepolia), `E2E_AMOUNT` in USDC units, `USER_PRIVATE_KEY` for the depositing wallet, and `RELAYER_URL` to use a hosted relayer instead of starting one.

## Recorded testnet runs

| Route | Burn or signature | Arc mint | Sweep on Arc | Execute on the destination | Time to position |
| --- | --- | --- | --- | --- | --- |
| Direct CCTP, fast transfer from Base Sepolia | 0x0c0397416083491bfda5f9dfa27fc82a11c29872749c984d4016f8a7f72ee791 | 0x19c281fec4fb9fc43bc03c71dbfe34f44c96cf657d72729bb93b09a5d642aec8 | 0x1c67f2afec36767c313e567e3210aae1b4c328dd17b8d7cef6026bcbea010859 | 0xccf3912b482c1bbb663cb011ccc34b8e980f5dfffedd5fce2b5663975221456f | 25 seconds |
| Gateway from a Base Sepolia unified balance | signed burn intent | 0x603f1db403b1ae0ca0eb93ef97206b0344053561bcaf8b4a32a749e912d63753 | 0x5bc0b1ac3827e9e2fb93ed8f7bcc6f03e5f93693f2d4dadfc92d6db38c26accc | 0x809c9c36a47fa05e0391da79c33a789abbf78befda0a9e0f0b3a3c74b077a82c | 16 seconds |
| Refund after deadline, intent funded short by the fast transfer fee | deposit address held 999870 | refund burn on Arc 0x59b19babfa135dd243a303571389b93b470f2fb1c7b139ad15e4c87f290ad483 | | mint on Base Sepolia 0x5c9b00e12edc35067c4b54ed22ac86214dece18da9702dda3daca95ce6b27959 | 6 seconds after the deadline |
| Direct CCTP from Base Sepolia into Aave V3 on Arbitrum Sepolia, 999870 aArbSepUSDC delivered | 0xddb85866a1a4ce3215b2d3cdf6bd5c4c4829e077e87f97dfaea6b29f8ea2849f | 0xecd18a65fc7b0077cb9eba7772c78ec2d6ca259292c4661374bfeca5dca2f086 | 0xa8c5afb12a3f9329e462db7d6a6bb2ec2fe5dd6eb49d4aa07c4c67c9b91b9281 | 0x871b4f1539a91b6196c346d8561f14ad088760f93c823a9cce8ef59a609d5170 | 42 seconds |
