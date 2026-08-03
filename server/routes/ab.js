'use strict';
/**
 * routes/ab.js — A/B 测试追踪端点
 * POST /api/ab-track  — 记录事件（公开）
 * GET  /api/ab-stats  — 汇总统计（需 ADMIN_TOKEN）
 */

const router = require('express').Router();
const { _M, _persist } = require('../lib/store');

// 初始化内存 store 中的 abEvents 数组（如果不存在）
if (!Array.isArray(_M.abEvents)) _M.abEvents = [];

const VALID_EVENTS = ['view', 'scroll_50', 'cta_click', 'checkout_start', 'checkout_complete'];

// POST /api/ab-track
router.post('/ab-track', function(req, res) {
  var body = req.body || {};
  var variant  = String(body.variant  || '').trim();
  var product  = String(body.product  || '').trim();
  var event    = String(body.event    || '').trim();
  var sessionId = String(body.sessionId || '').trim();

  if (!variant || !product || !event) {
    return res.status(400).json({ ok: false, error: 'variant, product, event 必填' });
  }
  if (!VALID_EVENTS.includes(event)) {
    return res.status(400).json({ ok: false, error: 'event 无效，允许: ' + VALID_EVENTS.join(', ') });
  }

  _M.abEvents.push({
    variant:   variant,
    product:   product,
    event:     event,
    sessionId: sessionId || null,
    ip:        (req.ip || '').replace(/^::ffff:/, '').slice(0, 40),
    ts:        new Date().toISOString()
  });
  _persist();

  return res.json({ ok: true });
});

// GET /api/ab-stats  （需要 ADMIN_TOKEN）
router.get('/ab-stats', function(req, res) {
  var adminToken = process.env.ADMIN_TOKEN;
  var provided   = req.headers['x-admin-token'] || req.query.token || '';
  if (!adminToken || provided !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 汇总：按 variant+product 分组
  var stats = {};
  var events = _M.abEvents || [];

  events.forEach(function(e) {
    var key = e.variant + '|' + e.product;
    if (!stats[key]) {
      stats[key] = {
        variant:          e.variant,
        product:          e.product,
        views:            0,
        scroll_50s:       0,
        cta_clicks:       0,
        checkout_starts:  0,
        checkout_completes: 0
      };
    }
    var s = stats[key];
    if (e.event === 'view')               s.views++;
    if (e.event === 'scroll_50')          s.scroll_50s++;
    if (e.event === 'cta_click')          s.cta_clicks++;
    if (e.event === 'checkout_start')     s.checkout_starts++;
    if (e.event === 'checkout_complete')  s.checkout_completes++;
  });

  // 输出格式：key = "variantName" 或 "variant|product"
  var out = {};
  Object.keys(stats).forEach(function(k) {
    var s = stats[k];
    var views = s.views || 0;
    var clicks = s.cta_clicks || 0;
    var starts = s.checkout_starts || 0;
    var completes = s.checkout_completes || 0;
    out[k] = {
      variant:            s.variant,
      product:            s.product,
      views:              views,
      scroll_50s:         s.scroll_50s,
      cta_clicks:         clicks,
      checkout_starts:    starts,
      checkout_completes: completes,
      ctr:                views > 0 ? (clicks / views * 100).toFixed(1) + '%' : '0%',
      conversion_rate:    views > 0 ? (completes / views * 100).toFixed(1) + '%' : '0%'
    };
  });

  return res.json({
    total_events: events.length,
    variants: out
  });
});

module.exports = router;
