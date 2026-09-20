'use strict';
/**
 * cny-ladder.test.js — 0921 Karen 拍板的「中国区价格档位」，别再手滑改出倒挂/撞价。
 *
 * 背景：0918 接入按所在地定价后，amountCny 是一个个手写的，没人管这一列自己是否成立。
 * 0920 查出三处：年卡按月比季卡还贵（¥24.9 vs ¥23）、同一句「完整解读」五种价
 * （¥39.9/44.9/69/89/99）、两处撞价（体验=基础、解锁7-10章=解锁3-6章）。
 *
 * 口径：**不按汇率定价，按档位定**。国内用户永远只看得见 ¥，跟美元比没有意义。
 *   单节 ¥14.9 → 入门/基础 ¥19.9 → 单份完整报告 ¥39.9 → 一键全解锁 ¥44.9 → VIP ¥149
 *   会员：月 ¥39 / 季 ¥69 / 年 ¥199
 *
 * ⚠️ 不做全局单调：美元贵的在人民币不一定贵（藏传 $14.9 > 八字 $11.99，但 ¥39.9 < ¥44.9），
 *   那是「长尾方法不该有溢价」的有意选择，不是 bug。所以只钉下面三条结构性规则。
 */
const test = require('node:test');
const assert = require('node:assert');
const { PRODUCTS } = require('./store');

const cny = (k) => { const p = PRODUCTS[k]; assert.ok(p, `目录里没有 ${k}`); return p.amountCny; };
const usd = (k) => { const p = PRODUCTS[k]; assert.ok(p, `目录里没有 ${k}`); return p.amount; };

// ── 规则本体：都写成纯函数，好拿假数据验它真会红 ────────────────────────────
/** 会员：期限越长，**按月单价**必须越便宜。返回问题清单。 */
function checkMemberLadder(get, terms) {
  const out = [];
  for (let i = 1; i < terms.length; i++) {
    const a = terms[i - 1], b = terms[i];
    const pa = get(a.key) / a.months, pb = get(b.key) / b.months;
    if (!(pb < pa)) out.push(`${b.key} 按月 ${(pb / 100).toFixed(2)} 不比 ${a.key} 的 ${(pa / 100).toFixed(2)} 便宜`);
  }
  return out;
}

/** 同一档位的商品，价格必须一致。 */
function checkSameTier(get, keys) {
  const seen = keys.map(k => [k, get(k)]);
  const first = seen[0][1];
  return seen.filter(([, v]) => v !== first).map(([k, v]) => `${k}=${v} 与同档 ${seen[0][0]}=${first} 不一致`);
}

/** 一个家族内的阶梯：必须严格递增（既不许倒挂，也不许撞价）。 */
function checkFamily(get, name, keys) {
  const out = [];
  for (let i = 1; i < keys.length; i++) {
    const a = get(keys[i - 1]), b = get(keys[i]);
    if (b === a) out.push(`${name}: ${keys[i]} 与 ${keys[i - 1]} 撞价（都是 ${a}）`);
    else if (b < a) out.push(`${name}: ${keys[i]}=${b} 比前一档 ${keys[i - 1]}=${a} 还便宜（倒挂）`);
  }
  return out;
}

const MEMBER_TERMS = [
  { key: 'member_monthly', months: 1 },
  { key: 'member_quarterly', months: 3 },
  { key: 'member_yearly', months: 12 },
];

// 没有 session 结构、用户眼里就是「一份完整报告」的方法，统一 ¥39.9
const FULL_REPORT_TIER = ['mianxiang_full', 'shouxiang_full', 'hehun', 'tibet_full', 'jyotish_full', 'maya_full', 'saju_kr_full'];

const FAMILIES = {
  '八字': ['bazi_trial', 'bazi_basic', 'bazi_full', 'bazi_vip'],
  '分章解锁': ['report_unlock_b', 'report_unlock_a'],
  '合婚': ['hehun_basic', 'hehun', 'hehun_full', 'hehun_master'],
  '塔罗': ['tarot', 'tarot_3', 'tarot_5'],
  '会员': ['member_daily', 'member_monthly', 'member_quarterly', 'member_yearly', 'member_lifetime'],
};

// ── 真目录必须过 ────────────────────────────────────────────────────────────
test('会员：期限越长按月越便宜（人民币和美元都要）', () => {
  assert.deepStrictEqual(checkMemberLadder(cny, MEMBER_TERMS), [], '人民币会员阶梯倒挂');
  assert.deepStrictEqual(checkMemberLadder(usd, MEMBER_TERMS), [], '美元会员阶梯倒挂');
});

test('「完整解读」同档位一个价（长尾方法不许溢价）', () => {
  assert.deepStrictEqual(checkSameTier(cny, FULL_REPORT_TIER), []);
  assert.strictEqual(cny('mianxiang_full'), 3990, '0921 Karen 拍的完整解读档 = ¥39.9');
});

test('家族阶梯：不许撞价，不许倒挂（人民币和美元都要）', () => {
  const problems = [];
  for (const [name, keys] of Object.entries(FAMILIES)) {
    problems.push(...checkFamily(cny, '¥ ' + name, keys));
    problems.push(...checkFamily(usd, '$ ' + name, keys));
  }
  assert.deepStrictEqual(problems, [], '价格阶梯有问题：\n  ' + problems.join('\n  '));
});

test('每个在卖的商品都得有 amountCny（别靠 ×7.25 兜底出 ¥54.38 这种数）', () => {
  const { RETIRED_PRODUCTS = [] } = require('./store');
  const missing = Object.entries(PRODUCTS)
    .filter(([k, p]) => p.amount && !p.amountCny && !RETIRED_PRODUCTS.includes(k))
    .map(([k]) => k);
  assert.deepStrictEqual(missing, [], '这些商品在国内会显示自动折算的怪数字');
});

// ── 自证臂：塞已知坏值，三条规则都必须转红 ──────────────────────────────────
test('守卫自身有效：塞坏值必须转红', () => {
  // 年卡按月比季卡贵（就是 0920 查出来的那个真实 bug：¥299 vs ¥69）
  const bad1 = (k) => ({ member_monthly: 3900, member_quarterly: 6900, member_yearly: 29900 }[k]);
  assert.notDeepStrictEqual(checkMemberLadder(bad1, MEMBER_TERMS), [], '年卡倒挂没被抓到 = 这条规则是空的');
  // 按月刚好持平也算没变便宜（边界：不能用 <= 放过去）
  const flat = (k) => ({ member_monthly: 3900, member_quarterly: 11700, member_yearly: 46800 }[k]);
  assert.notDeepStrictEqual(checkMemberLadder(flat, MEMBER_TERMS), []);

  // 同档位一个贵的（藏传 ¥99 的老样子）
  const bad2 = (k) => (k === 'tibet_full' ? 9900 : 3990);
  assert.notDeepStrictEqual(checkSameTier(bad2, FULL_REPORT_TIER), []);

  // 撞价 + 倒挂各一
  const collide = (k) => ({ a: 1990, b: 1990 }[k]);
  assert.match(checkFamily(collide, 'T', ['a', 'b']).join(''), /撞价/);
  const invert = (k) => ({ a: 1990, b: 990 }[k]);
  assert.match(checkFamily(invert, 'T', ['a', 'b']).join(''), /倒挂/);

  // 反向自证：好数据必须是空的，否则上面全是假阳性
  const good = (k) => ({ a: 990, b: 1990 }[k]);
  assert.deepStrictEqual(checkFamily(good, 'T', ['a', 'b']), []);
});
