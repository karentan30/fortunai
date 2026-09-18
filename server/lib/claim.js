'use strict';
/**
 * lib/claim.js — W1「先付款，邮箱自动建号」+ 邮箱登录链接
 *
 * 安全口径（0918 专家审出的洞，逐条对应）：
 *  - 自动登录只给「本次付款新建的号」+「同一浏览器（claim cookie 哈希对得上）」+「每单一次」。
 *    用别人的邮箱付款 ≠ 登进别人的号。
 *  - 已存在的「未验证 + 有密码」号 = 可能是别人抢注的 → 订单先挂起（pending_email），
 *    邮箱主人点登录链接验证后才挂上；验证时清掉抢注密码、踢掉旧会话。
 *  - 登录链接：只存哈希、30 分钟、单次；GET 只出确认页（邮件扫描器会预取 GET），POST 才消费。
 *  - 所有跳转只许站内（白名单源 + 以 / 开头且非 // 的路径）。
 *  - claimOrder 全同步、幂等：webhook 与回跳页谁先到都一样。
 */

const crypto = require('crypto');
const S = require('./store');

const SITE_ORIGINS = ['https://runae.app', 'https://www.runae.app', 'https://runae.net', 'https://www.runae.net',
  'https://shenyuan.mylumee.cn'].concat(String(process.env.EXTRA_SITE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
const DEFAULT_ORIGIN = process.env.FRONTEND_URL || 'https://runae.app';
const MAGIC_TTL_MS = 30 * 60 * 1000;
const READY_TTL_MS = 7 * 864e5;   // 「报告已就绪」邮件可能隔几天才点
const AUTOLOGIN_TTL_MS = 30 * 864e5;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = (n) => crypto.randomBytes(n || 24).toString('hex');

function isSiteOrigin(o) {
  if (!o) return false;
  if (SITE_ORIGINS.indexOf(o) >= 0) return true;
  return process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
}

// 把前端给的地址收窄成「白名单源 + 站内路径」。不合规一律退回默认。
function safeReturn(raw, fallbackPath) {
  const fb = { origin: DEFAULT_ORIGIN, path: fallbackPath || '/' };
  if (!raw) return fb;
  let u;
  try { u = new URL(String(raw), DEFAULT_ORIGIN); } catch (e) { return fb; }
  if (!isSiteOrigin(u.origin)) return fb;
  if (!u.pathname.startsWith('/') || u.pathname.startsWith('//') || u.pathname.startsWith('/\\')) return { origin: u.origin, path: fb.path };
  u.searchParams.delete('session_id');
  return { origin: u.origin, path: u.pathname + u.search + u.hash };
}

function langOf(origin, hint) {
  if (hint === 'zh' || hint === 'en') return hint;
  return /mylumee\.cn/.test(origin || '') ? 'zh' : 'en';
}

function _createPasswordlessUser(email, orderNo) {
  const r = S.insertUser.run(email, '');
  const u = S._M.users.find(x => x.id === r.lastInsertRowid);
  u.email_verified = false;
  if (orderNo) u.created_via_order = orderNo;
  S._persist();
  return u;
}

/**
 * 把一张已付订单挂到邮箱对应的账号上。
 * @returns {{status:'already'|'created'|'attached'|'held'|'no_email', userId:number|null}}
 */
function claimOrder(order, rawEmail) {
  if (!order) return { status: 'no_email', userId: null };
  if (order.user_id != null) return { status: 'already', userId: order.user_id };
  const email = S.normEmail(rawEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'no_email', userId: null };
  order.pay_email = email;
  let u = S.getUserByEmail.get(email);
  let status;
  if (!u) {
    u = _createPasswordlessUser(email, order.order_no);
    status = 'created';
  } else if (u.password_hash && !u.email_verified) {
    // 可能是抢注号：先挂起，邮箱主人点登录链接后再挂
    order.pending_email = email;
    S._persist();
    return { status: 'held', userId: null };
  } else {
    status = 'attached';
  }
  order.user_id = u.id;
  delete order.pending_email;
  S._persist();
  return { status, userId: u.id };
}

function _eqHash(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// 回跳时能否直接登录：三条同时成立，且每单只用一次
function tryAutoLogin(order, claimSecret) {
  if (!order || order.user_id == null || order.autologin_used) return null;
  if (!claimSecret || !_eqHash(order.claim_hash || '', sha(claimSecret))) return null;
  const u = S._M.users.find(x => x.id === order.user_id);
  if (!u || u.created_via_order !== order.order_no) return null;
  order.autologin_used = true;
  const token = rand(32);
  S.insertToken.run(u.id, token, AUTOLOGIN_TTL_MS);
  S._persist();
  return token;
}

// ── 登录链接 ──
const _ipHits = new Map();
function _ipAllow(ip) {
  const now = Date.now();
  const arr = (_ipHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (arr.length >= 10) { _ipHits.set(ip, arr); return false; }
  arr.push(now); _ipHits.set(ip, arr);
  return true;
}

// 返回明文令牌；被限流返回 null（调用方仍对外回 200，不泄露任何信息）
function createMagicToken(rawEmail, redirectPath, ip, ttlMs) {
  const email = S.normEmail(rawEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const now = Date.now();
  S._M.magicLinks = (S._M.magicLinks || []).filter(m => now - Date.parse(m.created_at) < 864e5);
  const recent = S._M.magicLinks.filter(m => m.email === email && now - Date.parse(m.created_at) < 3600e3).length;
  if (recent >= 3) return null;
  if (ip !== undefined && !_ipAllow(ip)) return null;
  const token = rand(24);
  S._M.magicLinks.push({ hash: sha(token), email, redirect: redirectPath || '/', created_at: new Date(now).toISOString(),
    expires_at: new Date(now + (ttlMs || MAGIC_TTL_MS)).toISOString(), used: false });
  S._persist();
  return token;
}

// 消费登录链接：成功返回 { user, redirect, token }（token = 新会话）
function consumeMagicToken(token) {
  if (!token || typeof token !== 'string') return null;
  const h = sha(token);
  const m = (S._M.magicLinks || []).find(x => x.hash === h);
  if (!m || m.used || Date.parse(m.expires_at) < Date.now()) return null;
  m.used = true;
  let u = S.getUserByEmail.get(m.email);
  if (!u) u = _createPasswordlessUser(m.email, null);
  if (!u.email_verified) {
    if (u.password_hash) {
      // 首次证明邮箱归属：抢注的密码作废，旧会话全踢
      u.password_hash = '';
      S._M.tokens = S._M.tokens.filter(t => t.user_id !== u.id);
    }
    u.email_verified = true;
  }
  // 挂上因「待验证」而挂起的订单
  S._M.orders.forEach(o => { if (o.user_id == null && o.pending_email === m.email) { o.user_id = u.id; delete o.pending_email; } });
  const session = rand(32);
  S.insertToken.run(u.id, session);
  S._persist();
  return { user: u, redirect: m.redirect, token: session };
}

// ── 邮件 ──
async function _send(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[CLAIM-EMAIL-SKIPPED] no RESEND_API_KEY:', subject); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Runae <noreply@shenyuan.mylumee.cn>', to, subject, html }),
    });
    return r.ok;
  } catch (e) { console.error('[CLAIM-EMAIL-ERR]', e.message); return false; }
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function _mail(lang, kind, link) {
  const T = {
    en: {
      ready: ['Your Runae reading is ready', 'Thanks for your purchase. Your full reading is unlocked and saved to your account.', 'Open my reading'],
      login: ['Your Runae sign-in link', 'Tap the button below to sign in. No password needed.', 'Sign in'],
      foot: 'This link works once and expires in 30 minutes. If you didn\'t request it, you can ignore this email.',
      footReady: 'This sign-in link works once and expires in 7 days. You can always get a new one from the sign-in page.',
    },
    zh: {
      ready: ['你的报告已就绪', '感谢购买，完整报告已解锁，并保存在你的账户里。', '打开我的报告'],
      login: ['你的登录链接', '点下面的按钮即可登录，不需要密码。', '登录'],
      foot: '此链接仅可使用一次，30 分钟内有效。如果不是你本人操作，忽略本邮件即可。',
      footReady: '此登录链接仅可使用一次，7 天内有效；过期可在登录页重新获取。',
    },
  }[lang === 'zh' ? 'zh' : 'en'];
  const [subject, body, cta] = T[kind];
  const html = '<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">'
    + '<h2 style="font-weight:600">' + esc(subject) + '</h2><p>' + esc(body) + '</p>'
    + '<p><a href="' + esc(link) + '" style="display:inline-block;background:#1f1a14;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">' + esc(cta) + '</a></p>'
    + '<p style="color:#888;font-size:12px">' + esc(kind === 'ready' ? T.footReady : T.foot) + '</p></div>';
  return { subject, html };
}

function magicUrl(origin, token) { return (isSiteOrigin(origin) ? origin : DEFAULT_ORIGIN) + '/api/auth/magic?t=' + token; }

async function sendMagicEmail(email, token, origin, lang, kind) {
  const m = _mail(lang, kind || 'login', magicUrl(origin, token));
  return _send(S.normEmail(email), m.subject, m.html);
}

module.exports = { SITE_ORIGINS, isSiteOrigin, safeReturn, langOf, sha, rand, claimOrder, tryAutoLogin,
  createMagicToken, consumeMagicToken, sendMagicEmail, magicUrl, AUTOLOGIN_TTL_MS, READY_TTL_MS };
