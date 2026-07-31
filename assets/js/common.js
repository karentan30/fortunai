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

  window.SY = { showToast: showToast, initTheme: initTheme, toggleTheme: toggleTheme,
                storePaidInput: storePaidInput, readPaidInput: readPaidInput, api: api };
})(window);
