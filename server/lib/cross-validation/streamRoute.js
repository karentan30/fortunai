'use strict';
/**
 * cross-validation/streamRoute.js
 * Phase1 SSE 流式路由骨架 — /api/cross-check/stream
 *
 * 职责：
 *   接收用户输入 → 流式推送进度事件 → 并行各体系分析 → 交叉比对 → 推送最终结果
 *
 * SSE 事件类型（前端按 type 字段区分）：
 *   { type: 'progress', step: 'computing_charts'|'analyzing_systems'|'comparing'|'done', message: string }
 *   { type: 'system_result', systemId, name, group, dims }    — 每体系分析完成后推送
 *   { type: 'comparison_result', birthGauge, momentGauge, synthesisAdvice, disclaimer }
 *   { type: 'hook', hookText }                                 — 免费用户只收此条
 *   { type: 'error', message }
 *
 * PRD 约束：
 *   • 整体耗时目标 25-35s（3 次 LLM 全并行：命盘分析/卦象分析/比对合成）
 *   • 流式进度条让体感更短
 *   • 权限闸：免费用户只返回 hook（最强共识体系 1 句话 verdict）+ 付费提示
 *   • 不暴露模型名
 *   • AI 标识必须在每个 verdict 旁 + 合成段上方（前端责任，后端在 disclaimer 中提示）
 *
 * ⚠️ 未 mount — 由主路由文件按需挂载
 *    app.use('/api/cross-check', require('./routes/cross-check-stream'));
 *    或在现有 cross-check.js 中 router.use('/stream', require('../lib/cross-validation/streamRoute'));
 */

const router = require('express').Router();
const { computeBaziChart } = require('../bazi-engine');
const { analyzeAllSystems, getSuccessfulSystems } = require('./systemAnalysis');
const { runCrossCompare } = require('./crossCompare');
const { DIMENSIONS, GROUP_BIRTH, GROUP_MOMENT } = require('./systems');

// ── SSE helper：写一条 event，自动加 \n\n ──
function sseWrite(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ── 授权闸（同 routes/cross-check.js 的占位逻辑，未接真实会员判断）──
// TODO(Phase1/P2): 接 lib/store 的 memberTier/hasFullAccess 判断
function requireEntitlement(req) {
  return { ok: false, tier: 'free', reason: 'Cross-Check is a premium feature. Entitlement not wired yet.' };
}

// ── 免费钩子（最强共识体系 1 句话 verdict）──
// TODO(Phase1): 从 perSystem 中取共识分最高的维度+体系，拼成 1 句话
function buildFreeHook(perSystem) {
  // 模板：找 confidence 最高的成功体系 + 该体系 career 维度的 verdict 作为钩子
  // return `Cross-Check preview: ${bestSystem.name} sees your career as "${dims.career.verdict}". Unlock full 4-system comparison →`;
  return 'Cross-Check preview unlocked: multiple systems are aligning on one key area of your chart. Upgrade to see where they agree — and where they clash.';
}

/**
 * POST /stream
 * body: { year, month, day, hour, minute?, gender, isLunar? }
 */
router.post('/stream', async function crossCheckStream(req, res) {
  // ── SSE headers ──
  res.setHeader('Content-Type',  'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    // ── 权限检查 ──
    const gate = requireEntitlement(req);
    const isFreeUser = !gate.ok;

    // ── 解析输入 ──
    const b = req.body || {};
    const birthOpts = {
      year:    parseInt(b.year,   10),
      month:   parseInt(b.month,  10),
      day:     parseInt(b.day,    10),
      hour:    b.hour   !== undefined ? parseInt(b.hour,   10) : 0,
      minute:  b.minute !== undefined ? parseInt(b.minute, 10) : 0,
      gender:  (b.gender === 'female' || b.gender === '女') ? 'female' : 'male',
      isLunar: b.isLunar === true || b.isLunar === 'true',
      includeZiwei: true,
    };
    if (!birthOpts.year || !birthOpts.month || !birthOpts.day) {
      sseWrite(res, { type: 'error', message: 'Birth year, month and day are required.' });
      return res.end();
    }

    // ── Step 1: 真引擎排盘 ──
    sseWrite(res, { type: 'progress', step: 'computing_charts', message: 'Computing your natal charts...' });
    const birthChart = computeBaziChart(birthOpts);
    const queryDate  = new Date();  // 问卦时刻 = 当前时刻
    const input      = { birthChart, queryDate };

    // ── Step 2: 各体系独立分析（并行，推送进度）──
    sseWrite(res, { type: 'progress', step: 'analyzing_systems', message: 'Running 4 divination systems in parallel...' });

    // TODO(Phase1): 替换为真实的 analyzeAllSystems(input)
    // 实现后，每体系完成就 sseWrite 一条 system_result（需改造 analyzeAllSystems 支持 onResult callback）
    // 模板：
    //   const perSystem = await analyzeAllSystems(input, (result) => {
    //     if (!result.error) sseWrite(res, { type: 'system_result', ...result });
    //   });
    const perSystem = {}; // TODO: remove placeholder

    // 免费用户：只返回 hook，不继续比对
    if (isFreeUser && process.env.CROSS_CHECK_ALLOW_UNGATED !== '1') {
      const hookText = buildFreeHook(perSystem);
      sseWrite(res, { type: 'hook', hookText, upgrade: true, upgradeReason: gate.reason });
      return res.end();
    }

    // ── Step 3: 交叉比对 ──
    sseWrite(res, { type: 'progress', step: 'comparing', message: 'Cross-comparing systems...' });
    // TODO(Phase1): 替换为真实的 runCrossCompare(perSystem)
    const comparisonResult = {}; // TODO: remove placeholder

    // ── Step 4: 推送最终结果 ──
    sseWrite(res, {
      type: 'comparison_result',
      systems:    getSuccessfulSystems(perSystem),
      dimensions: DIMENSIONS,
      perSystem,
      ...comparisonResult, // { birthGauge, momentGauge, synthesisAdvice }
      disclaimer:
        'Cross-Check compares multiple independent divination lenses. ' +
        'Agreement across systems does NOT prove a prediction will come true — ' +
        'it only means several traditional lenses converge on the same signal. ' +
        'All readings are AI-generated for self-reflection and entertainment only. ' +
        'Not medical, legal, or financial advice. 娱乐参考，仅供自我探索。',
    });

    sseWrite(res, { type: 'progress', step: 'done', message: 'Complete.' });
    res.end();

  } catch (e) {
    console.error('[cross-check/stream]', e && e.message);
    try {
      sseWrite(res, { type: 'error', message: 'Cross-Check service is busy, please try again.' });
      res.end();
    } catch (_) { /* already closed */ }
  }
});

module.exports = router;
