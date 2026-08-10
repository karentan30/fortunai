/**
 * server/routes/referral-enhancements.js
 * 补充 /api/referral/mine 缺失的字段实现
 *
 * 说明: 这是参考实现，需要集成到 routes/referral.js 的 GET /api/referral/mine 端点
 * 主要补充:
 * - converted_count: 已有成单的邀请数
 * - total_bonus: 累计奖励金额
 * - invitees: 详细邀请记录数组
 * - invitees_by_channel: 按渠道分组的邀请者信息
 */

const { invitedCount, wasInvited, getUserById, CHANNELS, REWARD_TIERS } = require('../lib/store');
const { buildShareUrl } = require('../lib/utils');

/**
 * 增强的 GET /api/referral/mine 实现
 *
 * 使用方式：
 * 1. 在 routes/referral.js 中找到 GET /api/referral/mine 的路由
 * 2. 将下面的逻辑替换或补充到现有的响应对象中
 */

function enhanceReferralMineResponse(req, invitedCount, tier, ref_codes, channel_urls) {
  const store = require('../lib/store');
  const userId = req.user.id;

  // ── 第1步: 获取该用户的所有邀请记录 ──
  const myInvitations = (store._M.referrals || []).filter(ref => ref.inviter_id === userId);

  // ── 第2步: 补充每条邀请记录的详情 + 计算转化状态 ──
  const invitees = myInvitations.map(ref => {
    // 查询被邀请者的订单，判断是否已转化
    const inviteeOrders = (store._M.orders || []).filter(o =>
      o.user_id === ref.invitee_id && o.payment_status === 'completed'
    );
    const converted = inviteeOrders.length > 0;

    return {
      id: ref.invitee_id,
      invitee_email: ref.invitee_email || `user_${ref.invitee_id}`,
      channel: ref.channel || 'organic',
      created_at: ref.created_at || new Date().toISOString(),
      converted: converted,
      converted_at: converted ? (inviteeOrders[0]?.created_at || null) : null,
      bonus: ref.bonus || 0,  // 单条邀请的奖励
      order_count: inviteeOrders.length
    };
  });

  // ── 第3步: 按渠道分组 ──
  const inviteesByChannel = {};
  CHANNELS.forEach(ch => {
    inviteesByChannel[ch] = invitees.filter(inv => inv.channel === ch);
  });

  // ── 第4步: 统计已转化数量 + 总奖励 ──
  const convertedCount = invitees.filter(inv => inv.converted).length;
  const totalBonus = invitees.reduce((sum, inv) => sum + (inv.bonus || 0), 0);

  // ── 第5步: 构建完整响应 ──
  return {
    // 原有字段
    ref_codes: ref_codes,                          // { tiktok: 'ABC_TK', ... }
    channel_urls: channel_urls,                    // 每渠道分享链接
    share_url: channel_urls.organic || '',         // 兼容旧接口
    ref_code: ref_codes.organic || '',             // 兼容旧接口

    // 邀请统计
    invited_count: invitedCount,                   // 已邀请总数
    converted_count: convertedCount,               // ★ NEW: 已转化数
    conversion_rate: invitedCount > 0
      ? Math.round((convertedCount / invitedCount) * 100)
      : 0,                                         // ★ NEW: 转化率百分比

    // 等级与奖励
    current_tier: tier?.level || 'pending',
    next_tier_at: tier?.max < 0 ? null : (tier?.max + 1),
    total_bonus: totalBonus,                       // ★ NEW: 累计奖励

    // 详细邀请记录
    invitees: invitees,                            // ★ NEW: 邀请明细数组
    invitees_by_channel: inviteesByChannel,        // ★ NEW: 按渠道分组

    // 原有字段（兼容）
    share_text: `我在善缘算了命,挺准的,你也来测测 → ${channel_urls.organic || ''}`
  };
}

/**
 * ─────────────────────────────────────────────
 * 集成步骤 (Integration Steps)
 * ─────────────────────────────────────────────
 *
 * 1. 在 server/routes/referral.js 顶部导入:
 *    const enhanceReferralMineResponse = require('./referral-enhancements').enhanceReferralMineResponse;
 *
 * 2. 找到 GET /api/referral/mine 路由处理函数
 *
 * 3. 用以下代码替换原有的 res.json() 部分:
 *
 *    // 旧代码 (需要删除):
 *    // res.json({
 *    //   ref_codes: ref_codes,
 *    //   channel_urls: channel_urls,
 *    //   ...
 *    // });
 *
 *    // 新代码:
 *    const enhancedResponse = enhanceReferralMineResponse(
 *      req,
 *      invitedCount,
 *      tier,
 *      ref_codes,
 *      channel_urls
 *    );
 *    res.json(enhancedResponse);
 */

/**
 * ─────────────────────────────────────────────
 * 数据库字段检查清单
 * ─────────────────────────────────────────────
 *
 * 确保 store._M.referrals 中包含以下字段:
 * [✓] inviter_id      - 邀请者用户ID
 * [✓] invitee_id      - 被邀请者用户ID
 * [✓] channel         - 渠道 (tiktok, xiaohongshu, wechat, youtube, organic)
 * [✓] created_at      - 邀请时间 ISO8601
 * [?] invitee_email   - 被邀请者邮箱 (可选，若无则取 user_${id})
 * [?] bonus           - 单条邀请的奖励金额 (可选，默认 0)
 *
 * 如果 referrals 缺失 invitee_email，可从 store._M.users 查询:
 *    const invitee = store._M.users.find(u => u.id === ref.invitee_id);
 *    const email = invitee?.email || null;
 */

/**
 * ─────────────────────────────────────────────
 * 性能优化建议
 * ─────────────────────────────────────────────
 *
 * 当邀请数 > 1000 时:
 * 1. 使用分页: /api/referral/mine?page=1&limit=50
 * 2. 缓存转化统计 (Redis): 5分钟失效
 * 3. 前端lazy-load表格: 虚拟滚动
 *
 * 示例:
 *    const PAGE_SIZE = 50;
 *    const page = parseInt(req.query.page || 1);
 *    const paginatedInvitees = invitees.slice(
 *      (page - 1) * PAGE_SIZE,
 *      page * PAGE_SIZE
 *    );
 *
 *    return {
 *      ...enhancedResponse,
 *      invitees: paginatedInvitees,
 *      pagination: {
 *        page: page,
 *        limit: PAGE_SIZE,
 *        total: invitees.length
 *      }
 *    };
 */

module.exports = {
  enhanceReferralMineResponse
};
