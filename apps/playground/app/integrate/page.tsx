import { testnetDestinations, testnetDeployments } from "@inletkit/sdk";

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
      <p>Any ERC 4626 vault over USDC needs no adapter at all: the generic one is registered on every receiver. Aave V3, Compound III and Uniswap v4 pools have adapters shipped in this repository; the guide for writing one is in <code>docs/adapters.md</code>.</p>

      <h2>3. Register on the hub</h2>
      <p>The hub on Arc keeps a registry of destination chains and receivers. Your receiver address is allowlisted for your chain's CCTP domain, and your adapter id is registered on the receiver.</p>

      <h2>4. Run a relayer, or use ours</h2>
      <p>The relayer is open source. It watches deposit addresses on Arc, sweeps the hub, relays Circle attestations, and executes adapters. Anything it does can also be done by hand: sweep, refund, receive, and claim are permissionless.</p>

      <h2>5. Or let an agent do it</h2>
      <p>The MCP server in <code>apps/mcp</code> exposes the same flow as tools: list destinations, quote, create an intent, submit the signed Gateway intent or the burn hash, and follow the status. The skill in <code>skills/inlet</code> teaches a coding agent to integrate the kit.</p>

      <h2>Destinations live on testnet</h2>
      <table>
        <thead>
          <tr><th>Destination</th><th>Chain</th><th>Adapter</th><th>Receiver</th></tr>
        </thead>
        <tbody>
          {testnetDestinations.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.name}</td>
              <td>{entry.chain}</td>
              <td>{entry.adapterName}</td>
              <td>{entry.receiver}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Inlet contracts on testnet</h2>
      <table>
        <tbody>
          <tr><th>Hub on Arc testnet</th><td>{testnetDeployments.arcTestnet.inletHub}</td></tr>
          <tr><th>Receiver on Arbitrum Sepolia</th><td>{testnetDeployments.arbitrumSepolia.inletReceiver}</td></tr>
          <tr><th>Receiver on Base Sepolia</th><td>{testnetDeployments.baseSepolia.inletReceiver}</td></tr>
          <tr><th>Receiver on Unichain Sepolia</th><td>{testnetDeployments.unichainSepolia.inletReceiver}</td></tr>
          <tr><th>Aave V3 adapter, Arbitrum Sepolia</th><td>{testnetDeployments.arbitrumSepolia.aaveV3Adapter}</td></tr>
          <tr><th>Compound III adapter, Base Sepolia</th><td>{testnetDeployments.baseSepolia.compoundV3Adapter}</td></tr>
          <tr><th>Uniswap v4 adapter, Unichain Sepolia</th><td>{testnetDeployments.unichainSepolia.uniswapV4LpAdapter}</td></tr>
          <tr><th>ERC 4626 adapters</th><td>{testnetDeployments.arbitrumSepolia.erc4626Adapter} on Arbitrum Sepolia and Unichain Sepolia, {testnetDeployments.baseSepolia.erc4626Adapter} on Base Sepolia</td></tr>
        </tbody>
      </table>
    </main>
  );
}
