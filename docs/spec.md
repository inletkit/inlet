# Inlet architecture specification

Version 0.2, September 2026. Testnet only. Zero fees.

## 1. Purpose

Inlet moves native USDC from any supported chain into a DeFi position on any other supported chain in one user action. The position can be a liquidity provider share, a margin account balance, or a vault deposit. The user signs once on the chain where the money is. Inlet handles landing, routing, delivery, and the final protocol call, and it never leaves funds in a state that nobody can claim.

Inlet is built on Circle rails only: Gateway for unified balances, CCTP V2 for burn and mint transfers, and Arc as the hub where every deposit lands and settles. There are no wrapped tokens and no third party bridges.

## 2. Actors

- User: holds USDC on a source chain, signs a deposit intent, receives a position on a destination chain.
- Protocol: the destination application (a vault, a perpetuals exchange, a lending market). Integrates Inlet by publishing an adapter and mounting the widget.
- Hub: the Inlet contract on Arc. Receives USDC per intent, verifies the user's signature, routes through CCTP, refunds when routing is impossible.
- Receiver: the Inlet contract on a destination chain. Receives minted USDC, executes the adapter, keeps funds claimable if execution fails.
- Relayer: an off chain service that watches Circle attestations, submits mints, sweeps the hub, and executes receivers. Anyone can run one. The reference relayer is open source.

## 3. Trust model

- The deposit address is the commitment. It is derived from the hash of every parameter of the deposit: amount, destination, receiver, adapter, beneficiary, deadline, refund address. Funds only arrive there because the user named that address in the Gateway or CCTP transfer they signed, so no separate Inlet signature is needed.
- The hub only moves funds along the path the intent names, or back to the intent's refund address after the deadline.
- The receiver only executes the adapter the intent names, for the beneficiary the intent names, with the amount that Circle minted, and only for messages burned by the hub.
- A relayer can delay a deposit. It cannot redirect it. If every relayer disappears, the user can sweep, refund, or claim by calling the contracts directly.

## 4. Deposit intent

An intent is an EIP 712 typed structure. Its hash under the hub's domain identifies the deposit; the user never signs it directly, because the deposit address derived from it is what the user's Gateway or CCTP transfer names.

```
DepositIntent {
  address owner            // signer on the source chain
  uint32  sourceDomain     // CCTP domain of the source chain
  uint32  destinationDomain
  bytes32 adapterId        // keccak256 of the adapter name, for example "erc4626:v1"
  bytes32 receiver         // the Inlet receiver on the destination chain
  bytes32 beneficiary      // destination account, left padded EVM address or 32 byte key
  bytes   adapterData      // adapter specific parameters
  uint256 amount           // minimum USDC that must arrive at the deposit address, 6 decimals
  uint256 nonce
  uint64  deadline         // unix seconds; after this the intent is refundable
  bytes32 refundRecipient  // account on the source chain
  uint16  feeBps           // must be 0 in version 1
}
```

EIP 712 domain: name "Inlet", version "1", chainId of Arc, verifyingContract the hub.

The amount is a floor, not the exact transfer size. Fast CCTP transfers deduct a fee at mint, so the SDK sets the intent amount to the burned amount minus the maximum fee, and the hub routes whatever balance actually arrives as long as it covers the floor. The intent hash is the EIP 712 digest. It identifies the deposit everywhere: on the hub, in the hook data, in the receiver, and in the relayer.

## 5. The hub on Arc

### 5.1 Deposit addresses

Every intent has its own deposit address on Arc, derived with CREATE2 from the hub address and the intent hash. The address is computable before any transaction exists, so the SDK can name it as the Gateway or CCTP mint recipient. The contract at that address is a minimal forwarder whose constructor transfers its entire USDC balance to the hub. It is deployed lazily at sweep time.

This gives three properties: the user never needs Arc gas, funds map to intents without ambiguity, and sweeping is permissionless.

### 5.2 sweep(intent)

1. Reject if the intent was already swept or refunded, if feeBps is not zero, if the deadline has passed, or if the destination or receiver is not registered on the hub.
2. Deploy the forwarder for the intent hash if it does not exist. The forwarder transfers the balance it received into the hub.
3. Require the received balance to be at least the intent amount. The full received balance is routed.
4. Call CCTP V2 depositForBurnWithHook with the destination domain, the mint recipient for that destination, the hook data described in 5.4, the destination caller, a max fee of zero for standard transfers, and the standard finality threshold required on Arc.
5. Record the intent as swept and emit an event carrying the intent hash and the CCTP nonce.

### 5.3 refund(intent)

After the deadline, anyone can call refund. The hub deploys or flushes the forwarder, takes whatever balance it holds, and burns it through CCTP back to the source domain with the refund recipient as mint recipient. Refund can be called again for funds that arrive late, including after a sweep.

### 5.4 Hook data

For EVM destinations the mint recipient is the Inlet receiver on that chain and the hook data is an Inlet frame: the ASCII tag `inlet/v1`, the intent hash, the adapter id, the beneficiary, and the adapter data.

For Stellar the mint recipient is Circle's CctpForwarder contract and the hook data follows Circle's forwarder layout: 24 reserved zero bytes, a 4 byte version, the 4 byte length of the forward recipient, the recipient's strkey, then the Inlet frame as the integrator payload. The hub stores the strkey of each registered Stellar receiver. The encoding is verified on testnet with small amounts before any larger transfer.

### 5.5 Fees

Version 1 charges nothing. The intent carries a feeBps field, the hub rejects any value other than zero, and no fee logic exists in the contracts. The field exists so that a future version can add a fee without changing the intent shape.

## 6. Source routes

### 6.1 Gateway route

The user holds or creates a Gateway unified balance on the source chain. The SDK builds a Gateway burn intent whose destination domain is Arc and whose destination recipient is the deposit address of the Inlet intent. The user signs the Gateway burn intent and the Inlet intent. The relayer submits the burn intent to the Gateway API, receives the attestation, and submits the mint on Arc. USDC lands at the deposit address in well under a second on Arc.

This route is the one that makes the margin top up possible: with a Gateway delegate authorization, the relayer can create burn intents from the user's unified balance when a protocol asks for more margin.

### 6.2 Direct CCTP route

The user sends a CCTP depositForBurn on the source chain with Arc as destination domain and the deposit address as mint recipient. The relayer, or Circle's Forwarding Service, submits the mint on Arc. One transaction, no Gateway balance needed.

Both routes end the same way: USDC at the deposit address, then sweep.

## 7. Destination execution

### 7.1 EVM receiver

The receiver is the mint recipient for every EVM destination. After the relayer submits receiveMessage on the destination's MessageTransmitter, it calls `execute(message)` on the receiver with the same CCTP message bytes.

execute does the following:

1. Confirm the message nonce has been consumed on the MessageTransmitter, so only real mints can drive execution.
2. Parse the burn message: the source domain must be Arc and the message sender must be the hub, the mint recipient must be this receiver, and the amount received is the burned amount minus the fee Circle executed.
3. Parse the Inlet frame from the hook data. Reject intents that were already executed.
4. Approve the adapter and call it with the amount, the beneficiary, and the adapter data.
5. If the adapter call fails, credit the amount to the beneficiary's claimable balance instead. The beneficiary can call `claim()` at any time.

Adapter interface on EVM:

```
interface IInletAdapter {
  function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
    external returns (bytes memory result);
}
```

Adapters are stateless. The ERC 4626 adapter takes a vault address and a minimum share amount, deposits, and sends the shares to the beneficiary.

### 7.2 Stellar receiver

The Stellar receiver is a Soroban contract that Circle's forwarder pays into. The relayer calls `execute` with the intent fields and the amount. The receiver converts the amount to Stellar's seven decimal USDC, then calls the Noether entrypoint that credits a beneficiary while the receiver pays: `deposit_for` on the vault for liquidity provider deposits, and `deposit_cross_margin_for` on the market for margin. If the call fails the amount becomes claimable by the beneficiary. In version 1 only the configured relayer may call execute, to prevent griefing; claims are open to the beneficiary.

The Noether entrypoints are provided by the Noether protocol. Inlet depends on them but does not contain them.

### 7.3 Adapters shipped in version 1

- erc4626:v1 on EVM destinations
- noether-vault:v1 on Stellar, credits NOE to the beneficiary
- noether-margin:v1 on Stellar, credits the beneficiary's cross margin balance

Adding a protocol means writing one adapter and registering its id. No change to the hub, the receiver, or the relayer.

## 8. Relayer

A TypeScript service. State per intent:

created, funded, swept, attested, received, executed, claimable, refunded.

Loops:

- Watch the deposit addresses of registered intents on Arc for USDC arrival, then sweep.
- Poll Circle's attestation API for each swept burn until the attestation is available, then submit receiveMessage on the destination.
- Execute the receiver and record the result.
- For the direct CCTP route, poll the source burn and submit the Arc mint.

Every step is idempotent and safe to retry. Storage is SQLite. The service exposes a small HTTP API: register an intent, read an intent's status. Keys for Arc, the EVM destinations, and Stellar are held in environment variables and never in the repository.

## 9. SDK and widget

The SDK computes deposit addresses, builds and hashes intents, produces the typed data to sign, talks to the Gateway API, and reads status from the relayer. It runs in browsers and in Node.

The widget is a React component. Login and wallets come from Privy: email login with an embedded wallet, or an external wallet. The user picks a destination and adapter, enters an amount, chooses the Gateway or direct route, signs, and watches the state advance to executed. For non EVM destinations the widget asks for the destination account.

Supported source chains in the demo: Base Sepolia and Arbitrum Sepolia. Arc testnet is configured as a custom chain.

## 10. Agent surface

An MCP server exposes tools: list adapters, quote, create intent (returns the typed data to sign), submit, and status. A skill document describes how to add the widget and an adapter to an existing application.

## 11. Invariants

- Funds are at exactly one of: the deposit address, the hub in transit within a single transaction, a CCTP burn awaiting mint, the receiver's claimable balance, or the protocol position.
- No intent is swept twice, refunded after sweeping, or executed twice.
- feeBps is zero.
- Any party can complete sweep, refund, receive, and claim without the reference relayer, and none of them needs a signature from the user.

## 12. Demo configuration

- Source: Base Sepolia, CCTP domain 6.
- Hub: Arc testnet, chain id 5042002, CCTP and Gateway domain 26.
- EVM destination: Arbitrum Sepolia, CCTP domain 3, with an ERC 4626 USDC vault.
- Stellar destination: Stellar testnet, CCTP domain 27, Noether vault and market.
- Contract addresses for USDC, TokenMessengerV2, MessageTransmitterV2, Gateway, and the Stellar CCTP contracts live in a checked in config file per chain, taken from the Circle documentation.

## 13. Build plan

- September 4: skeleton and this specification.
- September 5 to 6: hub, forwarder, EVM receiver, ERC 4626 adapter, tests, deployment to Arc testnet and Arbitrum Sepolia.
- September 6 to 7: relayer core; first end to end deposit from Base Sepolia through Arc into the vault.
- September 8: SDK and widget with Privy; playground and relayer hosted on Azure.
- September 9 to 10: Stellar receiver, Noether adapters, end to end into NOE.
- September 11: margin top up through a Gateway delegate, MCP server, skill, documentation.
- September 12: video, architecture diagram, submission text.
- September 13: buffer and submission before 12:00 EDT.

## 14. Out of scope for version 1

Non USDC inputs, fee collection, permissioned adapters, mainnet deployment, Solana, Aptos, Injective, and Starknet execution. Routing to those chains works through the hub; execution adapters for them come later.
