// 善缘 · LLM 封装 — 支持 Qwen(DashScope) / DeepSeek 自动切换
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });

// Qwen 优先，没有则降级 DeepSeek
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const DEEPSEEK_KEY  = process.env.DS_KEY || process.env.DEEPSEEK_API_KEY;
const USE_QWEN = !!DASHSCOPE_KEY;

const LLM_KEY   = USE_QWEN ? DASHSCOPE_KEY : DEEPSEEK_KEY;
const LLM_URL   = USE_QWEN
  ? 'https://dashscope-vpc.aliyuncs.com/compatible-mode/v1/chat/completions'
  : 'https://api.deepseek.com/v1/chat/completions';
const LLM_MODEL = USE_QWEN
  ? (process.env.QWEN_MODEL || 'qwen-plus')
  : (process.env.DS_MODEL   || 'deepseek-chat');

async function deepseekChat(messages, opts = {}) {
  const body = JSON.stringify({
    model: opts.model || LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream: false
  });

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LLM_KEY },
    body,
    signal: AbortSignal.timeout(opts.timeout || 300000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('LLM API ' + res.status + ': ' + err.slice(0, 200));
  }

  const raw = await res.text().catch(() => '');
  if (!raw || raw.trim() === '') throw new Error('LLM API 返回空响应，请重试');

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    throw new Error('LLM API 响应解析失败: ' + raw.slice(0, 100));
  }
  const msg = data.choices?.[0]?.message;
  return msg?.content || msg?.reasoning_content || '';
}

function buildReadingPrompt(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

async function deepseekStream(messages, opts = {}) {
  const body = JSON.stringify({
    model: opts.model || LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream: true
  });
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LLM_KEY },
    body,
    signal: AbortSignal.timeout(opts.timeout || 300000)
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('LLM API ' + res.status + ': ' + err.slice(0, 200));
  }
  return res.body;
}

module.exports = { deepseekChat, deepseekStream, buildReadingPrompt, DEEPSEEK_MODEL: LLM_MODEL };
