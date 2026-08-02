import { parseSubscription, parseSubInfo } from './parser';
import { convert } from './converter';
import type { TargetType } from './types';

export interface Env {
  ASSETS: Fetcher;
}

const TARGET_TYPES: Record<string, TargetType> = {
  clash: 'clash',
  singbox: 'singbox',
  'sing-box': 'singbox',
  v2ray: 'v2ray',
  trojan: 'trojan',
  ss: 'ss',
  mixed: 'mixed',
  shadowrocket: 'shadowrocket',
  sr: 'shadowrocket',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// 远程配置 URL（Clash/Sing-Box 用户常用的公开配置模板）
const REMOTE_CONFIGS: Record<string, string> = {
  'default': '',
  'clash-ruleset-a': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini',
  'clash-ruleset-b': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini',
  'clash-ruleset-c': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_MultiMode.ini',
  'clash-ruleset-d': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_NoAuto.ini',
  'clash-ruleset-e': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_NoReject.ini',
  'clash-ruleset-f': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini',
  'clash-ruleset-g': 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_FalseIP.ini',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // API: /sub
    if (url.pathname === '/sub' || url.pathname === '/sub/') {
      return handleSub(request, url);
    }

    // API: /version
    if (url.pathname === '/version') {
      return new Response('subconverter-edge v1.1.0', { headers: { 'Content-Type': 'text/plain' } });
    }

    // API: /api/shorten — 创建短链接（加密编码，不存储）
    if (url.pathname === '/api/shorten' && request.method === 'POST') {
      return handleShorten(request);
    }

    // API: /api/configs — 返回远程配置列表
    if (url.pathname === '/api/configs') {
      const configs = Object.entries(REMOTE_CONFIGS).filter(([, v]) => v).map(([k, v]) => ({
        id: k,
        url: v,
        name: k.replace('clash-ruleset-', 'ACL4SSR '),
      }));
      return new Response(JSON.stringify(configs), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 短链接跳转: /s/<hash> — 边缘解密，不查存储
    if (url.pathname.startsWith('/s/') && request.method === 'GET') {
      return handleRedirect(url);
    }

    // 静态资源
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleSub(request: Request, url: URL): Promise<Response> {
  const target = url.searchParams.get('target') || 'clash';
  const subUrl = url.searchParams.get('url');
  const emoji = url.searchParams.get('emoji') !== 'false';
  const includeNodeTypes = url.searchParams.get('include') || '';
  const excludeNodeTypes = url.searchParams.get('exclude') || '';
  const remoteConfig = url.searchParams.get('config') || '';

  if (!subUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const targetType = TARGET_TYPES[target] || 'clash';
  let allNodes: any[] = [];
  let subInfo: any = undefined;

  const urls = subUrl.split('|').filter(u => u.trim());

  for (const u of urls) {
    const trimmed = u.trim();
    if (trimmed.startsWith('ss://') || trimmed.startsWith('ssr://') || trimmed.startsWith('vmess://') || trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) {
      const result = parseSubscription(trimmed, 'text/plain');
      allNodes.push(...result.nodes);
      continue;
    }
    try {
      const resp = await fetch(trimmed, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const content = await resp.text();
      const result = parseSubscription(content, resp.headers.get('content-type') || '');
      allNodes.push(...result.nodes);
      if (result.subInfo && !subInfo) subInfo = result.subInfo;
    } catch {
      // ignore
    }
  }

  if (includeNodeTypes) {
    const types = includeNodeTypes.split(',').map(t => t.trim());
    allNodes = allNodes.filter(n => types.includes(n.type));
  }
  if (excludeNodeTypes) {
    const types = excludeNodeTypes.split(',').map(t => t.trim());
    allNodes = allNodes.filter(n => !types.includes(n.type));
  }

  if (emoji) {
    allNodes = allNodes.map(n => {
      if (!n.name.match(/[\u{1F300}-\u{1F9FF}]/u)) {
        n.name = addEmoji(n.name);
      }
      return n;
    });
  }

  if (allNodes.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid nodes found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const output = convert(allNodes, targetType);

  const responseHeaders: Record<string, string> = {
    'Content-Type': targetType === 'clash' ? 'text/yaml; charset=utf-8'
      : targetType === 'singbox' ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8',
    ...CORS_HEADERS,
  };

  // 注入远程配置（仅 Clash target）
  let finalOutput = output;
  if (remoteConfig && REMOTE_CONFIGS[remoteConfig] && targetType === 'clash') {
    try {
      const configResp = await fetch(REMOTE_CONFIGS[remoteConfig]);
      const configText = await configResp.text();
      finalOutput = mergeClashConfig(output, configText);
    } catch {
      // 配置拉取失败则用默认输出
    }
  }

  if (subInfo) {
    responseHeaders['subscription-userinfo'] = `upload=${subInfo.upload}; download=${subInfo.download}; total=${subInfo.total}; expire=${subInfo.expire}`;
  }

  return new Response(finalOutput, { headers: responseHeaders });
}

function mergeClashConfig(baseYaml: string, configIni: string): string {
  // 简单策略：在 Clash YAML 末尾追加 remote config 的规则段
  // remote config 是 INI 格式的 ACL4SSR 配置模板，不是直接 YAML
  // 这里不执行完整 subconverter 逻辑，只把 config URL 作为参数注释附在 YAML 顶部
  const configMarker = `# Remote Config: ${configIni.split('\n')[0] || ''}\n`;
  return configMarker + baseYaml;
}

// ── 短链接（无存储加密方案）──
// 原始 URL 用 AES-GCM 加密，密文 base36 编码为短链 hash
// 访问 /s/:hash 时在边缘解密并 302 跳转
// 不使用 KV，不存储任何用户数据，链接永久有效

const SECRET_KEY = 'subconverter-edge-v1'; // 固定密钥种子，fork 后可改

async function getAesKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('subconv-salt'), iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bytesToBase64url(bytes: Uint8Array): string {
  // base64url encoding (no padding) — much shorter than base36
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(data.buffer as ArrayBuffer);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(data.buffer as ArrayBuffer);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

async function handleShorten(request: Request): Promise<Response> {
  try {
    const body = await request.json() as { url: string };
    const targetUrl = body.url;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return jsonError('Invalid URL');
    }

    const key = await getAesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    // 先 deflate 压缩，再加密，缩短 hash 长度
    const encoded = new TextEncoder().encode(targetUrl);
    const compressed = await compressDeflate(encoded);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed.buffer as ArrayBuffer),
    );

    // IV (12 bytes) + ciphertext 拼接后 base36 编码
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);
    const hash = bytesToBase64url(combined);

    const shortUrl = `${new URL(request.url).origin}/s/${hash}`;
    return new Response(JSON.stringify({ short: shortUrl }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (e: any) {
    return jsonError(e.message || 'Failed');
  }
}

async function handleRedirect(url: URL): Promise<Response> {
  const hash = url.pathname.slice(3);
  if (!hash || hash.length < 4) return new Response('Not Found', { status: 404 });

  try {
    const combined = base64urlToBytes(hash);
    if (combined.length < 13) return new Response('Not Found', { status: 404 });

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await getAesKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    const decompressed = await decompressDeflate(new Uint8Array(plaintext));
    const targetUrl = new TextDecoder().decode(decompressed);
    if (!targetUrl.startsWith('http')) return new Response('Not Found', { status: 404 });

    return new Response(null, {
      status: 302,
      headers: { Location: targetUrl, ...CORS_HEADERS },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

function jsonError(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function addEmoji(name: string): string {
  const emojiMap: [RegExp, string][] = [
    [/香港|HK|Hong Kong/i, '🇭🇰'],
    [/台湾|TW|Taiwan/i, '🇹🇼'],
    [/日本|JP|Japan|东京|大阪/i, '🇯🇵'],
    [/韩国|KR|Korea|首尔/i, '🇰🇷'],
    [/新加坡|SG|Singapore|狮城/i, '🇸🇬'],
    [/美国|US|United States|洛杉矶|硅谷|西雅图/i, '🇺🇸'],
    [/英国|UK|United Kingdom/i, '🇬🇧'],
    [/德国|DE|Germany|法兰克福/i, '🇩🇪'],
    [/法国|FR|France|巴黎/i, '🇫🇷'],
    [/加拿大|CA|Canada|多伦多/i, '🇨🇦'],
    [/澳大利亚|AU|Australia|悉尼/i, '🇦🇺'],
    [/土耳其|TR|Turkey/i, '🇹🇷'],
    [/印度|IN|India/i, '🇮🇳'],
    [/俄罗斯|RU|Russia|莫斯科/i, '🇷🇺'],
    [/巴西|BR|Brazil/i, '🇧🇷'],
    [/泰国|TH|Thailand/i, '🇹🇭'],
    [/越南|VN|Vietnam/i, '🇻🇳'],
    [/菲律宾|PH|Philippines/i, '🇵🇭'],
    [/印尼|ID|Indonesia/i, '🇮🇩'],
    [/马来西亚|MY|Malaysia/i, '🇲🇾'],
  ];
  for (const [re, emoji] of emojiMap) {
    if (re.test(name)) return `${emoji} ${name}`;
  }
  return name;
}
