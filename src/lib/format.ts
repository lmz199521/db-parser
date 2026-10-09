/**
 * 展示层格式化工具
 *
 * 统一放在一处，避免每个组件各写一份 `toFixed` 导致小数位、千分位不一致。
 */

/** 字节数 → 人类可读（1.2 KB / 3.45 MB） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 千分位数字 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN');
}

/** 占比，total 为 0 时返回破折号而不是 NaN% */
export function formatRatio(part: number, total: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/** 耗时：1s 以内用毫秒，超过用秒 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** 截断长字符串，用于表格单元格与取值分布 */
export function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/*
 * 以这些字符开头的内容，会被 Excel / WPS 当成公式执行。
 * 这个工具恰恰是用来打开「别人给的」数据库文件的，导出时不去中和，
 * 就等于把上游的恶意内容原样递给用户的表格软件。
 */
const RISKY_PREFIX = /^[=+@\t\r]/;

/*
 * `-` 要单独判断，不能一刀切。
 *
 * 两个方向都会出错：
 *  - 无脑把 `-` 开头都加前缀：负数（-5、-3.14、-1e5）是**正常数据**，
 *    加前缀会被 Excel 当成文本，用户拿去求和全部为 0；
 *  - 完全不管 `-`：`-1+1`、`-=cmd|'/C calc'!A0` 这类在 Excel 里同样会被当公式求值。
 *
 * 所以规则是「**看起来不像一个合法数字**才中和」。
 * 判据必须覆盖所有合法的数字写法，否则会把数字误伤成文本：
 *   整数、小数（含 `.5` / `5.`）、科学计数法（1e5 / 1E-5）。
 * 注意：只判"是不是数字"，不判正负号 —— 开头那个 `-` 已经在调用处单独处理了。
 */
const PLAIN_NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** 判断减号开头的内容是不是「合法数字」（是就别动它） */
function isPlainNumber(text: string): boolean {
  return PLAIN_NUMBER.test(text.replace(/^-/, ''));
}

/** CSV 单元格转义：RFC 4180 引号处理 + 公式注入中和 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  const riskyMinus = text.startsWith('-') && !isPlainNumber(text);
  if (RISKY_PREFIX.test(text) || riskyMinus) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 生成 CSV 文本（供导出使用）。
 *
 * `rows` 同时接受两种形态：
 *  - 「对象数组」（表数据，键是列名）；
 *  - 「二维数组」（SQL 查询结果，按列下标）。
 *
 * 查询结果**必须**走二维数组：`SELECT a.id, b.id` 或 JOIN 之后的同名字段
 * 非常常见，用对象装行时后一列会覆盖前一列，导出的文件就是错的。
 */
export function toCsv(
  columns: string[],
  rows: Array<Record<string, unknown> | readonly unknown[]>,
): string {
  const head = columns.map(escapeCell).join(',');
  const body = rows.map((row) =>
    columns
      .map((col, i) => escapeCell(Array.isArray(row) ? row[i] : (row as Record<string, unknown>)[col]))
      .join(','),
  );
  return [head, ...body].join('\r\n');
}

/**
 * 复制文本到剪贴板，返回是否**真的**成功。
 *
 * 为什么要有返回值：剪贴板 API 不是哪儿都在 ——
 *  - 非安全上下文（http 局域网地址、部分 iframe）里 `navigator.clipboard` 直接是 undefined；
 *  - 即使用户点了授权，`writeText()` 也可能因为没有焦点或权限被拒而 reject。
 *
 * 调用方以前写的是 `void navigator.clipboard?.writeText(...)` 然后无条件播报"已复制"，
 * 结果读屏用户被告知复制成功、粘出来却是空的。必须按返回值播报，
 * 失败时给出降级提示（让用户手动选中文本来复制）。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 触发浏览器下载（纯前端，不经过服务器） */
export function downloadText(fileName: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  // BOM 让 Excel 正确识别 UTF-8 中文
  const blob = new Blob([`\uFEFF${text}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
