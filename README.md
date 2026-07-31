# subconverter-edge

Cloudflare Workers subscription converter with [Kumo](https://github.com/cloudflare/kumo) frontend.

## Features

- Parse SS/SSR/VMess/VLESS(Reality)/Trojan/Hysteria2/Clash YAML
- Convert to Clash/Sing-Box/V2Ray/SS/Trojan/Mixed
- Single Worker: SPA + API
- Emoji flags
- Node type filter (include/exclude)

## Deploy

Requirements: Node 18+, pnpm, Cloudflare account.

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
pnpm install
pnpm build
npx wrangler deploy
```

First deploy requires npx wrangler login.

## Custom Domain (optional)

Edit wrangler.toml routes to your domain, or remove [[routes]] to use *.workers.dev.

## Usage

### Web UI

Visit your Worker URL, enter subscription link, select target format, click generate.

### API

GET /sub?target=<target>&url=<subscription_url>

| Param | Required | Description |
|-------|----------|-------------|
| target | yes | clash/singbox/v2ray/trojan/ss/mixed |
| url | yes | subscription URL (pipe-separated for multiple) |
| emoji | no | true (default) / false |
| include | no | keep only specified types (e.g. ss,vmess) |
| exclude | no | drop specified types (e.g. ssr) |

## Tech Stack

- Backend: Cloudflare Workers (TypeScript)
- Frontend: React 19 + Vite + @cloudflare/kumo
- Deploy: Wrangler CLI

## Structure

src/
  worker/    # backend: parser + converter + router
  frontend/  # React SPA

## License

MIT
