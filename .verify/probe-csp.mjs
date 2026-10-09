/**
 * A/B 探针：验证「CSP 拦外发请求」这条断言**不是空跑**，
 * 并顺带证明本仓库这套策略是 **fail-closed** 的。
 *
 * 背景：给 CSP 写一个拼错的指令名（`connect-srcs`）在浏览器里是**静默忽略**的 ——
 * 响应头照样在、页面照样能跑，但保护为零。这是最难发现的一类失效。
 * 所以断言不能只检查"头里有没有 connect-src 这个字符串"，
 * 必须让浏览器**实际违一次规**，用 securitypolicyviolation 事件证明规则真的在拦。
 *
 * 本探针用三个本地小服务做对照：
 *   A  完整策略                      → 期望拦下
 *   B  拼错 connect-src，但保留 default-src 'none'  → 期望**仍然**拦下（回落兜底）
 *   C  拼错 connect-src，且**没有** default-src     → 期望**拦不住**（演示静默失效）
 *
 * 结论：只要 default-src 是 'none'，策略就是 fail-closed 的 ——
 * 哪怕将来有人手滑写错某个取数据的指令名，也不会悄悄变成"全放行"。
 * 这正是本仓库策略把 default-src 设成 'none' 而不是 'self' 的理由。
 *
 * 跑法：node .verify/probe-csp.mjs   （需要 dist/ 已构建、以及 playwright-core）
 */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const DIST = resolve(projectRoot, 'dist');

/** A · 完整策略（与 vite.config.ts 的 SECURITY_HEADERS 保持一致） */
const GOOD = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
].join('; ');

/** B · 手滑把 connect-src 拼错，但 default-src: 'none' 还在（期望：仍然拦得住） */
const TYPO_WITH_BACKSTOP = GOOD.replace("connect-src 'self'", "connect-srcs 'self'");

/** C · 拼错 **且** 没有 default-src 兜底（期望：静默放行 —— 这就是要避免的写法） */
const TYPO_NO_BACKSTOP = [
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-srcs 'self'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.sqlite': 'application/octet-stream',
};

function serve(csp) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = resolve(DIST, '.' + url.pathname);
    if (url.pathname === '/' || !extname(file)) file = resolve(DIST, 'index.html');
    try {
      const buf = readFileSync(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Content-Security-Policy': csp,
      });
      res.end(buf);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** 打开页面 → 主动向外部地址发一次请求 → 看有没有 securitypolicyviolation */
async function probe(browser, port) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(
    () =>
      new Promise((done) => {
        document.addEventListener(
          'securitypolicyviolation',
          (e) => done({ directive: e.violatedDirective, blocked: e.blockedURI }),
          { once: true },
        );
        fetch('https://example.com/exfil-probe').catch(() => {});
        setTimeout(() => done(null), 2500);
      }),
  );
  await page.close();
  return result;
}

const require = createRequire(import.meta.url);
const pwPath = process.env.PW_NODE_PATH;
const { chromium } = pwPath ? require(pwPath) : require('playwright-core');

/*
 * 定位一份可用的 Chromium。
 * 直接 `chromium.launch()` 会去找 `chrome-headless-shell`，而本机缓存里只有完整版
 * Chromium —— 所以这里沿用 browser.mjs 的策略：先看 CHROME_EXE，再扫 ms-playwright 缓存。
 */
function resolveChromeExe() {
  if (process.env.CHROME_EXE) return process.env.CHROME_EXE;
  const cacheRoot = 'C:/Users/PC/AppData/Local/ms-playwright';
  try {
    const dirs = readdirSync(cacheRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort((a, b) => Number(b.split('-')[1] ?? 0) - Number(a.split('-')[1] ?? 0));
    for (const d of dirs) {
      const exe = resolve(cacheRoot, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(exe)) return exe;
    }
  } catch {
    /* 走兜底 */
  }
  return `${cacheRoot}/chromium-1234/chrome-win64/chrome.exe`;
}

const browser = await chromium.launch({ executablePath: resolveChromeExe() });

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
};

const sGood = await serve(GOOD);
const sTypoBackstop = await serve(TYPO_WITH_BACKSTOP);
const sTypoBare = await serve(TYPO_NO_BACKSTOP);

const rGood = await probe(browser, sGood.address().port);
const rTypoBackstop = await probe(browser, sTypoBackstop.address().port);
const rTypoBare = await probe(browser, sTypoBare.address().port);

const show = (r) => (r ? `${r.directive} → ${r.blocked}` : '未触发违规（请求放行了）');
console.log(`A 完整策略                     ：${show(rGood)}`);
console.log(`B 拼错 but 有 default-src 'none'：${show(rTypoBackstop)}`);
console.log(`C 拼错 且 没有 default-src      ：${show(rTypoBare)}`);
console.log('');

check(
  'A 完整策略下浏览器确实拦下外发请求（断言的正向分支有效）',
  rGood !== null && /connect-src/.test(rGood.directive),
  show(rGood),
);
check(
  "B 拼错指令名但有 default-src 'none' → 仍然拦下（策略是 fail-closed 的）",
  rTypoBackstop !== null && /connect-src/.test(rTypoBackstop.directive),
  show(rTypoBackstop),
);
check(
  'C 拼错且无 default-src → 静默放行，证明"回落兜底"确实是 B 生效的原因',
  rTypoBare === null,
  show(rTypoBare),
);

sGood.close();
sTypoBackstop.close();
sTypoBare.close();
await browser.close();

console.log(
  `\n结果：${failed === 0 ? '探针结论成立 ✅ —— 策略 fail-closed，且断言分得清"拦得住/拦不住"' : `${failed} 项不符合预期 ❌`}`,
);
process.exit(failed === 0 ? 0 : 1);
