'use strict';
/**
 * routes/western-astrology.js — Runae · Western Astrology
 *   POST /api/western-astrology   — real engine chart → streaming AI interpretation
 *
 * Architecture: CODE calculates all planetary positions (celestine/VSOP87).
 *   LLM receives pre-computed chart data and ONLY interprets — never invents positions.
 *
 * Supports en/ko/zh language branches.
 * Streaming response (SSE-style ndjson: each chunk is a data: line).
 *
 * Compliance:
 *   - "Western/modern astrology" only — never "Chinese"
 *   - AI identifier on every reading
 *   - Entertainment/self-exploration disclaimer
 *   - Anti-fatalism: free will, potential, not destiny
 *   - Age gate: enforced client-side (14+) + server note in response
 *
 * ⚠️ Mount in server/index.js:
 *      app.use('/api', require('./routes/western-astrology'));
 */

const router = require('express').Router();
const { deepseekStream, deepseekChat, buildReadingPrompt } = require('../lib/llm');
const { buildWesternBlock } = require('../lib/western-astro-engine/prompt-block');
const { computeWesternChart } = require('../lib/western-astro-engine/index');
const { rateLimitMiddleware } = require('../middleware');

let mon = null;
try {
  mon = require(process.env.MONITORING_PATH ||
    require('path').join(__dirname, '../../../shared/monitoring.js'))({ project: 'shenyuan', require });
} catch (_) {}

// ═══════════════════════════════════════════════════════════════
// Honesty / compliance system prompt blocks — per language
// ═══════════════════════════════════════════════════════════════
const HONESTY_EN = `
WHO YOU ARE: You are Rún, the Western astrology voice of Runae. You are an AI astrology interpreter. Being transparent about that is part of your integrity.

CHART DATA: The planetary positions below were computed by a real astronomical engine (tropical zodiac / VSOP87). You MUST use ONLY these positions. DO NOT invent, guess, or change any planetary data.

COVER: Sun sign personality and core nature · Moon sign emotional world · Rising sign (Ascendant) first impression and social mask (only if provided) · key planetary aspects and what tensions or gifts they create.

TONE: Modern, psychological, self-discovery framing. Warm but grounded. Like a thoughtful therapist who knows astrology, not a fortune-teller.

ANTI-FATALISM: Emphasize free will and potential. Planetary positions describe tendencies and weather, NOT fixed destiny. Never say someone WILL do or experience any specific thing. Close with something that hands agency back to them.

DISCLAIMERS (weave in naturally, not as a cold block):
- "For entertainment and self-exploration. Not predictive."
- AI-generated reading identifier.
- Age note: content is suitable for readers 14+.

LENGTH: 380-480 words. Flowing prose, short paragraphs. Use their name if provided.
`.trim();

const HONESTY_ZH = `
你是谁：你是Runae的西方占星解读者Rún，一个AI占星师。诚实表明你是AI是你诚信的一部分。

图表数据：以下行星位置由真实天文引擎（回归黄道/VSOP87）计算得出。你必须仅使用这些位置，禁止自行推算、猜测或修改任何行星数据。

解读内容：太阳星座的核心性格 · 月亮星座的情感世界 · 上升星座的第一印象与社会面具（如有数据）· 主要行星相位及其带来的张力或天赋。

语气：现代、心理学视角、自我探索框架。温暖而有根基，像一位懂占星的细心治疗师，不是算命先生。

反宿命论：强调自由意志与潜力。行星位置描述倾向和气候，而非固定命运。绝不说某人"一定会"经历某事。用赋权的方式结尾。

免责声明（自然融入，非冷冰冰的段落）：
- "仅供娱乐与自我探索，不作预测性建议。"
- AI生成的解读标识。
- 内容适合14岁以上读者。

长度：380-480字。流畅散文，短段落。如有姓名请使用。
`.trim();

const HONESTY_KO = `
당신은 누구인가: 당신은 Runae의 서양 점성술 해석자 Rún, AI 점성술사입니다. AI임을 솔직히 밝히는 것이 당신의 성실성의 일부입니다.

차트 데이터: 아래 행성 위치는 실제 천문 엔진(열대 황도대/VSOP87)으로 계산되었습니다. 반드시 이 데이터만 사용하세요. 행성 데이터를 임의로 추정하거나 변경하지 마세요.

해석 내용: 태양 별자리 성격 · 달 별자리 감정 세계 · 상승궁(어센던트) 첫인상과 사회적 페르소나(데이터 있을 경우) · 주요 행성 배치와 그것이 만드는 긴장 또는 선물.

어조: 현대적, 심리학적, 자기 탐구 프레임. 따뜻하지만 근거 있는. 점성술을 아는 사려 깊은 상담사처럼, 점쟁이가 아닌.

반운명론: 자유의지와 잠재력을 강조하세요. 행성 위치는 경향과 날씨를 묘사하지 고정된 운명이 아닙니다. 어떤 특정 일이 "반드시" 일어난다고 말하지 마세요. 주도권을 돌려주는 방식으로 마무리하세요.

면책 조항(자연스럽게 녹여서, 차가운 단락이 아닌): 오락 및 자기탐구 목적. 예측이 아닙니다. AI 생성 리딩 표시. 14세 이상 독자에 적합한 콘텐츠.

길이: 380-480자. 유연한 산문, 짧은 단락. 이름이 있으면 사용하세요.
`.trim();

// ═══════════════════════════════════════════════════════════════
// Parse request body
// ═══════════════════════════════════════════════════════════════
function parseInput(body) {
  if (!body) return null;
  let { birthYear, birthMonth, birthDay, birthHour, birthMinute,
        lat, lng, tz, lang, name } = body;

  // Support legacy field names
  birthYear  = birthYear  || body.year;
  birthMonth = birthMonth || body.month;
  birthDay   = birthDay   || body.day;

  const year  = birthYear  ? +birthYear  : null;
  const month = birthMonth ? +birthMonth : null;
  const day   = birthDay   ? +birthDay   : null;

  if (!year || !month || !day) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  return {
    year, month, day,
    hour:   birthHour   !== undefined && birthHour   !== '' ? +birthHour   : null,
    minute: birthMinute !== undefined && birthMinute !== '' ? +birthMinute : 0,
    lat:    lat  !== undefined && lat  !== '' ? +lat  : null,
    lng:    lng  !== undefined && lng  !== '' ? +lng  : null,
    tz:     tz   !== undefined && tz   !== '' ? +tz   : null,
    lang:   ['en','ko','zh'].includes(lang) ? lang : 'en',
    name:   name ? String(name).trim().slice(0, 60) : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Build LLM messages per language
// ═══════════════════════════════════════════════════════════════
function buildMessages(input, chartBlock) {
  const nameStr = input.name ? ` for ${input.name}` : '';

  const systemMap = { en: HONESTY_EN, zh: HONESTY_ZH, ko: HONESTY_KO };
  const system = systemMap[input.lang] || HONESTY_EN;

  const userEN = `Please interpret the following Western astrology birth chart${nameStr}.\n\n${chartBlock}\n\nGive a warm, modern, psychologically grounded reading in English.`;
  const userZH = `请解读以下西方占星出生盘${nameStr}。\n\n${chartBlock}\n\n请用中文给出温暖、现代、心理学视角的解读。`;
  const userKO = `다음 서양 점성술 출생 차트${nameStr}를 해석해 주세요.\n\n${chartBlock}\n\n한국어로 따뜻하고 현대적이며 심리학적 관점의 해석을 해주세요.`;

  const userMap = { en: userEN, zh: userZH, ko: userKO };
  const user = userMap[input.lang] || userEN;

  return buildReadingPrompt(system, user);
}

// ═══════════════════════════════════════════════════════════════
// POST /api/western-astrology
// ═══════════════════════════════════════════════════════════════
router.post('/western-astrology', rateLimitMiddleware, async (req, res) => {
  try {
    const input = parseInput(req.body);
    if (!input) {
      return res.status(400).json({ error: 'Please provide a valid birth date (year, month, day).' });
    }

    // Compute chart data (real engine — no LLM involvement here)
    let chart;
    try {
      chart = computeWesternChart({
        year: input.year, month: input.month, day: input.day,
        hour: input.hour, minute: input.minute,
        latitude: input.lat, longitude: input.lng, timezone: input.tz,
      });
    } catch (engineErr) {
      console.error('[WESTERN-ASTROLOGY ENGINE ERR]', engineErr.message);
      return res.status(500).json({ error: 'Chart calculation failed — please check your input and try again.' });
    }

    const chartBlock = buildWesternBlock({
      birthYear: input.year, birthMonth: input.month, birthDay: input.day,
      birthHour: input.hour, birthMinute: input.minute,
      lat: input.lat, lng: input.lng, tz: input.tz,
    });

    const messages = buildMessages(input, chartBlock);

    // Return chart data immediately + stream AI reading
    // Use streaming response: send chart JSON first, then stream text
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    // First event: structured chart data for the frontend
    res.write(`data: ${JSON.stringify({ type: 'chart', chart })}\n\n`);

    // Stream AI reading
    let body;
    try {
      body = await deepseekStream(messages, { maxTokens: 1800 });
    } catch (streamErr) {
      // Fallback to non-streaming
      console.warn('[WESTERN-ASTROLOGY] stream failed, using deepseekChat fallback:', streamErr.message);
      try {
        const reading = await deepseekChat(messages, { maxTokens: 1800 });
        res.write(`data: ${JSON.stringify({ type: 'text', text: reading })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (chatErr) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Reading generation failed.' })}\n\n`);
        res.end();
      }
      return;
    }

    // Forward SSE stream from LLM provider
    const { Readable } = require('stream');
    const readable = Readable.fromWeb ? Readable.fromWeb(body) : body;
    let buffer = '';
    readable.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
        } catch (_) {}
      }
    });
    readable.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });
    readable.on('error', err => {
      console.error('[WESTERN-ASTROLOGY STREAM ERR]', err.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream error.' })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error('[WESTERN-ASTROLOGY ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'western-astrology' } });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chart reading unavailable — please try again in a moment.' });
    } else {
      try { res.write(`data: ${JSON.stringify({ type: 'error', error: 'Reading error.' })}\n\n`); res.end(); } catch (_) {}
    }
  }
});

module.exports = router;
