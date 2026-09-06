# Diagrams

| File | Shows |
| --- | --- |
| `architecture` | How a deposit moves: wallet or Gateway balance on the source chain, deposit address and hub on Arc, receiver, adapter and position on the destination chain, the relayer and Circle attestation, the refund path |
| `deposit-sequence` | One deposit over time, with the Gateway route and the CCTP route as the two branches |
| `intent-lifecycle` | The states an intent moves through, including claimable, refunding, refunded and expired |
| `deployment` | Where everything runs on testnet: the browser, Azure, Circle's APIs, Arc and the Sepolia testnets |

Each diagram is a self contained HTML file with inline SVG, plus the exported SVG and a 2x PNG. They follow the dark variant of the [diagram design system](https://github.com/cathrynlavery/diagram-design): one accent per diagram, orthogonal connectors, masked labels, a legend strip, and at most nine nodes.

To change a diagram edit `build.py` and run it, then export:

```
python3 build.py .
python3 -m venv .venv && .venv/bin/pip install playwright && .venv/bin/playwright install chromium
.venv/bin/python export.py architecture.html deposit-sequence.html intent-lifecycle.html deployment.html
```
