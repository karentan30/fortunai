require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3021;
const DEEPSEEK_API_KEY = process.env.DS_KEY || process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const STRIPE_SECRET_KEY = process.env.STRIPE_PAY_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:' + PORT;

// ── Stripe (only loaded when key exists) ──
let stripe = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
    console.log('✓ Stripe initialized');
  }
} catch(e) {
  console.log('ℹ Stripe not available (stripe package not installed)');
}

// ── CORS (allow all origins for dev) ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Stripe webhook needs raw body
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// ── Static files ──
app.use(express.static(path.join(__dirname, '..')));

// ── Database ──
const db = new Database(path.join(__dirname, 'shenyuan.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE,
    product TEXT,
    amount INTEGER,
    currency TEXT DEFAULT 'usd',
    donor_name TEXT,
    contact TEXT,
    wish_text TEXT,
    payment_status TEXT DEFAULT 'pending',
    stripe_session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    input TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertOrder = db.prepare(
  'INSERT INTO orders (order_no, product, amount, currency, donor_name, contact, wish_text, stripe_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const insertReading = db.prepare(
  'INSERT INTO readings (type, input, result) VALUES (?, ?, ?)'
);

// ── DeepSeek chat ──
async function deepseekChat(messages, opts = {}) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = JSON.stringify({
    model: opts.model || DEEPSEEK_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 2048,
    stream: false
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
    },
    body,
    signal: AbortSignal.timeout(opts.timeout || 30000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('DeepSeek API ' + res.status + ': ' + err.slice(0, 200));
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function buildReadingPrompt(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

// ── Product prices (cents) ──
const PRODUCTS = {
  bazi_basic:   { name: '基础命盘',     amount: 990,  desc: '日主+五行+今年运势' },
  bazi_full:    { name: '完整命盘',     amount: 1990, desc: '六维+十年大运+流月' },
  bazi_vip:     { name: '深度批命',     amount: 3990, desc: '大师级·终身档案' },
  daily_sub:    { name: '每日天机订阅', amount: 690,  desc: '月订阅·五行+Affirmation' },
  tarot:        { name: '塔罗占卜',     amount: 390,  desc: 'AI塔罗解读' },
  hehun:        { name: '合婚配对',     amount: 1990, desc: '双方八字合婚分析' },
};

// ── Health ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '善缘 ShenYuan',
    version: 'v2.0',
    port: PORT,
    stripe: stripe ? 'connected' : 'not_configured',
    llm: DEEPSEEK_API_KEY ? 'deepseek' : 'unavailable'
  });
});

// ════════════════════════════════════════════
// STRIPE PAYMENT
// ════════════════════════════════════════════

// POST /api/create-checkout — Create Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: '支付系统暂未开通' });
    }

    const { product, donorName, contact, wishText, email, successUrl, cancelUrl } = req.body;
    const prod = PRODUCTS[product];
    if (!prod) {
      return res.status(400).json({ error: '无效的产品 ID', valid: Object.keys(PRODUCTS) });
    }

    const orderNo = 'SY-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: prod.name, description: prod.desc },
          unit_amount: prod.amount,
          recurring: product === 'daily_sub' ? { interval: 'month' } : undefined,
        },
        quantity: 1,
      }],
      mode: product === 'daily_sub' ? 'subscription' : 'payment',
      success_url: successUrl || FRONTEND_URL + '/api/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || FRONTEND_URL + '/pages/' + product.split('_')[0] + '.html',
      customer_email: email || undefined,
      metadata: { order_no: orderNo, product, donor_name: donorName || '', contact: contact || '' }
    });

    // Save pending order
    insertOrder.run(
      orderNo, product, prod.amount, 'usd',
      donorName || '', contact || '', wishText || '', session.id
    );

    console.log(`[CHECKOUT] ${orderNo} — ${prod.name} $${(prod.amount/100).toFixed(2)}`);

    res.json({ url: session.url, sessionId: session.id, orderNo });
  } catch (err) {
    console.error('[CHECKOUT ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe-webhook — Stripe payment confirmation
app.post('/api/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (STRIPE_WEBHOOK_SECRET && stripe) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // Fallback: parse raw body
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[WEBHOOK SIG ERR]', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        if (orderNo) {
          db.prepare('UPDATE orders SET payment_status = ? WHERE order_no = ?').run('completed', orderNo);
          console.log(`[PAYMENT] ${orderNo} — completed`);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        if (orderNo) {
          db.prepare('UPDATE orders SET payment_status = ? WHERE order_no = ?').run('expired', orderNo);
        }
        break;
      }
      case 'customer.subscription.created': {
        const sub = event.data.object;
        db.prepare('INSERT OR IGNORE INTO subscriptions (email, stripe_subscription_id) VALUES (?, ?)')
          .run(sub.customer_email || '', sub.id);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK ERR]', err);
    res.status(500).send('Webhook handler error');
  }
});

// GET /api/success — Payment success page (lightweight HTML)
app.get('/api/success', (req, res) => {
  const sessionId = req.query.session_id || '';
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付成功 · 善缘</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0e0a04;font-family:'Noto Serif SC','Georgia',serif;display:flex;justify-content:center;align-items:center;min-height:100vh;color:rgba(255,245,220,0.9)}
  .card{background:#170e06;border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:40px 32px;max-width:360px;text-align:center;margin:20px}
  .icon{font-size:48px;margin-bottom:16px}
  h1{font-size:18px;letter-spacing:0.16em;color:#c9a84c;margin-bottom:8px;font-weight:400}
  p{font-size:12px;color:rgba(255,245,220,0.5);letter-spacing:0.08em;line-height:1.8;margin-bottom:24px}
  .btn{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#8a6420,#c9a84c,#e8d08a);border:none;border-radius:4px;color:#0e0a04;font-family:'Noto Serif SC',serif;font-size:13px;letter-spacing:0.16em;cursor:pointer;text-decoration:none}
  .gold-line{width:50px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:16px auto}
</style></head><body>
<div class="card">
  <div class="icon">🙏</div>
  <h1>功德圆满</h1>
  <div class="gold-line"></div>
  <p>您的善款已成功支付。<br>天机已启，自有因缘。</p>
  <a class="btn" href="/">返回首页</a>
</div>
<script>
  if (window.opener) { window.opener.postMessage('payment_complete', '*'); }
</script>
</body></html>`;
  res.send(html);
});

// ════════════════════════════════════════════
// AI READING ENDPOINTS
// ════════════════════════════════════════════

// POST /api/bazi — 八字命理
app.post('/api/bazi', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请提供出生年月日' });
    }

    const messages = buildReadingPrompt(
      '你是一位精通子平八字命理的大师。以专业但亲切的语气为用户解读命盘。遵循麦玲玲风格：先说问题再给解决方案，给具体时间点和数字，情感共鸣开场，给行动方案。语言：简体中文。',
      `生辰：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : '时辰不详'}
性别：${gender === 'male' ? '男' : '女'}
提问：${question || '请综合分析命盘'}

请按以下结构解析：
1. 日主分析（日干五行属性、强弱、性格特征）
2. 五行强弱（各五行百分比、旺弱判定）
3. 大运流年（目前运势走向，未来3年重要节点）
4. 各方面分析（财运、感情、健康、事业各给评分+建议）
5. 开运建议（颜色、方位、物品）`
    );

    const result = await deepseekChat(messages, { maxTokens: 3072 });
    insertReading.run('bazi', JSON.stringify(req.body), result);

    res.json({ reading: result });
  } catch (err) {
    console.error('[BAZI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// POST /api/tarot — 塔罗占卜
app.post('/api/tarot', async (req, res) => {
  try {
    const { cards, question, topic } = req.body;
    if (!question) {
      return res.status(400).json({ error: '请提供你的问题' });
    }

    const cardDesc = cards && cards.length
      ? cards.map((c, i) => `第${i+1}张（${c.position||'位置'+(i+1)}）：${c.name}${c.reversed?'（逆位）':'（正位）'}`).join('\n')
      : '使用随机三张塔罗牌（过去-现在-未来）';

    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势' };

    const messages = buildReadingPrompt(
      '你是一位融合东西方智慧的塔罗占卜师。温柔有力，既有洞见又不武断。给具体建议（3条）。',
      `问题：${question}
主题：${topicMap[topic] || topic || '综合'}
${cardDesc ? '牌面：\n' + cardDesc : ''}

请：
1. 综合解读（200字左右）
2. 给3条具体建议`
    );

    const result = await deepseekChat(messages);
    insertReading.run('tarot', JSON.stringify(req.body), result);

    res.json({ reading: result });
  } catch (err) {
    console.error('[TAROT ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// POST /api/ziwei — 紫微斗数
app.post('/api/ziwei', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay || birthHour === undefined) {
      return res.status(400).json({ error: '紫微斗数需要出生年月日时' });
    }

    const messages = buildReadingPrompt(
      '你是一位精通紫微斗数的命理师。通俗易懂，让没学过紫微的人也能理解。',
      `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时
性别：${gender === 'male' ? '男' : '女'}

请分析：
1. 命宫主星（主星及其含义）
2. 十二宫简析（命宫、财帛宫、官禄宫、夫妻宫、疾厄宫）
3. 今年流年运势
4. 一句话总结`
    );

    const result = await deepseekChat(messages);
    insertReading.run('ziwei', JSON.stringify(req.body), result);

    res.json({ analysis: result });
  } catch (err) {
    console.error('[ZIWEI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// POST /api/mianxiang — 面相手相
app.post('/api/mianxiang', async (req, res) => {
  try {
    const { question } = req.body;

    const messages = buildReadingPrompt(
      '你是一位擅长面相手相的民间相士。给有洞见但不过于绝对的解读，加一句免责声明。',
      `用户问题：${question || '请综合分析'}

请分析：额头（思维/早年运）、眼神（内心/感情）、鼻子（财运/中年）、嘴（表达/晚年）、整体建议。`
    );

    const result = await deepseekChat(messages);
    insertReading.run('mianxiang', JSON.stringify({ question }), result);

    res.json({ reading: result });
  } catch (err) {
    console.error('[MIANXIANG ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// POST /api/hehun — 合婚配对
app.post('/api/hehun', async (req, res) => {
  try {
    const { p1Year, p1Month, p1Day, p1Hour, p2Year, p2Month, p2Day, p2Hour, p1Gender, p2Gender } = req.body;
    if (!p1Year || !p2Year) {
      return res.status(400).json({ error: '请提供双方出生信息' });
    }

    const messages = buildReadingPrompt(
      '你是一位精通八字合婚的命理师。麦玲玲风格——先说问题再给解决方案，给具体分数和行动方案。浪漫但不虚假。',
      `双方信息：
A方：${p1Year}年${p1Month}月${p1Day}日${p1Hour !== undefined ? p1Hour+'时' : ''} · ${p1Gender === 'male' ? '男' : '女'}
B方：${p2Year}年${p2Month}月${p2Day}日${p2Hour !== undefined ? p2Hour+'时' : ''} · ${p2Gender === 'male' ? '男' : '女'}

请按结构输出：
1. 合婚总分（百分制）
2. 五行互补分析
3. 感情默契度评分+说明
4. 财运事业互补度评分+说明
5. 需要留意的冲突点
6. 开运建议（相处的颜色、方位、注意事项）
7. 一句话总结`
    );

    const result = await deepseekChat(messages, { maxTokens: 3072 });
    insertReading.run('hehun', JSON.stringify(req.body), result);

    res.json({ reading: result });
  } catch (err) {
    console.error('[HEHUN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// POST /api/daily — 每日运势
app.post('/api/daily', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const ganZhi = '今日干支推算';

    const messages = buildReadingPrompt(
      '你是一位命理师，每日给用户个性化的五行运势和Affirmation。温暖、具体、不笼统。',
      `用户：${birthYear||'?'}年${birthMonth||'?'}月${birthDay||'?'}日生 · ${gender === 'male' ? '男' : gender === 'female' ? '女' : ''}
今日日期：${dateStr}

请生成：
1. 今日五行能量百分比（木火土金水）
2. 幸运色
3. 幸运数字
4. 宜做/忌做的事情各2条
5. 一段专属的Affirmation（基于用户可能的日主五行，50字左右）
6. 一句古诗词作为收尾`
    );

    const result = await deepseekChat(messages);
    insertReading.run('daily', JSON.stringify(req.body), result);

    res.json({ reading: result });
  } catch (err) {
    console.error('[DAILY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// GET /api/orders — 查看订单（管理员用）
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50').all();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products — 产品列表
app.get('/api/products', (req, res) => {
  res.json({ products: PRODUCTS });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════╗`);
  console.log(`║   善缘 ShenYuan v2.0              ║`);
  console.log(`║   Port: ${PORT}                      ║`);
  console.log(`║   LLM: ${DEEPSEEK_API_KEY ? 'DeepSeek ✓' : 'No LLM ✗'}          ║`);
  console.log(`║   Stripe: ${stripe ? '✓' : '✗ (no key)'}             ║`);
  console.log(`╚═══════════════════════════════════╝\n`);
});
