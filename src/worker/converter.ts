import type { ProxyNode, TargetType } from './types';

// Clash YAML 输出
export function toClash(nodes: ProxyNode[]): string {
  const proxies: string[] = [];
  for (const n of nodes) {
    const p: Record<string, any> = { name: n.name, type: n.type, server: n.server, port: n.port };
    switch (n.type) {
      case 'ss':
        p.cipher = n.cipher || 'aes-256-gcm';
        p.password = n.password || '';
        p.udp = true;
        break;
      case 'vmess':
        p.uuid = n.uuid;
        p.alterId = n.alterId || 0;
        p.cipher = n.cipher || 'auto';
        p.network = n.network || 'tcp';
        p.tls = n.tls || false;
        if (n.sni) p.sni = n.sni;
        if (n.host) p['skip-cert-verify'] = false;
        if (n.network === 'ws') {
          p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        }
        p.udp = true;
        break;
      case 'vless':
        p.uuid = n.uuid;
        p.network = n.network || 'tcp';
        p.tls = n.tls || false;
        if (n.sni) p.sni = n.sni;
        if (n.flow) p.flow = n.flow;
        if (n.realityOpts) {
          p['reality-opts'] = {
            'public-key': n.realityOpts.publicKey,
            'short-id': n.realityOpts.shortId,
          };
        }
        if (n.network === 'ws') {
          p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        }
        p.udp = true;
        break;
      case 'trojan':
        p.password = n.password;
        p.sni = n.sni || n.server;
        p.udp = true;
        if (n.network === 'ws') {
          p['ws-opts'] = { path: n.path || '/', headers: { Host: n.host || n.server } };
        }
        break;
      case 'ssr':
        p.cipher = n.cipher;
        p.password = n.password;
        if (n.ssr) {
          p.protocol = n.ssr.protocol;
          p.obfs = n.ssr.obfs;
          p['obfs-param'] = n.ssr.obfsParam;
          p['protocol-param'] = n.ssr.protocolParam;
        }
        p.udp = true;
        break;
      case 'hysteria2':
        p.password = n.password;
        p.sni = n.sni || n.server;
        p['skip-cert-verify'] = false;
        p.udp = true;
        break;
    }
    proxies.push(`- ${JSON.stringify(p).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ')}`);
  }

  return `proxies:\n${proxies.join('\n')}\n\nproxy-groups:\n- name: PROXY\n  type: select\n  proxies:\n  - DIRECT\n${nodes.map(n => `  - "${n.name}"`).join('\n')}\n\nrules:\n- MATCH,PROXY\n`;
}

// Sing-Box JSON 输出
export function toSingBox(nodes: ProxyNode[]): string {
  const outbounds: any[] = [];
  for (const n of nodes) {
    const ob: any = { tag: n.name, type: n.type, server: n.server, server_port: n.port };
    switch (n.type) {
      case 'ss':
        ob.method = n.cipher || 'aes-256-gcm';
        ob.password = n.password || '';
        break;
      case 'vmess':
        ob.uuid = n.uuid;
        ob.alter_id = n.alterId || 0;
        if (n.network === 'ws') {
          ob.transport = { type: 'ws', path: n.path || '/' };
          if (n.host) ob.transport.headers = { Host: n.host };
        }
        if (n.tls) {
          ob.tls = { enabled: true, server_name: n.sni || n.server };
        }
        break;
      case 'vless':
        ob.uuid = n.uuid;
        if (n.tls) {
          ob.tls = { enabled: true, server_name: n.sni || n.server };
          if (n.realityOpts) {
            ob.tls.reality = { enabled: true, public_key: n.realityOpts.publicKey, short_id: n.realityOpts.shortId };
          }
        }
        if (n.flow) ob.flow = n.flow;
        if (n.network === 'ws') {
          ob.transport = { type: 'ws', path: n.path || '/' };
          if (n.host) ob.transport.headers = { Host: n.host };
        }
        break;
      case 'trojan':
        ob.password = n.password;
        ob.tls = { enabled: true, server_name: n.sni || n.server };
        break;
      case 'ssr':
        // Sing-Box 不支持 SSR，跳过
        continue;
      case 'hysteria2':
        ob.password = n.password;
        ob.tls = { enabled: true, server_name: n.sni || n.server };
        break;
    }
    outbounds.push(ob);
  }

  const config = {
    log: { level: 'info' },
    outbounds: [
      ...outbounds,
      { type: 'selector', tag: 'PROXY', outbounds: nodes.map(n => n.name), default: nodes[0]?.name || '' },
      { type: 'direct', tag: 'DIRECT' },
      { type: 'dns', tag: 'dns-out' },
    ],
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 }],
    route: { rules: [{ protocol: 'dns', outbound: 'dns-out' }], final: 'PROXY' },
  };
  return JSON.stringify(config, null, 2);
}

// V2Ray base64 输出 (每行一个 URI)
export function toV2Ray(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.raw) {
      lines.push(n.raw);
      continue;
    }
    switch (n.type) {
      case 'vmess': {
        const cfg = { v: '2', ps: n.name, add: n.server, port: String(n.port), id: n.uuid, aid: String(n.alterId || 0), net: n.network || 'tcp', type: 'none', host: n.host || '', path: n.path || '', tls: n.tls ? 'tls' : '', sni: n.sni || '' };
        lines.push('vmess://' + btoa(JSON.stringify(cfg)));
        break;
      }
      case 'ss': {
        const userInfo = btoa(`${n.cipher}:${n.password}`);
        lines.push(`ss://${userInfo}@${n.server}:${n.port}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'trojan': {
        const params = n.sni ? `?sni=${n.sni}` : '';
        lines.push(`trojan://${n.password}@${n.server}:${n.port}${params}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'vless': {
        const params = new URLSearchParams();
        if (n.network) params.set('type', n.network);
        if (n.tls) params.set('security', n.realityOpts ? 'reality' : 'tls');
        if (n.sni) params.set('sni', n.sni);
        if (n.flow) params.set('flow', n.flow);
        if (n.realityOpts) { params.set('pbk', n.realityOpts.publicKey); params.set('sid', n.realityOpts.shortId); }
        if (n.path) params.set('path', n.path);
        if (n.host) params.set('host', n.host);
        lines.push(`vless://${n.uuid}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'hysteria2': {
        const params = new URLSearchParams();
        if (n.sni) params.set('sni', n.sni);
        params.set('security', 'tls');
        lines.push(`hysteria2://${n.password}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`);
        break;
      }
    }
  }
  return btoa(lines.join('\n'));
}

// SS SIP002 输出
export function toSS(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.type === 'ss') {
      const userInfo = btoa(`${n.cipher}:${n.password}`);
      lines.push(`ss://${userInfo}@${n.server}:${n.port}#${encodeURIComponent(n.name)}`);
    }
  }
  return btoa(lines.join('\n'));
}

// Trojan 输出
export function toTrojan(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.type === 'trojan') {
      const params = n.sni ? `?sni=${n.sni}` : '';
      lines.push(`trojan://${n.password}@${n.server}:${n.port}${params}#${encodeURIComponent(n.name)}`);
    }
  }
  return btoa(lines.join('\n'));
}

// 混合输出
export function toMixed(nodes: ProxyNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.raw) { lines.push(n.raw); continue; }
    switch (n.type) {
      case 'vmess': {
        const cfg = { v: '2', ps: n.name, add: n.server, port: String(n.port), id: n.uuid, aid: String(n.alterId || 0), net: n.network || 'tcp', type: 'none', host: n.host || '', path: n.path || '', tls: n.tls ? 'tls' : '', sni: n.sni || '' };
        lines.push('vmess://' + btoa(JSON.stringify(cfg)));
        break;
      }
      case 'ss': {
        const userInfo = btoa(`${n.cipher}:${n.password}`);
        lines.push(`ss://${userInfo}@${n.server}:${n.port}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'trojan': {
        const params = n.sni ? `?sni=${n.sni}` : '';
        lines.push(`trojan://${n.password}@${n.server}:${n.port}${params}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'vless': {
        const params = new URLSearchParams();
        if (n.network) params.set('type', n.network);
        if (n.tls) params.set('security', n.realityOpts ? 'reality' : 'tls');
        if (n.sni) params.set('sni', n.sni);
        if (n.flow) params.set('flow', n.flow);
        if (n.realityOpts) { params.set('pbk', n.realityOpts.publicKey); params.set('sid', n.realityOpts.shortId); }
        if (n.path) params.set('path', n.path);
        if (n.host) params.set('host', n.host);
        lines.push(`vless://${n.uuid}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`);
        break;
      }
      case 'hysteria2': {
        const params = new URLSearchParams();
        if (n.sni) params.set('sni', n.sni);
        params.set('security', 'tls');
        lines.push(`hysteria2://${n.password}@${n.server}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`);
        break;
      }
    }
  }
  return btoa(lines.join('\n'));
}

export function convert(nodes: ProxyNode[], target: TargetType): string {
  switch (target) {
    case 'clash': return toClash(nodes);
    case 'singbox': return toSingBox(nodes);
    case 'v2ray': return toV2Ray(nodes);
    case 'ss': return toSS(nodes);
    case 'trojan': return toTrojan(nodes);
    case 'mixed': return toMixed(nodes);
  }
}
