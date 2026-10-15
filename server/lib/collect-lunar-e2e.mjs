// 真浏览器端到端判据：collect.html 选「农历」→ 存盘的是**换算后的公历**。
//
// 为什么必须真跑浏览器：这条链路的核心是「用户亲手点了农历、选了数字、点了下一步」，
//   中间有下拉联动、fetch、alert、localStorage、跳转。只测 /api/calendar/lunar 那条路由
//   （calendar.test.js 已覆盖）证明不了页面真的走了它——这正是原缺陷的形态：
//   接口是新的，页面却从没调用，一切"看起来正常"。
//
// 运行：node server/lib/collect-lunar-e2e.mjs      （需要 playwright，缺了会直接报错不跳过）
// 输出末行固定为 `结果：✅N／❌M`——门静默死掉时，先看有没有这一行。
'use strict';


import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..');
const ROOT = path.join(SERVER, '..');
const require = createRequire(import.meta.url);

// playwright 不在本仓库依赖里（重依赖，只为一个门不值当）。按顺序找：
//   环境变量 PLAYWRIGHT_PATH → 本仓库 → 同机已装的 lumee。找不到就**直接报错**，
//   绝不静默跳过——一个会自己变绿的门等于没有门。
function loadPlaywright() {
  const cands = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    path.join(process.env.HOME, 'projects', 'lumee', 'node_modules', 'playwright'),
  ].filter(Boolean);
  const errs = [];
  for (const c of cands) {
    try { return require(c); } catch (e) { errs.push(c + ': ' + e.message.split('\n')[0]); }
  }
  throw new Error('找不到 playwright（门需要它，不会自动跳过）。设 PLAYWRIGHT_PATH 指向 playwright 包目录。尝试过：\n  ' + errs.join('\n  '));
}
const { chromium } = loadPlaywright();

let pass = 0, fail = 0;
function chk(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
}

function freePort() {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

async function main() {
  const port = await freePort();
  const BASE = 'http://localhost:' + port;   // 用 localhost 而非 127.0.0.1：index.js 的 CORS 白名单放行 http://localhost*，这样门跑在与生产一致的条件下

  // 绝不能让判据读到/写到真实 data.json（DATA_FILE 不在 .env 里，所以不会被盖掉）
  const tmpData = path.join(os.tmpdir(), 'sy-collect-lunar-e2e.json');
  const realData = path.join(SERVER, 'data.json');
  fs.writeFileSync(tmpData, fs.existsSync(realData) ? fs.readFileSync(realData) : '{}');

  // 进程内起服务（不是子进程）：server/.env 里写着 `PORT=` 空串，而 index.js 是
  // `dotenv.config({override:true})` —— 空串会把 PORT 强制成 3021，子进程传 PORT 没用。
  // 进程内把 dotenv 换成空实现，端口才可控。node-cron 也换空实现，否则定时任务钉住事件循环。
  const ModuleCJS = require('node:module');
  const origLoad = ModuleCJS._load;
  const realSetInterval = global.setInterval;
  ModuleCJS._load = function (request) {
    if (request === 'dotenv') return { config: () => ({ parsed: {} }) };
    if (request === 'node-cron') return { schedule: () => ({ stop() {}, destroy() {} }) };
    return origLoad.apply(this, arguments);
  };
  process.env.PORT = String(port);
  process.env.DATA_FILE = tmpData;
  global.setInterval = function () { const h = realSetInterval.apply(this, arguments); if (h && h.unref) h.unref(); return h; };
  try {
    require(path.join(SERVER, 'index.js'));
  } finally {
    ModuleCJS._load = origLoad;
    global.setInterval = realSetInterval;
  }

  const cleanup = () => {};

  try {
    // 等服务起来（最多 30s）
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(BASE + '/api/health');
        if (r.ok) { up = true; break; }
      } catch (e) { /* 还没起来 */ }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!up) throw new Error('服务没起来（127.0.0.1:' + port + '）');

    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    let dialogMsg = null;
    page.on('dialog', async (d) => { dialogMsg = d.message(); await d.dismiss().catch(() => {}); });

    const open = () => page.goto(BASE + '/pages/collect.html', { waitUntil: 'domcontentloaded' });

    /** 填表并提交；返回提交后 localStorage 里的 profile（提交成功会跳到 pick.html） */
    async function submit({ cal, y, m, d, gender = 'female', leap = false }) {
      dialogMsg = null;
      await open();
      await page.evaluate(() => localStorage.removeItem('runae_profile'));
      await page.reload({ waitUntil: 'domcontentloaded' });

      await page.click(cal === 'lunar' ? '#calLunar' : '#calSolar');
      await page.selectOption('#byear', String(y));
      await page.selectOption('#bmonth', String(m));
      await page.selectOption('#bday', String(d));
      await page.selectOption('#gender', gender);
      if (leap) await page.click('#leapTxt');
      await page.waitForTimeout(400);           // 让 onchange 的补填/fetch 落定

      await page.click('#next');
      await page.waitForTimeout(900);           // 换算请求 + 跳转
      return await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('runae_profile') || 'null'); } catch (e) { return null; } });
    }

    // ── 1. 农历正臂：数字必须被换算，且原样农历另存 blunar ──────────────
    const r1 = await submit({ cal: 'lunar', y: 1991, m: 8, d: 28 });
    chk('农历 1991-8-28 女 → bdate = 公历 1991-10-05', r1 && r1.bdate === '1991-10-05', JSON.stringify(r1));
    chk('农历原样保留在 blunar = 1991-08-28', r1 && r1.blunar === '1991-08-28', r1 && r1.blunar);
    chk('cal 记为 lunar', r1 && r1.cal === 'lunar', r1 && r1.cal);

    // ── 2. 差异臂：阳历模式同样的数字必须原样存 1991-08-28 ──────────────
    //    若换算被撤掉，农历模式会退化成和这里一样 → 第 1 条立刻转红。
    //    这条证明第 1 条测的确实是"换算"，不是"记得住数字"。
    const r2 = await submit({ cal: 'solar', y: 1991, m: 8, d: 28 });
    chk('阳历 1991-8-28 → bdate = 1991-08-28（原样，不换算）', r2 && r2.bdate === '1991-08-28', r2 && r2.bdate);
    chk('差异臂：两种模式存出的日期确实不同',
      !!(r1 && r2) && r1.bdate !== r2.bdate, r1 && r1.bdate + ' vs ' + (r2 && r2.bdate));

    // ── 3. 非法农历必须被拦住，且不存盘 ────────────────────────────────
    const r3 = await submit({ cal: 'lunar', y: 1991, m: 9, d: 30 });
    chk('农历 1991年九月三十（该月只有29天）→ 弹提示', !!dialogMsg, dialogMsg || '没弹任何提示');
    chk('非法农历 → 不写盘', !r3 || r3.bdate !== '1991-09-30', JSON.stringify(r3));
    chk('非法农历 → 停在 collect 页没跳走',
      page.url().indexOf('collect.html') > -1, page.url());

    // ── 4. 闰月：选闰四月才给勾，勾了按闰月换算 ─────────────────────────
    const r4 = await submit({ cal: 'lunar', y: 2020, m: 4, d: 15, leap: true });
    chk('农历 2020 闰四月十五 → 公历 2020-06-06', r4 && r4.bdate === '2020-06-06', JSON.stringify(r4));
    chk('闰月选择被记进 blunar = 2020-04-15', r4 && r4.blunar === '2020-04-15', r4 && r4.blunar);

    // ── 5. 无闰月的年份不该出现闰月勾 ──────────────────────────────────
    await open();
    await page.click('#calLunar');
    await page.selectOption('#byear', '1991');
    await page.selectOption('#bmonth', '8');
    await page.waitForTimeout(500);
    const leapVisible = await page.isVisible('#leapWrap');
    chk('1991 年（无闰月）不显示闰月勾选框', !leapVisible, 'leapWrap 可见');

    await browser.close();
  } finally {
    cleanup();
  }
}

try {
  await main();
} catch (e) {
  fail++;
  console.log('  ❌ 判据自身异常：' + (e && e.message));
}
console.log('\n结果：✅' + pass + ' ／❌' + fail);
process.exit(fail ? 1 : 0);
