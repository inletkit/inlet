# @inletkit/widget

The React widget for Inlet deposits. It uses wagmi hooks for the wallet, so it drops into any app that already runs wagmi. Apps without a wallet stack can wrap it in `InletProvider`, which brings Privy and wagmi preconfigured for Base Sepolia, Arbitrum Sepolia, and Arc testnet.

```tsx
import { InletProvider, DepositWidget, demoVaultDestination } from "@inletkit/widget";
import "@inletkit/widget/styles.css";

<InletProvider privyAppId={PRIVY_APP_ID} relayerUrl={RELAYER_URL}>
  <DepositWidget destinations={[demoVaultDestination]} />
</InletProvider>
```

The widget picks Gateway when the user's unified balance covers the amount plus fee, which makes the deposit a single signature with no gas, and falls back to a CCTP fast transfer otherwise.
