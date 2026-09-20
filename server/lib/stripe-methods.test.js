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

// ── 0920：整单被拒时逐个降级，别一步塌回只收卡 ──────────────────────────────
test('微信没开通时，国内单降到 card+alipay 就停，支付宝不能跟着丢', () => {
  const { nextMethods } = require('./stripe-methods');
  const step1 = nextMethods(['card', 'alipay', 'wechat_pay']);
  assert.deepStrictEqual(step1, ['card', 'alipay'], '第一步只该摘掉微信');
  // 自证臂：如果实现是「一拒就回 ['card']」，上面这条会红
  assert.ok(step1.includes('alipay'), '降级一步不该把支付宝也丢掉');
});

test('韩国单逐个摘：link → kr_card → kakao_pay → 停', () => {
  const { nextMethods } = require('./stripe-methods');
  let m = ['card', 'kakao_pay', 'kr_card', 'link'];
  const seen = [];
  for (let i = 0; i < 10; i++) { const n = nextMethods(m); if (!n) break; seen.push(n.join('+')); m = n; }
  assert.deepStrictEqual(seen, ['card+kakao_pay+kr_card', 'card+kakao_pay', 'card']);
});

test('只剩 card 时返回 null（别无限重试，真错误要抛出去）', () => {
  const { nextMethods } = require('./stripe-methods');
  assert.strictEqual(nextMethods(['card']), null);
  assert.strictEqual(nextMethods([]), null);
  // 自证臂：还有非卡通道时必须不是 null，否则上面两条是空的
  assert.notStrictEqual(nextMethods(['card', 'alipay']), null);
});

// ── 0920 第二批：支付宝还在审核、微信过不了地理认证 ──────────────────────────
// 目标：别让每一单国内结账都白撞一次 Stripe 拒绝；审核通过后要自己恢复。
const INVALID = 'The payment method type "alipay" is invalid';

test('报错点名哪个通道，就只摘那一个（不误伤旁边已开通的）', () => {
  const { degrade, parseInvalidMethod, _unavailable } = require('./stripe-methods');
  _unavailable.clear();
  assert.strictEqual(parseInvalidMethod(INVALID, ['card', 'alipay', 'kakao_pay']), 'alipay');
  const next = degrade(['card', 'alipay', 'kakao_pay'], INVALID);
  assert.deepStrictEqual(next, ['card', 'kakao_pay'], '只该摘支付宝，kakao 要留着');
  // 自证臂：若实现退化成「从末尾摘」，摘掉的会是 kakao_pay，上面这条就红了
  assert.ok(next.includes('kakao_pay'));
  _unavailable.clear();
});

test('认不出报错就退回从末尾摘（不能卡死重试同一份清单）', () => {
  const { degrade, _unavailable } = require('./stripe-methods');
  _unavailable.clear();
  assert.deepStrictEqual(degrade(['card', 'alipay'], 'some other stripe error'), ['card']);
  assert.strictEqual(degrade(['card'], 'some other stripe error'), null);
  _unavailable.clear();
});

test('card 永远不摘，也永远不进「没开通」名单', () => {
  const { degrade, parseInvalidMethod, pruneUnavailable, _unavailable } = require('./stripe-methods');
  _unavailable.clear();
  assert.strictEqual(parseInvalidMethod('The payment method type "card" is invalid', ['card']), null);
  assert.strictEqual(degrade(['card'], 'The payment method type "card" is invalid'), null);
  assert.deepStrictEqual(pruneUnavailable(['card']), ['card']);
  _unavailable.clear();
});

test('被拒过的通道 TTL 内不再试，TTL 一过自动放出来（审核通过后自己恢复）', () => {
  const { degrade, pruneUnavailable, _unavailable, UNAVAILABLE_TTL_MS } = require('./stripe-methods');
  _unavailable.clear();
  const t0 = Date.now();
  degrade(['card', 'alipay'], INVALID, t0);
  assert.deepStrictEqual(pruneUnavailable(['card', 'alipay'], t0 + 1000), ['card'],
    'TTL 内还带着支付宝 = 每单白撞一次 Stripe');
  assert.deepStrictEqual(pruneUnavailable(['card', 'alipay'], t0 + UNAVAILABLE_TTL_MS + 1), ['card', 'alipay'],
    'TTL 过了不放出来 = 审核通过也永远收不到支付宝，要等重启');
  // 自证臂：没被拒过的通道本来就不该被摘
  _unavailable.clear();
  assert.deepStrictEqual(pruneUnavailable(['card', 'alipay'], t0), ['card', 'alipay']);
});
