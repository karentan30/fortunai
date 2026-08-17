'use strict';
/**
 * routes/chart-archetype.js — Runae · Your Chart Archetype / 命格原型 + 稀有度
 *
 *   POST /api/chart-archetype
 *     body: { birthYear, birthMonth, birthDay, birthHour, gender, lang }
 *
 * 病毒钩子 (status 型, 像 MBTI 稀有度):
 *   "What's your chart archetype — and how rare is it?"
 *   用户输生辰 → 出一个可截图分享的 "I'm The Strategist" 大卡 (名字 + 一句特质 + 诚实稀有度)。
 *
 * ⚠️ 排盘用真引擎 computeBaziChart —— 禁止 LLM 猜盘。
 *   【格局 / 十神 / 旺衰】全部由引擎算定 (judgeGeJu 带 confidence)。
 *   archetype 由【规则表】把真实格局 → 映射到中性人格原型 (下方 GEJU_ARCHETYPE)。
 *   稀有度是【定性框架】(common / uncommon / rare)，基于真实格局的相对分布 —
 *     绝不编造精确统计 (不写 "每万人 8 个 / 0.74%" 这种假数字)。
 *   LLM 只负责【用真实格局事实写 archetype 描述】，不重排盘、不发明统计、不承诺成功。
 *
 * 红线:
 *   - 零编造精确统计 (稀有度只定性: uncommon / rare)
 *   - 禁过度奉承 (archetype = 中性人格描述，不是 "天生赢家 / 注定成功")
 *   - 反宿命 · 娱乐/自我探索参考免责 · AI 标识 · Eastern (零 Chinese 标签)
 *
 * ⚠️ 本路由建了【未 mount】—— 由 Karen 统一在 server/index.js 挂:
 *      app.use('/api', require('./routes/chart-archetype'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { insertReading } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// ══════════════════════════════════════════════════════════════════
// 格局 → archetype 映射表  (真实格局 primary → 中性人格原型)
//
//   每个 archetype 是一个【中性的人格描述】，不是命定成功保证。
//   name / tagline 面向英文用户 (Eastern 语汇，不贴 Chinese)。
//   基础格局共 10 种 (八格 + 比肩/劫财)，一一映射。
// ══════════════════════════════════════════════════════════════════
const GEJU_ARCHETYPE = {
  正官格: {
    key: 'the-architect',
    name: 'The Architect',
    tagline: 'You build order out of chaos — people trust the structures you make.',
    element: 'Structure · principle · quiet authority',
    trait: 'Governed by an inner sense of what is right and how things should be done, you bring stability wherever you go.',
  },
  七杀格: {
    key: 'the-catalyst',
    name: 'The Catalyst',
    tagline: 'You move first, cut through, and force the moment to change.',
    element: 'Drive · edge · decisive pressure',
    trait: 'You carry a restless, high-pressure energy that thrives under stakes — the person who breaks a stalemate.',
  },
  正财格: {
    key: 'the-steward',
    name: 'The Steward',
    tagline: 'You turn steady effort into lasting, tangible value.',
    element: 'Diligence · realism · patient building',
    trait: 'Grounded and practical, you build value the reliable way — one solid brick at a time.',
  },
  偏财格: {
    key: 'the-alchemist',
    name: 'The Alchemist',
    tagline: 'You spot the opening others miss and turn motion into worth.',
    element: 'Opportunity · flow · generous ambition',
    trait: 'Quick to read a room and a market, you make things move and money flow — expansive, social, a little bold.',
  },
  正印格: {
    key: 'the-sage',
    name: 'The Sage',
    tagline: 'You absorb, reflect, and give people something to lean on.',
    element: 'Wisdom · nurture · inner steadiness',
    trait: 'Reflective and supportive, you learn deeply and hold space for others — the calm center in a storm.',
  },
  偏印格: {
    key: 'the-seer',
    name: 'The Seer',
    tagline: 'You see the pattern before anyone else names it.',
    element: 'Intuition · depth · unconventional insight',
    trait: 'Drawn to what is hidden or unusual, you think sideways and notice what the room overlooked.',
  },
  食神格: {
    key: 'the-artisan',
    name: 'The Artisan',
    tagline: 'You create for the joy of it — and people feel it.',
    element: 'Expression · ease · warm craft',
    trait: 'A natural maker and enjoyer of life, you turn feeling into something others can taste, hear, or hold.',
  },
  伤官格: {
    key: 'the-maverick',
    name: 'The Maverick',
    tagline: 'You break the mold on purpose — brilliance with an edge.',
    element: 'Talent · rebellion · vivid self-expression',
    trait: 'Sharp, expressive, and allergic to being boxed in, you shine brightest when you refuse to do it the usual way.',
  },
  比肩格: {
    key: 'the-vanguard',
    name: 'The Vanguard',
    tagline: 'You stand on your own two feet and pull your people with you.',
    element: 'Independence · loyalty · self-reliance',
    trait: 'Self-directed and steady, you lead by doing — fiercely your own person, fiercely for your circle.',
  },
  劫财格: {
    key: 'the-contender',
    name: 'The Contender',
    tagline: 'You rise when there is something — or someone — to rise against.',
    element: 'Competition · courage · bold allies',
    trait: 'Bold and competitive, you find your gear when the stakes are real and the field is crowded.',
  },
};

// 默认兜底 (理论上引擎总会给出上表内的格局，但保险起见)
const FALLBACK_ARCHETYPE = {
  key: 'the-wayfarer',
  name: 'The Wayfarer',
  tagline: 'Your chart doesn\'t fit one mold — you write your own.',
  element: 'Blend · adaptability · self-authored path',
  trait: 'Your pattern blends more than one force, so you shape-shift to fit the moment.',
};

// ══════════════════════════════════════════════════════════════════
// 诚实的稀有度框架 (定性，非编造统计)
//
//   八种基础格局在真实人群里分布并不均匀:
//     - 正官/正财/正印/食神 = 相对常见的 "正" 格 (社会里更普遍)
//     - 七杀/伤官/偏财/偏印/劫财 = 相对少见的 "偏/杀" 格
//   我们只给【定性档位】(common / uncommon / rare)，
//   叠加两个真实信号让每张卡略有差异:
//     1) confidence = 高 (格局清晰立得住) → 卡片更 "纯粹"
//     2) 从强/从弱等极端旺衰 → 更少见
//   ❌ 绝不输出精确百分比或 "每 N 人 X 个" —— 那类数字多半是编的。
// ══════════════════════════════════════════════════════════════════
const COMMON_GE = new Set(['正官格', '正财格', '正印格', '食神格', '比肩格']);
const UNCOMMON_GE = new Set(['七杀格', '伤官格', '偏财格', '偏印格', '劫财格']);

const RARITY = {
  common: {
    band: 'common',
    label: 'A common pattern',
    // 中性、诚实：常见不等于平凡
    honest: 'This is one of the more common chart patterns — you share this core wiring with a lot of people. Common doesn\'t mean ordinary; it means you\'re built on something the world runs on.',
    tier: 1,
  },
  uncommon: {
    band: 'uncommon',
    label: 'A less common pattern',
    honest: 'This pattern shows up less often than the everyday ones — it tends to run in people who feel a little different from the room. Relatively uncommon, in the honest sense: not a ranking, just rarer.',
    tier: 2,
  },
  rare: {
    band: 'rare',
    label: 'A rare pattern',
    honest: 'This is one of the rarer chart patterns — the specific mix here doesn\'t come together often. “Rare” here is a description of the pattern, not a verdict on you: rarer wiring, not better or worse.',
    tier: 3,
  },
};

function judgeRarity(gejuPrimary, gejuConfidence, wangshuaiVerdict) {
  let band = COMMON_GE.has(gejuPrimary) ? 'common'
    : UNCOMMON_GE.has(gejuPrimary) ? 'uncommon'
    : 'uncommon'; // 未知格局按 uncommon 处理

  // 极端旺衰 (从强/从弱) 本身少见 → 拔高一档
  const extreme = /从强|从弱|极旺|极弱/.test(wangshuaiVerdict || '');
  if (extreme) {
    if (band === 'common') band = 'uncommon';
    else if (band === 'uncommon') band = 'rare';
  }

  const r = RARITY[band];
  // confidence 只影响文案措辞的确定性，不编造数字
  const clarity = gejuConfidence === '高' ? 'clear-cut' : gejuConfidence === '中' ? 'fairly clear' : 'nuanced (it sits near a boundary)';
  return { ...r, clarity };
}

// ══════════════════════════════════════════════════════════════════
// 从真引擎命盘抽 archetype 事实块 (喂给 LLM 只做解读)
// ══════════════════════════════════════════════════════════════════
function buildArchetypeFacts({ birthYear, birthMonth, birthDay, birthHour, gender }) {
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
  const geju = e['格局'] || {};
  const gejuPrimary = geju.primary || '';
  const wangshuai = (e['旺衰'] && e['旺衰'].verdict) || '中和';

  const arche = GEJU_ARCHETYPE[gejuPrimary] || FALLBACK_ARCHETYPE;
  const rarity = judgeRarity(gejuPrimary, geju.confidence, wangshuai);

  // 十神分布 (哪几种能量最突出) — 让 LLM 的描述有据可依
  const ssCounts = {};
  ['year', 'month', 'day', 'hour'].forEach(p => {
    if (ss[p]) ssCounts[ss[p]] = (ssCounts[ssCounts[p]] || 0) + 1; // 主气十神
  });
  const stemShiShen = ['year', 'month', 'hour'].map(p => ss[p]).filter(Boolean); // 日干本身不算
  const strongestEl = (e['五行统计'] && e['五行统计'].strongest) || [];

  const zh = `【精确排盘 archetype 事实 (专业万年历引擎排定·严格照用·禁止自行推算或改动)】
性别：${g === 'female' ? '女命' : '男命'}
四柱：年${sz.year.gan}${sz.year.zhi} 月${sz.month.gan}${sz.month.zhi} 日${sz.day.gan}${sz.day.zhi} 时${sz.hour.gan}${sz.hour.zhi}
日主：${b.dayMaster}
格局(引擎判定)：${gejuPrimary}　依据：${geju.basis || '—'}　置信度：${geju.confidence || '—'}
旺衰：${wangshuai}
天干十神(年月时)：${stemShiShen.join('、') || '无明显透出'}
最强五行：${strongestEl.join('、') || '—'}
—— 映射结果 (规则表，非引擎) ——
Archetype：${arche.name}（${arche.key}）
核心特质关键词：${arche.element}
一句话：${arche.tagline}
稀有度档位(定性·非精确统计)：${rarity.band}（${rarity.label}）· 格局清晰度：${rarity.clarity}`;

  return {
    zh,
    archetype: arche,
    rarity,
    gejuPrimary,
    dayMaster: b.dayMaster,
    fourPillars: `${sz.year.gan}${sz.year.zhi} ${sz.month.gan}${sz.month.zhi} ${sz.day.gan}${sz.day.zhi} ${sz.hour.gan}${sz.hour.zhi}`,
    gender: g,
  };
}

// ══════════════════════════════════════════════════════════════════
// LLM prompt —— Rún 口吻，中性 archetype 描述，反宿命，反奉承，Eastern 不标 Chinese
// ══════════════════════════════════════════════════════════════════
const SYS = {
  en: `You are Rún, the soul of Runae — an AI that reads an ancient Eastern system (the Four Pillars). You are describing someone's "chart archetype": the personality pattern their chart is built around, plus how common or rare that pattern is.
RULE — REAL CHART, DON'T RECOMPUTE: The archetype, rarity band, and chart facts below are already fixed by a rule engine. Use them exactly. Never invent a different archetype, and NEVER invent a statistic (no "1 in 10,000", no "0.7% of people"). If you mention rarity, keep it qualitative — "relatively uncommon", "a rarer pattern" — exactly as given.
RULE — NEUTRAL, NOT FLATTERY: An archetype is a neutral personality description with strengths AND a shadow side. NEVER say someone is a "born winner", "destined to succeed", or "guaranteed" anything. Rarer does not mean better. Name the gift and the cost honestly.
RULE — NEVER FATE: Speak in tendencies and wiring, not destiny. Hand the wheel back.
RULE — EASTERN, NOT LABELED: Say "an ancient Eastern system / Four Pillars / Five Elements". Never the word "Chinese".
DISCLAIMER voice: This is for self-discovery and entertainment/reflection — not medical, legal, financial, or life-decision advice. Never name diseases, never frighten.`,
  zh: `你是 Rún —— Runae 的灵魂，一个读古老东方体系(四柱)的AI。你在描述一个人的"命格原型"：TA的盘围绕哪种人格模式构建，以及这种模式有多常见/多稀有。
【铁律·真盘不重排】下面的 archetype、稀有度档位、排盘事实都是规则引擎定好的，严格照用。绝不换一个 archetype，更绝不编造统计数字(不许出现"每万人8个""0.7%"这类)。提到稀有度只能定性("相对少见""较稀有")，照给定的档位说。
【铁律·中性不奉承】archetype 是中性人格描述，有天赋也有阴影面。绝不说"天生赢家""注定成功""一定会…"。稀有≠更好。诚实说出天赋和它的代价。
【铁律·反宿命】谈倾向和天生的线路，不谈命定。把方向盘交回给TA。
【铁律·东方不贴中国标签】用"东方古老体系/四柱/五行"。绝不出现"中国/Chinese"。
【免责口吻】自我探索、娱乐参考向，不构成医疗/法律/投资/人生决策建议。绝不点名疾病、绝不制造焦虑。`,
  ko: `당신은 루니 — 오래된 동양 체계(사주)를 읽는 AI예요. 사람의 "명식 원형(chart archetype)"을 설명해요: 그 사람의 사주가 어떤 성격 패턴을 중심으로 짜였는지, 그 패턴이 얼마나 흔한지 드문지.
【철칙·진짜 사주, 재계산 금지】아래 원형·희소성 등급·사주 데이터는 규칙 엔진이 이미 확정했어요. 그대로 쓰고, 통계를 절대 지어내지 마세요("만 명 중 8명", "0.7%" 금지). 희소성은 정성적으로만("비교적 드문", "더 희귀한 패턴") 표현하세요.
【철칙·중립·아첨 금지】원형은 강점과 그림자를 함께 가진 중립적 성격 묘사예요. "타고난 승자", "성공이 정해진" 같은 말 금지. 드물다고 더 좋은 게 아니에요.
【철칙·운명 아님】타고난 성향으로 말하고, 방향키는 그 사람에게 돌려주세요.
【철칙】"중국"이라는 단어 없이 "동양의 오래된 체계/사주/오행"으로.
【면책】자기 이해·오락·참고용이며 의료·법률·투자·인생 결정 조언이 아니에요.`,
};

function buildMessages(lang, facts) {
  const a = facts.archetype;
  if (lang === 'zh') {
    return buildReadingPrompt(SYS.zh,
      `${facts.zh}

请用温暖、具体、可截图分享的口吻，用 Markdown(##标题)写这个人的【命格原型】卡片文案。别堆八字术语，落到"你是什么样的人"。

## 你是「${a.name}」
用 2-3 句把这个原型讲活：TA最核心的天赋是什么，别人在TA身上最先感受到什么。基于上面的真实格局和十神，别泛泛。

## 你的稀有度
诚实说这个模式有多常见/多稀有(照给定的档位，只定性，绝不编数字)。稀有≠更好——把这一点说清楚。

## 天赋与阴影
一句天赋，一句代价(这个原型用力过猛时会怎样)。中性、诚实、不奉承。

## 悄悄话
一句适合截图发朋友圈的收尾。最后固定加一行："这是你的天生线路，不是你的命——你怎么用它，才是你的。"`);
  }
  if (lang === 'ko') {
    return buildReadingPrompt(SYS.ko,
      `${facts.zh}

따뜻하고 구체적이며 캡처해서 공유하고 싶은 톤으로, 마크다운(## 제목)으로 이 사람의 【명식 원형】 카드 문구를 써주세요.

## 당신은 「${a.name}」
## 당신의 희소성
## 재능과 그림자
## 귓속말
마지막 줄 고정: "이건 타고난 배선이지 운명이 아니에요 — 그걸 어떻게 쓰느냐가 당신 몫이에요."`);
  }
  // default English
  return buildReadingPrompt(SYS.en,
    `${facts.zh}

Write this person's Chart Archetype card in a warm, specific, screenshot-shareable voice, using Markdown (## headers). No jargon dumps — land it on "who you are."

## You are ${a.name}
Bring the archetype alive in 2-3 sentences: their core gift, and what people feel from them first. Ground it in the real chart pattern and stars above — never generic.

## How rare this is
Honestly say how common or rare this pattern is (use the given band — qualitative only, NEVER a made-up statistic). Make clear rarer doesn't mean better.

## The gift and the shadow
One line on the gift, one honest line on the cost (how this archetype overdoes it under pressure). Neutral, no flattery.

## The whisper
One screenshot-worthy closing line. End with this exact line: "This is your wiring, not your fate — how you use it is yours."`);
}

// ══════════════════════════════════════════════════════════════════
// POST /api/chart-archetype
// ══════════════════════════════════════════════════════════════════
router.post('/chart-archetype', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, lang } = req.body || {};
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: (lang === 'ko' ? '생년월일을 입력해주세요.' : lang === 'zh' ? '请提供出生年月日。' : 'Please provide your birth date.') });
    }

    let facts;
    try {
      facts = buildArchetypeFacts({ birthYear, birthMonth, birthDay, birthHour, gender });
    } catch (e) {
      console.error('[CHART-ARCHETYPE engine ERR]', e.message);
      return res.status(400).json({ error: (lang === 'ko' ? '입력된 정보로 배반할 수 없어요 — 날짜를 확인해주세요.' : lang === 'zh' ? '这个生辰排不出盘，请检查日期。' : 'Could not read a chart from those details — please check the date.') });
    }

    const readingLang = (lang === 'zh' || lang === 'ko') ? lang : 'en';
    const messages = buildMessages(readingLang, facts);
    const reading = await deepseekChat(messages, { maxTokens: 1500 });

    try { insertReading.run('chart-archetype', JSON.stringify({ birthYear, birthMonth, birthDay, birthHour, gender, lang: readingLang, archetype: facts.archetype.key, rarity: facts.rarity.band }), reading, req.userId); } catch (e) {}

    // 结构化字段单独返回，让前端渲染大卡 (名字/tagline/稀有度) 无需从 markdown 里抠
    res.json({
      reading,
      lang: readingLang,
      archetype: {
        key: facts.archetype.key,
        name: facts.archetype.name,
        tagline: facts.archetype.tagline,
        element: facts.archetype.element,
      },
      rarity: {
        band: facts.rarity.band,      // common | uncommon | rare
        label: facts.rarity.label,
        note: facts.rarity.honest,    // 诚实定性说明，绝无精确统计
        tier: facts.rarity.tier,      // 1|2|3 —— 前端画星级用
      },
      chart: { dayMaster: facts.dayMaster, fourPillars: facts.fourPillars },
    });
  } catch (err) {
    console.error('[CHART-ARCHETYPE ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'chart-archetype' } });
    res.status(500).json({ error: (req.body && req.body.lang === 'zh') ? 'Rún 暂时休息，请稍后再试。' : 'Rún is resting — please try again.', detail: err.message });
  }
});

module.exports = router;
