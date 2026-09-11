'use strict';
/**
 * routes/subscription-history.js — 订阅历史管理
 * GET /api/subscription/history
 *
 * 🔴 0912 修正。原版假设订单字段是 { product_name, status }，实际 store 里是
 *   { product, payment_status }，所以「套餐」列永远显示兜底的「标准」；
 *   而且把 amount（**分**）直接当元返回，前端 `'¥' + h.amount` 会把 ¥49 显示成 ¥4900。
 *   再叠加这个文件从没被 index.js 挂载过 —— 订阅历史一直是 404，页面静默走
 *   「无历史」兜底分支，所以从来没人发现金额离谱。
 *
 *   单位还有一层：amountCents 随通道变 —— 微信/支付宝记的是金额(人民币分)，
 *   Stripe 记的是 prod.amount(美元分)。所以按订单的 currency 判断币种，
 *   并把展示串一起算好给前端，避免前端自己猜符号。
 */
const router = require('express').Router();
const { getUserOrders, PRODUCTS } = require('../lib/store');
const { authMiddleware } = require('../middleware');

const SUBSCRIPTION_KEYWORDS = ['member', 'subscription', 'vip', 'daily_sub', 'daily_companion', 'monthly_report'];

router.get('/subscription/history', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  try {
    const orders = getUserOrders.all(req.user.id) || [];

    // 只看订阅/会员类订单；报告、代烧那些一次性购买不属于「订阅历史」
    const subOrders = orders
      .filter(o => SUBSCRIPTION_KEYWORDS.some(k => String(o.product || '').indexOf(k) >= 0))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const history = subOrders.map(o => {
      const cur = (o.currency || 'cny').toLowerCase();
      const symbol = cur === 'usd' ? '$' : cur === 'cny' ? '¥' : cur.toUpperCase() + ' ';
      const yuan = Math.round(Number(o.amount) || 0) / 100;
      // 整元写 ¥299，有零头才带两位小数 —— 不能把 $12.90 压成 $12.9
      const shown = Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
      const prod = PRODUCTS[o.product];
      return {
        id: o.id,
        order_no: o.order_no,
        tier: (prod && prod.name) || o.product || '标准',
        start_date: o.created_at ? String(o.created_at).substring(0, 10) : null,
        // expires_at 只有手动周期包(daily_companion_*/monthly_report*)才有；
        // 会员类的到期日在会员体系里，这里为 null，前端显示空
        end_date: o.expires_at ? String(o.expires_at).substring(0, 10) : null,
        amount: yuan,
        currency: cur.toUpperCase(),
        amount_text: symbol + shown,
        status: o.payment_status || 'completed'
      };
    });

    res.json({ history });
  } catch (err) {
    console.error('[SUBSCRIPTION_HISTORY ERR]', err);
    res.status(500).json({ error: '获取历史失败，请稍后重试' });
  }
});

module.exports = router;
