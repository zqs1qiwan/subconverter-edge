import { useState, useCallback, useEffect } from 'react';
import { Input, Checkbox, Badge, Text, Loader } from '@cloudflare/kumo';
import '@cloudflare/kumo/styles/standalone';
import QRCode from 'qrcode';
import './styles.css';

const GITHUB_URL = 'https://github.com/zqs1qiwan/subconverter-edge';

const TARGETS = [
  { value: 'clash', label: 'Clash' },
  { value: 'singbox', label: 'Sing-Box' },
  { value: 'shadowrocket', label: 'Shadowrocket（小火箭）' },
  { value: 'v2ray', label: 'V2Ray' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'ss', label: 'Shadowsocks' },
  { value: 'mixed', label: 'Mixed' },
];

const BACKEND_OPTIONS = [
  { value: '', label: '本站服务' },
  { value: 'https://api.v1.mk', label: 'api.v1.mk（肥羊增强型后端）' },
];

const UA_OPTIONS = [
  { value: 'clash', label: 'Clash (默认)' },
  { value: 'singbox', label: 'Sing-Box' },
  { value: 'shadowrocket', label: 'Shadowrocket' },
  { value: 'v2ray', label: 'V2Ray' },
];

const REMOTE_CONFIGS = [
  { value: '', label: '不使用' },
  { value: 'clash-ruleset-a', label: 'ACL4SSR Online' },
  { value: 'clash-ruleset-b', label: 'ACL4SSR Online Full' },
  { value: 'clash-ruleset-c', label: 'ACL4SSR Online MultiMode' },
  { value: 'clash-ruleset-d', label: 'ACL4SSR Online NoAuto' },
  { value: 'clash-ruleset-e', label: 'ACL4SSR Online NoReject' },
  { value: 'clash-ruleset-f', label: 'ACL4SSR Online Mini' },
  { value: 'clash-ruleset-g', label: 'ACL4SSR Online Mini FalseIP' },
];

const QR_TARGETS = new Set(['shadowrocket', 'v2ray', 'ss', 'trojan', 'mixed']);

export default function App() {
  const [subUrl, setSubUrl] = useState('');
  const [target, setTarget] = useState('clash');
  const [backend, setBackend] = useState('');
  const [emoji, setEmoji] = useState(true);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [remoteConfig, setRemoteConfig] = useState('');
  const [ua, setUa] = useState('clash');
  const [subName, setSubName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shortLoading, setShortLoading] = useState(false);
  const [shortUrl, setShortUrl] = useState('');
  const [shortCopied, setShortCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // URL 参数预填
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('url')) setSubUrl(params.get('url')!);
    if (params.get('target')) setTarget(params.get('target')!);
    if (params.get('backend')) setBackend(params.get('backend')!);
    if (params.get('emoji') === 'false') setEmoji(false);
    if (params.get('include')) setInclude(params.get('include')!);
    if (params.get('exclude')) setExclude(params.get('exclude')!);
    if (params.get('config')) setRemoteConfig(params.get('config')!);
    if (params.get('ua')) setUa(params.get('ua')!);
    if (params.get('name')) setSubName(params.get('name')!);
  }, []);

  const buildUrl = useCallback(() => {
    const input = subUrl.trim();
    if (!input) return '';

    const params = new URLSearchParams();
    params.set('target', target);
    params.set('url', input);
    if (!emoji) params.set('emoji', 'false');
    if (include.trim()) params.set('include', include.trim());
    if (exclude.trim()) params.set('exclude', exclude.trim());
    if (remoteConfig) params.set('config', remoteConfig);
    if (ua !== 'clash') params.set('ua', ua);
    if (subName.trim()) params.set('name', subName.trim());

    return `${backend || window.location.origin}/sub?${params.toString()}`;
  }, [subUrl, target, backend, emoji, include, exclude, remoteConfig, ua, subName]);

  const resetResult = () => {
    setGeneratedUrl('');
    setQrDataUrl('');
    setCopied(false);
    setError('');
    setShortUrl('');
    setShortCopied(false);
  };

  const handleGenerate = async () => {
    const url = buildUrl();
    if (!url) {
      setError('请输入订阅链接');
      return;
    }

    setLoading(true);
    resetResult();

    try {
      const resp = await fetch(url, { cache: 'no-store' });
      const text = await resp.text();
      const contentType = resp.headers.get('content-type') || '';

      if (!resp.ok) {
        if (contentType.includes('application/json')) {
          try {
            const payload = JSON.parse(text);
            throw new Error(payload.error || `HTTP ${resp.status}`);
          } catch (e: any) {
            throw new Error(e.message || `HTTP ${resp.status}`);
          }
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      if (!text || text.length < 10) {
        throw new Error('后端返回空内容');
      }

      setGeneratedUrl(url);

      if (QR_TARGETS.has(target)) {
        const qr = await QRCode.toDataURL(url, {
          width: 248,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(qr);
      }
    } catch (e: any) {
      setError(e.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleShorten = async () => {
    if (!generatedUrl) return;
    setShortLoading(true);
    setShortUrl('');
    setShortCopied(false);
    try {
      const resp = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: generatedUrl }),
      });
      const data: any = await resp.json();
      if (data.error) throw new Error(data.error);
      setShortUrl(data.short);
    } catch (e: any) {
      setError(e.message || '短链接生成失败');
    } finally {
      setShortLoading(false);
    }
  };

  const handleShortCopy = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setShortCopied(true);
    window.setTimeout(() => setShortCopied(false), 1500);
  };

  return (
    <main className="app-shell">
      <a className="github-corner" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        <span>部署我自己的转换服务</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
      </a>

      <section className="hero-panel">
        <div className="hero-copy">
          <Text variant="heading1" as="h1">SubconverterEdge</Text>
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="hero-subtitle">
            在线订阅转换 · 支持多客户端格式 · 一键生成订阅地址和二维码
          </Text>
        </div>

        <div className="converter-card">
          {/* 订阅链接 */}
          <div className="field-group field-main">
            <label className="field-label" htmlFor="sub-url">订阅链接</label>
            <Input
              id="sub-url"
              name="subUrl"
              value={subUrl}
              onChange={(e: any) => { setSubUrl(e.target.value); resetResult(); }}
              placeholder="支持订阅链接或单节点链接，多个链接用 | 分隔"
            />
            <p className="field-hint">支持 SS / SSR / VMess / VLESS / Trojan / Hysteria2 / Clash 订阅</p>
          </div>

          {/* 客户端 + 后端 */}
          <div className="field-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="target">客户端</label>
              <div className="native-select-wrapper">
                <select id="target" className="native-select" value={target} onChange={(e) => { setTarget(e.target.value); resetResult(); }}>
                  {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="backend">后端</label>
              <div className="native-select-wrapper">
                <select id="backend" className="native-select" value={backend} onChange={(e) => { setBackend(e.target.value); resetResult(); }}>
                  {BACKEND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 高级选项折叠 */}
          <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span>高级选项</span>
            <svg viewBox="0 0 24 24" className={showAdvanced ? 'chevron-open' : ''}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              {/* 远程配置 */}
              <div className="field-group">
                <label className="field-label" htmlFor="config">远程配置</label>
                <div className="native-select-wrapper">
                  <select id="config" className="native-select" value={remoteConfig} onChange={(e) => { setRemoteConfig(e.target.value); resetResult(); }}>
                    {REMOTE_CONFIGS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <p className="field-hint">仅 Clash 格式生效，基于 ACL4SSR 规则模板</p>
              </div>

              {/* 包含 / 排除 */}
              <div className="field-grid compact-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="include">包含节点</label>
                  <Input id="include" value={include} onChange={(e: any) => { setInclude(e.target.value); resetResult(); }} placeholder="ss,vmess" />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="exclude">排除节点</label>
                  <Input id="exclude" value={exclude} onChange={(e: any) => { setExclude(e.target.value); resetResult(); }} placeholder="ssr" />
                </div>
              </div>

              {/* 订阅名称 */}
              <div className="field-group">
                <label className="field-label" htmlFor="subname">订阅名称</label>
                <Input id="subname" value={subName} onChange={(e: any) => { setSubName(e.target.value); resetResult(); }} placeholder="留空则使用原始订阅名" />
                <p className="field-hint">自定义导入客户端后显示的订阅名称</p>
              </div>

              {/* 请求 UA */}
              <div className="field-group">
                <label className="field-label" htmlFor="ua">请求 User-Agent</label>
                <div className="native-select-wrapper">
                  <select id="ua" className="native-select" value={ua} onChange={(e) => { setUa(e.target.value); resetResult(); }}>
                    {UA_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <p className="field-hint">影响上游订阅返回的格式和响应头，默认 Clash 兼容</p>
              </div>

              {/* Emoji */}
              <div className="options-row">
                <Checkbox checked={emoji} onCheckedChange={(checked: boolean) => { setEmoji(!!checked); resetResult(); }} label="Emoji 国旗" />
              </div>
            </div>
          )}

          {error && <Badge variant="red">{error}</Badge>}

          {/* 按钮区 */}
          <div className="actions-row">
            <button className="btn-primary" onClick={handleGenerate} disabled={loading || !subUrl.trim()}>
              {loading ? <Loader size="sm" /> : '生成订阅链接'}
            </button>
            <button className="btn-secondary" onClick={handleCopy} disabled={!generatedUrl}>
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>

          {/* 结果区 */}
          {generatedUrl && (
            <section className="result-card" aria-label="Generated subscription">
              <div className="result-url-row">
                <div className="field-group">
                  <label className="field-label">订阅地址</label>
                  <div className="url-box"><code>{generatedUrl}</code></div>
                </div>
              </div>
              {qrDataUrl && (
                <div className="qr-panel">
                  <img src={qrDataUrl} alt="Subscription QR code" width={248} height={248} />
                  <span>扫码导入</span>
                </div>
              )}
            </section>
          )}

          {/* 短链接区 */}
          {generatedUrl && (
            <section className="short-link-section">
              <button className="btn-tertiary" onClick={handleShorten} disabled={shortLoading}>
                {shortLoading ? <Loader size="sm" /> : shortUrl ? '重新生成短链接' : '生成短链接'}
              </button>
              {shortUrl && (
                <div className="short-link-result">
                  <div className="url-box short-url-box"><code>{shortUrl}</code></div>
                  <button className="btn-icon" onClick={handleShortCopy} title="复制短链接">
                    {shortCopied ? '✓' : '⧉'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
