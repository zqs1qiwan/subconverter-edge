import type { ProxyNode, TargetType, ConvertOptions } from './types';

function yamlValue(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return `[${val.map(yamlValue).join(', ')}]`;
  if (typeof val === 'object') return JSON.stringify(val);
  const s = String(val);
  if (/[:,#\[\]{}&*!|>'"%@`]/.test(s) || s.includes('\n') || s.trim() !== s) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
function objToYaml(obj: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v).map(([ik, iv]) => `${ik}: ${yamlValue(iv)}`).join(', ');
      parts.push(`${k}: {${inner}}`);
    } else {
      parts.push(`${k}: ${yamlValue(v)}`);
    }
  }
  return `{${parts.join(', ')}}`;
}
function safeBtoa(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function toClash(nodes: ProxyNode[], opts: ConvertOptions = {}): string {
  const proxies: string[] = [];
  for (const n of nodes) {
    // Start from preserved extra for lossless round-trip, then override normalized fields
    const p: Record<string, any> = { ...(n.extra || {}), name: n.name, type: n.type, server: n.server, port: n.port };
    const udpVal = opts.udp !== undefined ? opts.udp : (opts.xudp ? true : undefined);
    switch (n.type) {
      case 'ss':
        p.cipher = n.cipher || 'aes-256-gcm'; p.password = n.password || '';
        if (udpVal !== undefined) p.udp = udpVal; else if (p.udp === undefined) p.udp = true;
        break;
      case 'vmess':
        p.uuid = n.uuid; p.alterId = n.alterId || 0; p.cipher = n.cipher || 'auto';
        p.network = n.network || 'tcp'; p.tls = n.tls || false;
        if (n.sni) p.sni = n.sni;
        if (n.insecure || opts.scv) p['skip-cert-verify'] = true;
        if (n.network === 'ws') p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        if (udpVal !== undefined) p.udp = udpVal; else if (p.udp === undefined) p.udp = true;
        break;
      case 'vless':
        p.uuid = n.uuid; p.network = n.network || 'tcp'; p.tls = n.tls || false;
        if (n.sni) p.sni = n.sni;
        if (n.flow) p.flow = n.flow;
        if (n.insecure || opts.scv) p['skip-cert-verify'] = true;
        if (n.realityOpts) {
          p['reality-opts'] = { 'public-key': n.realityOpts.publicKey, 'short-id': n.realityOpts.shortId };
          if (n.realityOpts.spiderX) (p['reality-opts'] as any)['spider-x'] = n.realityOpts.spiderX;
        }
        if (n.network === 'ws') p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        if (n.network === 'grpc' && n.serviceName) p['grpc-opts'] = { 'grpc-service-name': n.serviceName };
        if (n.fingerprint) p.fingerprint = n.fingerprint;
        if (n.alpn) p.alpn = n.alpn.split(',');
        if (udpVal !== undefined) p.udp = udpVal;
        break;
      case 'trojan':
        p.password = n.password; p.sni = n.sni || n.server; p.tls = true;
        p['skip-cert-verify'] = opts.scv ? true : (n.insecure || false);
        if (udpVal !== undefined) p.udp = udpVal;
        if (n.network === 'ws') p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        break;
      case 'anytls':
        p.password = n.password; p.sni = n.sni || n.server; p.tls = true;
        p['skip-cert-verify'] = opts.scv ? true : (n.insecure || false);
        if (udpVal !== undefined) p.udp = udpVal;
        break;
      case 'ssr':
        p.cipher = n.cipher; p.password = n.password;
        if (n.ssr) { p.protocol = n.ssr.protocol; p.obfs = n.ssr.obfs; p['obfs-param'] = n.ssr.obfsParam; p['protocol-param'] = n.ssr.protocolParam; }
        if (udpVal !== undefined) p.udp = udpVal;
        break;
      case 'hysteria2':
        p.password = n.password; p.sni = n.sni || n.server; p.tls = true;
        p['skip-cert-verify'] = opts.scv ? true : (n.insecure || false);
        if (n.mport) p.mport = n.mport;
        if (n.obfs) p.obfs = n.obfs;
        if (n.alpn) p.alpn = n.alpn.split(',');
        if (n.fingerprint) p.fingerprint = n.fingerprint;
        if (udpVal !== undefined) p.udp = udpVal;
        break;
      default:
        // http/socks5/tuic/wireguard/unknown: keep extra as-is (already merged)
        break;
    }
    if (opts.tfo) p.tfo = true;
    if (opts.tls13) p.tls13 = true;
    proxies.push(`- ${objToYaml(p)}`);
  }
  const groupName = opts.group || 'PROXY';
  let dns = '';
  if (opts.diydns || opts.fdn || opts.clashDoh) {
    dns = `\n\ndns:\n  enable: true\n  ipv6: ${opts.singboxIpv6 ? 'true' : 'false'}\n  enhanced-mode: ${opts.fdn ? 'fake-ip' : 'normal'}\n  nameserver:\n  - 223.5.5.5\n  - 8.8.8.8\n  - ${opts.clashDoh ? 'https://dns.google/dns-query' : 'https://dns.cloudflare.com/dns-query'}\n`;
  }
  return `proxies:\n${proxies.join('\n')}\n\nproxy-groups:\n- name: ${groupName}\n  type: select\n  proxies:\n  - DIRECT\n${nodes.map(n => `  - "${n.name}"`).join('\n')}\n${dns}\nrules:\n- MATCH,${groupName}\n`;
}

export function toSingBox(nodes: ProxyNode[], opts: ConvertOptions = {}): string {
  const outbounds: any[] = [];
  const skipped = new Set<string>();
  for (const n of nodes) {
    const ob: any = { tag: n.name, type: n.type === 'anytls' ? 'anytls' : n.type, server: n.server, server_port: n.port };
    switch (n.type) {
      case 'ss': ob.method = n.cipher || 'aes-256-gcm'; ob.password = n.password || ''; break;
      case 'vmess':
        ob.uuid = n.uuid; ob.alter_id = n.alterId || 0;
        if (n.network === 'ws') { ob.transport = { type: 'ws', path: n.path || '/' }; if (n.host) ob.transport.headers = { Host: n.host }; }
        if (n.tls) { ob.tls = { enabled: true, server_name: n.sni || n.server }; if (n.insecure || opts.scv) ob.tls.insecure = true; }
        break;
      case 'vless':
        ob.uuid = n.uuid;
        if (n.tls) {
          ob.tls = { enabled: true, server_name: n.sni || n.server };
          if (n.insecure || opts.scv) ob.tls.insecure = true;
          if (n.realityOpts) ob.tls.reality = { enabled: true, public_key: n.realityOpts.publicKey, short_id: n.realityOpts.shortId };
        }
        if (n.flow) ob.flow = n.flow;
        if (n.network === 'ws') { ob.transport = { type: 'ws', path: n.path || '/' }; if (n.host) ob.transport.headers = { Host: n.host }; }
        break;
      case 'trojan':
        ob.password = n.password; ob.tls = { enabled: true, server_name: n.sni || n.server };
        if (n.insecure || opts.scv) ob.tls.insecure = true;
        break;
      case 'anytls':
        ob.password = n.password; ob.tls = { enabled: true, server_name: n.sni || n.server };
        if (n.insecure || opts.scv) ob.tls.insecure = true;
        break;
      case 'ssr':
        skipped.add(n.name); continue;
      case 'hysteria2':
        ob.password = n.password; ob.tls = { enabled: true, server_name: n.sni || n.server };
        if (n.insecure || opts.scv) ob.tls.insecure = true;
        if (n.mport) ob.server_ports = [n.mport];
        break;
      default:
        skipped.add(n.name); continue;
    }
    outbounds.push(ob);
  }
  const includedNames = outbounds.map(o => o.tag);
  const config: any = {
    log: { level: 'info' },
    outbounds: [
      ...outbounds,
      { type: 'selector', tag: 'PROXY', outbounds: includedNames, default: includedNames[0] || '' },
      { type: 'direct', tag: 'DIRECT' },
      { type: 'dns', tag: 'dns-out' },
    ],
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 }],
    route: { rules: [{ protocol: 'dns', outbound: 'dns-out' }], final: 'PROXY' },
  };
  if (opts.singboxIpv6) config.dns = { servers: [{ tag: 'dns-remote', address: 'https://8.8.8.8/dns-query', detour: 'PROXY' }] };
  return JSON.stringify(config, null, 2);
}

function rawNameChanged(n: ProxyNode): boolean {
  if (!n.raw) return false;
  const hashIdx = n.raw.indexOf('#');
  if (hashIdx === -1) return n.name !== '';
  let frag = ''; try { frag = decodeURIComponent(n.raw.slice(hashIdx + 1)); } catch { frag = n.raw.slice(hashIdx + 1); }
  // vmess name is inside JSON, handled by rebuild when ps differs - approximate by checking frag/ps
  if (n.type === 'vmess') {
    try {
      const b64 = n.raw.slice(8).split('#')[0];
      const json = JSON.parse(atob(b64.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4 - (b64.length % 4)) % 4)));
      return (json.ps || '') !== n.name;
    } catch { return true; }
  }
  return frag !== n.name;
}

export function nodeToUri(n: ProxyNode): string | null {
  if (n.raw && !rawNameChanged(n)) return n.raw;
  switch (n.type) {
    case 'vmess': {
      const cfg: any = { v: '2', ps: n.name, add: n.server, port: String(n.port), id: n.uuid, aid: String(n.alterId || 0), net: n.network || 'tcp', type: 'none', host: n.host || '', path: n.path || '', tls: n.tls ? 'tls' : '', sni: n.sni || '' };
      if (n.alpn) cfg.alpn = n.alpn;
      return 'vmess://' + safeBtoa(JSON.stringify(cfg));
    }
    case 'ss': {
      const userInfo = safeBtoa(`${n.cipher}:${n.password}`);
      return `ss://${userInfo}@${n.server}:${n.port}#${encodeURIComponent(n.name)}`;
    }
    case 'ssr':
      return n.raw || null;
    case 'trojan': {
      const params = new URLSearchParams();
      if (n.sni) params.set('sni', n.sni);
      if (n.network && n.network !== 'tcp') params.set('type', n.network);
      if (n.path) params.set('path', n.path);
      if (n.host) params.set('host', n.host);
      if (n.alpn) params.set('alpn', n.alpn);
      const qs = params.toString();
      return `trojan://${encodeURIComponent(n.password || '')}@${n.server}:${n.port}${qs ? '?' + qs : ''}#${encodeURIComponent(n.name)}`;
    }
    case 'vless': {
      const params = new URLSearchParams();
      if (n.network) params.set('type', n.network);
      if (n.tls) params.set('security', n.realityOpts ? 'reality' : 'tls');
      if (n.sni) params.set('sni', n.sni);
      if (n.flow) params.set('flow', n.flow);
      if (n.realityOpts) { params.set('pbk', n.realityOpts.publicKey); params.set('sid', n.realityOpts.shortId); if (n.realityOpts.spiderX) params.set('spx', n.realityOpts.spiderX); }
      if (n.path) params.set('path', n.path);
      if (n.host) params.set('host', n.host);
      if (n.network === 'grpc' && n.serviceName) params.set('serviceName', n.serviceName);
      if (n.alpn) params.set('alpn', n.alpn);
      if (n.fingerprint) params.set('fp', n.fingerprint);
      return `vless://${n.uuid}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`;
    }
    case 'hysteria2':
    case 'anytls': {
      const params = new URLSearchParams();
      if (n.sni) params.set('sni', n.sni);
      params.set('security', 'tls');
      if (n.insecure) params.set('insecure', '1');
      if (n.mport) params.set('mport', n.mport);
      if (n.obfs) params.set('obfs', n.obfs);
      if (n.alpn) params.set('alpn', n.alpn);
      if (n.fingerprint) params.set('fp', n.fingerprint);
      return `${n.type}://${encodeURIComponent(n.password || '')}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`;
    }
    default:
      return null;
  }
}

function toUriList(nodes: ProxyNode[], opts: { plain?: boolean } = {}): string {
  const lines: string[] = [];
  for (const n of nodes) {
    const uri = nodeToUri(n);
    if (uri) lines.push(uri);
  }
  const joined = lines.join('\n');
  return opts.plain ? joined : safeBtoa(joined);
}

export function toV2Ray(nodes: ProxyNode[], opts: { list?: boolean } = {}): string { return toUriList(nodes, { plain: !!opts.list }); }
export function toMixed(nodes: ProxyNode[], opts: { list?: boolean } = {}): string { return toUriList(nodes, { plain: !!opts.list }); }
export function toSS(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) if (n.type === 'ss') { const uri = nodeToUri(n); if (uri) lines.push(uri); }
  return safeBtoa(lines.join('\n'));
}
export function toTrojan(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) if (n.type === 'trojan') { const uri = nodeToUri(n); if (uri) lines.push(uri); }
  return safeBtoa(lines.join('\n'));
}
export function convert(nodes: ProxyNode[], target: TargetType, opts: ConvertOptions = {}, list = false): string {
  switch (target) {
    case 'clash': return toClash(nodes, opts);
    case 'singbox': return toSingBox(nodes, opts);
    case 'v2ray': return toV2Ray(nodes, { list });
    case 'ss': return toSS(nodes);
    case 'trojan': return toTrojan(nodes);
    case 'mixed': return toMixed(nodes, { list });
    case 'shadowrocket': return toMixed(nodes, { list });
  }
}
