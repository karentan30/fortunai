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
    for (const k of ['users','tokens','orders','readings','subs','referrals','feedbacks','chatUsage','abEvents']) {
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

// ── 生成唯一 6 位大写 base36 邀请码 ──
function genRefCode() {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var attempt = 0; attempt < 50; attempt++) {
    var buf = crypto.randomBytes(6), code = '';
    for (var i = 0; i < 6; i++) { code += chars[buf[i] % 36]; }
    if (!_M.users.some(u => u.ref_code === code)) return code;
  }
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// ── 数据访问对象 ──
const insertUser = {
  run(e, h) {
    const id = _M._id.u++;
    _M.users.push({ id, email: e, password_hash: h, name: '', ref_code: genRefCode(), created_at: new Date().toISOString() });
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
    return _M.users.find(u => u.ref_code === code);
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
  'hehun': ['hehun'], '合婚': ['hehun'],
  'ziwei': ['ziwei'], '紫微': ['ziwei'],
  'xingming': ['xingming'], '姓名': ['xingming'],
  'astrology': ['astrology'], '占星': ['astrology'],
  'fengshui': ['fengshui'], '风水': ['fengshui'],
  'liuyao': ['liuyao'], '六爻': ['liuyao'],
  'qimen': ['qimen'], '奇门': ['qimen'],
  'daliuren': ['daliuren'], '大六壬': ['daliuren'],
  'lingqian': ['lingqian'], '灵签': ['lingqian'],
  'pastlife': ['pastlife'], '前世': ['pastlife'],
  'tarot': ['tarot'], '塔罗': ['tarot'],
  'mianxiang': ['member_monthly','member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  '面相': ['member_monthly','member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'member': ['member_monthly','member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'zhiyuan_full': ['zhiyuan_full', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year'],
  'daily_sub': ['daily_sub', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily'],
};

// 🔴 续费修复(0731): 订阅类产品加 expires_at 到期判断
const SUBSCRIBE_PRODUCTS = ['member_monthly','member_yearly','member_quarterly','member_3year','member_daily','daily_sub'];

function _isExpired(o) {
  if (!o.expires_at) return false;
  return Date.parse(o.expires_at) < Date.now();
}

function hasFullAccess(req, productKeys) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (!token) return false;
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

// 付费门+免责: 报告端点统一处理
function gateMessages(req, keys, messages, fullMax) {
  fullMax = fullMax || 16384;
  var full = hasFullAccess(req, keys);
  var addon = '\n\n【必须遵守】报告最后必须附一行免责声明:"本报告由AI生成,仅供参考娱乐,不构成医学、法律、投资或人生重大决策建议。"';
  if (!full) {
    addon += '\n\n【基础版限制】本次为未付费的基础版,只输出最核心的前2~3个维度的概览(合计约2000字),其余维度不要展开。结尾必须明确告知:完整的详细分析(财运/姻缘/事业/大运流年/开运等)在【完整版报告】中付费解锁。';
  }
  var out = (messages || []).map(function(m) {
    return (m && m.role === 'system') ? { role: 'system', content: (m.content || '') + addon } : m;
  });
  return { messages: out, maxTokens: full ? fullMax : 3500, full: full };
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

function _setOrExtendSub(pid, email, expIso) {
  const existing = _M.orders.find(x => x.product === pid && x.payment_status === 'completed' && x.user_id === null && x.contact === email);
  if (existing) { existing.expires_at = expIso; _persist(); return; }
  _M.orders.push({
    id: _M._id.o++, order_no: 'SY-SUB-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
    product: pid, amount: 0, currency: 'usd', user_id: null, donor_name: '', contact: email, wish_text: '',
    stripe_session_id: '', payment_status: 'completed', expires_at: expIso, created_at: new Date().toISOString()
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

// ── Referral helpers ──
function invitedCount(uid) {
  return _M.referrals.filter(r => r.inviter_id === uid).length;
}

function wasInvited(uid) {
  return _M.referrals.some(r => r.invitee_id === uid);
}

function createReferral(inviterId, inviteeId) {
  var ref = { id: _M._id.rf++, inviter_id: inviterId, invitee_id: inviteeId, created_at: new Date().toISOString() };
  _M.referrals.push(ref);
  _persist();
  return ref;
}

function grantReferralReward(inviterId) {
  if (!_M.rewards) _M.rewards = [];
  var already = _M.rewards.find(r => r.user_id === inviterId && r.type === 'referral_basic' && !r.used);
  if (!already) {
    _M.rewards.push({ user_id: inviterId, type: 'referral_basic', used: false, created_at: new Date().toISOString() });
    _persist();
  }
}

function tryApplyReferral(refCode, inviteeId) {
  if (!refCode) return false;
  var inviter = getUserByRefCode.get(refCode);
  if (!inviter) return false;
  if (inviter.id === inviteeId) return false;
  if (wasInvited(inviteeId)) return false;
  createReferral(inviter.id, inviteeId);
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
  daily_sub:       { name: '每日天机订阅',      amount: 490,    amountCny: 1990,  desc: '每日天机·单功能订阅' },
  tarot:           { name: '塔罗占卜',          amount: 390,    amountCny: 990,   desc: 'AI塔罗解读' },
  hehun:           { name: '合婚配对',          amount: 1990,   amountCny: 3990,  desc: '双方八字合婚分析', amountKrw: 4900 },
  member_monthly:  { name: '月度会员',          amount: 690,    amountCny: 1990,  desc: '全部AI占算无限次·完整报告不锁定', amountKrw: 12900 },
  member_yearly:   { name: '年度会员',          amount: 4900,   amountCny: 9900,  desc: '全年畅用·合婚报告·水晶挂件' },
  member_lifetime: { name: '终身会员',          amount: 18800,  amountCny: 68800, desc: '永久畅享·全部报告·专属档案' },
  member_daily:    { name: '日会员',            amount: 299,    amountCny: 990,   desc: '24小时无限使用' },
  member_quarterly:{ name: '季会员',            amount: 1499,   amountCny: 6900,  desc: '三个月畅享' },
  member_3year:    { name: '三年会员',          amount: 9900,   amountCny: 9900,  desc: '超值三年·比年费省32%' },
  zhiyuan_full:    { name: '高考志愿完整报告',  amount: 1390,   amountCny: 3990,  desc: '八字选专业+数据填志愿完整版' },
  daliuren:        { name: '大六壬预测',        amount: 990,    amountCny: 2900,  desc: '三传四课' },
  qimen:           { name: '奇门遁甲',          amount: 990,    amountCny: 2900,  desc: '八门九星' },
  bazi_trial:      { name: '体验命盘',          amount: 199,    amountCny: 990,   desc: '快速简批' },
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
  UNLOCK_BY_CATEGORY, SUBSCRIBE_PRODUCTS, hasFullAccess, gateMessages,
  _isExpired,
  // 订单操作
  _updOrder, _updOrderExpiry, _setOrExtendSub,
  _findOrder, _insCnOrder, _completeCnOrder, _insSub, _allOrders, _insJossOrder,
  // Referral
  invitedCount, wasInvited, createReferral, grantReferralReward, tryApplyReferral,
  // Streak
  updateStreak,
  // 常量
  PRODUCTS,
  // QA 上下文
  qaContext, saveQaContext,
};
