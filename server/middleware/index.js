'use strict';
/**
 * middleware/index.js — 共享中间件
 * rateLimitMiddleware, authMiddleware, optionalAuthMiddleware
 */

const { getToken } = require('../lib/store');

// ── IP 速率限制（滑动窗口，无需 Redis）──
const _rateLimitMap = new Map(); // key: ip|token → { timestamps: [] }
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1小时
const RATE_LIMIT_ANON  = 30;   // 未授权 IP：30次/小时
const RATE_LIMIT_AUTH  = 200;  // 有效 token 用户：200次/小时

// 受限路由前缀
const RATE_LIMITED_PREFIXES = [
  '/api/bazi', '/api/hehun', '/api/ziwei', '/api/tarot', '/api/liuyao',
  '/api/mianxiang', '/api/fengshui', '/api/xingming', '/api/daoshao',
  '/api/daily', '/api/chat', '/api/saju', '/api/report'
];

function isRateLimited(path) {
  return RATE_LIMITED_PREFIXES.some(function(prefix) {
    return path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');
  });
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

  var now = Date.now();
  var authHeader = req.headers['authorization'] || '';
  var token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
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
 */
function authMiddleware(req, res, next) {
  const token = req.headers['authorization'] || '';
  if (!token) { req.user = null; return next(); }
  const t = token.replace('Bearer ', '');
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
    const token = req.headers['authorization'] || '';
    if (token) {
      const t = token.replace('Bearer ', '');
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
