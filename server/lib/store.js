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
    // 🔴 0912: reportCreditSpentOn / reportCreditServed 必须一起回载 —— 它们记「本月这份额度
    //   花在哪份报告上」和「这份报告的哪几个请求已经拿到过内容」。
    //   只回载 reportCredits(计数)而不回载标记, 重启后计数还在、标记没了:
    //   月会员正在读的那份报告会重新被判「额度用尽」, 第 2 个请求又撞回付费墙;
    //   而 served 没了, 一次重启就能让「回补」重新放行 —— 刚拿到的报告被退回额度白送一遍。
    for (const k of ['users','tokens','orders','readings','subs','referrals','feedbacks','chatUsage','abEvents','reportCredits','reportCreditSpentOn','reportCreditServed','dailyUsage','rewards','streaks','questionCredits']) {
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
// 🔴 0912: account.html 的「保存资料 / 改密码」所依赖的两个口。
// 原来 routes/profile.js 写的是 store._M.db.prepare(UPDATE users ...) —— 那是 SQLite 时代的
// 残留，本项目 store 是 JSON 快照（_M.users + _persist），根本没有 .db，所以那三段代码
// 一旦被调用就是 TypeError→500。加这两个 helper 让路由有真实可用的数据访问口。
// getUserById 故意**不**返回 birthday/gender/password_hash：/api/auth/me 也在用它，
// 返回 password_hash 等于把口令哈希发给前端。
const getUserPrivateById = {
  get(id) {
    const u = _M.users.find(x => x.id === id);
    return u ? {
      id: u.id, email: u.email, name: u.name, ref_code: u.ref_code,
      birthday: u.birthday || null, gender: u.gender || null,
      password_hash: u.password_hash, created_at: u.created_at
    } : undefined;
  }
};
const updateUserFields = {
  run(id, fields) {
    const u = _M.users.find(x => x.id === id);
    if (!u) return false;
    const ALLOWED = ['name', 'birthday', 'gender', 'password_hash'];
    for (const k of ALLOWED) if (fields && fields[k] !== undefined) u[k] = fields[k];
    u.updated_at = new Date().toISOString();
    _persist();
    return true;
  }
};
// 改密码后让「其他设备」下线。保留 keepToken 这一条（当前会话），
// 否则用户改完密码当场被踢出，而页面上只弹「密码已修改」，体验是「刚改完就登录失效」。
const deleteUserTokens = {
  run(uid, keepToken) {
    const before = _M.tokens.length;
    _M.tokens = _M.tokens.filter(t => t.user_id !== uid || (keepToken && t.token === keepToken));
    const removed = before - _M.tokens.length;
    if (removed) _persist();
    return removed;
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
// ── OAuth（Google 一键登录·经增长中台验签后落库）──
// hub 已验过 id_token，这里只做"找/建本地用户 + 绑 google_sub"。无密码用户 password_hash 置空，
// 只能走 OAuth 登录（走 /api/auth/login 会因 verifyPassword 失败而拒绝，符合预期）。
const getUserByGoogleSub = { get(sub) { return sub ? _M.users.find(u => u.google_sub === sub) : undefined; } };
function findOrCreateGoogleUser({ email, googleSub, name }) {
  const e = String(email || '').trim().toLowerCase();
  const sub = String(googleSub || '').trim();
  // 1) 先按 google_sub 命中（最稳，邮箱可变）；2) 再按 email 命中（老用户首次用 Google 登录→绑定）
  let u = (sub && _M.users.find(x => x.google_sub === sub)) || (e && _M.users.find(x => String(x.email || '').toLowerCase() === e));
  if (u) {
    if (sub && !u.google_sub) u.google_sub = sub;      // 补绑
    if (name && !u.name) u.name = String(name).slice(0, 40);
    _persist();
    return u;
  }
  const id = _M._id.u++;
  const ref_codes = genRefCodesForUser();
  u = { id, email: e, password_hash: '', name: name ? String(name).slice(0, 40) : '', google_sub: sub,
        ref_codes, ref_code: ref_codes.organic, created_at: new Date().toISOString() };
  _M.users.push(u);
  _persist();
  return u;
}

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
    // 防刷: 被邀请人首次真实测算落库后,才给邀请人发裂变奖励(onInviteeFirstReading 幂等)。
    if (u) { try { onInviteeFirstReading(u); } catch (e) {} }
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
  // 🔴 0911: 老报告页(report-{en,cn,in,th,es,pt-br})在卖 report_unlock_a/b，
  //   韩语站在卖 saju_kr_full，求签/御神签/符文页在卖 bazi_basic——但这四个 key
  //   原先不在任何解锁表里 → 用户付了钱，服务端一个字都不放。
  //   gateReportAccess 是二值的（要么免费3章+预告单，要么全文），没法只放第3-6章，
  //   所以这里一律按「已付费=给全文」处理。宁可多给，不能收钱不给货。
  'bazi': ['bazi_full','bazi_vip','report_unlock_a','report_unlock_b','bazi_basic','saju_kr_full'],
  '八字': ['bazi_full','bazi_vip','report_unlock_a','report_unlock_b','bazi_basic','saju_kr_full'],
  '사주': ['bazi_full','bazi_vip','report_unlock_a','report_unlock_b','bazi_basic','saju_kr_full'],
  // 八字 session：买对应单 session 或买全套 bazi_full/vip 都解锁该 session
  'bazi_s_wealth': ['bazi_s_wealth','bazi_full','bazi_vip'], 'bazi_s_love': ['bazi_s_love','bazi_full','bazi_vip'], 'bazi_s_career': ['bazi_s_career','bazi_full','bazi_vip'],
  'bazi_s_dayun': ['bazi_s_dayun','bazi_full','bazi_vip'], 'bazi_s_health': ['bazi_s_health','bazi_full','bazi_vip'], 'bazi_s_luck': ['bazi_s_luck','bazi_full','bazi_vip'],
  // 紫微/西占 session：单买或买对应 _full 全套解锁
  'ziwei_s_career': ['ziwei_s_career','ziwei_full'], 'ziwei_s_wealth': ['ziwei_s_wealth','ziwei_full'], 'ziwei_s_love': ['ziwei_s_love','ziwei_full'], 'ziwei_s_dayun': ['ziwei_s_dayun','ziwei_full'],
  'astrology_s_career': ['astrology_s_career','astrology_full'], 'astrology_s_love': ['astrology_s_love','astrology_full'], 'astrology_s_growth': ['astrology_s_growth','astrology_full'],
  'kyusei_s_career': ['kyusei_s_career','kyusei_full'], 'kyusei_s_love': ['kyusei_s_love','kyusei_full'], 'kyusei_s_direction': ['kyusei_s_direction','kyusei_full'],
  'hehun_s_personality': ['hehun_s_personality','hehun_full','hehun'], 'hehun_s_emotion': ['hehun_s_emotion','hehun_full','hehun'], 'hehun_s_timing': ['hehun_s_timing','hehun_full','hehun'],
  'hehun': ['hehun','hehun_basic','hehun_master'], '合婚': ['hehun','hehun_basic','hehun_master'], '궁합': ['hehun','hehun_basic','hehun_master'], 'hehun_kr': ['hehun','hehun_basic','hehun_master'], 'hehun_full': ['hehun','hehun_basic','hehun_master'], 'hehun_kr_full': ['hehun','hehun_basic','hehun_master'],
  'ziwei': ['ziwei','ziwei_full'], '紫微': ['ziwei','ziwei_full'], 'ziwei_full': ['ziwei','ziwei_full'],
  'shouxiang': ['shouxiang_full'], '手相': ['shouxiang_full'], 'shouxiang_full': ['shouxiang_full'],
  'xingming': ['xingming'], '姓名': ['xingming'],
  'astrology': ['astrology'], '占星': ['astrology','astrology_full'], '星盘': ['astrology_full'], 'astrology_full': ['astrology_full'],
  'kyusei': ['kyusei_full'], '九星': ['kyusei_full'], 'kyusei_full': ['kyusei_full'],
  'fengshui': ['fengshui', 'fengshui_full'], '风水': ['fengshui', 'fengshui_full'],
  'yinzhai': ['yinzhai_full','yinzhai'], '阴宅': ['yinzhai_full','yinzhai'],
  'liuyao': ['liuyao'], '六爻': ['liuyao'],
  'qimen': ['qimen'], '奇门': ['qimen'],
  'daliuren': ['daliuren'], '大六壬': ['daliuren'],
  'lingqian': ['lingqian'], '灵签': ['lingqian'],
  'pastlife': ['pastlife'], '前世': ['pastlife'],
  // 0909: 原本只列 ['tarot'],导致买了 tarot_3($9.00)/tarot_5($19.90) 的用户
  //   在 hasFullAccess 里查不到分类键 → 被当成未付费。照 astrology/fengshui 的
  //   既有惯例,分类键要列全所有能解锁它的产品变体。高档位自然覆盖低档位。
  'tarot': ['tarot','tarot_3','tarot_5'], '塔罗': ['tarot','tarot_3','tarot_5'],
  'tarot_3': ['tarot_3','tarot_5'], 'tarot_5': ['tarot_5'],
  'jyotish_full': ['jyotish_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'jyotish': ['jyotish_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  'maya_full': ['maya_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'maya': ['maya_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  'tibet_full': ['tibet_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'], 'tibet': ['tibet_full','member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'],
  // 🔴 0817: 'member'/面相 只映射「全解锁会员」。月会员(member_monthly)走 credit 机制,
  //   由 hasFullAccess/gateMessages 里的 monthly 分支单独放行,不在这里直接解锁。
  'mianxiang': ['mianxiang_full','member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  '面相': ['mianxiang_full','member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'mianxiang_full': ['mianxiang_full'],
  'member': ['member_yearly','member_lifetime','member_daily','member_quarterly','member_3year'],
  'zhiyuan_full': ['zhiyuan_full', 'member_yearly', 'member_quarterly', 'member_3year','member_lifetime','member_daily'],
  // daily_sub(每日运势): 月会员也含每日运势, 故保留 member_monthly(每日运势不属"完整报告", 不消耗 credit)
  // daily_companion_month/year(每日运势·常伴): 手动周期包, 到期(_isExpired)自动失效需再买。
  'daily_sub': ['daily_sub', 'daily_companion_month', 'daily_companion_year', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily','member_lifetime'],
  'daily_companion': ['daily_companion_month', 'daily_companion_year', 'daily_sub', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily','member_lifetime'],
  // monthly_report(月度报告): monthly_report_year=年包(主推)也解锁单月; 全解锁会员一并放行。
  'monthly_report': ['monthly_report', 'monthly_report_year', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily','member_lifetime'],
};

// 🔴 续费修复(0731): 订阅类产品加 expires_at 到期判断
// 手动周期包(0907): daily_companion_*/monthly_report* 也需到期判断; 它们是"付一期给一期"的
//   一次性支付(Stripe mode=payment, 非 recurring), 完成后由 _grantPeriodicPackExpiry 写 expires_at,
//   到期由 _isExpired 自动失效, 用户需手动再买。⚠️真自动续扣(recurring)未接, 待代扣资质。
const SUBSCRIBE_PRODUCTS = ['member_monthly','member_yearly','member_quarterly','member_3year','member_daily','daily_sub','daily_companion_month','daily_companion_year','monthly_report','monthly_report_year'];

// 手动周期包 SKU → 授予的访问天数(付一期给一期·到期需手动再买·非自动续扣)
const PERIODIC_PACK_DAYS = {
  daily_companion_month: 31,
  daily_companion_year:  366,
  monthly_report:        31,
  monthly_report_year:   366,
};

// ── 会员分级(0817 最终阶梯) ──
// 全解锁会员(报告无限+无限聊天): 年/季/3年/终身/日。不设月度credit; 直接 hasFullAccess 全通。
const FULL_MEMBER_PRODUCTS = ['member_yearly','member_quarterly','member_3year','member_lifetime','member_daily'];
// 月会员(限量聊天30句/天 + 每月1份完整报告credit + 每日运势·不含大师深度·非全报告无限·其他报告5折)
const MONTHLY_MEMBER_PRODUCTS = ['member_monthly'];
// 月会员每月完整报告 credit 额度
const MONTHLY_REPORT_CREDIT = 1;
// 月会员聊天每日限量(免费用户同额度; 全解锁会员=无限)
const MONTHLY_CHAT_DAILY_LIMIT = 30;

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

// 从请求中提取 token 字符串 (Authorization header > body.token > sy_token cookie)
// 🔴 空 Bearer 必须继续回退：新版登录只下发 httpOnly cookie，前端页面普遍写
//    'Bearer ' + (localStorage.getItem('sy_token')||'')，拿不到 localStorage 时就发出
//    「Authorization: Bearer 」（尾部空）。旧实现见前缀匹配即 return ''，
//    导致 cookie 回退永远走不到 —— 已登录会员被当成匿名，付费内容不解锁、
//    配额按匿名计。这里改成「拿到非空令牌才算命中」。
function _tokenFromReq(req) {
  var auth = (req.headers && req.headers['authorization']) || '';
  if (auth.indexOf('Bearer ') === 0) {
    var bearer = auth.slice(7).trim();
    if (bearer) return bearer;
    // 空 Bearer → 落到 body.token / cookie 继续找
  }
  if (req.body && req.body.token) return String(req.body.token).trim();
  // httpOnly cookie fallback — parse raw Cookie header without cookie-parser
  try {
    var cookieHeader = (req.headers && req.headers['cookie']) || '';
    if (cookieHeader) {
      var cookies = cookieHeader.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var parts = cookies[i].trim().split('=');
        if (parts[0].trim() === 'sy_token' && parts[1]) {
          return decodeURIComponent(parts.slice(1).join('=').trim());
        }
      }
    }
  } catch (e) {}
  return '';
}

// 取登录 token → user_id。无 token / 无效返回 null。
function _uidFromReq(req) {
  try {
    var token = _tokenFromReq(req);
    if (!token) return null;
    var t = getToken.get(token);
    return t ? t.user_id : null;
  } catch (e) { return null; }
}

// 判断用户拥有的会员档: 'unlimited' | 'monthly' | null
// unlimited = 全解锁会员(FULL_MEMBER_PRODUCTS); monthly = 仅月会员。ADMIN_TOKEN → unlimited。
function memberTier(req) {
  try {
    var token = _tokenFromReq(req);
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

// ── 「本月这份报告的 credit 花在哪一份上」(0912 修复) ──
// 原来 credit 只按 uid+自然月计数、不记花在哪份报告上。而一份报告要发**多个请求**
// (报告页一次浏览 = 拿 meta 的 1 个 + 免费章 1 个 + 各付费章 7 个)，于是第 2 个请求起
// 就被判「额度用尽」→ 付费月会员看到的是免费预览 + 一个「再付一次」的付费墙，
// 而他明明交着月费。这里记住花在哪份报告上：同一份报告在本月的后续请求直接放行、
// 不重复扣；换成别份报告仍要各自一份额度，「每月1份」的上限不变。
function _monthlyCreditSpentKey(uid) {
  return uid + '_rcs_' + new Date().toISOString().slice(0, 7);
}
// 🔴 reportId 必须由调用方显式给出「这是哪一份报告」，绝不能从 productKeys 推。
//   理由(专家复审抓到的 P0)：productKeys 是**类目并集**，职责是"你拥有其中任一个就解锁"，
//   不是报告身份。divination.js 里同一个 11 键数组被 /api/ziwei、/api/xingming、
//   /api/astrology 三个**不同报告**共用，21 键那个更是被 10 个端点共用 ——
//   一旦拿它当身份，一个 credit 会连锁放行 3~10 份付费报告。
//   所以：不传 reportId 的端点**维持旧行为**(每个请求各自消耗额度，不做幂等放行)，
//   默认安全 —— 漏标注只会让那页回到修复前的严格行为，绝不会多送报告。
//   标记值带 '#' 前缀，与任何由 productKeys 拼出的字符串天然不同名，杜绝跨命名空间撞车。
// 返回 'already'(同一份报告本月已放行) | 'consumed'(本次扣成功) | 'none'(没额度)
function _monthlyCreditForReport(uid, reportId, req) {
  if (!uid) return 'none';
  if (!_M.reportCreditSpentOn) _M.reportCreditSpentOn = {};
  var sk = _monthlyCreditSpentKey(uid);
  if (reportId && _M.reportCreditSpentOn[sk] === '#' + reportId) {
    // 🔴 P1(专家复审): 记下「这份额度下已经有请求真的拿到过内容了」。
    //   本函数返回 'already' 的那个请求，服务端是**真的把付费内容发给它了**，
    //   只是没再扣一次额度。此时若头一个请求(扣额度那个)的 LLM 恰好失败并触发回补，
    //   额度被退回、标记被清，会员就白拿这一份完整报告，还能用退回的额度再开一份 ——
    //   一次付款两份报告。有了这个 latch，回补在「已被服务过」时直接拒绝。
    if (!_M.reportCreditServed) _M.reportCreditServed = {};
    _M.reportCreditServed[sk] = '#' + reportId;
    _persist();
    return 'already';
  }
  if (!consumeMonthlyReportCredit(uid, req)) return 'none';
  if (reportId) {
    // 新的一次消费：换了一份报告，上一轮「已被服务过」的印记作废。
    // ⚠️ 复审确认：MONTHLY_REPORT_CREDIT===1 时这行**不可达**（served 非空 ⇒ spentOn 非空 ⇒
    //    额度已用完，不可能再有「新鲜消费」）。它是为额度>1 的将来留的防御，别当成已生效的行为；
    //    真要把额度调大，单槽设计必须先改成「每份报告一个槽」（见 refundMonthlyReportCredit 上方注释）。
    if (_M.reportCreditServed) delete _M.reportCreditServed[sk];
    _M.reportCreditSpentOn[sk] = '#' + reportId;
    _persist();
  }
  return 'consumed';
}

// 🔴 P0-C修复(专家复审): 报告生成(LLM)失败时回补已扣的 credit,防"扣了额度没拿到报告"漏账。
//   端点在 gateReportAccess 返回 viaCredit=true 后, 若 LLM 抛错, 调此回滚。幂等下限保护到 0。
// 🔴 注意(0912): 「标记」是**单槽**的(uid+月 一个 key) —— 这只有在 MONTHLY_REPORT_CREDIT===1 时
//   才成立: 一个月只有一份额度，所以「花在哪份报告上」永远是唯一值。若将来把额度调大，
//   必须把标记改成「每份报告一个槽」的集合，否则第 2 份报告会覆盖第 1 份的标记。
//   (store-monthly-credit.test.js 里有一条测试钉死这个前提，改常量会先红。)
function refundMonthlyReportCredit(uid, req) {
  if (!uid) return false;
  if (!_M.reportCredits) _M.reportCredits = {};
  var key = _monthlyBillingKey(uid, req);
  var used = _M.reportCredits[key] || 0;
  if (used <= 0) return false;
  var name = _monthlyCreditSpentKey(uid);
  var mine = (req && req._syCreditReport) || null;
  var marker = _M.reportCreditSpentOn && _M.reportCreditSpentOn[name];
  // (1) 标记属于**另一份报告** → 这次请求根本没扣成功(扣成功是互斥的)，动它就是替别人作废放行，
  //     还会留下「计数已退、标记还在」的错位状态。装作没发生，直接在扣减之前返回。
  if (marker && (!mine || marker !== '#' + mine)) return false;
  // (2) 同一份报告的兄弟请求已经拿到过内容 → 这份额度已经在用了，不能退。
  //     退了 = 那份已送达的报告白送，而且退回的额度还能再开一份(一次付款两份报告)。
  if (mine && _M.reportCreditServed && _M.reportCreditServed[name] === '#' + mine) return false;
  _M.reportCredits[key] = used - 1;
  // 回补时把「花在哪份报告上」的标记一起清掉 —— 否则那份报告本月会被认成「已放行」，
  // 之后每个请求都直接放行，等于把退回的这一次额度变成本月无限次。
  if (marker) delete _M.reportCreditSpentOn[name];
  _persist();
  return true;
}

// ── 按次问事 credit（single_question=1次, question_pack_3=3次）──
// credit 绑定 user_id + 永不过期(不按月重置)。key: 'qc_<uid>'
function questionCreditsRemaining(uid) {
  if (!uid) return 0;
  if (!_M.questionCredits) _M.questionCredits = {};
  return Math.max(0, _M.questionCredits['qc_' + uid] || 0);
}

function grantQuestionCredits(uid, n) {
  if (!uid || !n) return;
  if (!_M.questionCredits) _M.questionCredits = {};
  var key = 'qc_' + uid;
  _M.questionCredits[key] = (_M.questionCredits[key] || 0) + n;
  _persist();
}

// 消费1次问事 credit。成功返回 true; 无额度返回 false。
function consumeQuestionCredit(uid) {
  if (!uid) return false;
  if (!_M.questionCredits) _M.questionCredits = {};
  var key = 'qc_' + uid;
  var rem = _M.questionCredits[key] || 0;
  if (rem <= 0) return false;
  _M.questionCredits[key] = rem - 1;
  _persist();
  return true;
}

function hasFullAccess(req, productKeys) {
  try {
    var token = _tokenFromReq(req);
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
    // 裂变奖励: referral_premium/standard 每个未使用奖励解锁1次报告;
    // referral_basic 同样解锁1次(等级越高奖励越多但单次消费量一样)
    if (!_M.rewards) return false;
    var reward = _M.rewards.find(function(r) {
      return r.user_id === t.user_id &&
        (r.type === 'referral_basic' || r.type === 'referral_standard' || r.type === 'referral_premium' || r.type === 'referral_invitee_welcome') &&
        !r.used;
    });
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
//
// 第 3 个参数 reportId：**一份报告被多个请求拼出来时必传**(比如八字报告页要发
// stream + 各章 chapter 共 N 个请求)。同一份报告的所有端点传同一个 id，本月的后续请求
// 就直接放行、不重复扣额度。不传 = 维持旧行为(每个请求各自要额度)，是默认安全的那一侧。
function gateReportAccess(req, productKeys, reportId) {
  // 先复用 hasFullAccess: 单买/全解锁会员/裂变奖励
  if (hasFullAccess(req, productKeys)) {
    return { full: true, viaCredit: false, tier: 'paid' };
  }
  // 月会员: 消费本 billing 月的报告 credit —— 但高端单品不在 credit 覆盖范围
  var uid = _uidFromReq(req);
  if (uid && memberTier(req) === 'monthly') {
    var creditEligible = !(productKeys || []).some(function(k) { return CREDIT_INELIGIBLE_KEYS[k]; });
    if (creditEligible) {
      var _g = _monthlyCreditForReport(uid, reportId, req);
      // 同一份报告本月已经放行过 → 后续请求(其它章/拿 meta 那次)直接放行，不再扣
      if (_g === 'already') return { full: true, viaCredit: false, tier: 'monthly', reportId: reportId || null };
      if (_g === 'consumed') {
        // 🔴 P0-C: 打标记, 供端点在 LLM 失败时回补 credit(_refundCreditOnFail)。
        //    _syCreditReport 同时告诉回补逻辑"退的是哪一份"，避免误清别份的放行标记。
        try { req._syCreditUid = uid; req._syCreditReport = reportId || null; } catch (e) {}
        return { full: true, viaCredit: true, tier: 'monthly', reportId: reportId || null };
      }
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
    var token = _tokenFromReq(req);
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
      // 走同一个「这份报告本月是否已放行」判定：合婚报告页若也发多个请求，
      // 不会在第二个请求上被误判成额度用尽（与 gateReportAccess 同一套语义）
      var _hg = _monthlyCreditForReport(t.user_id, 'hehun', req);
      if (_hg === 'already') return 'full';
      if (_hg === 'consumed') {
        try { req._syCreditUid = t.user_id; req._syCreditReport = 'hehun'; } catch (e) {} // 🔴 P0-C 失败回补标记
        return 'full';
      }
    }
    // basic: 拥有 hehun_basic
    if (owned['hehun_basic']) return 'basic';
    // 裂变奖励: 任意等级的未使用奖励消费一次 → basic (premium/standard 也能用)
    if (_M.rewards) {
      var reward = _M.rewards.find(function(r) {
        return r.user_id === t.user_id &&
          (r.type === 'referral_basic' || r.type === 'referral_standard' || r.type === 'referral_premium' || r.type === 'referral_invitee_welcome') &&
          !r.used;
      });
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
    var token = _tokenFromReq(req);
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
    var token = _tokenFromReq(req);
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

// 手动周期包(0907): 若订单产品在 PERIODIC_PACK_DAYS 内, 从"付款成功时刻"起授予对应天数的访问期,
//   写 expires_at。到期后 _isExpired 自动失效, 用户需手动再买(非自动续扣)。
//   在所有付款完成路径(_completeCnOrder / Stripe webhook checkout.session.completed)调用。
function _grantPeriodicPackExpiry(order) {
  if (!order) return;
  var days = PERIODIC_PACK_DAYS[String(order.product || '')];
  if (!days) return;
  // 若用户对同类周期包已有未过期访问期, 从"较晚的到期日"续期(叠加), 否则从现在起算。
  var base = Date.now();
  if (order.expires_at) {
    var prev = Date.parse(order.expires_at);
    if (!isNaN(prev) && prev > base) base = prev;
  }
  order.expires_at = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  _persist();
}

// amountCents 的单位**随通道变**：微信/支付宝传 prod.amountCny(人民币分)，
// Stripe 传 prod.amount(美元分)。0912 之前 currency 一律写死 'cny'，
// 于是刷卡买的 $11.99 在库里被记成 1199 分人民币。加第 6 个参数记录真实币种（默认 cny 不变）。
function _insCnOrder(oNo, product, amountCents, uid, channel, currency) {
  _M.orders.push({
    id: _M._id.o++, order_no: oNo, product: product, amount: amountCents,
    currency: currency || 'cny', user_id: uid || null, donor_name: '', contact: '', wish_text: '',
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
  _grantPeriodicPackExpiry(o);  // 手动周期包: 授予访问期(付一期给一期)
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

// ── 奖励分层（邀请越多等级越高）──
// min: 达到该等级所需的最低邀请数; max: -1 表示无上限
// 梯度: 1-10 basic → 11-50 standard → 51+ premium
const REWARD_TIERS = [
  { min: 51, max: -1,  level: 'premium',  bonus_type: 'referral_premium',  amount: 50 },
  { min: 11, max: 50,  level: 'standard', bonus_type: 'referral_standard', amount: 30 },
  { min: 1,  max: 10,  level: 'basic',    bonus_type: 'referral_basic',    amount: 10 }
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

  // 检查该等级是否已发过奖励，防重复发放。
  // 注意: 去掉 !r.used 条件——该 level 只要发过（不论是否已消费）就不重发，
  // 避免用户用掉奖励后同档再邀请触发重复发放漏洞。
  const alreadyGivenTier = _M.rewards.find(r =>
    r.user_id === inviterId &&
    r.type === tier.bonus_type
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

// ── 被邀请人欢迎奖励(双方各得1次的"被邀请人"侧)──
// 被邀请人首次被归因即得 1 次「完整报告」解锁额度。防重复: 每人只发一次 welcome。
function grantInviteeReward(inviteeId) {
  if (!inviteeId) return;
  if (!_M.rewards) _M.rewards = [];
  const exists = _M.rewards.find(r =>
    r.user_id === inviteeId && r.type === 'referral_invitee_welcome');
  if (exists) return;
  _M.rewards.push({
    user_id: inviteeId,
    type: 'referral_invitee_welcome',   // gateReportAccess/hehunTier 已登记该 type
    amount: 10,
    level: 'invitee',
    used: false,
    created_at: new Date().toISOString()
  });
  _persist();
}

// ── 防刷: 邀请人奖励延迟到"被邀请人首次落 reading"后才发 ──
// 在 insertReading.run 里对每个有 user_id 的 reading 调一次(幂等)。
// 找到该 user 作为被邀请人、且尚未给邀请人发过奖的 referral 记录 → 发邀请人奖励 → 打标记。
function onInviteeFirstReading(userId) {
  if (!userId) return;
  if (!Array.isArray(_M.referrals)) return;
  var ref = _M.referrals.find(function(r) {
    return r.invitee_id === userId && !r.inviter_rewarded;
  });
  if (!ref) return;
  // 软护栏: 邀请人 24h 归因数超 cap 时不发邀请人奖励，但仍打 inviter_rewarded 防重试绕过。
  var overCap = referralAttributionsInLast24h(ref.inviter_id) > REFERRAL_DAILY_CAP;
  ref.inviter_rewarded = true;           // 先打标记防重复（无论是否超 cap）
  if (!overCap) {
    grantReferralReward(ref.inviter_id); // 此刻(被邀请人真实激活)才给邀请人发
  }
  _persist();
}

// ── 软护栏: 同一 ref 24h 归因数上限,超限只记录归因不发被邀请人奖励 ──
var REFERRAL_DAILY_CAP = 20;
function referralAttributionsInLast24h(inviterId) {
  if (!Array.isArray(_M.referrals)) return 0;
  var cutoff = Date.now() - 24 * 3600 * 1000;
  return _M.referrals.filter(function(r) {
    return r.inviter_id === inviterId &&
      r.created_at && new Date(r.created_at).getTime() >= cutoff;
  }).length;
}

function tryApplyReferral(refCode, inviteeId, channel) {
  // P1修复: 支持渠道参数(来自?ref_channel查询参数)
  if (!refCode) return false;
  var inviter = getUserByRefCode.get(refCode);
  if (!inviter) return false;
  if (inviter.id === inviteeId) return false;
  if (wasInvited(inviteeId)) return false;
  // 软护栏: 同一邀请人 24h 归因上限。超限仍记录归因(便于统计/防重复邀请),但不发被邀请人欢迎奖励。
  var overCap = referralAttributionsInLast24h(inviter.id) >= REFERRAL_DAILY_CAP;
  createReferral(inviter.id, inviteeId, channel || 'organic');
  if (!overCap) {
    grantInviteeReward(inviteeId);   // 给被邀请人发 1 次解锁额度
  }
  // 邀请人奖励不在此发放 —— 已移到 onInviteeFirstReading(防批量空号刷解锁)。见 insertReading.run。
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
  bazi_full:       { name: '八字 · 一键全解锁（6 session 五折）', amount: 1199, amountCny: 4490, desc: '一键解锁全部 session：财运/感情/事业/大运/健康/开运，约六折省一半', amountKrw: 15900 },
  bazi_vip:        { name: '深度批命',          amount: 5900,   amountCny: 14900, desc: '八字×紫微双体系交叉印证旗舰', amountKrw: 19900 },
  saju_kr_full:    { name: '사주팔자 완전 분석', amount: 750,    amountKrw: 9900, desc: '사주 완전 분석 보고서 (천간지지 + 대운 + 유년)' },
  daily_sub:       { name: '每日天机订阅',      amount: 490,    amountCny: 1990,  desc: '每日天机·单功能订阅' },
  // ── 每日运势·常伴 (手动周期包·付一期给一期·到期需手动再买·非自动续扣) ──
  daily_companion_month: { name: '每日运势 · 常伴（月）', amount: 290, amountCny: 1900, desc: '每日专属运势与开运指引·1个月（到期手动续购）' },
  daily_companion_year:  { name: '每日运势 · 常伴（年）', amount: 1900, amountCny: 13800, desc: '每日专属运势与开运指引·12个月（到期手动续购，比月付省）' },
  // ── 月度报告 (手动周期包·付一期给一期·到期需手动再买·非自动续扣) ──
  monthly_report:      { name: '月度报告 · 单月', amount: 990, amountCny: 3900, desc: '本月专属流月运势完整报告·1个月（到期手动续购）' },
  monthly_report_year: { name: '月度报告 · 年包（12期）', amount: 9900, amountCny: 39800, desc: '连续12个月每月一份完整月度报告·主推（到期手动续购，比单月省）' },
  tarot:           { name: '塔罗占卜',          amount: 390,    amountCny: 990,   desc: 'AI塔罗解读' },
  tarot_3:         { name: '塔罗三张牌阵',      amount: 900,    amountCny: 990,   desc: 'AI深度三张牌解读（过去·现在·未来）' },
  tarot_5:         { name: '塔罗五芒星牌阵',    amount: 1990,   amountCny: 1990,  desc: 'AI五芒星深度解读·五维度全析' },
  ziwei_full:      { name: '紫微 · 一键全解锁（session 五折）', amount: 1199, amountCny: 4490, desc: '一键解锁全部紫微 session：事业/财帛/夫妻/大限' },
  shouxiang_full:  { name: '手相·麻衣神相完整解读', amount: 990, amountCny: 5900, desc: '掌纹三大主线+八大丘+特殊纹+化解建议' },
  mianxiang_full:  { name: '面相·麻衣神相完整解读', amount: 990, amountCny: 5900, desc: '三停五岳+十二宫+流年气色+化解建议' },
  duanshi_full:    { name: '断事问卦完整解读',  amount: 2900,   amountCny: 5900,  desc: '六爻起卦·吉凶断事·行动建议' },
  astrology_full:  { name: '西占 · 一键全解锁（session 五折）', amount: 1199, amountCny: 4490, desc: '一键解锁全部西占 session：事业/爱情/性格天赋' },
  kyusei_full:     { name: '九星 · 一键全解锁（session 五折）', amount: 1199, amountCny: 4490, desc: '一键解锁全部九星 session：事业/恋爱/方位' },
  // ── 八字 session 制（0820·每个 session $3.99·首个总览免费）──
  bazi_s_wealth:   { name: '八字 · 财运专精',   amount: 399,    amountCny: 1490,  desc: '正偏财格局+发财黄金年份+适合行业' },
  bazi_s_love:     { name: '八字 · 感情姻缘',   amount: 399,    amountCny: 1490,  desc: '夫妻宫+正缘特征+遇缘年份' },
  bazi_s_career:   { name: '八字 · 事业专精',   amount: 399,    amountCny: 1490,  desc: '官杀印星+升职时机+贵人特征' },
  bazi_s_dayun:    { name: '八字 · 大运流年',   amount: 399,    amountCny: 1490,  desc: '逐步大运+近年流年吉凶' },
  bazi_s_health:   { name: '八字 · 健康养生',   amount: 399,    amountCny: 1490,  desc: '五行脏腑+先天弱项+养生方向' },
  bazi_s_luck:     { name: '八字 · 开运贵人',   amount: 399,    amountCny: 1490,  desc: '幸运颜色方位+贵人特征+化解' },
  // 紫微 session
  ziwei_s_career:  { name: '紫微 · 事业官禄',   amount: 399,    amountCny: 1490,  desc: '官禄宫+事业方向+关键年份+贵人' },
  ziwei_s_wealth:  { name: '紫微 · 财帛财运',   amount: 399,    amountCny: 1490,  desc: '财帛宫+聚财方式+财运高峰年' },
  ziwei_s_love:    { name: '紫微 · 夫妻姻缘',   amount: 399,    amountCny: 1490,  desc: '夫妻宫+正缘+遇缘年份' },
  ziwei_s_dayun:   { name: '紫微 · 大限流年',   amount: 399,    amountCny: 1490,  desc: '当前大限+近年流年+转折年' },
  // 西占 session
  astrology_s_career: { name: '西占 · 事业财富', amount: 399,   amountCny: 1490,  desc: '事业行星+方向+过境年份' },
  astrology_s_love:   { name: '西占 · 爱情关系', amount: 399,   amountCny: 1490,  desc: '金星火星+关系模式+时机' },
  astrology_s_growth: { name: '西占 · 性格天赋', amount: 399,   amountCny: 1490,  desc: '水星+关键相位+成长课题' },
  // 九星 session
  kyusei_s_career:    { name: '九星 · 事业方向', amount: 399,   amountCny: 1490,  desc: '最适行业+发力时机+合作特质' },
  kyusei_s_love:      { name: '九星 · 恋爱人际', amount: 399,   amountCny: 1490,  desc: '恋爱模式+相性星号+人际提升' },
  kyusei_s_direction: { name: '九星 · 方位择吉', amount: 399,   amountCny: 1490,  desc: '今年吉凶方+家居/出行方位' },
  // 合婚 session
  hehun_s_personality:{ name: '合婚 · 性格相处', amount: 399,   amountCny: 1490,  desc: '性格互补+摩擦雷区+相处之道' },
  hehun_s_emotion:    { name: '合婚 · 感情经营', amount: 399,   amountCny: 1490,  desc: '感情课题+吵架模式+经营长久' },
  hehun_s_timing:     { name: '合婚 · 婚期择吉', amount: 399,   amountCny: 1490,  desc: '适婚年份+择吉参考' },
  hehun_basic:     { name: '合婚·基础版',       amount: 490,    amountCny: 990,   desc: '四柱+合婚总分+核心结论预览', amountKrw: 1900 },
  hehun:           { name: '合婚配对',          amount: 990,    amountCny: 5900,  desc: '双方八字合婚分析', amountKrw: 4900 },
  hehun_master:    { name: '合婚·大师批婚',     amount: 9900,   amountCny: 29900, desc: '完整+5年感情流年+择日+化解+命理师私语+真人连麦', amountKrw: 24900 },
  hehun_full:      { name: '合婚 · 一键全解锁（session 五折）', amount: 1199, amountCny: 4490, desc: '一键解锁全部合婚 session：性格/感情/婚期', amountKrw: 15900 },
  hehun_kr_full:   { name: '궁합 완전 분석',    amount: 1500,   amountCny: 3990,  desc: '궁합 완전 분석 보고서', amountKrw: 19900 },
  member_monthly:  { name: '月度会员',          amount: 1290,   amountCny: 3900,  desc: 'Rún每日30句·每月1份完整报告·其他报告5折·每日运势', amountKrw: 9900 },
  member_yearly:   { name: '年度会员',          amount: 9900,   amountCny: 29900, desc: '无限畅聊+全报告无限解锁' },
  member_lifetime: { name: '终身会员',          amount: 18800,  amountCny: 68800, desc: '永久畅享·全部报告·专属档案' },
  member_daily:    { name: '日会员',            amount: 299,    amountCny: 990,   desc: '24小时无限使用' },
  member_quarterly:{ name: '季会员',            amount: 2490,   amountCny: 6900,  desc: '三个月畅享' },
  member_3year:    { name: '三年会员',          amount: 19900,  amountCny: 9900,  desc: '超值三年·比年费省32%' },
  fengshui_full:   { name: '风水评测完整报告',   amount: 2900,   amountCny: 5900,  desc: '八宅飞星双体系·家庭命卦·12章节完整报告' },
  yinzhai_full:    { name: '阴宅风水分析',       amount: 9900,   amountCny: 29900, desc: '墓地选址·多候选对比·子孙运势·安葬日期' },
  zhiyuan_full:    { name: '高考志愿完整报告',  amount: 1390,   amountCny: 3990,  desc: '八字选专业+数据填志愿完整版' },
  daliuren:        { name: '大六壬预测',        amount: 2900,   amountCny: 5900,  desc: '三传四课' },
  qimen:           { name: '奇门遁甲',          amount: 2900,   amountCny: 5900,  desc: '八门九星' },
  bazi_trial:      { name: '体验命盘',          amount: 690,    amountCny: 1990,  desc: '快速简批（并入基础档）' },
  report_unlock_a: { name: '解锁深度报告（第3-6章）', amount: 990, amountCny: 1990, desc: '感情+事业+财运+大运，共4章' },
  report_unlock_b: { name: '解锁完整报告（第7-10章）', amount: 499, amountCny: 3990, desc: '流年+健康+开运+大师寄语，共4章' },
  report_annual:   { name: '年度订阅·全报告无限查', amount: 1490, amountCny: 9900, desc: '全部报告+每季度更新+开运日历' },
  joss_basic:      { name: '代烧·基础套餐',     amount: 4990,   amountCny: 19900, desc: '标准纸钱+元宝+祈福' },
  joss_premium:    { name: '代烧·尊享套餐',     amount: 24900,  amountCny: 99900, desc: '豪邸+纸钱+法器+视频' },
  joss_supreme:    { name: '代烧·至尊套餐',     amount: 249900, amountCny: 999900, desc: '全套冥器+法事+直播' },
  // ── 按次问事 (EN 英文chat按次付费) ──
  single_question:   { name: 'Single Question',   amount: 290,  amountCny: 1990, desc: '1 question to the AI Destiny Advisor' },
  question_pack_3:   { name: '3-Question Pack',   amount: 690,  amountCny: 4900, desc: '3 questions to the AI Destiny Advisor' },
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
  // token 提取辅助（header > body > cookie）
  _tokenFromReq,
  // 数据访问对象
  insertUser, getUserByEmail, getUserById, getUserByRefCode,
  getUserPrivateById, updateUserFields, deleteUserTokens,
  getUserByGoogleSub, findOrCreateGoogleUser,
  insertToken, getToken,
  getUserOrders, insertOrder, insertReading, getReadingsByUser,
  // 付费墙
  UNLOCK_BY_CATEGORY, SUBSCRIBE_PRODUCTS, PERIODIC_PACK_DAYS, hasFullAccess, hasVipAccess, hehunTier, gateMessages,
  _isExpired,
  // 会员分级(0817)
  FULL_MEMBER_PRODUCTS, MONTHLY_MEMBER_PRODUCTS, MONTHLY_REPORT_CREDIT, MONTHLY_CHAT_DAILY_LIMIT,
  memberTier, gateReportAccess, hehunTierReadonly,
  monthlyReportCreditRemaining, consumeMonthlyReportCredit, refundMonthlyReportCredit,
  // 订单操作
  _updOrder, _updOrderExpiry, _setOrExtendSub,
  _findOrder, _insCnOrder, _completeCnOrder, _insSub, _allOrders, _insJossOrder, _grantPeriodicPackExpiry,
  // Referral
  CHANNELS, REWARD_TIERS, genRefCodesForUser,
  invitedCount, wasInvited, createReferral, grantReferralReward, grantInviteeReward, onInviteeFirstReading, tryApplyReferral,
  // Streak
  updateStreak,
  // 常量
  PRODUCTS,
  // QA 上下文
  qaContext, saveQaContext,
  // 按次问事 credit
  questionCreditsRemaining, grantQuestionCredits, consumeQuestionCredit,
};
