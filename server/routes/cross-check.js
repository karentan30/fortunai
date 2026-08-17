'use strict';
/**
 * routes/cross-check.js — Runae 「Cross-Check / 多体系交叉验证」旗舰功能
 *
 * ⚠️ 未 mount — 由 Karen 统一在 server 入口挂载 (例如 app.use('/api/cross-check', require('./routes/cross-check'))).
 *
 * 概念：同一命盘 → 多个命理体系【独立】排盘并分析 → 就同一维度(事业/财运/感情/健康)
 *       各出结论 → 交叉比对：一致=⭐高置信·多体系共识；分歧=⚠️需权衡·附各自理由。
 *
 * 现阶段体系：八字(BaZi) + 紫微斗数(Zi Wei)，两者都用 server/lib/bazi-engine 真引擎排盘。
 *            吠陀(Vedic)/塔罗(Tarot) 引擎 ready 后按 SYSTEMS 数组扩展即可。
 *
 * 成本红线：一次 Cross-Check = N 个体系各跑 1 次 LLM(独立分析) + 1 次比对 LLM，
 *          属高成本高端功能。默认 requireEntitlement()=true，绝不对免费/游客开放。
 *          上线前须经老板确认定价与预算(见 docs/product/runae-cross-check.md)。
 *
 * 红线：零编造 · 真引擎排盘(禁 LLM 自排) · 娱乐参考免责 · 反宿命 ·
 *       诚实标注「体系一致 ≠ 预测成立，只是多视角共识」。
 */

const router = require('express').Router();
const { computeBaziChart } = require('../lib/bazi-engine');
const { deepseekChat } = require('../lib/llm');

// ── 交叉验证的固定维度 (所有体系必须就这几个维度出结论，才能对齐比对) ──
const DIMENSIONS = [
  { key: 'career', label: 'Career' },
  { key: 'wealth', label: 'Wealth' },
  { key: 'love',   label: 'Love & Relationships' },
  { key: 'health', label: 'Health & Vitality' },
];

// ── 体系登记表。新体系 ready 后在这里加一项即可（buildBlock 返回排盘文本，禁 LLM 自排）──
const SYSTEMS = [
  {
    id: 'bazi',
    name: 'BaZi (Four Pillars)',
    // 从真引擎排盘 → 排盘文本块 (LLM 只解读不排盘)
    buildBlock(chart) {
      const b = chart.bazi;
      const sz = b.siZhu, ss = b.shiShen, e = b.enrichment;
      const pillar = (p) => `${sz[p].gan}${sz[p].zhi}(${ss[p] || 'DayMaster'})`;
      const wx = e['五行统计'].withCangGan;
      const dy = (b.dayun || []).slice(0, 6)
        .map((d) => `${d.ganZhi.gan}${d.ganZhi.zhi}@age${d.startAge}`).join(' ');
      return [
        'BAZI CHART (professional almanac engine — DO NOT recompute pillars):',
        `Four Pillars: Year ${pillar('year')} | Month ${pillar('month')} | Day ${pillar('day')} | Hour ${pillar('hour')}`,
        `Day Master: ${b.dayMaster} | Structure(格局): ${e['格局'].primary} (${e['格局'].confidence}) | Strength(旺衰): ${e['旺衰'].verdict}`,
        `Five Elements power: Wood ${wx['木']} Fire ${wx['火']} Earth ${wx['土']} Metal ${wx['金']} Water ${wx['水']} | Missing: ${e['五行统计'].missing.join('') || 'none'} | Strongest: ${e['五行统计'].strongest.join('')}`,
        `Favorable elements(调候用神): ${e['调候用神'].join(', ')}`,
        `Luck cycles(大运): ${dy}`,
      ].join('\n');
    },
  },
  {
    id: 'ziwei',
    name: 'Zi Wei Dou Shu (Purple Star)',
    buildBlock(chart) {
      const z = chart.ziwei;
      // 官禄=career, 财帛=wealth, 夫妻=love, 疾厄=health, 命宫=self
      const pick = (name) => (z.gongs || []).find((g) => g.gong === name);
      const fmt = (g) => g
        ? `${g.gong}(${g.tiangan}${g.dizhi}): main[${(g.mainStars || []).join('/') || 'none'}] aux[${(g.auxStars || []).join('/') || 'none'}] sihua[${(g.sihua || []).map((s) => s.star + s.hua).join('/') || 'none'}]`
        : `${g}(n/a)`;
      return [
        'ZI WEI CHART (professional engine — DO NOT recompute palaces/stars):',
        `Life palace(命宫) idx ${z.mingGongIndex} | Body palace(身宫) idx ${z.shenGongIndex} | Element frame(五行局): ${z.wuXingJu.name} | ${z.yinYang}`,
        fmt(pick('命宫')),
        `Career → ${fmt(pick('官禄'))}`,
        `Wealth → ${fmt(pick('财帛'))}`,
        `Love → ${fmt(pick('夫妻'))}`,
        `Health → ${fmt(pick('疾厄'))}`,
      ].join('\n');
    },
  },
  // 未来: { id:'vedic', name:'Vedic Astrology', buildBlock(...) }  // 引擎 ready 后加
  // 未来: { id:'tarot', name:'Tarot',            buildBlock(...) }
];

// ── 每体系独立分析 prompt：只解读上面给定的排盘块，就四维度各出结论 ──
function systemAnalysisMessages(system, block) {
  const dimList = DIMENSIONS.map((d) => `"${d.key}" (${d.label})`).join(', ');
  return [
    {
      role: 'system',
      content:
        `You are a ${system.name} reader for Runae. You interpret ONLY the pre-computed chart data provided — ` +
        `you MUST NOT recompute or invent any chart element. Ground every conclusion in the given data. ` +
        `Be honest and non-fatalistic: describe tendencies and probabilities, never certainties. English only.`,
    },
    {
      role: 'user',
      content: [
        block,
        '',
        `For EACH of these dimensions: ${dimList}`,
        'give: a one-word verdict, a 0-100 confidence, and one concrete sentence of reasoning tied to the chart data above.',
        'verdict must be a short label the reader can compare across systems, e.g. "entrepreneurial", "steady/salaried", "abundant", "volatile", "committed", "independent", "resilient", "needs-care".',
        'Return STRICT JSON only, no prose:',
        '{"career":{"verdict":"...","confidence":78,"reason":"..."},"wealth":{...},"love":{...},"health":{...}}',
      ].join('\n'),
    },
  ];
}

// ── 交叉比对 prompt：拿 N 体系对同一维度的结论 → 判一致/分歧 + 共识度 ──
function crossCompareMessages(perSystem) {
  return [
    {
      role: 'system',
      content:
        'You are Runae\'s Cross-Check arbiter. You compare independent readings from multiple divination systems ' +
        'on the SAME dimensions. Decide agreement per dimension. Be strictly honest: systems agreeing does NOT ' +
        'prove a prediction is true — it only means multiple lenses converge. Never over-claim. English only.',
    },
    {
      role: 'user',
      content: [
        'Independent per-system readings (JSON):',
        JSON.stringify(perSystem),
        '',
        'For EACH dimension (career, wealth, love, health):',
        '- status: "consensus" if the systems\' verdicts point the same direction, "divergence" if they conflict, "partial" if leaning-but-mixed.',
        '- consensusScore: 0-100 (how aligned the systems are on this dimension).',
        '- summary: 1 honest sentence. For consensus, state the shared signal. For divergence, name what each system says and that the user must weigh it.',
        'Also give overallConsensus: 0-100 across all dimensions.',
        'Return STRICT JSON only:',
        '{"overallConsensus":72,"dimensions":{"career":{"status":"divergence","consensusScore":40,"summary":"..."},"wealth":{...},"love":{...},"health":{...}}}',
      ].join('\n'),
    },
  ];
}

function parseJson(text) {
  const m = text && text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM did not return JSON');
  return JSON.parse(m[0]);
}

// ── 授权闸：Cross-Check 是高端付费功能，绝不对免费/游客开放 ──
// Karen mount 时用真实会员判定替换 (memberTier/hasFullAccess from lib/store)。
function requireEntitlement(req) {
  // TODO(Karen): 接 lib/store 的 memberTier(req)/hasFullAccess(req) —
  //   仅允许 年会员 / 大师档 / 单次高客单已购 通过。
  // 此处占位默认拒绝，防止未接权限就上线烧钱。
  return { ok: false, reason: 'Cross-Check is a premium feature. Entitlement check not wired yet.' };
}

// POST /api/cross-check
// body: { year, month, day, hour, minute?, gender, isLunar? }
router.post('/', async function (req, res) {
  try {
    const gate = requireEntitlement(req);
    if (!gate.ok && process.env.CROSS_CHECK_ALLOW_UNGATED !== '1') {
      return res.status(402).json({ ok: false, error: gate.reason, upgrade: true });
    }

    const b = req.body || {};
    const opts = {
      year: parseInt(b.year, 10),
      month: parseInt(b.month, 10),
      day: parseInt(b.day, 10),
      hour: b.hour !== undefined ? parseInt(b.hour, 10) : 0,
      minute: b.minute !== undefined ? parseInt(b.minute, 10) : 0,
      gender: b.gender === 'female' || b.gender === '女' ? 'female' : 'male',
      isLunar: b.isLunar === true || b.isLunar === 'true',
      includeZiwei: true,
    };
    if (!opts.year || !opts.month || !opts.day) {
      return res.status(400).json({ ok: false, error: 'Birth year, month and day are required.' });
    }

    // Step 1 — 真引擎排盘一次，八字+紫微同源同一命盘
    const chart = computeBaziChart(opts);

    // Step 2 — 每体系【独立】分析 (并行，各自只看自己的排盘块)
    const perSystem = {};
    await Promise.all(
      SYSTEMS.map(async (sys) => {
        try {
          const block = sys.buildBlock(chart);
          const raw = await deepseekChat(systemAnalysisMessages(sys, block), {
            maxTokens: 900, temperature: 0.6,
          });
          perSystem[sys.id] = { name: sys.name, dims: parseJson(raw) };
        } catch (e) {
          console.warn('[cross-check] system', sys.id, 'failed:', e.message);
          perSystem[sys.id] = { name: sys.name, error: 'analysis_failed' };
        }
      })
    );

    const ok = Object.values(perSystem).filter((s) => !s.error);
    if (ok.length < 2) {
      return res.status(502).json({ ok: false, error: 'Cross-Check needs at least 2 systems; too many failed. Please retry.' });
    }

    // Step 3 — 交叉比对：判一致/分歧 + 共识度
    const compareRaw = await deepseekChat(crossCompareMessages(perSystem), {
      maxTokens: 900, temperature: 0.4,
    });
    const comparison = parseJson(compareRaw);

    // Step 4 — 组装结果 (前端 cross-check.html 消费)
    return res.json({
      ok: true,
      data: {
        systems: SYSTEMS.filter((s) => !perSystem[s.id].error).map((s) => ({ id: s.id, name: s.name })),
        dimensions: DIMENSIONS,
        perSystem,           // 每体系逐维度 {verdict, confidence, reason}
        comparison,          // {overallConsensus, dimensions:{[dim]:{status,consensusScore,summary}}}
        // 免责固定文案 — 前端必须原样展示
        disclaimer:
          'Cross-Check compares independent readings from multiple systems. Agreement across systems does NOT ' +
          'prove a prediction will come true — it only means several lenses converge on the same signal. ' +
          'All readings are AI-generated for self-reflection and entertainment only, and are not fatalistic, ' +
          'nor medical, legal, or financial advice.',
      },
    });
  } catch (e) {
    console.error('[cross-check]', e && e.message);
    return res.status(500).json({ ok: false, error: 'Cross-Check service is busy, please try again.' });
  }
});

module.exports = router;
