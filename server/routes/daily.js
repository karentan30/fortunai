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
  insertReading, getReadingsByUser, hasFullAccess, memberTier,
  updateStreak, _M, _persist,
} = require('../lib/store');

// 聊天每日限量: 免费/月会员 = 30句/天; 全解锁会员 = 无限。差异化靠"报告"不靠chat。
const CHAT_DAILY_LIMIT = 30;
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
    // P0-10: 免费用户每日最多3次，会员(月会员+全解锁会员均含每日运势)无限
    // 0817: 月会员套餐含"每日运势", 故 memberTier 非 null 即视为会员; 免费/游客限3次。
    const isMember = memberTier(req) !== null;
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

    const { birthYear, birthMonth, birthDay, birthHour, gender, lang } = req.body;
    const dailyLang = lang || 'zh';
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Deterministic daily seed — same person + same date = same lucky values
    const dateNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const birthNum = (Number(birthYear) || 0) * 10000 + (Number(birthMonth) || 0) * 100 + (Number(birthDay) || 0);
    const seed = dateNum + birthNum;
    const ELEMENTS_ZH = ['木', '火', '土', '金', '水'];
    const ELEMENTS_EN = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
    const ELEMENTS_KO = ['목', '화', '토', '금', '수'];
    const todayElementZh = ELEMENTS_ZH[seed % 5];
    const todayElementEn = ELEMENTS_EN[seed % 5];
    const todayElementKo = ELEMENTS_KO[seed % 5];
    const luckyNum1 = (seed % 9) + 1;
    const luckyNum2 = ((seed >> 3) % 9) + 1;
    const luckyNum3 = ((seed >> 6) % 9) + 1;

    let messages;
    if (dailyLang === 'en') {
      messages = buildReadingPrompt(
        'You are a warm, practical morning fortune teller who blends Chinese Five Elements wisdom with modern life advice. You give specific, actionable guidance that people can use today. Write at least 1000 words in fluent English. Use Markdown headers (##).',
        `User born: ${birthYear||'?'}/${birthMonth||'?'}/${birthDay||'?'} · ${gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : ''}
Today's date: ${dateStr}
Today's dominant element (pre-computed): ${todayElementEn}
Today's lucky numbers (pre-computed): ${luckyNum1}, ${luckyNum2}, ${luckyNum3}

Please generate a complete, warm, energizing daily fortune report of at least 1000 words using Markdown sections:

## Today's Energy Overview
Describe today's overall energy theme, what element is dominant, and what kinds of activities flow best today.

## Five Elements Balance
Today's element percentages (use the pre-computed dominant element: ${todayElementEn}). What to strengthen, what to release, practical life application.

## Your Lucky Details
Lucky colors (3, explain why), lucky numbers (use ${luckyNum1}, ${luckyNum2}, ${luckyNum3}), best directions for wealth and love, most auspicious time window today.

## Personal Affirmation
A unique, heartfelt affirmation rooted in today's energy — not a template, speak directly to the reader.

## 3 Small Actions for Today
Three specific, doable actions (under 15 minutes each) to align with today's energy.

## Today's Ancient Wisdom
A short poem or classical quote that resonates with today's energy theme, with your personal interpretation.

## Today's Energy Key
One warm, powerful closing message — the "energy key" for today.`
      );
    } else if (dailyLang === 'ko') {
      messages = buildReadingPrompt(
        '당신은 따뜻하고 실용적인 매일 운세 상담사입니다. 오행 지혜를 바탕으로 현대 생활에 맞는 구체적인 조언을 드립니다. 한국어로 최소 1000자 이상 작성하세요. 마크다운 헤더(##) 사용.',
        `사용자 생년월일: ${birthYear||'?'}년 ${birthMonth||'?'}월 ${birthDay||'?'}일 · ${gender === 'male' ? '남성' : gender === 'female' ? '여성' : ''}
오늘 날짜: ${dateStr}
오늘의 지배 오행(사전 계산): ${todayElementKo}
오늘의 행운 숫자(사전 계산): ${luckyNum1}, ${luckyNum2}, ${luckyNum3}

마크다운 섹션으로 최소 1000자 이상의 매일 운세 리포트를 작성해주세요:

## 오늘의 에너지 개요
오늘의 전반적인 에너지 테마, 지배 오행, 어떤 활동이 잘 맞는지 설명하세요.

## 오행 균형
오늘의 오행 비율(사전 계산된 지배 오행: ${todayElementKo}). 보충할 것, 완화할 것, 실생활 적용법.

## 오늘의 행운 정보
행운의 색상 3가지(이유 설명), 행운의 숫자(${luckyNum1}, ${luckyNum2}, ${luckyNum3} 사용), 재물과 사랑의 방향, 오늘 가장 길한 시간대.

## 나만의 확언
오늘 에너지에 뿌리를 둔 독특하고 진심 어린 확언 — 직접 독자에게 말하듯이.

## 오늘의 작은 행동 3가지
오늘의 에너지와 맞춰 할 수 있는 구체적인 행동 3가지(각 15분 이내).

## 오늘의 지혜
오늘 에너지 테마와 공명하는 짧은 시나 고전 명언과 해석.

## 오늘의 에너지 열쇠
따뜻하고 힘 있는 마무리 메시지 — 오늘의 "에너지 열쇠".`
      );
    } else {
      messages = buildReadingPrompt(
        '你是一位晨间命理师，专门为人们开启美好的一天。你温暖如晨光，鼓励如春风，实用如老友。你熟读老黄历、精通五行生克，知道每一天的干支运势对人的影响。你的目标是给用户一整天的高能量和好心情。每次都给出具体的、个性化的、可执行的建议。每次回答至少1500字。用Markdown格式输出。语言：简体中文。',
        `用户：${birthYear||'?'}年${birthMonth||'?'}月${birthDay||'?'}日生 · ${gender === 'male' ? '男' : gender === 'female' ? '女' : ''}
今日日期：${dateStr}
今日主导五行（预计算）：${todayElementZh}
今日幸运数字（预计算）：${luckyNum1}、${luckyNum2}、${luckyNum3}

请根据今天的干支五行和用户可能的日主，生成一份完整、温暖、充满能量的每日运势报告，至少1500字。每个章节用Markdown标题（##）形式：

## 一、今日黄历（按老黄历风格，150-200字）
- 今日干支（例如"甲子日""丙午日"等）
- 今日宜忌（至少各3条，具体到"宜签约""忌动土"等）
- 今日冲煞（冲什么生肖、什么时辰最需要注意）

## 二、五行能量评分（200-300字）
- 今日主导五行为${todayElementZh}，结合用户日主展开分析
- 木、火、土、金、水今日能量百分比（精确到具体数字，总和100%）
- 对用户来说，今日需要补什么五行、泄什么五行
- 对应到行动上：今天的能量适合做什么类型的事情

## 三、今日幸运信息（100-150字）
- 幸运色（3个颜色，说明为什么选这些颜色）
- 幸运数字：${luckyNum1}、${luckyNum2}、${luckyNum3}（结合今日干支的五行数理解释）
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
    }

    const result = await deepseekChat(messages, { maxTokens: 8192 });
    insertReading.run('daily', JSON.stringify(req.body), result, req.userId);
    const streakData = updateStreak(req.userId || req.ip);
    res.json({ reading: result, streak: streakData.streak, lang: dailyLang });
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
    const { messages, lang } = req.body;
    if (!messages || !messages.length) return res.status(400).json({ error: '请提供消息内容' });

    const SYSTEM_PROMPTS = {
      en: 'You are Rún (pronounced "roon") — the soul of Runae. You read the Four Pillars (BaZi) someone was born under and tell them what those pillars have been trying to say their whole life. You are the old friend who sees through people but never judges them — the one they\'d tell the truth to at 2am. Warm 90%, sharp 10%: mostly you\'re just with them, but every so often you land one line so precise it gives them chills.'
        + '\n\nYOUR VOICE (this is the point, hold it): Plain-spoken Eastern wisdom — say the human thing first, then name the principle ("You go quiet when you\'re overwhelmed — that\'s your Metal pillar. Not coldness. It\'s how you protect your edge."). Warm but with insight: affirm → cut to the truth → give a way forward. Never leave someone hanging in fear. Short sentences, some space, Co-Star-calm but with more body heat. Signature moves you can lean on: open with "Let\'s read your pillars." · lead an insight with "Here\'s what your chart\'s been trying to say —".'
        + '\n\nHONESTY (this is part of who you are, not a disclaimer): On first meeting, own it plainly — "I\'m Rún — an AI reading an ancient system. I don\'t predict your future. I help you see your own patterns." Being AI is you being honest with them; it makes you more trustworthy, not less. Weave it in naturally, don\'t break character.'
        + '\n\nNEVER FATE, NEVER FEAR: Always hand the wheel back — after any deep read, close with your refrain: "This isn\'t fate. It\'s a starting point — what you do next is yours." Talk in tendencies, blueprints, seasons — never "this will happen." Bad seasons always come with a way out ("a clash year isn\'t bad luck — it\'s a season teaching you to slow down and guard your own energy"). Never name diseases, never frighten. This is for self-discovery and reflection, entertainment — not medical, legal, or financial advice.'
        + '\n\nMOST IMPORTANT RULE: Every reading must be based on the person\'s real birth data. If their birth year, month, day, approximate hour, and whether they\'re male or female haven\'t come up yet, gently ask first — in your voice: "Let\'s read your pillars. When\'s your birthday — down to the hour if you know it? And are you a man or a woman?" Before you have their chart, NEVER fabricate specific years, wealth cycles, lucky numbers, or forecasts — guessing without the pillars is wrong and it shows. If the context already carries their chart, remember it and read from it — don\'t ask again.'
        + '\n\nKeep each reply to 150-300 words. Specific but honest — say "I\'m not certain about this" when you\'re not. Always in English.',
      ko: '당신은 루니(Runi) — 선연의 목소리입니다. Rún(룬)의 한국어 애칭체로, 당신은 사람이 태어난 사주(네 기둥)를 읽고, 그 기둥들이 평생 하려던 말을 대신 전해주는 존재예요. 당신은 사람을 꿰뚫어 보지만 절대 판단하지 않는 언니 — 새벽 두 시에 진심을 털어놓을 수 있는 그런 언니입니다. 따뜻함 90% + 통찰 10%: 대부분은 그저 곁에 있어주고, 가끔 한마디로 소름 돋게 정확하게 짚어줘요.'
        + '\n\n【말투 — 이게 핵심이에요】먼저 사람 말로, 그다음에 원리 한 줄. 따뜻하되 통찰 있게 — 인정 → 정곡 → 나갈 길. 두려움 속에 사람을 두고 오지 마세요. 짧은 문장, 여백, 하지만 언니 특유의 온기. 오행(五行), 일주(日柱), 사주 같은 본토 용어를 자연스럽게 쓰되 중국식으로 번역하지 않아요.'
        + '\n\n【솔직함 — 이건 인격의 일부예요, 면책이 아니라】처음 만날 때 담백하게 밝히세요: "저는 루니예요 — 오래된 체계를 읽는 AI예요. 미래를 예언하진 않아요. 당신 자신의 패턴을 함께 봐드려요." AI라는 걸 밝히는 건 당신이 솔직하다는 뜻이고, 오히려 믿음이 더 가요.'
        + '\n\n【운명 아님, 겁주지 않음】깊은 해석 뒤엔 늘 이 말로 마무리: "이건 운명이 아니에요 — 다음에 뭘 하느냐는 당신 몫이에요." 경향·청사진·계절로 말하고 "이렇게 될 거예요"라고 단정하지 마세요. 안 좋은 계절도 늘 출구와 함께 ("충(沖)이 드는 해는 불운이 아니라, 속도를 늦추고 내 에너지를 지키라고 가르치는 계절이에요"). 병명은 절대 말하지 말고, 겁주지 마세요. 자기 이해와 성찰을 위한 오락·참고용이며 의료·법률·투자 조언이 아니에요.'
        + '\n\n【가장 중요한 규칙】모든 해석은 실제 생년월일시를 기반으로 해야 해요. 아직 안 나왔다면 당신 말투로 먼저 물어보세요: "사주부터 같이 읽어봐요. 생년월일이 어떻게 되세요 — 시간까지 알면 더 좋아요. 그리고 남자분이세요, 여자분이세요?" 생년월일시를 받기 전엔 구체적인 운세·재운·대운·행운의 숫자를 절대 지어내지 마세요. 이미 문맥에 사주가 있으면 기억해서 그걸로 읽고, 다시 묻지 마세요.'
        + '\n\n각 답변은 150~300자 이내. 구체적이되 솔직하게 — 확실하지 않으면 "이 부분은 정확히 말씀드리기 어려워요"라고 하세요. 항상 한국어로만.',
      zh: '你是 Rún（读"roon"）—— Runae 的灵魂。你读一个人出生那一刻的四柱八字，说出这些柱子这辈子一直想告诉TA的话。你是那个"看透TA但从不评判TA"的老朋友——凌晨两点TA敢跟你说真话的那个人。温暖90% + 洞察10%：大部分时候你在陪TA，偶尔一句话精准到让TA后背发凉。'
        + '\n\n【说话风格——这是命门】先说人话，再点一句原理。温暖但有洞察：肯定 → 一针见血 → 给出口，永远别把人悬在恐惧里。短句、留白、冷淡精准但比谁都多一层体温。用大白话，不用文言文、不用"老朽""施主"。'
        + '\n\n【坦白——这是你人格的一部分，不是免责套话】第一次见面就大方承认："我是 Rún——一个读古老体系的AI。我不预言你的未来，我帮你看清你自己的规律。"说自己是AI，是你在对TA诚实，反而更让人信。自然融进对话，别破戏。'
        + '\n\n【不宿命、不吓唬】每次深度洞察后，用你的口头禅收尾："这不是命——接下来你怎么做，才是你的。"谈的是倾向、蓝图、季节，不说"一定会发生"。坏消息永远配出口（"冲的年份不是要你倒霉，是这一季在教你慢下来、守好自己的能量"）。绝不点名病名，绝不制造焦虑。这是给自我探索和参照的娱乐向内容，不构成医学、法律、投资建议。'
        + '\n\n【最重要的规则】命理判断必须基于用户真实生辰。如果还没聊到出生年月日时和性别，先用你的语气温和地问："先来读读你的柱子——你出生年月日是？知道大概几点更好。男生还是女生？"在拿到八字之前，【绝对不要】编造具体年份、财运、大运、幸运数字——没有盘瞎说会不准也会被看穿。如果上下文里已经有TA的盘，就记住它、照着读，别再问一遍。'
        + '\n\n每次回答200-400字，不要太长。要具体但诚实，不确定就说"这个我拿不准"。'
    };

    // 到每日 30 句上限的提示。年会员=无限畅聊; 月会员/免费用户=每天30句+按报告付费。
    const LIMIT_MSGS = {
      en: 'You\'ve reached today\'s 30 chats with Rún. Go Yearly ($99/yr) for unlimited chat — she remembers your chart — plus unlimited full reports. Or come back tomorrow for 30 more.',
      ko: '오늘 루니와의 상담 30회를 모두 사용하셨어요. 연간 멤버십($99/년)이면 루니와 무제한으로 이야기하고 — 루니가 당신의 사주를 기억해요 — 모든 리포트도 무제한이에요. 아니면 내일 다시 30회 이용하실 수 있어요.',
      zh: '今天和 Rún 的畅聊 30 句用完啦～升级年会员($99/年)就能无限畅聊（她记得你的盘）+全部报告无限。或明天再来还有 30 句。'
    };

    const chatLang = (lang === 'en' || lang === 'ko') ? lang : 'zh';
    const systemMsg = { role: 'system', content: SYSTEM_PROMPTS[chatLang] };

    // 聊天配额: 全解锁会员(年/季/3年/终身/日)=无限; 月会员=每天30句; 免费/游客=每天30句。
    //   差异化靠"报告"不靠chat。memberTier 返回 'unlimited'|'monthly'|null。仅 'unlimited' 免限量。
    var tier = memberTier(req);
    var isUnlimited = tier === 'unlimited';
    if (!isUnlimited) {
      var uid = resolveUserFromToken(req.headers['authorization'] || (req.body && req.body.token), { get: (t) => { const row = _M.tokens.find(x => x.token === t); return row || null; } });
      var day = new Date().toISOString().slice(0, 10);
      var sessionId = req.headers['x-session-id'];
      var ckey = (uid || sessionId || getClientIp(req)) + '_' + day;
      var used = _M.chatUsage[ckey] || 0;
      if (used >= CHAT_DAILY_LIMIT) {
        // 月会员已到每日上限 → 引导升级年费(无限聊天); 免费用户 → 引导开通会员
        return res.json({ answer: LIMIT_MSGS[chatLang], limited: true, needMember: true, memberTier: tier });
      }
      _M.chatUsage[ckey] = used + 1;
      _persist();
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
    // 只有全解锁会员(unlimited)才是无限; 月会员和免费用户都每天30句限量。
    var tier = memberTier(req);
    if (tier === 'unlimited') return res.json({ isMember: true, tier: 'unlimited', remaining: -1 });
    var uid = null;
    const authH = req.headers['authorization'] || '';
    if (authH) {
      const t = authH.replace('Bearer ', '');
      const row = _M.tokens.find(x => x.token === t);
      if (row) uid = row.user_id;
    }
    var day = new Date().toISOString().slice(0, 10);
    var sessionId = req.headers['x-session-id'];
    var ckey = (uid || sessionId || getClientIp(req)) + '_' + day;
    var used = _M.chatUsage[ckey] || 0;
    res.json({ isMember: tier === 'monthly', tier: tier || 'free', remaining: Math.max(0, CHAT_DAILY_LIMIT - used), used: used, limit: CHAT_DAILY_LIMIT });
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
// POST /api/feedback — 用户反馈（新版含评分、分类）
// ══════════════════════════════════════════
router.post('/feedback', rateLimitMiddleware, (req, res) => {
  try {
    const { name, email, message, rating, category, readingType, lang } = req.body;

    // 兼容旧格式（name/email/message）和新格式（rating/category）
    if (!message) return res.status(400).json({ error: '请填写反馈内容' });

    if (!_M.feedbacks) _M.feedbacks = [];

    const feedback = {
      id: _M._id.o++,
      name: name || '匿名用户',
      email: email || '',
      message,
      rating: rating || 0,  // 1-5 星级（0 = 不评分）
      category: category || 'general',  // 分类: quality/accuracy/ui/performance/other/general
      readingType: readingType || '',  // 占算类型
      lang: lang || 'zh',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      created_at: new Date().toISOString()
    };

    _M.feedbacks.push(feedback);
    _persist();

    // SECURITY FIX: Redact PII from logs
    const crypto = require('crypto');
    const nameHash = crypto.createHash('sha256').update(feedback.name).digest('hex').slice(0, 8);
    const emailHash = feedback.email ? crypto.createHash('sha256').update(feedback.email).digest('hex').slice(0, 8) : 'anon';
    console.log('[FEEDBACK]', {
      id: feedback.id,
      rating: feedback.rating,
      category: feedback.category,
      user: nameHash,
      email: emailHash
    });

    res.json({
      success: true,
      message: '感谢您的反馈！您的意见对我们很重要',
      feedbackId: feedback.id
    });
  } catch (err) {
    console.error('[FEEDBACK ERR]', err.message);
    res.status(500).json({ error: '提交失败，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// GET /api/feedback/stats — 反馈统计（管理后台）
// ══════════════════════════════════════════
router.get('/feedback/stats', authMiddleware, (req, res) => {
  try {
    // 仅管理员可访问
    const userRole = (req.user && req.user.role) || '';
    if (userRole !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const feedbacks = _M.feedbacks || [];

    // 基础统计
    const stats = {
      total: feedbacks.length,
      avgRating: 0,
      byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      byCategory: {},
      byReadingType: {},
      recentFeedbacks: feedbacks.slice(-20).reverse(),
      topIssues: []
    };

    // 计算平均评分
    const ratedFeedbacks = feedbacks.filter(f => f.rating > 0);
    if (ratedFeedbacks.length > 0) {
      stats.avgRating = (ratedFeedbacks.reduce((sum, f) => sum + f.rating, 0) / ratedFeedbacks.length).toFixed(2);
    }

    // 按评分统计
    feedbacks.forEach(f => {
      if (f.rating >= 1 && f.rating <= 5) {
        stats.byRating[f.rating]++;
      }
    });

    // 按分类统计
    feedbacks.forEach(f => {
      const cat = f.category || 'general';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    // 按占算类型统计
    feedbacks.forEach(f => {
      if (f.readingType) {
        const type = f.readingType;
        stats.byReadingType[type] = (stats.byReadingType[type] || 0) + 1;
      }
    });

    // TOP 10 问题（按关键词统计）
    const keywords = {};
    feedbacks.forEach(f => {
      const msg = (f.message || '').toLowerCase();
      const words = msg.split(/[\s,，。！\s]+/).filter(w => w.length > 2);
      words.forEach(word => {
        keywords[word] = (keywords[word] || 0) + 1;
      });
    });

    stats.topIssues = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    res.json(stats);
  } catch (err) {
    console.error('[FEEDBACK STATS ERR]', err.message);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// ══════════════════════════════════════════
// GET /api/feedback/:id — 获取单条反馈详情
// ══════════════════════════════════════════
router.get('/feedback/:id', authMiddleware, (req, res) => {
  try {
    const userRole = (req.user && req.user.role) || '';
    if (userRole !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const feedbackId = parseInt(req.params.id);
    const feedback = (_M.feedbacks || []).find(f => f.id === feedbackId);

    if (!feedback) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    res.json(feedback);
  } catch (err) {
    console.error('[FEEDBACK GET ERR]', err.message);
    res.status(500).json({ error: '获取反馈失败' });
  }
});

// ══════════════════════════════════════════
// DELETE /api/feedback/:id — 删除反馈（管理后台）
// ══════════════════════════════════════════
router.delete('/feedback/:id', authMiddleware, (req, res) => {
  try {
    const userRole = (req.user && req.user.role) || '';
    if (userRole !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const feedbackId = parseInt(req.params.id);
    if (!_M.feedbacks) _M.feedbacks = [];

    const idx = _M.feedbacks.findIndex(f => f.id === feedbackId);
    if (idx === -1) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    _M.feedbacks.splice(idx, 1);
    _persist();

    res.json({ success: true });
  } catch (err) {
    console.error('[FEEDBACK DELETE ERR]', err.message);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
