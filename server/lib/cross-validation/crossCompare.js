'use strict';
/**
 * cross-validation/crossCompare.js
 * 交叉比对层 — Phase1 核心
 *
 * 职责：
 *   1. 接收每个体系对各维度的独立分析结果（perSystem）
 *   2. 按认识论分组（命盘/卦象）分别计算共识分 —— 两组绝不合并成一个数字
 *   3. 调用 LLM 生成跨体系比对叙述，使用硬编码禁令防止编造
 *   4. 返回结构化结果：两个独立 gauge + 逐维度判断 + 综合建议模板
 *
 * PRD 关键设计（不得违反）：
 *   • overallConsensus 只能枚举：STRONG_CONSENSUS / PARTIAL / SPLIT / DIVERGENT
 *   • 两个 gauge（birthGauge / momentGauge）禁止合并成单一数字
 *   • synthesisAdvice 使用固定模板："从命盘看X·从时机看Y·两者一致/不一致的含义"
 *   • 分歧是信息，不得用"整体倾向"掩盖
 */

const { deepseekChat } = require('../llm');
const { GROUP_BIRTH, GROUP_MOMENT, DIMENSIONS } = require('./systems');

// ── overallConsensus 枚举（后端校验，非法值触发 retry）──
const CONSENSUS_ENUM = {
  STRONG_CONSENSUS: 'STRONG_CONSENSUS', // ≥ 3/4 体系对该组维度一致
  PARTIAL:          'PARTIAL',          // 2/4 一致（偏向一方）
  SPLIT:            'SPLIT',            // 2v2 正面对立
  DIVERGENT:        'DIVERGENT',        // 体系间毫无共识
};
const VALID_CONSENSUS_VALUES = new Set(Object.values(CONSENSUS_ENUM));

/**
 * 校验 overallConsensus 是否为合法枚举值。
 * 非法则返回 DIVERGENT 并记录警告，触发上层 retry 逻辑。
 *
 * @param {string} value
 * @returns {string} 合法的枚举值
 */
function validateConsensus(value) {
  if (VALID_CONSENSUS_VALUES.has(value)) return value;
  console.warn(`[crossCompare] 非法 overallConsensus 值 "${value}"，降级为 DIVERGENT`);
  return CONSENSUS_ENUM.DIVERGENT;
}

/**
 * 交叉比对 prompt — hardcoded 诚实禁令（PRD 工程红线）。
 * 严禁 LLM 用"整体倾向"掩盖分歧；分歧是信息必须透传。
 *
 * @param {object} groupedResults  { birth: { bazi: dims, ziwei: dims }, moment: { qimen: dims, iching: dims } }
 * @param {'birth'|'moment'} groupKey
 * @returns {Array} messages 数组，传入 deepseekChat
 */
function buildCompareMessages(groupedResults, groupKey) {
  const perSystem = groupedResults[groupKey] || {};
  const groupLabel = groupKey === 'birth'
    ? 'Birth Chart systems (BaZi + Zi Wei — natal destiny layer)'
    : 'Moment Oracle systems (Qimen + I-Ching — current timing layer)';

  // TODO(Phase1): 填充完整 system prompt 和 user prompt
  // 关键硬编码禁令（必须原样保留）：
  //   "你是诚实比对器不是解释器·3:1就说3:1分歧·禁止用'整体倾向'掩盖·分歧是信息"
  //   "overallConsensus 只能是以下枚举之一: STRONG_CONSENSUS | PARTIAL | SPLIT | DIVERGENT"
  //   "体系一致 ≠ 预测成立，只是多视角共识"

  return [
    {
      role: 'system',
      content:
        `You are Runae's Cross-Check arbiter for the ${groupLabel}. ` +
        'You are a HONEST COMPARATOR, NOT an interpreter. ' +
        'HARD RULES: ' +
        '(1) If 3 systems agree and 1 disagrees, say "3:1 divergence" — do NOT say "overall tendency". ' +
        '(2) Divergence IS information — surface it, never smooth it over. ' +
        '(3) Systems agreeing does NOT prove a prediction is true — it only means multiple lenses converge. ' +
        '(4) overallConsensus MUST be exactly one of: STRONG_CONSENSUS | PARTIAL | SPLIT | DIVERGENT. ' +
        'English only. STRICT JSON output only.',
    },
    {
      role: 'user',
      content: [
        `Independent per-system readings (JSON):`,
        JSON.stringify(perSystem),
        '',
        `For EACH dimension (${DIMENSIONS.map(d => d.key).join(', ')}):`,
        '- status: "consensus" | "divergence" | "partial"',
        '- consensusScore: 0-100',
        '- summary: 1 honest sentence. For divergence: name what each system says.',
        '',
        // TODO(Phase1): 补充输出 schema 要求
        'Also give overallConsensus (must be one of the 4 enum values above).',
        'Return STRICT JSON only:',
        '{"overallConsensus":"PARTIAL","dimensions":{"career":{"status":"divergence","consensusScore":40,"summary":"..."}}}',
      ].join('\n'),
    },
  ];
}

/**
 * 综合建议模板（PRD 固定格式，不得改变结构）。
 * "从命盘看X · 从时机看Y · 两者一致/不一致的含义"
 *
 * @param {object} birthComparison   命盘组比对结果
 * @param {object} momentComparison  卦象组比对结果
 * @param {string} dimensionKey      career | wealth | love | health
 * @returns {string} 固定格式综合建议（传入 LLM 合成阶段）
 */
function synthesisAdviceTemplate(birthComparison, momentComparison, dimensionKey) {
  // TODO(Phase1): 实现模板拼装逻辑
  // 模板格式：
  //   "From natal chart (BaZi+ZiWei): [birth dim summary].
  //    From current timing (Qimen+IChing): [moment dim summary].
  //    These [agree / diverge]: [brief implication]."
  throw new Error('synthesisAdviceTemplate: TODO');
}

/**
 * 核心入口：运行交叉比对，返回两个独立 gauge 的结构化结果。
 *
 * @param {object} perSystem
 *   { bazi: {dims:{career,wealth,love,health}}, ziwei: {...}, qimen: {...}, iching: {...} }
 *   每个体系的 dims 值格式：{ verdict, confidence, reason }
 * @returns {Promise<{
 *   birthGauge: { overallConsensus, dimensions },
 *   momentGauge: { overallConsensus, dimensions },
 *   synthesisAdvice: { [dimensionKey]: string },
 *   disclaimer: string
 * }>}
 */
async function runCrossCompare(perSystem) {
  // TODO(Phase1): 实现完整流程：
  // 1. 按 group 拆分 perSystem → groupedResults
  // 2. 并行跑两组 LLM 比对（birthGroup + momentGroup）
  // 3. 校验 overallConsensus 枚举值（validateConsensus），非法则 retry 一次
  // 4. 逐维度生成 synthesisAdvice（调用 synthesisAdviceTemplate）
  // 5. 返回结构化结果

  // ── Step 1: 拆分 ──
  const groupedResults = {
    birth:  {},
    moment: {},
  };
  for (const [sysId, result] of Object.entries(perSystem)) {
    // TODO: 从 PHASE1_SYSTEMS 查 group
    // if (sys.group === GROUP_BIRTH)  groupedResults.birth[sysId]  = result.dims;
    // else                            groupedResults.moment[sysId] = result.dims;
  }

  // ── Step 2: 并行比对 (placeholder) ──
  // const [birthRaw, momentRaw] = await Promise.all([
  //   deepseekChat(buildCompareMessages(groupedResults, 'birth'),  { maxTokens: 600, temperature: 0.4 }),
  //   deepseekChat(buildCompareMessages(groupedResults, 'moment'), { maxTokens: 600, temperature: 0.4 }),
  // ]);

  // ── Step 3: 校验枚举 ──
  // const birthComparison  = JSON.parse(birthRaw);
  // birthComparison.overallConsensus = validateConsensus(birthComparison.overallConsensus);
  // ...

  // ── Step 4: synthesisAdvice ──
  // ...

  // ── Step 5: 返回 ──
  throw new Error('runCrossCompare: TODO — Phase1 implementation pending');
}

module.exports = {
  CONSENSUS_ENUM,
  validateConsensus,
  buildCompareMessages,
  synthesisAdviceTemplate,
  runCrossCompare,
};
