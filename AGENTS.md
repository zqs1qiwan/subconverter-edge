# SubconverterEdge Agent Guide

## Overview

SubconverterEdge is a Cloudflare Workers subscription converter. The Worker serves both the React + Kumo frontend and the `/sub` conversion API.

## Files

| Path | Role |
|---|---|
| `src/worker/index.ts` | Worker entry, routing, `/sub` API |
| `src/worker/parser.ts` | Subscription and node URI parsers |
| `src/worker/converter.ts` | Target format converters |
| `src/worker/types.ts` | Shared types |
| `src/frontend/App.tsx` | React UI |
| `src/frontend/styles.css` | UI layout and dark theme overrides |
| `README.md` | Public fork/deploy documentation |
| `wrangler.toml` | Worker deployment config |

## Current status

| Item | Value |
|---|---|
| UI title | `SubconverterEdge 在线订阅转换` |
| GitHub badge | Fixed top-right `部署我自己的转换服务` badge pointing to upstream repository |
| Targets | `clash`, `singbox`, `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| QR code | Enabled for `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| Default backend | 本站服务（current Worker origin） |

## Development

```bash
npm install
npm run build
```

## Deploy

```bash
npx wrangler deploy
```

If this repository is deployed from a CI or a fork, set Cloudflare credentials according to Wrangler documentation.

## Verification

```bash
curl -s 'https://<your-worker-domain>/version'
curl -s 'https://<your-worker-domain>/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub'
```

For production-like subscription testing, URL-encode the source subscription before passing it to `url=`.

## UI rules

- Keep the interface copy short and functional.
- Do not show raw conversion content in the primary flow.
- Primary action: generate the subscription link.
- Secondary action: copy the generated link. It stays disabled until generation succeeds.
- The GitHub badge must keep pointing to the upstream repository so forked deployments can find the source.

## Known implementation notes

- Shadowrocket uses the mixed base64 URI-list output.
- Hysteria2 nodes must remain `hysteria2://` in mixed and Shadowrocket output.
- `btoa()` is not UTF-8 safe. Use the existing safe encoder in converters.
- Kumo dark mode requires `document.documentElement.setAttribute('data-mode', 'dark')` in `src/frontend/main.tsx`.
