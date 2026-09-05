"use client";

import { InletProvider } from "@inletkit/widget";
import type { ReactNode } from "react";

export const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:8787";

export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <p className="muted">NEXT_PUBLIC_PRIVY_APP_ID is not set.</p>;
  return (
    <InletProvider privyAppId={appId} relayerUrl={relayerUrl}>
      {children}
    </InletProvider>
  );
}
