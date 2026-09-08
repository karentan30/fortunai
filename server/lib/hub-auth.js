'use strict';
// ════════════════════════════════════════════════════════════════════
// hub-auth.js — 增长中台(Lumee hub)身份验证瘦客户端
//
// 中台已有 Google / Apple id_token 验签流（JWKS RS256）。子项目把前端拿到的
// id_token 转发给中台 /hub/auth/google，中台验签后返回可信 {email, google_sub, name}。
// 子项目据此建/登本地用户。签名方案与 pay-hub-client 完全一致：
//   X-Project-Id: <HUB_PROJECT_ID>
//   X-Sign:       HMAC-SHA256(rawBody, HUB_SECRET_<PROJECT_ID>) 小写十六进制
//
// 与 shared/pay-hub-client.js 独立（不改共享文件，避免影响其它项目）。
// ════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const PROJECT_ID = process.env.HUB_PROJECT_ID || 'shenyuan';
const HUB_SECRET = process.env['HUB_SECRET_' + PROJECT_ID.toUpperCase()] || '';
const HUB_BASE   = (process.env.HUB_BASE_URL || 'https://www.mylumee.app').replace(/\/+$/, '');

function sign(rawBody) {
  return crypto.createHmac('sha256', HUB_SECRET).update(
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')
  ).digest('hex');
}

// 是否已配置（缺 HUB_SECRET → 上层优雅降级返回 503，不崩）
function configured() { return !!HUB_SECRET; }

// POST /hub/auth/google { id_token } → { ok, email, google_sub, name }
// 成功返回 { email, googleSub, name }；失败抛 Error（含中台返回的错误文案）。
async function verifyGoogle(idToken) {
  if (!HUB_SECRET) throw new Error('hub 未配置（缺 HUB_SECRET_' + PROJECT_ID.toUpperCase() + '）');
  if (!idToken || typeof idToken !== 'string') throw new Error('缺少 id_token');
  const body = JSON.stringify({ id_token: idToken });
  let res;
  try {
    res = await fetch(HUB_BASE + '/hub/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Id': PROJECT_ID, 'X-Sign': sign(body) },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error('hub 网络错误: ' + e.message);
  }
  let data = {};
  try { data = await res.json(); } catch (_e) { data = {}; }
  if (!res.ok || !data.ok) throw new Error(data.error || ('hub google 验证失败 (' + res.status + ')'));
  return { email: (data.email || '').trim().toLowerCase(), googleSub: data.google_sub || '', name: data.name || '' };
}

module.exports = { verifyGoogle, configured, PROJECT_ID, HUB_BASE };
