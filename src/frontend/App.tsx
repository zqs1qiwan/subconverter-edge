import { useState, useCallback } from 'react';
import { Button, Input, Select, Field, Checkbox, Badge, Text, Surface, Loader } from '@cloudflare/kumo';
import '@cloudflare/kumo/styles/standalone';

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
    <Surface className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="text-center pt-8 pb-2">
          <Text variant="heading1" as="h1">订阅转换</Text>
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="mt-1">
            sub.laobaitv.net — Cloudflare Edge
          </Text>
        </div>

        <Surface className="p-6 flex flex-col gap-5 rounded-xl border border-white/10">
          <Field label="订阅链接">
            <Input
              value={subUrl}
              onChange={(e: any) => setSubUrl(e.target.value)}
              placeholder="https://example.com/sub"
            />
          </Field>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Field label="生成类型">
                <Select
                  value={target}
                  onValueChange={(val: string | null) => setTarget(val || "clash")}
                  items={TARGETS.map(t => ({ label: t.label, value: t.value }))}
                />
              </Field>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Field label="后端地址">
                <Select
                  value={backend}
                  onValueChange={(val: string | null) => setBackend(val || "")}
                  items={BACKEND_OPTIONS.map(b => ({ label: b.label, value: b.value }))}
                />
              </Field>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Field label="包含节点 (选填)">
                <Input value={include} onChange={(e: any) => setInclude(e.target.value)} placeholder="ss,vmess" />
              </Field>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Field label="排除节点 (选填)">
                <Input value={exclude} onChange={(e: any) => setExclude(e.target.value)} placeholder="ssr" />
              </Field>
            </div>
          </div>

          <div>
            <Checkbox
              checked={emoji}
              onCheckedChange={(e: any) => setEmoji(!!e.checked)}
              label="启用 Emoji"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="primary" onClick={handleGenerate} disabled={loading || !subUrl.trim()}>
              {loading ? <Loader size="sm" /> : '生成订阅链接'}
            </Button>
            <Button variant="secondary" onClick={handleCopy} disabled={!generatedUrl}>
              {copied ? '已复制' : '复制链接'}
            </Button>
          </div>

          {generatedUrl && (
            <div className="flex flex-col gap-2">
              <Field label="订阅地址">
                <Surface className="p-3 break-all rounded-lg bg-white/5 border border-white/10">
                  <code className="text-sm text-indigo-400 font-mono">{generatedUrl}</code>
                </Surface>
              </Field>
            </div>
          )}

          {error && (
            <Badge variant="red">{error}</Badge>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              <Field label="转换结果">
                <pre className="bg-black/30 border border-white/10 rounded-lg p-4 text-sm overflow-auto max-h-96 font-mono text-gray-300">
                  {result.slice(0, 5000)}
                </pre>
              </Field>
              {result.length > 5000 && (
                <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
                  ... (已截断，共 {result.length} 字符)
                </Text>
              )}
            </div>
          )}
        </Surface>

        <div className="flex justify-center items-center gap-4 py-4 text-sm opacity-50">
          <a href="https://github.com/zqs1qiwan/subconverter-edge" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span>© LaobaiTools</span>
        </div>
      </div>
    </Surface>
  );
}
