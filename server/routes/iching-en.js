'use strict';
/**
 * routes/iching-en.js — Runae · I Ching · Six Lines (Liu Yao)
 *   POST /api/iching-en          — cast hexagram (time-based or manual yaoArray) → AI reading
 *   GET  /api/iching-en/quota    — free quota remaining (2/day per IP)
 *
 * Engine: server/lib/liuyao-engine (real algorithm, not LLM-invented).
 * LLM only interprets — it never invents hexagram numbers or line values.
 *
 * ⚠️ Route not auto-mounted — Karen adds to server/index.js:
 *   app.use('/api', require('./routes/iching-en'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');
const { computeLiuyao } = require('../lib/liuyao-engine');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// Free quota: 2 per day per IP/session
const ICHING_FREE_DAILY = 2;

// ══════════════════════════════════════════════════════════════════
// Quota helpers
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
  return (uid || sessionId || getClientIp(req)) + '_iching_en_' + day;
}
function _ichingUsage() { if (!_M.ichingEnUsage) _M.ichingEnUsage = {}; return _M.ichingEnUsage; }

function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier };
  const usage = _ichingUsage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < ICHING_FREE_DAILY, remaining: Math.max(0, ICHING_FREE_DAILY - used), isMember: false, tier: null };
}
function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return;
  const usage = _ichingUsage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

// ══════════════════════════════════════════════════════════════════
// Hexagram rendering helpers
// ══════════════════════════════════════════════════════════════════

// Convert yao value to line type
function yaoToLineType(v) {
  if (v === 9) return { type: 'yang', moving: true };   // old yang → changes to yin
  if (v === 6) return { type: 'yin', moving: true };    // old yin  → changes to yang
  if (v === 7) return { type: 'yang', moving: false };
  if (v === 8) return { type: 'yin', moving: false };
  return { type: 'yang', moving: false };
}

// Build a compact human-readable summary of the six relatives for LLM
function summarizeSixRelatives(sixRelatives) {
  if (!sixRelatives || !Array.isArray(sixRelatives)) return '(not available)';
  return sixRelatives.map((rel, i) => `Line ${i + 1}: ${rel}`).join(', ');
}

// Build LLM user message block from engine output
function buildUserMessage(question, chart) {
  const { originalName, changedName, interName, changingYaos, sixGods, sixRelatives,
          najiaDizhi, worldAndResponse, voidBranches, palace, ganzhi } = chart;

  // changingYaos is an array of objects: { position, isChanging, type }. position is 1-based.
  const movingPositions = Array.isArray(changingYaos)
    ? changingYaos.filter(y => y && (y.isChanging || y.position != null))
                  .map(y => (typeof y === 'object' ? y.position : y + 1))
    : [];
  const hasChanges = movingPositions.length > 0;
  const changingStr = hasChanges
    ? `Line(s) ${movingPositions.join(', ')} are moving (changing)`
    : 'No moving lines (static hexagram)';

  // worldAndResponse is an array like ["","","世","","","应"] (index = line-1).
  let shiYing = '(not available)';
  if (Array.isArray(worldAndResponse)) {
    const wi = worldAndResponse.findIndex(v => v === '世');
    const yi = worldAndResponse.findIndex(v => v === '应');
    if (wi >= 0 || yi >= 0) {
      shiYing = `World (shi) at Line ${wi >= 0 ? wi + 1 : '?'}, Response (ying) at Line ${yi >= 0 ? yi + 1 : '?'}`;
    }
  }

  const palaceName = (palace && typeof palace === 'object') ? (palace.name || '') : (palace || '');

  const voidStr = voidBranches && voidBranches.length
    ? voidBranches.join(', ')
    : 'none';

  const sixRelStr = summarizeSixRelatives(sixRelatives);
  const sixGodsStr = sixGods && Array.isArray(sixGods)
    ? sixGods.map((g, i) => `Line ${i + 1}: ${g}`).join(', ')
    : '(not available)';

  return [
    `The querent's question / situation: "${question}"`,
    '',
    '=== Hexagram Data (computed by a real engine — do not invent or alter any of this) ===',
    `Primary hexagram: ${originalName || '(unknown)'}`,
    hasChanges
      ? `Derived hexagram (after moving lines change): ${changedName || '(none)'}`
      : 'No derived hexagram (no moving lines).',
    `Mutual (inner) hexagram: ${interName || '(not available)'}`,
    `Palace (Gua Palace): ${palaceName || '(not available)'}`,
    `Ganzhi (stems/branches context): ${ganzhi || '(not available)'}`,
    `Moving lines: ${changingStr}`,
    `Six Gods by line: ${sixGodsStr}`,
    `Six Relatives by line: ${sixRelStr}`,
    `World/Response positions: ${shiYing}`,
    `Void branches (kong wang — weakened branches): ${voidStr}`,
    '',
    'Please interpret this hexagram reading for the querent, following your instructions exactly.'
  ].join('\n');
}

// ══════════════════════════════════════════════════════════════════
// System prompt
// ══════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT =
  'You are Rún — the voice of Runae, interpreting an I Ching / Six Lines (Liu Yao) hexagram oracle reading.' +
  ' The hexagram has been cast by a real algorithm — you must NOT invent, alter, or question any hexagram numbers, line values, or names provided. Treat all engine data as fixed facts.' +
  '\n\nCULTURAL FRAMING: This is an Eastern divination method rooted in the Book of Changes (I Ching / Yijing). Always say "Eastern" — never "Chinese". Hexagram names from the I Ching are fine to use.' +
  '\n\nVOICE & STRUCTURE (320–480 words, plain paragraphs): Warm, quietly wise, a little poetic — never cold or clinical.' +
  ' Open with the primary hexagram name and a one-sentence image of its essence.' +
  ' Then a paragraph on what this hexagram says about the querent\'s situation — describe the momentum and hidden current, not a fixed outcome.' +
  ' If there are moving lines: a paragraph on which lines are changing and what they signal about the direction of movement.' +
  ' A paragraph on timing and approach — what this moment calls for (action, patience, a particular attitude).' +
  ' Close with one grounding sentence returning agency to the querent.' +
  '\n\nANTI-FATALISM: These are tendencies, not verdicts. Describe currents, not certainties. Never predict specific dates, events, or outcomes as guaranteed. The oracle shows the weather; the querent chooses the path.' +
  '\n\nAI LABEL (required): At the very end, add on its own line: "— AI-generated interpretation for self-reflection. Not professional advice."' +
  '\n\nNEVER name diseases, never frighten, never make financial or legal predictions.';

// ══════════════════════════════════════════════════════════════════
// POST /api/iching-en
//   body: { question, yaoArray?: number[6], useTime?: boolean, token? }
//   yaoArray: [6,7,8,9,7,8] — 6 values bottom to top (line 1 first)
//   If yaoArray omitted (or useTime:true), casts by current time.
// ══════════════════════════════════════════════════════════════════
router.post('/iching-en', rateLimitMiddleware, async (req, res) => {
  try {
    const question = String((req.body && req.body.question) || '').trim().slice(0, 500);
    if (!question) return res.status(400).json({ error: 'Please enter your question or situation.' });

    const q = checkQuota(req);
    if (!q.allowed) {
      return res.json({
        upgrade: true,
        needMember: true,
        message: 'You\'ve used your 2 free I Ching readings for today. Come back tomorrow, or unlock unlimited readings with membership ($9.90/mo).'
      });
    }

    // Cast the hexagram
    let chart;
    const rawYao = req.body && req.body.yaoArray;
    const useTime = req.body && req.body.useTime;

    if (!useTime && Array.isArray(rawYao) && rawYao.length === 6) {
      // Manual cast from coin ritual UI
      const yaoArray = rawYao.map(Number);
      if (yaoArray.some(v => ![6, 7, 8, 9].includes(v))) {
        return res.status(400).json({ error: 'Invalid yao values — each must be 6, 7, 8, or 9.' });
      }
      chart = await computeLiuyao({ yaoArray });
    } else {
      // Time-based cast
      chart = await computeLiuyao({ date: new Date() });
    }

    // Build prompt and call LLM
    const userMsg = buildUserMessage(question, chart);
    const messages = buildReadingPrompt(SYSTEM_PROMPT, userMsg);
    const reading = await deepseekChat(messages, { maxTokens: 1400 });

    consumeQuota(req);
    try { insertReading.run('iching-en', JSON.stringify({ question, chart: { originalName: chart.originalName, changedName: chart.changedName, palace: chart.palace, changingYaos: chart.changingYaos } }), reading, req.userId); } catch (e) {}

    const after = checkQuota(req);

    // Prepare safe hexagram data for frontend rendering
    const hexagram = {
      originalName: chart.originalName || '',
      changedName: chart.changedName || null,
      interName: chart.interName || null,
      palace: chart.palace || '',
      ganzhi: chart.ganzhi || '',
      changingYaos: chart.changingYaos || [],
      sixGods: chart.sixGods || [],
      sixRelatives: chart.sixRelatives || [],
      najiaDizhi: chart.najiaDizhi || [],
      worldAndResponse: chart.worldAndResponse || null,
      voidBranches: chart.voidBranches || [],
      // Engine echoes the resolved 6 line values in chart.yaoArray (6/7/8/9, line1→line6).
      // Map to {type,moving} so the page renders solid/broken + moving marks for BOTH
      // time-cast and coin-cast (client has no yaoArray for time-cast).
      yaos: Array.isArray(chart.yaoArray)
        ? chart.yaoArray.map(v => yaoToLineType(v))
        : null
    };

    res.json({
      hexagram,
      reading,
      remaining: after.remaining,
      isMember: q.isMember
    });

  } catch (err) {
    console.error('[ICHING-EN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'iching-en' } });
    res.status(500).json({ error: 'The oracle is settling — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/iching-en/quota
// ══════════════════════════════════════════════════════════════════
router.get('/iching-en/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: ICHING_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: ICHING_FREE_DAILY, limit: ICHING_FREE_DAILY, error: e.message });
  }
});

module.exports = router;
