# Inlet

From any chain into any position.

Inlet is a deposit rail for DeFi. A user holding USDC on any supported chain signs once, and a short time later holds the position they asked for on the destination chain: a liquidity provider share, a margin account balance, or a vault deposit. Not USDC sitting in a wallet on the other side. The position itself.

Under the button, Circle Gateway or CCTP brings native USDC to Arc, the Inlet hub contract on Arc escrows and routes it through CCTP to the destination chain, and the Inlet relayer makes the final deposit call into the protocol. If that call cannot complete, the funds stay claimable by the user. Nothing gets wrapped and nothing gets stuck.

## What ships

- `contracts/` the hub on Arc, per intent forwarders, the EVM receiver, and adapters (Foundry)
- `contracts-stellar/` the Stellar receiver that calls Noether (Soroban)
- `packages/sdk` intents, signing, Gateway and CCTP helpers, status client
- `packages/widget` the React deposit widget
- `packages/adapters` adapter definitions: ERC-4626 vaults, Noether vault, Noether margin
- `services/relayer` attestation tracking and destination execution
- `apps/playground` docs and live demo
- `apps/mcp` tool server for agents
- `skills/inlet` agent skill for integrating the kit

See `docs/spec.md` for the architecture.

## Live on testnet

- Playground and docs: https://red-cliff-00b9f0703.6.azurestaticapps.net
- Relayer API: https://inlet-relayer.wonderfulforest-6c3e22a4.westeurope.azurecontainerapps.io
- Hub on Arc testnet: 0x84f3433550d1B6FB7f0BE197eA9faA256962408B

## Status

Built during ETHGlobal ETHOnline 2026 on Arc testnet. Zero fees. Not audited. Testnet only.

## License

MIT
