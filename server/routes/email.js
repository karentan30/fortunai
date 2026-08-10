'use strict';
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUBS_FILE = path.join(__dirname, '../../data/subscribers.json');

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { return []; }
}
function saveSubs(subs) {
  fs.mkdirSync(path.dirname(SUBS_FILE), { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

function makeUnsubToken(email) {
  const secret = process.env.ADMIN_TOKEN || 'sy_secret';
  return crypto.createHmac('sha256', secret).update(email).digest('hex').slice(0, 16);
}

// 农历节气 & 宜忌（按月份简化版）
const SOLAR_TERMS = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
function getSolarTerm(date) {
  return SOLAR_TERMS[date.getMonth() * 2 + (date.getDate() < 15 ? 0 : 1)];
}

const ZODIAC_ZH = ['猪','鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗'];
function getZodiac(year) {
  return ZODIAC_ZH[(year - 1923) % 12] || '';
}

// 生成今日运势 HTML 邮件
function buildEmailHtml({ name, zodiac, date, fortuneContent, unsubUrl }) {
  const dateStr = `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`;
  const term = getSolarTerm(date);
  const weekdays = ['日','一','二','三','四','五','六'];
  const weekday = `星期${weekdays[date.getDay()]}`;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>善缘每日天机 · ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.15)">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1a0f2e 0%,#2d1b4e 100%);padding:32px 24px 24px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
        <div style="font-size:28px;margin-bottom:8px">☯️</div>
        <div style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:0.1em">善 缘</div>
        <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-top:4px;letter-spacing:0.2em">SHEN YUAN · 每日天机</div>
      </td></tr>

      <!-- Date block -->
      <tr><td style="padding:24px 24px 0;text-align:center">
        <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:12px;padding:16px 20px;display:inline-block">
          <div style="font-size:14px;color:#d4af37;font-weight:600;letter-spacing:0.1em">${dateStr} ${weekday}</div>
          <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-top:4px">节气 · ${term}</div>
        </div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:20px 24px 0">
        <p style="margin:0;font-size:15px;color:rgba(240,238,230,0.8)">
          ${name ? `${name}，` : ''}${zodiac ? `属${zodiac}的你` : '你'}好，今日天机已就绪：
        </p>
      </td></tr>

      <!-- Fortune content -->
      <tr><td style="padding:16px 24px 0">
        <div style="background:rgba(212,175,55,0.04);border-left:3px solid #d4af37;border-radius:0 8px 8px 0;padding:16px 20px">
          ${fortuneContent}
        </div>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:28px 24px;text-align:center">
        <a href="https://shenyuan.mylumee.cn/pages/bazi.html?ref=email_daily" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8972e);color:#1a0f2e;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.05em">
          🔮 查看完整八字年运报告
        </a>
        <div style="margin-top:10px;font-size:12px;color:rgba(212,175,55,0.4)">了解你2026全年命盘走势</div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="border-top:1px solid rgba(212,175,55,0.1);padding:16px 24px;text-align:center">
        <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.6">
          善缘 · shenyuan.mylumee.cn<br>
          本内容由AI生成，仅供娱乐参考，不构成人生重大决策建议。<br>
          <a href="${unsubUrl}" style="color:rgba(212,175,55,0.4);text-decoration:underline">退订每日推送</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// 用 DeepSeek 生成今日运势文本
async function generateFortune(zodiac) {
  const DS_KEY = process.env.DS_KEY || process.env.DEEPSEEK_API_KEY;
  if (!DS_KEY) {
    return buildFallbackFortune(zodiac);
  }
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const zodiacStr = zodiac ? `属${zodiac}` : '';
  const prompt = `你是专业命理师。请为${zodiacStr}的用户生成${dateStr}的每日运势，格式如下（直接输出HTML片段，无需代码块）：

<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">📊 今日总运</strong><br>【2-3句话，积极正向，不夸张】</p>
<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">✅ 今日宜</strong><br>• 宜一<br>• 宜二<br>• 宜三</p>
<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">❌ 今日忌</strong><br>• 忌一<br>• 忌二<br>• 忌三</p>
<p style="margin:0;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">🍀 开运</strong>　幸运色：【颜色】　幸运数：【数字】</p>

直接输出HTML，不要其他文字。`;

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DS_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || buildFallbackFortune(zodiac);
  } catch (e) {
    console.error('[email] DeepSeek fortune error:', e.message);
    return buildFallbackFortune(zodiac);
  }
}

function buildFallbackFortune(zodiac) {
  const d = new Date();
  const luckyColors = ['金色','紫色','红色','蓝色','绿色','白色'];
  const luckyNums = [3,6,8,9];
  const color = luckyColors[d.getDay() % luckyColors.length];
  const num = luckyNums[d.getDay() % luckyNums.length];
  return `<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">📊 今日总运</strong><br>今日五行气场平稳，${zodiac ? `属${zodiac}的` : ''}你适合稳扎稳打，专注眼前之事，贵人缘分佳。</p>
<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">✅ 今日宜</strong><br>• 宜与信任的人深度沟通<br>• 宜整理思路、规划近期目标<br>• 宜适当休息，养精蓄锐</p>
<p style="margin:0 0 12px;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">❌ 今日忌</strong><br>• 忌冲动决策，尤其财务方面<br>• 忌与人争执，以和为贵<br>• 忌贪多求快，循序渐进</p>
<p style="margin:0;color:rgba(240,238,230,0.85);font-size:14px;line-height:1.8"><strong style="color:#d4af37">🍀 开运</strong>　幸运色：${color}　幸运数：${num}</p>`;
}

// 发送单封邮件
async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('[email] RESEND_API_KEY not set, skip send'); return false; }
  try {
    const { Resend } = require('resend');
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: '善缘天机 <noreply@shenyuan.mylumee.cn>',
      to,
      subject,
      html
    });
    if (error) { console.error('[email] resend error:', error); return false; }
    return true;
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return false;
  }
}

// ─── Routes ─────────────────────────────────────────

// POST /api/email/subscribe — 扩展版（支持姓名+生日）
router.post('/email/subscribe', (req, res) => {
  const { email, name, birthYear } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'email required' });
  }
  const subs = loadSubs();
  const idx = subs.findIndex(function(s) { return s.email === email.trim().toLowerCase(); });
  const entry = {
    email: email.trim().toLowerCase(),
    name: name || '',
    birthYear: birthYear ? parseInt(birthYear) : null,
    source: 'email-subscribe',
    ts: Date.now()
  };
  if (idx >= 0) {
    // 更新已有记录（补全姓名/生日）
    subs[idx] = Object.assign({}, subs[idx], entry);
  } else {
    subs.push(entry);
  }
  saveSubs(subs);
  console.log('[email.subscribe]', email);
  res.json({ ok: true });
});

// GET /api/email/preview — 预览今日邮件（需 ADMIN_TOKEN）
router.get('/email/preview', async (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'forbidden' });
  const fortune = await generateFortune('');
  const html = buildEmailHtml({
    name: '测试用户',
    zodiac: '龙',
    date: new Date(),
    fortuneContent: fortune,
    unsubUrl: `https://shenyuan.mylumee.cn/api/email/unsubscribe?token=preview`
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// POST /api/admin/email/send-daily — 手动触发每日发送（需 ADMIN_TOKEN）
router.post('/admin/email/send-daily', async (req, res) => {
  const token = req.headers['x-admin-token'] || req.body && req.body.token;
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'forbidden' });
  const result = await sendDailyBatch();
  res.json(result);
});

// GET /api/email/unsubscribe — 退订
router.get('/email/unsubscribe', (req, res) => {
  const { token, email } = req.query;
  if (!email && !token) return res.status(400).send('参数缺失');
  const subs = loadSubs();
  // 支持两种模式：email直接退订 or token退订
  const filtered = subs.filter(function(s) {
    if (email) return s.email !== decodeURIComponent(email);
    return makeUnsubToken(s.email) !== token;
  });
  saveSubs(filtered);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>退订成功</title></head>
<body style="background:#1a0f2e;color:#d4af37;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><div style="font-size:48px">✅</div><h2 style="color:#d4af37">已退订每日天机推送</h2>
<p style="color:rgba(240,238,230,0.5)">你随时可以回来重新订阅</p>
<a href="https://shenyuan.mylumee.cn" style="color:#d4af37">返回善缘</a></div>
</body></html>`);
});

// ─── Daily batch send ────────────────────────────────

async function sendDailyBatch() {
  const subs = loadSubs();
  if (!subs.length) return { sent: 0, failed: 0, total: 0 };
  const today = new Date();
  const dateStr = `${today.getMonth()+1}月${today.getDate()}日`;

  // 按生肖分组，同生肖共用一次 AI 生成
  const zodiacGroups = {};
  for (const sub of subs) {
    const zodiac = sub.birthYear ? getZodiac(sub.birthYear) : '';
    if (!zodiacGroups[zodiac]) zodiacGroups[zodiac] = [];
    zodiacGroups[zodiac].push(sub);
  }

  let sent = 0, failed = 0;
  for (const [zodiac, group] of Object.entries(zodiacGroups)) {
    const fortune = await generateFortune(zodiac);
    for (const sub of group) {
      const unsubToken = makeUnsubToken(sub.email);
      const html = buildEmailHtml({
        name: sub.name || '',
        zodiac,
        date: today,
        fortuneContent: fortune,
        unsubUrl: `https://shenyuan.mylumee.cn/api/email/unsubscribe?token=${unsubToken}`
      });
      const ok = await sendEmail(sub.email, `☯️ 善缘天机 · ${dateStr}每日运势`, html);
      if (ok) sent++; else failed++;
    }
  }
  console.log(`[email] daily batch: sent=${sent} failed=${failed} total=${subs.length}`);
  return { sent, failed, total: subs.length };
}

// ─── 新邮件系统（订单/续费/邀请）─────────────────────────

const emailService = require('../lib/email-service');

/**
 * POST /api/email/send-order-confirmation
 * 发送订单确认邮件
 *
 * 请求体：{
 *   to: 'user@example.com',
 *   orderNo: 'sy_20260810_001',
 *   product: '八字年运报告',
 *   amount: 9900,           // 分
 *   expiresAt: '2027-08-10T00:00:00Z',
 *   lang: 'cn'              // cn/en/kr
 * }
 */
router.post('/email/send-order-confirmation', async (req, res) => {
  const { to, orderNo, product, amount, expiresAt, lang = 'cn' } = req.body || {};

  if (!to || !orderNo || !amount) {
    return res.status(400).json({ error: 'to, orderNo, amount required' });
  }

  try {
    const order = { orderNo, product, amount, expiresAt };
    const ok = await emailService.sendOrderConfirmation(to, order, lang);
    return res.json({ ok, email: to });
  } catch (e) {
    console.error('[email] send-order-confirmation error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/email/send-renewal-reminder
 * 发送续费提醒邮件
 *
 * 请求体：{
 *   to: 'user@example.com',
 *   planName: '年度会员',
 *   expiresAt: '2027-08-10T00:00:00Z',
 *   renewalPrice: 9900,     // 分
 *   lang: 'cn'
 * }
 */
router.post('/email/send-renewal-reminder', async (req, res) => {
  const { to, planName, expiresAt, renewalPrice, lang = 'cn' } = req.body || {};

  if (!to || !expiresAt || !renewalPrice) {
    return res.status(400).json({ error: 'to, expiresAt, renewalPrice required' });
  }

  try {
    const subscription = { planName, expiresAt, renewalPrice };
    const ok = await emailService.sendRenewalReminder(to, subscription, lang);
    return res.json({ ok, email: to });
  } catch (e) {
    console.error('[email] send-renewal-reminder error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/email/send-referral-success
 * 发送邀请成功邮件
 *
 * 请求体：{
 *   to: 'referrer@example.com',
 *   inviteeName: '张三',
 *   reward: 1000,           // 分
 *   currentLevel: '青铜',
 *   nextLevelRequired: 3,   // 距下一等级还需邀请3人
 *   lang: 'cn'
 * }
 */
router.post('/email/send-referral-success', async (req, res) => {
  const { to, inviteeName, reward, currentLevel, nextLevelRequired, lang = 'cn' } = req.body || {};

  if (!to || !reward) {
    return res.status(400).json({ error: 'to, reward required' });
  }

  try {
    const referral = { inviteeName, reward, currentLevel, nextLevelRequired };
    const ok = await emailService.sendReferralSuccess(to, referral, lang);
    return res.json({ ok, email: to });
  } catch (e) {
    console.error('[email] send-referral-success error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/admin/email/test-order
 * 测试订单确认邮件（仅 ADMIN）
 */
router.post('/admin/email/test-order', async (req, res) => {
  const token = req.headers['x-admin-token'] || req.body?.token;
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'forbidden' });

  try {
    const order = {
      orderNo: 'sy_test_' + Date.now(),
      product: '测试产品',
      amount: 9900,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };
    const ok = await emailService.sendOrderConfirmation('test@example.com', order, 'cn');
    res.json({ ok, message: 'test email sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, sendDailyBatch };
