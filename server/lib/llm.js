// 善缘 · DeepSeek LLM 封装（无状态，可单独测试）
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });

const DEEPSEEK_API_KEY = process.env.DS_KEY || process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DS_MODEL || 'deepseek-chat';

// 调用 DeepSeek chat completions。返回文本内容。
async function deepseekChat(messages, opts = {}) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = JSON.stringify({
    model: opts.model || DEEPSEEK_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream: false
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
    },
    body,
    signal: AbortSignal.timeout(opts.timeout || 300000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('DeepSeek API ' + res.status + ': ' + err.slice(0, 200));
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return msg?.content || msg?.reasoning_content || '';
}

// 构建 [{role:'system'},{role:'user'}] 标准消息对
function buildReadingPrompt(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

// 流式调用 DeepSeek，返回 Response.body（ReadableStream）
async function deepseekStream(messages, opts = {}) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = JSON.stringify({
    model: opts.model || DEEPSEEK_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream: true
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_API_KEY },
    body,
    signal: AbortSignal.timeout(opts.timeout || 300000)
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('DeepSeek API ' + res.status + ': ' + err.slice(0, 200));
  }
  return res.body;
}

module.exports = { deepseekChat, deepseekStream, buildReadingPrompt, DEEPSEEK_MODEL };
