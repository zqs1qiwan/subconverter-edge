# SubconverterEdge

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zqs1qiwan/subconverter-edge)

Cloudflare Workers 订阅转换服务，前端使用 React + Kumo，后端在同一个 Worker 内完成解析和转换。

## 功能

- 解析 SS / SSR / VMess / VLESS / Trojan / Hysteria2 / Clash YAML 订阅
- 转换为 Clash / Sing-Box / Shadowrocket / V2Ray / Trojan / Shadowsocks / Mixed 格式
- 生成订阅链接和二维码（移动端可扫码导入）
- 远程配置选择（ACL4SSR 规则模板，仅 Clash）
- 节点类型过滤（包含 / 排除）
- Emoji 国旗
- 短链接生成（AES-GCM 加密编码到 hash 本身，不存储用户数据，永久有效）
- URL 参数预填（支持 `?url=&target=&backend=` 直接打开）
- 高级选项折叠
- 单 Worker 部署，前端和 API 一体

## 一键部署

点击 README 顶部的 Deploy to Cloudflare 按钮，Cloudflare 会自动克隆仓库、创建 Worker、构建并部署到你的账号。

短链接功能使用 AES-GCM 加密编码，不依赖 KV 存储，无需额外配置。

部署后可在 Cloudflare Dashboard 绑定自定义域名。

## 手动部署

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
npm install
npm run build
npx wrangler deploy
```

如果需要部署到指定域名：

```bash
npx wrangler deploy --route "sub.example.com/*"
```

`wrangler.toml` 不包含默认自定义路由，默认使用 `*.workers.dev` 域名。

## 使用

### Web UI

打开 Worker 地址，粘贴订阅链接，选择客户端格式，点击「生成订阅链接」。

生成后会显示订阅地址和二维码（移动端格式），点击「复制链接」即可。

高级选项中可以选择远程配置、节点过滤和 Emoji。

### API

```text
GET /sub?target=<target>&url=<subscription_url>
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `target` | 是 | `clash` `singbox` `shadowrocket` `v2ray` `trojan` `ss` `mixed` |
| `url` | 是 | 订阅链接，多个用 `|` 分隔 |
| `emoji` | 否 | 默认 `true`，设 `false` 关闭国旗 |
| `include` | 否 | 只保留指定类型，如 `ss,vmess` |
| `exclude` | 否 | 排除指定类型，如 `ssr` |
| `config` | 否 | 远程配置 ID，如 `clash-ruleset-a` |

### 短链接

```text
POST /api/shorten
Content-Type: application/json

{"url": "https://your-worker.workers.dev/sub?target=clash&url=..."}
```

返回 `{ "short": "https://your-worker.workers.dev/s/xxxxxx" }`

访问 `/s/xxxxxx` 会 302 跳转到原始订阅地址。短链 hash 包含 AES-GCM 加密的原始 URL，在边缘解密，不存储在任何数据库或 KV 中。

### 远程配置列表

```text
GET /api/configs
```

## 目标格式

| 目标 | 输出 |
|---|---|
| `clash` | Clash YAML |
| `singbox` | Sing-Box JSON |
| `shadowrocket` | Base64 编码的 Mixed URI 列表 |
| `v2ray` | Base64 编码的 V2Ray URI 列表 |
| `trojan` | Base64 编码的 Trojan URI 列表 |
| `ss` | Base64 编码的 Shadowsocks URI 列表 |
| `mixed` | Base64 编码的 Mixed URI 列表 |

## 项目结构

```text
src/
  frontend/  React + Kumo UI
  worker/    Worker 路由、解析器、转换器、短链接
```

## 开发

```bash
npm install
npm run dev
npm run build
```

部署：

```bash
npx wrangler deploy
```

## 前端角标

页面右上角有「部署我自己的转换服务」角标，指向本仓库。Fork 后部署的服务也会展示此角标，用户可以点击找到上游开源项目。

## License

MIT

---

# SubconverterEdge (English)

Cloudflare Workers subscription converter with a React + Kumo frontend and backend in a single Worker.

## Features

- Parse SS / SSR / VMess / VLESS / Trojan / Hysteria2 / Clash YAML subscriptions
- Convert to Clash / Sing-Box / Shadowrocket / V2Ray / Trojan / Shadowsocks / Mixed
- Generate subscription URL and QR code (scan import for mobile clients)
- Remote config selection (ACL4SSR rule templates, Clash only)
- Node type filtering (include / exclude)
- Emoji flags
- Short link generation (SHA-256 hash, KV storage, 30-day TTL)
- URL parameter prefill (`?url=&target=&backend=`)
- Advanced options collapsible
- Single Worker deployment

## One-click deploy

Click the Deploy to Cloudflare button at the top of this README. Cloudflare will clone the repo, create the Worker, build, and deploy to your account.

A KV namespace is automatically provisioned for short link storage.

After deployment, you can add a custom domain in the Cloudflare dashboard.

## Manual deploy

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
npm install
npm run build
npx wrangler deploy
```

To deploy to a custom route:

```bash
npx wrangler deploy --route "sub.example.com/*"
```

`wrangler.toml` has no default custom route. The default domain is `*.workers.dev`.

## Usage

### Web UI

Open your Worker URL, paste a subscription link, select a target client, and click the generate button.

The subscription URL and QR code (for mobile formats) will appear. Click copy to use.

Advanced options include remote config, node filtering, and emoji flags.

### API

```text
GET /sub?target=<target>&url=<subscription_url>
```

| Param | Required | Description |
|---|---|---|
| `target` | yes | `clash` `singbox` `shadowrocket` `v2ray` `trojan` `ss` `mixed` |
| `url` | yes | Subscription URL, pipe-separated for multiple |
| `emoji` | no | `true` by default |
| `include` | no | Keep only specified types, e.g. `ss,vmess` |
| `exclude` | no | Drop specified types, e.g. `ssr` |
| `config` | no | Remote config ID, e.g. `clash-ruleset-a` |

### Short link

```text
POST /api/shorten
Content-Type: application/json

{"url": "https://your-worker.workers.dev/sub?target=clash&url=..."}
```

Returns `{ "short": "https://your-worker.workers.dev/s/xxxxxx" }`

Visiting `/s/xxxxxx` redirects 302 to the original subscription URL.

## License

MIT
