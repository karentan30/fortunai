// 守卫：pages/*.html 里引用的本地 js/css/html，服务端真的能取到。
//
// 和 frontend-calls-have-routes.test.js 是同一类故障的另一半：
//   那边管「前端 fetch 的 /api 路径服务端有没有路由」，
//   这边管「前端 <script src> / <a href> 指的本地文件在不在」。
// 两边的线上表现一样：**页面不报错，功能静默失效**。
//
// 0912 实测抓到的（同一个根因，只是散在 8 个文件里）：
//   · lp-bazi-geo.html   <script src="/geo-pricing.js">  —— 文件在 public/geo-pricing.js，
//       服务端静态根是项目根目录，所以 /geo-pricing.js 是 404（线上 curl 确认），
//       地理定价脚本从来没加载过，页面价格永远是写死的那个。
//   · bio-en.html / bio-kr.html  页脚链到 privacy-en.html / terms-en.html / -kr，
//       而真正的英/韩法律文件叫 legal-en.html / legal-kr.html（带 #privacy / #terms 锚点），
//       文件名写错 → 英文/韩文用户点「隐私政策」拿 404。
//   · life-kline.html   跳 /pricing-en.html，实际英文会员页是 /pages/member-en.html。
//   · bio-cn.html       链 /pages/privacy-cn.html，实际是 /pages/privacy.html。
//
// 解析规则照抄服务端真实行为，不自己发明：
//   · express.static 的根 = 项目根目录（server/..），所以 "/assets/js/common.js" → <root>/assets/js/common.js
//   · Caddy 会把 /xxx.html 重写到 /pages/xxx.html，所以 /history.html 和 /pages/history.html 都要认
//     （这就是为什么下面 resolve 会试两个位置 —— 少试一个就会误报一片，多试没用的会假绿）
//   · **不做**「在 public/ 下也找找」这种兜底：public/geo-pricing.js 是真的存在，
//     但服务端并不在 /geo-pricing.js 提供它 —— 兜底了就等于把 404 洗成通过。
//
// 运行：node --test server/lib/frontend-assets-exist.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = path.join(ROOT, 'pages');

// 已知断链，等 Karen 拍板后才修（属产品/权限决策，不是改个文件名的事）。见 docs/交接-0911.md。
// 显式列出来而不是放宽匹配规则：将来新增的断链会立刻红，不会被豁免规则吃掉。
const KNOWN_BROKEN = new Map([
  ['/pages/admin-login.html', 'admin-feedback.html 的登录跳转目标不存在；该页要「登录用户的 role=admin」'
    + '而 authMiddleware 根本没往外带 role 字段，整套后台鉴权要 Karen 定方案'],
]);

function resolveLocal(url) {
  const p = url.replace(/^\//, '');
  for (const candidate of [p, 'pages/' + path.basename(p)]) {
    if (fs.existsSync(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

function references() {
  const out = [];
  const files = fs.readdirSync(PAGES).filter(f => /\.(html|js)$/.test(f));
  const re = /(?:src|href)\s*=\s*["'](\/[^"'\s>]*)["']/g;
  for (const f of files) {
    const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
    let m;
    while ((m = re.exec(src))) {
      const url = m[1].split('#')[0].split('?')[0];
      if (!url || url === '/') continue;
      if (!/\.(js|css|html)$/.test(url)) continue;   // 图片/CDN/外链不在这里管
      if (url.includes('${')) continue;              // 模板拼出来的路径，静态判不了
      out.push({ url, file: f });
    }
  }
  return out;
}

test('pages 里引用的本地 js/css/html 都真实存在', () => {
  const refs = references();
  assert.ok(refs.length > 300, `只抽出 ${refs.length} 条本地引用 —— 抽取逻辑失效，本测试会假绿`);

  const dead = [];
  for (const { url, file } of refs) {
    if (resolveLocal(url)) continue;
    if (KNOWN_BROKEN.has(url)) continue;
    dead.push(`${url}   ← ${file}`);
  }
  assert.deepStrictEqual([...new Set(dead)].sort(), [],
    '以下本地引用服务端取不到（线上表现=脚本不加载 / 链接 404，页面本身不报错）：\n  '
    + [...new Set(dead)].sort().join('\n  '));
});

test('守卫自身有效：认得出 404，也不会被「文件在别的目录」骗过', () => {
  // 真实存在，但不在服务端提供的位置 —— 必须判死（public/geo-pricing.js 就是这个坑）
  assert.strictEqual(resolveLocal('/geo-pricing.js'), null);
  // 真在那儿
  assert.ok(resolveLocal('/assets/js/common.js'));
  // Caddy 重写：/history.html 与 /pages/history.html 等价，都要认
  assert.ok(resolveLocal('/pages/history.html'));
  assert.strictEqual(resolveLocal('/pages/history.html'), 'pages/history.html');
  // 完全不存在
  assert.strictEqual(resolveLocal('/pages/definitely-not-here.html'), null);
});

test('钉住：豁免清单只能缩小不能悄悄变大', () => {
  // 豁免是给「已记录、等决策」的断链用的，不是垃圾桶。
  // 数量变了就得回来改这一行 —— 逼着人对着 docs 里的记录解释一句。
  assert.ok(KNOWN_BROKEN.size <= 1,
    `已知断链豁免涨到 ${KNOWN_BROKEN.size} 条，先确认每一条都真的记录在案了`);
  for (const url of KNOWN_BROKEN.keys()) {
    // 豁免的必须真的是断的 —— 修好了就该把条目删掉，别留着掩盖回归
    assert.strictEqual(resolveLocal(url), null,
      `${url} 现在已经存在了，请把它从 KNOWN_BROKEN 里删掉（豁免过期会掩盖将来的回归）`);
  }
});
