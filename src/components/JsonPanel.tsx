/**
 * JSON 节点面板
 *
 * 这是整个工具的差异点：把 JSON 当成一棵可折叠的「节点树」浏览，
 * 而不是把一坨字符串丢给用户自己看。
 *
 * 三种状态：
 *  1. 表里没有 JSON 字段 → 空状态
 *  2. 有 JSON 字段但还没选 → 列出所有可解析的单元格，点一下就展开
 *  3. 选中了 → 节点树 / 原始文本 双视图 + 搜索高亮
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconBraces, IconCopy, IconClose, IconSearch } from './Icons';
import JsonTree from './JsonTree';
import { copyText } from '../lib/format';
import type { SelectedCell } from './DataGrid';
import type { TableInfo } from '../lib/types';

/** 选择器里最多列出的候选单元格数量 */
const PICKER_LIMIT = 60;

export interface JsonPanelProps {
  table: TableInfo | null;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** 空态给出的下一步：切到数据预览 */
  onOpenData?: () => void;
  /** 空态给出的下一步：回到总览换一张表 */
  onOpenOverview?: () => void;
  /** 把结果播报给屏幕阅读器（全站唯一的 aria-live 区在 App 里） */
  onAnnounce?: (message: string) => void;
}

interface JsonEntry {
  row: number;
  column: string;
  snippet: string;
}

export default function JsonPanel({
  table,
  selectedCell,
  onSelectCell,
  query,
  onQueryChange,
  onOpenData,
  onOpenOverview,
  onAnnounce,
}: JsonPanelProps) {
  const [mode, setMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);

  /*
   * 「已复制」的复原定时器要在卸载时清掉，否则组件已经没了、
   * 1600ms 后还去 setState（React 18 不再警告，但属于没必要的副作用）。
   */
  const copyTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const jsonColumns = useMemo(
    () => (table ? table.columns.filter((c) => c.isJsonLike) : []),
    [table],
  );

  /** 枚举所有「值是 JSON 字符串」的单元格，供选择器使用 */
  const entries = useMemo<JsonEntry[]>(() => {
    if (!table) return [];
    const out: JsonEntry[] = [];
    for (const col of jsonColumns) {
      table.previewRows.forEach((row, rowIndex) => {
        const raw = row[col.name];
        if (typeof raw === 'string' && raw.trim().length > 1) {
          out.push({ row: rowIndex, column: col.name, snippet: raw.slice(0, 90) });
        }
      });
    }
    return out;
  }, [table, jsonColumns]);

  /** 当前选中的单元格解析出来的对象 */
  const selected = useMemo(() => {
    if (!table || !selectedCell) return null;
    const raw = table.previewRows[selectedCell.row]?.[selectedCell.column];
    if (typeof raw !== 'string') return null;
    let text = raw;
    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
      text = JSON.stringify(value, null, 2);
    } catch {
      return null;
    }
    return {
      path: `${table.name} · 第 ${selectedCell.row + 1} 行 · ${selectedCell.column}`,
      text,
      value,
    };
  }, [table, selectedCell]);

  const handleCopy = async () => {
    if (!selected) return;
    // 必须按真实结果播报：剪贴板 API 在非安全上下文里可能不可用，
    // 无条件说"已复制"会让用户粘出空白却不明白为什么。
    const ok = await copyText(selected.text);
    if (!ok) {
      onAnnounce?.('复制失败：当前环境不允许访问剪贴板，请手动选中文本复制');
      return;
    }
    setCopied(true);
    // 复制是"看不见结果"的操作：按钮文字会变，但读屏用户需要明确知道成功了
    onAnnounce?.('已复制 JSON 文本到剪贴板');
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  if (!table || jsonColumns.length === 0) {
    return (
      <section className="card">
        <div className="state">
          <div className="state-mark" aria-hidden="true">
            <IconBraces size={20} />
          </div>
          <b className="state-title">
            {table ? '这张表里没有检测到 JSON 字段' : '还没有选中任何表'}
          </b>
          <p className="state-desc">
            {table
              ? '判断方式是：字段声明类型含 JSON，或抽样到的字符串值能被 JSON.parse 成功解析。换一张表试试，或者到「数据预览」翻一翻实际内容。'
              : 'JSON 节点树是按表展开的。在总览里挑一张带 JSON 标记的表，就能逐层展开它的节点。'}
          </p>
          <div className="state-actions">
            {onOpenOverview ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onOpenOverview}>
                去总览挑一张表
              </button>
            ) : null}
            {onOpenData ? (
              <button type="button" className="btn btn-quiet btn-sm" onClick={onOpenData}>
                看看数据预览
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>选择要展开的 JSON 字段</h2>
          <span className="chip is-json">
            <IconBraces size={12} />
            {jsonColumns.length} 个字段 · {entries.length} 个单元格
          </span>
          <div className="spacer" />
          {entries.length > 0 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onSelectCell({ row: entries[0].row, column: entries[0].column })}
            >
              展开第一个
            </button>
          ) : null}
        </div>

        {entries.length === 0 ? (
          <div className="state">
            <div className="state-mark" aria-hidden="true">
              <IconBraces size={20} />
            </div>
            <b className="state-title">预览数据里没有可解析的 JSON 值</b>
            <p className="state-desc">
              字段被识别为 JSON 类型，但前 {table.previewRows.length} 行没有实际内容 ——
              可能是空值，也可能 JSON 藏在更深的行里。预览只取前 200 行，超出的部分不在这里。
            </p>
            <div className="state-actions">
              {onOpenData ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={onOpenData}>
                  回到数据预览
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="chip-row">
              <span className="chip-row-label">字段</span>
              {jsonColumns.map((col) => {
                const count = entries.filter((e) => e.column === col.name).length;
                const first = entries.find((e) => e.column === col.name);
                return (
                  <button
                    key={col.name}
                    type="button"
                    className="chip is-clickable"
                    onClick={() => first && onSelectCell({ row: first.row, column: first.column })}
                    disabled={!first}
                  >
                    {col.name}
                    <em>{count}</em>
                  </button>
                );
              })}
            </div>

            <div className="pick-grid">
              {entries.slice(0, PICKER_LIMIT).map((entry) => (
                <button
                  key={`${entry.row}-${entry.column}`}
                  type="button"
                  className="pick"
                  onClick={() => onSelectCell({ row: entry.row, column: entry.column })}
                >
                  <b>
                    第 {entry.row + 1} 行
                    <span className="pick-col">{entry.column}</span>
                  </b>
                  <span className="pick-snippet">{entry.snippet}</span>
                </button>
              ))}
            </div>

            {entries.length > PICKER_LIMIT ? (
              <div className="grid-bar">
                仅列出前 {PICKER_LIMIT} 个单元格，共 {entries.length} 个。也可以用「数据预览」里的表格直接点。
              </div>
            ) : null}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="jt-bar">
        <span className="jt-path" title={selected.path}>
          {selected.path}
        </span>

        <div className="seg" role="group" aria-label="展示方式">
          <button
            type="button"
            className={`seg-btn${mode === 'tree' ? ' is-active' : ''}`}
            onClick={() => setMode('tree')}
            /*
             * aria-pressed：按钮只靠背景色表示"当前选中"，读屏读不出这个状态。
             * 加了这个属性，读屏会念"节点树，按下"。
             */
            aria-pressed={mode === 'tree'}
          >
            节点树
          </button>
          <button
            type="button"
            className={`seg-btn${mode === 'raw' ? ' is-active' : ''}`}
            onClick={() => setMode('raw')}
            aria-pressed={mode === 'raw'}
          >
            原始文本
          </button>
        </div>

        <div className="spacer" />

        {mode === 'tree' ? (
          <div className="jt-search">
            <IconSearch size={14} />
            <input
              className="input"
              type="search"
              placeholder="搜关键词，命中自动展开"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="搜索 JSON 节点"
            />
          </div>
        ) : null}

        <button type="button" className="btn btn-quiet btn-sm" onClick={() => void handleCopy()}>
          <IconCopy size={13} />
          {copied ? '已复制' : '复制'}
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => onSelectCell(null)}
          aria-label="关闭 JSON 预览"
        >
          <IconClose size={13} />
          关闭
        </button>
      </div>

      {mode === 'tree' ? (
        /*
         * key 只跟单元格（selected.path）走，**不能带 query**。
         * 原来写成 selected.path + query，等于每敲一个字符就把整棵树重挂载一次：
         * 用户手动展开的层级、滚动位置、键盘焦点全被清空，搜第二个词时等于从头再来。
         * 搜索需要的"自动展开命中分支"是由 JsonTree 内部的 effective 集合算出来的，
         * 本来就不需要靠重挂载达成。
         */
        <JsonTree
          key={selected.path}
          value={selected.value}
          query={query}
          onMatchCount={(count, keyword) => {
            if (!keyword) return;
            onAnnounce?.(
              count > 0
                ? `关键词「${keyword}」命中 ${count} 个节点，已自动展开`
                : `关键词「${keyword}」没有命中任何节点`,
            );
          }}
        />
      ) : (
        <pre className="code-block scroll">{selected.text}</pre>
      )}
    </section>
  );
}
