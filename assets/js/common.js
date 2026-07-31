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

  window.SY = { showToast: showToast, initTheme: initTheme, toggleTheme: toggleTheme,
                storePaidInput: storePaidInput, readPaidInput: readPaidInput, api: api,
                copyText: copyText, getRefCode: getRefCode, withRef: withRef, captureRef: captureRef };
})(window);
