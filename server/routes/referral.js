'use strict';
/**
 * routes/referral.js — 邀请裂变路由
 * GET  /api/referral/mine
 * POST /api/referral/claim
 * GET  /api/orders/mine
 */

const router = require('express').Router();
const {
  getUserById, getUserOrders,
  invitedCount, wasInvited, getUserByRefCode, createReferral, grantReferralReward,
} = require('../lib/store');
const { buildShareUrl } = require('../lib/utils');
const { simpleRateLimitMiddleware, authMiddleware } = require('../middleware');

// GET /api/referral/mine — 我的邀请码/分享链接/统计
router.get('/mine', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });
  const share_url = buildShareUrl(u.ref_code, req);
  res.json({
    ref_code: u.ref_code,
    share_url,
    invited_count: invitedCount(req.user.id),
    share_text: `我在善缘算了命,挺准的,你也来测测 → ${share_url}`
  });
});

// POST /api/referral/claim — 老用户补填邀请码
router.post('/claim', simpleRateLimitMiddleware, authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const ref = req.body && req.body.ref;
  if (!ref) return res.status(400).json({ error: '请提供邀请码' });
  if (wasInvited(req.user.id)) return res.status(400).json({ error: '你已使用过邀请码' });
  const inviter = getUserByRefCode.get(ref);
  if (!inviter) return res.status(400).json({ error: '邀请码无效' });
  if (inviter.id === req.user.id) return res.status(400).json({ error: '不能使用自己的邀请码' });
  createReferral(inviter.id, req.user.id);
  grantReferralReward(inviter.id);
  res.json({ ok: true, invited_count: invitedCount(req.user.id) });
});

module.exports = router;
