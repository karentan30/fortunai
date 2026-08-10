'use strict';
/**
 * routes/profile.js — 用户档案管理
 * POST /api/user/profile (更新昵称/性别/生日)
 * POST /api/auth/verify-password (验证当前密码)
 * POST /api/user/change-password (修改密码)
 */

const router = require('express').Router();
const { getUserById, updateUserProfile } = require('../lib/store');
const { hashPassword, verifyPassword, generateToken } = require('../lib/utils');
const { authMiddleware } = require('../middleware');

// POST /api/user/profile — 更新用户档案
router.post('/profile', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { name, birthday, gender } = req.body;
  const userId = req.user.id;

  // Validate inputs
  if (name && name.length > 50) {
    return res.status(400).json({ error: '昵称不能超过50个字符' });
  }

  if (birthday) {
    const d = new Date(birthday);
    if (!(d instanceof Date && !isNaN(d)) || d.getFullYear() < 1900) {
      return res.status(400).json({ error: '生日日期无效' });
    }
  }

  if (gender && !['M', 'F', 'N'].includes(gender)) {
    return res.status(400).json({ error: '性别选项无效' });
  }

  try {
    // Update in store
    const store = require('../lib/store');
    const stmt = store._M.db.prepare(`
      UPDATE users SET name = ?, birthday = ?, gender = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(name || null, birthday || null, gender || null, new Date().toISOString(), userId);

    const user = getUserById.get(userId);
    console.log(`[PROFILE] Updated user ${userId}: name=${name}, gender=${gender}`);

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        birthday: user.birthday,
        gender: user.gender,
        ref_code: user.ref_code
      }
    });
  } catch (err) {
    console.error('[PROFILE ERR]', err);
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});

// POST /api/auth/verify-password — 验证当前密码
router.post('/verify-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请提供密码' });

  const user = getUserById.get(req.user.id);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  const isValid = verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: '当前密码错误' });
  }

  res.json({ ok: true });
});

// POST /api/user/change-password — 修改密码
router.post('/change-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { new_password } = req.body;

  // Validate
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }
  if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: '密码需包含字母和数字' });
  }

  try {
    const hash = hashPassword(new_password);
    const store = require('../lib/store');
    const stmt = store._M.db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(hash, new Date().toISOString(), req.user.id);

    // Invalidate all existing tokens (logout all devices)
    const stmtToken = store._M.db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `);
    stmtToken.run(req.user.id);

    console.log(`[AUTH] Password changed for user ${req.user.id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CHANGE_PASSWORD ERR]', err);
    res.status(500).json({ error: '修改失败，请稍后重试' });
  }
});

module.exports = router;
