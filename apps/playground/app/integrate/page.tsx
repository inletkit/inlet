export default function Integrate() {
  return (
    <main className="doc">
      <h1>Integrate Inlet</h1>
      <p>Inlet is a deposit rail. Your users keep their USDC wherever it is; your protocol receives a position. The pieces: a hub on Arc, a receiver on your chain, an adapter that knows how to deposit into your protocol, a relayer, and this widget.</p>

      <h2>1. Mount the widget</h2>
      <pre><code>{`npm install @inletkit/widget @inletkit/sdk

import { InletProvider, DepositWidget, erc4626Destination } from "@inletkit/widget";
import "@inletkit/widget/styles.css";

const vault = erc4626Destination({
  id: "my-vault",
  name: "My USDC Vault",
  destinationDomain: 3,
  receiver: "0x84f3433550d1B6FB7f0BE197eA9faA256962408B",
  vault: "0xYourVault",
});

<InletProvider privyAppId={PRIVY_APP_ID} relayerUrl={RELAYER_URL}>
  <DepositWidget destinations={[vault]} />
</InletProvider>`}</code></pre>
      <p>Already running wagmi? Skip the provider and render the widget inside your own WagmiProvider. It only uses wagmi hooks.</p>

      <h2>2. Write an adapter</h2>
      <p>An adapter is a stateless contract with one function. The receiver approves it for the amount and calls it with the beneficiary and your data.</p>
      <pre><code>{`interface IInletAdapter {
  function deposit(address usdc, uint256 amount, bytes32 beneficiary, bytes calldata data)
    external returns (bytes memory result);
}`}</code></pre>
      <p>Any ERC 4626 vault over USDC needs no adapter at all: the generic one is registered on every receiver.</p>

      <h2>3. Register on the hub</h2>
      <p>The hub on Arc keeps a registry of destination chains and receivers. Your receiver address is allowlisted for your chain's CCTP domain, and your adapter id is registered on the receiver.</p>

      <h2>4. Run a relayer, or use ours</h2>
      <p>The relayer is open source. It watches deposit addresses on Arc, sweeps the hub, relays Circle attestations, and executes adapters. Anything it does can also be done by hand: sweep, refund, receive, and claim are permissionless.</p>

      <h2>Addresses on testnet</h2>
      <table>
        <tbody>
          <tr><th>Hub on Arc testnet</th><td>0x84f3433550d1B6FB7f0BE197eA9faA256962408B</td></tr>
          <tr><th>Receiver on Arbitrum Sepolia</th><td>0x84f3433550d1B6FB7f0BE197eA9faA256962408B</td></tr>
          <tr><th>ERC 4626 adapter</th><td>0x912c690f95a381e72F63a378fd906C6294412Fc9</td></tr>
          <tr><th>Demo vault</th><td>0x55da7c3B5e99816A7a9cD9dc47e24bfd7B19D6ED</td></tr>
        </tbody>
      </table>
    </main>
  );
}
