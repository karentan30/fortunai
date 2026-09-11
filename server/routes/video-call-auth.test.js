'use strict';
/**
 * video-call-auth.test.js — 钉住实时通话的鉴权
 *
 * 为什么值得测：/api/video-call/token 签发的是 Agora **发布者**凭证。
 * 改之前它只凭 body 里的 sessionId 就发凭证（extractToken 解析完没人用、
 * getUserIdFromToken 永远 return null），任何拿到 sessionId 的人都能进频道。
 * /end-session（写时长，后续计费）、/session/:id（带双方邮箱）、
 * /recording/:sessionId（录音 URL）同样没有身份判断。
 *
 * 生产上 Agora 尚未配置（所有端点 503），所以这些全是「等开了配置就引爆」的雷，
 * 现在钉住比事后补便宜得多。
 *
 * 运行：node --test server/routes/video-call-auth.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

const vc = require('./video-call');
const { _M } = require('../lib/store');

// 造两个用户 + 一张令牌
_M.users = _M.users || [];
_M.tokens = _M.tokens || [];
_M.users.push({ id: 7001, email: 'owner@example.com' });
_M.users.push({ id: 7002, email: 'stranger@example.com' });
_M.tokens.push({ token: 'tok-owner', user_id: 7001 });
_M.tokens.push({ token: 'tok-stranger', user_id: 7002 });

const SESSION = { id: 'sess-1', userId: 7001, consultantId: 9001, userEmail: 'owner@example.com' };

const reqWith = h => ({ headers: h || {}, body: {} });
const fakeRes = () => ({
  code: 0,
  status(c) { this.code = c; return this; },
  json(o) { this.body = o; return this; },
});

// ── 认出调用者 ────────────────────────────────────────────────────────
test('带真令牌 → 认出用户', () => {
  const c = vc._resolveCaller(reqWith({ authorization: 'Bearer tok-owner' }));
  assert.strictEqual(c.id, 7001);
});

test('🔴 空 Bearer + cookie → 仍能认出用户（前端读不到 httpOnly cookie）', () => {
  const c = vc._resolveCaller(reqWith({ authorization: 'Bearer ', cookie: 'sy_token=tok-owner' }));
  assert.strictEqual(c.id, 7001);
});

test('匿名 → null', () => {
  assert.strictEqual(vc._resolveCaller(reqWith({})), null);
  assert.strictEqual(vc._resolveCaller(reqWith({ authorization: 'Bearer nope' })), null);
});

// ── 谁能碰这个会话 ────────────────────────────────────────────────────
test('当事人（用户本人 / 咨询师）判定', () => {
  assert.strictEqual(vc._isParty(SESSION, { id: 7001 }), true, '用户本人');
  assert.strictEqual(vc._isParty(SESSION, { id: 9001 }), true, '咨询师');
  assert.strictEqual(vc._isParty(SESSION, { id: 7002 }), false, '无关的登录用户');
  assert.strictEqual(vc._isParty(SESSION, null), false, '匿名');
});

test('userId 是数字、caller.id 是数字串时也要认（存储层类型不稳）', () => {
  assert.strictEqual(vc._isParty({ userId: '7001', consultantId: 9001 }, { id: 7001 }), true);
});

// ── 拒绝路径 ──────────────────────────────────────────────────────────
test('匿名访问 → 401，且不泄露会话内容', () => {
  const res = fakeRes();
  assert.strictEqual(vc._denyUnlessParty(reqWith({}), res, SESSION), false);
  assert.strictEqual(res.code, 401);
  assert.ok(JSON.stringify(res.body).indexOf('owner@example.com') === -1, '401 响应不该带用户信息');
});

test('🔴 无关的登录用户 → 403（这是改之前的漏洞：只凭 sessionId 就发凭证）', () => {
  const res = fakeRes();
  const req = reqWith({ authorization: 'Bearer tok-stranger' });
  assert.strictEqual(vc._denyUnlessParty(req, res, SESSION), false);
  assert.strictEqual(res.code, 403);
});

test('当事人放行 → true，不写响应', () => {
  const res = fakeRes();
  const req = reqWith({ authorization: 'Bearer tok-owner' });
  assert.strictEqual(vc._denyUnlessParty(req, res, SESSION), true);
  assert.strictEqual(res.code, 0, '放行时不该设置状态码');
});

test('咨询师放行（同一条会话的另一方）', () => {
  _M.users.push({ id: 9001, email: 'master@example.com' });
  _M.tokens.push({ token: 'tok-consultant', user_id: 9001 });
  const res = fakeRes();
  const req = reqWith({ authorization: 'Bearer tok-consultant' });
  assert.strictEqual(vc._denyUnlessParty(req, res, SESSION), true);
});
