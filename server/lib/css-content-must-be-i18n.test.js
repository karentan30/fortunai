// 守卫：双语页面里，写死在 CSS `content:` 里的文案会永远漏翻。
//
// 0912 主路口实测抓到的：
//   pick.html 有 `.mcard.rec::after{content:'为你推荐'}` —— 带 zh/en 两套语言包的页面，
//   卡片角标却是 CSS 里的死中文。JS 只改 textContent/innerHTML，**永远碰不到 CSS 的 content**，
//   所以切到 ?lang=en 时英文页主卡右上角照旧挂着中文「为你推荐」：不报错、不 undefined、不白屏。
//
// 为什么单挑「双语页」：只有 zh/en 两套包的页面，本身就是「每个用户可见字符串都该随语言走」的约定，
//   判得死、不会误伤。像 home-kr.html 的 content:'가장 인기'（韩语页配韩语文案）就是对的，不在这里管。
//
// 刻意**不**管 `content:var(--x,'中文兜底')` 这种：那是 JS 灌值失败时的兜底，属于有意为之。
// 代价是这个守卫看不见兜底里的中文 —— 明确记在这里，免得以后以为它管得比实际宽。
//
// 运行：node --test server/lib/css-content-must-be-i18n.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PAGES = path.join(__dirname, '..', '..', 'pages');

// content: 后面紧跟字符串字面量，且里面含中日韩表意文字
const CJK_IN_CONTENT = /content:\s*(['"])(?:(?!\1).)*[一-鿿](?:(?!\1).)*\1/g;

// zh / en 两套语言包都存在（不要求分行、不要求特定声明写法 —— 之前按行首匹配太脆，
// 单行写的包会认不出来，那种「守卫没认出页面」的失效是静默的）
function isBilingual(src) {
  return /\bzh\s*:\s*[{'"[]/.test(src) && /\ben\s*:\s*[{'"[]/.test(src);
}

test('双语页面不得把用户可见文案写死在 CSS content 里', () => {
  const files = fs.readdirSync(PAGES).filter(f => f.endsWith('.html'));
  const scanned = [], hits = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
    if (!isBilingual(src)) continue;
    scanned.push(f);
    for (const m of src.matchAll(CJK_IN_CONTENT)) hits.push(`${f}  ${m[0].slice(0, 60)}`);
  }
  assert.ok(scanned.length >= 4, `只认出 ${scanned.length} 个双语页 —— 判定逻辑失效，本测试会假绿`);
  assert.deepStrictEqual(hits, [],
    '这些页面切到英文时会把中文露出来（CSS content 无法被 JS 覆盖）：\n  ' + hits.join('\n  '));
});

test('守卫自身有效：认得死中文，不误伤符号和变量兜底', () => {
  assert.ok(isBilingual("var T={ zh:{a:1}, en:{a:2} };"));
  assert.ok(!isBilingual("<div>只有中文</div>"));

  const hit = s => [...s.matchAll(CJK_IN_CONTENT)].length;
  assert.strictEqual(hit(".x::after{content:'为你推荐'}"), 1, '认不出单引号死中文');
  assert.strictEqual(hit('.x::after{content:"为你推荐"}'), 1, '认不出双引号死中文');
  assert.strictEqual(hit(".x::after{content:'✦'}"), 0, '符号不该报');
  assert.strictEqual(hit(".x::after{content:var(--rec,'为你推荐')}"), 0, '变量兜底按设计放行');
  assert.strictEqual(hit(".x::after{content:''}"), 0, '空值不该报');
});

test('pick.html 的角标确实改成了按语言注入', () => {
  const src = fs.readFileSync(path.join(PAGES, 'pick.html'), 'utf8');
  assert.match(src, /--rec-badge/, 'pick.html 的角标没有走 CSS 变量，英文页会再露出中文');
  assert.match(src, /recBadge:'为你推荐'/, '中文包少了 recBadge');
  assert.match(src, /recBadge:'Recommended'/, '英文包少了 recBadge');
  assert.match(src, /setProperty\('--rec-badge'/, '没有把当前语言的文案灌进 CSS 变量');
});
