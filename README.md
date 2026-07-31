# subconverter-edge

Cloudflare Workers subscription converter on sub.laobaitv.net.

## Architecture

Worker (sub.laobaitv.net)
- GET /  -> React SPA
- GET /sub?target=&url= -> convert API
- GET /version -> version info

## Supported

Input: SS, SSR, VMess, VLESS, Trojan, Clash YAML
Output: Clash, Sing-Box, V2Ray, SS, Trojan, Mixed

## Deploy

git push -> CF Workers auto-deploy
