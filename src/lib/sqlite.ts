/**
 * SQLite 解析与自动分析引擎
 *
 * 设计要点：
 * 1. 全程在浏览器内完成——文件不经过任何服务器，用户数据不出本机。
 * 2. 所有标识符一律用双引号包裹并转义，避免表名/字段名里的特殊字符造成注入或语法错误。
 * 3. 每张表独立 try/catch：一张表分析失败不影响整体报告。
 * 4. 统计口径区分「精确」与「抽样」，并在 UI 上如实标注，不制造假精确。
 * 5. sql.js 运行时用**动态 import** 加载：约 1MB 的 JS 不进首屏 chunk，
 *    用户真正拖入文件时才开始下载 —— 首屏只加载引擎之外的 UI 代码。
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import type { ColumnInfo, DatabaseReport, TableInfo, TypeFamily } from './types';

/** 预览行数上限 */
export const PREVIEW_ROWS = 200;
/** 超过这个行数就不做全表精确统计，改用抽样 */
const EXACT_STATS_ROW_LIMIT = 50_000;
/** 文件超过这个体积，行数也退化为估算（避免大国标卡住界面） */
const ESTIMATE_ROW_COUNT_BYTES = 200 * 1024 * 1024;

/**
 * 允许打开的文件体积上限。
 *
 * 为什么必须有：整个文件要被一次性读进内存（`file.arrayBuffer()`），
 * 再交给 sql.js 建库 —— 峰值内存大约是文件本身的 2~3 倍。
 * 一个 1.5GB 的库能让 16GB 的机器直接把标签页拖死，而且没有任何提示，
 * 用户只会看到浏览器"页面无响应"。
 * 与其卡死，不如在读之前就说清楚：这个工具处理不了这么大的文件。
 */
export const MAX_FILE_BYTES = 512 * 1024 * 1024;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * 加载 WASM 运行时（同页面只加载一次）。
 *
 * 关于 locateFile 为什么忽略传入的 file 参数：
 * 浏览器端 build 会请求 "sql-wasm-browser.wasm"，而默认 build 请求 "sql-wasm.wasm"。
 * 这两个文件在 sql.js 1.x 里是**完全相同的二进制**（可用 md5 校验）。
 * 这里统一返回同一份文件，好处是构建产物里只留一个 640KB 的 wasm。
 * scripts/copy-wasm.mjs 里带了校验：一旦将来两个文件不再相同，会额外拷贝并在日志里告警。
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    // 动态 import：把 sql.js 拆成独立 chunk，首屏不为它买单
    sqlJsPromise = import('sql.js')
      .then((mod) =>
        mod.default({
          locateFile: () => new URL('sql-wasm.wasm', document.baseURI).href,
        }),
      )
      .catch((err) => {
        sqlJsPromise = null; // 失败后允许重试，不要把错误状态永久缓存
        throw err;
      });
  }
  return sqlJsPromise;
}

/**
 * 空闲时预热引擎，让用户真正拖入文件时不必等下载。
 * 用 requestIdleCallback 包一层，不跟首屏渲染抢主线程。
 */
export function preloadSqlJs(): void {
  const run = () => void loadSqlJs().catch(() => undefined);
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (typeof ric === 'function') ric(run);
  else setTimeout(run, 1200);
}

/* --------------------------- 查询连接复用 --------------------------- */

/**
 * 一次查询最多返回多少行。
 *
 * 不设上限的话，用户敲一句 `SELECT * FROM 千万行表`（忘记加 LIMIT 是常态）
 * 就会一次性构造一个巨大的数组，标签页直接卡死。这是用户自己写的语句，
 * 不能指望他记得加 LIMIT，所以由引擎侧兜底截断。
 */
const QUERY_MAX_ROWS = 500;

/**
 * 分析完成后保留一个打开的 Database 句柄，供「SQL 查询」面板复用。
 *
 * 为什么值得做：runQuery 每次新建 Database 都要把整个文件重新解析一遍，
 * 一个 50MB 的库每次查询要几百毫秒。保留句柄后连续查询几乎瞬时。
 * 注意这仍然只是**内存副本**——用户磁盘上的文件不会被改动。
 */
let queryDb: { bytes: Uint8Array; db: Database } | null = null;

function setQueryDb(bytes: Uint8Array, db: Database): void {
  if (queryDb && queryDb.db !== db) {
    try {
      queryDb.db.close();
    } catch {
      /* 已经关掉了就算了 */
    }
  }
  queryDb = { bytes, db };
}

/** 释放查询连接（用户「换个文件」时调用，避免内存里一直挂着一个大库） */
export function releaseQueryDb(): void {
  if (!queryDb) return;
  try {
    queryDb.db.close();
  } catch {
    /* noop */
  }
  queryDb = null;
}

/* ---------------------------- 让出主线程 ---------------------------- */

/**
 * 交互预算：主线程连续被占用超过这个毫秒数，浏览器就来不及跑一次渲染 ——
 * 表现就是进度条"卡在 40% 一动不动"，用户以为页面死了。
 * 32ms 略大于两帧（60Hz 下 16.7ms），既保证能重绘，又不至于让出过频拖慢整体耗时。
 */
const YIELD_BUDGET_MS = 32;

let lastYieldAt = 0;

/** 真正让出：setTimeout(0) 把回调排到下一个宏任务，浏览器在这之间有窗口跑渲染 */
async function yieldToPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  lastYieldAt = performance.now();
}

/**
 * 按**时间预算**让出主线程。
 *
 * 原来这里是「每分析 5 张表让出一次」——两个方向都会出错：
 * 表多而小的时候让出过频，白白增加总耗时；
 * 表少而巨大时（单表 30 万行），一次列扫描就把主线程占满 1~3 秒，进度条直接冻住。
 * 改成看时间不看次数后，无论库里是 200 张小表还是 1 张巨表，
 * 主线程单次占用都不超过 YIELD_BUDGET_MS。
 */
async function maybeYield(): Promise<void> {
  if (performance.now() - lastYieldAt > YIELD_BUDGET_MS) await yieldToPaint();
}

/* ----------------------------- 基础工具 ----------------------------- */

/** 转义并包裹标识符，防止表名/字段名中的引号、空格、中文造成语法错误 */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** 把 SQLite 返回的值转成可以安全交给 React 渲染、并且能序列化的形式 */
export function normalizeCell(value: SqlValue): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return `[BLOB ${value.byteLength} 字节]`;
  }
  return String(value);
}

/**
 * SQLite 的文件头魔数，用来确认拖进来的确实是 SQLite 文件。
 *
 * SQLite 的头部是固定的 16 字节：
 *   `SQLite format 3` + `\0`（第 15 个字节必须是 NUL，然后才是页大小等字段）。
 * 这里以前只比对了前 15 个字符就返回 true —— 一个叫 `SQLite format 3X` 开头的
 * 任意文件（比如某种自研格式恰好这么命名）会被放行，然后在建库时才失败，
 * 错误信息也从"不是 SQLite 文件"退化成一条底层报错。
 * 把第 16 个字节的 NUL 也一起校验，代价为零。
 */
export function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 16) return false;
  let magic = '';
  for (let i = 0; i < 15; i += 1) magic += String.fromCharCode(bytes[i]);
  return magic === 'SQLite format 3' && bytes[15] === 0;
}

/**
 * 取多行，按「列名 → 值」的对象返回。
 *
 * ⚠️ 和 `runQuery` 的区别（这里容易踩坑，改之前先读完）：
 *
 *  - `queryAll`（本函数）走 `stmt.getAsObject()`。sql.js 在实现里会对**重名列**做消歧：
 *    遇到第二个同名键时自动改名成 `名字:1`、`名字:2`……
 *    —— 所以重名列不会互相覆盖，但也意味着**列名可能被 sql.js 改过**。
 *  - `runQuery` 走 `db.exec()`，返回的 `columns` 是**原始列名**（不做消歧），
 *    所以那边必须按列下标取值，用列名做键一定会丢数据。
 *
 * 本函数的所有调用点（sqlite_master / PRAGMA table_info / foreign_key_list /
 * index_list / index_info / 带唯一别名的聚合查询）列名本来就是唯一的，
 * 消歧逻辑不会生效，是安全的。
 * 但**不要**拿它去跑用户自由输入的 SQL —— 那不是它设计的用途，去用 runQuery。
 * （已有一条验收断言覆盖 `SELECT a AS x, b AS x` 的视图，防止这个不变量被改坏。）
 */
function queryAll(db: Database, sql: string): Array<Record<string, SqlValue>> {
  const stmt = db.prepare(sql);
  try {
    const rows: Array<Record<string, SqlValue>> = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function scalar(db: Database, sql: string): SqlValue {
  const rows = queryAll(db, sql);
  if (rows.length === 0) return null;
  const first = rows[0];
  const keys = Object.keys(first);
  return keys.length > 0 ? first[keys[0]] : null;
}

/**
 * 声明类型 → 类型族（SQLite 的类型很自由，这里做归一化便于着色和判断）。
 *
 * 这里的判断刻意**沿用 SQLite 自己的类型亲和性（type affinity）规则**，
 * 而不是"更聪明"的词边界匹配：
 *   SQLite 文档规定 —— 声明类型里只要**包含**子串 "INT" 就归 INTEGER 亲和性。
 *   所以 `POINT`（空间类型）在 SQLite 眼里确实是 INTEGER 亲和性。
 * 如果这里改成按单词精确匹配，工具显示的类型就会和数据库的实际行为不一致 ——
 * 用户会拿这个结论去写 SQL，然后被 SQLite 打脸。跟着官方规则走才是对的。
 */
export function toTypeFamily(declaredType: string): TypeFamily {
  const t = declaredType.toUpperCase();
  if (!t) return 'unknown';
  if (/JSON/.test(t)) return 'json';
  if (t.includes('INT')) return 'integer';
  if (/(REAL|FLOA|DOUB|DECIMAL|NUMERIC)/.test(t)) return 'real';
  if (/BOOL/.test(t)) return 'boolean';
  if (/(DATETIME|DATE|TIME|TIMESTAMP)/.test(t)) return 'datetime';
  if (/(CHAR|CLOB|TEXT|VARCHAR|STRING)/.test(t)) return 'text';
  if (/BLOB|BINARY/.test(t)) return 'blob';
  return 'unknown';
}

/** 判断一个字符串值是否真的是 JSON（必须能 parse 成功，而不是只看首字符） */
export function looksLikeJson(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length < 2) return false;
  const head = s[0];
  const tail = s[s.length - 1];
  if (!((head === '{' && tail === '}') || (head === '[' && tail === ']'))) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------- 单表分析 ---------------------------- */

interface ColumnStats {
  sampled: number;
  nullCount: number;
  distinctCount: number;
  topValues: Array<{ value: string; count: number }>;
  jsonLike: boolean;
}

/** 抽样统计：从预览行里算，永远可用，速度快 */
function statsFromSample(sample: unknown[]): ColumnStats {
  let nullCount = 0;
  let jsonLike = false;
  const counter = new Map<string, number>();

  for (const value of sample) {
    if (value === null) {
      nullCount += 1;
      continue;
    }
    if (!jsonLike && looksLikeJson(value)) jsonLike = true;

    /*
     * 计数的键必须是**完整值**，不能先截断再计数。
     *
     * 原来这里是先 `value.slice(0, 60) + '…'` 再 set：
     * 两百条长文本只要前 60 个字符一样（时间戳开头、"用户反馈："前缀、
     * 同一段 HTML 的开头），全都会被算成同一个值 —— 唯一值数因此严重偏小，
     * 而「取值分布」里那条最长的字符串也会被写成"出现 180 次"。
     * 截断只在**展示 topValues 时**做。
     */
    const key = typeof value === 'string' ? value : String(value);
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  const topValues = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({
      value: value.length > 60 ? `${value.slice(0, 60)}…` : value,
      count,
    }));

  return {
    sampled: sample.length,
    nullCount,
    distinctCount: counter.size,
    topValues,
    jsonLike,
  };
}

function analyzeColumn(
  db: Database,
  table: string,
  raw: Record<string, SqlValue>,
  previewValues: unknown[],
  exact: boolean,
): ColumnInfo {
  const name = String(raw.name ?? '');
  const declaredType = String(raw.type ?? '');
  const family = toTypeFamily(declaredType);
  const sampleStats = statsFromSample(previewValues);

  let nullCount = sampleStats.nullCount;
  let distinctCount = sampleStats.distinctCount;
  let statsExact = false;

  if (exact) {
    try {
      const row = queryAll(
        db,
        `SELECT SUM(CASE WHEN ${ident(name)} IS NULL THEN 1 ELSE 0 END) AS nulls,
                COUNT(DISTINCT ${ident(name)}) AS distincts
           FROM ${ident(table)}`,
      )[0];
      if (row) {
        const gotNulls = row.nulls !== null && row.nulls !== undefined;
        const gotDistincts = row.distincts !== null && row.distincts !== undefined;
        if (gotNulls) nullCount = Number(row.nulls);
        if (gotDistincts) distinctCount = Number(row.distincts);
        /*
         * 两个值都真的取到了，才把这一列标成"全表精确"。
         * 空表的 SUM/COUNT 返回 NULL（不是 0），那种情况我们并没有拿到精确值，
         * 标记照实留 false —— 否则界面会拿"分母=0 行"去算比例。
         */
        statsExact = gotNulls && gotDistincts;
      }
    } catch {
      // 精确统计失败就保留抽样值，不打断整体流程（statsExact 保持 false）
    }
  }

  return {
    cid: Number(raw.cid ?? 0),
    name,
    declaredType: declaredType || '（未声明）',
    typeFamily: family,
    notNull: Number(raw.notnull ?? 0) === 1,
    defaultValue: raw.dflt_value === null || raw.dflt_value === undefined
      ? null
      : String(raw.dflt_value),
    primaryKey: Number(raw.pk ?? 0) > 0,
    isJsonLike: family === 'json' || sampleStats.jsonLike,
    sampled: sampleStats.sampled,
    nullCount,
    distinctCount,
    statsExact,
    topValues: sampleStats.topValues,
  };
}

async function analyzeTable(
  db: Database,
  name: string,
  kind: 'table' | 'view',
  ddl: string | null,
  fileSize: number,
): Promise<TableInfo> {
  const base: TableInfo = {
    name,
    kind,
    ddl,
    rowCount: 0,
    rowCountExact: true,
    columns: [],
    foreignKeys: [],
    indexes: [],
    previewRows: [],
  };

  try {
    // 行数：大库退化为基于 rowid 的估算
    try {
      if (fileSize > ESTIMATE_ROW_COUNT_BYTES) {
        const maxRowid = scalar(db, `SELECT MAX(rowid) FROM ${ident(name)}`);
        base.rowCount = maxRowid === null ? 0 : Number(maxRowid);
        base.rowCountExact = false;
      } else {
        base.rowCount = Number(scalar(db, `SELECT COUNT(*) FROM ${ident(name)}`) ?? 0);
      }
    } catch {
      base.rowCount = 0;
      base.rowCountExact = false;
    }

    // 预览数据
    const rawPreview = queryAll(db, `SELECT * FROM ${ident(name)} LIMIT ${PREVIEW_ROWS}`);
    base.previewRows = [];
    for (let r = 0; r < rawPreview.length; r += 1) {
      const row = rawPreview[r];
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(row)) out[key] = normalizeCell(row[key]);
      base.previewRows.push(out);
      // 宽表 × 200 行的归一化也可能占满主线程，逐行按预算让出
      await maybeYield();
    }

    // 字段结构与画像
    const columns = queryAll(db, `PRAGMA table_info(${ident(name)})`);
    const columnNames = columns.map((c) => String(c.name ?? ''));
    const exact = base.rowCountExact && base.rowCount <= EXACT_STATS_ROW_LIMIT;

    base.columns = [];
    for (const raw of columns) {
      const colName = String(raw.name ?? '');
      const values = base.previewRows.map((r) => r[colName]);
      base.columns.push(analyzeColumn(db, name, raw, values, exact));
      // exact 模式下每列都要跑一次 COUNT(DISTINCT)，宽表里这是最重的一段
      await maybeYield();
    }

    // 外键
    try {
      base.foreignKeys = queryAll(db, `PRAGMA foreign_key_list(${ident(name)})`).map((fk) => ({
        from: String(fk.from ?? ''),
        toTable: String(fk.table ?? ''),
        toColumn: String(fk.to ?? ''),
        onUpdate: String(fk.on_update ?? ''),
        onDelete: String(fk.on_delete ?? ''),
      }));
    } catch {
      base.foreignKeys = [];
    }

    // 索引
    try {
      const indexes = queryAll(db, `PRAGMA index_list(${ident(name)})`);
      base.indexes = indexes.map((idx) => {
        const idxName = String(idx.name ?? '');
        let cols: string[] = [];
        try {
          cols = queryAll(db, `PRAGMA index_info(${ident(idxName)})`)
            .map((c) => String(c.name ?? ''))
            .filter((c) => c.length > 0);
        } catch {
          cols = [];
        }
        return {
          name: idxName,
          unique: Number(idx.unique ?? 0) === 1,
          origin: String(idx.origin ?? ''),
          columns: cols,
        };
      });
    } catch {
      base.indexes = [];
    }

    // 补一刀：字段名重复时不至于崩（极少见，但虚拟表可能）
    if (columnNames.length === 0) {
      base.error = '未能读取字段定义（可能是虚拟表或加密表）';
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }

  return base;
}

/* ---------------------------- 主入口 ---------------------------- */

export interface AnalyzeOptions {
  fileName: string;
  /**
   * 进度回调。
   *
   * `stage` 是给「四步阶段清单」用的：只报百分比的话，UI 只能画出光秃秃的一条进度条，
   * 用户不知道"卡在 40%"到底是在下载引擎还是在扫表。带上阶段后，UI 能明确告诉用户
   * 现在走到哪一步、还剩哪几步。
   *
   * `detail` 是该阶段内部的细分说明（例如"正在分析「orders」…"），可为空。
   */
  onProgress?: (stage: AnalyzeStage, ratio: number, detail?: string) => void;
}

/** 分析流程的四个阶段，顺序即执行顺序 */
export type AnalyzeStage = 'engine' | 'open' | 'analyze' | 'summarize' | 'done';

/** 分析一个 SQLite 文件，产出可视化所需的完整报告 */
export async function analyzeSqliteFile(
  bytes: Uint8Array,
  options: AnalyzeOptions,
): Promise<DatabaseReport> {
  const startedAt = performance.now();
  const { fileName, onProgress } = options;

  // 重置让出预算，保证第一次检查就能让出一帧（上一步可能刚跑完别的事）
  lastYieldAt = 0;

  onProgress?.('engine', 0.05, '首次使用需要下载约 640KB 的 WASM 引擎');
  const SQL = await loadSqlJs();

  onProgress?.('open', 0.15, '没有上传，全部在浏览器内存里完成');
  /*
   * 打开这一步单独包一层 try：文件头校验只能挡住"完全不像 SQLite"的文件，
   * 加密库、被截断的库、页大小损坏的库都能骗过魔数校验，然后在这里抛出来。
   * sql.js 抛出来的原文是英文的（"file is not a database"之类），
   * 直接透给用户不解决问题，所以在这里换成能指导下一步的说法。
   */
  let db: Database;
  try {
    db = new SQL.Database(bytes);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `无法打开这个数据库（${detail}）。常见原因：文件是加密的、被截断的，或者根本不是 SQLite 格式。`,
    );
  }

  try {
    const sqliteVersion = String(scalar(db, 'SELECT sqlite_version()') ?? '未知');
    const pageSize = Number(scalar(db, 'PRAGMA page_size') ?? 0);
    const pageCount = Number(scalar(db, 'PRAGMA page_count') ?? 0);
    const encoding = String(scalar(db, 'PRAGMA encoding') ?? '未知');

    const objects = queryAll(
      db,
      /*
       * `NOT LIKE 'sqlite\_%' ESCAPE '\'`：
       * 不加 ESCAPE 的话，LIKE 里的 `_` 是"任意单个字符"的通配符，
       * `sqlite_%` 会连 `sqliteXabc` 这种名字一起排除掉（用户表只要以 sqlite + 任意字符开头就消失）。
       * SQLite 的系统表名固定是 `sqlite_` + 下划线，所以把下划线转义成字面量再匹配。
       */
      `SELECT name, type, sql
         FROM sqlite_master
        WHERE type IN ('table','view')
          AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
        ORDER BY type DESC, name ASC`,
    );

    const tables: TableInfo[] = [];
    const views: TableInfo[] = [];

    for (let i = 0; i < objects.length; i += 1) {
      const obj = objects[i];
      const name = String(obj.name ?? '');
      const kind = obj.type === 'view' ? 'view' : 'table';
      const ddl = obj.sql === null || obj.sql === undefined ? null : String(obj.sql);
      if (!name) continue;

      onProgress?.('analyze', 0.2 + (i / Math.max(objects.length, 1)) * 0.7, `正在分析「${name}」`);
      await maybeYield();

      const info = await analyzeTable(db, name, kind, ddl, bytes.byteLength);
      if (kind === 'view') views.push(info);
      else tables.push(info);
    }

    onProgress?.('summarize', 0.95, '正在汇总统计口径');

    /*
     * 总行数走 sumRowCount（**含估算值**），不要在这里再写一遍 reduce ——
     * "只累加精确值"的老写法会在超 200MB 的库上产出「总行数 0 行」这种自相矛盾的数字。
     * 是否加"含估算值"字样由 allRowCountsExact() 决定。
     */
    const allObjects = [...tables, ...views];
    const totalRows = sumRowCount(allObjects);

    // 把这个已打开的连接留给「SQL 查询」面板复用，不再 close
    setQueryDb(bytes, db);
    onProgress?.('done', 1);

    return {
      fileName,
      fileSize: bytes.byteLength,
      sqliteVersion,
      pageSize,
      pageCount,
      encoding,
      tables,
      views,
      analyzedAt: new Date().toLocaleString('zh-CN'),
      totalRows,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    // 分析失败就别把这个句柄留在缓存里
    try {
      db.close();
    } catch {
      /* noop */
    }
    throw err;
  }
}

/**
 * 在已打开的库里执行一条自定义 SQL（供「自由查询」使用）。
 *
 * 三个关键点：
 *
 * 1. **行数据按「列下标」返回，刻意不做成「列名 → 值」的对象。**
 *    `SELECT a.id, b.id ...` 和 JOIN 之后的同名字段非常常见，用对象装行时
 *    后一列会覆盖前一列 —— 结果是两列显示同一个值、导出的 CSV 也是错的。
 *    这个缺陷是靠实测 `SELECT id AS x, id + 100 AS x` 抓出来的。
 * 2. 返回行数有上限（QUERY_MAX_ROWS），超出即截断并置 truncated 标记。
 * 3. 多语句脚本只返回第一个结果集 —— 主流 SQL 客户端也是这个行为，保持一致。
 *
 * 改动只发生在内存副本里，不会写回用户的磁盘文件；刷新页面即丢弃。
 */
export async function runQuery(
  bytes: Uint8Array,
  sql: string,
): Promise<{
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
  /**
   * 结果集的**真实**总行数（截断前）。
   *
   * 截断之后就数不出来了 —— 界面要报"共 N 行、仅渲染前 500 行"，
   * 表格的 aria-rowcount 也得是这个真值，否则读屏只知道 DOM 里有 500 行、
   * 用户会以为查询结果恰好 500 行。所以趁 slicing 之前先量一次。
   */
  totalRows: number;
}> {
  if (!queryDb || queryDb.bytes !== bytes) {
    /*
     * 这里刻意**不要**先 await loadSqlJs()：反正下一行就抛错，
     * 那一步等于让用户白等一次引擎下载（可能是 640KB）。
     */
    throw new Error('数据库连接已失效，请重新载入文件');
  }
  const result = queryDb.db.exec(sql);
  if (result.length === 0) return { columns: [], rows: [], truncated: false, totalRows: 0 };

  const { columns, values } = result[0];
  const totalRows = values.length;
  const truncated = totalRows > QUERY_MAX_ROWS;
  const rows = (truncated ? values.slice(0, QUERY_MAX_ROWS) : values).map((row) =>
    row.map((cell) => normalizeCell(cell)),
  );
  return { columns, rows, truncated, totalRows };
}

/** 判断分析结果里有多少 JSON 字段（用于首页展示卖点） */
export function countJsonColumns(report: DatabaseReport): number {
  return [...report.tables, ...report.views].reduce(
    (sum, t) => sum + t.columns.filter((c) => c.isJsonLike).length,
    0,
  );
}

/**
 * 全库总行数：**表 + 视图一起算，估算值也算进去**。
 *
 * 这里以前写的是 `sum + (t.rowCountExact ? t.rowCount : 0)` —— 只累加精确值。
 * 看起来像"宁缺毋滥"，实际会产出一个自相矛盾的数字：
 * 文件超过 200MB 时每张表的行数都走 `MAX(rowid)` 估算（rowCountExact=false），
 * 于是一个 30 万行的库，表卡片显示「300,000 行」，
 * 而顶栏和 KPI 卡片显示「总行数 0 行 / 含估算值」。
 * 脚注承认"含估算值"，值里却一个估算值都没含 —— 用户只会认为这个工具算错了。
 *
 * 正确做法是照实累加，由 `allRowCountsExact()` 告诉界面要不要加"估算"字样。
 */
export function sumRowCount(objects: readonly TableInfo[]): number {
  return objects.reduce((sum, t) => sum + t.rowCount, 0);
}

/** 是否所有对象的行数都是精确值（决定界面标"精确统计"还是"含估算值"） */
export function allRowCountsExact(objects: readonly TableInfo[]): boolean {
  return objects.every((t) => t.rowCountExact);
}

/** 一个报告里的全部对象（表在前、视图在后，顺序与侧栏一致） */
export function allObjectsOf(report: DatabaseReport): TableInfo[] {
  return [...report.tables, ...report.views];
}
