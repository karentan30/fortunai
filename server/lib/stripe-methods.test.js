/**
 * 用 node 自带的 node:test 跑（Node 18+ 内置，仓库没有测试框架，不新引依赖）：
 *   node --test server/lib/stripe-methods.test.js
 *
 * 只测支付方式的**决策逻辑**，不碰真实收钱链路 —— 本机没有 STRIPE_SECRET_KEY，
 * 按项目铁律「收钱链路本地跑不了就出说明书不出代码」，真实下单流程留给 Karen
 * 在后台开通后用真实已付费订单回归（见本次报告的验收清单）。
 */
const test = require('node:test');
const assert = require('node:assert');
const { resolvePaymentMethods } = require('./stripe-methods');

test('一次性付款：原样放行，支付宝保留', () => {
  const r = resolvePaymentMethods(['card', 'alipay'], false);
  assert.deepStrictEqual(r.methods, ['card', 'alipay']);
  assert.deepStrictEqual(r.dropped, []);
});

test('订阅：支付宝被剔除，只留 card —— 这就是本次要堵的洞', () => {
  const r = resolvePaymentMethods(['card', 'alipay'], true);
  assert.deepStrictEqual(r.methods, ['card']);
  assert.deepStrictEqual(r.dropped, ['alipay']);
});

test('订阅：微信同样剔除', () => {
  const r = resolvePaymentMethods(['card', 'wechat_pay'], true);
  assert.deepStrictEqual(r.methods, ['card']);
  assert.deepStrictEqual(r.dropped, ['wechat_pay']);
});

test('订阅：支付宝+微信一起来，两个都剔除', () => {
  const r = resolvePaymentMethods(['alipay', 'wechat_pay', 'card'], true);
  assert.deepStrictEqual(r.methods, ['card']);
  assert.deepStrictEqual(r.dropped.sort(), ['alipay', 'wechat_pay']);
});

test('订阅：剔完一个不剩 → 回落 card（返回空数组会让 Stripe 报另一个错，等于换个样子的 bug）', () => {
  const r = resolvePaymentMethods(['alipay'], true);
  assert.deepStrictEqual(r.methods, ['card']);
  assert.deepStrictEqual(r.dropped, ['alipay']);
});

test('订阅：本来就只有 card，不受影响（负面验证：别把正常订阅也改坏）', () => {
  const r = resolvePaymentMethods(['card'], true);
  assert.deepStrictEqual(r.methods, ['card']);
  assert.deepStrictEqual(r.dropped, []);
});

test('韩国 KR_PAY_METHODS 那类自定义方式：一次性单不动它', () => {
  const r = resolvePaymentMethods(['card', 'kakao_pay', 'naver_pay'], false);
  assert.deepStrictEqual(r.methods, ['card', 'kakao_pay', 'naver_pay']);
});

test('韩国方式在订阅单里也不误杀（只剔支付宝/微信这两个明确不支持订阅的）', () => {
  const r = resolvePaymentMethods(['card', 'kakao_pay'], true);
  assert.deepStrictEqual(r.methods, ['card', 'kakao_pay']);
  assert.deepStrictEqual(r.dropped, []);
});

test('入参异常不炸', () => {
  assert.deepStrictEqual(resolvePaymentMethods(undefined, false).methods, []);
  assert.deepStrictEqual(resolvePaymentMethods(null, true).methods, ['card']);
  assert.deepStrictEqual(resolvePaymentMethods([], false).methods, []);
  assert.deepStrictEqual(resolvePaymentMethods(['card', null, ''], false).methods, ['card']);
});
