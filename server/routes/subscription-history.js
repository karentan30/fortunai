'use strict';
/**
 * routes/subscription-history.js — 订阅历史管理
 * GET /api/subscription/history
 */

const router = require('express').Router();
const { getUserOrders } = require('../lib/store');
const { authMiddleware } = require('../middleware');

// GET /api/subscription/history — 获取订阅历史
router.get('/history', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  try {
    const orders = getUserOrders.all(req.user.id) || [];

    // Filter for subscription/membership products
    const subOrders = orders.filter(o => {
      const category = o.product || '';
      return category.indexOf('member') >= 0 ||
             category.indexOf('subscription') >= 0 ||
             category.indexOf('vip') >= 0;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const history = subOrders.map(o => ({
      id: o.id,
      tier: o.product_name || 'Standard',
      start_date: o.created_at ? o.created_at.substring(0, 10) : null,
      end_date: o.expires_at ? o.expires_at.substring(0, 10) : null,
      amount: o.amount || 0,
      status: o.status || 'completed'
    }));

    res.json({ history });
  } catch (err) {
    console.error('[SUBSCRIPTION_HISTORY ERR]', err);
    res.status(500).json({ error: '获取历史失败，请稍后重试' });
  }
});

module.exports = router;
