'use strict';
/**
 * routes/video-call.js — 实时通话路由
 *
 * POST   /api/video-call/start-session   咨询师发起通话
 * POST   /api/video-call/token          用户加入通话，获取 token
 * POST   /api/video-call/end-session    结束通话，计费
 * GET    /api/video-call/session/:id    查询通话状态
 * GET    /api/video-call/recording/:id  获取录音 URL（待实现）
 *
 * 依赖 store.js 的 _M.videoCallSessions 存储会话数据
 */

const router = require('express').Router();
const agora = require('../lib/agora-integration');
const { _M, _persist, _tokenFromReq } = require('../lib/store');

// ── 初始化存储 ──
if (!_M.videoCallSessions) _M.videoCallSessions = [];
if (!_M.videoCallRecordings) _M.videoCallRecordings = [];

/**
 * Helper: 从 store 中查找会话
 */
function findSession(sessionId) {
  return _M.videoCallSessions.find(s => s.id === sessionId);
}

/**
 * Helper: 认出调用者是谁。
 *
 * 原来这里有两个空壳（extractToken 解析了但没人用、getUserIdFromToken 永远返回 null），
 * 于是 /token 只凭 body 里的 sessionId 就签发 Agora 发布者凭证——任何拿到 sessionId
 * 的人都能加入通话频道。/end-session、/session/:id、/recording/:sessionId 同样裸奔。
 *
 * 走 _tokenFromReq（header > body > httpOnly cookie），前端拿不到 cookie 时
 * 发出的空 "Bearer " 不会把它短路成匿名。
 */
function resolveCaller(req) {
  const t = _tokenFromReq(req);
  if (!t) return null;
  const row = (_M.tokens || []).find(x => x.token === t);
  if (!row) return null;
  const user = (_M.users || []).find(u => String(u.id) === String(row.user_id));
  return user || { id: row.user_id };
}

/** 会话只有当事人（用户本人 / 咨询师）能碰 */
function isParty(session, caller) {
  if (!caller) return false;
  const uid = String(caller.id);
  return String(session.userId) === uid || String(session.consultantId) === uid;
}

/** 401 未登录 / 403 非当事人 */
function denyUnlessParty(req, res, session) {
  const caller = resolveCaller(req);
  if (!caller) {
    res.status(401).json({ error: '请先登录后再加入通话' });
    return false;
  }
  if (!isParty(session, caller)) {
    res.status(403).json({ error: '无权访问该通话' });
    return false;
  }
  return true;
}

// ══════════════════════════════════════════
// POST /api/video-call/start-session
// ══════════════════════════════════════════
// 咨询师发起通话（通常来自后台或列表）
// body: {
//   orderId: "order-123",        // 关联的订单/预约 ID
//   userId: 123,                 // 用户 ID
//   userEmail: "user@example.com",
//   consultantId: 456,           // 咨询师 ID
//   consultantName: "Master Liu" // 咨询师名字（显示用）
// }
router.post('/start-session', (req, res) => {
  try {
    // 1. 权限检查：至少必须是已登录用户（发起方=咨询师，身份字段仍取自 body）
    // TODO: 咨询师角色体系还没有，等有了要在这里核对 consultantId 属于调用者本人，
    //       否则任何登录用户都能以任意 consultantId 开一个会话。
    if (!resolveCaller(req)) {
      return res.status(401).json({ error: '请先登录' });
    }

    if (!agora.isAgoraReady()) {
      return res.status(503).json({ error: 'Agora 服务未配置' });
    }

    const { orderId, userId, userEmail, consultantId, consultantName } = req.body;

    if (!orderId || !userId || !consultantId) {
      return res.status(400).json({
        error: '缺少必要字段: orderId, userId, consultantId'
      });
    }

    // 2. 生成唯一频道名
    const channelName = agora.generateChannelName(consultantId, userId);

    // 3. 为双方生成 UID（简单策略：使用 consultantId 和 userId 哈希）
    // 实际应该使用更稳定的 UID（如数据库自增 ID）
    const consultantUid = parseInt(String(consultantId).slice(0, 9)) || 100000 + consultantId;
    const userUid = parseInt(String(userId).slice(0, 9)) || 100000 + userId;

    // 4. 创建咨询师的 token
    const consultantToken = agora.generateAgoraToken(
      channelName,
      consultantUid,
      'publisher',
      agora.TOKEN_TTL
    );

    // 5. 创建会话记录
    const session = agora.createCallSession({
      channel: channelName,
      consultantId,
      consultantName: consultantName || '咨询师',
      consultantUid,
      userId,
      userEmail,
      userUid,
      orderId
    });

    _M.videoCallSessions.push(session);
    _persist();

    console.log(
      `[video-call] 咨询师发起通话: sessionId=${session.id} ` +
      `channel=${channelName} consultant=${consultantName} user=${userEmail}`
    );

    res.json({
      ok: true,
      session: {
        id: session.id,
        channel: channelName,
        appId: agora.AGORA_APP_ID,
        uid: consultantUid,
        token: consultantToken,
        role: 'consultant',
        expiresAt: new Date(Date.now() + agora.TOKEN_TTL * 1000).toISOString()
      }
    });
  } catch (err) {
    console.error('[video-call/start-session]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/video-call/token
// ══════════════════════════════════════════
// 用户加入通话，获取 token
// body: { sessionId: "uuid..." }
// 调用者身份从 Authorization 头 / body.token / sy_token cookie 解析，
// 必须与 session.userId 或 session.consultantId 一致。
router.post('/token', (req, res) => {
  try {
    if (!agora.isAgoraReady()) {
      return res.status(503).json({ error: 'Agora 服务未配置' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    // 2. 查找会话
    const session = findSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 2b. 只有当事人能拿到发布者凭证
    if (!denyUnlessParty(req, res, session)) return;

    if (session.status === 'ended') {
      return res.status(410).json({ error: '通话已结束' });
    }

    // 3. 生成用户 token
    const userToken = agora.generateAgoraToken(
      session.channel,
      session.userUid,
      'publisher',
      agora.TOKEN_TTL
    );

    // 4. 更新会话状态
    session.status = 'connected';
    session.updatedAt = new Date().toISOString();
    _persist();

    console.log(
      `[video-call] 用户加入通话: sessionId=${session.id} ` +
      `user=${session.userEmail}`
    );

    res.json({
      ok: true,
      session: {
        id: session.id,
        channel: session.channel,
        appId: agora.AGORA_APP_ID,
        uid: session.userUid,
        token: userToken,
        role: 'user',
        consultantName: session.consultantName,
        expiresAt: new Date(Date.now() + agora.TOKEN_TTL * 1000).toISOString()
      }
    });
  } catch (err) {
    console.error('[video-call/token]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/video-call/end-session
// ══════════════════════════════════════════
// 结束通话，记录时长和费用
// body: {
//   sessionId: "uuid...",
//   durationSeconds: 3600,  // 实际通话时长
//   recordingUrl?: "..." // 可选的录音 URL
// }
router.post('/end-session', (req, res) => {
  try {
    const { sessionId, durationSeconds, recordingUrl } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    const session = findSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 结束通话会写时长（后续要计费），只允许当事人
    if (!denyUnlessParty(req, res, session)) return;

    // 更新会话
    session.status = 'ended';
    session.endTime = new Date().toISOString();
    session.durationSeconds = durationSeconds || 0;
    session.updatedAt = new Date().toISOString();

    // 如果有录音，记录到单独的表
    if (recordingUrl) {
      const recording = {
        id: session.id,
        sessionId,
        consultantId: session.consultantId,
        userId: session.userId,
        url: recordingUrl,
        durationSeconds: session.durationSeconds,
        createdAt: new Date().toISOString()
      };
      _M.videoCallRecordings.push(recording);
      session.recordingId = recording.id;
    }

    _persist();

    const durationMinutes = (durationSeconds / 60).toFixed(1);
    console.log(
      `[video-call] 通话结束: sessionId=${session.id} ` +
      `duration=${durationMinutes}分钟 consultant=${session.consultantId} user=${session.userId}`
    );

    res.json({
      ok: true,
      session: {
        id: session.id,
        durationSeconds: session.durationSeconds,
        durationFormatted: agora.formatDuration(session.durationSeconds),
        recordingId: session.recordingId,
        endTime: session.endTime
      }
    });
  } catch (err) {
    console.error('[video-call/end-session]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/video-call/session/:id
// ══════════════════════════════════════════
// 查询通话会话状态
router.get('/session/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = findSession(id);

    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 会话里有频道名与双方邮箱，只给当事人看
    if (!denyUnlessParty(req, res, session)) return;

    res.json({
      ok: true,
      session: {
        id: session.id,
        channel: session.channel,
        status: session.status,
        consultantName: session.consultantName,
        userEmail: session.userEmail,
        startTime: session.startTime,
        endTime: session.endTime,
        durationSeconds: session.durationSeconds,
        recordingId: session.recordingId
      }
    });
  } catch (err) {
    console.error('[video-call/session]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/video-call/recordings/:sessionId
// ══════════════════════════════════════════
// 获取会话的录音（如果存在）
router.get('/recording/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const recording = _M.videoCallRecordings.find(r => r.sessionId === sessionId);

    if (!recording) {
      return res.status(404).json({ error: '暂无录音' });
    }

    // 录音是通话内容，只有当事人能拿 URL
    const session = findSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    if (!denyUnlessParty(req, res, session)) return;

    res.json({
      ok: true,
      recording: {
        id: recording.id,
        url: recording.url,
        durationSeconds: recording.durationSeconds,
        createdAt: recording.createdAt
      }
    });
  } catch (err) {
    console.error('[video-call/recording]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/video-call/health
// ══════════════════════════════════════════
// 检查 Agora 服务状态
router.get('/health', (req, res) => {
  const ready = agora.isAgoraReady();
  res.json({
    ok: true,
    agoraReady: ready,
    activeSessions: _M.videoCallSessions.filter(s => s.status !== 'ended').length,
    message: ready ? 'Agora 服务就绪' : 'Agora 服务未配置'
  });
});

module.exports = router;
// 供测试直接验证鉴权判定（Express 路由要 Agora 配好才会走到这些分支）
module.exports._resolveCaller = resolveCaller;
module.exports._isParty = isParty;
module.exports._denyUnlessParty = denyUnlessParty;
