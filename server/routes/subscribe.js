'use strict';
const router = require('express').Router();
const fs = require('fs');
const path = require('path');

const SUBS_FILE = path.join(__dirname, '../../data/subscribers.json');

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { return []; }
}

function saveSubs(subs) {
  fs.mkdirSync(path.dirname(SUBS_FILE), { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

router.post('/subscribe', (req, res) => {
  const { email, source } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'email required' });
  }
  const subs = loadSubs();
  const exists = subs.some(function(s) { return s.email === email; });
  if (!exists) {
    subs.push({ email: email.trim().toLowerCase(), source: source || 'unknown', ts: Date.now() });
    saveSubs(subs);
  }
  console.log('[subscribe]', email, 'from', source || 'unknown');
  res.json({ ok: true });
});

module.exports = router;
