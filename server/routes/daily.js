'use strict';
/**
 * routes/daily.js — 每日功能 & AI对话
 * POST /api/daily
 * POST /api/chat
 * GET  /api/chat/quota
 * GET  /api/chat-history
 * POST /api/chat-summary
 * POST /api/feedback
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const {
  insertReading, getReadingsByUser, hasFullAccess,
  updateStreak, _M, _persist,
} = require('../lib/store');
const { getToken } = require('../lib/store');
const { getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware, authMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({project: 'shenyuan', require: require}); } catch(e) {}

const READING_TYPE_NAMES = {
  bazi: '八字命理', tarot: '塔罗占卜', ziwei: '紫微斗数',
  mianxiang: '面相手相', hehun: '合婚配对', daily: '每日运势',
  xingming: '姓名学', astrology: '西方占星', liuyao: '六爻占卜',
  lingqian: '求神灵签', daliuren: '大六壬', qimen: '奇门遁甲',
  fengshui: '风水评测', geo_fortune: '地理命理'
};

// ══════════════════════════════════════════
// POST /api/daily — 每日运势
// ══════════════════════════════════════════
router.post('/daily', rateLimitMiddleware, async (req, res) => {
  try {
    // P0-10: 免费用户每日最多3次，付费会员无限
    const isMember = hasFullAccess(req, ['member']);
    if (!isMember) {
      const uid = resolveUserFromToken(req.headers['authorization'] || (req.body && req.body.token), { get: (t) => { const row = _M.tokens.find(x => x.token === t); return row || null; } });
      const day = new Date().toISOString().slice(0, 10);
      const dkey = (uid || getClientIp(req)) + '_daily_' + day;
      if (!_M.dailyUsage) _M.dailyUsage = {};
      const used = _M.dailyUsage[dkey] || 0;
      if (used >= 3) {
        return res.status(429).json({ error: '今日免费次数已用完，成为会员享无限天机', upgrade: true });
      }
      _M.dailyUsage[dkey] = used + 1;
      _persist();
    }

    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const messages = buildReadingPrompt(
      '你是一位晨间命理师，专门为人们开启美好的一天。你温暖如晨光，鼓励如春风，实用如老友。你熟读老黄历、精通五行生克，知道每一天的干支运势对人的影响。你的目标是给用户一整天的高能量和好心情。每次都给出具体的、个性化的、可执行的建议。每次回答至少1500字。用Markdown格式输出。语言：简体中文。',
      `用户：${birthYear||'?'}年${birthMonth||'?'}月${birthDay||'?'}日生 · ${gender === 'male' ? '男' : gender === 'female' ? '女' : ''}
今日日期：${dateStr}

请根据今天的干支五行和用户可能的日主，生成一份完整、温暖、充满能量的每日运势报告，至少1500字。每个章节用Markdown标题（##）形式：

## 一、今日黄历（按老黄历风格，150-200字）
- 今日干支（例如"甲子日""丙午日"等）
- 今日宜忌（至少各3条，具体到"宜签约""忌动土"等）
- 今日冲煞（冲什么生肖、什么时辰最需要注意）

## 二、五行能量评分（200-300字）
- 木、火、土、金、水今日能量百分比（精确到具体数字，总和100%）
- 今日哪个五行当令、哪个最弱
- 对用户来说，今日需要补什么五行、泄什么五行
- 对应到行动上：今天的能量适合做什么类型的事情

## 三、今日幸运信息（100-150字）
- 幸运色（3个颜色，说明为什么选这些颜色）
- 幸运数字（3个数字，结合今日干支的五行数理）
- 幸运方位（求财方位、求感情方位）
- 最吉利的时辰（几点到几点）

## 四、专属Affirmation（150-200字）
基于用户可能的日主五行，写一段独家的、非模板的、直击心灵的肯定语。

## 五、今日3个小行动（每条100-150字）
给用户3个具体、可执行、用时不超过15分钟的小行动建议。

## 六、今日古诗词配运势解读
选一首适合今日能量和意境的古诗词，用自己的话解读这首诗如何呼应今日的运势走向。

## 七、今日能量寄语（50-100字）
最后给用户一句温暖有力的话，作为今天的"能量钥匙"。`
    );

    const result = await deepseekChat(messages, { maxTokens: 8192 });
    insertReading.run('daily', JSON.stringify(req.body), result, req.userId);
    const streakData = updateStreak(req.userId || req.ip);
    res.json({ reading: result, streak: streakData.streak });
  } catch (err) {
    console.error('[DAILY ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'daily' } });
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/chat — AI命理对话
// ══════════════════════════════════════════
router.post('/chat', rateLimitMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !messages.length) return res.status(400).json({ error: '请提供消息内容' });

    const systemMsg = {
      role: 'system',
      content: '你是一位精通八字命理、紫微斗数、占星、塔罗的命理师，像温暖的朋友用大白话交流，不用文言文、不用"老朽""施主"。'
        + '\n\n【最重要的规则】命理判断必须基于用户的真实生辰八字。如果用户还没告诉你出生年月日时和性别，你【必须先温和地问清楚】，例如"想帮你算准，先告诉我你的出生年月日、大概几点、男生还是女生？时辰不确定也没关系"。'
        + '在拿到生辰之前，【绝对不要】编造具体的年份、财运、大运、幸运数字等判断——没有八字就瞎说会不准、也会被看穿。拿到生辰后，再基于八字给具体、温暖的分析。'
        + '\n\n每次回答200-400字，不要太长。建议要具体但诚实，不确定就说"这个我拿不准"。'
    };

    // 付费定位: 免费每天5条, 会员($6.9/月)无限畅聊
    var isMember = hasFullAccess(req, ['member']);
    if (!isMember) {
      var uid = resolveUserFromToken(req.headers['authorization'] || (req.body && req.body.token), { get: (t) => { const row = _M.tokens.find(x => x.token === t); return row || null; } });
      var day = new Date().toISOString().slice(0, 10);
      var ckey = (uid || getClientIp(req)) + '_' + day;
      var used = _M.chatUsage[ckey] || 0;
      if (used >= 5) {
        return res.json({ answer: '今天的免费畅聊次数用完啦～开通会员($6.9/月)就能和命理师无限畅聊，还解锁全部完整报告哦。', limited: true, needMember: true });
      }
      _M.chatUsage[ckey] = used + 1;
    }
    const allMessages = [systemMsg].concat(messages.slice(-10));
    const answer = await deepseekChat(allMessages, { maxTokens: 1024 });
    res.json({ answer });
  } catch (err) {
    console.error('[CHAT ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// GET /api/chat/quota — 查询今日免费剩余次数
// ══════════════════════════════════════════
router.get('/chat/quota', (req, res) => {
  try {
    var isMember = hasFullAccess(req, ['member']);
    if (isMember) return res.json({ isMember: true, remaining: -1 });
    var uid = null;
    const authH = req.headers['authorization'] || '';
    if (authH) {
      const t = authH.replace('Bearer ', '');
      const row = _M.tokens.find(x => x.token === t);
      if (row) uid = row.user_id;
    }
    var day = new Date().toISOString().slice(0, 10);
    var ckey = (uid || getClientIp(req)) + '_' + day;
    var used = _M.chatUsage[ckey] || 0;
    res.json({ isMember: false, remaining: Math.max(0, 5 - used), used: used, limit: 5 });
  } catch (e) {
    res.json({ isMember: false, remaining: 5, error: e.message });
  }
});

// ══════════════════════════════════════════
// GET /api/chat-history
// ══════════════════════════════════════════
router.get('/chat-history', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  try {
    const readings = getReadingsByUser.all(req.user.id);
    const mapped = readings.map(r => ({
      id: r.id, type: r.type, typeName: READING_TYPE_NAMES[r.type] || r.type,
      input: r.input, result: r.result,
      summary: r.input ? JSON.parse(r.input) : null, createdAt: r.created_at
    }));
    res.json({ readings: mapped });
  } catch (err) {
    console.error('[HISTORY ERR]', err.message);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// ══════════════════════════════════════════
// POST /api/chat-summary
// ══════════════════════════════════════════
router.post('/chat-summary', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  try {
    const readings = _M.readings
      .filter(r => r.user_id === req.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);

    if (!readings || readings.length === 0) {
      return res.json({ summary: '您还没有命理咨询记录。快去体验算命占卜吧！' });
    }

    const historyText = readings.map((r, i) => {
      const typeName = READING_TYPE_NAMES[r.type] || r.type;
      let inputPreview = '';
      try {
        const parsed = JSON.parse(r.input);
        inputPreview = Object.keys(parsed).map(k => k + ': ' + parsed[k]).join(', ').slice(0, 200);
      } catch (e) { inputPreview = r.input.slice(0, 200); }
      return '[咨询' + (i+1) + '] ' + r.created_at + ' | 类型: ' + typeName + '\n内容: ' + inputPreview;
    }).join('\n\n');

    const messages = [
      { role: 'system', content: '你是善缘平台的高级命理分析师。请根据用户近期的命理咨询记录，生成一份综合的命理趋势总结。\n\n要求：\n1. 提炼用户关注的核心问题领域（如事业、感情、财运等）\n2. 分析命理趋势和阶段性特征\n3. 给出持续的改进建议\n4. 语气温暖亲切，有洞察力\n5. 用简体中文，总字数600-1000字\n6. 用Markdown格式，有小标题和分段' },
      { role: 'user', content: '以下是用户近期的命理咨询记录：\n\n' + historyText + '\n\n请为用户生成一份命理趋势总结，分析他们关心的主要问题领域和命理趋势。' }
    ];

    const summary = await deepseekChat(messages, { maxTokens: 2048 });
    res.json({ summary, count: readings.length });
  } catch (err) {
    console.error('[SUMMARY ERR]', err.message);
    res.status(500).json({ error: '总结生成失败，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/feedback — 用户反馈
// ══════════════════════════════════════════
router.post('/feedback', rateLimitMiddleware, (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: '请填写完整信息' });
    if (!_M.feedbacks) _M.feedbacks = [];
    _M.feedbacks.push({ id: _M._id.o++, name, email, message, created_at: new Date().toISOString() });
    _persist();
    console.log('[FEEDBACK]', name, email, message.slice(0, 60));
    res.json({ success: true, message: '感谢您的反馈，我们将尽快回复！' });
  } catch (err) {
    console.error('[FEEDBACK ERR]', err.message);
    res.status(500).json({ error: '提交失败，请稍后重试' });
  }
});

module.exports = router;
