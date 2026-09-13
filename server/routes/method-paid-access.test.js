'use strict';
/**
 * method-paid-access.test.js — 「付了钱能不能拿到那份报告」的回归。
 *
 * 为什么要有这个文件：报告页的付费按钮各自把 product 名传给 /api/create-checkout，
 * 而「买哪个 SKU 能解锁哪个方法」是 store.js 里 UNLOCK_BY_CATEGORY + PRODUCTS 两处
 * 拼出来的。这两处与页面之间没有任何测试，于是出现三类真实故障（0913 实测）：
 *   ① 页面卖的 SKU 根本不在 PRODUCTS 里 → create-checkout 直接 400，按钮点了没反应；
 *   ② 页面卖的是**别的方法**的 SKU（藏传/吠陀页卖 bazi_full）→ 收了钱解锁不了本页报告；
 *   ③ 页面标的价与实际收的钱不是一个数。
 * 这个文件钉的是 ① 和 ②：**每一个方法都必须有一个真实可售的 SKU，且买了它就解锁它自己**。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-paid-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
process.env.MONITORING_PATH = path.join(TMP, 'no-such-monitoring.js');

// 页面 ↔ 它宣称可买的东西（照 pages/*.html 里的 create-checkout 调用抄下来）
//   key = 页面路径里的方法名（也是 gate 的 reportId）
//   soldAs = 该页付费按钮实际提交的 product（页面真实行为，不是我们希望它是什么）
const PAGES = [
  { page: 'pages/tarot.html', method: 'tarot', soldAs: ['tarot_3', 'tarot_5'], productKeys: ['tarot_5', 'tarot_3', 'tarot'] },
  { page: 'pages/ziwei.html', method: 'ziwei', soldAs: ['ziwei_full'], productKeys: ['ziwei_full', 'ziwei'] },
  { page: 'pages/mianxiang.html', method: 'mianxiang', soldAs: ['mianxiang_full'], productKeys: ['mianxiang_full'] },
  { page: 'pages/fengshui.html', method: 'fengshui', soldAs: ['fengshui_full'], productKeys: ['fengshui', '风水'] },
  { page: 'pages/yinzhai.html', method: 'yinzhai', soldAs: ['yinzhai_full'], productKeys: ['yinzhai'] },
  { page: 'pages/tibet.html', method: 'tibet', soldAs: ['tibet_full'], productKeys: ['tibet_full', 'tibet'] },
  { page: 'pages/jyotish.html', method: 'jyotish', soldAs: ['jyotish_full'], productKeys: ['jyotish_full', 'jyotish'] },
  { page: 'pages/maya.html', method: 'maya', soldAs: ['maya_full'], productKeys: ['maya_full', 'maya'] },
];

// 每个可售 SKU 一个买家，order 写成已完成且未过期
const BUYERS = {};
const orders = [];
let uid = 1;
const ALL_SKUS = [...new Set(PAGES.flatMap(p => p.soldAs))];
const users = [], tokens = [];
for (const sku of ALL_SKUS) {
  const id = uid++;
  BUYERS[sku] = { uid: id, token: 'tok_' + sku };
  users.push({ id, email: sku + '@example.com', name: sku });
  tokens.push({ id, user_id: id, token: 'tok_' + sku });
  orders.push({
    id: orders.length + 1, order_no: 'o_' + sku, product: sku, amount: 1000, currency: 'usd',
    user_id: id, payment_status: 'completed',
    created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 300 * 864e5).toISOString(),
  });
}

fs.writeFileSync(process.env.DATA_FILE, JSON.stringify({
  users, tokens, orders,
  _id: { u: users.length + 1, t: tokens.length + 1, o: orders.length + 1, r: 1, s: 1, rf: 1 },
}));

const S = require('../lib/store');

test.after(() => { try { S._flushStore(); } catch (e) {} });

const reqFor = token => ({ headers: { authorization: 'Bearer ' + token } });

test('每个方法页都必须有一个真实可售的 SKU（否则按钮点了没反应 / 收钱不给货）', () => {
  const problems = [];
  for (const p of PAGES) {
    if (!p.soldAs.length) { problems.push(`${p.page}: 页面上没有任何可用的付费入口（SKU 无处可买）`); continue; }
    for (const sku of p.soldAs) {
      if (!S.PRODUCTS[sku]) problems.push(`${p.page}: 卖 ${sku}，但 PRODUCTS 里没有这个 SKU（create-checkout 会 400）`);
    }
  }
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});

test('买了某方法的 SKU，就必须解锁**它自己那份**报告（不能解锁别的、也不能什么都不解锁）', () => {
  const problems = [];
  for (const p of PAGES) {
    if (!p.soldAs.length) continue;
    // 该页实际会收的那个 SKU 的买家
    const sku = p.soldAs[0];
    const buyer = BUYERS[sku];
    if (!buyer) continue;
    const g = S.gateReportAccess(reqFor(buyer.token), p.productKeys, p.method);
    if (!g.full) problems.push(`${p.page}: 买了 ${sku}（$ ${(S.PRODUCTS[sku] || {}).amount / 100}）打开本页报告仍是付费墙`);
  }
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});

test('反向：买 A 方法的 SKU 不能白送 B 方法的报告（防「修过头」变成一键全解锁）', () => {
  const problems = [];
  for (const p of PAGES) {
    if (!p.soldAs.length) continue;
    for (const other of PAGES) {
      if (other.method === p.method || !other.soldAs.length) continue;
      // 用 A 页买家的身份去开 B 页的报告
      const g = S.gateReportAccess(reqFor(BUYERS[p.soldAs[0]].token), other.productKeys, other.method);
      if (g.full) problems.push(`${p.method} 的买家能白看 ${other.method} 的报告`);
    }
  }
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});

test('页面标价 = 实际收费金额（同一 SKU 不允许出现两个价）', () => {
  // 页面按钮上写的价（逐条从 pages/*.html 抄下来，标了行号）
  //   cur: 'usd'（默认）比 PRODUCTS[sku].amount；'cny' 比 amountCny
  const ADVERTISED = {
    tibet: { shown: 14.90, at: 'pages/tibet.html:783' },
    jyotish: { shown: 12.90, at: 'pages/jyotish.html:742' },
    maya: { shown: 9.90, at: 'pages/maya.html:662' },
    ziwei: { shown: 11.99, at: 'pages/ziwei.html:1222' },
    mianxiang: { shown: 9.90, at: 'pages/mianxiang.html:851' },
    fengshui: { shown: 59, cur: 'cny', at: 'pages/fengshui.html:1077' },
    yinzhai: { shown: 99, cur: 'usd', at: 'pages/yinzhai.html:316' },
  };
  const problems = [];
  for (const p of PAGES) {
    const adv = ADVERTISED[p.method];
    if (!adv || !p.soldAs.length) continue;
    const sku = p.soldAs[0];
    const prod = S.PRODUCTS[sku];
    if (!prod) { problems.push(`${p.page}: 标价 ${adv.cur === 'cny' ? '¥' : '$'}${adv.shown}（${adv.at}）但 ${sku} 不存在，无法收费`); continue; }
    const cny = adv.cur === 'cny';
    const charged = (cny ? prod.amountCny : prod.amount) / 100;
    if (Math.abs(charged - adv.shown) > 0.001) {
      problems.push(`${p.page}: 页面写 ${cny ? '¥' : '$'}${adv.shown}（${adv.at}），实际收 ${cny ? '¥' : '$'}${charged}（${sku}）`);
    }
  }
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});
