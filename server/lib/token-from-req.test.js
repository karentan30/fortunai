// 钉住「空 Bearer 必须回退 cookie」这条 —— 它挂过一整条付费链路。
//
// 背景：新版登录只下发 httpOnly cookie（JS 读不到），而站内大量页面写的是
//   headers: { Authorization: 'Bearer ' + (localStorage.getItem('sy_token')||'') }
// 拿不到 localStorage 时就发出「Authorization: Bearer 」（尾部为空）。
// 旧实现一看到前缀 'Bearer ' 就 return 空串，**永远不会走到 cookie 回退**，
// 于是已登录会员被判成匿名：付费报告不解锁、聊天额度按 IP 算、会员等级失效。
const test = require('node:test');
const assert = require('node:assert');
const { _tokenFromReq } = require('./store');

function req(headers, body) {
  return { headers: Object.assign({}, headers), body: body || {} };
}

test('Bearer 带真令牌 → 取到令牌', () => {
  assert.strictEqual(_tokenFromReq(req({ authorization: 'Bearer tok123' })), 'tok123');
});

test('🔴 空 Bearer + cookie → 必须回退到 cookie', () => {
  assert.strictEqual(
    _tokenFromReq(req({ authorization: 'Bearer ', cookie: 'sy_token=fromcookie; other=1' })),
    'fromcookie'
  );
});

test('🔴 空 Bearer + body.token → 回退到 body', () => {
  assert.strictEqual(
    _tokenFromReq(req({ authorization: 'Bearer ' }, { token: 'frombody' })),
    'frombody'
  );
});

test('Bearer 只有空格 → 视为空，继续回退', () => {
  assert.strictEqual(
    _tokenFromReq(req({ authorization: 'Bearer    ', cookie: 'sy_token=abc' })),
    'abc'
  );
});

test('没有 Authorization，只有 cookie → 取 cookie', () => {
  assert.strictEqual(_tokenFromReq(req({ cookie: 'a=1; sy_token=xyz; b=2' })), 'xyz');
});

test('cookie 值里的 = 不被截断（base64 token）', () => {
  assert.strictEqual(_tokenFromReq(req({ cookie: 'sy_token=ab=cd=ef' })), 'ab=cd=ef');
});

test('body.token 为空串 → 继续回退到 cookie', () => {
  assert.strictEqual(
    _tokenFromReq(req({ cookie: 'sy_token=real' }, { token: '' })),
    'real'
  );
});

test('什么都没有 → 空串（匿名）', () => {
  assert.strictEqual(_tokenFromReq(req({})), '');
  assert.strictEqual(_tokenFromReq({ headers: {}, body: {} }), '');
  assert.strictEqual(_tokenFromReq({}), '');
});

test('Authorization 不是 Bearer 方案 → 不吃掉，继续回退', () => {
  assert.strictEqual(
    _tokenFromReq(req({ authorization: 'Basic zzz', cookie: 'sy_token=ok' })),
    'ok'
  );
});
