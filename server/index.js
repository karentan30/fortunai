require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const path = require('path');
const fs   = require('fs');

// ⚡ Sentry 必须在 express/其他第三方之前 init（v10 补丁限制）
const mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../shared/monitoring.js'))({ project: 'shenyuan', require: require });

const express = require('express');
const cors    = require('cors');

// ── Routes & Middleware ──
const { rateLimitMiddleware, optionalAuthMiddleware } = require('./middleware');
const authRouter      = require('./routes/auth');
const referralRouter  = require('./routes/referral');
const paymentRouter   = require('./routes/payment');
const divinationRouter = require('./routes/divination');
const dailyRouter     = require('./routes/daily');
const adminRouter     = require('./routes/admin');
const abRouter        = require('./routes/ab');

const PORT = process.env.PORT || 3021;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:' + PORT;

const app = express();

// 🔴 P1-3: 生产在 Caddy 反代后, 设 trust proxy → req.ip 为真实客户端 IP
app.set('trust proxy', 1);

// ── CORS ──
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
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1 || origin.startsWith('http://localhost')) {
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
    if (req.path.startsWith('/api/') || req.path.startsWith('/pay/')) {
      console.log('[REQ]', req.method, req.path, res.statusCode, ms + 'ms');
    }
  });
  next();
});

// ── Body parsers ──
// Stripe webhook 需要 raw body（必须在 express.json 之前）
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
// 微信支付回调是 XML(text)
app.use('/pay/wechat/notify', express.text({ type: '*/*', limit: '1mb' }));
// 支付宝回调是 application/x-www-form-urlencoded
app.use('/pay/alipay/notify', express.urlencoded({ extended: false, limit: '1mb' }));
// 通用 JSON（风水/阴宅路由含多图 base64，需要更大 limit）
app.use('/api/fengshui', express.json({ limit: '50mb' }));
app.use('/api/yinzhai', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '10mb' }));

// ── AI路由速率限制（在路由注册前挂载）──
app.use(rateLimitMiddleware);

// ── Optional auth（AI reading 路由可选登录，登录后关联用户历史）──
app.use(optionalAuthMiddleware);

// ── Static files ──
// 🔴 安全红线(P0-1): 显式拒绝敏感路径 + dotfiles 拒 + 仅暴露前端目录。
app.use(['/server', '/docs', '/.git', '/node_modules'], (req, res) => {
  res.status(403).json({ error: 'forbidden' });
});
// P0-1 补丁: data.json 含所有用户数据，必须在 static 之前显式 403 拦截
app.use('/data.json', (req, res) => res.status(403).json({ error: 'forbidden' }));
app.use(express.static(path.join(__dirname, '..'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: function(res, filePath) {
    if (filePath.indexOf('data.json') >= 0) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (/\.(webp|jpg|jpeg|png|gif|svg|ico|woff2?|ttf|otf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
// 🔴 P0 回归修复: index:false 导致 GET / 404。显式送 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ════════════════════════════════════════════
// Route mounting
// ════════════════════════════════════════════

// 公共接口: 健康检查 / 大师列表 / 灵感语录
app.use('/api', adminRouter);

// 认证
app.use('/api/auth', authRouter);

// 邀请裂变
app.use('/api/referral', referralRouter);

// 合婚邀请链接（服务端落盘，跨设备有效）
app.use('/api/invite', require('./routes/invite'));

// 支付（含 Stripe / 微信 / 支付宝 + 订单查询）
// payment router 内部包含 /api/* 和 /pay/* 两类路径，挂在根路径
app.use('/', paymentRouter);

// 占算引擎（AI reading）
app.use('/api', divinationRouter);

// 每日运势 / AI 对话 / 用户反馈
app.use('/api', dailyRouter);

// A/B 测试追踪
app.use('/api', abRouter);

// 邮件订阅
app.use('/api', require('./routes/subscribe'));

// ── 全局错误处理 ──
app.use(function(err, req, res, next) {
  console.error('[FATAL]', err.message);
  res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
});

// ── Start（本地/HK 服务器）——Vercel 使用 api/index.js ──
if (!process.env.VERCEL) {
  // Sentry error handler（必须放在所有路由之后）
  if (mon.setupExpressErrorHandler) mon.setupExpressErrorHandler(app);

  // Push 通知路由（仅非 Vercel 环境）
  const { pushRouter, vapidRouter } = require('./routes/push');
  app.use('/api/push', pushRouter);      // POST /api/push/subscribe, /api/push/send-daily
  app.use('/api', vapidRouter);          // GET  /api/vapid-public-key

  // 全局兜底
  app.use(function(err, req, res, next) {
    console.error('[unhandled]', err.message || err);
    if (mon && mon.feishuAlert) mon.feishuAlert('未处理异常', (err && err.message) || 'unknown', 'error');
    if (!res.headersSent) res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
  });

  app.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════╗`);
    console.log(`║   善缘 ShenYuan v2.0              ║`);
    console.log(`║   Port: ${PORT}                      ║`);
    console.log(`║   LLM: ${(process.env.DS_KEY || process.env.DEEPSEEK_API_KEY) ? 'DeepSeek ✓' : 'No LLM ✗'}          ║`);
    console.log(`║   Stripe: ${process.env.STRIPE_PAY_SECRET_KEY ? '✓' : '✗ (no key)'}             ║`);
    console.log(`╚═══════════════════════════════════╝\n`);
  });
}

module.exports = app;
