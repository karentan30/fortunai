const express = require('express');
const router = express.Router();

// In-memory store: inviteId -> { inviterName, inviterBirthday, nameA, p1Year, p1Month, p1Day, p1Hour, p1Gender, mode, expiresAt }
const inviteStore = new Map();

const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

function makeId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Cleanup expired entries periodically
setInterval(function() {
  var now = Date.now();
  for (var [id, rec] of inviteStore) {
    if (rec.expiresAt < now) inviteStore.delete(id);
  }
}, 30 * 60 * 1000);

// POST /api/invite/save
router.post('/save', function(req, res) {
  var body = req.body || {};
  var record = {
    inviterName: (body.inviterName || '').slice(0, 20),
    nameA: (body.nameA || '').slice(0, 20),
    p1Year: body.p1Year || '',
    p1Month: body.p1Month || '',
    p1Day: body.p1Day || '',
    p1Hour: body.p1Hour !== undefined ? body.p1Hour : '',
    p1Gender: body.p1Gender || '',
    mode: body.mode || 'marriage',
    ref: (body.ref || '').slice(0, 20),
    expiresAt: Date.now() + EXPIRE_MS
  };

  var inviteId;
  var attempts = 0;
  do {
    inviteId = makeId();
    attempts++;
  } while (inviteStore.has(inviteId) && attempts < 10);

  inviteStore.set(inviteId, record);
  res.json({ inviteId });
});

// GET /api/invite/:inviteId
router.get('/:inviteId', function(req, res) {
  var record = inviteStore.get((req.params.inviteId || '').toUpperCase());
  if (!record || record.expiresAt < Date.now()) {
    return res.status(404).json({ error: 'not found or expired' });
  }
  res.json({
    inviterName: record.inviterName || record.nameA || '',
    nameA: record.nameA || record.inviterName || '',
    p1Year: record.p1Year,
    p1Month: record.p1Month,
    p1Day: record.p1Day,
    p1Hour: record.p1Hour,
    p1Gender: record.p1Gender,
    mode: record.mode
  });
});

module.exports = router;
