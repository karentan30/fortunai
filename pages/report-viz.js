/*
 * report-viz.js — 善缘/Runae 报告可复用可视化基元（纯前端 SVG · 无依赖 · 深色金玉主题）
 * ─────────────────────────────────────────────────────────────────────────
 * 依据 docs/报告设计-25方法规格.md 的"4个复用基元"，让紫微/风水/合婚/占星/塔罗等
 * 报告都能拼装。所有函数为纯函数，返回 SVG/HTML 字符串；空数据一律优雅降级返 ''。
 *
 * 风格与 bazi.html 的 buildDayunTimeline / genWuxingRadar 一致：
 *   金 #c9a84c · 金亮 #e8d08a · 金深 #8a6420 · 玉 #5bbfa0
 *   凶/暗红 #c85a52 · 吉/绿 #6fae6f · 深底 #12100a
 *
 * 导出的 4 个基元（给主会话接各报告用）：
 *   1. renderFlyingStarGrid(data)        — 飞星九宫盘（风水/阴宅/九星共用）
 *   2. renderScoreRing(label, score, max)— 圆环评分（合婚/占星/面相共用·可并排）
 *   3. renderScrollCard(opts)            — 卷轴签卡（灵签/omikuji/解签用）
 *   4. renderTimeline(steps, currentIdx) — 通用时间轴（紫微大限/合婚流年/大运共用）
 *
 * 引入：<script src="/pages/report-viz.js"></script>  → 全局 window.ReportViz.*
 * ───────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  /* ── 主题常量 ── */
  var GOLD = '#c9a84c', GOLD_LIGHT = '#e8d08a', GOLD_DEEP = '#8a6420';
  var JADE = '#5bbfa0', JADE_MID = '#8dd9bf';
  var INK_DARK = '#12100a';           // 深底
  var GOOD = '#6fae6f', BAD = '#c85a52', NEUTRAL = GOLD;
  var SERIF_CN = "'Noto Serif SC','Songti SC',serif";
  var SERIF_EN = "'Cormorant Garamond','EB Garamond',serif";

  /* ── 小工具 ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }

  /* 深色底描金外框（各组件统一容器视觉语言） */
  function frameOpen(title, sub, maxW) {
    var t = title ? '<div class="rv-frame-title">' + esc(title) + '</div>' : '';
    var s = sub ? '<div class="rv-frame-sub">' + esc(sub) + '</div>' : '';
    return '<div class="rv-frame"' + (maxW ? ' style="max-width:' + maxW + 'px"' : '') + '>' + t + s;
  }
  function frameClose(foot) {
    return (foot ? '<div class="rv-frame-foot">' + esc(foot) + '</div>' : '') + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════════════
   * 基元 1 · 飞星九宫盘  renderFlyingStarGrid(data)
   *   风水/阴宅/九星共用。3×3 九宫格 SVG，每宫标数字星 + 方位，
   *   当前/凶方高亮。
   *
   * data = {
   *   title, subtitle,                         // 可选标题
   *   cells: [                                 // 长度 1..9（洛书顺序或任意顺序）
   *     { star: 8, dir: '东南', name: '巽',    // star=飞星数字, dir=方位, name=八卦(可选)
   *       luck: 'good'|'bad'|'neutral',        // 吉凶 → 色块
   *       current: true,                       // 当前/本命方位高亮
   *       label: '旺财' },                     // 一句话（可选）
   *     ...
   *   ],
   *   layout: 'luoshu'                         // 'luoshu'(洛书定位) | 'seq'(按序 3x3)
   * }
   * ════════════════════════════════════════════════════════════════════════ */
  // 洛书标准布局：数字 → 九宫格位 (row,col) 0-based。 4 9 2 / 3 5 7 / 8 1 6
  var LUOSHU_POS = { 4: [0, 0], 9: [0, 1], 2: [0, 2], 3: [1, 0], 5: [1, 1], 7: [1, 2], 8: [2, 0], 1: [2, 1], 6: [2, 2] };
  // 飞星数字 → 五行/吉凶默认色（可被 cell.luck 覆盖）
  var STAR_TONE = { 1: JADE, 2: BAD, 3: JADE, 4: JADE, 5: BAD, 6: GOLD, 7: BAD, 8: GOOD, 9: GOLD };

  function renderFlyingStarGrid(data) {
    if (!data) return '';
    var cells = (data && isArr(data.cells)) ? data.cells.filter(function (c) { return c && (c.star != null || c.dir || c.name); }) : [];
    if (!cells.length) return '';

    var S = 300, gap = 6, pad = 4;
    var cellS = (S - pad * 2 - gap * 2) / 3;
    var layout = data.layout || 'luoshu';

    // 建 3x3 网格占位
    var grid = [[null, null, null], [null, null, null], [null, null, null]];
    if (layout === 'luoshu') {
      cells.forEach(function (c) {
        var p = LUOSHU_POS[num(c.star, -1)];
        if (p) grid[p[0]][p[1]] = c;
      });
      // 未按洛书命中的（无 star 或重复）按空位补
      var leftover = cells.filter(function (c) { return !LUOSHU_POS[num(c.star, -1)]; });
      var li = 0;
      for (var r = 0; r < 3 && li < leftover.length; r++)
        for (var col = 0; col < 3 && li < leftover.length; col++)
          if (!grid[r][col]) grid[r][col] = leftover[li++];
    } else {
      var i = 0;
      for (var r2 = 0; r2 < 3; r2++) for (var c2 = 0; c2 < 3; c2++) grid[r2][c2] = cells[i++] || null;
    }

    var svg = '<svg width="100%" viewBox="0 0 ' + S + ' ' + S + '" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:' + S + 'px;margin:0 auto">';
    // 外框
    svg += '<rect x="1" y="1" width="' + (S - 2) + '" height="' + (S - 2) + '" rx="10" fill="none" stroke="rgba(201,168,76,0.35)" stroke-width="1.5"/>';

    for (var rr = 0; rr < 3; rr++) {
      for (var cc = 0; cc < 3; cc++) {
        var cell = grid[rr][cc];
        var x = pad + cc * (cellS + gap), y = pad + rr * (cellS + gap);
        var cx = x + cellS / 2, cy = y + cellS / 2;
        var isCenter = (rr === 1 && cc === 1);

        if (!cell) {
          svg += '<rect x="' + x + '" y="' + y + '" width="' + cellS + '" height="' + cellS + '" rx="7" fill="rgba(255,255,255,0.015)" stroke="rgba(201,168,76,0.08)" stroke-width="1"/>';
          continue;
        }

        var luck = cell.luck || (STAR_TONE[num(cell.star, 0)] === GOOD ? 'good' : (STAR_TONE[num(cell.star, 0)] === BAD ? 'bad' : 'neutral'));
        var tone = luck === 'good' ? GOOD : luck === 'bad' ? BAD : (STAR_TONE[num(cell.star, 0)] || GOLD);
        var isCur = !!cell.current;

        // 底块（吉凶色）
        var fill = luck === 'good' ? 'rgba(111,174,111,0.14)' : luck === 'bad' ? 'rgba(200,90,82,0.16)' : 'rgba(201,168,76,0.06)';
        var strokeW = isCur ? 2.4 : 1.2;
        var stroke = isCur ? GOLD_LIGHT : (isCenter ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.16)');
        svg += '<rect x="' + x + '" y="' + y + '" width="' + cellS + '" height="' + cellS + '" rx="7" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeW + '"/>';
        if (isCur) {
          svg += '<rect x="' + (x + 2.5) + '" y="' + (y + 2.5) + '" width="' + (cellS - 5) + '" height="' + (cellS - 5) + '" rx="5" fill="none" stroke="' + GOLD + '" stroke-width="0.8" opacity="0.5"/>';
        }

        // 方位（顶）
        if (cell.dir) {
          svg += '<text x="' + cx + '" y="' + (y + 17) + '" text-anchor="middle" font-size="11" font-family="' + SERIF_CN + '" fill="rgba(232,208,138,0.72)" letter-spacing="0.06em">' + esc(cell.dir) + '</text>';
        }
        // 飞星数字（中·大字）
        if (cell.star != null) {
          svg += '<text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" font-size="30" font-weight="700" font-family="' + SERIF_EN + '" fill="' + tone + '">' + esc(cell.star) + '</text>';
        }
        // 八卦名（数字右下角小字）
        if (cell.name) {
          svg += '<text x="' + (x + cellS - 8) + '" y="' + (cy - 6) + '" text-anchor="end" font-size="12" font-family="' + SERIF_CN + '" fill="rgba(141,217,191,0.7)">' + esc(cell.name) + '</text>';
        }
        // 一句话标签（底）
        if (cell.label) {
          svg += '<text x="' + cx + '" y="' + (y + cellS - 9) + '" text-anchor="middle" font-size="9.5" font-family="' + SERIF_CN + '" fill="' + (luck === 'bad' ? 'rgba(230,150,145,0.9)' : luck === 'good' ? 'rgba(150,210,150,0.9)' : 'rgba(200,190,160,0.6)') + '">' + esc(cell.label) + '</text>';
        }
        if (isCur) {
          svg += '<text x="' + (x + 9) + '" y="' + (y + cellS - 9) + '" text-anchor="start" font-size="8.5" font-family="' + SERIF_CN + '" fill="' + GOLD_LIGHT + '" letter-spacing="0.1em">◈</text>';
        }
      }
    }
    svg += '</svg>';

    return frameOpen(data.title, data.subtitle) +
      svg +
      frameClose(data.foot || '九宫飞星 · 金绿为旺 · 暗红为凶 · ◈ 描金为当前方位');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * 基元 2 · 圆环评分  renderScoreRing(label, score, max)
   *   合婚/占星/面相共用。SVG 圆环评分，可多个并排。
   *
   *   renderScoreRing('总契合度', 82, 100)                    // 简单调用
   *   renderScoreRing({ label:'性格', score:9, max:10,        // 对象调用（更多控制）
   *     size:120, tone:'auto'|'good'|'bad'|'gold'|'jade', sub:'一句话' })
   *   renderScoreRing.group([...], '标题')                    // 一排多个（辅助）
   * ════════════════════════════════════════════════════════════════════════ */
  function renderScoreRing(label, score, max) {
    var o;
    if (label && typeof label === 'object') { o = label; }
    else { o = { label: label, score: score, max: max }; }

    if (o.score == null || isNaN(Number(o.score))) return '';
    var mx = num(o.max, 100); if (mx <= 0) mx = 100;
    var sc = clamp(num(o.score, 0), 0, mx);
    var pct = sc / mx;
    var size = num(o.size, 128);
    var stroke = Math.max(6, size * 0.08);
    var cx = size / 2, cy = size / 2;
    var r = (size - stroke) / 2 - 2;
    var circ = 2 * Math.PI * r;
    var dash = circ * pct;

    // 色调：auto 按分值 → 高绿 / 中金 / 低红
    var tone = o.tone || 'auto';
    var col = GOLD, colLight = GOLD_LIGHT;
    if (tone === 'good') { col = GOOD; colLight = '#9ed89e'; }
    else if (tone === 'bad') { col = BAD; colLight = '#e39a95'; }
    else if (tone === 'jade') { col = JADE; colLight = JADE_MID; }
    else if (tone === 'gold') { col = GOLD; colLight = GOLD_LIGHT; }
    else { // auto
      if (pct >= 0.75) { col = GOOD; colLight = '#9ed89e'; }
      else if (pct >= 0.5) { col = GOLD; colLight = GOLD_LIGHT; }
      else if (pct >= 0.3) { col = '#d09a4c'; colLight = '#e8c07a'; }
      else { col = BAD; colLight = '#e39a95'; }
    }

    var uid = 'rvr' + Math.random().toString(36).slice(2, 8);
    var scoreTxt = (Math.round(sc * 10) / 10).toString();
    var fs = size * 0.30;

    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block">';
    svg += '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + col + '"/><stop offset="100%" stop-color="' + colLight + '"/></linearGradient></defs>';
    // 轨道
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(201,168,76,0.1)" stroke-width="' + stroke + '"/>';
    // 进度弧（从顶端顺时针）
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="url(#' + uid + ')" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + circ + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    // 分值
    svg += '<text x="' + cx + '" y="' + (cy + fs * 0.16) + '" text-anchor="middle" font-size="' + fs + '" font-weight="300" font-family="' + SERIF_EN + '" fill="' + colLight + '">' + esc(scoreTxt) + '</text>';
    // 满分小字
    if (o.showMax !== false) {
      svg += '<text x="' + cx + '" y="' + (cy + fs * 0.68) + '" text-anchor="middle" font-size="' + (size * 0.085) + '" font-family="' + SERIF_EN + '" fill="rgba(200,190,160,0.42)">/ ' + esc(mx) + '</text>';
    }
    svg += '</svg>';

    var lbl = o.label ? '<div class="rv-ring-label">' + esc(o.label) + '</div>' : '';
    var sub = o.sub ? '<div class="rv-ring-sub">' + esc(o.sub) + '</div>' : '';
    return '<div class="rv-ring">' + svg + lbl + sub + '</div>';
  }

  // 辅助：一排多个评分环
  renderScoreRing.group = function (rings, title) {
    if (!isArr(rings) || !rings.length) return '';
    var body = rings.map(function (r) { return renderScoreRing(r); }).filter(Boolean).join('');
    if (!body) return '';
    return frameOpen(title) + '<div class="rv-ring-row">' + body + '</div>' + frameClose();
  };

  /* ════════════════════════════════════════════════════════════════════════
   * 基元 3 · 卷轴签卡  renderScrollCard(opts)
   *   灵签/omikuji/解签用。古卷轴质感：签号 + 吉凶等级印章 + 四句签诗 + 解读。
   *
   * opts = {
   *   number: '第五十一签',   // 签号
   *   level: '上上签',        // 吉凶等级 → 印章
   *   levelTone: 'good'|'bad'|'neutral',  // 缺省按 level 文字推断
   *   title: '观音灵签',      // 顶部小标（可选）
   *   poem: ['天开地辟结良缘','日吉时良万物全','若得此签非小可','人行中正帼相欢'], // 四句签诗
   *   verses: [...],          // poem 的别名
   *   reading: '解读段落…',   // 解读正文（可选）
   *   omikuji: false          // true 用和风竖排样式
   * }
   * ════════════════════════════════════════════════════════════════════════ */
  var LEVEL_GOOD = /(大吉|上上|上吉|上签|吉)/;
  var LEVEL_BAD = /(大凶|凶|下下|下签|末吉不利)/;
  function inferLevelTone(level) {
    var s = String(level || '');
    if (/大凶|下下|凶(?!.*吉)/.test(s)) return 'bad';
    if (LEVEL_GOOD.test(s) && !/凶/.test(s)) return 'good';
    if (LEVEL_BAD.test(s)) return 'bad';
    return 'neutral';
  }

  function renderScrollCard(opts) {
    if (!opts) return '';
    var poem = isArr(opts.poem) ? opts.poem : (isArr(opts.verses) ? opts.verses : []);
    poem = poem.filter(function (l) { return l != null && String(l).trim() !== ''; });
    var hasContent = poem.length || opts.number || opts.level || opts.reading;
    if (!hasContent) return '';

    var tone = opts.levelTone || inferLevelTone(opts.level);
    var stampCol = tone === 'good' ? GOOD : tone === 'bad' ? BAD : GOLD;
    var stampBorder = tone === 'good' ? 'rgba(111,174,111,0.7)' : tone === 'bad' ? 'rgba(200,90,82,0.75)' : 'rgba(201,168,76,0.7)';

    var isOmi = !!opts.omikuji;
    var cls = 'rv-scroll' + (isOmi ? ' rv-scroll-omi' : '');

    var html = '<div class="' + cls + '">';
    // 卷轴顶轴
    html += '<div class="rv-scroll-rod rv-scroll-rod-top"><span class="rv-scroll-knob"></span><span class="rv-scroll-knob rv-scroll-knob-r"></span></div>';
    html += '<div class="rv-scroll-body">';

    // 顶部小标 + 签号
    if (opts.title) html += '<div class="rv-scroll-temple">' + esc(opts.title) + '</div>';
    if (opts.number) html += '<div class="rv-scroll-num">' + esc(opts.number) + '</div>';

    // 吉凶印章
    if (opts.level) {
      html += '<div class="rv-scroll-stamp" style="color:' + stampCol + ';border-color:' + stampBorder + '">' + esc(opts.level) + '</div>';
    }

    // 四句签诗
    if (poem.length) {
      html += '<div class="rv-scroll-poem' + (isOmi ? ' rv-poem-vert' : '') + '">';
      poem.forEach(function (line) {
        html += '<div class="rv-scroll-verse">' + esc(line) + '</div>';
      });
      html += '</div>';
    }

    // 解读
    if (opts.reading) {
      html += '<div class="rv-scroll-divider">✦</div>';
      html += '<div class="rv-scroll-reading">' + esc(opts.reading) + '</div>';
    }

    html += '</div>'; // body
    html += '<div class="rv-scroll-rod rv-scroll-rod-bottom"><span class="rv-scroll-knob"></span><span class="rv-scroll-knob rv-scroll-knob-r"></span></div>';
    html += '</div>';
    return html;
  }

  /* ════════════════════════════════════════════════════════════════════════
   * 基元 4 · 通用时间轴  renderTimeline(steps, currentIdx)
   *   紫微大限/合婚流年/大运共用。泛化 bazi 已有 dayun 时间轴。
   *
   * steps = [
   *   { label:'甲子',        // 节点主标（干支/大限/年份）
   *     sub:'8岁',           // 节点副标（起始年龄/年份）
   *     tone:'good'|'bad'|'neutral'|'#hex',  // 色（缺省中性金）
   *     tag:'宜婚',          // 关键标注（可选，如"宜婚/宜孕/需磨合"）
   *     current:true },      // 当前节点（也可用第二参 currentIdx 指定）
   *   ...
   * ]
   * 第二参：currentIdx(number) 或 opts{ currentIdx, title, subtitle, foot }
   * ════════════════════════════════════════════════════════════════════════ */
  var TONE_MAP = { good: GOOD, bad: BAD, neutral: GOLD, gold: GOLD, jade: JADE };
  function resolveTone(t) {
    if (!t) return GOLD;
    if (t.charAt && t.charAt(0) === '#') return t;
    return TONE_MAP[t] || GOLD;
  }

  function renderTimeline(steps, opt) {
    if (!isArr(steps)) return '';
    var st = steps.filter(function (s) { return s && (s.label != null || s.sub != null); });
    if (st.length < 2) return '';

    var o = (opt && typeof opt === 'object') ? opt : {};
    var curIdx = (typeof opt === 'number') ? opt : (o.currentIdx != null ? o.currentIdx : -1);
    // 也支持在 step 上标 current
    if (curIdx < 0) { for (var q = 0; q < st.length; q++) if (st[q].current) { curIdx = q; break; } }

    var n = st.length;
    var boxW = 66;                       // 每节点宽（水平滚动）
    var W = Math.max(360, boxW * n + 36);
    var hasTag = st.some(function (s) { return s.tag; });
    var H = hasTag ? 128 : 110;
    var padX = 18, trackY = hasTag ? 62 : 50;

    var svg = '<svg width="' + W + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block">';
    // 主轴线
    svg += '<line x1="' + padX + '" y1="' + trackY + '" x2="' + (W - padX) + '" y2="' + trackY + '" stroke="rgba(201,168,76,0.28)" stroke-width="1.5"/>';

    var innerW = W - padX * 2, seg = innerW / n;
    st.forEach(function (d, i) {
      var cx = padX + seg * i + seg / 2;
      var col = resolveTone(d.tone);
      var isCur = (i === curIdx);

      // 色带底
      svg += '<rect x="' + (padX + seg * i + 3) + '" y="' + (trackY - 3) + '" width="' + (seg - 6) + '" height="6" rx="3" fill="' + col + '" opacity="' + (isCur ? '0.55' : '0.2') + '"/>';

      // 节点圆
      svg += '<circle cx="' + cx + '" cy="' + trackY + '" r="' + (isCur ? 7 : 4.5) + '" fill="' + (isCur ? col : INK_DARK) + '" stroke="' + col + '" stroke-width="' + (isCur ? 2.5 : 1.5) + '"/>';
      if (isCur) {
        svg += '<circle cx="' + cx + '" cy="' + trackY + '" r="11" fill="none" stroke="' + col + '" stroke-width="1" opacity="0.5">' +
          '<animate attributeName="r" values="8;13;8" dur="2.4s" repeatCount="indefinite"/>' +
          '<animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite"/></circle>';
      }

      // 主标（干支/大限）在上
      if (d.label != null) {
        svg += '<text x="' + cx + '" y="' + (trackY - 15) + '" text-anchor="middle" font-size="14" font-weight="700" font-family="' + SERIF_CN + '" fill="' + col + '">' + esc(d.label) + '</text>';
      }
      // 副标（年龄/年份）在下
      if (d.sub != null) {
        svg += '<text x="' + cx + '" y="' + (trackY + 22) + '" text-anchor="middle" font-size="9" font-family="' + SERIF_EN + '" fill="rgba(200,190,160,0.62)">' + esc(d.sub) + '</text>';
      }
      // 关键标注
      if (d.tag) {
        var tagCol = resolveTone(d.tone !== undefined && d.tone ? d.tone : (isCur ? 'gold' : 'neutral'));
        svg += '<text x="' + cx + '" y="' + (trackY + 40) + '" text-anchor="middle" font-size="9.5" font-family="' + SERIF_CN + '" fill="' + tagCol + '" letter-spacing="0.06em">' + esc(d.tag) + '</text>';
      }
      // 当前标记
      if (isCur && !d.tag) {
        svg += '<text x="' + cx + '" y="' + (trackY + 40) + '" text-anchor="middle" font-size="9" font-family="' + SERIF_CN + '" fill="' + col + '" letter-spacing="0.1em">当前</text>';
      } else if (isCur && d.tag) {
        svg += '<text x="' + cx + '" y="' + (trackY + 54) + '" text-anchor="middle" font-size="8.5" font-family="' + SERIF_CN + '" fill="' + col + '" letter-spacing="0.1em">当前</text>';
      }
    });
    svg += '</svg>';

    return frameOpen(o.title, o.subtitle) +
      '<div class="rv-timeline-scroll">' + svg + '</div>' +
      frameClose(o.foot || '色带示节点属性 · 光标为当前所处阶段');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * 组件样式（自动注入一次；深色底 + 金玉描边 + 响应式）
   * 若宿主页面已定义 .rv-frame 等 class，可在引入前设 window.__RV_NO_CSS=true 跳过。
   * ════════════════════════════════════════════════════════════════════════ */
  var CSS = [
    '.rv-frame{background:linear-gradient(160deg,rgba(20,16,8,0.96),rgba(12,10,6,0.98));border:1px solid rgba(201,168,76,0.22);border-radius:16px;padding:18px 16px 14px;margin:14px auto;box-shadow:0 6px 28px rgba(0,0,0,0.45),inset 0 0 40px rgba(201,168,76,0.03);font-family:' + SERIF_CN + ';color:rgba(232,224,200,0.9)}',
    '.rv-frame-title{text-align:center;font-size:15px;letter-spacing:0.14em;color:' + GOLD_LIGHT + ';margin-bottom:2px}',
    '.rv-frame-sub{text-align:center;font-size:11px;letter-spacing:0.08em;color:rgba(200,190,160,0.5);margin-bottom:12px}',
    '.rv-frame-title+.rv-frame-sub{margin-top:2px}',
    '.rv-frame-foot{text-align:center;font-size:10px;letter-spacing:0.05em;color:rgba(200,190,160,0.4);margin-top:10px}',
    /* 评分环 */
    '.rv-ring-row{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 20px;align-items:flex-start}',
    '.rv-ring{display:inline-flex;flex-direction:column;align-items:center;text-align:center}',
    '.rv-ring-label{margin-top:7px;font-size:12px;letter-spacing:0.1em;color:rgba(232,224,200,0.82)}',
    '.rv-ring-sub{margin-top:2px;font-size:10px;color:rgba(200,190,160,0.5);max-width:140px;line-height:1.4}',
    /* 卷轴签卡 */
    '.rv-scroll{max-width:380px;margin:16px auto;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.5))}',
    '.rv-scroll-rod{height:14px;background:linear-gradient(180deg,' + GOLD_DEEP + ',#5a3f14 55%,#3a2809);border-radius:7px;position:relative;margin:0 6px}',
    '.rv-scroll-rod-top{margin-bottom:-2px;z-index:2}',
    '.rv-scroll-rod-bottom{margin-top:-2px;z-index:2}',
    '.rv-scroll-knob{position:absolute;top:50%;left:-6px;transform:translateY(-50%);width:14px;height:20px;border-radius:5px;background:radial-gradient(circle at 40% 35%,' + GOLD_LIGHT + ',' + GOLD_DEEP + ');box-shadow:0 1px 3px rgba(0,0,0,0.5)}',
    '.rv-scroll-knob-r{left:auto;right:-6px}',
    '.rv-scroll-body{background:linear-gradient(180deg,rgba(38,30,16,0.98),rgba(28,22,12,0.98));border-left:1px solid rgba(201,168,76,0.28);border-right:1px solid rgba(201,168,76,0.28);padding:24px 26px 26px;position:relative}',
    '.rv-scroll-body:before{content:"";position:absolute;inset:6px;border:1px solid rgba(201,168,76,0.14);border-radius:2px;pointer-events:none}',
    '.rv-scroll-temple{text-align:center;font-size:12px;letter-spacing:0.24em;color:rgba(201,168,76,0.6);margin-bottom:6px}',
    '.rv-scroll-num{text-align:center;font-size:20px;letter-spacing:0.16em;color:' + GOLD_LIGHT + ';margin-bottom:14px;font-weight:500}',
    '.rv-scroll-stamp{display:block;width:74px;height:74px;line-height:1.1;margin:0 auto 18px;border:2.5px solid;border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:19px;font-weight:700;letter-spacing:0.02em;transform:rotate(-7deg);box-shadow:inset 0 0 12px rgba(0,0,0,0.35);padding:6px}',
    '.rv-scroll-poem{margin:6px auto 4px;text-align:center}',
    '.rv-scroll-verse{font-size:17px;letter-spacing:0.18em;line-height:2;color:rgba(240,232,210,0.94)}',
    '.rv-poem-vert{display:flex;flex-direction:row-reverse;justify-content:center;gap:20px;margin:10px auto}',
    '.rv-poem-vert .rv-scroll-verse{writing-mode:vertical-rl;text-orientation:upright;letter-spacing:0.12em;line-height:1.7}',
    '.rv-scroll-divider{text-align:center;color:rgba(201,168,76,0.4);font-size:13px;margin:14px 0 10px}',
    '.rv-scroll-reading{font-size:13px;line-height:1.85;color:rgba(220,212,192,0.8);text-align:justify;letter-spacing:0.02em}',
    /* 时间轴 */
    '.rv-timeline-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}',
    '.rv-timeline-scroll::-webkit-scrollbar{height:5px}',
    '.rv-timeline-scroll::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.25);border-radius:3px}',
    /* 飞星盘响应 */
    '.rv-frame svg{max-width:100%}',
    '@media(max-width:420px){.rv-scroll-body{padding:20px 18px 22px}.rv-scroll-verse{font-size:15px;letter-spacing:0.12em}.rv-ring-row{gap:12px 14px}}'
  ].join('\n');

  function injectCSS() {
    if (typeof document === 'undefined') return;
    if (root.__RV_NO_CSS) return;
    if (document.getElementById('report-viz-css')) return;
    var s = document.createElement('style');
    s.id = 'report-viz-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCSS);
    else injectCSS();
  }

  /* ── 导出 ── */
  var API = {
    renderFlyingStarGrid: renderFlyingStarGrid,
    renderScoreRing: renderScoreRing,
    renderScrollCard: renderScrollCard,
    renderTimeline: renderTimeline,
    injectCSS: injectCSS,
    _css: CSS
  };
  root.ReportViz = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : this);
