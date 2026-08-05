'use strict';
/**
 * routes/affiliate.js — Affiliate 推广追踪系统
 * GET  /api/affiliate/track?ref=CODE          公开，记录点击，302重定向首页
 * POST /api/admin/affiliate/create            管理员，新建 affiliate
 * GET  /api/admin/affiliate/list              管理员，列出所有 affiliate + 统计
 * GET  /api/admin/affiliate/stats/:code       管理员，单个明细
 * POST /api/admin/affiliate/payout/:code      管理员，标记已结算
 *
 * 前端传 ref_code：
 *   1. 落地 URL ?ref=CODE → localStorage.setItem('sy_ref', CODE)
 *   2. 发起支付时 body 里带 { ref_code: localStorage.getItem('sy_ref') }
 *      或请求头 X-Affiliate-Ref
 */

const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATA_DIR    = path.join(__dirname, '../data');
const AFF_FILE    = path.join(DATA_DIR, 'affiliates.json');
const ORD_FILE    = path.join(DATA_DIR, 'affiliate-orders.json');

// ── Data helpers ──
function _load(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return []; }
}

function _save(file, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) { console.error('[affiliate] save error:', e.message); }
}

function _adminCheck(req, res) {
  const tok = req.headers['x-admin-token'] || req.query.token || (req.body && req.body.token);
  if (!ADMIN_TOKEN || tok !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

// ── GET /api/affiliate/track?ref=CODE ──
// 记录点击，重定向首页
router.get('/affiliate/track', (req, res) => {
  var code = (req.query.ref || '').trim().toUpperCase();
  if (!code) return res.redirect('/');

  var affiliates = _load(AFF_FILE);
  var aff = affiliates.find(function(a) { return a.code === code; });
  if (!aff) {
    // 自动注册未知 code（允许推广方先用链接后补注册）
    aff = { code: code, name: code, commission_rate: 0.15, clicks: 0, created_at: new Date().toISOString(), active: true };
    affiliates.push(aff);
  }
  aff.clicks = (aff.clicks || 0) + 1;
  aff.last_click = new Date().toISOString();
  _save(AFF_FILE, affiliates);

  console.log('[affiliate] click code=' + code + ' total=' + aff.clicks);
  res.redirect('/');
});

// ── POST /api/admin/affiliate/create ──
router.post('/admin/affiliate/create', (req, res) => {
  if (!_adminCheck(req, res)) return;
  var { name, code, commission_rate } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: '缺少 name 或 code' });

  code = String(code).trim().toUpperCase();
  var rate = parseFloat(commission_rate) || 0.15;
  if (rate < 0 || rate > 1) return res.status(400).json({ error: 'commission_rate 应为 0-1' });

  var affiliates = _load(AFF_FILE);
  if (affiliates.find(function(a) { return a.code === code; })) {
    return res.status(409).json({ error: '该 code 已存在' });
  }
  var aff = { code, name, commission_rate: rate, clicks: 0, created_at: new Date().toISOString(), active: true };
  affiliates.push(aff);
  _save(AFF_FILE, affiliates);
  res.json({ ok: true, affiliate: aff });
});

// ── GET /api/admin/affiliate/list ──
router.get('/admin/affiliate/list', (req, res) => {
  if (!_adminCheck(req, res)) return;
  var affiliates = _load(AFF_FILE);
  var orders = _load(ORD_FILE);

  var result = affiliates.map(function(aff) {
    var myOrders = orders.filter(function(o) { return o.ref_code === aff.code; });
    var paid = myOrders.filter(function(o) { return o.status === 'completed'; });
    var totalRevenue = paid.reduce(function(s, o) { return s + (o.amount_usd || 0); }, 0);
    var commission = paid.reduce(function(s, o) { return s + (o.commission || 0); }, 0);
    var unpaid = paid.filter(function(o) { return !o.paid_out; }).reduce(function(s, o) { return s + (o.commission || 0); }, 0);
    return Object.assign({}, aff, {
      orders_total: myOrders.length,
      orders_paid: paid.length,
      revenue_usd: parseFloat(totalRevenue.toFixed(2)),
      commission_total: parseFloat(commission.toFixed(2)),
      commission_pending: parseFloat(unpaid.toFixed(2)),
    });
  });

  res.json({ ok: true, affiliates: result, total: result.length });
});

// ── GET /api/admin/affiliate/stats/:code ──
router.get('/admin/affiliate/stats/:code', (req, res) => {
  if (!_adminCheck(req, res)) return;
  var code = (req.params.code || '').toUpperCase();
  var affiliates = _load(AFF_FILE);
  var orders = _load(ORD_FILE);

  var aff = affiliates.find(function(a) { return a.code === code; });
  if (!aff) return res.status(404).json({ error: 'affiliate not found' });

  var myOrders = orders.filter(function(o) { return o.ref_code === code; });
  res.json({ ok: true, affiliate: aff, orders: myOrders });
});

// ── POST /api/admin/affiliate/payout/:code ──
router.post('/admin/affiliate/payout/:code', (req, res) => {
  if (!_adminCheck(req, res)) return;
  var code = (req.params.code || '').toUpperCase();
  var orders = _load(ORD_FILE);

  var count = 0;
  orders.forEach(function(o) {
    if (o.ref_code === code && o.status === 'completed' && !o.paid_out) {
      o.paid_out = true;
      o.paid_out_at = new Date().toISOString();
      count++;
    }
  });
  _save(ORD_FILE, orders);
  res.json({ ok: true, marked: count });
});

// ── 导出 recordAffiliateOrder（供 payment.js 调用）──
function recordAffiliateOrder(orderNo, refCode, productKey, amountUsd) {
  if (!refCode) return;
  refCode = String(refCode).trim().toUpperCase();
  if (!refCode) return;

  var affiliates = _load(AFF_FILE);
  var aff = affiliates.find(function(a) { return a.code === refCode; });
  var rate = aff ? (aff.commission_rate || 0.15) : 0.15;

  // 自动注册未知 affiliate
  if (!aff) {
    aff = { code: refCode, name: refCode, commission_rate: rate, clicks: 0, created_at: new Date().toISOString(), active: true };
    affiliates.push(aff);
    _save(AFF_FILE, affiliates);
  }

  var orders = _load(ORD_FILE);
  // 防重
  if (orders.find(function(o) { return o.order_no === orderNo; })) return;

  var commission = parseFloat((amountUsd * rate).toFixed(2));
  orders.push({
    order_no: orderNo,
    ref_code: refCode,
    product: productKey,
    amount_usd: amountUsd,
    commission: commission,
    commission_rate: rate,
    status: 'pending',
    paid_out: false,
    created_at: new Date().toISOString(),
  });
  _save(ORD_FILE, orders);
  console.log('[affiliate] order ' + orderNo + ' ref=' + refCode + ' commission=$' + commission);
}

function completeAffiliateOrder(orderNo) {
  var orders = _load(ORD_FILE);
  var o = orders.find(function(x) { return x.order_no === orderNo; });
  if (o) { o.status = 'completed'; o.completed_at = new Date().toISOString(); _save(ORD_FILE, orders); }
}

module.exports = { router, recordAffiliateOrder, completeAffiliateOrder };
