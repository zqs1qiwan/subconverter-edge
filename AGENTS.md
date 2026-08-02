# SubconverterEdge Agent Guide

## Overview

Cloudflare Workers subscription converter. Single Worker serves React + Kumo frontend and `/sub` conversion API. Short links use AES-GCM encryption encoded in the hash itself — no KV, no database, no stored user data.

## Files

| Path | Role |
|---|---|
| `src/worker/index.ts` | Worker entry, routing, `/sub`, `/api/shorten`, `/api/configs`, `/s/:hash` redirect |
| `src/worker/parser.ts` | Subscription and node URI parsers |
| `src/worker/converter.ts` | Target format converters |
| `src/worker/types.ts` | Shared types |
| `src/frontend/App.tsx` | React UI |
| `src/frontend/styles.css` | UI layout and dark theme overrides |
| `README.md` | Public bilingual documentation (Chinese first) |
| `wrangler.toml` | Worker + KV config, no default route |

## Current status

| Item | Value |
|---|---|
| Version | `v1.1.0` |
| UI title | `SubconverterEdge` |
| Subtitle | `在线订阅转换 · 支持多客户端格式 · 一键生成订阅地址和二维码` |
| GitHub badge | `部署我自己的转换服务` in top-right |
| Targets | `clash`, `singbox`, `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| QR code | `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| Remote config | ACL4SSR templates, Clash only |
| Short link | AES-GCM encrypted, encoded in hash, no storage, permanent |
| URL prefill | `?url=&target=&backend=&emoji=&include=&exclude=&config=` |
| Backend options | `本站服务`, `api.v1.mk（肥羊增强型后端）` |
| Advanced | Collapsible: remote config, include, exclude, emoji |

## Development

```bash
npm install
npm run build
```

## Deploy

Default: `*.workers.dev` (no custom route in `wrangler.toml`).

```bash
npx wrangler deploy
```

Production:

```bash
npx wrangler deploy --route "sub.laobaitv.net/*"
```

## Verification

```bash
curl -s 'https://<your-worker-domain>/version'
# → subconverter-edge v1.1.0

curl -s 'https://<your-worker-domain>/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub'

curl -s 'https://<your-worker-domain>/api/configs'
```

## UI rules

- Buttons are native `<button>`, not Kumo `Button` component (Kumo Button styling is not controllable).
- Primary action: generate subscription link.
- Secondary action: copy link. Disabled until generation succeeds.
- Short link section appears after generation.
- Advanced options collapsed by default.
- GitHub badge always points to upstream repository.

## Known implementation notes

- Shadowrocket uses mixed base64 URI-list output.
- Hysteria2 nodes must remain `hysteria2://` in mixed and Shadowrocket output.
- `btoa()` is not UTF-8 safe. Use `safeBtoa()` in converters.
- Kumo dark mode requires `document.documentElement.setAttribute('data-mode', 'dark')` in `src/frontend/main.tsx`.
- Remote config is appended as a comment marker in Clash YAML output. Full ACL4SSR merge is not implemented.
