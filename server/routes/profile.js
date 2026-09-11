'use strict';
/**
 * routes/profile.js — 用户档案管理
 * POST /api/user/profile          (更新昵称/性别/生日)
 * POST /api/auth/verify-password  (验证当前密码)
 * POST /api/user/change-password  (修改密码)
 *
 * 🔴 0912 重写。原版写的是 `store._M.db.prepare('UPDATE users SET ...')` 和
 *   `DELETE FROM sessions` —— 那是 SQLite 时代的写法，本项目 store 是 JSON 快照，
 *   没有 .db、也没有 sessions 表，所以三处调用全是 TypeError。
 *   更糟的是：这个文件从来没被 index.js require 过，account.html 的「保存资料」
 *   和「改密码」一直是 404。两者叠加的后果是——用户在账号设置里怎么存都存不上，
 *   改密码永远提示「当前密码错误」（前端把任何非 2xx 都显示成这句话）。
 *   现在：数据访问走 lib/store 的真实 helper，并在 index.js 里挂载。
 */
const router = require('express').Router();
const { getUserPrivateById, updateUserFields, deleteUserTokens, _tokenFromReq } = require('../lib/store');
const { hashPassword, verifyPassword } = require('../lib/utils');
const { authMiddleware } = require('../middleware');

// POST /api/user/profile — 更新用户档案
router.post('/user/profile', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const userId = req.user.id;
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const birthday = body.birthday ? String(body.birthday).trim() : undefined;
  const gender = body.gender ? String(body.gender).trim() : undefined;

  if (name !== undefined && name.length > 50) {
    return res.status(400).json({ error: '昵称不能超过50个字符' });
  }
  if (birthday) {
    // YYYY-MM-DD，且必须是真实存在的日期（'2026-02-31' 要被 Date 归一化前拦下）
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    const valid = d && !isNaN(d)
      && d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
      && +m[1] >= 1900 && d.getTime() <= Date.now();
    if (!valid) return res.status(400).json({ error: '生日日期无效' });
  }
  if (gender && !['M', 'F', 'N'].includes(gender)) {
    return res.status(400).json({ error: '性别选项无效' });
  }

  try {
    // name 空串=用户清空了昵称，按空处理（不写 undefined，否则清不掉旧值）
    const patch = {};
    if (name !== undefined) patch.name = name || '';
    if (birthday !== undefined) patch.birthday = birthday || null;
    if (gender !== undefined) patch.gender = gender || null;

    const ok = updateUserFields.run(userId, patch);
    if (!ok) return res.status(404).json({ error: '用户不存在' });

    const user = getUserPrivateById.get(userId);
    console.log(`[PROFILE] Updated user ${userId}: name=${patch.name} gender=${patch.gender}`);
    res.json({
      ok: true,
      user: {
        id: user.id, email: user.email, name: user.name,
        birthday: user.birthday, gender: user.gender, ref_code: user.ref_code
      }
    });
  } catch (err) {
    console.error('[PROFILE ERR]', err);
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});

// POST /api/auth/verify-password — 验证当前密码
router.post('/auth/verify-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: '请提供密码' });

  const user = getUserPrivateById.get(req.user.id);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  // OAuth 注册的用户没有密码（password_hash 为空）—— 不能走 verifyPassword：
  // 它内部会 split(':')，对空值直接抛。这也正是「明明没设过密码却报当前密码错误」的来源。
  if (!user.password_hash) {
    return res.status(400).json({ error: '该账号由第三方登录创建，未设置密码' });
  }
  if (!verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: '当前密码错误' });
  }
  res.json({ ok: true });
});

// POST /api/user/change-password — 修改密码
router.post('/user/change-password', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '请先登录' });

  const { new_password: newPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: '密码需包含字母和数字' });
  }

  try {
    const ok = updateUserFields.run(req.user.id, { password_hash: hashPassword(String(newPassword)) });
    if (!ok) return res.status(404).json({ error: '用户不存在' });

    // 其他设备下线，当前这条 token 保留 —— 否则用户刚点完「密码已修改」就发现自己退登了
    const removed = deleteUserTokens.run(req.user.id, _tokenFromReq(req));
    console.log(`[AUTH] Password changed for user ${req.user.id} (revoked ${removed} other token(s))`);
    res.json({ ok: true, revoked: removed });
  } catch (err) {
    console.error('[CHANGE_PASSWORD ERR]', err);
    res.status(500).json({ error: '修改失败，请稍后重试' });
  }
});

module.exports = router;
