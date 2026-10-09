/**
 * JSON 节点树
 *
 * 这是整个工具的差异点所在：把 JSON 当成一棵可折叠的「节点树」来浏览，
 * 而不是把一坨字符串丢给用户自己看。支持：
 *  - 逐层折叠 / 展开
 *  - 关键词搜索，命中节点自动展开并高亮
 *  - 超大数组 / 对象分批渲染，避免一次性渲染上万节点
 *  - **完整键盘操作**（WAI-ARIA tree 模式）
 *
 * 键盘模型说明（改造重点）：
 * 改造前每个节点的展开按钮写着 tabIndex={-1}，而且树里没有任何元素可聚焦 ——
 * 键盘用户能看到这棵树，却一个节点都打不开，等于功能对键盘用户完全不存在。
 * 现在按 WAI-ARIA 的 tree 模式重做：
 *  - roving tabindex：整棵树在 Tab 顺序里只占**一个**停留点，由 focusPath 决定是谁；
 *  - ↑ / ↓ 在同一层级与上下相邻的可见节点间移动；
 *  - → 展开当前节点（已展开则进入第一个子节点）；
 *  - ← 折叠当前节点（已折叠则回到父节点）；
 *  - Enter / Space 切换展开状态；Home / End 跳到树的首尾；
 *  - aria-level / aria-setsize / aria-posinset 让读屏能播报"第 2 层，第 3 项，共 8 项"。
 *
 * 「可见节点」的判定必须和渲染完全一致，否则按 ↓ 会跳到屏幕上看不见的节点上。
 * 因此渲染与键盘导航共用下面这个 visibleLimit() 分批规则。
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

/** 单个集合一次最多渲染的子节点数，超出部分按需加载 */
const CHILD_BATCH = 100;

/**
 * 路径段转义（RFC 6901 JSON Pointer 的做法：`~` → `~0`，`/` → `~1`）。
 *
 * 拼路径时用的是 `父路径 + '/' + key`。如果 key 本身含 `/`（JSON 里完全合法，
 * 比如 `{"user/name": "张三"}`），`a/b` 这个键就会和「a 下面的 b」拼出同一个字符串：
 *   - 展开一个节点，另一个跟着展开；
 *   - 键盘 ↓ 停在重叠位置上，按下一次不动。
 * 把 key 里的 `~` 和 `/` 先转义掉，`/` 就只可能是分隔符，路径唯一。
 * 路径只在内部当索引使用，不展示给用户，所以转义不影响可读性。
 */
function encodeKey(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

type Kind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'other';

function kindOf(value: unknown): Kind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'other';
  }
}

function entriesOf(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v] as [string, unknown]);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>);
  }
  return [];
}

function isCollection(value: unknown): boolean {
  const k = kindOf(value);
  return k === 'object' || k === 'array';
}

function collectionLabel(value: unknown): string {
  const k = kindOf(value);
  if (k === 'array') return `Array(${(value as unknown[]).length})`;
  if (k === 'object') return `{ ${Object.keys(value as object).length} 项 }`;
  return '';
}

/**
 * 某个集合实际渲染出来的子节点数。
 * 渲染和键盘导航都必须走这个函数 —— 两处规则一旦不一致，按 ↓ 就会跳到看不见的节点。
 */
function visibleLimit(path: string, total: number, shown: Record<string, number>): number {
  return Math.min(shown[path] ?? CHILD_BATCH, total);
}

/** 收集命中的节点路径，以及为展示命中项需要自动展开的祖先路径 */
function findMatches(value: unknown, query: string) {
  const matched = new Set<string>();
  const expand = new Set<string>();

  const walk = (node: unknown, path: string, keyLabel: string) => {
    const keyHit = keyLabel.toLowerCase().includes(query);
    const valueHit =
      typeof node === 'string' ? node.toLowerCase().includes(query) : false;
    const isLeaf = !isCollection(node);
    if (keyHit || (valueHit && isLeaf)) matched.add(path);

    for (const [childKey, childValue] of entriesOf(node)) {
      walk(childValue, `${path}/${encodeKey(childKey)}`, childKey);
    }
  };

  walk(value, 'root', 'root');

  for (const path of matched) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      expand.add(parts.slice(0, i).join('/'));
    }
  }

  return { matched, expand };
}

/* ------------------------- 可见节点扁平列表 ------------------------- */

interface FlatNode {
  path: string;
  level: number;
  parentPath: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

/** 按渲染顺序（即 ↑↓ 的移动顺序）展开成一维列表 */
function buildFlat(
  value: unknown,
  expanded: Set<string>,
  shown: Record<string, number>,
): FlatNode[] {
  const list: FlatNode[] = [];

  const walk = (node: unknown, path: string, level: number, parentPath: string | null) => {
    const collection = isCollection(node);
    const kids = collection ? entriesOf(node) : [];
    const open = collection && expanded.has(path);

    list.push({ path, level, parentPath, hasChildren: collection, expanded: open });
    if (!open) return;

    const limit = visibleLimit(path, kids.length, shown);
    for (let i = 0; i < limit; i += 1) {
      walk(kids[i][1], `${path}/${encodeKey(kids[i][0])}`, level + 1, path);
    }
  };

  walk(value, 'root', 1, null);
  return list;
}

function escapeAttr(value: string): string {
  // CSS.escape 在目标浏览器里都可用；留一个最小兜底，避免表达式在旧环境里直接抛错
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\\]]/g, '\\$&');
}

/* ------------------------------- 渲染 ------------------------------- */

interface TreeCtx {
  expanded: Set<string>;
  matched: Set<string>;
  query: string;
  shown: Record<string, number>;
  focusPath: string;
  onToggle: (path: string) => void;
  onShowMore: (path: string) => void;
}

interface NodeProps {
  keyLabel: string;
  value: unknown;
  path: string;
  level: number;
  /** 在同级里的位置（1 起），对应 aria-posinset */
  posInSet: number;
  /** 同级总数量，对应 aria-setsize */
  setSize: number;
  ctx: TreeCtx;
}

/** 标量值（字符串 / 数字 / 布尔 / null）的渲染 */
function Scalar({ value }: { value: unknown }) {
  const k = kindOf(value);
  if (k === 'null') return <span className="jt-null">null</span>;
  if (k === 'string') return <span className="jt-string">"{String(value)}"</span>;
  if (k === 'number') return <span className="jt-number">{String(value)}</span>;
  if (k === 'boolean') return <span className="jt-boolean">{String(value)}</span>;
  return <span className="jt-meta">{String(value)}</span>;
}

function NodeBase({ keyLabel, value, path, level, posInSet, setSize, ctx }: NodeProps) {
  const collection = isCollection(value);
  const kids = collection ? entriesOf(value) : [];
  const isOpen = collection && ctx.expanded.has(path);
  const isHit = ctx.matched.has(path) && ctx.query.length > 0;
  const limit = collection ? visibleLimit(path, kids.length, ctx.shown) : 0;
  const visible = kids.slice(0, limit);
  const focused = ctx.focusPath === path;

  return (
    <div
      className={`jt-node${isHit ? ' is-hit' : ''}`}
      role="treeitem"
      data-path={path}
      aria-level={level}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      aria-expanded={collection ? isOpen : undefined}
      /*
       * roving tabindex：整棵树只有一个节点 tabIndex=0。
       * 焦点落在 treeitem 本身（而不是里面的三角按钮）—— 三角按钮是纯装饰，
       * 真正的展开动作由 Enter / Space / → 在 treeitem 上处理，鼠标点击仍可用。
       */
      tabIndex={focused ? 0 : -1}
    >
      {/*
        折叠三角是纯装饰：它不参与 Tab 顺序，也不再是一个 <button>。
        改造前它是个 tabIndex={-1} 的按钮 + aria-hidden，属于"藏在无障碍树里但还能点"的
        灰色地带。现在展开动作有两个入口，都不依赖它：
          - 键盘：treeitem 上的 Enter / Space / ← / →
          - 鼠标与手指：点这一整行
        触屏上尤其重要 —— 一个 15px 宽的小三角，拇指根本点不准。
      */}
      <span
        className={collection ? 'jt-line is-branch' : 'jt-line'}
        onClick={collection ? () => ctx.onToggle(path) : undefined}
      >
        <span className="jt-toggle" aria-hidden="true">
          {collection ? (isOpen ? '▾' : '▸') : ' '}
        </span>
        <span className="jt-head">
          <span className="jt-key">{keyLabel}</span>
          <span className="jt-meta">:</span>
        </span>
        {/*
          值和集合摘要都放在 .jt-line 里面。
          改造前它们挂在 .jt-line 外面，导致"命中高亮"只盖住了「key:」这一小截，
          值那一半还是原色 —— 高亮看起来像没生效。放进来之后高亮和焦点环才覆盖整行。
        */}
        <span className="jt-val">
          {collection ? <span className="jt-meta">{collectionLabel(value)}</span> : <Scalar value={value} />}
        </span>
      </span>

      {collection && isOpen ? (
        <>
          <div className="jt-group" role="group">
            {visible.map(([childKey, childValue], i) => (
              <Node
                key={`${path}/${encodeKey(childKey)}`}
                keyLabel={childKey}
                value={childValue}
                path={`${path}/${encodeKey(childKey)}`}
                level={level + 1}
                posInSet={i + 1}
                setSize={kids.length}
                ctx={ctx}
              />
            ))}
          </div>
          {kids.length > limit ? (
            <div className="jt-more">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => ctx.onShowMore(path)}
                aria-label={`继续加载「${keyLabel}」剩余 ${kids.length - limit} 项，共 ${kids.length} 项`}
              >
                继续加载剩余 {kids.length - limit} 项
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/*
 * memo：节点树的 props 几乎都是稳定引用（value 来自解析后的 JSON、path 是字符串、
 * ctx 在外面用 useMemo 固定住），所以父组件因为无关状态重渲染时（比如复制按钮的
 * "已复制" toast、搜索框以外的输入），整棵树可以直接跳过比较。
 * 递归子节点用的也是这个 memo 版本，否则只有第一层受益。
 */
const Node = memo(NodeBase);

export interface JsonTreeProps {
  value: unknown;
  /** 搜索关键词，命中节点会自动展开并高亮 */
  query?: string;
  /** 默认展开层数 */
  defaultExpandDepth?: number;
  /**
   * 命中数变化时通知外层（用于屏幕阅读器播报"命中 N 个节点"）。
   * 视觉上命中的节点会变黄，但读屏用户看不见颜色变化，必须有人替它说出来。
   */
  onMatchCount?: (count: number, query: string) => void;
}

export default function JsonTree({
  value,
  query = '',
  defaultExpandDepth = 2,
  onMatchCount,
}: JsonTreeProps) {
  const normalized = query.trim().toLowerCase();
  const { matched, expand } = useMemo(
    () =>
      normalized
        ? findMatches(value, normalized)
        : { matched: new Set<string>(), expand: new Set<string>() },
    [value, normalized],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const seed = (node: unknown, path: string, depth: number) => {
      if (!isCollection(node) || depth > defaultExpandDepth) return;
      set.add(path);
      for (const [childKey, childValue] of entriesOf(node)) {
        seed(childValue, `${path}/${encodeKey(childKey)}`, depth + 1);
      }
    };
    seed(value, 'root', 1);
    return set;
  });

  /** path -> 已渲染的子节点数（「继续加载」按钮用） */
  const [shown, setShown] = useState<Record<string, number>>({});
  /** 当前持有 Tab 焦点 / 键盘光标所在的节点 */
  const [focusPath, setFocusPath] = useState('root');

  // 搜索时把命中的分支自动展开，但不影响用户手动折叠出来的状态
  const effective = useMemo(() => {
    if (!normalized) return expanded;
    return new Set<string>([...expanded, ...expand, ...matched]);
  }, [expanded, expand, matched, normalized]);

  const flat = useMemo(() => buildFlat(value, effective, shown), [value, effective, shown]);

  const indexOfPath = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((node, i) => map.set(node.path, i));
    return map;
  }, [flat]);

  const treeRef = useRef<HTMLDivElement | null>(null);
  const shouldRefocus = useRef(false);

  /** 移动键盘光标；实际 focus() 交给下面的 effect，等重渲染把新节点挂上 DOM 之后再执行 */
  const moveFocus = (path: string) => {
    shouldRefocus.current = true;
    setFocusPath(path);
  };

  const onToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const onShowMore = useCallback((path: string) => {
    setShown((prev) => ({ ...prev, [path]: (prev[path] ?? CHILD_BATCH) + CHILD_BATCH }));
  }, []);

  /*
   * 展开一个新节点时，目标元素在本次渲染前还不存在，所以不能在按键回调里直接 focus()。
   * 用 ref 标记"这次渲染后需要把焦点放到 focusPath"，渲染完成后再查 DOM。
   */
  useEffect(() => {
    if (!shouldRefocus.current) return;
    shouldRefocus.current = false;
    const root = treeRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>(`[data-path="${escapeAttr(focusPath)}"]`) ??
      root.querySelector<HTMLElement>('[data-path="root"]');
    target?.focus();
  });

  /**
   * 键盘导航。
   *
   * 挂在容器上做事件委托，而不是给每个节点绑一份 handler ——
   * 一棵上千节点的树会因此多出上千个监听器，且每次展开都要重绑。
   */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    /*
     * 先放行真正的交互控件。
     *
     * 委托挂在整棵树的容器上，树的内部还嵌着「继续加载剩余 N 项」这种真按钮。
     * 在按钮上按 Enter / Space 时，事件会冒泡到这里：如果不先返回，
     *   - closest('.jt-node') 会拿到按钮所属的那个节点（不是按钮本身）；
     *   - 于是 Enter 被当成"展开/折叠这个节点"，还把 preventDefault() 打了，
     *     连按钮自己的默认点击也一起掐掉 —— 用户想加载更多，结果是把父节点折叠了。
     * 交互控件自己会处理键盘，委托这层必须让路。
     */
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;

    const nodeEl = target.closest<HTMLElement>('.jt-node');
    if (!nodeEl) return;
    const path = nodeEl.dataset.path;
    if (!path) return;
    const i = indexOfPath.get(path);
    if (i === undefined) return;

    const node = flat[i];
    const inTree = treeRef.current?.contains(nodeEl) ?? false;
    if (!inTree) return;

    const toggle = () => {
      onToggle(path);
      // 展开后焦点留在原节点（符合 ARIA 建议：→ 展开但不移动）
      shouldRefocus.current = true;
      setFocusPath(path);
    };

    switch (event.key) {
      case 'ArrowDown': {
        const next = flat[Math.min(i + 1, flat.length - 1)];
        if (next && next.path !== path) moveFocus(next.path);
        break;
      }
      case 'ArrowUp': {
        const prev = flat[Math.max(i - 1, 0)];
        if (prev && prev.path !== path) moveFocus(prev.path);
        break;
      }
      case 'ArrowRight': {
        if (!node.hasChildren) break;
        if (!node.expanded) toggle();
        else {
          const first = flat[i + 1];
          if (first && first.parentPath === path) moveFocus(first.path);
        }
        break;
      }
      case 'ArrowLeft': {
        if (node.hasChildren && node.expanded) toggle();
        else if (node.parentPath) moveFocus(node.parentPath);
        break;
      }
      case 'Home': {
        const first = flat[0];
        if (first && first.path !== path) moveFocus(first.path);
        break;
      }
      case 'End': {
        const last = flat[flat.length - 1];
        if (last && last.path !== path) moveFocus(last.path);
        break;
      }
      case 'Enter':
      case ' ':
        if (!node.hasChildren) break;
        toggle();
        break;
      default:
        // 其余按键（含 Tab）交回浏览器，别把用户困在树里
        return;
    }

    event.preventDefault();
  };

  /*
   * 命中数变化时上报。
   * 依赖里带上 onMatchCount 会让它在父组件每次渲染时都重跑一遍，
   * 但上报的内容（count + keyword）没变的话父级 setState 也不会引起可见变化，
   * 所以这里用 ref 存最新的回调，依赖只留 [matched, normalized]。
   */
  const announceRef = useRef(onMatchCount);
  announceRef.current = onMatchCount;
  useEffect(() => {
    if (!normalized) return;
    announceRef.current?.(matched.size, normalized);
  }, [matched, normalized]);

  /*
   * ctx 每次渲染都新建一个对象的话，Node 的 memo 就完全失效了（引用永远不等）。
   * 用 useMemo 把它固定住：只有真正会影响渲染的这些值变了才换新对象。
   */
  const resolvedFocusPath = indexOfPath.has(focusPath) ? focusPath : 'root';
  const ctx = useMemo<TreeCtx>(
    () => ({
      expanded: effective,
      matched,
      query: normalized,
      shown,
      focusPath: resolvedFocusPath,
      onToggle,
      onShowMore,
    }),
    [effective, matched, normalized, shown, resolvedFocusPath, onToggle, onShowMore],
  );

  return (
    <div className="jsontree" role="tree" ref={treeRef} onKeyDown={onKeyDown} aria-label="JSON 节点树">
      {/*
        单一 tabIndex=0 的停靠点由 ctx.focusPath 决定。若 focusPath 指向的节点
        因折叠而不在列表里（例如刚折叠了它的祖先），退回到根节点，避免出现
        "整棵树没有任何一个可 Tab 到的元素"的死角。
        —— 这一步在上面算 resolvedFocusPath 时已经做了。
      */}
      <Node keyLabel="root" value={value} path="root" level={1} posInSet={1} setSize={1} ctx={ctx} />
    </div>
  );
}
