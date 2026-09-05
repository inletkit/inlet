"use client";

import { InletRelayerClient, type IntentRecord } from "@inletkit/sdk";
import { StatusTimeline, demoVaultDestination } from "@inletkit/widget";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { relayerUrl } from "../providers";

function Status() {
  const params = useSearchParams();
  const hash = params.get("hash");
  const [record, setRecord] = useState<IntentRecord>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!hash) return;
    const client = new InletRelayerClient(relayerUrl);
    let stopped = false;
    const load = () =>
      client
        .getIntent(hash as `0x${string}`)
        .then((next) => !stopped && setRecord(next))
        .catch((cause) => !stopped && setError(String(cause)));
    void load();
    const handle = setInterval(load, 3000);
    return () => {
      stopped = true;
      clearInterval(handle);
    };
  }, [hash]);

  if (!hash) return <p className="muted">Add ?hash=0x… to the URL to follow a deposit.</p>;
  if (error) return <p className="muted">{error}</p>;
  if (!record) return <p className="muted">Loading…</p>;
  return (
    <div className="card">
      <p className="muted">Intent {hash}</p>
      <StatusTimeline record={record} destination={demoVaultDestination} />
    </div>
  );
}

export default function StatusPage() {
  return (
    <main className="doc">
      <h1>Deposit status</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Status />
      </Suspense>
    </main>
  );
}
