'use strict';
/**
 * report-main-path.test.js — 主路口(首页→collect→pick→report-v2)的**端点级**回归。
 *
 * 为什么要有这个文件：store-monthly-credit.test.js 验的是 gate 的语义，验不到
 * 「端点有没有拿对 reportId」「页面发的那一串请求在真 HTTP 层是不是都被放行」。
 * 而线上那个 P0 恰恰只在「一份报告 = 多个请求」时才现形：
 * report-v2.html 一次浏览 = 1 个 /api/bazi/stream + 3 个免费章 + 7 个付费章，
 * 额度原来只够第 1 个请求 → 交着月费的会员看到 6 个付费墙 + 免费预览。
 *
 * 这里用**真 express 路由 + 假 LLM**复现页面那一串请求：
 *   - 月会员：整串请求都必须拿到正文，一个 locked 都不许有，且额度只扣 1 次
 *   - 非会员：7 个付费章**必须**全是 locked（防止「修过头」变成白送）
 *   - 额度已花在别的报告上：八字这串必须重新上墙（「每月 1 份」的上限不能破）
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ── 必须在 require 任何 store 之前落定 ──
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-mainpath-'));
process.env.DATA_FILE = path.join(TMP, 'data.json');
// 让 divination.js 里那句监测模块 require 直接失败(它自带 try/catch)：
// 测试进程不联网、不留定时器
process.env.MONITORING_PATH = path.join(TMP, 'no-such-monitoring.js');

const MONTH = new Date().toISOString().slice(0, 7);
const CREDIT_KEY = '1_rc_' + MONTH;
const SPENT_KEY = '1_rcs_' + MONTH;

const MEMBER_TOKEN = 'tok_member';
const FREE_TOKEN = 'tok_free';

fs.writeFileSync(process.env.DATA_FILE, JSON.stringify({
  users: [
    { id: 1, email: 'member@example.com', name: 'M' },
    { id: 2, email: 'free@example.com', name: 'N' },
  ],
  tokens: [
    { id: 1, user_id: 1, token: MEMBER_TOKEN },
    { id: 2, user_id: 2, token: FREE_TOKEN },
  ],
  orders: [{
    id: 1, order_no: 'o1', product: 'member_monthly', amount: 990, currency: 'usd',
    user_id: 1, payment_status: 'completed',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 20 * 864e5).toISOString(),
  }],
  _id: { u: 3, t: 3, o: 2, r: 1, s: 1, rf: 1 },
}));

// ── 假 LLM：必须在 require 路由之前塞进 require.cache（divination.js 在顶层解构）──
const ENC = new TextEncoder();
function fakeStream(pieces) {
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (i < pieces.length) return Promise.resolve({ done: false, value: ENC.encode(pieces[i++]) });
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}
const OK_PIECES = [
  'data: {"choices":[{"delta":{"content":"甲木生于申月，身弱喜水。"}}]}\n\n',
  'data: [DONE]\n\n',
];
const _llmPath = require.resolve('../lib/llm');
// ⚠️ divination.js 在顶层 `const { deepseekStream } = require('../lib/llm')` —— 它抓的是**函数对象本身**。
//    所以「失败」必须由桩函数内部读一个可变的开关来模拟，事后替换 exports.deepseekStream 是无效的。
let FAIL_NEXT = false;
// 流到一半断：先吐一块正文，再 reject（模拟 LLM 中途挂掉）
let FAIL_MIDSTREAM = false;
function brokenStream() {
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (i++ === 0) return Promise.resolve({ done: false, value: ENC.encode(OK_PIECES[0]) });
          return Promise.reject(new Error('stream broke mid-way'));
        },
      };
    },
  };
}
require.cache[_llmPath] = {
  id: _llmPath, filename: _llmPath, loaded: true, children: [], paths: [],
  exports: {
    deepseekChat: async () => ({ content: '甲木生于申月，身弱喜水。' }),
    deepseekStream: async () => {
      if (FAIL_MIDSTREAM) return brokenStream();
      if (FAIL_NEXT) { FAIL_NEXT = false; throw new Error('stub LLM down'); }
      return fakeStream(OK_PIECES);
    },
    buildReadingPrompt: (sys, user) => [{ role: 'system', content: String(sys || '') }, { role: 'user', content: String(user || '') }],
    DEEPSEEK_MODEL: 'stub',
    activeProviders: [],
  },
};

const express = require('express');
const S = require('../lib/store');
const router = require('./divination');

const app = express();
app.use(express.json());
app.use('/api', router);
const srv = app.listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
test.after(() => { srv.close(); try { S._flushStore(); } catch (e) {} });

// report-v2.html 的真实请求串
const BIRTH = { birthYear: 1990, birthMonth: 6, birthDay: 15, birthHour: 12, gender: 'female' };
const FREE_CHAPTERS = ['pillars', 'elements', 'year'];
const PAID_CHAIN = ['wealth', 'career', 'love', 'luck', 'forecast', 'remedy', 'message'];

function post(p, body, token) {
  return fetch(BASE + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (token || MEMBER_TOKEN) },
    body: JSON.stringify(Object.assign({}, body)),
  });
}
// 把 SSE 正文里的 data: 行解出来
function sseEvents(text) {
  return text.split('\n')
    .filter(l => l.indexOf('data: ') === 0)
    .map(l => { try { return JSON.parse(l.slice(6)); } catch (e) { return null; } })
    .filter(Boolean);
}
async function readChapter(id, token) {
  const r = await post('/api/bazi/chapter', Object.assign({ chapterId: id, lang: 'zh' }, BIRTH), token);
  return { status: r.status, events: sseEvents(await r.text()) };
}
async function readStream(token) {
  const r = await post('/api/bazi/stream', Object.assign({ mode: 'truth', lang: 'zh' }, BIRTH), token);
  return { status: r.status, events: sseEvents(await r.text()) };
}
const isLocked = ev => ev.some(e => e.type === 'locked');

function resetMonth() {
  S._M.reportCredits = {};
  S._M.reportCreditSpentOn = {};
  S._M.reportCreditServed = {};
}

test('/api/bazi/chart：只排盘，不调 LLM、不扣会员额度（免费计算器页走这里）', async () => {
  resetMonth();
  FAIL_NEXT = false;
  FAIL_MIDSTREAM = false;
  let calls = 0;
  const realStream = require.cache[_llmPath].exports.deepseekStream;
  require.cache[_llmPath].exports.deepseekStream = async (...a) => { calls++; return realStream(...a); };

  let r, d;
  try {
    // 匿名访客（页面实际发的 body：不带 token，同源请求自带 cookie）
    r = await fetch(BASE + '/api/bazi/chart', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ birthYear: 1990, birthMonth: 6, birthDay: 15, birthHour: 12, gender: 'male', lang: 'en', mode: 'truth' }),
    });
    d = await r.json();
    assert.strictEqual(r.status, 200);
    assert.ok(d.pillars && d.pillars.day && d.pillars.day.gan, '没返回四柱');
    assert.ok(d.pillars.dayMaster && d.pillars.dayMasterElement, '没返回日主');

    // 月会员用同一个免费页（cookie 认证）—— 额度一分都不许动
    r = await fetch(BASE + '/api/bazi/chart', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'sy_token=' + MEMBER_TOKEN },
      body: JSON.stringify({ birthYear: 1990, birthMonth: 6, birthDay: 15, gender: 'female', lang: 'en' }),
    });
    d = await r.json();
    assert.ok(d.pillars, '带 cookie 时没返回四柱');
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], undefined,
      '免费计算器扣掉了月会员当月唯一一份报告额度');
    assert.strictEqual(calls, 0, `免费排盘调了 ${calls} 次 LLM（每访客都烧一次完整报告生成）`);
    assert.strictEqual(d.reading, undefined, '这个端点不该产出报告正文');
  } finally {
    require.cache[_llmPath].exports.deepseekStream = realStream;
  }

  // 换成本页用的真端点后，会员那份额度仍然完整可用（免费页不该吃掉它）
  const stream = await readStream(MEMBER_TOKEN);
  assert.strictEqual(stream.events.find(e => e.type === 'meta').locked, false,
    '免费计算器把额度吃掉了，会员回到报告页看到付费墙');
});

test('月会员跑完整个报告页：全程零 locked，额度只扣 1 次（线上那个 P0 的端点级复现）', async () => {
  resetMonth();
  const lockedChapters = [];
  const servedWithoutText = [];

  // 页面顺序：主体流在前，然后是免费章 + 付费章链
  const stream = await readStream(MEMBER_TOKEN);
  assert.strictEqual(stream.status, 200, '主体流不该非 200');
  const meta = stream.events.find(e => e.type === 'meta');
  assert.ok(meta, '主体流没发 meta 事件');
  assert.strictEqual(meta.locked, false, '月会员打开报告页就被判「未解锁」—— 这就是线上那个 P0');
  assert.ok(stream.events.some(e => e.type === 'chunk' && e.content), '主体流没有正文');

  for (const id of FREE_CHAPTERS.concat(PAID_CHAIN)) {
    const { status, events } = await readChapter(id, MEMBER_TOKEN);
    assert.strictEqual(status, 200, `章节 ${id} 非 200`);
    if (isLocked(events)) lockedChapters.push(id);
    else if (!events.some(e => e.type === 'chunk' && e.content)) servedWithoutText.push(id);
  }
  assert.deepStrictEqual(lockedChapters, [], '交着月费的会员看到付费墙的章节: ' + lockedChapters.join(','));
  assert.deepStrictEqual(servedWithoutText, [], '放行了却没给正文的章节: ' + servedWithoutText.join(','));

  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1,
    `一份报告应该只扣 1 份额度，实际扣了 ${S._M.reportCredits[CREDIT_KEY]}`);
  assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#bazi', '标记应指向这一份八字报告');
});

test('非会员跑同一条链：7 个付费章必须全部 locked（不许修过头变成白送）', async () => {
  resetMonth();
  const stream = await readStream(FREE_TOKEN);
  const meta = stream.events.find(e => e.type === 'meta');
  assert.strictEqual(meta.locked, true, '非会员的主体流被整份放行了');

  const paidLocked = [];
  for (const id of PAID_CHAIN) {
    const { events } = await readChapter(id, FREE_TOKEN);
    if (isLocked(events)) paidLocked.push(id);
  }
  assert.deepStrictEqual(paidLocked, PAID_CHAIN, '非会员白拿的付费章: ' + PAID_CHAIN.filter(x => !paidLocked.includes(x)).join(','));
  assert.strictEqual(S._M.reportCredits[CREDIT_KEY], undefined, '非会员不该产生额度记录');

  // 免费章对谁都免费
  for (const id of FREE_CHAPTERS) {
    const { events } = await readChapter(id, FREE_TOKEN);
    assert.strictEqual(isLocked(events), false, `免费章 ${id} 被墙了`);
  }
});

test('本月的 1 份额度已经花在别的报告上：八字这串必须重新上墙', async () => {
  resetMonth();
  // 等价于「先看完了合婚」（hehunTier 用 reportId 'hehun' 扣掉同一份额度）
  S._M.reportCredits[CREDIT_KEY] = 1;
  S._M.reportCreditSpentOn[SPENT_KEY] = '#hehun';

  const stream = await readStream(MEMBER_TOKEN);
  assert.strictEqual(stream.events.find(e => e.type === 'meta').locked, true,
    '额度已花在合婚上，八字还能白看 —— 「每月 1 份」的上限破了');
  const { events } = await readChapter('wealth', MEMBER_TOKEN);
  assert.strictEqual(isLocked(events), true, '额度已花在合婚上，付费章还能白看');

  // 而合婚自己那份仍然放行（同一份报告的后续请求不该被误伤）
  assert.strictEqual(S.gateReportAccess({ headers: { authorization: 'Bearer ' + MEMBER_TOKEN } }, ['hehun'], 'hehun').full,
    true, '标记指向的那份报告自己被墙了');
});

test('失败回补后整串仍要能读完（扣了额度但生成失败不能吃会员的额度）', async () => {
  resetMonth();
  try {
    // 第 1 个请求(主体流)正好是失败的那个 → 端点回补额度
    FAIL_NEXT = true;
    const first = await readStream(MEMBER_TOKEN);
    assert.ok(first.events.some(e => e.type === 'error'), 'LLM 挂了应该发 error 事件');
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 0, '生成失败应把额度退回来（会员没拿到东西）');
    assert.strictEqual(S.monthlyReportCreditRemaining(1), 1, '退回后额度应回到 1');

    // 重试整串：必须能读完
    const retry = await readStream(MEMBER_TOKEN);
    assert.strictEqual(retry.events.find(e => e.type === 'meta').locked, false, '回补后重试仍被墙');
    for (const id of PAID_CHAIN) {
      const { events } = await readChapter(id, MEMBER_TOKEN);
      assert.strictEqual(isLocked(events), false, `回补后章节 ${id} 仍被墙`);
    }
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '整串重试后额度应恰好被扣 1 次');
  } finally {
    FAIL_NEXT = false;
  }
});

// 🔴 专家复审抓到(既有漏洞，不是本轮引入)：流式端点原来无条件回补。
//   正文已经 stream 出去了(用户手里有内容)，再退额度 = 一次付款两份报告。
// 🔴 上面那条测试靠的是 bazi 家系带 reportId。非八字方法(藏传/玛雅/紫微/塔罗…)的 gate
//   调用**不带 reportId**，于是 _trackEmitted 里那句 `!_syCreditReport` 把它们放过了：
//   正文已经 stream 出去，出错时照样回补额度 → 会员拿「半份藏传 + 一份全新的八字」只付了一次钱。
//   (端点本身的动机是「别让会员卡住」，所以这里要的是把 identity 补上，而不是把回补关掉：
//    带 reportId 后重试走 already 分支，照样拿得到自己那份。)
test('非八字方法(藏传流)：正文已送出后出错，额度同样不许退，且那份报告仍能重试', async () => {
  resetMonth();
  const BODY = { name: 'M', dob: '1990-06-15', gender: 'F', concern: 'career', lang: 'en' };
  const tibet = async () => {
    const r = await post('/api/tibet/stream', BODY, MEMBER_TOKEN);
    return { status: r.status, events: sseEvents(await r.text()) };
  };
  try {
    FAIL_MIDSTREAM = true;
    const first = await tibet();
    const meta = first.events.find(e => e.type === 'meta');
    assert.ok(meta, '藏传流没发 meta');
    assert.strictEqual(meta.locked, false, '前提不成立：会员打开这页就已经被墙');
    assert.ok(first.events.some(e => e.type === 'chunk' && e.content), '前提不成立：正文还没发出去');
    assert.ok(first.events.some(e => e.type === 'error'), '半路断流应该发 error 事件');
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1,
      '正文已送到用户手里还退了额度 —— 一次付款两份报告（非八字方法这条路没关上）');

    // 拒补不能让会员「付了钱什么也拿不到」——同一份报告必须还能重试
    FAIL_MIDSTREAM = false;
    const retry = await tibet();
    const rmeta = retry.events.find(e => e.type === 'meta');
    assert.strictEqual(rmeta.locked, false, '同一份报告重试被墙了：付了月费的会员拿不到自己那份');
    assert.ok(retry.events.some(e => e.type === 'chunk' && e.content), '重试没拿到正文');
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '重试不该再扣一次额度');

    // 但「每月 1 份」不能破：换成八字仍然是墙
    const bazi = await readStream(MEMBER_TOKEN);
    assert.strictEqual(bazi.events.find(e => e.type === 'meta').locked, true,
      '藏传那份吃掉的额度被白送了：八字也放行了');
    assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#tibet', '标记应指向藏传那一份');
  } finally {
    FAIL_MIDSTREAM = false;
  }
});

test('正文已经流出去之后再出错：额度不许退，但那份报告仍能重试', async () => {
  resetMonth();
  try {
    FAIL_MIDSTREAM = true;
    const r = await readStream(MEMBER_TOKEN);
    const gotContent = r.events.some(e => e.type === 'chunk' && e.content);
    assert.ok(gotContent, '这个用例的前提是「正文已经发出去了一部分」');
    assert.ok(r.events.some(e => e.type === 'error'), '半路断流应该发 error 事件');

    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1,
      '正文已送到用户手里还退了额度 —— 一次付款两份报告');
    assert.strictEqual(S._M.reportCreditSpentOn[SPENT_KEY], '#bazi', '标记不该被清');

    // 关键：拒补不能让会员「付了钱什么也拿不到」—— 同一份报告必须还能重试
    FAIL_MIDSTREAM = false;
    const retry = await readStream(MEMBER_TOKEN);
    assert.strictEqual(retry.events.find(e => e.type === 'meta').locked, false, '同一份报告重试被墙了');
    assert.ok(retry.events.some(e => e.type === 'chunk' && e.content), '重试没拿到正文');
    assert.strictEqual(S._M.reportCredits[CREDIT_KEY], 1, '重试不该再扣一次额度');

    // 而退回的额度确实没白送：换一份报告仍然要另付
    assert.strictEqual(S.gateReportAccess({ headers: { authorization: 'Bearer ' + MEMBER_TOKEN } }, ['tarot', '塔罗'], 'tarot').full,
      false, '半路断流还白送出一份额度');
  } finally {
    FAIL_MIDSTREAM = false;
  }
});
