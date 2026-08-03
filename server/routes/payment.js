'use strict';
/**
 * routes/payment.js — 支付相关路由
 * POST /api/create-checkout
 * POST /api/stripe-webhook
 * GET  /api/success
 * GET  /api/products
 * GET  /api/orders          (admin)
 * GET  /api/orders/mine     (user)
 * POST /api/order           (代供/冥器)
 * POST /pay/wechat/create
 * GET  /pay/wechat/query
 * POST /pay/wechat/notify
 * POST /pay/alipay/qr
 * GET  /pay/alipay/query
 * POST /pay/alipay/notify
 */

const router = require('express').Router();
const crypto = require('crypto');
const path = require('path');
const pay = require('../pay.js');
const hub = require(process.env.HUB_CLIENT_PATH || require('path').join(__dirname, '../../../shared/pay-hub-client.js'));

const {
  PRODUCTS, SUBSCRIBE_PRODUCTS,
  getToken, getUserOrders,
  insertOrder, _updOrder, _updOrderExpiry, _setOrExtendSub, _insSub,
  _findOrder, _insCnOrder, _completeCnOrder, _allOrders, _insJossOrder,
  _M, _persist,
} = require('../lib/store');
const { sendEmail, getClientIp, resolveUserFromToken } = require('../lib/utils');
const { rateLimitMiddleware, simpleRateLimitMiddleware, authMiddleware } = require('../middleware');

// Stripe（只在 key 存在时加载）
const STRIPE_SECRET_KEY    = process.env.STRIPE_PAY_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL          = process.env.FRONTEND_URL || '';

let stripe = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
    console.log('✓ Stripe initialized');
  }
} catch (e) {
  console.log('ℹ Stripe not available (stripe package not installed)');
}

// ── Helper: resolve userId from token ──
function _payResolveUser(token) {
  if (!token) return null;
  var t = String(token).replace('Bearer ', '');
  var row = getToken.get(t);
  return row ? row.user_id : null;
}

// ── Stripe Price IDs (Capstone account) ──
const STRIPE_PRICE_IDS = {
  'member_monthly':      'price_1TzAjGEAXrE2YgcrRzUY78Ko',
  'member_yearly':       'price_1TzAjQEAXrE2YgcrHYurEL8Z',
  'member_quarterly':    'price_1U0BwvEAXrE2YgcrTU0PFGZm',
  'bazi_full_krw':       'price_1TzrGREAXrE2Ygcr1dOkiv2O',
  'bazi_vip_krw':        'price_1TzrGUEAXrE2YgcrtAXjFt9M',
  'hehun_krw':           'price_1TzAriEAXrE2YgcrWEj4Azdn',
  'member_monthly_krw':  'price_1TzrGWEAXrE2YgcrhrIIeMXC',
};

// ══════════════════════════════════════════
// GET /api/products
// ══════════════════════════════════════════
router.get('/products', (req, res) => {
  res.json({ products: PRODUCTS });
});

// ══════════════════════════════════════════
// GET /api/orders — admin 查看订单
// ══════════════════════════════════════════
router.get('/orders', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.headers['x-admin-token'] !== adminToken) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    res.json({ orders: _allOrders() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/orders/mine — 当前用户订单
// ══════════════════════════════════════════
router.get('/orders/mine', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  try {
    res.json({ orders: getUserOrders.all(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/create-checkout — Stripe Checkout Session
// ══════════════════════════════════════════
router.post('/create-checkout', rateLimitMiddleware, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: '支付系统暂未开通' });

    const { product, donorName, contact, wishText, email, successUrl, cancelUrl, token } = req.body;
    const prod = PRODUCTS[product];
    if (!prod) return res.status(400).json({ error: '无效的产品 ID', valid: Object.keys(PRODUCTS) });

    let userId = null;
    if (token) {
      const t = token.replace('Bearer ', '');
      const row = getToken.get(t);
      if (row) userId = row.user_id;
    }

    const orderNo = 'SY-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');

    var ipCountry = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '').toUpperCase();
    var isCN = ipCountry === 'CN';
    if (isCN) {
      return res.json({
        channel: 'cn', product,
        amountCny: prod.amountCny || prod.amount,
        message: '国内用户请使用微信支付或支付宝',
      });
    }

    const region = (req.body.region || '').toLowerCase();
    const isKR = region === 'kr';
    const payCurrency = isKR ? 'krw' : 'usd';
    const payMethods = isKR
      ? (process.env.KR_PAY_METHODS ? process.env.KR_PAY_METHODS.split(',').map(s => s.trim()) : ['card'])
      : ['card'];

    const isJoss = product.startsWith('joss_');
    let unitAmount;
    if (isKR) {
      unitAmount = prod.amountKrw || Math.round(prod.amount / 100 * 1300);
    } else if (isJoss && req.body.price) {
      const frontendCents = Math.round(parseFloat(req.body.price) * 100);
      unitAmount = Math.min(Math.max(frontendCents, prod.amount), prod.amount + 200000);
    } else {
      unitAmount = prod.amount;
    }

    const isSubscription = ['daily_sub','member_monthly','member_yearly','member_quarterly','member_3year','member_daily'].includes(product);
    const krwKey = isKR ? product + '_krw' : null;
    const priceId = (krwKey && STRIPE_PRICE_IDS[krwKey]) ? STRIPE_PRICE_IDS[krwKey] : STRIPE_PRICE_IDS[product];

    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : { price_data: {
            currency: payCurrency,
            product_data: { name: prod.name, description: prod.desc },
            unit_amount: unitAmount,
            recurring: isSubscription ? (
              product === 'member_yearly'    ? { interval: 'year' } :
              product === 'member_quarterly' ? { interval: 'month', interval_count: 3 } :
              product === 'member_3year'     ? { interval: 'year',  interval_count: 3 } :
                                               { interval: 'month' }
            ) : undefined,
          }, quantity: 1 };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: payMethods,
      line_items: [lineItem],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: successUrl || FRONTEND_URL + '/api/success?session_id={CHECKOUT_SESSION_ID}&product=' + product,
      cancel_url: cancelUrl || FRONTEND_URL + '/pages/' + product.split('_')[0] + '.html',
      customer_email: email || undefined,
      metadata: { order_no: orderNo, product, donor_name: donorName || '', contact: contact || '' }
    });

    insertOrder.run(orderNo, product, unitAmount, payCurrency, userId, donorName || '', contact || '', wishText || '', session.id);
    console.log(`[CHECKOUT] ${orderNo} — ${prod.name} $${(prod.amount/100).toFixed(2)}`);
    res.json({ url: session.url, sessionId: session.id, orderNo });
  } catch (err) {
    console.error('[CHECKOUT ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/stripe-webhook
// ══════════════════════════════════════════
router.post('/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!STRIPE_WEBHOOK_SECRET || !stripe) {
      console.error('[WEBHOOK] 缺 STRIPE_WEBHOOK_SECRET, 拒绝未验签事件');
      return res.status(500).send('Webhook not configured');
    }
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
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
          const subId = session.subscription;
          const mode = session.mode;
          if (subId && stripe) {
            try {
              stripe.subscriptions.retrieve(subId).then(function(sub) {
                const prod = session.metadata?.product || '';
                if (SUBSCRIBE_PRODUCTS.indexOf(prod) >= 0 && sub.current_period_end) {
                  _updOrderExpiry(orderNo, new Date(sub.current_period_end * 1000).toISOString());
                }
              }).catch(function(e) { console.error('[WEBHOOK sub retrieve]', e.message); });
            } catch (e) { console.error('[WEBHOOK sub]', e.message); }
          } else if (mode === 'subscription') {
            console.log('[PAYMENT] subscription checkout without sub id, order ' + orderNo);
          }
          console.log(`[PAYMENT] ${orderNo} — completed`);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        if (orderNo) _updOrder('expired', orderNo);
        break;
      }
      case 'customer.subscription.created':
      case 'invoice.payment_succeeded': {
        const obj = event.data.object;
        const subId = obj.subscription || obj.id || '';
        const email = obj.customer_email || '';
        const periodEnd = obj.current_period_end ? obj.current_period_end * 1000 : null;
        if (subId && stripe && periodEnd) {
          try {
            _insSub(email, subId);
            const pending = _M.orders.filter(function(o) {
              return o.stripe_subscription_id === subId || (o.metadata && o.metadata.sub_id === subId);
            });
            if (!pending.length) {
              stripe.invoices.retrieve(obj.invoice || (obj.id || ''), { expand: ['lines.data.price.product'] }).then(function(inv) {
                const line = inv.lines && inv.lines.data && inv.lines.data[0];
                const prodName = line && line.price && line.price.product && (line.price.product.name || '');
                if (prodName) {
                  let pid = null;
                  Object.keys(PRODUCTS).forEach(function(k) { if (PRODUCTS[k].name === prodName) pid = k; });
                  if (pid) _setOrExtendSub(pid, email, new Date(periodEnd).toISOString());
                }
              }).catch(function(e) { console.error('[WEBHOOK invoice expand]', e.message); });
            }
          } catch (e) { console.error('[WEBHOOK sub created]', e.message); }
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object;
        const subId = obj.subscription || obj.id || '';
        _M.orders.forEach(function(o) {
          if (o.stripe_subscription_id === subId && o.payment_status === 'completed') {
            o.expires_at = new Date().toISOString();
          }
        });
        _persist();
        console.log('[SUB] cancelled/failed subId=' + subId);
        if (event.type === 'invoice.payment_failed') {
          const custEmail = obj.customer_email || '';
          if (custEmail) {
            sendEmail({
              to: custEmail,
              subject: '善缘会员续费失败 — 请更新支付方式',
              html: `<div style="font-family:serif;max-width:480px;margin:0 auto;padding:32px;background:#faf6ee;color:#3a2a0e"><h2 style="color:#9a7529">善缘 · 续费提醒</h2><p>您好，您的善缘会员订阅续费未能成功处理。</p><p>为避免会员权益中断，请点击下方按钮更新支付方式：</p><a href="https://shenyuan.mylumee.cn/pages/member.html" style="display:inline-block;margin:16px 0;padding:12px 28px;background:linear-gradient(135deg,#a8823a,#8a6a26);color:#fff;text-decoration:none;border-radius:9px;font-size:14px">更新支付方式 →</a><p style="font-size:11px;color:#9a7529;opacity:0.6">如您已取消订阅，请忽略此邮件。</p></div>`
            }).catch(function() {});
          }
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK ERR]', err);
    res.status(500).send('Webhook handler error');
  }
});

// ══════════════════════════════════════════
// GET /api/success — 支付成功页
// ══════════════════════════════════════════
router.get('/success', (req, res) => {
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付成功 · 善缘</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0e0a04;font-family:'Noto Serif SC','Georgia',serif;display:flex;justify-content:center;align-items:center;min-height:100vh;color:rgba(255,245,220,0.9);overflow:hidden}
.particles{position:fixed;inset:0;pointer-events:none;z-index:0}
.p{position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(201,168,76,0.6);animation:rise var(--d) var(--delay) infinite}
@keyframes rise{0%{transform:translateY(100vh) scale(0);opacity:0}20%{opacity:1}80%{opacity:0.6}100%{transform:translateY(-20px) scale(1.5);opacity:0}}
.card{position:relative;z-index:1;background:linear-gradient(135deg,#170e06,#1a1005);border:1px solid rgba(201,168,76,0.25);border-radius:16px;padding:48px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(201,168,76,0.08)}
.success-ring{width:80px;height:80px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(201,168,76,0.4),rgba(140,100,32,0.3));border:2px solid rgba(201,168,76,0.4);display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 20px;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.3)}50%{box-shadow:0 0 0 12px rgba(201,168,76,0)}}
.gold-line{width:60px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:16px auto}
h1{font-size:20px;letter-spacing:0.2em;color:#c9a84c;margin-bottom:6px;font-weight:400}
.subtitle{font-size:12px;color:rgba(255,245,220,0.45);letter-spacing:0.12em;margin-bottom:20px}
.benefit-box{background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:14px 16px;margin-bottom:24px;text-align:left}
.benefit-item{font-size:12px;color:rgba(255,245,220,0.7);padding:4px 0;letter-spacing:0.06em;display:flex;align-items:center;gap:8px}
.benefit-item::before{content:'✦';color:#c9a84c;font-size:9px;flex-shrink:0}
.btn-primary{display:block;width:100%;padding:14px 0;background:linear-gradient(135deg,#8a6420,#c9a84c,#e8d08a);border:none;border-radius:4px;color:#0e0a04;font-family:'Noto Serif SC',serif;font-size:14px;letter-spacing:0.18em;cursor:pointer;text-decoration:none;margin-bottom:10px;font-weight:500}
.countdown{font-size:11px;color:rgba(255,245,220,0.3);letter-spacing:0.08em;margin-top:12px}
</style></head><body>
<div class="particles" id="particles"></div>
<div class="card">
  <div class="success-ring" id="successIcon">🙏</div>
  <h1 id="successTitle">功德圆满</h1>
  <div class="gold-line"></div>
  <p class="subtitle" id="successSub">支付成功 · 天机已启</p>
  <div class="benefit-box" id="benefitBox"></div>
  <a class="btn-primary" id="ctaBtn" href="/">前往查看</a>
  <p class="countdown" id="countdown">3秒后自动跳转…</p>
</div>
<script>
const CONFIGS={
  bazi_full:{icon:'🔮',title:'命盘已解锁',sub:'完整八字命理 · 即刻查阅',benefits:['六维完整命盘报告（5000+字）','十年大运逐年解析','流月财运姻缘事业'],btn:'查看完整命盘',url:'/pages/bazi.html?unlocked=1'},
  bazi_vip:{icon:'👑',title:'深度档案已开启',sub:'大师级命理 · 终身珍藏',benefits:['8000+字深度批命报告','终身档案永久保存','专属大运流年分析'],btn:'查看深度命盘',url:'/pages/bazi.html?unlocked=1&vip=1'},
  bazi_basic:{icon:'🔮',title:'命盘已解锁',sub:'基础八字命理 · 即刻查阅',benefits:['日主五行基础分析','今年运势概览','关键命理特征'],btn:'查看命盘',url:'/pages/bazi.html?unlocked=1'},
  bazi_trial:{icon:'🔮',title:'体验命盘已解锁',sub:'快速简批 · 即刻查阅',benefits:['日主五行速批','今年关键运势','体验完整版报告'],btn:'查看命盘',url:'/pages/bazi.html?unlocked=1'},
  hehun:{icon:'💕',title:'合婚报告已生成',sub:'双命交汇 · 情缘揭晓',benefits:['双方八字合婚深度分析','情感运势 + 婚期吉日','五行互补与化解方案'],btn:'查看合婚报告',url:'/pages/hehun.html?unlocked=1'},
  tarot:{icon:'🃏',title:'塔罗已揭示',sub:'牌面已开 · 天意已显',benefits:['AI深度塔罗解读','当下处境与建议','行动指引'],btn:'查看塔罗',url:'/pages/tarot.html?unlocked=1'},
  member_monthly:{icon:'✨',title:'月度会员已激活',sub:'月度畅享 · 全功能开放',benefits:['全部AI占算无限次','八字/合婚/塔罗/紫微全通','每日天机会员专属版'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  member_yearly:{icon:'🌟',title:'年度会员已激活',sub:'全年畅享 · 至尊体验',benefits:['全部AI占算无限次 · 365天','比月费省41%','合婚配对报告 + 水晶挂件权益'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  member_quarterly:{icon:'✨',title:'季度会员已激活',sub:'三月畅享 · 全功能开放',benefits:['全部AI占算无限次 · 3个月','八字/合婚/塔罗全通','每日天机专属版'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  member_3year:{icon:'🌟',title:'三年会员已激活',sub:'超值三年 · 长久陪伴',benefits:['全部AI占算无限次 · 3年','极致性价比','全产品永久畅享'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  member_lifetime:{icon:'♾️',title:'终身会员已激活',sub:'永久畅享 · 与缘同在',benefits:['全部AI占算永久无限次','全部报告专属档案','终身功能更新'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  member_daily:{icon:'☀️',title:'日会员已激活',sub:'今日畅享 · 24小时全开',benefits:['今日全部AI占算无限次','全产品24小时畅用','体验完整会员权益'],btn:'开始使用',url:'/pages/bazi.html?member=1'},
  daily_sub:{icon:'☀️',title:'每日天机已订阅',sub:'日日开运 · 天机指引',benefits:['每日五行运势推送','专属Affirmation冥想词','明日预告提前知'],btn:'查看今日天机',url:'/pages/daily.html?activated=1'},
  joss_basic:{icon:'🕯️',title:'代烧订单已确认',sub:'法师接单 · 虔诚履约',benefits:['标准纸钱 + 金元宝 + 祈福','48小时内安排法事','仪式视频发送至邮箱'],btn:'查看订单详情',url:'/pages/daishao-en.html?order=1'},
  joss_premium:{icon:'🏮',title:'尊享代烧已确认',sub:'豪华法事 · 诚心供奉',benefits:['豪华纸质别墅 + 法器全套','专属法师 1对1 仪式','高清视频 48小时内发送'],btn:'查看订单详情',url:'/pages/daishao-en.html?order=1'},
  joss_supreme:{icon:'⛩️',title:'至尊法事已受理',sub:'大法事 · 隆重承办',benefits:['全套冥器 + 多位法师联诵','直播仪式 实时观看','专属报告 + 法事证书'],btn:'查看订单详情',url:'/pages/daishao-en.html?order=1'},
};
const DEFAULT={icon:'🙏',title:'功德圆满',sub:'支付成功 · 天机已启',benefits:['支付成功确认','善缘已收到您的心意','如有疑问请联系客服'],btn:'返回首页',url:'/'};
const params=new URLSearchParams(location.search);
const cfg=CONFIGS[params.get('product')||'']||DEFAULT;
document.getElementById('successIcon').textContent=cfg.icon;
document.getElementById('successTitle').textContent=cfg.title;
document.getElementById('successSub').textContent=cfg.sub;
document.getElementById('ctaBtn').textContent=cfg.btn;
document.getElementById('ctaBtn').href=cfg.url;
document.getElementById('benefitBox').innerHTML=cfg.benefits.map(b=>'<div class="benefit-item">'+b+'</div>').join('');
const pc=document.getElementById('particles');
for(let i=0;i<15;i++){const p=document.createElement('div');p.className='p';p.style.cssText='left:'+Math.random()*100+'%;--d:'+(3+Math.random()*4)+'s;--delay:-'+(Math.random()*4)+'s';pc.appendChild(p);}
if(window.opener){window.opener.postMessage('payment_complete','*');}
let t=3;const cd=document.getElementById('countdown');
const timer=setInterval(()=>{t--;cd.textContent=t+'秒后自动跳转…';if(t<=0){clearInterval(timer);location.href=cfg.url;}},1000);
</script>
</body></html>`;
  res.send(html);
});

// ══════════════════════════════════════════
// POST /api/order — 代供/冥器订单
// ══════════════════════════════════════════
router.post('/order', rateLimitMiddleware, (req, res) => {
  try {
    const { donorName, contact, wishText, recipientName, temple, timing, total, specialReq } = req.body;
    if (!donorName || !contact) return res.status(400).json({ error: '请填写施主姓名和联系方式' });
    const orderNo = 'SY-JOSS-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const fullWish = '【往生者】' + (recipientName || '未指定') +
                     ' 【道场】' + (temple || '未指定') +
                     ' 【时间】' + (timing || '未指定') +
                     '\n祝愿词：' + (wishText || '') +
                     (specialReq ? '\n特别要求：' + specialReq : '');
    const amount = total ? parseInt(total) : 0;
    if (!Number.isFinite(amount) || amount < 100 || amount > 10000000) {
      return res.status(400).json({ error: '订单金额异常' });
    }
    _insJossOrder(orderNo, 'joss_burning', amount, 'usd', donorName, contact, fullWish, 'pending');
    console.log('[JOSS ORDER]', orderNo, '-', donorName, '- $' + (amount/100).toFixed(2));
    res.json({ success: true, orderNo: orderNo });
  } catch (err) {
    console.error('[JOSS ORDER ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// 中国支付：微信 NATIVE + 支付宝当面付
// ══════════════════════════════════════════

// POST /pay/wechat/create
router.post('/pay/wechat/create', rateLimitMiddleware, async (req, res) => {
  try {
    var product = (req.body && req.body.product || '').trim();
    var prod = PRODUCTS[product];
    if (!prod) return res.status(400).json({ error: '无效的产品 ID', valid: Object.keys(PRODUCTS) });
    if (!hub.HUB_SECRET) return res.status(400).json({ error: '支付服务暂不可用' });

    var uid = _payResolveUser(req.body && (req.body.token || req.headers['authorization']));
    var method = (req.body && (req.body.method || req.body.channel) || 'wechat').toLowerCase();
    if (!['wechat', 'alipay', 'stripe'].includes(method)) method = 'wechat';
    var oid = pay.genOutTradeNo(method === 'alipay' ? 'ali' : method === 'stripe' ? 'st' : 'wx');
    var cnyAmt = prod.amountCny || prod.amount;
    _insCnOrder(oid, product, cnyAmt, uid, method);

    var r;
    try {
      r = await hub.create(method, '善缘 · ' + prod.name, cnyAmt / 100, oid);
    } catch (e) {
      console.error('[pay/wechat/create] hub 下单异常', e.message);
      return res.status(502).json({ error: '发起支付失败，请稍后再试' });
    }
    console.log('[pay/wechat/create] ' + oid + ' — ' + prod.name + ' ¥' + (cnyAmt/100).toFixed(2));
    var resp = { ok: true, out_trade_no: oid, amount: cnyAmt };
    if (r.method === 'stripe') { resp.url = r.url; resp.session_id = r.session_id; }
    else { resp.code_url = r.code_url; resp.method = r.method; }
    return res.json(resp);
  } catch (err) {
    console.error('[pay/wechat/create ERR]', err);
    return res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
  }
});

// GET /pay/wechat/query
router.get('/pay/wechat/query', async (req, res) => {
  try {
    var oid = (req.query.out_trade_no || '').trim();
    if (!oid) return res.status(400).json({ error: '缺少订单号' });
    var o = _findOrder(oid);
    if (!o) return res.json({ status: 'unknown' });
    if (o.payment_status === 'completed') return res.json({ status: 'paid', product: o.product });
    if (hub.HUB_SECRET) {
      try {
        var s = await hub.status(oid);
        if (s.status === 'paid') {
          var ccr = _completeCnOrder(oid, null, oid);
          if (ccr === 'paid') console.log('[pay/wechat/query] PAID via hub ' + oid);
          return res.json({ status: 'paid', product: o.product });
        }
      } catch (e) { console.error('[pay/wechat/query] hub 查单异常', e.message); }
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[pay/wechat/query ERR]', err);
    return res.status(500).json({ error: '服务暂时不可用' });
  }
});

// POST /pay/wechat/notify
router.post('/pay/wechat/notify', (req, res) => {
  res.set('Content-Type', 'application/xml');
  if (!pay.wechatReady()) return res.send(pay.wxReplyXml(false, 'not configured'));
  var raw = typeof req.body === 'string' ? req.body : '';
  var v = pay.wxVerifyNotify(raw);
  if (!v.ok) { console.error('[wx/notify] 验签失败'); return res.send(pay.wxReplyXml(false, 'sign fail')); }
  var d = v.data;
  if (d.return_code !== 'SUCCESS' || d.result_code !== 'SUCCESS') {
    return res.send(pay.wxReplyXml(true, 'OK'));
  }
  var oid = d.out_trade_no || '';
  var feeCents = d.total_fee != null ? Number(d.total_fee) : null;
  var r = _completeCnOrder(oid, feeCents, d.transaction_id || '');
  if (r === 'notfound') { console.error('[wx/notify] 未知订单 ' + oid); return res.send(pay.wxReplyXml(false, 'order not found')); }
  if (r === 'amount_mismatch') { console.error('[wx/notify] 金额不符 ' + oid + ' paid=' + feeCents); return res.send(pay.wxReplyXml(false, 'amount mismatch')); }
  if (r === 'paid') console.log('[wx/notify] PAID ' + oid);
  return res.send(pay.wxReplyXml(true, 'OK'));
});

// POST /pay/alipay/qr
router.post('/pay/alipay/qr', rateLimitMiddleware, async (req, res) => {
  try {
    var product = (req.body && req.body.product || '').trim();
    var prod = PRODUCTS[product];
    if (!prod) return res.status(400).json({ error: '无效的产品 ID', valid: Object.keys(PRODUCTS) });
    if (!hub.HUB_SECRET) return res.status(400).json({ error: '支付服务暂不可用' });

    var uid = _payResolveUser(req.body && (req.body.token || req.headers['authorization']));
    var oid = pay.genOutTradeNo('ali');
    var cnyAmtAli = prod.amountCny || prod.amount;
    _insCnOrder(oid, product, cnyAmtAli, uid, 'alipay');

    var r;
    try {
      r = await hub.create('alipay', '善缘 · ' + prod.name, cnyAmtAli / 100, oid);
    } catch (e) {
      console.error('[pay/alipay/qr] hub 下单异常', e.message);
      return res.status(502).json({ error: '发起支付失败，请稍后再试' });
    }
    console.log('[pay/alipay/qr] ' + oid + ' — ' + prod.name + ' ¥' + (cnyAmtAli/100).toFixed(2));
    return res.json({ ok: true, out_trade_no: oid, qr_code: r.qr_code, amount: cnyAmtAli });
  } catch (err) {
    console.error('[pay/alipay/qr ERR]', err);
    return res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
  }
});

// GET /pay/alipay/query
router.get('/pay/alipay/query', async (req, res) => {
  try {
    var oid = (req.query.out_trade_no || '').trim();
    if (!oid) return res.status(400).json({ error: '缺少订单号' });
    var o = _findOrder(oid);
    if (!o) return res.json({ status: 'unknown' });
    if (o.payment_status === 'completed') return res.json({ status: 'paid', product: o.product });
    if (hub.HUB_SECRET) {
      try {
        var s = await hub.status(oid);
        if (s.status === 'paid') {
          var ccr = _completeCnOrder(oid, null, oid);
          if (ccr === 'paid') console.log('[pay/alipay/query] PAID via hub ' + oid);
          return res.json({ status: 'paid', product: o.product });
        }
      } catch (e) { console.error('[pay/alipay/query] hub 查单异常', e.message); }
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[pay/alipay/query ERR]', err);
    return res.status(500).json({ error: '服务暂时不可用' });
  }
});

// POST /pay/alipay/notify
router.post('/pay/alipay/notify', (req, res) => {
  if (!pay.alipayReady()) return res.send('fail');
  var d = req.body || {};
  if (!pay.alipayVerifyNotify(d)) { console.error('[alipay/notify] 验签失败'); return res.send('fail'); }
  var status = d.trade_status || '';
  if (status !== 'TRADE_SUCCESS' && status !== 'TRADE_FINISHED') return res.send('success');
  var oid = d.out_trade_no || '';
  var paidCents = d.total_amount ? Math.round(parseFloat(d.total_amount) * 100) : null;
  var r = _completeCnOrder(oid, paidCents, d.trade_no || '');
  if (r === 'notfound') { console.error('[alipay/notify] 未知订单 ' + oid); return res.send('fail'); }
  if (r === 'amount_mismatch') { console.error('[alipay/notify] 金额不符 ' + oid + ' paid=' + paidCents); return res.send('fail'); }
  if (r === 'paid') console.log('[alipay/notify] PAID ' + oid);
  return res.send('success');
});

module.exports = router;
