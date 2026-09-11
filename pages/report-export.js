/* ═══════════════════════════════════════════════════════════
   Runae · 报告等级 + 导出 PDF（共享组件，零依赖）
   用法：在任一报告页 </body> 前加一行
       <script src="report-export.js" defer></script>
   可选（页面自知更多信息时注册，缺省自动推断）：
       window.RunaeReportMeta = { title:'八字命盘', method:'bazi', chapters:9, unlocked:true };
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__runaeExportLoaded) return;
  window.__runaeExportLoaded = true;

  var LANG = (new URLSearchParams(location.search).get('lang')) ||
             localStorage.getItem('runae_lang') || 'zh';
  var EN = LANG === 'en';

  var T = EN ? {
    gradeTitle: 'Report Grade',
    lv3: 'Excellent', lv2: 'Good', lv1: 'Standard',
    basis: 'Graded on birth-data completeness and unlocked sections.',
    why3: 'Your birth data is complete and the full report is unlocked.',
    why2: 'Add your birth hour or unlock the full report to reach Excellent.',
    why1: 'Add birth hour, birth place and unlock the full report to reach Excellent.',
    export: 'Export PDF',
    exportHint: 'Choose “Save as PDF” in the print dialog.',
    exporting: 'Preparing…',
    close: 'Close',
    foot: 'Runae · A reading generated from your birth data',
    page: 'Page',
    need3: 'Complete data + full report',
    need2: 'Birth hour or full report missing',
    need1: 'Birth hour, birth place and full report missing',
    toast: 'Tip: choose “Save as PDF” as the destination.',
    printFail: 'Your browser blocked the print window. Please allow pop-ups and try again.'
  } : {
    gradeTitle: '报告等级',
    lv3: '优秀', lv2: '良好', lv1: '标准',
    basis: '依据出生资料完整度与已解锁章节评定。',
    why3: '你的出生资料完整，且完整报告已解锁。',
    why2: '补上出生时辰、或解锁完整报告，即可升到「优秀」。',
    why1: '补上出生时辰、出生地并解锁完整报告，即可升到「优秀」。',
    export: '导出 PDF',
    exportHint: '在打印窗口里选「另存为 PDF」。',
    exporting: '正在准备…',
    close: '关闭',
    foot: 'Runae · 依据你的出生资料生成的命理推演',
    page: '第',
    need3: '资料完整 + 完整报告',
    need2: '缺出生时辰 或 未解锁完整报告',
    need1: '缺出生时辰、出生地，且未解锁完整报告',
    toast: '提示：目标打印机选「另存为 PDF」。',
    printFail: '浏览器拦截了打印窗口，请允许弹出窗口后重试。'
  };

  function profile() {
    try { return JSON.parse(localStorage.getItem('runae_profile') || '{}') || {}; }
    catch (e) { return {}; }
  }

  /* ── 等级计算：只看真实的资料完整度与解锁状态，不编造 ── */
  function computeGrade() {
    var p = profile(), m = window.RunaeReportMeta || {};
    var score = 40;                                  // 报告已生成即达基线

    var bdate = p.bdate || m.bdate || '';
    var btime = p.btime || m.btime || '';
    var bplace = p.bplace || p.bcity || p.city || m.bplace || '';

    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(bdate))) score += 5;
    if (btime && /\d/.test(String(btime))) score += 25;   // 时辰=八字精度关键
    if (bplace && String(bplace).trim()) score += 10;

    var unlocked = (typeof m.unlocked === 'boolean') ? m.unlocked : !document.querySelector('[data-locked], .paywall, #paywall');
    if (unlocked) score += 15;

    var chapters = m.chapters;
    if (chapters == null) {
      var secs = document.querySelectorAll('#body .sec, #body section, #body .chapter');
      chapters = secs.length;
    }
    if (chapters >= 6) score += 10;
    else if (chapters >= 3) score += 5;

    var level = score >= 85 ? 3 : (score >= 70 ? 2 : 1);
    return { score: Math.min(score, 100), level: level, chapters: chapters, btime: !!btime, bplace: !!bplace };
  }

  /* ── 报告标题 ── */
  function reportTitle() {
    var m = window.RunaeReportMeta || {};
    if (m.title) return m.title;
    var h = document.querySelector('#hero h2');
    if (h && h.textContent.trim()) return h.textContent.trim().replace(/\s+/g, ' ');
    var t = (document.title || '').split('·').pop().trim();
    return t || (EN ? 'Your Reading' : '你的报告');
  }

  /* 屏幕态：打印专用节点常驻 DOM 但不显示（print 时才展开）。
     常驻而非「导出时临时创建」是为了避开 Chrome 的 afterprint 竞态
     —— 部分版本 print() 返回即触发 afterprint，临时节点会被提前清掉，
     导致 PDF 里缺等级卡/页眉页脚。 */
  var SCREEN_CSS = '#rxHead,#rxFoot,#rxGradeCard{display:none !important}';

  /* ═══ 打印样式：深色 → 纸白，A4，避免卡片被切断 ═══ */
  var PRINT_CSS = [
    '@media print {',
    '  @page { size: A4; margin: 14mm 13mm 20mm; }',
    '  html { color-scheme: light !important; background: #fff !important; }',
    '  :root {',
    '    --paper:#ffffff !important; --card:#ffffff !important; --card-2:#fbfaf7 !important;',
    '    --ink:#141414 !important; --ink-2:#3d3d3d !important; --ink-3:#6b6b6b !important;',
    '    --gold:#8a6d2f !important; --gold-soft:#8a6d2f !important; --gold-wash:#f4efe2 !important;',
    '    --jade:#166b56 !important; --jade-deep:#eaf5f1 !important; --jade-soft:#166b56 !important; --jade-wash:#eaf5f1 !important;',
    '    --line:#dcdcdc !important; --line-2:#c9c9c9 !important;',
    '    --wood:#2f7d3f !important; --fire:#b5473a !important; --earth:#8a6d2f !important;',
    '    --metal:#6b6b6b !important; --water:#2b6b9b !important;',
    '  }',
    '  body { background:#fff !important; color:#141414 !important; font-size:11.5pt !important; line-height:1.62 !important; }',
    '  .wrap { max-width:100% !important; padding:0 !important; }',
    /* 屏幕上的交互件一律不进 PDF */
    '  .nav-back, .bar, .step, .cta, button, .btn, .no-print, #rxBar, #rxToast,',
    '  .rx-actions, .skip, .back-top, [data-noprint] { display:none !important; }',
    /* 卡片：白底 + 细边，避免跨页断 */
    '  .alert, .card, .chart, .read, .sec, .cross, .ti, .box, .pane, .kv, .row,',
    '  .item, .blk, .acc, .tl-item, .result, .panel, .cons, section {',
    '    background:#fff !important; box-shadow:none !important; border-color:#dcdcdc !important;',
    '    break-inside:avoid; page-break-inside:avoid;',
    '  }',
    '  .alert { border:1px solid #166b56 !important; background:#f4faf8 !important; padding:12pt 13pt !important; }',
    '  .read, .acc, .cons { border:1px solid #e2e2e2 !important; padding:10pt 12pt !important; border-radius:8pt !important; }',
    '  h1,h2,h3,h4,.rhero h2,.sec { page-break-after:avoid; break-after:avoid; }',
    '  .rhero { padding:0 0 10pt !important; border-bottom:1px solid #dcdcdc; margin-bottom:12pt; }',
    '  .rhero h2 { font-size:20pt !important; }',
    '  .sec { font-size:9pt !important; letter-spacing:.14em !important; color:#6b6b6b !important; margin:16pt 0 7pt !important; border-bottom:1px solid #ececec; padding-bottom:3pt; }',
    '  .alert .t, .alert p b, em, strong { color:#166b56 !important; }',
    '  a { color:#141414 !important; text-decoration:none !important; }',
    '  img, svg { max-width:100% !important; }',
    /* SVG 里写死的近白色（深色主题专用）必须翻成深色，否则白纸上消失 */
    '  svg [fill="#f0ebe0"], svg [fill="#F3ECDD"], svg [fill="#f0e6c8"], svg [fill="#F3E4E8"],',
    '  svg [fill="#cfcabb"], svg [fill="#ffffff"], svg [fill="white"] { fill:#141414 !important; }',
    '  svg [fill^="rgba(240,235,224"], svg [fill="#f2e4b8"], svg [fill="#e8d49c"],',
    '  svg [fill="#DFC488"], svg [fill="#E8C87E"], svg [fill="#dcc082"] { fill:#8a6d2f !important; }',
    '  svg [fill="#4fbfa0"], svg [fill="#7DDFC0"], svg [fill="#7ddfc0"] { fill:#166b56 !important; }',
    '  svg [stroke^="rgba(240,235,224"], svg [stroke="#f0ebe0"], svg [stroke="#F3ECDD"] { stroke:#bbbbbb !important; }',
    '  svg [stroke="#0f1b17"], svg [stroke="#0b1512"], svg [stroke="#060e0d"] { stroke:#ffffff !important; }',
    '  .elem-bar i, .bar-fill, [class*="fill-"] { background:#8a6d2f !important; }',
    /* 页脚走文档流（不放 position:fixed —— 各浏览器打印时 fixed 的落点不一致，
       实测 headless 与打印预览表现不同。流内元素 100% 可预期）*/
    '  #rxFoot { display:block !important; margin-top:16pt; padding-top:6pt;',
    '            border-top:1px solid #e6e6e6; font-size:8pt; color:#8a8a8a;',
    '            letter-spacing:.04em; break-inside:avoid; }',
    '  #rxGradeCard { display:block !important; border:1px solid #8a6d2f !important; background:#fdfbf5 !important;',
    '                 padding:9pt 12pt !important; border-radius:8pt !important; margin:0 0 12pt !important; break-inside:avoid; }',
    '}'
  ].join('\n');

  /* ═══ 打印专用节点（页眉 / 页脚 / 等级卡） ═══ */
  function buildPrintNodes(g) {
    var title = reportTitle();

    var foot = document.createElement('div');
    foot.id = 'rxFoot';
    foot.innerHTML = '<div>' + esc(T.foot) + '</div>' +
      '<div style="margin-top:2pt">' + esc(title) + ' · ' + esc(T.gradeTitle) +
      ' ' + esc(g.level === 3 ? T.lv3 : (g.level === 2 ? T.lv2 : T.lv1)) +
      ' · ' + new Date().toLocaleDateString(EN ? 'en-US' : 'zh-CN') + ' · runae.app</div>';

    var lv = g.level === 3 ? T.lv3 : (g.level === 2 ? T.lv2 : T.lv1);
    var card = document.createElement('div');
    card.id = 'rxGradeCard';
    card.innerHTML =
      '<div style="font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#8a6d2f;font-weight:600">' +
        esc(T.gradeTitle) + '</div>' +
      '<div style="font-family:var(--serif),Georgia,serif;font-size:16pt;color:#141414;margin-top:2pt">' +
        esc(lv) + '<span style="font-size:8.5pt;color:#6b6b6b;font-family:inherit"> · ' + g.score + '/100</span></div>' +
      '<div style="font-size:9pt;color:#3d3d3d;margin-top:3pt;font-weight:600">' + esc(title) + '</div>' +
      '<div style="font-size:8.5pt;color:#6b6b6b;margin-top:2pt">' + esc(T.basis) + '</div>';

    var body = document.getElementById('body') || document.querySelector('.wrap');
    // 等级卡放正文最前（PDF 首页可见），页脚放最后。都常驻 DOM，屏幕态 display:none
    if (body && body.parentNode) body.parentNode.insertBefore(card, body);
    else document.body.appendChild(card);
    var wrap = document.querySelector('.wrap') || document.body;
    wrap.appendChild(foot);
    return card;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════════════════
     深色 → 纸白 颜色映射
     页面大量颜色是写死的 rgba(240,235,224,.72) 这种，不是 CSS 变量，
     光靠 @media print 重定义 :root 覆盖不到 —— 打出来白纸上一片浅灰看不清。
     这里在打印前按元素把「深色主题色」逐条映射成纸白主题色：
       · 前景（color/fill/stroke）：亮度 > 0.5（浅色字）→ 映射成深色
       · 背景：亮度 < 0.5（深色底）→ 映射成白/极浅
       · 边框：跟随前景，但 alpha 抬到在白底上看得见
     色相保持不变（金还是金、玉还是玉），只翻亮度。
     映射表覆盖品牌调色板；表外的颜色走 HSL 亮度反转兜底。
     ══════════════════════════════════════════════════════════ */
  var PALETTE = [
    { from: [240, 235, 224], to: [26, 24, 22] },    // ink 米白
    { from: [255, 255, 255], to: [20, 20, 20] },
    { from: [220, 192, 130], to: [138, 109, 47] },  // gold
    { from: [232, 212, 156], to: [138, 109, 47] },
    { from: [240, 230, 200], to: [138, 109, 47] },
    { from: [243, 228, 232], to: [138, 109, 47] },
    { from: [79, 191, 160], to: [22, 107, 86] },    // jade
    { from: [125, 223, 192], to: [22, 107, 86] },
    { from: [125, 207, 143], to: [47, 125, 63] },   // wood
    { from: [224, 122, 106], to: [181, 71, 58] },   // fire
    { from: [216, 181, 106], to: [138, 109, 47] },  // earth
    { from: [207, 202, 187], to: [107, 107, 107] }, // metal
    { from: [106, 168, 216], to: [43, 107, 155] }   // water
  ];
  // 深色底 → 纸白/极浅底
  var BG_PALETTE = [
    { from: [6, 14, 13], to: [255, 255, 255] },
    { from: [11, 21, 18], to: [255, 255, 255] },
    { from: [15, 27, 23], to: [255, 255, 255] },
    { from: [14, 43, 36], to: [234, 245, 241] }
  ];

  function parseColor(s) {
    if (!s) return null;
    var m = String(s).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.%]+))?\s*\)/i);
    if (!m) return null;
    var a = m[4] == null ? 1 : (String(m[4]).indexOf('%') >= 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: isNaN(a) ? 1 : a };
  }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  function near(c, p, tol) {
    tol = tol || 26;
    return Math.abs(c.r - p[0]) <= tol && Math.abs(c.g - p[1]) <= tol && Math.abs(c.b - p[2]) <= tol;
  }
  function hslInvert(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    var nl = 1 - l;                       // 保色相，只翻亮度
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q2 = nl < .5 ? nl * (1 + s) : nl + s - nl * s, p2 = 2 * nl - q2;
    return {
      r: Math.round((s ? hue2rgb(p2, q2, h + 1 / 3) : nl) * 255),
      g: Math.round((s ? hue2rgb(p2, q2, h) : nl) * 255),
      b: Math.round((s ? hue2rgb(p2, q2, h - 1 / 3) : nl) * 255),
      a: c.a
    };
  }
  function mapFg(c) {
    if (c.a < .03) return null;
    for (var i = 0; i < PALETTE.length; i++) if (near(c, PALETTE[i].from)) {
      var t = PALETTE[i].to; return { r: t[0], g: t[1], b: t[2], a: Math.max(c.a, .55) };
    }
    if (lum(c) > .5) { var x = hslInvert(c); x.a = Math.max(x.a, .78); return x; }
    return null;                       // 本来就是深色 → 白底上照样看得见，不动
  }
  function mapBg(c) {
    if (c.a < .03) return null;
    for (var i = 0; i < BG_PALETTE.length; i++) if (near(c, BG_PALETTE[i].from)) {
      var t = BG_PALETTE[i].to;
      return { r: t[0], g: t[1], b: t[2], a: t[0] === 255 && t[1] === 255 && t[2] === 255 ? Math.max(c.a, .96) : 1 };
    }
    if (lum(c) < .5) { var x = hslInvert(c); x.a = 1; return x; }
    return null;                       // 已经是浅底 → 不动
  }
  function mapBorder(c) {
    if (c.a < .03) return null;
    if (lum(c) > .5 || near(c, PALETTE[0].from)) return { r: 20, g: 20, b: 20, a: Math.min(.32, Math.max(.1, c.a * 2.2)) };
    return null;
  }
  function css(c) {
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (Math.round(c.a * 1000) / 1000) + ')';
  }
  function same(a, b) {
    return a && b && Math.abs(a.r - b.r) < 3 && Math.abs(a.g - b.g) < 3 && Math.abs(a.b - b.b) < 3 && Math.abs(a.a - b.a) < .03;
  }

  var TOUCHED = [];   // [{el, prop}]，打印后逐条还原
  var PRINTING = false;

  function applyEl(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    var props = [
      ['color', mapFg],
      ['backgroundColor', mapBg],
      ['borderTopColor', mapBorder], ['borderRightColor', mapBorder],
      ['borderBottomColor', mapBorder], ['borderLeftColor', mapBorder]
    ];
    props.forEach(function (pair) {
      var prop = pair[0], fn = pair[1], raw = cs[prop], cur = parseColor(raw);
      if (!cur) return;
      var next = fn(cur);
      if (!next || same(cur, next)) return;
      TOUCHED.push({ el: el, prop: prop, val: el.style[prop] });
      try { el.style[prop] = css(next); } catch (e) { }
    });
    // SVG：fill / stroke / stop-color 都是元素属性或计算值
    if (el.tagName && (el.tagName.toLowerCase() === 'svg' || el.ownerSVGElement)) {
      var tag = el.tagName.toLowerCase();
      var isText = (tag === 'text' || tag === 'tspan');
      ['fill', 'stroke'].forEach(function (prop) {
        var raw = cs[prop];
        if (!raw || raw === 'none' || String(raw).indexOf('url') === 0) return;
        var cur = parseColor(raw); if (!cur) return;
        // 文字/描边是前景；图形填充多数是「底色」（命盘那个深色块），先按底色映射，
        // 否则深色填充会在白纸上留下黑块并把上面的字吞掉
        var next = isText ? mapFg(cur) : (prop === 'fill' ? (mapBg(cur) || mapFg(cur)) : mapFg(cur));
        if (!next || same(cur, next)) return;
        TOUCHED.push({ el: el, prop: prop, val: el.style[prop] });
        try { el.style[prop] = css(next); } catch (e) { }
      });
    }
    if (el.tagName && el.tagName.toLowerCase() === 'stop') {
      var raw = el.getAttribute('stop-color'); var cur = parseColor(raw);
      if (cur) {
        var next = mapBg(cur) || mapFg(cur);
        if (next) {
          TOUCHED.push({ el: el, prop: 'stop-color', val: el.style.stopColor });
          try { el.style.stopColor = css(next); } catch (e) { }
        }
      }
    }
  }

  function applyPrintTheme() {
    if (PRINTING) return;
    PRINTING = true;
    TOUCHED = [];
    var root = document.querySelector('.wrap') || document.body;
    applyEl(document.documentElement);
    applyEl(document.body);
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i], tag = (el.tagName || '').toLowerCase();
      if (tag === 'img' || tag === 'video' || tag === 'canvas') continue;
      if (el.id === 'rxFoot' || el.id === 'rxGradeCard') continue;
      if (el.closest && el.closest('#rxFoot,#rxGradeCard')) continue;
      applyEl(el);
    }
  }
  function restorePrintTheme() {
    if (!PRINTING) return;
    PRINTING = false;
    TOUCHED.forEach(function (t) {
      try {
        if (t.prop === 'stop-color') t.el.style.stopColor = t.val || '';
        else t.el.style[t.prop] = t.val || '';
      } catch (e) { }
    });
    TOUCHED = [];
  }

  window.__rxApplyPrintTheme = applyPrintTheme;      // 供自动化验证
  window.__rxRestorePrintTheme = restorePrintTheme;
  window.addEventListener('beforeprint', applyPrintTheme);
  window.addEventListener('afterprint', restorePrintTheme);
  try {
    var mq = window.matchMedia('print');
    var onMq = function (e) { if (e.matches) applyPrintTheme(); else restorePrintTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (e) { }

  /* ═══ 屏幕上的等级徽章 ═══ */
  function renderBadge(g) {
    var host = document.getElementById('hero') || document.querySelector('.rhero') ||
               document.querySelector('.wrap');
    if (!host) return;
    var lv = g.level === 3 ? T.lv3 : (g.level === 2 ? T.lv2 : T.lv1);
    var el = document.createElement('div');
    el.id = 'rxBadge';
    el.className = 'no-print';
    el.style.cssText = 'display:flex;align-items:center;gap:7px;justify-content:center;' +
      'margin:10px auto 0;font-size:11.5px;letter-spacing:.04em';
    el.innerHTML =
      '<span style="color:var(--ink-3)">' + esc(T.gradeTitle) + '</span>' +
      '<span style="color:' + (g.level === 3 ? 'var(--gold)' : 'var(--ink-2)') + ';font-weight:700">' + esc(lv) + '</span>' +
      '<span title="' + esc(T.basis + ' ' + (g.level === 3 ? T.why3 : (g.level === 2 ? T.why2 : T.why1))) +
        '" style="width:14px;height:14px;border-radius:50%;border:1px solid var(--line-2);' +
        'color:var(--ink-3);font-size:9px;display:inline-flex;align-items:center;justify-content:center;' +
        'cursor:help;flex-shrink:0">i</span>';
    if (host.id === 'hero' && !host.innerHTML.trim()) {
      // hero 由页面异步渲染，先挂到 wrap 顶部，稍后由 observer 挪进 hero
      var wrap = document.querySelector('.wrap');
      if (wrap) { wrap.insertBefore(el, wrap.children[1] || null); return; }
    }
    host.appendChild(el);
  }

  /* ═══ 底部操作条 ═══ */
  function renderBar() {
    var bar = document.createElement('div');
    bar.id = 'rxBar';
    bar.className = 'no-print';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:60;' +
      'padding:10px 22px calc(10px + env(safe-area-inset-bottom));' +
      'background:linear-gradient(180deg,rgba(6,14,13,0),rgba(6,14,13,.92) 38%);' +
      'display:flex;justify-content:center;pointer-events:none';
    var inner = document.createElement('div');
    inner.style.cssText = 'width:100%;max-width:386px;pointer-events:auto';
    var btn = document.createElement('button');
    btn.id = 'rxExport';
    btn.type = 'button';
    btn.style.cssText = 'width:100%;padding:14px;border-radius:14px;border:1px solid rgba(220,192,130,.5);' +
      'background:linear-gradient(160deg,rgba(220,192,130,.16),rgba(220,192,130,.06));' +
      'color:var(--gold);font-family:inherit;font-size:14.5px;font-weight:600;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;gap:8px;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' +
      '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
      esc(T.export);
    inner.appendChild(btn);
    bar.appendChild(inner);
    document.body.appendChild(bar);
    document.body.style.paddingBottom = '78px';
    return btn;
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.id = 'rxToast';
    t.className = 'no-print';
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:70;' +
      'background:rgba(15,27,23,.97);border:1px solid var(--line-2);color:var(--ink);' +
      'padding:11px 16px;border-radius:12px;font-size:13px;max-width:340px;text-align:center;' +
      'box-shadow:0 12px 30px -14px rgba(0,0,0,.7)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 3600);
    setTimeout(function () { t.remove(); }, 4200);
  }

  /* ═══ 导出 ═══ */
  function doExport(btn) {
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '.7';
    btn.innerHTML = esc(T.exporting);

    var back = false;
    function restore() {
      if (back) return; back = true;
      btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = orig;
      window.removeEventListener('afterprint', restore);
    }
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 4000);   // 兜底：万一 afterprint 不触发

    // 等级卡在正文最前，先把它排到 DOM 里再打印
    var card = document.getElementById('rxGradeCard');
    var body = document.getElementById('body') || document.querySelector('.wrap');
    if (card && body && body.parentNode && card.parentNode !== body.parentNode) {
      body.parentNode.insertBefore(card, body);
    }
    setTimeout(function () {
      try { window.print(); toast(T.toast); }
      catch (e) { toast(T.printFail); }
    }, 120);
  }

  function boot() {
    var g = computeGrade();
    renderBadge(g);
    buildPrintNodes(g);          // 常驻，print 时才可见
    var btn = renderBar();
    btn.addEventListener('click', function () { doExport(btn); });
    // 页面异步渲染完 hero 后，把徽章挪进 hero（视觉更贴标题）
    var hero = document.getElementById('hero');
    if (hero && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        var b = document.getElementById('rxBadge');
        if (b && hero.innerHTML.trim() && b.parentNode !== hero) { hero.appendChild(b); mo.disconnect(); }
      });
      mo.observe(hero, { childList: true });
      setTimeout(function () { mo.disconnect(); }, 15000);
    }
  }

  var st = document.createElement('style');
  st.id = 'rxPrintCss';
  st.textContent = SCREEN_CSS + '\n' + PRINT_CSS;
  document.head.appendChild(st);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
