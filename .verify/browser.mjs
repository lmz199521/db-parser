/**
 * 浏览器侧验收（本地跑，不进产物）
 *
 * 覆盖设计室附录 B 的五条验收标准里能自动化的部分：
 *  1. 所有文字对底色的对比度 ≥4.5:1（亮 / 暗两套主题各查一遍）
 *  2. 分析过程中真的会显示「四步阶段清单」
 *  3. 只靠键盘能完成：切 Tab、在 JSON 树里展开三层节点
 *  4. 亮暗主题下侧栏都是深色面板
 *  5. 全站只出现四种动效时长（从 CSS 里静态核对）
 *
 * 以及几组「看不见的承诺」：
 *  6. 文件零上传 —— 监听所有请求，断言跨域 0 条、写请求 0 条（带下限守卫防空跑）
 *  7. 安全响应头 —— CSP 不只是"挂了头"，而是**让浏览器真的违一次规**证明它在拦；
 *     并校验部署配置所依赖的产物布局（wasm 无 hash、MIME 正确、assets 才有 hash）
 *
 * 另外顺手产出几张截图，方便人工看一眼版式。
 *
 * 运行：
 *   npm run verify:browser     （会先构建，再自动起预览服务，跑完自动收回）
 *
 * 前置：需要 playwright-core 与一份 Chromium。
 *   npm i -D playwright-core && npx playwright install chromium
 * 若装在了别处，用 PW_NODE_PATH 指向它的 node_modules；浏览器路径用 CHROME_EXE 覆盖。
 * 截图落在 .verify/shots/，方便人工复核版式。
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/*
 * playwright-core 装在受管的隔离工作区里（不污染本项目依赖），
 * 所以用 createRequire + NODE_PATH 去解析，而不是直接 import ——
 * ESM 的 import 不认 NODE_PATH。
 */
const requireFrom = createRequire(import.meta.url);
const PW_PATHS = [
  process.env.PW_NODE_PATH ?? 'C:/Users/PC/.workbuddy/binaries/node/workspace/node_modules',
];

async function loadPlaywright() {
  // 1) 本项目的 node_modules（如果哪天把它装成 devDependency，这条就会命中）
  try {
    return requireFrom('playwright-core');
  } catch {
    /* 继续走下面的绝对路径兜底 */
  }
  // 2) 受管隔离工作区。CJS 的 require 不认 file:// URL，这里必须用 import()
  const path = requireFrom('node:path');
  for (const base of PW_PATHS) {
    const entry = path.join(base, 'playwright-core', 'index.js');
    if (fs.existsSync(entry)) {
      const mod = await import(pathToFileURL(entry).href);
      return mod.default ?? mod;
    }
  }
  throw new Error(
    '找不到 playwright-core。装一个：npm i -D playwright-core，' +
      '或把 PW_NODE_PATH 指向已安装它的 node_modules 目录。',
  );
}

const { chromium } = await loadPlaywright();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');
const SHOTS = resolve(HERE, 'shots');
/** 构建产物目录 —— 第 13 组会直接检查它的布局（部署配置的缓存规则依赖这个布局） */
const DIST = resolve(PROJECT, 'dist');
/*
 * 用 127.0.0.1 而不是 localhost。
 * vite.config.ts 里 server/preview 都显式绑了 127.0.0.1（只对回环开放）。
 * 而 Windows 上 localhost 常常先解析到 ::1（IPv6），只绑 IPv4 的服务会连不上，
 * 表现为"服务明明起着却 fetch 失败"。写死 IPv4 地址就没这个歧义。
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const PREVIEW_PORT = new URL(BASE).port || '4173';

/** 找一份可用的 Chromium：先看 CHROME_EXE，再在 ms-playwright 缓存目录里扫最新的一版 */
function resolveChromeExe() {
  if (process.env.CHROME_EXE) return process.env.CHROME_EXE;
  const cacheRoot = 'C:/Users/PC/AppData/Local/ms-playwright';
  try {
    const dirs = fs
      .readdirSync(cacheRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort((a, b) => Number(b.split('-')[1] ?? 0) - Number(a.split('-')[1] ?? 0));
    for (const d of dirs) {
      const exe = resolve(cacheRoot, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    /* 没有缓存目录就走下面的兜底 */
  }
  // 兜底：给一个明确的原文，好让报错信息告诉用户该设 CHROME_EXE
  return `${cacheRoot}/chromium-1234/chrome-win64/chrome.exe`;
}
const EXE = resolveChromeExe();

fs.mkdirSync(SHOTS, { recursive: true });

/* ---------------------- 自己把预览服务器拉起来 ---------------------- */

/*
 * 脚本要跑在**构建产物**上（dist/），不是 dev server：
 * 只有构建后才会走真实的压缩、CSS 提取、动态 import 分包路径 ——
 * 首屏体积、引擎 chunk 拆分这些问题只在产物里才暴露得出来。
 *
 * 如果 4173 已经有服务在跑就直接复用（开发时方便），否则自己起一个并在结束时回收。
 */
let previewServer = null;

async function urlAlive(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensurePreview() {
  if (await urlAlive(`${BASE}/`)) {
    console.log(`（复用已在运行的预览服务：${BASE}）`);
    return;
  }
  const viteBin = resolve(PROJECT, 'node_modules/vite/bin/vite.js');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`找不到 ${viteBin}，先跑一次 npm install`);
  }
  if (!fs.existsSync(resolve(PROJECT, 'dist/index.html'))) {
    throw new Error('dist/ 里还没有产物，先跑一次 npm run build');
  }
  previewServer = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', PREVIEW_PORT, '--strictPort'],
    { cwd: PROJECT, stdio: 'ignore' },
  );
  for (let i = 0; i < 60; i += 1) {
    if (await urlAlive(`${BASE}/`)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('vite preview 20 秒内没有起来');
}

await ensurePreview();

function stopPreview() {
  if (previewServer && !previewServer.killed) {
    previewServer.kill();
    previewServer = null;
  }
}

process.on('exit', stopPreview);
process.on('SIGINT', () => {
  stopPreview();
  process.exit(130);
});

let failures = 0;
let passed = 0;
const check = (label, ok, detail = '') => {
  if (ok) passed += 1;
  else failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
};

/* ------------------------- 对比度计算（注入页面执行） ------------------------- */

const CONTRAST_SCRIPT = `(() => {
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map((v) => parseFloat(v.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  };

  /** 逐层向上合成，直到拿到一个不透明的背景 */
  const effectiveBg = (el) => {
    let acc = null;
    let node = el;
    while (node) {
      const cs = getComputedStyle(node);
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) acc = acc === null ? c : over(acc, c);
      if (acc && acc.a >= 1) return acc;
      node = node.parentElement;
    }
    return acc && acc.a >= 1 ? acc : { r: 255, g: 255, b: 255, a: 1 };
  };

  const hasOwnText = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 0) return true;
    }
    return false;
  };

  const out = [];
  let checked = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!hasOwnText(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    // 禁用控件 WCAG 明确豁免；这里单独统计，不和正文混在一起
    const disabled = el.closest(':disabled') !== null || el.closest('[aria-disabled="true"]') !== null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rect = el.getBoundingClientRect();
    // 跳过 1×1 的读屏专用区（.sr-live）和被裁掉的元素
    if (rect.width < 4 || rect.height < 4) continue;
    if (parseFloat(cs.opacity) === 0) continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    checked += 1; // 真正参与对比度比较的元素数量 —— 用来给断言加下限守卫
    const bg = effectiveBg(el);
    const fgComposited = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fgComposited, bg);

    if (got < need) {
      out.push({
        disabled,
        need,
        got: Math.round(got * 100) / 100,
        size,
        weight,
        cls: typeof el.className === 'string' ? el.className : '',
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().slice(0, 40),
        fg: cs.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      });
    }
  }
  return { checked, violations: out };
})()`;

/* --------------------------------- 主流程 --------------------------------- */

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

try {
  /* -------------------- 1. 四步阶段清单（拦截引擎下载） -------------------- */

  console.log('\n=== 1. 分析过程中的四步阶段清单 ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // 把动态 import 的引擎 chunk 拖慢，好在「加载解析引擎」这一步停住，抓得到清单
    await page.route('**/sql-wasm*', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '先看看示例数据' }).click();

    await page.waitForSelector('.steps', { timeout: 8000 });
    const stepLabels = await page.locator('.steps .step-label').allTextContents();
    check(
      '出现四步阶段清单',
      stepLabels.length === 4,
      stepLabels.join(' → '),
    );
    const currentLabel = await page.locator('.steps .step.is-current .step-label').textContent();
    check('当前步被显式标出', Boolean(currentLabel), String(currentLabel));
    const hasFoot = await page.locator('.loading-foot').isVisible().catch(() => false);
    check('显示真实累加秒表', hasFoot);
    await page.screenshot({ path: resolve(SHOTS, '01-分析中-四步清单.png') });

    await page.waitForSelector('.topbar-stats', { timeout: 20000 });
    // 原来这里是 check(..., true)，恒真、什么都不验证。改成真读一次顶栏数字
    const statTables = await page.locator('.topbar-stat b').first().textContent();
    check(
      '分析完成后进入工作区（顶栏统计已填充）',
      Number((statTables ?? '').replace(/[^\d]/g, '')) > 0,
      `顶栏显示 ${statTables} 张表`,
    );
    await ctx.close();
  }

  /* ------------------------ 2. 工作区 · 键盘与对比度 ------------------------ */

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1,
    // 第 10 组要验证"复制 SQL"真的把内容写进了剪贴板，没有这个权限 readText 会抛错
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const missing = [];

  /*
   * 「文件零上传」是本产品写在首页的第一承诺，但原来的验收只监听 4xx/5xx ——
   * 一次成功的、发往外部域名并携带文件字节的 POST 不会被发现，也就永远不会变红。
   * 这里把每一个请求都记下来，最后断言全程同源、且没有任何写请求。
   */
  const ORIGIN = new URL(BASE).origin;
  const externalReqs = [];
  const writeReqs = [];
  let sameOriginCount = 0;
  page.on('request', (r) => {
    let u;
    try {
      u = new URL(r.url());
    } catch {
      return;
    }
    if (!u.protocol.startsWith('http')) return;
    if (u.origin === ORIGIN) sameOriginCount += 1;
    else externalReqs.push(`${r.method()} ${r.url()}`);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) {
      writeReqs.push(`${r.method()} ${r.url()}`);
    }
  });

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location();
    consoleErrors.push(`${m.text()} @ ${loc.url || '(未知来源)'}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    missing.push(`FAILED ${r.failure()?.errorText ?? ''} ${r.url()}`);
  });

  await page.goto(`${BASE}/?sample=1&json=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar-stats', { timeout: 25000 });
  await page.waitForSelector('[role="tab"]', { timeout: 5000 });

  console.log('\n=== 2. Tab 键盘模型（roving tabindex） ===');
  {
    const zeroTabs = await page.locator('[role="tab"][tabindex="0"]').count();
    check('Tab 条里只有 1 个 tabIndex=0 的停留点', zeroTabs === 1, String(zeroTabs));

    const selectedBefore = await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
    await page.locator('[role="tab"][tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    const selectedAfter = await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
    const focusedAfter = await page.evaluate(() => document.activeElement?.id ?? '');
    check('→ 切换了选中的 Tab', selectedBefore !== selectedAfter, `${selectedBefore} → ${selectedAfter}`);
    check('→ 把焦点一起带走了', focusedAfter === selectedAfter, focusedAfter);

    await page.keyboard.press('Home');
    const home = await page.evaluate(() => document.activeElement?.id ?? '');
    check('Home 跳到第一个 Tab', home === 'tab-overview', home);

    await page.keyboard.press('End');
    const end = await page.evaluate(() => document.activeElement?.id ?? '');
    check('End 跳到最后一个 Tab', end === 'tab-sql', end);

    const panelTabIndex = await page.locator('[role="tabpanel"]').getAttribute('tabindex');
    check('面板可聚焦（tabIndex=0）', panelTabIndex === '0', String(panelTabIndex));

    const rovingAfter = await page.locator('[role="tab"][tabindex="0"]').count();
    check('切换后仍然只有 1 个停留点', rovingAfter === 1, String(rovingAfter));
  }

  console.log('\n=== 3. JSON 树键盘模型 ===');
  {
    await page.locator('[role="tab"]', { hasText: 'JSON 节点' }).click();
    await page.waitForSelector('.jsontree [role="treeitem"]', { timeout: 5000 });

    const rootSel = '.jsontree [role="treeitem"][data-path="root"]';
    check('树里有且只有一个 tabIndex=0 的节点', (await page.locator('.jsontree [role="treeitem"][tabindex="0"]').count()) === 1);

    await page.locator(rootSel).focus();
    const expandedBefore = await page.locator(rootSel).getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    check('Enter 切换展开状态', expandedBefore !== (await page.locator(rootSel).getAttribute('aria-expanded')), `${expandedBefore} → ${await page.locator(rootSel).getAttribute('aria-expanded')}`);
    await page.keyboard.press('Enter');

    await page.locator(rootSel).focus();
    await page.keyboard.press('ArrowRight');
    check('→ 展开根节点', (await page.locator(rootSel).getAttribute('aria-expanded')) === 'true');
    await page.keyboard.press('ArrowRight');
    const firstChildFocused = await page.evaluate(
      () => document.activeElement?.getAttribute('data-path') ?? '',
    );
    check('再按 → 进入第一个子节点', firstChildFocused.startsWith('root/'), firstChildFocused);

    // 连续 ↓ 走一段，确认焦点确实在树里移动
    const seen = new Set();
    for (let i = 0; i < 3; i += 1) {
      seen.add(await page.evaluate(() => document.activeElement?.getAttribute('data-path') ?? ''));
      await page.keyboard.press('ArrowDown');
    }
    check('↓ 在同一棵树里移动焦点', seen.size >= 2, [...seen].join(' | '));

    // 展开三层：深度优先往下钻
    // 注意不能简单地「→ →」连按两次就指望下沉 —— root 的第一个子节点往往是标量，
    // 在标量上按 → 什么也不会发生。所以下钻失败就 ↓ 换下一个兄弟节点再试。
    const levelOf = () =>
      page.evaluate(() => Number(document.activeElement?.getAttribute('aria-level') ?? 0));
    await page.locator(rootSel).focus();
    let depth = 1;
    for (let i = 0; i < 40; i += 1) {
      const before = await levelOf();
      await page.keyboard.press('ArrowRight'); // 展开当前节点（已展开则进入子节点）
      await page.keyboard.press('ArrowRight');
      const after = await levelOf();
      if (after > before) depth = Math.max(depth, after);
      if (depth >= 3) break;
      await page.keyboard.press('ArrowDown'); // 这条分支到底了，换下一个兄弟
    }
    check('键盘可下钻到第 3 层', depth >= 3, `最深 aria-level=${depth}`);

    const treeItemCount = await page.locator('.jsontree [role="treeitem"]').count();
    check('树渲染出节点', treeItemCount > 3, `${treeItemCount} 个`);

    const hasGroup = await page.locator('.jsontree [role="group"]').count();
    check('子节点包在 role="group" 里', hasGroup >= 1, `${hasGroup} 个 group`);

    const ariaAttrs = await page.evaluate(() => {
      const el = document.querySelector('.jsontree [role="treeitem"]');
      return {
        level: el?.getAttribute('aria-level'),
        setsize: el?.getAttribute('aria-setsize'),
        posinset: el?.getAttribute('aria-posinset'),
      };
    });
    check(
      'treeitem 带 aria-level / setsize / posinset',
      ariaAttrs.level !== null && ariaAttrs.setsize !== null && ariaAttrs.posinset !== null,
      JSON.stringify(ariaAttrs),
    );

    // 原来这里是 check(..., true)，恒真。改成记录前后状态再比较
    const readFocus = () =>
      page.evaluate(() => ({
        path: document.activeElement?.getAttribute('data-path') ?? '',
        level: Number(document.activeElement?.getAttribute('aria-level') ?? 0),
        expanded: document.activeElement?.getAttribute('aria-expanded'),
      }));
    const beforeLeft = await readFocus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    const afterLeft = await readFocus();
    check(
      '← 能收起或回到父节点',
      afterLeft.path !== beforeLeft.path ||
        afterLeft.level < beforeLeft.level ||
        afterLeft.expanded !== beforeLeft.expanded,
      `${beforeLeft.path}(L${beforeLeft.level}) → ${afterLeft.path}(L${afterLeft.level})`,
    );

    /*
     * 搜索不能把整棵树重挂载。
     * 做法：在 .jsontree 上打一个自定义属性当"指纹"，然后改搜索词。
     * React 若重挂载了这棵子树，元素会被换掉，指纹自然消失。
     */
    await page.evaluate(() => {
      document.querySelector('.jsontree')?.setAttribute('data-probe', 'kept');
    });
    await page.getByLabel('搜索 JSON 节点').fill('a');
    await page.waitForTimeout(150);
    check(
      '改搜索词不会重挂载整棵树（手动展开的层级得以保留）',
      (await page.locator('.jsontree[data-probe="kept"]').count()) === 1,
    );
    await page.getByLabel('搜索 JSON 节点').fill('');
    await page.waitForTimeout(150);

    await page.screenshot({ path: resolve(SHOTS, '02-JSON树-键盘.png') });
  }

  console.log('\n=== 3b. 只用键盘进入 JSON 节点树 ===');
  {
    /*
     * 改造前 JSON 单元格只是 <td onClick>：鼠标能点，键盘完全打不开 ——
     * 而这恰好是整个工具最核心的交互入口。这里验证它现在是一个真按钮。
     */
    await page.locator('[role="tab"]', { hasText: '数据预览' }).click();
    await page.waitForSelector('table.grid td .cell-json-btn', { timeout: 5000 });

    const cellBtn = page.locator('table.grid td .cell-json-btn').first();
    const label = await cellBtn.getAttribute('aria-label');
    check('JSON 单元格是一个带 aria-label 的按钮', Boolean(label), label ?? '(无)');

    const rows = await page.locator('table.grid tbody tr').count();
    const rowCount = await page.locator('table.grid').getAttribute('aria-rowcount');
    check(
      '表格声明了真实总行数（aria-rowcount），不会让读屏以为只有一页',
      Number(rowCount) > rows,
      `aria-rowcount=${rowCount}，DOM 里 ${rows} 行`,
    );

    await cellBtn.focus();
    /*
     * 深链 ?json=1 可能已经把第 1 行这一格选中了，此时回车是"收起"。
     * 先把状态归零，再验证"回车能展开"这条正向路径。
     */
    if ((await cellBtn.getAttribute('aria-pressed')) === 'true') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(120);
    }
    await page.keyboard.press('Enter');
    await page.waitForSelector('.jsontree', { timeout: 5000 });
    const jsonTabSelected = await page
      .locator('[role="tab"][aria-selected="true"]')
      .getAttribute('id');
    check('在单元格上按回车会打开 JSON 节点树', jsonTabSelected === 'tab-json', String(jsonTabSelected));
  }

  /*
   * 对比度扫描：**5 个 Tab 全扫**。
   *
   * 原来只扫了「总览」一个面板就下结论，而「数据预览 / 字段结构 / JSON 节点 / SQL 查询」
   * 这四个面板从未进入视野 —— 实测它们加起来有 700+ 处文字。
   * 另外 check(real.length === 0) 在「一个元素都没扫到」时也会成立，
   * 所以每条都配一个「至少扫到 N 处」的下限守卫。
   */
  const CONTRAST_TABS = ['总览', '数据预览', '字段结构', 'JSON 节点', 'SQL 查询'];

  const scanEveryTab = async (themeLabel) => {
    const perTab = [];
    for (const name of CONTRAST_TABS) {
      await page.locator('[role="tab"]', { hasText: name }).click();
      await page.waitForTimeout(320);
      const res = await page.evaluate(CONTRAST_SCRIPT);
      const violations = res?.violations ?? [];
      perTab.push({
        name,
        checked: res?.checked ?? 0,
        real: violations.filter((v) => !v.disabled),
        disabled: violations.filter((v) => v.disabled),
      });
    }

    const checked = perTab.reduce((sum, t) => sum + t.checked, 0);
    const real = perTab.flatMap((t) => t.real);
    check(
      `${themeLabel}：5 个 Tab 全扫，正文对比度全部达标`,
      real.length === 0,
      real.length === 0
        ? `${checked} 处文字 · 0 违规（${perTab.map((t) => `${t.name}${t.checked}`).join(' / ')}）`
        : `${real.length} 处：${real
            .slice(0, 6)
            .map((v) => `${v.cls || v.tag}(${v.got}:1 需${v.need})「${v.text}」`)
            .join(' ; ')}`,
    );
    // 下限守卫：扫到的元素太少，说明渲染或选择器出了问题，上面那条等于空跑
    check(`${themeLabel}：扫描到的文字元素足够多（防止空跑）`, checked >= 200, `${checked} 处`);

    const disabled = perTab.flatMap((t) => t.disabled);
    if (disabled.length > 0) {
      console.log(`  （不计入验收：${disabled.length} 处禁用态文字，WCAG 豁免）`);
    }
  };

  console.log('\n=== 4. 亮色主题对比度（5 个 Tab 全扫） ===');
  {
    await scanEveryTab('亮色主题');
    await page.locator('[role="tab"]', { hasText: '总览' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(SHOTS, '03-亮色-总览.png'), fullPage: false });
  }

  console.log('\n=== 5. 暗色主题对比度（5 个 Tab 全扫） ===');
  {
    await page.getByRole('button', { name: '切换到暗色主题' }).click();
    await page.waitForTimeout(250);
    await scanEveryTab('暗色主题');
    await page.locator('[role="tab"]', { hasText: '总览' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(SHOTS, '04-暗色-总览.png') });

    // 侧栏在两种主题下都必须是深色面板（值可以不同，但都必须够暗）
    const navLum = (color) => {
      const m = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return 1;
      return [m[1], m[2], m[3]]
        .map((v) => Number(v) / 255)
        .reduce((acc, v, i) => acc + [0.2126, 0.7152, 0.0722][i] * v, 0);
    };
    const navBgDark = await page.evaluate(() => {
      const el = document.querySelector('.sidebar');
      return el ? getComputedStyle(el).backgroundColor : '';
    });
    check(
      '暗色主题下侧栏是深色面板',
      navLum(navBgDark) < 0.2,
      `${navBgDark} 亮度≈${navLum(navBgDark).toFixed(3)}`,
    );

    await page.getByRole('button', { name: '切换到亮色主题' }).click();
    await page.waitForTimeout(150);
    const navBgLight = await page.evaluate(() => {
      const el = document.querySelector('.sidebar');
      return el ? getComputedStyle(el).backgroundColor : '';
    });
    check(
      '亮色主题下侧栏**仍是**深色面板（不是白底）',
      navLum(navBgLight) < 0.2,
      `${navBgLight} 亮度≈${navLum(navBgLight).toFixed(3)}`,
    );

    // 主区在两种主题下都要比画布亮/暗一层，不能和画布糊在一起
    const layerGap = await page.evaluate(() => {
      const canvas = getComputedStyle(document.body).backgroundColor;
      const card = document.querySelector('.card');
      return { canvas, card: card ? getComputedStyle(card).backgroundColor : '' };
    });
    check(
      '亮色主题下卡片与画布不是同一个色（有层次）',
      layerGap.canvas !== layerGap.card,
      `画布 ${layerGap.canvas} / 卡片 ${layerGap.card}`,
    );
  }

  console.log('\n=== 6. 动效时长只有四种 ===');
  {
    /*
     * ⚠️ 这条断言原来是个「空跑」的反面教材，把改动原因写在这里，防止以后又退化回去：
     *
     * 原实现用 /transition:[^;]*?(\d+)ms/ 去抓**字面毫秒**。但样式表里 14 条 transition
     * 全部写成 var(--dur-*)（token 引用，没有字面毫秒），animation 里也只有 `dropin 120ms`
     * 一条是毫秒制、其余是秒制。于是集合恒为 {120ms}、extra 恒为空 —— 断言永远 PASS。
     * 改 token 的值、新增一条秒制的 transition，它都发现不了。
     *
     * 现在分三步：
     *   ① 解析 --dur-* 的真实取值并校验它恰好是规范里的四个（这是「四种时长」的源头）；
     *   ② 把所有 transition / animation 里的 token 引用与秒制时长归一成毫秒后校验；
     *   ③ 加下限守卫 —— 抓不到样本就报错，防止正则再次退化后静默空跑。
     */
    const css = fs.readFileSync(resolve(PROJECT, 'src/styles.css'), 'utf8');
    const ALLOWED = [120, 140, 160, 240];

    /*
     * 先摘掉「减少动效」块。
     * 它里面是 animation-duration / transition-duration: 0.001ms !important ——
     * 这是用「极短时长代替 none」的标准写法（保证 transitionend 仍会触发），
     * 属于无障碍特性，不是 UI 动效时长，不该被纳入「四种时长」的约束。
     */
    const stripBlock = (source, header) => {
      const start = source.indexOf(header);
      if (start === -1) return source;
      const open = source.indexOf('{', start);
      if (open === -1) return source;
      let depth = 0;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) return source.slice(0, start) + source.slice(i + 1);
        }
      }
      return source;
    };
    const motionCss = stripBlock(css, '@media (prefers-reduced-motion: reduce)');

    // ① token 层：四种时长的源头
    const tokenVals = new Map();
    for (const m of motionCss.matchAll(/(--dur-[\w-]+):\s*([\d.]+)(ms|s)\s*;/g)) {
      tokenVals.set(m[1], parseFloat(m[2]) * (m[3] === 's' ? 1000 : 1));
    }
    const tokenDurs = [...tokenVals.values()].sort((a, b) => a - b);
    check(
      '四个 --dur-* token 恰好是规范里的四个值',
      JSON.stringify(tokenDurs) === JSON.stringify(ALLOWED),
      [...tokenVals].map(([k, v]) => `${k.replace('--dur-', '')}=${v}ms`).join(' · '),
    );

    /*
     * 转圈 / 骨架微光 / 进度条这类**连续加载指示器**不受「四种时长」约束 ——
     * 它们的时长语义是「转一圈多久」，跟交互反馈的过渡时长不是一回事。
     */
    const LOADING_ANIMS = new Set(['spin', 'indeterminate', 'shimmer']);

    // ② 引用层：字面时长与 token 引用都归一成毫秒
    const durs = new Set();
    for (const m of motionCss.matchAll(/(^|[;{\s])(transition|animation)(-duration)?\s*:([^;}]*)/g)) {
      const prop = m[2];
      const body = m[4];
      if (prop === 'animation') {
        const name = (body.match(/^\s*([A-Za-z_][\w-]*)/) ?? [])[1];
        if (name && LOADING_ANIMS.has(name)) continue;
      }
      for (const d of body.matchAll(/([\d.]+)(ms|s)\b/g)) {
        durs.add(parseFloat(d[1]) * (d[2] === 's' ? 1000 : 1));
      }
      for (const t of body.matchAll(/var\((--dur-[\w-]+)/g)) {
        if (tokenVals.has(t[1])) durs.add(tokenVals.get(t[1]));
      }
    }

    const sorted = [...durs].sort((a, b) => a - b);
    const extra = sorted.filter((v) => !ALLOWED.includes(v));
    check(
      'transition / animation 只出现规范里的四种时长',
      extra.length === 0,
      extra.length === 0
        ? `命中 ${sorted.length} 种：${sorted.join(', ')}ms`
        : `多出：${extra.join(', ')}ms`,
    );
    // ③ 下限守卫：抓不到足够样本说明正则已退化，这条断言等于没测
    check(
      '确实抓到了四种时长（防止断言空跑）',
      sorted.length === ALLOWED.length,
      `抓到 ${sorted.length} 种：${sorted.join(', ')}ms`,
    );
  }

  console.log('\n=== 7. 空态都带按钮 · 提示都带下一步 ===');
  {
    const files = fs.readdirSync(resolve(PROJECT, 'src/components'));
    const empties = [];
    for (const f of files.filter((f) => f.endsWith('.tsx'))) {
      const src = fs.readFileSync(resolve(PROJECT, 'src/components', f), 'utf8');
      if (src.includes('className="empty"') || src.includes("className={'empty'}")) empties.push(f);
    }
    check('组件层已全部改用 .state 四态组件', empties.length === 0, empties.join(', ') || '无残留');

    // 每个 .state 块里都必须有 .state-actions
    const noAction = [];
    for (const f of files.filter((f) => f.endsWith('.tsx'))) {
      const src = fs.readFileSync(resolve(PROJECT, 'src/components', f), 'utf8');
      const states = (src.match(/className="state"/g) ?? []).length;
      const actions = (src.match(/className="state-actions"/g) ?? []).length;
      if (states > actions) noAction.push(`${f}(${states} 个空态 / ${actions} 组按钮)`);
    }
    check('每个空态都配了 .state-actions 按钮', noAction.length === 0, noAction.join(', ') || '全部配套');
  }

  console.log('\n=== 7b. 「没有外键 / 没有索引」也要说出来 ===');
  {
    // 视图天然没有索引：切到 v_order_summary 的「字段结构」，应当看到一行说明而不是空白
    await page.locator('.sidebar').getByText('v_order_summary', { exact: true }).click();
    await page.locator('[role="tab"]', { hasText: '字段结构' }).click();
    await page.waitForSelector('.card-empty-note', { timeout: 5000 });
    const notes = await page.locator('.card-empty-note').allTextContents();
    check(
      '无外键 / 无索引都给出说明行，而不是把卡片直接藏起来',
      notes.length === 2 && notes.some((t) => t.includes('外键')) && notes.some((t) => t.includes('索引')),
      `${notes.length} 行：${notes.map((t) => t.slice(0, 12)).join(' | ')}`,
    );

    const fkCard = await page.locator('.card-head h2', { hasText: '外键关系' }).count();
    check('「外键关系」卡片即使为空也保留在页面上', fkCard === 1, `${fkCard} 个`);
  }

  /* --------------------------- 8. 响应式截图 --------------------------- */

  console.log('\n=== 8. 多尺寸截图 ===');
  {
    for (const [name, w, h] of [
      ['05-窄屏-390', 390, 844],
      ['06-平板-834', 834, 1000],
      ['07-宽屏-1680', 1680, 950],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
    }
    // 原来这里是 check(..., true)，恒真。改成真的去磁盘上核对文件
    const shotNames = ['05-窄屏-390', '06-平板-834', '07-宽屏-1680'];
    const shotOk = shotNames.every((n) => {
      const p = resolve(SHOTS, `${n}.png`);
      return fs.existsSync(p) && fs.statSync(p).size > 1000;
    });
    check(
      '三种尺寸截图已产出且都是非空文件',
      shotOk,
      shotNames.map((n) => `${n}: ${fs.existsSync(resolve(SHOTS, `${n}.png`)) ? `${fs.statSync(resolve(SHOTS, `${n}.png`)).size}B` : '缺失'}`).join(' · '),
    );

    // 窄屏下前两列应当粘性固定，--sticky-col-1-w 由组件实测写入
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[role="tab"]', { hasText: '数据预览' }).click();
    await page.waitForSelector('table.grid', { timeout: 5000 });
    await page.waitForTimeout(300);
    const stickyW = await page.evaluate(() => {
      const t = document.querySelector('table.grid');
      const first = t?.querySelector('thead th:nth-child(1)');
      return {
        var: t?.style.getPropertyValue('--sticky-col-1-w') ?? '',
        measured: first ? Math.round(first.getBoundingClientRect().width) : 0,
      };
    });
    check(
      '窄屏粘性列偏移是实测值（不是硬编码）',
      /^\d+(\.\d+)?px$/.test(stickyW.var) && Math.abs(parseFloat(stickyW.var) - stickyW.measured) <= 1,
      `--sticky-col-1-w=${stickyW.var} 实测=${stickyW.measured}px`,
    );
    await page.screenshot({ path: resolve(SHOTS, '08-窄屏-数据预览.png') });
  }

  /* --------------------- 10. 全键盘链路（不碰鼠标） --------------------- */

  console.log('\n=== 10. 全键盘链路：搜索表 → 切 Tab → 翻页 → 展开 JSON → 复制 SQL ===');
  {
    /*
     * 设计室验收标准第 3 条：只靠键盘走完主流程。
     * 这一段刻意**不出现任何 locator.click()** —— 焦点全靠 Tab 挪，
     * 操作全靠 Enter / 方向键。哪个环节只留给鼠标，这里就会断掉。
     */
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(200);

    const activeMatches = (sel) =>
      page.evaluate((s) => document.activeElement?.matches(s) ?? false, sel);
    const activeInfo = () =>
      page.evaluate(() => ({
        text: (document.activeElement?.textContent ?? '').trim().slice(0, 24),
      }));

    /** 把焦点放回文档起点，再一路 Tab 往下找，直到 activeElement 命中选择器 */
    const tabTo = async (sel, limit = 120) => {
      await page.evaluate(() => {
        const el = document.activeElement;
        if (el instanceof HTMLElement) el.blur();
      });
      for (let i = 0; i < limit; i += 1) {
        if (await activeMatches(sel)) return true;
        await page.keyboard.press('Tab');
      }
      return activeMatches(sel);
    };

    // --- 10a. 搜索表名 ---
    const tableTotal = await page.locator('.sidebar-body .tbl-item').count();
    check('Tab 能走到侧栏搜索框', await tabTo('input[aria-label="搜索表或字段"]'));
    await page.keyboard.type('orders');
    await page.waitForTimeout(200);
    const filtered = await page.locator('.sidebar-body .tbl-item').count();
    check(
      '只用键盘输入就过滤了表清单',
      filtered > 0 && filtered < tableTotal,
      `${tableTotal} → ${filtered}`,
    );
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    check(
      '清空搜索后表清单恢复',
      (await page.locator('.sidebar-body .tbl-item').count()) === tableTotal,
      `恢复至 ${tableTotal} 项`,
    );

    // --- 10b. 用方向键走完 5 个 Tab ---
    check(
      'Tab 能走到 Tab 条（roving tabindex 只留一个停留点）',
      await tabTo('[role="tab"][tabindex="0"]'),
    );
    await page.keyboard.press('Home');
    const walked = [];
    for (let i = 0; i < 5; i += 1) {
      walked.push(
        await page.evaluate(() => ({
          focused: document.activeElement?.id ?? '',
          selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? '',
          panel: document.querySelector('[role="tabpanel"]')?.id ?? '',
        })),
      );
      if (i < 4) await page.keyboard.press('ArrowRight');
    }
    check(
      '只用 ←→ 走完 5 个 Tab，焦点 / 选中态 / 面板三者同步',
      walked.length === 5 &&
        walked.every(
          (w) => w.focused === w.selected && w.panel === w.selected.replace('tab-', 'panel-'),
        ),
      walked.map((w) => w.panel.replace('panel-', '')).join(' → '),
    );

    // --- 10c. 搜索 + 回车选表，再翻页 ---
    check('Tab 能走到侧栏搜索框（第二遍）', await tabTo('input[aria-label="搜索表或字段"]'));
    await page.keyboard.type('orders');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');
    check('Tab 从搜索框进入表清单第一项', await activeMatches('.tbl-item'), (await activeInfo()).text);
    await page.keyboard.press('Enter');
    await page.waitForSelector('table.grid', { timeout: 5000 });
    await page.waitForTimeout(300);
    check(
      '回车选中表并落到「数据预览」',
      (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id')) === 'tab-data',
    );

    const pageBefore = await page.locator('.pager-page').textContent();
    check('Tab 能走到「下一页」按钮', await tabTo('[aria-label="下一页"]'));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const pageAfter = await page.locator('.pager-page').textContent();
    check('回车翻页生效', pageBefore !== pageAfter, `${pageBefore} → ${pageAfter}`);

    // --- 10d. 键盘打开并下钻 JSON 树 ---
    check('Tab 能走到 JSON 单元格按钮', await tabTo('.cell-json-btn'));
    await page.keyboard.press('Enter');
    await page.waitForSelector('.jsontree [role="treeitem"]', { timeout: 5000 });
    check(
      '回车把 JSON 节点树打开了',
      (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id')) === 'tab-json',
    );
    check('Tab 能进入树（树的唯一停留点）', await tabTo('.jsontree [role="treeitem"]'));
    const levelOf = () =>
      page.evaluate(() => Number(document.activeElement?.getAttribute('aria-level') ?? 0));
    let depth = 1;
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      depth = Math.max(depth, await levelOf());
      if (depth >= 3) break;
      await page.keyboard.press('ArrowDown'); // 分支到底了，换下一个兄弟再试
    }
    check('只用键盘能展开到第 3 层节点', depth >= 3, `最深 aria-level=${depth}`);

    // --- 10e. 复制 SQL ---
    await tabTo('[role="tab"][tabindex="0"]');
    await page.keyboard.press('End'); // 走到最后一个 Tab：SQL 查询
    await page.waitForTimeout(250);
    check(
      'End 键跳到「SQL 查询」',
      (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id')) === 'tab-sql',
    );
    check('Tab 能走到「复制 SQL」按钮', await tabTo('button[aria-label="复制 SQL 语句"]'));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check('回车真的把 SQL 写进了剪贴板', clip.includes('SELECT'), clip.slice(0, 48) || '(空)');

    const liveText = await page.locator('.sr-live').textContent();
    check(
      '整条链路都有读屏播报（.sr-live 有内容）',
      (liveText ?? '').trim().length > 0,
      (liveText ?? '').slice(0, 36),
    );
  }

  /* ---------------- 11. 窄屏：顶栏统计搬到信息卡（P1-3） ---------------- */

  console.log('\n=== 11. 窄屏下顶栏统计已搬到「数据库信息」卡片 ===');
  {
    await page.locator('[role="tab"]', { hasText: '总览' }).click();
    await page.waitForTimeout(250);
    const compact = page.locator('.meta-grid.is-compact-stats');

    /*
     * 口径一致性：顶栏与 KPI 卡片必须报同一个「总行数」。
     * 顶栏一度只累加表、KPI 卡累加表 + 视图，同一屏出现 929 与 1009 两个总数，
     * 看起来就像数据算错了。数字格式都由 formatNumber 统一，可以直接比字符串。
     */
    const barRows = (
      await page.locator('.topbar-stat', { hasText: '行数据' }).locator('b').textContent()
    )?.trim();
    const kpiRows = (
      await page.locator('.kpi', { hasText: '总行数' }).locator('.kpi-value').textContent()
    )
      ?.replace(/行\s*$/, '')
      .trim();
    check('顶栏与 KPI 卡的「总行数」口径一致', barRows === kpiRows, `顶栏 ${barRows} / KPI ${kpiRows}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    check(
      '窄屏下顶栏统计条隐藏（给品牌和按钮腾地方）',
      !(await page.locator('.topbar-stats').isVisible().catch(() => false)),
    );
    check('窄屏下信息卡里出现同样这四项台账', await compact.isVisible().catch(() => false));
    const keys = await compact.locator('.meta-k').allTextContents();
    check(
      '台账四项 = 数据表 / 总行数 / JSON 字段 / 解析耗时',
      JSON.stringify(keys) === JSON.stringify(['数据表', '总行数', 'JSON 字段', '解析耗时']),
      keys.join(' / '),
    );
    const vals = await compact.locator('.meta-v').allTextContents();
    check(
      '台账四项都填了值（不是空壳）',
      vals.length === 4 && vals.every((v) => v.trim().length > 0),
      vals.join(' / '),
    );
    await compact.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(SHOTS, '09-窄屏-信息卡台账.png') });
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(350);
    check(
      '桌面端台账隐藏，不与 KPI 卡片重复',
      !(await compact.isVisible().catch(() => false)),
    );
    check(
      '桌面端顶栏统计条回来了',
      await page.locator('.topbar-stats').isVisible().catch(() => false),
    );
  }

  console.log('\n=== 12. 文件零上传（首页第一承诺） ===');
  check(
    '全程没有任何跨域请求',
    externalReqs.length === 0,
    externalReqs.slice(0, 3).join(' | ') || '全部同源',
  );
  check(
    '没有向外发起的写请求',
    writeReqs.length === 0,
    writeReqs.join(' | ') || '无 POST / PUT / PATCH / DELETE',
  );
  // 下限守卫：一个请求都没观察到，说明监听器没生效，上面两条等于空跑
  check(
    '确实观察到了同源请求（防止监听失效导致空跑）',
    sameOriginCount >= 5,
    `观察到 ${sameOriginCount} 个同源请求`,
  );

  console.log('\n=== 9. 无运行时报错 ===');
  check(
    '没有 404 / 5xx 资源请求',
    missing.length === 0,
    missing.slice(0, 4).join(' | ') || '干净',
  );
  check(
    '控制台没有 error / 未捕获异常',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | ') || '干净',
  );

  /*
   * 13. 安全响应头（CSP 等）
   *
   * 这一组刻意放在**最后**：下面会主动制造一次 CSP 违规，
   * 因此必须先让第 9 组的「控制台干净」断言跑完，否则自己污染自己。
   *
   * 为什么必须验证「CSP 真的在拦」而不是只验证「头存在」：
   * 一个写错指令名的 CSP（比如把 connect-src 拼成 connect-srcs）会被浏览器
   * 当成未知指令静默忽略 —— 响应头照样在，页面照样能跑，但一点保护都没有。
   * 所以这里分两步：先断言头与关键指令存在，再让浏览器**实际违一次规**，
   * 用 securitypolicyviolation 事件证明它确实生效。
   */
  console.log('\n=== 13. 安全响应头 ===');
  const heads = await fetch(BASE, { redirect: 'follow' }).then((r) => r.headers);
  const csp = heads.get('content-security-policy') ?? '';
  check('响应里带了 Content-Security-Policy', csp.length > 0, csp.slice(0, 60) || '（缺失）');
  /*
   * 'wasm-unsafe-eval' 是**承载性**指令：删掉它 sql.js 就无法实例化 WASM，
   * 整站白屏。单独断言，免得有人"为了更安全"顺手精简掉。
   */
  check(
    "CSP 含 'wasm-unsafe-eval'（缺了 WASM 直接白屏）",
    csp.includes("'wasm-unsafe-eval'"),
    csp.includes("'wasm-unsafe-eval'") ? '在' : '缺失',
  );
  check(
    "CSP 含 connect-src 'self'（真正守住零上传的一行）",
    /connect-src 'self'/.test(csp),
    /connect-src 'self'/.test(csp) ? '在' : '缺失',
  );
  check('响应里带了 X-Content-Type-Options: nosniff', /nosniff/i.test(heads.get('x-content-type-options') ?? ''), heads.get('x-content-type-options') ?? '（缺失）');
  check('响应里带了 Referrer-Policy', (heads.get('referrer-policy') ?? '').length > 0, heads.get('referrer-policy') ?? '（缺失）');

  // WASM 真的被加载过（resource timing 里能看到），证明 wasm-unsafe-eval 起了作用
  const wasmLoaded = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.endsWith('.wasm'))
      .map((e) => ({ url: e.name.split('/').pop(), size: e.transferSize })),
  );
  check(
    'WASM 引擎确实被浏览器加载（CSP 没挡住实例化）',
    wasmLoaded.length >= 1,
    wasmLoaded.map((w) => `${w.url}(${Math.round(w.size / 1024)}KB)`).join(', ') || '（没观察到）',
  );

  /*
   * WASM 的 MIME 必须是 application/wasm。
   * 浏览器用 WebAssembly.instantiateStreaming 加载时，Content-Type 不对会直接拒绝 ——
   * 这是"部署到 Nginx 后白屏"最常见的原因之一，所以在构建产物这一层就验掉。
   */
  const wasmType = await page.evaluate(() =>
    fetch('sql-wasm.wasm', { method: 'HEAD' })
      .then((r) => r.headers.get('content-type') ?? '')
      .catch(() => ''),
  );
  check(
    'WASM 以 application/wasm 下发（MIME 错会白屏）',
    /application\/wasm/.test(wasmType),
    wasmType || '（没取到）',
  );

  /*
   * 下面这一组验的是**部署配置所依赖的前提**，不是配置本身。
   *
   * 为什么值得单独断言：README 里反复强调"缓存要按有没有 hash 分层"，
   * 而这条建议完全建立在两个事实之上 ——
   *   ① sql-wasm.wasm / sample.sqlite 在产物根目录，文件名**没有**内容 hash
   *   ② 只有 /assets/ 下的文件才带 hash
   * 一旦将来有人把 wasm 挪进 assets/，或者 Vite 改成给 public/ 资源也加 hash，
   * 那套缓存规则就会**静默地**从"正确"变成"会导致线上白屏"，
   * 而 nginx 配置本身看不出任何异常。所以把这个前提钉在验收里。
   *
   * 顺带说明：nginx 语法（nginx -t）和 docker 镜像构建不在自动验收范围内 ——
   * 本机不一定有这两个工具。README 的部署章节给了对应命令，部署前请自行跑一遍。
   */
  const rootFiles = fs.existsSync(DIST) ? fs.readdirSync(DIST) : [];
  const assetFiles = fs.existsSync(resolve(DIST, 'assets')) ? fs.readdirSync(resolve(DIST, 'assets')) : [];

  check(
    '产物根目录有 index.html',
    rootFiles.includes('index.html'),
    rootFiles.join(', ') || '（dist 不存在）',
  );
  check(
    'sql-wasm.wasm 在产物根目录且文件名**不含 hash**（缓存分层的依据）',
    rootFiles.includes('sql-wasm.wasm'),
    rootFiles.filter((f) => f.endsWith('.wasm')).join(', ') || '（没有 wasm）',
  );
  check(
    'sample.sqlite 在产物根目录（示例按钮依赖它）',
    rootFiles.includes('sample.sqlite'),
    rootFiles.filter((f) => f.endsWith('.sqlite')).join(', ') || '（没有示例库）',
  );
  check(
    '/assets/ 下的文件都带内容 hash（所以才能 immutable 缓存）',
    assetFiles.length > 0 && assetFiles.every((f) => /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(f)),
    assetFiles.join(', '),
  );
  check(
    'wasm **不在** /assets/ 下（放进去就会被打上 hash，缓存规则得跟着改）',
    !assetFiles.some((f) => f.endsWith('.wasm')),
    assetFiles.filter((f) => f.endsWith('.wasm')).join(', ') || '如预期：assets 里没有 wasm',
  );

  // 真违一次规：向外部地址发请求，看 CSP 是否出手阻断
  const violation = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const done = (v) => resolve(v);
        document.addEventListener(
          'securitypolicyviolation',
          (e) => done({ directive: e.violatedDirective, blocked: e.blockedURI }),
          { once: true },
        );
        // 指向一个必然存在的公网地址；不管它通不通，CSP 都应在发出前就拦下
        fetch('https://example.com/csp-probe').catch(() => {});
        setTimeout(() => done(null), 2000);
      }),
  );
  check(
    'CSP 实际拦下了向外部地址发起的请求（不是只挂了个头）',
    violation !== null && /connect-src/.test(violation.directive),
    violation ? `${violation.directive} → ${violation.blocked}` : '没有观察到违规事件（CSP 未生效）',
  );

  await ctx.close();
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? `\n结果：${passed} 项全部通过 ✅`
    : `\n结果：${passed} 项通过 · ${failures} 项失败 ❌`,
);
process.exit(failures === 0 ? 0 : 1);
