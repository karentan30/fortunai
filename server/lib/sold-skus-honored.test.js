// 静态守卫：页面上卖得出去的 SKU，服务端必须认账。
//
// 为什么值得单独立一个测试：`PRODUCTS` 表、页面上的 `product: 'xxx'`、
// `UNLOCK_BY_CATEGORY` 三处各改各的，没有一处校验它们是否对齐。已经踩过两次：
//   · report-{en,cn,in,th,es,pt-br} 在卖 report_unlock_a/b，求签三页在卖 bazi_basic，
//     韩语站在卖 saju_kr_full —— 这四个 key 不在任何解锁表里。
//     用户付了钱，gateReportAccess 走 UNLOCK_BY_CATEGORY 查不到 → 服务端一个字都不放，
//     页面还把「章节标题预告单」的模糊遮罩去掉装作已解锁。收钱不发货，且全静默。
//   · saju-landing-KR.html 传的是 `saju_kr_full_krw` —— 那是 STRIPE_PRICE_IDS 的键名，
//     不是产品键。PRODUCTS 查不到 → 按钮恒返回 400，一个人都付不了款。
//
// 两条规则，都可静态判定：
//   ① 页面卖的每个 product 必须在 PRODUCTS 里（否则下单接口 400，按钮是死的）
//   ② 必须在某处解锁表里出现，或明确列入「本来就不解锁任何东西」的白名单
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = path.join(ROOT, 'pages');
const { PRODUCTS, UNLOCK_BY_CATEGORY } = require('./store.js');

// 这些 SKU 卖了不算「解锁某个付费墙」，所以不在 UNLOCK_BY_CATEGORY 里是对的：
// 订阅/周期包走 memberTier，代烧和问题包走各自的额度计费，报告年包同理。
const NON_UNLOCKING = new Set([
  'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily', 'member_lifetime',
  'daily_sub', 'daily_companion_month', 'daily_companion_year', 'monthly_report_year',
  'single_question', 'question_pack_3', 'report_annual', 'bazi_trial',
]);

// 走各自专用等级函数、不进 UNLOCK_BY_CATEGORY 的 SKU：
// hehunTier() 里 FULL_MEMBER_PRODUCTS.concat(['member_lifetime','hehun','hehun_full','hehun_kr_full'])
const HONORED_BY_DEDICATED_GATE = new Set([
  'hehun', 'hehun_full', 'hehun_kr_full', 'hehun_master', 'hehun_basic',
]);

// 代烧是靠人工履约（法师接单 → 48h 内仪式视频发邮箱）而不是解锁付费墙，
// 所以不在 UNLOCK_BY_CATEGORY 里是对的。见 payment.js 的 SUCCESS_PAGE.joss_*。
const NON_UNLOCKING_PREFIX = ['joss_'];

// 源码里带 `product:` 但**不是**结账产品的误报。逐条写明为什么：
const NOT_A_CHECKOUT = {
  'booking.html': { shenyuan_booking: '/api/support-ticket 的工单标签，不是支付商品' },
  'support-widget.html': { shenyuan: '客服组件的配置字段，不是支付商品' },
  'lp-bazi-cn-a.html': { bazi: 'AB 实验参数，不是支付商品' },
  'member-en.html': { member_: '是 `\'member_\' + curPlan` 的拼接前缀，不是完整产品 ID' },
};

// 页面源码里在卖的 SKU。
//
// 只扫 `product:'x'` 会漏掉三元写法 `tier==='a' ? 'report_unlock_a' : 'report_unlock_b'`
// —— report_unlock_b 就是这么卖的，第一版守卫正好漏了它。
// 改成：页面只要引用过任一支付/报告端点，就把该页出现过的所有「合法产品键字面量」全算进来。
// 宁可多收（多收只会让守卫更严，误报逐条写进 NOT_A_CHECKOUT），不可少收。
const PAY_ENDPOINT = /\/pay\/|create-checkout|\/api\/bazi\b/;
function soldProducts(src) {
  const out = new Set();
  if (!PAY_ENDPOINT.test(src)) return out;
  for (const k of Object.keys(PRODUCTS)) {
    if (src.includes("'" + k + "'")) out.add(k);
  }
  return out;
}

// 被任何一张解锁表认账的 SKU 全集
const HONORED = new Set();
for (const list of Object.values(UNLOCK_BY_CATEGORY)) for (const k of list) HONORED.add(k);

test('每个页面在卖的 SKU 都真实存在于 PRODUCTS（否则下单接口 400，按钮是死的）', () => {
  const missing = [];
  for (const f of fs.readdirSync(PAGES).filter(x => x.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
    for (const p of soldProducts(src)) {
      if ((NOT_A_CHECKOUT[f] || {})[p]) continue;
      if (!PRODUCTS[p]) missing.push(`${f} → ${p}`);
    }
  }
  assert.deepStrictEqual(missing, [],
    '页面在卖 PRODUCTS 里没有的产品 ID，下单必然 400：\n  ' + missing.join('\n  '));
});

test('每个页面在卖的 SKU 都有人在服务端认账（否则用户付钱拿不到东西）', () => {
  const orphaned = [];
  for (const f of fs.readdirSync(PAGES).filter(x => x.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
    for (const p of soldProducts(src)) {
      if ((NOT_A_CHECKOUT[f] || {})[p]) continue;
      if (HONORED.has(p) || NON_UNLOCKING.has(p) || HONORED_BY_DEDICATED_GATE.has(p)) continue;
      if (NON_UNLOCKING_PREFIX.some(pre => p.startsWith(pre))) continue;
      orphaned.push(`${f} → ${p}`);
    }
  }
  assert.deepStrictEqual(orphaned, [],
    '页面在卖、但没有任何解锁表认账的 SKU —— 用户付钱后服务端不会放行任何内容。\n'
    + '修法二选一：加进 UNLOCK_BY_CATEGORY，或加进本测试的 NON_UNLOCKING 白名单并说明它靠什么计费。\n  '
    + orphaned.join('\n  '));
});

test('守卫本身有效：能扫到页面、能扫到 SKU、解锁表非空', () => {
  const html = fs.readdirSync(PAGES).filter(x => x.endsWith('.html'));
  assert.ok(html.length > 50, `扫到的页面数太少（${html.length}），路径可能不对`);
  assert.ok(HONORED.size > 40, `解锁表认账的 SKU 太少（${HONORED.size}），UNLOCK_BY_CATEGORY 可能读空了`);
  const sold = new Set();
  for (const f of html) for (const p of soldProducts(fs.readFileSync(path.join(PAGES, f), 'utf8'))) sold.add(p);
  assert.ok(sold.size > 20, `扫到的在售 SKU 太少（${sold.size}），正则可能失效了`);
});
