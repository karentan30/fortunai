/* 善缘 · 共享 JS v1.0（各页面可引用；提供统一工具函数）
 * 用法: <script src="/assets/js/common.js"></script>
 */
(function(window){
  'use strict';

  // ── Toast 提示（error/info）──
  function showToast(msg, type) {
    var t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'error' : 'info');
    t.textContent = msg;
    t.onclick = function(){ t.remove(); };
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function(){ t.remove(); }, 300); }, 3000);
  }

  // ── 主题切换（深/浅，存 localStorage sy_theme）──
  function initTheme() {
    var t = localStorage.getItem('sy_theme');
    if (t === 'dark') document.documentElement.classList.add('dark-mode');
  }
  function toggleTheme() {
    var el = document.documentElement;
    el.classList.toggle('dark-mode');
    localStorage.setItem('sy_theme', el.classList.contains('dark-mode') ? 'dark' : 'light');
  }

  // ── 支付回流工具（localStorage 存/读）──
  function storePaidInput(key, input) {
    try { localStorage.setItem(key, JSON.stringify(input)); } catch(e){}
  }
  function readPaidInput(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; }
  }

  // ── API 请求封装（自动带 token，JSON）──
  function api(path, body) {
    var token = localStorage.getItem('sy_token') || '';
    return fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); });
  }

  // ── 复制文本（现代 API + 降级）──
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function(){ return true; })
        .catch(function(){ return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed'; t.style.left = '-9999px'; t.style.top = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); document.body.removeChild(t); return true; }
    catch(e) { document.body.removeChild(t); return false; }
  }

  // ── 邀请码 ref 拼接 + 捕获（裂变可归因）──
  function getRefCode() {
    return localStorage.getItem('sy_ref_code') || '';
  }
  function withRef(url) {
    var ref = getRefCode();
    if (!ref) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
  }
  function captureRef() {
    try {
      var r = new URLSearchParams(location.search).get('ref');
      if (r) localStorage.setItem('sy_ref_code', r);
    } catch(e) {}
  }

  // ── 会员身份态(全站注入): 已登录会员 → 顶部金色徽章, 提示到期日 ──
  function initMembership() {
    if (!localStorage.getItem('sy_token')) return;
    fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sy_token') } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        // 缓存自己的邀请码(sy_my_ref_code), 供各分享页用于裂变归因
        if (d && d.user && d.user.ref_code) localStorage.setItem('sy_my_ref_code', d.user.ref_code);
        if (!d || !d.membership || !d.membership.isMember) return;
        var exp = d.membership.expiresAt ? new Date(d.membership.expiresAt) : null;
        // 按页面语言本地化(英文站/韩文站不能显示中文) —— pathname 或 <html lang> 判定
        var _p = location.pathname, _hl = (document.documentElement.lang || '').toLowerCase();
        var _lang = _hl.indexOf('ko') === 0 ? 'ko' : _hl.indexOf('en') === 0 ? 'en'
          : (/-KR\.html|saju|-ko\.html/i.test(_p) ? 'ko' : (/-en\.html/i.test(_p) ? 'en' : 'zh'));
        var _ymd = exp ? (exp.getFullYear() + '-' + (exp.getMonth()+1) + '-' + exp.getDate()) : '';
        var _T = {
          zh: { badge:'👑 会员已解锁', until:' · 至 ',    renew:function(n){ return '⚡ 会员还剩' + n + '天到期 · 续费享8折'; } },
          en: { badge:'👑 Member',     until:' · until ', renew:function(n){ return '⚡ Membership ends in ' + n + ' day' + (n>1?'s':'') + ' · Renew for 20% off'; } },
          ko: { badge:'👑 멤버십',      until:' · ~',      renew:function(n){ return '⚡ 멤버십 ' + n + '일 남음 · 갱신 20% 할인'; } }
        }[_lang];
        var expStr = exp ? (_T.until + _ymd) : '';
        var badge = document.createElement('div');
        badge.textContent = _T.badge + expStr;
        // top:52px → 落在顶部导航行(lang-toggle/Leaderboard 在 top:16)下方, 全站不再与右上角导航重叠
        badge.style.cssText = 'position:fixed;top:52px;right:14px;z-index:999;background:linear-gradient(135deg,#8a6420,#c9a84c);color:#fff;font-size:10px;padding:6px 12px;border-radius:20px;letter-spacing:.06em;box-shadow:0 2px 10px rgba(201,168,76,.4);font-family:inherit';
        document.body.appendChild(badge);
        // 到期前7天全站续费 banner
        var daysLeft = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
        if (daysLeft !== null && daysLeft <= 7 && daysLeft > 0) {
          var renewBanner = document.createElement('div');
          renewBanner.id = 'sy-renew-banner';
          renewBanner.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);z-index:998;background:linear-gradient(135deg,#8a6420,#c9a84c);color:#fff;font-size:12px;padding:8px 18px;border-radius:20px;letter-spacing:.04em;box-shadow:0 2px 12px rgba(201,168,76,.5);cursor:pointer;white-space:nowrap;max-width:90vw';
          renewBanner.textContent = _T.renew(daysLeft);
          renewBanner.onclick = function(){ window.location.href = '/pages/member.html'; };
          document.body.appendChild(renewBanner);
          setTimeout(function(){ renewBanner.style.display='none'; }, 10000);
        }
      }).catch(function(){});
  }

  window.SY = { showToast: showToast, initTheme: initTheme, toggleTheme: toggleTheme,
                storePaidInput: storePaidInput, readPaidInput: readPaidInput, api: api,
                copyText: copyText, getRefCode: getRefCode, withRef: withRef, captureRef: captureRef,
                initMembership: initMembership };
})(window);
