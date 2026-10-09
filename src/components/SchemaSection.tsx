/**
 * 表结构视图：字段画像 + 外键关系 + 索引 + 建表 SQL
 *
 * 「自动分析」的价值主要落在这里：用户不需要写任何 PRAGMA，
 * 拖进文件就能看到字段类型、空值率、唯一值数、取值分布。
 */
import { useEffect, useRef, useState } from 'react';
import { IconDownload, IconInfo, IconKey, IconLayers, IconLink } from './Icons';
import { copyText, downloadText, formatNumber, formatRatio } from '../lib/format';
import type { ColumnInfo, TableInfo, TypeFamily } from '../lib/types';

const TYPE_LABEL: Record<TypeFamily, string> = {
  integer: '整数',
  real: '小数',
  text: '文本',
  blob: '二进制',
  boolean: '布尔',
  datetime: '时间',
  json: 'JSON',
  unknown: '未知',
};

function Constraints({ col }: { col: ColumnInfo }) {
  const chips: string[] = [];
  if (col.primaryKey) chips.push('主键');
  if (col.notNull) chips.push('非空');
  if (!col.primaryKey && !col.notNull) chips.push('可空');
  return (
    <>
      {chips.map((text) => (
        <span key={text} className={`chip is-mini${text === '主键' ? ' is-pk' : ''}`}>
          {text}
        </span>
      ))}
    </>
  );
}

/** 把字段结构导出成 Markdown 数据字典 —— 直接把分析结果落到文档里 */
function toMarkdownDict(table: TableInfo): string {
  const lines: string[] = [
    `# ${table.name} 数据字典`,
    '',
    `- 对象类型：${table.kind === 'view' ? '视图' : '数据表'}`,
    `- 行数：${table.rowCountExact ? formatNumber(table.rowCount) : `约 ${formatNumber(table.rowCount)}（估算）`}`,
    `- 字段数：${table.columns.length}`,
    '',
    '| # | 字段 | 声明类型 | 类型族 | 约束 | 默认值 | 空值 | 唯一值 | 统计口径 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  table.columns.forEach((col, i) => {
    const constraints = [
      col.primaryKey ? '主键' : '',
      col.notNull ? '非空' : '',
      !col.primaryKey && !col.notNull ? '可空' : '',
    ]
      .filter(Boolean)
      .join(' ');
    /*
     * 口径必须逐列写出来。
     * 「空值 / 唯一值」两列在不同行可能是不同来源的数字 ——
     * 一列是全表精确值，另一列可能只是前 200 行抽样来的。
     * 不标口径的话，读者没法判断"空值 800"到底是整张表有 800 个空，
     * 还是抽样的 200 行里就有 800 个（后者根本不可能，但读者无从分辨）。
     */
    const scope = col.statsExact ? '全表精确' : `抽样 ${col.sampled} 行`;
    lines.push(
      `| ${i + 1} | ${col.name} | ${col.declaredType} | ${TYPE_LABEL[col.typeFamily]} | ${constraints} | ${col.defaultValue ?? '—'} | ${col.nullCount} | ${col.distinctCount} | ${scope} |`,
    );
  });

  if (table.foreignKeys.length > 0) {
    lines.push('', '## 外键关系', '', '| 本表字段 | 引用表 | 引用字段 | ON UPDATE | ON DELETE |', '| --- | --- | --- | --- | --- |');
    table.foreignKeys.forEach((fk) => {
      lines.push(`| ${fk.from} | ${fk.toTable} | ${fk.toColumn || '（主键）'} | ${fk.onUpdate} | ${fk.onDelete} |`);
    });
  }

  if (table.indexes.length > 0) {
    lines.push('', '## 索引', '', '| 索引名 | 字段 | 唯一 |', '| --- | --- | --- |');
    table.indexes.forEach((idx) => {
      lines.push(`| ${idx.name} | ${idx.columns.join(', ') || '—'} | ${idx.unique ? '是' : '否'} |`);
    });
  }

  if (table.ddl) {
    lines.push('', '## 建表 SQL', '', '```sql', table.ddl, '```');
  }

  return lines.join('\n');
}

export interface SchemaSectionProps {
  table: TableInfo;
  /** 把结果播报给屏幕阅读器（全站唯一的 aria-live 区在 App 里） */
  onAnnounce?: (message: string) => void;
}

export default function SchemaSection({ table, onAnnounce }: SchemaSectionProps) {
  const [showDdl, setShowDdl] = useState(false);
  const [copied, setCopied] = useState(false);

  /** 「已复制」的复原定时器：卸载时清掉 */
  const copyTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const handleCopyDdl = async () => {
    // 按真实结果播报：这里是 DDL，粘错一次就白搭。剪贴板不可用时必须说清楚，
    // 否则用户以为复制成功了。
    const ok = await copyText(table.ddl ?? '');
    if (!ok) {
      onAnnounce?.('复制失败：当前环境不允许访问剪贴板，请手动选中文本复制');
      return;
    }
    setCopied(true);
    onAnnounce?.(`已复制「${table.name}」的建表 SQL`);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const sampled = table.columns[0]?.sampled ?? 0;
  const jsonColumns = table.columns.filter((c) => c.isJsonLike).length;
  const exactColumns = table.columns.filter((c) => c.statsExact).length;

  /*
   * 口径说明必须和表格里真实的数字一致。
   *
   * 原来写的是 `${table.rowCountExact ? '精确统计' : '估算'} · 画像基于抽样 ${sampled} 行`
   * —— 表行数是精确的、但画像可能是精确的：两句话凑在一起反而误导。
   * 而且"画像基于抽样 200 行"在精确统计的表上就是错的（空值/唯一值是全表算的）。
   * 现在按**列**统计：有几列真的走了精确统计，就写几列。
   */
  const scopeNote =
    table.columns.length === 0
      ? '没有字段'
      : exactColumns === table.columns.length
        ? `全表精确统计（${formatNumber(table.rowCount)} 行）`
        : exactColumns === 0
          ? `画像基于抽样 ${formatNumber(sampled)} 行`
          : `${exactColumns}/${table.columns.length} 列全表精确，其余基于抽样 ${formatNumber(sampled)} 行`;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>字段结构</h2>
          <span className="chip">{table.columns.length} 个字段</span>
          {jsonColumns > 0 ? <span className="chip is-json">{jsonColumns} 个 JSON 字段</span> : null}
          <div className="spacer" />
          <span className="card-note">{scopeNote}</span>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => downloadText(`${table.name}.数据字典.md`, toMarkdownDict(table), 'text/markdown;charset=utf-8')}
          >
            <IconDownload size={13} />
            导出数据字典
          </button>
        </div>

        <div className="grid-scroll tall">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col" className="col-index">
                  #
                </th>
                <th scope="col">字段名</th>
                <th scope="col">声明类型</th>
                <th scope="col">类型族</th>
                <th scope="col">约束</th>
                <th scope="col">默认值</th>
                <th scope="col">空值</th>
                <th scope="col">唯一值</th>
                <th scope="col">取值分布 Top 3</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col, index) => (
                <tr key={col.name}>
                  <td className="cell-num col-index">{index + 1}</td>
                  <td>
                    <span className="field-name">
                      {col.primaryKey ? <IconKey size={12} /> : null}
                      {col.name}
                    </span>
                  </td>
                  <td>
                    <code className="code-inline">{col.declaredType}</code>
                  </td>
                  <td>
                    <span className={`type-chip t-${col.typeFamily}`}>{TYPE_LABEL[col.typeFamily]}</span>
                  </td>
                  <td className="cell-nowrap">
                    <Constraints col={col} />
                  </td>
                  <td className="cell-nowrap">
                    {col.defaultValue === null ? (
                      <span className="cell-null">无</span>
                    ) : (
                      <code className="code-inline">{col.defaultValue}</code>
                    )}
                  </td>
                  <td className="cell-num cell-nowrap">
                    {formatNumber(col.nullCount)}
                    {/*
                      空值率的分母必须和分子同源。
                      精确统计时空值数是**整张表**的（全表 800 个空），
                      分母却写抽样行数（200）→ 显示 400%，一个物理上不可能的比例。
                    */}
                    <span
                      className="cell-sub"
                      title={col.statsExact ? '整表精确统计' : `基于抽样 ${formatNumber(col.sampled)} 行`}
                    >
                      {' '}
                      ({formatRatio(col.nullCount, col.statsExact ? table.rowCount : col.sampled)})
                    </span>
                  </td>
                  <td className="cell-num">{formatNumber(col.distinctCount)}</td>
                  <td>
                    {col.topValues.length === 0 ? (
                      <span className="cell-null">—</span>
                    ) : (
                      <span className="top-values">
                        {col.topValues.slice(0, 3).map((tv) => (
                          <span key={tv.value} className="top-value" title={tv.value}>
                            <code className="code-inline">{tv.value}</code>
                            <em>×{tv.count}</em>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/*
        外键与索引两张卡片改成「永远渲染」。
        原来没有外键时整块卡片直接不出现，用户无从判断是"这张表真没外键"
        还是"工具没读到" —— 空结果和失败长得一样，是最容易让人不信任工具的地方。
        现在统一：有内容出表格，没内容出一行说明。
      */}
      <section className="card">
        <div className="card-head">
          <h2>
            <IconLink size={14} />
            外键关系
          </h2>
          <span className="chip">{table.foreignKeys.length} 条</span>
          <div className="spacer" />
          <span className="card-note">表示本表的字段引用了另一张表的主键</span>
        </div>
        {table.foreignKeys.length > 0 ? (
          <div className="grid-scroll tall">
            <table className="grid">
              <caption className="sr-only">{table.name} 的外键关系，共 {table.foreignKeys.length} 条</caption>
              <thead>
                <tr>
                  <th scope="col">本表字段</th>
                  <th scope="col">→ 引用表</th>
                  <th scope="col">引用字段</th>
                  <th scope="col">更新时</th>
                  <th scope="col">删除时</th>
                </tr>
              </thead>
              <tbody>
                {table.foreignKeys.map((fk, i) => (
                  <tr key={`${fk.from}-${i}`}>
                    <td>
                      <code className="code-inline">{fk.from}</code>
                    </td>
                    <td>
                      <code className="code-inline accent">{fk.toTable}</code>
                    </td>
                    <td>
                      <code className="code-inline">{fk.toColumn || '（主键）'}</code>
                    </td>
                    <td className="cell-text">{fk.onUpdate || '—'}</td>
                    <td className="cell-text">{fk.onDelete || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card-empty-note">
            这张表没有声明外键。SQLite 默认不强制外键约束，很多库为了性能干脆不写 ——
            这属于正常情况，不代表文件有问题。
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <IconLayers size={14} />
            索引
          </h2>
          <span className="chip">{table.indexes.length} 个</span>
          <div className="spacer" />
          <span className="card-note">索引决定查询快慢，主键与唯一约束会自动建索引</span>
        </div>
        {table.indexes.length > 0 ? (
          <div className="grid-scroll tall">
            <table className="grid">
              <caption className="sr-only">{table.name} 的索引，共 {table.indexes.length} 个</caption>
              <thead>
                <tr>
                  <th scope="col">索引名</th>
                  <th scope="col">字段</th>
                  <th scope="col">唯一</th>
                  <th scope="col">来源</th>
                </tr>
              </thead>
              <tbody>
                {table.indexes.map((idx) => (
                  <tr key={idx.name}>
                    <td>
                      <code className="code-inline">{idx.name}</code>
                    </td>
                    <td>
                      <code className="code-inline">{idx.columns.join(', ') || '—'}</code>
                    </td>
                    <td className="cell-nowrap">{idx.unique ? '是' : '否'}</td>
                    <td className="cell-text">
                      {idx.origin === 'pk' ? '主键' : idx.origin === 'u' ? '唯一约束' : '手动创建'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card-empty-note">
            这张表没有任何索引（连主键索引都没有）。数据量上去之后，查询会退化成全表扫描。
          </p>
        )}
      </section>

      {table.ddl ? (
        <section className="card">
          <div className="card-head">
            <h2>建表 SQL</h2>
            <div className="spacer" />
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowDdl((v) => !v)}>
              {showDdl ? '收起' : '展开'}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => void handleCopyDdl()}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          {showDdl ? (
            <div className="card-body pad">
              <pre className="code-block">{table.ddl}</pre>
            </div>
          ) : null}
        </section>
      ) : null}

      {table.columns.length === 0 ? (
        <div className="alert is-warn" role="status">
          <IconInfo size={16} />
          <span>
            <span>
              未能读取这张表的字段定义{table.error ? `：${table.error}` : ''}
              。可能是虚拟表（VIRTUAL TABLE）或加密表。
            </span>
            <span className="alert-next">
              其它表不受影响，左边仍然可以正常切换。如果整库都读不出字段，
              多半是文件被加密（SQLCipher 等），浏览器端无法解密。
            </span>
          </span>
        </div>
      ) : null}
    </>
  );
}
