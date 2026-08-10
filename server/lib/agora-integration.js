'use strict';
/**
 * lib/agora-integration.js — Agora RTC 集成层
 *
 * 实时音视频通话（咨询师 + 用户）
 * - Token 生成（使用官方 agora-access-token 包）
 * - 通话会话管理（创建/更新/结束）
 * - 录音控制（启动/停止）
 * - 清晰的错误处理和日志
 *
 * 复用 Lumee 的 Agora 集成模式，适配 ShenYuan 数据结构
 */

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const crypto = require('crypto');

// ── 配置读取 ──
const AGORA_APP_ID = process.env.AGORA_APP_ID || '';
const AGORA_APP_CERT = process.env.AGORA_APP_CERT || '';
const AGORA_CALL_TOKEN_TTL_SEC = parseInt(process.env.AGORA_CALL_TOKEN_TTL_SEC || '3600'); // 默认 1 小时

/**
 * 检查 Agora 是否已配置
 */
function isAgoraReady() {
  return !!(AGORA_APP_ID && AGORA_APP_CERT);
}

/**
 * 生成 Agora RTC 访问令牌
 * @param {string} channelName - 频道名（e.g., "consult-c123-u456"）
 * @param {number} uid - 用户 ID（0 为匿名）
 * @param {string} role - 角色类型：'publisher' 或 'subscriber'
 * @param {number} expirationTimeInSeconds - 过期时间（秒）
 * @returns {string} Agora 访问令牌
 * @throws {Error} 如果 Agora 未配置或参数无效
 */
function generateAgoraToken(
  channelName,
  uid,
  role = 'publisher',
  expirationTimeInSeconds = AGORA_CALL_TOKEN_TTL_SEC
) {
  if (!isAgoraReady()) {
    throw new Error('Agora 未配置: 缺少 AGORA_APP_ID 或 AGORA_APP_CERT');
  }

  if (!channelName || typeof channelName !== 'string') {
    throw new Error('channelName 必须是非空字符串');
  }

  const roleType = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERT,
      channelName,
      uid,
      roleType,
      expirationTimeInSeconds
    );
    return token;
  } catch (err) {
    throw new Error(`Token 生成失败: ${err.message}`);
  }
}

/**
 * 创建唯一的通话频道名
 * 格式: "consult-c{consultantId}-u{userId}-{timestamp}"
 * @param {string|number} consultantId - 咨询师 ID
 * @param {string|number} userId - 用户 ID
 * @returns {string} 频道名
 */
function generateChannelName(consultantId, userId) {
  const ts = Date.now().toString(36); // 36进制时间戳(更短)
  const randomPart = crypto.randomBytes(3).toString('hex');
  return `consult-c${consultantId}-u${userId}-${ts}${randomPart}`;
}

/**
 * 创建通话会话记录
 * @param {object} sessionData - 会话数据对象
 * @returns {object} 会话记录
 */
function createCallSession(sessionData) {
  return {
    id: crypto.randomUUID(),
    channel: sessionData.channel,
    consultantId: sessionData.consultantId,
    consultantName: sessionData.consultantName,
    consultantUid: sessionData.consultantUid,
    userId: sessionData.userId,
    userEmail: sessionData.userEmail,
    userUid: sessionData.userUid,
    status: 'initiated', // initiated -> connected -> ended
    startTime: new Date().toISOString(),
    endTime: null,
    recordingId: null,
    recordingStarted: false,
    durationSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 构建供前端使用的通话初始化数据
 * @param {string} channelName - Agora 频道名
 * @param {number} userUid - 用户在 Agora 中的 UID
 * @param {number} tokenTtl - Token 有效期（秒）
 * @param {string} role - 角色类型
 * @returns {object} 前端可用的通话数据
 */
function buildCallInitData(channelName, userUid, tokenTtl = AGORA_CALL_TOKEN_TTL_SEC, role = 'publisher') {
  if (!isAgoraReady()) {
    return { error: 'Agora 服务未配置' };
  }

  try {
    const token = generateAgoraToken(channelName, userUid, role, tokenTtl);
    return {
      appId: AGORA_APP_ID,
      channel: channelName,
      uid: userUid,
      token: token,
      expiresAt: new Date(Date.now() + tokenTtl * 1000).toISOString()
    };
  } catch (err) {
    console.error('[agora] buildCallInitData error:', err.message);
    return { error: err.message };
  }
}

/**
 * 验证通话会话数据完整性
 * @param {object} session - 会话对象
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateCallSession(session) {
  const errors = [];

  if (!session.channel) errors.push('缺少 channel');
  if (!session.consultantId) errors.push('缺少 consultantId');
  if (!session.userId) errors.push('缺少 userId');
  if (!session.userUid && session.userUid !== 0) errors.push('缺少 userUid');
  if (!session.consultantUid && session.consultantUid !== 0) errors.push('缺少 consultantUid');
  if (!['initiated', 'connected', 'ended', 'failed'].includes(session.status)) {
    errors.push(`无效的 status: ${session.status}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 生成录音存储文件名
 * @param {string} sessionId - 会话 ID
 * @param {string} extension - 文件扩展名（默认 m4a）
 * @returns {string} 文件名
 */
function generateRecordingFilename(sessionId, extension = 'm4a') {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `recordings/${timestamp}/${sessionId}.${extension}`;
}

/**
 * 格式化通话时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间（如 "1h 23m 45s"）
 */
function formatDuration(seconds) {
  if (seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// ── 导出接口 ──
module.exports = {
  isAgoraReady,
  generateAgoraToken,
  generateChannelName,
  createCallSession,
  buildCallInitData,
  validateCallSession,
  generateRecordingFilename,
  formatDuration,

  // 常量
  TOKEN_TTL: AGORA_CALL_TOKEN_TTL_SEC,
  AGORA_APP_ID: AGORA_APP_ID // 前端需要 appId
};
