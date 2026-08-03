/**
 * ab-track.js — 善缘 A/B 测试前端追踪片段
 * 用法：在页面 <head> 底部引入，设置 window.SY_AB.variant 和 .product 后自动追踪。
 *
 * 自动行为：
 *  - 页面加载时发 view 事件
 *  - 滚动超 50% 时发 scroll_50（只发一次）
 *  - 含 data-ab-cta 属性的按钮点击时发 cta_click
 *
 * 手动调用：
 *  SY_AB.track('checkout_start')
 *  SY_AB.track('checkout_complete')
 */

(function() {
  'use strict';

  // ── 全局配置对象 ──────────────────────────────────────────
  window.SY_AB = window.SY_AB || {};
  window.SY_AB.variant = window.SY_AB.variant || null;   // e.g. 'cn-a'
  window.SY_AB.product = window.SY_AB.product || null;   // e.g. 'bazi_full'

  // ── Session ID（本 session 内唯一，跨页面追踪用）────────────
  var _sessionId = (function() {
    try {
      var k = 'sy_ab_sid';
      var existing = sessionStorage.getItem(k);
      if (existing) return existing;
      var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(k, id);
      return id;
    } catch (e) { return ''; }
  })();

  // ── 核心发送函数 ──────────────────────────────────────────
  function track(event) {
    var variant = window.SY_AB.variant;
    var product  = window.SY_AB.product;
    if (!variant || !product || !event) return;

    var payload = {
      variant:   variant,
      product:   product,
      event:     event,
      sessionId: _sessionId
    };

    // 优先用 sendBeacon（页面卸载时也能发出），降级用 fetch
    var url = '/api/ab-track';
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function() {});
      }
    } catch (e) {}
  }

  // 挂到全局
  window.SY_AB.track = track;

  // ── 自动：view 事件（DOM 就绪后发送）────────────────────────
  function _sendView() {
    track('view');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _sendView);
  } else {
    // 已就绪，延迟一帧确保 SY_AB.variant/product 已被页面内联脚本赋值
    setTimeout(_sendView, 0);
  }

  // ── 自动：scroll_50 事件（只发一次）─────────────────────────
  var _scroll50Sent = false;
  function _onScroll() {
    if (_scroll50Sent) return;
    var scrolled  = window.scrollY || window.pageYOffset || 0;
    var docHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight
    );
    var winHeight = window.innerHeight || document.documentElement.clientHeight;
    if (docHeight <= winHeight) return; // 页面不足一屏，跳过
    var pct = scrolled / (docHeight - winHeight);
    if (pct >= 0.5) {
      _scroll50Sent = true;
      track('scroll_50');
      window.removeEventListener('scroll', _onScroll, { passive: true });
    }
  }
  window.addEventListener('scroll', _onScroll, { passive: true });

  // ── 自动：CTA 按钮点击（data-ab-cta 属性）────────────────────
  document.addEventListener('click', function(e) {
    var el = e.target;
    // 向上最多找 3 层，支持按钮内有 span/icon 的情况
    for (var i = 0; i < 3; i++) {
      if (!el) break;
      if (el.hasAttribute && el.hasAttribute('data-ab-cta')) {
        track('cta_click');
        break;
      }
      el = el.parentElement;
    }
  }, true);

})();
