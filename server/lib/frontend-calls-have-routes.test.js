// 守卫：前端 fetch 的每个 /api/... 路径，服务端真的注册了路由。
//
// 为什么值得单独立一个测试（0912 真实事故，一次抓到 9 处）：
//   pages/*.html 里的 fetch 是**手写字符串**，服务端路由是另一套名字。两边一旦对不上，
//   表现是 404 —— 而 404 在页面上通常只表现为「点了没反应」「一直空着」：
//     · account.html:  /api/user/profile、/api/user/change-password、
//                      /api/auth/verify-password、/api/subscription/history
//       这四个路由的文件 (routes/profile.js、routes/subscription-history.js) **存在**
//       但从没被 index.js require/mount 过 —— 「文件在、路由不在」，看目录结构完全看不出来。
//       用户在「账号设置」里存资料、改密码永远失败，且改密码那条永远报「当前密码错误」。
//     · duanshi.html:  POST /api/duanshi，而服务端只有 /api/duanshi/stream。
//     · life-events.html: POST /api/booking，服务端没有这个路由。
//     · 5 个落地页 POST /api/track、/api/ab-event、/api/ab-impression，
//       而服务端只有 /api/ab-track —— A/B 归因和 CTA 埋点静默全丢（还都裹着 .catch(){}）。
//   这类错「页面上没有任何报错」：UI 冒烟只测页面能不能渲染，不点每个按钮、
//   更不看响应码；curl 探活得先知道要探哪个路径 —— 只有静态比对两边最便宜。
//
// 基准是 **Express 自己的路由表**，不重新实现路由解析：require index.js 之前劫持
// app.use 记下挂载前缀，再遍历 router.stack 里的 layer.route.path。那是运行时真值，
// 所以不会因为「我以为路由长这样」而假绿（本项目就有两处 router 文件存在但没挂载）。
//
// 运行：node --test server/lib/frontend-calls-have-routes.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '..');
const PAGES = path.join(SERVER, '..', 'pages');

// ── 1) 造一个可安全 require 的环境 ────────────────────────────────────────
//  · DATA_FILE 指向临时副本：绝不能让测试进程读到/写到真实 data.json
//  · node-cron 换成空实现、setInterval 全部 unref：否则定时任务把事件循环钉住，
//    测试跑完 node --test 不退出（实测会干等 2 分钟才被杀）
//  · app.listen 换成空实现：不需要真占端口，而且 .env 里 PORT=3021 会盖掉环境变量
//  · 注意**不能**设 VERCEL=1：push / vapid 两个 router 只在非 Vercel 分支里挂载，
//    设了它就会把线上真实存在的路由漏掉 —— 正是这个测试要防的假绿
function bootApp() {
  const tmp = path.join(os.tmpdir(), 'sy-routes-test-data.json');
  const src = path.join(SERVER, 'data.json');
  fs.writeFileSync(tmp, fs.existsSync(src) ? fs.readFileSync(src) : '{}');
  process.env.DATA_FILE = tmp;

  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'node-cron') return { schedule: () => ({ stop() {}, destroy() {} }) };
    return origLoad.apply(this, arguments);
  };
  const realSetInterval = global.setInterval;
  global.setInterval = function () { const h = realSetInterval.apply(this, arguments); if (h && h.unref) h.unref(); return h; };

  const express = require('express');
  const mounts = [];
  const origUse = express.application.use;
  express.application.use = function (p, ...rest) {
    const router = rest.find(a => a && typeof a === 'function' && a.stack);
    if (router) mounts.push({ prefix: typeof p === 'string' ? p : '', router });
    return origUse.apply(this, [p, ...rest]);
  };
  express.application.listen = function () { return { close() {} }; };

  const app = require(path.join(SERVER, 'index.js'));
  Module._load = origLoad;
  global.setInterval = realSetInterval;
  return { app, mounts };
}

// index.js 只会被真正执行一次（require 缓存），而且劫持 app.use 必须在 require 之前装好。
// 所以整个文件只 boot 一次，后面几个 test 复用同一份路由表。
let _booted = null;
const bootOnce = () => (_booted ||= bootApp());

// ── 2) 从 Express 路由表取真值 ───────────────────────────────────────────
// 只走两条路：app 自己注册的叶子路由 + app.use(prefix, router) 记下来的前缀。
// **不做** 从 layer.regexp 反推前缀——那个正则只能取到第一段，
// 会把 app.use('/api/invite', r) 的路由错标成 /api/:inviteId（一个不存在的 2 段通配，
// 反而把每个 2 段的 GET 都判成「存在」）。本项目没有 router 内部的嵌套挂载；
// 真出现了就在下面 assert 里报出来，而不是静默漏掉。
function routeTable(app, mounts) {
  const out = new Set();
  const join = (a, b) => ((a + b).replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/');
  let nested = 0;

  const walk = (router, prefix, depth) => {
    for (const layer of (router.stack || [])) {
      if (layer.route) {
        for (const m of Object.keys(layer.route.methods)) {
          out.add(`${m.toUpperCase()} ${join(prefix, layer.route.path)}`);
        }
      } else if (layer.name === 'router' && depth > 0) {
        // app 自己那层（depth 0）的 router 都由 mounts 记了前缀；
        // router 内部再套 router 的话，前缀就推不出来了 → 报出来而不是静默漏
        nested++;
      }
    }
  };
  walk(app._router, '', 0);
  for (const { prefix, router } of mounts) walk(router, prefix, 1);
  return { routes: out, nested };
}

// ── 3) 从 pages/*.html 抽出前端调用的 /api 路径 ──────────────────────────
// 关键区分「写死的路径」和「拼出来的路径」：
//   fetch('/api/duanshi', ...)          → 写死，路径必须精确存在
//   fetch('/api/invite/' + code, ...)   → 拼的（字面量以 / 结尾或后面跟 + / ${}），
//                                          只要求这条路由族存在
// 不做这个区分时，'/api/invite' 这种前缀会把 '/api/duanshi'（真错）一起放行。
function frontendPaths() {
  const refs = new Map();   // 归一化路径 → { files:Set, exact:boolean }
  const re = /(['"`])(\/api\/[^'"`\n]*)\1(\s*\+)?/g;
  for (const f of fs.readdirSync(PAGES).filter(x => /\.(html|js)$/.test(x))) {
    const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
    let m;
    while ((m = re.exec(src))) {
      const raw = m[2];
      const dynamic = !!m[3] || /\$\{/.test(raw) || raw.endsWith('/');
      // 查询串不算路径：'/api/products?x=1' 找的是 /api/products 这条路由
      const p = raw.split('?')[0].replace(/\$\{[^}]*\}/g, '*').replace(/\/+$/, '');
      if (p === '/api' || !p) continue;
      const key = (dynamic ? '~' : '=') + p;
      if (!refs.has(key)) refs.set(key, { p, dynamic, files: new Set() });
      refs.get(key).files.add(f);
    }
  }
  return [...refs.values()];
}

const segs = (s) => s.split('/').filter(Boolean);

// 精确匹配：段数相同，参数段(:x)与通配段(*)匹配任意段，其余字面量必须一致。
// allowPrefix 只给「拼出来的」路径用：'/api/invite' 允许命中 '/api/invite/:inviteId'。
function matchedBy(routes, p, allowPrefix) {
  const ps = segs(p);
  for (const r of routes) {
    const rp = segs(r.split(' ')[1]);
    if (rp.length < ps.length) continue;
    if (!allowPrefix && rp.length !== ps.length) continue;
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (rp[i].startsWith(':') || ps[i] === '*') continue;
      if (rp[i] !== ps[i]) { ok = false; break; }
    }
    if (ok) return r;
  }
  return null;
}

// ── 4) 断言 ─────────────────────────────────────────────────────────────
test('前端 fetch 的每个 /api 路径，服务端都有对应路由', () => {
  const { app, mounts } = bootOnce();
  const { routes, nested } = routeTable(app, mounts);
  assert.strictEqual(nested, 0,
    `发现 ${nested} 处路由内部嵌套挂载，本测试的解析走不到 —— 请扩充 walker，别让它假绿`);
  assert.ok(routes.size > 100, `只解析出 ${routes.size} 条路由 —— 路由表解析失效，本测试会假绿`);

  const refs = frontendPaths();
  assert.ok(refs.length > 50, `只从 pages/ 抽出 ${refs.length} 个 /api 路径 —— 抽取逻辑失效`);

  const dead = [];
  for (const { p, dynamic, files } of refs.sort((a, b) => a.p.localeCompare(b.p))) {
    if (!matchedBy(routes, p, dynamic)) {
      dead.push(`${p}   ← ${[...files].sort().join(', ')}`);
    }
  }
  assert.deepStrictEqual(dead, [],
    '以下前端调用的接口服务端没有路由（线上表现=点了没反应/静默丢数据，页面不报错）：\n  '
    + dead.join('\n  '));
});

test('钉住：account.html / duanshi / 埋点 这些曾经 404 的接口必须在路由表里', () => {
  const { app, mounts } = bootOnce();
  const { routes } = routeTable(app, mounts);

  // { 方法 路径, 谁在用 } —— 左侧是**线上真值**：0912 用 curl 逐条探过，当时全是 404
  const MUST_EXIST = [
    ['POST /api/user/profile',            'account.html 保存资料'],
    ['POST /api/user/change-password',    'account.html 修改密码'],
    ['POST /api/auth/verify-password',    'account.html 校验当前密码'],
    ['GET /api/subscription/history',     'account.html 订阅历史'],
    ['POST /api/booking',                 'life-events.html 预约表单（11 个页面链到它）'],
    ['GET /api/bookings',                 '预约列表（后台查询，需 ADMIN_TOKEN）'],
    ['POST /api/ab-track',                '5 个落地页的 A/B 与 CTA 埋点'],
    ['POST /api/duanshi/stream',          'duanshi.html 断事问卦'],
  ];
  const missing = MUST_EXIST.filter(([r]) => !routes.has(r)).map(([r, who]) => `${r}  (${who})`);
  assert.deepStrictEqual(missing, [],
    '这些接口又没了 —— 挂载被删掉，功能会静默变回 404：\n  ' + missing.join('\n  '));
});

test('守卫自身有效：能认出没挂载的路由，也不会被同名前缀骗过', () => {
  const routes = new Set([
    'POST /api/pay/wechat/create', 'GET /api/products',
    'POST /api/invite/save', 'GET /api/invite/:inviteId', 'GET /api/affiliate/track',
  ]);
  // 完全不存在 → 必须抓到
  assert.strictEqual(matchedBy(routes, '/api/user/profile', false), null);
  // 拼出来的路径：命中同族即可
  assert.ok(matchedBy(routes, '/api/invite', true));
  // 写死的路径不许被前缀沾光 —— 这条正是 '/api/duanshi' 会被 '/api/duanshi/stream' 放行的原因
  assert.strictEqual(matchedBy(routes, '/api/duanshi', false), null);
  assert.ok(matchedBy(new Set(['POST /api/duanshi/stream']), '/api/duanshi/stream', false));
  // 名字像但不同 → 必须抓（/api/affiliate/track 不等于 /api/track）
  assert.strictEqual(matchedBy(routes, '/api/track', false), null);
  // 参数段通配
  assert.strictEqual(matchedBy(routes, '/api/pay/wechat/create', false), 'POST /api/pay/wechat/create');
});
