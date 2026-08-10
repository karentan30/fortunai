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
  CHANNELS, REWARD_TIERS,
} = require('../lib/store');
const { buildShareUrl } = require('../lib/utils');
const { simpleRateLimitMiddleware, authMiddleware } = require('../middleware');

// GET /api/referral/mine — 我的邀请码/分享链接/统计
// P1修复: 返回5渠道邀请码 + 当前奖励等级
router.get('/mine', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });

  // 查询完整user对象获得ref_codes
  const fullUser = require('../lib/store')._M.users.find(x => x.id === req.user.id);
  const ref_codes = fullUser?.ref_codes || { organic: fullUser?.ref_code };

  const invited = invitedCount(req.user.id);
  const tier = REWARD_TIERS.find(t => invited >= t.min && (t.max < 0 || invited <= t.max));

  // 为每个渠道生成分享链接
  const channel_urls = {};
  Object.entries(ref_codes).forEach(([channel, code]) => {
    channel_urls[channel] = buildShareUrl(code, req, channel);
  });

  res.json({
    ref_codes: ref_codes,           // { tiktok: 'ABC_TK', xiaohongshu: 'DEF_XH', ... }
    channel_urls: channel_urls,     // 每渠道分享链接
    share_url: buildShareUrl(ref_codes.organic, req),  // 兼容旧接口
    ref_code: ref_codes.organic,    // 兼容旧接口
    invited_count: invited,
    current_tier: tier?.level || 'pending',
    next_tier_at: tier?.max < 0 ? null : tier?.max + 1,  // 下一等级需要邀请数
    share_text: `我在善缘算了命,挺准的,你也来测测 → ${buildShareUrl(ref_codes.organic, req)}`
  });
});

// POST /api/referral/claim — 老用户补填邀请码
// P1修复: 支持?ref_channel查询参数记录来源
router.post('/claim', simpleRateLimitMiddleware, authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const ref = req.body && req.body.ref;
  const channel = req.query.ref_channel || req.body?.channel || 'organic';
  if (!ref) return res.status(400).json({ error: '请提供邀请码' });
  if (wasInvited(req.user.id)) return res.status(400).json({ error: '你已使用过邀请码' });
  const inviter = getUserByRefCode.get(ref);
  if (!inviter) return res.status(400).json({ error: '邀请码无效' });
  if (inviter.id === req.user.id) return res.status(400).json({ error: '不能使用自己的邀请码' });
  createReferral(inviter.id, req.user.id, channel);
  grantReferralReward(inviter.id);

  // 返回邀请者的新等级
  const invited = invitedCount(inviter.id);
  const tier = REWARD_TIERS.find(t => invited >= t.min && (t.max < 0 || invited <= t.max));

  res.json({
    ok: true,
    inviter_id: inviter.id,
    inviter_tier: tier?.level || 'pending',
    invited_count: invited
  });
});

// GET /api/referral/leaderboard — 排行榜 Top 10 (无需登录)
router.get('/leaderboard', (req, res) => {
  try {
    const referrerStats = {};
    // 统计每个邀请者的邀请数
    (require('../lib/store')._M.referrals || []).forEach(ref => {
      if (!referrerStats[ref.inviter_id]) {
        referrerStats[ref.inviter_id] = { invited_count: 0, converted_count: 0, channels: {} };
      }
      referrerStats[ref.inviter_id].invited_count++;
      referrerStats[ref.inviter_id].channels[ref.channel] = (referrerStats[ref.inviter_id].channels[ref.channel] || 0) + 1;
    });

    // 统计转化（有order的邀请者）
    const orderUserIds = new Set((require('../lib/store')._M.orders || []).map(o => o.user_id).filter(Boolean));
    Object.keys(referrerStats).forEach(uid => {
      if (orderUserIds.has(uid)) {
        referrerStats[uid].converted_count++;
      }
    });

    // 获取用户信息并计算等级
    const { REWARD_TIERS, getUserById } = require('../lib/store');
    const leaderboard = Object.entries(referrerStats).map(([uid, stats]) => {
      const user = getUserById.get(uid) || {};
      const tier = REWARD_TIERS.find(t => stats.invited_count >= t.min && (t.max < 0 || stats.invited_count <= t.max));
      return {
        user_id: uid,
        name: user.name || user.email?.split('@')[0] || '匿名用户',
        email: user.email,
        invited_count: stats.invited_count,
        converted_count: stats.converted_count,
        tier: tier?.level || 'basic',
        reward_amount: tier?.amount || 0,
        channels: stats.channels
      };
    })
    .sort((a, b) => b.invited_count - a.invited_count)
    .slice(0, 10);

    res.json(leaderboard);
  } catch (e) {
    console.error('[referral.leaderboard] 错误:', e.message);
    res.status(500).json({ error: '排行榜查询失败' });
  }
});

// GET /api/referral/share-card?token=xxx  — SVG share card
// P1修复: 支持?channel参数指定渠道，默认organic
router.get('/share-card', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  const u = getUserById.get(req.user.id);
  if (!u) return res.status(401).json({ error: '请先登录' });

  const fullUser = require('../lib/store')._M.users.find(x => x.id === req.user.id);
  const ref_codes = fullUser?.ref_codes || { organic: fullUser?.ref_code };
  const channel = req.query.channel || 'organic';
  const code = ref_codes[channel] || ref_codes.organic || '';

  const shareUrl = buildShareUrl(code, req, channel);
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
