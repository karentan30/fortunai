'use strict';
/**
 * routes/oracle.js — Runae 问事三系统 (draw-based + AI 解读)
 *   POST /api/oracle/tarot          — Tarot 塔罗 (随机抽 3 张 → AI 解读)
 *   POST /api/oracle/fortune-sticks — Fortune Sticks 求签 (随机抽 1 签 → AI 解读)
 *   POST /api/oracle/moon-blocks    — Moon Blocks 掷筊 (随机 3 态 yes/no/laughing → AI 解读)
 *   GET  /api/oracle/quota          — 查询今日免费剩余抽签次数
 *
 * 诚实定位: 这三个系统是【随机抽 + AI 解读】, 不是精确排盘引擎。
 *   - 前端负责随机抽 (卡牌/签号/掷筊结果), 后端只接收结果 + 用户问题 → 调 LLM 解读。
 *   - 也接受后端兜底随机 (若前端未传抽签结果)。
 *
 * 复用 daily.js 里 /api/chat 的模式: deepseekChat + buildReadingPrompt + memberTier 配额。
 * 免费给 1 次完整抽+解读; 深追问/多次引导会员 (慷慨拉活跃, 不硬付费墙)。
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { insertReading, memberTier, _M, _persist } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// 免费额度: 每天 1 次完整抽+解读 (慷慨拉活跃), 之后深聊引导会员。
const ORACLE_FREE_DAILY = 1;

// ══════════════════════════════════════════
// 共享: 诚实定位 + 反宿命 + AI 标识 (所有系统 system prompt 都拼接)
// ══════════════════════════════════════════
const HONESTY_EN =
  '\n\nWHO YOU ARE (say this plainly on the reading, woven in — never a cold disclaimer): This is a random draw read by an AI — an ancient ritual, honestly done. You do not排盘, you do not compute a precise chart, and you never pretend the draw was anything but chance meeting meaning. Being AI is you being honest; it makes you more trustworthy, not less.' +
  '\n\nNEVER FATE, NEVER FEAR: A draw shows a tendency and a way to think about your situation — never a verdict. Always hand the wheel back: close with a line like "This isn\'t fate — what you do next is yours." Bad-looking draws always come with a way forward. Never name diseases, never frighten. This is for self-reflection and entertainment only — not medical, legal, or financial advice.' +
  '\n\nVOICE: Warm, plain-spoken Eastern wisdom (say "Eastern", never "Chinese"). Say the human thing first, then the meaning. Short paragraphs, some space. Speak directly to the person about THEIR question. Always in English.';

// ══════════════════════════════════════════
// 配额 helper (独立 usage key, 不动 chatUsage)
// ══════════════════════════════════════════
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
  return (uid || sessionId || getClientIp(req)) + '_oracle_' + day;
}
function _oracleUsage() { if (!_M.oracleUsage) _M.oracleUsage = {}; return _M.oracleUsage; }

// 返回 { allowed, remaining, isMember } — 会员无限, 免费/游客每天 ORACLE_FREE_DAILY 次完整解读
function checkQuota(req) {
  const tier = memberTier(req);
  if (tier) return { allowed: true, remaining: -1, isMember: true, tier: tier };
  const usage = _oracleUsage();
  const used = usage[_quotaKey(req)] || 0;
  return { allowed: used < ORACLE_FREE_DAILY, remaining: Math.max(0, ORACLE_FREE_DAILY - used), isMember: false, tier: null };
}
function consumeQuota(req) {
  const tier = memberTier(req);
  if (tier) return; // 会员不计
  const usage = _oracleUsage();
  const k = _quotaKey(req);
  usage[k] = (usage[k] || 0) + 1;
  _persist();
}

const UPGRADE_MSG =
  'You\'ve had today\'s free reading with Rún. Go Yearly ($99/yr) to draw as often as you like and keep the conversation going — she remembers your questions. Or come back tomorrow for a fresh draw.';

// ══════════════════════════════════════════
// TAROT — 82 张牌 (22 大阿卡纳 + 简化组), 前端抽 3 张 (past/present/outcome)
// ══════════════════════════════════════════
const TAROT_MAJOR = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
  'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
  'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun',
  'Judgement', 'The World'
];
function drawTarot() {
  const pool = TAROT_MAJOR.slice();
  const picks = [];
  const slots = ['Past', 'Present', 'Outcome'];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const name = pool.splice(idx, 1)[0];
    const reversed = Math.random() < 0.4;
    picks.push({ slot: slots[i], card: name, reversed: reversed });
  }
  return picks;
}

router.post('/oracle/tarot', rateLimitMiddleware, async (req, res) => {
  try {
    const q = checkQuota(req);
    if (!q.allowed) return res.json({ upgrade: true, needMember: true, message: UPGRADE_MSG });

    const question = String((req.body && req.body.question) || '').slice(0, 500).trim();
    // 前端传抽好的牌; 没传就后端兜底抽 (诚实随机)
    let cards = (req.body && Array.isArray(req.body.cards) && req.body.cards.length) ? req.body.cards : drawTarot();
    // 归一化前端结构 {slot,card,reversed}
    cards = cards.slice(0, 3).map((c, i) => ({
      slot: c.slot || ['Past', 'Present', 'Outcome'][i] || 'Card',
      card: String(c.card || c.name || '').slice(0, 40),
      reversed: !!c.reversed
    }));
    const spread = cards.map(c => `${c.slot}: ${c.card}${c.reversed ? ' (reversed)' : ''}`).join(' · ');

    const messages = buildReadingPrompt(
      'You are Rún — the voice of Runae, reading a live Tarot pull.' +
      ' Read the three cards as one story of the person\'s situation: Past (what shaped it), Present (where they are), Outcome (where it\'s heading if nothing changes).' +
      ' Honour reversed cards as a softer, blocked, or inward version of the card — not simply "the opposite".' + HONESTY_EN +
      '\n\nSTRUCTURE (use plain paragraphs, no long lists, 220-380 words total): a warm one-line open naming what they asked · one short paragraph per card tied to THEIR question · then one paragraph "So what does this mean for you" with a concrete way to think or act · close with your refrain that this isn\'t fate.',
      `The person asked: "${question || '(they didn\'t type a question — read it as a general "where is my life heading right now")'}"\n\nThe cards they pulled: ${spread}\n\nRead these three cards for them, in your voice.`
    );

    const reading = await deepseekChat(messages, { maxTokens: 1400 });
    consumeQuota(req);
    try { insertReading.run('tarot', JSON.stringify({ question, cards }), reading, req.userId); } catch (e) {}
    const after = checkQuota(req);
    res.json({ reading, cards, remaining: after.remaining, isMember: q.isMember });
  } catch (err) {
    console.error('[ORACLE tarot ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'oracle-tarot' } });
    res.status(500).json({ error: 'The oracle is resting — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════
// FORTUNE STICKS — 抽 1 签 (1-100 号 + 吉凶等级)
// ══════════════════════════════════════════
const STICK_LEVELS = [
  { level: 'Great Fortune', weight: 12 },
  { level: 'Good Fortune', weight: 30 },
  { level: 'Middling', weight: 34 },
  { level: 'Caution', weight: 18 },
  { level: 'Ask Again', weight: 6 }
];
function drawStick() {
  const number = 1 + Math.floor(Math.random() * 100);
  const total = STICK_LEVELS.reduce((s, l) => s + l.weight, 0);
  let r = Math.random() * total;
  let level = STICK_LEVELS[STICK_LEVELS.length - 1].level;
  for (const l of STICK_LEVELS) { if (r < l.weight) { level = l.level; break; } r -= l.weight; }
  return { number, level };
}

router.post('/oracle/fortune-sticks', rateLimitMiddleware, async (req, res) => {
  try {
    const q = checkQuota(req);
    if (!q.allowed) return res.json({ upgrade: true, needMember: true, message: UPGRADE_MSG });

    const question = String((req.body && req.body.question) || '').slice(0, 500).trim();
    let stick = (req.body && req.body.stick && req.body.stick.number) ? req.body.stick : drawStick();
    stick = { number: Number(stick.number) || (1 + Math.floor(Math.random() * 100)), level: String(stick.level || 'Middling').slice(0, 30) };

    const messages = buildReadingPrompt(
      'You are Rún — the voice of Runae, reading a drawn Fortune Stick (an Eastern lot-drawing oracle).' +
      ` The seeker shook the bamboo cylinder and one numbered stick fell. You will be given its number and its overall omen level (${STICK_LEVELS.map(l => l.level).join(' / ')}).` +
      ' Give it a short evocative title (like an omen verse), a two-line poetic couplet you compose in that omen\'s spirit, then read what it means for THEIR question.' + HONESTY_EN +
      '\n\nSTRUCTURE (200-340 words): "Stick No. X · «your title»" on the first line · your 2-line verse · one paragraph reading it against their question · one paragraph "what to do with this" · close with your not-fate refrain. Keep the omen level honest — if it\'s Caution, don\'t sugar-coat, but always give a way through.',
      `The seeker asked: "${question || '(no question typed — read it as "what\'s the outlook on my life right now")'}"\n\nThey drew: Stick No. ${stick.number} — omen level: ${stick.level}\n\nRead this stick for them, in your voice.`
    );

    const reading = await deepseekChat(messages, { maxTokens: 1200 });
    consumeQuota(req);
    try { insertReading.run('lingqian', JSON.stringify({ question, stick }), reading, req.userId); } catch (e) {}
    const after = checkQuota(req);
    res.json({ reading, stick, remaining: after.remaining, isMember: q.isMember });
  } catch (err) {
    console.error('[ORACLE sticks ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'oracle-sticks' } });
    res.status(500).json({ error: 'The oracle is resting — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════
// MOON BLOCKS — 掷两块半月木, 3 态: sacred(yes) / no(angry) / laughing(ask again)
// ══════════════════════════════════════════
function tossBlocks() {
  const f1 = Math.random() < 0.5; // one up one down = sacred
  const f2 = Math.random() < 0.5;
  if (f1 !== f2) return { outcome: 'sacred', label: 'Sacred · Yes' };
  if (f1 && f2) return { outcome: 'no', label: 'No · both flat' };
  return { outcome: 'laughing', label: 'Laughing · ask again' };
}

router.post('/oracle/moon-blocks', rateLimitMiddleware, async (req, res) => {
  try {
    const q = checkQuota(req);
    if (!q.allowed) return res.json({ upgrade: true, needMember: true, message: UPGRADE_MSG });

    const question = String((req.body && req.body.question) || '').slice(0, 500).trim();
    let toss = (req.body && req.body.toss && req.body.toss.outcome) ? req.body.toss : tossBlocks();
    const validOutcomes = { sacred: 'Sacred · Yes', no: 'No · both flat', laughing: 'Laughing · ask again' };
    const outcome = validOutcomes[toss.outcome] ? toss.outcome : tossBlocks().outcome;
    toss = { outcome, label: validOutcomes[outcome] };

    const meaning = {
      sacred: 'SACRED (聖筊) — one block up, one down. A clear YES / blessing on the matter.',
      no: 'NO (陰筊) — both blocks flat. A no, or "not this, not now".',
      laughing: 'LAUGHING (笑筊) — both blocks round-side up. The blocks are laughing: your question wasn\'t clear, or it\'s not the right thing to ask — try asking it differently.'
    }[outcome];

    const messages = buildReadingPrompt(
      'You are Rún — the voice of Runae, reading a Moon Blocks toss (an Eastern yes/no divination with two crescent blocks).' +
      ' There are three honest outcomes: Sacred (yes), No, and Laughing (the question needs rephrasing). Read the outcome for the seeker\'s exact question — do not invent a different result.' + HONESTY_EN +
      '\n\nSTRUCTURE (160-280 words): name the outcome warmly in one line · one paragraph on what this answer means for THEIR specific question · if Laughing, gently coach them to ask a clearer / different question · one paragraph "so, next step" · close with your not-fate refrain.',
      `The seeker asked: "${question || '(no question typed — remind them Moon Blocks needs a clear yes/no question, and give them an example)'}"\n\nThe blocks landed: ${meaning}\n\nRead this toss for them, in your voice.`
    );

    const reading = await deepseekChat(messages, { maxTokens: 1000 });
    consumeQuota(req);
    try { insertReading.run('moon_blocks', JSON.stringify({ question, toss }), reading, req.userId); } catch (e) {}
    const after = checkQuota(req);
    res.json({ reading, toss, remaining: after.remaining, isMember: q.isMember });
  } catch (err) {
    console.error('[ORACLE blocks ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'oracle-blocks' } });
    res.status(500).json({ error: 'The oracle is resting — please try again in a moment.' });
  }
});

// ══════════════════════════════════════════
// GET /api/oracle/quota
// ══════════════════════════════════════════
router.get('/oracle/quota', (req, res) => {
  try {
    const q = checkQuota(req);
    res.json({ isMember: q.isMember, tier: q.tier || 'free', remaining: q.remaining, limit: ORACLE_FREE_DAILY });
  } catch (e) {
    res.json({ isMember: false, remaining: ORACLE_FREE_DAILY, limit: ORACLE_FREE_DAILY, error: e.message });
  }
});

module.exports = router;
