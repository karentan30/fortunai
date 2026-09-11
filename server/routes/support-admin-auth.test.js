// 守卫：客服工单里的用户信息不能公开读。
//
// 0912 线上实测：不带任何 token 直接 GET https://runae.app/api/support-tickets 返回 200，
// 内容是全部工单 —— 用户邮箱、提问原文、完整客服对话记录；/api/support-stats 返回 200；
// /api/support-messages/<邮箱> 也能按邮箱查到对话；POST /api/support-ticket/:id/status 谁都能改。
// 同文件里的 /api/bookings（403）和隔壁 /api/ab-stats（401）本来就是要 token 的，只有这几条漏了。
//
// 两条边界都要钉住，缺一个就会往另一个方向坏：
//   · 后台四条 → 没 token 必须 401/403（修的就是这个）
//   · 用户提交工单 POST /api/support-ticket → **必须继续公开**（support-widget / booking.html 在用），
//     加鉴权加过头会把用户提交入口一起堵死，那是比泄露更直接的损失。
//
// 运行：node --test server/routes/support-admin-auth.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const ADMIN = 'test-admin-token-0912';
process.env.ADMIN_TOKEN = ADMIN;

// 这个测试会真的 POST 一次工单，所以必须把它写到临时文件：
// 否则在服务器上跑测试（npm test 就会跑）会往真实工单库里塞一条垃圾记录，
// 还可能触发真实的通知邮件。顺带把 key 摘掉，确保不误发信。
process.env.TICKET_FILE = require('node:path').join(require('node:os').tmpdir(), 'sy-support-auth-test.jsonl');
delete process.env.RESEND_API_KEY;

const express = require('express');
const app = express();
app.use(express.json());
app.use('/api', require('./support'));
const server = app.listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const get = (p, headers) => fetch(BASE + p, { headers: headers || {} });
const post = (p, body, headers) =>
  fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body || {}),
  });

test('后台接口：不带 token 一律拒绝，且不吐任何工单内容', async () => {
  const cases = [
    ['GET', '/api/support-tickets'],
    ['GET', '/api/support-stats'],
    ['GET', '/api/support-messages/someone@example.com'],
    ['GET', '/api/bookings'],
  ];
  for (const [method, p] of cases) {
    const r = await get(p);
    assert.ok([401, 403].includes(r.status), `${method} ${p} 没 token 却返回 ${r.status}`);
    const body = await r.text();
    assert.ok(!/tickets|messages|bookings/.test(body),
      `${method} ${p} 拒绝时仍把数据带出来了：${body.slice(0, 120)}`);
  }

  // 改工单状态是写操作，同样必须挡住
  const w = await post('/api/support-ticket/tk_1/status', { status: 'resolved' });
  assert.ok([401, 403].includes(w.status), `改工单状态没 token 却返回 ${w.status}`);
});

test('后台接口：token 错了也要拒绝（不能只判「有没有带」）', async () => {
  const r = await get('/api/support-tickets', { 'x-admin-token': 'wrong-token' });
  assert.ok([401, 403].includes(r.status), `错误 token 返回了 ${r.status}`);
  const q = await get('/api/support-tickets?token=wrong-token');
  assert.ok([401, 403].includes(q.status), `query 里的错误 token 返回了 ${q.status}`);
});

test('后台接口：正确 token 放行（两种带法都行）', async () => {
  const h = await get('/api/support-tickets', { 'x-admin-token': ADMIN });
  assert.strictEqual(h.status, 200, `header 带正确 token 却 ${h.status}`);
  assert.strictEqual((await h.json()).ok, true);

  const q = await get(`/api/support-stats?token=${ADMIN}`);
  assert.strictEqual(q.status, 200, `query 带正确 token 却 ${q.status}`);
});

test('用户提交工单必须仍然公开（加鉴权别加过头）', async () => {
  const r = await post('/api/support-ticket', {
    product: 'shenyuan', email: 'user@example.com', question: '测试',
  });
  assert.strictEqual(r.status, 200,
    '用户提交工单被鉴权挡住了 —— support-widget.html / booking.html 提交入口会全线失效');
  assert.strictEqual((await r.json()).ok, true);
});

test('用户提交工单仍做校验（没被这一轮改松）', async () => {
  const bad = await post('/api/support-ticket', { email: 'not-an-email', question: 'x' });
  assert.strictEqual(bad.status, 400, `无效邮箱应 400，实际 ${bad.status}`);
});
