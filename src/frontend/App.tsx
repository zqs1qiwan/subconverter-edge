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

const QR_TARGETS = new Set(['shadowrocket', 'v2ray', 'ss', 'trojan', 'mixed']);

export default function App() {
  const [subUrl, setSubUrl] = useState('');
  const [target, setTarget] = useState('clash');
  const [backend, setBackend] = useState('');
  const [emoji, setEmoji] = useState(true);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
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

    return `${backend || window.location.origin}/sub?${params.toString()}`;
  }, [subUrl, target, backend, emoji, include, exclude]);

  const resetResult = () => {
    setGeneratedUrl('');
    setQrDataUrl('');
    setCopied(false);
    setError('');
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

  return (
    <main className="app-shell">
      <a className="github-corner" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        <span>部署我自己的转换服务</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
      </a>

      <section className="hero-panel">
        <div className="hero-copy">
          <Text variant="heading1" as="h1">SubconverterEdge 在线订阅转换</Text>
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="hero-subtitle">
            粘贴订阅链接，选择客户端格式，生成可复制或扫码导入的订阅地址。
          </Text>
        </div>

        <div className="converter-card">
          <div className="field-group field-main">
            <label className="field-label" htmlFor="sub-url">订阅链接</label>
            <Input
              id="sub-url"
              name="subUrl"
              value={subUrl}
              onChange={(e: any) => { setSubUrl(e.target.value); resetResult(); }}
              placeholder="支持订阅链接或单节点链接，多个链接用 | 分隔"
            />
            <p className="field-hint">支持 SS / SSR / VMess / VLESS / Trojan / Hysteria2 / Clash 订阅。</p>
          </div>

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

          <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span>高级选项</span>
            <svg viewBox="0 0 24 24" className={showAdvanced ? 'chevron-open' : ''}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              <div className="field-grid compact-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="include">包含</label>
                  <Input id="include" value={include} onChange={(e: any) => { setInclude(e.target.value); resetResult(); }} placeholder="ss,vmess" />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="exclude">排除</label>
                  <Input id="exclude" value={exclude} onChange={(e: any) => { setExclude(e.target.value); resetResult(); }} placeholder="ssr" />
                </div>
              </div>
              <div className="options-row">
                <Checkbox checked={emoji} onCheckedChange={(checked: boolean) => { setEmoji(!!checked); resetResult(); }} label="Emoji" />
              </div>
            </div>
          )}

          {error && <Badge variant="red">{error}</Badge>}

          <div className="actions-row">
            <button className="btn-primary" onClick={handleGenerate} disabled={loading || !subUrl.trim()}>
              {loading ? <Loader size="sm" /> : '生成订阅链接'}
            </button>
            <button className="btn-secondary" onClick={handleCopy} disabled={!generatedUrl}>
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>

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
        </div>
      </section>
    </main>
  );
}
