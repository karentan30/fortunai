/* 相生单校区试点落地页：读取 /assets/data/friends-campus.json 渲染，校名未确认时只显示占位。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.document) api.mount(root);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /** 校名展示：未确认或没填时不出现任何具体学校名。 */
  function campusLabel(config) {
    var c = (config && config.campus) || {};
    var name = [c.schoolName, c.campusName].filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim(); }).join(' · ');
    if (c.confirmed === true && name) return { confirmed: true, text: name };
    return { confirmed: false, text: c.placeholderLabel || '待确定' };
  }
  /** 入口链接：保留首触归因；首触里没有校区/活动码时补上本页配置的码。 */
  function entryParams(config, attribution) {
    var a = Object.assign({}, attribution || {});
    if (!a.campus || a.campus === 'none') a.campus = config && config.campus && config.campus.code;
    if (!a.campaign || a.campaign === 'none') a.campaign = config && config.campaign;
    return a;
  }
  function shareParams(config, mode, opts) {
    opts = opts || {};
    var p = { campus: config.campus && config.campus.code, campaign: config.campaign };
    if (mode === 'club') { p.source = 'club'; p.club = opts.club; }
    else { p.source = 'friend'; if (opts.ref) p.ref = opts.ref; }
    return p;
  }
  function mount(w) {
    var d = w.document, A = w.XiangshengAttribution;
    var $ = function (s) { return d.querySelector(s); };
    var toastTimer;
    function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600); }
    function el(tag, cls, text) { var x = d.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; }
    var config = null, referral = null;
    if (A) A.beacon('xs_landing_view');
    function render() {
      var label = campusLabel(config);
      var school = $('#campus-school');
      school.textContent = label.confirmed ? '本轮试点：' + label.text + '（学校信息由用户自填，非学校官方活动）' : '试点校区：' + label.text + '。确定后公布，本页不是任何学校的官方活动。';
      d.querySelectorAll('[data-campus-label]').forEach(function (x) { x.textContent = label.confirmed ? label.text + '附近' : '附近'; });
      var entry = new URL(config.entryPath || '/pages/friends-connect.html#start', w.location.origin).toString();
      var href = A ? A.shareUrl(entry, entryParams(config, A.current())) : entry;
      d.querySelectorAll('[data-entry-link]').forEach(function (a) { a.href = href; });
      var box = $('#campus-scenes'); box.textContent = '';
      (config.scenes || []).forEach(function (s) {
        var card = el('article', 'campus-scene');
        card.appendChild(el('h3', '', s.title));
        card.appendChild(el('p', '', s.line));
        if (s.opener) card.appendChild(el('p', 'campus-opener', '开场可以问：' + s.opener));
        box.appendChild(card);
      });
      var select = $('#club-select'); select.textContent = '';
      (config.clubs || []).forEach(function (c) { if (!c || !c.code) return; var o = el('option', '', c.label || c.code); o.value = c.code; select.appendChild(o); });
      updateMode();
    }
    function mode() { var x = d.querySelector('input[name=share-mode]:checked'); return x ? x.value : 'friend'; }
    function updateMode() {
      var m = mode(), note = $('#share-note'), clubs = (config && config.clubs) || [];
      $('#club-picker').hidden = m !== 'club' || !clubs.length;
      $('#share-generate').disabled = m === 'club' && !clubs.length;
      if (m === 'club') note.textContent = clubs.length ? '社团码由运营登记，链接只带社团码。' : '还没有登记社团码：需要社团负责人同意后由运营写进配置，暂时不能生成社团链接。';
      else note.textContent = referral ? '链接会带上你的推荐码（服务器生成，不含你的个人信息）。' : '未登录时生成不带推荐码的朋友链接；登录后可带上你的推荐码。';
    }
    function drawQr(url) {
      var canvas = $('#share-qr'), ctx = canvas.getContext('2d');
      if (typeof w.qrcode !== 'function') { toast('二维码组件没加载，可以先复制链接'); return false; }
      var qr = w.qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), cell = Math.max(2, Math.floor(canvas.width / (n + 8))), size = cell * (n + 8), off = Math.floor((canvas.width - size) / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#172b20';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + (c + 4) * cell, off + (r + 4) * cell, cell, cell);
      try { $('#share-download').href = canvas.toDataURL('image/png'); } catch (e) {}
      return true;
    }
    function generate() {
      var m = mode();
      var url = A.shareUrl(new URL('/pages/friends-campus.html', w.location.origin).toString(), shareParams(config, m, { club: $('#club-select').value, ref: referral }));
      $('#share-link').value = url; $('#share-result').hidden = false; drawQr(url);
      A.beacon('xs_share_create', { v: m });
    }
    d.querySelectorAll('input[name=share-mode]').forEach(function (x) { x.addEventListener('change', updateMode); });
    $('#share-generate').addEventListener('click', function () { if (config && A) generate(); });
    $('#share-copy').addEventListener('click', function () {
      var v = $('#share-link').value;
      var done = function () { toast('链接已复制'); }, fail = function () { $('#share-link').select(); toast('请长按链接手动复制'); };
      try { w.navigator.clipboard.writeText(v).then(done, fail); } catch (e) { fail(); }
    });
    d.querySelectorAll('[data-cta]').forEach(function (a) { a.addEventListener('click', function () { if (A) A.beacon('xs_cta_click'); }); });
    w.fetch('/api/friends/referral', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && /^r[0-9a-f]{11}$/.test(j.code || '')) { referral = j.code; if (config) updateMode(); } }).catch(function () {});
    w.fetch('/assets/data/friends-campus.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw Error('config'); return r.json(); }).then(function (c) { config = c; render(); })
      .catch(function () { $('#campus-school').textContent = '试点配置暂时读取失败，请稍后刷新。'; $('#share-generate').disabled = true; });
  }
  return { campusLabel: campusLabel, entryParams: entryParams, shareParams: shareParams, mount: mount };
});
