/**
 * assets/js/price.js — 0918 按所在地显示价格（中国=¥，其它=$）
 *
 * 用法：价格写成 <span data-rp="bazi_full">$11.99</span>（静态值=美元兜底，查不到地区时原样显示）。
 * 本脚本拉 /api/price-region（服务端判定，与结账实收同一口径、同一价目表），把所有 [data-rp] 换成当地币种；
 * 之后动态插进来的节点（报告页大多是 JS 拼出来的）也会被 MutationObserver 换掉。
 * 页面拼字符串时可用 RunaePrice.fmt('bazi_full', '$11.99')：已拿到地区直接给当地价，否则给兜底。
 * 不要用 geo-pricing.js（那套是旧的 GEO_PRICING 表，与实收目录不一致）。
 */
(function () {
  var data = null;
  var waiting = [];

  function apply(root) {
    if (!data || !root || !root.querySelectorAll) return;
    var els = root.matches && root.matches('[data-rp]') ? [root] : [];
    els = els.concat(Array.prototype.slice.call(root.querySelectorAll('[data-rp]')));
    els.forEach(function (el) {
      var v = data.prices[el.getAttribute('data-rp')];
      if (v && el.textContent !== v) el.textContent = v;
    });
  }

  window.RunaePrice = {
    fmt: function (product, fallback) { return (data && data.prices[product]) || fallback || ''; },
    region: function () { return data ? data.region : null; },
    ready: function (cb) { if (data) cb(data); else waiting.push(cb); },
    apply: function (root) { apply(root || document); },
  };

  fetch('/api/price-region', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.prices) return;
      data = d;
      document.documentElement.setAttribute('data-currency', d.currency);
      apply(document);
      if (window.MutationObserver) {
        new MutationObserver(function (muts) {
          muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) apply(n); }); });
        }).observe(document.body || document.documentElement, { childList: true, subtree: true });
      }
      waiting.splice(0).forEach(function (cb) { try { cb(d); } catch (e) {} });
    })
    .catch(function () { /* 拿不到就保留美元兜底；结账时服务端仍按所在地收 */ });
})();
