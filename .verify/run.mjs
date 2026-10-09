/**
 * 引擎回归验证（本地跑，不进产物）
 *
 * 覆盖十组：
 *  1. 样本库分析：表 / 视图 / 外键 / 索引 / DDL / 进度阶段 / 主线程让出
 *  2. JSON 识别：显式声明类型
 *  3. 查询连接复用：重名列、行数上限截断、bytes 身份校验、内存副本写入可见
 *  4. JSON 识别：抽样启发式（含反例不误判）
 *  5. 连接释放的幂等与拒绝行为
 *  6. 文件头魔数：16 字节（第 16 字节必须是 NUL）
 *  7. 行数聚合口径：单一实现 sumRowCount / allRowCountsExact / allObjectsOf
 *  8. 统计口径标记 statsExact 与**空值率 ≤ 100% 这一物理不变量**
 *  9. 视图重名列：消歧名唯一、两列各自拿到正确的精确统计
 * 10. CSV 导出：公式注入中和（含 `-1+1` 这种"像减号但不是数字"的写法）与 RFC 4180 转义
 *
 * 运行：node .verify/run.mjs        加 VERBOSE=1 可看步骤标记
 */
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

/*
 * sqlite.ts 用 document.baseURI 定位 wasm（浏览器里是 http://…），Node 下没有
 * document，这里补一个。Emscripten 在 Node 环境用 fs.readFileSync 读 wasm，
 * 不认识 file:// 协议，所以垫一层还原成普通路径。
 *
 * 坑：只垫 readFileSync。把 fs.readFile 一起覆盖会打断 Node 自身的 ESM 加载器，
 * 进程会被直接杀掉且毫无报错 —— 这个坑花了不少时间才定位到。
 */
const sqlJsDist = resolve(projectRoot, 'node_modules/sql.js/dist') + '/';
globalThis.document = { baseURI: pathToFileURL(sqlJsDist).href };

const readFileRaw = fs.readFileSync;
fs.readFileSync = function patched(target, ...rest) {
  const p =
    typeof target === 'string' && target.startsWith('file://') ? fileURLToPath(target) : target;
  return readFileRaw.call(this, p, ...rest);
};

const verbose = process.env.VERBOSE === '1';
const mark = (label) => {
  if (verbose) fs.writeSync(2, `[mark] ${label}\n`);
};

let failures = 0;
function check(label, condition, detail = '') {
  const result = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`[${result}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/* ------------------------------ 载入被测模块 ------------------------------ */

mark('import bundle');
const mod = await import(pathToFileURL(resolve(here, 'sqlite.bundle.mjs')).href);
const { analyzeSqliteFile, runQuery, countJsonColumns, releaseQueryDb, isSqliteFile } = mod;
mark(`bundle exports: ${Object.keys(mod).length} 个`);

const sampleBytes = new Uint8Array(readFileRaw(resolve(projectRoot, 'public/sample.sqlite')));

/* -------------------------- 1. 样本库分析与报告 -------------------------- */

console.log('\n=== 1. 样本库分析 ===');
check('SQLite 魔数校验', isSqliteFile(sampleBytes), `${sampleBytes.byteLength} 字节`);
check('非 SQLite 文件被拒', !isSqliteFile(new Uint8Array([1, 2, 3, 4])), '4 字节垃圾数据');

const progressLog = [];
const stageLog = [];

/*
 * 主线程让出探针。
 *
 * 改造前的让出策略是"每分析 5 张表让出一次"，样本库只有 5 张表 + 1 个视图，
 * 意味着整轮分析一次都不会让出主线程 —— 进度条会一直不动，直到全部结束。
 * 这个探针用 setInterval 当"证人"：只要分析过程中定时器插进来跑过，
 * 就说明主线程确实被让出过；如果一次都没跑，说明又退回了全程独占。
 */
let yieldTicks = 0;
const yieldProbe = setInterval(() => {
  yieldTicks += 1;
}, 8);

mark('analyzeSqliteFile(sample)');
const report = await analyzeSqliteFile(sampleBytes, {
  fileName: '样本库.sqlite',
  onProgress: (stage, ratio, detail) => {
    progressLog.push(`${Math.round(ratio * 100)}% ${stage}${detail ? ` ${detail}` : ''}`);
    stageLog.push(stage);
  },
});
mark('analyzeSqliteFile(sample) 完成');
clearInterval(yieldProbe);

console.log(
  `  文件 ${report.fileName} · SQLite ${report.sqliteVersion} · 编码 ${report.encoding} · ` +
    `页 ${report.pageSize}B×${report.pageCount} · 耗时 ${report.elapsedMs}ms`,
);
console.log(`  表 ${report.tables.map((t) => `${t.name}(${t.rowCount})`).join(', ')}`);
console.log(`  视图 ${report.views.map((t) => `${t.name}(${t.rowCount})`).join(', ') || '（无）'}`);

check('解析出 5 张表', report.tables.length === 5, report.tables.map((t) => t.name).join('/'));
check('解析出 1 个视图', report.views.length === 1);
check('总行数为 1009', report.totalRows === 1009, String(report.totalRows));
check('进度回调被调用', progressLog.length >= 5, `${progressLog.length} 次`);
check(
  '四个阶段都上报过',
  ['engine', 'open', 'analyze', 'summarize', 'done'].every((s) => stageLog.includes(s)),
  [...new Set(stageLog)].join(' → '),
);
check(
  '阶段顺序单调不回退',
  (() => {
    const order = ['engine', 'open', 'analyze', 'summarize', 'done'];
    let prev = -1;
    for (const s of stageLog) {
      const i = order.indexOf(s);
      if (i < prev) return false;
      prev = i;
    }
    return true;
  })(),
  stageLog.join(' → '),
);
check(
  'analyze 阶段带上"正在分析「表名」"明细',
  progressLog.some((l) => l.includes('正在分析「')),
  progressLog.find((l) => l.includes('正在分析「')) ?? '（没找到）',
);
check(
  '分析过程中主线程有让出（定时器能插进来）',
  yieldTicks >= 1,
  `${yieldTicks} 次 tick`,
);

const orders = report.tables.find((t) => t.name === 'orders');
check('orders 行数精确为 80', orders?.rowCount === 80 && orders.rowCountExact === true);
check(
  'orders 外键被读到',
  (orders?.foreignKeys.length ?? 0) >= 1,
  (orders?.foreignKeys ?? []).map((f) => `${f.from}→${f.toTable}.${f.toColumn}`).join(', '),
);
check(
  'orders 索引被读到',
  (orders?.indexes.length ?? 0) >= 2,
  (orders?.indexes ?? []).map((i) => `${i.name}${i.unique ? '(唯一)' : ''}`).join(', '),
);
check('orders 有建表 SQL', typeof orders?.ddl === 'string' && orders.ddl.includes('CREATE TABLE'));
check(
  '视图带建视图 SQL',
  typeof report.views[0]?.ddl === 'string' && report.views[0].ddl.includes('CREATE VIEW'),
);

/* --------------------------- 2. JSON 识别（声明类型） --------------------------- */

console.log('\n=== 2. JSON 识别 · 声明类型 ===');
const declaredJson = [
  ['users', 'profile'],
  ['products', 'tags'],
  ['orders', 'items'],
  ['app_logs', 'context'],
];
for (const [tableName, columnName] of declaredJson) {
  const column = report.tables
    .find((t) => t.name === tableName)
    ?.columns.find((c) => c.name === columnName);
  check(
    `${tableName}.${columnName} 识别为 JSON`,
    column?.isJsonLike === true,
    column ? `declaredType=${column.declaredType} family=${column.typeFamily}` : '未找到字段',
  );
}
check('JSON 字段总数与声明一致', countJsonColumns(report) === declaredJson.length, String(countJsonColumns(report)));

// 预览行里真能 JSON.parse 成功的单元格数量
let parsedJson = 0;
for (const table of [...report.tables, ...report.views]) {
  for (const row of table.previewRows) {
    for (const col of table.columns) {
      if (!col.isJsonLike) continue;
      const raw = row[col.name];
      if (typeof raw !== 'string') continue;
      try {
        JSON.parse(raw);
        parsedJson += 1;
      } catch {
        /* 抽样的字符串不保证都是 JSON */
      }
    }
  }
}
check('存在可解析的 JSON 单元格', parsedJson > 0, `${parsedJson} 个`);

/* --------------------------- 3. SQL 查询连接复用 --------------------------- */

console.log('\n=== 3. SQL 查询连接复用 ===');

/*
 * runQuery 返回的行是**按列下标的二维数组**（不是「列名 → 值」的对象）——
 * 这样 SELECT a.id, b.id 这种重名列才不会互相覆盖。所以这里也按下标取值，
 * 用列名去 columns 里查一下下标，断言的可读性不受影响。
 */
const cell = (result, rowIdx, colName) => result.rows[rowIdx]?.[result.columns.indexOf(colName)];

const t0 = performance.now();
const countResult = await runQuery(sampleBytes, 'SELECT COUNT(*) AS n FROM orders;');
const t1 = performance.now();
const rowsResult = await runQuery(sampleBytes, 'SELECT * FROM users LIMIT 5;');
const t2 = performance.now();

check(
  '复用缓存连接可查询（第 1 次）',
  cell(countResult, 0, 'n') === 80,
  `返回 ${countResult.rows.length} 行 · ${(t1 - t0).toFixed(1)}ms`,
);
check(
  '复用缓存连接可查询（第 2 次）',
  rowsResult.rows.length === 5 && rowsResult.columns.length > 0,
  `${rowsResult.columns.length} 列 · ${(t2 - t1).toFixed(1)}ms`,
);

/*
 * P0-2 回归：重名列。
 *
 * 病根：早先用「列名 → 值」的对象装每一行，遇到 SELECT a.id, b.id 或 JOIN 后的
 * 同名字段，后一列会把前一列覆盖掉 —— 表格里两列显示同一个值，导出的 CSV 也是错的。
 * 现在按列下标返回，1 和 2 必须各归各位。
 */
const dup = await runQuery(sampleBytes, 'SELECT 1 AS x, 2 AS x;');
check(
  '重名列不会互相覆盖（按列下标返回）',
  dup.columns.length === 2 && dup.rows[0]?.[0] === 1 && dup.rows[0]?.[1] === 2,
  `columns=${JSON.stringify(dup.columns)} row=${JSON.stringify(dup.rows[0])}`,
);

/*
 * 结果行数上限：超过 QUERY_MAX_ROWS(500) 要截断，但 totalRows 必须保留真值，
 * 否则界面报不出「共 600 行、仅渲染前 500 行」，表格的 aria-rowcount 也是错的。
 */
const big = await runQuery(
  sampleBytes,
  'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 600) SELECT x FROM c;',
);
check(
  '超过 500 行的结果被截断，且保留真实总行数',
  big.truncated === true && big.rows.length === 500 && big.totalRows === 600,
  `truncated=${big.truncated} shown=${big.rows.length} total=${big.totalRows}`,
);
const small = await runQuery(sampleBytes, 'SELECT 1 AS one;');
check(
  '未超限时 truncated 为 false',
  small.truncated === false && small.totalRows === 1 && small.rows.length === 1,
  `truncated=${small.truncated} total=${small.totalRows}`,
);

/*
 * 这里原本有一条「第 2 次查询更快（连接已打开）」的断言，已删除，原因：
 *  1) 它比较两次微秒级查询的耗时，在机器负载波动下会随机失败（flaky）；
 *  2) 连接是在 analyzeSqliteFile 内部就建好的，两次查询用的都是同一条已打开的连接，
 *     所以这条断言并不能证明「连接复用」这个它声称的机制。
 * 「连接复用」已由下面的「多次查询共用同一内存副本」与「bytes 身份不匹配时拒绝查询」
 * 两条客观覆盖 —— 它们验证的是事实，不是计时。
 */

// 内存副本可以连续改：第一次建表，第二次还能查到
await runQuery(sampleBytes, 'CREATE TABLE t_probe(v INTEGER);');
await runQuery(sampleBytes, 'INSERT INTO t_probe VALUES (42);');
const probe = await runQuery(sampleBytes, 'SELECT v FROM t_probe;');
check(
  '多次查询共用同一内存副本（写入可见）',
  cell(probe, 0, 'v') === 42,
  String(cell(probe, 0, 'v')),
);

// 换成另一份 bytes 应当被拒绝，避免串库
try {
  await runQuery(new Uint8Array(sampleBytes), 'SELECT 1;');
  check('bytes 身份不匹配时拒绝查询', false, '没有抛错');
} catch (err) {
  check('bytes 身份不匹配时拒绝查询', true, err.message);
}

/* ------------------------ 4. JSON 识别（抽样启发式 · 合成库） ------------------------ */

console.log('\n=== 4. JSON 识别 · 抽样启发式（合成库）===');
const { default: initSqlJs } = await import('sql.js');
const SQL = await initSqlJs({
  locateFile: (f) => resolve(projectRoot, 'node_modules/sql.js/dist', f),
});
const mem = new SQL.Database();
mem.run('CREATE TABLE t (id INTEGER PRIMARY KEY, payload TEXT, note TEXT);');
mem.run(
  `INSERT INTO t (payload, note) VALUES
     ('{"a":[1,2],"b":{"c":3}}', '普通文本'),
     ('[1,2,3]', '另一个普通文本'),
     ('{看起来像 json 但解析不了}', '假的 json'),
     ('不是 json', '还是普通文本');`,
);
const syntheticBytes = mem.export();
mem.close();

mark('analyzeSqliteFile(synthetic)');
const syntheticReport = await analyzeSqliteFile(syntheticBytes, { fileName: '合成库.sqlite' });
mark('analyzeSqliteFile(synthetic) 完成');

const syntheticTable = syntheticReport.tables[0];
const payload = syntheticTable.columns.find((c) => c.name === 'payload');
const note = syntheticTable.columns.find((c) => c.name === 'note');

check(
  'TEXT 列里的 JSON 被抽样识别',
  payload?.isJsonLike === true,
  payload ? `declaredType=${payload.declaredType} family=${payload.typeFamily}` : '未找到字段',
);
check('识别结果确实来自抽样而非声明类型', payload?.typeFamily === 'text', payload?.typeFamily);
check(
  '普通文本列不被误判为 JSON',
  note?.isJsonLike === false,
  note ? `distinct=${note.distinctCount}` : '未找到字段',
);
check('合成库共 4 行', syntheticTable.rowCount === 4, String(syntheticTable.rowCount));

// 分析新库会把缓存连接换成新库 —— 旧 bytes 应当随即失效
try {
  await runQuery(sampleBytes, 'SELECT 1;');
  check('切换到新库后旧连接失效', false, '没有抛错');
} catch (err) {
  check('切换到新库后旧连接失效', true, err.message);
}
const syntheticReuse = await runQuery(syntheticBytes, 'SELECT COUNT(*) AS n FROM t;');
check(
  '新库连接可直接复用',
  cell(syntheticReuse, 0, 'n') === 4,
  String(cell(syntheticReuse, 0, 'n')),
);

/* ------------------------------ 5. 释放连接 ------------------------------ */

console.log('\n=== 5. 释放连接 ===');
releaseQueryDb();
try {
  await runQuery(syntheticBytes, 'SELECT 1;');
  check('释放后拒绝查询', false, '没有抛错');
} catch (err) {
  check('释放后拒绝查询', true, err.message);
}
releaseQueryDb();
check('重复释放不报错', true, '可安全重复调用');

/* --------------------------- 6. 文件头魔数（16 字节） --------------------------- */

console.log('\n=== 6. SQLite 魔数校验（第 16 字节）===');
/*
 * 官方头部是**固定 16 字节**：`SQLite format 3`（15 字符）+ NUL。
 * 只比对前 15 个字符会让 `SQLite format 3X…` 这种文件通过校验，
 * 然后在建库时才失败，错误信息也从"不是 SQLite 文件"退化成一条底层报错。
 */
const header = new Uint8Array(64);
for (let i = 0; i < 15; i += 1) header[i] = 'SQLite format 3'.charCodeAt(i);
header[15] = 0;
check('15 字符魔数 + 第 16 字节 NUL → 通过', isSqliteFile(header) === true);

const badHeader = header.slice();
badHeader[15] = 0x41; // 'A'
check(
  '第 16 字节不是 NUL → 拒绝',
  isSqliteFile(badHeader) === false,
  '构造了 "SQLite format 3A"',
);

check('长度不足 16 字节 → 拒绝', isSqliteFile(new Uint8Array(15)) === false, '15 字节');
check('前 15 字符不对 → 拒绝', isSqliteFile(new Uint8Array(64)) === false, '全 0 字节');
check('真实样本文件通过魔数校验', isSqliteFile(sampleBytes) === true);

/* --------------------------- 7. 行数聚合口径（单一实现） --------------------------- */

console.log('\n=== 7. 行数聚合口径 ===');
const { sumRowCount, allRowCountsExact, allObjectsOf } = mod;

const fakeExact = { name: 'a', rowCount: 100, rowCountExact: true };
const fakeEst = { name: 'b', rowCount: 300000, rowCountExact: false };

/*
 * 这是本组断言的核心：总行数必须**包含估算值**。
 * 旧实现写的是 `sum + (t.rowCountExact ? t.rowCount : 0)`，只累加精确值 ——
 * 文件超 200MB 时所有表都走 MAX(rowid) 估算，于是 30 万行的库会显示「总行数 0 行」，
 * 脚注却写着"含估算值"。数字自相矛盾，用户只会认为工具算错了。
 */
check('总行数包含估算值', sumRowCount([fakeExact, fakeEst]) === 300100, String(sumRowCount([fakeExact, fakeEst])));
check('全精确时 allRowCountsExact 为 true', allRowCountsExact([fakeExact]) === true);
check('混入估算时 allRowCountsExact 为 false', allRowCountsExact([fakeExact, fakeEst]) === false);
check('空数组视为全精确', allRowCountsExact([]) === true);
check('空数组总行数为 0', sumRowCount([]) === 0);
check(
  'allObjectsOf 顺序为「表在前、视图在后」',
  (() => {
    const objs = allObjectsOf(report);
    const firstViewIdx = objs.findIndex((o) => o.kind === 'view');
    const lastTableIdx = objs.map((o) => o.kind).lastIndexOf('table');
    return (
      objs.length === report.tables.length + report.views.length &&
      (firstViewIdx === -1 || firstViewIdx > lastTableIdx)
    );
  })(),
  allObjectsOf(report).map((o) => `${o.kind}:${o.name}`).join(', '),
);

/*
 * 报告里的 totalRows 必须和界面用的聚合函数**同一个数**。
 * 引擎自算一份、界面再算一份，是"同一屏三个总行数"的成因。
 */
check(
  'report.totalRows 与 sumRowCount(allObjectsOf(report)) 一致',
  report.totalRows === sumRowCount(allObjectsOf(report)),
  `${report.totalRows} vs ${sumRowCount(allObjectsOf(report))}`,
);
check('样本库总行数仍为 1009', report.totalRows === 1009, String(report.totalRows));

/* ------------------------ 8. 统计口径标记与空值率不变量 ------------------------ */

console.log('\n=== 8. 统计口径与空值率 ===');

/*
 * 样本库每张表都远小于 EXACT_STATS_ROW_LIMIT，所以每一列都该走全表精确统计。
 * 若这里出现 statsExact=false，说明精确统计那条 SQL 挂了而没人发现。
 */
const allColumns = [...report.tables, ...report.views].flatMap((t) => t.columns);
check(
  '样本库所有列都标为全表精确',
  allColumns.length > 0 && allColumns.every((c) => c.statsExact === true),
  `${allColumns.filter((c) => !c.statsExact).length}/${allColumns.length} 列非精确`,
);

/*
 * 构造一张"空值数与抽样数差得很远"的表：
 * 1000 行、x 列有 800 个 NULL。
 *  - 旧口径：分子 800（全表）/ 分母 200（抽样）→ 显示 400%，物理上不可能；
 *  - 新口径：分母按 statsExact 取整表行数 1000 → 80%。
 * 断言不写死 80，而是断言**所有列的空值率都不超过 100%** ——
 * 这是真正的物理不变量，任何分子分母错配都会被它抓住。
 */
const mem2 = new SQL.Database();
mem2.run('CREATE TABLE wide (id INTEGER, x TEXT);');
mem2.run('BEGIN;');
const ins = mem2.prepare('INSERT INTO wide (id, x) VALUES (?, ?)');
for (let i = 1; i <= 1000; i += 1) ins.run([i, i <= 200 ? `v${i}` : null]);
ins.free();
mem2.run('COMMIT;');
const wideBytes = mem2.export();
mem2.close();

const wideReport = await analyzeSqliteFile(wideBytes, { fileName: 'wide.sqlite' });
const wideTable = wideReport.tables[0];
const xCol = wideTable.columns.find((c) => c.name === 'x');
check('宽表 x 列走了精确统计', xCol?.statsExact === true, `statsExact=${xCol?.statsExact}`);
check('精确模式下空值数为全表真值 800', xCol?.nullCount === 800, String(xCol?.nullCount));

const ratios = wideTable.columns.map((c) => {
  const denom = c.statsExact ? wideTable.rowCount : c.sampled;
  return { name: c.name, pct: denom > 0 ? (c.nullCount / denom) * 100 : 0 };
});
check(
  '所有列的空值率都 ≤ 100%（分子分母同源）',
  ratios.every((r) => r.pct <= 100),
  ratios.map((r) => `${r.name}=${r.pct.toFixed(1)}%`).join(' '),
);
const xRatio = ratios.find((r) => r.name === 'x');
check('x 列空值率为 80.0%', Math.abs((xRatio?.pct ?? 0) - 80) < 0.05, `${xRatio?.pct.toFixed(1)}%`);

/* ------------------------ 9. 视图重名列（消歧名必须可解析） ------------------------ */

console.log('\n=== 9. 视图重名列 ===');

/*
 * `CREATE VIEW v AS SELECT a AS x, b AS x` 是合法 SQL。
 * 关键是两件事：
 *  ① SQLite 本身会把重名列消歧成 `x` / `x:1`（PRAGMA 与 exec 用的是同一套名字），
 *    所以字段名必须是唯一的 —— 否则后面"按名字取值"全乱套；
 *  ② `"x:1"` 作为标识符**能解析到第二列**，所以精确统计各自落到正确的列上，
 *    不会出现"两列都显示第一列的统计"这种静默错误。
 * 造法：a 列空值 800、b 列空值 200，两个数字都远离抽样值，一眼能分辨。
 */
const mem3 = new SQL.Database();
mem3.run('CREATE TABLE pair (a INTEGER, b INTEGER);');
mem3.run('BEGIN;');
const ins2 = mem3.prepare('INSERT INTO pair (a, b) VALUES (?, ?)');
for (let i = 1; i <= 1000; i += 1) ins2.run([i <= 200 ? i : null, i <= 200 ? null : i]);
ins2.free();
mem3.run('COMMIT;');
mem3.run('CREATE VIEW dup_view AS SELECT a AS x, b AS x FROM pair;');
const dupBytes = mem3.export();
mem3.close();

const dupReport = await analyzeSqliteFile(dupBytes, { fileName: 'dup.sqlite' });
const dupView = dupReport.views.find((v) => v.name === 'dup_view');
const dupNames = (dupView?.columns ?? []).map((c) => c.name);
check(
  '视图重名列被消歧成唯一字段名',
  dupNames.length === 2 && new Set(dupNames).size === 2,
  JSON.stringify(dupNames),
);
const colX = dupView?.columns.find((c) => c.name === 'x');
const colX1 = dupView?.columns.find((c) => c.name === 'x:1');
check(
  '消歧列 x 拿到第一列的真实统计（空值 800）',
  colX?.nullCount === 800 && colX?.statsExact === true,
  `nullCount=${colX?.nullCount} statsExact=${colX?.statsExact}`,
);
check(
  '消歧列 x:1 拿到第二列的真实统计（空值 200）',
  colX1?.nullCount === 200 && colX1?.statsExact === true,
  `nullCount=${colX1?.nullCount} statsExact=${colX1?.statsExact}`,
);
check(
  '两列统计没有互相串台',
  colX?.nullCount !== colX1?.nullCount,
  `x=${colX?.nullCount} · x:1=${colX1?.nullCount}`,
);

/* ------------------------ 10. CSV 导出与公式注入中和 ------------------------ */

console.log('\n=== 10. CSV 导出安全 ===');
const fmt = await import(pathToFileURL(resolve(here, 'format.bundle.mjs')).href);
const { toCsv } = fmt;

/** 取单列单行 CSV 的"数据行"部分（跳过表头） */
const csvCell = (value) => toCsv(['c'], [[value]]).split('\r\n')[1];

/*
 * `-` 开头必须分情况：负数要原样保留（否则用户拿去求和全是 0），
 * 不像数字的（`-1+1`、`-=cmd|…`）必须中和 —— 它们在 Excel 里会被当公式求值。
 * 老实现只挡 `-.`，`-1+1` 直接放行。
 */
check('`-1+1` 被中和', csvCell('-1+1') === "'-1+1", csvCell('-1+1'));
check('孤立的 `-` 被中和', csvCell('-') === "'-", csvCell('-'));
check('负数 `-1` 原样保留', csvCell('-1') === '-1', csvCell('-1'));
check('负数 `-1.5` 原样保留', csvCell('-1.5') === '-1.5', csvCell('-1.5'));
check('`-.5` 原样保留', csvCell('-.5') === '-.5', csvCell('-.5'));
check('`-0.5` 原样保留', csvCell('-0.5') === '-0.5', csvCell('-0.5'));
check('科学计数法 `-1e5` 原样保留', csvCell('-1e5') === '-1e5', csvCell('-1e5'));
check('科学计数法 `-1E-5` 原样保留', csvCell('-1E-5') === '-1E-5', csvCell('-1E-5'));
check('`5.` 原样保留', csvCell('5.') === '5.', csvCell('5.'));

for (const [label, value] of [
  ['=1+1', '=1+1'],
  ['+1', '+1'],
  ['@SUM(A1)', '@SUM(A1)'],
]) {
  check(`公式前缀 \`${label}\` 被中和`, csvCell(value).startsWith("'"), csvCell(value));
}
check('制表符开头被中和', csvCell('\tX').includes("'"), JSON.stringify(csvCell('\tX')));
check('回车开头被中和并加引号', csvCell('\rX').includes("'"), JSON.stringify(csvCell('\rX')));

check('含逗号被引号包裹', csvCell('a,b') === '"a,b"', csvCell('a,b'));
check('含双引号被双写并包裹', csvCell('a"b') === '"a""b"', csvCell('a"b'));
check('null 导出为空单元格', csvCell(null) === '', JSON.stringify(csvCell(null)));
check('undefined 导出为空单元格', csvCell(undefined) === '', JSON.stringify(csvCell(undefined)));

/*
 * 二维数组按**列下标**取值：这是「查询结果导出」的路径。
 * 用对象装行的话，`SELECT a.id, b.id` 会把后一列覆盖成前一列。
 */
check(
  '二维数组按列下标导出（重名列不覆盖）',
  toCsv(['x', 'x'], [[1, 2]]) === 'x,x\r\n1,2',
  JSON.stringify(toCsv(['x', 'x'], [[1, 2]])),
);
check(
  '对象行按列名导出',
  toCsv(['p', 'q'], [{ p: 1, q: 2 }]) === 'p,q\r\n1,2',
  JSON.stringify(toCsv(['p', 'q'], [{ p: 1, q: 2 }])),
);
check(
  '多行输出用 CRLF 分隔',
  toCsv(['n'], [[1], [2], [3]]).split('\r\n').length === 4,
  JSON.stringify(toCsv(['n'], [[1], [2], [3]])),
);

console.log(`\n结果：${failures === 0 ? '全部通过 ✅' : `${failures} 项失败 ❌`}`);
process.exit(failures === 0 ? 0 : 1);
