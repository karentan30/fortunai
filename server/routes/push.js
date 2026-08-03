'use strict';
/**
 * routes/push.js — Web Push 订阅管理
 * POST /api/push/subscribe
 * POST /api/push/send-daily
 * GET  /api/vapid-public-key
 *
 * 注意: 这些路由只在非 Vercel 环境（本地/HK服务器）下挂载。
 * 在 index.js 中判断 !process.env.VERCEL 后再 use 此 router。
 */

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:tan42204@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

const PUSH_SUBS_FILE = path.join(__dirname, '../../data/push-subs.json');

function loadPushSubs() {
  try { return JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8')); } catch (e) { return []; }
}

function savePushSubs(subs) {
  fs.mkdirSync(path.dirname(PUSH_SUBS_FILE), { recursive: true });
  fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subs));
}

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  var sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'invalid subscription' });
  var subs = loadPushSubs();
  var exists = subs.find(s => s.endpoint === sub.endpoint);
  if (!exists) { subs.push(sub); savePushSubs(subs); }
  res.json({ ok: true, total: subs.length });
});

// POST /api/push/send-daily
router.post('/send-daily', async (req, res) => {
  var adminToken = req.headers['x-admin-token'] || (req.body && req.body.token);
  if (adminToken !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'forbidden' });
  var subs = loadPushSubs();
  var payload = JSON.stringify({
    title: '선연 · 善缘 🔮',
    body: req.body && req.body.body ? req.body.body : '오늘의 오행 천기가 도착했어요 · 今日五行天机已更新',
    url: '/pages/daily.html'
  });
  var results = await Promise.allSettled(subs.map(function(sub) {
    return webpush.sendNotification(sub, payload).catch(function(e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        var s = loadPushSubs();
        savePushSubs(s.filter(x => x.endpoint !== sub.endpoint));
      }
      throw e;
    });
  }));
  var sent = results.filter(r => r.status === 'fulfilled').length;
  res.json({ sent: sent, total: subs.length });
});

// GET /api/vapid-public-key — 单独的 router，挂在 /api 下
const vapidRouter = require('express').Router();
vapidRouter.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

module.exports = { pushRouter: router, vapidRouter };
