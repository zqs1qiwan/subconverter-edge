import { parseSubscription, parseSubInfo } from './parser';
import { convert } from './converter';
import type { TargetType, ConvertOptions, ProxyNode } from './types';

export interface Env { ASSETS: Fetcher; SHORT_LINKS: KVNamespace }

const VERSION = 'subconverter-edge v1.2.0';
const TARGET_TYPES: Record<string, TargetType> = {
  clash: 'clash', singbox: 'singbox', 'sing-box': 'singbox', v2ray: 'v2ray',
  trojan: 'trojan', ss: 'ss', mixed: 'mixed', shadowrocket: 'shadowrocket', sr: 'shadowrocket',
};
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*',
};
const AD_PATTERNS: RegExp[] = [
  /剩余|到期|过期|重置|套餐|expire|expiry|reset|traffic/i,
  /https?:\/\//,
  /(官方|官网|主页|网站|网址|发布页|永久|备用|国内|国外|入口|购买|客服|群组|main|backup|portal)[:：]\s*\S+\.\w+/i,
  /加群|进群|入群|交流群|电报群|tg群|点击订阅|查看官网|访问官网|前往官网|点击下载|下载客户端|使用客户端|查看公告|最新通知|重要通知|更新公告|请到|请访问|请使用|请前往|详见|查看详情/i,
  /join\s*(us|group|telegram)|visit\s*(our\s*)?(site|website|homepage)|t\.me\/|telegram\.me|telegram\.dog|download\s*(the\s*)?(app|client)/i,
  /^\s*[^\p{L}\p{N}\s]*[🔔📢⚠💡⏰🗑💬📄🧾❗]/u,
];
const UA_OPTIONS: Record<string, string> = {
  clash: 'clash.meta/1.19.0', singbox: 'sing-box', shadowrocket: 'Shadowrocket/1900 CFNetwork/1410 Darwin/22.0.0',
  v2ray: 'v2rayN', default: 'clash.meta/1.19.0',
};
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
const KNOWN_TYPES = new Set(['ss','ssr','vmess','vless','trojan','hysteria2','hy2','anytls','http','socks5','socks','tuic','wireguard']);

function boolParam(v: string | null, def = false): boolean {
  if (v === null) return def;
  return v === 'true' || v === '1';
}
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a,b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
async function fetchWithTimeout(url: string, ua: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { headers: { 'User-Agent': ua }, signal: ctrl.signal, redirect: 'follow' }); }
  finally { clearTimeout(t); }
}
// include/exclude: dual mode - if all tokens are known types => type filter (back-compat), else keyword regex on name
function filterByParam(nodes: ProxyNode[], param: string, keep: boolean): ProxyNode[] {
  const tokens = param.split(',').map(s => s.trim()).filter(Boolean);
  if (!tokens.length) return nodes;
  if (tokens.every(t => KNOWN_TYPES.has(t.toLowerCase()))) {
    const set = new Set(tokens.map(t => t.toLowerCase().replace('hy2','hysteria2')));
    return nodes.filter(n => keep ? set.has(n.type) : !set.has(n.type));
  }
  // keyword mode: tokens joined as regex alternation, also support | inside
  const pattern = tokens.join('|');
  let re: RegExp; try { re = new RegExp(pattern, 'i'); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
  return nodes.filter(n => keep ? re.test(n.name) : !re.test(n.name));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (url.pathname === '/sub' || url.pathname === '/sub/') return handleSub(request, url);
    if (url.pathname === '/version') return new Response(VERSION, { headers: { 'Content-Type': 'text/plain' } });
    if (url.pathname === '/api/shorten' && request.method === 'POST') return handleShorten(request, env);
    if (url.pathname === '/api/configs') {
      const configs = Object.entries(REMOTE_CONFIGS).filter(([, v]) => v).map(([k, v]) => ({ id: k, url: v, name: k.replace('clash-ruleset-', 'ACL4SSR ') }));
      return new Response(JSON.stringify(configs), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }
    if (url.pathname.startsWith('/s/') && request.method === 'GET') return handleRedirect(url, env);
    if (env.ASSETS) return env.ASSETS.fetch(request as any);
    return new Response('Not Found', { status: 404 });
  },
};

async function handleSub(request: Request, url: URL): Promise<Response> {
  const sp = url.searchParams;
  const targetRaw = sp.get('target') || 'clash';
  const targetType = TARGET_TYPES[targetRaw];
  if (!targetType) return jsonError(`Unsupported target: ${targetRaw}. Supported: ${Object.keys(TARGET_TYPES).join(', ')}`);
  const subUrl = sp.get('url');
  if (!subUrl) return jsonError('Missing url parameter');
  const emoji = sp.get('emoji') !== 'false';
  const ads = sp.get('ads') === '1' || boolParam(sp.get('ads'));
  const filterParam = sp.get('filter') || '';
  const remoteConfig = sp.get('config') || '';
  const diyua = sp.get('diyua') || '';
  const uaKey = sp.get('ua') || 'clash';
  const userAgent = diyua || UA_OPTIONS[uaKey] || UA_OPTIONS['default'];
  const filename = sp.get('filename') || sp.get('name') || '';
  const intervalSec = sp.get('interval') ? parseInt(sp.get('interval')!, 10) : NaN;
  const renameParam = sp.get('rename') || '';
  const sortBool = boolParam(sp.get('sort'));
  const listBool = boolParam(sp.get('list') || sp.get('nodeList'));
  const insertBool = boolParam(sp.get('insert'));
  const insertUrl = sp.get('insert_url') || '';
  const opts: ConvertOptions = {
    udp: sp.get('udp') === null ? undefined : boolParam(sp.get('udp')),
    xudp: boolParam(sp.get('xudp')),
    tfo: boolParam(sp.get('tfo')),
    tls13: boolParam(sp.get('tls13')),
    scv: boolParam(sp.get('scv')),
    fdn: boolParam(sp.get('fdn')),
    diydns: boolParam(sp.get('diydns')),
    clashDoh: boolParam(sp.get('clash.doh')),
    singboxIpv6: sp.get('singbox.ipv6') === '1' || boolParam(sp.get('singbox.ipv6')),
    appendType: boolParam(sp.get('append_type')),
    newName: boolParam(sp.get('new_name')),
    group: sp.get('group') || undefined,
  };
  // dev_id accepted for compat (no-op in this Worker)
  void sp.get('dev_id');

  let allNodes: ProxyNode[] = [];
  let subInfo: any = undefined;
  let subTitle: string | undefined = undefined;
  let profileUpdateInterval: string | undefined = undefined;
  const errors: string[] = [];

  const fetchOne = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    if (/^(ss|ssr|vmess|vless|trojan|hysteria2|hy2|anytls):\/\//.test(trimmed)) {
      allNodes.push(...parseSubscription(trimmed, 'text/plain').nodes);
      return;
    }
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { errors.push('Invalid URL: ' + trimmed.slice(0, 60)); return; }
    if (!['http:', 'https:'].includes(parsed.protocol)) { errors.push('Unsupported protocol: ' + parsed.protocol); return; }
    if (isPrivateHost(parsed.hostname)) { errors.push('Blocked private host: ' + parsed.hostname); return; }
    try {
      const resp = await fetchWithTimeout(trimmed, userAgent);
      if (!resp.ok) { errors.push(`Upstream ${resp.status} for ${parsed.hostname}`); return; }
      const content = await resp.text();
      const result = parseSubscription(content, resp.headers.get('content-type') || '');
      allNodes.push(...result.nodes);
      if (result.subInfo && !subInfo) subInfo = result.subInfo;
      const headerSubInfo = parseSubInfo(resp.headers);
      if (headerSubInfo && !subInfo) subInfo = headerSubInfo;
      const disposition = resp.headers.get('content-disposition');
      if (disposition && !subTitle) {
        const m = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
        if (m) try { subTitle = decodeURIComponent(m[1].replace(/["']/g, '')); } catch { subTitle = m[1].replace(/["']/g, ''); }
      }
      if (!profileUpdateInterval) { const iv = resp.headers.get('profile-update-interval'); if (iv) profileUpdateInterval = iv; }
    } catch (e: any) {
      errors.push(`Fetch failed for ${parsed.hostname}: ${e?.name === 'AbortError' ? 'timeout' : e?.message || 'error'}`);
    }
  };

  for (const u of subUrl.split('|')) await fetchOne(u);
  if (insertBool && insertUrl) for (const u of insertUrl.split('|')) await fetchOne(u);

  const includeParam = sp.get('include') || '';
  const excludeParam = sp.get('exclude') || '';
  if (includeParam) allNodes = filterByParam(allNodes, includeParam, true);
  if (excludeParam) allNodes = filterByParam(allNodes, excludeParam, false);

  if (ads || filterParam) {
    allNodes = allNodes.filter(n => {
      if (ads && AD_PATTERNS.some(p => p.test(n.name))) return false;
      if (filterParam) {
        try { if (new RegExp(filterParam).test(n.name)) return false; }
        catch { if (n.name.includes(filterParam)) return false; }
      }
      return true;
    });
  }
  // rename: old=new|old2=new2 (regex replace on name)
  if (renameParam) {
    for (const pair of renameParam.split('|')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const oldS = pair.slice(0, eq), newS = pair.slice(eq + 1);
      if (!oldS) continue;
      let re: RegExp; try { re = new RegExp(oldS, 'g'); } catch { continue; }
      allNodes = allNodes.map(n => ({ ...n, name: n.name.replace(re, newS) }));
    }
  }
  if (opts.appendType) allNodes = allNodes.map(n => ({ ...n, name: `${n.name} [${n.type}]` }));
  if (sortBool) allNodes = [...allNodes].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  if (emoji) {
    allNodes = allNodes.map(n => ({ ...n, name: n.name.match(/[\u{1F300}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/u) ? n.name : addEmoji(n.name) }));
  }
  // dedupe by name+server+port+type
  const seen = new Set<string>(); allNodes = allNodes.filter(n => { const k = `${n.type}|${n.server}|${n.port}|${n.name}`; if (seen.has(k)) return false; seen.add(k); return true; });

  if (allNodes.length === 0) {
    return jsonError(errors.length ? `No valid nodes found (${errors.join('; ')})` : 'No valid nodes found');
  }
  if ((targetType === 'ss' || targetType === 'trojan') && !allNodes.some(n => n.type === targetType)) {
    return jsonError(`No ${targetType} nodes in subscription (found: ${[...new Set(allNodes.map(n => n.type))].join(', ')})`);
  }

  let output: string;
  try { output = convert(allNodes, targetType, opts, listBool); }
  catch (e: any) { return jsonError('Convert failed: ' + (e?.message || 'unknown')); }

  const responseHeaders: Record<string, string> = {
    'Content-Type': targetType === 'clash' ? 'text/yaml; charset=utf-8' : targetType === 'singbox' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...CORS_HEADERS,
  };
  let finalOutput = output;
  if (remoteConfig && targetType === 'clash') {
    const cfgUrl = REMOTE_CONFIGS[remoteConfig] || (/^https?:\/\//.test(remoteConfig) ? remoteConfig : '');
    if (cfgUrl) {
      try {
        const cfgResp = await fetchWithTimeout(cfgUrl, 'clash.meta/1.19.0');
        if (cfgResp.ok) finalOutput = mergeClashConfig(output, await cfgResp.text(), allNodes.map(n => n.name));
      } catch { /* fallback to default */ }
    }
  }
  if (subInfo && (subInfo.total > 0 || subInfo.download > 0 || subInfo.upload > 0)) {
    responseHeaders['subscription-userinfo'] = `upload=${subInfo.upload}; download=${subInfo.download}; total=${subInfo.total}; expire=${subInfo.expire}`;
  }
  if (filename) subTitle = filename;
  if (subTitle) responseHeaders['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(subTitle)}`;
  if (!isNaN(intervalSec) && intervalSec > 0) profileUpdateInterval = String(Math.ceil(intervalSec / 3600));
  responseHeaders['profile-update-interval'] = profileUpdateInterval || '24';
  responseHeaders['X-Node-Count'] = String(allNodes.length);
  if (errors.length) responseHeaders['X-Upstream-Warnings'] = errors.join(' | ').slice(0, 500);
  return new Response(finalOutput, { headers: responseHeaders });
}

// Structured ACL4SSR .ini -> Clash rule-providers + proxy-groups + rules
function mergeClashConfig(baseYaml: string, configIni: string, nodeNames: string[]): string {
  const rulesets: { group: string; url: string }[] = [];
  const groups: { name: string; type: string; members: string[]; filter?: string }[] = [];
  for (const rawLine of configIni.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('ruleset=')) {
      const rest = line.slice('ruleset='.length);
      const idx = rest.indexOf(',');
      if (idx > 0) rulesets.push({ group: rest.slice(0, idx).trim(), url: rest.slice(idx + 1).trim() });
    } else if (line.startsWith('custom_proxy_group=')) {
      const rest = line.slice('custom_proxy_group='.length);
      // format: name`type`[]member`[]member`filter
      const parts = rest.split('`');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const type = parts[1].trim() || 'select';
        const members: string[] = []; let filter: string | undefined;
        for (let i = 2; i < parts.length; i++) {
          const seg = parts[i].trim();
          if (seg.startsWith('[]')) members.push(seg.slice(2).trim());
          else if (seg) filter = seg;
        }
        groups.push({ name, type, members, filter });
      }
    }
  }
  if (!rulesets.length && !groups.length) return baseYaml;
  // Build proxy-groups: replace filter regex with matching node names; '.*' or empty => all nodes
  const groupBlocks: string[] = [];
  for (const g of groups) {
    const members: string[] = [];
    for (const m of g.members) {
      if (m === 'DIRECT' || m === 'REJECT' || m === 'REJECT-DROP') members.push(m);
      else if (groups.some(x => x.name === m)) members.push(m);
      else if (nodeNames.includes(m)) members.push(m);
      else members.push(m); // keep as-is (may be a ruleset group name)
    }
    if (g.filter && g.filter !== '.*') {
      try {
        const re = new RegExp(g.filter);
        for (const n of nodeNames) if (re.test(n) && !members.includes(n)) members.push(n);
      } catch { /* ignore */ }
    } else if (g.filter === '.*' || !g.filter) {
      // ACL4SSR '.*' means all nodes available in this group context; include all for select groups that have no explicit nodes
      if (!members.some(m => nodeNames.includes(m))) for (const n of nodeNames) if (!members.includes(n)) members.push(n);
    }
    // dedupe preserve order, quote names with special chars
    const uniq = [...new Set(members)];
    const list = uniq.map(m => `  - "${m}"`).join('\n');
    groupBlocks.push(`- name: "${g.name}"\n  type: ${g.type}\n  proxies:\n${list}`);
  }
  // rule-providers: name from group+index (sanitize)
  const providers: string[] = []; const rules: string[] = [];
  const usedNames = new Set<string>();
  rulesets.forEach((r, i) => {
    let pname = r.group.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) + '_' + i;
    while (usedNames.has(pname)) pname += '_';
    usedNames.add(pname);
    providers.push(`  ${pname}:\n    type: http\n    behavior: classical\n    url: "${r.url}"\n    path: ./ruleset/${pname}.list\n    interval: 86400`);
    if (r.url.includes('[]GEOIP')) {
      const geo = r.url.replace('[]GEOIP,', '').trim();
      rules.push(`  - GEOIP,${geo},"${r.group}"`);
    } else if (r.url.includes('[]FINAL')) {
      rules.push(`  - MATCH,"${r.group}"`);
    } else {
      rules.push(`  - RULE-SET,${pname},"${r.group}"`);
    }
  });
  // Replace default proxy-groups/rules in baseYaml
  let head = baseYaml;
  // Strip existing proxy-groups + rules sections (they are at end in our output)
  const pgIdx = head.indexOf('\nproxy-groups:');
  if (pgIdx !== -1) head = head.slice(0, pgIdx);
  const merged = [
    head.trimEnd(),
    '',
    'proxy-groups:',
    ...groupBlocks,
    '',
    'rule-providers:',
    ...providers,
    '',
    'rules:',
    ...rules,
    '',
  ].join('\n');
  return merged;
}

async function handleShorten(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { url: string };
    const targetUrl = body.url;
    if (!targetUrl || !targetUrl.startsWith('http')) return jsonError('Invalid URL');
    if (targetUrl.length > 8000) return jsonError('URL too long');
    const hash = await deterministicHash(targetUrl);
    if (!env.SHORT_LINKS) return jsonError('Short link service unavailable');
    const existing = await env.SHORT_LINKS.get(hash);
    if (!existing) await env.SHORT_LINKS.put(hash, targetUrl, { expirationTtl: 31536000 });
    const shortUrl = `${new URL(request.url).origin}/s/${hash}`;
    return new Response(JSON.stringify({ short: shortUrl, hash }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  } catch (e: any) { return jsonError(e.message || 'Failed'); }
}
async function handleRedirect(url: URL, env: Env): Promise<Response> {
  const hash = url.pathname.slice(3);
  if (!hash) return jsonError('Not Found');
  if (!env.SHORT_LINKS) return new Response(JSON.stringify({ error: 'Short link service unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  const target = await env.SHORT_LINKS.get(hash);
  if (!target) return jsonError('Not Found');
  return new Response(null, { status: 302, headers: { Location: target, ...CORS_HEADERS } });
}
async function deterministicHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 5).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}
function jsonError(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}
function addEmoji(name: string): string {
  const emojiMap: [RegExp, string][] = [
    [/香港|HK|Hong Kong/i, '🇭🇰'], [/台湾|TW|Taiwan/i, '🇹🇼'], [/日本|JP|Japan|东京|大阪/i, '🇯🇵'],
    [/韩国|KR|Korea|首尔/i, '🇰🇷'], [/新加坡|SG|Singapore|狮城/i, '🇸🇬'], [/美国|US|United States|洛杉矶|硅谷|西雅图/i, '🇺🇸'],
    [/英国|UK|United Kingdom/i, '🇬🇧'], [/德国|DE|Germany|法兰克福/i, '🇩🇪'], [/法国|FR|France|巴黎/i, '🇫🇷'],
    [/加拿大|CA|Canada|多伦多/i, '🇨🇦'], [/澳大利亚|AU|Australia|悉尼/i, '🇦🇺'], [/土耳其|TR|Turkey/i, '🇹🇷'],
    [/印度|IN|India/i, '🇮🇳'], [/俄罗斯|RU|Russia|莫斯科/i, '🇷🇺'], [/巴西|BR|Brazil/i, '🇧🇷'],
    [/泰国|TH|Thailand/i, '🇹🇭'], [/越南|VN|Vietnam/i, '🇻🇳'], [/菲律宾|PH|Philippines/i, '🇵🇭'],
    [/印尼|ID|Indonesia/i, '🇮🇩'], [/马来西亚|MY|Malaysia/i, '🇲🇾'],
  ];
  for (const [re, emoji] of emojiMap) if (re.test(name)) return `${emoji} ${name}`;
  return name;
}
