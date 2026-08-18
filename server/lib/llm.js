// 善缘/Runae · LLM 封装 — 多 provider 自动兜底链
// 主力(付费)失败[含"Insufficient Balance"/超时/限流] → 自动切下一个 → 免费兜底(Groq/Gemini)
// 全部 OpenAI 兼容端点，同一套 fetch 复用。加免费兜底只需往 .env 丢 GROQ_API_KEY 或 GEMINI_API_KEY。
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });

// ── 候选 provider 池（按优先级；无 key 的自动跳过）──
// 顺序默认：付费主力在前(质量/稳定) → 免费兜底在后。可用 LLM_PRIORITY=gemini,groq,deepseek 覆盖。
const ALL_PROVIDERS = {
  deepseek: {
    name: 'deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    key: process.env.DS_KEY || process.env.DEEPSEEK_API_KEY,
    model: process.env.DS_MODEL || 'deepseek-chat'
  },
  qwen: {
    name: 'qwen',
    url: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: process.env.DASHSCOPE_API_KEY,
    model: process.env.QWEN_MODEL || 'qwen-plus'
  },
  groq: { // 免费·很快·llama-3.3-70b（限流严，高峰会429→自动切下一个）
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },
  gemini: { // 免费·gemini-2.0-flash（有每日上限→到顶自动切下一个）
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  }
};

const DEFAULT_ORDER = ['deepseek', 'qwen', 'groq', 'gemini'];
const ORDER = (process.env.LLM_PRIORITY
  ? process.env.LLM_PRIORITY.split(',').map(s => s.trim())
  : DEFAULT_ORDER);

// 实际可用链：按顺序、有 key、去重
function activeProviders() {
  const seen = new Set();
  const list = [];
  for (const name of ORDER) {
    const p = ALL_PROVIDERS[name];
    if (p && p.key && !seen.has(name)) { seen.add(name); list.push(p); }
  }
  return list;
}

const LLM_MODEL = (activeProviders()[0] || {}).model || 'deepseek-chat';

async function _callOne(provider, messages, opts, stream) {
  const body = JSON.stringify({
    model: opts.model || provider.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream
  });
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.key },
    body,
    signal: AbortSignal.timeout(opts.timeout || 300000)
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('[' + provider.name + '] ' + res.status + ': ' + err.slice(0, 160));
  }
  return res;
}

// 非流式：逐 provider 尝试，失败切下一个，全挂才抛
async function deepseekChat(messages, opts = {}) {
  const providers = activeProviders();
  if (!providers.length) throw new Error('无可用 LLM provider（.env 缺 DS_KEY / GROQ_API_KEY / GEMINI_API_KEY）');
  let lastErr;
  for (const p of providers) {
    try {
      const res = await _callOne(p, messages, opts, false);
      const raw = await res.text().catch(() => '');
      if (!raw || raw.trim() === '') throw new Error('[' + p.name + '] 空响应');
      let data;
      try { data = JSON.parse(raw); } catch (e) { throw new Error('[' + p.name + '] 解析失败: ' + raw.slice(0, 80)); }
      const msg = data.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning_content || '';
      if (!content) throw new Error('[' + p.name + '] 无内容');
      if (p !== providers[0]) console.warn('[llm] 主力失败，已兜底到', p.name);
      return content;
    } catch (e) {
      lastErr = e;
      console.warn('[llm] provider 失败，尝试下一个:', e.message);
    }
  }
  throw lastErr || new Error('所有 LLM provider 均失败');
}

// 流式：逐 provider 尝试，返回首个成功的 res.body
async function deepseekStream(messages, opts = {}) {
  const providers = activeProviders();
  if (!providers.length) throw new Error('无可用 LLM provider（.env 缺 DS_KEY / GROQ_API_KEY / GEMINI_API_KEY）');
  let lastErr;
  for (const p of providers) {
    try {
      const res = await _callOne(p, messages, opts, true);
      if (p !== providers[0]) console.warn('[llm] stream 主力失败，已兜底到', p.name);
      return res.body;
    } catch (e) {
      lastErr = e;
      console.warn('[llm] stream provider 失败，尝试下一个:', e.message);
    }
  }
  throw lastErr || new Error('所有 LLM provider 均失败');
}

function buildReadingPrompt(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

module.exports = { deepseekChat, deepseekStream, buildReadingPrompt, DEEPSEEK_MODEL: LLM_MODEL, activeProviders };
