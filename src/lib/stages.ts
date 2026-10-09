/**
 * 分析流程的阶段定义（UI 与引擎共享）
 *
 * 为什么单独抽一个模块：引擎需要按顺序上报阶段，UI 需要把阶段渲染成清单，
 * 两边一旦各写一份，改了一处忘了另一处就会出现"进度停在第三步但清单说在第二步"。
 * 这里作为唯一事实来源。
 *
 * 设计背景：分析一个几百 MB 的库可能要好几秒，只给一条百分比进度条，
 * 用户无法判断"卡住的 40%"到底是在下载引擎、还是在扫一张 30 万行的表。
 * 明确列出四个阶段并标出当前所处位置，等待才有意义。
 */
import type { AnalyzeStage } from './sqlite';

export interface StageDef {
  id: AnalyzeStage;
  /** 阶段名，用于清单标题 */
  label: string;
  /** 这个阶段在做什么的解释性文案 */
  hint: string;
}

export const ANALYZE_STEPS: readonly StageDef[] = [
  {
    id: 'engine',
    label: '加载解析引擎',
    hint: '首次使用需要下载约 640KB 的 WASM 引擎，之后走浏览器缓存',
  },
  {
    id: 'open',
    label: '打开数据库',
    hint: '在浏览器内存里建立连接，文件不会离开你的电脑',
  },
  {
    id: 'analyze',
    label: '逐表分析',
    hint: '读取表结构、主外键、索引，并计算字段画像',
  },
  {
    id: 'summarize',
    label: '汇总结果',
    hint: '标注哪些统计是精确值、哪些是抽样估算',
  },
] as const;

/** 当前阶段在清单里的下标；'done' 或未知阶段返回清单长度（表示全部走完） */
export function stageIndex(stage: AnalyzeStage): number {
  const i = ANALYZE_STEPS.findIndex((s) => s.id === stage);
  return i === -1 ? ANALYZE_STEPS.length : i;
}

/** 分析进度快照：阶段 + 总进度 + 真实耗时 */
export interface AnalyzeProgress {
  stage: AnalyzeStage;
  /** 阶段内部的细分说明，例如「正在分析「orders」」 */
  detail?: string;
  /** 总进度 0..1 */
  ratio: number;
  /**
   * 从点击开始累计的真实耗时（毫秒）。
   * 用真实秒表而不是"根据进度估算剩余时间"——后者在遇到大表时会剧烈跳变，
   * 报一个一直在改的数字，比不报更让人焦虑。
   */
  elapsedMs: number;
}
