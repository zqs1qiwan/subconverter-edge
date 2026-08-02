# SubconverterEdge

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zqs1qiwan/subconverter-edge)

Cloudflare Workers subscription converter with a React + Kumo frontend.

## Features

- Parse SS, SSR, VMess, VLESS, Trojan, Hysteria2, and Clash YAML subscriptions
- Convert to Clash, Sing-Box, Shadowrocket, V2Ray, Trojan, Shadowsocks, or mixed URI lists
- Generate a subscription URL from the web UI
- Generate QR codes for mobile clients that support scan import
- Optional emoji flags and node type include/exclude filters
- Single Worker deployment: static frontend and `/sub` API

## Fork and deploy

### One-click deploy

Click the button at the top of this README. Cloudflare will clone the repository, create a Worker, run the build command, and deploy it to your account.

After deployment, you can add a custom domain in the Cloudflare dashboard if needed.

### Manual deploy

Requirements:

- Node.js 18 or newer
- Cloudflare account
- Wrangler CLI login or `CLOUDFLARE_API_TOKEN`

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
npm install
npm run build
npx wrangler deploy
```

For a fork:

1. Fork this repository on GitHub.
2. Clone your fork.
3. Run `npm install && npm run build`.
4. Run `npx wrangler deploy`.
5. Add a custom domain in Cloudflare Workers settings if needed.

`wrangler.toml` does not include a default custom route. This keeps one-click deploy usable for any Cloudflare account. If you want to deploy from the CLI to a specific route, pass it explicitly:

```bash
npx wrangler deploy --route "sub.example.com/*"
```

The deployed frontend includes a "部署我自己的转换服务" badge in the top-right corner. It points to this upstream repository so users of forked deployments can find the source project.

## Usage

### Web UI

Open your Worker URL, paste a subscription URL, choose a target client, then click **生成订阅链接**. The page returns a subscription link and, for supported mobile clients, a QR code.

### API

```text
GET /sub?target=<target>&url=<subscription_url>
```

| Param | Required | Description |
|---|---:|---|
| `target` | yes | `clash`, `singbox`, `shadowrocket`, `v2ray`, `trojan`, `ss`, `mixed` |
| `url` | yes | Source subscription URL. Multiple URLs can be separated with `|` |
| `emoji` | no | `true` by default. Set `false` to disable emoji flags |
| `include` | no | Keep only specified node types, for example `ss,vmess` |
| `exclude` | no | Drop specified node types, for example `ssr` |

Example:

```bash
curl 'https://<your-worker-domain>/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub'
```

## Target formats

| Target | Output |
|---|---|
| `clash` | Clash YAML |
| `singbox` | Sing-Box JSON |
| `shadowrocket` | Base64-encoded mixed URI list |
| `v2ray` | Base64-encoded V2Ray URI list |
| `trojan` | Base64-encoded Trojan URI list |
| `ss` | Base64-encoded Shadowsocks URI list |
| `mixed` | Base64-encoded mixed URI list |

## Project structure

```text
src/
  frontend/  React + Kumo UI
  worker/    Worker router, parsers, converters
```

## Development

```bash
npm install
npm run dev
npm run build
```

Deploy:

```bash
npx wrangler deploy
```

## Verification

```bash
curl -s 'https://<your-worker-domain>/version'
curl -s 'https://<your-worker-domain>/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub'
```

## License

MIT
