// 「月会员本月那一份报告额度」的判定测试（0912 主路口 P0）。
//
// 线上症状：付着月费的会员在主路口读八字报告，看到的是免费预览 + 一个「再付一次」的付费墙；
//   而他并没有超限——这个月一次都还没看。
//
// 根因：额度只按 uid+自然月计数（reportCredits['1_rc_2026-09']=1），**不记花在哪份报告上**。
//   而报告页一次浏览要发多个请求（拿 meta 1 个 + 免费章 1 个 + 各付费章 7 个）。第 1 个请求
//   就把唯一的额度扣掉，第 2 个起被判「额度用尽」→ 降级成免费预览 + 付费墙。
//
// 修法：调用方显式给一个 reportId（"这是哪一份报告"）。同一份报告本月的后续请求直接放行、
//   不重复扣；换一份报告仍要各自一份额度，「每月 1 份」的上限不变。
//   🔴 reportId 绝**不能**从 productKeys 推：那是类目并集数组，被多个不同报告共用
//   （见下面「不同报告共用同一个 productKeys 数组」那条回归测试）。
//
// 这份测试用临时 DATA_FILE 起一个独立的 store 实例，所以不会碰生产 data.json。
//
// 运行：node --test server/lib/store-monthly-credit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 必须在 require 之前落定 —— store.js 在模块顶层读 process.env.DATA_FILE
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-credit-'));
const DATA_FILE = path.join(TMP, 'data.json');
process.env.DATA_FILE = DATA_FILE;

const MONTH = new Date().toISOString().slice(0, 7);
const CREDIT_KEY = '1_rc_' + MONTH;        // 计数 key（uid=1）
const SPENT_KEY = '1_rcs_' + MONTH;        // 「花在哪份报告上」标记 key

// 八字报告的真实端点用的三套数组（语言分支各写各的，这是 report-cn/report-v2 两个页面
// 读同一份八字报告却算出不同 group 的来源 —— 所以身份只能由 reportId 给）
const BAZI_A = ['bazi', '八字', '사주'];
const BAZI_B = ['bazi', '八字'];
// 🔴 类目并集数组：/api/ziwei、/api/xingming、/api/astrology 三个**不同报告**共用这一个数组
const UNION_11 = ['bazi', 'hehun', 'ziwei', 'xingming', 'astrology', '八字', '合婚', '紫微', '姓名', '占星', '星盘'];

const REQ = { headers: { authorization: 'Bearer tok_m' } };
const REQ_OTHER = { headers: { authorization: 'Bearer tok_n' } };

function seed(extra) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(Object.assign({
    users: [
      { id: 1, email: 'member@example.com', name: 'M' },
      { id: 2, email: 'free@example.com', name: 'N' },
    ],
    tokens: [
      { id: 1, user_id: 1, token: 'tok_m' },
      { id: 2, user_id: 2, token: 'tok_n' },
    ],
    orders: [{
      id: 1, order_no: 'o1', product: 'member_monthly', amount: 990, currency: 'usd',
      user_id: 1, payment_status: 'completed',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 20 * 864e5).toISOString(),
    }],
    _id: { u: 3, t: 3, o: 2, r: 1, s: 1, rf: 1 },
  }, extra || {})));
}

seed();                       // 必须在 require 之前写好：store 顶层就会 _loadStore()
let S = require('./store');

function reset(extra) {
  seed(extra);
  S._M.reportCredits = {};
  S._M.reportCreditSpentOn = {};
  S._M.reportCreditServed = {};
  S._M.rewards = [];
}

// 每个用例现造一个干净的请求对象。别共用顶层 REQ：gateReportAccess 会往上写
// _syCreditUid/_syCreditReport，共用会让用例的结果依赖执行顺序（复审指出的坑）。
function reqFor(token) {
  return { headers: { authorization: 'Bearer ' + token } };
}

test('月会员同一份报告的第 2..N 个请求不再被判「额度用尽」（这就是线上那个 P0）', () => {
  reset();

  const r1 = S.gateReportAccess(REQ, BAZI_A, 'bazi');
  assert.strictEqual(r1.full, true, '第 1 个请求都没放行 —— 门本身坏了');
  assert.strictEqual(r1.viaCredit, true, '第 1 个请求应是真的扣了额度');
  assert.strictEqual(S.monthlyReportCreditRemaining(1), 0, '扣完应该剩 0（每月 1 份）');

  // 第 2 个请求：额度已经扣过了，但这是**同一份报告**的后续章节，必须继续放行
  const r2 = S.gateReportAccess(REQ, BAZI_A, 'bazi');
  assert.strictEqual(r2.full, true,
    '同一份报告的第 2 个请求被挡了 —— 月会员会看到付费墙（本次修复的原始症状）');
  assert.strictEqual(r2.viaCredit, false, '第 2 个请求不该再扣一次额度');

  for (let i = 3; i <= 9; i++) {
    assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true, `第 ${i} 个请求被挡了`);
  }
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '整份报告只该扣 1 次额度');
});

test('同一份报告的多个端点（productKeys 数组写法不同）共用一份额度', () => {
  reset();
  // /api/bazi（report-cn.html，中文分支）→ 数组 A
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_B, 'bazi').full, true);
  // /api/bazi/stream + /api/bazi/chapter（report-v2.html）→ 数组 B
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true,
    '同一份八字报告换个端点就被判额度用尽 —— 用户换页面读同一份报告会撞付费墙');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').viaCredit, false, '不该重复扣');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '同一份报告换端点读也只该扣 1 次');
});

// 🔴 这条是这次专家复审抓到的 P0 的回归测试：身份绝不能从 productKeys 推。
//   不传 reportId 的端点必须维持旧行为（各自消耗额度），否则一个 credit 会连锁放行
//   多份付费报告 —— 21 键那个数组被 10 个端点共用，最坏情况一次放行 10 份。
test('不同报告共用同一个 productKeys 数组时，不许互相放行（身份不能来自数组）', () => {
  reset();
  // /api/ziwei
  assert.strictEqual(S.gateReportAccess(REQ, UNION_11).full, true, '第一个报告应吃到额度');
  // /api/xingming —— 同一个数组，但是**另一份报告**
  assert.strictEqual(S.gateReportAccess(REQ, UNION_11).full, false,
    '另一个报告靠同一个类目数组白拿了完整版 —— 一个 credit 放行了多份付费报告');
  // /api/astrology
  assert.strictEqual(S.gateReportAccess(REQ, UNION_11).full, false, '第三个报告也白拿了');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '被挡的请求不该扣额度');
});

test('「每月 1 份」的上限不变：换一份报告仍然要额度、且拿不到第 2 份', () => {
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  const other = S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot');
  assert.strictEqual(other.full, false, '这个月第 2 份报告（塔罗）不该免费放行 —— 上限被放开了');
  assert.strictEqual(other.tier, 'monthly', '降级路径应报 monthly（免费预览 + 升级提示）');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '被挡的那次不该扣额度');
});

test('先看的哪一份不影响判定：塔罗在前、八字在后也是同样语义', () => {
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, true);
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, true, '同份后续请求要放行');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, false, '换一份应被挡');
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, true, '回到原来那份仍要能读');
});

test('非会员 / 匿名不该被这条「已放行」逻辑漏进去', () => {
  reset();
  assert.strictEqual(S.gateReportAccess({}, BAZI_A, 'bazi').full, false, '匿名放行了');
  assert.strictEqual(S.gateReportAccess({}, BAZI_A, 'bazi').tier, null);
  assert.strictEqual(S.gateReportAccess(REQ_OTHER, BAZI_A, 'bazi').full, false, '无订单用户放行了');
  assert.strictEqual(S.gateReportAccess(REQ_OTHER, BAZI_A, 'bazi').full, false);
  assert.deepStrictEqual(S._M.reportCreditSpentOn, {}, '非会员不该写标记');
});

test('credit 不可覆盖的高端单品不该吃掉标准报告的额度', () => {
  reset();
  const vip = S.gateReportAccess(REQ, ['bazi_vip'], 'bazi_vip');
  assert.strictEqual(vip.full, false, 'bazi_vip 被 credit 覆盖了');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], undefined, '高端单品不该扣标准报告额度');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true, '额度被高端单品吃掉了');
});

test('生成失败回补额度后：同一份报告能重试，且退回的额度只能花一次', () => {
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  assert.strictEqual(S.refundMonthlyReportCredit(1, REQ), true, '回补应成功');
  assert.strictEqual(S.monthlyReportCreditRemaining(1), 1, '回补后额度应回到 1');

  // 重试同一份报告：既要有额度（回补生效），也要不被残留标记挡住（标记被清）
  const retry = S.gateReportAccess(REQ, BAZI_A, 'bazi');
  assert.strictEqual(retry.full, true, '回补后重试同一份报告被挡了');
  assert.strictEqual(retry.viaCredit, true, '重试应重新扣额度（吃的是刚退回的那一份）');

  // 退回的额度不能被重复利用
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  S.refundMonthlyReportCredit(1, REQ);
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, true, '退回的额度应能在别处花');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, false, '退回的额度被花了两次');
});

test('回补只清本次请求自己花掉的那份标记，不动别人的', () => {
  reset();
  // 第 1 个请求扣成功 → 标记 = #bazi，req 上带着"退的是 bazi"
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);

  // 模拟「另一个请求（没扣成功的那次）失败后触发回补」：它不该有权清掉 bazi 的标记
  const otherReq = { headers: REQ.headers, _syCreditUid: 1, _syCreditReport: 'tarot' };
  assert.strictEqual(S.refundMonthlyReportCredit(1, otherReq), false, '非本次请求的回补应被拒');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1,
    '非本次请求的回补把计数也退了 —— 退了一个它没扣过的额度');
  assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#bazi',
    '无关请求的回补把八字那份的放行标记清掉了');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true, '八字报告应仍能读');
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, false,
    '非本次请求的回补白送出一份额度');

  // 而扣成功的那次自己失败 → 标记要清掉（否则退回的额度变成本月无限次）
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  assert.strictEqual(S.refundMonthlyReportCredit(1, REQ), true, '自己那份的回补应成功');
  assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], undefined, '自己那份的标记应被清掉');
});

// 🔴 P1(专家复审)：同一份报告的两个请求并发时，先到的那个扣了额度、后到的靠标记直接拿到内容。
//   此时先到那次的 LLM 若失败并触发「回补」，额度会被退回 —— 但内容其实已经发出去了，
//   会员等于一份钱拿两份报告（已送达的这份 + 用退回额度再开的一份）。回补必须被拒。
test('同一份报告的兄弟请求已经拿到内容后，不许再回补额度（一次付款两份报告）', () => {
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').viaCredit, true, '第 1 个请求应扣额度');
  // 第 2 个请求（同一份报告，数组写法不同）靠标记放行 —— 服务端**真的把内容发给它了**
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_B, 'bazi').viaCredit, false, '第 2 个请求不该重复扣');
  assert.strictEqual(S._M.reportCreditServed[SPENT_KEY], '#bazi', '应记下「这份额度已被服务过」');

  assert.strictEqual(S.refundMonthlyReportCredit(1, REQ), false,
    '内容已送达还回补 —— 一次付款两份报告');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '被拒的回补不该动计数');
  assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#bazi', '被拒的回补不该清标记');
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, false,
    '回补被拒后额度不该凭空多出一份');

  // 反面：没有兄弟请求、纯粹自己失败 → 仍要能回补（别把正常的重试也堵死）
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').viaCredit, true);
  assert.strictEqual(S.refundMonthlyReportCredit(1, REQ), true, '「扣了额度但生成失败」仍必须能回补');
});

test('不传 reportId 的端点（未标注）既不写标记，也蹭不到别人的放行标记', () => {
  reset();
  // 未标注端点自己扣成功 → 不写标记（身份未知，凭空造一个会放行别的报告）
  const r1 = reqFor('tok_m');
  assert.strictEqual(S.gateReportAccess(r1, ['tarot', '塔罗']).full, true, '未标注端点第 1 次应吃到额度');
  assert.deepStrictEqual(S._M.reportCreditSpentOn, {}, '没给 reportId 却写了标记');
  assert.strictEqual(S.refundMonthlyReportCredit(1, r1), true, '没写标记的回补应放行');

  // 已标注端点扣成功（标记 #bazi）后，未标注端点不许靠这个标记白拿
  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  assert.strictEqual(S.gateReportAccess({ headers: REQ.headers }, ['tarot', '塔罗']).full, false,
    '未标注端点靠别人写下的标记白拿了一份报告');
  assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#bazi', '未标注端点不该改动标记');
});

// 单槽标记（uid+月 一个 key）只在「一个月一份额度」时成立。把额度调大就会撞车：
// 第 2 份报告会覆盖第 1 份的标记，那份报告本月再打开就被判「额度用尽」。这条测试钉住前提。
test('标记是单槽的 —— 前提是 MONTHLY_REPORT_CREDIT === 1，调大之前必须先改结构', () => {
  assert.strictEqual(S.MONTHLY_REPORT_CREDIT, 1,
    '额度不再是 1 了：reportCreditSpentOn/reportCreditServed 的单槽设计必须改成「每份报告一个槽」，' +
    '否则第 2 份报告会覆盖第 1 份的标记，已付费的报告本月重开撞回付费墙');
});

test('合婚档位与报告门共用同一份额度，不各扣各的', () => {
  reset();
  assert.strictEqual(S.hehunTier(REQ), 'full', '月会员第一次读合婚应放行');
  assert.strictEqual(S.hehunTier(REQ), 'full', '合婚页第 2 个请求被挡了');
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '合婚整页只该扣 1 次');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, false, '合婚 + 八字拿到了 2 份额度');

  reset();
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true);
  assert.notStrictEqual(S.hehunTier(REQ), 'full', '八字 + 合婚拿到了 2 份额度');
});

// ── 放最后：会把模块实例换掉 ──
test('重启后标记要能回载（否则 PM2 一重启，月会员正读的那份报告又撞回付费墙）', () => {
  S._flushStore();                       // 把旧实例的待写落盘清掉，免得覆盖下面要造的现场
  // 🔴 served 必须一起塞进现场：只塞 spentOn 的话，「served 有没有回载」这条断言是空转的
  //   （把 served 从白名单里删掉也照样全绿 —— 复审实测过，所以这里必须一起回载+断言）
  seed({
    reportCredits: { [CREDIT_KEY]: 1 },
    reportCreditSpentOn: { [SPENT_KEY]: '#bazi' },
    reportCreditServed: { [SPENT_KEY]: '#bazi' },
  });

  delete require.cache[require.resolve('./store')];
  S = require('./store');                // 模拟 PM2 重启

  assert.deepStrictEqual(S._M.reportCreditSpentOn, { [SPENT_KEY]: '#bazi' },
    '标记没有回载 —— 重启后月会员正读的那份报告会被判「额度用尽」');
  assert.deepStrictEqual(S._M.reportCreditServed, { [SPENT_KEY]: '#bazi' },
    'served 没有回载 —— 重启后一次「回补」又能把已送达的那份报告白送一遍');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').full, true, '重启后同一份报告应继续放行');
  assert.strictEqual(S.gateReportAccess(REQ, BAZI_A, 'bazi').viaCredit, false, '重启后不该重复扣额度');
  assert.strictEqual(S.gateReportAccess(REQ, ['tarot', '塔罗'], 'tarot').full, false,
    '重启后「每月 1 份」的上限应仍然有效');
  // 回载的 served 要真的还拦得住回补（不只是躺在内存里）。
  // ⚠️ 必须造一个「标记就是自己」的回补请求：若不带 _syCreditReport，
  //    会先被「非本次请求的标记」那条守卫挡下，测的就不是 served 这条闸了。
  const ownReq = { headers: { authorization: 'Bearer tok_m' }, _syCreditUid: 1, _syCreditReport: 'bazi' };
  assert.strictEqual(S.refundMonthlyReportCredit(1, ownReq), false,
    '重启后 served 失效了：已送达的报告还能被回补成白送');
});
