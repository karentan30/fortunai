'use strict';
/**
 * guest-checkout.test.js — W1「先付款，邮箱自动建号」的安全回归（0918）
 *
 * 钉住：
 *  ① 游客能直接进 Stripe（不再 401），拿到只作用于 /api/checkout 的 claim cookie
 *  ② 回跳：同浏览器 + 新建号 → 自动登录；每单只一次；换浏览器不登录
 *  ③ 用别人（已验证）的邮箱付款 → 订单挂过去，但**绝不**登进那个号
 *  ④ 抢注号（有密码未验证）→ 订单挂起；邮箱主人点登录链接后才挂上，并清掉抢注密码/会话
 *  ⑤ 跳转只许站内；session_id 对不上/未付款不建号
 *  ⑥ 登录链接：GET 不消费、单次、过期、防 CSRF、限流
 *  ⑦ webhook 与回跳幂等：不重复建号
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-guest-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
process.env.STRIPE_PAY_SECRET_KEY = 'sk_test_stub';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stub';
delete process.env.RESEND_API_KEY;   // 绝不真发邮件

const HUB_STUB = path.join(TMP, 'hub-stub.js');
fs.writeFileSync(HUB_STUB, 'module.exports = { HUB_SECRET: "", create: async () => { throw new Error("stub"); }, subCreate: async () => { throw new Error("stub"); }, HUB_SUB_PLAN_MAP: {}, _M: null };\n');
process.env.HUB_CLIENT_PATH = HUB_STUB;

// Stripe 桩：记录建单参数；retrieve 读 global.__SESS；webhook 直接把 body 当事件
const STRIPE_STUB = path.join(TMP, 'stripe-stub.js');
fs.writeFileSync(STRIPE_STUB, `
let n = 0;
global.__SESS = {}; global.__CREATED = [];
module.exports = {
  checkout: { sessions: {
    create: async (a) => { const id = 'cs_test_' + (++n); global.__CREATED.push(Object.assign({ id }, a)); return { id, url: 'https://checkout.stripe.test/' + id }; },
    retrieve: async (id) => global.__SESS[id] || { id, payment_status: 'unpaid' },
  } },
  webhooks: { constructEvent: (body) => JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body)) },
};`);
process.env.STRIPE_CLIENT_PATH = STRIPE_STUB;

const { hashPassword } = require('../lib/utils');
fs.writeFileSync(process.env.DATA_FILE, JSON.stringify({
  users: [
    { id: 1, email: 'Victim@Example.com', name: 'V', password_hash: hashPassword('victimpw'), email_verified: true },
    { id: 2, email: 'squatted@example.com', name: 'Attacker', password_hash: hashPassword('attackerpw') },
  ],
  tokens: [{ id: 1, user_id: 2, token: 'tok_attacker' }],
  orders: [],
  _id: { u: 3, t: 2, o: 1, r: 1, s: 1, rf: 1 },
}));

const express = require('express');
const S = require('../lib/store');
const claim = require('../lib/claim');
const app = express();
app.set('trust proxy', 1);
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/api', require('./payment'));
app.use('/api/auth', require('./auth'));
const srv = app.listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
test.after(() => { srv.close(); try { S._flushStore(); } catch (e) {} });

const cookiesOf = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : []);
const cookieVal = (r, name) => { const c = cookiesOf(r).find(x => x.startsWith(name + '=')); return c ? c.split(';')[0].slice(name.length + 1) : null; };

let ipN = 1;
async function startGuest(successUrl, extra) {
  const r = await fetch(BASE + '/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.' + (ipN++) },
    body: JSON.stringify(Object.assign({ product: 'bazi_full', successUrl, cancelUrl: successUrl }, extra || {})),
  });
  const d = await r.json();
  return { r, d, claimCookie: cookieVal(r, 'sy_claim_' + d.orderNo), created: global.__CREATED[global.__CREATED.length - 1] };
}
function markPaid(sessionId, email) { global.__SESS[sessionId] = { id: sessionId, payment_status: 'paid', customer_details: { email } }; }
function ret(created, orderNo, cookie) {
  const u = new URL(created.success_url.replace('{CHECKOUT_SESSION_ID}', created.id));
  return fetch(BASE + u.pathname + u.search, { redirect: 'manual', headers: cookie ? { cookie: 'sy_claim_' + orderNo + '=' + cookie } : {} });
}

test('① 游客报告单直接进 Stripe，不再 401；claim cookie 只作用于 /api/checkout', async () => {
  const { r, d, created } = await startGuest('http://localhost:3021/pages/report-v2.html?paid=1');
  assert.strictEqual(r.status, 200, JSON.stringify(d));
  assert.ok(d.url.startsWith('https://checkout.stripe.test/'));
  const c = cookiesOf(r).find(x => x.startsWith('sy_claim_'));
  assert.ok(c && /Path=\/api\/checkout/i.test(c) && /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c), c);
  assert.ok(created.success_url.startsWith('http://localhost:3021/api/checkout/return?session_id={CHECKOUT_SESSION_ID}&o='));
  assert.ok(!/report-v2/.test(created.success_url), '回跳地址不该直接带前端路径');
  const o = S._findOrder(d.orderNo);
  assert.strictEqual(o.user_id, null);
  assert.ok(o.claim_hash && o.claim_hash.length === 64);
  assert.ok(!JSON.stringify(o).includes(cookieVal(r, 'sy_claim_' + d.orderNo)), '明文 claim 不许落库');
});

test('⑤ 外站 successUrl 被收窄成默认站点（开放跳转）', async () => {
  const { created, d } = await startGuest('https://evil.example/steal');
  assert.ok(created.success_url.startsWith('https://runae.app/api/checkout/return'), created.success_url);
  assert.ok(created.cancel_url.startsWith('https://runae.app/'), created.cancel_url);
  assert.strictEqual(S._findOrder(d.orderNo).return_path, '/api/success?product=bazi_full');
  for (const bad of ['//evil.example/x', '/\\evil.example']) {
    assert.ok(claim.safeReturn('http://localhost:3021' + bad).path === '/', bad);
  }
});

test('② 同浏览器新邮箱 → 自动登录，回到报告页；第二次回跳不再登录', async () => {
  const { d, created, claimCookie } = await startGuest('http://localhost:3021/pages/report-v2.html?paid=1');
  markPaid(created.id, 'New.Buyer@Example.com ');
  const r1 = await ret(created, d.orderNo, claimCookie);
  assert.strictEqual(r1.status, 302);
  assert.strictEqual(r1.headers.get('location'), '/pages/report-v2.html?paid=1');
  const tok = cookieVal(r1, 'sy_token');
  assert.ok(tok, '没发登录 cookie');
  const t = S.getToken.get(tok);
  const u = S._M.users.find(x => x.id === t.user_id);
  assert.strictEqual(u.email, 'new.buyer@example.com');
  assert.strictEqual(u.password_hash, '');
  assert.ok(Date.parse(S._M.tokens.find(x => x.token === tok).expires_at) > Date.now() + 29 * 864e5);
  assert.strictEqual(S._findOrder(d.orderNo).user_id, u.id);

  const r2 = await ret(created, d.orderNo, claimCookie);
  assert.strictEqual(cookieVal(r2, 'sy_token'), null, '同一单第二次回跳又登录了');
  assert.ok(r2.headers.get('location').includes('claim=email'));
});

test('② 换浏览器（没 claim cookie）→ 不登录，提示去邮箱', async () => {
  const { d, created } = await startGuest('http://localhost:3021/pages/report-v2.html');
  markPaid(created.id, 'other.device@example.com');
  const r = await ret(created, d.orderNo, null);
  assert.strictEqual(cookieVal(r, 'sy_token'), null);
  assert.ok(r.headers.get('location').includes('claim=email'));
  assert.ok(S._findOrder(d.orderNo).user_id, '订单仍应挂到新号');
});

test('③ 用别人（已验证）的邮箱付款 → 订单挂过去，但绝不登进那个号', async () => {
  const { d, created, claimCookie } = await startGuest('http://localhost:3021/pages/report-v2.html');
  markPaid(created.id, 'victim@example.COM');
  const r = await ret(created, d.orderNo, claimCookie);
  assert.strictEqual(cookieVal(r, 'sy_token'), null, '🔴 用别人邮箱付一单就登进了别人的号');
  assert.strictEqual(S._findOrder(d.orderNo).user_id, 1);
  assert.strictEqual(S._M.users.filter(u => S.normEmail(u.email) === 'victim@example.com').length, 1, '大小写不同建出了第二个号');
});

test('④ 抢注号：订单挂起；邮箱主人点登录链接 → 订单挂上、抢注密码作废、旧会话下线', async () => {
  const { d, created, claimCookie } = await startGuest('http://localhost:3021/pages/report-v2.html');
  markPaid(created.id, 'squatted@example.com');
  const r = await ret(created, d.orderNo, claimCookie);
  assert.strictEqual(cookieVal(r, 'sy_token'), null);
  const o = S._findOrder(d.orderNo);
  assert.strictEqual(o.user_id, null, '🔴 订单挂到了抢注者的号上');
  assert.strictEqual(o.pending_email, 'squatted@example.com');

  const tok = claim.createMagicToken('squatted@example.com', '/pages/report-v2.html');
  const post = await fetch(BASE + '/api/auth/magic', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost:3021' }, body: 't=' + tok });
  assert.strictEqual(post.status, 303);
  assert.strictEqual(post.headers.get('location'), '/pages/report-v2.html');
  assert.ok(cookieVal(post, 'sy_token'));
  assert.strictEqual(S._findOrder(d.orderNo).user_id, 2);
  const u = S._M.users.find(x => x.id === 2);
  assert.strictEqual(u.password_hash, '');
  assert.strictEqual(u.email_verified, true);
  assert.strictEqual(S.getToken.get('tok_attacker'), null, '抢注者的旧会话没踢掉');
});

test('⑤ session_id 对不上 / 未付款 → 不建号不登录', async () => {
  const { d, created, claimCookie } = await startGuest('http://localhost:3021/pages/report-v2.html');
  const users0 = S._M.users.length;
  const wrong = await fetch(BASE + '/api/checkout/return?session_id=cs_forged&o=' + d.orderNo, { redirect: 'manual', headers: { cookie: 'sy_claim_' + d.orderNo + '=' + claimCookie } });
  assert.strictEqual(wrong.headers.get('location'), '/');
  const unpaid = await ret(created, d.orderNo, claimCookie);   // 桩默认 unpaid
  assert.ok(unpaid.headers.get('location').includes('paid=pending'));
  assert.strictEqual(cookieVal(unpaid, 'sy_token'), null);
  assert.strictEqual(S._M.users.length, users0);
  assert.strictEqual(S._findOrder(d.orderNo).user_id, null);
});

test('⑦ webhook 先到 → 建号挂单；再回跳仍能自动登录且不重复建号', async () => {
  const { d, created, claimCookie } = await startGuest('http://localhost:3021/pages/report-v2.html');
  markPaid(created.id, 'hook.first@example.com');
  const ev = { type: 'checkout.session.completed', data: { object: { id: created.id, metadata: { order_no: d.orderNo, product: 'bazi_full', guest: '1' }, customer_details: { email: 'Hook.First@example.com' } } } };
  const wh = await fetch(BASE + '/api/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 'x' }, body: JSON.stringify(ev) });
  assert.strictEqual(wh.status, 200);
  const o = S._findOrder(d.orderNo);
  assert.strictEqual(o.payment_status, 'completed');
  assert.ok(o.user_id && o.ready_mail_sent);
  const r = await ret(created, d.orderNo, claimCookie);
  assert.ok(cookieVal(r, 'sy_token'), 'webhook 先到后，同浏览器应仍能自动登录');
  assert.strictEqual(S._M.users.filter(u => u.email === 'hook.first@example.com').length, 1);
  await fetch(BASE + '/api/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 'x' }, body: JSON.stringify(ev) });
  assert.strictEqual(S._M.users.filter(u => u.email === 'hook.first@example.com').length, 1, 'webhook 重投建出第二个号');
});

test('⑥ 登录链接：GET 不消费；单次；过期失效；外站 POST 拒绝', async () => {
  const tok = claim.createMagicToken('magic.user@example.com', '/pages/account.html');
  const g = await fetch(BASE + '/api/auth/magic?t=' + tok);
  assert.strictEqual(g.status, 200);
  assert.ok((await g.text()).includes('method="POST"'));
  const evil = await fetch(BASE + '/api/auth/magic', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' }, body: 't=' + tok });
  assert.strictEqual(evil.status, 403);
  const ok = await fetch(BASE + '/api/auth/magic', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 't=' + tok });
  assert.strictEqual(ok.status, 303, '外站被拒后，正主应仍可用（令牌不该被外站请求烧掉）');
  const again = await fetch(BASE + '/api/auth/magic', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 't=' + tok });
  assert.strictEqual(again.status, 400, '登录链接能重复用');

  const t2 = claim.createMagicToken('magic.user@example.com', '/');
  S._M.magicLinks.find(m => m.hash === claim.sha(t2)).expires_at = new Date(Date.now() - 1000).toISOString();
  const exp = await fetch(BASE + '/api/auth/magic', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 't=' + t2 });
  assert.strictEqual(exp.status, 400);
});

test('⑥ 登录链接请求：永远 200、不泄露账号是否存在、每邮箱每小时最多 3 封、跳转只许站内', async () => {
  const before = S._M.magicLinks.filter(m => m.email === 'rl@example.com').length;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(BASE + '/api/auth/magic-link', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.' + i },
      body: JSON.stringify({ email: 'RL@example.com', redirect: 'https://evil.example/x' }) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true });
  }
  const rows = S._M.magicLinks.filter(m => m.email === 'rl@example.com');
  assert.strictEqual(rows.length - before, 3);
  assert.ok(rows.every(m => m.redirect === '/pages/account.html'), '外站 redirect 没被拦');
  assert.ok(rows.every(m => m.hash.length === 64 && !m.token), '令牌明文落库了');
});

test('无密码账号不能用空密码登录', async () => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'new.buyer@example.com', password: 'x' }) });
  assert.strictEqual(r.status, 401);
});

test('过期令牌不再有效', () => {
  S.insertToken.run(1, 'tok_short', 1);
  const row = S._M.tokens.find(t => t.token === 'tok_short');
  row.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual(S.getToken.get('tok_short'), null);
});
