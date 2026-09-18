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
const HUB_STUB = path.join(TMP, 'hub-stub.js');
fs.writeFileSync(HUB_STUB, 'module.exports = { HUB_SECRET: "", create: async () => { throw new Error("stub"); }, subCreate: async () => { throw new Error("stub"); } };\n');
process.env.HUB_CLIENT_PATH = HUB_STUB;
const STRIPE_STUB = path.join(TMP, 'stripe-stub.js');
fs.writeFileSync(STRIPE_STUB, `
let n = 0; global.__CREATED = []; global.__REJECT_WALLETS = false;
module.exports = { checkout: { sessions: {
  create: async (a) => {
    if (global.__REJECT_WALLETS && a.payment_method_types.some(m => m !== 'card')) throw new Error('The payment method type "wechat_pay" is invalid');
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

test('国内结账：人民币 + 卡/支付宝/微信，金额=目录 amountCny，不再回 channel:cn', async () => {
  const { status, d, s } = await checkout('CN');
  assert.strictEqual(status, 200);
  assert.ok(d.url, JSON.stringify(d));
  assert.notStrictEqual(d.channel, 'cn');
  assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
  assert.strictEqual(s.line_items[0].price_data.unit_amount, S.PRODUCTS.bazi_full.amountCny);
  assert.deepStrictEqual(s.payment_method_types, ['card', 'alipay', 'wechat_pay']);
  assert.deepStrictEqual(s.payment_method_options, { wechat_pay: { client: 'web' } });
});

test('Stripe 拒了支付宝/微信 → 退回只收卡，国内照样能付', async () => {
  global.__REJECT_WALLETS = true;
  try {
    const { status, d, s } = await checkout('CN');
    assert.strictEqual(status, 200);
    assert.ok(d.url);
    assert.deepStrictEqual(s.payment_method_types, ['card']);
    assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
  } finally { global.__REJECT_WALLETS = false; }
});

test('美国结账：美元目录价；前端硬传 currency:cny 也不改币种', async () => {
  const { s } = await checkout('US', { currency: 'cny', region: 'cn' });
  assert.strictEqual(s.line_items[0].price_data.currency, 'usd');
  assert.strictEqual(s.line_items[0].price_data.unit_amount, S.PRODUCTS.bazi_full.amount);
  assert.deepStrictEqual(s.payment_method_types, ['card']);
});

test('国内订阅：人民币，只收卡（支付宝/微信不支持订阅）', async () => {
  const { status, s } = await checkout('CN', { product: 'member_monthly' });
  assert.strictEqual(status, 200);
  assert.strictEqual(s.mode, 'subscription');
  assert.strictEqual(s.line_items[0].price_data.currency, 'cny');
  assert.deepStrictEqual(s.payment_method_types, ['card']);
});
