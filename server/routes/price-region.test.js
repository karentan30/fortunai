'use strict';
/**
 * price-region.test.js — 0918 Karen「按所在地定价：中国=人民币，美国=美元」
 *
 * 钉住：展示价（/api/price-region）与实收（/api/create-checkout）同一判定、同一目录；
 *   国内不再回 channel:'cn' 死胡同；国内走 CNY + 支付宝/微信，被 Stripe 拒时退回只收卡；
 *   前端传 currency:'cny' 不能让海外用户按人民币付（也不能反过来）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-price-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
process.env.STRIPE_PAY_SECRET_KEY = 'sk_test_stub';
delete process.env.CN_PAY_METHODS;
// 本文件用 cf-ipcountry 模拟地理位置，所以这里显式打开「信任 CDN 国家头」。
// 生产默认是**关**的（那个头谁都能伪造，见下面最后一条测试）。
process.env.TRUST_CDN_GEO = '1';
const HUB_STUB = path.join(TMP, 'hub-stub.js');
fs.writeFileSync(HUB_STUB, 'module.exports = { HUB_SECRET: "", create: async () => { throw new Error("stub"); }, subCreate: async () => { throw new Error("stub"); } };\n');
process.env.HUB_CLIENT_PATH = HUB_STUB;
const STRIPE_STUB = path.join(TMP, 'stripe-stub.js');
fs.writeFileSync(STRIPE_STUB, `
let n = 0; global.__CREATED = []; global.__ATTEMPTS = 0; global.__REJECT_WALLETS = false;
module.exports = { checkout: { sessions: {
  create: async (a) => {
    global.__ATTEMPTS++;
    // 照 Stripe 真实报错的样子点名是哪个通道没开通（生产里支付宝审核中就是这条）
    const bad = a.payment_method_types.find(m => m !== 'card');
    if (global.__REJECT_WALLETS && bad) throw new Error('The payment method type "' + bad + '" is invalid');
    const id = 'cs_test_' + (++n); global.__CREATED.push(a); return { id, url: 'https://checkout.stripe.test/' + id };
  } } }, webhooks: { constructEvent: () => ({}) } };`);
process.env.STRIPE_CLIENT_PATH = STRIPE_STUB;
fs.writeFileSync(process.env.DATA_FILE, JSON.stringify({ users: [], tokens: [], orders: [], _id: { u: 1, t: 1, o: 1, r: 1, s: 1, rf: 1 } }));

const express = require('express');
const S = require('../lib/store');
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api', require('./payment'));
const srv = app.listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
test.after(() => { srv.close(); try { S._flushStore(); } catch (e) {} });

let ipN = 1;
const H = (cc) => Object.assign({ 'content-type': 'application/json', 'x-forwarded-for': '10.1.0.' + (ipN++) }, cc ? { 'cf-ipcountry': cc } : {});
const checkout = (cc, body) => fetch(BASE + '/api/create-checkout', { method: 'POST', headers: H(cc), body: JSON.stringify(Object.assign({ product: 'bazi_full' }, body)) })
  .then(async r => ({ status: r.status, d: await r.json(), s: global.__CREATED[global.__CREATED.length - 1] }));

test('展示价：国内=¥ 目录 amountCny，美国=$ 目录 amount', async () => {
  const cn = await (await fetch(BASE + '/api/price-region', { headers: H('CN') })).json();
  const us = await (await fetch(BASE + '/api/price-region', { headers: H('US') })).json();
  assert.strictEqual(cn.currency, 'cny');
  assert.strictEqual(cn.prices.bazi_full, '¥' + (S.PRODUCTS.bazi_full.amountCny / 100).toFixed(2));
  assert.strictEqual(us.currency, 'usd');
  assert.strictEqual(us.prices.bazi_full, '$11.99');
  assert.strictEqual(us.prices.member_monthly, '$9.90');
});

test('国内结账：人民币 + 卡/支付宝，金额=目录 amountCny，不再回 channel:cn', async () => {
  const { status, d, s } = await checkout('CN');
  assert.strictEqual(status, 200);
  assert.ok(d.url, JSON.stringify(d));
  assert.notStrictEqual(d.channel, 'cn');
  assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
  assert.strictEqual(s.line_items[0].price_data.unit_amount, S.PRODUCTS.bazi_full.amountCny);
  // 0920 Karen：微信过不了 Stripe 的地理/主体认证，从默认清单拿掉——留着只会让
  // 每一单国内结账白撞一次「整单拒」。真开通了用 CN_PAY_METHODS 加回来。
  assert.deepStrictEqual(s.payment_method_types, ['card', 'alipay']);
  assert.strictEqual(s.payment_method_options, undefined, '清单里没微信就不该带 wechat_pay 选项');
});

test('支付宝没开通：退回只收卡照样能付，且记住它——下一单不再白撞一次', async () => {
  const { _unavailable } = require('../lib/stripe-methods');
  _unavailable.clear();
  global.__REJECT_WALLETS = true;
  try {
    global.__ATTEMPTS = 0;
    const { status, d, s } = await checkout('CN');
    assert.strictEqual(status, 200);
    assert.ok(d.url);
    assert.deepStrictEqual(s.payment_method_types, ['card']);
    assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
    assert.strictEqual(global.__ATTEMPTS, 2, '第一单该是「带支付宝被拒 + 只收卡成功」两次');

    // 支付宝还在审核期间，每一单都重撞一次 = 白搭半秒。第二单必须直接只带卡。
    global.__ATTEMPTS = 0;
    const second = await checkout('CN');
    assert.strictEqual(second.status, 200);
    assert.deepStrictEqual(second.s.payment_method_types, ['card']);
    assert.strictEqual(global.__ATTEMPTS, 1, '记住「支付宝没开通」后，第二单不该再撞一次 Stripe');
  } finally { global.__REJECT_WALLETS = false; _unavailable.clear(); }
});

test('美国结账：美元目录价；前端硬传 currency:cny 也不改币种', async () => {
  const { s } = await checkout('US', { currency: 'cny', region: 'cn' });
  assert.strictEqual(s.line_items[0].price_data.currency, 'usd');
  assert.strictEqual(s.line_items[0].price_data.unit_amount, S.PRODUCTS.bazi_full.amount);
  // 0920 Karen 的 Stripe 开了 Link（一键复用已存的卡），海外一次性付款默认带上。
  assert.deepStrictEqual(s.payment_method_types, ['card', 'link']);
});

test('国内订阅：人民币，只收卡（支付宝/微信不支持订阅）', async () => {
  const { status, s } = await checkout('CN', { product: 'member_monthly' });
  assert.strictEqual(status, 200);
  assert.strictEqual(s.mode, 'subscription');
  assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
  assert.deepStrictEqual(s.payment_method_types, ['card']);
});

// ── 0920：别让人加个请求头就拿到国内价 ──────────────────────────────────────
test('🔴 默认不信 cf-ipcountry：伪造这个头拿不到人民币价（四八折白拿）', async () => {
  const prev = process.env.TRUST_CDN_GEO;
  delete process.env.TRUST_CDN_GEO;
  try {
    // 内网 IP 查不到地区 → 回落到域名判定 → 127.0.0.1 不是 mylumee.cn → 美元。
    // 关键是：带着 cf-ipcountry: CN 也照样是美元。
    const r = await (await fetch(BASE + '/api/price-region', { headers: H('CN') })).json();
    assert.strictEqual(r.currency, 'usd', '伪造 cf-ipcountry 就能把 $11.99 买成 ¥44.90');
    const { d, s: sess } = await checkout('CN');
    assert.ok(d.url);
    assert.strictEqual(sess.line_items[0].price_data.currency, 'usd', '结账也不能被这个头带偏');
  } finally { process.env.TRUST_CDN_GEO = prev; }
  // 自证臂：开关打开时同一个请求必须变成人民币，否则上面两条是空的
  const on = await (await fetch(BASE + '/api/price-region', { headers: H('CN') })).json();
  assert.strictEqual(on.currency, 'cny');
});
