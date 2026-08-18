'use strict';
/**
 * cross-validation/systems.js
 * 体系登记表 — Phase1 扩展版
 *
 * 在现有 routes/cross-check.js 的 SYSTEMS 数组基础上，增加：
 *   • qimen  — 奇门遁甲 (问卦时刻，async)
 *   • iching — 六爻易经 (问卦时刻，async)
 *
 * 认识论分组（关键：不能把两组合并成一个数字）：
 *   GROUP_BIRTH  = 命盘类（八字 + 紫微）—— 以出生时刻为坐标，论人生底色。
 *   GROUP_MOMENT = 卦象类（奇门 + 六爻）—— 以提问时刻为坐标，论当前时机。
 *
 * 下游 crossCompare.js 必须分两组独立计算共识分，
 * 绝不把 GROUP_BIRTH 和 GROUP_MOMENT 混在同一 gauge 里。
 */

const { computeBaziChart } = require('../bazi-engine');
const { computeQimen }     = require('../qimen-engine');
const { computeLiuyao }    = require('../liuyao-engine');
const { buildQimenBlock }  = require('../qimen-engine/prompt-block');
const { buildLiuyaoBlock } = require('../liuyao-engine/prompt-block');

// ── 交叉验证固定维度（所有体系必须就这几个维度出结论，才能对齐比对）──
const DIMENSIONS = [
  { key: 'career', label: 'Career & Purpose'       },
  { key: 'wealth', label: 'Wealth & Resources'      },
  { key: 'love',   label: 'Love & Relationships'    },
  { key: 'health', label: 'Health & Vitality'       },
];

// ── 认识论分组常量 ──
const GROUP_BIRTH  = 'birth_chart';   // 命盘类：八字 / 紫微
const GROUP_MOMENT = 'moment_oracle'; // 卦象类：奇门 / 六爻

// ── Phase1 体系定义 ──
// 每个体系必须实现：
//   id        {string}   唯一标识
//   name      {string}   展示名
//   group     {string}   GROUP_BIRTH | GROUP_MOMENT
//   buildBlock {async function(input):string}  返回排盘文本（LLM 只解读，禁止自排）
//
// input 结构：
//   birth_chart 组：{ birthChart }  —— computeBaziChart() 的完整结果
//   moment_oracle 组：{ queryDate } —— Date 对象，问卦时刻

const PHASE1_SYSTEMS = [
  // ────────────────────────────────────────
  // GROUP_BIRTH：命盘类（以出生时刻为坐标）
  // ────────────────────────────────────────
  {
    id: 'bazi',
    name: 'BaZi (Four Pillars)',
    group: GROUP_BIRTH,
    /**
     * 从 computeBaziChart 结果提取八字排盘文本。
     * 与 routes/cross-check.js 原有 buildBlock 完全等价；
     * 集中到此处方便统一维护。
     *
     * @param {{ birthChart: object }} input
     * @returns {string}
     */
    async buildBlock({ birthChart }) {
      // TODO(Phase1): 将 routes/cross-check.js 中 bazi.buildBlock 的逻辑迁移至此
      // 参考：cross-check.js line 39-54
      throw new Error('bazi.buildBlock: TODO — migrate from routes/cross-check.js bazi entry');
    },
  },
  {
    id: 'ziwei',
    name: 'Zi Wei Dou Shu (Purple Star)',
    group: GROUP_BIRTH,
    /**
     * 从 computeBaziChart 结果提取紫微斗数排盘文本（ziwei 字段）。
     * 与 routes/cross-check.js 原有 buildBlock 完全等价。
     *
     * @param {{ birthChart: object }} input
     * @returns {string}
     */
    async buildBlock({ birthChart }) {
      // TODO(Phase1): 将 routes/cross-check.js 中 ziwei.buildBlock 的逻辑迁移至此
      // 参考：cross-check.js line 59-76
      throw new Error('ziwei.buildBlock: TODO — migrate from routes/cross-check.js ziwei entry');
    },
  },

  // ────────────────────────────────────────
  // GROUP_MOMENT：卦象类（以提问时刻为坐标）
  // ────────────────────────────────────────
  {
    id: 'qimen',
    name: 'Qimen Dunjia (奇门遁甲)',
    group: GROUP_MOMENT,
    /**
     * 奇门遁甲排盘文本 — 用当前提问时刻起局。
     *
     * @param {{ queryDate: Date }} input
     * @returns {Promise<string>}
     */
    async buildBlock({ queryDate }) {
      // TODO(Phase1): 调用 computeQimen({ date: queryDate }) 然后调 buildQimenBlock
      // 模板：
      //   const chart = await computeQimen({ date: queryDate, method: 'zhuanpan', scope: 'hour' });
      //   return buildQimenBlock({ chart });
      throw new Error('qimen.buildBlock: TODO — wire computeQimen + buildQimenBlock');
    },
  },
  {
    id: 'iching',
    name: 'I-Ching Liuyao (六爻易经)',
    group: GROUP_MOMENT,
    /**
     * 六爻排盘文本 — 用当前提问时刻自动起卦（不传 yaoArray，引擎按时间起卦）。
     *
     * @param {{ queryDate: Date }} input
     * @returns {Promise<string>}
     */
    async buildBlock({ queryDate }) {
      // TODO(Phase1): 调用 computeLiuyao({ date: queryDate }) 然后调 buildLiuyaoBlock
      // 模板：
      //   const chart = await computeLiuyao({ date: queryDate });
      //   return buildLiuyaoBlock({ chart });
      throw new Error('iching.buildBlock: TODO — wire computeLiuyao + buildLiuyaoBlock');
    },
  },
];

module.exports = {
  DIMENSIONS,
  GROUP_BIRTH,
  GROUP_MOMENT,
  PHASE1_SYSTEMS,
};
