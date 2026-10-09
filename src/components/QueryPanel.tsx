/**
 * SQL 自由查询面板
 *
 * 复用分析阶段就打开的那个内存连接（见 lib/sqlite.ts 的 setQueryDb），
 * 所以连续查询几乎瞬时，不会每次都重新解析整个文件。
 * 任何写入都只发生在内存副本里 —— 用户磁盘上的文件不会被改动。
 */
import { useEffect, useRef, useState } from 'react';
import { IconAlert, IconCopy, IconDownload, IconPlay, IconTerminal } from './Icons';
import { copyText, downloadText, formatNumber, toCsv, truncate } from '../lib/format';
import type { TableInfo } from '../lib/types';

export interface QueryResult {
  columns: string[];
  /**
   * 结果行 —— **按列下标**存，不要改成「列名 → 值」的对象。
   *
   * `SELECT a.id, b.id ...` 或 JOIN 后的同名字段很常见，用对象装行时
   * 后一列会覆盖前一列（两列显示同一个值、导出的 CSV 也是错的）。
   */
  rows: unknown[][];
  /** 结果超过引擎上限被截断（见 lib/sqlite.ts 的 QUERY_MAX_ROWS） */
  truncated: boolean;
  /** 截断前的真实总行数 */
  totalRows: number;
}

export interface QueryPanelProps {
  tables: TableInfo[];
  sql: string;
  onSqlChange: (sql: string) => void;
  result: QueryResult | null;
  error: string | null;
  busy: boolean;
  onRun: () => void;
  /** 把执行结果播报给屏幕阅读器（全站唯一的 aria-live 区在 App 里） */
  onAnnounce?: (message: string) => void;
}

export default function QueryPanel({
  tables,
  sql,
  onSqlChange,
  result,
  error,
  busy,
  onRun,
  onAnnounce,
}: QueryPanelProps) {
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** 「已复制」的复原定时器：卸载时清掉，避免组件没了还去 setState */
  const copyTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  /*
   * 结果只在视觉上变化，读屏用户看不到表格的出现。把行数/列数播报出去，
   * 键盘用户按完 Ctrl+Enter 才知道"到底跑通了没有、出了多少行"。
   */
  useEffect(() => {
    if (error) onAnnounce?.(`查询失败：${error}`);
    else if (result) {
      const scope = result.truncated
        ? `共 ${result.totalRows} 行，为保护页面性能仅显示前 ${result.rows.length} 行`
        : `返回 ${result.rows.length} 行`;
      onAnnounce?.(`查询${scope}、${result.columns.length} 列`);
    }
  }, [result, error, onAnnounce]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <IconTerminal size={14} />
            SQL 查询
          </h2>
          <div className="spacer" />
          <span className="card-note">在内存副本上执行，不会写回你的文件</span>
        </div>
        <div className="card-body pad">
          <textarea
            className="sql-editor"
            value={sql}
            spellCheck={false}
            placeholder="SELECT * FROM 表名 LIMIT 20;"
            onChange={(e) => onSqlChange(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl / Cmd + Enter 执行，跟主流数据库客户端保持一致
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onRun();
              }
            }}
            aria-label="SQL 查询语句"
          />

          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={onRun} disabled={busy}>
              <IconPlay size={13} />
              {busy ? '执行中…' : '执行'}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => onSqlChange('')}
              disabled={busy || sql.length === 0}
            >
              清空
            </button>
            {/*
              复制语句：SQL 编辑器是个 textarea，敲完一条查询想粘到别处（存档 / 发给同事）
              是常见动作 —— 在编辑框里用鼠标划词复制，对键盘用户是走不通的。

              必须按 copyText() 的返回值播报，不能无条件说"已复制"：
              剪贴板 API 在非安全上下文里可能根本不存在，用户粘出来是空的却被告知成功。
            */}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              aria-label="复制 SQL 语句"
              onClick={async () => {
                const ok = await copyText(sql);
                if (ok) {
                  setCopied(true);
                  onAnnounce?.('已复制 SQL 语句到剪贴板');
                  if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
                  copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
                } else {
                  onAnnounce?.('复制失败：当前环境不允许访问剪贴板，请手动选中文本复制');
                }
              }}
              disabled={busy || sql.length === 0}
            >
              <IconCopy size={13} />
              {copied ? '已复制' : '复制 SQL'}
            </button>
            <span className="card-note">快捷键 Ctrl / ⌘ + Enter</span>
          </div>

          {/*
            这里刻意**不加** role="alert"。
            role="alert" 是隐式的 aria-live="assertive"，而全站唯一的播报区
            （App 里的 .sr-live，aria-live="polite"）已经在上面那个 useEffect 里
            把同一条错误播报出去了。两处都播 = 读屏把同一句话念两遍，
            而且是 assertive 先打断、polite 后补 —— 听感非常糟。
          */}
          {error ? (
            <div className="alert is-danger" style={{ marginTop: 12, marginBottom: 0 }}>
              <IconAlert size={15} />
              <span>
                <span className="mono">{error}</span>
                {/*
                  报错只给错误码/英文信息，用户仍然不知道下一步干什么。
                  补一句可执行的排查动作，把"报错了"变成"照着做就能改对"。
                */}
                <span className="alert-next">
                  先检查表名和字段名有没有拼错（中文表名要用双引号包起来）。
                  也可以在下方「表清单速查」里点一下表名，自动生成一条能跑通的 SELECT。
                </span>
              </span>
            </div>
          ) : null}

          {result ? (
            result.rows.length === 0 ? (
              <div className="alert is-info" style={{ marginTop: 12, marginBottom: 0 }}>
                <IconTerminal size={15} />
                <span>
                  语句执行成功，但没有返回任何行。
                  <span className="alert-next">
                    常见原因是 WHERE 条件太严 —— 把条件去掉先看一眼全表，
                    或者到「数据预览」确认这张表本来就有数据。
                  </span>
                </span>
              </div>
            ) : (
              <div className="query-result">
                <div className="grid-bar">
                  <span>
                    返回 <b className="tnum">{formatNumber(result.totalRows)}</b> 行 ·{' '}
                    <b className="tnum">{result.columns.length}</b> 列
                    {result.truncated
                      ? `（超出显示上限，仅渲染前 ${formatNumber(result.rows.length)} 行）`
                      : ''}
                  </span>
                  <div className="pager">
                    {result.truncated ? (
                      /*
                        「仅渲染前 500 行」听起来只是显示层的限制，用户很容易认为
                        "导出能拿到全部"。实际上导出用的就是同一份截断后的数据，
                        CSV 里也只有 500 行。不写清楚，用户会拿这个文件去做后续分析，
                        然后在别处发现数据对不上，却找不到原因。
                      */
                      <span className="card-note is-warn">
                        CSV 同样只含前 {formatNumber(result.rows.length)} 行
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      title={
                        result.truncated
                          ? `结果共 ${formatNumber(result.totalRows)} 行，受引擎上限限制，导出文件只包含前 ${formatNumber(result.rows.length)} 行`
                          : `导出全部 ${formatNumber(result.rows.length)} 行`
                      }
                      aria-label={
                        result.truncated
                          ? `导出 CSV，注意结果已截断，仅前 ${formatNumber(result.rows.length)} 行`
                          : '导出 CSV'
                      }
                      onClick={() => {
                        downloadText('query-result.csv', toCsv(result.columns, result.rows));
                        onAnnounce?.(
                          result.truncated
                            ? `已导出 CSV：结果共 ${result.totalRows} 行，文件里只有前 ${result.rows.length} 行`
                            : `已导出 CSV，共 ${result.rows.length} 行`,
                        );
                      }}
                    >
                      <IconDownload size={13} />
                      导出 CSV
                    </button>
                  </div>
                </div>
                {/*
                  aria-rowcount / aria-colcount：结果可能被截断（DOM 里只有 500 行），
                  但用户查询的是全部的 N 行 —— 不声明真值，读屏会以为结果就是 500 行。
                  +1 把表头算作第 1 行；# 那一列也占一列，所以列数再 +1。
                */}
                <div className="grid-scroll" style={{ maxHeight: 380 }}>
                  <table
                    className="grid"
                    aria-rowcount={result.totalRows + 1}
                    aria-colcount={result.columns.length + 1}
                  >
                    <caption className="sr-only">
                      查询结果，共 {formatNumber(result.totalRows)} 行、{result.columns.length} 列。
                      {result.truncated
                        ? `超出显示上限，表格里只渲染了前 ${formatNumber(result.rows.length)} 行。`
                        : ''}
                    </caption>
                    <thead>
                      <tr aria-rowindex={1}>
                        <th scope="col" className="col-index">
                          #
                        </th>
                        {/*
                          列名做 key 是不行的：`SELECT a.id, b.id` 会出现两个 "id"，
                          React 会因为 key 重复告警、甚至渲染错位。改用列下标。
                        */}
                        {result.columns.map((c, ci) => (
                          <th key={ci} scope="col">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} aria-rowindex={i + 2}>
                          <td className="cell-num col-index">{formatNumber(i + 1)}</td>
                          {result.columns.map((_, ci) => {
                            const cell = row[ci];
                            return (
                              <td key={ci} className="cell-text">
                                {cell === null || cell === undefined ? (
                                  <span className="cell-null">NULL</span>
                                ) : typeof cell === 'number' ? (
                                  <span className="cell-num">{String(cell)}</span>
                                ) : (
                                  truncate(String(cell), 200)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>表清单速查</h2>
          <span className="chip">{tables.length} 张表</span>
          <div className="spacer" />
          <span className="card-note">点表名生成一条 SELECT，省得手敲</span>
        </div>
        <div className="pick-grid">
          {tables.map((table) => (
            <div key={table.name} className="pick is-static">
              <button
                type="button"
                className="pick-link"
                onClick={() => onSqlChange(`SELECT * FROM "${table.name}" LIMIT 50;`)}
              >
                {table.name}
              </button>
              <span className="pick-snippet">
                {formatNumber(table.rowCount)} 行 · {table.columns.length} 字段
              </span>
              {table.columns.length > 0 ? (
                <button
                  type="button"
                  className="pick-toggle"
                  onClick={() => setOpenTable(openTable === table.name ? null : table.name)}
                  aria-expanded={openTable === table.name}
                >
                  {openTable === table.name ? '收起字段' : '查看字段'}
                </button>
              ) : null}
              {openTable === table.name ? (
                <span className="pick-cols">
                  {table.columns.map((c) => (
                    <code key={c.name} className="code-inline">
                      {c.name}
                    </code>
                  ))}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
