export interface ProxyNode {
  type: string;
  name: string;
  server: string;
  port: number;
  // SS
  cipher?: string;
  password?: string;
  // VMess
  uuid?: string;
  alterId?: number;
  network?: string;
  tls?: boolean;
  sni?: string;
  host?: string;
  path?: string;
  // VLESS
  flow?: string;
  realityOpts?: {
    publicKey: string;
    shortId: string;
    spiderX: string;
  };
  // Trojan
  sni2?: string;
  //通用
  alpn?: string;
  fingerprint?: string;
  insecure?: boolean;
  ssr?: {
    protocol: string;
    obfs: string;
    obfsParam: string;
    protocolParam: string;
  };
  // 原始链接
  raw?: string;
}

export interface SubscriptionInfo {
  upload: number;
  download: number;
  total: number;
  expire: number;
}

export interface ParseResult {
  nodes: ProxyNode[];
  subInfo?: SubscriptionInfo;
}

export type TargetType = 'clash' | 'singbox' | 'v2ray' | 'trojan' | 'ss' | 'mixed';
