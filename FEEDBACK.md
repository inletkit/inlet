# Uniswap developer feedback

Written by the Inlet team during ETHGlobal ETHOnline 2026, September 6, 2026. Inlet is a deposit rail: USDC on any chain becomes a DeFi position on another chain in one signature, through Circle Gateway, CCTP V2 and Arc. One of the positions it delivers is a Uniswap v4 liquidity position.

## What we integrated and where

| Piece of the stack | Where in this repository |
| --- | --- |
| v4 PositionManager, `modifyLiquidities` with `MINT_POSITION` and `SETTLE_PAIR` | `contracts/src/adapters/UniswapV4LpAdapter.sol`, function `_mint` |
| v4 StateView, `getSlot0` for the current tick | `contracts/src/adapters/UniswapV4LpAdapter.sol`, function `plan` |
| Permit2 allowance for the PositionManager | `contracts/src/adapters/UniswapV4LpAdapter.sol`, constructor |
| v4-core libraries `TickMath`, `PoolKey`, `PoolId`, `Currency` | imported from the `v4-core` submodule in `contracts/lib` |
| Single sided liquidity math mirroring `LiquidityAmounts` | `contracts/src/libraries/LiquidityMath.sol` |
| Trading API `/quote` for a live pool price | `services/relayer/src/uniswap.ts`, shown in `packages/widget/src/components/DepositWidget.tsx` |
| Pool key and adapter data encoding for the SDK | `packages/sdk/src/intent.ts`, `uniswapV4LpAdapterData` and `poolId` |
| Fork test against the live Unichain Sepolia pool | `contracts/test/fork/UniswapV4Fork.t.sol` |
| Unit tests with a mock PositionManager that checks action encoding, tick alignment and max amounts | `contracts/test/adapters/UniswapV4LpAdapter.t.sol` |

Chain: Unichain Sepolia (chain id 1301). Pool: ETH/USDC, fee 3000, tick spacing 60, no hooks. The adapter mints a USDC only range just below the current price, so a deposit needs no ETH and the position is owned by the depositor, visible in the Uniswap interface in testnet mode.

## Time to first successful integration

About four hours from reading the v4 docs to a position minted on a fork of Unichain Sepolia, including the tests. About one more hour to the first live position from a Base Sepolia wallet through Inlet.

## What blocked or slowed us

1. **No example of minting a position from a contract.** The v4 guides show `modifyLiquidities` from a script with the periphery's helper libraries. A contract that mints for someone else needs the raw action encoding: `abi.encode(actions, params)` with `MINT_POSITION` parameters `(PoolKey, tickLower, tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)` and `SETTLE_PAIR` parameters `(Currency, Currency)`. We assembled this from the PositionManager source. A short page listing the parameter tuple of every action would have saved most of the time.
2. **Permit2 is a double approval.** The PositionManager pulls tokens through Permit2, so a contract must approve Permit2 on the token and then call `Permit2.approve(token, positionManager, amount, expiration)`. The liquidity guide mentions Permit2 once; the failure mode when it is missing is a bare revert inside `settle`, which is hard to attribute.
3. **Negative tick rounding.** Solidity division truncates toward zero, so `tick / spacing * spacing` rounds a negative tick up, above the current price. The ETH/USDC pool sits at tick -193383, so the first attempt produced a range that needed ETH. The v4 docs do not warn about this; the fix is the same as in v3 (subtract one spacing when the tick is negative and not aligned).
4. **Importing the periphery interfaces pulls in more repositories.** `IPositionManager` imports `IPermit2Forwarder`, which imports the `permit2` repository, and the periphery's remappings expect `solmate`. We wrote minimal interfaces instead of adding three submodules. A dependency free interface package would help integrators who only need `modifyLiquidities`, `nextTokenId` and `getSlot0`.
5. **Documentation redirects.** Several documentation links (the old `docs.unichain.org` contract address page, the Trading API reference) redirect to `llms.mdx` pages or 404. The Trading API getting started page does not state the base URL `https://trade-api.gateway.uniswap.org/v1` or the `x-api-key` header; we found both by trial.
6. **Arc is missing from the deployment list.** Uniswap v4 is announced for Arc mainnet but not on Arc testnet, and the SDK's Arc addresses are mainnet only. The deployments page could say which testnets have v4 and which do not, so a hackathon team does not lose an afternoon.

## Ratings

| Area | Score out of 5 | Why |
| --- | --- | --- |
| v4 documentation | 3 | Good conceptual pages and script examples; thin on contract to contract integration and action encodings |
| Contract addresses | 4 | Accurate for Unichain Sepolia once found; the old Unichain docs domain redirects to a page without them |
| Trading API | 4 | Worked on the first request with a free key, including on Unichain Sepolia; the getting started page lacks the base URL and header |
| Testnet liquidity | 5 | The ETH/USDC pool on Unichain Sepolia is deep and priced like mainnet, which made real single sided positions possible |
| Support | not used | We did not need to ask; the source code answered every question |

## What was missing

- An action parameter reference for the PositionManager.
- A contract level example of minting on behalf of another owner.
- A single note about Permit2 in the "mint a position" guide, and about negative tick rounding in the "range" guide.
- Trading API quotes for testnets are supported, which the docs do not say; a supported chains list with testnets would have saved the probe.

## What we would continue

A `uniswap-v4-lp` adapter that accepts any pool key, so protocols with their own v4 pools can receive single sided deposits from any chain, plus a symmetric adapter for the other side of the pool. Once v4 is live on Arc mainnet on September 16, the same adapter deploys there with Arc as both the settlement hub and the destination, which removes the second CCTP hop entirely.
