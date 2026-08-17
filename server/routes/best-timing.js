'use strict';
/**
 * routes/best-timing.js — Runae · Best Time to Reach Out (最佳联系时机 / 择时求复合)
 *
 * POST /api/best-timing
 *   body: { you:{year,month,day,hour|null,gender}, them:{...}, scenario, rangeDays, lang, tzOffset }
 *
 * ══ 红线 ══
 * 零编造：所有日期/时辰 100% 由确定性引擎算 —— getDayGanZhi(流日) + getHourGanZhi(流时)
 *          + 固定评分规则。LLM 只把已算好的事实润色成 why/tone 一句话，绝不挑/排/编任何日期。
 * 反宿命：禁"保证复合/一定回你/一定爱你"。窗口=更容易被接住的时机，不控制任何人。
 * AI 标 + 娱乐参考免责（前端渲染，本文件在 disclaimer 字段回带）。
 * 时区：时钟范围(hourStart/hourEnd)用【用户本地】(tzOffset)；排盘流日/流时用真太阳时(引擎默认东八区)。
 *
 * ⚠️ 未 mount —— 由 server/index.js 统一挂载（本文件不改 index.js）。
 *    建议：app.use('/api', require('./routes/best-timing'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { getDayGanZhi, getHourGanZhi } = require('../lib/bazi-engine/yiqi-core/ganzhi');
const { memberTier, hasFullAccess, insertReading } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// ══════════════════════════════════════════════════════════════
// 固定经典表（自带·可单测·禁改）—— 与引擎 zhi-relations.js 同源
// ══════════════════════════════════════════════════════════════
const GAN_WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
const ZHI_WX = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };
// 相生：木→火→土→金→水→木
const GEN = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
// 相克：木→土→水→火→金→木
const KE  = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
// 咸池桃花（以日支/年支三合局取正）
const PEACH_MAP = { '寅':'卯','午':'卯','戌':'卯','申':'酉','子':'酉','辰':'酉','巳':'午','酉':'午','丑':'午','亥':'子','卯':'子','未':'子' };
// 六冲
const LIU_CHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
// 六合
const LIU_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
// 三合局
const SAN_HE = [['申','子','辰'],['亥','卯','未'],['寅','午','戌'],['巳','酉','丑']];
// 天干五合
const GAN_HE = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };

function sameSanHe(a, b) {
  if (a === b) return false;
  return SAN_HE.some(g => g.indexOf(a) >= 0 && g.indexOf(b) >= 0);
}

// ══════════════════════════════════════════════════════════════
// 从真引擎命盘里抽出择时所需的确定性事实（每人算一次）
// ══════════════════════════════════════════════════════════════
function buildProfile(person) {
  const g = person.gender === 'male' ? 'male' : 'female';
  const hourKnown = person.hour !== null && person.hour !== undefined && person.hour !== '';
  const { bazi: b } = computeBaziChart({
    year: Number(person.year), month: Number(person.month), day: Number(person.day),
    hour: hourKnown ? Number(person.hour) : 0, gender: g, includeZiwei: false,
  });
  const sz = b.siZhu, e = b.enrichment;
  const dayGan = sz.day.gan, dayZhi = sz.day.zhi, yearZhi = sz.year.zhi;
  const dmElement = GAN_WX[dayGan];

  // 喜用神元素集合（弱→喜印/比=生我+同我；强→喜财/官/食伤=我克/克我/我生；再并调候用神元素）
  const verdict = (e['旺衰'] && e['旺衰'].verdict) || '中和';
  const weak = /弱/.test(verdict);
  const strong = /旺/.test(verdict);
  const fav = new Set();
  if (weak || !strong) {
    fav.add(dmElement);                                   // 同我(比劫)
    for (const el in GEN) if (GEN[el] === dmElement) fav.add(el); // 生我(印)
  }
  if (strong || !weak) {
    fav.add(GEN[dmElement]);                              // 我生(食伤)
    fav.add(KE[dmElement]);                               // 我克(财)
    for (const el in KE) if (KE[el] === dmElement) fav.add(el);   // 克我(官杀)
  }
  // 调候用神元素并入喜用（气候补偏）
  (e['调候用神'] || []).forEach(gz => { const el = GAN_WX[gz] || ZHI_WX[gz]; if (el) fav.add(el); });

  // 食伤元素 = 我生（对方"表达/柔软/易接话"的星）
  const shishangEl = GEN[dmElement];
  // 桃花地支
  const peach = new Set([PEACH_MAP[dayZhi], PEACH_MAP[yearZhi]].filter(Boolean));

  return {
    gender: g, hourKnown, dayGan, dayZhi, dmElement,
    fav, shishangEl, peach, verdict,
    fourPillars: `${sz.year.gan}${sz.year.zhi} ${sz.month.gan}${sz.month.zhi} ${sz.day.gan}${sz.day.zhi} ${sz.hour.gan}${sz.hour.zhi}`,
  };
}

// ── 单人对某"流日/流时干支"的确定性检查，返回 {score, reasons[]} ──
function scoreForPerson(pf, gan, zhi, isHour) {
  const w = isHour ? 0.4 : 1; // 时辰层权重更轻
  let s = 0; const reasons = [];
  const dayEl = ZHI_WX[zhi];                 // 流日/流时地支五行（主）
  const ganEl = GAN_WX[gan];

  // + 元素生/同 喜用神 → 心情顺
  if (pf.fav.has(dayEl) || pf.fav.has(GEN[dayEl])) { s += 14 * w; reasons.push('favourable_element'); }
  // + 流日地支五行 = 其食伤 → 更易表达/接话
  if (dayEl === pf.shishangEl) { s += 11 * w; reasons.push('shishang_active'); }
  // + 桃花地支到 → 亲和/吸引力上扬
  if (pf.peach.has(zhi)) { s += 10 * w; reasons.push('taohua'); }
  // + 天干五合到日干 → 柔和牵引
  if (GAN_HE[gan] === pf.dayGan) { s += 6 * w; reasons.push('gan_he'); }
  // – 六冲日支 → 易急躁/防御（时辰层需知时=有意义；日层始终算）
  if (LIU_CHONG[zhi] === pf.dayZhi) {
    if (!isHour || pf.hourKnown) { s -= 16 * w; reasons.push('clash'); }
  }
  // – 元素强克喜用神 → 戒备
  if (pf.fav.size && KE[dayEl] && pf.fav.has(KE[dayEl]) && !pf.fav.has(dayEl)) { s -= 8 * w; reasons.push('drain'); }
  return { score: s, reasons };
}

// ── 两盘配合加成（bridge / friction）──
function pairScore(you, them, zhi) {
  let s = 0; const reasons = [];
  const bridge = (LIU_HE[zhi] === you.dayZhi) || (LIU_HE[zhi] === them.dayZhi)
    || sameSanHe(zhi, you.dayZhi) || sameSanHe(zhi, them.dayZhi);
  if (bridge) { s += 10; reasons.push('pair_liuhe'); }
  const friction = (LIU_CHONG[zhi] === you.dayZhi) && (LIU_CHONG[zhi] === them.dayZhi);
  if (friction) { s -= 8; reasons.push('pair_chong'); }
  return { score: s, reasons };
}

// ══════════════════════════════════════════════════════════════
// 30 天打分 + 挑窗口（全确定性，无 LLM）
// ══════════════════════════════════════════════════════════════
const HOUR_BLOCKS = [ // 时辰起点小时 → 排盘用 hour + 时钟范围
  { h: 1, s: 1, e: 3, zhi: '丑', name: 'Ox 丑' }, { h: 3, s: 3, e: 5, zhi: '寅', name: 'Tiger 寅' },
  { h: 5, s: 5, e: 7, zhi: '卯', name: 'Rabbit 卯' }, { h: 7, s: 7, e: 9, zhi: '辰', name: 'Dragon 辰' },
  { h: 9, s: 9, e: 11, zhi: '巳', name: 'Snake 巳' }, { h: 11, s: 11, e: 13, zhi: '午', name: 'Horse 午' },
  { h: 13, s: 13, e: 15, zhi: '未', name: 'Goat 未' }, { h: 15, s: 15, e: 17, zhi: '申', name: 'Monkey 申' },
  { h: 17, s: 17, e: 19, zhi: '酉', name: 'Rooster 酉' }, { h: 19, s: 19, e: 21, zhi: '戌', name: 'Dog 戌' },
  { h: 21, s: 21, e: 23, zhi: '亥', name: 'Pig 亥' },
]; // 子时(23-1)跨日，社交场景略去，只取白天/傍晚 11 个块

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeWindows(you, them, rangeDays, tzOffset) {
  // 用户"今天"起算（用户本地）。tzOffset = 用户本地相对 UTC 的分钟偏移（如东八区=-480，与 JS getTimezoneOffset 同号）。
  const nowUtc = Date.now();
  const localNow = new Date(nowUtc - (Number(tzOffset) || 0) * 60000);
  const days = [];

  for (let off = 1; off <= rangeDays; off++) {
    const dLocal = new Date(localNow.getTime() + off * 86400000);
    const Y = dLocal.getUTCFullYear(), M = dLocal.getUTCMonth() + 1, D = dLocal.getUTCDate();
    const liuRi = getDayGanZhi(Y, M, D); // 流日（真太阳时确定性，节气无关的儒略日 mod）

    // 日层分：对方 50% + 自己 30% + 配合 20%
    const t = scoreForPerson(them, liuRi.gan, liuRi.zhi, false);
    const u = scoreForPerson(you, liuRi.gan, liuRi.zhi, false);
    const p = pairScore(you, them, liuRi.zhi);
    let dayScore = t.score * 0.5 + u.score * 0.3 + p.score * 0.7;
    dayScore = Math.max(0, Math.min(100, Math.round(50 + dayScore)));

    // 时辰层：对该日 11 个时辰用流时打分，挑对方最舒服的块
    let best = null;
    for (const blk of HOUR_BLOCKS) {
      const liuShi = getHourGanZhi(liuRi.gan, blk.h);
      const ht = scoreForPerson(them, liuShi.gan, liuShi.zhi, true);
      const hu = scoreForPerson(you, liuShi.gan, liuShi.zhi, true);
      const hs = ht.score * 0.6 + hu.score * 0.4;
      if (!best || hs > best.hs) best = { blk, hs, reasons: ht.reasons.concat(hu.reasons) };
    }

    days.push({
      off, Y, M, D, weekday: WD[dLocal.getUTCDay()],
      score: dayScore, label: dayScore >= 75 ? 'best' : dayScore >= 60 ? 'good' : 'low',
      reasons: Array.from(new Set(t.reasons.map(r => 'target_' + r).concat(u.reasons.map(r => 'you_' + r)).concat(p.reasons))),
      clash: t.reasons.indexOf('clash') >= 0 || u.reasons.indexOf('clash') >= 0 || p.reasons.indexOf('pair_chong') >= 0,
      hour: best.blk,
    });
  }

  // 选窗口：score>=60，按分排序取前 6，尽量错开（避免 3 天内两个 best 挤在一起）
  const qualified = days.filter(d => d.label !== 'low').sort((a, b) => b.score - a.score);
  const picked = [];
  for (const d of qualified) {
    if (picked.length >= 6) break;
    if (picked.some(p => Math.abs(p.off - d.off) < 3 && p.label === 'best' && d.label === 'best')) continue;
    picked.push(d);
  }
  picked.sort((a, b) => a.off - b.off); // 时间顺序

  // avoid day（最强 clash 日，供付费列）
  const avoid = days.filter(d => d.clash).sort((a, b) => a.score - b.score)[0] || null;

  return { picked, avoid, lowDays: days.filter(d => d.label === 'low').map(d => d.off) };
}

// ══════════════════════════════════════════════════════════════
// why/tone 模板库（LLM 关掉也能发；LLM 只润色，禁改日期/verdict）
// ══════════════════════════════════════════════════════════════
const WHY_BANK = {
  target_shishang_active: "Their expressive side runs easy today — they're in a softer, more open frame, so a message reads as warmth, not weight.",
  target_taohua: "It's a peach-blossom day for them — sociability and warmth run high, so they lean a little more toward connection.",
  target_favourable_element: "The day's energy sits well with their chart — their mood tends to run lighter and more receptive.",
  you_favourable_element: "Your own element runs smooth today, so you come across calm and unhurried — words land better because you do.",
  you_shishang_active: "You're in an easy, expressive place today, so what you say comes out warm rather than loaded.",
  pair_liuhe: "The two charts form a quiet bridge today — the energy between you runs cooperative rather than crossed.",
  default: "The day's energy leans gentle for both of you — a naturally easier moment to open a small door.",
};
const TONE_BANK = {
  crush: "Light and playful. A small, specific hook — a song, a meme, a shared thing. No confession yet; just open the door.",
  ex_reconcile: "Warm and low-pressure. A short, kind hello — no rehashing, no big talk. One line that says 'I thought of you,' then leave space.",
  win_over: "Confident and generous. Lead with something useful or genuinely admiring. Give before you ask; let the value land first.",
  cold_contact: "Easy and human. Reference the last real thing you shared. Keep it brief — you're reopening a door, not making a speech.",
};

function pickWhyKey(reasons) {
  const order = ['target_shishang_active', 'target_taohua', 'target_favourable_element', 'you_favourable_element', 'you_shishang_active', 'pair_liuhe'];
  const norm = reasons.map(r => r
    .replace('target_shishang_active', 'target_shishang_active')
    .replace('you_shishang_active', 'you_shishang_active'));
  for (const k of order) if (norm.indexOf(k) >= 0) return k;
  return 'default';
}

function templateWindows(picked, scenario) {
  return picked.map(d => {
    const whyKey = pickWhyKey(d.reasons);
    return {
      date: `${d.Y}-${String(d.M).padStart(2, '0')}-${String(d.D).padStart(2, '0')}`,
      mon: MON[d.M - 1], dnum: d.D, weekday: d.weekday, off: d.off,
      label: d.label, score: d.score,
      shichen: d.hour.name, hourStart: d.hour.s, hourEnd: d.hour.e,
      why: WHY_BANK[whyKey] || WHY_BANK.default,
      tone: TONE_BANK[scenario] || TONE_BANK.crush,
      reasons: d.reasons.slice(0, 4),
    };
  });
}

// LLM 只把"事实块"润色成更自然的 why/tone（禁改日期/时辰/verdict）。失败则回落模板。
async function polishWithLLM(windows, scenario, lang, youPf, themPf) {
  try {
    const facts = windows.map((w, i) =>
      `#${i + 1} ${w.mon} ${w.dnum} (${w.label}) reasons: ${w.reasons.join(', ') || 'gentle day'}`
    ).join('\n');
    const langName = lang === 'zh' ? 'Chinese' : lang === 'ko' ? 'Korean' : 'English';
    const messages = buildReadingPrompt(
      `You are Rún, the voice of Runae, reading an ancient Eastern timing system (Four Pillars). Your ONLY job is to phrase two short lines per window: a "why" (why this day/hour is gentler for reaching out) and a "tone" (how to reach out) — in ${langName}.
HARD RULES:
- NEVER invent, change, reorder, or remove any date, hour, or verdict. Use exactly the windows given.
- NEVER promise another person's behaviour. BANNED: "they will reply," "you'll get back together," "this makes them love you," any certainty about someone else.
- Anti-fatalism: a window improves the odds and your own poise; it does not control anyone.
- Keep each line ≤ 22 words, warm, concrete, screenshot-friendly. No jargon dumps.
Return STRICT JSON: {"windows":[{"i":1,"why":"...","tone":"..."}, ...]} — one object per input window, same order.`,
      `Scenario: ${scenario}. Windows (facts only — do not change dates):\n${facts}\n\nReturn the JSON now.`
    );
    const raw = await deepseekChat(messages, { maxTokens: 1200, temperature: 0.6 });
    const m = raw && raw.match(/\{[\s\S]*\}/);
    if (!m) return windows;
    const parsed = JSON.parse(m[0]);
    if (!parsed || !Array.isArray(parsed.windows)) return windows;
    parsed.windows.forEach(o => {
      const idx = (Number(o.i) || 0) - 1;
      if (idx >= 0 && idx < windows.length) {
        if (typeof o.why === 'string' && o.why.trim()) windows[idx].why = o.why.trim();
        if (typeof o.tone === 'string' && o.tone.trim()) windows[idx].tone = o.tone.trim();
      }
    });
  } catch (e) { /* 润色失败 → 模板照发，不阻塞 */ }
  return windows;
}

// ══════════════════════════════════════════════════════════════
// POST /api/best-timing
// ══════════════════════════════════════════════════════════════
router.post('/best-timing', rateLimitMiddleware, async (req, res) => {
  const lang = (req.body && req.body.lang) || 'en';
  const t = (en, ko, zh) => lang === 'ko' ? ko : lang === 'zh' ? zh : en;
  try {
    const { you, them, scenario, rangeDays, tzOffset } = req.body || {};
    const scen = ['crush', 'ex_reconcile', 'win_over', 'cold_contact'].indexOf(scenario) >= 0 ? scenario : 'crush';
    const range = Math.max(7, Math.min(31, Number(rangeDays) || 30));

    if (!you || !you.year || !you.month || !you.day || !them || !them.year || !them.month || !them.day) {
      return res.status(400).json({ error: t('Please provide both birth dates.', '두 사람의 생년월일을 입력해주세요.', '请提供双方的出生年月日。') });
    }

    // 付费门（照 love-destiny：全解锁会员 / 月会员 / 单买 → 完整；免费/游客 → 只给下一个真窗口）
    const full = memberTier(req) !== null || hasFullAccess(req, ['bazi', 'love_destiny']);

    let youPf, themPf;
    try {
      youPf = buildProfile(you);
      themPf = buildProfile(them);
    } catch (e) {
      console.error('[BEST-TIMING engine ERR]', e.message);
      return res.status(400).json({ error: t('Could not cast the charts — please check the dates.', '배반할 수 없어요 — 날짜를 확인해주세요.', '这些生辰排不出盘，请检查日期。') });
    }

    const { picked, avoid, lowDays } = computeWindows(youPf, themPf, range, tzOffset);
    if (!picked.length) {
      return res.json({
        tier: full ? 'paid' : 'free', locked: !full, windowCount: 0, windows: [], lowDays,
        themHourKnown: themPf.hourKnown,
        disclaimer: 'Timing guidance, not a promise.',
        note: t('No standout window in this range — the days run fairly even. Try a different scenario or check back after new charts of energy roll in.',
          '이 기간엔 두드러진 시기가 없어요 — 날들이 비교적 고르네요.',
          '这段时间没有特别突出的窗口 —— 各日能量较平。'),
      });
    }

    let windows = templateWindows(picked, scen);
    // LLM 只润色 why/tone（付费全量润色；免费只润色第 1 个即可省 token）——失败回落模板
    const toPolish = full ? windows : windows.slice(0, 1);
    await polishWithLLM(toPolish, scen, lang, youPf, themPf);

    const windowCount = windows.length;
    let out;
    if (full) {
      out = windows; // 完整
    } else {
      // 免费：第 1 个真窗口全给，其余只回 label/off（date/why/tone/时辰 一律 null，付费内容不进 DOM）
      out = windows.map((w, i) => i === 0 ? w : {
        date: null, off: w.off, label: w.label, locked: true,
        shichen: null, hourStart: null, hourEnd: null, why: null, tone: null, reasons: [],
      });
    }

    const avoidOut = full && avoid
      ? { date: `${avoid.Y}-${String(avoid.M).padStart(2, '0')}-${String(avoid.D).padStart(2, '0')}`, mon: MON[avoid.M - 1], dnum: avoid.D, weekday: avoid.weekday }
      : (avoid ? { locked: true, mon: MON[avoid.M - 1] } : null);

    try {
      insertReading.run('best_timing', JSON.stringify({ you, them, scenario: scen, rangeDays: range, lang }),
        JSON.stringify({ windowCount, top: windows[0] && windows[0].date }), req.userId);
    } catch (e) {}

    res.json({
      tier: full ? 'paid' : 'free',
      locked: !full,
      windowCount,
      windows: out,
      avoid: avoidOut,
      lowDays: full ? lowDays : [],
      themHourKnown: themPf.hourKnown,
      disclaimer: 'Timing guidance, not a promise. A good window improves your odds and your own poise — it does not control anyone.',
    });
  } catch (err) {
    console.error('[BEST-TIMING ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'best-timing' } });
    res.status(500).json({ error: t('Runae is resting — please try again.', '잠시 후 다시 시도해주세요.', '暂时不可用，请稍后再试。') });
  }
});

module.exports = router;
