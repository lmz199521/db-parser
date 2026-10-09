/**
 * 总览面板
 *
 * 拖入文件后第一眼看到的东西：KPI 卡片 + 数据库元信息 + 表卡片网格。
 * 点任意一张表卡片 → 直接跳到该表的「数据预览」Tab。
 */
import {
  IconBraces,
  IconClock,
  IconColumns,
  IconDatabase,
  IconRows,
  IconShield,
  IconTable,
  IconView,
} from './Icons';
import { formatBytes, formatDuration, formatNumber } from '../lib/format';
import { allObjectsOf, allRowCountsExact, sumRowCount } from '../lib/sqlite';
import type { DatabaseReport, TableInfo } from '../lib/types';

export interface OverviewPanelProps {
  report: DatabaseReport;
  jsonColumnCount: number;
  onOpenTable: (name: string) => void;
  /** 全库没有表时的下一步：去字段结构看看 */
  onOpenSchema?: () => void;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-row">
      <span className="meta-k">{label}</span>
      <span className="meta-v">{value}</span>
    </div>
  );
}

function TableCard({
  table,
  onOpen,
}: {
  table: TableInfo;
  onOpen: (name: string) => void;
}) {
  const jsonColumns = table.columns.filter((c) => c.isJsonLike).length;
  return (
    <button type="button" className="table-card" onClick={() => onOpen(table.name)}>
      <span className="table-card-top">
        <span className="table-card-icon" aria-hidden="true">
          {table.kind === 'view' ? <IconView size={15} /> : <IconTable size={15} />}
        </span>
        <span className="table-card-name" title={table.name}>
          {table.name}
        </span>
        {table.kind === 'view' ? <span className="chip is-view">视图</span> : null}
      </span>
      <span className="table-card-stats">
        <span>
          <b>{formatNumber(table.rowCount)}</b>
          行
        </span>
        <span>
          <b>{table.columns.length}</b>
          字段
        </span>
        <span>
          <b>{table.foreignKeys.length}</b>
          外键
        </span>
        {jsonColumns > 0 ? (
          <span>
            <b>{jsonColumns}</b>
            JSON
          </span>
        ) : null}
      </span>
      {!table.rowCountExact ? <span className="table-card-note">行数为估算值</span> : null}
      {table.error ? <span className="table-card-note is-warn">部分信息未能读取</span> : null}
    </button>
  );
}

export default function OverviewPanel({
  report,
  jsonColumnCount,
  onOpenTable,
  onOpenSchema,
}: OverviewPanelProps) {
  /*
   * 口径与顶栏、与 report.totalRows 共用同一实现，避免"同一屏三个总行数"。
   * 估算值照实累加：超 200MB 的库每张表都走 MAX(rowid) 估算，
   * 只累加精确值会让 30 万行的库显示「总行数 0 行」。
   */
  const allObjects = allObjectsOf(report);
  const fieldCount = allObjects.reduce((sum, t) => sum + t.columns.length, 0);
  const fkCount = allObjects.reduce((sum, t) => sum + t.foreignKeys.length, 0);
  const totalRows = sumRowCount(allObjects);
  const rowsExact = allRowCountsExact(allObjects);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <IconTable size={14} />
            数据表
          </div>
          <div className="kpi-value">{formatNumber(report.tables.length)}</div>
          <div className="kpi-foot">
            {report.views.length > 0 ? `另有 ${report.views.length} 个视图` : '无视图'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <IconRows size={14} />
            总行数
          </div>
          <div className="kpi-value">
            {rowsExact ? '' : '约 '}
            {formatNumber(totalRows)}
            <span className="kpi-unit">行</span>
          </div>
          <div className="kpi-foot">{rowsExact ? '精确统计' : '含估算值（大文件按 rowid 估算）'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <IconColumns size={14} />
            字段总数
          </div>
          <div className="kpi-value">{formatNumber(fieldCount)}</div>
          <div className="kpi-foot">{fkCount > 0 ? `${fkCount} 条外键约束` : '无外键约束'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <IconBraces size={14} />
            JSON 字段
          </div>
          <div className="kpi-value">{formatNumber(jsonColumnCount)}</div>
          <div className="kpi-foot">
            {jsonColumnCount > 0 ? '可折叠成节点树查看' : '未检测到 JSON 字段'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <IconClock size={14} />
            解析耗时
          </div>
          <div className="kpi-value">
            {formatDuration(report.elapsedMs)}
          </div>
          <div className="kpi-foot">分析于 {report.analyzedAt}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>数据库信息</h2>
          <span className="chip">
            <IconDatabase size={12} />
            SQLite {report.sqliteVersion}
          </span>
          <div className="spacer" />
          <span className="chip is-ok">
            <IconShield size={12} />
            未上传任何数据
          </span>
        </div>
        <div className="card-body pad">
          <div className="meta-grid">
            <MetaRow label="文件名" value={report.fileName} />
            <MetaRow label="文件体积" value={formatBytes(report.fileSize)} />
            <MetaRow
              label="页大小 × 页数"
              value={`${formatNumber(report.pageSize)} B × ${formatNumber(report.pageCount)}`}
            />
            <MetaRow label="文本编码" value={report.encoding} />
          </div>

          {/*
           * 窄屏专属台账（≤860px 显示，桌面端整块隐藏）。
           *
           * 顶栏右那条统计条在窄屏被隐藏 —— 品牌 + 主题切换 + 「换个文件」已经占满一行，
           * 再塞四个数字会把品牌挤成省略号。但数字本身不能凭空消失：
           * 一旦用户切到「数据预览」以外的 Tab，顶栏就是唯一的常驻位置。
           * 所以把它们固化进这张常驻的信息卡，等于给窄屏留一本随时能翻的台账。
           *
           * 桌面端不重复展示，避免和上面的 KPI 卡片唱双簧。
           */}
          <div className="meta-grid is-compact-stats">
            <MetaRow label="数据表" value={`${formatNumber(report.tables.length)} 张`} />
            <MetaRow
              label="总行数"
              value={`${rowsExact ? '' : '约'}${formatNumber(totalRows)} 行${rowsExact ? '' : '（含估算）'}`}
            />
            <MetaRow label="JSON 字段" value={`${formatNumber(jsonColumnCount)} 个`} />
            <MetaRow label="解析耗时" value={formatDuration(report.elapsedMs)} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>表与视图</h2>
          <span className="chip">{allObjects.length} 个对象</span>
          <div className="spacer" />
          <span className="card-note">点任意一张卡片可查看它的数据与结构</span>
        </div>
        {allObjects.length === 0 ? (
          <div className="state">
            <div className="state-mark" aria-hidden="true">
              <IconTable size={20} />
            </div>
            <b className="state-title">这个数据库里没有表</b>
            <p className="state-desc">
              文件能正常打开，但表清单是空的 —— 可能里面只包含 sqlite_ 开头的系统表
              （系统表不在分析范围内），也可能数据全放在视图里。
            </p>
            <div className="state-actions">
              {onOpenSchema ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={onOpenSchema}>
                  <IconColumns size={13} />
                  去字段结构看看
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="table-cards">
            {allObjects.map((table) => (
              <TableCard key={table.name} table={table} onOpen={onOpenTable} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
