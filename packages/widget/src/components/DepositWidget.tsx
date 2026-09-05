import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { defaultSources } from "../config.js";
import { useInlet } from "../context.js";
import { short, usdc } from "../format.js";
import type { Destination, RoutePreference, SourceChain } from "../types.js";
import { useDeposit } from "../useDeposit.js";
import { StatusTimeline } from "./StatusTimeline.js";

export interface DepositWidgetProps {
  destinations: Destination[];
  relayerUrl?: string;
  sources?: SourceChain[];
  defaultAmount?: string;
  title?: string;
}

export function DepositWidget({ destinations, relayerUrl, sources = defaultSources, defaultAmount = "1", title = "Deposit from any chain" }: DepositWidgetProps) {
  const inlet = useInlet();
  const url = relayerUrl ?? inlet.relayerUrl;
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [destinationId, setDestinationId] = useState(destinations[0]?.id);
  const [sourceDomain, setSourceDomain] = useState(sources[0]?.domain);
  const [amount, setAmount] = useState(defaultAmount);
  const [preference, setPreference] = useState<RoutePreference>("auto");

  const destination = destinations.find((entry) => entry.id === destinationId) ?? destinations[0];
  const source = sources.find((entry) => entry.domain === sourceDomain) ?? sources[0];
  const { state, quote, deposit, fundGateway, reset } = useDeposit({ relayerUrl: url, source, destination });
  const [gatewayTx, setGatewayTx] = useState<string>();

  useEffect(() => {
    const connected = sources.find((entry) => entry.chainId === chainId);
    if (connected) setSourceDomain(connected.domain);
  }, [chainId, sources]);

  const phase = useRef(state.phase);
  phase.current = state.phase;

  useEffect(() => {
    if (!isConnected || !address) return;
    const handle = setTimeout(() => {
      if (["creating", "signing", "sending", "tracking", "done"].includes(phase.current)) return;
      void quote(amount, preference);
    }, 400);
    return () => clearTimeout(handle);
  }, [amount, preference, isConnected, address, source, destination, quote]);

  const busy = ["creating", "signing", "sending"].includes(state.phase);
  const quoting = state.phase === "quoting";
  const tracking = state.phase === "tracking" || state.phase === "done";

  return (
    <section className="inlet">
      <header className="inlet-header">
        <h2 className="inlet-title">{title}</h2>
        {isConnected && address ? (
          <button className="inlet-link" type="button" onClick={() => (inlet.logout ? inlet.logout() : disconnect())}>
            {short(address)}
          </button>
        ) : null}
      </header>

      {!isConnected ? (
        <button
          className="inlet-primary"
          type="button"
          disabled={!inlet.ready}
          onClick={() => (inlet.login ? inlet.login() : connectors[0] ? connect({ connector: connectors[0] }) : undefined)}
        >
          {inlet.login ? "Log in" : "Connect wallet"}
        </button>
      ) : tracking && state.record ? (
        <div className="inlet-body">
          <StatusTimeline record={state.record} destination={destination} sourceExplorer={source.explorer} />
          {state.phase === "done" ? (
            <button className="inlet-secondary" type="button" onClick={reset}>
              New deposit
            </button>
          ) : null}
        </div>
      ) : (
        <div className="inlet-body">
          <label className="inlet-field">
            <span>Into</span>
            <select id="inlet-destination" name="destination" value={destination?.id} onChange={(event) => setDestinationId(event.target.value)} disabled={busy}>
              {destinations.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inlet-field">
            <span>From</span>
            <select id="inlet-source" name="source" value={source?.domain} onChange={(event) => setSourceDomain(Number(event.target.value))} disabled={busy}>
              {sources.map((entry) => (
                <option key={entry.domain} value={entry.domain}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inlet-field">
            <span>Amount</span>
            <input id="inlet-amount" name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} />
          </label>
          <div className="inlet-routes">
            {(["auto", "gateway", "cctp"] as RoutePreference[]).map((option) => (
              <button key={option} type="button" className={`inlet-chip ${preference === option ? "inlet-chip-on" : ""}`} onClick={() => setPreference(option)} disabled={busy}>
                {option === "auto" ? "Best route" : option === "gateway" ? "Gateway" : "CCTP"}
              </button>
            ))}
          </div>

          {state.quote ? (
            <dl className={`inlet-quote ${quoting ? "inlet-quote-stale" : ""}`}>
              <div>
                <dt>Route</dt>
                <dd>{state.quote.route === "gateway" ? "Gateway, one signature, no gas" : "CCTP fast transfer, approve and burn"}</dd>
              </div>
              <div>
                <dt>You send</dt>
                <dd>{usdc(state.quote.sendAmount)}</dd>
              </div>
              <div>
                <dt>Position receives</dt>
                <dd>{usdc(state.quote.intentAmount)}</dd>
              </div>
              <div>
                <dt>Circle fee, at most</dt>
                <dd>{usdc(state.quote.circleFee)}</dd>
              </div>
              <div>
                <dt>Wallet USDC</dt>
                <dd>{usdc(state.quote.walletUsdc)}</dd>
              </div>
              <div>
                <dt>Gateway balance</dt>
                <dd>{usdc(state.quote.gatewayAvailable)}</dd>
              </div>
            </dl>
          ) : null}

          {state.quote?.route === "cctp" && state.quote.needsGas ? <p className="inlet-warn">This route needs a little ETH on {source.name} for two transactions. Use Gateway to skip gas entirely.</p> : null}
          {state.quote?.route === "cctp" && state.quote.walletUsdc < state.quote.sendAmount ? <p className="inlet-warn">Not enough USDC in the wallet on {source.name}.</p> : null}
          {state.quote?.route === "gateway" && state.quote.gatewayAvailable < state.quote.sendAmount + state.quote.circleFee ? <p className="inlet-warn">Gateway balance does not cover the amount plus fee.</p> : null}
          {gatewayTx ? (
            <p className="inlet-warn">
              Deposited into your Gateway balance in{" "}
              <a className="inlet-step-link" href={source.explorer + gatewayTx} target="_blank" rel="noreferrer">
                {short(gatewayTx)}
              </a>
              . Circle credits it once {source.name} reaches finality, usually fifteen to twenty minutes.
            </p>
          ) : null}
          {state.error ? <p className="inlet-warn">{state.error}</p> : null}

          <button
            className="inlet-primary"
            type="button"
            disabled={!state.quote || busy || quoting}
            onClick={() => state.quote && void deposit(state.quote)}
          >
            {state.phase === "creating" ? "Registering intent" : state.phase === "signing" ? "Waiting for your wallet" : state.phase === "sending" ? "Sending" : quoting ? "Quoting" : "Deposit"}
          </button>
          <button
            className="inlet-secondary"
            type="button"
            disabled={busy || state.phase === "quoting"}
            onClick={() => void fundGateway(amount).then((tx) => tx && setGatewayTx(tx))}
          >
            Add {amount || "0"} USDC to my Gateway balance
          </button>
        </div>
      )}
    </section>
  );
}
