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
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
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
      return new Response('subconverter-edge v1.0.0', { headers: { 'Content-Type': 'text/plain' } });
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

  if (!subUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const targetType = TARGET_TYPES[target] || 'clash';
  let allNodes: any[] = [];
  let subInfo: any = undefined;

  // 支持多个订阅 (用 | 分隔)
  const urls = subUrl.split('|').filter(u => u.trim());

  for (const u of urls) {
    const trimmed = u.trim();
    // 如果是节点 URI (不以 http 开头)，直接当内容解析
    if (trimmed.startsWith('ss://') || trimmed.startsWith('ssr://') || trimmed.startsWith('vmess://') || trimmed.startsWith('vless://') || trimmed.startsWith('trojan://')) {
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
      // 忽略单个订阅失败
    }
  }

  // 过滤节点
  if (includeNodeTypes) {
    const types = includeNodeTypes.split(',').map(t => t.trim());
    allNodes = allNodes.filter(n => types.includes(n.type));
  }
  if (excludeNodeTypes) {
    const types = excludeNodeTypes.split(',').map(t => t.trim());
    allNodes = allNodes.filter(n => !types.includes(n.type));
  }

  // Emoji 处理 (添加国旗)
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
    'Content-Type': targetType === 'clash' ? 'text/yaml; charset=utf-8' : targetType === 'singbox' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...CORS_HEADERS,
  };

  if (subInfo) {
    responseHeaders['subscription-userinfo'] = `upload=${subInfo.upload}; download=${subInfo.download}; total=${subInfo.total}; expire=${subInfo.expire}`;
  }

  return new Response(output, { headers: responseHeaders });
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
