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
- 短链接生成（SHA-256 确定性 hash，同一链接始终生成同一短链，KV 存储 365 天有效，到期自动清理）
- URL 参数预填（支持 `?url=&target=&backend=` 直接打开）
- 高级选项折叠
- 单 Worker 部署，前端和 API 一体

## 部署

### 方式一：一键部署

点击 README 顶部的 Deploy to Cloudflare 按钮，Cloudflare 会自动克隆仓库、创建 Worker、构建并部署到你的账号。KV namespace 也会自动创建。

> **隐私说明**：短链接的原始订阅地址会映射存储到 Cloudflare KV 中，有效期 365 天，到期后自动清理。同一订阅链接始终生成同一个短链接，不会产生重复。用户在使用短链接功能前请自行评估隐私风险。

### 方式二：Workers Builds 自动部署

在 Cloudflare Dashboard 中将你的 fork 仓库连接到 Worker：

1. 进入 Workers & Pages → 选择你的 Worker → Settings → Build
2. 连接 GitHub 仓库，选择你的 fork
3. 设置 Build command（将 `YOUR_KV_ID` 替换为你创建的 KV namespace ID）：
   ```
   sed -i "s/REPLACE_WITH_YOUR_KV_ID/YOUR_KV_ID/g" wrangler.toml && npm ci && npm run build
   ```
4. Deploy command 保持默认：`npx wrangler deploy`

之后每次 push 到 main 分支会自动触发构建和部署。

### 方式三：手动部署

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
```

创建 KV namespace 并替换 `wrangler.toml` 中的 `REPLACE_WITH_YOUR_KV_ID`：

```bash
# 创建 KV namespace，记下返回的 ID
npx wrangler kv namespace create SHORT_LINKS

# 将 wrangler.toml 中的 REPLACE_WITH_YOUR_KV_ID 替换为你的 KV namespace ID
# 也可以用 sed：
# sed -i "s/REPLACE_WITH_YOUR_KV_ID/<你的KV_ID>/g" wrangler.toml

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

访问 `/s/xxxxxx` 会 302 跳转到原始订阅地址。短链接通过 SHA-256 确定性 hash 生成，同一订阅链接始终映射到同一个短链接，不会产生重复。原始订阅地址存储在 Cloudflare KV 中，有效期 365 天，到期后自动清理。

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
- Short link generation (SHA-256 deterministic hash, same URL always maps to same short link, KV storage 365-day TTL)
- URL parameter prefill (`?url=&target=&backend=`)
- Advanced options collapsible
- Single Worker deployment

## Deployment

### Option 1: One-click deploy

Click the Deploy to Cloudflare button at the top of this README. Cloudflare will clone the repo, create the Worker, build, and deploy to your account. The KV namespace is automatically provisioned.

> **Privacy note**: The original subscription URL is stored in Cloudflare KV for 365 days, then automatically cleaned up. The same subscription link always maps to the same short link. Users should evaluate privacy risks before using the short link feature.

### Option 2: Workers Builds auto-deploy

Connect your fork to your Worker via Cloudflare Dashboard:

1. Go to Workers & Pages → select your Worker → Settings → Build
2. Connect your GitHub repository and select your fork
3. Set the Build command (replace `YOUR_KV_ID` with your KV namespace ID):
   ```
   sed -i "s/REPLACE_WITH_YOUR_KV_ID/YOUR_KV_ID/g" wrangler.toml && npm ci && npm run build
   ```
4. Keep the default Deploy command: `npx wrangler deploy`

Future pushes to the main branch will automatically trigger builds and deploys.

### Option 3: Manual deploy

```bash
git clone https://github.com/zqs1qiwan/subconverter-edge.git
cd subconverter-edge
```

Create a KV namespace and replace `REPLACE_WITH_YOUR_KV_ID` in `wrangler.toml`:

```bash
# Create a KV namespace, note the returned ID
npx wrangler kv namespace create SHORT_LINKS

# Replace REPLACE_WITH_YOUR_KV_ID in wrangler.toml with your KV namespace ID
# Or use sed:
# sed -i "s/REPLACE_WITH_YOUR_KV_ID/<YOUR_KV_ID>/g" wrangler.toml

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

Visiting `/s/xxxxxx` redirects 302 to the original subscription URL. Short links use SHA-256 deterministic hashing — the same subscription URL always maps to the same short link. The original URL is stored in Cloudflare KV with a 365-day TTL, then automatically cleaned up.

## License

MIT
