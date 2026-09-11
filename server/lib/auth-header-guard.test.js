// 静态守卫：禁止任何路由再手工解析 Authorization 头。
//
// 为什么值得单独立一个测试：前端几乎所有页面都发
//   headers: { Authorization: 'Bearer ' + (localStorage.getItem('sy_token')||'') }
// 而新版登录只下发 httpOnly cookie（JS 读不到），于是请求头恒为「Bearer 」+空。
// 手工写法 `req.headers['authorization'] || req.body.token` 会让这个**非空字符串**
// 短路掉 body 与 cookie 两条回退路径，已登录会员被判成匿名。
//
// 这个 bug 已经先后出现在 store.js / divination.js / daily.js / 4 个测算路由上，
// 每次表现都是「付费内容不解锁、额度按 IP 算、会员等级失效」——
// 全是静默失败，UI 全绿也测不出来。所以这里用静态扫描把它钉死：
// 全仓库只允许 store.js 的 _tokenFromReq 一个地方读这个头，其余一律走它。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ALLOWLIST = [
  path.join('lib', 'store.js'),   // _tokenFromReq 本体，唯一合法读头处
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (!e.name.endsWith('.js')) continue;
    if (e.name.endsWith('.test.js')) continue;
    out.push(p);
  }
  return out;
}

test('🔴 除 store.js 外，没有路由手工解析 Authorization 头', () => {
  const bad = [];
  for (const f of walk(ROOT, [])) {
    const rel = path.relative(ROOT, f);
    if (ALLOWLIST.includes(rel)) continue;
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/headers\s*(\[['"]authorization['"]\]|\.authorization)/i.test(line)) {
        bad.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepStrictEqual(bad, [],
    '\n手工读 Authorization 会漏掉 cookie 回退（空 Bearer 会短路），改用 _tokenFromReq(req)：\n' + bad.join('\n'));
});

test('🔴 没有 slice(7) / replace(\'Bearer \') 这类手写前缀剥离', () => {
  const bad = [];
  for (const f of walk(ROOT, [])) {
    const rel = path.relative(ROOT, f);
    if (ALLOWLIST.includes(rel)) continue;
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/\.slice\(\s*7\s*\)/.test(line) || /replace\(\s*['"]Bearer /.test(line)) {
        bad.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepStrictEqual(bad, [],
    '\n手写剥离前缀会在令牌为空时静默降级成匿名，改用 _tokenFromReq(req)：\n' + bad.join('\n'));
});

test('守卫自身有效：能扫到文件', () => {
  const files = walk(ROOT, []);
  assert.ok(files.length > 20, '扫描到的 js 文件太少（' + files.length + '），守卫可能失效');
  assert.ok(files.some(f => f.endsWith(path.join('lib', 'store.js'))), '没扫到 store.js');
});
