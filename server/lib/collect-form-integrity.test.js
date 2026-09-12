// 守卫：collect.html 不许「静默丢状态」和「静默收非法输入」。
//
// 0912 主路口实测抓到的两条（都是页面不报错的那一类）：
//   ① 回访丢状态：方向和照片解锁态都不从存档还原。用户回到这页直接点下一步，
//      提交出去的 aspects 被改写成页面默认的「事业/爱情」、hasPalm 变成 false ——
//      把存档里原有的解锁态**覆盖掉**，于是到了选推演那页手相又被锁上。
//      用户加过照片、也明明选过方向，却说不出哪里变了。
//   ② 非法日期放行：日期下拉恒为 1..31，不随年月收敛，2月31日也能选出来；
//      而引擎不会报错（儒略日公式把它偏移成相邻一天），照样排出一套看着正常的干支。
//
// 这两条用真浏览器验过（日期 28/29/30 天、2月31日被拦、回访还原 2 个方向 + 1 个解锁态、
// 再次提交后 hasPalm 仍为 true）。这里做源码级钉死，防止被人顺手删掉。
//
// 运行：node --test server/lib/collect-form-integrity.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'collect.html'), 'utf8');

test('回访必须还原方向多选（不能被页面默认值顶掉）', () => {
  assert.match(SRC, /P\.aspects\.indexOf\(c\.dataset\.a\)/,
    '方向不再从存档还原了 —— 老用户的选择会被静默改写成「事业/爱情」');
});

test('回访必须还原照片解锁态（否则会把存档覆盖成未解锁）', () => {
  assert.match(SRC, /if\(P\.hasPalm\)\s*photos\.palm/, '手相解锁态不再还原');
  assert.match(SRC, /if\(P\.hasFace\)\s*photos\.face/, '面相解锁态不再还原');
});

test('日期下拉必须随年月收敛，且提交时兜底校验', () => {
  // 收敛：按年月算当月天数重建列表
  assert.match(SRC, /new Date\(y,\s*m,\s*0\)\.getDate\(\)/,
    '日期列表不再随年月收敛 —— 2月31日/4月31日又能选出来了');
  assert.match(SRC, /ys\.onchange\s*=\s*refillDays|onchange\s*=\s*refillDays/,
    '改了年/月没有重算日期列表');
  // 兜底：绕过下拉（改 DOM、旧存档）也不能把不存在的日期送进引擎
  assert.match(SRC, /if\(\+_d\s*>\s*new Date\(\+_y,\+_m,0\)\.getDate\(\)\)/,
    '提交时少了「这一天是否存在」的兜底校验');
  assert.match(SRC, /alertDateReal:/, '少了非法日期的提示文案');
});

test('性别校验和「记住上次选择」都还在（这几条是本轮一起立起来的）', () => {
  assert.match(SRC, /alert\(t\.alertGender\)/, '性别校验被删了');
  assert.match(SRC, /if\(P\.gender\)/, '恢复上次选性别的逻辑被删了');
});
