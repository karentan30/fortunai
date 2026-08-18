'use strict';
/**
 * routes/ziwei-en.js — Runae Zi Wei Dou Shu (Purple Star Astrology) — English
 *   POST /api/ziwei-en        — validate → computeBaziChart (real engine) → deepseekChat reading
 *   GET  /api/ziwei-en/quota  — 1/day per IP free
 *
 * Engine: computeBaziChart({ year, month, day, hour, gender, includeZiwei: true })
 *   returns chart.ziwei.gongs[] (12 palaces, each with .gong .dizhi .mainStars .auxStars .sihua)
 *   and chart.ziwei.shenGongIndex (body palace index)
 *
 * Honesty contract: star positions computed by real deterministic engine.
 *   LLM interprets only — never invents star positions.
 *   "Eastern" not "Chinese" in all user-visible text.
 *   Age gate: ≥ 14.
 *   AI + entertainment disclaimer in every response.
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try {
  mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({
    project: 'shenyuan', require
  });
} catch (e) {}

const FREE_DAILY = 1;

// ── Palace name translations ──────────────────────────────────────
const PALACE_EN = {
  '命宫': 'Life',
  '兄弟': 'Siblings',
  '夫妻': 'Relationships',
  '子女': 'Children',
  '财帛': 'Wealth',
  '疾厄': 'Health',
  '迁移': 'Travel & Change',
  '交友': 'Friends & Society',
  '官禄': 'Career',
  '田宅': 'Home & Property',
  '福德': 'Fortune & Spirit',
  '父母': 'Parents & Heritage'
};

// ── Quota helpers ─────────────────────────────────────────────────
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
  return (uid || sessionId || getClientIp(req)) + '_ziwei_en_' + day;
}
function _usage() { if (!_M.ziweiEnUsage) _M.ziweiEnUsage = {}; return _M.ziweiEnUsage; }

function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier };
  const usage = _usage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < FREE_DAILY, remaining: Math.max(0, FREE_DAILY - used), isMember: false, tier: null };
}
function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return;
  const usage = _usage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

// ── Palace summary builder ────────────────────────────────────────
function buildPalaceSummary(ziwei) {
  const palaces = ziwei.gongs.map((g, idx) => {
    const nameEn = PALACE_EN[g.gong] || g.gong;
    const isLife = idx === 0;
    const isBody = idx === ziwei.shenGongIndex;
    return {
      index: idx,
      nameZh: g.gong,
      nameEn,
      dizhi: g.dizhi,
      isLife,
      isBody,
      mainStars: Array.isArray(g.mainStars) ? g.mainStars : [],
      auxStars: Array.isArray(g.auxStars) ? g.auxStars : [],
      sihua: Array.isArray(g.sihua) ? g.sihua : []
    };
  });
  const lifePalace = palaces[0];
  return { palaces, lifePalace };
}

// ── LLM prompt builder ────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are an Eastern astrology interpreter specializing in Zi Wei Dou Shu (Purple Star Astrology). ' +
  'The chart has been computed by a real deterministic engine — do NOT invent, modify, or question star positions. Treat them as fixed facts.\n\n' +
  'Use "Eastern" not "Chinese". System names (Zi Wei, Purple Star, the 14 major stars) are fine to name directly.\n\n' +
  'THIS IS AI-GENERATED ENTERTAINMENT AND REFLECTION — not a prediction of guaranteed outcomes. Always describe archetypal patterns and tendencies, never certainties or fate.\n\n' +
  'FOCUS: 1) Life Palace (命宫) — the stars present and what they suggest about core character and destiny\'s shape. ' +
  '2) Career Palace (官禄) — vocational patterns and strengths. ' +
  '3) Wealth Palace (财帛) — approach to resources and prosperity patterns. ' +
  '4) Relationships Palace (夫妻) — partnership tendencies and relational style.\n\n' +
  'VOICE: Warm, plain-spoken, a little wonder-struck. Speak directly to "you." Short paragraphs. Always in English. ' +
  'Describe gifts AND growth edges. Never name diseases. Never frighten. ' +
  'Close with your not-fate refrain: remind them that these are patterns, not verdicts — the chart is a map, not a sentence.';

function buildUserMessage(palaces, lifePalace, year, month, day, hour, gender) {
  const lifeStars = lifePalace.mainStars.length ? lifePalace.mainStars.join(', ') : '(empty — this is a powerful void position)';
  const hourLabel = ['Zi 23-01', 'Chou 01-03', 'Yin 03-05', 'Mao 05-07', 'Chen 07-09', 'Si 09-11',
    'Wu 11-13', 'Wei 13-15', 'Shen 15-17', 'You 17-19', 'Xu 19-21', 'Hai 21-23'];
  const hourIdx = Math.floor(((Number(hour) + 1) / 2)) % 12;
  const hourStr = hourLabel[hourIdx] || String(hour);

  let msg = `Birth: year ${year}, month ${month}, day ${day}, hour period ${hourStr}, gender ${gender}.\n\n`;
  msg += `Life Palace (命宫) major star(s): ${lifeStars}\n\n`;
  msg += 'All 12 palaces (computed by real engine — interpret as given):\n';
  palaces.forEach(p => {
    const stars = p.mainStars.length ? p.mainStars.join(', ') : 'empty';
    const aux = p.auxStars.length ? ` [aux: ${p.auxStars.join(', ')}]` : '';
    const sihua = p.sihua.length ? ` {transformations: ${p.sihua.map(s => s.star + s.hua).join(', ')}}` : '';
    const tags = [];
    if (p.isLife) tags.push('LIFE PALACE');
    if (p.isBody) tags.push('BODY PALACE');
    msg += `${p.nameEn} (${p.nameZh}/${p.dizhi})${tags.length ? ' [' + tags.join(', ') + ']' : ''}: ${stars}${aux}${sihua}\n`;
  });
  msg += '\nWrite a warm, honest reading (350-500 words, plain paragraphs). Cover Life Palace first, then Career, Wealth, and Relationships. End with the not-fate refrain.';
  return msg;
}

// ── POST /api/ziwei-en ────────────────────────────────────────────
router.post('/ziwei-en', rateLimitMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const year = Number(body.year);
    const month = Number(body.month);
    const day = Number(body.day);
    const hour = Number(body.hour);
    const gender = String(body.gender || '').toLowerCase() === 'female' ? 'female' : 'male';

    // Validate inputs
    if (!(year >= 1000 && year <= 9999)) return res.status(400).json({ error: 'Please enter a valid birth year.' });
    if (!(month >= 1 && month <= 12)) return res.status(400).json({ error: 'Please enter a valid birth month (1-12).' });
    if (!(day >= 1 && day <= 31)) return res.status(400).json({ error: 'Please enter a valid birth day (1-31).' });
    if (!(hour >= 0 && hour <= 23)) return res.status(400).json({ error: 'Please select a valid birth hour.' });

    // Age gate: ≥ 14
    const currentYear = new Date().getFullYear();
    if (currentYear - year < 14) {
      return res.status(400).json({ error: 'This reading is for ages 14 and above.' });
    }

    const q = checkQuota(req);
    if (!q.allowed) {
      return res.json({
        upgrade: true,
        needMember: true,
        message: 'Your free Purple Star reading for today is done. Come back tomorrow, or unlock unlimited readings with membership.'
      });
    }

    // Compute chart via real engine (sync)
    let chart;
    try {
      chart = computeBaziChart({ year, month, day, hour, gender, includeZiwei: true });
    } catch (engineErr) {
      console.error('[ZIWEI-EN ENGINE ERR]', engineErr.message);
      return res.status(500).json({ error: 'Could not compute your chart — please check your birth details and try again.' });
    }

    const ziwei = chart.ziwei;
    if (!ziwei || !Array.isArray(ziwei.gongs) || ziwei.gongs.length < 12) {
      return res.status(500).json({ error: 'Chart engine returned incomplete data — please try again.' });
    }

    const { palaces, lifePalace } = buildPalaceSummary(ziwei);

    // Build LLM messages
    const messages = buildReadingPrompt(SYSTEM_PROMPT, buildUserMessage(palaces, lifePalace, year, month, day, hour, gender));

    const reading = await deepseekChat(messages, { maxTokens: 1800, temperature: 0.72 });
    consumeQuota(req);

    try {
      insertReading.run('ziwei-en', JSON.stringify({ year, month, day, hour, gender }), reading, req.userId);
    } catch (_e) {}

    const after = checkQuota(req);
    res.json({
      palaces,
      lifePalace,
      shenGongIndex: ziwei.shenGongIndex,
      reading,
      remaining: after.remaining,
      isMember: q.isMember
    });
  } catch (err) {
    console.error('[ZIWEI-EN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'ziwei-en' } });
    res.status(500).json({ error: 'The stars are settling — please try again in a moment.' });
  }
});

// ── GET /api/ziwei-en/quota ───────────────────────────────────────
router.get('/ziwei-en/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: FREE_DAILY, limit: FREE_DAILY, error: e.message });
  }
});

module.exports = router;
