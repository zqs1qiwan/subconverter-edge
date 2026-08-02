import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Input, Checkbox, Badge, Text, Loader } from '@cloudflare/kumo';
import '@cloudflare/kumo/styles/standalone';
import QRCode from 'qrcode';
import './styles.css';

const TARGETS = [
  { value: 'clash', label: 'Clash' },
  { value: 'singbox', label: 'Sing-Box' },
  { value: 'shadowrocket', label: 'Shadowrocket (小火箭)' },
  { value: 'v2ray', label: 'V2Ray' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'ss', label: 'Shadowsocks' },
  { value: 'mixed', label: '混合订阅' },
];

const BACKEND_OPTIONS = [
  { value: '', label: '本站后端' },
  { value: 'https://api.v1.mk', label: '肥羊增强型后端' },
];

// 需要二维码的 target
const SHOW_QR = ['shadowrocket', 'v2ray', 'ss', 'trojan', 'mixed'];

export default function App() {
  const [subUrl, setSubUrl] = useState('');
  const [target, setTarget] = useState('clash');
  const [backend, setBackend] = useState('');
  const [emoji, setEmoji] = useState(true);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 生成订阅 URL
  const buildUrl = useCallback(() => {
    if (!subUrl.trim()) return '';
    const params = new URLSearchParams();
    params.set('target', target);
    params.set('url', subUrl.trim());
    if (!emoji) params.set('emoji', 'false');
    if (include) params.set('include', include);
    if (exclude) params.set('exclude', exclude);
    const base = backend || window.location.origin;
    return `${base}/sub?${params.toString()}`;
  }, [subUrl, target, backend, emoji, include, exclude]);

  // 生成二维码
  useEffect(() => {
    if (qrDataUrl && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          ctx.drawImage(img, 0, 0, 240, 240);
        };
        img.src = qrDataUrl;
      }
    }
  }, [qrDataUrl]);

  const handleGenerate = async () => {
    const url = buildUrl();
    if (!url) { setError('请输入订阅链接'); return; }
    setLoading(true);
    setError('');
    setGeneratedUrl('');
    setQrDataUrl('');
    try {
      // 验证后端可用
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // 确认有内容
      const text = await resp.text();
      if (!text || text.includes('"error"')) {
        const j = JSON.parse(text);
        throw new Error(j.error || '转换失败');
      }
      setGeneratedUrl(url);
      // 生成二维码
      if (SHOW_QR.includes(target)) {
        const qr = await QRCode.toDataURL(url, {
          width: 240,
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

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

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

          {error && (
            <div className="error-box">
              <Badge variant="red">{error}</Badge>
            </div>
          )}

          <div className="actions-row">
            <Button variant="primary" onClick={handleGenerate} disabled={loading || !subUrl.trim()}>
              {loading ? <Loader size="sm" /> : '生成订阅链接'}
            </Button>
          </div>

          {generatedUrl && (
            <div className="result-section">
              <div className="field-group">
                <label className="field-label">订阅地址</label>
                <div className="url-box">
                  <code>{generatedUrl}</code>
                </div>
              </div>
              {qrDataUrl && (
                <div className="qr-section">
                  <label className="field-label">扫码导入</label>
                  <div className="qr-box">
                    <img src={qrDataUrl} alt="QR Code" width={240} height={240} />
                  </div>
                </div>
              )}
              <div className="actions-row">
                <Button variant="secondary" onClick={handleCopy}>
                  {copied ? '已复制' : '复制订阅地址'}
                </Button>
              </div>
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
