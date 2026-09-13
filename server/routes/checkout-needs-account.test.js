'use strict';
/**
 * checkout-needs-account.test.js — 「没账号就不许下单」的回归。
 *
 * 为什么要有这个文件(0913 生产实测)：
 *   /opt/shenyuan/server/data.json 里 **64 张订单全部 user_id=null**，包括唯一一笔
 *   completed 的 $19 daily_companion_year(2026-09-08)。而发货只认 user_id：
 *   getUserOrders.all(uid) 与 hasFullAccess 都是按 user_id 取单 —— 匿名订单等于
 *   「钱收到了，没有任何人能被解锁」，用户还没有自助补救路径（客服只能在后台手工补）。
 *   根因是三条下单通道(/create-checkout、/pay/wechat/create、/pay/alipay/qr、
 *   /pay/stripe/create)都允许 uid=null 直接建单。
 *
 * 这里钉三件事：
 *   ① 报告类商品：无 token → 401 login_required（不许建单、不许收钱）
 *   ② 代烧/供奉/预约等人工交付商品：无 token 仍然放行（不能误伤已有的人工成交）
 *   ③ 有 token 时不许被这条守卫误拦（否则等于把已登录用户的钱路堵死）
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-need-account-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
delete process.env.STRIPE_PAY_SECRET_KEY;   // 让 Stripe 通道处于「未开通」——守卫必须排在它前面

// 🔴 测试绝不许碰真支付中台：本地机器上 hub 客户端能读到真凭证，第一版这个测试
//   真的向中台发了一次下单请求（回「鉴权失败」），差点在测试里建出真订单。
//   payment.js 支持 HUB_CLIENT_PATH，这里塞一个 HUB_SECRET 为空的桩，通道直接判未开通。
const HUB_STUB = path.join(TMP, 'hub-stub.js');
fs.writeFileSync(HUB_STUB, 'module.exports = { HUB_SECRET: "", create: async () => { throw new Error("stub hub: disabled in tests"); }, subCreate: async () => { throw new Error("stub hub: disabled in tests"); }, HUB_SUB_PLAN_MAP: {}, _M: null };\n');
process.env.HUB_CLIENT_PATH = HUB_STUB;

const TOK = 'tok_buyer';
fs.writeFileSync(process.env.DATA_FILE, JSON.stringify({
  users: [{ id: 1, email: 'buyer@example.com', name: 'B' }],
  tokens: [{ id: 1, user_id: 1, token: TOK }],
  orders: [],
  _id: { u: 2, t: 2, o: 1, r: 1, s: 1, rf: 1 },
}));

const express = require('express');
const S = require('../lib/store');
const router = require('./payment');

const app = express();
app.use(express.json());
app.use('/api', router);
const srv = app.listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
test.after(() => { srv.close(); try { S._flushStore(); } catch (e) {} });

function post(p, body, opts) {
  opts = opts || {};
  return fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, opts.headers || {}),
    body: JSON.stringify(body),
  });
}

test('报告类商品：没登录就不许下单（401 login_required），而不是先收钱再没人能解锁', async () => {
  for (const p of ['/api/create-checkout', '/api/pay/wechat/create', '/api/pay/alipay/qr', '/api/pay/stripe/create']) {
    const r = await post(p, { product: 'bazi_full' });
    assert.strictEqual(r.status, 401, p + ' 匿名下单没有被拦（返回 ' + r.status + '）');
    const d = await r.json();
    assert.strictEqual(d.error, 'login_required', p + ' 返回的不是 login_required: ' + JSON.stringify(d));
    assert.ok(String(d.loginUrl || '').indexOf('login.html') > 0, p + ' 没给登录入口: ' + JSON.stringify(d));
  }
  assert.strictEqual(S._allOrders().length, 0, '被拦的请求居然建了订单');
});

test('代烧/供奉/预约这类人工交付的商品：匿名仍然能下单（不能误伤已有成交）', async () => {
  for (const p of ['/api/create-checkout', '/api/pay/wechat/create', '/api/pay/alipay/qr']) {
    const r = await post(p, { product: 'joss_premium' });
    assert.notStrictEqual(r.status, 401, p + ' 把代烧也拦了 —— 这类是人工联系交付，不需要账号');
  }
  assert.ok(S.orderNeedsAccount('bazi_full'), '报告类必须要求账号');
  assert.ok(!S.orderNeedsAccount('joss_basic') && !S.orderNeedsAccount('joss_premium')
            && !S.orderNeedsAccount('joss_supreme') && !S.orderNeedsAccount('shenyuan')
            && !S.orderNeedsAccount('shenyuan_booking'), '豁免名单被改了');
});

test('已登录用户不许被这条守卫误拦（返回 401 就意味着把已登录的钱路堵死了）', async () => {
  // cookie（同源 fetch 自动带）与 body token 两种认出方式都要能过
  const viaCookie = await post('/api/create-checkout', { product: 'bazi_full' },
                               { headers: { cookie: 'sy_token=' + TOK } });
  assert.notStrictEqual(viaCookie.status, 401, 'cookie 认证的已登录用户被判成匿名');

  const viaBody = await post('/api/create-checkout', { product: 'bazi_full', token: TOK });
  assert.notStrictEqual(viaBody.status, 401, 'body token 认证的已登录用户被判成匿名');

  const viaHeader = await post('/api/create-checkout', { product: 'bazi_full' },
                               { headers: { authorization: 'Bearer ' + TOK } });
  assert.notStrictEqual(viaHeader.status, 401, 'Authorization 头认证的已登录用户被判成匿名');

  const viaEmptyHeader = await post('/api/create-checkout', { product: 'bazi_full' },
                                    { headers: { cookie: 'sy_token=' + TOK, authorization: 'Bearer ' } });
  assert.notStrictEqual(viaEmptyHeader.status, 401, '空 Authorization 头把 cookie 顶掉了（页面会发 Bearer + 空 token）');
});
