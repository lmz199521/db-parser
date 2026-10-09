# 数据库放大镜 · UI 设计规范 v2

> 版本 v2.0 ｜ 落地范围：`src/styles.css`（主战场）、`src/App.tsx`、`src/components/*`
> **硬约束（全程遵守）**：React 18 + TS + Vite；手写 CSS + CSS 变量；**不引入任何新运行时依赖**；亮/暗双主题；WCAG AA；键盘全可达；尊重 `prefers-reduced-motion`；class 命名沿用语义化短横线（`.kpi-grid` / `.table-card` / `.jt-node`）；**不动 `height:100dvh` 的 app 骨架**（顶栏 + 工作区 + 页脚）。
> **所有对比度数字都是按 WCAG 2.1 相对亮度公式跑脚本实测出来的**，不是估的。标注含义：`AA` = 正文达标（≥4.5:1）；`AA-Large` = 仅大字达标（≥3:1）；`非文本` = 只可用于图标/边框/分隔（<3:1 不得承载文字）。

---

## 0. 阅读索引

| 你要做的事 | 直接跳 |
| --- | --- |
| 改 Token / 换肤 / 修颜色对比度 | §2 + 附录 A（整块可粘贴的 CSS） |
| 改某个具体组件的样式与状态 | §6 |
| 调排版、间距、圆角、阴影 | §3 + §4 |
| 调断点与响应式行为 | §5 |
| 修可用性 / 无障碍缺陷 | §7 + §9 + §10 |
| 排期开工 | §10 |

---

## 1. 设计定位

### 1.1 三个关键词

| 关键词 | 它约束什么 | 落到具体做法 |
| --- | --- | --- |
| **仪表感（Instrument）** | 这是测量设备的读数面板，不是产品营销页 | 所有数字 `font-variant-numeric: tabular-nums`（等宽数位，翻页时不抖）；单位降一级字号 + 降一级灰度；KPI 卡片只有「1 个图标 + 1 个数字 + 1 句来源说明」，不做插图与装饰块 |
| **可验证（Verifiable）** | 每个结论都能追到来源 | 行数必须标「精确 / 估算」；字段画像必须标「基于抽样 N 行」；类型必须同时给「声明类型原文」和「归一化类型族」；不确定性不隐藏 |
| **克制（Restrained）** | 颜色只用来编码信息，不用来装饰 | 全站只允许 3 处渐变（统一用 `--brand-gradient`）：`.brand-mark`、`.dropzone-mark`、进度条填充。其余一律纯色 |

### 1.2 一句话定位

> **一台已经校准好、开机就能读数的「数据库示波器」** —— 用户把文件拖进来之后的 3 秒内，界面必须已经替他把「库里有什么、数据长什么样、哪里不对劲」讲清楚；界面自己不说话，数据说话。

### 1.3 反向约束（明确不要做什么）

> **KPI 卡片里禁止出现任何「趋势 / 环比」元素** —— `↑12%`、`较上周 +3`、`环比改善` 一类，全部不许出现。
> 理由：这个站没有时间序列基线，任何对比箭头都是编出来的。在「信任感」为第一目标的产品里，一次假数据就会抵消掉「文件零上传」这个最重要的承诺。
>
> 连带禁止：伪造的确定性进度百分比（进度占比必须来自真实阶段）、无来源的「性能评分 / 健康分」、装饰性的脉冲 / 呼吸 / 光晕动画。

---

## 2. 色彩 Token 表

### 2.1 亮色 · 画布 / 表面 / 文字 / 边框

表面之间的分离度（`x:1`）只用来判断「层次够不够」，不作为文字对比度依据；实际分层靠 1px 边框 + 4px 数值差，不靠阴影。

| Token | 值 | 用途 | 实测对比度 |
| --- | --- | --- | --- |
| `--canvas` | `#f4f6f9` | app 底板、主区背景、吸顶标题区背景 | ÷ surface 1.08:1 |
| `--surface` | `#ffffff` | 卡片、KPI、输入框、按钮底 | 内容层基准 |
| `--surface-2` | `#f9fafc` | 卡片头、表头、底部工具条 | ÷ surface 1.04:1 |
| `--surface-3` | `#eef1f6` | 徽标底、分段控件槽、次级按钮 hover | ÷ surface 1.13:1 |
| `--surface-inset` | `#f7f8fb` | 代码块、SQL 编辑器、JSON 树底（原 `--code-bg`） | ÷ surface 1.06:1 |
| `--text-1` | `#0f1522` | 标题、正文、表格数据 | **18.25:1 AA**（÷surface）；÷surface-3 **16.12:1 AA** |
| `--text-2` | `#4a5464` | 次要说明、表头、未选中 Tab | **7.65:1 AA**；÷surface-3 **6.76:1 AA** |
| `--text-3` | `#656e7d` | 辅助文字：卡片注释、KPI 脚注、NULL、空态正文 | **5.15:1 AA**；÷surface-2 **4.93:1 AA**；÷surface-3 **4.55:1 AA**；÷canvas **4.75:1 AA** |
| `--text-4` | `#9aa2b1` | 纯装饰：分隔符、禁用文字、占位图形、图标线 | **2.57:1 — 仅非文本**，禁止承载任何文字 |
| `--text-inv` | `#ffffff` | 深色底上的文字（侧栏、主按钮） | ÷ accent 5.37:1 AA |
| `--line-1` | `#e6e9ef` | 卡片边框、表格行分隔、卡片头下边线 | ÷surface 1.22:1 |
| `--line-2` | `#d3d8e2` | 输入框边框、次级按钮边框、控件描边 | ÷surface 1.43:1 |
| `--line-3` | `#b3bbc9` | hover 边框、虚线拖拽框、滚动条抓手 | ÷surface 1.93:1 |

> **这是本次规范里最重要的一处改动**：`--text-3` 从 `#818b9c` 改为 `#656e7d`。
> 现状 `#818b9c` ÷surface 只有 **3.44:1**、÷surface-3 只有 **3.09:1**，而它被 `.card-note` / `.kpi-foot` / `.kpi-unit` / `.main-sub` / `.cell-null` / `.empty p` / `.meta-k` 大量用于 **11.5px–12.5px 正文级文字** → 系统性违反 AA。原 `#818b9c` 降级为 `--text-4`，只允许出现在图标与分隔符上。

### 2.2 暗色 · 画布 / 表面 / 文字 / 边框

| Token | 值 | 用途 | 实测对比度 |
| --- | --- | --- | --- |
| `--canvas` | `#0c0f18` | app 底板、主区背景 | ÷surface 1.09:1 |
| `--surface` | `#141926` | 卡片、KPI | 内容层基准 |
| `--surface-2` | `#1a2032` | 卡片头、表头、工具条 | ÷surface 1.08:1 |
| `--surface-3` | `#212840` | 徽标底、分段控件槽 | ÷surface 1.21:1 |
| `--surface-inset` | `#0f1420` | 代码块、SQL 编辑器、JSON 树底 | ÷surface 1.05:1 |
| `--text-1` | `#eef1f7` | 标题、正文、数据 | **15.51:1 AA**；÷surface-3 **12.87:1 AA** |
| `--text-2` | `#a3adc0` | 次要说明、表头 | **7.77:1 AA**；÷surface-2 7.17:1 AA；÷surface-3 **6.45:1 AA** |
| `--text-3` | `#8e97aa` | 辅助文字 | **5.98:1 AA**；÷surface-2 **5.52:1 AA**；÷surface-3 **4.96:1 AA**；÷canvas **6.52:1 AA** |
| `--text-4` | `#69738a` | 纯装饰、禁用文字 | **3.69:1 — 仅非文本** |
| `--text-inv` | `#0c0f18` | 亮底上的文字（主按钮） | ÷accent 6.42:1 AA |
| `--line-1` | `#232b3e` | 卡片边框、行分隔 | ÷surface 1.24:1 |
| `--line-2` | `#303a52` | 输入框边框、控件描边 | ÷surface 1.55:1 |
| `--line-3` | `#3d4864` | hover 边框、拖拽虚线 | ÷surface 1.93:1 |

> 暗色下 `--text-3` 从 `#6f7a90` 改为 `#8e97aa`：现状在 surface 上只有 **4.06:1**、canvas 上 **4.43:1**，都不达 AA。

### 2.3 品牌主色

| Token | 亮色 | 暗色 | 用途 | 亮色实测 | 暗色实测 |
| --- | --- | --- | --- | --- | --- |
| `--accent` | `#5b5bd6` | `#8b8bf0` | 主按钮底、Tab 激活下划线、选中态、图标线 | 图标线 ÷surface **5.37:1 AA** | ÷surface **5.89:1 AA** |
| `--accent-hover` | `#4b4bc4` | `#9c9cf5` | 主按钮 hover / active | 白字在上 **6.77:1 AA** | 暗字在上 **7.74:1 AA** |
| `--accent-soft` | `#ededfc` | `#221f45` | 选中行底、JSON 单元格选中底、输入框 focus 环底 | 内容文字 ÷此底 **15.75:1 AA** | ÷此底 **13.75:1 AA** |
| `--accent-line` | `#c9c9f5` | `#3b3673` | 选中态边框、可点击徽标 hover 边框 | 非文本 | 非文本 |
| `--accent-text` | `#3f3fb0` | `#b6b6ff` | 链接、Tab 激活文字、按钮里的强调文字 | ÷surface **8.24:1 AA**；÷accent-soft **7.11:1 AA** | ÷surface **9.30:1 AA**；÷accent-soft **8.24:1 AA** |
| `--focus` | `#5b5bd6` | `#a5a5ff` | `:focus-visible` 描边（2px + offset 2px） | ÷surface 5.37:1（≥3:1 达标） | ÷surface **7.88:1** |
| `--focus-on-dark` | `#a5a5ff` | `#a5a5ff` | 深色顶栏 / 侧栏内的焦点环专用 | ÷`#111524` **8.15:1** | ÷`#080a11` **8.88:1** |
| `--brand-gradient` | `linear-gradient(140deg,#6366f1 0%,#4f46e5 45%,#06b6d4 100%)` | 同亮色 | **仅** `.brand-mark` / `.dropzone-mark` / 进度条 | — | — |

> **焦点环必须拆成两个 Token**。现状 `:focus-visible { outline: 2px solid var(--accent) }` 在顶栏深色底上实测 **3.38:1**（`#5b5bd6` ÷ `#111524`），刚好卡在 3:1 边缘；顶栏又是键盘用户最先 Tab 到的地方（主题切换、换个文件），必须换成 `--focus-on-dark`。

### 2.4 侧栏专用（两套主题下都保持深色面板 = 视觉锚点）

| Token | 亮色 | 暗色 | 用途 | 亮色实测 | 暗色实测 |
| --- | --- | --- | --- | --- | --- |
| `--nav-bg` | `#111524` | `#080a11` | 侧栏 / 顶栏底 | ÷surface **18.16:1**（锚点立得住） | ÷surface 1.13:1 |
| `--nav-bg-2` | `#1a2133` | `#12161f` | 侧栏行 hover 底、搜索框底 | 面板层次 | — |
| `--nav-active` | `#2b3550` | `#232c45` | 侧栏选中行底 | ÷nav-bg 1.49:1 | ÷nav-bg 1.43:1 |
| `--nav-line` | `#242b3e` | `#1e2637` | 侧栏内分隔线、顶栏底边线 | 非文本 | 非文本 |
| `--nav-text` | `#9aa5ba` | `#8b95a9` | 侧栏次级文字、图标、行名（未选中） | ÷nav-bg **7.32:1 AA** | ÷nav-bg **6.56:1 AA** |
| `--nav-text-strong` | `#f0f3f8` | `#f4f6fa` | 侧栏主文字、顶栏统计数、顶栏品牌名 | ÷nav-bg **16.32:1 AA**；÷nav-active **11.95:1 AA** | ÷nav-bg **18.28:1 AA** |
| `--nav-count` | `#8b95a9` | `#9aa9c0` | 侧栏行数（未选中行） | ÷nav-bg **6.03:1 AA** | ÷nav-bg **8.30:1 AA** |
| `--nav-count-active` | `#b8c2d6` | `#9aa9c0` | 侧栏行数（选中行，必须比 `--nav-count` 亮） | ÷nav-active **6.79:1 AA** | ÷nav-active **5.81:1 AA** |
| `--nav-label` | `#7e8aa3` | `#7a8499` | 分组标题「表 / 视图」 | ÷nav-bg **5.23:1 AA** | ÷nav-bg **5.26:1 AA** |
| `--nav-input-border` | `#39425c` | `#283247` | 侧栏搜索框 hover 边框 | 非文本 | 非文本 |

> **两处必修**：
> ① 现状行数 `#7b859c` 在**选中行底** `#262f47` 上只有 **3.59:1**（未选中时 4.91:1 是够的）→ 选中行必须切到 `--nav-count-active`。
> ② 现状分组标题 `#66708a` ÷nav-bg 仅 **3.67:1**、分组计数 `#5b6580` 仅 **3.13:1**，都是 10.5px 小字 → 必须换成 `--nav-label`。侧栏空态文字 `.sidebar-empty` 现用 `#66708a`，同步改用 `--nav-label`。

### 2.5 侧栏标签（`.tag`）

| 场景 | 亮/暗色底 | 亮/暗色文字 | 实测对比度 |
| --- | --- | --- | --- |
| 默认（字段数） | `#222a40` / `#1e2637` | `#9fabc0` / `#9aa9c0` | **6.15:1 AA** |
| JSON | `#2a2246` / `#2a2246` | `#c3abf7` / `#c3abf7` | **7.41:1 AA** |
| 外键 | `#1d2f43` / `#1d2f43` | `#85b8e8` / `#85b8e8` | **6.51:1 AA** |
| 视图 | `#23303f` / `#23303f` | `#8fc4d8` / `#8fc4d8` | **7.06:1 AA** |
| 字段命中 | `#332c17` / `#332c17` | `#e3c67f` / `#e3c67f` | **8.36:1 AA** |
| **选中行内的标签** | `#35406a` / `#2c3654` | `--text-inv` 同族 | 底与行底分离 1.21:1（可辨，且不依赖颜色单独传意） |

> 现状：`.tag` 底 `#212940` 压在选中行底 `#262f47` 上，分离度只有 **1.09:1** —— 标签在选中行里视觉上糊掉了。选中行内标签必须换底（见上表末行）。

### 2.6 语义色四套

| 语义 | Token | 亮色 | 暗色 | 亮色实测（文字 ÷ 底色） | 暗色实测 |
| --- | --- | --- | --- | --- | --- |
| **成功** | `--ok` / `--ok-soft` / `--ok-line` | `#0b7a5a` / `#e6f6f0` / `#bfe6d8` | `#4ed4a4` / `#10291f` / `#1d4a37` | ÷surface **5.32:1**；÷soft **4.77:1** AA | ÷surface **9.42:1**；÷soft **8.30:1** AA |
| **警告** | `--warn` / `--warn-soft` / `--warn-line` | `#8a4b00` / `#fdf3e4` / `#f0dab2` | `#e8b168` / `#2a2110` / `#4b3a18` | ÷surface **6.80:1**；÷soft **6.19:1** AA | ÷surface **9.12:1**；÷soft **8.25:1** AA |
| **危险** | `--danger` / `--danger-soft` / `--danger-line` | `#b3261e` / `#fdedec` / `#f3cbc8` | `#f08d86` / `#2c1614` / `#522723` | ÷surface **6.54:1**；÷soft **5.76:1** AA | ÷surface **7.40:1**；÷soft **7.19:1** AA |
| **信息** | `--info` / `--info-soft` / `--info-line` | `#175cd3` / `#eaf1fd` / `#c9ddf7` | `#7cb3f5` / `#121f33` / `#1f3a5c` | ÷surface **5.99:1**；÷soft **5.27:1** AA | ÷surface **8.04:1**；÷soft **7.58:1** AA |
| 辅助（JSON 专用） | `--violet` / `--violet-soft` / `--violet-line` | `#6d28d9` / `#f3edfe` / `#ddd0fb` | `#b79bf7` / `#221a38` / `#3e2f63` | ÷surface **7.10:1**；÷soft **6.21:1** AA | ÷surface **7.56:1**；÷soft **7.11:1** AA |

> `--warn` 由 `#a15c07` → `#8a4b00`：现状在 `--warn-soft` 上只有 **4.75:1**，虽压线达标但没有任何余量（用户把字号放大到 200% 就不再是「大字豁免」场景）；换掉后是 6.19:1，同时把「警告」和「危险」的色相隔开（橙棕 vs 红）。

### 2.7 字段类型配色族（7 族 × bg / fg / line）

颜色**永远不是唯一信号** —— 每处 `type-chip` 必须带文字标签（`整数/小数/文本/JSON/时间/二进制/布尔/未知`）或完整类型名。

| 族 | class | 亮 bg | 亮 fg | 亮 line | 实测 | 暗 bg | 暗 fg | 暗 line | 实测 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 整数 | `.t-integer` | `#e9f1fd` | `#175cd3` | `#c9ddf7` | **5.26:1 AA** | `#12213a` | `#90c2fb` | `#23395c` | **8.66:1 AA** |
| 小数 | `.t-real` | `#e6f5fa` | `#0a6b8a` | `#bcdff0` | **5.40:1 AA** | `#0f2530` | `#6fd0ec` | `#1d4457` | **8.97:1 AA** |
| 文本 | `.t-text` | `#e6f6f0` | `#0b7a5a` | `#bfe6d8` | **4.77:1 AA** | `#10291f` | `#5fd9ad` | `#1e4a38` | **8.84:1 AA** |
| JSON | `.t-json` | `#f3edfe` | `#6d28d9` | `#ddd0fb` | **6.21:1 AA** | `#221a38` | `#c4a8ff` | `#3e2f63` | **8.16:1 AA** |
| 时间 | `.t-datetime` | `#fdf3e4` | `#8a4b00` | `#f0dab2` | **6.19:1 AA** | `#2a2110` | `#eec27f` | `#4b3a18` | **9.56:1 AA** |
| 二进制 | `.t-blob` | `#eef1f6` | `#4a5464` | `#d3d8e2` | **6.76:1 AA** | `#1c2233` | `#a3adc0` | `#313a52` | **7.01:1 AA** |
| **布尔** | `.t-boolean` | `#eaf7f4` | `#0f766e` | `#c3e6e0` | **4.98:1 AA** | `#0e2a2a` | `#6fd8cd` | `#1b4a48` | **8.95:1 AA** |
| 未知 | `.t-unknown` | `#eef1f6` | `#4a5464` | `#d3d8e2` | **6.76:1 AA** | `#1c2233` | `#a3adc0` | `#313a52` | **7.01:1 AA** |

> **布尔必须独立成族**：现状 `.type-chip.t-boolean` 直接复用整数配色，而「字段结构」表里布尔和整数是并排的两列类型族，同色不同义直接削弱了「一眼扫出类型分布」的能力。新增 `--t-bool-*` 四个 Token（青绿），与整数（蓝）明显区分。

### 2.8 代码区与 JSON 树

| Token / 类 | 亮色 | 暗色 | 实测对比度 |
| --- | --- | --- | --- |
| `--code-bg` | `#f7f8fb` | `#0f1420` | ÷surface 1.06:1 / 1.05:1 |
| `--code-line` | `#e6e9ef` | `#232b3e` | 非文本 |
| `.code-block` 正文 | `--text-1` | `--text-1` | **17.19:1 AA** / **16.26:1 AA** |
| `.jt-key` 键名 | `--violet` `#6d28d9` | `--violet` `#b79bf7` | **6.69:1 AA** / **7.93:1 AA** |
| `.jt-string` 字符串 | `--ok` `#0b7a5a` | `--ok` `#4ed4a4` | **5.01:1 AA** / **9.88:1 AA** |
| `.jt-number` 数字 | `--info` `#175cd3` | `--info` `#7cb3f5` | **5.64:1 AA** / **8.43:1 AA** |
| `.jt-boolean` 布尔 | `--warn` `#8a4b00` | `--warn` `#e8b168` | **6.41:1 AA** / **9.57:1 AA** |
| `.jt-null` 空值 | `--text-3` | `--text-3` | **4.85:1 AA** / **6.27:1 AA** |
| `--hit-bg` **搜索命中底** | `#fdf0b8` | `#4a3c12` | 底色本身**不能是唯一信号**，见 §6.8 |
| `--hit-line` 命中左边线 | `--warn` `#8a4b00` | `--warn` `#e8b168` | ÷命中底 ≥4.5:1 |

> **现状缺陷**：命中高亮底 `#fff3c4` ÷ `--code-bg` `#f8f9fb` 只有 **1.06:1**（暗色 `#4a3c12` ÷ `#10141f` 是 **1.70:1**）—— 高亮块在背景里几乎看不见，「搜索命中自动展开」这个功能等于没有视觉反馈。修法见 §6.8。

---

## 3. 字体与排版

字体栈保持现状（`--font`：Inter + 系统中文字体栈；`--mono`：JetBrains Mono + 系统等宽栈）。零依赖、中文回退正确、等宽在 Windows/macOS 都有落地，不换。

字重可用集：`400 / 500 / 600 / 650`（650 只给 KPI 数值）。**禁止 700 与 300 以下**：700 在这个密度下会糊，300 在 11.5px 上发虚。

| 层级 | Token | px | 行高 | 字重 | 字距 | 用途 |
| --- | --- | --- | --- | --- | --- | --- |
| 落地页主标题 | `--fs-display` | 22 | 30px (1.36) | 600 | -0.3px | `.dropzone h1` |
| 页面标题 | `--fs-h1` | 19 | 26px (1.37) | 600 | -0.2px | `.main-title` |
| 卡片标题 | `--fs-h2` | 13.5 | 20px (1.48) | 600 | -0.1px | `.card-head h2`、`.empty b` |
| 数据大字 | `--fs-metric` | 23 | 27px (1.17) | 650 | -0.6px | `.kpi-value` |
| 正文 | `--fs-body` | 14 | 22px (1.55) | 400 | 0 | `body`、说明段落 |
| 正文小 | `--fs-body-sm` | 13 | 20px (1.53) | 400–500 | 0 | 按钮、输入框、Tab、alert、`.meta-v` |
| 数据 | `--fs-data` | 12.5 | 19px (1.5) | 400 | 0 | 表格单元格、JSON 树、`.jt-path` |
| 数据紧凑 | `--fs-data-sm` | 12 | 18px (1.5) | 400 | 0 | `.grid-bar`、分页、`.dropzone-progress-text` |
| 注释 | `--fs-caption` | 11.5 | 17px (1.46) | 400 | 0 | `.card-note`、`.kpi-foot`、`.meta-k`、`th`、`.asset span` |
| 微标签 | `--fs-micro` | 10.5 | 16px (1.5) | 600 | +0.9px（仅全大写英文） | `.sidebar-group`、`.type-chip` |
| 徽标 | `--fs-badge` | 10 | 16px | 500 | 0 | `.tag` |

排版规矩（逐条可执行）：

1. **正文字号下限 11.5px**。会成句阅读的文字不得小于 `--fs-caption`；10.5px 只允许出现在「全大写英文标签 + 类型徽标 + 徽标」，且必须配合 `--text-2` 或更深的颜色。
2. **数字一律等宽数位**。`.tnum` 工具类已有，需补齐到：`.kpi-value`、`.table-card-stats b`、`.tbl-count`、`.grid-bar b`、`.pager-page`、顶栏 `.topbar-stat b`、`.meta-v` 里的数字、`.jt-meta` 的计数。（现状只有前 4 处，翻开分页时会看到数字宽度跳动。）
3. **单位降一级**：`.kpi-unit`、`.cell-sub`、`.top-value em` 用 `--fs-caption` + `--text-3`，与数字之间用 `margin-left: 3px` 定位，不用空格字符（空格会在窄列里被折行）。
4. **中文正文 `letter-spacing: 0`**；`letter-spacing` 只允许用于全大写英文分组标题（+0.9px）与大标题（-0.2px / -0.3px 视觉补偿）。
5. **行长上限**：说明性段落 `max-width: 46ch`（现状 `.dropzone .lead` 已是 46ch，`.empty p` 42ch 保留，`.alert span` 建议 68ch）。
6. **中文段落行高 ≥1.5**；表格与 JSON 树这类数据行可以压到 1.5，但不能低于 1.45。
7. **不换行优先级**：类型徽标、PK/JSON 徽标、分页数字、侧栏行数一律 `white-space: nowrap`；表头 `nowrap`（现状已有）；单元格正文允许 `break-word`，JSON 单元格 `break-all`（现状已有）。

### 等宽字体的使用场景与字号

| 场景 | 类 | 字号 / 行高 | 说明 |
| --- | --- | --- | --- |
| 建表 SQL、SQL 结果原文 | `.code-block` | 12.5px / 1.7 | 允许折行 |
| SQL 编辑器 | `.sql-editor` | 12.5px / 1.7 | 等宽 + `tab-size: 2`（新增，现状 Tab 是 8 格，SQL 对齐会崩） |
| JSON 节点树 | `.jsontree` | 12.5px / 1.75 | 唯一用 1.75 行高的地方（树需要垂直呼吸感） |
| 数据表格的数字列 | `.cell-num` | 12.5px | 右对齐 + tabular-nums |
| JSON 单元格 | `.cell-json` | 11.5px | 2 行截断 |
| 行内代码 / 字段名 / 索引名 / 默认值 | `.code-inline` | 11.5px | 有背景 + 边框 |
| 类型徽标 | `.type-chip` | 10.5px | `--r-xs` 圆角，非胶囊（与语义徽标区分） |
| 路径 / 面包屑 | `.jt-path` | 11.5px | 单行省略 |
| 侧栏行数 | `.tbl-count` | 11px | tabular-nums |
| 分页 / 页码 | `.pager-btn`、`.pager-page` | 12px / 11.5px | tabular-nums |
| 导出文件名 | `.table-card-name`、`.tbl-name` | 12.5–13px | 用**正文**字体（文件名里有中文，等宽会掉字体） |

> 等宽区里出现中文（SQL 注释、字段的中文别名）时：字号不缩小、`letter-spacing: 0`，并接受中英文混排 —— 但禁止把只有中文的内容放进等宽容器（如「用户表」这种表名走 `.tbl-name` 的正文栈）。

---

## 4. 间距 / 圆角 / 阴影

### 4.1 间距（推导逻辑：4px 基准栅格）

规则：**所有间距 = 4n**。只允许两个例外 —— `2px`（同类元素紧贴，如两个相邻徽标）、`6px`（图标与其文字标签）。命名按「用途」而不是序号，避免改代码时不知道该选哪一档。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--sp-1` | 2px | 相邻徽标之间、`<sup>` 类微调 |
| `--sp-2` | 4px | 表格内元素间距、标签换行间距、分段控件内 gap |
| `--sp-3` | 6px | 图标 + 文字、KPI 数字 + 单位、按钮内 gap |
| `--sp-4` | 8px | 侧栏行内间距、按钮组 gap、`.row` gap、网格 gap（紧凑） |
| `--sp-5` | 10px | 卡片头内部 gap、工具条内部 gap |
| `--sp-6` | 12px | **组件内边距默认值**：卡片头 padding、侧栏头 padding、网格 gap |
| `--sp-7` | 14px | 按钮 padding-x、表格单元格 padding-x、KPI padding |
| `--sp-8` | 16px | **卡片内边距默认值**（`.card-body.pad`、网格容器 padding） |
| `--sp-9` | 20px | 主区内边距（上）、内容块之间 |
| `--sp-10` | 24px | 主区左右 padding（宽屏）、卡片间隔 |
| `--sp-11` | 32px | 区块分隔、落地页留白 |
| `--sp-12` | 40px | 落地页卡片内边距 |
| `--sp-13` | 52px | 空态上下留白（现状 `.empty` 46px → 归到 52px） |

**间距的层级纪律**（这是「看起来专业」的核心）：
- 组内间距 < 组间间距，比例至少 1:1.5。例：`.kpi-top` 与 `.kpi-value` 之间 8px，`.kpi-value` 与 `.kpi-foot` 之间 5px→**6px**，卡片之间 24px。
- 现有偏差需修 3 处：`.kpi` padding `14px 15px` → `14px 16px`；`.main-head` / `.main-body` 左右 `26px` → `24px`；`.grid-bar` padding `9px 14px` → `10px 14px`。

### 4.2 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| `--r-xs` | 4px | 行内 code、命中高亮块、`.type-chip` |
| `--r-sm` | 6px | 按钮、输入框、分段控件按钮、侧栏行、分页按钮、`.jt-path` |
| `--r-md` | 9px | 表卡片、pick 卡片、alert、`.query-result`、`.code-block`、`.tbl-item` 悬停底 |
| `--r-lg` | 13px | 大卡片（`.card`）、KPI、拖拽区、覆盖层卡片 |
| `--r-xl` | 16px | 落地页图标底（`.dropzone-mark`）|
| `--r-full` | 999px | 胶囊徽标（`.chip` / `.tag`）、进度条、滚动条抓手、行数徽标 |

规矩：**父子同心**，子圆角 = 父圆角 − 父 padding，最小值不小于 `--r-xs`。实际约束：`.card`（13px）内的 `.query-result`（9px）不再嵌套圆角；`.card` 内的表格用 `overflow:hidden` 裁角，不给 `<table>` 单独设圆角。

### 4.3 阴影

| Token | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `--sh-1` | `0 1px 2px rgba(15,21,34,.05)` | `0 1px 2px rgba(0,0,0,.40)` | 卡片、KPI 静置 |
| `--sh-2` | `0 2px 8px rgba(15,21,34,.06)` | `0 2px 8px rgba(0,0,0,.45)` | 卡片 hover、拖拽区静置 |
| `--sh-3` | `0 12px 32px rgba(15,21,34,.10)` | `0 12px 32px rgba(0,0,0,.55)` | 拖拽覆盖层、拖拽中的卡片 |
| `--ring` | `0 0 0 3px var(--accent-soft)` | 同左 | 输入框 focus（配合 `border-color: var(--accent)`） |

规矩：**卡片静置层次靠 1px 边框，不靠阴影**（现状已如此，保持）；阴影只表达「浮起」；同屏最多一层 `--sh-3`。

---

## 5. 布局与断点

骨架不动：`.app{height:100dvh;overflow:hidden}` → `.topbar`（56–58px）→ `.workspace`（grid：侧栏 + 主区）→ `.main`（`overflow-y:auto`）→ `.main-head`（`position:sticky;top:0`）+ `.main-body` → `.app-foot`。**侧栏独立滚动、主区吸顶依赖这个骨架，任何「改成 min-height」「把 sticky 去掉」「给 .app 加 padding」的改动都会踩坑。**

### 5.1 关键尺寸

| 项 | 值 | 备注 |
| --- | --- | --- |
| `--bar-h` | 58px（<768px：52px） | 现状 58px，保留 |
| `--nav-w` | 272px（≥1440）/ **268px（1080–1440，现状）** / 240px（860–1080，现状 216px） | 216px 放不下「表名 + 行数 + 2 个标签」，加宽 24px |
| 侧栏横置高度 | 176px → 168px（<860） | 现状 176px，保留亦可；取 168px 与 4n 对齐 |
| `--content-max` | 1400px | 新增 `.shell` 只包住 `.main-head` 的内层与 `.main-body`，**不包背景层**，否则吸顶区背景会被裁窄 |
| 主区左右 padding | 24px（≥1080）/ 16px（768–1080）/ 14px（<768） | 现状 26 / 14 |
| `table.grid` 最小宽度 | 640px | 低于此值横向滚动，**绝不压列宽** |
| 表格滚动区高度 | 460px（数据预览）/ 380px（SQL 结果）/ 不限（字段结构 `.tall`） | 现状一致 |
| KPI 最小宽 | 158px（<768：138px） | — |
| 触控目标 | ≥32×32（桌面）/ ≥44×44（`@media (pointer:coarse)`） | 分页按钮 28×26 → 32×32 |

### 5.2 KPI 网格列数规则（5 张卡，固定规则）

| 断点 | 列数 | 实现 |
| --- | --- | --- |
| ≥1440 | 5 列等宽 | `grid-template-columns: repeat(5, minmax(0,1fr))` |
| 1080–1440 | `auto-fit`，实得 3–5 列 | `repeat(auto-fit, minmax(158px,1fr))`（保留现状写法） |
| 768–1080 | 3 列 | `repeat(3, minmax(0,1fr))` |
| <768 | 2 列，第 5 张（解析耗时）跨两列 | `repeat(2,minmax(0,1fr))` + `.kpi:last-child{grid-column:span 2}` |

### 5.3 断点行为表

| 断点 | 顶栏 | 侧栏 | 主区 | 网格 / 表格 | 其他 |
| --- | --- | --- | --- | --- | --- |
| **≥1440** | 58px；4 个统计数全显，各 padding 0 16px；统计值 13.5px | 272px 竖列，标签全显 | 内容居中 `max-width:1400px`；左右 24px | KPI **5 列**；`.table-cards` `minmax(230px,1fr)`；`.pick-grid` `minmax(216px,1fr)` | 页脚显示 |
| **1024–1440** | 58px；统计数 padding 收窄 0 10px | 268px 竖列（≤1080 时 240px） | 左右 24px→20px；`.jt-path` max-width 220px | 同上，列数自然递减 | 页脚显示 |
| **768–1024** | 58px；统计数**只留 2 个**（表数、行数），另 2 个移到「数据库信息」卡里，信息不丢只搬家；`.brand-sub` 隐藏 | 240px 竖列；<860 时转横置滑条（高 168px，卡片宽 160px，`scroll-snap-align:start`，搜索框固定在滑条上方） | 左右 16px；`.main-sub` 单行省略；**Tab 条改可横滑** | KPI **3 列**；`.table-cards` `minmax(186px,1fr)`；`.pick-grid` `minmax(180px,1fr)` | 页脚 <860 隐藏 |
| **<768** | 52px；统计数全部移除，只留品牌 + 主题 + 换个文件（后者改图标按钮 + `aria-label`）；`.brand` 图标 26px | 横置滑条；侧栏分组标题改为「贴在滑条起始处的小标签」 | 左右 14px；`.main-title` 18px；Tab 可横滑，Tab padding 9px 12px | KPI **2 列**（第 5 张跨 2 列）；`.table-cards`/`.pick-grid` **1 列**；`table.grid` 横向滚动，**首两列粘性固定**（`th:first-child,td:first-child{position:sticky;left:0}`，行号列 + 第二列用 `box-shadow: 1px 0 0 var(--line-1)` 做接缝） | 页脚隐藏；`.grid-bar` 折成两行（统计一行、分页另起） |

**Tab 条横滑实现**（新增，不动骨架）：`.tabs` 外面再包一层 `.tabs-wrap{overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}`，`::-webkit-scrollbar{display:none}`；两侧用 `mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)` 做渐隐；`.tabs{scroll-snap-type:x proximity}`、`.tab{scroll-snap-align:start}`。吸顶仍由 `.main-head{position:sticky;top:0}` 负责。

---

## 6. 逐组件规格

### 6.0 状态定义的统一约定（先定规矩，后面不再重复）

| 状态 | 背景 | 边框 | 文字 | 说明 |
| --- | --- | --- | --- | --- |
| 默认 | 见各组件 | `--line-1` | `--text-1` | 卡片静置层次靠 1px 边框，不靠阴影 |
| hover | 提亮/压暗一级（`surface`→`surface-2`/`surface-3`） | → `--line-3` | → `--text-1` | 只改颜色，120ms |
| **active（按下）** | 再深一档 | 不变 | 不变 | **禁止位移 / 缩放 / 内阴影以外的变化**；现状 `.table-card:hover` 的 `translateY(-1px)` 保留，但 `:active` 必须回到 0，否则"按下去更飘" |
| focus-visible | 不变 | 不变 | 不变 | `outline: 2px solid var(--focus); outline-offset: 2px`；**深色面板内（顶栏 / 侧栏）改用 `--focus-on-dark`**；表格单元格与满宽行用 `offset: -2px`（否则被 `overflow:hidden` 裁掉） |
| 选中 | `--accent-soft`（浅底）/ `--nav-active`（侧栏） | `--accent-line` 或 inset 2px `--accent` | `--accent-text` | 选中必须有**非颜色**的第二信号（左侧竖条 / 2px 描边） |
| **disabled** | `--surface-3` | `--line-2` | `--text-4` | **禁用一律不用 `opacity: .5`** —— 实测半透会把 `--text-1` 压到 **3.46:1**，读不清"这个按钮现在是什么"。改用明确灰色 token + `aria-disabled="true"` + `cursor: not-allowed` |
| loading | 见 §6.12 | — | — | 必须能证明"在干活"，见 §6.12 |
| empty | `.state` 组件 | — | — | 每个空态必须给「下一步动作」 |
| error | `.state.is-error` 或 `.alert.is-danger` | — | — | 必须给「原因 + 怎么办」，不能只说"失败了" |

触控目标：桌面 ≥32×32，`@media (pointer:coarse)` 下 ≥44×44（分页按钮、标签、图标按钮）。

---

### 6.1 通用基元

#### 6.1.1 `.btn`

```
[ icon 13 ]  文案        ← gap 6，图标与文字基线对齐
padding 7px 13px ｜ h 32 ｜ r 6 ｜ font 13/500
```

| 变体 | 底 / 文字 | 边框 | 用途 | 对比度 |
| --- | --- | --- | --- | --- |
| `.btn-primary` | `--accent` / `#fff` | 无 | 主操作：选择文件、执行 | **5.37:1 AA** |
| `.btn-quiet` | `--surface` / `--text-1` | `--line-2` | 次操作：导出、复制、清空 | 18.25:1 AA |
| `.btn-ghost` | 透明 / 继承 | `--line-3` | 深色面板内：顶栏 | — |
| `.btn-sm` | 同上 | 同上 | 卡片头 / 工具条，h **28**（现状 26→28），padding 4px 10px，font 12 | — |
| `.btn-icon` | 透明 / `--text-2` | 无 | 主题切换、关闭，**32×32** | 图标需 ≥3:1（`--text-2` 7.65:1 ✓） |

| 状态 | 表现 |
| --- | --- |
| 默认 | 见上表 |
| hover | primary → `--accent-hover`（**6.77:1**）；quiet → 底 `--surface-3` + 边框 `--line-3`；ghost → 底 `--nav-bg-2`；icon → 底 `--surface-3` + 色 `--text-1` |
| active | primary → `--accent-hover` + `box-shadow: inset 0 1px 3px rgba(0,0,0,.12)`；其它变体维持 hover 态，**不动 transform** |
| focus-visible | `outline: 2px solid var(--focus); outline-offset: 2px`（顶栏内用 `--focus-on-dark`） |
| disabled | 底 `--surface-3`、字 `--text-4`、边框 `--line-2`、`cursor: not-allowed`、`aria-disabled="true"` |
| loading | 文案左侧插 12px CSS 转圈（`border: 2px solid currentColor; border-top-color: transparent; animation: spin .8s linear infinite`），文案保持（「执行中…」），`aria-busy="true"`；**不加 `pointer-events:none`**（否则焦点会丢，读屏会跳过它） |

#### 6.1.2 输入族（`.input` / `.sql-editor` / 侧栏搜索）

| 项 | 值 |
| --- | --- |
| 高 | 32（现状 ~33，收敛） |
| padding | 7px 11px |
| 字号 | 13；`.input-mono` / `.sql-editor` 12.5 等宽 |
| 圆角 | `--r-sm` 6 |
| 边框 | 默认 `--line-2`；hover `--line-3`；focus `--accent` + `box-shadow: 0 0 0 3px var(--accent-soft)`（= `--ring`） |
| placeholder | `--text-3`（**5.15:1 AA**，修 Token 后自动达标；现状 3.44:1 不合格） |
| disabled | 底 `--surface-3`、字 `--text-4`、边框 `--line-2` |
| error | **输入框不做红色描边**。错误统一交给 `.state.is-error` / `.alert`，避免"红框 + 红条"双重表达同一件事 |
| 侧栏搜索 | 底 `--nav-bg-2`、边框 `--nav-line`、字 `--nav-text-strong`（14.42:1）、placeholder `--nav-text`（6.60:1）、左侧图标绝对定位 `left: 9px`、`padding-left: 30px`；hover 边框 `--nav-input-border`；**focus 环改亮色** `0 0 0 3px rgba(139,139,240,.18)`（深底上不能用浅色 `--accent-soft`，会变成一块白圈） |
| `type="search"` | 保留系统清除按钮（触屏上这是主要清空入口），只把 `::-webkit-search-decoration` 去掉 |

#### 6.1.3 `.chip` 与 `.tag`（两个不同的东西，别混用）

| | `.chip` | `.tag` |
| --- | --- | --- |
| 语义 | **状态徽标**（视图 / PK / JSON / 未上传 / 行数估算） | **行内元信息**（N 字段 / JSON N / 外键 N） |
| 出现位置 | 卡片头、`.main-title` 旁、`.chip-row`、表头 | 侧栏行的第二行 |
| 高度 | 20（`line-height:1.75`，`padding: 0 8px`，font 11） | 16（`line-height:1.6`，`padding: 0 6px`，font 10） |
| 圆角 | `--r-full` | `--r-full` |
| 交互 | 仅 `.is-clickable`（JSON 字段筛选）：hover 底 `--accent-soft` + 边框 `--accent-line` + 字 `--accent-text` | 不可交互，无 hover |
| 状态 | 默认 / hover / focus-visible（同 `.btn`）/ disabled（字 `--text-4` + `aria-disabled`） | 无状态（纯静态） |
| 变体 | `.is-view` `.is-pk` `.is-json` `.is-ok` `.is-mini` | `.is-json` `.is-fk` `.is-view` `.is-hit` |

#### 6.1.4 `.card`

```
┌─ .card  1px line-1 · r 13 · sh-1 · margin-bottom 16 ──────────────┐
│ .card-head  padding 12 16 · min-height 48 · bg surface-2 · 底 1px line-1 │
│   [icon 14 accent]  h2 13.5/600  ·  [chip]  ·  spacer  ·  card-note 11.5 text-3  ·  [btn-sm]
├───────────────────────────────────────────────────────────────────┤
│ .card-body（默认无 padding） / .card-body.pad（padding 16）         │
└───────────────────────────────────────────────────────────────────┘
```
- `.card + .card` 间距 **16px**（保持现状，不放大 —— 这个站信息密度高，16px 已经是分组的最小值）
- `.card-head` `flex-wrap: wrap`（✓ 已有），窄屏时 `.card-note` 换到第二行并左对齐
- 状态：静置 / hover（仅可点击卡片）/ loading（骨架卡片）/ empty（内嵌 `.state`）/ error（内嵌 `.alert.is-danger`，`margin: 16px 16px 0`）

#### 6.1.5 `.state` —— 统一「空 / 加载 / 错误」组件（**本次新增，替代散落的 `.empty` 与内联 alert**）

```
┌────────────── .state（padding 52 22 · max-width 520 · margin auto · 居中） ──────────────┐
│                          [ .state-mark ]  44×44 r 16                                     │
│                          .state-title  13.5/600 --text-1                                 │
│                          .state-desc  12.5/400 --text-3 · max-width 42ch · line-height 1.6 │
│                          [ .state-actions ]  gap 8 · margin-top 16（最多 2 个 btn-sm）    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

| 变体 | class | mark 底 / 色 | ARIA | 用在哪 |
| --- | --- | --- | --- | --- |
| 空 | `.state` | `--surface-3` / `--text-3` | 无（或用 `role="status"`） | 空库、空表、无 JSON、搜索无结果 |
| 加载 | `.state.is-loading` | `--accent-soft` / `--accent` | `role="status" aria-live="polite" aria-busy="true"` | 解析中、查询中 |
| 错误 | `.state.is-error` | `--danger-soft` / `--danger` | `role="alert"` | 文件损坏、单表读取失败 |
| 提示 | `.state.is-hint` | `--info-soft` / `--info` | 无 | 空结果但有下一步 |

尺寸对齐：padding **52px 22px**（现状 `.empty` 是 46px → 归到 4n 栅格）、mark 44×44 + `--r-xl` 16（现状 12px 圆角 → 归到 token）、mark 与标题间距 14、标题与说明 5、说明与动作 16。

**每个空态必须给「下一步动作」** —— 逐场景定死（这是本次规范里最能立刻提升体感的一条）：

| 场景 | 标题 | 说明 | 动作按钮 |
| --- | --- | --- | --- |
| 库里没有表 | 这个数据库里没有表 | 文件可能是空的，或只包含系统表（`sqlite_` 开头不展示） | [换个文件] |
| 表里没有数据 | 这张表里还没有数据 | 已定义 N 个字段，当前 0 行 | [看字段结构] [看建表 SQL] |
| 没有 JSON 字段 | 这张表里没有检测到 JSON 字段 | 判断依据：声明类型含 JSON，或抽样字符串能被 `JSON.parse` 成功解析 | [切到别的表] |
| 有 JSON 字段但预览无值 | 预览数据里没有可解析的 JSON 值 | 字段被识别为 JSON，但前 N 行没有实际内容 | [去数据预览] |
| 搜索无结果 | 没有匹配的表或字段 | 可以搜表名，也可以搜字段名 | [清空搜索] |
| **没有外键 / 没有索引** | — | — | **不给空态组件**，只在卡片头右侧用一行 `.card-note`（「这张表没有外键约束 · SQLite 默认不强制校验」） |

> 最后一条是刻意的：总览页与字段页一旦出现三块大留白空态，用户会觉得「这库是不是没读出来」。**能用一行注释表达的"没有"，不要用一整块空态。**

#### 6.1.6 其它基元

| 类 | 关键尺寸 | 状态要点 |
| --- | --- | --- |
| `.skeleton` | 文本行 h12 / 表格行 h16 / 卡片块 h 按内容；`--r-xs`；`background-size: 200% 100%` | 见下方骨架屏 Token；`animation: shimmer 1.6s linear infinite` |
| `.bar` | h 4 · `--r-full` · 底 `--surface-3`；填充 `--brand-gradient` | 确定进度：`span` 宽度 = 比值，`transition: width 240ms cubic-bezier(.16,1,.3,1)` |
| `.bar.is-indeterminate` | `span` 宽 35%，`translateX(-100%→300%)` 1.4s 循环 | 用于「加载解析引擎」这种真进度不可知的阶段 |
| `.seg` | 内 padding 2 · gap 2 · `--r-sm` · 底 `--surface-3` · 边框 `--line-1` | 激活项：底 `--surface` + `--sh-1` + 字 `--accent-text`（8.24:1 ✓） |
| `.pager-btn` | **32×32**（现状 28×26）、`--r-sm`、font 12 | 默认 / hover 边框 `--accent` + 字 `--accent-text` / disabled 字 `--text-4` + 底 `--surface-2` / 当前页底 `--accent` 白字（5.37:1） |
| `.code-inline` | 11.5 mono · padding 1px 5px · `--r-xs` · 底 `--surface-inset` · 边框 `--code-line` | 长值（默认值 / 索引字段）单行省略 + `title` |
| `.code-block` | 12.5/1.7 · padding 13 15 · `--r-md` · 底 `--surface-inset` · `tab-size: 2` | 建表 SQL 用 `pre-wrap`（现状）；SQL 结果用 `pre` + `overflow:auto` 横向滚动 |

**骨架屏必须换色** —— 现状 shimmer 用 `--surface-3` → `--surface-2`，振幅只有 **1.05:1**，屏幕上就是一块静止的浅灰，用户读不出"在加载"。新增两个 Token：

| Token | 亮 | 暗 | 实测振幅 |
| --- | --- | --- | --- |
| `--skeleton-base` | `#e4e9f1` | `#1c2233` | ÷surface 1.22:1 / 1.11:1 |
| `--skeleton-sheen` | `#f8fafc` | `#2b3450` | ÷base **1.17:1 / 1.29:1** |

---

### 6.2 TopBar（`.topbar`）

```
[▣ 30×30] 数据库放大镜 │ 拖入文件，看懂数据库        12 | 84.3k | 7 | 412ms      [☾] │ [换个文件]
  .brand(gap 10)                .brand-sub        .topbar-stats(每项 padding 0 14 / 分隔线 1px)  .btn-icon │ .btn-primary.btn-sm
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  ← .progress-line（busy 时出现，2px，贴底边，不占高度）
```

| 项 | 尺寸 |
| --- | --- |
| 高度 | 58px（<768px → 52px） |
| padding | `0 18px`（<768 → `0 12px`） |
| gap | 14px（<768 → 10px） |
| 品牌 | 字 15/600 `--nav-text-strong`；`.brand-mark` 30×30 `--r-md` `--brand-gradient`；`.brand-sub` 12px `--nav-text`（7.32:1 AA）+ 左边框 1px `--nav-line` + `padding-left: 12px` |
| 统计项 | 上下两行：值 13.5/600 `--nav-text-strong`（**16.32:1 AA**）+ tabular-nums；标签 12px `--nav-text`（**7.32:1 AA**）；左分隔线 1px `--nav-line`（首项无） |
| 统计顺序（固定，不增删） | 表数 → 行数据（含估算时加 `≈`）→ JSON 字段 → 解析耗时 |
| 缺数据 | 显示 `—`，**不显示 0**（0 是"算出来是 0"，`—` 是"没测到"，语义不同） |
| `.topbar-pill` | 高 22 · `--r-full` · 边框 `--nav-line` · 文字 11.5 `--nav-text`（7.32:1 AA）· 图标 `#8fc4d8`（图形，非文本） |
| 主题切换 | `.btn-icon` 32×32 |
| `.progress-line` | 高 2px，底 `--nav-line`，填充 `--brand-gradient`；**绝对定位贴底边**，不占顶栏高度（现状 ✓ 别改） |

| 状态 | 表现 |
| --- | --- |
| 落地页（`report=null`） | 品牌 + 副标题 + spacer + 主题切换 + 「纯本地解析」pill；统计区**不占位**（不留空块） |
| 工作区 | 副标题隐藏；4 统计 + 主题切换 + 1px 分隔 + 「换个文件」（`.btn-primary.btn-sm`，h 28） |
| busy | 底边进度条出现，同时：统计区 `opacity: .55` + `pointer-events: none`（在读旧数值时不让人以为它更新了）；**「换个文件」保持可点**（用户有取消的权利，点了走 §6.2 的二次确认） |
| 解析中点击「换个文件」 | 按钮就地变成「确认丢弃？ / 取消」两个 `.btn-sm`，**不引入模态框**（零依赖 + 不打断焦点） |
| focus-visible | 顶栏内所有可聚焦元素用 `outline: 2px solid var(--focus-on-dark); outline-offset: 2px`（现状 accent 在 `#111524` 上只有 3.38:1） |
| empty / error | 顶栏不承载空态与错误。错误一律在落地页/主区用 `.alert.is-danger` |

---

### 6.3 Sidebar（`.sidebar`）

```
┌ .sidebar  272/268/240px · bg --nav-bg · 右 1px --nav-line ─────────┐
│ .sidebar-head  padding 12 12 10 · 底 1px --nav-line                │
│  ┌ .sidebar-search  h32 · bg --nav-bg-2 · 边框 --nav-line ─────┐   │
│  │ [🔍 14px @left 9]   搜索表名或字段名…                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│ .sidebar-body  padding 8 8 24 · overflow-y: auto  ← 独立滚动        │
│  .sidebar-group  10.5/600 +0.9px  --nav-label    [▤] 表 · 23        │
│  ┌ .tbl-item  最小高 44 · padding 8 10 · r6 · mb 2 ─────────────┐   │
│  │ orders                                                  1 284 │   │  .tbl-name 12.5/500 ellipsis  .tbl-count 11 mono
│  │ [12 字段] [JSON 2] [外键 1]                                    │   │  .tbl-tags gap 4 · mt 5 · tag h16
│  └────────────────────────────────────────────────────────────────┘   │
│  .sidebar-group  视图 · 3                                            │
│  …                                                                  │
│  .sidebar-empty（无匹配）                                            │
└──────────────────────────────────────────────────────────────────────┘
```

| 项 | 尺寸 |
| --- | --- |
| 宽 | 272（≥1440）/ 268（1080–1440）/ 240（860–1080） |
| `.tbl-item` | 最小高 44 · padding `8px 10px` · `--r-sm` · 下间距 2 |
| `.tbl-name` | 12.5 / 500 · 单行省略（`title` 给全名） |
| `.tbl-count` | 11 mono · `--nav-count`（未选中 **6.03:1 AA**）/ 选中行切 `--nav-count-active`（**6.79:1 AA**） |
| `.tag` | 高 16 · font 10 · gap 4 · 换行间距 `--sp-1` |
| `.sidebar-group` | 10.5/600 +0.9px 大写风格 · `--nav-label`（**5.23:1 AA**）· padding `12px 10px 7px` |

| 状态 | 视觉 |
| --- | --- |
| 默认 | 字 `--nav-text` 7.32:1；透明底 |
| hover | 底 `--nav-bg-2`；字 `--nav-text-strong` |
| active（按下） | 底 `--nav-active`；**不动 transform** |
| 选中 | 底 `--nav-active` + `box-shadow: inset 2px 0 0 var(--accent)`（**非颜色的第二信号**）+ 字 `--nav-text-strong`（11.95:1）+ `aria-current="true"`（✓ 已有）+ 行数切 `--nav-count-active` + 行内 `.tag` 底切 `#35406a`（现状标签底压在选中底上只有 1.09:1，会糊掉） |
| focus-visible | `outline: 2px solid var(--focus-on-dark); outline-offset: -2px`（行是满宽，正偏移会被侧栏裁掉） |
| disabled | 不适用（表必然可选） |
| empty | `.sidebar-empty`：padding `26px 12px`、12px、`--nav-label`（现状用 `#66708a` 只有 3.67:1）+ **新增「清空搜索」按钮**（12px，用 `#a5a5ff`，除以 `#111524` **8.15:1** —— **不能用 `--accent`，深底上不够亮**） |
| loading | 3 条 `.tbl-item` 骨架：行名占位 60% 宽 h12 + 行数占位 40×12；`shimmer 1.6s` |
| error | 侧栏不承载全局错误；**单表读取失败**在该行 `.tag.is-warn`「部分信息未读取」+ `title` 写原因，点击仍可进入该表 |

> 侧栏独立滚动完全依赖 `.sidebar-body{flex:1;min-height:0;overflow-y:auto}`（✓ 已有），搜索框留在 `.sidebar-head` 所以滚动时不动（✓ 已有）。这两条是骨架的一部分，**改动前先在 200 张表的库上验证**。

---

### 6.4 DropZone 与全局拖拽覆盖层

```
.dropstage（flex · padding 40 20 · overflow-y auto）
 └ .dropcard（width: min(760px,100%) · margin auto）
    ┌ .dropzone  虚线 1.5px --line-3 · r13 · 底 --surface · padding 52 40 40 · sh-2 ─┐
    │        [ .dropzone-mark  56×56 · r16 · --brand-gradient ]                       │
    │        h1  22/600 -0.3px  把数据库文件拖进来                                     │
    │        .lead  14 --text-2  max-width 46ch                                       │
    │        .hint  12 --text-3  max-width 50ch（支持格式 + 不上传）                    │
    │        [选择文件 primary]  [先看看示例数据 quiet]                                │
    │        ── .dropzone-progress（busy 时出现，预留 min-height 52）──                │
    │        正在分析「orders」… (7/23)                                    42%         │
    │        ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  h4 r-full                              │
    │        ── .dropzone-divider  你会看到  ──                                       │
    │        .asset-grid（auto-fit minmax(178px,1fr) · gap 10）4 张能力卡             │
    └─────────────────────────────────────────────────────────────────────────────────┘
    .alert.is-danger（错误时 · margin-top 16 · 左对齐）
```

| 项 | 尺寸 |
| --- | --- |
| `.dropstage` padding | 40 20（<768 → 24 14） |
| `.dropcard` | `min(760px, 100%)` |
| `.dropzone` padding | `52px 40px 40px`（<768 → `32px 20px 24px`） |
| `.dropzone-mark` | 56×56 · `--r-xl` 16 · 图标 24 |
| `.asset` | padding `12px 13px` · `--r-md` · 底 `--surface-2` · 图标 15 `--accent` · 标题 12.5/600 · 说明 11.5 `--text-2` |
| `.dropzone-progress` | mark 后 20px · 文案 12 · 百分比 12 mono `--accent-text` · 进度条 h4 |

| 状态 | 视觉 |
| --- | --- |
| 默认 | 虚线 `--line-3` |
| hover | 虚线不变，底 `--surface-2` |
| **is-over（拖拽悬停）** | 虚线 → `--accent` 且加粗到 2px；底 `--accent-soft`；mark 换 `IconUpload`；**禁止 `translateY(-2px)`**（现状有 —— 拖拽时卡片跟着跳，光标与落点对不上） |
| focus-visible | `outline: 2px solid var(--focus); outline-offset: 2px`（整卡是 `role="button"`，✓ 已有） |
| active | 无 |
| disabled / busy | 两个按钮 disabled（**token 灰，不用 opacity**）；`aria-busy="true"`；`Enter`/`Space` 仍可聚焦但不触发新选择 |
| loading | `.dropzone-progress` 出现 —— **外层预留 `min-height: 52px`**，否则出现瞬间会把下面 4 张能力卡往下推（现状真实缺陷）；阶段文案来自 `onProgress(message, ratio)`，见 §6.12 |
| error | `.alert.is-danger` 移到卡片**下方左对齐**。文案必须含「原因 + 怎么办」，4 类分开：扩展名不对 / 文件头不是 SQLite / 读取失败 / 解析失败（现状已分开 ✓，只需把第一句加重） |
| empty | 不适用 |

**全局拖拽覆盖层 `.drop-overlay`**（工作区内拖入新文件）：

| 项 | 规范 |
| --- | --- |
| 结构 | 固定 `inset: 0` · `z-index: 50` · 底 `--overlay` · `backdrop-filter: blur(2px)`（现状 3px → **2px**，大库时 blur 会掉帧）· `aria-hidden="true"`（✓ 已有） |
| 内部卡片 | padding `34px 46px` · 虚线 2px `--accent` · `--r-lg` · `--sh-3` · 标题 15/600 · 说明 12 `--text-3`；**卡片 `pointer-events: none`**（避免遮挡导致 `dragleave` 反复触发、遮罩闪烁） |
| 动效 | 进入 opacity 120ms ease-out；**离开立即消失，不做退出动画**（退出动画会造成"遮罩卡住"的错觉） |
| 文案 | 保留「松手即可分析新文件 / 当前分析结果会被替换，磁盘上的原文件不受影响」—— 这是信任感的第二次关键触达，不许删 |

---

### 6.5 OverviewPanel

**KPI 卡 `.kpi`**（列数规则见 §5.2）：

```
┌ .kpi  min 158 · padding 14 16 · r13 · 1px --line-1 · sh-1 ┐
│ [icon 14 --accent]  数据表          ← .kpi-top 11.5 --text-3 · gap 7 · mb 8
│ 12 张                               ← .kpi-value 23/650 -0.6px tabular-nums + .kpi-unit 11.5 --text-3
│ 另有 3 个视图                       ← .kpi-foot 11.5 --text-3 · mt 6
└──────────────────────────────────────────────────────────────┘
```

| 状态 | 视觉 |
| --- | --- |
| 默认 | `cursor: default`；**没有 hover 效果**（不可点击的元素不该有 hover 反馈，现状 ✓ 保持） |
| hover / active / focus | 不适用（整卡不可交互） |
| empty | 数值位显示 `—`，`.kpi-foot` 写「未检测到…」（例：JSON 字段为 0 → 「未检测到 JSON 字段」✓ 现状已有） |
| loading | 数字换成 h12、宽 62% 的骨架条；**图标与标签保留**（标签说明"我们在算什么"，loading 时更该显示） |
| error | 不适用（错误由面板承载） |

**数据库信息卡**：`.meta-grid` 保持 `repeat(auto-fit, minmax(230px,1fr))` + gap `4px 22px`；**去掉 `.meta-row` 的虚线下边框**（4 行数据配 4 条虚线是纯噪音），改为行高 34px + 键固定 88px；`.meta-k` 11.5 `--text-3`（**5.15:1 AA**）；`.meta-v` 12.5 `--text-1`；长值 `overflow-wrap:anywhere`（✓ 已有）。
窄屏被顶栏隐藏的 2 个统计数插入本卡（补到 6 行），**信息不丢**。

**表卡片 `.table-card`**：min 230 · padding 13 14 · `--r-md` · 图标 24×24 `--r-sm` 底 `--accent-soft` · 名称 13/600 省略 · 统计 4 列（行 / 字段 / 外键 / JSON）gap 14，值 14/600 `--text-1` tabular-nums，标签 11.5 `--text-3`。

| 状态 | 视觉 |
| --- | --- |
| hover | 边框 `--accent-line` + `--sh-2` + `translateY(-1px)`（保留） |
| active | `translateY(0)` + 底 `--surface-2`（按下不"更飘"） |
| focus-visible | `outline: 2px solid var(--focus); outline-offset: 2px` |
| 备注行 | 行数为估算 → 11px `--warn`（**6.80:1 AA**）；部分信息未读取 → 11px `--warn` |
| empty | `.state`（库里没有表 → [换个文件]） |
| loading | 6 张骨架卡片（图标圆 + 名称条 + 两行统计条） |

---

### 6.6 DataGrid（`.grid-scroll` + `table.grid` + `.grid-bar`）

```
.card
 ├ .card-head  数据预览 · [前 200 行] · note「点击带 JSON 标记的单元格可展开节点树」
 ├ .grid-scroll  max-h 460 · overflow auto
 │   table.grid   min-width 640（新增！）· font 12.5 · border-collapse separate
 │   ┌ thead（sticky top 0 · 底 --surface-2 · 11.5/600 --text-2 · padding 9 12）
 │   │  #  │ id [INTEGER][PK] │ payload [TEXT][JSON] │ created_at [DATETIME] │ …
 │   └ tbody  td padding 7 12 · 底 1px --line-1 · max-width 380
 │      1  │ 1024 │ {"sku":"A-1","qty":3}（.cell-json 2 行截断 · --violet）│ 2024-05-01T…
 │      ↑ .col-index 46px 右对齐 mono --text-3
 ├ .grid-bar  共 200 行 · 显示 1–25 │ 每页 [25▾] │ [导出 CSV] │ « ‹ 1/8 › »
```

| 项 | 值 |
| --- | --- |
| `table.grid` 最小宽 | **640px**（新增）—— 现状没有 `min-width`，20 列在窄屏会被压到每列 30px、文字竖排 |
| thead 高 | 36（padding 9 12）；sticky + `box-shadow: inset 0 -1px 0 --line-1`（✓ 已有，解决 sticky 下边框丢失） |
| 行高 | 33（padding 7 12）；`.grid-scroll` 上限 460 |
| `.col-index` | 46px 右对齐 mono 11 `--text-3`（**5.15:1 AA**） |
| 单元格 max-width | 380（✓ 已有）；数字右对齐 mono；JSON 2 行截断 |
| `.grid-bar` | padding 10 14 · 底 `--surface-2` · 上 1px `--line-1` · font 12 · `<b>` 12/600 `--text-1` tabular-nums |
| 分页按钮 | 32×32 `--r-sm`；`.pager-page` 11.5 mono「1 / 8」 |

| 状态 | 视觉 |
| --- | --- |
| 行 hover | 底 `--surface-2`。**只换底色，禁止位移/缩放**（表格行位移会让人误以为行在移动） |
| 单元格 hover（JSON 列） | 底 `--accent-soft` + `inset 0 0 0 1px --accent-line` + `cursor: pointer` |
| 选中单元格 | 底 `--accent-soft` + `inset 0 0 0 2px --accent`（✓ 已有）；所在行加 `.is-selected`（✓ 已有） |
| focus-visible | JSON 单元格必须可聚焦：`tabIndex={0}` + `role="button"` + `aria-label="第 3 行 payload 字段，查看 JSON 节点树"`；`outline: 2px solid var(--focus); outline-offset: -2px`（表格内必须负偏移，否则被 `overflow` 裁掉） |
| disabled | 不适用 |
| empty | `.state`：这张表里还没有数据 + 已定义 N 个字段 + [看字段结构] [看建表 SQL] |
| loading | **表头保留**（列名已知就不要藏），tbody 渲染 8 行骨架（每格 h12 骨架条）；分页与导出禁用 |
| error | 单表部分失败 → 卡片内 `.alert.is-warn`（✓ 已有，保留）；整表失败 → `.state.is-error` + [重试] |

分页细节：首页/上页在 `current === 0` 时 disabled（✓ 已有），disabled 态用 `--text-4` + 底 `--surface-2`，**不用 opacity**。每页行数 `select` 保留 25/50/100/200（✓ 已有，含 `aria-label`）。**不加「跳到第 N 页」输入框** —— 预览上限 200 行、最多 8 页，加输入框是过度设计。

---

### 6.7 SchemaSection（字段结构 / 外键 / 索引 / 建表 SQL）

```
.card  字段结构 · [N 个字段] · [N 个 JSON 字段] · note「精确统计 · 画像基于抽样 1 000 行」 · [导出数据字典]
 └ .grid-scroll.tall（无高度上限）  table.grid
    #  字段名      声明类型           类型族    约束       默认值    空值        唯一值    取值分布 Top 3
    1  🔑 id      INTEGER  ← .code-inline      [整数]   [主键]     无        0 (0%)      184       —
    2     email   TEXT                        [文本]   [非空]    —          12 (1.2%)  184       "a@b.com" ×7 …
```

| 元素 | 尺寸 / 颜色 |
| --- | --- |
| `.field-name` | 13 / 600；主键图标 12px `--warn`（图形，非文本） |
| `.code-inline`（声明类型 / 默认值） | 11.5 mono · `--r-xs` · 底 `--surface-inset` · 边框 `--code-line` |
| `.type-chip` | 10.5 mono · `--r-xs`（**不是**胶囊，与语义 `.chip` 明确区分）· 每族配色见 §2.7 |
| 约束徽标 | 主键 → `.chip.is-pk`（warn-soft）；非空 → `.chip`；**可空 → `.chip`（中性灰）**，绝不用警告色 |
| `.cell-sub`（括号里的百分比） | 11 `--text-3` —— 它是辅助信息，不能和主数字抢注意力（✓ 现状正确） |
| `.top-value` | gap 6；`code` max-width 190 单行省略 + `title`；`em` 10.5 mono `--text-3` |
| 外键卡 | 5 列：本表字段 / → 引用表（`.code-inline.accent`，**7.11:1 AA**）/ 引用字段 / 更新时 / 删除时 |
| 索引卡 | 4 列：索引名 / 字段 / 唯一 / 来源（主键 / 唯一约束 / 手动创建） |
| 建表 SQL 卡 | `.code-block` 12.5/1.7；[展开/收起] + [复制] 两个 `.btn-quiet.btn-sm` |

| 状态 | 表现 |
| --- | --- |
| 默认 | 表格形式，行 hover 同 §6.6 |
| hover | 行底 `--surface-2` |
| focus-visible | 「查看字段」类按钮同 `.btn`；表格本身不加焦点（数据表不需要逐格聚焦） |
| 展开 / 收起建表 SQL | **瞬时，无高度动画**（理由见 §8） |
| 复制成功 | 按钮文案切「已复制」1600ms + **`aria-live="polite"` 的 sr-only 播报**（否则读屏用户不知道复制成功） |
| empty（无外键 / 无索引） | **不渲染整块空态**，只在对应卡片的 `.card-head` 右侧写一行 `.card-note`：「这张表没有外键约束 · SQLite 默认不强制校验」/「这张表没有索引 · 查询会走全表扫描」 |
| empty（字段为 0） | `.state.is-error`：未能读取这张表的字段定义（可能是虚拟表 VIRTUAL TABLE 或加密表）+ [看建表 SQL] |
| loading | 字段表 6 行骨架（名称条 + 两个徽标占位） |
| error（单表部分失败） | `.alert.is-warn` **位置上移到「字段结构」卡头正下方**（现状在整页最底部，用户第一眼看不到）；文案保留「这张表的部分信息未能读取：{原因}」 |

### 6.8 JsonPanel（三段状态机）

```
① 无 JSON 字段  → .state（文案已有 ✓）+ [切到别的表]
② 有字段未选    → .card-head  选择要展开的 JSON 字段 · [N 个字段 · M 个单元格] · [展开第一个 primary-sm]
                  .chip-row    字段：[payload 42] [meta 8]        ← .chip.is-clickable + <em> 计数
                  .pick-grid   auto-fill minmax(216px,1fr) · gap 8 · padding 16
                    ┌ .pick  padding 10 12 · r-md · 1px --line-1 ──┐
                    │ 第 12 行  (payload)   ← b 12.5/600 + .pick-col 10.5 mono violet │
                    │ {"sku":"A-1","qty":3}  ← .pick-snippet 11 mono --text-3 两行截断 │
                    └──────────────────────────────────────────────┘
                  .grid-bar「仅列出前 60 个单元格，共 N 个。也可以用「数据预览」里的表格直接点」
③ 已选          → .jt-bar  [路径 11.5 mono max-w 340] · [节点树｜原始文本 seg] · spacer · [搜索 216] · [复制] · [关闭]
                  .jsontree  或  .code-block
```

| 状态 | 表现 |
| --- | --- |
| `.chip.is-clickable` hover | 底 `--accent-soft` + 边框 `--accent-line` + 字 `--accent-text`（✓ 已有） |
| `.chip.is-clickable` disabled | 该字段没有可解析值时：字 `--text-4` + `aria-disabled="true"` + `cursor: not-allowed`（现状 opacity .45 ✓ 可保留，但更推荐 token 灰） |
| `.pick` hover | 底 `--accent-soft` + 边框 `--accent-line` + `translateY(-1px)`（✓ 已有）；`:active` 回 0 |
| `.pick` focus-visible | `outline: 2px solid var(--focus); outline-offset: 2px` |
| 复制 | 文案切「已复制」1600ms + `aria-live="polite"` 播报，`title` 给全文路径 |
| seg 切换（节点树↔原始文本） | 内容切换 140ms opacity，容器不位移（见 §8） |
| empty（有字段但预览无值） | `.state`「预览数据里没有可解析的 JSON 值」+ [去数据预览] |
| 搜索 0 命中 | **不整块空态**：在 `.jt-bar` 下方插一行 11.5px `.card-note`「没有节点匹配「xxx」· [清空搜索]」（树还在，只是没命中） |
| loading | `.pick-grid` 6 张骨架卡；或 `.state.is-loading` |
| error（JSON 非法） | `.state.is-error`「这个字段的值不是合法 JSON」+ [查看原始文本]（切到 raw 模式） |

### 6.9 JsonTree

```
.jsontree  role="tree" · 底 --surface-inset · 12.5 mono · line-height 1.75 · padding 12 14 · max-h 480
  ▾  root: { 5 项 }              ← .jt-toggle 15px(.jt-key --violet)(.jt-meta 11.5 --text-3)
    ▾  user: { 3 项 }
         name: "Ada"              ← .jt-string --ok     （亮 5.01:1 AA）
         age: 36                  ← .jt-number --info   （5.64:1 AA）
         vip: true                ← .jt-boolean --warn  （6.41:1 AA）
         note: null               ← .jt-null --text-3   （4.85:1 AA）
    ▸  orders: Array(120)
       [继续加载剩余 20 项]        ← .jt-more + .btn-quiet.btn-sm
```

| 项 | 规范 |
| --- | --- |
| 缩进 / 引导线 | 15px 缩进 + 1px 竖线。**把 1px dashed `--line-2` 改成 1px solid `--line-1`**：长树里虚线是持续噪音，实线更安静 |
| `.jt-toggle` | 15px 宽 mono 10px `--text-3`；hover `--accent`；**必须可聚焦**，见下方键盘规范 |
| 行高 | 19.25px（12.5 × 1.75）；单行不换行、横向溢出滚动（现状 `word-break` 由 `.jt-string` 的 `break-all` 处理，保留） |
| 分批渲染 | `CHILD_BATCH = 100` 保留；「继续加载剩余 N 项」补 `aria-label`（说明是哪个节点的剩余项） |
| 折叠 / 展开动效 | **0ms 瞬时**（理由见 §8） |

**命中高亮（必须修）**：

| Token | 亮 | 暗 | 实测 |
| --- | --- | --- | --- |
| `--hit-bg` | `#f7c948` | `#5c4a14` | ÷`--code-bg` **1.48:1 / 2.14:1** |
| `--hit-line` | `--warn` `#8a4b00` | `--warn` `#e8b168` | ÷hit-bg **4.34:1 / 4.47:1** |
| 命中行文字 | 统一 `--text-1` | 同左 | ÷hit-bg **11.65:1 / 7.59:1 AA** |

```css
.jt-node.is-hit > .jt-line {
  background: var(--hit-bg);
  box-shadow: inset 2px 0 0 var(--hit-line);   /* 非颜色的第二信号 */
  border-radius: var(--r-xs);
}
.jt-node.is-hit .jt-key,
.jt-node.is-hit .jt-string,
.jt-node.is-hit .jt-number,
.jt-node.is-hit .jt-boolean { color: var(--text-1); }   /* 命中行压掉语法着色 */
```
两条理由：① 淡黄（现状 `#fff3c4`）在近白底上不可能有足够亮度差，只有饱和黄才看得见 —— 现状实测 1.06:1 等于没做；② 命中行保留语法着色时，绿色字符串落在饱和黄上只有 4.65:1（擦线），统一压成 `--text-1` 既解决对比度，又让「命中」成为行内唯一焦点。

**键盘可达（当前是硬缺陷）**：`.jt-toggle` 现在是 `tabIndex={-1}`，**键盘用户完全无法展开任何节点**。
改法：树内 roving tabindex —— 焦点容器 `role="tree"`，每个节点 `role="treeitem" tabIndex={focused ? 0 : -1}`，焦点落在节点行上；键位：

| 键 | 行为 |
| --- | --- |
| `↑` / `↓` | 上一 / 下一可见节点 |
| `→` | 集合节点：展开；已展开则进第一个子节点 |
| `←` | 集合节点：折叠；已折叠则回父节点 |
| `Enter` / `Space` | 切换展开 / 折叠 |
| `Home` / `End` | 首 / 尾可见节点 |

同时补 ARIA：`aria-level={depth+1}`、`aria-setsize`、`aria-posinset`（同级位置），子节点容器 `role="group"`。

### 6.10 QueryPanel

```
.card  SQL 查询 · note「在内存副本上执行，不会写回你的文件」
 ├ .sql-editor  12.5 mono · min-h 104 · resize vertical · tab-size 2
 │              底 --surface-inset · 边框 --line-2 · focus --accent + --ring
 ├ .row  [执行 primary（Ctrl/⌘+Enter）] [清空 quiet-sm] note「快捷键 Ctrl / ⌘ + Enter」
 ├ .alert.is-danger（错误时 · 描述用 .mono 显示 SQLite 原文）
 └ .query-result  「返回 N 行 · M 列」 [导出 CSV]
     table.grid（max-h 380）
```

| 状态 | 表现 |
| --- | --- |
| 默认 | 编辑器空 + placeholder `SELECT * FROM 表名 LIMIT 20;`（placeholder `--text-3` 5.15:1 AA） |
| busy | 执行按钮 loading（12px 转圈 + 「执行中…」）；清空按钮 disabled；**编辑器保持可编辑**（用户趁机改下一句）；`aria-busy="true"` 标在结果区 |
| busy 时旧结果 | **不模糊、不变暗**（变暗会让用户以为数据出问题了）；只在结果区顶部加 2px `is-indeterminate` 进度条 |
| 空结果 | `.alert.is-info`「语句执行成功，但没有返回任何行」+ **追加一行提示**：「可以用 `SELECT COUNT(*) FROM 表名;` 确认是表为空还是条件太严」——现状只说"没有返回任何行"，用户分不清是没数据还是写错了 |
| 错误 | `.alert.is-danger` + `.mono` 原文（✓ 已有）+ **补一句**「这只是本次查询失败，不影响已分析的结果」 |
| loading（首次进入） | 结果区表格骨架 4 行 |
| focus-visible | 编辑器用 `--ring`（不用 outline，保持输入框形态）；按钮同 `.btn` |

**表清单速查卡**：`.pick.is-static`（无 hover 位移 ✓ 已有）；`.pick-link` 12.5/600 `--accent-text`（**8.24:1 AA**）+ hover 下划线；`.pick-toggle` 11 `--text-3` → hover `--accent-text`；`.pick-cols` 内 `.code-inline` 换行 + `max-height: 128px` 滚动（✓ 已有）。

### 6.11 Footer（`.app-foot`）

| 项 | 值 |
| --- | --- |
| 高度 | 自动（padding `7px 16px`） |
| 文字 | 11.5 `--text-3`（改 Token 后 **5.15:1 AA**；现状 `#818b9c` 只有 3.44:1） |
| 底 | `--surface` + 上 1px `--line-1` |
| 内容 | `纯前端解析 · 文件不上传` ｜ `支持 SQLite / .db / .sqlite3`（保持，不加行） |
| <860px | 隐藏（✓ 现状） |

### 6.12 加载态总规范（跨组件 —— 本次规范里最值钱的一节）

**问题**：解析大库要数秒。用户必须能一眼确认「它在干活」，而不是「它卡死了」。

**结论：三层反馈 + 一个"进度必须真的会动"的工程前提。**

| 层 | 位置 | 规格 |
| --- | --- | --- |
| L1 全局 | 顶栏 `.progress-line` | 2px 贴底边、不占高度、`role="progressbar"` + `aria-valuenow`（当前只有 role，缺 valuenow） |
| L2 阶段 | 落地页 `.dropzone-progress` / 工作区 `.state.is-loading` | 四步 checklist + 进度条 + 已用时长 |
| L3 局部 | 侧栏 3 行骨架 · 表卡片 6 张骨架 · 表格 8 行骨架 | 用 `--skeleton-*` 新色（振幅 ≥1.17:1） |

**四步阶段清单**（直接映射 `lib/sqlite.ts` 现有的 `onProgress` 文案，**不需要改 lib 的接口**）：

| `ratio` | 现有 `message` | 展示为 | 进度条类型 |
| --- | --- | --- | --- |
| 0.05 | 正在加载解析引擎… | 第 1 步 · 加载解析引擎 | **不确定**（`is-indeterminate`） |
| 0.15 | 正在打开数据库… | 第 2 步 · 打开数据库 | 确定 |
| 0.20 → 0.90 | 正在分析「orders」… | 第 3 步 · 分析表结构（显示表名 + 序号） | 确定 |
| 0.95 | 汇总结果… | 第 4 步 · 汇总结果 | 确定 |

渲染规格：
```
● 加载解析引擎          ← 已完成：✓ 11px --ok
◐ 打开数据库            ← 进行中：12px CSS 转圈 --accent，文字 --text-1
○ 分析表结构            ← 未开始：文字 --text-3
○ 汇总结果                       已用 2.4 s   ← --fs-caption --text-3 tabular-nums
▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  38%    ← .bar h4
```
- 步骤行高 22px、缩进 4px、状态图标槽宽 16px；
- **已用时长的数字必须真实累加**（`performance.now() - t0`，100ms 更新一次）—— 不许用 CSS 动画 / 假数字伪造（违反 §1.3 反向约束）；
- 第 3 步若单表耗时超过 1.5s，在表名后追加「（大表，可能较慢）」而不是换一个假百分比。

**★ 工程前提：进度必须真的动。**

`analyzeSqliteFile` 现在的让出策略是「每 5 张表 `await setTimeout(0)`」。问题：如果某张表很大（数十万行 × 20 列的抽样统计），**单张表就能阻塞主线程 1–3 秒**，浏览器期间完全无法重绘 —— 用户看到的是进度条卡住、然后直接跳到 100%（甚至先白屏几秒）。这等于 L2 层白做。

结论（改法）：把让出条件从「每 5 张表」改成「**距上次让出超过 32ms 就让出**」：

```ts
// lib/sqlite.ts —— 新增两个小工具，不引入依赖
let lastYield = 0;
async function yieldToPaint() {
  lastYield = performance.now();
  await new Promise((r) => setTimeout(r, 0));
}
async function maybeYield() {
  if (performance.now() - lastYield > 32) await yieldToPaint();
}
```
- `for (const obj of objects)` 循环里每个对象前 `await maybeYield()`（替代原来的 `i % 5 === 4`）；
- `analyzeTable` 的**列循环里**同样按 32ms 阈值 `await maybeYield()`（大表单表才切得开）；
- 副作用可控：32ms ≈ 2 帧，用户无感；总耗时增加 <3%。

**兜底**：任何真进度不可知的阶段（引擎加载、单次超大 SQL）一律切 `is-indeterminate` 扫光条，**并且不显示百分比数字**（伪造百分比 = 造假）。

---

## 7. 重点改进项（8 处，按收益排序）

### 改进 1 · 辅助文字整体不达 AA（系统性问题）

| | |
| --- | --- |
| **现状问题** | `--text-3` = `#818b9c`，除以 surface 只有 **3.44:1**、除以 surface-3 只有 **3.09:1**；暗色 `#6f7a90` 是 **4.06:1 / 4.43:1**。而它被 `.card-note` / `.kpi-foot` / `.kpi-unit` / `.main-sub` / `.card-note` / `.meta-k` / `.cell-null` / `.empty p` / 页脚 大量用于 **11.5–12.5px 的正文级文字**，全站几十处同时不合格 |
| **怎么改** | 亮色 `--text-3` → `#656e7d`（5.15 / 4.93 / 4.55 / 4.75:1，四背景全过），暗色 → `#8e97aa`（5.98 / 5.52 / 4.96 / 6.52:1）；原 `#818b9c` 降级为新增的 `--text-4`，只允许出现在图标、分隔符、禁用文字上；侧栏同步：`.sidebar-group` / `.sidebar-empty` 从 `#66708a` → `--nav-label` `#7e8aa3`（5.23:1），分组计数 `em` 从 `#5b6580` → `--nav-label`（3.13 → 5.23:1） |
| **改完什么样** | 页面观感整体"沉"了一点：注释文字从「若隐若现」变得可读；层次仍然清楚，因为 `--text-2` 与 `--text-1` 没动 |
| **为什么更好** | 一行 Token 改动一次性修掉全站几十处 AA 违规，是本次性价比最高的一处；而且修完 `placeholder`（同样用 `--text-3`）自动达标，不用单独处理 |

### 改进 2 · JSON 树键盘完全无法展开（硬缺陷）

| | |
| --- | --- |
| **现状问题** | `JsonTree.tsx` 里 `.jt-toggle` 写着 `tabIndex={-1}` —— 整个节点树只能鼠标点。键盘用户、读屏用户**拿不到这个站最核心的差异功能**（JSON 节点树），而且 `role="tree"` 写了却不符合 ARIA 交互模型（有 role 无键盘行为，比不写更容易误导读屏） |
| **怎么改** | 树内 roving tabindex：焦点落在 `.jt-line`（`role="treeitem" tabIndex={focused?0:-1}`），`↑↓` 移动、`→` 展开/进子、`←` 折叠/回父、`Enter`/`Space` 切换、`Home`/`End` 首尾；补 `aria-level` / `aria-setsize` / `aria-posinset` 与子容器 `role="group"`；`.jt-toggle` 从可聚焦元素降为纯装饰（`aria-hidden`，点击仍有效） |
| **改完什么样** | 键盘用户 Tab 到树里，方向键就能把这棵 JSON 一层层剥开；读屏会播报「user，集合，第 2 项，共 5 项，已展开」 |
| **为什么更好** | 从「键盘不可用」变成「键盘一等公民」；同时把写错一半的 ARIA 补成完整实现，避免了 role 与行为不一致的误导 |

### 改进 3 · 搜索命中高亮几乎看不见（1.06:1）

| | |
| --- | --- |
| **现状问题** | `.jt-node.is-hit > .jt-line{background:#fff3c4}` 在 `--code-bg #f8f9fb` 上实测 **1.06:1**（暗色 `#4a3c12` 是 1.70:1）。「搜关键词、命中自动展开」这个功能做了，但视觉反馈等于零；用户搜完只会觉得"页面变长了，不知道命中在哪" |
| **怎么改** | 新增 `--hit-bg`（亮 `#f7c948` / 暗 `#5c4a14`，除以 code-bg **1.48:1 / 2.14:1**）+ `--hit-line`（`--warn`，除以命中底 **4.34:1 / 4.47:1**）；`.is-hit` 内所有语法色统一压成 `--text-1`（除以命中底 **11.65:1 / 7.59:1**）；加 `box-shadow: inset 2px 0 0 var(--hit-line)` 作为非颜色的第二信号 |
| **改完什么样** | 命中行是一块饱和琥珀色横条 + 左侧深色竖线，扫一眼就能定位；同时命中行内的语法着色让位，焦点唯一 |
| **为什么更好** | 淡黄在近白底上不管怎么调都不可能有足够亮度差 —— 必须用饱和度换可见度；压掉命中行的语法色同时顺手解决了「绿色字符串落在饱和黄上只有 4.65:1」的擦线问题 |

### 改进 4 · 解析进度"不会动"（L2 层反馈白做）

| | |
| --- | --- |
| **现状问题** | 两处叠加：① `analyzeSqliteFile` 每 5 张表才 `await setTimeout(0)`，**单张大表的抽样统计可阻塞主线程 1–3 秒**，浏览器期间无法重绘 → 进度条卡住再跳 100%；② UI 侧只有一行文案 + 百分比，没有阶段感、没有耗时，用户无法判断"还剩多久 / 是不是卡死了" |
| **怎么改** | 引擎侧：按「距上次让出 >32ms 就让出」替换「每 5 张表让出」，列循环里同样处理（抽 `maybeYield()`，零依赖）；UI 侧：四步阶段清单（加载引擎 / 打开库 / 分析表结构（带表名 + 序号）/ 汇总）+ 真实累加的已用时长 + 每次出现预留 `min-height: 52px` 防跳动 |
| **改完什么样** | 大库解析时进度条以约 30fps 平滑推进，第 3 步能看到「正在分析「orders」(7/23)」，秒表在走；小于 1 秒的库仍是一闪而过，不啰嗦 |
| **为什么更好** | 这是"纯前端解析"这个卖点的信任成本所在 —— 用户能看见过程中发生了什么，才会相信"文件真的在这台机器上被读了"，而不是"它是不是偷偷上传了" |

### 改进 5 · 表格没有最小宽度，窄屏把列压成竖排

| | |
| --- | --- |
| **现状问题** | `table.grid{width:100%}` 没有 `min-width`。20 列的宽表在 1100px 视口里只剩每列 ~40px，`word-break:break-word` 会把一个字段名拆成「ord / ers」竖着排；`max-width:380px` 只约束了最大值，管不了最小 |
| **怎么改** | `table.grid{min-width:640px}`；`<768px` 时首列 `#` 与第二列 `position:sticky; left:0 / 46px` + `box-shadow:1px 0 0 var(--line-1)` 做接缝；`.grid-scroll` 已有 `overflow:auto`，直接产出横向滚动 |
| **改完什么样** | 窄屏下表格横向滚动，列宽保持可读；滚动时行号与第一个字段一直贴在左边，不会"滚丢了这是哪一行" |
| **为什么更好** | 数据表格的最小可用宽度是硬约束：宁可横向滚动，也不要"每列都能看见但一个字都读不了" |

### 改进 6 · 侧栏选中行的行数与标签糊掉

| | |
| --- | --- |
| **现状问题** | 选中行底 `#262f47` 上，行数 `#7b859c` 只有 **3.59:1**（未选中时 4.91:1 是够的）；行内 `.tag` 底 `#212940` 与选中行底 `#262f47` 分离度只有 **1.09:1**，标签视觉上"融进"了行底 |
| **怎么改** | 新增 `--nav-count-active`（亮 `#b8c2d6` **6.79:1** / 暗 `#9aa9c0`）；选中行内 `.tag` 底改 `#35406a`；选中行加 `box-shadow: inset 2px 0 0 var(--accent)`；未选中行行数改用 `--nav-count` `#8b95a9`（6.03:1） |
| **改完什么样** | 选中行左边一条 2px 紫线，行数明显更亮，标签有清晰的底块 —— 三个信号（位置 / 亮度 / 底块）同时指向"这行是当前表" |
| **为什么更好** | 侧栏是这个站唯一的导航，选中态是最高频的视觉判断。修完之后「我现在在哪张表」不再需要靠回忆 |

### 改进 7 · 空态只有解释，没有出口；而且有三套空态样式并存

| | |
| --- | --- |
| **现状问题** | ① 全站 5 处空态（空库 / 空表 / 无 JSON / JSON 无值 / 搜索无结果）文案都不错，但**没有一个给出下一步动作**，用户读完只能自己找路；② `.empty`（44px 图标 + 12px 圆角）、`.alert.is-warn`、`.sidebar-empty` 三套风格各写各的，圆角/内边距/字号都不一致；③ 「没有外键」「没有索引」直接不渲染，导致字段页在缺少关系时显得"没读出来" |
| **怎么改** | 抽出 `.state`（空 / 加载 / 错误 / 提示四个变体，`52px 22px` padding、`44×44 + --r-xl` 图标、标题 13.5、说明 12.5 `--text-3`、动作区）；逐场景配好动作按钮（见 §6.1.5 表）；「没有外键 / 没有索引」改用卡片头一行 `.card-note` 表达 |
| **改完什么样** | 任何一处空态都是「一句结论 + 一句解释 + 一个按钮」，用户不会卡在空白页上；三套空态归一为一套，圆角与间距对齐 4n 栅格 |
| **为什么更好** | 这个站被打开的场景是「我手上有个不知道是什么的 .db」，空态出现频率极高；一句"这张表没有外键约束"比一整块留白更能建立"它真的读完了"的信任 |

### 改进 8 · 禁用态与深色面板焦点环

| | |
| --- | --- |
| **现状问题** | ① 禁用态统一用 `opacity: .5`，实测把 `--text-1` 压到 **3.46:1** —— 虽然 WCAG 豁免禁用控件，但工具站的禁用态本身是信息（"下一步"为什么不能点）；② `:focus-visible{outline:2px solid var(--accent)}` 在顶栏深色底 `#111524` 上只有 **3.38:1**，而顶栏是键盘用户最先 Tab 到的地方 |
| **怎么改** | 禁用态改 token 灰（底 `--surface-3` / 字 `--text-4` / 边框 `--line-2`）+ `aria-disabled="true"`（保留可聚焦，读屏能解释为什么不可用）；新增 `--focus-on-dark: #a5a5ff`，顶栏与侧栏内所有焦点环改用它（除以 `#111524` **8.15:1**、除以暗色侧栏 `#080a11` **8.88:1**） |
| **改完什么样** | 禁用按钮是一块干净的浅灰，文字仍然清楚；顶栏的焦点环是亮紫色，任何背景下都能一眼找到焦点位置 |
| **为什么更好** | 焦点可见性是键盘可用性的前提 —— 看不见焦点等于键盘不可用；禁用态用真实颜色而不是透明度，还能顺带避免"半透元素叠在彩色背景上颜色发脏"的老问题 |

---

## 8. 动效规范

### 8.1 缓动曲线（只允许这三条，不许多写）

| Token | 值 | 用途 |
| --- | --- | --- |
| `--ease-std` | `cubic-bezier(0.2, 0, 0, 1)` | 状态色变化（hover / focus / 禁用） |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 位移、抬升、进度条推进（起步快、收尾稳） |
| `--ease-inout` | `cubic-bezier(0.4, 0, 0.2, 1)` | 透明度、主题过渡 |

禁用：`ease`、`ease-in`、`linear`（仅 shimmer 例外）、任何参数 <0 或 >1 的自定义曲线、`spring` 类回弹。

### 8.2 时长表

| 场景 | 时长 | 缓动 | 属性 | 说明 |
| --- | --- | --- | --- | --- |
| hover（底 / 边框 / 文字色） | **120ms** | `--ease-std` | background-color, border-color, color, box-shadow | 现状 0.15s / 0.12s / 0.14s / 0.18s 混用 → 一律 120ms |
| 卡片 hover 抬升（`.table-card` / `.pick`） | **160ms** | `--ease-out` | transform, box-shadow | 只有这两类可点击卡片允许位移 |
| 面板 / Tab 内容切换 | **140ms** | `--ease-inout` | opacity | 容器不位移，只淡入内容 |
| 进度条推进（确定进度） | **240ms** | `--ease-out` | width | 落后于真实进度再追上，视觉上更"跟手" |
| 进度条（不确定阶段） | **1.4s 循环** | `linear` | transform: translateX | 引擎加载 / 超大查询 |
| 骨架屏 shimmer | **1.6s 循环** | `linear` | background-position | 振幅由 `--skeleton-*` 保证 |
| 拖拽遮罩进入 | **120ms** | `--ease-out` | opacity | 退出 **0ms**（立即消失，避免"遮罩卡住"） |
| 复制成功反馈 | **160ms 淡入 → 1600ms 后还原** | `--ease-inout` | opacity, color | 按钮文案「复制」→「已复制」 |
| 主题切换 | **200ms** | `--ease-inout` | background-color, color, border-color | 只过渡这三个，不做 `all` |
| 按钮按下（`:active`） | **0ms** | — | 所有 transform | 见下方禁令 |
| 骨架 → 内容替换 | **0ms** | — | — | 瞬时，避免"内容在长出来"的错觉 |
| 折叠 / 展开（JSON 树、建表 SQL、字段清单、窄屏侧栏滑条） | **0ms** | — | — | 见下方禁令 |

### 8.3 必须**没有**动效的地方（明确禁令）

1. **数据表格的行 hover 与选中** —— 只换底色，不许位移、缩放、描边动画（行在"动"会让人误以为数据在变）。
2. **JSON 树节点的展开 / 折叠** —— 大 DOM 树做高度动画必掉帧，且瞬时切换更符合仪器感。
3. **表格分页切换、Tab 内容切换时的容器位移** —— 只允许内容 `opacity` ≤140ms；容器本身不许有 transform / margin 变化。
4. **跟随鼠标 / 拖拽的元素**（`.drop-overlay-card`、`.dropzone.is-over`）—— 一个 transition 都不能有，否则产生跟手延迟；`.dropzone.is-over` 的 `translateY(-2px)` 现状必须删掉。
5. **loading 骨架** —— 只有亮度流动，不许位移 / 缩放 / 旋转（旋转留给按钮内 12px 转圈）。
6. **所有 `:active` 态的 transform** —— 按下去不许"弹"，只能靠底色加深 + 内阴影。
7. **侧栏选中态切换** —— 不许有滑动指示条动画（键盘上下键连续切换时，滑动的指示条会拖影）。
8. **破坏性操作（换个文件 / 清空 SQL）** —— 不加确认动画；确认用就地文案切换，不用弹窗。

### 8.4 `prefers-reduced-motion`

保留现有全局规则（`transition-duration: .001ms` / `animation-duration: .001ms` / `animation-iteration-count: 1`），并**追加两条**：

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background: var(--skeleton-base); }        /* 静态灰块，不做流动 */
  .bar.is-indeterminate span { animation: none; width: 100%; opacity: .45; } /* 静态满条，不扫光 */
}
```
理由：`animation-duration: .001ms` 只是把动画压缩到看不见，但在部分浏览器/显示器上会退化成高频闪烁，比不动更难受。这两处改成静态最安全。

---

## 9. 无障碍检查清单

标注：✓ 已达标 ｜ △ 部分达标（需补） ｜ ✗ 未达标（必修）

### A. 对比度

| # | 要求 | 现状 | 动作 |
| --- | --- | --- | --- |
| A1 | 正文（<18.5px）≥4.5:1 | ✗ `--text-3` 亮 3.44 / 暗 4.06；侧栏分组 3.67 / 3.13；选中行行数 3.59 | 改进 1、6（P0） |
| A2 | 大字（≥18.5px 或 ≥14px bold）≥3:1 | ✓ 主区标题 19px/600 用 `--text-1` = 18.25:1 | 无 |
| A3 | 非文本（图标 / 边框 / 焦点环 / 图形）≥3:1 | △ 图标 `--accent` 5.37:1 ✓；**顶栏焦点环 3.38:1** 擦线 | `--focus-on-dark`（P0） |
| A4 | 状态不靠颜色单独表达 | △ 类型徽标带文字 ✓；命中高亮只靠色 ✗；选中行只靠色 △ | `--hit-line` 左线 + `inset 2px accent`（P0） |
| A5 | placeholder ≥4.5:1 | ✗ 3.44:1 | 随 A1 自动修复 |
| A6 | 禁用态文字（豁免，但尽量可读） | ✗ opacity .5 等效 3.46:1 | 改进 8（P0） |
| A7 | 骨架屏可辨识 | ✗ 振幅 1.05:1 看起来是静止灰块 | `--skeleton-*`（P1） |

### B. 焦点可见

| # | 要求 | 现状 | 动作 |
| --- | --- | --- | --- |
| B1 | 所有可交互元素有可见焦点 | △ 全部有 `:focus-visible` ✓，但输入框用 `:focus` 覆盖掉 outline（改以 `border + --ring` 表达，判定可接受） | 保持，`--ring` 对比度 5.37:1 |
| B2 | 焦点环不被裁切 | ✗ 表格单元格、满宽侧栏行的正 offset 描边会被 `overflow` 裁掉 | `outline-offset: -2px`（P0） |
| B3 | 深色面板内用亮色焦点环 | ✗ 顶栏 3.38:1 | `--focus-on-dark`（P0） |
| B4 | 焦点顺序与视觉顺序一致 | ✓ DOM 顺序即视觉顺序 | 无 |
| B5 | 焦点不因 disabled 丢失 | △ 用 `aria-disabled` 而非 `disabled` 的元素保持可聚焦 | 统一（P1） |

### C. 键盘

| # | 要求 | 现状 | 动作 |
| --- | --- | --- | --- |
| C1 | 全功能键盘可达 | ✗ JSON 树折叠按钮 `tabIndex={-1}`，键盘无法展开任何节点 | 改进 2（P0） |
| C2 | Tab 组件符合 ARIA APG | ✗ 5 个 Tab 都可 Tab 到，但 `←` `→` 不切换（APG 要求 roving tabindex + 方向键） | App.tsx + styles.css（P0） |
| C3 | 快捷键不冲突 | △ 已有 `Ctrl/⌘+Enter` | 补：`/` 聚焦侧栏搜索、`1–5` 切 Tab、`Esc` 关闭 JSON 预览；**不占用** `Ctrl/⌘+F`、`Ctrl/⌘+P` |
| C4 | 分页 / 工具条键盘可达 | ✓ 原生 button + select | 无 |
| C5 | 拖拽区键盘可用 | ✓ `role="button"` + `tabIndex` + Enter/Space | 无 |
| C6 | 无键盘陷阱、无 skip 缺失 | ✓ 无陷阱；△ 缺 skip-link（内容层级浅，可不加） | 不加 |

### D. 屏幕阅读器语义（三种复杂结构分别给建议）

**D1 · 数据表格（`DataGrid` / `SchemaSection` / `QueryPanel`）**

| 项 | 现状 | 动作 |
| --- | --- | --- |
| `<caption class="sr-only">` | ✓ 已有，含表名 + 行数 + 当前页 | 保持 |
| `th scope="col"` | ✓ 已有 | 保持 |
| 表头在 sticky 时的语义 | ✓ sticky 是视觉行为，不影响语义 | 保持 |
| **行数播报不一致** | ✗ 表格渲染 25 行但数据有 200 行，读屏只报 25 行 | 加 `aria-rowcount={rows.length}` + 每行 `aria-rowindex={absoluteRow+1}`（P1） |
| JSON 单元格可交互 | ✗ 用 `onClick` 挂在 `<td>` 上，键盘与读屏都拿不到 | 改成 `<td><button role="button">` 或给 td 加 `tabIndex={0} role="button" aria-label="第 3 行 payload 字段，查看 JSON 节点树"`（P1） |
| 可排序列 | 无排序功能 | 不加 `aria-sort`（没功能不要加属性） |
| 空表格 | ✓ `.state` 会在表格位置替换 | 保持 |

**D2 · Tab 导航（`App.tsx`）**

| 项 | 现状 | 动作 |
| --- | --- | --- |
| `role="tablist" aria-label="视图切换"` | ✓ 已有 | 保持 |
| `role="tab"` + `aria-selected` + `aria-controls` | ✓ 已有 | 保持 |
| `role="tabpanel"` + `aria-labelledby` | ✓ 已有 | 保持 |
| **roving tabindex** | ✗ 5 个 Tab 全在 Tab 序里 | 只有当前 Tab `tabIndex={0}`，其余 `-1`；`←→` 切换、`Home/End` 首尾、激活即切换（`aria-selected` 跟随焦点） |
| **面板可聚焦** | ✗ | `tabpanel` 加 `tabIndex={0}`，让 Tab 键从 Tab 条直接进入内容 |
| **计数播报** | △ `.tab-count` 是独立 span | 合并进按钮文本或 `aria-label`：「JSON 节点，5」 |

**D3 · JSON 树（`JsonTree`）**

| 项 | 现状 | 动作 |
| --- | --- | --- |
| `role="tree"` / `role="treeitem"` | ✓ 已有 | 保持 |
| `aria-expanded` | ✓ 已有（仅集合节点） | 保持 |
| `aria-level` / `aria-setsize` / `aria-posinset` | ✗ | 全部补上（读屏才能播报「第 2 项，共 5 项」） |
| 子节点容器 | ✗ | 加 `role="group"` |
| 键盘 | ✗ | 见 C1 |
| 折叠按钮语义 | ✗ `tabIndex={-1}` 但仍是 `<button>`，读屏仍会念它 | 改为 `aria-hidden="true"` + `tabIndex={-1}` 的纯视觉控制，展开状态由 `treeitem` 的 `aria-expanded` 承担 |
| 命中数播报 | ✗ 搜索后有多少命中完全没播报 | 补 `aria-live="polite"` 播报「找到 7 个匹配节点」 |

**D4 · 动态状态统一播报（新增一个 `.sr-live` 区域）**

| 需要播报的事件 | 文案 |
| --- | --- |
| 解析阶段变化 | 「正在分析「orders」，第 7 张，共 23 张」 |
| 解析完成 | 「分析完成：23 张表，7 个 JSON 字段，耗时 2.4 秒」 |
| 复制成功 | 「已复制到剪贴板」 |
| 搜索命中 | 「找到 7 个匹配节点」/「没有匹配」 |
| 切换表 | 「已切换到表 orders，1 284 行，12 个字段」 |
| 主题切换 | 「已切换到暗色主题」 |

实现：`<div class="sr-live" role="status" aria-live="polite" aria-atomic="true">`，全局唯一，放 `App.tsx` 根部；`.sr-live` 用现有 `.sr-only` 样式。**注意不要给每个组件各加一个 live region**（多个 live region 会互相打断）。

**D5–D9 · 其它**

| # | 项 | 现状 | 动作 |
| --- | --- | --- | --- |
| D5 | 错误播报 | ✓ `.alert.is-danger role="alert"` | 保持 |
| D6 | 图标装饰化 | ✓ `Icons.tsx` 全部 `aria-hidden` + `focusable="false"` | 保持（这块做得很好） |
| D7 | 语言 | ✓ `lang="zh-CN"` | 保持 |
| D8 | 标题层级 | ✓ 主区 h1 + 卡片 h2 | 保持 |
| D9 | `title` 不作唯一信息源 | △ 侧栏「字段 xxx」把 3 个命中字段名塞进 `title`、表名截断也只靠 `title` | 命中字段改为可见标签或 `aria-label` 展开（P1） |
| D10 | 文件输入有可访问名 | △ `input[hidden]` 由按钮触发 | 给 input 加 `aria-label="选择数据库文件"`（P1） |
| D11 | 图表替代文本 | 不适用（全站无图表） | — |

### E. 触控与缩放

| # | 要求 | 现状 | 动作 |
| --- | --- | --- | --- |
| E1 | 触控目标 ≥44×44 | ✗ 分页按钮 28×26、`.tag` 高 16、`.jt-toggle` 15×15 | `@media (pointer:coarse)` 下：分页按钮 44×44、行高加大、`.jt-toggle` 命中区扩到 44×44（用伪元素放大点击区，不改视觉尺寸） |
| E2 | 200% 文字缩放不破版 | △ `100dvh` + 内部滚动 ✓；需复核固定高度元素（`.grid-scroll max-height`、`.jsontree max-height`） | 把固定 `max-height` 改为 `min(460px, 60vh)` 形式，缩放时不至于只剩两行 |
| E3 | 横向滚动只发生在表格/代码块内 | ✓ `.grid-scroll` / `.code-block` | 加 `min-width` 后确认页面本身不横向滚动 |

### F. 动效偏好

| # | 要求 | 现状 | 动作 |
| --- | --- | --- | --- |
| F1 | 尊重 `prefers-reduced-motion` | ✓ 全局已有 | 补 shimmer / indeterminate 静态化（§8.4） |
| F2 | 无自动播放、无闪烁 | ✓ | 保持 |
| F3 | 无超 3 次/秒闪烁 | ✓ | 保持 |

---

## 10. 实施优先级

### P0 · 必做（不做就等于没达标，或存在真实缺陷）

| # | 改什么 | 动哪些文件 |
| --- | --- | --- |
| P0-1 | 修 `--text-3`（亮 `#656e7d` / 暗 `#8e97aa`）、新增 `--text-4`、侧栏 `--nav-label` / `--nav-count` / `--nav-count-active`（一次性修掉 A1/A5/A6） | `src/styles.css` |
| P0-2 | JSON 树键盘可达：roving tabindex + `↑↓←→` + `aria-level/setsize/posinset` + `role="group"` | `src/components/JsonTree.tsx`、`src/styles.css` |
| P0-3 | 命中高亮换 `--hit-bg` / `--hit-line`，`.is-hit` 内语法色压成 `--text-1` | `src/styles.css` |
| P0-4 | 进度"真的会动"：`maybeYield()` 32ms 让出 + 四步阶段清单 + 真实耗时 | `src/lib/sqlite.ts`、`src/App.tsx`、`src/components/TopBar.tsx`、`src/components/DropZone.tsx` |
| P0-5 | `table.grid{min-width:640px}` + 窄屏首两列粘性固定 | `src/styles.css` |
| P0-6 | Tab 键盘模型：roving tabindex + `←→` / `Home` / `End` + `tabpanel tabIndex={0}` | `src/App.tsx`、`src/styles.css` |
| P0-7 | 禁用态去 `opacity` 改 token 灰；新增 `--focus-on-dark` 并替换顶栏/侧栏焦点环；表格与满宽行 `outline-offset: -2px` | `src/styles.css` |

### P1 · 应做（体感与一致性提升，成本可控）

| # | 改什么 | 动哪些文件 |
| --- | --- | --- |
| P1-1 | 抽出 `.state` 统一空/加载/错误/提示四态，并按 §6.1.5 表逐场景补「下一步动作」；「无外键/无索引」改为一行 `.card-note` | `src/styles.css`、`App.tsx`、`OverviewPanel.tsx`、`JsonPanel.tsx`、`DataGrid.tsx` |
| P1-2 | 骨架屏换 `--skeleton-base` / `--skeleton-sheen`（振幅 1.17 / 1.29:1），侧栏/表卡片/表格三处接上 | `src/styles.css` |
| P1-3 | 断点体系整理（1440 / 1080 / 860 / 640）：KPI 固定列数规则、Tab 条横滑 + 渐隐、主区 `--content-max` 1400 居中、窄屏顶栏统计搬到信息卡 | `src/styles.css`、`TopBar.tsx`、`OverviewPanel.tsx` |
| P1-4 | 布尔类型独立配色：新增 `--t-bool-*`，补 `.type-chip.t-boolean` 规则 | `src/styles.css` |
| P1-5 | 单表警告上移到「字段结构」卡头下方；复制成功加 `.sr-live` 播报 | `src/components/SchemaSection.tsx`、`JsonPanel.tsx`、`App.tsx` |
| P1-6 | 数据表格加 `aria-rowcount` / `aria-rowindex`；JSON 单元格改可聚焦 `role="button"` + `aria-label` | `src/components/DataGrid.tsx` |
| P1-7 | 加统一 `.sr-live` 播报区（解析阶段/完成/复制/命中数/切表/主题） | `src/App.tsx`、`src/styles.css` |
| P1-8 | SQL 空结果/错误补「下一步」（`COUNT(*)` 验证、说明不影响已分析结果） | `src/components/QueryPanel.tsx` |
| P1-9 | 触控目标：`@media (pointer:coarse)` 下分页按钮 44×44、`.jt-toggle` 用伪元素扩点击区；固定 `max-height` 改 `min(x, 60vh)` | `src/styles.css` |

### P2 · 可选（有余力再做，不影响达标）

| # | 改什么 | 动哪些文件 |
| --- | --- | --- |
| P2-1 | 主题切换 200ms 颜色过渡（只过渡 background-color / color / border-color） | `src/styles.css` |
| P2-2 | 表格首列 sticky（宽屏也保留）+ 列宽拖拽 | `src/components/DataGrid.tsx`、`src/styles.css` |
| P2-3 | SQL 编辑器行号 gutter（手写 `<pre>` 镜像，零依赖）+ 关键字简单高亮 | `src/components/QueryPanel.tsx`、`src/styles.css` |
| P2-4 | 打印样式（`.main-body` 单栏、去阴影、黑字白底），让"另存为 PDF"能当报告用 | `src/styles.css` |
| P2-5 | 空库 / 损坏库 / 加密库的落地页文案分流（现在是同一个 alert） | `src/App.tsx`、`src/components/DropZone.tsx` |
| P2-6 | 数据库信息卡补「文件指纹」（前 16 字节 SHA-1 手写实现），便于用户核对自己看的是哪个文件 | `src/lib/sqlite.ts`、`src/components/OverviewPanel.tsx` |

---

## 附录 A · 可直接粘贴的 Token 层

> 把现有 `:root` 与 `:root[data-theme='dark']` 两个块整体替换为下面内容（token 名保持与现状兼容：`--nav-bg` / `--code-bg` 等旧名继续存在，只改值 + 追加新 token，组件层不需要大改）。

```css
/* ============================ 亮色 ============================ */
:root {
  /* 画布与表面 */
  --canvas: #f4f6f9;
  --surface: #ffffff;
  --surface-2: #f9fafc;
  --surface-3: #eef1f6;
  --surface-inset: #f7f8fb;

  /* 文字 */
  --text-1: #0f1522;
  --text-2: #4a5464;
  --text-3: #656e7d;   /* ← 由 #818b9c 改为达标色（5.15:1 AA） */
  --text-4: #9aa2b1;   /* 新增：仅装饰/禁用，不得承载文字 */
  --text-inv: #ffffff;

  /* 边框 */
  --line-1: #e6e9ef;
  --line-2: #d3d8e2;
  --line-3: #b3bbc9;

  /* 品牌 */
  --accent: #5b5bd6;
  --accent-hover: #4b4bc4;
  --accent-soft: #ededfc;
  --accent-line: #c9c9f5;
  --accent-text: #3f3fb0;
  --brand-gradient: linear-gradient(140deg, #6366f1 0%, #4f46e5 45%, #06b6d4 100%);

  /* 焦点 */
  --focus: #5b5bd6;
  --focus-on-dark: #a5a5ff;   /* 新增：深色面板内用 */

  /* 侧栏（两套主题下都保持深色面板） */
  --nav-bg: #111524;
  --nav-bg-2: #1a2133;
  --nav-active: #2b3550;
  --nav-line: #242b3e;
  --nav-text: #9aa5ba;
  --nav-text-strong: #f0f3f8;
  --nav-count: #8b95a9;
  --nav-count-active: #b8c2d6;  /* 新增：选中行行数 6.79:1 AA */
  --nav-label: #7e8aa3;         /* 新增：分组标题 5.23:1 AA */
  --nav-input-border: #39425c;
  --nav-tag-bg: #222a40;
  --nav-tag-fg: #9fabc0;
  --nav-tag-active-bg: #35406a;

  /* 语义 */
  --ok: #0b7a5a;      --ok-soft: #e6f6f0;      --ok-line: #bfe6d8;
  --warn: #8a4b00;    --warn-soft: #fdf3e4;    --warn-line: #f0dab2;
  --danger: #b3261e;  --danger-soft: #fdedec;  --danger-line: #f3cbc8;
  --info: #175cd3;    --info-soft: #eaf1fd;    --info-line: #c9ddf7;
  --violet: #6d28d9;  --violet-soft: #f3edfe;  --violet-line: #ddd0fb;

  /* 字段类型族 */
  --t-int-bg: #e9f1fd;      --t-int-fg: #175cd3;     --t-int-line: #c9ddf7;
  --t-real-bg: #e6f5fa;     --t-real-fg: #0a6b8a;    --t-real-line: #bcdff0;
  --t-text-bg: #e6f6f0;     --t-text-fg: #0b7a5a;    --t-text-line: #bfe6d8;
  --t-json-bg: #f3edfe;     --t-json-fg: #6d28d9;    --t-json-line: #ddd0fb;
  --t-time-bg: #fdf3e4;     --t-time-fg: #8a4b00;    --t-time-line: #f0dab2;
  --t-blob-bg: #eef1f6;     --t-blob-fg: #4a5464;    --t-blob-line: #d3d8e2;
  --t-bool-bg: #eaf7f4;     --t-bool-fg: #0f766e;    --t-bool-line: #c3e6e0;  /* 新增族 */
  --t-unknown-bg: #eef1f6;  --t-unknown-fg: #4a5464; --t-unknown-line: #d3d8e2;

  /* 代码区 / JSON 树 */
  --code-bg: #f7f8fb;
  --code-line: #e6e9ef;
  --hit-bg: #f7c948;     /* ← 由 #fff3c4 改为可见色（÷code-bg 1.48:1） */
  --hit-line: #8a4b00;

  /* 骨架屏 */
  --skeleton-base: #e4e9f1;
  --skeleton-sheen: #f8fafc;

  /* 圆角 */
  --r-xs: 4px; --r-sm: 6px; --r-md: 9px; --r-lg: 13px; --r-xl: 16px; --r-full: 999px;

  /* 阴影 */
  --sh-1: 0 1px 2px rgba(15, 21, 34, .05);
  --sh-2: 0 2px 8px rgba(15, 21, 34, .06);
  --sh-3: 0 12px 32px rgba(15, 21, 34, .10);
  --ring: 0 0 0 3px var(--accent-soft);

  /* 字体 */
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo,
    Consolas, monospace;

  /* 字号阶梯 */
  --fs-display: 22px; --fs-h1: 19px; --fs-h2: 13.5px; --fs-metric: 23px;
  --fs-body: 14px; --fs-body-sm: 13px; --fs-data: 12.5px; --fs-data-sm: 12px;
  --fs-caption: 11.5px; --fs-micro: 10.5px; --fs-badge: 10px;

  /* 间距 */
  --sp-1: 2px;  --sp-2: 4px;  --sp-3: 6px;  --sp-4: 8px;  --sp-5: 10px;
  --sp-6: 12px; --sp-7: 14px; --sp-8: 16px; --sp-9: 20px; --sp-10: 24px;
  --sp-11: 32px; --sp-12: 40px; --sp-13: 52px;

  /* 缓动 */
  --ease-std: cubic-bezier(.2, 0, 0, 1);
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-inout: cubic-bezier(.4, 0, .2, 1);

  /* 布局 */
  --bar-h: 58px;
  --nav-w: 268px;
  --content-max: 1400px;

  --overlay: rgba(244, 246, 249, .82);
}

/* ============================ 暗色 ============================ */
:root[data-theme='dark'] {
  --canvas: #0c0f18;
  --surface: #141926;
  --surface-2: #1a2032;
  --surface-3: #212840;
  --surface-inset: #0f1420;

  --text-1: #eef1f7;
  --text-2: #a3adc0;
  --text-3: #8e97aa;   /* ← 由 #6f7a90 改为达标色（5.98:1 AA） */
  --text-4: #69738a;
  --text-inv: #0c0f18;

  --line-1: #232b3e;
  --line-2: #303a52;
  --line-3: #3d4864;

  --accent: #8b8bf0;
  --accent-hover: #9c9cf5;
  --accent-soft: #221f45;
  --accent-line: #3b3673;
  --accent-text: #b6b6ff;

  --focus: #a5a5ff;
  --focus-on-dark: #a5a5ff;

  --nav-bg: #080a11;
  --nav-bg-2: #12161f;
  --nav-active: #232c45;
  --nav-line: #1e2637;
  --nav-text: #8b95a9;
  --nav-text-strong: #f4f6fa;
  --nav-count: #9aa9c0;
  --nav-count-active: #9aa9c0;
  --nav-label: #7a8499;
  --nav-input-border: #283247;
  --nav-tag-bg: #1e2637;
  --nav-tag-fg: #9aa9c0;
  --nav-tag-active-bg: #2c3654;

  --ok: #4ed4a4;      --ok-soft: #10291f;      --ok-line: #1d4a37;
  --warn: #e8b168;    --warn-soft: #2a2110;    --warn-line: #4b3a18;
  --danger: #f08d86;  --danger-soft: #2c1614;  --danger-line: #522723;
  --info: #7cb3f5;    --info-soft: #121f33;    --info-line: #1f3a5c;
  --violet: #b79bf7;  --violet-soft: #221a38;  --violet-line: #3e2f63;

  --t-int-bg: #12213a;     --t-int-fg: #90c2fb;     --t-int-line: #23395c;
  --t-real-bg: #0f2530;    --t-real-fg: #6fd0ec;    --t-real-line: #1d4457;
  --t-text-bg: #10291f;    --t-text-fg: #5fd9ad;    --t-text-line: #1e4a38;
  --t-json-bg: #221a38;    --t-json-fg: #c4a8ff;    --t-json-line: #3e2f63;
  --t-time-bg: #2a2110;    --t-time-fg: #eec27f;    --t-time-line: #4b3a18;
  --t-blob-bg: #1c2233;    --t-blob-fg: #a3adc0;    --t-blob-line: #313a52;
  --t-bool-bg: #0e2a2a;    --t-bool-fg: #6fd8cd;    --t-bool-line: #1b4a48;
  --t-unknown-bg: #1c2233; --t-unknown-fg: #a3adc0; --t-unknown-line: #313a52;

  --code-bg: #0f1420;
  --code-line: #232b3e;
  --hit-bg: #5c4a14;
  --hit-line: #e8b168;

  --skeleton-base: #1c2233;
  --skeleton-sheen: #2b3450;

  --sh-1: 0 1px 2px rgba(0, 0, 0, .40);
  --sh-2: 0 2px 8px rgba(0, 0, 0, .45);
  --sh-3: 0 12px 32px rgba(0, 0, 0, .55);

  --overlay: rgba(12, 15, 24, .82);
}
```

### 附录 A-2 · 新增/修改的组件片段（照抄即可）

```css
/* 1) 命中高亮：饱和底 + 左线 + 命中行压掉语法色 */
.jt-node.is-hit > .jt-line {
  background: var(--hit-bg);
  box-shadow: inset 2px 0 0 var(--hit-line);
  border-radius: var(--r-xs);
}
.jt-node.is-hit .jt-key,
.jt-node.is-hit .jt-string,
.jt-node.is-hit .jt-number,
.jt-node.is-hit .jt-boolean { color: var(--text-1); }

/* 2) 树缩进引导线：虚线 → 实线（长树里虚线是持续噪音） */
.jt-node { border-left: 1px solid var(--line-1); }

/* 3) 骨架屏：振幅从 1.05:1 提到 1.17:1 */
.skeleton {
  background: linear-gradient(90deg,
    var(--skeleton-base) 25%, var(--skeleton-sheen) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}

/* 4) 侧栏选中行：非颜色的第二信号 + 行数/标签分别处理 */
.tbl-item.is-active {
  background: var(--nav-active);
  box-shadow: inset 2px 0 0 var(--accent);
  color: var(--nav-text-strong);
}
.tbl-item.is-active .tbl-count { color: var(--nav-count-active); }
.tbl-item.is-active .tag        { background: var(--nav-tag-active-bg); }
.tbl-item .tbl-count            { color: var(--nav-count); }
.sidebar-group                  { color: var(--nav-label); }
.sidebar-group em               { color: var(--nav-label); font-weight: 500; }
.sidebar-empty                  { color: var(--nav-label); }

/* 5) 焦点环：深色面板内换亮色；表格/满宽行用负偏移防裁切 */
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.topbar :focus-visible,
.sidebar :focus-visible { outline-color: var(--focus-on-dark); }
.table-card:focus-visible,
.pick:focus-visible { outline-offset: 2px; }
.tbl-item:focus-visible,
table.grid td[role='button']:focus-visible { outline-offset: -2px; }

/* 6) 禁用态：token 灰，不用 opacity */
.btn:disabled, .pager-btn:disabled, .chip.is-clickable:disabled {
  opacity: 1;
  background: var(--surface-3);
  border-color: var(--line-2);
  color: var(--text-4);
  cursor: not-allowed;
}
.btn-primary:disabled { background: var(--surface-3); color: var(--text-4); }

/* 7) 表格最小可用宽度 */
table.grid { min-width: 640px; }

/* 8) 统一三态组件 */
.state {
  padding: var(--sp-13) 22px;
  max-width: 520px;
  margin: 0 auto;
  text-align: center;
  color: var(--text-2);
}
.state-mark {
  width: 44px; height: 44px; margin: 0 auto 14px;
  display: grid; place-items: center;
  border-radius: var(--r-xl);
  background: var(--surface-3); color: var(--text-3);
}
.state-title { display: block; font-size: var(--fs-h2); font-weight: 600;
  color: var(--text-1); margin-bottom: 5px; }
.state-desc { font-size: var(--fs-data); color: var(--text-3);
  max-width: 42ch; margin: 0 auto; line-height: 1.6; }
.state-actions { display: flex; gap: var(--sp-4); justify-content: center;
  flex-wrap: wrap; margin-top: var(--sp-8); }
.state.is-loading .state-mark { background: var(--accent-soft); color: var(--accent); }
.state.is-error   .state-mark { background: var(--danger-soft); color: var(--danger); }
.state.is-hint    .state-mark { background: var(--info-soft);   color: var(--info); }

/* 9) 顶栏统计在忙时不应该被误读为"已更新" */
.topbar.is-busy .topbar-stats { opacity: .55; pointer-events: none; }

/* 10) 按钮内 loading 转圈（零依赖） */
@keyframes spin { to { transform: rotate(360deg); } }
.btn .spin {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid currentColor; border-top-color: transparent;
  animation: spin .8s linear infinite;
}
```

---

## 附录 B · 一句话验收标准

改完之后，随机抽任意一屏截图，应当满足：

1. 所有文字色对底色的对比度 **≥4.5:1**（装饰图标与禁用态除外，禁用态 ≥3:1）；
2. **任何一处空态都有按钮**，任何一处 loading 都有阶段文案；
3. 只靠键盘（无鼠标）能完成：换文件 → 搜索表 → 切 5 个 Tab → 翻页 → 展开 JSON 三层节点 → 复制 SQL；
4. 亮暗两套主题下，**侧栏始终是深色面板**，主区始终比画布亮/暗一层；
5. 全站动效只出现这四种：颜色变化 120ms、卡片抬升 160ms、内容淡入 140ms、进度推进 240ms。出现第五种即为超标。
