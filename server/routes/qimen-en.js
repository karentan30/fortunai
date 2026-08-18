'use strict';
/**
 * routes/qimen-en.js — Runae · Qi Men Dun Jia (Mystic Doors) — English
 *   POST /api/qimen-en          — compute plate + AI reading
 *   GET  /api/qimen-en/quota    — quota check
 *
 * Engine: server/lib/qimen-engine (computeQimen) — real plate, no LLM invention.
 * LLM (deepseekChat): reads the plate, gives strategic timing/direction guidance.
 * Free quota: 2 readings per IP per day.
 *
 * ⚠️ Not mounted yet — add to server/index.js:
 *   app.use('/api', require('./routes/qimen-en'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');
const { computeQimen } = require('../lib/qimen-engine');

let mon = null;
try {
  mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require });
} catch (e) {}

// ── Quota ───────────────────────────────────────────────────────────
const QIMEN_FREE_DAILY = 2;

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
  return (uid || sessionId || getClientIp(req)) + '_qimen_en_' + day;
}

function _usage() {
  if (!_M.qimenEnUsage) _M.qimenEnUsage = {};
  return _M.qimenEnUsage;
}

function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier };
  const usage = _usage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < QIMEN_FREE_DAILY, remaining: Math.max(0, QIMEN_FREE_DAILY - used), isMember: false, tier: null };
}

function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return;
  const usage = _usage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

// ── Helpers ──────────────────────────────────────────────────────────

// Build a human-readable directions summary from the plate's directions object
function formatDirections(directions) {
  if (!directions || typeof directions !== 'object') return 'Not available';
  const parts = [];
  for (const [dir, info] of Object.entries(directions)) {
    if (info && (info.auspicious || info.score > 0)) {
      parts.push(dir + (info.label ? ' (' + info.label + ')' : ''));
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'Refer to palace positions in the plate';
}

// Serialize the 9-palace grid for LLM (text table)
function serializeGrid(jiuGongGe) {
  if (!Array.isArray(jiuGongGe) || jiuGongGe.length === 0) return 'Not available';
  return jiuGongGe.map(p => {
    const items = [];
    if (p.palace) items.push('Palace ' + p.palace);
    if (p.gong) items.push('Gong: ' + p.gong);
    if (p.door) items.push('Door: ' + p.door);
    if (p.star) items.push('Star: ' + p.star);
    if (p.god) items.push('God: ' + p.god);
    if (p.stem) items.push('Stem: ' + p.stem);
    return items.join(' | ');
  }).join('\n');
}

// ── System Prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are an Eastern divination interpreter for Qi Men Dun Jia (Mystic Doors) — the ancient strategic art of timing, positioning, and directional intelligence.' +
  '\n\nIDENTITY: This is an AI-generated reading for entertainment and self-reflection. State this naturally in your closing line — never as a cold disclaimer. You do not invent or alter plate data; the plate was computed by a real engine and handed to you as fixed facts.' +
  '\n\nWORDS TO AVOID: Never use the word "Chinese" anywhere in your response. Use "Eastern" instead. "Qi Men Dun Jia", "Eight Doors", "Nine Palaces", "Mystic Doors" are fine.' +
  '\n\nHONESTY: Qi Men reads the energy of a moment — it describes tendencies, not certainties. Always hand the wheel back: say what the plate suggests, not what will definitely happen. Close with a line like "These are the winds of the moment — not fate, not a guarantee, but a strategic lens." Avoid absolute predictions. Avoid fear-inducing language.' +
  '\n\nANTI-FATALISM: Trends, not guarantees. Strategic options, not destiny.' +
  '\n\nVOICE: Calm, precise, a little mysterious. Short paragraphs. Speak directly to the person about their question. Plain English — no jargon dumps. Explain any technical Qi Men term the first time you use it.' +
  '\n\nSTRUCTURE (280-420 words): A warm one-line opening that acknowledges the person\'s question · A paragraph on the current Ju (cycle number) and whether it is Yang Dun or Yin Dun — what energy this cycle carries · A paragraph on the Zhi Fu (Chief Star palace) and Zhi Shi (Mission Star palace) — what they say about the situation and the actor · Up to 3 bullet points on the most significant pattern tags and what they mean for this question · One paragraph on timing and direction guidance (auspicious directions from the plate if available) · Closing: honest one-liner about trends vs guarantees + AI entertainment note.';

// ── POST /api/qimen-en ───────────────────────────────────────────────
router.post('/qimen-en', rateLimitMiddleware, async (req, res) => {
  try {
    const question = String((req.body && req.body.question) || '').slice(0, 500).trim();
    if (!question) {
      return res.status(400).json({ error: 'Please enter your question or situation.' });
    }

    const q = checkQuota(req);
    if (!q.allowed) {
      return res.json({
        upgrade: true,
        needMember: true,
        message: 'You have used your 2 free readings for today. Come back tomorrow for 2 more — or unlock unlimited readings with membership.'
      });
    }

    // Parse optional time parameters
    const now = new Date();
    let chosenDate = now;
    if (req.body && req.body.date) {
      const parsed = new Date(req.body.date);
      if (!isNaN(parsed.getTime())) chosenDate = parsed;
    }
    if (req.body && req.body.hour !== undefined && req.body.hour !== null && req.body.hour !== '') {
      const h = parseInt(req.body.hour, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) {
        chosenDate = new Date(chosenDate);
        chosenDate.setHours(h, 0, 0, 0);
      }
    }

    const method = (req.body && req.body.method === 'feipan') ? 'feipan' : 'zhuanpan';

    // Compute the plate
    let plate;
    try {
      plate = await computeQimen({ date: chosenDate, method, scope: 'hour' });
    } catch (engineErr) {
      console.error('[QIMEN-EN ENGINE ERR]', engineErr.message);
      return res.status(500).json({ error: 'The plate could not be cast — please try again in a moment.' });
    }

    // Build structured summary for LLM
    const patternTop = Array.isArray(plate.patternTags) ? plate.patternTags.slice(0, 5) : [];
    // voidPalaces entries are objects { branch, palace, name } — flatten to readable text
    const voidList = Array.isArray(plate.voidPalaces) && plate.voidPalaces.length
      ? plate.voidPalaces.map(v => (v && typeof v === 'object')
          ? ((v.name || ('Palace ' + v.palace)) + (v.branch ? ' (' + v.branch + ')' : ''))
          : String(v)).join(', ')
      : 'None';
    const auspiciousDirs = formatDirections(plate.directions);
    const gridText = serializeGrid(plate.jiuGongGe);

    const userMsg =
      'QUESTION / SITUATION: ' + question +
      '\n\nPLATE (computed — treat as fixed facts):' +
      '\nJu Number (局数): ' + (plate.juShu != null ? plate.juShu : 'N/A') +
      '\nDun Type: ' + (plate.isYangDun ? 'Yang Dun (阳遁 — ascending energy)' : 'Yin Dun (阴遁 — descending/inward energy)') +
      '\nZhi Fu palace (值符 — Chief Star): ' + (plate.zhiFu || 'N/A') +
      '\nZhi Shi palace (值使 — Mission Star / Eight Doors): ' + (plate.zhiShi || 'N/A') +
      '\nHorse Star (驿马): ' + (plate.horseStar || 'N/A') +
      '\nVoid Palaces (空亡): ' + voidList +
      '\nTop Pattern Tags (格局): ' + (patternTop.length > 0 ? patternTop.join(', ') : 'None identified') +
      '\nAuspicious Directions: ' + auspiciousDirs +
      '\n\nNINE-PALACE GRID (九宫格):\n' + gridText +
      '\n\nRead the plate for this person\'s question. Follow your structure instructions.';

    const messages = buildReadingPrompt(SYSTEM_PROMPT, userMsg);
    const reading = await deepseekChat(messages, { maxTokens: 1400 });

    consumeQuota(req);

    try {
      insertReading.run('qimen-en', JSON.stringify({ question, date: chosenDate, method, juShu: plate.juShu }), reading, req.userId);
    } catch (e) {}

    const afterQ = checkQuota(req);

    // Build a safe serializable plate summary for the frontend
    const plateSummary = {
      juShu: plate.juShu,
      isYangDun: plate.isYangDun,
      zhiFu: plate.zhiFu,
      zhiShi: plate.zhiShi,
      horseStar: plate.horseStar,
      voidPalaces: plate.voidPalaces,
      patternTags: patternTop,
      jiuGongGe: Array.isArray(plate.jiuGongGe) ? plate.jiuGongGe : [],
      directions: plate.directions || {},
      ganzhi: plate.ganzhi || {},
      timeInfo: plate.timeInfo || {},
      method,
      chosenDate: chosenDate.toISOString()
    };

    res.json({ plate: plateSummary, reading, remaining: afterQ.remaining, isMember: q.isMember });
  } catch (err) {
    console.error('[QIMEN-EN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'qimen-en' } });
    res.status(500).json({ error: 'The gate is not yet open — please try again in a moment.' });
  }
});

// ── GET /api/qimen-en/quota ──────────────────────────────────────────
router.get('/qimen-en/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: QIMEN_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: QIMEN_FREE_DAILY, limit: QIMEN_FREE_DAILY, error: e.message });
  }
});

module.exports = router;
