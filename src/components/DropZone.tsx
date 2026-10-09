/**
 * 文件拖入区（落地页）
 *
 * 支持三种进入方式：拖拽、点击选择、以及「载入示例数据」。
 * 关键点：拖拽必须阻止浏览器默认行为，否则浏览器会直接打开文件、
 * 把整个页面替换掉 —— 这是拖拽功能最常见的坑。
 *
 * 分析期间这里会从「上传卡片」变成「阶段清单」：
 * 光有一条百分比进度条时，用户不知道卡住的 40% 是在下载引擎还是在扫表；
 * 明确列出四个阶段并标出当前位置，等待才有意义。
 */
import { useCallback, useRef, useState } from 'react';
import {
  IconAlert,
  IconBraces,
  IconDatabase,
  IconGrid,
  IconLink,
  IconShield,
  IconUpload,
} from './Icons';
import { ANALYZE_STEPS, stageIndex, type AnalyzeProgress } from '../lib/stages';

export interface DropZoneProps {
  onFile: (file: File) => void;
  onSample: () => void;
  busy: boolean;
  progress: AnalyzeProgress | null;
  error: string | null;
}

const FEATURES = [
  {
    icon: <IconGrid size={15} />,
    title: '表结构全览',
    desc: '字段类型、主键、非空、默认值、索引一次看全',
  },
  {
    icon: <IconLink size={15} />,
    title: '关系一眼看清',
    desc: '自动读取外键，标出表与表之间的引用关系',
  },
  {
    icon: <IconBraces size={15} />,
    title: 'JSON 节点树',
    desc: 'JSON 字段自动识别，折叠成节点树逐层展开',
  },
  {
    icon: <IconShield size={15} />,
    title: '本地零上传',
    desc: '纯浏览器解析，数据库文件不离开你的电脑',
  },
];

export default function DropZone({ onFile, onSample, busy, progress, error }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsOver(false);
      if (busy) return;
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [busy, onFile],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    // 必须 preventDefault，否则 drop 事件不会触发
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);
  }, []);

  const handlePick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) onFile(file);
      // 重置，保证同一个文件再次选择时也能触发 change
      event.target.value = '';
    },
    [onFile],
  );

  return (
    <div className="dropstage">
      <div className="dropcard">
        <div
          className={`dropzone${isOver ? ' is-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="拖入或选择数据库文件"
          onKeyDown={(event) => {
            /*
             * 关键守卫：Enter / 空格可能来自**内层**的原生控件（这里是「选择文件」按钮）。
             *
             * 事件是从焦点元素冒泡上来的，所以按 Enter 激活内层按钮时，这里也会收到。
             * 如果不判断 event.target，就会：内层按钮先把文件选择框点开一次，
             * 这里又 event.preventDefault() + 再点一次 —— 一次按键弹两次选择框，
             * 而且 preventDefault 会把内层按钮自己的默认行为也一起掐掉。
             * 只在事件确实发生在这个容器本身（currentTarget === target）时才处理。
             */
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <div className="dropzone-mark" aria-hidden="true">
            {isOver ? <IconUpload size={24} /> : <IconDatabase size={24} />}
          </div>

          {/*
            分析中标题必须跟着换。原来按钮写着「正在分析…」而标题还是「把数据库文件拖进来」，
            用户会以为需要再拖一次，或者以为刚才那次没生效。
          */}
          <h1>
            {busy ? '正在分析你的数据库' : isOver ? '松手就开始解析' : '把数据库文件拖进来'}
          </h1>
          <p className="lead">
            {busy
              ? '全程在本机内存里完成，不需要联网也不需要等待上传 —— 大文件可能要几秒，下面会显示走到哪一步了。'
              : '自动解析出所有表、字段、主外键关系与 JSON 字段，图表化、可折叠地呈现给你。'}
          </p>
          <p className="hint">
            {busy ? (
              '关掉页面就会中断分析，请稍等几秒'
            ) : (
              <>
                支持 SQLite 单文件数据库（.sqlite / .db / .sqlite3 / .db3）
                <br />
                文件全程在浏览器本地解析，不会上传到任何服务器
              </>
            )}
          </p>

          <div className="dropzone-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <IconUpload size={14} />
              {busy ? '正在分析…' : '选择文件'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={onSample} disabled={busy}>
              先看看示例数据
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3,.db3,application/vnd.sqlite3,application/x-sqlite3"
            onChange={handlePick}
            hidden
          />

          {progress ? (
            <div className="dropzone-progress">
              <div className="dropzone-progress-text">
                <span>{ANALYZE_STEPS[stageIndex(progress.stage)]?.label ?? '分析完成'}</span>
                <b className="tnum">{Math.round(progress.ratio * 100)}%</b>
              </div>

              <div className="bar">
                <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>

              {/*
                role="list" + 显式序号：读屏用户听到的是"第 2 步，共 4 步"，
                而不是 4 个孤立的词。当前步用 aria-current="step" 标出。
              */}
              <ol className="steps">
                {ANALYZE_STEPS.map((step, i) => {
                  const current = stageIndex(progress.stage);
                  const done = i < current;
                  const isNow = i === current;
                  return (
                    <li
                      key={step.id}
                      className={`step${done ? ' is-done' : ''}${isNow ? ' is-current' : ''}`}
                      aria-current={isNow ? 'step' : undefined}
                    >
                      <span className="step-mark" aria-hidden="true">
                        {done ? '✓' : i + 1}
                      </span>
                      <span className="step-label">{step.label}</span>
                      {isNow ? (
                        <span className="step-hint">{progress.detail ?? step.hint}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              <div className="loading-foot">
                已用时 <b className="tnum">{(progress.elapsedMs / 1000).toFixed(1)}</b> 秒
              </div>
            </div>
          ) : null}

          <div className="dropzone-divider">你会看到</div>

          <div className="asset-grid">
            {FEATURES.map((feature) => (
              <div className="asset" key={feature.title}>
                {feature.icon}
                <div>
                  <b>{feature.title}</b>
                  <span>{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/*
          不加 role="alert"：这条错误由 App 的 setLive() 统一播报（全站唯一的 .sr-live 区），
          这里再加 role="alert" 会变成同一个错误被念两遍。
        */}
        {error ? (
          <div className="alert is-danger" style={{ marginTop: 16, marginBottom: 0 }}>
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
