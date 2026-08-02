import { useState, useCallback } from 'react';
import { Button, Input, Checkbox, Badge, Text, Loader } from '@cloudflare/kumo';
import '@cloudflare/kumo/styles/standalone';
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
  { value: '', label: '本站后端' },
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

  // 生成完整的订阅 URL，始终使用当前页面 origin 作为默认后端
  const generateUrl = useCallback(() => {
    if (!subUrl.trim()) return '';
    const params = new URLSearchParams();
    params.set('target', target);
    params.set('url', subUrl.trim());
    if (!emoji) params.set('emoji', 'false');
    if (include) params.set('include', include);
    if (exclude) params.set('exclude', exclude);
    // backend 为空时用本站后端（当前 origin）
    const base = backend || window.location.origin;
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
    <div className="app-container">
      <div className="app-content">
        <div className="app-header">
          <Text variant="heading1" as="h1">订阅转换</Text>
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="sub-title">
            Cloudflare Workers + Kumo
          </Text>
        </div>

        <div className="form-card">
          <div className="field-group">
            <label className="field-label">订阅链接</label>
            <Input
              name="subUrl"
              value={subUrl}
              onChange={(e: any) => setSubUrl(e.target.value)}
              placeholder="https://example.com/sub"
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label">生成类型</label>
              <div className="native-select-wrapper">
                <select
                  className="native-select"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">后端地址</label>
              <div className="native-select-wrapper">
                <select
                  className="native-select"
                  value={backend}
                  onChange={(e) => setBackend(e.target.value)}
                >
                  {BACKEND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label">包含节点 (选填)</label>
              <Input value={include} onChange={(e: any) => setInclude(e.target.value)} placeholder="ss,vmess" />
            </div>
            <div className="field-group">
              <label className="field-label">排除节点 (选填)</label>
              <Input value={exclude} onChange={(e: any) => setExclude(e.target.value)} placeholder="ssr" />
            </div>
          </div>

          <div className="checkbox-row">
            <Checkbox
              checked={emoji}
              onCheckedChange={(checked: boolean) => setEmoji(!!checked)}
              label="启用 Emoji"
            />
          </div>

          <div className="actions-row">
            <Button variant="primary" onClick={handleGenerate} disabled={loading || !subUrl.trim()}>
              {loading ? <Loader size="sm" /> : '生成订阅链接'}
            </Button>
            <Button variant="secondary" onClick={handleCopy} disabled={!generatedUrl}>
              {copied ? '已复制' : '复制链接'}
            </Button>
          </div>

          {generatedUrl && (
            <div className="field-group">
              <label className="field-label">订阅地址</label>
              <div className="url-box">
                <code>{generatedUrl}</code>
              </div>
            </div>
          )}

          {error && (
            <div className="error-box">
              <Badge variant="red">{error}</Badge>
            </div>
          )}

          {result && (
            <div className="field-group">
              <label className="field-label">转换结果</label>
              <pre className="result-pre">{result.slice(0, 5000)}</pre>
              {result.length > 5000 && (
                <Text variant="secondary" size="sm" as="p" DANGEROUS_className="truncate-note">
                  ... (已截断，共 {result.length} 字符)
                </Text>
              )}
            </div>
          )}
        </div>

        <div className="app-footer">
          <a href="https://github.com/zqs1qiwan/subconverter-edge" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </div>
    </div>
  );
}
