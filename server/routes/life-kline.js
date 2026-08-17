'use strict';
/**
 * routes/life-kline.js — Runae · Life K-Line / 人生K线
 *   POST /api/life-kline        — 真引擎排盘 → 规则化打分每个大运/流年 (0-100 运势分) → 时间轴 + AI 点评
 *   GET  /api/life-kline/quota  — 查询今日免费剩余
 *
 * 诚实定位: 每一年的【分数由 JS 用确定的规则算】(五行生克 + 旺衰喜忌 + 调候用神 + 刑冲合),
 *   由真八字引擎 computeBaziChart 排出的真实大运/流年 ganZhi 驱动 — 绝不让 LLM 编分数。
 *   LLM 只负责【点评】关键转折期 (最旺/最挑战/翻身年), 依据是我们递给它的既定分数, 不重算。
 *   同 numerology.js "脚本算 · AI 解释" 模式。
 *
 * 病毒钩子: 把一生画成股票 K 线, 牛市/熊市一眼看穿, 可截图分享。
 *   "This isn't fortune-telling — it's your life's K-line chart."
 *   免费: 完整一生大势曲线 (逐大运一句 + 3 个关键转折年点评)。
 *   付费/会员: 逐年 (每个流年) 详批 + 具体主题 + 行动建议。
 *
 * 红线: 零编造 (分数纯规则算) · 反宿命 (trends not guarantees) · 禁 "X 年你一定破产/发财" ·
 *   Eastern 不用 Chinese · 娱乐参考免责 · AI 标识。
 *
 * ⚠️ 本路由建了未 mount — 由 Karen 统一在 server/index.js 挂:
 *      app.use('/api', require('./routes/life-kline'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

const KLINE_FREE_DAILY = 1; // 每天 1 次免费完整曲线

// ══════════════════════════════════════════════════════════════════
// 五行常量表 — 天干/地支 → 五行 (标准命理定义, 非 LLM 生成)
// ══════════════════════════════════════════════════════════════════
const GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};
// 地支主气五行 (本气)
const ZHI_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
};
// 五行相生: A 生 B  (A → B)
const SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
// 五行相克: A 克 B
const KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

// 地支六冲 (冲 = 动荡/转折)
const CHONG = {
  '子': '午', '午': '子', '卯': '酉', '酉': '卯', '寅': '申', '申': '寅',
  '巳': '亥', '亥': '巳', '辰': '戌', '戌': '辰', '丑': '未', '未': '丑'
};

// ══════════════════════════════════════════════════════════════════
// 喜忌推导 — 由真引擎的【旺衰 verdict】+【调候用神】确定 favorable / unfavorable 五行
//   身弱 → 喜 生我(印) + 同我(比劫);  身旺 → 喜 我生(食伤) + 我克(财) + 克我(官杀)
//   这是标准扶抑用神法则, 规则确定, 不猜。
// ══════════════════════════════════════════════════════════════════
function whoShengMe(dmEl) { // 生我者 (印) — 找 X 使 SHENG[X]===dmEl
  return Object.keys(SHENG).find(k => SHENG[k] === dmEl);
}
function whoKeMe(dmEl) {   // 克我者 (官杀) — 找 X 使 KE[X]===dmEl
  return Object.keys(KE).find(k => KE[k] === dmEl);
}

function deriveFavor(chart) {
  const dm = chart.bazi.dayMaster;          // 日主天干, e.g. '辛'
  const dmEl = GAN_WUXING[dm];              // 日主五行, e.g. '金'
  const verdict = (chart.bazi.enrichment && chart.bazi.enrichment['旺衰'] && chart.bazi.enrichment['旺衰'].verdict) || '中和';
  const isWeak = /弱/.test(verdict);        // 偏弱 / 弱 / 极弱
  const isStrong = /旺/.test(verdict) || /强/.test(verdict);

  const yin = whoShengMe(dmEl);             // 印: 生日主
  const bijie = dmEl;                       // 比劫: 同日主
  const shishang = SHENG[dmEl];             // 食伤: 日主生
  const cai = KE[dmEl];                     // 财: 日主克
  const guansha = whoKeMe(dmEl);            // 官杀: 克日主

  let favorable, unfavorable;
  if (isWeak) {
    // 身弱 → 用印比帮身, 忌食伤财官泄克
    favorable = [yin, bijie];
    unfavorable = [shishang, cai, guansha];
  } else if (isStrong) {
    // 身旺 → 用食伤财官泄耗, 忌印比帮身
    favorable = [shishang, cai, guansha];
    unfavorable = [yin, bijie];
  } else {
    // 中和 → 以食伤财官为顺用(通关生财), 印比为帮身次吉, 无明显忌 (取温和权重)
    favorable = [shishang, cai];
    unfavorable = [guansha]; // 中和时官杀过重仍偏压
  }

  // 调候用神 (季节寒暖燥湿的关键调节字) 加权为 favorable, 提高其对应五行
  const tiaohou = (chart.bazi.enrichment && chart.bazi.enrichment['调候用神']) || [];
  const tiaohouEls = tiaohou.map(g => GAN_WUXING[g]).filter(Boolean);

  return { dmEl, verdict, isWeak, isStrong, favorable, unfavorable, tiaohouEls, roles: { yin, bijie, shishang, cai, guansha } };
}

// ══════════════════════════════════════════════════════════════════
// 单个 ganZhi (天干+地支) 的运势贡献分 → 归一到 0-100
//   天干权重 0.55, 地支权重 0.45 (地支为根, 略轻但含调候冲合修正)
//   命中 favorable +, 命中 unfavorable -, 调候用神额外 +, 与命局地支冲 = 波动(向中性拉)
// ══════════════════════════════════════════════════════════════════
function scoreGanZhi(gan, zhi, favor, birthZhiSet) {
  const ganEl = GAN_WUXING[gan];
  const zhiEl = ZHI_WUXING[zhi];
  const fav = new Set(favor.favorable);
  const unf = new Set(favor.unfavorable);
  const th = new Set(favor.tiaohouEls);

  function elContribution(el) {
    let c = 0;
    if (fav.has(el)) c += 1;
    if (unf.has(el)) c -= 1;
    if (th.has(el)) c += 0.5;   // 调候用神加成
    return c; // 区间约 [-1, 1.5]
  }

  const ganC = elContribution(ganEl); // 天干透出, 显性
  const zhiC = elContribution(zhiEl); // 地支藏根
  // 天干 0.55 / 地支 0.45 加权
  let raw = ganC * 0.55 + zhiC * 0.45; // 约 [-1, 1.5]

  // 冲: 该运/年地支与命局四支相冲 → 转折/动荡, 把分数向中性(0)拉 30% 并记标记
  let volatile = false;
  if (birthZhiSet.has(CHONG[zhi])) {
    volatile = true;
    raw = raw * 0.7; // 削弱确定性, 体现"变动"
  }

  // 归一: raw 理论区间 ~[-1, 1.5] → 映射 0-100, 50 为中性
  //   raw= -1 → ~22 ; raw=0 → 50 ; raw=1 → 78 ; raw=1.5 → 92
  let score = 50 + raw * 28;
  score = Math.max(8, Math.min(96, Math.round(score))); // 夹到 8-96, 永不给绝对 0/100
  return { score, volatile };
}

// 分档标签 (牛熊)
function trendLabel(score) {
  if (score >= 72) return 'bull';       // 牛市 · 旺
  if (score >= 58) return 'up';         // 上行 · 顺
  if (score >= 43) return 'neutral';    // 盘整 · 平
  if (score >= 30) return 'down';       // 回调 · 挑战
  return 'bear';                        // 熊市 · 考验
}

// ══════════════════════════════════════════════════════════════════
// 主计算: 排盘 → 逐大运 + 逐流年打分 → 时间轴 + 关键转折
// ══════════════════════════════════════════════════════════════════
function computeKline(birth) {
  const chart = computeBaziChart({
    year: birth.y, month: birth.m, day: birth.d,
    hour: birth.hour, minute: birth.minute || 0,
    gender: birth.gender, includeZiwei: false
  });
  const favor = deriveFavor(chart);

  // 命局四支集合 (判冲用)
  const sz = chart.bazi.siZhu;
  const birthZhiSet = new Set([sz.year.zhi, sz.month.zhi, sz.day.zhi, sz.hour.zhi]);

  const dayunArr = chart.bazi.dayun || [];
  const decades = [];   // 每个大运一段
  const years = [];     // 逐流年点 (细粒度, 画 K 线)

  for (const d of dayunArr) {
    const dS = scoreGanZhi(d.ganZhi.gan, d.ganZhi.zhi, favor, birthZhiSet);
    // 该大运逐流年
    const yrPoints = (d.liuNian || []).map(ly => {
      const s = scoreGanZhi(ly.ganZhi.gan, ly.ganZhi.zhi, favor, birthZhiSet);
      // 流年最终分 = 流年自身 70% + 所处大运底色 30% (大运定基调, 流年定起伏)
      const blended = Math.round(s.score * 0.7 + dS.score * 0.3);
      const finalScore = Math.max(8, Math.min(96, blended));
      return {
        year: ly.year, age: ly.age,
        ganZhi: ly.ganZhi.gan + ly.ganZhi.zhi,
        score: finalScore,
        trend: trendLabel(finalScore),
        volatile: s.volatile
      };
    });
    years.push(...yrPoints);
    decades.push({
      ganZhi: d.ganZhi.gan + d.ganZhi.zhi,
      startAge: d.startAge, endAge: d.endAge,
      startYear: d.startYear, endYear: d.endYear,
      ganShiShen: d.ganShiShen, zhiShiShen: d.zhiShiShen,
      score: dS.score,
      trend: trendLabel(dS.score),
      volatile: dS.volatile
    });
  }

  // 关键转折年 (给 LLM 点评 + 前端标注): 全局最高分年 / 最低分年 / 最大跃升年
  let peak = null, trough = null, bestSwing = null;
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    if (!peak || y.score > peak.score) peak = y;
    if (!trough || y.score < trough.score) trough = y;
    if (i > 0) {
      const jump = y.score - years[i - 1].score;
      if (!bestSwing || jump > bestSwing.jump) bestSwing = { ...y, jump, from: years[i - 1].score };
    }
  }
  const turningPoints = [];
  if (peak) turningPoints.push({ kind: 'peak', ...peak });
  if (trough && trough.year !== (peak && peak.year)) turningPoints.push({ kind: 'trough', ...trough });
  if (bestSwing && bestSwing.year !== (peak && peak.year) && bestSwing.jump >= 8) turningPoints.push({ kind: 'rise', ...bestSwing });

  return {
    dayMaster: chart.bazi.dayMaster,
    dayMasterElement: favor.dmEl,
    verdict: favor.verdict,
    geju: (chart.bazi.enrichment && chart.bazi.enrichment['格局'] && chart.bazi.enrichment['格局'].primary) || null,
    favorable: favor.favorable,
    unfavorable: favor.unfavorable,
    decades, years, turningPoints,
    span: years.length ? { fromYear: years[0].year, toYear: years[years.length - 1].year, fromAge: years[0].age, toAge: years[years.length - 1].age } : null
  };
}

// ══════════════════════════════════════════════════════════════════
// 诚实 + 反宿命 + AI 标识 (system prompt)
// ══════════════════════════════════════════════════════════════════
const HONESTY_EN =
  '\n\nWHO YOU ARE (weave in warmly, never a cold disclaimer): Every score on this chart was computed by an exact rule engine — from an authentic Eastern Four Pillars chart, using the classic five-element balance (which elements support you, which drain you) plus the seasonal-adjustment stars and the clash points. You NEVER invent, sense, or change a score; the numbers are fixed, only their meaning is a conversation. You are an AI reading a chart, and being upfront about that is you being honest.' +
  '\n\nNEVER FATE, NEVER FEAR: A "bull year" means the winds are behind you; a "bear year" means headwinds and a season to build quietly — never a verdict that something WILL happen. These are trends, not guarantees. NEVER say someone will "go broke", "get rich", "lose their job", "get sick", or any specific event in a given year. NEVER name diseases. Always hand the wheel back — close with a line like "This is the weather of your life, not your destiny — how you sail it is yours." For self-reflection and entertainment only — not medical, legal, or financial advice.' +
  '\n\nVOICE: Warm, plain-spoken, a touch of wonder — like a market analyst who loves the person, not a fortune-teller. Speak directly to them ("you"). Short paragraphs. Always English. Say "Eastern Four Pillars", never "Chinese". Never call a year simply "good" or "bad" — every season has its work.';

// ══════════════════════════════════════════════════════════════════
// 配额 helper
// ══════════════════════════════════════════════════════════════════
function _uid(req) {
  return resolveUserFromToken(
    req.headers['authorization'] || (req.body && req.body.token),
    { get: (t) => { const row = _M.tokens.find(x => x.token === t); return row || null; } }
  );
}
function _quotaKey(req) {
  const uid = _uid(req);
  const day = new Date().toISOString().slice(0, 10);
  const sessionId = req.headers['x-session-id'];
  return (uid || sessionId || getClientIp(req)) + '_lifekline_' + day;
}
function _klineUsage() { if (!_M.lifeKlineUsage) _M.lifeKlineUsage = {}; return _M.lifeKlineUsage; }

function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier: tier };
  const usage = _klineUsage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < KLINE_FREE_DAILY, remaining: Math.max(0, KLINE_FREE_DAILY - used), isMember: false, tier: null };
}
function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return;
  const usage = _klineUsage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

// 解析生辰
function parseBirth(body) {
  if (!body) return null;
  let y, m, d, hour, minute;
  if (body.birthdate) {
    const mm = String(body.birthdate).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!mm) return null;
    y = +mm[1]; m = +mm[2]; d = +mm[3];
  } else {
    y = +body.year; m = +body.month; d = +body.day;
  }
  hour = body.hour !== undefined && body.hour !== '' ? +body.hour : 12; // 未知时辰默认午时 12
  minute = body.minute ? +body.minute : 0;
  if (!y || !m || !d || y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (hour < 0 || hour > 23) hour = 12;
  const gender = (body.gender === 'female' || body.gender === '女') ? 'female' : 'male';
  return { y, m, d, hour, minute, gender, hourKnown: body.hour !== undefined && body.hour !== '' };
}

const UPGRADE_MSG =
  'Your free Life K-Line is done for today. The year-by-year deep read — every single year decoded with its theme and best move — comes with membership ($9.90/mo). Or come back tomorrow for another free chart.';

// ══════════════════════════════════════════════════════════════════
// POST /api/life-kline
//   body: { year/month/day/hour?/gender?, or birthdate:"YYYY-MM-DD", token? }
//   free   → 完整曲线 + 逐大运一句 + 3 转折点点评
//   member → 加逐年 (可选 range) 详批
// ══════════════════════════════════════════════════════════════════
router.post('/life-kline', rateLimitMiddleware, async (req, res) => {
  try {
    const birth = parseBirth(req.body);
    if (!birth) return res.status(400).json({ error: 'Please enter a valid birth date (year, month and day).' });

    const q = checkQuota(req);
    if (!q.allowed) return res.json({ upgrade: true, needMember: true, message: UPGRADE_MSG });

    const data = computeKline(birth);
    const wantFull = q.isMember;

    // 组装递给 LLM 的【既定分数】(它只点评, 不重算)
    const tpBlock = data.turningPoints.map(tp => {
      const label = tp.kind === 'peak' ? 'PEAK (highest season)' : tp.kind === 'trough' ? 'TROUGH (toughest season)' : 'BIGGEST UPSWING (turnaround)';
      return `- ${label}: year ${tp.year} (age ${tp.age}), ${tp.ganZhi}, score ${tp.score}/100${tp.volatile ? ' [a clash year — expect movement/change]' : ''}`;
    }).join('\n');

    const decadeBlock = data.decades.map(dc =>
      `- Age ${dc.startAge}-${dc.endAge} (${dc.startYear}-${dc.endYear}) ${dc.ganZhi}: score ${dc.score}/100 (${dc.trend})`
    ).join('\n');

    const chartFacts =
      `Day Master: ${data.dayMasterElement} element (fixed).  Balance: ${data.verdict}.  ` +
      `Elements that SUPPORT them (their "bull" fuel): ${data.favorable.join(', ')}.  ` +
      `Elements that DRAIN/PRESSURE them: ${data.unfavorable.join(', ')}.  ` +
      (data.geju ? `Chart structure: ${data.geju}.` : '');

    let scope, structure;
    if (wantFull) {
      scope = 'Give the FULL year-by-year commentary on their life K-line.';
      structure =
        '\n\nSTRUCTURE (520-720 words): a one-line open framing their life as a K-line chart · a short paragraph on the SHAPE of the whole curve (where the big bull decades and bear decades sit) · then walk each turning-point season below, one short paragraph each, naming the YEAR and what kind of season it is (momentum vs. build quietly) and one grounded suggestion for how to sail it · then a paragraph reading the current & upcoming decade for them · close with your not-fate refrain.';
    } else {
      scope = 'Give the FREE big-picture read of their life K-line (tease, do not fully spoil the year-by-year).';
      structure =
        '\n\nSTRUCTURE (300-420 words): a one-line open framing their life as a K-line chart · one paragraph on the overall SHAPE of the curve (roughly which decades run bullish and which run as build-quietly seasons) · one short paragraph on each of the turning-point years listed (name the year, say what kind of season it is and one grounded way to meet it) · a single closing line noting that a full year-by-year read is waiting · then your not-fate refrain.';
    }

    const messages = buildReadingPrompt(
      'You are Rún — the voice of Runae, reading someone\'s life as a stock-style K-line chart drawn from their Eastern Four Pillars. ' + scope +
      ' The scores below were ALREADY computed by an exact rule engine — treat every number as a fixed fact and NEVER recalculate, question, or change it. Higher score = tailwind season ("bull"); lower = headwind season ("bear"). ' + HONESTY_EN + structure,
      `${chartFacts}\n\nTHEIR LIFE K-LINE — decade trend (fixed scores, do not recompute):\n${decadeBlock}\n\nKEY TURNING-POINT YEARS (fixed):\n${tpBlock}\n\nRead this K-line for them, in your voice — a market analyst who loves them.`
    );

    const reading = await deepseekChat(messages, { maxTokens: wantFull ? 2400 : 1400 });
    consumeQuota(req);
    try { insertReading.run('life-kline', JSON.stringify({ birth, summary: { verdict: data.verdict, span: data.span }, full: wantFull }), reading, req.userId); } catch (e) {}
    const after = checkQuota(req);

    res.json({
      reading,
      chart: {
        dayMaster: data.dayMaster,
        dayMasterElement: data.dayMasterElement,
        verdict: data.verdict,
        geju: data.geju,
        favorable: data.favorable,
        unfavorable: data.unfavorable,
        span: data.span,
        decades: data.decades,
        // 逐流年点: 免费也给全部点(画整条曲线才 viral 可截图), 深读文字才是付费墙
        years: data.years,
        turningPoints: data.turningPoints
      },
      full: wantFull,
      remaining: after.remaining,
      isMember: q.isMember
    });
  } catch (err) {
    console.error('[LIFE-KLINE ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'life-kline' } });
    res.status(500).json({ error: 'The chart is still drawing — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/life-kline/quota
// ══════════════════════════════════════════════════════════════════
router.get('/life-kline/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: KLINE_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: KLINE_FREE_DAILY, limit: KLINE_FREE_DAILY, error: e.message });
  }
});

// 导出算法供测试/复用
router.__calc = { computeKline, scoreGanZhi, deriveFavor, trendLabel, GAN_WUXING, ZHI_WUXING };

module.exports = router;
