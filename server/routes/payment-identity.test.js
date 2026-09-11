// 静态守卫：每条收款通道都必须「认得人」——下单时要落 user_id。
//
// 为什么值得单独立一个测试（0911 真实事故）：
//   微信、支付宝两条通道都调 _payResolveUser(...) 从 token/cookie 里认人，
//   只有 Stripe 这条硬编码了 null。后果是：**已登录**用户在报告页刷卡买
//   report_unlock_a，订单行 user_id 仍是 null，而 hasFullAccess 必须
//   「有 token」且「存在 user_id 相同的订单」两条同时成立才放全文——
//   所以钱收了、正文一个字都不给，且用户自己无法补救（他没做错任何事）。
//
//   这类事故的特征是**完全没有报错**：支付成功、订单入库、页面提示「已解锁」，
//   只是内容取不到。真浏览器走查、curl 探活、付款回调模拟全都测不出来，
//   因为每一环单独看都是对的，错的是两环之间的连接。只有静态检查连接处最便宜。
//
// 本测试不跑 Express，只读源码文本——所以它不会因为环境/依赖/网络而假绿。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES = path.join(__dirname);
const PAY = path.join(ROUTES, 'payment.js');

// 抓到形如 _insCnOrder(oid, product, amt, <第4个实参>, channel) 里的第 4 个实参。
// 参数里可能有嵌套逗号/括号（如 usdAmt / 100），所以按括号深度切而不是简单 split。
function orderInsertUids(src) {
  const out = [];
  const re = /_insCnOrder\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1, arg = '', args = [];
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
      if (c === ',' && depth === 1) { args.push(arg.trim()); arg = ''; }
      else arg += c;
      i++;
    }
    args.push(arg.trim());
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ uid: args[3] === undefined ? '' : args[3], line, arity: args.length });
  }
  return out;
}

test('没有任何收款通道把订单落成「无主单」（user_id 硬编码 null）', () => {
  const src = fs.readFileSync(PAY, 'utf8');
  const calls = orderInsertUids(src);
  assert.ok(calls.length >= 3,
    `只扫到 ${calls.length} 处 _insCnOrder 调用，解析逻辑或路径可能失效`);

  const ownerless = calls
    .filter(c => /^(null|undefined)$/.test(c.uid) || c.uid === '')
    .map(c => `routes/payment.js:${c.line} → 第4个实参是 ${JSON.stringify(c.uid)}，`
      + `这单永远不会被 hasFullAccess 认出来（收钱不发货）`);

  assert.deepStrictEqual(ownerless, [],
    '以下下单把 user_id 写死成空 —— 付了钱的用户永远兑换不出内容：\n  ' + ownerless.join('\n  '));
});

test('每条收款通道下单前都调了 _payResolveUser 认人', () => {
  const src = fs.readFileSync(PAY, 'utf8');

  // 三条通道的创建入口。名字写死是有意的：新增通道时这条测试应该提醒你
  // 「去认人」，而不是静默放过。
  const CHANNELS = ['/pay/wechat/create', '/pay/alipay/qr', '/pay/stripe/create'];
  const missing = [];
  for (const ep of CHANNELS) {
    const at = src.indexOf(`router.post('${ep}'`);
    if (at < 0) { missing.push(`${ep}: 找不到这个路由，通道被改名或删了，请同步本测试`); continue; }
    // 取该 handler 到下一条 router.<method>( 之间的源码块
    const rest = src.slice(at + 1);
    const next = rest.search(/\nrouter\.(post|get)\(/);
    const body = next < 0 ? rest : rest.slice(0, next);
    if (!/_payResolveUser\s*\(/.test(body)) {
      const line = src.slice(0, at).split('\n').length;
      missing.push(`routes/payment.js:${line} ${ep} 没有调 _payResolveUser`);
    }
  }
  assert.deepStrictEqual(missing, [],
    '这些收款通道没认人，订单会变成无主单：\n  ' + missing.join('\n  '));
});

test('守卫自身有效：能认出被改回 null 的写法', () => {
  const fake = `_insCnOrder(oid, product, amt, null, 'stripe');`;
  const calls = orderInsertUids(fake);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].uid, 'null');
  assert.strictEqual(calls[0].arity, 5);

  // 带嵌套逗号的实参不能被切错位
  const nested = orderInsertUids(`_insCnOrder(oid, p, Math.round(amt / 100), uid, 'alipay');`);
  assert.strictEqual(nested[0].uid, 'uid');
  assert.strictEqual(nested[0].arity, 5);
});
