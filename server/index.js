require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const astrology = require('./astrology.js');

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

// ── CORS (restrict to known origins) ──
var ALLOWED_ORIGINS = [
  'http://localhost:3021',
  'http://localhost:3000',
  'http://47.242.80.65:3021',
  'https://shenyuan.mylumee.cn',
  'https://shenyuan.vercel.app',
  'https://shenyuan-fabulousslim.vercel.app',
  'https://shenyuan-karentan30-fabulousslim.vercel.app',
  'https://fortunai.vercel.app',
  'https://myfortuneai.vercel.app'
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// ── Request logging ──
app.use(function(req, res, next) {
  var start = Date.now();
  res.on('finish', function() {
    var ms = Date.now() - start;
    if (req.path.startsWith('/api/')) {
      console.log('[REQ]', req.method, req.path, res.statusCode, ms + 'ms');
    }
  });
  next();
});

app.use(express.json({ limit: '10mb' }));

// Stripe webhook needs raw body
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// ── Static files ──
app.use(express.static(path.join(__dirname, '..')));  // Vercel handles static files

// ── In-memory Data Store (Vercel-compatible, replaces better-sqlite3) ──
const _M = { users:[], tokens:[], orders:[], readings:[], subs:[], _id:{u:1,t:1,o:1,r:1,s:1} };
const insertUser = { run(e,h){const id=_M._id.u++;_M.users.push({id,email:e,password_hash:h,name:'',created_at:new Date().toISOString()});return{lastInsertRowid:id};} };
const getUserByEmail = { get(e){return _M.users.find(u=>u.email===e);} };
const getUserById = { get(id){const u=_M.users.find(x=>x.id===id);return u?{id:u.id,email:u.email,name:u.name,created_at:u.created_at}:undefined;} };
const insertToken = { run(uid,t){_M.tokens.push({id:_M._id.t++,user_id:uid,token:t,created_at:new Date().toISOString()});} };
const getToken = { get(t){const tok=_M.tokens.find(x=>x.token===t);if(!tok)return null;const u=_M.users.find(x=>x.id===tok.user_id);return u?{...tok,email:u.email,name:u.name}:null;} };
const getUserOrders = { all(uid){return _M.orders.filter(o=>o.user_id===uid&&o.payment_status==='completed').sort((a,b)=>b.created_at.localeCompare(a.created_at));} };
const insertOrder = { run(oNo,p,amt,cur,uid,dN,c,wT,sId){_M.orders.push({id:_M._id.o++,order_no:oNo,product:p,amount:amt,currency:cur,user_id:uid,donor_name:dN,contact:c,wish_text:wT,stripe_session_id:sId,payment_status:'pending',created_at:new Date().toISOString()});} };
const insertReading = { run(t,i,r,u){_M.readings.push({id:_M._id.r++,type:t,input:i,result:r,user_id:u||null,created_at:new Date().toISOString()});} };
const getReadingsByUser = { all(uId){return _M.readings.filter(r=>r.user_id===uId).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,5);} };
function _updOrder(s,oNo){const o=_M.orders.find(x=>x.order_no===oNo);if(o)o.payment_status=s;}
function _insSub(e,sId){if(!_M.subs.find(x=>x.stripe_subscription_id===sId))_M.subs.push({email:e,stripe_subscription_id:sId,status:'active',created_at:new Date().toISOString()});}
function _allOrders(){return[..._M.orders].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,50);}
function _insJossOrder(oNo,p,amt,cur,dN,c,wT,ps){_M.orders.push({id:_M._id.o++,order_no:oNo,product:p,amount:amt,currency:cur,donor_name:dN,contact:c,wish_text:wT,payment_status:ps,created_at:new Date().toISOString()});}

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
    signal: AbortSignal.timeout(opts.timeout || 120000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error('DeepSeek API ' + res.status + ': ' + err.slice(0, 200));
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return msg?.content || msg?.reasoning_content || '';
}

function buildReadingPrompt(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

// ── Product prices (cents) ──
const PRODUCTS = {
  bazi_basic:   { name: '基础命盘',         amount: 990,  desc: '日主+五行+今年运势' },
  bazi_full:    { name: '完整命盘',         amount: 1990, desc: '六维+十年大运+流月' },
  bazi_vip:     { name: '深度批命',         amount: 3990, desc: '大师级·终身档案' },
  daily_sub:    { name: '每日天机订阅',     amount: 690,  desc: '月订阅·五行+Affirmation' },
  tarot:        { name: '塔罗占卜',         amount: 390,  desc: 'AI塔罗解读' },
  hehun:        { name: '合婚配对',         amount: 1990, desc: '双方八字合婚分析' },
  member_monthly:  { name: '月度会员',      amount: 690,  desc: '全部AI占算无限次·完整报告不锁定' },
  member_yearly:   { name: '年度会员',      amount: 4900, desc: '全年畅用·大师语音·水晶挂件' },
  member_lifetime: { name: '终身会员',      amount: 18800, desc: '永久畅享·大师1对1·专属档案' },
  member_daily:     { name: '日会员',       amount: 299,  desc: '24小时无限使用' },
  member_quarterly: { name: '季会员',       amount: 1499, desc: '三个月畅享' },
  member_3year:     { name: '三年会员',     amount: 3999, desc: '超值三年' },
  daliuren:    { name: '大六壬预测',      amount: 990,  desc: '三传四课' },
  qimen:       { name: '奇门遁甲',        amount: 990,  desc: '八门九星' },
  bazi_trial:  { name: '体验命盘',        amount: 199,  desc: '快速简批' },
};

// ── Inspiration quotes library ──
var INSPIRATION_QUOTES = [
  {cn:'万物皆有裂痕，那是光照进来的地方', en:'There is a crack in everything, that is how the light gets in', src:'Leonard Cohen'},
  {cn:'当你真心渴望某件事，整个宇宙都会来帮忙', en:'When you truly want something, the universe conspires to help you', src:'Paulo Coelho'},
  {cn:'顺其自然，不是放弃而是让一切发生', en:'Go with the flow, not giving up but letting things happen', src:'Tao Te Ching'},
  {cn:'此心安处是吾乡', en:'Where the heart finds peace, there is home', src:'Su Shi'},
  {cn:'行到水穷处，坐看云起时', en:'Walk to the edge of water, sit and watch clouds rise', src:'Wang Wei'},
  {cn:'心若向阳，无畏悲伤', en:'Face the sun and the shadows fall behind you', src:'Chinese Proverb'},
  {cn:'一念放下，万般自在', en:'Let go of one thought and find ten thousand freedoms', src:'Zen Wisdom'},
  {cn:'天行健，君子以自强不息', en:'As heaven moves with strength, the noble strives unceasingly', src:'I Ching'},
  {cn:'知足者常乐，能忍者自安', en:'Contentment brings lasting joy, patience brings inner peace', src:'Ancient Wisdom'},
  {cn:'塞翁失马，焉知非福', en:'A blessing in disguise — who knows what fortune misfortune brings', src:'Huainanzi'},
  {cn:'红尘万丈，只为渡你一人', en:'Through ten thousand worlds, I cross only for you', src:'Buddhist Proverb'},
  {cn:'本来无一物，何处惹尘埃', en:'From nothing comes nothing — where can dust gather', src:'Huineng'},
  {cn:'不忘初心，方得始终', en:'Stay true to your heart and you will find your way', src:'Buddhist Scripture'},
  {cn:'上善若水，水善利万物而不争', en:'The highest good is like water, benefiting all without striving', src:'Lao Tzu'},
  {cn:'山不向我走来，我便向山走去', en:'If the mountain won\'t come to me, I will go to the mountain', src:'Chinese Idiom'},
  {cn:'命里有时终须有，命里无时莫强求', en:'What is meant for you will come; what is not, let it go', src:'Ancient Proverb'},
  {cn:'大音希声，大象无形', en:'Great sound is silent, great form is formless', src:'Lao Tzu'},
  {cn:'人生如逆旅，我亦是行人', en:'Life is a journey, and I too am a traveler', src:'Su Shi'},
  {cn:'长风破浪会有时，直挂云帆济沧海', en:'The wind will rise and break the waves, set sail across the vast sea', src:'Li Bai'},
  {cn:'不以物喜，不以己悲', en:'Let not joy from possessions nor sorrow from self prevail', src:'Fan Zhongyan'},
  {cn:'The only way out is through', en:'The only way out is through', src:'Robert Frost'},
  {cn:'This too shall pass', en:'This too shall pass', src:'Sufi Wisdom'},
  {cn:'Be the change you wish to see in the world', en:'Be the change you wish to see in the world', src:'Mahatma Gandhi'},
  {cn:'In the middle of difficulty lies opportunity', en:'In the middle of difficulty lies opportunity', src:'Albert Einstein'},
  {cn:'The soul becomes dyed with the color of its thoughts', en:'The soul becomes dyed with the color of its thoughts', src:'Marcus Aurelius'},
  {cn:'To love oneself is the beginning of a lifelong romance', en:'To love oneself is the beginning of a lifelong romance', src:'Oscar Wilde'},
  {cn:'What you seek is seeking you', en:'What you seek is seeking you', src:'Rumi'},
  {cn:'Let the beauty of what you love be what you do', en:'Let the beauty of what you love be what you do', src:'Rumi'},
  {cn:'The wound is the place where the light enters you', en:'The wound is the place where the light enters you', src:'Rumi'},
  {cn:'You are the universe experiencing itself', en:'You are the universe experiencing itself', src:'Alan Watts'},
  {cn:'The quieter you become, the more you can hear', en:'The quieter you become, the more you can hear', src:'Rumi'},
  {cn:'知之者不如好之者，好之者不如乐之者', en:'To know is good, to love is better, to delight is best', src:'Confucius'},
  {cn:'己所不欲，勿施于人', en:'Do not do to others what you do not want done to yourself', src:'Confucius'},
  {cn:'学而不思则罔，思而不学则殆', en:'Learning without thought is lost; thought without learning is perilous', src:'Confucius'},
  {cn:'道生一，一生二，二生三，三生万物', en:'The Tao gives birth to one, one to two, two to three, three to all things', src:'Lao Tzu'},
  {cn:'天地与我并生，万物与我为一', en:'Heaven and earth exist with me; all things and I are one', src:'Zhuangzi'},
  {cn:'至人无己，神人无功，圣人无名', en:'The perfect man has no self; the spiritual man has no achievement; the sage has no name', src:'Zhuangzi'},
  {cn:'祸兮福之所倚，福兮祸之所伏', en:'Misfortune rests upon fortune; fortune conceals misfortune', src:'Lao Tzu'},
  {cn:'柔弱胜刚强', en:'Gentleness overcomes strength', src:'Lao Tzu'},
  {cn:'千里之行，始于足下', en:'A journey of a thousand miles begins with a single step', src:'Lao Tzu'}
];

// ── Masters data (真人大师入驻) ──
const MASTERS = [
  { id: 1, name: "张明远", title: "八字命理师", exp: "30年",
    specialty: "八字/风水", rating: 4.9, price: "$19.9/次",
    desc: "师承正统子平命理，擅长八字批命和家居风水。为数百位企业家指点过运势，客户遍及海内外。",
    avatarInitial: "张", tags: ["命理泰斗", "风水"] },
  { id: 2, name: "李灵素", title: "塔罗占卜师", exp: "15年",
    specialty: "塔罗/感情", rating: 4.8, price: "$9.9/次",
    desc: "精通韦特塔罗和雷诺曼，擅长感情和事业占卜。以温暖细腻的解牌风格深受用户喜爱。",
    avatarInitial: "李", tags: ["情感专家", "塔罗"] },
  { id: 3, name: "Sarah Moon", title: "Astrologer", exp: "20年",
    specialty: "西方占星/合盘", rating: 4.7, price: "$14.9/次",
    desc: "Western astrology specialist. Natal charts, synastry, and transit analysis in English & Chinese.",
    avatarInitial: "S", tags: ["Western", "Astrology"] },
  { id: 4, name: "王道正", title: "奇门遁甲师", exp: "25年",
    specialty: "奇门遁甲/六壬", rating: 4.6, price: "$24.9/次",
    desc: "道家正一派传人，深研奇门遁甲与大六壬。擅长择吉、趋吉避凶、商业决策咨询。",
    avatarInitial: "王", tags: ["奇门", "道家"] },
  { id: 5, name: "陈慧心", title: "心理咨询师", exp: "12年",
    specialty: "心理占星/性格分析", rating: 4.9, price: "$12.9/次",
    desc: "心理学硕士，融合西方心理学与东方命理。擅长用MBTI+星盘帮你认识真正的自己。",
    avatarInitial: "陈", tags: ["心理学", "星盘"] },
  { id: 6, name: "玄机子", title: "紫微斗数命理师", exp: "40年",
    specialty: "紫微斗数/风水", rating: 4.8, price: "$29.9/次",
    desc: "台湾紫微斗数名家，著作等身。精通紫微斗数排盘与阳宅风水，桃李遍天下。",
    avatarInitial: "玄", tags: ["紫微泰斗", "风水"] }
];

// GET /api/masters — 大师列表
app.get('/api/masters', (req, res) => {
  res.json({ masters: MASTERS });
});

// GET /api/inspiration — Daily inspiration quote
app.get('/api/inspiration', (req, res) => {
  var now = new Date();
  var idx = (now.getFullYear() * 365 + (now.getMonth() + 1) * 31 + now.getDate()) % INSPIRATION_QUOTES.length;
  res.json({
    date: now.toISOString().split('T')[0],
    quote: INSPIRATION_QUOTES[idx],
    total: INSPIRATION_QUOTES.length
  });
});

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
// AUTHENTICATION
// ════════════════════════════════════════════

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  var parts = stored.split(':');
  var salt = parts[0];
  var hash = parts[1];
  var check = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === check;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Rate limiting ──
var rateLimit = {};
function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimit[ip]) rateLimit[ip] = [];
  rateLimit[ip] = rateLimit[ip].filter(function(t) { return now - t < 60000; });
  if (rateLimit[ip].length > 60) return false;
  rateLimit[ip].push(now);
  return true;
}
function rateLimitMiddleware(req, res, next) {
  var ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  next();
}

// Middleware: extract user from token
function authMiddleware(req, res, next) {
  const token = req.headers['authorization'] || req.query.token;
  if (!token) {
    req.user = null;
    return next();
  }
  const t = token.replace('Bearer ', '');
  const row = getToken.get(t);
  req.user = row ? { id: row.user_id, email: row.email, name: row.name } : null;
  next();
}

// POST /api/auth/register
app.post('/api/auth/register', rateLimitMiddleware, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // Check existing
    const existing = getUserByEmail.get(email);
    if (existing) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }

    const hash = hashPassword(password);
    const result = insertUser.run(email, hash);
    const token = generateToken();
    insertToken.run(result.lastInsertRowid, token);

    console.log(`[AUTH] Register: ${email}`);
    res.json({ token, user: { id: result.lastInsertRowid, email } });
  } catch (err) {
    console.error('[AUTH ERR]', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', rateLimitMiddleware, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    const user = getUserByEmail.get(email);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = generateToken();
    insertToken.run(user.id, token);

    console.log(`[AUTH] Login: ${email}`);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('[AUTH ERR]', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未登录' });
  }
  res.json({ user: req.user });
});

// GET /api/orders/mine — 当前用户订单
app.get('/api/orders/mine', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    const orders = getUserOrders.all(req.user.id);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
// STRIPE PAYMENT
// ════════════════════════════════════════════

// POST /api/create-checkout — Create Stripe Checkout Session
app.post('/api/create-checkout', rateLimitMiddleware, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: '支付系统暂未开通' });
    }

    const { product, donorName, contact, wishText, email, successUrl, cancelUrl, token } = req.body;
    const prod = PRODUCTS[product];
    if (!prod) {
      return res.status(400).json({ error: '无效的产品 ID', valid: Object.keys(PRODUCTS) });
    }

    // Resolve user from token (optional)
    let userId = null;
    if (token) {
      const t = token.replace('Bearer ', '');
      const row = getToken.get(t);
      if (row) userId = row.user_id;
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
      orderNo, product, prod.amount, 'usd', userId,
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
          _updOrder('completed', orderNo);
          console.log(`[PAYMENT] ${orderNo} — completed`);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        if (orderNo) {
          _updOrder('expired', orderNo);
        }
        break;
      }
      case 'customer.subscription.created': {
        const sub = event.data.object;
        _insSub(sub.customer_email || '', sub.id);
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

// ── AI追问上下文缓存 ──
var qaContext = {};

// 每次生成报告时保存上下文（在bazi/hehun/tarot等路由中调用）
function saveQaContext(endpoint, input, reading) {
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  qaContext[id] = {
    endpoint: endpoint,
    input: input,
    reading: reading,
    createdAt: Date.now()
  };
  // 清理超过30分钟的旧上下文
  var cutoff = Date.now() - 30 * 60 * 1000;
  Object.keys(qaContext).forEach(function(k) {
    if (qaContext[k].createdAt < cutoff) delete qaContext[k];
  });
  return id;
}

// ── Optional auth for reading routes (attach userId if token present) ──
app.use(function(req, res, next) {
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/') && !req.path.startsWith('/api/stripe-webhook') && !req.path.startsWith('/api/health') && !req.path.startsWith('/api/success') && !req.path.startsWith('/api/orders') && !req.path.startsWith('/api/products') && !req.path.startsWith('/api/create-checkout') && !req.path.startsWith('/api/inspiration')) {
    const token = req.headers['authorization'] || req.query.token;
    if (token) {
      const t = token.replace('Bearer ', '');
      const row = getToken.get(t);
      if (row) req.userId = row.user_id;
    }
  }
  next();
});

// ════════════════════════════════════════════
// AI READING ENDPOINTS
// ════════════════════════════════════════════

// POST /api/bazi — 八字命理
app.post('/api/bazi', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请提供出生年月日' });
    }

    const modeInstruction = (mode === 'gentle')
      ? '\n\n【说话模式】\n你温暖治愈、以鼓励为主，让人感到被理解。即使指出问题，也要先肯定再引导，用温柔的方式表达。'
      : '\n\n【说话模式】\n你说话直率、不留情面，但句句为对方好。直接指出问题，不拐弯抹角，用最直白的方式告诉命主真相。';

    const messages = buildReadingPrompt(
      `你是一位精通八字命理的实力派命理师，既有正统传承的底子，又懂现代人的语言。你说话有分寸——引经据典时不掉书袋，用大白话解释深奥命理，但偶尔一句古文点睛让报告有分量。

【说话风格】
1. 先说好事，让人感到被认可和尊重；再温和指出问题；最后给出具体可行的解决办法。
2. 三分古典七分白话——核心结论用大白话，引古书时一定附上白话翻译。让读不懂古文的人也能看懂，让懂古文的人觉得有水平。
3. 具体——给出具体的年份、数字、颜色、物品，让人能照着做。
4. 开场用温暖轻松的语调，先共情，再分析。不用"老朽""施主""老夫"这类太文言的说法，用"我"和"你"直接对话。

【输出格式】
你必须严格按照以下15个维度展开，每个维度都要写详细，总字数在10000-15000字之间。维度之间用空行分隔。每个维度的标题必须用对应的emoji开头。

维度结构：
1. 📜 四柱八字排盘（年柱月柱日柱时柱分别解释）
2. 🔥 十神分析（正官/偏印/食神/伤官等）
3. 🟤 五行能量分析
4. 💰 财运格局
5. 💕 感情姻缘（含夫妻宫分析）
6. 💼 事业格局
7. 🏥 健康预警和养生建议（越具体越好）
8. 📅 全部8步大运（从当前大运开始前后各排，每步大运100-200字）
9. 🔮 未来10年逐年流年详批（财运评分/感情评分/事业评分）
10. ✨ 神煞分析（天乙贵人/桃花/驿马等）
11. 🌿 藏干分析
12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫
13. 🎯 开运锦囊
14. 📖 古法断语
15. 💌 命理师的叮嘱

语言：简体中文。用朋友聊天一样的语气写，不要文言腔。重要信息加粗。偶尔引一句经典命理时，一定用白话解释清楚。

⚠️ 重要：这是深度命理报告，用户付费购买的。每个维度必须展开到极致详细。
- 总字数要求：10000-15000字
- 给出的建议必须非常具体：具体到颜色色号、具体到日期、具体到物品品牌
- 大运排盘：必须排出全部8步大运，每步大运不少于100-200字分析，不漏
- 流年分析：未来10年逐年分析，每一年给出财运/感情/事业评分
- 引用古文时用白话解释（普通人都能看懂）
- 多用量化数据（百分比、分数、排名）让报告有说服力${modeInstruction}`,
      `请为我批算八字命盘，生成一份完整的深度命理报告。

【基本信息】
出生时间：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : '（时辰不详）'}
性别：${gender === 'male' ? '男' : '女'}
用户关注：${question || '请全面分析命盘'}

【输出要求】
请严格按照以下维度展开，每个维度都要写详细，总字数10000-15000字。每个维度用对应的emoji作为标题开头。每个维度都必须基于上述生辰八字展开具体分析，不能泛泛而谈。

1. 📜 四柱八字排盘
- 分别解释年柱、月柱、日柱、时柱的天干地支含义
- 各柱代表的含义（年柱祖上、月柱父母兄弟、日柱自身夫妻、时柱子女晚年）
- 整体八字格局如何

2. 🔥 十神分析
- 详细列出所有十神（正官、偏官/七杀、正印、偏印、正财、偏财、比肩、劫财、食神、伤官）
- 每个十神在命局中的位置和作用
- 十神组合对性格和命运的影响

3. 🟤 五行能量分析
- 八字中每个五行的百分比（精确到数字，如木25%、火30%等）
- 哪种五行最旺、哪种最弱
- 需要补什么五行、泄什么五行
- 五行对应的身体器官提醒（如木主肝胆、火主心脏等）
- 饮食养生建议（吃什么补什么）

4. 💰 财运格局
- 正财格局分析（稳定收入/工资）
- 偏财格局分析（投资/副业/意外之财）
- 命中有无财库、财库是否打开
- 发财的最佳年龄段（给出具体年份！）
- 适合的求财行业方向
- 禁忌的投资行为（什么样的投资会亏）
- 未来10年的财运走势

5. 💕 感情姻缘
- 夫妻宫分析
- 正缘特征描述（身高范围、性格特点、职业方向、认识场景等具体描述）
- 遇到正缘的最佳年份（给出具体年份）
- 桃花运分析（烂桃花还是正桃花）
- 已有伴侣用户的感情建议
- 单身用户如何提升遇到正缘的概率

6. 💼 事业格局
- 八字中官杀/印星情况分析
- 适合的职业路径（打工、创业、自由职业、体制内等）
- 升职/跳槽的最佳时机（具体到年份+月份）
- 贵人特征（什么属相/什么性格的人是贵人）和出现的时间
- 创业还是打工的判断
- 未来10年事业建议

7. 🏥 健康预警和养生建议
- 先天体质弱项（哪个脏腑需要特别注意）
- 需要重点关注的年龄段
- 高发病症预警（越具体越好）
- 养生建议（适合的运动类型、作息建议、饮食调理，越具体越好）

8. 📅 全部8步大运
- 从当前大运开始，前后各排，列出全部8步大运
- 每步大运的干支、起始年份和结束年份
- 每步大运100-200字的详细分析，解释该运对命主的影响
- 每步大运都算出来，不漏

9. 🔮 未来10年逐年流年详批
- 从当前年份起，往后10年逐年分析
- 每一年给出 财运评分/感情评分/事业评分（百分制）
- 每一年给出关键提醒和注意事项

10. ✨ 神煞分析
- 天乙贵人（有无、位置、对命主的影响）
- 桃花（有无、位置、是正桃花还是烂桃花）
- 驿马（有无、位置、是否主动奔波）
- 其他重要神煞（如华盖、孤辰寡宿、太极贵人、文昌贵人等）

11. 🌿 藏干分析
- 每个地支中藏有哪些天干
- 藏干透出情况分析
- 藏干对命局的影响

12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫
- 父母宫分析（父母缘分、是否得力）
- 子女宫分析（子女缘分、数量倾向、子女成就）
- 夫妻宫分析（婚姻质量、配偶特征）

13. 🎯 开运锦囊
- 幸运颜色（精确到具体的色系，如藏青色、琥珀色等）
- 幸运数字（3个数字，解释为什么）
- 吉祥方位（求财方位、求姻缘方位）
- 推荐佩戴物品（材质、形状、颜色）
- 家居风水建议（卧室/书房/客厅的布置建议）
- 流年避讳（今年不要做什么）

14. 📖 古法断语
- 引用一句经典命理古籍中的断语（如《渊海子平》《三命通会》《滴天髓》等）
- 用通俗语言解释这句话的含义
- 这句话如何对应命主的人生

15. 💌 命理师的叮嘱
- 温暖、鼓励的结尾
- 针对此命主八字专属的3条人生建议
- 一句祝福收尾`
    );

    const result = await deepseekChat(messages, { maxTokens: 16384 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);

    res.json({ reading: result, contextId: ctxId });
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
      '你是一位融合东西方智慧的塔罗占卜师，从业二十年，解读过上万个案。你像一位知心姐姐，温暖有力量，说话柔和但直抵人心。你能让求助者在迷茫中看到光，在困惑中找到方向。记住：逆位牌不是坏牌，是提醒；困难不是终点，是转折。每次回答至少2000字。语言：简体中文。',
      `问题：${question}
主题：${topicMap[topic] || topic || '综合'}
${cardDesc ? '牌面信息：\n' + cardDesc : '使用随机三张塔罗牌（过去-现在-未来）'}

请按照以下结构出具一份完整的塔罗占卜解读，每张牌必须详细展开300-400字：

## 一、整体格局概览（200-300字）
从所有牌面的整体能量场出发，给用户一个全局性的判断。能量是向上还是向下？牌面传递了什么核心信息？用一句话概括今天的占卜主题。

## 二、逐牌详细解读（每张牌300-400字）
对每张牌进行深度解读，包括：
- 牌面的核心牌义（正位/逆位的具体含义）
- 这张牌在这个位置（过去/现在/未来/障碍/建议等）的特殊意义
- 这张牌与问题${question}的直接关联
- 如果是逆位牌，重点强调"挑战也是机会"，给出转化建议

## 三、综合解读与能量走向（300-400字）
将所有牌串联起来，形成一个完整的故事线。从过去到未来，能量如何流动？格局如何演变？给用户一幅清晰的地图。

## 四、3条可执行的行动建议（每条100字左右）
针对牌面给出具体、可落地的建议。不要笼统地说"保持积极"，要具体到怎么做、什么时候做、注意什么。

## 五、每月行动提醒（100字）
基于牌面能量，告诉用户在这个月里最适合做的一件事（或最需要注意的一个事项）。

## 六、占卜师的悄悄话（100-150字）
温暖、私人化的收尾，让用户感受到被理解和支持。可以是一句人生感悟，也可以是一句鼓励。`
    );

    const result = await deepseekChat(messages, { maxTokens: 8192 });
    insertReading.run('tarot', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('tarot', req.body, result);

    res.json({ reading: result, contextId: ctxId });
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
      '你是一位精通紫微斗数的命理师，师承中州派，从业30年，批过上万张命盘。你深谙紫微斗数精髓，能从命盘中看透一个人的一生轨迹。你的语言通俗易懂，不用晦涩术语唬人——要用大白话让从没学过紫微的人也能听懂。你的分析必须专业、深刻、具体。每次回答至少4000字。用Markdown格式输出，使用标题、加粗让报告结构清晰。语言：简体中文。',
      `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时
性别：${gender === 'male' ? '男' : '女'}

请按以下结构出具一份完整的紫微斗数命理报告。每个宫位的分析必须不少于200字，总字数不少于4000字：

## 一、命盘基本格局（200-300字）
- 命宫所在宫位、主星、辅星
- 格局名称（如"日照雷门""月朗天门""杀破狼""机月同梁"等）
- 一句话概括此命格

## 二、命宫主星深度解读（400-500字）
- 主星特性、在命宫的影响力
- 命宫三方四正的整体分析
- 命主性格特质的深度剖析（至少5个特质）
- 性格中需要调和的面向

## 三、主要宫位逐个分析（每个宫位200-300字，至少8个宫位）

1. **命宫** — 性格、人生基调、气质
2. **兄弟宫** — 手足缘分、母亲缘、人际关系底色
3. **夫妻宫** — 感情模式、正缘特征、婚姻质量
4. **子女宫** — 子女缘分、创造力、投资运
5. **财帛宫** — 财源、理财方式、财运走势
6. **疾厄宫** — 先天体质、高发病症、需要关注的年龄段
7. **迁移宫** — 外出运、外地发展、交通运势
8. **官禄宫** — 事业方向、职场表现、升迁机遇
9. **田宅宫** — 不动产运、家庭环境、居住品质
10. **福德宫** — 精神世界、福报、晚年心境
11. **父母宫** — 父母缘分、祖荫、家风影响

## 四、四化飞星分析（200-300字）
- 本命四化（化禄、化权、化科、化忌分别落哪一宫）
- 四化组合的深层含义
- 化忌所在宫位需要特别注意的事项

## 五、当前大运详批（400-500字）
- 目前走第几步大运、大运干支
- 大运四化星分布
- 当前大运的总体走势
- 大运期间需要把握的机会
- 大运期间需要规避的风险

## 六、流年关键点（300-400字）
- 当前流年命盘重心
- 流年四化对当前大运的影响
- 今年最重要的3个关注点（事业/财运/感情/健康）
- 今年需要主动求变的领域

## 七、开运建议（200-300字）
- 适合的职业方向（基于官禄宫和财帛宫）
- 幸运方位（基于迁移宫）
- 需要培养的能力或品质
- 流年避讳（今年不要做什么）

## 八、一句话点睛（50-100字）
用诗意的一句话总结此命盘的精华。`
    );

    const result = await deepseekChat(messages, { maxTokens: 16384 });
    insertReading.run('ziwei', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('ziwei', req.body, result);

    res.json({ analysis: result, contextId: ctxId });
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
      '你是一位民间相面高人，阅人无数，行走江湖四十载，看过十万张面孔。你深知"相由心生，境随心转"的道理——面相不是一成不变的，心善则貌美，心恶则相凶。你的分析一针见血但不忘提醒用户命运掌握在自己手中。每次回答至少2000字。用Markdown格式输出，使用标题、加粗让报告结构清晰。语言：简体中文。',
      `用户关注：${question || '请综合分析面相与手相'}

请按以下结构出具一份详细的面相手相分析报告。每个部位分析不少于200字：

## 一、额头（天庭）— 事业运、早年运（200-300字）
- 额头高低、宽窄、饱满度的象征意义
- 早年运势（0-30岁）的总体判断
- 思维方式和智商体现
- 额头纹路的含义（如有抬头纹、川字纹等）
- 开运建议：如何通过发型、妆容改善额头的运势

## 二、眉毛 — 兄弟朋友、性格脾气（200-300字）
- 眉形、浓淡、长短的性格反映
- 眉毛是否顺而不乱（代表人际关系是否顺畅）
- 兄弟缘分和朋友运的判断
- 开运建议：眉形修剪和日常打理

## 三、眼睛 — 内心世界、桃花、诚信（200-300字）
- 眼神（藏而不露/露而不藏）透露的内心世界
- 眼形（桃花眼、丹凤眼、三角眼等）的含义
- 眼白和眼珠的比例反映的诚信度和运气
- 眼神是否有神、是否浑浊的福报判断
- 开运建议：如何通过眼神训练提升运势

## 四、鼻子 — 财运、中年运（200-300字）
- 鼻梁高低、鼻头大小代表的财运格局
- 鼻子的"三停"（山根、鼻梁、鼻头）各自含义
- 鼻孔是否外露（漏财/守财）
- 中年运（30-50岁）的财运判断
- 开运建议：鼻部妆容修饰和气场调整

## 五、嘴巴 — 表达力、晚年运、食禄（200-300字）
- 唇形、唇色的福气判断
- 嘴角上扬/下垂体现的人生态度
- 牙齿整齐度与福报的关系
- 口才表达能力和人际关系的影响
- 晚年运（50岁后）的判断

## 六、下巴（地阁）— 不动产运、晚年（150-200字）
- 下巴方圆/尖窄代表的不动产运和晚年福气
- 双下巴（福相/贵相）的判断
- 下巴与晚年的关系

## 七、整体面相格局评估（200-300字）
- 五岳四渎（额头为南岳、鼻子为中岳等）的整体平衡
- 三停（上停、中停、下停）的比例分析
- 面部的气色判断（红润/晦暗等）
- 整体福气指数（百分制）

## 八、改善面相的小建议（150-200字）
- 表情管理（多笑、眉头舒展、眼神温和）
- 日常妆容建议（如何通过修饰提升面相福气）
- 内在修养（心善则貌美——多行善事、少生怒气）

## 九、相面师的叮嘱（100字）
提醒用户：面相会变，心善则貌美。以上分析仅基于文字描述，如需精准分析请上传正面照片。`
    );

    const result = await deepseekChat(messages, { maxTokens: 8192 });
    insertReading.run('mianxiang', JSON.stringify({ question }), result, req.userId);

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
      '你是一位德高望重的合婚师，从业四十余年，阅人无数，撮合过上千对姻缘。你说话诚恳、直率、不留情面，但句句为对方好。你深知婚姻不是儿戏，合婚分析必须全面深刻、落到实地。每次回答至少3000字。用Markdown格式输出，使用标题、加粗、分隔线让报告清晰易读。语言：简体中文。',
      `双方信息：
A方：${p1Year}年${p1Month}月${p1Day}日${p1Hour !== undefined ? p1Hour+'时' : ''} · ${p1Gender === 'male' ? '男' : '女'}
B方：${p2Year}年${p2Month}月${p2Day}日${p2Hour !== undefined ? p2Hour+'时' : ''} · ${p2Gender === 'male' ? '男' : '女'}

请详细展开以下分析维度（总字数8000-12000字）：
1. 双方四柱八字详细排盘（各柱逐一解释）
2. 五行互补度详细分析（含五行百分比）
3. 十神互动分析
4. 性格匹配度（含具体相处场景分析）
5. 价值观兼容性
6. 吵架模式和冲突化解技巧
7. 双方父母/家庭兼容性分析
8. 子女缘分分析
9. 最佳结婚年份+月份
10. 前世因缘分析
11. 婚后注意事项（财务/家庭/事业/生育）
12. 综合建议

请按以下结构出具一份详细的合婚报告（每项都要有具体评分和深度分析，不许敷衍）。每个章节必须用Markdown标题（##）形式。每项必须展开300字以上的详细分析：

## 一、合婚总分（百分制）
给出综合评分，并简要说明为什么是这个分数。

## 二、五行互补度（满分20分）
分析两人八字中的五行（金木水火土）是否互补，各自旺什么、缺什么，两人在一起能否五行中和。给出具体分数并详细分析。

## 三、性格匹配度（满分20分）
从日干、月令分析两人的性格是否合拍。谁强谁弱、谁主内谁主外、沟通风格是否对路。给出分数并详细分析。

## 四、价值观兼容性（满分15分）
从命局分析两人的价值观取向（物质vs精神、家庭vs事业、保守vs冒险），是否有根本冲突。给出分数并详细分析。

## 五、吵架模式分析（满分10分）
根据八字冲合，分析两人会在什么情况下触发争吵（财务压力、家庭干涉、个性摩擦、沟通不畅等），给出具体的避免方法和冲突化解技巧。

## 六、气场合度（满分10分）
委婉地分析两人在亲密关系中的气场是否和谐，包括情感表达方式、亲密节奏是否匹配、是否会有长期的冷淡或摩擦周期。给出分数并详细分析。

## 七、生育子女缘分（满分5分）
从子女宫、食伤星分析是否有子女缘，何时要孩子最合适，孩子对婚姻的影响。

## 八、双方父母家庭兼容性（满分5分）
从年柱、月柱分析两家是否合得来，有无婆媳或翁婿矛盾隐患，给出相处建议。

## 九、最佳结婚年份（满分5分）
给出具体的最佳结婚年份和月份（如2026年农历八月），并详细说明为什么这个时间最吉。

## 十、婚后需要注意的3个事项
具体、可执行，如财务安排（谁管钱）、与长辈同住是否合适、事业发展节奏协调等。

## 十一、合婚古诀引用
引用1-2句经典命理古籍（《渊海子平》《三命通会》《滴天髓》等）中的合婚口诀，附白话解释和点评。

## 十二、一句话结论
用诗意、温暖的语言总结这二人的姻缘。给一个让人心安、充满希望的收尾。`
    );

    const result = await deepseekChat(messages, { maxTokens: 16384 });
    insertReading.run('hehun', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('hehun', req.body, result);

    res.json({ reading: result, contextId: ctxId });
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
      '你是一位晨间命理师，专门为人们开启美好的一天。你温暖如晨光，鼓励如春风，实用如老友。你熟读老黄历、精通五行生克，知道每一天的干支运势对人的影响。你的目标是给用户一整天的高能量和好心情。每次都给出具体的、个性化的、可执行的建议。每次回答至少1500字。用Markdown格式输出。语言：简体中文。',
      `用户：${birthYear||'?'}年${birthMonth||'?'}月${birthDay||'?'}日生 · ${gender === 'male' ? '男' : gender === 'female' ? '女' : ''}
今日日期：${dateStr}

请根据今天的干支五行和用户可能的日主，生成一份完整、温暖、充满能量的每日运势报告，至少1500字。每个章节用Markdown标题（##）形式：

## 一、今日黄历（按老黄历风格，150-200字）
- 今日干支（例如"甲子日""丙午日"等）
- 今日宜忌（至少各3条，具体到"宜签约""忌动土"等）
- 今日冲煞（冲什么生肖、什么时辰最需要注意）

## 二、五行能量评分（200-300字）
- 木、火、土、金、水今日能量百分比（精确到具体数字，总和100%）
- 今日哪个五行当令、哪个最弱
- 对用户（基于可能的日主五行）来说，今日需要补什么五行、泄什么五行
- 对应到行动上：今天的能量适合做什么类型的事情

## 三、今日幸运信息（100-150字）
- 幸运色（3个颜色，说明为什么选这些颜色）
- 幸运数字（3个数字，结合今日干支的五行数理）
- 幸运方位（求财方位、求感情方位）
- 最吉利的时辰（几点到几点）

## 四、专属Affirmation（150-200字）
基于用户可能的日主五行，写一段独家的、非模板的、直击心灵的肯定语。不要"我是强大的"这种通用句，要结合今日的五行能量和用户可能的日主特质，写出让用户读完之后心生力量、一整天都带着好能量的文字。可以参考"我是____，今日____能量助我____"的句式，但要自然不刻意。

## 五、今日3个小行动（每条100-150字）
给用户3个具体、可执行、用时不超过15分钟的小行动建议。例如：
- 什么时间喝什么茶、吃什么颜色的食物
- 什么时间段做哪类工作更容易顺利
- 今天的社交策略（多说/多听/少说/不见人）
- 今天的休息和放松方式（散步/冥想/泡茶等）

## 六、今日古诗词配运势解读
选一首适合今日能量和意境的古诗词（唐诗宋词为佳），不需太长，四句或八句即可。然后用自己的话解读这首诗如何呼应今日的运势走向，让用户在诗意中找到力量和安慰。

## 七、今日能量寄语（50-100字）
最后给用户一句温暖有力的话，作为今天的"能量钥匙"——简短、上口、有力量，用户可以记住一整天。例如"今日____之势，助我____"的句式。`
    );

    const result = await deepseekChat(messages, { maxTokens: 8192 });
    insertReading.run('daily', JSON.stringify(req.body), result, req.userId);

    res.json({ reading: result });
  } catch (err) {
    console.error('[DAILY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// POST /api/ask-followup — 追问命理师
app.post('/api/ask-followup', async (req, res) => {
  try {
    const { contextId, question } = req.body;
    if (!contextId || !question) {
      return res.status(400).json({ error: '缺少上下文ID或问题' });
    }

    const ctx = qaContext[contextId];
    if (!ctx) {
      return res.status(404).json({ error: '上下文已过期，请重新生成报告' });
    }

    const messages = [
      { role: 'system', content: '你是一位善缘命理平台的资深命理师。用户刚刚看了他们的命理报告，现在有后续问题要问你。\n请基于以下报告内容回答用户的问题。语气亲切、专业、具体，给出时间点和建议。\n\n之前的报告内容：\n' + ctx.reading.slice(0, 3000) },
      { role: 'user', content: question }
    ];

    const answer = await deepseekChat(messages, { maxTokens: 2048 });
    res.json({ answer });
  } catch (err) {
    console.error('[QA ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// GET /api/context/:id — 获取QA上下文（前端连接用）
app.get('/api/context/:id', (req, res) => {
  var ctx = qaContext[req.params.id];
  if (!ctx) return res.status(404).json({ error: '上下文不存在' });
  res.json({ endpoint: ctx.endpoint });
});

// POST /api/fengshui — AI风水评测
app.post('/api/fengshui', async (req, res) => {
  try {
    const { houseDirection, floor, rooms, occupants, address, question } = req.body;
    if (!houseDirection) {
      return res.status(400).json({ error: '请提供房屋朝向' });
    }

    const messages = [
      { role: 'system', content: '你是一位精通八宅风水与玄空飞星的风水大师，从业30年。语气亲切专业，给出具体可操作的建议。' },
      { role: 'user', content: '房屋朝向：' + (houseDirection || '') + '\n楼层：' + (floor || '未提供') + '\n房间布局：' + (rooms || '未提供') + '\n居住成员：' + (occupants || '未提供') + '\n地址：' + (address || '未提供') + '\n用户问题：' + (question || '请综合分析房屋风水') + '\n\n请按以下结构详细分析（要求3000+字）：\n1. 🏠 房屋格局总评\n2. 🧭 八宅吉凶位分析（每个方位逐一分析）\n3. 🛏️ 各房间风水建议（卧室/客厅/厨房/书房/卫生间）\n4. 💰 财位分析及催财布局\n5. ❤️ 桃花位/人缘位布局\n6. 🏃 健康位分析\n7. 🪴 化解与开运建议（植物/摆件/颜色）\n8. 📐 户型改造建议\n9. 🎯 一句话总结' }
    ];

    const analysis = await deepseekChat(messages, { maxTokens: 12288 });
    res.json({ analysis });
  } catch (err) {
    console.error('[FENGSHUI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/geo-fortune — 基于经纬度的地域命理分析
app.post('/api/geo-fortune', async (req, res) => {
  try {
    const { latitude, longitude, birthYear, birthMonth, birthDay, gender } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: '请提供经纬度' });
    }

    // 根据经纬度判断地域五行属性
    var latDir = latitude >= 0 ? '北半球' : '南半球';
    var longDir = longitude >= 0 ? '东经' : '西经';

    // 粗略地域五行
    var regionElement = '土';
    if (longitude > 0 && longitude < 60) regionElement = '土';
    else if (longitude >= 60 && longitude < 120) regionElement = '木';
    else if (longitude >= -60 && longitude < 0) regionElement = '金';
    else regionElement = '水';
    if (Math.abs(latitude) > 45) regionElement = '水';
    else if (Math.abs(latitude) < 15) regionElement = '火';

    const messages = [
      { role: 'system', content: '你是一位结合传统风水与现代地理学的命理师。擅长分析不同地域对个人运势的影响。' },
      { role: 'user', content: '用户位置：纬度 ' + latitude + '（' + latDir + '），经度 ' + longitude + '（' + longDir + '）\n地域五行属性：' + regionElement + '\n出生信息：' + (birthYear ? birthYear + '年' : '') + (birthMonth ? birthMonth + '月' : '') + (birthDay ? birthDay + '日' : '') + '\n性别：' + (gender || '未提供') + '\n\n请分析：\n1. 🌍 此地的地理能量特点\n2. 🧭 在此地居住/工作的五行影响\n3. 💰 此地财运分析\n4. ❤️ 此地感情/人际运势\n5. 🏃 此地健康提醒\n6. 🎯 在此地发展的建议\n7. 📍 更适合此人的其他方位建议' }
    ];

    const analysis = await deepseekChat(messages, { maxTokens: 8192 });
    res.json({ analysis, location: { lat: latitude, lng: longitude, regionElement: regionElement } });
  } catch (err) {
    console.error('[GEO ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// GET /api/orders — 查看订单（管理员用）
app.get('/api/orders', (req, res) => {
  try {
    const orders = _allOrders();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products — 产品列表
app.get('/api/products', (req, res) => {
  res.json({ products: PRODUCTS });
});

// POST /api/order — 代供/冥器订单
app.post('/api/order', (req, res) => {
  try {
    const { donorName, contact, wishText, recipientName, temple, timing, total, specialReq } = req.body;
    if (!donorName || !contact) {
      return res.status(400).json({ error: '请填写施主姓名和联系方式' });
    }
    const orderNo = 'SY-JOSS-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const fullWish = '【往生者】' + (recipientName || '未指定') +
                     ' 【道场】' + (temple || '未指定') +
                     ' 【时间】' + (timing || '未指定') +
                     '\n祝愿词：' + (wishText || '') +
                     (specialReq ? '\n特别要求：' + specialReq : '');
    const amount = total ? parseInt(total) : 0;
    _insJossOrder(orderNo, 'joss_burning', amount, 'usd', donorName, contact, fullWish, 'pending');
    console.log('[JOSS ORDER]', orderNo, '-', donorName, '- $' + (amount/100).toFixed(2));
    res.json({ success: true, orderNo: orderNo });
  } catch (err) {
    console.error('[JOSS ORDER ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
// LIUYAO / LINGQIAN / DEITY / OFFERING
// ════════════════════════════════════════════

// POST /api/liuyao — 六爻占卜
app.post('/api/liuyao', async (req, res) => {
  try {
    const { question, topic } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // Simulate six coin tosses to generate a hexagram
    var coins = [];
    for (var i = 0; i < 6; i++) {
      var val = Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2);
      coins.push(val); // 0=老阴, 1=少阳, 2=少阴, 3=老阳
    }
    var guaYao = coins.map(function(c) { return c >= 2 ? '---' : '- -'; });
    var guaBinary = coins.map(function(c) { return c >= 2 ? 1 : 0; }).join('');

    const messages = [
      { role: 'system', content: '你是一位精通《周易》六爻占卜的民间大师，擅长用通俗语言解读卦象。语气亲切、具体、实用。' },
      { role: 'user', content: `用户问题：${question}
主题：${topic || '综合'}
起卦结果（由系统六爻生成）：
${guaYao[5]}  (上九)
${guaYao[4]}  (九五)
${guaYao[3]}  (九四)
${guaYao[2]}  (九三)
${guaYao[1]}  (九二)
${guaYao[0]}  (初九)

请按结构详细解读（3000+字）：
1. 🔮 本卦解读（此卦象的整体含义）
2. 📖 爻辞详解（每爻逐一解释）
3. 🎯 针对问题的具体指引
4. ⏰ 应期判断（何时会有结果）
5. 💡 行动建议（3条具体建议）
6. ⚠️ 注意事项`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 12288 });
    var ctxId = saveQaContext('liuyao', req.body, reading);
    res.json({ reading, contextId: ctxId, hexagram: guaYao });
  } catch (err) {
    console.error('[LIUYAO ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/lingqian — 求神灵签
app.post('/api/lingqian', async (req, res) => {
  try {
    const { question, temple } = req.body;

    var qianNum = Math.floor(Math.random() * 100) + 1;
    var qianType = qianNum <= 15 ? '上上签' : qianNum <= 35 ? '上签' : qianNum <= 65 ? '中签' : qianNum <= 85 ? '下签' : '下下签';
    var qianPoem = '签诗由AI生成';  // Will be generated by AI

    const messages = [
      { role: 'system', content: '你是一位在名山古寺修行多年的解签僧人。解签时语气温和、充满智慧，既点明签文深意又给人希望。' },
      { role: 'user', content: `求签地点：${temple || '善缘灵境'}
用户问题：${question || '请指点迷津'}
抽得签号：第${qianNum}签（${qianType}）

请生成：
1. 📜 签诗（四句七言古诗，原创）
2. 🏮 解签（签文含义，300字左右）
3. 🎯 对你的启示（针对用户问题的具体指引）
4. 💡 行动建议
5. 🙏 祈福方法`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 8192 });
    var ctxId = saveQaContext('lingqian', req.body, reading);
    res.json({
      reading,
      contextId: ctxId,
      qian: { number: qianNum, type: qianType }
    });
  } catch (err) {
    console.error('[LINGQIAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/deity-guide — 求神指引
app.post('/api/deity-guide', async (req, res) => {
  try {
    const { question, birthYear, gender, preference } = req.body;
    if (!question) return res.status(400).json({ error: '请说明你求什么事' });

    const messages = [
      { role: 'system', content: '你是一位深谙佛道仙三家文化的寺庙住持，为信众指点该拜哪位菩萨或仙家。语气慈悲、智慧、不迷信。' },
      { role: 'user', content: `信众所求：${question}
出生年份：${birthYear || '未提供'}
性别：${gender || '未提供'}
偏好：${preference || '无特定偏好'}

请详细分析（3000+字）：
1. 🧭 根据所求之事，最适合供奉的菩萨/仙家（推荐1-3位）
2. 📖 每位菩萨/仙家的简介和掌管领域
3. 🙏 对应供奉方式（香/花/果/灯/水）
4. 💰 供奉建议（具体到花篮规格、水果种类、灯油天数）
5. 🏠 在家中何处设供桌
6. 🕐 最佳供奉时辰
7. 📿 持诵什么经文/咒语
8. 💌 仙家文化特别指导（如果是求仙家）`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 12288 });
    res.json({ reading });
  } catch (err) {
    console.error('[DEITY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/offering-plan — 供奉方案
app.post('/api/offering-plan', async (req, res) => {
  try {
    const { deity, purpose, budget, duration } = req.body;
    if (!deity || !purpose) {
      return res.status(400).json({ error: '请提供供奉对象和所求事项' });
    }

    const messages = [
      { role: 'system', content: '你是一位寺庙供奉管理师，为信众设计最合适的供奉方案。包含实体供奉（花篮/水果/香油灯）和电子供奉。' },
      { role: 'user', content: `供奉对象：${deity}
所求事项：${purpose}
预算：${budget || '不限'}
供奉时长：${duration || '7天'}

请设计详细的供奉方案（3000+字）：

一、🍎 实体供品推荐
  1. 花篮（花材选择、颜色寓意、规格）
  2. 水果（种类、数量、摆放方式）
  3. 香油灯（不同灯种的含义）- 包括：
     - 光明灯（求智慧、学业）
     - 平安灯（求平安、健康）
     - 财运灯（求财、事业）
     - 姻缘灯（求姻缘、感情）
     - 消灾灯（化解灾难、小人）
  4. 其他供品

二、🕯️ 电子供奉方案
  1. 在线点灯（选灯种、时长、回向文）
  2. 电子供花（虚拟花篮）
  3. 在线供果
  4. 电子功德箱

三、📅 供奉日程安排
  每日/每周供奉计划

四、💰 费用预算
  各方案的价格区间

五、🙏 祈福回向文
  适合此愿望的专属回向文`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 12288 });
    res.json({ reading });
  } catch (err) {
    console.error('[OFFERING ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/daliuren — 大六壬预测
app.post('/api/daliuren', async (req, res) => {
  try {
    const { question, birthYear, gender } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // Simulate 大六壬 lesson selection (随机课名+神将)
    var lessonNames = ['元首课', '重审课', '涉害课', '遥克课', '昴星课', '伏吟课', '返吟课', '别责课', '八专课', '三光课', '三阳课', '三奇课', '六仪课', '天赦课', '铸印课'];
    var deities = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
    var lesson = lessonNames[Math.floor(Math.random() * lessonNames.length)];
    var randomDeities = [];
    for (var i = 0; i < 4; i++) {
      randomDeities.push(deities[Math.floor(Math.random() * deities.length)]);
    }

    const messages = [
      { role: 'system', content: '你是一位精通大六壬的玄学大师，民间尊称"六壬神断"，从业四十余年。你深谙六壬三传四课之精妙，能从课象中洞悉天机。你的语气平和笃定，引经据典但深入浅出，让求测者信服。' },
      { role: 'user', content: `用户问题：${question}
出生年份：${birthYear || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

起课结果（系统随机）：
课名：${lesson}
课将：${randomDeities[0]}、${randomDeities[1]}、${randomDeities[2]}、${randomDeities[3]}

请按以下结构详细解读（3000+字）：
1. 📜 课名解读（此课名的含义和格局）
2. 🏮 课体传象（三传四课分析）
3. 🎯 针对问题的具体断语
4. ⏰ 应期判断（何时会有转机或结果）
5. 💡 行动建议（3条具体可执行建议）
6. ⚠️ 注意事项与化解方法`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 12288 });
    var ctxId = saveQaContext('daliuren', req.body, reading);
    res.json({ reading, contextId: ctxId, lesson: { name: lesson, gods: randomDeities } });
  } catch (err) {
    console.error('[DALIUREN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/qimen — 奇门遁甲
app.post('/api/qimen', async (req, res) => {
  try {
    const { question, direction, birthYear, gender } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // Simulate 奇门局 (随机八门+九星)
    var eightDoors = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
    var nineStars = ['天蓬星', '天任星', '天冲星', '天辅星', '天英星', '天芮星', '天柱星', '天心星', '天禽星'];
    var shuffledDoors = [...eightDoors].sort(function() { return Math.random() - 0.5; });
    var shuffledStars = [...nineStars].sort(function() { return Math.random() - 0.5; });
    var currentDoor = shuffledDoors[0];
    var currentStar = shuffledStars[0];

    const messages = [
      { role: 'system', content: '你是一位精通奇门遁甲的高人，师承茅山道脉，精研奇门数十年。你擅长排盘布局，能从八门九星中洞察时空能量，为求测者指点迷津。你的语气沉稳、自信、有道家仙风，每个断语都有理有据。' },
      { role: 'user', content: `用户问题：${question}
出生年份：${birthYear || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}
求测方位：${direction || '未提供'}

起局结果（系统随机）：
值使门（八门）：${currentDoor}
值符星（九星）：${currentStar}
其余八门：${shuffledDoors.slice(1).join('、')}
其余九星：${shuffledStars.slice(1).join('、')}

请按以下结构详细解读（3000+字）：
1. 🌐 奇门局象总评（此局的整体格局判断）
2. 🚪 八门分析（值使门${currentDoor}的含义及对求测事的影响）
3. ⭐ 九星分析（值符星${currentStar}的能量及吉凶）
4. 🎯 针对问题的具体局象指引
5. ⏰ 时间窗口判断（何时行动最有利）
6. 📍 方位建议（吉方和忌方）
7. 💡 行动建议（3条具体可执行建议）`}
    ];

    const reading = await deepseekChat(messages, { maxTokens: 12288 });
    var ctxId = saveQaContext('qimen', req.body, reading);
    res.json({ reading, contextId: ctxId, door: currentDoor, star: currentStar });
  } catch (err) {
    console.error('[QIMEN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// POST /api/xingming — 姓名学分析
app.post('/api/xingming', async (req, res) => {
  try {
    const { surname, givenName, zodiac, gender } = req.body;
    if (!surname || !givenName) {
      return res.status(400).json({ error: '请提供姓氏和名字' });
    }

    const messages = buildReadingPrompt(
      '你是一位精通姓名学的命理大师，深谙五格剖象法（天格、人格、地格、外格、总格）与生肖喜忌之道，从业三十余年，为成千上万人改过名。你的分析专业深刻——笔画数理、五行补益、生肖适配，面面俱到。你的语气亲切实在，用大白话解释深奥姓名学原理，不故弄玄虚。每个建议都给出具体的新名字选项，让人能照着做。',
      `用户姓名：${surname}${givenName}
姓氏：${surname}
名字：${givenName}
生肖：${zodiac || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

请按以下结构出具一份完整的姓名学分析报告，总字数不少于3000字：

## 一、📊 五格数理分析（600-800字）

### 1.1 笔画计算
- 天格（姓氏笔画+1）：计算方式及结果
- 人格（姓氏+名字第一字笔画）：计算方式及结果
- 地格（名字两字笔画之和）：计算方式及结果
- 外格（总格-人格+1）：计算方式及结果
- 总格（姓名全部笔画之和）：计算方式及结果

### 1.2 数理吉凶
- 天格数理吉凶解读（包括五行属性）
- 人格数理吉凶解读（包括五行属性）——此格为姓名核心，重点分析
- 地格数理吉凶解读（包括五行属性）
- 外格数理吉凶解读（包括五行属性）
- 总格数理吉凶解读（包括五行属性）
- 五格之间的生克关系

### 1.3 三才配置（天格、人格、地格的五行关系）
- 三才五行相生/相克分析
- 三才配置对健康、事业、财运的影响

## 二、🦊 生肖喜忌分析（400-600字）
- 该生肖的五行属性（本命五行）
- 该生肖的喜用字根（什么偏旁/部首的字最旺此生肖）
- 该生肖的忌用字根（什么偏旁/部首的字对此生肖不利）
- 当前姓名中哪些字符合生肖喜用、哪些冲犯生肖忌讳
- 生肖与五格数理的配合度评估

## 三、🔥 五行补益分析（300-400字）
- 姓名中各字的五行属性（逐一分析每个字的五行）
- 姓名整体的五行平衡度
- 姓名对八字五行的补益作用（如果知道八字更好，基于生肖推断可能的五行需求）
- 需要加强的五行和需要避免的五行

## 四、🎯 姓名综合评分（100-200字）
- 五格评分（百分制）
- 生肖适配评分（百分制）
- 五行补益评分（百分制）
- 综合评分（百分制）及评级（优秀/良好/一般/需改善）

## 五、📈 姓名对各方面运势的影响（500-600字）
- 事业运：人格和外格对事业的影响，适合的职业方向提示
- 财运：总格数理对财运的暗示，偏财正财分析
- 感情运：地格对感情婚姻的影响
- 健康运：三才配置对健康的影响，需要注意的身体部位
- 人际运：外格对社交和贵人的影响

## 六、💡 改名建议（600-800字）
- 该姓名是否需要改名的判断（综合评分低于70分建议改名）
- 推荐改名方向（需要补什么五行、用什么偏旁的字）
- 3-5个推荐新名字（每个名字附详细解释）：
  - 推荐名一：XXX —— 五行组合、数理解读、生肖适配说明
  - 推荐名二：XXX —— 同上
  - 推荐名三：XXX —— 同上
- 每个推荐名给出五格数理评分（百分制）
- 改名的最佳时机建议（什么年龄段改名效果最好）

## 七、📝 姓名能量提升小技巧（200-300字）
- 不改名的情况下，如何通过日常使用提升姓名能量（如用特定笔名/昵称/微信名等）
- 建议使用的幸运颜色和吉祥物
- 姓名相关的风水小贴士（名片设计、签名风格等建议）

## 八、💌 姓名学师的叮嘱（100-200字）
- 温暖、鼓励的结尾
- 姓名只是一个符号，真正的运势掌握在自己手中——但这个符号可以成为你的助力`

    );

    const result = await deepseekChat(messages, { maxTokens: 16384 });
    insertReading.run('xingming', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('xingming', req.body, result);

    res.json({ reading: result, contextId: ctxId });
  } catch (err) {
    console.error('[XINGMING ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// POST /api/astrology — 西方占星
app.post('/api/astrology', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, birthMinute, latitude, longitude, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请提供出生日期' });
    }

    // 1. Calculate astrology chart
    const chart = astrology.calcAstrology(
      parseInt(birthYear), parseInt(birthMonth), parseInt(birthDay),
      birthHour !== undefined ? parseInt(birthHour) : undefined,
      birthMinute !== undefined ? parseInt(birthMinute) : undefined,
      latitude !== undefined ? parseFloat(latitude) : 40.0,
      longitude !== undefined ? parseFloat(longitude) : 116.0
    );

    // 2. Build chart summary for AI prompt
    const chartSummary = `【星盘基本数据】
出生时间：${birthYear}/${birthMonth}/${birthDay} ${birthHour !== undefined ? birthHour + ':' + (birthMinute || '00') : '时间不详'}
性别：${gender === 'male' ? '男 Male' : gender === 'female' ? '女 Female' : '未知'}
经纬度：${latitude || '40°N'}, ${longitude || '116°E'}

【三大重要星座】
太阳 Sun：${chart.sun.signZh}(${chart.sun.signEn}) ${chart.sun.degree}°
月亮 Moon：${chart.moon.signZh}(${chart.moon.signEn}) ${chart.moon.degree}°
上升 Ascendant：${chart.rising.signZh}(${chart.rising.signEn}) ${chart.rising.degree}°

【行星落座】
水星 Mercury：${chart.planets.mercury.signZh}(${chart.planets.mercury.signEn}) ${chart.planets.mercury.degree}°
金星 Venus：${chart.planets.venus.signZh}(${chart.planets.venus.signEn}) ${chart.planets.venus.degree}°
火星 Mars：${chart.planets.mars.signZh}(${chart.planets.mars.signEn}) ${chart.planets.mars.degree}°
木星 Jupiter：${chart.planets.jupiter.signZh}(${chart.planets.jupiter.signEn}) ${chart.planets.jupiter.degree}°
土星 Saturn：${chart.planets.saturn.signZh}(${chart.planets.saturn.signEn}) ${chart.planets.saturn.degree}°

【元素分布】
${chart.elements.map(function(e) { return e.name + ': ' + e.percentage + '% (' + e.count + '个)'; }).join('\n')}

【模式分布】
${chart.modalities.map(function(m) { return m.name + ': ' + m.percentage + '% (' + m.count + '个)'; }).join('\n')}

【月亮相位】${chart.moonPhase.phase} (照明度 ${chart.moonPhase.illumination})

【宫位系统】（基于上升点的等宫制）
${chart.houses.map(function(h) { return '第' + h.number + '宫: ' + h.signZh + '(' + h.signEn + ')'; }).join('\n')}

【星盘概要】${chart.summary.bigThree} · 主导元素: ${chart.summary.dominantElement} · 主导模式: ${chart.summary.dominantModality}`;

    // 3. Send to DeepSeek for detailed reading
    const messages = [
      { role: 'system', content: '你是一位精通西方占星学的资深占星师，从业20年，为上千人解读过本命星盘。你融合古典占星与现代心理占星，分析深刻且温暖。你的语言：70%中文 + 30%英文关键术语（星座名、行星名用英文给出，其余用中文解释），让用户既能看懂又能学到占星知识。每次解读详细、具体、有深度。' },
      { role: 'user', content: `请根据以下星盘数据，为用户出具一份详细的西方占星解读报告。

${chartSummary}

请按以下结构展开详细的星盘解读（总字数4000-6000字）。

## 一、星盘格局总览（300-400字）
概述此星盘的核心能量格局。上升星座如何塑造外在形象，太阳星座如何驱动内在自我，月亮星座如何折射情感需求。一句话总结此星盘的最大特质。

## 二、三大支柱详解（500-700字）

### 2.1 太阳星座 — ${chart.sun.signEn}
太阳在${chart.sun.signEn}的特质：核心性格、生命目标、创造力表现。此配置的正面面和需要成长的阴影面。

### 2.2 月亮星座 — ${chart.moon.signEn}
月亮在${chart.moon.signEn}的特质：情感需求、情绪模式、安全感来源。内在小孩的样貌和照顾自己的方式。

### 2.3 上升星座 — ${chart.rising.signEn}
上升${chart.rising.signEn}的外在形象：给人的第一印象、外在气质、人生面具。上升星座如何影响人生方向。

## 三、行星落座详析（800-1000字）
逐一行星分析其落座的深层含义。每个行星100-200字。

### 3.1 水星 ${chart.planets.mercury.signEn} — 沟通与思维
### 3.2 金星 ${chart.planets.venus.signEn} — 爱情与审美
### 3.3 火星 ${chart.planets.mars.signEn} — 行动与欲望
### 3.4 木星 ${chart.planets.jupiter.signEn} — 幸运与扩张
### 3.5 土星 ${chart.planets.saturn.signEn} — 责任与功课

## 四、元素与模式分析（300-400字）
分析四元素（火土风水）的分布比例以及主导元素${chart.summary.dominantElement}对你性格的影响。
分析开创/固定/变动三种模式的分布，主导模式${chart.summary.dominantModality}如何塑造你面对世界的方式。

## 五、宫位简析（400-500字）
简述每个宫位的落座及其对人生领域的影响。重点看上升星座起始的第1宫，以及四角宫（1/4/7/10）。

## 六、月亮相位（200-300字）
当前月亮${chart.moonPhase.phase}，照明度${chart.moonPhase.illumination}，对情绪和直觉的影响。

## 七、主要人生领域分析（600-800字）

### 7.1 事业与使命
基于太阳、中天（第10宫${chart.houses[9].signEn}）、土星${chart.planets.saturn.signEn}的提示，适合的职业方向和发展建议。

### 7.2 感情与人际
基于金星${chart.planets.venus.signEn}、月亮${chart.moon.signEn}、第7宫${chart.houses[6].signEn}的提示，爱情模式和理想伴侣特征。

### 7.3 财运与资源
基于第2宫${chart.houses[1].signEn}、木星${chart.planets.jupiter.signEn}的提示，财富格局和理财建议。

## 八、成长方向与年度提醒（300-400字）
综合全盘，给出3条切实可行的成长建议。以及未来一年重要的星象提醒。

## 九、占星师的寄语（100-200字）
温暖、有洞见的收尾，让用户感到被理解且有力量前行。`
      }
    ];

    const result = await deepseekChat(messages, { maxTokens: 16384 });
    insertReading.run('astrology', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('astrology', req.body, result);

    res.json({
      chart: {
        sun: { signZh: chart.sun.signZh, signEn: chart.sun.signEn, degree: chart.sun.degree },
        moon: { signZh: chart.moon.signZh, signEn: chart.moon.signEn, degree: chart.moon.degree },
        rising: { signZh: chart.rising.signZh, signEn: chart.rising.signEn, degree: chart.rising.degree },
        planets: chart.planets,
        elements: chart.elements,
        modalities: chart.modalities,
        moonPhase: chart.moonPhase,
        houses: chart.houses,
        summary: chart.summary,
        bigThree: chart.summary.bigThree
      },
      reading: result,
      contextId: ctxId
    });
  } catch (err) {
    console.error('[ASTROLOGY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});



// ════════════════════════════════════════════
// CHAT HISTORY & SUMMARY
// ════════════════════════════════════════════

const READING_TYPE_NAMES = {
  bazi: '八字命理', tarot: '塔罗占卜', ziwei: '紫微斗数',
  mianxiang: '面相手相', hehun: '合婚配对', daily: '每日运势',
  xingming: '姓名学', astrology: '西方占星', liuyao: '六爻占卜',
  lingqian: '求神灵签', daliuren: '大六壬', qimen: '奇门遁甲',
  fengshui: '风水评测', geo_fortune: '地理命理'
};

// GET /api/chat-history
app.get('/api/chat-history', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    const readings = getReadingsByUser.all(req.user.id);
    const mapped = readings.map(r => ({
      id: r.id,
      type: r.type,
      typeName: READING_TYPE_NAMES[r.type] || r.type,
      input: r.input,
      result: r.result,
      summary: r.input ? JSON.parse(r.input) : null,
      createdAt: r.created_at
    }));
    res.json({ readings: mapped });
  } catch (err) {
    console.error('[HISTORY ERR]', err.message);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// POST /api/chat-summary
app.post('/api/chat-summary', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    const readings = _M.readings
      .filter(r => r.user_id === req.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);

    if (!readings || readings.length === 0) {
      return res.json({ summary: '您还没有命理咨询记录。快去体验算命占卜吧！' });
    }

    const historyText = readings.map((r, i) => {
      const typeName = READING_TYPE_NAMES[r.type] || r.type;
      let inputPreview = '';
      try {
        const parsed = JSON.parse(r.input);
        inputPreview = Object.keys(parsed).map(k => k + ': ' + parsed[k]).join(', ').slice(0, 200);
      } catch(e) {
        inputPreview = r.input.slice(0, 200);
      }
      return '[' + '咨询' + (i+1) + '] ' + r.created_at + ' | 类型: ' + typeName + '\n内容: ' + inputPreview;
    }).join('\n\n');

    const messages = [
      { role: 'system', content: '你是善缘平台的高级命理分析师。请根据用户近期的命理咨询记录，生成一份综合的命理趋势总结。\n\n要求：\n1. 提炼用户关注的核心问题领域（如事业、感情、财运等）\n2. 分析命理趋势和阶段性特征\n3. 给出持续的改进建议\n4. 语气温暖亲切，有洞察力\n5. 用简体中文，总字数600-1000字\n6. 用Markdown格式，有小标题和分段' },
      { role: 'user', content: '以下是用户近期的命理咨询记录：\n\n' + historyText + '\n\n请为用户生成一份命理趋势总结，分析他们关心的主要问题领域和命理趋势。' }
    ];

    const summary = await deepseekChat(messages, { maxTokens: 2048 });
    res.json({ summary, count: readings.length });
  } catch (err) {
    console.error('[SUMMARY ERR]', err.message);
    res.status(500).json({ error: '总结生成失败，请稍后重试' });
  }
});


// POST /api/pastlife — 前世预测
app.post('/api/pastlife', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, birthPlace } = req.body;
    if (!birthYear) return res.status(400).json({ error: '请提供出生信息' });

    const lan = req.headers['accept-language'] || 'zh';
    const isEn = lan.startsWith('en');
    const zodiacs = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
    const zi = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const currZodiac = zi[(birthYear - 4) % 12];

    const sysPrompt = isEn
      ? 'You are a mystical past-life regression guide. Generate a vivid, detailed past-life story based on the person birth data. Write in English. Be specific: time period, location, occupation, personality, appearance, key life events, and how it connects to their current life. 2000-3000 words.'
      : '你是一位通晓三世因果的灵性导师。根据用户的出生信息，回溯其前世的身份、经历和因果。语言生动、细节丰富，像在讲一个真实的故事。给出具体的前世身份（年代+地点+职业）、外貌特征、关键人生事件、以及今生与此的关联。2000-3000字。';

    const userPrompt = isEn
      ? 'Birth: ' + birthYear + '/' + (birthMonth || '?') + '/' + (birthDay || '?')
        + (birthHour !== undefined ? ' at ' + birthHour + ':00' : '')
        + ' Gender: ' + (gender || 'unknown')
        + ' Birthplace: ' + (birthPlace || 'unknown')
        + ' Chinese zodiac: ' + zodiacs[(birthYear - 4) % 12]
        + '\n\nTell me my past life in vivid detail.'
      : '出生：' + (birthYear || '?') + '年' + (birthMonth || '?') + '月' + (birthDay || '?') + '日'
        + (birthHour !== undefined ? ' ' + birthHour + '时' : '')
        + '\n性别：' + (gender === 'male' ? '男' : '女')
        + '\n出生地：' + (birthPlace || '未知')
        + '\n生肖：' + currZodiac
        + '\n\n请详细描述我的前世：我是什么人？生活在什么年代和地方？做过什么？和今生的关联是什么？';

    const messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt }
    ];
    const reading = await deepseekChat(messages, { maxTokens: 8192 });
    var ctxId = saveQaContext('pastlife', req.body, reading);
    res.json({ reading, contextId: ctxId });
  } catch (err) {
    console.error('[PASTLIFE ERR]', err.message);
    res.status(500).json({ error: isEn ? 'AI temporarily unavailable' : 'AI暂时不可用，请稍后重试' });
  }
});


// POST /api/chat — AI命理对话
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: '请提供消息内容' });
    }

    const systemMsg = {
      role: 'system',
      content: '你是一位精通八字命理、紫微斗数、占星、塔罗的命理师。'
        + '你像一位温暖的朋友，用大白话回答命理问题。'
        + '不用文言文，不用"老朽""施主"。直接、温暖、具体。'
        + '给出具体的年份、数字、颜色、方向建议。'
        + '每次回答200-500字，不要太长。'
        + '如果你不知道答案，就诚实说"这个我拿不准"。'
    };

    const allMessages = [systemMsg].concat(messages.slice(-10));
    const answer = await deepseekChat(allMessages, { maxTokens: 1024 });
    res.json({ answer });
  } catch (err) {
    console.error('[CHAT ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});


// POST /api/zhiyuan — 高考志愿
app.post('/api/zhiyuan', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, score, province, subjectType, ranking } = req.body;
    const lan = req.headers['accept-language'] || 'zh';
    if (!birthYear || !score || !province) {
      return res.status(400).json({ error: '请提供出生信息和高考分数' });
    }

    const sysPrompt = `你是一位精通八字命理的高考志愿规划师。根据用户的出生信息和高考分数，提供专业、城市、学校选择建议。用大白话写，不要古文。

必须包含以下章节（每个至少200字）：
1. 📜 八字命格适合行业
2. 🔥 适合的专业方向（具体专业名+理由）
3. 🌆 旺你的城市（五行匹配+就业机会）
4. 🏫 可报考的学校建议（冲/稳/保三层）
5. 💰 毕业薪资展望
6. 🎯 总结建议
总字数4000-6000字。`;

    const cityElement = { 北京:'水',上海:'金',广州:'火',深圳:'火',杭州:'木',成都:'土',武汉:'木',南京:'金',西安:'金',重庆:'土',长沙:'火',天津:'水',苏州:'金',青岛:'水',大连:'水',厦门:'木' };

    const userPrompt = `出生：${birthYear}年${birthMonth||'?'}月${birthDay||'?'}日${birthHour!==undefined?birthHour+'时':''}
性别：${gender === "male" ? "男" : "女"}
高考分数：${score}分（${province}省）
科目：${subjectType || "理科"}
全省排名：${ranking || "未知"}

请给出高考志愿填报建议。`;

    const messages = [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }];
    const reading = await deepseekChat(messages, { maxTokens: 8192 });
    var ctxId = saveQaContext('zhiyuan', req.body, reading);
    res.json({ reading, contextId: ctxId });
  } catch (err) {
    console.error('[ZHIYUAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ── Global error handler ──
app.use(function(err, req, res, next) {
  console.error('[FATAL]', err.message);
  res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
});

// ── Start (local only — Vercel uses api/index.js) ──
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════╗`);
    console.log(`║   善缘 ShenYuan v2.0              ║`);
    console.log(`║   Port: ${PORT}                      ║`);
    console.log(`║   LLM: ${DEEPSEEK_API_KEY ? 'DeepSeek ✓' : 'No LLM ✗'}          ║`);
    console.log(`║   Stripe: ${stripe ? '✓' : '✗ (no key)'}             ║`);
    console.log(`╚═══════════════════════════════════╝\n`);
  });
}
module.exports = app;
