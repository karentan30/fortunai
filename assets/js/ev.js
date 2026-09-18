/**
 * ev.js — Runae 漏斗埋点（W2）
 * 自动：按页面发 landing_view / collect_view / pick_view / report_view / invite_open；
 *       报告页滚到 80% 发 free_done；付费墙进视野发 paywall_view；
 *       调下单接口时发 checkout_click（带 product）。
 * 手动：RunaeEv('collect_submit') / RunaeEv('method_pick', {m:'bazi'})
 * 匿名 sid 存 localStorage；utm/ref 首触归因存 localStorage，不收任何个人信息。
 */
(function (w, d) {
  'use strict';
  if (w.RunaeEv) return;
  var URL_EV = '/api/ev';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var sid = ls('runae_sid');
  if (!sid) { sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); ls('runae_sid', sid); }

  // 首触归因：只在第一次带 utm/ref 进来时写，之后不覆盖
  var attr = {};
  try { attr = JSON.parse(ls('runae_attr') || '{}') || {}; } catch (e) { attr = {}; }
  try {
    var q = new URLSearchParams(location.search);
    if (!attr.src && (q.get('utm_source') || q.get('ref') || q.get('i'))) {
      attr = { src: q.get('utm_source') || (q.get('i') ? 'invite' : 'ref'), camp: q.get('utm_campaign') || '', ref: q.get('ref') || (q.get('i') ? 'invite' : '') };
      ls('runae_attr', JSON.stringify(attr));
    }
  } catch (e) {}

  var page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'home';
  var lang = (function () {
    try { var l = new URLSearchParams(location.search).get('lang'); if (l) return l; } catch (e) {}
    return ls('runae_lang') || (d.documentElement.lang || '').slice(0, 2) || '';
  })();

  var sent = {};
  function send(e, extra) {
    extra = extra || {};
    var key = e + '|' + (extra.m || '');
    if (extra.once !== false && sent[key]) return;
    sent[key] = 1;
    var body = JSON.stringify({ e: e, m: extra.m || '', p: page, lang: lang, sid: sid, src: attr.src || '', camp: attr.camp || '', ref: attr.ref || '', v: extra.v || '' });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(URL_EV, new Blob([body], { type: 'text/plain' }))) return;
    } catch (err) {}
    try { fetch(URL_EV, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }).catch(function () {}); } catch (err) {}
  }
  w.RunaeEv = send;

  // ── 页面浏览 ──
  var method = page.indexOf('report-') === 0 ? page.slice(7) : '';
  if (page === 'home' || page === 'index' || page === 'home-en' || page === 'en' || page.indexOf('lp-') === 0) send('landing_view', { m: page });
  else if (page === 'collect') send('collect_view');
  else if (page === 'pick') send('pick_view');
  else if (page === 'match') send('invite_open');
  else if (method) send('report_view', { m: method });

  // ── 下单：拦截 fetch，识别下单接口 ──
  var PAY_RE = /\/api\/(create-checkout|pay\/stripe\/create|pay\/wechat|pay\/alipay)/;
  if (typeof w.fetch === 'function') {
    var of = w.fetch;
    w.fetch = function (input, init) {
      try {
        var u = typeof input === 'string' ? input : (input && input.url) || '';
        if (PAY_RE.test(u)) {
          var prod = '';
          try { prod = JSON.parse((init && init.body) || '{}').product || ''; } catch (e) {}
          send('checkout_click', { m: method || page, v: prod, once: false });
        }
      } catch (e) {}
      return of.apply(this, arguments);
    };
  }

  if (!method) return;

  // ── 读完免费部分 ──
  function onScroll() {
    var h = d.documentElement.scrollHeight - w.innerHeight;
    if (h > 200 && (w.scrollY || d.documentElement.scrollTop) / h >= 0.8) { send('free_done', { m: method }); w.removeEventListener('scroll', onScroll); }
  }
  w.addEventListener('scroll', onScroll, { passive: true });

  // ── 付费墙进入视野（付费墙多为异步渲染，轮询 30 秒挂观察器）──
  if (!('IntersectionObserver' in w)) return;
  var SEL = '#paywall-slot > *, .paywall-gate, #unlockBtn, [data-paywall]';
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { send('paywall_view', { m: method }); io.disconnect(); } });
  }, { threshold: 0.3 });
  var tries = 0, seen = [];
  var t = setInterval(function () {
    d.querySelectorAll(SEL).forEach(function (el) { if (seen.indexOf(el) < 0) { seen.push(el); io.observe(el); } });
    if (++tries > 30 || sent['paywall_view|' + method]) clearInterval(t);
  }, 1000);
})(window, document);
