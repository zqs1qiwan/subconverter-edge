# SubconverterEdge Agent Guide

## Overview

Cloudflare Workers subscription converter. Single Worker serves React + Kumo frontend and `/sub` conversion API. Short links use SHA-256 deterministic hash with KV storage (365-day TTL).

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
| Version | `v1.2.0` |
| UI title | `SubconverterEdge` |
| Subtitle | `在线订阅转换 · 支持多客户端格式 · 一键生成订阅地址和二维码` |
| GitHub badge | `部署我自己的转换服务` in top-right |
| Targets | `clash`, `singbox`, `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` (unknown target returns 400) |
| QR code | `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| Remote config | ACL4SSR .ini parsed into rule-providers + proxy-groups + rules, Clash only; also accepts full config URL |
| Short link | SHA-256 deterministic hash, 10 chars, KV storage, 365-day TTL |
| URL prefill | `?url=&target=&backend=&emoji=&include=&exclude=&config=&rename=&sort=&udp=&scv=&diydns=&append_type=&list=&tls13=&diyua=&interval=&filename=` |
| Backend options | `本站服务`, `api.v1.mk（肥羊增强型后端）` |
| Advanced | Collapsible: remote config, include/exclude (type or keyword), rename, sort, udp/scv/diydns/append_type/list/tls13, diyua, interval, ads, emoji |

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
# → subconverter-edge v1.2.0

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
- Remote config (ACL4SSR .ini) is parsed: `ruleset=` -> rule-providers + RULE-SET rules, `custom_proxy_group=` -> proxy-groups (filter `.*` = all nodes, regex = matching nodes). GEOIP/FINAL special-cased.
- Clash YAML nodes preserve original fields in `extra` for lossless Clash round-trip; AnyTLS/Hysteria2 (mport/obfs/alpn/fp/ports/up/down) and http/socks5/tuic types pass through Clash output.
- `raw` URI passthrough is skipped when name changed (emoji/rename/append_type) so mixed/shadowrocket/v2ray reflect new names.
- Sing-Box selector only references actually emitted outbounds (SSR/unknown skipped, no dangling refs).
- `ss`/`trojan` targets return 400 when no nodes of that type exist (no empty 200).
- Upstream fetch: 15s timeout, non-2xx treated as error, private-IP hosts blocked (SSRF guard), warnings in `X-Upstream-Warnings`, count in `X-Node-Count`.
- include/exclude dual mode: all tokens are known types -> type filter; otherwise keyword regex on name.
