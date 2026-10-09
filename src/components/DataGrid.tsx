/**
 * 数据预览表格
 *
 * 设计要点：
 * 1. BLOB 等二进制值在引擎层就已经转成可读文本，组件里不需要再防空。
 * 2. JSON 字段的单元格可以直接点开，联动到 JSON 节点树 —— 这是主要交互入口。
 * 3. **分页渲染**：预览最多 200 行，但仍按 25/50/100 行分页，
 *    避免一次性往 DOM 里塞 200 行 × 20 列 = 4000 个单元格（滚动会明显掉帧）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconColumns, IconDownload } from './Icons';
import { downloadText, formatNumber, toCsv, truncate } from '../lib/format';
import type { ColumnInfo, TableInfo } from '../lib/types';

export interface SelectedCell {
  row: number;
  /** 预览行集合里的绝对行号（0 起） */
  column: string;
}

export interface DataGridProps {
  table: TableInfo;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell | null) => void;
  /** 点击 JSON 单元格时通知外层切到 JSON Tab */
  onOpenJson?: () => void;
  /** 空表时给出的下一步：切到字段结构 */
  onOpenSchema?: () => void;
}

const PAGE_SIZES = [25, 50, 100, 200];

function renderCell(value: unknown, isJsonColumn: boolean) {
  if (value === null || value === undefined) {
    return <span className="cell-null">NULL</span>;
  }
  if (typeof value === 'number') {
    return <span className="cell-num">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="cell-text">{String(value)}</span>;
  }
  const text = String(value);
  if (isJsonColumn) {
    // JSON 单元格只显示开头一段：完整内容点一下就能在节点树里看，
    // 表格里铺满几千字的 JSON 会把整行高度撑爆、后面的列全被顶到屏幕外。
    return <span className="cell-json">{truncate(text, 120)}</span>;
  }
  return <span className="cell-text">{truncate(text)}</span>;
}

export default function DataGrid({
  table,
  selectedCell,
  onSelectCell,
  onOpenJson,
  onOpenSchema,
}: DataGridProps) {
  const columns: ColumnInfo[] = table.columns;
  const rows = table.previewRows;

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  /*
   * 粘性列偏移量实测。
   *
   * 窄屏下前两列会 sticky 固定（styles.css 的 @media (max-width: 860px)），
   * 第二列的 left 必须精确等于第一列的渲染宽度，否则两列之间会露出一条缝，
   * 或者第二列盖住第一列的尾巴。
   * 第一列是行号列，宽度会随行数位数（9 行 vs 200 行）变化，CSS 里写死不可靠，
   * 所以这里实测一次写进 CSS 变量。ResizeObserver 让它在字体加载完 / 窗口缩放后自动跟上。
   */
  const gridRef = useRef<HTMLTableElement | null>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    const measure = () => {
      const first = el.querySelector<HTMLElement>('thead th:nth-child(1)');
      if (!first) return;
      el.style.setProperty('--sticky-col-1-w', `${first.getBoundingClientRect().width}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [table.name, pageSize]);

  // 换表时回到第一页，否则会停在新表不存在的页码上
  useEffect(() => {
    setPage(0);
  }, [table.name]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);

  // 当前页的绝对行区间，用来把「页内下标」换算成「预览集合里的绝对行号」
  const offset = current * pageSize;
  const slice = useMemo(() => rows.slice(offset, offset + pageSize), [rows, offset, pageSize]);

  const go = (next: number) => setPage(Math.min(Math.max(next, 0), pageCount - 1));

  if (rows.length === 0) {
    return (
      <div className="state">
        <div className="state-mark" aria-hidden="true">
          <IconColumns size={20} />
        </div>
        <b className="state-title">这张表里还没有数据</b>
        <p className="state-desc">
          表结构中定义了 {table.columns.length} 个字段，但当前行数为 0。
          可以到「字段结构」看看它的定义是否和预期一致。
        </p>
        <div className="state-actions">
          {onOpenSchema ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenSchema}>
              <IconColumns size={13} />
              查看字段结构
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() =>
              /*
               * 导出的是**这张表真实的字段名**作为表头。
               * 原来写死 ['name', 'type']，导出的 CSV 第一行是 name,type ——
               * 跟这张表毫无关系，用户拿去当模板还得手改。
               */
              downloadText(`${table.name}-columns.csv`, toCsv(columns.map((c) => c.name), []))
            }
          >
            <IconDownload size={13} />
            导出空表头
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid-scroll">
        {/*
          aria-rowcount / aria-rowindex：分页之后 DOM 里只有 25 行，但表里其实有 200 行。
          不声明的话读屏会播报"共 25 行"，用户会以为文件只有这么多数据。
          +1 是把表头算作第 1 行。
        */}
        <table
          className="grid"
          ref={gridRef}
          aria-rowcount={rows.length + 1}
          aria-colcount={columns.length + 1}
        >
          <caption className="sr-only">
            {table.name} 的数据预览，共 {rows.length} 行，当前第 {current + 1} 页。
            带 JSON 标记的单元格是一个按钮，按回车可展开它的节点树。
          </caption>
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col" className="col-index">
                #
              </th>
              {columns.map((col) => (
                <th key={col.name} scope="col">
                  <span className="th-name">{col.name}</span>
                  <span className={`type-chip t-${col.typeFamily}`}>{col.declaredType}</span>
                  {col.primaryKey ? <span className="chip is-pk is-mini">PK</span> : null}
                  {col.isJsonLike && !col.primaryKey ? (
                    <span className="chip is-json is-mini">JSON</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, indexInPage) => {
              const absoluteRow = offset + indexInPage;
              const rowSelected = selectedCell !== null && selectedCell.row === absoluteRow;
              return (
                <tr
                  key={absoluteRow}
                  className={rowSelected ? 'is-selected' : undefined}
                  aria-rowindex={absoluteRow + 2}
                >
                  <td className="cell-num col-index">{absoluteRow + 1}</td>
                  {columns.map((col) => {
                    const value = row[col.name];
                    const clickable = col.isJsonLike;
                    const isSelected =
                      selectedCell !== null &&
                      selectedCell.row === absoluteRow &&
                      selectedCell.column === col.name;

                    const toggle = () => {
                      onSelectCell(isSelected ? null : { row: absoluteRow, column: col.name });
                      if (!isSelected) onOpenJson?.();
                    };

                    return (
                      <td
                        key={col.name}
                        className={[
                          clickable ? 'is-clickable' : '',
                          isSelected ? 'is-cell-selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined}
                      >
                        {/*
                          关键：用 <td> 里塞一个真 <button>，而不是给 <td> 加 role="button"。
                          给 td 加 role="button" 会把单元格从表格结构里摘出去，
                          读屏就播不出"第 3 行第 5 列"了 —— 表格语义和可操作性不该二选一。

                          点击处理只挂在按钮上，td 上不再挂 onClick：
                          两处都挂的话，点按钮会冒泡到 td，一次点击触发两遍、选中状态被立刻翻回去。
                          按钮用 display:block + width:100% 撑满单元格，点击面积和原来一样大。
                        */}
                        {clickable ? (
                          <button
                            type="button"
                            className="cell-json-btn"
                            onClick={toggle}
                            aria-pressed={isSelected}
                            title="点击查看 JSON 节点树"
                            aria-label={
                              `第 ${absoluteRow + 1} 行，字段 ${col.name}，JSON 内容。` +
                              (isSelected ? '按回车收起节点树' : '按回车展开节点树')
                            }
                          >
                            {renderCell(value, col.isJsonLike)}
                          </button>
                        ) : (
                          renderCell(value, col.isJsonLike)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-bar">
        <span>
          共 <b className="tnum">{formatNumber(rows.length)}</b> 行{rows.length >= 200 ? '（预览上限 200 行）' : ''} ·
          显示 <b className="tnum">{formatNumber(offset + 1)}</b>–
          <b className="tnum">{formatNumber(Math.min(offset + pageSize, rows.length))}</b>
        </span>

        <label className="grid-bar-size">
          每页
          <select
            className="input"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            aria-label="每页行数"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() =>
            downloadText(`${table.name}.csv`, toCsv(columns.map((c) => c.name), rows))
          }
        >
          <IconDownload size={13} />
          导出 CSV
        </button>

        <div className="pager">
          {/*
            四个按钮的可见文字只是 « ‹ › » 这几个符号，读屏会照字面念出来，
            用户听到的是"左书名号"而不是"上一页"。用 aria-label 给每个按钮一个真名字。
          */}
          <button
            type="button"
            className="pager-btn"
            onClick={() => go(0)}
            disabled={current === 0}
            aria-label="第一页"
          >
            «
          </button>
          <button
            type="button"
            className="pager-btn"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="上一页"
          >
            ‹
          </button>
          <span className="pager-page">
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="pager-btn"
            onClick={() => go(current + 1)}
            disabled={current >= pageCount - 1}
            aria-label="下一页"
          >
            ›
          </button>
          <button
            type="button"
            className="pager-btn"
            onClick={() => go(pageCount - 1)}
            disabled={current >= pageCount - 1}
            aria-label="最后一页"
          >
            »
          </button>
        </div>
      </div>
    </>
  );
}
