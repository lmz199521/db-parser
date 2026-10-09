import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * 生产环境推荐响应头 —— **这里是单一事实来源**。
 *
 * 为什么把安全头写在构建配置里，而不是只写进 nginx 配置文档：
 * 写在文档里的头永远不会有人测。放在 `preview.headers` 之后，
 * `npm run verify:browser` 用真 Chromium 跑的就是**带这套头的页面** ——
 * CSP 一旦挡住 WASM 初始化，验收会当场变红，而不是等用户上线才发现白屏。
 *
 * 完整说明与「各平台怎么加同一套头」见 README「部署 → 安全响应头」。
 *
 * 关于 CSP 里最关键的一条：
 *   `connect-src 'self'` 才是真正守住「文件零上传」的那一行 ——
 *   即使页面里被塞进恶意脚本，它也没有可用的网络出口把数据发出去。
 *   `script-src` 里的 `'unsafe-inline'` 是为 index.html 那段防闪白内联脚本留的
 *   （要收紧就把它挪成外部文件，或改用 sha256 hash），
 *   但它不削弱"零上传"这条承诺 —— 外发数据靠的是 connect-src / img-src / form-action。
 *   `'wasm-unsafe-eval'` 是 sql.js 的 WASM 实例化所必需的，缺了会直接白屏。
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=()',
};

// base 用相对路径：这样构建产物既能挂站点根目录，也能挂 GitHub Pages 的子路径
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    /*
     * 只绑回环地址。
     * 不写这一行时，host 由 Vite 决定，某些环境下会监听 0.0.0.0 ——
     * 同一个 Wi-Fi 下的任何人都能打开你的开发页（包括热更新通道）。
     * 开发服务器不该对局域网开放。
     */
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    /*
     * 只挂在 preview（等价于"生产"），**不挂 dev**：
     * dev 走的是未打包的 ESM + HMR，严格 CSP 会干扰热更新调试，
     * 而那里没有"要守住的生产承诺"，加上只是徒增开发摩擦。
     * 需要验证生产行为时跑 `npm run verify:browser` 即可。
     */
    headers: SECURITY_HEADERS,
  },
  build: {
    outDir: 'dist',
    /*
     * 关掉"小资源内联成 base64"。
     *
     * 注意：**.wasm 本来就不受这个选项影响**（Vite 对 wasm 走单独的 URL 处理，
     * 不会内联）。这里真正想要的是别把 favicon、小图标之类塞进 JS bundle ——
     * 那样每次改图标都要重新下载整个 JS，也没法单独走缓存。
     * 之前那行注释写成"sql.js 的 wasm 单独成块"，是错的，容易误导后来人。
     */
    assetsInlineLimit: 0,
  },
});
