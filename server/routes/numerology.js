'use strict';
/**
 * routes/numerology.js — Runae 数字命理 (Western Numerology)
 *   POST /api/numerology          — 规则算核心数字 (JS 确定性) → AI 解读
 *   GET  /api/numerology/quota    — 查询今日免费剩余次数
 *
 * 诚实定位: 数字【由 JS 用标准 Pythagorean 规则算, 确定的数学结果, 不让 LLM 算数字】,
 *   LLM 只负责【解读】(性格/天赋/今年 Personal Year)。同 "脚本算 · AI 解释"。
 *
 * 出海钩子: 西方人熟悉 Life Path Number, 零教育成本入门。
 *   免费: Life Path Number + 一段解读。
 *   完整 profile (Expression / Soul Urge / Personality / Birthday / Personal Year 深读) 引导会员。
 *
 * 复用 oracle.js 模式: deepseekChat + buildReadingPrompt + memberTier 配额 + 诚实/反宿命/AI 标识。
 *
 * ⚠️ 本路由建了未 mount — 由 Karen 统一在 server/index.js 挂:  app.use('/api', require('./routes/numerology'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// 免费额度: 每天 1 次完整算+解读 (Life Path 永远免费给)
const NUM_FREE_DAILY = 1;

// ══════════════════════════════════════════════════════════════════
// 核心数字算法 — 标准 Pythagorean numerology (纯数学, 确定的规则)
// ══════════════════════════════════════════════════════════════════

// Pythagorean 字母→数字表 (A=1 … I=9, J=1 … R=9, S=1 … Z=8)
const LETTER_MAP = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9,
  s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8
};
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
// Master numbers 不再约简 (标准 numerology: 11, 22, 33)
const MASTER = new Set([11, 22, 33]);

// 把任意数字反复相加约简到 1-9, 保留 master number (11/22/33)
function reduceNumber(n) {
  n = Math.abs(Math.floor(n));
  while (n > 9 && !MASTER.has(n)) {
    let sum = 0;
    while (n > 0) { sum += n % 10; n = Math.floor(n / 10); }
    n = sum;
  }
  return n;
}

// 约简但记录中间和 (用于展示 "28/1" 这类合成写法)
function reduceWithTrail(n) {
  const original = Math.abs(Math.floor(n));
  const final = reduceNumber(original);
  // 若原始就已是个位或 master, 不显合成
  const compound = (original > 9 && original !== final && !(MASTER.has(original)));
  return { value: final, compound: compound ? original : null };
}

// Life Path — 生日 年+月+日 各自约简后相加再约简 (标准做法, 保 master)
function lifePath(y, m, d) {
  const ry = reduceNumber(y);
  const rm = reduceNumber(m);
  const rd = reduceNumber(d);
  return reduceWithTrail(ry + rm + rd);
}

// Birthday Number — 出生"日" 约简 (1-31 → 保留 master)
function birthdayNumber(d) {
  return reduceWithTrail(d);
}

// 把姓名字母加起来 (filter: 全部 / 仅元音 / 仅辅音)
function sumName(name, filter) {
  let sum = 0;
  const letters = String(name).toLowerCase().replace(/[^a-z]/g, '');
  for (const ch of letters) {
    if (filter === 'vowels' && !VOWELS.has(ch)) continue;
    if (filter === 'consonants' && VOWELS.has(ch)) continue;
    sum += LETTER_MAP[ch] || 0;
  }
  return sum;
}

// Expression / Destiny — 全名全部字母
function expressionNumber(name) { return reduceWithTrail(sumName(name, 'all')); }
// Soul Urge / Heart's Desire — 仅元音
function soulUrgeNumber(name) { return reduceWithTrail(sumName(name, 'vowels')); }
// Personality — 仅辅音
function personalityNumber(name) { return reduceWithTrail(sumName(name, 'consonants')); }

// Personal Year — 出生"月+日" 约简 + 当前年 约简 (标准: master 在此步不保留, 转 1-9)
function personalYear(m, d, year) {
  const rm = reduceNumber(m);
  const rd = reduceNumber(d);
  let ry = reduceNumber(year);
  let n = rm + rd + ry;
  // Personal Year 传统上约到 1-9 (不保 master)
  while (n > 9) { let s = 0; while (n > 0) { s += n % 10; n = Math.floor(n / 10); } n = s; }
  return n;
}

// 校验 + 解析生日 (YYYY-MM-DD 或分字段)
function parseBirth(body) {
  let y, m, d;
  if (body && body.birthdate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(String(body.birthdate))) {
    const parts = String(body.birthdate).split('-').map(Number);
    y = parts[0]; m = parts[1]; d = parts[2];
  } else {
    y = Number(body && body.year); m = Number(body && body.month); d = Number(body && body.day);
  }
  if (!(y >= 1000 && y <= 9999)) return null;
  if (!(m >= 1 && m <= 12)) return null;
  if (!(d >= 1 && d <= 31)) return null;
  return { y, m, d };
}

// 计算完整 profile (确定的数字, 全部 JS 算好)
function computeProfile(name, y, m, d) {
  const now = new Date();
  const curYear = now.getFullYear();
  const lp = lifePath(y, m, d);
  const profile = {
    lifePath: lp.value,
    lifePathCompound: lp.compound,
    birthday: birthdayNumber(d).value,
    personalYear: personalYear(m, d, curYear),
    personalYearOf: curYear
  };
  const cleanName = String(name || '').trim();
  if (cleanName && /[a-zA-Z]/.test(cleanName)) {
    profile.hasName = true;
    profile.expression = expressionNumber(cleanName).value;
    profile.soulUrge = soulUrgeNumber(cleanName).value;
    profile.personality = personalityNumber(cleanName).value;
  } else {
    profile.hasName = false;
  }
  return profile;
}

// ══════════════════════════════════════════════════════════════════
// 诚实定位 + 反宿命 + AI 标识 (拼进 system prompt)
// ══════════════════════════════════════════════════════════════════
const HONESTY_EN =
  '\n\nWHO YOU ARE (weave this in warmly, never a cold disclaimer): The numbers were computed by an exact formula — standard Pythagorean numerology — and read to you by an AI. You never invent or "sense" a number; the math is fixed, only the meaning is a conversation. Being AI is you being honest.' +
  '\n\nNEVER FATE, NEVER FEAR: A number is a lens on tendencies and talents — never a verdict on how your life must go. Always hand the wheel back: close with a line like "This isn\'t fate — the numbers describe a pattern, but what you do with it is yours." Never name diseases, never frighten. For self-reflection and entertainment only — not medical, legal, or financial advice.' +
  '\n\nVOICE: Warm, plain-spoken, a little wonder-struck. Speak directly to the person. Short paragraphs with some space. Always in English. Never say the number is "good" or "bad" — every number has gifts and growth edges.';

// ══════════════════════════════════════════════════════════════════
// 配额 helper (独立 usage key)
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
  return (uid || sessionId || getClientIp(req)) + '_numerology_' + day;
}
function _numUsage() { if (!_M.numerologyUsage) _M.numerologyUsage = {}; return _M.numerologyUsage; }

function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier: tier };
  const usage = _numUsage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < NUM_FREE_DAILY, remaining: Math.max(0, NUM_FREE_DAILY - used), isMember: false, tier: null };
}
function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return;
  const usage = _numUsage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

const UPGRADE_MSG =
  'Your free Life Path reading is done for today. Your full numerology profile — Expression, Soul Urge, Personality and a deep Personal Year forecast — comes with membership ($9.90/mo). Or come back tomorrow for another free Life Path read.';

// ══════════════════════════════════════════════════════════════════
// POST /api/numerology
//   body: { name?, birthdate:"YYYY-MM-DD" (或 year/month/day), full?:true, token? }
//   free  → 只解读 Life Path (+ Birthday), 数字全算但深读锁 Expression/SoulUrge
//   member/full → 完整 profile 全解读
// ══════════════════════════════════════════════════════════════════
router.post('/numerology', rateLimitMiddleware, async (req, res) => {
  try {
    const birth = parseBirth(req.body);
    if (!birth) return res.status(400).json({ error: 'Please enter a valid birth date (year, month and day).' });

    const q = checkQuota(req);
    if (!q.allowed) return res.json({ upgrade: true, needMember: true, message: UPGRADE_MSG });

    const name = String((req.body && req.body.name) || '').slice(0, 80).trim();
    const profile = computeProfile(name, birth.y, birth.m, birth.d);
    const wantFull = q.isMember; // 会员才给完整深读; 游客/免费只深读 Life Path

    // 组装喂给 LLM 的确定数字 (LLM 只解读, 绝不重算)
    const lpLabel = profile.lifePathCompound ? `${profile.lifePathCompound}/${profile.lifePath}` : String(profile.lifePath);
    let numbersBlock = `Life Path Number: ${lpLabel}\nBirthday Number: ${profile.birthday}\nPersonal Year (${profile.personalYearOf}): ${profile.personalYear}`;
    if (wantFull && profile.hasName) {
      numbersBlock += `\nExpression / Destiny Number: ${profile.expression}\nSoul Urge / Heart's Desire Number: ${profile.soulUrge}\nPersonality Number: ${profile.personality}`;
    }

    let scope, structure;
    if (wantFull) {
      scope = 'Give them their FULL numerology profile.';
      structure =
        '\n\nSTRUCTURE (420-620 words, plain paragraphs, no giant lists): a warm one-line open · a paragraph on their Life Path Number (the headline of who they are — core drive, natural gifts, the growth edge) · ' +
        (profile.hasName ? 'a short paragraph each for Expression (outer talents / how they show up), Soul Urge (what their heart secretly wants), and Personality (first impression they give) · ' : 'a paragraph on their Birthday Number as a supporting talent · ') +
        'then a clear paragraph headed "Your ' + profile.personalYearOf + ' — Personal Year ' + profile.personalYear + '" on the theme and best focus of this year for them · close with your not-fate refrain.';
    } else {
      scope = 'Read ONLY their Life Path Number in depth (this is the free preview). Mention their Personal Year in one closing line, and invite — do not spoil — the fuller profile.';
      structure =
        '\n\nSTRUCTURE (240-360 words, plain paragraphs): a warm one-line open naming their Life Path Number · one paragraph on its core drive and natural gifts · one paragraph on its growth edge / shadow (honest but kind) · one short paragraph on the kind of work/relationships that tend to fit this number · a single closing line teasing that their Personal Year is ' + profile.personalYear + ' and there is a fuller profile (Expression, Soul Urge) waiting · then your not-fate refrain.';
    }

    const messages = buildReadingPrompt(
      'You are Rún — the voice of Runae, reading a Western numerology chart. ' + scope +
      ' The numbers below were ALREADY computed for you by an exact Pythagorean formula — treat them as fixed facts and NEVER recalculate, question, or change them. Master numbers (11, 22, 33) are intentional — read them as the master vibration, mentioning they also carry the energy of their reduced digit. ' + HONESTY_EN + structure,
      `Person's first name: ${name || '(not given — read from the numbers alone, address them warmly as "you")'}\nTheir computed numbers (fixed — do not recompute):\n${numbersBlock}\n\nRead these numbers for them, in your voice.`
    );

    const reading = await deepseekChat(messages, { maxTokens: wantFull ? 2000 : 1200 });
    consumeQuota(req);
    try { insertReading.run('numerology', JSON.stringify({ name, birth, profile, full: wantFull }), reading, req.userId); } catch (e) {}
    const after = checkQuota(req);

    // 免费用户: 返回 Life Path + Birthday + Personal Year 数字 (可展示大卡), 但深读只到 Life Path;
    //   Expression/SoulUrge/Personality 数字也返回(便于前端展示"锁"卡诱导), 但解读文字里没有。
    res.json({
      reading,
      profile: {
        lifePath: profile.lifePath,
        lifePathCompound: profile.lifePathCompound,
        birthday: profile.birthday,
        personalYear: profile.personalYear,
        personalYearOf: profile.personalYearOf,
        expression: profile.hasName ? profile.expression : null,
        soulUrge: profile.hasName ? profile.soulUrge : null,
        personality: profile.hasName ? profile.personality : null,
        hasName: profile.hasName
      },
      full: wantFull,
      remaining: after.remaining,
      isMember: q.isMember
    });
  } catch (err) {
    console.error('[NUMEROLOGY ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'numerology' } });
    res.status(500).json({ error: 'The numbers are settling — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/numerology/quota
// ══════════════════════════════════════════════════════════════════
router.get('/numerology/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: NUM_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: NUM_FREE_DAILY, limit: NUM_FREE_DAILY, error: e.message });
  }
});

// 导出算法供测试/复用
router.__calc = { reduceNumber, lifePath, expressionNumber, soulUrgeNumber, personalityNumber, personalYear, computeProfile };

module.exports = router;
