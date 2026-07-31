import { useState, useCallback } from 'react';
import './styles.css';

const TARGETS = [
  { value: 'clash', label: 'Clash' },
  { value: 'singbox', label: 'Sing-Box' },
  { value: 'v2ray', label: 'V2Ray' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'ss', label: 'Shadowsocks' },
  { value: 'mixed', label: '混合订阅' },
];

const BACKEND_OPTIONS = [
  { value: '', label: '本站后端 (sub.laobaitv.net)' },
  { value: 'https://api.v1.mk', label: '肥羊增强型后端' },
];

export default function App() {
  const [subUrl, setSubUrl] = useState('');
  const [target, setTarget] = useState('clash');
  const [backend, setBackend] = useState('');
  const [emoji, setEmoji] = useState(true);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateUrl = useCallback(() => {
    if (!subUrl.trim()) return '';
    const params = new URLSearchParams();
    params.set('target', target);
    params.set('url', subUrl.trim());
    if (!emoji) params.set('emoji', 'false');
    if (include) params.set('include', include);
    if (exclude) params.set('exclude', exclude);
    const base = backend || '';
    return `${base}/sub?${params.toString()}`;
  }, [subUrl, target, backend, emoji, include, exclude]);

  const handleGenerate = async () => {
    const url = generateUrl();
    if (!url) { setError('请输入订阅链接'); return; }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      setResult(text);
    } catch (e: any) {
      setError(e.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const url = generateUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const generatedUrl = generateUrl();

  return (
    <div className="app">
      <header className="header">
        <h1>订阅转换</h1>
        <p>sub.laobaitv.net — Cloudflare Edge</p>
      </header>

      <main className="main">
        <div className="card">
          <div className="field">
            <label>订阅链接</label>
            <input
              type="text"
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              placeholder="https://example.com/sub"
            />
          </div>

          <div className="row">
            <div className="field">
              <label>生成类型</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label>后端地址</label>
              <select value={backend} onChange={(e) => setBackend(e.target.value)}>
                {BACKEND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>包含节点 (选填)</label>
              <input type="text" value={include} onChange={(e) => setInclude(e.target.value)} placeholder="ss,vmess" />
            </div>
            <div className="field">
              <label>排除节点 (选填)</label>
              <input type="text" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="ssr" />
            </div>
          </div>

          <div className="checkbox">
            <label>
              <input type="checkbox" checked={emoji} onChange={(e) => setEmoji(e.target.checked)} />
              <span>启用 Emoji</span>
            </label>
          </div>

          <div className="actions">
            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? '生成中...' : '生成订阅链接'}
            </button>
            <button className="btn-secondary" onClick={handleCopy} disabled={!generatedUrl}>
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>

          {generatedUrl && (
            <div className="output-url">
              <label>订阅地址</label>
              <div className="url-box">
                <code>{generatedUrl}</code>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {result && (
            <div className="result">
              <label>转换结果</label>
              <pre>{result.slice(0, 5000)}</pre>
              {result.length > 5000 && <p className="truncated">... (已截断，共 {result.length} 字符)</p>}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <a href="https://github.com/zqs1qiwan/subconverter-edge" target="_blank" rel="noopener">GitHub</a>
        <span>© LaobaiTools</span>
      </footer>
    </div>
  );
}
