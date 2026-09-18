'use strict';
/**
 * routes/auth.js — 用户认证 & 邀请裂变
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 * GET  /api/referral/mine
 * POST /api/referral/claim
 * GET  /api/orders/mine
 */

const router = require('express').Router();
const {
  insertUser, getUserByEmail, getUserById, getToken, insertToken, getUserOrders,
  getUserByGoogleSub, findOrCreateGoogleUser,
  UNLOCK_BY_CATEGORY, _isExpired,
  tryApplyReferral, wasInvited, getUserByRefCode, createReferral, grantReferralReward, invitedCount,
} = require('../lib/store');
const { hashPassword, verifyPassword, generateToken, buildShareUrl } = require('../lib/utils');
const hubAuth = require('../lib/hub-auth');
const { simpleRateLimitMiddleware, authMiddleware } = require('../middleware');

// POST /api/auth/register
router.post('/register', simpleRateLimitMiddleware, (req, res) => {
  try {
    const { password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: '请提供邮箱和密码' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    const existing = getUserByEmail.get(email);
    if (existing) return res.status(409).json({ error: '该邮箱已注册' });

    const hash = hashPassword(password);
    const result = insertUser.run(email, hash);
    const token = generateToken();
    insertToken.run(result.lastInsertRowid, token);

    const ref = req.body.ref || req.query.ref;
    tryApplyReferral(ref, result.lastInsertRowid);

    const newUser = getUserById.get(result.lastInsertRowid);
    // SECURITY FIX: Redact email in logs (PII protection)
    const emailHash = require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 8);
    console.log(`[AUTH] Register: ${emailHash}${ref ? ' (ref:' + ref + ')' : ''}`);
    // SECURITY FIX: Return token in httpOnly cookie instead of JSON response
    // Client should NOT store tokens in localStorage
    res.cookie('sy_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
    });
    res.json({ user: { id: result.lastInsertRowid, email }, ref_code: newUser.ref_code });
  } catch (err) {
    console.error('[AUTH ERR]', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
router.post('/login', simpleRateLimitMiddleware, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请提供邮箱和密码' });

    const user = getUserByEmail.get(email);   // 大小写不敏感
    if (!user) return res.status(401).json({ error: '邮箱或密码错误' });
    if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: '邮箱或密码错误' });

    const token = generateToken();
    insertToken.run(user.id, token);

    // SECURITY FIX: Redact email in logs (PII protection)
    const emailHash = require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 8);
    console.log(`[AUTH] Login: ${emailHash}`);
    // SECURITY FIX: Return token in httpOnly cookie
    res.cookie('sy_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name, ref_code: user.ref_code } });
  } catch (err) {
    console.error('[AUTH ERR]', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// POST /api/auth/google
// body: { id_token | credential, ref? } — 前端(Google Identity Services)拿到的 id_token。
// 流程：转发中台 /hub/auth/google 验签 → 拿 {email, google_sub, name} → 找/建本地用户 → 发 sy_token cookie。
// 前端登录按钮由前端会话另做，这里只提供后端端点。
router.post('/google', simpleRateLimitMiddleware, async (req, res) => {
  try {
    if (!hubAuth.configured()) return res.status(503).json({ error: 'Google 登录暂未开通' });
    const idToken = (req.body && (req.body.id_token || req.body.credential || '')).toString().trim();
    if (!idToken) return res.status(400).json({ error: '缺少 Google 凭证' });

    // 中台验签（JWKS RS256 + iss/aud/exp/email_verified 全在中台做）
    let identity;
    try {
      identity = await hubAuth.verifyGoogle(idToken);
    } catch (e) {
      console.warn('[AUTH/google] hub 验证失败:', e.message);
      return res.status(401).json({ error: 'Google 验证失败，请重试' });
    }
    if (!identity.email || !identity.googleSub) {
      return res.status(401).json({ error: 'Google 账号缺少可用邮箱' });
    }

    // 是否新用户（决定是否记裂变归因）：google_sub 或 email 命中即为老用户
    const preexisting = getUserByGoogleSub.get(identity.googleSub) || getUserByEmail.get(identity.email);
    const isNew = !preexisting;

    const user = findOrCreateGoogleUser({ email: identity.email, googleSub: identity.googleSub, name: identity.name });

    if (isNew) {
      const ref = (req.body && req.body.ref) || req.query.ref;
      try { tryApplyReferral(ref, user.id); } catch (_e) {}
    }

    const token = generateToken();
    insertToken.run(user.id, token);

    const emailHash = require('crypto').createHash('sha256').update(identity.email).digest('hex').slice(0, 8);
    console.log(`[AUTH] Google ${isNew ? 'signup' : 'login'}: ${emailHash}`);

    res.cookie('sy_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name, ref_code: user.ref_code }, isNew });
  } catch (err) {
    console.error('[AUTH ERR]', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '未登录' });
  const u = getUserById.get(req.user.id);
  const orders = getUserOrders.all(req.user.id) || [];
  const memberOrder = orders.find(function(o) {
    return UNLOCK_BY_CATEGORY['member'].indexOf(String(o.product || '')) >= 0 && !_isExpired(o);
  });
  const isMember = !!memberOrder;
  res.json({
    user: { ...req.user, ref_code: u ? u.ref_code : null },
    membership: { isMember: isMember, expiresAt: memberOrder && memberOrder.expires_at ? memberOrder.expires_at : null }
  });
});


// ── 邮箱登录链接（0918·W1）──────────────────────────────
// POST /api/auth/magic-link {email, redirect}  永远回 200，不泄露邮箱有没有注册
// GET  /api/auth/magic?t=                       只出确认页（邮件扫描器会预取 GET，不能在 GET 里消费）
// POST /api/auth/magic  t=                       消费令牌 → 设 cookie → 303 回站内
const claim = require('../lib/claim');
const { logEvent } = require('./events');

router.post('/magic-link', simpleRateLimitMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const origin = claim.isSiteOrigin(req.headers.origin) ? req.headers.origin : undefined;
    const ret = claim.safeReturn(b.redirect ? new URL(String(b.redirect), origin || 'https://runae.app').href : '', '/pages/account.html');
    const tok = claim.createMagicToken(b.email, ret.path, req.ip);
    if (tok) {
      await claim.sendMagicEmail(b.email, tok, origin || ret.origin, claim.langOf(origin || ret.origin, b.lang), 'login');
      logEvent({ e: 'magic_sent', lang: b.lang || '' });
    }
  } catch (e) { console.error('[AUTH magic-link]', e.message); }
  res.json({ ok: true });
});

const _MAGIC_PAGE = (lang, t, state) => {
  const zh = lang === 'zh';
  const title = zh ? '登录' : 'Sign in';
  const msg = state === 'bad'
    ? (zh ? '这个链接已失效或已被使用。回到登录页重新获取一个即可。' : 'This link has expired or was already used. Request a new one from the sign-in page.')
    : (zh ? '点下面的按钮完成登录。' : 'Tap the button below to finish signing in.');
  const body = state === 'bad'
    ? '<a class="b" href="/pages/login.html">' + (zh ? '去登录页' : 'Go to sign-in') + '</a>'
    : '<form method="POST" action="/api/auth/magic"><input type="hidden" name="t" value="' + String(t).replace(/[^a-f0-9]/g, '') + '"><button class="b" type="submit">' + (zh ? '登录并打开' : 'Sign in & continue') + '</button></form>';
  return '<!DOCTYPE html><html lang="' + (zh ? 'zh' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + title + '</title>'
    + '<style>body{font-family:-apple-system,system-ui,sans-serif;background:#faf7f2;color:#222;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}'
    + '.c{max-width:360px;text-align:center}.b{display:inline-block;background:#1f1a14;color:#fff;border:0;border-radius:10px;padding:14px 26px;font-size:16px;text-decoration:none;cursor:pointer}</style></head>'
    + '<body><div class="c"><h2 style="font-weight:600">Runae</h2><p>' + msg + '</p>' + body + '</div></body></html>';
};

router.get('/magic', (req, res) => {
  const lang = /mylumee\.cn/.test(req.headers.host || '') ? 'zh' : 'en';
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
  res.send(_MAGIC_PAGE(lang, String(req.query.t || ''), req.query.t ? 'ok' : 'bad'));
});

router.post('/magic', require('express').urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
  const lang = /mylumee\.cn/.test(req.headers.host || '') ? 'zh' : 'en';
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
  // 防登录 CSRF：别的网站不能替用户提交一个攻击者的令牌
  if (req.headers.origin && !claim.isSiteOrigin(req.headers.origin)) return res.status(403).send(_MAGIC_PAGE(lang, '', 'bad'));
  const r = claim.consumeMagicToken(String((req.body && req.body.t) || ''));
  if (!r) return res.status(400).send(_MAGIC_PAGE(lang, '', 'bad'));
  res.cookie('sy_token', r.token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  logEvent({ e: 'magic_ok', lang });
  res.redirect(303, r.redirect && r.redirect.startsWith('/') && !r.redirect.startsWith('//') ? r.redirect : '/pages/account.html');
});

module.exports = router;
