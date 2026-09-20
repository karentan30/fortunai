'use strict';
// 0920：已下架档位不能再被买到（member_3year 阶梯是坏的：国内¥99<年卡¥299、海外$199>终身$188）。
// 判据带自证臂：把一个在售产品塞进同一条断言必须转红，否则这测试是空的。
const { test } = require('node:test');
const assert = require('node:assert');
const { PRODUCTS, RETIRED_PRODUCTS, SUBSCRIBE_PRODUCTS } = require('../lib/store');
const fs = require('fs');
const path = require('path');

test('member_3year 在下架名单里', () => {
  assert.ok(RETIRED_PRODUCTS.includes('member_3year'));
});

test('create-checkout 三个入口都挡下架产品（自证臂：在售产品不被挡）', () => {
  const src = fs.readFileSync(path.join(__dirname, 'payment.js'), 'utf8');
  const guards = src.match(/RETIRED_PRODUCTS\.includes\(product\)/g) || [];
  assert.strictEqual(guards.length, 3, '三个 create-checkout 入口都要挡');
  // 自证臂：下架的挡、在售的不挡
  assert.ok(RETIRED_PRODUCTS.includes('member_3year'));
  assert.ok(!RETIRED_PRODUCTS.includes('member_yearly'), '在售产品不该在下架名单');
});

test('下架产品仍保留目录条目与订阅识别，老买家权益不掉', () => {
  assert.ok(PRODUCTS.member_3year, '目录条目要留着，否则老订单显示不出名字');
  assert.ok(SUBSCRIBE_PRODUCTS.includes('member_3year'), '老买家到期判断仍要走订阅分支');
});

test('在售会员档：人民币阶梯递增、且都便宜于终身', () => {
  const ladder = ['member_daily', 'member_monthly', 'member_quarterly', 'member_yearly'];
  const cny = ladder.map(k => PRODUCTS[k].amountCny);
  for (let i = 1; i < cny.length; i++) {
    assert.ok(cny[i] > cny[i - 1], `${ladder[i]} 的¥价要高于 ${ladder[i - 1]}`);
  }
  const life = PRODUCTS.member_lifetime.amountCny;
  cny.forEach((v, i) => assert.ok(v < life, `${ladder[i]} 应便宜于终身`));
  // 自证臂：已下架的 3 年档放进同一把尺子必须不合格，证明这条断言真的会转红
  assert.ok(!(PRODUCTS.member_3year.amountCny > PRODUCTS.member_yearly.amountCny),
    '自证臂：member_3year ¥99 本就低于年卡，说明尺子抓得到坏阶梯');
});

test('塔罗牌阵：¥价随张数递增，且不低于单张', () => {
  const t = PRODUCTS.tarot.amountCny, t3 = PRODUCTS.tarot_3.amountCny, t5 = PRODUCTS.tarot_5.amountCny;
  assert.ok(t3 > t, '3 张要贵于单张');
  assert.ok(t5 > t3, '5 张要贵于 3 张');
});

// 0920 Karen 拍板：代烧/祈福需要真人到场，没人执行 → 全部下架
test('代烧 joss_* 全部进下架名单且结账挡得住', () => {
  const { RETIRED_PRODUCTS, PRODUCTS } = require('../lib/store');
  for (const k of ['joss_basic', 'joss_premium', 'joss_supreme']) {
    assert.ok(RETIRED_PRODUCTS.includes(k), k + ' 应已下架');
    assert.ok(PRODUCTS[k], k + ' 目录条目要保留给老订单');
  }
  // 自证臂：塞一个还在卖的产品，必须不在名单里，否则这条断言是空的
  assert.ok(!RETIRED_PRODUCTS.includes('bazi_full'), '在售产品不该被判成下架');
});

test('报告解锁阶梯：B 不能比 A 贵（两种币都是）', () => {
  const { PRODUCTS } = require('../lib/store');
  const a = PRODUCTS.report_unlock_a, b = PRODUCTS.report_unlock_b;
  assert.ok(b.amount <= a.amount, `USD: B $${b.amount / 100} 不该高于 A $${a.amount / 100}`);
  assert.ok(b.amountCny <= a.amountCny, `CNY: B ¥${b.amountCny / 100} 不该高于 A ¥${a.amountCny / 100}`);
});

test('祈福代办页不再可达（路由已 302）', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../index.js'), 'utf8');
  assert.match(src, /gongfeng\|daishao\|daishao-en/);
});

// 0921：两个没接线的落地页样板（付款按钮指向不存在的 ../server/pay，标价也是编的）
test('没接线的落地页 302 到真能下单的方法页', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  for (const [page, target] of [['lp-zh-main', 'bazi.html'], ['lp-in-vedic', 'jyotish.html']]) {
    const re = new RegExp(page + "[^\\n]*redirect\\(302, '/pages/" + target);
    assert.ok(re.test(src), page + ' 的 302 没了 —— 那个页面的付款按钮是死的，别让它再对外开放');
  }
  // 自证臂：换个没下架的页面必须找不到，否则上面是空的
  assert.ok(!/lp-bazi-cn-a[^\n]*redirect\(302/.test(src), '正常落地页不该被重定向');
});
