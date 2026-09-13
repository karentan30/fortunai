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

  // ── 🔴 0913：未登录下单守卫 + 表单快照 ──
  // 服务端已拒掉「没账号就下单」（报告类商品发单只认 user_id，匿名订单＝收了钱没人能被解锁）。
  // 40 个页面各自处理 401 不现实，所以在共享层包一层 fetch：
  //   · 只关心下单类请求(/api/create-checkout、/api/pay/*)；
  //   · 只读 res.clone()，原 response 原样返回，页面原有逻辑不受影响；
  //   · 回 401 login_required 时，先快照当前表单，再带用户去登录页，登录完回本页并把表单填回去
  //     （不然用户填了八个字段、点付款、被弹去登录、回来一片空白，只能重填）。
  var _SY_PAY_RE = /^\/api\/(create-checkout|pay\/)/;
  var _SNAP_KEY = 'sy_form_snapshot';
  var _FIELDS = 'input,select,textarea';

  function _fieldKey(el, i) {
    // 勾选类控件必须按「位置」给 key：同名 radio/checkbox 群（name="concern" 这种）
    // 每个控件的 id/name 都一样，只记录「用户勾了哪一个」是表达不出来的 ——
    // 回填时会把每个同 key 的控件都勾上（radio 组变成勾最后一个、checkbox 组全选）。
    // 按位置 + 总数校验(indexOk)兜底，页面控件数一变就不填，宁可不填也不填错。
    if (el.type === 'checkbox' || el.type === 'radio') return el.tagName + '#cb' + i;
    if (el.id) return '#' + el.id;
    if (el.name) return '[name="' + el.name + '"]';
    var cls = (el.className || '').split(/\s+/).filter(Boolean)[0];
    return el.tagName + (cls ? '.' + cls : '') + '|' + el.getAttribute('data-idx') + '|' + i;
  }
  function _stableKey(k) { return k.charAt(0) === '#' || k.charAt(0) === '['; }
  function snapshotForm() {
    try {
      var out = [];
      var all = document.querySelectorAll(_FIELDS);
      Array.prototype.forEach.call(all, function(el, i) {
        if (el.type === 'password' || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) out.push([_fieldKey(el, i), 1]);
          return;
        }
        if (el.value) out.push([_fieldKey(el, i), String(el.value)]);
      });
      sessionStorage.setItem(_SNAP_KEY, JSON.stringify({ url: location.pathname, total: all.length, fields: out }));
    } catch (e) {}
  }
  function restoreForm() {
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem(_SNAP_KEY) || 'null'); } catch (e) { return false; }
    if (!raw || raw.url !== location.pathname || !raw.fields || !raw.fields.length) return false;
    // 字段总数变了(页面脚本动态加/删了控件)就不许按位置回填 —— 位置已经对不上，
    // 硬填会把「城市」写进「年份」这种离谱的地方。这时候只回填有 id/name 的字段。
    var indexOk = (document.querySelectorAll(_FIELDS).length === raw.total);
    var hit = 0;
    Array.prototype.forEach.call(document.querySelectorAll(_FIELDS), function(el, i) {
      var k = _fieldKey(el, i);
      if (!_stableKey(k) && !indexOk) return;
      for (var n = 0; n < raw.fields.length; n++) {
        if (raw.fields[n][0] !== k) continue;
        var v = raw.fields[n][1];
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = true;
          var lab = el.closest ? el.closest('label') : null;
          if (lab && lab.classList) lab.classList.add('checked');
        } else { el.value = v; }
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        hit++;
        return;
      }
    });
    try { sessionStorage.removeItem(_SNAP_KEY); } catch (e) {}
    if (hit) { try { showToast('已为你保留刚才填写的内容，继续支付即可'); } catch (e) {} }
    return hit > 0;
  }
  function _goLogin() {
    if (window.__syPayRedirecting) return;
    window.__syPayRedirecting = true;
    snapshotForm();
    var back = location.pathname + location.search;
    setTimeout(function() {
      location.href = '/pages/login.html?redirect=' + encodeURIComponent(back);
    }, 300);
  }
  // 下单请求判定：既要认相对路径('/api/pay/...')，也要认同源的绝对地址
  // （本机开发时页面写的是 http://localhost:3021/api/...，new Request() 也只会给绝对 url）
  function _isPayUrl(url) {
    try {
      var u = new URL(url, location.origin);
      if (u.origin !== location.origin) return false;
      return _SY_PAY_RE.test(u.pathname);
    } catch (e) { return _SY_PAY_RE.test(String(url).split('?')[0]); }
  }
  function installPaidLoginGuard() {
    if (window.__syPaidGuard || typeof window.fetch !== 'function') return;
    window.__syPaidGuard = true;
    var origFetch = window.fetch;
    window.fetch = function(input) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = origFetch.apply(this, arguments);
      if (!_isPayUrl(url)) return p;
      return p.then(function(res) {
        if (res && res.status === 401) {
          try {
            res.clone().json().then(function(d) {
              if (d && d.error === 'login_required') {
                try { showToast(d.message || '请先登录再购买'); } catch (e) {}
                _goLogin();
              }
            }).catch(function() {});
          } catch (e) {}
        }
        return res;
      });
    };
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
    // 🔴 别用 localStorage 有没有 token 来判「登录了没」：登录只下发 httpOnly cookie，
    //    localStorage.sy_token 永远是空的 —— 上面那行早退会让真会员一个徽章都看不到。
    //    直接问服务端（同源 fetch 自动带 cookie）。
    fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sy_token') || '') } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.user) localStorage.setItem('sy_logged_in', '1');
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

  // 装上守卫（幂等）；回到本页时把登录前填的表单填回去
  try { installPaidLoginGuard(); } catch (e) {}
  function _bootRestore() {
    if (restoreForm()) return;
    // 有些页面的下拉/日期选项是页面脚本在 load 之后才填的：那一刻回填会落空，
    // 所以稍后再试一次（快照只有回填成功才删，失败可以安全重试）。
    setTimeout(function() { restoreForm(); }, 600);
  }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _bootRestore);
    else _bootRestore();
  } catch (e) {}

  window.SY = { showToast: showToast, initTheme: initTheme, toggleTheme: toggleTheme,
                storePaidInput: storePaidInput, readPaidInput: readPaidInput, api: api,
                copyText: copyText, getRefCode: getRefCode, withRef: withRef, captureRef: captureRef,
                initMembership: initMembership, snapshotForm: snapshotForm, restoreForm: restoreForm };
})(window);
