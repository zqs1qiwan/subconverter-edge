export interface ProxyNode {
  type: string;
  name: string;
  server: string;
  port: number;
  cipher?: string;
  password?: string;
  uuid?: string;
  alterId?: number;
  network?: string;
  tls?: boolean;
  sni?: string;
  host?: string;
  path?: string;
  flow?: string;
  realityOpts?: { publicKey: string; shortId: string; spiderX: string };
  serviceName?: string;
  sni2?: string;
  alpn?: string;
  fingerprint?: string;
  insecure?: boolean;
  ssr?: { protocol: string; obfs: string; obfsParam: string; protocolParam: string };
  obfs?: string;
  mport?: string;
  ports?: string;
  up?: number;
  down?: number;
  raw?: string;
  extra?: Record<string, any>;
}
export interface SubscriptionInfo { upload: number; download: number; total: number; expire: number }
export interface ParseResult { nodes: ProxyNode[]; subInfo?: SubscriptionInfo }
export type TargetType = 'clash' | 'singbox' | 'v2ray' | 'trojan' | 'ss' | 'mixed' | 'shadowrocket';
export interface ConvertOptions {
  udp?: boolean; xudp?: boolean; tfo?: boolean; tls13?: boolean; scv?: boolean;
  fdn?: boolean; diydns?: boolean; clashDoh?: boolean; singboxIpv6?: boolean;
  appendType?: boolean; newName?: boolean; group?: string;
}
