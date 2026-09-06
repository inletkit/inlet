import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@inletkit/widget/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Inlet",
  description: "From any chain into any position. A deposit rail for DeFi built on Circle Gateway, CCTP, and Arc.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="shell">
            <nav className="nav">
              <a className="brand" href="/">Inlet</a>
              <span>
                <a href="/integrate/">Integrate</a>
                <a href="/status/">Status</a>
                <a href="https://github.com/y4hyya/inlet" target="_blank" rel="noreferrer">GitHub</a>
              </span>
            </nav>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
