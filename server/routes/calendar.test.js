// 判据：/api/calendar/lunar 真的把农历换算成公历，且非法日期**拦住**而不是滚到下个月。
//
// 背景：collect.html 的「阳历/农历」开关此前全站没做换算，选农历的用户被按同一串数字
//   当公历排盘（静默错盘）。这个路由是新引入的唯一换算点，所以它错了 = 前端继续错。
//   真起 HTTP 请求打真路由，不重构函数内部——本项目的测试基准是运行时真值，不是
//   「我以为路由长这样」（见 frontend-calls-have-routes.test.js 的教训）。
//
// 运行：node --test server/routes/calendar.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');

const ROUTE_FILE = path.join(__dirname, 'calendar.js');

/** 载入路由（transform 可改写源码，供自证臂用）。 */
function loadRouter(transform) {
  const src = fs.readFileSync(ROUTE_FILE, 'utf8');
  const out = transform ? transform(src) : src;
  if (out === null) return null;
  const m = new Module(ROUTE_FILE, null);
  m.filename = ROUTE_FILE;
  m.paths = Module._nodeModulePaths(path.dirname(ROUTE_FILE));
  m._compile(out, ROUTE_FILE);
  return m.exports;
}

/** 起一个只听 127.0.0.1 随机端口的临时 app，打完就关。 */
async function withServer(router, fn) {
  const app = express();
  app.use('/api', router);
  const srv = http.createServer(app);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    return await fn(async (qs) => {
      const res = await fetch(base + '/api/calendar/lunar' + qs);
      return { status: res.status, body: await res.json() };
    });
  } finally {
    await new Promise(r => srv.close(r));
  }
}

test('农历 → 公历换算 + 非法日期拦截', async (t) => {
  const router = loadRouter();
  assert.ok(typeof router === 'function', 'calendar 路由应导出 express router');

  await withServer(router, async (get) => {
    await t.test('正臂1 农历1991年八月廿八 → 公历 1991-10-05', async () => {
      const r = await get('?y=1991&m=8&d=28');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.body.solar, { year: 1991, month: 10, day: 5 });
      assert.strictEqual(r.body.leap, false);
      assert.strictEqual(r.body.leapMonth, 0, '1991 年无闰月');
    });

    await t.test('正臂2 该月天数随农历月变（八月30天 / 九月29天）', async () => {
      const a = await get('?y=1991&m=8');
      assert.strictEqual(a.status, 200);
      assert.strictEqual(a.body.monthDayCount, 30);
      assert.strictEqual(a.body.solar, undefined, '不带 d 时不该返回公历日期');
      const b = await get('?y=1991&m=9');
      assert.strictEqual(b.body.monthDayCount, 29);
    });

    await t.test('正臂3 闰月：2020 闰四月十五 → 公历 2020-06-06', async () => {
      const r = await get('?y=2020&m=4&leap=1&d=15');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.leap, true);
      assert.strictEqual(r.body.leapMonth, 4);
      assert.deepStrictEqual(r.body.solar, { year: 2020, month: 6, day: 6 });
    });

    await t.test('正臂4 不勾闰月时按平月算（不能被静默当成闰月）', async () => {
      const r = await get('?y=2020&m=4&d=15');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.leap, false, '没勾闰月就必须按不闰的四月算');
      assert.deepStrictEqual(r.body.solar, { year: 2020, month: 5, day: 7 });
    });

    await t.test('正臂5 无闰月的年份误传 leap=1 不报错、按平月算', async () => {
      const r = await get('?y=1991&m=4&leap=1&d=15');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.leap, false);
      assert.strictEqual(r.body.leapMonth, 0);
    });

    await t.test('正臂6 非法日期必须 400（不许滚到下个月）', async () => {
      const r = await get('?y=1991&m=9&d=30');   // 农历九月只有 29 天
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.body.ok, false);
      assert.strictEqual(r.body.monthDayCount, 29, '要带上真实天数，前端才能提示');
      assert.match(r.body.error, /29/);
    });

    await t.test('正臂7 越界年份/月份 400', async () => {
      for (const qs of ['?y=1800&m=1&d=1', '?y=1991&m=13&d=1', '?y=1991&m=0&d=1', '?y=abc&m=1&d=1']) {
        const r = await get(qs);
        assert.strictEqual(r.status, 400, qs + ' 应 400');
        assert.strictEqual(r.body.ok, false);
      }
    });

    // ── 自证臂：撤掉「天数校验」这一行，正臂6 必须转红 ──────────────────
    await t.test('自证臂 撤掉天数校验后，非法日期不再被拦（判据有区分度）', async () => {
      const NEEDLE = 'if (d > rm.days) {';
      const patched = loadRouter((src) => {
        if (src.indexOf(NEEDLE) === -1) return null;
        return src.replace(NEEDLE, 'if (false) { /* ARM: 撤掉天数校验 */');
      });
      assert.ok(patched, '找不到 "' + NEEDLE + '" —— 自证臂失效，必须重写判据');

      await withServer(patched, async (get) => {
        const r = await get('?y=1991&m=9&d=30');
        assert.notStrictEqual(r.status, 400,
          '撤掉校验后仍返回 400 ⇒ 正臂6 不是被这一行拦的，判据指向错了');
      });
    });
  });
});
