'use strict';
/**
 * cross-validation/systemAnalysis.js
 * 各体系独立分析层 — Phase1
 *
 * 职责：
 *   每个体系独立从排盘文本 → LLM 就四维度出结论（verdict/confidence/reason）。
 *   体系之间完全并行，互不影响，体现"多个独立视角"的护城河。
 *
 * PRD 约束：
 *   • maxTokens 分层：单体系分析 ≤ 600 token
 *   • 任一体系失败只警告不中断，但最少需要 2 个体系成功才能进入比对层
 *   • 禁止 LLM 自排——排盘文本必须由真引擎生成后传入
 */

const { deepseekChat } = require('../llm');
const { DIMENSIONS, PHASE1_SYSTEMS, GROUP_BIRTH, GROUP_MOMENT } = require('./systems');

// ── 每体系独立分析 prompt ──
// 与 routes/cross-check.js 的 systemAnalysisMessages 等价，但加了 maxTokens 分层标注
function buildSystemAnalysisMessages(system, block) {
  const dimList = DIMENSIONS.map(d => `"${d.key}" (${d.label})`).join(', ');
  return [
    {
      role: 'system',
      content:
        `You are a ${system.name} reader for Runae. ` +
        'You interpret ONLY the pre-computed chart data provided — ' +
        'you MUST NOT recompute or invent any chart element. ' +
        'Ground every conclusion in the given data. ' +
        'Be honest and non-fatalistic: describe tendencies and probabilities, never certainties. ' +
        'English only.',
    },
    {
      role: 'user',
      content: [
        block,
        '',
        `For EACH of these dimensions: ${dimList}`,
        'give: a one-word verdict, a 0-100 confidence, and one concrete sentence of reasoning tied to the chart data.',
        'verdict must be a short label the reader can compare across systems.',
        'Return STRICT JSON only, no prose:',
        '{"career":{"verdict":"...","confidence":78,"reason":"..."},"wealth":{...},"love":{...},"health":{...}}',
      ].join('\n'),
    },
  ];
}

/**
 * 解析 LLM 输出的 JSON（带防御性提取）。
 * @param {string} text
 * @returns {object}
 */
function parseAnalysisJson(text) {
  const m = text && text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM did not return valid JSON');
  return JSON.parse(m[0]);
}

/**
 * 对单体系执行分析。
 *
 * @param {object} system   PHASE1_SYSTEMS 中的体系定义
 * @param {object} input    { birthChart?, queryDate? }
 * @returns {Promise<{ id, name, group, dims }|{ id, name, group, error }>}
 */
async function analyzeOneSystem(system, input) {
  try {
    const block = await system.buildBlock(input);
    const raw   = await deepseekChat(
      buildSystemAnalysisMessages(system, block),
      { maxTokens: 600, temperature: 0.6 }  // PRD: 分析 ≤ 600 token
    );
    const dims = parseAnalysisJson(raw);
    return { id: system.id, name: system.name, group: system.group, dims };
  } catch (e) {
    console.warn(`[cross-validation] system "${system.id}" analysis failed:`, e.message);
    return { id: system.id, name: system.name, group: system.group, error: 'analysis_failed' };
  }
}

/**
 * 并行分析所有 Phase1 体系，返回 perSystem 对象。
 * 最少 2 个体系成功时才继续，否则抛出错误。
 *
 * @param {object} input
 *   { birthChart: computeBaziChart 结果, queryDate: Date（问卦时刻） }
 * @returns {Promise<object>} perSystem: { [sysId]: { name, group, dims } }
 */
async function analyzeAllSystems(input) {
  // TODO(Phase1): 实现并行分析
  // 模板：
  //   const results = await Promise.all(
  //     PHASE1_SYSTEMS.map(sys => analyzeOneSystem(sys, input))
  //   );
  //   const perSystem = Object.fromEntries(results.map(r => [r.id, r]));
  //   const successCount = results.filter(r => !r.error).length;
  //   if (successCount < 2) throw new Error('Cross-Check needs at least 2 systems; too many failed.');
  //   return perSystem;
  throw new Error('analyzeAllSystems: TODO — Phase1 implementation pending');
}

/**
 * 从 perSystem 中筛出成功的体系列表（供前端展示）。
 * @param {object} perSystem
 * @returns {Array<{id, name, group}>}
 */
function getSuccessfulSystems(perSystem) {
  return Object.values(perSystem)
    .filter(s => !s.error)
    .map(s => ({ id: s.id, name: s.name, group: s.group }));
}

module.exports = {
  buildSystemAnalysisMessages,
  parseAnalysisJson,
  analyzeOneSystem,
  analyzeAllSystems,
  getSuccessfulSystems,
};
