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

// POST /api/email/subscribe — 扩展版（支持姓名+完整出生信息+语言+功能标签）
router.post('/email/subscribe', (req, res) => {
  const { email, name, birthYear, birthMonth, birthDay, birthHour, gender, lang, features, source } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'email required' });
  }
  const subs = loadSubs();
  const normalizedEmail = email.trim().toLowerCase();
  const idx = subs.findIndex(function(s) { return s.email === normalizedEmail; });
  const entry = {
    email: normalizedEmail,
    name: name || '',
    birthYear: birthYear ? parseInt(birthYear) : null,
    birthMonth: birthMonth ? parseInt(birthMonth) : null,
    birthDay: birthDay ? parseInt(birthDay) : null,
    birthHour: (birthHour !== undefined && birthHour !== null) ? parseInt(birthHour) : null,
    gender: gender || '',
    lang: lang || 'zh',
    features: Array.isArray(features) ? features : (features ? [features] : []),
    source: source || 'email-subscribe',
    ts: Date.now()
  };
  if (idx >= 0) {
    // 更新已有记录（合并功能标签，补全出生信息）
    const existing = subs[idx];
    const mergedFeatures = Array.from(new Set([].concat(existing.features || [], entry.features)));
    subs[idx] = Object.assign({}, existing, entry, { features: mergedFeatures, ts: existing.ts, updatedTs: Date.now() });
  } else {
    subs.push(entry);
  }
  saveSubs(subs);
  // SECURITY FIX: Redact email from logs
  const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 8);
  console.log('[email.subscribe]', emailHash, 'lang:', lang || 'zh', 'src:', source || 'email-subscribe');
  res.json({ ok: true });
});

// POST /api/email/send-report — 报告发邮箱（方案b：摘要+链接回看，稳健不崩）
router.post('/email/send-report', async (req, res) => {
  const { email, name, birthYear, gender, reportSummary, lang } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'email required' });
  }
  const unsubToken = makeUnsubToken(email.trim().toLowerCase());
  const unsubUrl = `https://shenyuan.mylumee.cn/api/email/unsubscribe?token=${unsubToken}`;
  const zodiac = birthYear ? getZodiac(parseInt(birthYear)) : '';
  const displayName = name || (gender === 'male' ? '先生' : gender === 'female' ? '女士' : '朋友');
  const reportUrl = 'https://shenyuan.mylumee.cn/pages/bazi.html?ref=email_report';

  const summarySnippet = reportSummary && reportSummary.trim()
    ? reportSummary.trim().slice(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : '你的八字命盘已生成，包含格局分析、流年运势、财运感情等全维度解读。';

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>你的八字报告 · Runae</title>
</head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.15)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1a0f2e 0%,#2d1b4e 100%);padding:32px 24px 24px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
        <div style="font-size:28px;margin-bottom:8px">☯️</div>
        <div style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:0.15em">Runae · 善缘</div>
        <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-top:4px;letter-spacing:0.2em">你的命盘报告已就绪</div>
      </td></tr>
      <!-- Greeting -->
      <tr><td style="padding:28px 24px 0">
        <p style="margin:0 0 12px;font-size:16px;color:#d4af37;font-weight:600">${displayName}，你的八字报告来了 ✨</p>
        <p style="margin:0;font-size:14px;color:rgba(240,238,230,0.75);line-height:1.8">
          ${zodiac ? `属${zodiac}的你，` : ''}命盘格局已为你深度解读完毕。以下是报告摘要：
        </p>
      </td></tr>
      <!-- Summary snippet -->
      <tr><td style="padding:16px 24px 0">
        <div style="background:rgba(212,175,55,0.04);border-left:3px solid #d4af37;border-radius:0 8px 8px 0;padding:16px 20px;font-size:14px;color:rgba(240,238,230,0.8);line-height:1.9">
          ${summarySnippet}${reportSummary && reportSummary.length > 500 ? '<br><em style="color:rgba(212,175,55,0.5);font-size:12px">…（完整报告见下方链接）</em>' : ''}
        </div>
      </td></tr>
      <!-- CTA -->
      <tr><td style="padding:28px 24px;text-align:center">
        <a href="${reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8972e);color:#1a0f2e;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.08em">
          🔮 查看完整命盘报告
        </a>
        <div style="margin-top:10px;font-size:12px;color:rgba(212,175,55,0.4)">每天早8点，专属运势已为你准备</div>
      </td></tr>
      <!-- Footer -->
      <tr><td style="border-top:1px solid rgba(212,175,55,0.1);padding:16px 24px;text-align:center">
        <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.8">
          Runae · shenyuan.mylumee.cn<br>
          本内容由AI生成，仅供娱乐参考，不构成人生重大决策建议。<br>
          <a href="${unsubUrl}" style="color:rgba(212,175,55,0.4);text-decoration:underline">退订邮件推送</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  // 发信失败不崩溃，静默返回ok（用户体验优先）
  try {
    await sendEmail(email.trim().toLowerCase(), `📖 你的八字命盘报告 · Runae`, html);
  } catch (e) {
    console.error('[email.send-report] failed:', e.message);
  }
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

// ─── 营销邮件模板库（5封轮换）────────────────────────

/**
 * 模板1（主打）: 每日运势 — 由 buildEmailHtml 生成，已覆盖
 * 模板2: 未试功能安利
 * 模板3: 择时提醒
 * 模板4: 裂变（合婚邀请）
 * 模板5: 升级引导（会员/报告折扣）
 *
 * 轮换规则：按订阅天数 mod 5 决定当天模板类型
 * Day 0,5,10…: 每日运势（默认）
 * Day 1,6,11…: 未试功能安利
 * Day 2,7,12…: 择时提醒
 * Day 3,8,13…: 合婚裂变
 * Day 4,9,14…: 升级引导
 */

function buildUntriedFeatureEmail({ name, zodiac, featuresDone, unsubUrl }) {
  const displayName = name || (zodiac ? `属${zodiac}的你` : '你');
  const done = Array.isArray(featuresDone) ? featuresDone : [];
  // 选一个用户还没试过的功能推荐
  const allFeatures = [
    { id: 'hehun', icon: '💑', title: '合婚配对', desc: '输入两人八字，测你们的缘分指数与相处要诀', url: '/pages/hehun.html?ref=email_upsell' },
    { id: 'best-timing', icon: '⏰', title: '最佳择时', desc: '找到本周最适合表白、谈钱、签合同的吉时', url: '/pages/best-timing.html?ref=email_upsell' },
    { id: 'numerology', icon: '🔢', title: '姓名数字能量', desc: '你的名字藏着什么天机？', url: '/pages/chat.html?ref=email_upsell' },
    { id: 'chart-archetype', icon: '🏛️', title: '命格稀有度', desc: '看看你的八字在千万人中是什么段位', url: '/pages/chart-archetype.html?ref=email_upsell' },
    { id: 'western', icon: '⭐', title: '西方星盘', desc: '东方八字遇见西方星座，双重解读你的命运', url: '/pages/astrology.html?ref=email_upsell' }
  ];
  const untried = allFeatures.filter(function(f) { return done.indexOf(f.id) === -1; });
  const feature = untried.length ? untried[Math.floor(Math.random() * untried.length)] : allFeatures[0];

  return {
    subject: `${displayName}，还有一个关于你的秘密没解开 🔮`,
    html: `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runae · 未解之谜</title></head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.15)">
  <tr><td style="background:linear-gradient(135deg,#1a0f2e,#2d1b4e);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
    <div style="font-size:28px;margin-bottom:8px">☯️</div>
    <div style="font-size:20px;font-weight:700;color:#d4af37;letter-spacing:0.1em">Runae · 善缘</div>
  </td></tr>
  <tr><td style="padding:28px 24px 0">
    <p style="margin:0 0 12px;font-size:15px;color:rgba(240,238,230,0.85);line-height:1.8">
      ${displayName}，你已经看过八字报告了 ✨<br>但还有一个关于你的面向，我们还没一起探索过：
    </p>
  </td></tr>
  <tr><td style="padding:16px 24px 0">
    <div style="background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">${feature.icon}</div>
      <div style="font-size:16px;font-weight:700;color:#d4af37;margin-bottom:8px;letter-spacing:0.06em">${feature.title}</div>
      <div style="font-size:13px;color:rgba(240,238,230,0.6);line-height:1.7;margin-bottom:16px">${feature.desc}</div>
      <a href="https://shenyuan.mylumee.cn${feature.url}" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8972e);color:#1a0f2e;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.06em">
        立即探索 →
      </a>
    </div>
  </td></tr>
  <tr><td style="border-top:1px solid rgba(212,175,55,0.1);padding:20px 24px;margin-top:24px;text-align:center">
    <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.7">
      Runae · shenyuan.mylumee.cn<br>本内容由AI生成，仅供娱乐参考。<br>
      <a href="${unsubUrl}" style="color:rgba(212,175,55,0.4);text-decoration:underline">退订</a>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`
  };
}

function buildBestTimingEmail({ name, zodiac, unsubUrl }) {
  const displayName = name || (zodiac ? `属${zodiac}的你` : '你');
  const today = new Date();
  const weekdays = ['日','一','二','三','四','五','六'];
  // 生成本周 3 个吉日（简化版：按数字规则）
  const goodDays = [
    { day: weekdays[(today.getDay() + 2) % 7], label: '谈重要事项、签合同', icon: '📝' },
    { day: weekdays[(today.getDay() + 4) % 7], label: '表白、发展感情', icon: '💕' },
    { day: weekdays[(today.getDay() + 5) % 7], label: '谈薪水、开口借钱', icon: '💰' }
  ];
  const rows = goodDays.map(function(g) {
    return `<tr>
      <td style="padding:10px 12px;font-size:20px;text-align:center">${g.icon}</td>
      <td style="padding:10px 12px;font-size:14px;color:#d4af37;font-weight:600">周${g.day}</td>
      <td style="padding:10px 12px;font-size:13px;color:rgba(240,238,230,0.7)">${g.label}</td>
    </tr>`;
  }).join('');

  return {
    subject: `本周最佳出击时机 — ${displayName}错过要等7天 ⏰`,
    html: `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runae · 本周吉时</title></head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.15)">
  <tr><td style="background:linear-gradient(135deg,#1a0f2e,#2d1b4e);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
    <div style="font-size:28px;margin-bottom:8px">⏰</div>
    <div style="font-size:20px;font-weight:700;color:#d4af37;letter-spacing:0.1em">本周择时速报</div>
    <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-top:4px">Runae · 善缘</div>
  </td></tr>
  <tr><td style="padding:24px 24px 0">
    <p style="margin:0 0 16px;font-size:14px;color:rgba(240,238,230,0.75);line-height:1.8">
      ${displayName}，本周有几个时机特别值得把握：
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15);border-radius:10px">
      ${rows}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(200,196,180,0.4);line-height:1.7">
      ⚠️ 以上基于五行气场简化推演，仅供参考娱乐，AI生成，不构成决策建议。
    </p>
  </td></tr>
  <tr><td style="padding:20px 24px;text-align:center">
    <a href="https://shenyuan.mylumee.cn/pages/best-timing.html?ref=email_timing" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8972e);color:#1a0f2e;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700">
      查看精准择时分析 →
    </a>
  </td></tr>
  <tr><td style="border-top:1px solid rgba(212,175,55,0.1);padding:16px 24px;text-align:center">
    <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.7">
      Runae · shenyuan.mylumee.cn<br>
      <a href="${unsubUrl}" style="color:rgba(212,175,55,0.4);text-decoration:underline">退订</a>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`
  };
}

function buildReferralEmail({ name, zodiac, refCode, unsubUrl }) {
  const displayName = name || (zodiac ? `属${zodiac}的你` : '你');
  const inviteUrl = `https://shenyuan.mylumee.cn/pages/hehun.html?ref=${refCode || 'email_viral'}`;
  return {
    subject: `${displayName}，测测你俩的合婚缘分吧 💑`,
    html: `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runae · 合婚邀请</title></head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(201,96,122,0.2)">
  <tr><td style="background:linear-gradient(135deg,#1a0f2e,rgba(201,96,122,0.08));padding:32px 24px;text-align:center;border-bottom:1px solid rgba(201,96,122,0.15)">
    <div style="font-size:36px;margin-bottom:8px">💑</div>
    <div style="font-size:20px;font-weight:700;color:#e8809a;letter-spacing:0.08em">合婚测缘分</div>
    <div style="font-size:12px;color:rgba(232,128,154,0.5);margin-top:4px">Runae · 善缘</div>
  </td></tr>
  <tr><td style="padding:28px 24px">
    <p style="margin:0 0 16px;font-size:15px;color:rgba(240,238,230,0.85);line-height:1.8">
      ${displayName}，你看过自己的命盘了。<br>
      有没有一个TA，你想知道你们合不合？
    </p>
    <div style="background:rgba(201,96,122,0.06);border:1px solid rgba(201,96,122,0.2);border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
      <div style="font-size:14px;color:rgba(232,128,154,0.9);line-height:1.8;margin-bottom:16px">
        两人八字合盘分析<br>
        <span style="font-size:12px;color:rgba(232,128,154,0.5)">缘分指数 · 相处要诀 · 感情运势</span>
      </div>
      <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#e8809a,#c0546e);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700">
        发给TA一起测 →
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:rgba(200,196,180,0.4);line-height:1.7;text-align:center">
      AI生成 · 仅供娱乐参考 · 不构成决策建议
    </p>
  </td></tr>
  <tr><td style="border-top:1px solid rgba(201,96,122,0.1);padding:16px 24px;text-align:center">
    <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.7">
      Runae · shenyuan.mylumee.cn<br>
      <a href="${unsubUrl}" style="color:rgba(232,128,154,0.4);text-decoration:underline">退订</a>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`
  };
}

function buildUpgradeEmail({ name, zodiac, unsubUrl }) {
  const displayName = name || (zodiac ? `属${zodiac}的你` : '你');
  return {
    subject: `${displayName}，年度会员限时5折 — 今天最后一天 ⚡`,
    html: `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runae · 升级会员</title></head>
<body style="margin:0;padding:0;background:#0d0820;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0820;padding:20px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a0f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.15)">
  <tr><td style="background:linear-gradient(135deg,#1a0f2e,#2d1b4e);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
    <div style="display:inline-block;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);border-radius:20px;padding:4px 16px;font-size:12px;color:#d4af37;margin-bottom:12px;letter-spacing:0.1em">限时优惠</div>
    <div style="font-size:20px;font-weight:700;color:#d4af37;letter-spacing:0.08em">解锁全年命盘</div>
    <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-top:4px">Runae · 善缘</div>
  </td></tr>
  <tr><td style="padding:28px 24px">
    <p style="margin:0 0 20px;font-size:15px;color:rgba(240,238,230,0.85);line-height:1.8">
      ${displayName}，你用过一次八字报告。<br>升级会员后，每周运势、流年大运、合婚无限测，全部解锁。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        <td style="padding:12px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15);border-radius:10px;text-align:center">
          <div style="font-size:12px;color:rgba(212,175,55,0.5);margin-bottom:4px;text-decoration:line-through">¥199/年</div>
          <div style="font-size:28px;font-weight:700;color:#d4af37">¥99</div>
          <div style="font-size:11px;color:rgba(212,175,55,0.6)">年度会员 · 仅今天</div>
        </td>
      </tr>
    </table>
    <div style="text-align:center">
      <a href="https://shenyuan.mylumee.cn/pages/bazi.html?tab=upgrade&ref=email_upgrade" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8972e);color:#1a0f2e;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.06em">
        立即升级 →
      </a>
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:rgba(200,196,180,0.35);text-align:center;line-height:1.7">
      AI生成内容 · 仅供娱乐参考 · 不构成人生重大决策建议
    </p>
  </td></tr>
  <tr><td style="border-top:1px solid rgba(212,175,55,0.1);padding:16px 24px;text-align:center">
    <div style="font-size:11px;color:rgba(240,238,230,0.3);line-height:1.7">
      Runae · shenyuan.mylumee.cn<br>
      <a href="${unsubUrl}" style="color:rgba(212,175,55,0.4);text-decoration:underline">退订</a>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`
  };
}

// ─── Daily batch send ────────────────────────────────

async function sendDailyBatch() {
  const subs = loadSubs();
  if (!subs.length) return { sent: 0, failed: 0, total: 0 };
  const today = new Date();
  const dateStr = `${today.getMonth()+1}月${today.getDate()}日`;

  // 按生肖分组，同生肖共用一次 AI 生成（仅对运势模板生效）
  const zodiacGroups = {};
  for (const sub of subs) {
    const zodiac = sub.birthYear ? getZodiac(sub.birthYear) : '';
    if (!zodiacGroups[zodiac]) zodiacGroups[zodiac] = [];
    zodiacGroups[zodiac].push(sub);
  }

  // 缓存运势（按生肖，避免重复调 AI）
  const fortuneCache = {};

  let sent = 0, failed = 0;
  for (const [zodiac, group] of Object.entries(zodiacGroups)) {
    for (const sub of group) {
      const unsubToken = makeUnsubToken(sub.email);
      const unsubUrl = `https://shenyuan.mylumee.cn/api/email/unsubscribe?token=${unsubToken}`;

      // 轮换模板：按订阅天数 mod 5
      const daysSince = sub.ts ? Math.floor((Date.now() - sub.ts) / 86400000) : 0;
      const tplIdx = daysSince % 5;

      let subject, html;
      try {
        if (tplIdx === 0) {
          // 模板1: 每日运势
          if (!fortuneCache[zodiac]) {
            fortuneCache[zodiac] = await generateFortune(zodiac);
          }
          html = buildEmailHtml({ name: sub.name || '', zodiac, date: today, fortuneContent: fortuneCache[zodiac], unsubUrl });
          subject = `☯️ 善缘天机 · ${dateStr}每日运势`;
        } else if (tplIdx === 1) {
          // 模板2: 未试功能安利
          const tpl = buildUntriedFeatureEmail({ name: sub.name || '', zodiac, featuresDone: sub.features || [], unsubUrl });
          subject = tpl.subject; html = tpl.html;
        } else if (tplIdx === 2) {
          // 模板3: 择时提醒
          const tpl = buildBestTimingEmail({ name: sub.name || '', zodiac, unsubUrl });
          subject = tpl.subject; html = tpl.html;
        } else if (tplIdx === 3) {
          // 模板4: 合婚裂变
          const refCode = sub.refCode || '';
          const tpl = buildReferralEmail({ name: sub.name || '', zodiac, refCode, unsubUrl });
          subject = tpl.subject; html = tpl.html;
        } else {
          // 模板5: 升级引导
          const tpl = buildUpgradeEmail({ name: sub.name || '', zodiac, unsubUrl });
          subject = tpl.subject; html = tpl.html;
        }
      } catch (e) {
        // 任意模板构建失败，降级到运势模板
        console.error('[email] template build failed, fallback to fortune:', e.message);
        if (!fortuneCache[zodiac]) fortuneCache[zodiac] = buildFallbackFortune(zodiac);
        html = buildEmailHtml({ name: sub.name || '', zodiac, date: today, fortuneContent: fortuneCache[zodiac], unsubUrl });
        subject = `☯️ 善缘天机 · ${dateStr}每日运势`;
      }

      const ok = await sendEmail(sub.email, subject, html);
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
