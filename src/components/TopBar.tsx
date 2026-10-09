/**
 * 顶部栏
 *
 * 两种形态：
 *  - 落地页：只有品牌 + 主题切换
 *  - 工作区：品牌 + 数据库统计 + 主题切换 + 「换个文件」
 *
 * busy 时在底边显示一条进度线（不占用布局高度，避免内容跳动）。
 */
import { IconClose, IconDatabase, IconMoon, IconSpark, IconSun } from './Icons';
import { formatDuration, formatNumber } from '../lib/format';
import { allObjectsOf, allRowCountsExact, sumRowCount } from '../lib/sqlite';
import { ANALYZE_STEPS, stageIndex, type AnalyzeProgress } from '../lib/stages';
import type { DatabaseReport } from '../lib/types';
import type { Theme } from '../hooks/useTheme';

export interface TopBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  report: DatabaseReport | null;
  jsonColumnCount: number;
  busy: boolean;
  progress: AnalyzeProgress | null;
  onReset: () => void;
}

export default function TopBar({
  theme,
  onToggleTheme,
  report,
  jsonColumnCount,
  busy,
  progress,
  onReset,
}: TopBarProps) {
  /*
   * 行数口径必须和总览的 KPI 卡片**共用同一个实现**（sumRowCount / allRowCountsExact），
   * 否则同一屏上会出现两个互相打架的「总行数」——顶栏说 929（只算表），
   * KPI 卡说 1009（表 + 视图），用户第一反应是"这工具的数算错了"，信任直接塌掉。
   *
   * 统计范围固定为「表 + 视图」，且**估算值一并累加**：以前只累加精确值，
   * 文件超 200MB（每张表都退化成 MAX(rowid) 估算）时顶栏会显示「0 行数据」。
   * 是否可能出现估算值，交给 rowsExact 决定要不要加提示。
   */
  const allObjects = report ? allObjectsOf(report) : [];
  const totalRows = sumRowCount(allObjects);
  const rowsExact = allRowCountsExact(allObjects);

  const percent = Math.round((progress?.ratio ?? 0.03) * 100);

  return (
    /*
     * is-busy：分析进行中。此时右侧的统计数字是"上一份文件"的，不能让人误读成新结果，
     * 所以降一级亮度；同时把「换个文件」锁住 —— 分析中途重置会让新报告落到已清空的界面上。
     */
    <header className={`topbar${busy ? ' is-busy' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <IconDatabase size={17} />
        </span>
        <span className="brand-name">数据库放大镜</span>
        {report ? null : <span className="brand-sub">拖入文件，看懂数据库</span>}
      </div>

      <div className="topbar-spacer" />

      {report ? (
        <div className="topbar-stats" aria-hidden={busy ? 'true' : undefined}>
          <div className="topbar-stat">
            <b>{formatNumber(report.tables.length)}</b>张表
          </div>
          <div
            className="topbar-stat"
            title={rowsExact ? undefined : '含估算值：文件超过 200MB 时行数改为按 MAX(rowid) 估算'}
          >
            <b>{formatNumber(totalRows)}</b>行数据{rowsExact ? '' : '（估）'}
          </div>
          <div className="topbar-stat">
            <b>{formatNumber(jsonColumnCount)}</b>个 JSON 字段
          </div>
          <div className="topbar-stat">
            <b>{formatDuration(report.elapsedMs)}</b>解析耗时
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
      >
        {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
      </button>

      {report ? (
        <>
          <span className="topbar-sep" aria-hidden="true" />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onReset}
            disabled={busy}
            title={busy ? '分析进行中，完成后再换' : undefined}
          >
            {busy ? <span className="spin" aria-hidden="true" /> : <IconClose size={14} />}
            换个文件
          </button>
        </>
      ) : (
        <span className="topbar-pill" title="文件全程在浏览器本地解析">
          <IconSpark size={13} />
          纯本地解析
        </span>
      )}

      {busy ? (
        <div
          className="progress-line"
          role="progressbar"
          aria-label="分析进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          /* 具体文字交给下方/播报区，进度条本身只负责视觉 */
          aria-valuetext={`${percent}%，${
            ANALYZE_STEPS[stageIndex(progress?.stage ?? 'engine')]?.label ?? '分析中'
          }`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </header>
  );
}
