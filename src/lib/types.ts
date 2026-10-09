/** 字段（列）的元信息与轻量画像 */
export interface ColumnInfo {
  cid: number;
  name: string;
  /** 声明类型，如 VARCHAR(50)、INTEGER、TEXT */
  declaredType: string;
  /** 归一化后的类型族，用于着色与分组 */
  typeFamily: TypeFamily;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  /** 抽样判断：该列的字符串值是否像 JSON */
  isJsonLike: boolean;
  /** 抽样统计 */
  sampled: number;
  nullCount: number;
  distinctCount: number;
  /**
   * `nullCount` / `distinctCount` 这两个数字是不是**全表精确值**。
   *
   * 为什么必须把它记下来：这两个字段有两种来源 ——
   *   ① 抽样：从预览的 ≤200 行里算出来（分母是 sampled）；
   *   ② 精确：`SELECT SUM(... IS NULL), COUNT(DISTINCT ...) FROM 整张表`（分母是整表行数）。
   * 字段留下来之后，UI 只有同时知道「这个数是哪来的」才能算出正确的**比例**。
   * 之前没留这个标记，界面一律用 `nullCount / sampled` 算空值率 ——
   * 精确模式下分子是全表值、分母是 200，1000 行 800 个空值的列会显示成 **400%**。
   */
  statsExact: boolean;
  /**
   * 出现最多的几个值。
   *
   * 这里原来还有一对 `min?` / `max?`（数值列的最小/最大值）：引擎会算、会往这里塞，
   * 但**从来没有任何组件读过它们** —— 界面上一个地方都没显示。属于白算又白占类型字段，
   * 一并删掉。真要展示数值区间，应该走「精确统计」那条路（SQL 侧 MIN/MAX），
   * 而不是从 200 行预览里抽样，抽出来的极值容易误导。
   */
  topValues: Array<{ value: string; count: number }>;
}

export type TypeFamily =
  | 'integer'
  | 'real'
  | 'text'
  | 'blob'
  | 'boolean'
  | 'datetime'
  | 'json'
  | 'unknown';

export interface ForeignKeyInfo {
  from: string;
  toTable: string;
  toColumn: string;
  onUpdate: string;
  onDelete: string;
}

export interface IndexInfo {
  name: string;
  unique: boolean;
  origin: string;
  columns: string[];
}

export interface TableInfo {
  name: string;
  kind: 'table' | 'view';
  /** 建表原始 SQL（来自 sqlite_master），便于对照 */
  ddl: string | null;
  rowCount: number;
  /** 行数是否为精确值（超大库会退化为估算） */
  rowCountExact: boolean;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  /** 预览数据（限制条数） */
  previewRows: Array<Record<string, unknown>>;
  /** 分析该表时若出错，记录原因而不是整体失败 */
  error?: string;
}

export interface DatabaseReport {
  fileName: string;
  fileSize: number;
  sqliteVersion: string;
  pageSize: number;
  pageCount: number;
  encoding: string;
  tables: TableInfo[];
  views: TableInfo[];
  analyzedAt: string;
  totalRows: number;
  elapsedMs: number;
}
