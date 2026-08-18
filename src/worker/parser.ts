import type { ProxyNode, ParseResult, SubscriptionInfo } from './types';

// Base64 解码
function base64Decode(str: string): string {
  try {
    // URL-safe base64 -> standard
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    // Remove whitespace/newlines
    s = s.replace(/\s/g, '');
    const pad = s.length % 4;
    const b64 = pad ? s + '='.repeat(4 - pad) : s;
    return atob(b64);
  } catch {
    return str;
  }
}

// 从 subscription-info header 解析流量信息
export function parseSubInfo(headers: Headers): SubscriptionInfo | undefined {
  const info = headers.get('subscription-userinfo') || headers.get('Subscription-Userinfo');
  if (!info) return undefined;
  const parts = info.split(';').map(s => s.trim());
  const result: SubscriptionInfo = { upload: 0, download: 0, total: 0, expire: 0 };
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (!k || !v) continue;
    const num = parseInt(v, 10);
    if (k === 'upload') result.upload = num;
    else if (k === 'download') result.download = num;
    else if (k === 'total') result.total = num;
    else if (k === 'expire') result.expire = num;
  }
  return result;
}

// SS URI: ss://base64(method:password)@server:port#name  或 ss://base64(method:password@server:port)#name
function parseSS(uri: string): ProxyNode | null {
  try {
    const u = new URL(uri);
    const name = decodeURIComponent(u.hash.slice(1)) || 'SS';
    let method = '', password = '', server = '', port = 0;

    // 现代 SIP002 格式: ss://base64(method:password)@host:port
    if (u.username) {
      // URL.username 会把 = 编码为 %3D，破坏 base64 padding，需先解码
      let decoded = decodeURIComponent(u.username);
      // 检查是否是 base64 (不含 : 但可解码出 :)
      if (!decoded.includes(':')) {
        decoded = base64Decode(decoded);
      }
      const colonIdx = decoded.indexOf(':');
      method = decoded.slice(0, colonIdx);
      password = decoded.slice(colonIdx + 1);
      server = u.hostname;
      port = parseInt(u.port, 10);
    } else {
      // 旧格式: ss://base64#name
      const decoded = base64Decode(uri.slice(5).split('#')[0]);
      const m = decoded.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/);
      if (!m) return null;
      [, method, password, server, ] = m;
      port = parseInt(m[4], 10);
    }

    return { type: 'ss', name, server, port, cipher: method, password, raw: uri };
  } catch {
    return null;
  }
}

// SSR URI: ssr://base64
function parseSSR(uri: string): ProxyNode | null {
  try {
    const b64 = uri.slice(6);
    const decoded = base64Decode(b64);
    // host:port:protocol:method:obfs:base64pass/?params
    const mainPart = decoded.split('/?')[0];
    const paramPart = decoded.split('/?')[1] || '';
    const parts = mainPart.split(':');
    if (parts.length < 6) return null;
    const [server, port, protocol, cipher, obfs, passB64] = parts;
    const password = base64Decode(passB64);

    const params = new URLSearchParams(paramPart);
    const obfsParam = params.get('obfs_param') || '';
    const protocolParam = params.get('proto_param') || '';
    const name = params.get('remarks') ? decodeURIComponent(params.get('remarks')!) : 'SSR';

    return {
      type: 'ssr', name, server, port: parseInt(port, 10),
      cipher, password,
      ssr: { protocol, obfs, obfsParam, protocolParam },
      raw: uri,
    };
  } catch {
    return null;
  }
}

// VMess URI: vmess://base64(json)
function parseVMess(uri: string): ProxyNode | null {
  try {
    const b64 = uri.slice(8);
    const decoded = base64Decode(b64);
    const cfg = JSON.parse(decoded);
    return {
      type: 'vmess', name: cfg.ps || cfg.name || 'VMess',
      server: cfg.add, port: parseInt(cfg.port, 10),
      uuid: cfg.id, alterId: parseInt(cfg.aid, 10) || 0,
      network: cfg.net || 'tcp', tls: cfg.tls === 'tls',
      sni: cfg.sni || cfg.host || '',
      host: cfg.host || '', path: cfg.path || '',
      cipher: cfg.scy || 'auto',
      raw: uri,
    };
  } catch {
    return null;
  }
}

// VLESS URI: vless://uuid@server:port?params#name
function parseVLESS(uri: string): ProxyNode | null {
  try {
    const u = new URL(uri);
    const name = decodeURIComponent(u.hash.slice(1)) || 'VLESS';
    const params = u.searchParams;
    const node: ProxyNode = {
      type: 'vless', name, server: u.hostname, port: parseInt(u.port, 10),
      uuid: u.username, network: params.get('type') || 'tcp',
      tls: params.get('security') === 'tls' || params.get('security') === 'reality',
      sni: params.get('sni') || '', flow: params.get('flow') || '',
      raw: uri,
    };
    if (params.get('security') === 'reality') {
      node.realityOpts = {
        publicKey: params.get('pbk') || '',
        shortId: params.get('sid') || '',
        spiderX: params.get('spx') || '',
      };
    }
    if (params.get('host')) node.host = params.get('host')!;
    if (params.get('path')) node.path = params.get('path')!;
    if (params.get('alpn')) node.alpn = params.get('alpn')!;
    if (params.get('fp')) node.fingerprint = params.get('fp')!;
    return node;
  } catch {
    return null;
  }
}

// Trojan URI: trojan://password@server:port?params#name
function parseTrojan(uri: string): ProxyNode | null {
  try {
    const u = new URL(uri);
    const name = decodeURIComponent(u.hash.slice(1)) || 'Trojan';
    const params = u.searchParams;
    return {
      type: 'trojan', name, server: u.hostname, port: parseInt(u.port, 10),
      password: u.username, tls: true,
      sni: params.get('sni') || u.hostname,
      network: params.get('type') || 'tcp',
      host: params.get('host') || '', path: params.get('path') || '',
      raw: uri,
    };
  } catch {
    return null;
  }
}

// Hysteria2 URI: hysteria2://password@server:port?params#name
function parseHysteria2(uri: string): ProxyNode | null {
  try {
    const u = new URL(uri);
    const name = decodeURIComponent(u.hash.slice(1)) || 'Hysteria2';
    const params = u.searchParams;
    return {
      type: 'hysteria2', name, server: u.hostname, port: parseInt(u.port, 10),
      password: u.username,
      tls: true,
      sni: params.get('sni') || u.hostname,
      host: params.get('host') || '',
      insecure: params.get('insecure') === '1',
      raw: uri,
    };
  } catch {
    return null;
  }
}

// 解析 Shadowrocket STATUS= 行
// 格式: 🚀↑:0.07GB,↓:6.11GB,TOT:800GB💡Expires:2027-07-10
function parseStatusLine(line: string): SubscriptionInfo | undefined {
  try {
    const result: SubscriptionInfo = { upload: 0, download: 0, total: 0, expire: 0 };
    // 提取上传: ↑:X.GB
    const upMatch = line.match(/↑:([\d.]+)\s*(\w+)/);
    if (upMatch) result.upload = parseSize(upMatch[1], upMatch[2]);
    // 提取下载: ↓:X.GB
    const downMatch = line.match(/↓:([\d.]+)\s*(\w+)/);
    if (downMatch) result.download = parseSize(downMatch[1], downMatch[2]);
    // 提取总量: TOT:X.GB
    const totMatch = line.match(/TOT:([\d.]+)\s*(\w+)/);
    if (totMatch) result.total = parseSize(totMatch[1], totMatch[2]);
    // 提取过期时间: Expires:YYYY-MM-DD
    const expMatch = line.match(/Expires:(\d{4}-\d{2}-\d{2})/);
    if (expMatch) result.expire = Math.floor(new Date(expMatch[1]).getTime() / 1000);
    return result;
  } catch {
    return undefined;
  }
}

function parseSize(val: string, unit: string): number {
  const num = parseFloat(val);
  const u = unit.toUpperCase();
  if (u === 'B') return Math.floor(num);
  if (u === 'KB') return Math.floor(num * 1024);
  if (u === 'MB') return Math.floor(num * 1024 * 1024);
  if (u === 'GB') return Math.floor(num * 1024 * 1024 * 1024);
  if (u === 'TB') return Math.floor(num * 1024 * 1024 * 1024 * 1024);
  return Math.floor(num);
}

// 主解析函数
export function parseSubscription(content: string, contentType: string): ParseResult {
  let text = content.trim();

  // 如果是 base64 编码的整个订阅
  if (!text.startsWith('{') && !text.startsWith('[') && !text.startsWith('#') && !text.startsWith('proxies:') && !text.includes('://')) {
    const decoded = base64Decode(text);
    if (decoded.includes('://')) {
      text = decoded;
    }
  }

  // 如果是 Clash YAML 格式
  if (text.includes('proxies:') || text.startsWith('proxies:')) {
    return parseClashYaml(text);
  }

  // 按行解析 URI (清理 \r\n)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const nodes: ProxyNode[] = [];
  let subInfo: SubscriptionInfo | undefined;

  for (const line of lines) {
    // Shadowrocket 格式: STATUS=🚀↑:0.07GB,↓:6.11GB,TOT:800GB💡Expires:2027-07-10
    if (line.startsWith('STATUS=')) {
      subInfo = parseStatusLine(line.slice(7));
      continue;
    }
    let node: ProxyNode | null = null;
    if (line.startsWith('ss://')) node = parseSS(line);
    else if (line.startsWith('ssr://')) node = parseSSR(line);
    else if (line.startsWith('vmess://')) node = parseVMess(line);
    else if (line.startsWith('vless://')) node = parseVLESS(line);
    else if (line.startsWith('trojan://')) node = parseTrojan(line);
    else if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) node = parseHysteria2(line);
    if (node) nodes.push(node);
  }

  return { nodes, subInfo };
}

// 解析 Clash YAML (简易解析，提取 proxies 列表)
function parseClashYaml(text: string): ParseResult {
  const nodes: ProxyNode[] = [];
  // 简易 YAML proxies 解析
  const lines = text.split('\n');
  let inProxies = false;
  let current: Partial<ProxyNode> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'proxies:') { inProxies = true; continue; }
    if (inProxies && !line.startsWith(' ') && !line.startsWith('-') && trimmed && !trimmed.startsWith('#')) {
      inProxies = false; continue;
    }
    if (!inProxies) continue;

    if (trimmed.startsWith('- {')) {
      // 内联 YAML
      try {
        const obj = parseInlineYaml(trimmed.slice(2));
        if (obj.type && obj.server && obj.type !== 'select' && obj.type !== 'url-test' && obj.type !== 'fallback' && obj.type !== 'load-balance') {
          nodes.push(normalizeClashNode(obj));
        }
      } catch { /* skip */ }
      continue;
    }

    if (trimmed.startsWith('- ')) {
      if (current) nodes.push(normalizeClashNode(current as any));
      current = {};
      const rest = trimmed.slice(2).trim();
      if (rest.startsWith('{')) {
        try {
          current = parseInlineYaml(rest);
        } catch { /* skip */ }
      }
      continue;
    }

    if (current && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      (current as any)[key] = isNaN(Number(val)) ? val : Number(val);
    }
  }
  if (current) nodes.push(normalizeClashNode(current as any));

  return { nodes };
}

function parseInlineYaml(str: string): Record<string, any> {
  // 去掉外层 {}
  let s = str.trim();
  if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
  const result: Record<string, any> = {};
  // 逗号分割，但跳过嵌套 { } 内的逗号
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx === -1) continue;
    const key = p.slice(0, idx).trim();
    let val = p.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (val === 'true') val = true as any;
    else if (val === 'false') val = false as any;
    else if (!isNaN(Number(val))) val = Number(val) as any;
    else if (val.startsWith('{') && val.endsWith('}')) {
      // 递归解析嵌套对象
      try { val = parseInlineYaml(val) as any; } catch { /* keep string */ }
    }
    result[key] = val;
  }
  return result;
}

function normalizeClashNode(obj: Record<string, any>): ProxyNode {
  return {
    type: obj.type || 'unknown',
    name: obj.name || 'Unnamed',
    server: obj.server || '',
    port: parseInt(obj.port, 10) || 0,
    cipher: obj.cipher, password: obj.password,
    uuid: obj.uuid, alterId: obj.alterId || 0,
    network: obj.network, tls: obj.tls,
    sni: obj.sni || obj.server, host: obj.host, path: obj.path,
    insecure: obj['skip-cert-verify'] === true,
    flow: obj.flow,
    realityOpts: obj['reality-opts'] || obj.realityOpts,
    alpn: typeof obj.alpn === 'string' ? obj.alpn : undefined,
    raw: JSON.stringify(obj),
  };
}
