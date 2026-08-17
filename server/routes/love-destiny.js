'use strict';
/**
 * routes/love-destiny.js — Runae · Love Destiny / 姻缘(月老)
 * 单人 love reading：分析【夫妻宫(日支) / 桃花 / 正缘特征 / 感情模式 / 遇缘窗口】。
 * 区别于合婚(两人)——这是问"我自己"的爱情命运。
 *
 * POST /api/love-destiny
 *   body: { birthYear, birthMonth, birthDay, birthHour, gender, lang }
 *
 * ⚠️ 排盘用真引擎 computeBaziChart，禁止 LLM 猜盘。
 * ⚠️ 未 mount —— 由 server/index.js 统一挂载（本文件不改 index.js）。
 *    建议：app.use('/api', require('./routes/love-destiny'));
 *
 * 红线：零编造 · Eastern(非Chinese标签) · 娱乐参考免责 · 反宿命 · 禁"你X年一定结婚"承诺。
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { insertReading, memberTier, hasFullAccess } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// ══════════════════════════════════════════════════════════════
// 命理逻辑（规则化，喂给 LLM 只做解读，不做排盘）
// ══════════════════════════════════════════════════════════════

// 咸池桃花：以日支/年支查桃花地支（子午卯酉四正）
//   寅午戌→卯 · 申子辰→酉 · 巳酉丑→午 · 亥卯未→子
const PEACH_MAP = {
  '寅': '卯', '午': '卯', '戌': '卯',
  '申': '酉', '子': '酉', '辰': '酉',
  '巳': '午', '酉': '午', '丑': '午',
  '亥': '子', '卯': '子', '未': '子',
};

// 正缘星（配偶星）：女命看官杀(正官/七杀)，男命看财(正财/偏财)。
function spouseStarGroups(gender) {
  return gender === 'female'
    ? { label: 'Officer stars (正官/七杀)', keys: ['正官', '七杀'], zh: '官杀（正官/七杀）' }
    : { label: 'Wealth stars (正财/偏财)', keys: ['正财', '偏财'], zh: '财星（正财/偏财）' };
}

/**
 * 从真引擎命盘里抽出 love 维度事实块（中英双份，喂给 LLM）。
 * 任何异常向上抛，由路由降级/报错处理。
 */
function buildLoveFacts({ birthYear, birthMonth, birthDay, birthHour, gender }) {
  const g = gender === 'male' ? 'male' : 'female';
  const { bazi: b } = computeBaziChart({
    year: Number(birthYear),
    month: Number(birthMonth),
    day: Number(birthDay),
    hour: Number(birthHour) || 0,
    gender: g,
    includeZiwei: false,
  });

  const sz = b.siZhu, ss = b.shiShen, e = b.enrichment;
  const dayZhi = sz.day.zhi;                 // 夫妻宫 = 日支
  const yearZhi = sz.year.zhi;
  const dayHiddenStems = (b.cangGan.day || []).map(x => `${x.gan}(${x.shiShen})`).join('、'); // 夫妻宫藏干十神

  // 桃花地支（日支主查，年支辅查）
  const peachFromDay = PEACH_MAP[dayZhi] || null;
  const peachFromYear = PEACH_MAP[yearZhi] || null;
  const peachSet = Array.from(new Set([peachFromDay, peachFromYear].filter(Boolean)));

  // 正缘星（配偶星）统计
  const star = spouseStarGroups(g);
  const groups = (e['五行统计'] && e['五行统计'].shiShenGroups) || {};
  // 各柱十神里配偶星出现情况
  const pillarStars = [];
  ['year', 'month', 'hour'].forEach(p => { if (star.keys.includes(ss[p])) pillarStars.push(`${p === 'year' ? '年' : p === 'month' ? '月' : '时'}柱${ss[p]}`); });
  // 藏干里的配偶星
  ['year', 'month', 'day', 'hour'].forEach(p => {
    (b.cangGan[p] || []).forEach(cg => { if (star.keys.includes(cg.shiShen)) pillarStars.push(`${p === 'year' ? '年' : p === 'month' ? '月' : p === 'day' ? '日(夫妻宫)' : '时'}支藏${cg.gan}${cg.shiShen}`); });
  });
  const spouseStarPresence = pillarStars.length ? pillarStars.join('、') : `本命四柱未透${star.zh}（配偶星藏而不显）`;

  // 日支(夫妻宫)刑冲合害——感情模式的关键信号
  const dizhiRel = (e['地支关系'] || []).filter(r => Array.isArray(r.pillars) && r.pillars.includes('日'));
  const spousePalaceRel = dizhiRel.length
    ? dizhiRel.map(r => `${r.type}(${(r.zhi || []).join('')}${r.detail ? '·' + r.detail : ''})`).join('；')
    : '夫妻宫平和，无明显刑冲合害';

  // 大运里配偶星/桃花现的年份窗口（倾向，非承诺）
  const nowYear = new Date().getFullYear();
  const windows = [];
  (b.dayun || []).forEach(d => {
    if (d.startYear === undefined) return;
    if (d.endYear !== undefined && d.endYear < nowYear - 1) return; // 只看当下及未来大运
    const hitStar = star.keys.includes(d.zhiShiShen) || star.keys.includes(d.ganShiShen);
    const hitPeach = peachSet.includes(d.ganZhi && d.ganZhi.zhi);
    // 日支与大运支合（六合/三合半合）——缘分启动的传统信号，交给 LLM 谨慎解读
    if (hitStar || hitPeach) {
      const why = [];
      if (hitStar) why.push(`大运走${star.zh}`);
      if (hitPeach) why.push('大运带桃花');
      windows.push(`${d.startYear}起(${d.ganZhi.gan}${d.ganZhi.zhi}·${d.startAge}岁·${why.join('/')})`);
    }
  });
  const encounterWindows = windows.length ? windows.join('　') : '未来大运无明显官杀/桃花集中期——缘分更看主动创造与调整';

  const wx = e['五行统计'].withCangGan;

  const zh = `【精确排盘 love 维度事实（专业万年历引擎排定·严格使用·禁止自行推算或修改）】
性别：${g === 'female' ? '女命' : '男命'}
四柱：年${sz.year.gan}${sz.year.zhi} 月${sz.month.gan}${sz.month.zhi} 日${sz.day.gan}${sz.day.zhi} 时${sz.hour.gan}${sz.hour.zhi}
日主：${b.dayMaster}　旺衰：${e['旺衰'].verdict}　格局：${e['格局'].primary}
【夫妻宫】日支＝${dayZhi}（藏干十神：${dayHiddenStems}）
【夫妻宫状态】${spousePalaceRel}
【正缘星（配偶星）】${g === 'female' ? '女命看官杀' : '男命看财'}：${spouseStarPresence}
【桃花】咸池桃花地支：${peachSet.length ? peachSet.join('、') : '无标准桃花'}（日支${dayZhi}起${peachFromDay || '—'}；年支${yearZhi}起${peachFromYear || '—'}）
【五行力量】木${wx['木']} 火${wx['火']} 土${wx['土']} 金${wx['金']} 水${wx['水']}　缺:${e['五行统计'].missing.join('') || '无'}
【调候用神】${e['调候用神'].join('、')}
【遇缘倾向窗口（大运层·仅倾向非承诺）】${encounterWindows}
当前年份：${nowYear}年`;

  return { zh, dayZhi, peachSet, gender: g };
}

// ══════════════════════════════════════════════════════════════
// 语言化 system / user prompt —— Rún 口吻，反宿命，Eastern 不标 Chinese
// ══════════════════════════════════════════════════════════════

const AI_DISCLAIMER = {
  en: 'You are Rún — an AI reading an ancient Eastern system (the Four Pillars). You do not predict the future or promise events. You help people see their own love patterns.',
  zh: '你是 Rún —— 一个读古老东方体系（四柱）的AI。你不预言未来、不承诺任何事件，你帮人看清自己的感情规律。',
  ko: '당신은 루니 — 오래된 동양 체계(사주)를 읽는 AI예요. 미래를 예언하거나 사건을 약속하지 않고, 사랑의 패턴을 함께 봐드려요.',
};

function buildMessages(lang, facts, free) {
  const scopeEn = free
    ? 'FREE PREVIEW: reveal only the FIRST section (## Your Soulmate Portrait) in full, then write one teaser line for the other sections and stop. Do NOT write the peach-blossom, patterns, or encounter-window sections in full.'
    : 'FULL READING: write every section in full.';
  const scopeZh = free
    ? '免费预览：只完整写出【第一节·你的正缘画像】，其余各节各留一句钩子后停止，不要完整展开桃花/感情模式/遇缘窗口。'
    : '完整解读：每一节都完整展开。';
  const scopeKo = free
    ? '무료 미리보기: 【첫 번째 섹션·당신의 인연 초상】만 완전히 쓰고, 나머지 섹션은 한 줄씩 티저만 남기고 멈추세요.'
    : '전체 해석: 모든 섹션을 완전히 작성하세요.';

  if (lang === 'zh') {
    return buildReadingPrompt(
      `${AI_DISCLAIMER.zh}
你是 Rún，Runae 的灵魂。你读一个人的四柱，说出TA感情里"一直在重复的那句话"。温暖90%、洞察10%，先说人话再点原理。大白话，不用文言。
【铁律·反宿命】谈的是倾向、蓝图、季节，绝不说"你X年一定结婚/一定遇到正缘"。任何窗口都说成"更容易遇见/更适合主动"的季节，把方向盘交回给TA："这不是命——你怎么做，才是你的。"
【铁律·排盘】下面的排盘事实是专业引擎算好的，严格照用，禁止自行改动或新排四柱/桃花/大运。
【铁律·东方不贴中国标签】用"东方古老体系/四柱/五行"这类中性表达。
【免责】这是自我探索的娱乐参考向内容，不构成婚恋、医疗、法律、投资建议。绝不点名疾病、绝不制造焦虑。`,
      `${facts.zh}

请以温暖、具体、可截图分享的口吻，用Markdown(##标题)写一份 love destiny 单人解读。${scopeZh}

## 一、你的正缘画像
基于夫妻宫(日支)与配偶星，描绘对方大概是什么样的人（气质/相处感/被你吸引的点），以及你在关系里最需要的是什么。落到"感觉"，别报八字术语堆砌。

## 二、你的桃花运
桃花地支说明你的魅力信号从哪来、在什么场合/什么状态下最有魅力。给一条"放大桃花"的具体生活建议。

## 三、你的感情模式
结合夫妻宫刑冲合害与旺衰，诚实讲你在关系里反复出现的模式（例如：习惯性退让/太快投入/用忙碌保护自己），肯定它的来处，再给一个更自由的走法。这是你的模式，不是被钉死的命。

## 四、遇缘的季节
把遇缘窗口讲成"更容易遇见、更适合主动打开自己"的季节倾向（严禁"一定"字样）。每段都提醒：能不能成，看你那时怎么选。

## 五、月老悄悄话
一句温暖有力、直击心灵、适合截图发朋友圈的收尾。最后固定加一行："这不是命——接下来你怎么做，才是你的。"`
    );
  }

  if (lang === 'ko') {
    return buildReadingPrompt(
      `${AI_DISCLAIMER.ko}
당신은 루니, 선연의 목소리예요. 사주를 읽고 그 사람 연애에서 "계속 반복되는 한마디"를 대신 전해줘요. 따뜻함 90% + 통찰 10%.
【철칙·운명 아님】경향·청사진·계절로 말하고 "당신은 X년에 반드시 결혼/인연을 만난다"고 절대 말하지 마세요. 어떤 시기도 "더 만나기 쉬운/능동적으로 열기 좋은" 계절로 표현하고 마무리는 "이건 운명이 아니에요 — 다음에 뭘 하느냐는 당신 몫이에요."
【철칙·배반】아래 배반 데이터는 전문 엔진이 계산한 것이니 그대로 쓰고, 사주/도화/대운을 임의로 바꾸지 마세요.
【철칙】중국식으로 번역하지 말고 "동양의 오래된 체계/사주/오행"으로 자연스럽게.
【면책】자기 이해를 위한 오락·참고용이며 결혼·의료·법률·투자 조언이 아니에요.`,
      `${facts.zh}

따뜻하고 구체적이며 캡처해서 공유하고 싶은 톤으로, 마크다운(## 제목)으로 1인 러브 리딩을 써주세요. ${scopeKo}

## 1. 당신의 인연 초상
## 2. 당신의 도화운
## 3. 당신의 사랑 패턴
## 4. 인연이 무르익는 계절
## 5. 월하노인의 귓속말
마지막 줄 고정: "이건 운명이 아니에요 — 다음에 뭘 하느냐는 당신 몫이에요."`
    );
  }

  // default English
  return buildReadingPrompt(
    `${AI_DISCLAIMER.en}
You are Rún, the soul of Runae. You read someone's Four Pillars and name the one thing their love life keeps trying to say. Warm 90%, sharp 10% — say the human thing first, then the principle. Plain-spoken Eastern wisdom, no jargon dumps.
RULE — NEVER FATE, NEVER FEAR: Speak in tendencies, blueprints, seasons. NEVER say "you will marry in year X" or "you will meet your soulmate in X." Frame every window as a season when it's "easier to meet / a better time to open yourself" — then hand the wheel back: "This isn't fate — what you do next is yours." Bad patterns always come with a way forward.
RULE — DON'T CAST THE CHART: The chart facts below are computed by a professional engine. Use them exactly. Never recompute or alter pillars, peach blossom, or luck cycles.
RULE — EASTERN, NOT LABELED: Say "an ancient Eastern system / Four Pillars / Five Elements."
DISCLAIMER: This is for self-discovery and reflection, entertainment and reference only — not relationship, medical, legal, or financial advice. Never name diseases, never frighten.`,
    `${facts.zh}

Write a single-person Love Destiny reading in a warm, specific, screenshot-shareable voice, using Markdown (## headers). ${scopeEn}

## Your Soulmate Portrait
From the Spouse Palace (day branch) and partner star, paint who the person you're drawn to tends to be (their feel, how they hold you, what pulls you in) and what you most need in a relationship. Land it on feeling, not jargon.

## Your Peach Blossom (Attraction)
What your charm signal is and where/when it shines brightest. One concrete way to turn it up in real life.

## Your Love Patterns
Honestly name the pattern that keeps repeating for you in relationships (e.g. giving in too fast, falling in too quick, hiding inside busyness). Affirm where it comes from, then offer a freer way. This is your pattern — not a fixed fate.

## Your Seasons to Meet
Frame the encounter windows as seasons when it's easier to meet or a better time to open yourself — NEVER "you will." Each one reminds them: whether it becomes something is how they choose then.

## The Matchmaker's Whisper
One warm, chills-down-the-spine closing line, made to screenshot. End with this exact line: "This isn't fate — what you do next is yours."`
  );
}

// ══════════════════════════════════════════════════════════════
// POST /api/love-destiny
// ══════════════════════════════════════════════════════════════
router.post('/love-destiny', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, lang } = req.body || {};
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: (lang === 'en' ? 'Please provide your birth date.' : lang === 'ko' ? '생년월일을 입력해주세요.' : '请提供出生年月日。') });
    }

    // 付费门：全解锁会员 / 月会员 → 完整；免费/游客 → 只出正缘画像一角
    const full = memberTier(req) !== null || hasFullAccess(req, ['love_destiny', 'bazi_full', 'bazi_vip']);

    let facts;
    try {
      facts = buildLoveFacts({ birthYear, birthMonth, birthDay, birthHour, gender });
    } catch (e) {
      console.error('[LOVE-DESTINY engine ERR]', e.message);
      return res.status(400).json({ error: (lang === 'en' ? 'Could not cast the chart from those details — please check the date.' : lang === 'ko' ? '입력된 정보로 배반할 수 없어요 — 날짜를 확인해주세요.' : '这个生辰排不出盘，请检查日期。') });
    }

    const readingLang = (lang === 'en' || lang === 'ko') ? lang : 'zh';
    const messages = buildMessages(readingLang, facts, !full);
    const result = await deepseekChat(messages, { maxTokens: full ? 4096 : 1400 });

    insertReading.run('love_destiny', JSON.stringify({ birthYear, birthMonth, birthDay, birthHour, gender, lang: readingLang }), result, req.userId);

    res.json({ reading: result, full, locked: !full, lang: readingLang });
  } catch (err) {
    console.error('[LOVE-DESTINY ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'love-destiny' } });
    res.status(500).json({ error: (req.body && req.body.lang === 'en') ? 'Rún is resting — please try again.' : '月老暂时不可用，请稍后再试。', detail: err.message });
  }
});

module.exports = router;
