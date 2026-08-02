import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 强制 Kumo 暗色模式（Kumo 默认用 light-dark() CSS 函数，
// 不设 data-mode=dark 会走亮色：text-kumo-default = 近黑色，在 #121212 背景上不可见）
document.documentElement.setAttribute('data-mode', 'dark');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
