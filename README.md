# 数据库放大镜 · db-parser

> 把数据库文件拖进浏览器，自动分析出所有表、字段、主外键关系与 JSON 字段，并可视化呈现。
> **文件全程在浏览器本地解析，不会上传到任何服务器。**

## 为什么做这个

现有的工具要么是数据库客户端（`Chat2DB`、`CloudBeaver`、`Adminer`），要么是 JSON 浏览器（`jsonhero-web`、`jsoneditor`），
但**没有一个是「拖个文件进来 → 自动分析表结构 → 结果还能按 JSON 节点树展开」的**。

这个项目把两类工具的长处拼在一起：

| 能力 | 借鉴来源 |
| --- | --- |
| 拖文件即查、表结构呈现 | `Adminer`（单文件即用的极简思路）、`CloudBeaver`（表/字段/索引的信息组织） |
| JSON 节点树、路径、搜索 | `jsonhero-web`（把 JSON 当树浏览的交互范式） |
| 浏览器内跑 SQLite | `sql.js`（SQLite 编译成 WebAssembly，浏览器直接读写） |
| 一键部署到静态托管 | Vite 构建 + 相对路径 base，可直接挂 GitHub Pages / 任意静态服务器 |

## 在线体验

```bash
# 载入示例数据（含 5 张表、1 个视图、4 个 JSON 字段）
http://localhost:5173/?sample=1

# 再自动展开第一个 JSON 字段的节点树（适合演示 / 截图）
http://localhost:5173/?sample=1&json=1
```

## 界面结构

```
┌─ 顶栏 ── 品牌 │ 表数 / 行数 / JSON 字段数 / 解析耗时 │ 主题切换 │ 换个文件 ─┐
├──────────────┬────────────────────────────────────────────────────────────┤
│  侧栏        │  总览 │ 数据预览 │ 字段结构 │ JSON 节点 │ SQL 查询            │
│  搜索表/字段 │  ──────────────────────────────────────────────────────────│
│  ├ 表 (5)    │                                                            │
│  └ 视图 (1)  │   （Tab 内容区，吸顶标题 + 独立滚动）                        │
├──────────────┴────────────────────────────────────────────────────────────┤
└─ 页脚 ── 纯前端解析 · 文件不上传 · 支持 SQLite / .db / .sqlite3 ─────────────┘
```

### 五个 Tab 各自负责什么

| Tab | 内容 |
| --- | --- |
| **总览** | 5 张 KPI 卡片（表数 / 总行数 / 字段数 / JSON 字段数 / 解析耗时）+ 数据库元信息 + 表卡片网格，点卡片直接进对应表 |
| **数据预览** | 分页表格（25/50/100/200 行每页）、JSON 单元格点击即展开、一键导出当前表 CSV |
| **字段结构** | 字段画像（类型 / 约束 / 默认值 / 空值率 / 唯一值 / Top 3 取值分布）+ 外键 + 索引 + 建表 SQL，可导出 Markdown 数据字典 |
| **JSON 节点** | 节点树 / 原始文本双视图，搜索自动展开并高亮；没选单元格时列出所有可解析的 JSON 单元格供挑选 |
| **SQL 查询** | 多行 SQL 编辑器（⌘/Ctrl + Enter 执行）、结果表格、导出 CSV，附「表清单速查」一键生成 SELECT |

## 功能

### 已完成

- **拖拽 / 点击上传** `.sqlite` `.db` `.sqlite3` `.db3` 文件，自动校验文件头魔数；支持把新文件直接拖到工作区任意位置替换；超过 512MB 的文件在读进内存之前就被拦下并说明原因
- **自动分析**：表清单、行数、字段类型、主键、非空、默认值、索引、外键、建表 SQL
- **字段画像**：空值率、唯一值数、Top 5 取值分布（区分**全表精确**与**抽样**两档，界面上逐列标注统计口径，比例的分母永远和分子同源）
- **JSON 节点树**：JSON 字段自动识别（显式声明 + 抽样启发式双路径），点击单元格即展开，支持折叠、搜索高亮、分批渲染
- **数据预览**：前 200 行分页展示，BLOB 自动转成可读文本
- **视图支持**：与表同等对待（含视图输出列重名 —— SQLite 会消歧成 `x` / `x:1`，两列各自拿到正确统计）
- **自由查询**：执行任意 SQL，复用分析时打开的内存连接，改动只发生在内存副本；结果超过 500 行自动截断并如实报出真实总行数
- **导出**：表数据 / 查询结果导出 CSV，表结构导出 Markdown 数据字典；CSV 单元格会中和 `=` `+` `@` 以及"不像数字的 `-`"开头的公式注入
- **主题切换**：亮 / 暗双主题，跟随系统并记住选择，首屏无闪白
- **示例数据**：内置一套含外键与嵌套 JSON 的电商库，点一下就能看效果

### 计划中

- **上传 JSON / JSONL 文件直接预览**（复用现有节点树组件）
- **ER 关系图**：把外键画成表与表之间的连线
- **更多文件格式**：MySQL / PostgreSQL 的 `.sql` 导出文件解析
- **手机 ADB 直连**：通过 `adb` 拉取 Android 应用私有目录下的数据库后分析
- **URL 分享**：把分析结果压缩进 hash，方便贴给别人看

## 快速开始

```bash
# 1. 安装依赖（Node 18+，本项目在 Node 22 上开发）
npm install

# 2. 启动开发服务器
npm run dev
# 打开 http://localhost:5173

# 3. 构建生产包（产物在 dist/）
npm run build

# 4. 本地预览生产包
npm run preview
```

> **不需要任何手工预处理。** 示例库（`public/sample.sqlite` / `sample.json`）与
> SQLite 的 WASM 运行时（`public/sql-wasm.wasm`）都是**生成物，不在仓库里**，
> 由 npm 前置钩子在 `dev` / `build` / `verify` 跑起来之前自动重建 —— 见下方
> [为什么仓库里没有示例库](#为什么仓库里没有示例库)。
> 想单独跑一次：`npm run sync:wasm && npm run make-testdata`。

其他脚本：

```bash
npm run typecheck       # TypeScript 类型检查（含 vite.config.ts）
npm run verify          # 引擎回归验证（79 项断言，跑在 Node 里，不需要浏览器）
npm run verify:browser  # 浏览器端验收（84 项断言：对比度 / 键盘 / 零上传守护 / 安全响应头 …）
npm run verify:csp      # CSP 策略的 A/B/C 对照（证明策略是 fail-closed 的）
npm run check           # typecheck + verify + build 一条龙
npm run check:all       # check + verify:browser（共 163 项断言）
npm run sync:wasm       # 同步 sql.js 的 wasm 到 public/（predev / prebuild 会自动执行）
npm run make-testdata   # 生成示例库与示例 JSON（predev / prebuild / preverify 会自动执行）
```

### 验收脚本

`.verify/` 下的脚本不进产物，只服务于「改完代码怎么确认没改坏」：

| 脚本 | 作用 | 前置 |
| --- | --- | --- |
| `run.mjs` | 引擎层回归（79 项）：解析、JSON 识别、查询复用、魔数校验、行数口径、空值率不变量、视图重名列、CSV 中和。用 esbuild 把 `src/lib/sqlite.ts` 与 `src/lib/format.ts` 打成两个 bundle 后在 Node 里跑 | 无 |
| `browser.mjs` | 真浏览器验收（84 项）：亮暗两套主题 × 5 个 Tab 的对比度逐元素扫描、roving tabindex、JSON 树键盘下钻、**跨域请求与写请求监听**（守住「文件零上传」的承诺）、**安全响应头与 CSP 实效**、扫一遍控制台报错 | 需要 `playwright-core` 与一份 Chromium |
| `probe-csp.mjs` | CSP 策略的 A/B/C 对照：证明"拼错指令名也不会静默失效"这件事**是因为** `default-src 'none'` 在兜底 | 需要 `playwright-core` 与一份 Chromium |

`browser.mjs` / `probe-csp.mjs` 会用 `createRequire` 从受管隔离目录里加载 `playwright-core`，不污染项目依赖；
装在别处时用环境变量覆盖：`PW_NODE_PATH=<node_modules 路径>`、`CHROME_EXE=<chrome.exe 路径>`、`BASE_URL=<预览地址>`。

> 脚本里每条聚合型断言都配了**下限守卫**（例如"扫到的文字元素 ≥200 处"、"抓到 4 种时长"、
> "观察到 ≥5 个同源请求"）。理由：正则/选择器一旦因为改版而匹配不到东西，
> `0 处违规` 依然是"通过"——那种绿色比红色更危险。

完整的测试方案（分层、用例矩阵、测试数据、反向验证、CI 接线）见下方 [测试方案](#测试方案)。

**只想直接上线？** 跳到 [部署](#部署)：四条路线（托管平台 / GitHub Pages / Docker / 手动 Nginx），
配置文件和 CI 工作流都已经在这个仓库里了，最短的一条是 `docker compose up -d`。

### 为什么仓库里没有示例库

clone 下来会发现 `public/` 里只有一个 `_headers`，另外三个文件都不在 —— 这是**故意的**：

| 文件 | 由谁生成 | 为什么不留一份在仓库里 |
| --- | --- | --- |
| `public/sample.sqlite` | `npm run make-testdata` | 种子固定的伪随机，每次生成的内容完全一致 |
| `public/sample.json` | `npm run make-testdata` | 同上 |
| `public/sql-wasm.wasm` | `npm run sync:wasm` | 从 `node_modules/sql.js` 拷过来，是依赖的副本 |

**核心原因**：提交生成物等于同时维护「源码」和「产物」两份事实。哪天改了生成脚本
却忘了重新生成，仓库里就留着一份过期数据 —— **而且没有任何东西会报错**，
CI 全绿，部署正常，只有人眼去看才发现不对。让产物永远由脚本现造，
"过期"这个状态在物理上就不存在。

代价是需要有人负责在恰当的时候生成它们，这件事交给 npm 的生命周期钩子：

```jsonc
"predev":     "npm run sync:wasm && npm run make-testdata",  // npm run dev   之前
"prebuild":   "npm run sync:wasm && npm run make-testdata",  // npm run build 之前
"preverify":  "npm run make-testdata",                       // npm run verify 之前
```

所以 **`npm ci && npm run build` 就是全部**，不用记任何前置步骤。三个文件加起来
约 1 MB，顺带让 clone 快一点。

> 唯一的例外场景：如果你的构建环境禁用了 npm 生命周期脚本
> （`npm ci --ignore-scripts`、某些平台的"不执行依赖脚本"开关），
> 钩子不会跑，就需要在构建命令里显式写上 `npm run make-testdata && npm run build`。
> 本仓库提供的 CI 工作流与 Dockerfile 都**没有**关闭脚本，不需要这层保险。

## 目录结构

```
db-parser/
├── index.html                  # 入口 HTML：SEO / OG 元信息 + 主题与地址栏色预置脚本（防闪白）
├── vite.config.ts              # base 设为 './'，保证可挂子路径；server/preview 只绑回环
├── tsconfig.json               # 类型检查配置（src / scripts / vite.config.ts）
├── Dockerfile                  # 两阶段构建：Node 构建 → Nginx 托管（部署路线 C）
├── docker-compose.yml          # 一条命令起服务
├── .dockerignore               # 构建上下文排除清单
├── netlify.toml                # Netlify 零配置部署（部署路线 A1）
├── .github/workflows/
│   └── deploy-pages.yml        # Fork 后开箱即用的 Pages 部署工作流（部署路线 B）
├── deploy/
│   ├── nginx.conf              # Nginx 站点配置（部署路线 D）
│   └── security-headers.inc    # Nginx 用的安全响应头（每个 location 都要 include）
├── scripts/
│   ├── copy-wasm.mjs           # 把 sql.js 的 wasm 同步到 public/，并校验两个 wasm 是否一致
│   └── make-testdata.mjs       # 生成示例数据库与示例 JSON
├── .verify/                    # 验收脚本（不进产物，见上）
│   ├── run.mjs                 # 引擎层回归（79 项）
│   ├── browser.mjs             # 浏览器端验收（84 项）
│   ├── probe-csp.mjs           # CSP 策略 A/B/C 对照（证明 fail-closed）
│   ├── sqlite.bundle.mjs       # run.mjs 的编译产物（构建生成，已 gitignore）
│   └── format.bundle.mjs       # 同上，format.ts 的编译产物
├── public/
│   ├── _headers                # Netlify / Cloudflare Pages 读的响应头与缓存策略（本目录唯一入库的文件）
│   ├── sample.sqlite           # 示例库（生成物 · 不入库 · 由 predev/prebuild 自动重建）
│   ├── sample.json             # 示例 JSON（同上）
│   └── sql-wasm.wasm           # SQLite 的 WebAssembly 运行时（同上）
└── src/
    ├── main.tsx                # 挂载点
    ├── App.tsx                 # 主界面：状态编排、Tab 路由、全局拖拽、深链参数
    ├── styles.css              # 设计系统：Token → 基础元素 → 组件 → 布局
    ├── hooks/
    │   └── useTheme.ts         # 主题切换（DOM / localStorage / 系统偏好三级回退）
    ├── lib/
    │   ├── types.ts            # 全部数据结构定义
    │   ├── format.ts           # 格式化与导出工具（字节 / 百分比 / CSV / Markdown / 剪贴板）
    │   ├── sqljs.d.ts          # sql.js 的类型声明（官方包不带）
    │   └── sqlite.ts           # 解析与分析引擎（核心）
    └── components/
        ├── Icons.tsx           # 手写内联 SVG 图标集（零依赖）
        ├── TopBar.tsx          # 顶栏：品牌 / 统计 / 主题切换 / 进度线
        ├── Sidebar.tsx         # 侧栏：搜索 + 表/视图分组清单
        ├── DropZone.tsx        # 落地页拖拽区
        ├── OverviewPanel.tsx   # 总览：KPI + 数据库信息 + 表卡片网格
        ├── DataGrid.tsx        # 数据预览表格（分页 + 导出）
        ├── SchemaSection.tsx   # 字段结构 + 外键 + 索引 + 建表 SQL
        ├── JsonPanel.tsx       # JSON 面板：单元格选择器 + 节点树 / 原始文本
        ├── JsonTree.tsx        # JSON 节点树（折叠 / 搜索 / 分批渲染 / memo 化）
        └── QueryPanel.tsx      # SQL 查询面板
```

## 核心实现要点

### 1. 为什么不需要后端

SQLite 是单文件数据库，`sql.js` 把 SQLite 编译成了 WebAssembly，所以**浏览器能直接打开数据库文件**。
这意味着：没有服务端 → 没有 SSRF 风险 → 可以安全地公开部署。

### 2. 首屏只加载该加载的东西

- **sql.js 用动态 `import()` 引入**，约 1MB 的引擎代码被拆成独立 chunk，首屏不为它买单；
  页面空闲时再 `requestIdleCallback` 预热，等用户真拖文件进来时已经下好了
- **主包 206.9KB（gzip 67.9KB）**，其中大头是 React；CSS 40.6KB（gzip 9.0KB）
- WASM 文件放 `public/` 走静态资源，不被内联进 JS

### 3. 全表分析不会卡死界面

- 按**时间预算**让出主线程：主线程连续占用超过 32ms 就 `setTimeout(0)` 让出一帧。
  用时间而不是"每 N 张表一次"，是因为后者在两种极端下都出错 ——
  表多而小时让出过频、白白拉长总耗时；单表 30 万行时一次扫描就把主线程占满几秒
- 行数、字段画像都有「精确 / 抽样」两档：行数 ≤ 5 万走精确 SQL，超过则退化为抽样
- 文件超过 200MB 时，行数改用 `MAX(rowid)` 估算并如实标注

### 4. 渲染开销控制

- **表格分页**：预览最多 200 行，但按 25 行一页渲染，避免 200 行 × 20 列 = 4000 个单元格一次性入 DOM
- **JSON 节点树**：单个集合一次最多渲染 100 个子节点，超出部分点「继续加载」
- **表清单可搜索**：表名和字段名都能命中，表多的时候不至于翻花眼

### 5. SQL 查询复用连接

分析阶段打开的 `Database` 句柄会被保留下来给「SQL 查询」面板复用，
所以连续查询是毫秒级，而不是每次都把整个文件重新解析一遍。
换文件或点「换个文件」时才关闭 —— `releaseQueryDb()` 会释放，避免内存里一直挂着一个大库。

> 写入操作仍然只发生在内存副本上，用户磁盘上的文件不会被改动；刷新页面即丢弃。

### 6. 安全细节

- 所有表名 / 字段名一律用 `ident()` 转义后拼进 SQL，防止名称里的特殊字符导致语法错误或注入
- 单表分析各自 `try/catch`，一张表失败不影响整体报告
- 校验文件头：`SQLite format 3` 这 15 个字符**加上第 16 字节必须是 NUL**（官方头部固定 16 字节）。
  只比前 15 个字符的话，`SQLite format 3X…` 这种文件会被放行，然后在建库时才失败
- 复用的查询连接带 bytes 身份绑定，换成另一份文件立刻失效，避免串库
- **CSV 导出中和公式注入**：单元格以 `=` `+` `@` 制表符/回车开头时前面补一个 `'`，
  免得用户把这个工具打开的上游数据直接丢进 Excel 时被当成公式执行。
  `-` 单独收紧：只有"减号开头**且整个内容不是一个合法数字**"才中和
  （`-1` / `-1.5` / `-.5` / `-1e5` / `-1E-5` 都是正常数据，放宽会变文本；
  `-1+1` / `-=cmd|'/C calc'!A0` 必须挡，它们在 Excel 里会被求值）
- **SQL 结果按列下标返回**：`SELECT a.id, b.id` 或 JOIN 后的同名字段，用「列名 → 值」的对象装行
  会互相覆盖 —— 两列显示同一个值、导出的 CSV 也是错的
- **文件零上传是可验证的**：浏览器端验收脚本监听**所有请求**，
  断言"跨域请求 0 条、写请求 0 条"，并保留下限守卫（确实观察到 ≥5 个同源请求）——
  否则监听一旦失效，"0 条"也会是绿色
- **CSP 把"零上传"从承诺变成强制**：部署时下发 `connect-src 'self'` + `default-src 'none'`，
  浏览器层面堵死外发通道 —— 即使页面被注入脚本也传不出数据。
  `default-src` 取 `'none'` 而非 `'self'` 是为了让策略 **fail-closed**：
  指令名拼错时回落到全禁，而不是静默放行。
  这条性质由 `npm run verify:csp` 的三组对照实测过（详见 [部署 → 安全响应头](#安全响应头三个地方要保持一致)）

### 7. 无障碍

- 全站只保留**一个** `aria-live` 播报区（`.sr-live`），避免多个 live region 互相打断
- 播报相同文案时追加一个零宽空格：`aria-live` 只在文本真正变化时才念，
  连续两次"已复制"如果不制造变化，读屏会一声不吭
- 复制类操作**按返回值播报**：剪贴板 API 在非安全上下文里可能根本不存在，
  不能无条件说"已复制"
- 表格声明 `aria-rowcount` / `aria-rowindex` + `<caption>`：分页或截断后 DOM 里只有几十行，
  不声明真实行数，读屏会播报"共 25 行"，用户以为文件只有这么多数据
- 错误提示**不同时**用 `role="alert"` 和 `.sr-live`：`role="alert"` 是隐式的 assertive，
  两处都播会让同一句错误被念两遍

### 8. UI 设计系统

`styles.css` 分四层，改主题只需要动 Token 层：

```
Token（颜色 / 字号 / 圆角 / 阴影 / 布局）
  └─ 基础元素（body / 按钮 / 输入框 / 焦点样式）
       └─ 组件（卡片 / KPI / 表格 / 徽标 / 节点树 …）
            └─ 布局（骨架 / 工作区 / 侧栏 / 响应式）
```

- 换肤靠 `:root[data-theme='dark']` 覆盖 Token，组件层代码零改动
- 字段类型有专属配色族（整数 / 小数 / 文本 / JSON / 时间 / 二进制），全站统一
- 无障碍：`:focus-visible` 只对键盘用户显示描边、`prefers-reduced-motion` 关闭动效、Tab 有完整 `role`/`aria-selected`、表格有 `caption`
- 窄屏（≤860px）侧栏从左侧竖列变成顶部横向滑条

## 测试方案

### 0. 怎么跑

```bash
npm run check:all        # 全量：类型 → 引擎 79 项 → 构建 → 浏览器 84 项（共 163 项）
```

分层单跑（改哪层就只跑哪层，省时间）：

| 命令 | 层 | 耗时量级 | 什么时候跑 |
| --- | --- | --- | --- |
| `npm run typecheck` | L0 类型 | 秒级 | 每次改 `.ts` / `.tsx` |
| `npm run verify` | L1 + L2 引擎 | 秒级 | 改 `lib/` 下任何东西 |
| `npm run verify:browser` | L3 浏览器 | 十几秒 | 改组件 / CSS / 交互 / 部署配置 |
| `npm run verify:csp` | L3 浏览器（专项） | 几秒 | 改 CSP 策略 |
| `npm run check:all` | 全部 | 约 1 分钟 | 提交前、上线前 |

> `check:all` 是**提交前的唯一判据**。它绿了才允许 push —— 单跑某一层绿不代表没改坏别的层。

### 1. 四层金字塔

| 层 | 被测范围 | 载体 | 为什么单独一层 |
| --- | --- | --- | --- |
| **L0 类型** | 全部 TS | `tsc --noEmit` | 类型错误是最便宜的一类 bug，不该留给运行时 |
| **L1 纯函数** | `lib/format.ts` | `.verify/format.bundle.mjs` | 无副作用、无 DOM、无 DB。毫秒级，可以穷举边界值 |
| **L2 引擎集成** | `lib/sqlite.ts` + **真实 sql.js** | `.verify/sqlite.bundle.mjs` | 统计口径、SQL 拼装、截断逻辑只有真跑一遍 SQLite 才算数。**不 mock 引擎** |
| **L3 浏览器 E2E** | 组件 + CSS + 交互 + 网络 + 部署契约 | 真 Chromium（playwright-core） | 对比度、焦点、键盘链路、"零上传"、CSP 实效这类只有在真浏览器里才成立 |
| **L4 手工清单** | 见 §7 | 人 | 见 §7 |

L1 / L2 用 esbuild 把源码打成 ESM bundle 直接在 Node 里 import —— 不引测试框架、不装 jsdom，
断言就是 `console.log('[PASS] …')`。这样这个项目**零测试依赖**，clone 下来 `npm i` 就能跑。

### 2. 用例矩阵

按**风险域**分组。`覆盖` 列写的是当前状态，`待补` 的是明确知道还没测的。

#### A. 文件识别与容错

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| A1 | 正常 SQLite 文件 | 通过魔数校验 | L2 | ✅ |
| A2 | 前 15 字符对、第 16 字节不是 NUL | **拒绝** | L2 | ✅ |
| A3 | 长度 < 16 字节 | 拒绝 | L2 | ✅ |
| A4 | 前 15 字符完全不对（全 0） | 拒绝 | L2 | ✅ |
| A5 | 加密库（SQLCipher）/ 被截断的库 | 抛可读错误，不是堆栈 | L2 | ⚠️ 只测了"打开失败时报错文案"，没造真加密样本 |
| A6 | 超过 512MB | 在 `arrayBuffer()` 之前拦下 | L3 | ⚠️ 待补（造 512MB 文件成本高，可用 `MAX_FILE_BYTES` 单测替代） |
| A7 | 拖入 `.json` | 明确提示而不是静默失败 | L3 | ⚠️ 待补 |

#### B. 结构与统计口径（本项目最容易出错的一域）

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| B1 | 表 / 视图清单、系统表 `sqlite_*` 被排除 | 5 表 + 1 视图 | L2 | ✅ |
| B2 | 字段类型归一化 `POINT`/`INTERVAL` 含 `INT` → 整数族 | 跟 SQLite 官方 affinity 一致 | L2 | ✅ 由 `toTypeFamily` 间接覆盖 |
| B3 | 外键 / 索引 / DDL | 全部读到 | L2 | ✅ |
| B4 | **空值率 ≤ 100%**（分子分母必须同源） | 1000 行 800 空 → 80.0% | L2 | ✅ |
| B5 | `statsExact` 标记如实（精确 vs 抽样） | 小表全精确 | L2 | ✅ |
| B6 | **总行数包含估算值** | 30 万行估算 + 100 精确 = 300100 | L2 | ✅ |
| B7 | `allRowCountsExact` 决定"含估算值"字样 | 混入估算 → false | L2 | ✅ |
| B8 | 顶栏 / KPI / 台账 / `report.totalRows` 四处同源 | 全部 1,009 | L2+L3 | ✅ |
| B9 | **视图输出列重名**（`SELECT a AS x, b AS x`） | 消歧成 `x` / `x:1`，两列各自正确 | L2 | ✅ |
| B10 | 空表（0 行） | 不崩、不出现 `NaN%`、`statsExact` 留 false | L2 | ⚠️ 待补 |
| B11 | 声明类型为空的列 | 显示「（未声明）」 | L2 | ⚠️ 待补 |
| B12 | 宽表（200 列） | 不卡死、逐列统计齐全 | L2 | ⚠️ 待补 |

#### C. 查询

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| C1 | 分析完直接查询（连接复用） | 拿到结果 | L2 | ✅ |
| C2 | `SELECT 1 AS x, 2 AS x` 重名列 | 按列下标返回，`[1, 2]` 不覆盖 | L2 | ✅ |
| C3 | 超过 500 行 | `truncated=true`、`rows.length=500`、`totalRows=600` | L2 | ✅ |
| C4 | 未超限 | `truncated=false` | L2 | ✅ |
| C5 | 连续写操作（内存副本） | 写入可见，磁盘文件不动 | L2 | ✅ |
| C6 | 换文件后旧连接 | 立即失效 | L2 | ✅ |
| C7 | `releaseQueryDb()` 后查询 | 拒绝 | L2 | ✅ |
| C8 | 语法错误 SQL | 展示可读报错 + 下一步建议 | L3 | ✅（报错文案） |
| C9 | 多语句脚本 | 只返回第一个结果集 | L2 | ⚠️ 待补 |
| C10 | 查询结果 700 行时导出 CSV | 文件里只有 500 行**且界面明确提示** | L3 | ⚠️ 待补（提示已加，断言未加） |

#### D. 导出安全（CSV 公式注入）

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| D1 | `-1+1` / `-=cmd\|'/C calc'!A0` | 中和成 `'-1+1` | L2 | ✅ |
| D2 | 孤立 `-` | 中和 | L2 | ✅ |
| D3 | `-1` `-1.5` `-.5` `-0.5` `-1e5` `-1E-5` `5.` | **原样保留**（是合法数字） | L2 | ✅ |
| D4 | `=1+1` `+1` `@SUM(A1)` `\t` `\r` 开头 | 中和 | L2 | ✅ |
| D5 | 含逗号 / 双引号 / 换行 | RFC 4180 转义（`"a,b"` / `"a""b"`） | L2 | ✅ |
| D6 | `null` / `undefined` | 空单元格 | L2 | ✅ |
| D7 | 二维数组按列下标导出 | 重名列不覆盖 | L2 | ✅ |
| D8 | 对象行按列名导出 | 正常 | L2 | ✅ |
| D9 | 导出的 Markdown 数据字典 | 每列带「统计口径」列 | L2 | ⚠️ 待补 |

#### E. JSON 识别与节点树

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| E1 | 声明类型含 `JSON` | 识别 | L2 | ✅ |
| E2 | TEXT 列里能 `JSON.parse` 成功的值 | 抽样识别 | L2 | ✅ |
| E3 | `{看起来像 json 但解析不了}` | **不误判** | L2 | ✅ |
| E4 | 长文本只在第 61 字符起不同 | 唯一值数不被截断影响 | L2 | ⚠️ 待补（已修，断言未加） |
| E5 | 键名含 `/` 与 `~` | 路径按 RFC 6901 转义，不撞路径 | L3 | ⚠️ 待补 |
| E6 | 单集合 > 100 个子节点 | 分批渲染 + 「继续加载」 | L3 | ✅ |
| E7 | 搜索命中 | 自动展开并高亮 | L3 | ✅ |
| E8 | 键盘下钻到第 3 层 | `aria-level=3` | L3 | ✅ |
| E9 | 深层嵌套（10 层） | 不栈溢出、不错位 | L2 | ⚠️ 待补 |

#### F. 展示口径一致性（同一事实在多个位置必须同值）

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| F1 | 顶栏「总行数」= KPI「总行数」= 台账「总行数」 | 三处同值 | L3 | ✅ |
| F2 | 字段卡片口径注记与表格数字一致 | 「N/M 列全表精确」 | L3 | ⚠️ 待补 |
| F3 | 空值率单元格的 title 说明来源 | 精确 / 抽样 | L3 | ⚠️ 待补 |
| F4 | 表卡片「行数为估算值」角标只在估算时出现 | 精确时不出现 | L3 | ⚠️ 待补 |

#### G. 无障碍

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| G1 | 亮/暗 × 5 Tab 全部文字对比度 | 达 WCAG AA | L3 | ✅（693 处文字） |
| G2 | roving tabindex：Tab 条只有一个停留点 | 是 | L3 | ✅ |
| G3 | 全键盘链路：搜索 → 切 Tab → 翻页 → 展开 JSON → 复制 SQL | 走得通 | L3 | ✅ |
| G4 | 全站只有一个 `aria-live` 区 | 是 | L3 | ✅ |
| G5 | 播报相同文案（连续两次"已复制"） | 追加零宽空格，读屏会念 | L3 | ⚠️ 待补 |
| G6 | 焦点环不被 `overflow` 裁切 | 完整可见 | L3 | ✅ |
| G7 | 表格 `aria-rowcount` / `aria-rowindex` / `<caption>` | 截断后仍报真实行数 | L3 | ✅ |
| G8 | `prefers-reduced-motion` | 动效时长归零 | L3 | ✅ |

#### H. 规模与性能

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| H1 | 分析过程中主线程有让出 | 定时器能插进来 ≥1 次 | L2 | ✅ |
| H2 | > 5 万行 → 退化为抽样 | `statsExact=false` | L2 | ⚠️ 待补（需造大表） |
| H3 | > 200MB → 行数走 `MAX(rowid)` 估算 | `rowCountExact=false` | L2 | ⚠️ 待补（造 235MB 库太慢，改为对 `sumRowCount` 纯函数断言 —— 已 ✅） |
| H4 | 5 秒内完成样本库分析 | 实际 ~100ms | L3 | ✅（隐含在 E2E 超时里） |

#### I. 隐私承诺（「文件零上传」）

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| I1 | 全流程跨域请求 | **0 条** | L3 | ✅ |
| I2 | 全流程写请求（POST/PUT/PATCH/DELETE） | **0 条** | L3 | ✅ |
| I3 | 同源请求下限守卫 | ≥5 个（证明监听没失效） | L3 | ✅ |
| I4 | 分析后磁盘文件未被改动 | hash 不变 | L4（手工） | ⚠️ 浏览器无法读原文件路径，只能手工验证 |

#### J. 部署契约（产物布局与安全响应头）

这一域的逻辑很直白：**部署配置是在别的地方（nginx.conf / netlify.toml / _headers）
写的，但它们全部依赖"产物长什么样"这个前提**。前提一旦被改坏，
配置文件本身看不出任何异常，线上却会白屏或发不出新版。所以把前提钉进验收。

| # | 场景 | 期望 | 层 | 覆盖 |
| --- | --- | --- | --- | --- |
| J1 | 响应里带 `Content-Security-Policy` | 存在 | L3 | ✅ |
| J2 | CSP 里含 `'wasm-unsafe-eval'` | 在（删了整站白屏，是承载性指令） | L3 | ✅ |
| J3 | CSP 里含 `connect-src 'self'` | 在（这是守住"零上传"的那一行） | L3 | ✅ |
| J4 | **CSP 真的在拦**：页面主动向外部地址发一次请求 | 触发 `securitypolicyviolation`，指令为 `connect-src` | L3 | ✅ |
| J5 | 拼错指令名（`connect-srcs`）但保留 `default-src 'none'` | 仍被拦下 → 策略 fail-closed | L3 专项 | ✅ `verify:csp` |
| J6 | 拼错指令名且**没有** `default-src` | 静默放行（反面教材，证明兜底确实是 J5 生效的原因） | L3 专项 | ✅ `verify:csp` |
| J7 | `sql-wasm.wasm` 的 Content-Type | `application/wasm` | L3 | ✅ |
| J8 | 产物根目录有 `index.html` | 在 | L3 | ✅ |
| J9 | **`sql-wasm.wasm` 文件名不含 hash** | 无 hash（缓存分层建议的前提） | L3 | ✅ |
| J10 | `sample.sqlite` 在产物根目录 | 在（示例按钮依赖它） | L3 | ✅ |
| J11 | `/assets/` 下文件名都带内容 hash | 是（所以才能 immutable） | L3 | ✅ |
| J12 | `wasm` **不在** `/assets/` 下 | 是（挪进去就得改缓存规则） | L3 | ✅ |
| J13 | `X-Content-Type-Options` / `Referrer-Policy` 存在 | 存在 | L3 | ✅ |
| J14 | `nginx -t` 通过 | 无语法错误 | L4（手工） | ⚠️ 本机不一定有 nginx，需部署者自行跑 |
| J15 | `docker build` 成功且镜像可跑 | 容器起来能打开首页 | L4（手工） | ⚠️ 同上 |
| J16 | 真实平台上的响应头与配置一致 | 与 `_headers` 一致 | L4（手工） | ⚠️ 见部署章节的检查清单 |

### 3. 测试数据矩阵

| 数据 | 来源 | 用途 |
| --- | --- | --- |
| `public/sample.sqlite` | `npm run make-testdata`（生成物，不入库） | 5 表 + 1 视图 + 4 个 JSON 字段，E2E 主数据 |
| 合成库（现造现用） | `run.mjs` 内 `new SQL.Database()` | 精确控制行数/空值分布，不污染仓库 |
| 10 万行宽表 | 待补 | 验证抽样降级路径（H2） |
| 加密 / 截断库 | 待补 | 验证容错文案（A5） |

> **合成库优于固定样本**：断言依赖"800 个空值"这种精确数字时，用一个在脚本里现造的库，
> 比 commit 一个二进制样本文件更可读、更能改、也不会因为样本被换掉而静默失效。

### 4. 「不可见承诺」怎么测

本项目有两类承诺是**用户看不见的**，必须专门设计观测手段，否则永远只能靠"我读代码觉得没问题"：

| 承诺 | 观测手段 |
| --- | --- |
| 文件不上传 | L3 里挂 `page.on('request')`，把所有请求按"同源/跨域"分类，断言跨域为 0、写请求为 0，**并加下限守卫**（否则监听失效时"0 条违规"依然是绿色） |
| 不写回用户文件 | 浏览器拿不到磁盘文件句柄，做不到自动断言 → 退化为 L4 手工：分析前后算一次 `sha256` |
| 统计不造假 | 在文档里逐列标注口径（`statsExact`）+ 断言"空值率 ≤ 100%"这类**物理不变量**。不变量比"等于 80%"更耐改，也不会因为口径调整而失效 |
| CSP 不是"挂了个头" | 光断言"响应头里有这个字符串"没有意义 —— 指令名拼错时字符串照样在。所以让页面**主动违一次规**，用 `securitypolicyviolation` 事件证明规则真的在拦（J4）。再进一步：`verify:csp` 用 A/B/C 三组对照，证明"拼错也不失效"这件事**是因为** `default-src 'none'` 在兜底（J5/J6）|
| 部署配置的**前提**成立 | 缓存分层的建议依赖"wasm 没有 hash、只有 assets 才有"。前提是这里唯一会悄悄变坏的东西，所以直接断言产物布局（J9~J12）|

### 5. 反向验证（证明断言不是空跑）

只看"全绿"不能说明断言有效 —— 也可能它根本没在跑。**改完断言后必须做一次故意破坏**：

```bash
# 1) 备份
cp src/lib/sqlite.ts /tmp/a.ts && cp src/lib/format.ts /tmp/b.ts

# 2) 注入 3 处破坏：CSV 中和失效 / 总行数只累加精确值 / 魔数不校验第 16 字节
#    （手改或脚本改都行，关键是要精确改到被测那一行）

# 3) 跑
npm run build:verify && node .verify/run.mjs | grep -E '^\[FAIL\]|结果：'

# 4) 期望：恰好 4 条 FAIL，且正是那 4 条相关断言
#    第 16 字节不是 NUL → 拒绝 / 总行数包含估算值 / `-1+1` 被中和 / 孤立的 `-` 被中和

# 5) 还原并复跑
cp /tmp/a.ts src/lib/sqlite.ts && cp /tmp/b.ts src/lib/format.ts && npm run verify
```

**判定标准**：破坏后 FAIL 的必须是**你预期的那几条**，其余一条都不能红。
如果破坏了却没红 → 那条断言是空跑的，必须重写。

破坏方式要贴着被测那一行，否则会得到**假阴性**。两次真实踩坑：

- 破坏 CSP 时把注释写在数组元素后面，逗号被吞进注释 → 配置语法错误 →
  vite 起不来 → 报的是"vite preview 20 秒内没有起来"，看着像被测代码坏了，其实是破坏手法写坏了。
- 破坏后脚本在**更早的断言**上崩了（WASM 起不来 → 页面卡在第一步），
  于是根本没走到你想验的那条断言上。这时要看的是"崩溃点是否合理"，别急着改断言。

反向验证**不必每次都手工做**。像 J5/J6 这种"证明某条设计决策成立"的对照，
已经沉淀成可重复执行的脚本（`npm run verify:csp`），比每次手改一遍更可靠。

### 6. 断言写法规范

这个项目的断言踩过坑，留下三条硬规矩：

1. **聚合型断言必须带下限守卫。** "扫到 0 处违规"在"选择器一个都没匹配上"时也是绿的。
   所有扫描型断言都要额外断言"扫到了 ≥N 个候选"，把空跑变成红。
   （例：`断言文字元素 ≥200 处`、`断言抓到恰好 4 种动效时长`、`断言同源请求 ≥5 个`）
2. **不写 flaky 断言。** 曾经有一条"第 2 次查询比第 1 次快"来证明连接复用 ——
   微秒级计时在负载波动下随机失败，而且它证明不了它声称的机制，已删除，
   改为"bytes 身份不匹配时拒绝查询"这种**验证事实而非计时**的断言。
3. **优先断物理不变量，而不是魔法数字。** "空值率 ≤ 100%"比"等于 80%"更能抓住口径错配，
   也不会因为口径调整而失效。

### 7. 手工验证清单（L4）

自动化覆盖不到的部分，上线前手工走一遍：

**功能与隐私**

- [ ] 拖入一个**真实的**自己项目的 `.db` 文件，确认五 Tab 都有内容
- [ ] 分析前后对该文件算 `sha256`，确认**未变更**
- [ ] 用 Excel / WPS 打开导出的 CSV，确认中文不乱码（BOM 生效）、负数仍是数字
- [ ] 导出的 CSV 里塞一个 `=1+1` 的字段值，确认 Excel 显示为文本而不是算出 2
- [ ] 手机（真机）打开一次：窄屏布局、横向 Tab 条、触屏点击目标
- [ ] 断网后打开站点 → 已加载的页面仍可用（无服务端依赖）
- [ ] 浏览器 DevTools Network 面板人工确认无跨域请求

**部署配置本身**（自动化验的是"配置所依赖的前提"，不是配置语法）

- [ ] `nginx -t` 通过，`nginx -s reload` 后站点正常 —— 路径：`deploy/nginx.conf`
- [ ] `docker build -t db-parser .` 成功，容器起得来且首页可打开
- [ ] 线上响应头与 `public/_headers` 一致（最省事的确认方式：DevTools → Network → 首页 → Headers）
- [ ] `sql-wasm.wasm` 的线上缓存头**不是** `immutable`（它没有 hash，见部署章节的排错表）

### 8. CI 接线

`npm run check:all` 就是 CI 的全部内容。完整的 GitHub Actions 配置和注意事项
（`make-testdata` 不能省、只想跑便宜层怎么写）见 [部署 → 自动化（CI）](#自动化ci)，
这里不重复一遍 —— 两份配置很容易写着写着就不一致了。

> 如果一个都不想像：`.github/workflows/deploy-pages.yml` 是仓库自带的部署工作流，
> 它已经内建了"构建前先跑 `make-testdata` + `npm run check`"这一套。

## 已知限制

- **只支持 SQLite 这类单文件数据库**。MySQL / PostgreSQL 是客户端-服务端架构，数据不在一个文件里，浏览器端无法直接读取；需要后续支持导入 `.sql` 导出文件。
- **无法打开加密数据库**（如 SQLCipher），WASM 版 SQLite 不含加密扩展。
- **文件体积上限 512MB**：整份文件要一次性读进内存再建库，峰值内存约为文件的 2~3 倍。超限会在读文件之前就给出提示，而不是把标签页拖死。
- **超大库（>200MB）** 分析会明显变慢，行数退化为估算（界面会标注「约」与「（估）」）。
- **字段画像是精确 / 抽样两档**：行数 ≤ 5 万走全表精确 SQL，超过则只统计预览的 200 行；
  界面上逐列标注口径，比例的分母按口径选取，不会出现「大于 100%」的占比。
- **SQL 结果最多渲染 500 行**（超出会截断，导出 CSV 同样只含这 500 行，界面会明确提示；真实总行数如实报出）。
- **JSON 文件本身还不能直接拖**：目前只认 SQLite；拖 `.json` 会得到明确提示而不是静默失败。

## 部署

这个项目在部署上有三个特点，理解了它们，后面所有路线都会变得很顺：

1. **构建产物就是一堆静态文件** —— 没有服务端、没有数据库、没有 API 路由。
   扔到任何能托管文件的地方都能跑，包括 Nginx、对象存储、甚至 U 盘。
2. **不需要任何环境变量** —— 也就没有"变量配错导致线上 500"这类事故。
3. **`base` 是相对路径 `./`** —— 同一份产物既能挂在 `https://example.com/`，
   也能挂在 `https://example.com/tools/db/`，**不用改任何配置**。

反过来说：这个仓库里所有部署配置都不是必需的。你完全可以
`npm run build` 之后把 `dist/` 手动拷到服务器上，那就是一个完整的上线。

### 先选一条路

| 路线 | 适合谁 | 要做什么 | 成本 | 上手难度 |
| --- | --- | --- | --- | --- |
| **A · 托管平台** | 不想碰服务器、想几分钟上线 | 连仓库，点部署 | 免费额度足够 | ⭐ |
| **B · GitHub Pages** | 已在 GitHub、想长期维护 | Fork + 开一次 Pages | 免费 | ⭐ |
| **C · Docker** | 有自己的 VPS / 群晖 / 内网机 | `docker compose up -d` | 服务器钱 | ⭐⭐ |
| **D · 手动 + Nginx** | 已有站点，想挂个子路径 | `npm run build` + 拷文件 | 服务器钱 | ⭐⭐⭐ |

> 只想**看一眼效果**、还没打算上线？`npm run dev` 就行，不需要部署。

### 通用前置：先在本机构建一次

不管选哪条路，都建议先在本地把构建跑通 —— 这样线上出问题时，
你能立刻分辨是"构建有问题"还是"托管平台配置有问题"。

```bash
npm ci                      # 按 lockfile 精确安装
npm run check:all           # 类型 + 引擎 79 项 + 构建 + 浏览器 84 项断言
npm run preview             # 打开 http://127.0.0.1:4173 看构建产物
```

上面没有"先生成示例库"这一步 —— `build` 的 `prebuild` 钩子会自动把
示例库和 WASM 造出来。真要单独跑：`npm run sync:wasm && npm run make-testdata`。

`npm run build` 完成后，`dist/` 里应该有这些东西：

```
dist/
├── index.html                  # 入口（无 hash → 必须 no-cache）
├── assets/
│   ├── index-<hash>.js         # 主包，带内容 hash
│   ├── index-<hash>.css        # 样式，带内容 hash
│   └── sql-wasm-browser-<hash>.js
├── sql-wasm.wasm               # SQLite 引擎运行时（⚠️ 无 hash，见下方排错表）
├── sample.sqlite               # 示例库（"先看看示例数据"按钮靠它 · 构建时由钩子生成）
├── sample.json                 # 示例 JSON（同样构建时生成）
└── _headers                    # 给 Netlify / Cloudflare Pages 读的响应头
```

**`sql-wasm.wasm` 没有内容 hash** 这一点很关键，是后面缓存配置和排错表里反复提到的坑。

### 路线 A · 托管平台（最省事）

三个平台都支持"连上 Git 仓库 → 自动构建 → 自动上线"，之后每次 push 都会重新部署。

<details>
<summary><b>A1 · Netlify —— 本仓库已带 <code>netlify.toml</code>，真正做到零配置</b></summary>

1. Netlify → **Add new site** → **Import an existing project** → 选你的 fork
2. 什么都不用填 —— 构建命令、发布目录、Node 版本、安全响应头全部自动读取：
   - `netlify.toml` 提供构建命令与发布目录
   - `public/_headers` 提供安全响应头与缓存策略
3. 点 **Deploy**。之后每次 push 到 main 都会自动重新部署。

也可以直接改一行 `netlify.toml` 里的 `command` 来调整构建内容。
</details>

<details>
<summary><b>A2 · Cloudflare Pages</b></summary>

1. Cloudflare Dashboard → **Workers &amp; Pages** → **Create** → **Pages** → 连你的仓库
2. 填三项（Netlify 是自动读，这里要手填）：

   | 字段 | 值 |
   | --- | --- |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | 环境变量 | `NODE_VERSION` = `22` |

   构建命令写 `npm run build` 就够：`prebuild` 钩子会自动生成示例库与 WASM。
   （只有当你显式关掉了 npm 生命周期脚本时，才需要写成
   `npm run make-testdata && npm run build`。）

3. **安全响应头不用额外配** —— Cloudflare Pages 同样会读取产物里的 `/_headers`，
   也就是本仓库已有的 `public/_headers`。
</details>

<details>
<summary><b>A3 · Vercel</b></summary>

1. Vercel → **Add New** → **Project** → Import 你的仓库
2. Framework Preset 选 **Vite**（Output Directory 保持 `dist`）。
   Build Command **保留默认的 `npm run build` 就行**，不用改 —— `prebuild` 钩子会自动生成示例库与 WASM
3. **安全响应头需要自己加** —— Vercel 不读 `_headers`。在仓库根加一个 `vercel.json`：

   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           {
             "key": "Content-Security-Policy",
             "value": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
           },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "no-referrer" },
           { "key": "X-Frame-Options", "value": "DENY" }
         ]
       },
       {
         "source": "/assets/(.*)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
         ]
       }
     ]
   }
   ```

   > 注意 Vercel 的 `vercel.json` **要提交进仓库**，与 `.gitignore` 里排除的
   > `.vercel/` 目录不是一回事。
</details>

### 路线 B · Fork → GitHub Pages（本仓库自带工作流）

仓库里已经有 `.github/workflows/deploy-pages.yml`，fork 之后开一次开关就行：

1. **Fork** 这个仓库（或把它 push 到你自己的仓库）
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
3. push 到 `main`（或在 Actions 页面点 **Run workflow**）

之后访问 `https://<你的用户名>.github.io/<仓库名>/` 即可 ——
本仓库自身的线上地址是 `https://lmz199521.github.io/db-parser/`。

> **两个常被踩的坑**
>
> 1. **Source 必须选 "GitHub Actions"**，不要选 "Deploy from a branch"。
>    这个项目用 `upload-pages-artifact` + `deploy-pages` 发布，
>    选错模式会出现"Actions 绿了但站点 404"。
> 2. **不要选 `/docs` 目录做发布源**。本仓库的 `docs/` 是 UI 设计文档，不是站点；
>    站点产物是 `dist/`，由工作流上传。
>
> 为什么挂在子路径（`/仓库名/`）也能正常加载资源？因为 `vite.config.ts` 里
> `base: './'`，构建产物里没有任何写死的绝对路径。

### 路线 C · Docker（VPS / 群晖 / 内网服务器）

```bash
docker compose up -d          # 构建并后台启动，访问 http://<主机>:8080
docker compose logs -f        # 看日志
docker compose down           # 停掉并删除容器
```

或者不用 compose：

```bash
docker build -t db-parser .
docker run -d --name db-parser -p 8080:80 --restart unless-stopped db-parser
```

镜像用的是「Node 构建 + Nginx 托管」两阶段，最终镜像里**没有 Node**，只有 Nginx 和静态文件。

> **这个容器是刻意无状态的**：没有卷、没有环境变量、没有依赖服务。
> 解析全部发生在用户浏览器里，服务端只负责发文件 ——
> 删掉容器不丢任何东西，也不需要备份。
> 反过来说：任何"给这个服务加个卷存点数据"的需求，都说明架构走偏了。
>
> 想换端口：改 `docker-compose.yml` 里的 `"8080:80"`；
> 想上 HTTPS：把容器放在 Caddy / Nginx Proxy Manager / Traefik 后面反向代理即可，
> 容器本身只管 80 端口的 HTTP。

### 路线 D · 手动构建 + Nginx

```bash
npm run build
# 把 dist/ 整个拷到服务器
rsync -av --delete dist/ user@server:/var/www/db-parser/
```

站点配置用仓库里的 **`deploy/nginx.conf`**（一个 `server {}` 块，可直接放进 `conf.d/`）：

```bash
sudo cp deploy/nginx.conf            /etc/nginx/conf.d/db-parser.conf
sudo cp deploy/security-headers.inc  /etc/nginx/conf.d/
# 改一下 nginx.conf 里的 root 指向你的 dist 路径
sudo nginx -t && sudo nginx -s reload
```

那份配置里有两条注释写得比较长，都是真的踩过的坑：

**坑 1：缓存不能一刀切。** 凭直觉写一条 `location ~* \.(js|css|wasm)$ { expires 1y; }`
看起来没问题，但 `sql-wasm.wasm` 在 `public/` 下、**文件名没有 hash**，
被缓存成 immutable 之后，升级 sql.js 会出现"本机没问题、线上白屏"，而且清缓存才恢复正常 ——
极难排查。配置里按"有没有 hash"分了三层。

**坑 2：Nginx 的 `add_header` 不继承。** 只要某个 `location` 里写了自己那条
`add_header`，`server` 级的那些就会**全部失效**。所以安全头单独抽成
`deploy/security-headers.inc`，由每个需要它的 `location` 用 `include` 引入。

> 想更省心的话，**Caddy** 只要四行（还自动签发 HTTPS 证书）：
>
> ```caddyfile
> db.example.com {
>     root * /var/www/db-parser
>     file_server
>     try_files {path} /index.html
>     encode gzip
>     import /etc/caddy/security-headers.caddy   # 内容与 deploy/security-headers.inc 一致
> }
> ```

### 子路径部署（例如 `https://example.com/tools/db/`）

**前端侧不需要改任何东西** —— `base: './'` 已经处理好了。
你要做的只有两件事：

1. **服务器把该路径映射到 `dist/`**。Nginx 用 `alias`：

   ```nginx
   location /tools/db/ {
       alias /var/www/db-parser/;
       try_files $uri $uri/ /tools/db/index.html;
   }
   ```

2. **（可选）改 `index.html` 里的 canonical / og:url** —— 本仓库已填成 GitHub Pages
   的地址，只有在你用自有域名时才需要动。理由见下一节。

### 让站点变成你自己的（可选）

不改也能跑，但上线到公开域名后建议改掉，否则分享到社交平台时标题和缩略图会是别人的：

| 改什么 | 在哪 |
| --- | --- |
| 页面标题、Meta 描述 | `index.html` 的 `<title>` 与 `<meta name="description">` |
| 社交平台分享标题 / 描述 | `index.html` 的 `og:title` / `og:description` |
| canonical / og:url 绝对地址 | `index.html` — 本仓库已填成 GitHub Pages 的默认地址 `https://lmz199521.github.io/db-parser/`；**换域名时这两处要一起改** |
| 社交预览图 | 目前**没有** `og:image`，所以 `twitter:card` 写的是 `summary`（不是 `summary_large_image`，缺图会被平台静默降级）。补一张 1200×630 的图并加上 `og:image` 之后，可以再改回 `summary_large_image` |
| 品牌名 | `TopBar.tsx` 里的 `brand-name`、以及 `Sidebar` / 页脚中的同名文案 |
| 主色与主题色 | `styles.css` 顶部的 Token 层（`--accent` 等），改一处全站生效 |

> `canonical` 指错的代价比不写更大（等于告诉搜索引擎"正式版本在别的地址"），
> 所以它必须是生效的真实地址，不能留占位符。
>
> 另外 `canonical` 不能用 `./` 这种相对写法 —— Vite 会把目录当静态资源去读，
> 构建直接报 `EISDIR`。

### 安全响应头：三个地方要保持一致

这个项目的核心承诺是「文件不上传」。**CSP 是让这条承诺在浏览器层面强制生效的手段** ——
即使页面被注入脚本，也没有网络出口把数据发出去。

策略文本目前存在于三处，改一处就要改其余两处（`grep "default-src 'none'"` 能找全）：

| 位置 | 谁在用 | 有没有自动验收 |
| --- | --- | --- |
| `vite.config.ts` 的 `SECURITY_HEADERS` | `vite preview` / 本地验证 | ✅ 由 `npm run verify:browser` 第 13 组覆盖 |
| `public/_headers` | Netlify、Cloudflare Pages | ⚠️ 需在平台侧人工确认 |
| `deploy/security-headers.inc` | Nginx（含 Docker 镜像） | ⚠️ 需 `nginx -t` 后人工确认 |

**两条承载性指令，改之前务必知道后果：**

- `script-src` 里的 `'wasm-unsafe-eval'` —— sql.js 靠它实例化 WASM。**删掉整站白屏**，
  这不是"更安全"，是打不开。
- `connect-src 'self'` 配合 `default-src 'none'` —— 这才是真正守住"零上传"的部分。
  `default-src` 取 `'none'` 而不是 `'self'`，是为了让策略 **fail-closed**：
  万一将来有人把某个取数据的指令名拼错（比如写成 `connect-srcs`），
  浏览器会回落到"全部禁止"而不是静默放行。

这最后一条不是推测，是实测的。`npm run verify:csp` 用三组对照证明了它：

```
A 完整策略                      ：拦下（connect-src → https://example.com/exfil-probe）
B 拼错 but 有 default-src 'none'：拦下  ← 回落兜底，策略是 fail-closed 的
C 拼错 且 没有 default-src      ：放行  ← 反面教材：这样写就静默失效了
```

### 部署后检查清单

**必须全过**（前 5 项是"站点根本打不开"级别的问题）：

| # | 检查项 | 怎么验证 |
| --- | --- | --- |
| 1 | 首页能打开，不是白屏 | 打开站点根地址 |
| 2 | 控制台没有 error | DevTools → Console |
| 3 | 拖入一个真实 `.db` 文件，五个 Tab 都有内容 | 也就是 WASM 真的跑起来了 |
| 4 | Network 面板里**没有跨域请求** | 「零上传」承诺的现场核对 |
| 5 | 响应头里有 `Content-Security-Policy` | DevTools → Network → 点首页 → Headers |
| 6 | 点「先看看示例数据」有反应 | 验证 `sample.sqlite` 确实进了产物 |
| 7 | 切暗色主题后刷新，仍然是暗色 | 验证 localStorage 与防闪白脚本 |
| 8 | HTTPS 生效（地址栏是锁） | 托管平台一般自动配；自建服务器需自行申请证书 |

**建议也过一遍**：

| # | 检查项 | 怎么验证 |
| --- | --- | --- |
| 9 | `sql-wasm.wasm` 的响应头是 `application/wasm` | Network → 点该请求 → Headers |
| 10 | `index.html` 的 `Cache-Control` 含 `no-cache` | 同上 |
| 11 | `/assets/*.js` 的 `Cache-Control` 含 `immutable` | 同上 |
| 12 | 手机（真机）打开一次 | 窄屏布局、横向 Tab 条、触屏点击目标 |
| 13 | 断网后已加载的页面仍可用 | 无服务端依赖，刷新才需要网络 |

### 出问题了看这里

| 症状 | 最可能的原因 | 怎么确认 | 怎么修 |
| --- | --- | --- | --- |
| **白屏**，控制台报 WASM / MIME 相关 | `.wasm` 的 `Content-Type` 不是 `application/wasm` | Network 里点 `sql-wasm.wasm` 看响应头 | Nginx 用 `deploy/nginx.conf`（它显式钉了 MIME）；托管平台一般天然正确 |
| **白屏**，控制台报 CSP 拦截 | 少了 `'wasm-unsafe-eval'` | Console 里的 CSP 报错会直接点出违规指令 | 把三条指令补齐（见上一节） |
| 控制台报 `Unexpected token '<'` | 某个 `.js` 404，服务器回落成了 `index.html`，浏览器拿 HTML 当 JS 执行 | Network 里看那个 js 请求是不是 200 但内容类型是 HTML | 检查 `location /assets/` 不要做 `try_files` 回落；Nginx 默认 404 就对 |
| 页面是旧版，强刷才好 | `index.html` 被缓存了 | 看响应头 `Cache-Control` | `index.html` 必须 `no-cache`；带 hash 的 `/assets/*` 才能 immutable |
| **升级 sql.js 后线上白屏，本机正常** | `sql-wasm.wasm` 被 immutable 缓存住了 | 看该文件响应头是不是 `immutable` | 它没有 hash，绝不能 immutable；改成 `no-cache` |
| 静态资源 404（CSS/JS 加载不到） | 子路径部署但资源按根路径找 | Network 里看请求的 URL 前缀 | 确认 `vite.config.ts` 仍是 `base: './'`；服务器用 `alias` 映射到 `dist/` |
| 点「看看示例数据」没反应 | `sample.sqlite` 没进产物 | 直接访问站点 `/sample.sqlite` | 构建前先跑 `npm run make-testdata`（.dockerignore 里也别排除 `public/`） |
| GitHub Pages 上 404，但 Actions 是绿的 | Pages 的 Source 没选 "GitHub Actions" | Settings → Pages | 改成 GitHub Actions 重新跑一次 |
| `npm run build` 报 `EISDIR` | `index.html` 里的 canonical 写成了 `./` | 看报错指向哪一行 | canonical 必须写完整的绝对地址 |
| Docker 构建很慢 | 每层都在重新 `npm ci` | 看构建日志哪一层最慢 | 确认 `COPY package*.json` 在 `COPY . .` **之前**（本仓库的 Dockerfile 已经这样） |

### 回滚

静态站点没有"半上线"状态 —— 要么是新版，要么是旧版，不会出现数据库迁移那种
"回滚不回去"的情况。三种回滚方式，按你的部署路线选：

```bash
# 托管平台（Netlify / Cloudflare / Vercel）
# → 在平台的 Deployments 历史里找到上一个正常版本，点 "Rollback" / "Promote"

# GitHub Pages
git revert <坏掉的提交> && git push     # 工作流会自动重新部署回滚后的版本

# 手动 / Docker
rsync -av --delete <上一版的 dist/>  user@server:/var/www/db-parser/
docker compose up -d --build            # 或 git checkout <上一个 tag> 后重建
```

> 之所以能这么干脆地回滚：**这个站点没有任何持久化状态**。
> 用户数据从来只在用户自己的浏览器里，服务端没有数据库、没有对象存储、
> 没有任何需要"回滚"的东西。

### 自动化（CI）

`npm run check:all` 就是 CI 的全部内容。把它接到 push 上，改坏了当场就知道：

```yaml
name: check
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm i -D playwright-core && npx playwright install --with-deps chromium
      - run: npm run check:all
```

> **不需要单独写 `make-testdata`。** `check:all` 链里的 `build` 会自动先跑
> `prebuild`（生成示例库 + WASM），`verify` 会自动先跑 `preverify`。
> 反过来说：如果你的环境关掉了 npm 生命周期脚本（`npm ci --ignore-scripts`），
> 就必须在这里显式补一行 `npm run make-testdata` —— 否则浏览器验收会以
> "示例按钮点不动"这种形式失败，比"文件不存在"难查得多。
>
> 只想跑便宜的引擎层断言（不需要 Chromium）就把最后两行换成
> `npm run check` —— 类型 + 引擎 79 项 + 构建，几秒钟。

## 隐私与安全

- 数据库文件**只在浏览器内存中解析**，不发往任何服务器
- 这条承诺不是口头的，是**可验证**的：
  - 浏览器验收脚本监听全部请求，断言"跨域 0 条、写请求 0 条"，并带下限守卫防止监听失效
  - 部署时下发的 CSP 里 `connect-src 'self'` + `default-src 'none'`，
    从浏览器层面堵死外发通道 —— 即使页面被注入脚本也传不出数据
- 仓库的 `.gitignore` 排除了 `*.db` `*.sqlite` `*.sql` `.env`，**以及三个生成物**
  （`public/sample.sqlite` / `sample.json` / `sql-wasm.wasm`）—— 它们能由脚本确定性重建，
  进仓库只会多一份会静默过期的事实（见 [为什么仓库里没有示例库](#为什么仓库里没有示例库)）
- 仓库里**不含任何真实数据**：示例库是脚本按固定种子造出来的假数据，
  用户名、手机号、地址、UA 全是编的
- 部署到静态托管时不需要任何环境变量与服务端配置 ——
  没有密钥可泄露，也就没有"环境变量配错"这类事故
- Docker 镜像基于 `nginx:alpine`，最终镜像里没有 Node、没有包管理器、没有后端代码

## License

MIT
