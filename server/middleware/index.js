'use strict';
/**
 * middleware/index.js — 共享中间件
 * rateLimitMiddleware, authMiddleware, optionalAuthMiddleware
 */

const { getToken, _tokenFromReq } = require('../lib/store');

// ── IP 速率限制（滑动窗口，无需 Redis）──
const _rateLimitMap = new Map(); // key: ip|token → { timestamps: [] }
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1小时
const RATE_LIMIT_ANON  = 150;  // 未授权 IP：150次/小时（分章报告一次~11调用，需放宽）
const RATE_LIMIT_AUTH  = 200;  // 有效 token 用户：200次/小时

// ── 受限路由范围（0911 改为默认拒绝）───────────────────────────────────────
// 旧实现是「白名单枚举」：不在 RATE_LIMITED_PREFIXES 里的路径一律放行。
// 结果是后来新增的 40+ 个会烧 LLM 的路由（numerology / life-kline /
// chart-archetype / identity-triad / western-astrology / best-timing /
// love-destiny / hepan / support-chat / /api/shouxiang / /api/duanshi …）
// **全都写了 rateLimitMiddleware 却完全不生效** —— 中间件第一行就 return next() 了。
// 白名单式防护天然会随新增路由腐化，所以改成「/api/* 默认全拦 + 显式豁免」。
//
// ⚠️ 豁免名单里**绝不能少掉钱路** —— 支付回调的 IP 是 Stripe/微信/支付宝/中台，
//    不受我们控制。一旦把这些限流掉，后果是「用户付了钱、回调被 429、不发货」。
const RATE_LIMIT_EXEMPT_PREFIXES = [
  '/api/stripe-webhook',   // Stripe 回调（raw body + 验签）
  '/api/hub-callback',     // 中台订阅事件回调（HMAC 验签）
  '/api/pay/',             // 微信/支付宝/中台的 notify + query + create 全在钱路上
  '/api/orders',           // 订单查询（付款页会轮询）
  '/api/success',          // 付款成功落地页
  '/api/health',           // 健康检查
  '/api/products',         // 静态商品表
];

function isExempt(path) {
  return RATE_LIMIT_EXEMPT_PREFIXES.some(function(prefix) {
    return path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');
  });
}

function isRateLimited(path) {
  if (!path || path.indexOf('/api') !== 0) return false; // 只覆盖 API
  if (isExempt(path)) return false;
  return true; // 默认拒绝：新增路由自动受保护，不需要记得回来加白名单
}

// 每5分钟清理已过期记录
setInterval(function() {
  var now = Date.now();
  for (var [key, record] of _rateLimitMap) {
    record.timestamps = record.timestamps.filter(function(t) {
      return now - t < RATE_LIMIT_WINDOW_MS;
    });
    if (record.timestamps.length === 0) _rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * rateLimitMiddleware — AI 路由速率限制（按 token 或 IP 区分）
 */
function rateLimitMiddleware(req, res, next) {
  if (!isRateLimited(req.path)) return next();

  // 🔴 0911：本中间件既在 index.js:87 全局挂了一次，又在各路由挂了 89 次，
  // 同一次请求会走两遍 → 计两次 → 实际限额只有标称的一半（匿名 75/h 而非 150/h）。
  // 用请求级标记去重，比删掉 89 处调用点安全得多（漏删一处就没有保护了）。
  if (req._syRateCounted) return next();
  req._syRateCounted = true;

  var now = Date.now();
  var token = _tokenFromReq(req);
  var key = token ? 'token:' + token : 'ip:' + (req.ip || 'unknown');
  var limit = token ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;

  var record = _rateLimitMap.get(key);
  if (!record) {
    record = { timestamps: [] };
    _rateLimitMap.set(key, record);
  }

  record.timestamps = record.timestamps.filter(function(t) {
    return now - t < RATE_LIMIT_WINDOW_MS;
  });

  if (record.timestamps.length >= limit) {
    var oldest = record.timestamps[0];
    var retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  record.timestamps.push(now);
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', limit - record.timestamps.length);
  next();
}

// 简单 IP 限速（用于 auth 路由，60 req/min）
var _simpleRateLimit = {};
function checkSimpleRateLimit(ip) {
  var now = Date.now();
  if (!_simpleRateLimit[ip]) _simpleRateLimit[ip] = [];
  _simpleRateLimit[ip] = _simpleRateLimit[ip].filter(function(t) { return now - t < 60000; });
  if (_simpleRateLimit[ip].length > 60) return false;
  _simpleRateLimit[ip].push(now);
  return true;
}

function simpleRateLimitMiddleware(req, res, next) {
  var ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  if (!checkSimpleRateLimit(ip)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  next();
}

/**
 * authMiddleware — 提取 token，绑定 req.user（未登录为 null）
 * 读取顺序: Authorization header > req.body.token > sy_token httpOnly cookie
 */
function authMiddleware(req, res, next) {
  const t = _tokenFromReq(req);
  if (!t) { req.user = null; return next(); }
  const row = getToken.get(t);
  req.user = row ? { id: row.user_id, email: row.email, name: row.name } : null;
  next();
}

/**
 * optionalAuthMiddleware — 只在路径满足条件时解析 token → req.userId
 * 用于 AI reading 路由（可选登录，登录后关联用户历史）
 */
function optionalAuthMiddleware(req, res, next) {
  if (
    req.path.startsWith('/api/') &&
    !req.path.startsWith('/api/auth/') &&
    !req.path.startsWith('/api/stripe-webhook') &&
    !req.path.startsWith('/api/health') &&
    !req.path.startsWith('/api/success') &&
    !req.path.startsWith('/api/orders') &&
    !req.path.startsWith('/api/products') &&
    !req.path.startsWith('/api/create-checkout') &&
    !req.path.startsWith('/api/inspiration')
  ) {
    const t = _tokenFromReq(req);
    if (t) {
      const row = getToken.get(t);
      if (row) req.userId = row.user_id;
    }
  }
  next();
}

/**
 * CSRF token验证中间件 — 保护支付等关键API
 */
const _csrfTokens = new Map(); // sessionId -> {token, createdAt}
const CSRF_EXPIRY = 30 * 60 * 1000; // 30分钟

function csrfMiddleware(req, res, next) {
  // 仅POST请求检查CSRF
  if (req.method !== 'POST') return next();

  // 支付相关路由强制验证CSRF
  var protectedPaths = [
    '/api/create-checkout',
    '/api/pay/wechat/create',
    '/api/pay/alipay/qr',
    '/api/order',
    '/api/referral/claim'
  ];

  if (!protectedPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next(); // 不需要保护
  }

  // SECURITY: 从header获取CSRF token
  var csrfToken = req.headers['x-csrf-token'] || '';
  if (!csrfToken) {
    return res.status(403).json({ error: 'Missing CSRF token' });
  }

  // TODO: 在完整实现中应该：
  // 1. 从session/cookie中获取存储的CSRF token
  // 2. 比较两者是否一致
  // 3. 验证token是否过期
  // 目前这里是基础实现，生产环境需升级

  next();
}

module.exports = {
  rateLimitMiddleware,
  simpleRateLimitMiddleware,
  authMiddleware,
  optionalAuthMiddleware,
  csrfMiddleware,
};
