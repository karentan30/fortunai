'use strict';
/**
 * routes/soul-name.js — Runae · Your Name in Any Language / 灵魂之名
 *   POST /api/soul-name   — LLM 生成目标文化地道名字，3 候选 + 含义 + 发音 + 文化注解
 *
 * 定位：语言学习者/expat/旅行者/取网名 实用工具。纯 LLM 任务，无需排盘引擎。
 * 支持语言：Chinese/Japanese/Korean/French/Spanish/Italian/German/Arabic/Russian/
 *           Portuguese/Hindi/Thai/Vietnamese/Hebrew/Turkish/Polish/Dutch/Greek + 自填
 *
 * 红线：娱乐/参考免责 · AI 标识 · 文化尊重不冒犯 · 禁承诺"改名必转运"
 *
 * ⚠️ 本路由未 mount — 挂载行:
 *      app.use('/api', require('./routes/soul-name'));
 */

const router = require('express').Router();
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { getClientIp } = require('../lib/utils');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require: require }); } catch (e) {}

// 简单 IP 级限速，每小时 5 次（纯公用功能无会员体系）
const ipCounts = new Map();
function checkIpRate(ip) {
  const now = Date.now();
  const key = ip + ':' + Math.floor(now / 3600000);
  const n = (ipCounts.get(key) || 0) + 1;
  ipCounts.set(key, n);
  // 清旧 key
  if (ipCounts.size > 5000) { for (const [k] of ipCounts) { if (!k.endsWith(String(Math.floor(now / 3600000)))) ipCounts.delete(k); if (ipCounts.size < 2000) break; } }
  return n <= 10;
}

const SUPPORTED_LANGUAGES = [
  'Chinese','Japanese','Korean','French','Spanish','Italian',
  'German','Arabic','Russian','Portuguese','Hindi','Thai',
  'Vietnamese','Hebrew','Turkish','Polish','Dutch','Greek'
];

const HONESTY_FOOTER = '\n\n[Runae note, always include this line in italics at the very end: "AI-generated for reference and inspiration — names carry meaning, but your story writes itself."]';

// ══════════════════════════════════════════════════════════════════
// POST /api/soul-name
//   body: {
//     originalName: string,       // 用户原名（必填）
//     gender: 'female'|'male'|'neutral',
//     targetLanguage: string,     // 目标语言，可自填
//     personality?: string,       // 一句性格/气质描述（可选）
//     birthYear?: number,
//     birthMonth?: number,
//     birthDay?: number,
//   }
// ══════════════════════════════════════════════════════════════════
router.post('/soul-name', rateLimitMiddleware, async (req, res) => {
  try {
    const ip = getClientIp(req);
    if (!checkIpRate(ip)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

    const body = req.body || {};
    const originalName = String(body.originalName || '').slice(0, 80).trim();
    if (!originalName) return res.status(400).json({ error: 'Please enter your name.' });

    const gender = ['female', 'male', 'neutral'].includes(body.gender) ? body.gender : 'neutral';
    let targetLanguage = String(body.targetLanguage || '').trim().slice(0, 60);
    if (!targetLanguage) return res.status(400).json({ error: 'Please select a target language.' });

    // 白名单外语言仍允许，只截断长度
    const personality = String(body.personality || '').slice(0, 200).trim();
    const birthYear = parseInt(body.birthYear) || null;
    const birthMonth = parseInt(body.birthMonth) || null;
    const birthDay = parseInt(body.birthDay) || null;
    const hasBirth = birthYear && birthMonth && birthDay;

    // 组装 birth 信息给 LLM（可选）
    const birthBlock = hasBirth
      ? `Birth date: ${birthYear}-${String(birthMonth).padStart(2,'0')}-${String(birthDay).padStart(2,'0')} (use this to add culturally appropriate auspicious meaning or elemental nuance if relevant to the target culture, but keep it light — the name must work on its own without knowing the birth date).`
      : 'No birth date provided.';

    const personalityBlock = personality
      ? `Personality / desired vibe: "${personality}"`
      : 'No personality note provided — choose something broadly appealing and meaningful.';

    const systemPrompt =
      `You are Rún, a multilingual cultural naming consultant for Runae. Your job is to give people beautiful, authentic names in cultures that resonate with them — for language learners, travelers, expats, and global citizens.\n\n` +
      `Rules you MUST follow:\n` +
      `1. Always generate EXACTLY 3 candidate names in the target language/culture. Number them 1, 2, 3.\n` +
      `2. For each name provide:\n` +
      `   • The name in its native script (if applicable) AND romanized/pronunciation guide\n` +
      `   • Literal meaning of each component\n` +
      `   • Why it fits this person (connect to their personality/vibe and optionally birth elements)\n` +
      `   • A one-line cultural background note (naming customs, era, feel)\n` +
      `3. Names must be genuinely native — NOT literal translations of the original name unless it happens to be beautiful. Choose names a real person from that culture would actually bear.\n` +
      `4. Respect cultural norms: no offensive words, no names that would feel jarring to native speakers.\n` +
      `5. Gender: honor the stated gender using the naming conventions of the target culture.\n` +
      `6. Tone: warm, poetic but practical — like a knowledgeable friend, not a textbook.\n` +
      `7. Do NOT make fortune-telling promises ("this name will bring luck"). Cultural meaning is fine; fate-claims are not.\n` +
      `8. Respond in English (with native script inline for non-Latin languages).\n` +
      HONESTY_FOOTER;

    const userPrompt =
      `Original name: ${originalName}\n` +
      `Gender: ${gender}\n` +
      `Target language/culture: ${targetLanguage}\n` +
      `${personalityBlock}\n` +
      `${birthBlock}\n\n` +
      `Please generate 3 authentic, meaningful name candidates in ${targetLanguage} for this person.`;

    const messages = buildReadingPrompt(systemPrompt, userPrompt);
    const reading = await deepseekChat(messages, { maxTokens: 1800 });

    if (mon) try { mon.track('soul_name', { ip, targetLanguage }); } catch (e) {}

    res.json({
      reading,
      meta: { originalName, targetLanguage, gender }
    });
  } catch (err) {
    console.error('[soul-name] error:', err);
    res.status(500).json({ error: 'AI temporarily unavailable. Please try again.' });
  }
});

module.exports = router;
