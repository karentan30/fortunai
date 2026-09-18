'use strict';
// W2 漏斗埋点：白名单、sendBeacon(text/plain) 能收、管理口令、去重计数、不进 data.json
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-ev-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
process.env.ADMIN_TOKEN = 'adm_test';

const express = require('express');
const { router, funnel } = require('./events');
const app = express();
app.use(express.json());
app.use('/api', router);
const srv = app.listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
test.after(() => srv.close());

const beacon = (o) => fetch(BASE + '/api/ev', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(o) });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('sendBeacon 的 text/plain 能收，JSON 也能收', async () => {
  assert.strictEqual((await beacon({ e: 'collect_view', sid: 's1', lang: 'en' })).status, 204);
  const r = await fetch(BASE + '/api/ev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ e: 'pick_view', sid: 's1' }) });
  assert.strictEqual(r.status, 204);
});

test('白名单外的事件拒收，也不落盘', async () => {
  assert.strictEqual((await beacon({ e: 'rm_rf', sid: 's1' })).status, 400);
  await wait(50);
  const txt = fs.readdirSync(path.join(TMP, 'events')).map(f => fs.readFileSync(path.join(TMP, 'events', f), 'utf8')).join('');
  assert.ok(!txt.includes('rm_rf'));
});

test('字段被截断，不收原始 IP', async () => {
  await beacon({ e: 'collect_view', sid: 'x'.repeat(500), camp: 'c'.repeat(500) });
  await wait(50);
  const f = fs.readdirSync(path.join(TMP, 'events'))[0];
  const rows = fs.readFileSync(path.join(TMP, 'events', f), 'utf8').trim().split('\n').map(JSON.parse);
  const last = rows[rows.length - 1];
  assert.ok(last.sid.length <= 48 && last.camp.length <= 64);
  assert.ok(!JSON.stringify(rows).includes('127.0.0.1'));
  assert.strictEqual(last.ih.length, 8);
});

test('看板要管理口令；给了口令能拿到按人去重的漏斗', async () => {
  assert.strictEqual((await fetch(BASE + '/api/kpi/funnel')).status, 401);
  assert.strictEqual((await fetch(BASE + '/api/kpi/funnel', { headers: { 'x-admin-token': 'wrong' } })).status, 401);
  await beacon({ e: 'collect_view', sid: 's1' });   // 同一人重复进入，只算一次
  await beacon({ e: 'collect_view', sid: 's2', lang: 'zh' });
  await wait(50);
  const r = await fetch(BASE + '/api/kpi/funnel?days=1&by=lang', { headers: { 'x-admin-token': 'adm_test' } });
  assert.strictEqual(r.status, 200);
  const d = await r.json();
  const en = d.groups.en.find(s => s.e === 'collect_view').n;
  const zh = d.groups.zh.find(s => s.e === 'collect_view').n;
  assert.strictEqual(en, 1);
  assert.strictEqual(zh, 1);
});

test('没 sid 时用 IP 哈希兜底去重', () => {
  const g = funnel([{ e: 'paid', ih: 'aaaa' }, { e: 'paid', ih: 'aaaa' }, { e: 'paid', ih: 'bbbb' }]);
  assert.strictEqual(g.all.find(s => s.e === 'paid').n, 2);
});

test('埋点绝不写进 data.json', () => {
  assert.ok(!fs.existsSync(process.env.DATA_FILE) || !fs.readFileSync(process.env.DATA_FILE, 'utf8').includes('collect_view'));
});
