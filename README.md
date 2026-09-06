# Inlet

From any chain into any position.

Inlet is a deposit rail for DeFi. A user holding USDC on any supported chain signs once, and a short time later holds the position they asked for on the destination chain: a liquidity provider share, a margin account balance, or a vault deposit. Not USDC sitting in a wallet on the other side. The position itself.

Under the button, Circle Gateway or CCTP brings native USDC to Arc, the Inlet hub contract on Arc escrows and routes it through CCTP to the destination chain, and the Inlet relayer makes the final deposit call into the protocol. If that call cannot complete, the funds stay claimable by the user. Nothing gets wrapped and nothing gets stuck.

## What ships

- `contracts/` the hub on Arc, per intent forwarders, the EVM receiver, and the adapters for ERC 4626 vaults, Aave V3, Compound III and Uniswap v4 (Foundry)
- `packages/sdk` intents, adapter data encoders, the destination catalog, Gateway and CCTP helpers, the relayer client
- `packages/widget` the React deposit widget with optional Privy login
- `services/relayer` deposit tracking, Arc mints, sweeps, attestations, destination execution, refunds, and the Uniswap quote proxy
- `apps/playground` docs and live demo
- `apps/mcp` MCP server so agents can deposit through Inlet
- `skills/inlet` the agent skill for integrating the kit
- `contracts-stellar/` the Stellar receiver that calls Noether (Soroban), in progress

See `docs/spec.md` for the architecture and `docs/adapters.md` for writing and deploying adapters.

## For agents

`apps/mcp` is a stdio MCP server over the same SDK and relayer API the widget uses. Tools: `list_destinations`, `list_sources`, `quote_deposit`, `create_intent` (returns the deposit address and the exact transaction or EIP 712 payload to sign), `report_source_transaction`, `submit_gateway_intent`, `deposit_status`, `uniswap_quote`, and, when `INLET_PRIVATE_KEY` is set, `deposit` and `fund_gateway_balance` which run the whole flow with that wallet.

```
{
  "mcpServers": {
    "inlet": {
      "command": "node",
      "args": ["/path/to/inlet/apps/mcp/dist/index.js"],
      "env": { "INLET_RELAYER_URL": "https://inlet-relayer.wonderfulforest-6c3e22a4.westeurope.azurecontainerapps.io" }
    }
  }
}
```

`skills/inlet/SKILL.md` teaches a coding agent how to mount the widget, write an adapter, and run a relayer.

Recorded agent run: one `deposit` tool call moved 1 USDC from a Base Sepolia Gateway balance into Compound III on Base Sepolia in 16 seconds (Arc mint 0x2180a82f73e121449b52f616883ffa71a26c44b66eaee012edad9887f37e1a31, sweep 0x113d8d04186c5082eb9c54dbbd87b92a733d8db03d13ecbaa0c9b6f864fe80c1, execute 0xdcf11694a8160eec3413e20302a36cbb50a40ff93b7bbcc8508fcf44106e7cad).

## Live on testnet

- Playground and docs: https://red-cliff-00b9f0703.6.azurestaticapps.net
- Relayer API: https://inlet-relayer.wonderfulforest-6c3e22a4.westeurope.azurecontainerapps.io
- Hub on Arc testnet: 0x84f3433550d1B6FB7f0BE197eA9faA256962408B

## Destinations live on testnet

| Destination | Chain | Adapter | Position delivered |
| --- | --- | --- | --- |
| Aave V3 | Arbitrum Sepolia | `aave-v3:v1` | aArbSepUSDC |
| Compound III | Base Sepolia | `compound-v3:v1` | USDC supply balance |
| Morpho Oneshot vault | Base Sepolia | `erc4626:v1` | vUSDC shares |
| Uniswap v4 ETH/USDC | Unichain Sepolia | `uniswap-v4-lp:v1` | a single sided liquidity position NFT |
| Inlet demo vault | Arbitrum Sepolia | `erc4626:v1` | vault shares |

Every run is recorded with its transaction hashes in `services/relayer/README.md`.

## Uniswap integration

Inlet delivers Uniswap v4 liquidity positions on Unichain Sepolia (chain id 1301). A deposit of USDC from any chain ends as a position NFT owned by the depositor in the ETH/USDC pool (fee 3000, tick spacing 60, no hooks), minted with a USDC only range just below the current price so no ETH is needed. Developer feedback for the Uniswap Foundation lives in `FEEDBACK.md`.

Contracts on Unichain Sepolia:

| Contract | Address |
| --- | --- |
| Inlet receiver | 0x84f3433550d1B6FB7f0BE197eA9faA256962408B |
| Uniswap v4 liquidity adapter | 0x55da7c3B5e99816A7a9cD9dc47e24bfd7B19D6ED |
| Uniswap PositionManager | 0xf969Aee60879C54bAAed9F3eD26147Db216Fd664 |
| Uniswap StateView | 0xc199F1072a74D4e905ABa1A84d9a45E2546B6222 |
| Permit2 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 |

Where the integration lives:

- [`contracts/src/adapters/UniswapV4LpAdapter.sol`](contracts/src/adapters/UniswapV4LpAdapter.sol): the constructor approves Permit2 and the PositionManager (lines 39 to 45), `plan` reads the current tick from StateView and sizes a single sided range (lines 71 to 88), `_mint` encodes `MINT_POSITION` and `SETTLE_PAIR` and calls `modifyLiquidities` (lines 90 to 107), `range` and `floorTick` handle tick spacing and negative tick rounding (lines 109 to 134).
- [`contracts/src/libraries/LiquidityMath.sol`](contracts/src/libraries/LiquidityMath.sol): liquidity for a single sided amount, mirroring Uniswap's `LiquidityAmounts`.
- [`contracts/src/interfaces/IUniswapV4.sol`](contracts/src/interfaces/IUniswapV4.sol): the PositionManager, StateView and Permit2 surface used. `TickMath`, `PoolKey`, `PoolId` and `Currency` come from the `v4-core` submodule.
- [`contracts/test/fork/UniswapV4Fork.t.sol`](contracts/test/fork/UniswapV4Fork.t.sol): mints a real position on a fork of Unichain Sepolia. [`contracts/test/adapters/UniswapV4LpAdapter.t.sol`](contracts/test/adapters/UniswapV4LpAdapter.t.sol): action encoding, tick alignment, Permit2 approvals and the claimable fallback.
- [`packages/sdk/src/intent.ts`](packages/sdk/src/intent.ts): `uniswapV4LpAdapterData` and `poolId` (lines 88 to 94).
- [`services/relayer/src/uniswap.ts`](services/relayer/src/uniswap.ts): the Uniswap Trading API `/quote` client behind the relayer's `/quotes/uniswap` route, shown as the live pool price in the widget.

Recorded deposit: burn on Base Sepolia 0x082440c3cda81259ab7f8e636e2dc0ea5292f510655f05619dc2b251a2f238a8, mint on Arc 0x6f08191e89260315621a6d0d256663381749cc730bf360a591200bba462ed2d8, sweep on Arc 0x1cf9832b4151ad0886029b45ea349b66b82699793373fc00c3f87591fe17ab09, execute on Unichain Sepolia 0x9bfe59be1f352251d7f879f263ca7265634c707b1c5b11c336f89491228ca769, position 7920 with liquidity 546255824825 owned by 0xFDeA5eBbe7970A00792562e1C5299215CF6A3813.

## Status

Built during ETHGlobal ETHOnline 2026 on Arc testnet. Zero fees. Not audited. Testnet only.

## License

MIT
