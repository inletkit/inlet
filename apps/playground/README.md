# Inlet playground

Docs and live demo. A static Next.js site that mounts the Inlet widget against a relayer.

```
cp .env.example .env.local
pnpm dev
```

Set `NEXT_PUBLIC_PRIVY_APP_ID` to your Privy app and `NEXT_PUBLIC_RELAYER_URL` to a running relayer. `pnpm build` writes the static site to `out/`.
