'use strict';
/**
 * routes/jieqian.js — 解签服务（寺庙实体签解读）
 * POST /api/jieqian
 *
 * 核心逻辑：用户已在庙里实体抽签 → 输入签系+签号+所问之事
 * → 查真谱库取固定谱文（一字不改）→ LLM 结合所问做白话解读
 *
 * 与 /api/lingqian（虚拟摇签）的本质区别：
 *   - 不 Math.random() 帮用户抽签
 *   - 签诗来自现实世界用户手里的实体签
 *   - LLM 只解不编，谱文铁律不进 LLM 生成路径
 */

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');

const { deepseekChat }  = require('../lib/llm');
const { gateMessages, saveQaContext, insertReading } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');
const { matchProduct }  = require('../data/products');

// ── 合规免责（沿用全局基线） ──
const DISCLAIMER_ZH = '\n\n本报告由AI辅助生成，仅供传统文化参考与娱乐，不构成医学、法律、投资或人生重大决策建议。签文为传统庙谱固定谱文，解读为文化参考，不承诺灵验，如有健康疑虑请咨询专业医生。';
const DISCLAIMER_EN = '\n\nThis reading is AI-assisted, based on traditional temple scripture, and is for cultural reference and entertainment only. It does not guarantee efficacy, nor does it constitute medical, legal, investment, or life-decision advice. Consult a professional for medical concerns.';

// ── 语言后缀 ──
function langSuffix(lang) {
  const MAP = {
    'en': 'Output the ENTIRE reading in fluent English. Keep key Chinese/Japanese divination terms in their original language with English explanation in parentheses. Never mention which AI model powers this.',
    'ja': '全ての解説を流暢な日本語で出力してください。重要な漢字術語は原語を保持し、括弧内に日本語説明を追加してください。使用しているAIモデルを絶対に明かさないでください。',
    'ko': '전체 해석을 유창한 한국어로 출력하세요. 핵심 한자 술어는 원어를 유지하고 괄호 안에 한국어 설명을 추가하세요. 사용 중인 AI 모델을 절대 밝히지 마세요.',
  };
  return MAP[lang] ? '\n\n【语言指令】' + MAP[lang] : '';
}

// ── 签系配置 ──
const SIGN_SYSTEMS = {
  guanyin: {
    name: '观音灵签',
    nameEn: 'Guanyin Temple Oracle',
    dataFile: 'lingqian-guanyin.json',
    minNo: 1,
    maxNo: 100,
    type: 'numbered',   // 用签号查
  },
  huangdaxian: {
    name: '黄大仙灵签',
    nameEn: 'Wong Tai Sin Oracle',
    dataFile: 'lingqian-huangdaxian.json',
    minNo: 1,
    maxNo: 100,
    type: 'numbered',
  },
  omikuji: {
    name: '日本御神签',
    nameEn: 'Japanese Omikuji',
    dataFile: null,       // 无独立签库，用等级制
    type: 'grade',        // 用吉凶等级查
  },
};

// ── 签库缓存（require 已做 module cache，此处做 null-safe 封装） ──
const _libCache = {};
function loadLib(dataFile) {
  if (!dataFile) return null;
  if (_libCache[dataFile]) return _libCache[dataFile];
  try {
    const lib = require(path.join(__dirname, '../data', dataFile));
    _libCache[dataFile] = lib;
    return lib;
  } catch (e) {
    console.warn('[JIEQIAN] 签库加载失败:', dataFile, e && e.message);
    return null;
  }
}

// ── 按签号查签 ──
function findSign(lib, signNo) {
  if (!lib || !Array.isArray(lib.signs)) return null;
  const no = parseInt(signNo, 10);
  if (isNaN(no)) return null;
  return lib.signs.find(s => s && s.no === no) || null;
}

// ── 所问之事 topic → 中文标签 ──
const TOPIC_MAP = {
  career:  '事业工作',
  love:    '感情姻缘',
  wealth:  '财运求财',
  health:  '健康疾病',
  travel:  '出行行程',
  lost:    '寻物失物',
  lawsuit: '官司诉讼',
  move:    '搬迁置业',
  study:   '学业考试',
  other:   '其他',
};

// ══════════════════════════════════════════════════════════
// POST /api/jieqian
// ══════════════════════════════════════════════════════════
/**
 * 入参：
 *   system   {string} 'guanyin' | 'huangdaxian' | 'omikuji'
 *   signNo   {number} 签号 1-100（观音/黄大仙用）
 *   grade    {string} 吉凶等级（omikuji 用：大吉/吉/中吉/小吉/末吉/凶/大凶）
 *   question {string} 用户所问（自由文本，可选）
 *   topic    {string} career|love|wealth|health|travel|lost|lawsuit|move|study|other（可选）
 *   lang     {string} 'zh'|'en'|'ja'|'ko'（默认 zh）
 *   tier     {string} 'free'|'full'（默认 free）
 *
 * 响应：
 *   sign     {object} 签的元数据（来自真谱库，不含 LLM 生成内容）
 *   reading  {string} LLM 解读文本（free 档截断+锁定提示）
 *   locked   {bool}   free 档为 true
 *   contextId {string} 支持 /api/ask-followup 追问
 *   product  {object} 可选带货
 *   meta     {object} 签系/签号/验证状态等元信息
 */
router.post('/jieqian', rateLimitMiddleware, async (req, res) => {
  try {
    const {
      system   = 'guanyin',
      signNo,
      grade,
      question = '',
      topic    = '',
      lang     = 'zh',
      tier: reqTier,
    } = req.body;

    const isEn = (lang === 'en');
    const sysConf = SIGN_SYSTEMS[system];

    // ── 未知签系 ──
    if (!sysConf) {
      return res.status(400).json({
        error: isEn
          ? `Unknown sign system "${system}". Supported: guanyin, huangdaxian, omikuji.`
          : `不支持的签系"${system}"。当前支持：guanyin（观音）、huangdaxian（黄大仙）、omikuji（御神签）。`,
      });
    }

    // ── 分档控制（gateMessages 判断付费状态） ──
    const _gate = gateMessages(
      req,
      ['jieqian', '解签', 'lingqian', '灵签', 'omikuji', 'member'],
      [],
      8192
    );
    // free/full 两档，付费门暂留 TODO 可接入 Stripe/微信支付
    const jqTier = _gate.full ? (reqTier === 'full' ? 'full' : 'free') : 'free';
    // TODO P1: 接入 resolveReportTier + 地理定价（¥9.9 国内 / $6.9 海外）

    // ══════════════
    // 签系分支
    // ══════════════

    // ── A. omikuji（等级制，无独立签库） ──
    if (system === 'omikuji') {
      return await _handleOmikuji({ req, res, grade, question, topic, lang, isEn, jqTier });
    }

    // ── B. 带真谱库的签系（观音 / 黄大仙） ──
    const lib     = loadLib(sysConf.dataFile);
    const signMeta = findSign(lib, signNo);
    const systemName = sysConf.name;
    const verifiedTotal = lib ? (lib._meta && lib._meta.verified_count) || lib.signs.filter(s => s && s.verified).length : 0;
    const totalInLib    = lib ? (lib._meta && lib._meta.total) || lib.signs.length : 0;

    // ── 签号越界 / 找不到 ──
    if (!signMeta) {
      const rangeMsg = isEn
        ? `Sign #${signNo} not found in ${sysConf.nameEn} (1–${sysConf.maxNo}).`
        : `第 ${signNo} 签不在 ${systemName} 签库范围内（有效签号 1–${sysConf.maxNo}）。`;
      return res.status(400).json({ error: rangeMsg });
    }

    // ── 占位签（verified=false）——优雅降级，不编造签诗 ──
    if (!signMeta.verified) {
      const placeholderMsg = isEn
        ? `Sign #${signMeta.no} (${systemName}) is not yet in our verified scripture database (${verifiedTotal}/${totalInLib} signs verified). Please try a different sign number, or check back soon as we continue expanding the library.`
        : `第 ${signMeta.no} 签（${systemName}）暂未收录真谱（本库已收录 ${verifiedTotal}/${totalInLib} 签）。建议换其他签号，或稍后再试——我们正在持续补全真谱库。`;
      return res.json({
        sign: { no: signMeta.no, grade: signMeta.grade || '', gong: signMeta.gong || '' },
        reading: placeholderMsg,
        locked: false,
        verified: false,
        meta: { system, systemName, verifiedCount: verifiedTotal, totalCount: totalInLib },
      });
    }

    // ── Verified 签：注入固定谱文做解读 ──
    const topicLabel = TOPIC_MAP[topic] || question || '综合指引';
    const poemText = signMeta.poem.join('\n');
    const isAuspicious = /上上|上吉|中吉/.test(signMeta.grade || '');
    const isCaution = /凶/.test(signMeta.grade || '');

    // 凶签额外安抚指令
    const cautionInstruction = isCaution
      ? isEn
        ? '\n⚠️ CAUTION SIGN PROTOCOL: This is a caution sign. You MUST open with warm reassurance and reframing before any guidance. Use gentle, hopeful language. Never frighten the reader. Focus on "what can I do" not "what will go wrong". End with an uplifting closing.'
        : '\n⚠️ 凶签协议：本签为凶/警示签，必须先用温暖语气安抚、转念引导，再给行动建议。绝不恐吓。重点在"可以做什么"而非"会发生什么坏事"。结尾给予温暖祝福。'
      : '';

    const systemPrompt = isEn
      ? `You are a wise temple oracle interpreter with decades of experience in traditional Chinese divination texts. You translate ancient wisdom into warm, practical, personally relevant guidance. Speak with calm authority and deep compassion.\n\n【IRON RULES】\n1. The poem below is FIXED TEMPLE SCRIPTURE — copy it EXACTLY as given. You may NOT alter, paraphrase, or replace even one character of the poem.\n2. You interpret the sign — you do NOT rewrite the sign.\n3. Never mention which AI model powers this.\n4. No guarantees of outcomes; no medical diagnoses; no scaremongering.${cautionInstruction}` + DISCLAIMER_EN + langSuffix(lang)
      : `你是一位在庙宇解签数十年的解签师，精通传统庙谱诗意与白话转化，善于结合求签者所问之事给出温暖、有深度、落地可行的解读。\n\n【铁律·不得违反】\n1. 下方签诗是${systemName}的固定庙谱真文，一字不改、不得自行创作、不得替换、不得"优化"——你只负责解签，不编签。\n2. 先原样引用签诗，再做解读。\n3. 绝不透露所用AI模型。\n4. 不承诺灵验、不恐吓、不打包票、不做医疗建议。${cautionInstruction}` + DISCLAIMER_ZH + langSuffix(lang);

    let userPrompt;
    if (jqTier === 'free') {
      userPrompt = isEn
        ? `The querent drew this sign at the temple.\n\n【Sign Information · ${sysConf.nameEn} · Sign #${signMeta.no} · ${signMeta.grade}】\n(Fixed temple scripture — do NOT alter)\nPoem:\n${poemText}\nAllusion: ${signMeta.gong || ''}\nTemple Commentary: ${signMeta.explain || ''}\nOmens: ${signMeta.meaning || ''}\n\nTheir question / matter: ${topicLabel}\nAdditional context: ${question || '(none provided)'}\n\nFor the FREE PREVIEW, output ONLY the following 3 sections (~400 words total):\n\n📜 SIGN SCRIPTURE (copy poem exactly, then state: ${signMeta.grade} · ${signMeta.gong || ''})\n🏮 FORTUNE LEVEL & ONE-LINE INSIGHT (50 words — what this sign means in one sentence for their specific matter)\n💬 FIRST IMPRESSION (2 paragraphs, ~250 words — tone setting, overall energy of this sign, warmth and hope)\n\nThen output exactly:\n---LOCKED---\nUnlock the full reading (¥9.9 / $6.9) to receive:\n🔍 Line-by-line poem translation & allusion background\n🎯 Targeted guidance for your specific matter\n💡 Practical action suggestions\n🕊️ Resolution/reframing guidance\n🙏 Ritual & blessing guidance`
        : `求签者在庙中抽到了这支签。\n\n【签文信息 · ${systemName} · 第${signMeta.no}签 · ${signMeta.grade}】\n（固定庙谱真文·禁止改写）\n签诗：\n${poemText}\n典故：${signMeta.gong || ''}\n解曰：${signMeta.explain || ''}\n圣意：${signMeta.meaning || ''}\n\n所问之事：${topicLabel}\n补充说明：${question || '（无）'}\n\n【免费预览版】仅输出以下3节（约400字）：\n\n📜 签诗原文（原样引用，并标注：${signMeta.grade} · ${signMeta.gong || ''}）\n🏮 吉凶等级与一句点睛（50字——对所问之事，这支签一句话意味着什么）\n💬 解签初读（2段，约250字——定调、这支签的整体能量，给人温暖与方向）\n\n完成后输出：\n---LOCKED---\n解锁完整解读（¥9.9 / $6.9）可获得：\n🔍 签诗逐句白话翻译 + 典故背景\n🎯 结合你所问之事的定向解读\n💡 行动建议\n🕊️ ${isCaution ? '转念化解方向' : '顺势行动指引'}\n🙏 祈福与调心方法`;
    } else {
      // full 档
      userPrompt = isEn
        ? `The querent drew this sign at the temple.\n\n【Sign Information · ${sysConf.nameEn} · Sign #${signMeta.no} · ${signMeta.grade}】\n(Fixed temple scripture — do NOT alter)\nPoem:\n${poemText}\nAllusion: ${signMeta.gong || ''}\nTemple Commentary: ${signMeta.explain || ''}\nOmens: ${signMeta.meaning || ''}\n\nTheir question / matter: ${topicLabel}\nAdditional context: ${question || '(none provided)'}\n\nGenerate a COMPLETE sign reading (~1200 words) with these sections:\n\n1. 📜 SIGN SCRIPTURE (copy poem exactly, grade & allusion)\n2. 🏮 FORTUNE OVERVIEW (${signMeta.grade} — 150 words, overall energy and context)\n3. 🔍 LINE-BY-LINE INTERPRETATION (each of the 4 poem lines: original → modern translation → insight, ~200 words total)\n4. 📖 ALLUSION BACKGROUND (${signMeta.gong || 'traditional story'} — 100 words, the story behind the sign)\n5. 🎯 TARGETED GUIDANCE FOR YOUR MATTER (${topicLabel} — 200 words, specific and personally relevant)\n6. 💡 ACTION SUGGESTIONS (3–5 concrete, honest, non-prescriptive suggestions — 150 words)\n7. 🕊️ ${isCaution ? 'REFRAMING & RESOLUTION (caution sign comfort + gentle guidance — 150 words)' : 'FAVORABLE ACTION WINDOWS (timing guidance — 100 words)'}\n8. 🙏 BLESSING & RITUAL (traditional practice suggestion, warm and optional — 100 words)`
        : `求签者在庙中抽到了这支签。\n\n【签文信息 · ${systemName} · 第${signMeta.no}签 · ${signMeta.grade}】\n（固定庙谱真文·禁止改写）\n签诗：\n${poemText}\n典故：${signMeta.gong || ''}\n解曰：${signMeta.explain || ''}\n圣意：${signMeta.meaning || ''}\n\n所问之事：${topicLabel}\n补充说明：${question || '（无）'}\n\n请生成完整解签报告（约1200字），按以下8节写完：\n\n1. 📜 签诗原文（原样引用，标注签级与典故名）\n2. 🏮 签运总览（${signMeta.grade}·150字·整体能量与背景）\n3. 🔍 逐句白话解（签诗四句每句：原文→现代白话→含义启示，共约200字）\n4. 📖 典故背景（${signMeta.gong || '传统典故'}·100字·这支签背后的故事）\n5. 🎯 结合所问之事的定向解读（${topicLabel}·200字·具体落地，与求签者所问紧密结合）\n6. 💡 行动建议（3–5条，诚实具体，不承诺，不打包票·150字）\n7. 🕊️ ${isCaution ? '转念化解（凶签安抚·先给温暖再给方向·150字）' : '顺势行动窗口（吉签如何把握时机·100字）'}\n8. 🙏 祈福与调心（传统习俗·温和可选·100字）`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const maxTokens = jqTier === 'free' ? 3000 : 8192;
    const reading = await deepseekChat(messages, { maxTokens, priority: 'deepseek' });

    // 存上下文支持追问
    const ctxId = saveQaContext('jieqian', req.body, reading);

    // 尝试匹配带货（付费档才推）
    let product;
    if (jqTier === 'full') {
      try { product = matchProduct(reading, 'jieqian'); } catch (e) {}
    }

    res.json({
      sign: {
        no:      signMeta.no,
        grade:   signMeta.grade,
        gong:    signMeta.gong,
        poem:    signMeta.poem,   // 来自真谱库，一字不改
        explain: signMeta.explain,
        meaning: signMeta.meaning,
      },
      reading,
      locked:    jqTier === 'free',
      contextId: ctxId,
      product,
      meta: {
        system,
        systemName,
        verified: true,
        verifiedCount: verifiedTotal,
        totalCount:    totalInLib,
        tier: jqTier,
      },
    });
  } catch (err) {
    console.error('[JIEQIAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════════════════════
// omikuji 分支（御神签·等级制·无签号查库）
// ══════════════════════════════════════════════════════════
const OMIKUJI_GRADES = ['大吉', '吉', '中吉', '小吉', '末吉', '凶', '大凶'];
const OMIKUJI_GRADE_EN = {
  '大吉': 'Dai-kichi (Great Blessing)',
  '吉':   'Kichi (Blessing)',
  '中吉': 'Chū-kichi (Middle Blessing)',
  '小吉': 'Shō-kichi (Small Blessing)',
  '末吉': 'Sue-kichi (Future Blessing)',
  '凶':   'Kyō (Caution)',
  '大凶': 'Dai-kyō (Great Caution)',
};

async function _handleOmikuji({ req, res, grade, question, topic, lang, isEn, jqTier }) {
  const gradeLabel = grade || '吉';
  const gradeEn    = OMIKUJI_GRADE_EN[gradeLabel] || gradeLabel;
  const topicLabel = TOPIC_MAP[topic] || question || '综合指引';
  const isCaution  = /凶/.test(gradeLabel);

  if (!OMIKUJI_GRADES.includes(gradeLabel)) {
    return res.status(400).json({
      error: isEn
        ? `Unknown omikuji grade "${gradeLabel}". Valid grades: ${OMIKUJI_GRADES.join(' / ')}`
        : `不认识的御神签等级"${gradeLabel}"。有效等级：${OMIKUJI_GRADES.join(' / ')}`,
    });
  }

  const cautionNote = isCaution
    ? isEn
      ? '\n⚠️ CAUTION PROTOCOL: Open with warm reassurance. Emphasize that caution signs are invitations to be mindful, not predictions of doom. End with hope and encouragement.'
      : '\n⚠️ 凶签协议：先安抚，强调"凶签是提醒不是诅咒"，给转念方向，结尾温暖祝福，绝不恐吓。'
    : '';

  const systemPrompt = isEn
    ? `You are a wise and compassionate Shinto shrine priest at a sacred Japanese shrine, deeply versed in omikuji (御神籤) tradition. Your voice is calm, gentle, and filled with wabi-sabi wisdom. Each reading is personal and heartfelt. Never mention which AI model powers this.${cautionNote}` + DISCLAIMER_EN + langSuffix(lang)
    : `你是一位精通日本御神签（おみくじ）传统的神社神职，同时深谙汉字典故与汉诗之美。你用温暖、平静、充满禅意的语言为参拜者传达神的旨意。绝不透露所用AI模型。${cautionNote}` + DISCLAIMER_ZH + langSuffix(lang);

  let userPrompt, maxTokens;

  if (jqTier === 'free') {
    maxTokens = 3000;
    userPrompt = isEn
      ? `The visitor drew from the omikuji box: ${gradeLabel} — ${gradeEn}\nTheir question / matter: ${topicLabel}\nAdditional context: ${question || '(none)'}\n\nFor the FREE PREVIEW, output ONLY these 3 sections (~400 words):\n\n🎋 FORTUNE LEVEL (${gradeEn} — bilingual Japanese + English display, 50 words)\n🌸 SACRED POEM (compose one traditional 5-7-5-7-7 waka in Japanese, then poetic English translation, then 80-word reflection)\n🏯 OVERALL FORTUNE READING (2 paragraphs, ~250 words — ${gradeLabel} energy, warmth and direction)\n\nThen output exactly:\n---LOCKED---\n❤️ Love & Relationships · Unlock full version\n📚 Study & Career · Unlock full version\n💰 Wealth · Unlock full version\n🕊️ ${isCaution ? 'Reframing & resolution guidance' : 'Action timing'} · Unlock full version\n🙏 Ritual & prayer guidance · Unlock full version`
      : `参拜者从签筒中摇出：${gradeLabel}\n所问之事：${topicLabel}\n补充说明：${question || '（无）'}\n\n【免费预览版】仅输出以下3节（约400字）：\n\n🎋 签级（日中双语展示·50字）\n🌸 御神歌（传统日文五七五七七原文 + 中文诗意译文 + 80字解读）\n🏯 ${gradeLabel} 总运初读（2段·约250字·签的整体能量与方向）\n\n完成后输出：\n---LOCKED---\n❤️ 恋爱姻缘 · 完整版解锁\n📚 学业事业 · 完整版解锁\n💰 财运 · 完整版解锁\n🕊️ ${isCaution ? '转念化解指引' : '顺势时机'} · 完整版解锁\n🙏 祈愿仪式 · 完整版解锁`;
  } else {
    maxTokens = 8192;
    userPrompt = isEn
      ? `The visitor drew from the omikuji box: ${gradeLabel} — ${gradeEn}\nTheir question / matter: ${topicLabel}\nAdditional context: ${question || '(none)'}\n\nGenerate a COMPLETE omikuji reading (~1500 words):\n1. 🎋 Fortune Level (bilingual, 80 words)\n2. 🌸 Sacred Waka Poem (5-7-5-7-7 Japanese + poetic English + 150-word background reflection)\n3. 🏯 Overall Fortune Reading (${gradeLabel} — 400 words, energy field and approach)\n4. ❤️ Love & Relationships (200 words)\n5. 📚 Study & Career (200 words)\n6. 💰 Wealth (150 words)\n7. 🕊️ ${isCaution ? 'Reframing & Resolution (comfort + gentle direction)' : 'Action Timing & Favorable Directions'} (150 words)\n8. 🙏 Ritual & Prayer Guidance (100 words — specific and practical)\n9. 🎋 Shrine Priest's Closing Whisper (100 words — personal and heartfelt)`
      : `参拜者摇出：${gradeLabel}\n所问之事：${topicLabel}\n补充说明：${question || '（无）'}\n\n请生成完整御神签解读报告（约1500字）：\n1. 🎋 签级神启（日中双语·80字）\n2. 🌸 御神歌（日文五七五七七原文 + 中文诗意译文 + 150字和歌解读）\n3. 🏯 ${gradeLabel} 总运详解（400字·能量场与应对心态）\n4. ❤️ 恋爱姻缘（200字）\n5. 📚 学业事业（200字）\n6. 💰 财运（150字）\n7. 🕊️ ${isCaution ? '转念化解（凶签安抚 + 温和指引·150字）' : '顺势时机与吉方（150字）'}\n8. 🙏 祈愿仪式（100字·具体可行）\n9. 🎋 神职者的耳语（100字·专属叮嘱）`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const reading = await deepseekChat(messages, { maxTokens });
  const ctxId = saveQaContext('jieqian_omikuji', req.body, reading);

  res.json({
    sign: { grade: gradeLabel, gradeEn },
    reading,
    locked:    jqTier === 'free',
    contextId: ctxId,
    meta: {
      system: 'omikuji',
      systemName: '日本御神签',
      verified: true,   // 等级制，无须查库
      tier: jqTier,
    },
  });
}

module.exports = router;
