/*
 * 相生渠道归因（首触、无个人信息）。
 * URL 参数：source（渠道）、campaign（活动码）、club（社团码）、xref（推荐码）、campus（校区码）。
 * 只在带参数进来时写入 localStorage 的 xs_attr_v1，30 天有效；之后无参数访问、登录/注册跳转都不覆盖。
 * 注册（/api/auth/register 的 xs 字段）和首次建卡（attribution 字段）都从这里取，服务器再按白名单校验一遍。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XiangshengAttribution = api.browser(root);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var KEY = 'xs_attr_v1';
  var TTL = 30 * 864e5;
  var SOURCES = ['wechat', 'xhs', 'douyin', 'channels', 'direct', 'tiktok', 'campus', 'club', 'friend'];
  var CAMPAIGNS = ['none', 'launch_20261105', 'poster_a', 'poster_b', 'collection', 'celeb', 'video_a', 'video_b'];
  var CAMPUS_CAMPAIGN = /^campus\d{2}_[a-z0-9]{1,16}$/;
  var CODE = /^[a-z0-9][a-z0-9_]{1,23}$/;
  var REF = /^r[0-9a-f]{11}$/;
  function low(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }
  function normalize(input) {
    input = input && typeof input === 'object' ? input : {};
    var src = low(input.source) === '微信' || input.source === '微信' ? 'wechat' : low(input.source);
    var camp = low(input.campaign);
    return {
      source: SOURCES.indexOf(src) >= 0 ? src : 'direct',
      campaign: CAMPAIGNS.indexOf(camp) >= 0 || CAMPUS_CAMPAIGN.test(camp) ? camp : 'none',
      club: CODE.test(low(input.club)) ? low(input.club) : 'none',
      ref: REF.test(low(input.ref)) ? low(input.ref) : 'none',
      campus: CODE.test(low(input.campus)) ? low(input.campus) : 'none'
    };
  }
  /** 从查询串读参数；没有任何归因参数时返回 null（不能把“直接访问”写成首触）。 */
  function parse(search) {
    var q;
    try { q = new URLSearchParams(search || ''); } catch (e) { return null; }
    var raw = { source: q.get('source'), campaign: q.get('campaign'), club: q.get('club'), ref: q.get('xref'), campus: q.get('campus') };
    var any = Object.keys(raw).some(function (k) { return raw[k]; });
    if (!any) return null;
    var n = normalize(raw);
    var meaningful = n.source !== 'direct' || n.campaign !== 'none' || n.club !== 'none' || n.ref !== 'none' || n.campus !== 'none';
    return meaningful ? n : null;
  }
  /** 首触合并：已有未过期记录就保留；否则用新参数。 */
  function merge(stored, parsed, now) {
    var valid = stored && typeof stored === 'object' && typeof stored.at === 'number' && now - stored.at < TTL && now >= stored.at;
    if (valid) return { value: normalize(stored), at: stored.at, changed: false };
    if (parsed) return { value: parsed, at: now, changed: true };
    return { value: normalize({}), at: null, changed: !!stored };
  }
  function shareUrl(base, params) {
    var u = new URL(base);
    var n = normalize(params || {});
    ['source', 'campaign', 'club', 'campus'].forEach(function (k) { if (n[k] !== 'none' && !(k === 'source' && n[k] === 'direct')) u.searchParams.set(k, n[k]); });
    if (n.ref !== 'none') u.searchParams.set('xref', n.ref);
    return u.toString();
  }
  function browser(w) {
    var storage = null;
    try { storage = w.localStorage; } catch (e) {}
    function read() { try { return JSON.parse(storage.getItem(KEY) || 'null'); } catch (e) { return null; } }
    function write(v) { try { if (v) storage.setItem(KEY, JSON.stringify(v)); else storage.removeItem(KEY); } catch (e) {} }
    function capture() {
      var m = merge(read(), parse(w.location && w.location.search), Date.now());
      if (m.changed) write(m.at ? Object.assign({ at: m.at }, m.value) : null);
      return m.value;
    }
    var current = capture();
    var sid = null;
    function sessionId() {
      if (sid) return sid;
      try { sid = storage.getItem('xs_sid'); } catch (e) {}
      if (!sid) { sid = 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); try { storage.setItem('xs_sid', sid); } catch (e) {} }
      return sid;
    }
    /** 匿名浏览事件（只能是 landing/cta/share 三种，服务器会拒绝其它）。 */
    function beacon(e, extra) {
      var a = current;
      var body = JSON.stringify({ e: e, sid: sessionId(), p: 'friends-campus', src: a.source, camp: a.campaign, club: a.club, cp: a.campus, ref: a.ref, v: (extra && extra.v) || '' });
      try { if (w.navigator.sendBeacon && w.navigator.sendBeacon('/api/ev', new w.Blob([body], { type: 'text/plain' }))) return; } catch (err) {}
      try { w.fetch('/api/ev', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }).catch(function () {}); } catch (err) {}
    }
    return {
      current: function () { return Object.assign({}, current); },
      /** 只要首触里有任何非默认值，就算“相生渠道带来”，注册时随请求带上。 */
      forRegister: function () { return Object.assign({}, current); },
      shareUrl: shareUrl, normalize: normalize, beacon: beacon, KEY: KEY
    };
  }
  return { normalize: normalize, parse: parse, merge: merge, shareUrl: shareUrl, browser: browser, KEY: KEY, TTL: TTL };
});
