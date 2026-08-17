'use strict';
/**
 * lib/store.js — 共享数据层
 * 内存运算 + JSON 快照落盘，扛 PM2 重启，防丢单红线。
 * 只有一个实例，所有 routes 通过 require 拿到同一个对象。
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Data Store ──
const _M = {
  users: [], tokens: [], orders: [], readings: [], subs: [],
  referrals: [], rewards: [], chatUsage: {}, feedbacks: [], streaks: {},
  abEvents: [],
  _id: { u: 1, t: 1, o: 1, r: 1, s: 1, rf: 1 }
};

const _DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data.json');

// 启动加载快照
(function _loadStore() {
  try {
    if (!fs.existsSync(_DATA_FILE)) return;
    const d = JSON.parse(fs.readFileSync(_DATA_FILE, 'utf8'));
    // 🔴 0817: 加 reportCredits(月会员报告credit,防重启白刷) + dailyUsage(每日运势免费次数) + rewards + streaks 落盘恢复
    for (const k of ['users','tokens','orders','readings','subs','referrals','feedbacks','chatUsage','abEvents','reportCredits','dailyUsage','rewards','streaks']) {
      if (Array.isArray(d[k])) _M[k] = d[k];
      else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) _M[k] = d[k];
    }
    if (d._id && typeof d._id === 'object') Object.assign(_M._id, d._id);
    console.log(`[store] 已加载快照: users=${_M.users.length} orders=${_M.orders.length} referrals=${_M.referrals.length}`);
  } catch (e) { console.error('[store] 快照加载失败, 从空开始:', e.message); }
})();

// 去抖落盘（原子写: tmp→rename），500ms 合并高频写
let _persistTimer = null, _persistPending = false;

function _writeStoreNow() {
  _persistPending = false;
  try {
    const tmp = _DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_M));
    fs.renameSync(tmp, _DATA_FILE);
  } catch (e) { console.error('[store] 落盘失败:', e.message); }
}

function _persist() {
  _persistPending = true;
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => { _persistTimer = null; _writeStoreNow(); }, 500);
}

function _flushStore() {
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
  if (_persistPending) _writeStoreNow();
}

process.on('SIGTERM', () => { _flushStore(); process.exit(0); });
process.on('SIGINT',  () => { _flushStore(); process.exit(0); });

// ── 渠道定义 ──
const CHANNELS = ['tiktok', 'xiaohongshu', 'wechat', 'youtube', 'organic'];

// ── 生成唯一 6 位大写 base36 邀请码 ──
function genRefCode() {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var attempt = 0; attempt < 50; attempt++) {
    var buf = crypto.randomBytes(6), code = '';
    for (var i = 0; i < 6; i++) { code += chars[buf[i] % 36]; }
    // 检查所有渠道中的邀请码是否已存在
    if (!_M.users.some(u => u.ref_codes && Object.values(u.ref_codes).some(rc => rc.split('_')[0] === code))) return code;
  }
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// ── 为用户生成 5 渠道邀请码 ──
function genRefCodesForUser() {
  const codes = {};
  CHANNELS.forEach(ch => {
    const base = genRefCode();
    const suffix = ch.substring(0, 2).toUpperCase();
    codes[ch] = base + '_' + suffix; // e.g. ABC123_TK for tiktok
  });
  return codes;
}

// ── 数据访问对象 ──
const insertUser = {
  run(e, h) {
    const id = _M._id.u++;
    // P1修复: 改为生成5渠道邀请码，保留ref_code字段兼容旧接口(取organic渠道)
    const ref_codes = genRefCodesForUser();
    _M.users.push({ id, email: e, password_hash: h, name: '', ref_codes: ref_codes, ref_code: ref_codes.organic, created_at: new Date().toISOString() });
    _persist();
    return { lastInsertRowid: id };
  }
};
const getUserByEmail  = { get(e) { return _M.users.find(u => u.email === e); } };
const getUserById     = {
  get(id) {
    const u = _M.users.find(x => x.id === id);
    return u ? { id: u.id, email: u.email, name: u.name, ref_code: u.ref_code, created_at: u.created_at } : undefined;
  }
};
const getUserByRefCode = {
  get(c) {
    if (!c) return undefined;
    var code = String(c).trim().toUpperCase();
    if (!code) return undefined;
    // P1修复: 支持新的渠道邀请码格式(含_后缀)，也支持旧的ref_code格式
    return _M.users.find(u => {
      if (u.ref_code === code) return true;  // 兼容旧格式
      if (u.ref_codes && Object.values(u.ref_codes).includes(code)) return true;  // 新格式
      return false;
    });
  }
};
const insertToken = {
  run(uid, t) {
    _M.tokens.push({ id: _M._id.t++, user_id: uid, token: t, created_at: new Date().toISOString() });
    _persist();
  }
};
const getToken = {
  get(t) {
    const tok = _M.tokens.find(x => x.token === t);
    if (!tok) return null;
    const u = _M.users.find(x => x.id === tok.user_id);
    return u ? { ...tok, email: u.email, name: u.name } : null;
  }
};
const getUserOrders = {
  all(uid) {
    return _M.orders.filter(o => o.user_id === uid && o.payment_status === 'completed')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
};
const insertOrder = {
  run(oNo, p, amt, cur, uid, dN, c, wT, sId) {
    _M.orders.push({
      id: _M._id.o++, order_no: oNo, product: p, amount: amt, currency: cur,
      user_id: uid, donor_name: dN, contact: c, wish_text: wT,
      stripe_session_id: sId, payment_status: 'pending', created_at: new Date().toISOString()
    });
    _persist();
  }
};
const insertReading = {
  run(t, i, r, u) {
    _M.readings.push({ id: _M._id.r++, type: t, input: i, result: r, user_id: u || null, created_at: new Date().toISOString() });
    _persist();
  }
};
const getReadingsByUser = {
  all(uId) {
    return _M.readings.filter(r => r.user_id === uId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
  }
};

// ── 产品/付费墙相关常量 ──
// 🔴 P1-1 付费墙修复: 精确白名单，bazi_trial 不解锁完整报告
const UNLOCK_BY_CATEGORY = {
  'bazi': ['bazi_full','bazi_vip'], '八字': ['bazi_full','bazi_vip'], '사주': ['bazi_full','bazi_vip'],
  'hehun': ['hehun','hehun_basic','hehun_master'], '合婚': ['hehun','hehun_basic','hehun_master'], '궁합': ['hehun','hehun_basic','hehun_master'], 'hehun_kr': ['hehun','hehun_basic','hehun_master'], 'hehun_full': ['hehun','hehun_basic','hehun_master'], 'hehun_kr_full': ['hehun','hehun_basic','hehun_master'],
  'ziwei': ['ziwei','ziwei_full'], '紫微': ['ziwei','ziwei_full'], 'ziwei_full': ['ziwei','ziwei_full'],
  'xingming': ['xingming'], '姓名': ['xingming'],
  'astrology': ['astrology'], '占星': ['astrology'],
  'fengshui': ['fengshui', 'fengshui_full'], '风水': ['fengshui', 'fengshui_full'],
  'yinzhai': ['yinzhai_full','yinzhai'], '阴宅': ['yinzhai_full','yinzhai'],
  'liuyao': ['liuyao'], '六爻': ['liuyao'],
  'qimen': ['qimen'], '奇门': ['qimen'],
  'daliuren': ['daliuren'], '大六壬': ['daliuren'],
  'lingqian': ['lingqian'], '灵签': ['lingqian'],
  'pastlife': ['pastlife'], '前世': ['pastlife'],
  'tarot': ['tarot'], '塔罗': ['tarot'],
  'jyotish_full': ['jyotish_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'jyotish': ['jyotish_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  'maya_full': ['maya_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'maya': ['maya_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  'tibet_full': ['tibet_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'tibet': ['tibet_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  // 🔴 0817: 'member'/面相 只映射「全解锁会员」。月会员(member_monthly)走 credit 机制,
  //   由 hasFullAccess/gateMessages 里的 monthly 分支单独放行,不在这里直接解锁。
  'mianxiang': ['member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  '面相': ['member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'member': ['member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'zhiyuan_full': ['zhiyuan_full', 'member_yearly', 'member_quarterly', 'member_3year','member_lifetime','member_daily'],
  // daily_sub(每日运势): 月会员也含每日运势, 故保留 member_monthly(每日运势不属"完整报告", 不消耗 credit)
  'daily_sub': ['daily_sub', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily','member_lifetime'],
};

// 🔴 续费修复(0731): 订阅类产品加 expires_at 到期判断
const SUBSCRIBE_PRODUCTS = ['member_monthly','member_yearly','member_quarterly','member_3year','member_daily','daily_sub'];

// ── 会员分级(0817 最终阶梯) ──
// 全解锁会员(报告无限+无限聊天+每月1次大师深度credit): 年/季/3年/终身/日
const FULL_MEMBER_PRODUCTS = ['member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'];
// 月会员(限量聊天5句/天 + 每月1份完整报告credit + 每日运势·不含大师深度·非全报告无限)
const MONTHLY_MEMBER_PRODUCTS = ['member_monthly'];
// 月会员每月完整报告 credit 额度
const MONTHLY_REPORT_CREDIT = 1;
// 月会员聊天每日限量
const MONTHLY_CHAT_DAILY_LIMIT = 5;

// 🔴 0817: 保证「全解锁会员」能无限解锁所有报告类目 —— 把 FULL_MEMBER_PRODUCTS 注入
//   UNLOCK_BY_CATEGORY 每个类目(去重)。月会员(member_monthly)仍走 credit 机制,不在此注入。
//   注意: 只注入报告类目; daily_sub 保留其原有 member_monthly(每日运势非报告,不耗 credit)。
(function _injectFullMemberUnlock() {
  Object.keys(UNLOCK_BY_CATEGORY).forEach(function(cat) {
    var arr = UNLOCK_BY_CATEGORY[cat];
    FULL_MEMBER_PRODUCTS.forEach(function(p) {
      if (arr.indexOf(p) < 0) arr.push(p);
    });
  });
})();

function _isExpired(o) {
  if (!o.expires_at) return false;
  return Date.parse(o.expires_at) < Date.now();
}

// 取登录 token → user_id。无 token / 无效返回 null。
function _uidFromReq(req) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return null;
    var t = getToken.get(token);
    return t ? t.user_id : null;
  } catch (e) { return null; }
}

// 判断用户拥有的会员档: 'unlimited' | 'monthly' | null
// unlimited = 全解锁会员(FULL_MEMBER_PRODUCTS); monthly = 仅月会员。ADMIN_TOKEN → unlimited。
function memberTier(req) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return 'unlimited';
    if (!token) return null;
    var t = getToken.get(token);
    if (!t) return null;
    var orders = (getUserOrders.all(t.user_id) || []).filter(function(o) { return !_isExpired(o); });
    var owned = {};
    orders.forEach(function(o) { owned[String(o.product || '')] = true; });
    if (FULL_MEMBER_PRODUCTS.some(function(p) { return owned[p]; })) return 'unlimited';
    if (owned['member_lifetime']) return 'unlimited';
    if (MONTHLY_MEMBER_PRODUCTS.some(function(p) { return owned[p]; })) return 'monthly';
    return null;
  } catch (e) { return null; }
}

// 月会员当前 billing 月的 key。以最近一笔 member_monthly 订单的 created_at 起算，
// 按 ~30天周期滚动，得到当前周期序号，配合 user_id 组成计数 key，实现按 billing 月重置。
// 🔴 P1修复(专家复审): 原按"最新订单created_at滚动30天周期"会与 Stripe 实际账单日
//   (按自然月扣费)逐月漂移,造成"没到账单日却已重置"客诉。改用自然月 YYYY-MM:
//   直观可解释、与月度扣费天然对齐、不依赖订单时间线,也避免续费订单 user_id 缺失时的歧义。
function _monthlyBillingKey(uid, req) {
  return uid + '_rc_' + new Date().toISOString().slice(0, 7);
}

// 月会员完整报告 credit: 查询本 billing 月是否还有额度(未真正扣减)
function monthlyReportCreditRemaining(uid, req) {
  if (!_M.reportCredits) _M.reportCredits = {};
  var key = _monthlyBillingKey(uid, req);
  var used = _M.reportCredits[key] || 0;
  return Math.max(0, MONTHLY_REPORT_CREDIT - used);
}

// 月会员完整报告 credit: 尝试消费一次。成功返回 true 并落盘; 无额度返回 false。
function consumeMonthlyReportCredit(uid, req) {
  if (!uid) return false;
  if (!_M.reportCredits) _M.reportCredits = {};
  var key = _monthlyBillingKey(uid, req);
  var used = _M.reportCredits[key] || 0;
  if (used >= MONTHLY_REPORT_CREDIT) return false;
  _M.reportCredits[key] = used + 1;
  _persist();
  return true;
}

// 🔴 P0-C修复(专家复审): 报告生成(LLM)失败时回补已扣的 credit,防"扣了额度没拿到报告"漏账。
//   端点在 gateReportAccess 返回 viaCredit=true 后, 若 LLM 抛错, 调此回滚。幂等下限保护到 0。
function refundMonthlyReportCredit(uid, req) {
  if (!uid) return false;
  if (!_M.reportCredits) _M.reportCredits = {};
  var key = _monthlyBillingKey(uid, req);
  var used = _M.reportCredits[key] || 0;
  if (used <= 0) return false;
  _M.reportCredits[key] = used - 1;
  _persist();
  return true;
}

function hasFullAccess(req, productKeys) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return false;
    // 管理员绕过：CEOtoken直接全访问（开发/审核用）
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true;
    var t = getToken.get(token);
    if (!t) return false;
    var orders = getUserOrders.all(t.user_id) || [];
    var paidAccess = orders.some(function(o) {
      var prod = String(o.product || '');
      if (_isExpired(o)) return false;
      return productKeys.some(function(k) {
        var allowed = UNLOCK_BY_CATEGORY[k];
        return allowed ? allowed.indexOf(prod) >= 0 : false;
      });
    });
    if (paidAccess) return true;
    // 裂变奖励: 未使用的 referral_basic 奖励也能解锁一次 basic 报告
    if (!_M.rewards) return false;
    var reward = _M.rewards.find(function(r) { return r.user_id === t.user_id && r.type === 'referral_basic' && !r.used; });
    if (reward) { reward.used = true; _persist(); return true; }
    return false;
  } catch (e) { return false; }
}

// 🔴 P0-NEW修复(第二轮复审): 月会员"每月1份完整报告 credit"只覆盖【标准报告】,
//   不能用 1 个 $9.9 credit 换走高端单品($69.9阴宅/大师深度/大师批婚)。
//   CREDIT_INELIGIBLE_KEYS = credit 不可覆盖的高端类目/产品键; 命中则月会员不走 credit,
//   必须单买对应高端产品或升全解锁会员。标准报告(八字/紫微/合婚/风水/塔罗/占星/姓名/
//   六爻/奇门/大六壬/灵签/前世/高考志愿/jyotish/maya/tibet 等)照常吃 credit。
var CREDIT_INELIGIBLE_KEYS = {
  'yinzhai': true, '阴宅': true, 'yinzhai_full': true,   // $69.9 阴宅
  'bazi_vip': true,                                       // $39.9 大师深度(另有 detectBaziVip 独立门,这里双保险)
  'hehun_master': true,                                   // 大师批婚(另由 hehunTier 独立分档)
};

// ── 报告级访问判定(0817·会员分级核心)──
// 返回 { full: bool, viaCredit: bool, tier: 'unlimited'|'monthly'|'paid'|'referral'|null }
// 优先级: 单买/全解锁会员/裂变 → full(不耗 credit); 否则 月会员且本月还有 credit
//   且该报告属"credit可覆盖的标准报告" → 消费1个 credit → full。
// 报告端点用此判定; 聊天/每日运势不要用(它们各有自己的限量逻辑,别误耗报告 credit)。
function gateReportAccess(req, productKeys) {
  // 先复用 hasFullAccess: 单买/全解锁会员/裂变奖励
  if (hasFullAccess(req, productKeys)) {
    return { full: true, viaCredit: false, tier: 'paid' };
  }
  // 月会员: 消费本 billing 月的报告 credit —— 但高端单品不在 credit 覆盖范围
  var uid = _uidFromReq(req);
  if (uid && memberTier(req) === 'monthly') {
    var creditEligible = !(productKeys || []).some(function(k) { return CREDIT_INELIGIBLE_KEYS[k]; });
    if (creditEligible && consumeMonthlyReportCredit(uid, req)) {
      // 🔴 P0-C: 打标记, 供端点在 LLM 失败时回补 credit(_refundCreditOnFail)。
      try { req._syCreditUid = uid; } catch (e) {}
      return { full: true, viaCredit: true, tier: 'monthly' };
    }
    // 月会员但 credit 用尽 / 或请求的是高端单品 → 走免费预览(高端单品端点自行 402)
    return { full: false, viaCredit: false, tier: 'monthly' };
  }
  return { full: false, viaCredit: false, tier: null };
}

// 合婚三档分档: 返回 'master' | 'full' | 'basic' | null
// 参照 hasFullAccess 取 token→user orders→过滤未过期订单
function hehunTier(req) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return null;
    // 管理员绕过 → 最高档
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return 'master';
    var t = getToken.get(token);
    if (!t) return null;
    var orders = (getUserOrders.all(t.user_id) || []).filter(function(o) { return !_isExpired(o); });
    var owned = {};
    orders.forEach(function(o) { owned[String(o.product || '')] = true; });
    // master: 拥有 hehun_master
    if (owned['hehun_master']) return 'master';
    // full: 全解锁会员(年/季/3年/终身/日) 或 单买 hehun/hehun_full/hehun_kr_full
    // 🔴 0817: 不再用 SUBSCRIBE_PRODUCTS(含 member_monthly)。月会员改走 credit,见下。
    var fullKeys = FULL_MEMBER_PRODUCTS.concat(['member_lifetime', 'hehun', 'hehun_full', 'hehun_kr_full']);
    for (var i = 0; i < fullKeys.length; i++) { if (owned[fullKeys[i]]) return 'full'; }
    // 月会员: 消费本月报告 credit → full; credit 用尽则降级(basic/裂变/teaser)
    if (owned['member_monthly']) {
      if (consumeMonthlyReportCredit(t.user_id, req)) {
        try { req._syCreditUid = t.user_id; } catch (e) {} // 🔴 P0-C 失败回补标记
        return 'full';
      }
    }
    // basic: 拥有 hehun_basic
    if (owned['hehun_basic']) return 'basic';
    // 裂变奖励: 未使用的 referral_basic 消费一次 → basic
    if (_M.rewards) {
      var reward = _M.rewards.find(function(r) { return r.user_id === t.user_id && r.type === 'referral_basic' && !r.used; });
      if (reward) { reward.used = true; _persist(); return 'basic'; }
    }
    return null;
  } catch (e) { return null; }
}

// 🔴 P0-B修复(专家复审): hehunTier 会消费月会员 credit 与 referral 奖励(有副作用)。
//   只读场景(如 book-consult 只判断是否 master)必须用此版本, 绝不扣 credit/奖励。
//   返回 'master' | 'full' | 'basic' | null。
function hehunTierReadonly(req) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return null;
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return 'master';
    var t = getToken.get(token);
    if (!t) return null;
    var orders = (getUserOrders.all(t.user_id) || []).filter(function(o) { return !_isExpired(o); });
    var owned = {};
    orders.forEach(function(o) { owned[String(o.product || '')] = true; });
    if (owned['hehun_master']) return 'master';
    var fullKeys = FULL_MEMBER_PRODUCTS.concat(['member_lifetime', 'hehun', 'hehun_full', 'hehun_kr_full']);
    for (var i = 0; i < fullKeys.length; i++) { if (owned[fullKeys[i]]) return 'full'; }
    // 月会员本月还有 credit → 视作可升 full(但不在此扣减)
    if (owned['member_monthly'] && monthlyReportCreditRemaining(t.user_id, req) > 0) return 'full';
    if (owned['hehun_basic']) return 'basic';
    return null;
  } catch (e) { return null; }
}

// 只读: 判断登录用户是否有指定精确产品(如 bazi_vip)的已完成、未过期订单
// 参照 hasFullAccess/hehunTier 取 token→user orders→过滤未过期。product 精确匹配，
// 不走 UNLOCK_BY_CATEGORY 展开，故普通 full 用户(bazi_full)不会被误判成 vip。
function hasVipAccess(req, product) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return false;
    // ADMIN_TOKEN 审核绕过
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true;
    var t = getToken.get(token);
    if (!t) return false;
    var orders = getUserOrders.all(t.user_id) || [];
    return orders.some(function(o) {
      if (_isExpired(o)) return false;
      return String(o.product || '') === String(product);
    });
  } catch (e) { return false; }
}

// 付费门+免责: 报告端点统一处理
// 🔴 0817: 改用 gateReportAccess — 全解锁会员/单买/裂变→full; 月会员消费本月1个报告 credit→full;
//   月会员 credit 用尽 或 未付费 → 免费预览段(前2~3维度约2000字,其余锁定引导付费)。
function gateMessages(req, keys, messages, fullMax) {
  fullMax = fullMax || 16384;
  var acc = gateReportAccess(req, keys);
  var full = acc.full;
  var addon = '\n\n【必须遵守】报告最后必须附一行免责声明:"本报告由AI生成,仅供参考娱乐,不构成医学、法律、投资或人生重大决策建议。"';
  if (!full) {
    addon += '\n\n【基础版限制】本次为未付费的基础版,只输出最核心的前2~3个维度的概览(合计约2000字),其余维度不要展开。结尾必须明确告知:完整的详细分析(财运/姻缘/事业/大运流年/开运等)在【完整版报告】中付费解锁。';
  }
  var out = (messages || []).map(function(m) {
    return (m && m.role === 'system') ? { role: 'system', content: (m.content || '') + addon } : m;
  });
  return { messages: out, maxTokens: full ? fullMax : 3500, full: full, viaCredit: acc.viaCredit, memberTier: acc.tier };
}

// ── 订单操作 helpers ──
function _updOrder(s, oNo) {
  const o = _M.orders.find(x => x.order_no === oNo);
  if (o) { o.payment_status = s; _persist(); }
}

function _updOrderExpiry(oNo, expIso) {
  const o = _M.orders.find(x => x.order_no === oNo);
  if (o) { o.expires_at = expIso; o.payment_status = 'completed'; _persist(); }
}

function _setOrExtendSub(pid, email, expIso, stripeSessionId) {
  // 🔴 P0-D修复(专家复审): 续费订单必须回填 user_id, 否则会员分级(memberTier/credit/getUserOrders
  //   全靠 user_id 匹配)在首期到期后查不到续费订单 → 已续费老会员被判成免费用户,报告/无限聊天全掉线。
  //   按 email 反查用户回填; 查不到则退回 null(保持旧行为,不阻断建单)。
  var uid = null;
  if (email) {
    var u = getUserByEmail.get(email);
    if (u) uid = u.id;
  }

  // P1修复：幂等性检查 — 若已存在相同sessionId的订单，直接返回(防webhook重复投递)
  if (stripeSessionId) {
    const existing = _M.orders.find(x => x.stripe_session_id === stripeSessionId && x.product === pid);
    if (existing) {
      console.log('[store] Idempotent: skipping duplicate order', stripeSessionId);
      existing.expires_at = expIso;
      if (uid && existing.user_id == null) existing.user_id = uid; // 补历史缺失
      _persist(); return;
    }
  }

  _M.orders.push({
    id: _M._id.o++, order_no: 'SY-SUB-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
    product: pid, amount: 0, currency: 'usd', user_id: uid, donor_name: '', contact: email, wish_text: '',
    stripe_session_id: stripeSessionId || '', payment_status: 'completed', expires_at: expIso, created_at: new Date().toISOString()
  });
  _persist();
}

function _findOrder(oNo) { return _M.orders.find(x => x.order_no === oNo); }

function _insCnOrder(oNo, product, amountCents, uid, channel) {
  _M.orders.push({
    id: _M._id.o++, order_no: oNo, product: product, amount: amountCents,
    currency: 'cny', user_id: uid || null, donor_name: '', contact: '', wish_text: '',
    stripe_session_id: null, channel: channel, trade_no: '',
    payment_status: 'pending', created_at: new Date().toISOString()
  });
  _persist();
}

// 幂等入账：校验金额(分)后把订单置 completed
function _completeCnOrder(oNo, paidFeeCents, tradeNo) {
  const o = _findOrder(oNo);
  if (!o) return 'notfound';
  if (paidFeeCents != null && Number(o.amount) !== Number(paidFeeCents)) return 'amount_mismatch';
  if (o.payment_status === 'completed') return 'already';
  o.payment_status = 'completed';
  o.trade_no = tradeNo || o.trade_no || '';
  o.paid_at = new Date().toISOString();
  _persist();
  return 'paid';
}

function _insSub(e, sId) {
  if (!_M.subs.find(x => x.stripe_subscription_id === sId)) {
    _M.subs.push({ email: e, stripe_subscription_id: sId, status: 'active', created_at: new Date().toISOString() });
    _persist();
  }
}

function _allOrders() {
  return [..._M.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

function _insJossOrder(oNo, p, amt, cur, dN, c, wT, ps) {
  _M.orders.push({
    id: _M._id.o++, order_no: oNo, product: p, amount: amt, currency: cur,
    donor_name: dN, contact: c, wish_text: wT, payment_status: ps, created_at: new Date().toISOString()
  });
  _persist();
}

// ── 奖励分层（前100倍数机制）──
const REWARD_TIERS = [
  { min: 1, max: 100, level: 'premium', bonus_type: 'referral_premium', amount: 50 },
  { min: 101, max: 200, level: 'standard', bonus_type: 'referral_standard', amount: 30 },
  { min: 201, max: -1, level: 'basic', bonus_type: 'referral_basic', amount: 10 }
];

// ── Referral helpers ──
function invitedCount(uid) {
  return _M.referrals.filter(r => r.inviter_id === uid).length;
}

function wasInvited(uid) {
  return _M.referrals.some(r => r.invitee_id === uid);
}

function createReferral(inviterId, inviteeId, channel) {
  // P1修复: 记录来源渠道
  var ref = { id: _M._id.rf++, inviter_id: inviterId, invitee_id: inviteeId, channel: channel || 'organic', created_at: new Date().toISOString() };
  _M.referrals.push(ref);
  _persist();
  return ref;
}

function grantReferralReward(inviterId) {
  // P1修复: 按邀请数分层发放奖励
  if (!_M.rewards) _M.rewards = [];
  const count = invitedCount(inviterId);
  const tier = REWARD_TIERS.find(t => count >= t.min && (t.max < 0 || count <= t.max));
  if (!tier) return; // 不符合任何等级

  // 检查该等级是否已发过奖励，防重复发放
  const alreadyGivenTier = _M.rewards.find(r =>
    r.user_id === inviterId &&
    r.type === tier.bonus_type &&
    !r.used
  );
  if (alreadyGivenTier) return;

  _M.rewards.push({
    user_id: inviterId,
    type: tier.bonus_type,
    amount: tier.amount,
    level: tier.level,
    triggered_at_count: count,
    used: false,
    created_at: new Date().toISOString()
  });
  _persist();
}

function tryApplyReferral(refCode, inviteeId, channel) {
  // P1修复: 支持渠道参数(来自?ref_channel查询参数)
  if (!refCode) return false;
  var inviter = getUserByRefCode.get(refCode);
  if (!inviter) return false;
  if (inviter.id === inviteeId) return false;
  if (wasInvited(inviteeId)) return false;
  createReferral(inviter.id, inviteeId, channel || 'organic');
  grantReferralReward(inviter.id);
  return true;
}

// ── Streak helper ──
function updateStreak(userId) {
  if (!userId) return { streak: 0, isNew: false };
  if (!_M.streaks) _M.streaks = {};
  var s = _M.streaks[userId] || { count: 0, lastDate: null };
  var today = new Date().toISOString().slice(0, 10);
  if (s.lastDate === today) return { streak: s.count, isNew: false, broke: false };
  var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  var prevCount = s.count;
  var broke = !!(s.lastDate && s.lastDate !== yesterday && prevCount > 1);
  s.count = (s.lastDate === yesterday) ? s.count + 1 : 1;
  s.lastDate = today;
  _M.streaks[userId] = s;
  _persist();
  return { streak: s.count, isNew: true, broke: broke, prevStreak: prevCount };
}

// ── Product prices ──
const PRODUCTS = {
  bazi_basic:      { name: '基础命盘',         amount: 990,    amountCny: 1990,  desc: '日主+五行+今年运势' },
  bazi_full:       { name: '完整命盘',          amount: 1990,   amountCny: 3990,  desc: '六维+十年大运+流月', amountKrw: 9900 },
  bazi_vip:        { name: '深度批命',          amount: 3990,   amountCny: 7990,  desc: '大师级·终身档案', amountKrw: 19900 },
  saju_kr_full:    { name: '사주팔자 완전 분석', amount: 750,    amountCny: 5500,  desc: '사주 완전 분석 보고서 (천간지지 + 대운 + 유년)', amountKrw: 9900 },
  daily_sub:       { name: '每日天机订阅',      amount: 490,    amountCny: 1990,  desc: '每日天机·单功能订阅' },
  tarot:           { name: '塔罗占卜',          amount: 390,    amountCny: 990,   desc: 'AI塔罗解读' },
  tarot_3:         { name: '塔罗三张牌阵',      amount: 900,    amountCny: 990,   desc: 'AI深度三张牌解读（过去·现在·未来）' },
  tarot_5:         { name: '塔罗五芒星牌阵',    amount: 1990,   amountCny: 1990,  desc: 'AI五芒星深度解读·五维度全析' },
  ziwei_full:      { name: '紫微斗数深度解读',  amount: 1990,   amountCny: 3990,  desc: '十二宫位+大运+流年完整批命' },
  duanshi_full:    { name: '断事问卦完整解读',  amount: 990,    amountCny: 990,   desc: '六爻起卦·吉凶断事·行动建议' },
  hehun_basic:     { name: '合婚·基础版',       amount: 490,    amountCny: 990,   desc: '四柱+合婚总分+核心结论预览', amountKrw: 1900 },
  hehun:           { name: '合婚配对',          amount: 1990,   amountCny: 3990,  desc: '双方八字合婚分析', amountKrw: 4900 },
  hehun_master:    { name: '合婚·大师批婚',     amount: 4990,   amountCny: 19900, desc: '完整+5年感情流年+择日+化解+命理师私语+真人连麦', amountKrw: 24900 },
  hehun_full:      { name: 'Compatibility Reading', amount: 1990, amountCny: 3990, desc: 'Full BaZi compatibility analysis', amountKrw: 19900 },
  hehun_kr_full:   { name: '궁합 완전 분석',    amount: 1500,   amountCny: 3990,  desc: '궁합 완전 분석 보고서', amountKrw: 19900 },
  member_monthly:  { name: '月度会员',          amount: 990,    amountCny: 1990,  desc: 'Rún每日5句·每月1份完整报告·每日运势', amountKrw: 9900 },
  member_yearly:   { name: '年度会员',          amount: 9900,   amountCny: 9900,  desc: '无限畅聊+全报告无限+每月1次大师深度' },
  member_lifetime: { name: '终身会员',          amount: 18800,  amountCny: 68800, desc: '永久畅享·全部报告·专属档案' },
  member_daily:    { name: '日会员',            amount: 299,    amountCny: 990,   desc: '24小时无限使用' },
  member_quarterly:{ name: '季会员',            amount: 2490,   amountCny: 6900,  desc: '三个月畅享' },
  member_3year:    { name: '三年会员',          amount: 9900,   amountCny: 9900,  desc: '超值三年·比年费省32%' },
  fengshui_full:   { name: '风水评测完整报告',   amount: 1990,   amountCny: 5990,  desc: '八宅飞星双体系·家庭命卦·12章节完整报告' },
  yinzhai_full:    { name: '阴宅风水分析',       amount: 6990,   amountCny: 19900, desc: '墓地选址·多候选对比·子孙运势·安葬日期' },
  zhiyuan_full:    { name: '高考志愿完整报告',  amount: 1390,   amountCny: 3990,  desc: '八字选专业+数据填志愿完整版' },
  daliuren:        { name: '大六壬预测',        amount: 990,    amountCny: 2900,  desc: '三传四课' },
  qimen:           { name: '奇门遁甲',          amount: 990,    amountCny: 2900,  desc: '八门九星' },
  bazi_trial:      { name: '体验命盘',          amount: 199,    amountCny: 990,   desc: '快速简批' },
  report_unlock_a: { name: '解锁深度报告（第3-6章）', amount: 299, amountCny: 1990, desc: '感情+事业+财运+大运，共4章' },
  report_unlock_b: { name: '解锁完整报告（第7-10章）', amount: 499, amountCny: 3990, desc: '流年+健康+开运+大师寄语，共4章' },
  report_annual:   { name: '年度订阅·全报告无限查', amount: 1490, amountCny: 9900, desc: '全部报告+每季度更新+开运日历' },
  joss_basic:      { name: '代烧·基础套餐',     amount: 4990,   amountCny: 19900, desc: '标准纸钱+元宝+祈福' },
  joss_premium:    { name: '代烧·尊享套餐',     amount: 24900,  amountCny: 99900, desc: '豪邸+纸钱+法器+视频' },
  joss_supreme:    { name: '代烧·至尊套餐',     amount: 249900, amountCny: 999900, desc: '全套冥器+法事+直播' },
};

// ── AI追问上下文缓存 ──
var qaContext = {};

function saveQaContext(endpoint, input, reading) {
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  qaContext[id] = { endpoint: endpoint, input: input, reading: reading, createdAt: Date.now() };
  var cutoff = Date.now() - 30 * 60 * 1000;
  Object.keys(qaContext).forEach(function(k) {
    if (qaContext[k].createdAt < cutoff) delete qaContext[k];
  });
  return id;
}

module.exports = {
  _M,
  _persist,
  _flushStore,
  // 数据访问对象
  insertUser, getUserByEmail, getUserById, getUserByRefCode,
  insertToken, getToken,
  getUserOrders, insertOrder, insertReading, getReadingsByUser,
  // 付费墙
  UNLOCK_BY_CATEGORY, SUBSCRIBE_PRODUCTS, hasFullAccess, hasVipAccess, hehunTier, gateMessages,
  _isExpired,
  // 会员分级(0817)
  FULL_MEMBER_PRODUCTS, MONTHLY_MEMBER_PRODUCTS, MONTHLY_REPORT_CREDIT, MONTHLY_CHAT_DAILY_LIMIT,
  memberTier, gateReportAccess, hehunTierReadonly,
  monthlyReportCreditRemaining, consumeMonthlyReportCredit, refundMonthlyReportCredit,
  // 订单操作
  _updOrder, _updOrderExpiry, _setOrExtendSub,
  _findOrder, _insCnOrder, _completeCnOrder, _insSub, _allOrders, _insJossOrder,
  // Referral
  CHANNELS, REWARD_TIERS, genRefCodesForUser,
  invitedCount, wasInvited, createReferral, grantReferralReward, tryApplyReferral,
  // Streak
  updateStreak,
  // 常量
  PRODUCTS,
  // QA 上下文
  qaContext, saveQaContext,
};
