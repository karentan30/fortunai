'use strict';
/**
 * lib/utils.js — 共享工具函数
 */

const crypto = require('crypto');

// ── 密码工具 ──
function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  var parts = stored.split(':');
  var salt = parts[0];
  var hash = parts[1];
  var check = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === check;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── IP 提取工具 ──
function getClientIp(req) {
  if (req.ip) return String(req.ip).replace('::ffff:', '');
  return (req.connection && req.connection.remoteAddress || '127.0.0.1').replace('::ffff:', '');
}

// ── Token 解析工具 ──
function resolveUserFromToken(token, getToken) {
  if (!token) return null;
  var t = String(token).replace('Bearer ', '');
  var row = getToken.get(t);
  return row ? row.user_id : null;
}

// ── 邮件发送（Resend API，有 key 才发）──
async function sendEmail({ to, subject, html }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('[EMAIL-SKIPPED] No RESEND_API_KEY. Would send to:', to, '|', subject);
    return;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'ShenYuan <noreply@shenyuan.app>', to, subject, html })
    });
    const d = await r.json();
    console.log('[EMAIL]', subject, '→', to, d.id || d.error);
  } catch (e) { console.error('[EMAIL-ERR]', e.message); }
}

// ── 分享 URL 构建 ──
function buildShareUrl(refCode, req) {
  const FRONTEND_URL = process.env.FRONTEND_URL || '';
  var base = FRONTEND_URL || '';
  if ((!base || base.indexOf('localhost') !== -1) && req && req.headers && req.headers.host) {
    var proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    base = proto + '://' + req.headers.host;
  }
  return base + '/pages/invite.html?ref=' + encodeURIComponent(refCode);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  getClientIp,
  resolveUserFromToken,
  sendEmail,
  buildShareUrl,
};
