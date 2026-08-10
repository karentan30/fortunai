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

// GET /api/referral/share-card?token=xxx  — SVG share card
router.get('/share-card', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });
  const shareUrl = buildShareUrl(u.ref_code, req);
  const code = u.ref_code || '';
  const invCount = invitedCount(req.user.id);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1005;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0e0a04;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8a6420;stop-opacity:1"/>
      <stop offset="50%" style="stop-color:#c9a84c;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#e8d08a;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#c9a84c;stop-opacity:0"/>
      <stop offset="50%" style="stop-color:#c9a84c;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#c9a84c;stop-opacity:0"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="600" height="800" fill="url(#bg)"/>
  <!-- Outer border -->
  <rect x="16" y="16" width="568" height="768" rx="16" fill="none" stroke="#c9a84c" stroke-width="1" stroke-opacity="0.3"/>
  <rect x="24" y="24" width="552" height="752" rx="12" fill="none" stroke="#c9a84c" stroke-width="0.5" stroke-opacity="0.15"/>
  <!-- Top decorative line -->
  <rect x="0" y="0" width="600" height="4" fill="url(#gold)"/>
  <!-- Brand name -->
  <text x="300" y="90" text-anchor="middle" font-family="serif" font-size="13" fill="#c9a84c" letter-spacing="8" opacity="0.6">善 缘 · S H E N Y U A N</text>
  <rect x="100" y="104" width="400" height="1" fill="url(#goldLine)"/>
  <!-- Main headline -->
  <text x="300" y="170" text-anchor="middle" font-family="serif" font-size="28" fill="#f0ead8" letter-spacing="4">我在善缘算了命</text>
  <text x="300" y="215" text-anchor="middle" font-family="serif" font-size="22" fill="rgba(240,234,216,0.7)" letter-spacing="3">邀你一起来测</text>
  <!-- Seal circle -->
  <circle cx="300" cy="360" r="110" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-opacity="0.4"/>
  <circle cx="300" cy="360" r="100" fill="rgba(201,168,76,0.05)" stroke="#c9a84c" stroke-width="0.5" stroke-opacity="0.2"/>
  <!-- Ref code -->
  <text x="300" y="345" text-anchor="middle" font-family="serif" font-size="11" fill="#c9a84c" letter-spacing="4" opacity="0.6">邀 请 码</text>
  <text x="300" y="388" text-anchor="middle" font-family="monospace" font-size="36" fill="#e8d08a" letter-spacing="6" font-weight="bold">${code}</text>
  <!-- Invited count -->
  <text x="300" y="430" text-anchor="middle" font-family="serif" font-size="12" fill="rgba(201,168,76,0.5)" letter-spacing="2">已邀请 ${invCount} 位好友</text>
  <!-- Divider -->
  <rect x="150" y="510" width="300" height="1" fill="url(#goldLine)"/>
  <!-- Benefit text -->
  <text x="300" y="548" text-anchor="middle" font-family="serif" font-size="16" fill="rgba(240,234,216,0.85)" letter-spacing="2">✦ 邀1位好友</text>
  <text x="300" y="578" text-anchor="middle" font-family="serif" font-size="16" fill="#c9a84c" letter-spacing="2">解锁免费合婚报告</text>
  <!-- Share URL -->
  <text x="300" y="660" text-anchor="middle" font-family="monospace" font-size="10" fill="rgba(201,168,76,0.4)" letter-spacing="1">${shareUrl.replace(/&/g, '&amp;')}</text>
  <!-- QR hint -->
  <text x="300" y="700" text-anchor="middle" font-family="serif" font-size="11" fill="rgba(240,234,216,0.3)" letter-spacing="3">扫码 · 测八字 · 知命运</text>
  <!-- Bottom decorative -->
  <rect x="150" y="740" width="300" height="1" fill="url(#goldLine)"/>
  <text x="300" y="760" text-anchor="middle" font-family="serif" font-size="9" fill="rgba(201,168,76,0.25)" letter-spacing="4">shenyuan.mylumee.cn</text>
</svg>`;

  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(svg);
});

module.exports = router;
