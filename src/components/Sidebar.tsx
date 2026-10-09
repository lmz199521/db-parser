/**
 * 左侧表清单
 *
 * 相对朴素版的改进：
 *  - 顶部搜索框，表名与字段名都能命中（字段命中会标出来）
 *  - 表 / 视图分组，带计数
 *  - 每项显示行数 + 字段数 + JSON / 外键标记
 */
import { useMemo, useState } from 'react';
import { IconSearch, IconTable, IconView } from './Icons';
import { formatNumber } from '../lib/format';
import type { TableInfo } from '../lib/types';

export interface SidebarProps {
  tables: TableInfo[];
  views: TableInfo[];
  activeName: string | null;
  onSelect: (name: string) => void;
}

interface MatchResult {
  hit: TableInfo;
  /** 命中的字段名（用于提示"为什么这张表被搜出来"） */
  columnHits: string[];
}

function match(objects: TableInfo[], query: string): MatchResult[] {
  if (!query) return objects.map((hit) => ({ hit, columnHits: [] }));
  const needle = query.toLowerCase();
  return objects
    .map((table) => {
      const columnHits = table.columns
        .filter((c) => c.name.toLowerCase().includes(needle))
        .map((c) => c.name);
      const nameHit = table.name.toLowerCase().includes(needle);
      if (!nameHit && columnHits.length === 0) return null;
      return { hit: table, columnHits: nameHit ? [] : columnHits.slice(0, 3) };
    })
    .filter((item): item is MatchResult => item !== null);
}

function TableButton({
  table,
  columnHits,
  active,
  onSelect,
}: {
  table: TableInfo;
  columnHits: string[];
  active: boolean;
  onSelect: (name: string) => void;
}) {
  const jsonColumns = table.columns.filter((c) => c.isJsonLike).length;
  return (
    <button
      type="button"
      className={`tbl-item${active ? ' is-active' : ''}`}
      onClick={() => onSelect(table.name)}
      aria-current={active ? 'true' : undefined}
    >
      <span className="tbl-row">
        <span className="tbl-name" title={table.name}>
          {table.name}
        </span>
        <span className="tbl-count">{formatNumber(table.rowCount)}</span>
      </span>
      <span className="tbl-tags">
        <span className="tag">{table.columns.length} 字段</span>
        {jsonColumns > 0 ? <span className="tag is-json">JSON {jsonColumns}</span> : null}
        {table.foreignKeys.length > 0 ? (
          <span className="tag is-fk">外键 {table.foreignKeys.length}</span>
        ) : null}
        {columnHits.length > 0 ? (
          <span className="tag is-hit" title={columnHits.join('、')}>
            字段 {columnHits[0]}
            {columnHits.length > 1 ? ` +${columnHits.length - 1}` : ''}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function Sidebar({ tables, views, activeName, onSelect }: SidebarProps) {
  const [query, setQuery] = useState('');

  const matchedTables = useMemo(() => match(tables, query.trim()), [tables, query]);
  const matchedViews = useMemo(() => match(views, query.trim()), [views, query]);
  const empty = matchedTables.length === 0 && matchedViews.length === 0;

  return (
    <nav className="sidebar" aria-label="表清单">
      <div className="sidebar-head">
        <div className="sidebar-search">
          <IconSearch size={14} />
          <input
            className="input"
            type="search"
            placeholder="搜索表名或字段名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索表或字段"
          />
        </div>
      </div>

      <div className="sidebar-body">
        {empty ? (
          <p className="sidebar-empty">没有匹配的表或字段</p>
        ) : (
          <>
            {matchedTables.length > 0 ? (
              <>
                <div className="sidebar-group">
                  <IconTable size={12} />
                  表 <em>{matchedTables.length}</em>
                </div>
                {matchedTables.map(({ hit, columnHits }) => (
                  <TableButton
                    key={hit.name}
                    table={hit}
                    columnHits={columnHits}
                    active={hit.name === activeName}
                    onSelect={onSelect}
                  />
                ))}
              </>
            ) : null}

            {matchedViews.length > 0 ? (
              <>
                <div className="sidebar-group">
                  <IconView size={12} />
                  视图 <em>{matchedViews.length}</em>
                </div>
                {matchedViews.map(({ hit, columnHits }) => (
                  <TableButton
                    key={hit.name}
                    table={hit}
                    columnHits={columnHits}
                    active={hit.name === activeName}
                    onSelect={onSelect}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </nav>
  );
}
