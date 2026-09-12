// 守卫：会改变推演结果的表单字段，不允许被静默预填。
//
// 0912 主路口实测发现的真问题（不是猜的）：
//   collect.html 的 <select id="gender"> 第一位是「女」而不是占位项，而 HTML 的 <select>
//   在没有 selected 时**默认选中第一项** —— 于是任何没注意到这个下拉框的用户，提交的都是
//   gender:'female'。性别不是标签，它决定大运顺逆：同一生辰（1990-06-15 08:30）实跑引擎，
//   女命大运起于 **4 岁**（4/14/24/34），男命起于 **8 岁**（8/18/28/38），整条序列不同。
//   也就是说：男性用户会拿到一份按女命排的报告，而页面上看起来一切正常、没有任何报错。
//
// 这条守卫刻意只管「首位选项带值」这一种形态 —— 那是 <select> 静默预填的唯一成因，
// 判得死、不会假绿。像生日那种首位是空占位、由用户显式选择的，不受影响。
//
// 运行：node --test server/lib/form-no-silent-default.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PAGES = path.join(__dirname, '..', '..', 'pages');

// 已记录、待处理：这两页同样是「性别首位带值」，但不在主路口（collect.html）上，
// 本轮按 Karen「先把主路口做好」的要求没有动。显式列出而不是放宽规则，
// 免得将来新增的页面混进豁免里不被发现。
const KNOWN_PENDING = new Map([
  ['life-kline.html', '首位是 Male，女性用户不注意会拿到男命大运'],
  ['ziwei-en.html',   '首位是 Male，同上'],
]);

// 抓 <select id="gender"> 的第一个 <option>，返回「用户不选时会提交的那个值」。
// 注意这里返回的是**提交值**而不是 value 属性：<option>女</option> 没有 value 时，
// 表单提交的是它的文本「女」—— 同样是静默预填，不能当成空占位放过去。
function firstOptionValue(html) {
  const sel = html.match(/<select[^>]*id="gender"[^>]*>([\s\S]*?)<\/select>/);
  if (!sel) return null;
  const opt = sel[1].match(/<option([^>]*)>([\s\S]*?)<\/option>/);
  if (!opt) return null;
  const v = opt[1].match(/value\s*=\s*"([^"]*)"/);
  return v ? v[1] : opt[2].replace(/<[^>]*>/g, '').trim();
}

test('性别下拉框不得静默预填（首位必须是空占位）', () => {
  const files = fs.readdirSync(PAGES).filter(f => f.endsWith('.html'));
  const checked = [], bad = [];
  for (const f of files) {
    const v = firstOptionValue(fs.readFileSync(path.join(PAGES, f), 'utf8'));
    if (v === null) continue;
    checked.push(f);
    if (v !== '' && !KNOWN_PENDING.has(f)) bad.push(`${f}  首位 value="${v}" ← 用户不选就会按这个提交`);
  }
  assert.ok(checked.length >= 5, `只找到 ${checked.length} 个性别下拉框 —— 匹配逻辑失效，守卫会假绿`);
  assert.deepStrictEqual(bad, [],
    '这些页面的性别下拉框会静默预填（后果=按错误性别排大运，页面不报错）：\n  ' + bad.join('\n  '));
});

test('主路口 collect.html 必须显式校验性别', () => {
  const src = fs.readFileSync(path.join(PAGES, 'collect.html'), 'utf8');
  assert.match(src, /alert\(t\.alertGender\)/,
    'collect.html 少了性别校验 —— 用户不选性别就能带着默认值走进报告');
  // 双语都要有，别只补中文
  assert.match(src, /alertGender:'请选择性别'/);
  assert.match(src, /alertGender:'Please select your gender'/);
  // 恢复了上次选择的路径要留着：回头客不该重复点
  assert.match(src, /if\(P\.gender\)/, '恢复上次选择的逻辑被删了 —— 回头客每次都要重点一遍');
});

test('守卫自身有效：认得出带值、也认得出无 value 属性的写法', () => {
  assert.strictEqual(firstOptionValue('<select id="gender"><option value="">请选择</option></select>'), '');
  assert.strictEqual(firstOptionValue('<select id="gender"><option value="female">女</option></select>'), 'female');
  // 没有 value 属性时提交的是选项文本，同样算「带值」—— 这条最容易漏
  assert.strictEqual(firstOptionValue('<select id="gender"><option>女</option></select>'), '女');
  assert.strictEqual(firstOptionValue('<select id="other"><option value="x">x</option></select>'), null);
  // 属性顺序不同也要认得
  assert.strictEqual(firstOptionValue('<select class="a" id="gender" name="g"><option value="male">男</option></select>'), 'male');
});

test('豁免清单只能缩小不能悄悄变大', () => {
  assert.ok(KNOWN_PENDING.size <= 2,
    `待处理清单涨到 ${KNOWN_PENDING.size} 条 —— 新增的应直接修掉，而不是加进豁免`);
});
