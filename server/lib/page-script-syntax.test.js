// 静态守卫：页面的内联 <script> 必须能通过 JS 语法编译。
//
// 为什么值得单独立一个测试：一个内联 <script> 里只要有**一处**语法错误，
// 整段脚本都不会执行——不是报错一处、其余照跑，而是整块哑掉。页面还会正常
// 渲染 HTML，所以看上去「页面在」，实际所有交互都是死的，人在浏览器里要盯很久才发现。
//
// 已抓到两个真实事故（都在生产上活着很久了）：
//   · report-in.html  `'Preparing '+name+''s chart…'` —— 少转义一个撇号，
//     整页卡在 "Calculating your Four Pillars…" 转圈，报告永远出不来。
//   · inspiration.html  `'巨蟹座':[:'…']` —— 多一个 [ 和 :，
//     星座列表整个渲染不出来，页面只剩标题。
// 两个页面都不在 UI 冒烟清单里，所以光靠真浏览器走查漏掉了。静态扫全部 192 个页面最便宜。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGES = path.join(__dirname, '..', '..', 'pages');

// 🔴 必须先剥掉 HTML 注释再找 <script>。
// lp-zh-main.html 把「等你填像素 ID」的 <script> 范例整段放在 <!-- --> 里，
// 不剥的话会把注释里的模板文字当成真代码，报出一堆假语法错误，守卫就废了。
function inlineScripts(html) {
  const out = [];
  const src = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;                       // 外链脚本留给浏览器
    const type = (attrs.match(/type\s*=\s*["']([^"']+)/) || [])[1] || 'text/javascript';
    if (!/javascript|module/i.test(type)) continue;              // 跳过 JSON-LD 等数据块
    if (m[2].trim().length < 20) continue;                       // 一行都不到的空壳
    out.push({ code: m[2], index: m.index });
  }
  return out;
}

test('所有页面的内联 <script> 都能编译（一处语法错＝整段脚本哑掉）', () => {
  const broken = [];
  let blocks = 0;
  for (const f of fs.readdirSync(PAGES).filter(x => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(PAGES, f), 'utf8');
    let i = 0;
    for (const b of inlineScripts(html)) {
      i++; blocks++;
      try {
        new vm.Script(b.code, { filename: `${f}#script${i}` });
      } catch (e) {
        // 报「文件:行号」比报「第几个 script」有用得多。
        // vm.Script 的 stack 第一行就是 `<filename>:<script 内行号>`，
        // 再把该 <script> 起点在 HTML 里的行号加上，换算成文件绝对行号。
        const inScript = parseInt((e.stack || "").split("\n")[0].split(":").pop(), 10);
        const startsAt = html.slice(0, b.index).split("\n").length;
        const fileLine = Number.isFinite(inScript) ? startsAt + inScript - 1 : null;
        const src = Number.isFinite(inScript) ? (b.code.split("\n")[inScript - 1] || "").trim() : "";
        broken.push(`pages/${f}${fileLine ? ":" + fileLine : " script#" + i}: ${e.message}`
          + (src ? "\n      ↳ " + src.slice(0, 130) : ""));
      }
    }
  }
  assert.ok(blocks > 200, `扫到的内联脚本太少（${blocks}），页面路径或正则可能失效`);
  assert.deepStrictEqual(broken, [],
    '以下内联脚本编译不过 —— 该段 JS 在浏览器里会整块不执行：\n  ' + broken.join('\n  '));
});

test('守卫自身有效：能剥掉注释里的假 <script>、能跳过 JSON-LD', () => {
  // lp-zh-main.html 里注释掉的像素范例：必须一条都扫不到
  const lp = fs.readFileSync(path.join(PAGES, 'lp-zh-main.html'), 'utf8');
  const codes = inlineScripts(lp).map(b => b.code);
  assert.ok(!codes.some(c => c.includes('YOUR_TIKTOK_PIXEL_ID')),
    '剥注释失效：把注释里的像素模板当成真实代码了');

  // JSON-LD 不能被当成 JS
  const withLd = '<script type="application/ld+json">{"a":1}</script>'
    + '<script>var onlyRealScript = 1;</script>';
  assert.deepStrictEqual(inlineScripts(withLd).map(b => b.code.trim()), ['var onlyRealScript = 1;']);
});
