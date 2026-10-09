/**
 * 数据库放大镜 —— 主界面
 *
 * 数据流：
 *   File ──arrayBuffer──▶ Uint8Array ──sql.js──▶ DatabaseReport ──▶ 可视化 UI
 *
 * 信息架构（v2）：
 *   左侧：表清单（可搜索）
 *   右侧：总览 / 数据预览 / 字段结构 / JSON 节点 / SQL 查询 五个 Tab
 *   —— 不再把五块内容一屏滚到底，用户点到哪看到哪。
 *
 * 所有解析都在浏览器里完成，文件不会经过任何服务器。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import DropZone from './components/DropZone';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import OverviewPanel from './components/OverviewPanel';
import JsonPanel from './components/JsonPanel';
import QueryPanel, { type QueryResult } from './components/QueryPanel';
import DataGrid, { type SelectedCell } from './components/DataGrid';
import SchemaSection from './components/SchemaSection';
import {
  IconAlert,
  IconBraces,
  IconColumns,
  IconGrid,
  IconTable,
  IconTerminal,
  IconUpload,
} from './components/Icons';
import {
  analyzeSqliteFile,
  countJsonColumns,
  isSqliteFile,
  MAX_FILE_BYTES,
  preloadSqlJs,
  releaseQueryDb,
  runQuery,
} from './lib/sqlite';
import { ANALYZE_STEPS, stageIndex, type AnalyzeProgress } from './lib/stages';
import { formatBytes, formatDuration, formatNumber } from './lib/format';
import { useTheme } from './hooks/useTheme';
import type { DatabaseReport } from './lib/types';

type TabId = 'overview' | 'data' | 'schema' | 'json' | 'sql';

/** Tab 顺序即键盘左右方向键的移动顺序，两处必须一致，所以只写一份 */
const TAB_ORDER: readonly TabId[] = ['overview', 'data', 'schema', 'json', 'sql'];

const TAB_LABEL: Record<TabId, string> = {
  overview: '总览',
  data: '数据预览',
  schema: '字段结构',
  json: 'JSON 节点',
  sql: 'SQL 查询',
};

const ACCEPTED_EXT = /\.(db|sqlite|sqlite3|db3|sqlite2)$/i;

/**
 * 屏幕阅读器播报区。
 *
 * 全站只保留这一个 —— 多个 aria-live 同时说话会互相打断，反而听不清。
 * 视觉上 1px 藏在角落里（.sr-live），键盘用户不会碰到它。
 */
function LiveRegion({ message }: { message: string }) {
  return (
    <div className="sr-live" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<DatabaseReport | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** 屏幕阅读器播报文案（全站唯一播报区，见 LiveRegion） */
  const [live, setLiveRaw] = useState('');

  /*
   * 播报时的一个坑：`aria-live` 只在**文本真的变化**时才念。
   * 连续两次"已复制 SQL 语句到剪贴板"，第二次 setState 的值和上次相同，
   * React 会直接跳过这次更新 —— DOM 没变，读屏一声不吭，用户以为没生效。
   * 所以这里记下上一句说过的话：内容一样就追加一个不可见的零宽空格（U+200B），
   * 制造一次真实变更，读屏才会重念。
   * 包装成 setLive 让所有调用点（含传给子组件的 onAnnounce）都不用改。
   */
  const liveSeqRef = useRef({ text: '', repeat: 0 });
  const setLive = useCallback((message: string) => {
    const prev = liveSeqRef.current;
    const repeat = prev.text === message ? prev.repeat + 1 : 0;
    liveSeqRef.current = { text: message, repeat };
    setLiveRaw(repeat > 0 ? `${message}${'\u200B'.repeat(repeat)}` : message);
  }, []);

  const [jsonQuery, setJsonQuery] = useState('');
  const [sqlText, setSqlText] = useState('');
  const [sqlResult, setSqlResult] = useState<QueryResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlBusy, setSqlBusy] = useState(false);

  /* ------------------------------ 数据加载 ------------------------------ */

  /** 分析开始的时刻，用于「真实累加秒表」 */
  const analyzeStartRef = useRef(0);

  /*
   * 运行令牌：每次开始一次新的分析就自增。
   *
   * 为什么需要：分析是异步的（下载引擎 → 读文件 → 扫表）。用户连着拖两个文件时，
   * 第一次的 await 还在路上，第二次已经开始了。等第一次的 Promise 落地，
   * 它会用**旧结果**去 setReport / setBusy —— 屏幕上就出现"文件是 B，内容是 A"。
   * 每次发车领一个号，落地时号不对就整包丢掉，只让最新那次说话。
   */
  const runIdRef = useRef(0);
  const supersede = useCallback(() => {
    runIdRef.current += 1;
    return runIdRef.current;
  }, []);

  /*
   * 真实秒表。
   *
   * 刻意不做"预计剩余 Xs"：剩余时间只能靠"当前进度 ÷ 已耗时"外推，
   * 而分析耗时分布极不均匀（下载引擎、跑 COUNT(DISTINCT) 各占一段），
   * 外推出来的数字会 3s→40s→8s 乱跳。只报"已经花了多久"这个确定的事实。
   */
  useEffect(() => {
    if (!busy) return undefined;
    const id = window.setInterval(() => {
      setProgress((prev) =>
        prev ? { ...prev, elapsedMs: performance.now() - analyzeStartRef.current } : prev,
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [busy]);

  const analyze = useCallback(
    async (buf: Uint8Array, fileName: string, runId: number) => {
      setBusy(true);
      setError(null);
      setReport(null);
      setSelectedCell(null);
      setSqlResult(null);
      setSqlError(null);
      setJsonQuery('');
      setTab('overview');
      analyzeStartRef.current = performance.now();
      setProgress({ stage: 'engine', ratio: 0, elapsedMs: 0 });
      setLive(`开始分析 ${fileName}`);
      try {
        const result = await analyzeSqliteFile(buf, {
          fileName,
          onProgress: (stage, ratio, detail) => {
            // 已被更新的一次分析顶替：进度条属于旧任务，别再往界面上写了
            if (runIdRef.current !== runId) return;
            setProgress({
              stage,
              ratio,
              detail,
              elapsedMs: performance.now() - analyzeStartRef.current,
            });
          },
        });
        // 结果落地前再确认一次"我还是当前任务"，否则整包丢弃
        if (runIdRef.current !== runId) return;
        setBytes(buf);
        setReport(result);
        const first = result.tables[0] ?? result.views[0];
        setActiveName(first?.name ?? null);
        setSqlText(`SELECT * FROM "${first?.name ?? 'sqlite_master'}" LIMIT 50;`);
        setLive(
          `分析完成：${result.tables.length} 张表、${result.views.length} 个视图，共 ${formatNumber(
            result.totalRows,
          )} 行数据，耗时 ${formatDuration(result.elapsedMs)}`,
        );
      } catch (err) {
        if (runIdRef.current !== runId) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(
          `解析失败：${message}。如果是加密数据库或损坏文件，浏览器端无法打开。`,
        );
        setLive(`解析失败：${message}`);
      } finally {
        // 只有当前任务才有资格收起忙碌态；被顶替的旧的 finally 不能把新的进度条关掉
        if (runIdRef.current === runId) {
          setBusy(false);
          setProgress(null);
        }
      }
    },
    [setLive],
  );

  /*
   * 阶段变化时播报。依赖只写 stage/detail：progress 每 100ms 会因秒表刷新一次，
   * 如果依赖整个对象，读屏会被"正在分析「orders」"这条重复念几十遍。
   */
  const progressStage = progress?.stage;
  const progressDetail = progress?.detail;
  useEffect(() => {
    if (!progressStage) return;
    const index = stageIndex(progressStage);
    /*
     * 'done' 不是"第 5 个阶段"—— 它不在清单里，stageIndex 会返回清单长度。
     * 不拦的话，`ANALYZE_STEPS[index]?.label ?? '分析中'` 会在分析真正结束的那一刻
     * 播报一句"分析中"，和紧接着的"分析完成：N 张表…"自相矛盾。
     * 完成消息由 analyze() 自己负责播。
     */
    if (index >= ANALYZE_STEPS.length) return;
    const label = ANALYZE_STEPS[index].label;
    setLive(progressDetail ? `${label}：${progressDetail}` : label);
  }, [progressStage, progressDetail, setLive]);

  const handleFile = useCallback(
    async (file: File) => {
      // 领一个号：本次之后的任何异步落地都要先核对这个号
      const runId = supersede();
      setError(null);
      if (!ACCEPTED_EXT.test(file.name)) {
        const message = `「${file.name}」看起来不是 SQLite 数据库文件。浏览器端只能直接读取 SQLite 单文件库 —— MySQL / PostgreSQL 是「客户端 + 服务端」结构，文件本身不含数据，浏览器无法直接打开。`;
        setError(message);
        setLive(`无法打开：${message}`);
        return;
      }
      try {
        /*
         * 体积闸门放在 arrayBuffer() **之前**：读一个 1.5GB 的文件要好几秒，
         * 读完再说不支持，用户白白等了一场，内存也白占了一次。
         * file.size 是元数据，取它是瞬时的。
         */
        if (file.size > MAX_FILE_BYTES) {
          const message = `「${file.name}」有 ${formatBytes(file.size)}，超过了浏览器端能处理的 ${formatBytes(
            MAX_FILE_BYTES,
          )} 上限。整份文件必须一次性读进内存，再大就可能让标签页卡死。`;
          setError(message);
          setLive(`无法打开：${message}`);
          return;
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        // 读文件也要时间（大文件几百毫秒），期间用户可能又拖了新的
        if (runIdRef.current !== runId) return;
        if (!isSqliteFile(buf)) {
          const message = `「${file.name}」的文件头不是 SQLite 格式，无法解析。可能不是 SQLite 库、或者文件被加密/损坏。`;
          setError(message);
          setLive(`无法打开：${message}`);
          return;
        }
        await analyze(buf, file.name, runId);
      } catch (err) {
        if (runIdRef.current !== runId) return;
        const message = `读取文件失败：${err instanceof Error ? err.message : String(err)}`;
        setError(message);
        setLive(message);
      }
    },
    [analyze, setLive, supersede],
  );

  const handleSample = useCallback(async () => {
    const runId = supersede();
    try {
      setBusy(true);
      setError(null);
      analyzeStartRef.current = performance.now();
      setProgress({ stage: 'engine', ratio: 0.02, detail: '正在下载示例数据库…', elapsedMs: 0 });
      const res = await fetch(`${import.meta.env.BASE_URL}sample.sqlite`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (runIdRef.current !== runId) return;
      await analyze(buf, '示例：电商订单库.sqlite', runId);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(`加载示例数据失败：${message}`);
      setLive(`加载示例数据失败：${message}`);
    } finally {
      if (runIdRef.current === runId) {
        setBusy(false);
        setProgress(null);
      }
    }
  }, [analyze, setLive, supersede]);

  const reset = useCallback(() => {
    /*
     * 先作废在途分析：分析没法真正中断（WASM 在主线程里跑），
     * 但可以让它落地时被令牌拦下，不再往已经清空的界面上写结果。
     */
    supersede();
    setBusy(false);
    setProgress(null);
    releaseQueryDb(); // 释放内存里的数据库连接，别一直挂着
    setBytes(null);
    setReport(null);
    setActiveName(null);
    setSelectedCell(null);
    setError(null);
    setSqlResult(null);
    setSqlError(null);
    setJsonQuery('');
    setTab('overview');
    setLive('已清空当前数据库，可以拖入新文件');
  }, [setLive, supersede]);

  /* ------------------------------- 派生值 ------------------------------- */

  const allObjects = useMemo(
    () => (report ? [...report.tables, ...report.views] : []),
    [report],
  );

  const active = useMemo(() => {
    if (allObjects.length === 0) return null;
    return allObjects.find((t) => t.name === activeName) ?? allObjects[0];
  }, [allObjects, activeName]);

  const jsonColumnCount = useMemo(() => (report ? countJsonColumns(report) : 0), [report]);

  const activeJsonCount = useMemo(
    () => (active ? active.columns.filter((c) => c.isJsonLike).length : 0),
    [active],
  );

  const selectTable = useCallback(
    (name: string) => {
      setActiveName(name);
      setSelectedCell(null);
      setJsonQuery('');
      setTab('data');
      // 切表时视图整块换了内容，读屏用户需要知道"现在看的是哪张表"
      setLive(`已切换到表 ${name}`);
    },
    [setLive],
  );

  const toggleTheme = useCallback(() => {
    toggle();
    setLive(theme === 'dark' ? '已切换到亮色主题' : '已切换到暗色主题');
  }, [theme, toggle, setLive]);

  const handleRunSql = useCallback(async () => {
    if (!bytes) return;
    const sql = sqlText.trim();
    if (!sql) return;
    setSqlBusy(true);
    setSqlError(null);
    try {
      // 注意：改动只发生在这个内存副本里，不会写回到用户的文件
      setSqlResult(await runQuery(bytes, sql));
    } catch (err) {
      setSqlResult(null);
      setSqlError(err instanceof Error ? err.message : String(err));
    } finally {
      setSqlBusy(false);
    }
  }, [bytes, sqlText]);

  /* ------------------------------ Tab 键盘 ------------------------------ */

  /*
   * roving tabindex：Tab 条在页面 Tab 顺序里只占**一个**停留点，正好是当前选中的那个。
   * 用 ↑↓←→ 在 Tab 之间移动，而不是让用户按 Tab 键穿过 5 个按钮。
   * 这是 WAI-ARIA 对 tablist 推荐的做法，也让键盘用户少按 4 次 Tab。
   */
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = TAB_ORDER.length - 1;
      let next: number;
      switch (event.key) {
        case 'ArrowRight':
          next = index === last ? 0 : index + 1;
          break;
        case 'ArrowLeft':
          next = index === 0 ? last : index - 1;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = last;
          break;
        default:
          // 其余按键（含 Tab 本身）交回浏览器处理
          return;
      }
      event.preventDefault();
      // 自动激活：面板渲染成本很低，没必要多一步"先移动焦点、再按 Enter 确认"
      setTab(TAB_ORDER[next]);
      tabRefs.current[next]?.focus();
    },
    [],
  );

  /* ------------------------------ 体力活前置 ------------------------------ */

  // 首页空闲时就把 WASM 引擎预下载好，用户真拖文件进来时不用等
  const preloaded = useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    preloadSqlJs();
  }, []);

  /* ------------------------------- 深链 ------------------------------- */

  // ?sample=1 自动载入示例数据，方便演示与自动化截图
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('sample')) void handleSample();
    // 只在首次挂载时执行，故意留空依赖数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoJson = useMemo(
    () => new URLSearchParams(window.location.search).has('json'),
    [],
  );

  // ?json=1 自动选中第一个 JSON 单元格并切到 JSON Tab（演示 / 截图用）
  useEffect(() => {
    if (!autoJson || !report) return;
    const target = [...report.tables, ...report.views].find(
      (t) => t.previewRows.length > 0 && t.columns.some((c) => c.isJsonLike),
    );
    const column = target?.columns.find((c) => c.isJsonLike);
    if (!target || !column) return;
    setActiveName(target.name);
    setSelectedCell({ row: 0, column: column.name });
    setTab('json');
  }, [autoJson, report]);

  /* --------------------------- 全局拖拽（工作区内） --------------------------- */

  useEffect(() => {
    /*
     * 这里刻意**不**按 report 是否存在来决定要不要挂监听。
     *
     * 原先是 `if (!report) return;`，问题出在「重新分析」：analyze() 一开头就把 report
     * 清成 null（好让界面回到落地页看进度），于是全局这几个 dragover/drop 兜底全部撤掉。
     * 此时用户把文件拖到页面空白处，浏览器会执行默认行为 —— 直接把文件在新标签页里打开，
     * 整个应用被替换掉。改成一挂到底：任何时刻拖拽都被接住，不会跳走。
     *
     * 落地页本来就有 DropZone 自己处理拖拽（那层会 stopPropagation，
     * 所以事件不会冒泡到 window，不会重复触发）。
     */
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setDragOver(true);
    };
    const onDragLeave = (event: DragEvent) => {
      // relatedTarget 为 null 说明真的离开了窗口
      if (event.relatedTarget === null) setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  /* -------------------------------- 渲染 -------------------------------- */

  if (!report) {
    return (
      <div className="app">
        <LiveRegion message={live} />
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          report={null}
          jsonColumnCount={0}
          busy={busy}
          progress={progress}
          onReset={reset}
        />
        <DropZone
          onFile={handleFile}
          onSample={handleSample}
          busy={busy}
          progress={progress}
          error={error}
        />
      </div>
    );
  }

  // 顺序由 TAB_ORDER 决定（键盘左右方向键也用它），这里只提供各自的计数
  const tabCounts: Record<TabId, number | undefined> = {
    overview: allObjects.length,
    data: active?.previewRows.length,
    schema: active?.columns.length,
    json: activeJsonCount,
    sql: undefined,
  };

  return (
    <div className="app">
      <LiveRegion message={live} />

      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        report={report}
        jsonColumnCount={jsonColumnCount}
        busy={busy}
        progress={progress}
        onReset={reset}
      />

      <div className="workspace">
        <Sidebar
          tables={report.tables}
          views={report.views}
          activeName={active?.name ?? null}
          onSelect={selectTable}
        />

        <main className="main">
          <div className="main-head">
            <div className="shell">
              <div className="main-head-top">
                <div className="main-head-title">
                  <h1 className="main-title">
                    {tab === 'overview' ? '数据库总览' : active?.name ?? '—'}
                    {tab !== 'overview' && active?.kind === 'view' ? (
                      <span className="chip is-view">视图</span>
                    ) : null}
                    {tab !== 'overview' && activeJsonCount > 0 ? (
                      <span className="chip is-json">
                        <IconBraces size={12} />
                        {activeJsonCount} 个 JSON 字段
                      </span>
                    ) : null}
                    {tab !== 'overview' && active && !active.rowCountExact ? (
                      <span className="chip">行数估算</span>
                    ) : null}
                  </h1>
                  <div className="main-sub">
                    {report.fileName} · {formatBytes(report.fileSize)} · SQLite{' '}
                    {report.sqliteVersion} · 分析耗时 {formatDuration(report.elapsedMs)}
                  </div>
                </div>
              </div>

              {/*
                tabs-wrap 负责横向滚动与两侧渐隐，tabs 只负责布局。
                窄屏 5 个 Tab 会超出宽度，没有这层就只能换行或裁掉，
                换行会让吸顶区高度变化、内容跟着跳。
              */}
              <div className="tabs-wrap">
                <nav className="tabs" role="tablist" aria-label="视图切换">
                  {TAB_ORDER.map((id, index) => (
                    <button
                      key={id}
                      ref={(el) => {
                        tabRefs.current[index] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`tab-${id}`}
                      aria-selected={tab === id}
                      /*
                       * 面板是条件渲染的：同一时刻只有当前 Tab 那个 panel-xxx 存在于 DOM 里。
                       * 给 5 个 Tab 都写死 aria-controls，其中 4 个就指向了不存在的 id ——
                       * 读屏跟着这个引用去跳转会落空。只给当前选中的 Tab 加。
                       */
                      aria-controls={tab === id ? `panel-${id}` : undefined}
                      // roving tabindex：只有当前选中的 Tab 在 Tab 顺序里
                      tabIndex={tab === id ? 0 : -1}
                      className={`tab${tab === id ? ' is-active' : ''}`}
                      onClick={() => setTab(id)}
                      onKeyDown={(event) => onTabKeyDown(event, index)}
                    >
                      {TAB_LABEL[id]}
                      {typeof tabCounts[id] === 'number' ? (
                        <span className="tab-count">{tabCounts[id]}</span>
                      ) : null}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          <div className="main-body">
            <div
              /*
               * key={tab}：让面板在切换时重新挂载，140ms 淡入动画才会重播。
               * 这里不会额外损失状态 —— 面板本来就是条件渲染的，
               * 切走时子组件已经卸载了。
               */
              key={tab}
              className="shell tabpanel"
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              /*
               * 面板本身可聚焦：Tab 到面板后按 ↓ 能直接进入内容区滚动，
               * 而不是被迫一路 Tab 穿过面板里所有控件才能读到正文。
               */
              tabIndex={0}
            >
              {/*
                不加 role="alert"：它是隐式的 aria-live="assertive"，
                而这条错误已经由 setLive() 送进全站唯一的 .sr-live 播报区了。
                两处都播 = 同一句错误被念两遍（assertive 先打断、polite 再补一遍）。
              */}
              {error ? (
                <div className="alert is-danger">
                  <IconAlert size={16} />
                  <span>{error}</span>
                </div>
              ) : null}

              {tab === 'overview' ? (
                <OverviewPanel
                  report={report}
                  jsonColumnCount={jsonColumnCount}
                  onOpenTable={selectTable}
                  onOpenSchema={() => setTab('schema')}
                />
              ) : null}

              {tab === 'data' ? (
                !active ? (
                  <section className="card">
                    <div className="state">
                      <div className="state-mark" aria-hidden="true">
                        <IconTable size={20} />
                      </div>
                      <b className="state-title">这个数据库里没有可预览的表</b>
                      <p className="state-desc">
                        文件能正常打开，但里面没有普通表 —— 可能只含 SQLite 系统表，
                        数据全都放在视图里。
                      </p>
                      <div className="state-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                          <IconUpload size={13} />
                          换个文件
                        </button>
                        {report.views.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm"
                            onClick={() => setTab('overview')}
                          >
                            看看 {report.views.length} 个视图
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="card">
                    <div className="card-head">
                      <h2>
                        <IconGrid size={14} />
                        数据预览
                      </h2>
                      <span className="chip">前 {formatNumber(active.previewRows.length)} 行</span>
                      <div className="spacer" />
                      <span className="card-note">
                        {active.previewRows.some((r) =>
                          active.columns.some((c) => c.isJsonLike && typeof r[c.name] === 'string'),
                        )
                          ? '点击带 JSON 标记的单元格可展开节点树'
                          : '只读展示，不会修改你的文件'}
                      </span>
                    </div>
                    {active.error ? (
                      <div className="alert is-warn" style={{ margin: 16, marginBottom: 0 }}>
                        <IconAlert size={16} />
                        <span>这张表的部分信息未能读取：{active.error}</span>
                      </div>
                    ) : null}
                    <DataGrid
                      table={active}
                      selectedCell={selectedCell}
                      onSelectCell={setSelectedCell}
                      onOpenJson={() => setTab('json')}
                      onOpenSchema={() => setTab('schema')}
                    />
                  </section>
                )
              ) : null}

              {tab === 'schema' ? (
                !active ? (
                  <section className="card">
                    <div className="state">
                      <div className="state-mark" aria-hidden="true">
                        <IconColumns size={20} />
                      </div>
                      <b className="state-title">还没有可查看的表</b>
                      <p className="state-desc">
                        字段结构是逐表展示的。左侧选一张表，就能看到它的字段类型、主外键与索引。
                      </p>
                      <div className="state-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                          <IconUpload size={13} />
                          换个文件
                        </button>
                      </div>
                    </div>
                  </section>
                ) : (
                  <SchemaSection table={active} onAnnounce={setLive} />
                )
              ) : null}

              {tab === 'json' ? (
                <JsonPanel
                  table={active}
                  selectedCell={selectedCell}
                  onSelectCell={setSelectedCell}
                  query={jsonQuery}
                  onQueryChange={setJsonQuery}
                  onOpenData={() => setTab('data')}
                  onOpenOverview={() => setTab('overview')}
                  onAnnounce={setLive}
                />
              ) : null}

              {tab === 'sql' ? (
                <QueryPanel
                  tables={report.tables}
                  sql={sqlText}
                  onSqlChange={setSqlText}
                  result={sqlResult}
                  error={sqlError}
                  busy={sqlBusy}
                  onRun={() => void handleRunSql()}
                  onAnnounce={setLive}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      {dragOver ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-card">
            <IconUpload size={26} />
            <b>松手即可分析新文件</b>
            <span>当前分析结果会被替换，磁盘上的原文件不受影响</span>
          </div>
        </div>
      ) : null}

      <footer className="app-foot">
        <span>
          <IconTerminal size={12} />
          纯前端解析 · 文件不上传
        </span>
        <span className="app-foot-sep">·</span>
        <span>支持 SQLite / .db / .sqlite3</span>
      </footer>
    </div>
  );
}
