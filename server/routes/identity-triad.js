'use strict';
/**
 * routes/identity-triad.js — Runae · Zodiac × MBTI × BaZi Ten Gods 三合一身份卡
 *
 *   POST /api/identity-triad
 *     body: { birthYear, birthMonth, birthDay, birthHour, gender, mbti, lang }
 *
 * 病毒钩子 (三角身份型 · 引 MBTI/星座人群进八字):
 *   "You already know your zodiac and your MBTI —
 *    but your third layer (your Ten Gods archetype) is the deep one."
 *   用户输生日 + 选 MBTI → 出一张可截图分享的三层身份卡:
 *     ① 西方星座 (人人知) · ② MBTI (人人知) · ③ 八字十神/日主 archetype (大多数人第一次见)
 *   → 三角验证解读 (三家在哪一致⭐/哪互补) → 诚实稀有度 → CTA 看完整八字报告。
 *
 * ⚠️ 十神/日主用真引擎 computeBaziChart —— 禁止 LLM 猜盘。
 *   - 日主 (dayMaster) + 主导十神 (透出天干十神) 全部由引擎算定。
 *   - 星座 (sun sign) 由【日期规则表】算 (纯确定性，不喂 LLM)。
 *   - MBTI 由用户自己选 (来自外部框架，我们只当输入)。
 *   - archetype 由【规则表】把真实【日主五行】映射到中性人格原型 (下方 DM_ARCHETYPE)。
 *   - 稀有度是【定性框架】(uncommon / rare)：三个独立框架同时命中某个组合本就少见，
 *       只定性说 "this exact combination is uncommon / rare"，绝不编精确 %。
 *   - LLM 只负责【用真实十神/日主 + 已知星座/MBTI 事实做三角合成】，不重排盘、不发明统计。
 *
 * 红线:
 *   - 零编造 · 十神用真引擎 · 稀有度诚实不编 %
 *   - 零 Chinese 标签 (Eastern) · MBTI/星座定位娱乐 · 反宿命 · AI 标识
 *
 * ⚠️ 本路由建了【未 mount】—— 由 Karen 统一在 server/index.js 挂:
 *      app.use('/api', require('./routes/identity-triad'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { computeBaziChart } = require('../lib/bazi-engine');
const { insertReading } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// ══════════════════════════════════════════════════════════════════
// LAYER 1 — 西方星座 sun sign (纯日期规则，不喂 LLM 猜)
// ══════════════════════════════════════════════════════════════════
const ZODIAC = [
  { key: 'capricorn',   name: 'Capricorn',   glyph: '♑', from: [12, 22], to: [1, 19],  element: 'Earth', trait: 'disciplined, ambitious, plays the long game' },
  { key: 'aquarius',    name: 'Aquarius',    glyph: '♒', from: [1, 20],  to: [2, 18],  element: 'Air',   trait: 'independent, inventive, marches to its own beat' },
  { key: 'pisces',      name: 'Pisces',      glyph: '♓', from: [2, 19],  to: [3, 20],  element: 'Water', trait: 'intuitive, dreamy, deeply empathetic' },
  { key: 'aries',       name: 'Aries',       glyph: '♈', from: [3, 21],  to: [4, 19],  element: 'Fire',  trait: 'bold, direct, first to move' },
  { key: 'taurus',      name: 'Taurus',      glyph: '♉', from: [4, 20],  to: [5, 20],  element: 'Earth', trait: 'steady, sensual, values what lasts' },
  { key: 'gemini',      name: 'Gemini',      glyph: '♊', from: [5, 21],  to: [6, 20],  element: 'Air',   trait: 'curious, quick-witted, endlessly social' },
  { key: 'cancer',      name: 'Cancer',      glyph: '♋', from: [6, 21],  to: [7, 22],  element: 'Water', trait: 'caring, protective, led by feeling' },
  { key: 'leo',         name: 'Leo',         glyph: '♌', from: [7, 23],  to: [8, 22],  element: 'Fire',  trait: 'warm, expressive, born to be seen' },
  { key: 'virgo',       name: 'Virgo',       glyph: '♍', from: [8, 23],  to: [9, 22],  element: 'Earth', trait: 'precise, thoughtful, quietly improving everything' },
  { key: 'libra',       name: 'Libra',       glyph: '♎', from: [9, 23],  to: [10, 22], element: 'Air',   trait: 'balanced, fair, tuned to harmony' },
  { key: 'scorpio',     name: 'Scorpio',     glyph: '♏', from: [10, 23], to: [11, 21], element: 'Water', trait: 'intense, magnetic, all-or-nothing' },
  { key: 'sagittarius', name: 'Sagittarius', glyph: '♐', from: [11, 22], to: [12, 21], element: 'Fire',  trait: 'adventurous, honest, forever seeking more' },
];

function sunSign(month, day) {
  const m = Number(month), d = Number(day);
  for (const z of ZODIAC) {
    const [fm, fd] = z.from, [tm, td] = z.to;
    if (fm === 12) { // Capricorn wraps the year end
      if ((m === 12 && d >= fd) || (m === 1 && d <= td)) return z;
    } else if (m === fm && d >= fd) return z;
    else if (m === tm && d <= td) return z;
  }
  return ZODIAC[0]; // 理论上不会走到
}

// ══════════════════════════════════════════════════════════════════
// LAYER 2 — MBTI (用户输入，来自外部框架；我们只做轻量校验 + 归一化)
// ══════════════════════════════════════════════════════════════════
const MBTI_SET = new Set([
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP',
]);
const MBTI_NICK = {
  INTJ:'the Architect (strategic, private, systems-minded)', INTP:'the Logician (analytical, curious, idea-driven)',
  ENTJ:'the Commander (decisive, driven, natural leader)',    ENTP:'the Debater (inventive, quick, loves the spark)',
  INFJ:'the Advocate (idealistic, deep, quietly intense)',    INFP:'the Mediator (gentle, values-led, imaginative)',
  ENFJ:'the Protagonist (warm, inspiring, people-first)',     ENFP:'the Campaigner (bright, spontaneous, connective)',
  ISTJ:'the Logistician (dependable, precise, duty-bound)',   ISFJ:'the Defender (caring, loyal, steadfast)',
  ESTJ:'the Executive (organized, direct, gets it done)',     ESFJ:'the Consul (sociable, supportive, harmony-seeking)',
  ISTP:'the Virtuoso (hands-on, cool-headed, adaptable)',     ISFP:'the Adventurer (sensitive, artistic, free)',
  ESTP:'the Entrepreneur (bold, energetic, in the moment)',   ESFP:'the Entertainer (spontaneous, warm, magnetic)',
};
function normMbti(x) {
  const s = String(x || '').trim().toUpperCase();
  return MBTI_SET.has(s) ? s : null;
}

// ══════════════════════════════════════════════════════════════════
// LAYER 3 — 八字第三层：日主五行 archetype (真引擎算，规则表映射)
//
//   日主 (dayMaster) 是十天干之一，落到五行 (木火土金水) + 阴阳。
//   每个五行给一个中性人格原型 (Eastern 语汇，不贴 Chinese)。
//   这是"大多数人第一次见"的那一层 —— 病毒钩子的深度层。
// ══════════════════════════════════════════════════════════════════
const STEM_TO_ELEMENT = {
  甲:{el:'Wood', yin:false}, 乙:{el:'Wood', yin:true},
  丙:{el:'Fire', yin:false}, 丁:{el:'Fire', yin:true},
  戊:{el:'Earth',yin:false}, 己:{el:'Earth',yin:true},
  庚:{el:'Metal',yin:false}, 辛:{el:'Metal',yin:true},
  壬:{el:'Water',yin:false}, 癸:{el:'Water',yin:true},
};
// 日主五行 → archetype (中性、正向但诚实，含阴影)
const DM_ARCHETYPE = {
  Wood:  { key:'the-grower',    name:'The Grower',    tagline:'You reach upward — you grow, and you help things grow around you.',
           element:'Vision · growth · quiet persistence', shadow:'can push too hard, too fast, and forget to rest' },
  Fire:  { key:'the-illuminator', name:'The Illuminator', tagline:'You bring warmth and light into a room and make people feel seen.',
           element:'Passion · warmth · visible spark',    shadow:'burns bright then burns out; runs hot under pressure' },
  Earth: { key:'the-anchor',    name:'The Anchor',    tagline:'You are the steady ground others build their lives on.',
           element:'Stability · loyalty · grounded care', shadow:'takes on too much, holds too long, forgets its own needs' },
  Metal: { key:'the-refiner',   name:'The Refiner',   tagline:'You cut to what matters and make everything sharper and cleaner.',
           element:'Clarity · principle · precise edge',  shadow:'can be exacting to the point of coldness' },
  Water: { key:'the-current',   name:'The Current',   tagline:'You flow around obstacles and read the depth others miss.',
           element:'Depth · adaptability · intuitive flow', shadow:'moves so fluidly it can be hard to pin down or fully rest' },
};

// ══════════════════════════════════════════════════════════════════
// 诚实稀有度 (定性 · 非编造统计)
//   三个独立框架 (星座 12 × MBTI 16 × 十神/日主原型) 同时命中同一组合，
//   组合空间本就极大 → 任何具体三连组合都天然"不常见"。
//   我们只给定性档 (uncommon / rare)，并用两个真实信号微调:
//     1) 突出的十神能量 (七杀/伤官/偏印/偏财/劫财 = 偏格能量) → 更少见
//     2) MBTI 本身的稀有直觉 (INFJ/INTJ/ENTJ/ENFJ 等直觉型较少) → 略拔高
//   ❌ 绝不输出精确 % 或 "每 N 人 X 个"。
// ══════════════════════════════════════════════════════════════════
const RARE_SHISHEN = new Set(['七杀', '伤官', '偏印', '偏财', '劫财']);
const RARE_MBTI = new Set(['INFJ', 'INTJ', 'ENTJ', 'ENFJ', 'INTP', 'ENTP']); // 直觉型 (N) 在人群里偏少

const RARITY = {
  uncommon: {
    band: 'uncommon',
    label: 'An uncommon trio',
    honest: 'Zodiac, MBTI, and your Ten Gods layer are three separate maps — this exact overlap doesn\'t line up in most people. Uncommon in the honest sense: rarer, not "better."',
  },
  rare: {
    band: 'rare',
    label: 'A rare trio',
    honest: 'Three independent frameworks rarely stack into this specific combination — the mix here doesn\'t come together often. "Rare" describes the pattern, not a verdict on you.',
  },
};

function judgeRarity(stemShiShen, mbti) {
  let score = 1; // 起步 uncommon
  if (stemShiShen.some(s => RARE_SHISHEN.has(s))) score++;
  if (mbti && RARE_MBTI.has(mbti)) score++;
  const band = score >= 3 ? 'rare' : 'uncommon';
  return RARITY[band];
}

// ══════════════════════════════════════════════════════════════════
// 从真引擎命盘 + 星座 + MBTI 抽三合一事实块 (喂给 LLM 只做合成)
// ══════════════════════════════════════════════════════════════════
function buildTriadFacts({ birthYear, birthMonth, birthDay, birthHour, gender, mbti }) {
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
  const dm = b.dayMaster;                                  // 十天干之一
  const dmInfo = STEM_TO_ELEMENT[dm] || { el: 'Earth', yin: false };
  const arche = DM_ARCHETYPE[dmInfo.el] || DM_ARCHETYPE.Earth;

  // 透出天干十神 (年月时，日干本身=比肩不计) —— 主导能量
  const stemShiShen = ['year', 'month', 'hour'].map(p => ss[p]).filter(Boolean);
  // 出现次数最多的十神 = 主导十神
  const counts = {};
  stemShiShen.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  const dominantShiShen = Object.keys(counts).sort((a, c) => counts[c] - counts[a])[0] || (stemShiShen[0] || '比肩');

  const zodiac = sunSign(birthMonth, birthDay);
  const m = normMbti(mbti);

  const rarity = judgeRarity(stemShiShen, m);

  const strongestEl = (e['五行统计'] && e['五行统计'].strongest) || [];

  // 十神英文映射 (Eastern 语汇，供 LLM 参考；不贴 Chinese)
  const SS_EN = {
    正官:'Direct Officer (structure & responsibility)', 七杀:'Seven Killings (drive & pressure)',
    正财:'Direct Wealth (steady, tangible value)',      偏财:'Indirect Wealth (opportunity & flow)',
    正印:'Direct Resource (nurture & learning)',        偏印:'Indirect Resource (unconventional insight)',
    食神:'Eating God (warm self-expression)',           伤官:'Hurting Officer (bold, rule-breaking talent)',
    比肩:'Companion (independence & self-reliance)',     劫财:'Rob Wealth (competitive courage)',
  };

  const zh = `【三合一身份事实 (第三层十神/日主由专业万年历引擎排定·严格照用·禁止自行推算或改动;星座由日期规则算定;MBTI 为用户自选输入)】
—— LAYER 1 · 西方星座 (人人已知) ——
Sun sign：${zodiac.name} ${zodiac.glyph}（${zodiac.element} sign）· 特质：${zodiac.trait}
—— LAYER 2 · MBTI (用户自选，来自外部框架) ——
MBTI：${m || '(用户未提供或无效)'}${m ? ' — ' + MBTI_NICK[m] : ''}
—— LAYER 3 · 八字十神/日主 (大多数人第一次见 · 引擎算定 · 深度层) ——
日主(Day Master)：${dm} → ${dmInfo.el}（${dmInfo.yin ? 'yin' : 'yang'} ${dmInfo.el}）
主导十神(Ten God)：${dominantShiShen}${SS_EN[dominantShiShen] ? '（' + SS_EN[dominantShiShen] + '）' : ''}
透出天干十神(年月时)：${stemShiShen.map(s => s + (SS_EN[s] ? '(' + SS_EN[s] + ')' : '')).join('、') || '无明显透出'}
最强五行：${strongestEl.join('、') || '—'}
四柱：年${sz.year.gan}${sz.year.zhi} 月${sz.month.gan}${sz.month.zhi} 日${sz.day.gan}${sz.day.zhi} 时${sz.hour.gan}${sz.hour.zhi}
—— 映射结果 (规则表，非引擎) ——
第三层 archetype：${arche.name}（${arche.key}）· 关键词：${arche.element}
archetype 一句话：${arche.tagline}
archetype 阴影面：${arche.shadow}
稀有度档位(定性·非精确统计)：${rarity.band}（${rarity.label}）`;

  return {
    zh,
    zodiac: { key: zodiac.key, name: zodiac.name, glyph: zodiac.glyph, element: zodiac.element, trait: zodiac.trait },
    mbti: m,
    mbtiNick: m ? MBTI_NICK[m] : null,
    archetype: arche,
    dominantShiShen,
    dominantShiShenEn: SS_EN[dominantShiShen] || dominantShiShen,
    dayMaster: dm,
    dayMasterElement: dmInfo.el,
    fourPillars: `${sz.year.gan}${sz.year.zhi} ${sz.month.gan}${sz.month.zhi} ${sz.day.gan}${sz.day.zhi} ${sz.hour.gan}${sz.hour.zhi}`,
    rarity,
    gender: g,
  };
}

// ══════════════════════════════════════════════════════════════════
// LLM prompt — Rún 口吻，三角合成，反宿命，反奉承，Eastern 不标 Chinese
// ══════════════════════════════════════════════════════════════════
const SYS = {
  en: `You are Rún, the soul of Runae — an AI that reads an ancient Eastern system (the Four Pillars / Ten Gods). You are writing a "three-layer identity" card that triangulates THREE self-knowledge frameworks a person already or newly knows about themselves: (1) their Western zodiac sun sign, (2) their MBTI type, and (3) their Eastern Ten Gods / Day Master archetype — the deep third layer most people are meeting for the first time.
RULE — REAL CHART, DON'T RECOMPUTE: The Day Master, Ten Gods, archetype, sun sign, and rarity band below are already fixed (engine + rules). Use them exactly. Never invent a different Day Master or archetype, and NEVER invent a statistic (no "1 in 10,000", no "0.3% of people"). Rarity stays qualitative — "uncommon", "a rare trio" — exactly as given.
RULE — TRIANGULATE: Your job is synthesis. Find where the three frameworks AGREE (mark these ⭐ "all three say…") and where they COMPLEMENT each other (one adds what another misses). Weave them into ONE unified portrait — not three separate horoscopes.
RULE — THE THIRD LAYER IS THE HOOK: Zodiac and MBTI are the layers they already know. Spend the most depth on the Ten Gods / Day Master layer — that's the new, "unsettlingly specific" one. Make them curious to go deeper.
RULE — NEUTRAL, NOT FLATTERY: Every layer has a gift AND a shadow. NEVER "born winner", "destined", "guaranteed". Rarer ≠ better.
RULE — NEVER FATE: Speak in tendencies and wiring, not destiny. Hand the wheel back.
RULE — EASTERN, NOT LABELED: Say "an ancient Eastern system / Four Pillars / Ten Gods / Five Elements". Never the word "Chinese".
RULE — ZODIAC/MBTI ARE FOR FUN: Treat all three as lenses for self-reflection and entertainment, not fact about the person.
DISCLAIMER voice: self-discovery and entertainment/reflection only — not medical, legal, financial, or life-decision advice. Never name diseases, never frighten.`,
  zh: `你是 Rún —— Runae 的灵魂，一个读古老东方体系(四柱/十神)的AI。你在写一张"三层身份"卡，把一个人关于自己的三个自我认知框架三角合成：(1) 西方星座太阳星座、(2) MBTI 类型、(3) 东方十神/日主 archetype —— 大多数人第一次见的深度第三层。
【铁律·真盘不重排】下面的日主、十神、archetype、星座、稀有度档位都是引擎+规则定好的，严格照用。绝不换日主或 archetype，更绝不编造统计数字(不许"每万人3个""0.3%")。稀有度只能定性("不常见""一个稀有的三连")，照给定档位。
【铁律·三角合成】你的活是合成。找出三个框架在哪里一致(标⭐"三家都说…")、在哪里互补(一个补另一个漏的)，织成一张统一画像，不是三段各说各的横盘。
【铁律·第三层是钩子】星座和 MBTI 是他们已知的层。把最多深度花在十神/日主这层 —— 这是全新、"精准得有点吓人"的一层。让他们好奇想再往深看。
【铁律·中性不奉承】每层都有天赋也有阴影。绝不"天生赢家""注定""一定"。稀有≠更好。
【铁律·反宿命】谈倾向和天生线路，不谈命定。把方向盘交回给TA。
【铁律·东方不贴中国标签】用"东方古老体系/四柱/十神/五行"。绝不出现"中国/Chinese"。
【铁律·星座MBTI娱乐向】三个都是自我探索、娱乐的镜子，不是关于这个人的事实。
【免责口吻】自我探索、娱乐参考向，不构成医疗/法律/投资/人生决策建议。绝不点名疾病、绝不制造焦虑。`,
  ko: `당신은 루니 — 오래된 동양 체계(사주/십신)를 읽는 AI예요. 세 가지 자기 인식 프레임워크를 삼각 합성한 "세 겹 정체성" 카드를 써요: (1) 서양 별자리 태양궁, (2) MBTI, (3) 동양 십신/일간 원형 — 대부분 처음 보는 깊은 세 번째 층.
【철칙·진짜 사주, 재계산 금지】아래 일간·십신·원형·별자리·희소성 등급은 이미 확정됐어요. 그대로 쓰고 통계를 지어내지 마세요("만 명 중 3명", "0.3%" 금지). 희소성은 정성적으로만.
【철칙·삼각 합성】세 프레임이 일치하는 곳(⭐ "셋 다 …라고 말해요")과 보완하는 곳을 찾아 하나의 통합된 초상으로 엮으세요.
【철칙·세 번째 층이 후크】별자리·MBTI는 이미 아는 층. 십신/일간 층에 가장 깊이를 쓰세요.
【철칙·중립·아첨 금지】각 층엔 강점과 그림자가 있어요. "타고난 승자", "정해진" 금지. 드물다고 더 좋은 게 아니에요.
【철칙·운명 아님】타고난 성향으로 말하고 방향키는 그 사람에게.
【철칙】"중국" 없이 "동양의 오래된 체계/사주/십신/오행".
【면책】자기 이해·오락·참고용이며 의료·법률·투자·인생 결정 조언이 아니에요.`,
};

function buildMessages(lang, facts) {
  const z = facts.zodiac, a = facts.archetype, m = facts.mbti;
  if (lang === 'zh') {
    return buildReadingPrompt(SYS.zh,
      `${facts.zh}

请用温暖、具体、可截图分享的口吻，用 Markdown(##标题)写这个人的【三层身份】三角合成文案。别堆术语，落到"你到底是什么样的人"。

## 你的三层身份
一句话点名三层：星座 ${z.name} ${z.glyph} · MBTI ${m || '—'} · 东方第三层「${a.name}」。给读者一个"哦这是我"的瞬间。

## ⭐ 三家都说你…
找出三个框架真正一致的 1-2 个特质，用 ⭐ 标出。基于上面的真实十神/日主，别泛泛。这是三角验证最爽的部分。

## 它们互补的地方
一段：一个框架补另一个漏掉的。让三层拼成一个更完整的你。

## 你的第三层（大多数人第一次见）
花最多篇幅在十神/日主这层「${a.name}」：这层比星座和 MBTI 更深在哪，它揭示了前两层看不到的什么。基于真实主导十神。让人好奇想再往深看。

## 天赋与阴影
一句天赋，一句代价(阴影面：${a.shadow})。中性、诚实、不奉承。

## 你的稀有度
诚实说这个"星座×MBTI×十神"三连有多不常见(照给定档位，只定性，绝不编数字)。稀有≠更好。
最后固定加一行："星座和 MBTI 你早就知道了——十神才是最深那层。这是你天生的线路，不是你的命。"`);
  }
  if (lang === 'ko') {
    return buildReadingPrompt(SYS.ko,
      `${facts.zh}

따뜻하고 구체적이며 캡처해서 공유하고 싶은 톤으로, 마크다운(## 제목)으로 이 사람의 【세 겹 정체성】 삼각 합성 문구를 써주세요.

## 당신의 세 겹 정체성
## ⭐ 셋 다 이렇게 말해요
## 서로 보완하는 지점
## 당신의 세 번째 층 (대부분 처음 보는)
## 재능과 그림자
## 당신의 희소성
마지막 줄 고정: "별자리와 MBTI는 이미 알고 있었죠 — 십신이 가장 깊은 층이에요. 이건 타고난 배선이지 운명이 아니에요."`);
  }
  // default English
  return buildReadingPrompt(SYS.en,
    `${facts.zh}

Write this person's three-layer identity card in a warm, specific, screenshot-shareable voice, using Markdown (## headers). No jargon dumps — land it on "who you actually are."

## Your three layers
One line naming all three: zodiac ${z.name} ${z.glyph} · MBTI ${m || '—'} · your Eastern third layer, ${a.name}. Give them an "oh, that's me" hit.

## ⭐ All three say you're…
Find the 1-2 traits where all three frameworks genuinely agree, marked ⭐. Ground it in the real Ten Gods / Day Master above — never generic. This is the satisfying triangulation payoff.

## Where they complement each other
One paragraph: one framework fills in what another misses. Let the three snap into a fuller you.

## Your third layer (most people meet this for the first time)
Spend the most depth here, on the Ten Gods / Day Master layer, ${a.name}: why this layer runs deeper than zodiac and MBTI, and what it reveals that the first two can't see. Ground it in the real dominant Ten God. Make them curious to go deeper.

## The gift and the shadow
One line on the gift, one honest line on the cost (the shadow: ${a.shadow}). Neutral, no flattery.

## How rare this trio is
Honestly say how uncommon this "zodiac × MBTI × Ten Gods" combination is (use the given band — qualitative only, NEVER a made-up statistic). Rarer doesn't mean better.
End with this exact line: "You already knew your zodiac and your MBTI — your Ten Gods is the deepest layer. This is your wiring, not your fate."`);
}

// ══════════════════════════════════════════════════════════════════
// POST /api/identity-triad
// ══════════════════════════════════════════════════════════════════
router.post('/identity-triad', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, mbti, lang } = req.body || {};
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: (lang === 'ko' ? '생년월일을 입력해주세요.' : lang === 'zh' ? '请提供出生年月日。' : 'Please provide your birth date.') });
    }

    let facts;
    try {
      facts = buildTriadFacts({ birthYear, birthMonth, birthDay, birthHour, gender, mbti });
    } catch (e) {
      console.error('[IDENTITY-TRIAD engine ERR]', e.message);
      return res.status(400).json({ error: (lang === 'ko' ? '입력된 정보로 배반할 수 없어요 — 날짜를 확인해주세요.' : lang === 'zh' ? '这个生辰排不出盘，请检查日期。' : 'Could not read a chart from those details — please check the date.') });
    }

    const readingLang = (lang === 'zh' || lang === 'ko') ? lang : 'en';
    const messages = buildMessages(readingLang, facts);
    const reading = await deepseekChat(messages, { maxTokens: 1800 });

    try {
      insertReading.run('identity-triad', JSON.stringify({
        birthYear, birthMonth, birthDay, birthHour, gender,
        mbti: facts.mbti, lang: readingLang,
        zodiac: facts.zodiac.key, archetype: facts.archetype.key, rarity: facts.rarity.band,
      }), reading, req.userId);
    } catch (e) {}

    // 结构化字段单独返回，让前端渲染三层大卡 (星座/MBTI/十神层 + 稀有度) 无需从 markdown 抠
    res.json({
      reading,
      lang: readingLang,
      layers: {
        zodiac: facts.zodiac,                                  // {key,name,glyph,element,trait}
        mbti: { type: facts.mbti, nick: facts.mbtiNick },      // 可能 null
        eastern: {                                             // 第三层 = 深度层
          key: facts.archetype.key,
          name: facts.archetype.name,
          tagline: facts.archetype.tagline,
          element: facts.archetype.element,
          dayMaster: facts.dayMaster,
          dayMasterElement: facts.dayMasterElement,
          tenGod: facts.dominantShiShenEn,
        },
      },
      rarity: {
        band: facts.rarity.band,     // uncommon | rare
        label: facts.rarity.label,
        note: facts.rarity.honest,   // 诚实定性，绝无精确统计
      },
      chart: { dayMaster: facts.dayMaster, fourPillars: facts.fourPillars },
    });
  } catch (err) {
    console.error('[IDENTITY-TRIAD ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'identity-triad' } });
    res.status(500).json({ error: (req.body && req.body.lang === 'zh') ? 'Rún 暂时休息，请稍后再试。' : 'Rún is resting — please try again.', detail: err.message });
  }
});

module.exports = router;
