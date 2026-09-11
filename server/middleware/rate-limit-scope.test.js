'use strict';
/**
 * rate-limit-scope.test.js — 钉住「哪些路径会被限流」
 *
 * 为什么值得测：这段判断直接决定钱路回调会不会被 429。
 * 一旦 /api/stripe-webhook 或 /api/pay/* 被误限流，后果是「用户付了钱、
 * 回调被拒、不发货」—— 静默、且事后极难归因。同理，排行榜那种 10 秒轮询的
 * 接口如果掉出豁免名单，用户开着页面十几分钟就会开始报错。
 *
 * 运行：node --test server/middleware/rate-limit-scope.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const { isRateLimited, isExempt } = require('./index');

// ── 钱路：必须豁免，且是硬红线 ──────────────────────────────────────────
test('支付/回调类路径一律不限流（钱路红线）', () => {
  const moneyPaths = [
    '/api/stripe-webhook',
    '/api/hub-callback',
    '/api/pay/wechat/notify',
    '/api/pay/wechat/query',
    '/api/pay/alipay/notify',
    '/api/pay/alipay/create',
    '/api/orders',
    '/api/orders/sy_123',
    '/api/success',
    // 带 query 的落地页（付款成功后跳回）
    '/api/success?product=tarot_5',
  ];
  for (const p of moneyPaths) {
    assert.strictEqual(isRateLimited(p), false, `${p} 不应被限流`);
    assert.strictEqual(isExempt(p), true, `${p} 应在豁免名单里`);
  }
});

// ── 轮询页：必须豁免，否则页面开十几分钟就报错 ─────────────────────────
test('排行榜轮询接口不限流（10 秒一次 × 2 接口，远超 150/h）', () => {
  assert.strictEqual(isRateLimited('/api/referral/leaderboard'), false);
  assert.strictEqual(isRateLimited('/api/referral/mine'), false);
});

test('健康检查与静态商品表不限流', () => {
  assert.strictEqual(isRateLimited('/api/health'), false);
  assert.strictEqual(isRateLimited('/api/products'), false);
});

// ── AI 路由：必须限流（这才是限流存在的理由）──────────────────────────
test('会烧 LLM 的路由全部受限', () => {
  const llmPaths = [
    '/api/bazi',
    '/api/bazi/stream',
    '/api/hehun',
    '/api/ziwei',
    '/api/tarot',
    '/api/liuyao',
    '/api/mianxiang',
    '/api/fengshui',
    '/api/xingming',
    '/api/daoshao',
    '/api/daily',
    '/api/chat',
    '/api/saju',
    '/api/report',
    // 0911 之前因为白名单没列全而「写了中间件却完全不生效」的这批
    '/api/numerology',
    '/api/life-kline',
    '/api/chart-archetype',
    '/api/identity-triad',
    '/api/western-astrology',
    '/api/best-timing',
    '/api/love-destiny',
    '/api/soul-name',
    '/api/qimen-en',
    '/api/iching-en',
    '/api/ziwei-en',
    '/api/daliuren-en',
  ];
  for (const p of llmPaths) {
    assert.strictEqual(isRateLimited(p), true, `${p} 应该被限流`);
  }
});

// ── 默认拒绝：新增路由自动受保护，不需要回来改白名单 ───────────────────
test('未知的新增 /api 路由默认受保护（这是改默认拒绝的全部意义）', () => {
  assert.strictEqual(isRateLimited('/api/brand-new-llm-thing'), true);
  assert.strictEqual(isRateLimited('/api/some/deep/path'), true);
  assert.strictEqual(isRateLimited('/api/'), true);
});

// ── 非 API 路径一律不管（静态页/图片/sitemap 不能被限流）───────────────
test('非 /api 路径不限流', () => {
  const nonApi = ['/', '/index.html', '/pages/home-en.html', '/sitemap.xml', '/favicon.ico'];
  for (const p of nonApi) {
    assert.strictEqual(isRateLimited(p), false, `${p} 不应被限流`);
  }
});

test('路径为空/未定义时不限流（避免中间件在异常请求上崩）', () => {
  assert.strictEqual(isRateLimited(''), false);
  assert.strictEqual(isRateLimited(undefined), false);
  assert.strictEqual(isRateLimited(null), false);
});

// ── 前缀匹配的边界：不能被前缀邻近串骗过 ───────────────────────────────
test('豁免前缀按路径段匹配，不会被"前缀沾边"的路径蹭到', () => {
  // 以 /api/pay/ 为前缀的才是钱路；/api/payroll 不是
  assert.strictEqual(isRateLimited('/api/payroll'), true);
  // /api/orders 自身及其子路径豁免，但 /api/ordersX 不豁免
  assert.strictEqual(isRateLimited('/api/ordersX'), true);
  // /api/health 豁免，/api/healthz 不豁免
  assert.strictEqual(isRateLimited('/api/healthz'), true);
});
