'use strict';
/**
 * routes/daliuren-en.js — Runae Da Liu Ren (大六壬) English Oracle
 *   POST /api/daliuren-en          — real engine plate → AI reading
 *   GET  /api/daliuren-en/quota    — today's free-quota status (2/day per IP)
 *
 * Engine: computeDaLiuRen() wraps generateLiuren() from mingyu-core (vendored, MIT).
 * LLM: deepseekChat() interprets — engine branch values are fixed facts, LLM only reads.
 * Honesty: AI label + entertainment disclaimer + anti-fatalism.
 *
 * Mount in server/index.js:  app.use('/api', require('./routes/daliuren-en'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { computeDaLiuRen } = require('../lib/daliuren-engine');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try {
  mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({
    project: 'shenyuan', require: require
  });
} catch (e) {}

// Free quota: 2 readings per IP per day
const DLR_FREE_DAILY = 2;

// ── quota helpers ──────────────────────────────────────────────────────────────

function _uid(req) {
  return resolveUserFromToken(
    req.headers['authorization'] || (req.body && req.body.token),
    { get: function(t) { var row = _M.tokens.find(function(x) { return x.token === t; }); return row || null; } }
  );
}

function _quotaKey(req) {
  var uid = _uid(req);
  var day = new Date().toISOString().slice(0, 10);
  var sessionId = req.headers['x-session-id'];
  return (uid || sessionId || getClientIp(req)) + '_daliuren_' + day;
}

function _dlrUsage() {
  if (!_M.daliurenUsage) _M.daliurenUsage = {};
  return _M.daliurenUsage;
}

function checkQuota(req) {
  var tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier: tier };
  var usage = _dlrUsage();
  var used = usage[_quotaKey(req)] || 0;
  return { allowed: used < DLR_FREE_DAILY, remaining: Math.max(0, DLR_FREE_DAILY - used), isMember: false, tier: null };
}

function consumeQuota(req) {
  var tier = memberTier(req);
  if (tier) return;
  var usage = _dlrUsage();
  var k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

// ── branch name → English meaning map ────────────────────────────────────────
// The twelve earthly branches (地支) with concise English gloss for the oracle UI
const BRANCH_EN = {
  子: { name: 'Zi (子)', element: 'Water', meaning: 'hidden seed, initiation' },
  丑: { name: 'Chou (丑)', element: 'Earth', meaning: 'patient accumulation, slowness' },
  寅: { name: 'Yin (寅)', element: 'Wood', meaning: 'initiative, forward thrust' },
  卯: { name: 'Mao (卯)', element: 'Wood', meaning: 'flourishing, open door' },
  辰: { name: 'Chen (辰)', element: 'Earth', meaning: 'transformation, complication' },
  巳: { name: 'Si (巳)', element: 'Fire', meaning: 'culmination, decisive moment' },
  午: { name: 'Wu (午)', element: 'Fire', meaning: 'peak brightness, outward action' },
  未: { name: 'Wei (未)', element: 'Earth', meaning: 'completion, ripening' },
  申: { name: 'Shen (申)', element: 'Metal', meaning: 'swift movement, cutting clarity' },
  酉: { name: 'You (酉)', element: 'Metal', meaning: 'harvest, precision' },
  戌: { name: 'Xu (戌)', element: 'Earth', meaning: 'guarding, final threshold' },
  亥: { name: 'Hai (亥)', element: 'Water', meaning: 'dormancy, return to source' },
};

function branchInfo(branch) {
  return BRANCH_EN[branch] || { name: branch, element: 'Unknown', meaning: '' };
}

// ── LLM prompts ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are an Eastern divination interpreter for Da Liu Ren (大六壬), the classical heavenly plate oracle. ' +
  'The plate has been computed by a real engine — do not invent branch positions or transmission values. ' +
  'The three transmissions (Initial / Middle / Final) represent the trajectory of the situation: ' +
  'Initial = the hidden root, Middle = the unfolding dynamic, Final = the likely resolution. ' +
  '\n\nUSE "Eastern" not "Chinese". "Da Liu Ren" and classical term names (branch names, Ganzhi, Tianjiang) are fine. ' +
  '\n\nHONESTY: This is AI-generated entertainment and reflection only. Always clarify: for reference only, not a guaranteed prediction. ' +
  'Describe the oracle\'s reading as tendencies and energetic patterns — never fate, never certainty. ' +
  'End with a line like: "This is a pattern in the moment — what you do with it is yours." ' +
  '\n\nVOICE: Warm, a little mystical, precise. Short paragraphs. Always in English. ' +
  'Speak directly to the person asking. Do not moralize or alarm.';

function buildUserMessage(plate, question) {
  var t = plate.threeTransmissions || [];
  var chu = t[0] || {};
  var zhong = t[1] || {};
  var mo = t[2] || {};
  var bi = function(b) { return branchInfo(b); };

  var lines = [
    'QUESTION / SITUATION: ' + (question || '(none given)'),
    '',
    '── DA LIU REN PLATE (computed by real engine) ──',
    'Ganzhi day: ' + (plate.ganzhi && plate.ganzhi.day || ''),
    'Month leader (月将): ' + (plate.monthLeader || ''),
    'Day/Night divination: ' + (plate.dayNight || ''),
    'Transmission rule (取传规则): ' + (plate.transmissionRule || ''),
    'Transmission pattern (三传格局): ' + (plate.transmissionPattern || ''),
    '',
    '── THREE TRANSMISSIONS (三传) — engine-derived, do not alter ──',
    'Initial transmission (初传): branch ' + (chu.branch || '') + ' — ' + bi(chu.branch).name + ' [' + bi(chu.branch).element + '] — ' + bi(chu.branch).meaning + (chu.isVoid ? ' [VOID — xun kong]' : '') + (chu.god ? ' · Tianjiang: ' + chu.god : ''),
    'Middle transmission (中传): branch ' + (zhong.branch || '') + ' — ' + bi(zhong.branch).name + ' [' + bi(zhong.branch).element + '] — ' + bi(zhong.branch).meaning + (zhong.isVoid ? ' [VOID — xun kong]' : '') + (zhong.god ? ' · Tianjiang: ' + zhong.god : ''),
    'Final transmission (末传): branch ' + (mo.branch || '') + ' — ' + bi(mo.branch).name + ' [' + bi(mo.branch).element + '] — ' + bi(mo.branch).meaning + (mo.isVoid ? ' [VOID — xun kong]' : '') + (mo.god ? ' · Tianjiang: ' + mo.god : ''),
    '',
    '── PATTERN TAGS (课格 / guaTi) ──',
    (plate.patternTags || []).join(' · ') || '(none)',
    '',
    'Lesson summary: ' + (plate.lessonSummary || ''),
    'Transmission summary: ' + (plate.transmissionSummary || ''),
    '',
    'Read the three transmissions for this question. 280–420 words. Three short paragraphs: ' +
    '(1) Initial — what is hidden or driving the situation now; ' +
    '(2) Middle — the dynamic unfolding, what is shifting; ' +
    '(3) Final — the likely direction or resolution. ' +
    'Then one closing sentence handing the steering wheel back to the person. ' +
    'Do not fabricate branch values beyond those above.'
  ];
  return lines.join('\n');
}

// ── POST /api/daliuren-en ─────────────────────────────────────────────────────

router.post('/daliuren-en', rateLimitMiddleware, async function(req, res) {
  try {
    var question = String((req.body && req.body.question) || '').slice(0, 500).trim();
    if (!question) {
      return res.status(400).json({ error: 'Please enter your question or situation.' });
    }

    var q = checkQuota(req);
    if (!q.allowed) {
      return res.json({
        upgrade: true,
        needMember: true,
        message: 'You have used your 2 free Da Liu Ren readings for today. Come back tomorrow, or unlock unlimited readings with membership ($9.90/mo).'
      });
    }

    // Parse optional date override
    var dateOpt = null;
    if (req.body && req.body.date) {
      var parsed = new Date(req.body.date);
      if (!isNaN(parsed.getTime())) dateOpt = parsed;
    }

    // Compute real plate
    var plate;
    try {
      plate = await computeDaLiuRen({ date: dateOpt });
    } catch (engineErr) {
      console.error('[DALIUREN ENGINE ERR]', engineErr.message);
      return res.status(500).json({ error: 'The heavenly plate could not be cast — please try again.' });
    }

    // Build LLM messages and call
    var messages = buildReadingPrompt(SYSTEM_PROMPT, buildUserMessage(plate, question));
    var reading = await deepseekChat(messages, { maxTokens: 1200 });

    consumeQuota(req);
    try { insertReading.run('daliuren-en', JSON.stringify({ question: question, date: dateOpt }), reading, req.userId); } catch (e) {}

    var after = checkQuota(req);

    // Extract transmission data for frontend display
    var transmissions = (plate.threeTransmissions || []).map(function(t) {
      var info = branchInfo(t.branch);
      return {
        stage: t.stage,
        branch: t.branch,
        name: info.name,
        element: info.element,
        meaning: info.meaning,
        god: t.god || '',
        isVoid: t.isVoid || false,
        seasonState: t.seasonState || ''
      };
    });

    res.json({
      reading: reading,
      transmissions: transmissions,
      patternTags: plate.patternTags || [],
      transmissionPattern: plate.transmissionPattern || '',
      transmissionRule: plate.transmissionRule || '',
      monthLeader: plate.monthLeader || '',
      dayNight: plate.dayNight || '',
      ganzhi: plate.ganzhi || {},
      remaining: after.remaining,
      isMember: q.isMember
    });

  } catch (err) {
    console.error('[DALIUREN-EN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'daliuren-en' } });
    res.status(500).json({ error: 'The oracle is settling — please try again in a moment.' });
  }
});

// ── GET /api/daliuren-en/quota ────────────────────────────────────────────────

router.get('/daliuren-en/quota', function(req, res) {
  try {
    var q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: DLR_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: DLR_FREE_DAILY, limit: DLR_FREE_DAILY, error: e.message });
  }
});

module.exports = router;
