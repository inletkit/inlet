"use client";

import { DepositWidget, demoVaultDestination } from "@inletkit/widget";

export default function Home() {
  return (
    <main className="hero">
      <div>
        <h1>From any chain into any position.</h1>
        <p>
          Inlet takes USDC from the chain your user is on and delivers a position on the chain your protocol is on. One signature, native USDC only, Arc as the settlement hub, no wrapped tokens and nothing that can get stuck.
        </p>
        <ul className="facts">
          <li>
            <strong>Gateway route</strong>
            Signature only, no gas, USDC on Arc in under a second, position in about fifteen seconds.
          </li>
          <li>
            <strong>CCTP route</strong>
            Approve and burn on the source chain, fast transfer to Arc, position in about half a minute.
          </li>
          <li>
            <strong>For protocols</strong>
            One adapter file, three lines to mount, any ERC 4626 vault works with no custom code.
          </li>
        </ul>
      </div>
      <DepositWidget destinations={[demoVaultDestination]} />
    </main>
  );
}
