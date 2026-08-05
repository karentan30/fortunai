const https = require('https');
const fs = require('fs');

const API_KEY = 'sk-8597ac6c84d344039e09c8f947e4022b';

// CORRECT birth data
const BAZI = {
  solar: '1991年10月5日 06:00（卯时）',
  lunar: '辛未年八月廿八日卯时',
  pillars: '辛未 丁酉 戊申 乙卯',
  year: '辛未', month: '丁酉', day: '戊申', hour: '乙卯',
  dayMaster: '戊土',
  dayun: '戊戌(1~11岁) → 己亥(11~21岁) → 庚子(21~31岁) → 辛丑(31~41岁) → 壬寅(41~51岁) → 癸卯(51~61岁)',
  currentDayun: '庚子大运（2019–2029）',
  nextDayun: '辛丑大运（2029–2039）',
};

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 12000,
      stream: false,
      temperature: 0.85,
    });
    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.choices[0].message.content);
        } catch(e) {
          reject(new Error('Parse error: ' + data.slice(0,200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function htmlWrap(title, subtitle, css, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
${css}
</head>
<body>
${body}
</body>
</html>`;
}

// ─── VERSION 1: TRADITIONAL ──────────────────────────────────────────────────
async function genV1(content) {
  const css = `<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1a0a2e; color:#f0e8d8; font-family:'STSong','Noto Serif SC','SimSun','Georgia',serif; max-width:860px; margin:0 auto; font-size:16px; line-height:2.1; -webkit-font-smoothing:antialiased; }
.cover { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:80px 48px 64px; background:radial-gradient(ellipse 70% 50% at 50% 20%, rgba(201,168,76,0.15) 0%, transparent 70%); border-bottom:1px solid rgba(201,168,76,0.18); position:relative; }
.cover::before { content:''; position:absolute; top:28px; left:28px; width:48px; height:48px; border:1px solid rgba(201,168,76,0.3); border-right:none; border-bottom:none; }
.cover::after { content:''; position:absolute; bottom:28px; right:28px; width:48px; height:48px; border:1px solid rgba(201,168,76,0.3); border-left:none; border-top:none; }
.cover-brand { font-size:10px; letter-spacing:10px; color:rgba(201,168,76,0.5); margin-bottom:36px; }
.cover-icon { font-size:64px; margin-bottom:20px; }
.cover-title { font-size:32px; color:#c9a84c; font-weight:300; letter-spacing:10px; margin-bottom:8px; }
.cover-sub { font-size:12px; color:rgba(201,168,76,0.5); letter-spacing:6px; margin-bottom:32px; font-style:italic; }
.gold-line { width:120px; height:1px; background:linear-gradient(90deg,transparent,#c9a84c,transparent); margin:0 auto 32px; }
.summary-card { background:rgba(201,168,76,0.07); border:1px solid rgba(201,168,76,0.28); border-radius:12px; padding:24px 32px; margin-bottom:24px; text-align:left; min-width:380px; }
.summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.summary-item { display:flex; flex-direction:column; gap:3px; }
.summary-label { font-size:10px; color:rgba(201,168,76,0.6); letter-spacing:2px; }
.summary-value { font-size:15px; color:#f0e8d8; }
.summary-highlight { font-size:18px; color:#c9a84c; font-weight:500; }
.content { padding:52px 52px 0; }
h2.chapter { font-size:20px; color:#c9a84c; font-weight:500; letter-spacing:3px; margin:44px 0 18px; padding:15px 20px; border-left:4px solid #c9a84c; background:linear-gradient(90deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.02) 100%); }
h3 { font-size:16px; color:rgba(201,168,76,0.9); margin:24px 0 10px; padding-left:12px; border-left:2px solid rgba(201,168,76,0.35); }
p { margin-bottom:16px; text-indent:2em; color:#f0e8d8; }
ul { padding-left:22px; margin-bottom:16px; }
li { margin-bottom:9px; color:#f0e8d8; }
li::marker { color:rgba(201,168,76,0.5); }
strong { color:#c9a84c; font-weight:600; }
em { color:rgba(220,140,110,0.95); font-style:normal; }
blockquote { border-left:3px solid rgba(201,168,76,0.45); padding:14px 20px; margin:20px 0; background:rgba(201,168,76,0.05); color:rgba(240,232,216,0.92); font-style:italic; }
table { width:100%; border-collapse:collapse; margin:18px 0; }
th { background:rgba(201,168,76,0.14); color:#c9a84c; padding:11px 14px; text-align:left; font-weight:400; font-size:14px; border-bottom:1.5px solid rgba(201,168,76,0.3); }
td { padding:10px 14px; border-bottom:1px solid rgba(201,168,76,0.1); font-size:15px; }
hr { border:none; border-top:1px solid rgba(201,168,76,0.12); margin:32px 0; }
.why-box { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.2); border-radius:8px; padding:16px 20px; margin:16px 0; }
.why-title { font-size:11px; color:rgba(201,168,76,0.7); letter-spacing:2px; margin-bottom:8px; }
.dayun-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:20px 0; }
.dayun-card { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.2); border-radius:8px; padding:14px; text-align:center; }
.dayun-name { font-size:22px; color:#c9a84c; margin-bottom:4px; }
.dayun-age { font-size:11px; color:rgba(240,232,216,0.5); margin-bottom:8px; }
.footer { text-align:center; color:rgba(240,232,216,0.22); font-size:12px; margin-top:48px; padding:24px 52px; border-top:1px solid rgba(201,168,76,0.1); }
</style>`;

  const body = `
<div class="cover">
  <div class="cover-brand">善 缘 · S H E N Y U A N</div>
  <div class="cover-icon">☯</div>
  <div class="cover-title">命理人生报告</div>
  <div class="cover-sub">PERSONAL DESTINY READING · 戊土命主</div>
  <div class="gold-line"></div>
  <div class="summary-card">
    <div class="summary-grid">
      <div class="summary-item"><span class="summary-label">出生时间</span><span class="summary-value">1991年10月5日 卯时</span></div>
      <div class="summary-item"><span class="summary-label">日主命格</span><span class="summary-highlight">戊土 · 大地之命</span></div>
      <div class="summary-item"><span class="summary-label">四柱八字</span><span class="summary-value">辛未 丁酉 戊申 乙卯</span></div>
      <div class="summary-item"><span class="summary-label">当前大运</span><span class="summary-value">庚子（2019–2029）</span></div>
      <div class="summary-item"><span class="summary-label">格局</span><span class="summary-value">伤官配印格</span></div>
      <div class="summary-item"><span class="summary-label">用神</span><span class="summary-value">丁火（正印）</span></div>
    </div>
  </div>
</div>
<div class="content">
${content}
</div>
<div class="footer">善缘 ShenYuan · AI命理系统 · shenyuan.app<br>本报告基于四柱八字（玄空飞星）推演，仅供参考，不构成人生决策依据。</div>`;

  return htmlWrap('善缘 · Karen 人生报告（传统版）', '', css, body);
}

// ─── VERSION 2: MODERN ───────────────────────────────────────────────────────
async function genV2(content) {
  const css = `<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#f7f6f3; color:#1a1a1a; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif; max-width:860px; margin:0 auto; font-size:16px; line-height:1.85; }
.hero { background:#1a1a1a; color:#fff; padding:64px 52px 52px; }
.hero-brand { font-size:11px; letter-spacing:6px; color:rgba(255,255,255,0.4); margin-bottom:40px; }
.hero-title { font-size:36px; font-weight:700; margin-bottom:8px; }
.hero-sub { font-size:14px; color:rgba(255,255,255,0.5); margin-bottom:40px; }
.meta-row { display:flex; gap:32px; flex-wrap:wrap; }
.meta-item { }
.meta-label { font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:2px; margin-bottom:4px; }
.meta-val { font-size:15px; color:rgba(255,255,255,0.85); }
.meta-val.accent { color:#f0c040; font-size:18px; font-weight:600; }
.content { padding:48px 52px; }
h2.chapter { font-size:22px; font-weight:700; color:#1a1a1a; margin:48px 0 16px; padding-bottom:10px; border-bottom:2px solid #1a1a1a; }
h3 { font-size:16px; font-weight:600; color:#333; margin:24px 0 10px; }
p { margin-bottom:16px; color:#333; }
ul { padding-left:20px; margin-bottom:16px; }
li { margin-bottom:8px; color:#333; }
strong { color:#1a1a1a; font-weight:700; }
em { color:#b07d30; font-style:normal; font-weight:600; }
.card { background:#fff; border:1px solid #e0ddd6; border-radius:12px; padding:24px; margin:16px 0; }
.card-title { font-size:11px; letter-spacing:3px; color:#999; margin-bottom:12px; font-weight:600; }
.insight-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:16px 0; }
.insight-card { background:#fff; border:1px solid #e0ddd6; border-radius:10px; padding:20px; }
.insight-icon { font-size:28px; margin-bottom:8px; }
.insight-label { font-size:11px; color:#999; margin-bottom:4px; }
.insight-val { font-size:15px; color:#1a1a1a; font-weight:600; }
table { width:100%; border-collapse:collapse; margin:16px 0; }
th { background:#f0ede6; color:#555; padding:10px 14px; text-align:left; font-size:13px; font-weight:600; }
td { padding:10px 14px; border-bottom:1px solid #ece9e0; font-size:14px; }
.dayun-row { display:flex; gap:10px; flex-wrap:wrap; margin:16px 0; }
.dayun-pill { background:#1a1a1a; color:#fff; padding:8px 16px; border-radius:20px; font-size:14px; }
.dayun-pill.current { background:#c9a84c; }
blockquote { border-left:4px solid #c9a84c; padding:14px 20px; margin:20px 0; background:#fffdf5; color:#444; font-style:italic; }
.footer { text-align:center; color:#bbb; font-size:12px; padding:32px 52px; border-top:1px solid #e0ddd6; margin-top:48px; }
</style>`;

  const body = `
<div class="hero">
  <div class="hero-brand">善缘 · SHENYUAN</div>
  <div class="hero-title">Karen 的命理报告</div>
  <div class="hero-sub">基于四柱八字 · 戊土日主 · 伤官配印格</div>
  <div class="meta-row">
    <div class="meta-item"><div class="meta-label">出生</div><div class="meta-val">1991年10月5日 06:00（卯时）</div></div>
    <div class="meta-item"><div class="meta-label">四柱</div><div class="meta-val">辛未 丁酉 戊申 乙卯</div></div>
    <div class="meta-item"><div class="meta-label">日主</div><div class="meta-val accent">戊土</div></div>
    <div class="meta-item"><div class="meta-label">当前大运</div><div class="meta-val">庚子（2019–2029）</div></div>
  </div>
</div>
<div class="content">
${content}
</div>
<div class="footer">善缘 ShenYuan · shenyuan.app · 本报告仅供参考</div>`;

  return htmlWrap('善缘 · Karen 人生报告（现代版）', '', css, body);
}

// ─── VERSION 3: POETIC ───────────────────────────────────────────────────────
async function genV3(content) {
  const css = `<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#faf8f3; color:#2c2318; font-family:'STSong','Noto Serif SC','SimSun','Georgia',serif; max-width:800px; margin:0 auto; font-size:17px; line-height:2.2; }
.cover { min-height:90vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:80px 52px; background:linear-gradient(180deg, #faf8f3 0%, #f5f0e6 100%); border-bottom:1px solid rgba(139,109,56,0.2); }
.ink-circle { width:80px; height:80px; border:1px solid rgba(139,109,56,0.3); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:36px; margin:0 auto 32px; }
.cover-title { font-size:28px; color:#5a3e1b; font-weight:300; letter-spacing:8px; margin-bottom:12px; }
.cover-sub { font-size:13px; color:rgba(90,62,27,0.55); letter-spacing:4px; margin-bottom:40px; }
.cover-poem { font-size:15px; color:#7a5c30; line-height:2.4; font-style:italic; }
.cover-bazi { margin-top:36px; font-size:12px; color:rgba(90,62,27,0.45); letter-spacing:3px; }
.content { padding:60px 52px 0; }
h2.chapter { font-size:18px; color:#5a3e1b; font-weight:400; letter-spacing:4px; margin:52px 0 24px; text-align:center; }
h2.chapter::before, h2.chapter::after { content:'——'; color:rgba(139,109,56,0.4); margin:0 12px; }
h3 { font-size:16px; color:#7a5c30; margin:28px 0 12px; }
p { margin-bottom:20px; color:#2c2318; text-indent:2em; }
.poem-block { text-align:center; font-size:16px; color:#7a5c30; line-height:2.8; margin:28px 0; padding:24px; border-top:1px solid rgba(139,109,56,0.15); border-bottom:1px solid rgba(139,109,56,0.15); background:rgba(139,109,56,0.03); font-style:italic; }
blockquote { border-left:2px solid rgba(139,109,56,0.3); padding:12px 24px; margin:20px 0; color:#5a3e1b; font-style:italic; }
ul { padding-left:24px; margin-bottom:16px; }
li { margin-bottom:10px; color:#2c2318; }
li::marker { color:rgba(139,109,56,0.4); }
strong { color:#5a3e1b; font-weight:600; }
em { color:#8b6d38; font-style:normal; }
table { width:100%; border-collapse:collapse; margin:20px 0; }
th { background:rgba(139,109,56,0.08); color:#5a3e1b; padding:10px 16px; font-weight:400; font-size:14px; border-bottom:1px solid rgba(139,109,56,0.2); }
td { padding:10px 16px; border-bottom:1px solid rgba(139,109,56,0.08); font-size:15px; }
.footer { text-align:center; color:rgba(90,62,27,0.3); font-size:12px; margin-top:60px; padding:32px 52px; border-top:1px solid rgba(139,109,56,0.12); }
</style>`;

  const body = `
<div class="cover">
  <div class="ink-circle">☯</div>
  <div class="cover-title">山 · 岳 · 命</div>
  <div class="cover-sub">戊土日主 · 伤官配印 · 厚德载物</div>
  <div class="cover-poem">大地为根，岁月为脉<br>金秋所生，才华自出<br>印星护体，贵人常伴</div>
  <div class="cover-bazi">辛未 · 丁酉 · 戊申 · 乙卯 ｜ 1991年10月5日 卯时</div>
</div>
<div class="content">
${content}
</div>
<div class="footer">善缘 ShenYuan · 命由天定，运由己造 · shenyuan.app</div>`;

  return htmlWrap('善缘 · Karen 人生报告（诗意版）', '', css, body);
}

// ─── VERSION 4: STRATEGIC ────────────────────────────────────────────────────
async function genV4(content) {
  const css = `<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0d1117; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif; max-width:900px; margin:0 auto; font-size:15px; line-height:1.8; }
.header { padding:48px 52px 40px; border-bottom:1px solid #21262d; }
.header-label { font-size:10px; letter-spacing:6px; color:#8b949e; margin-bottom:20px; }
.header-title { font-size:32px; font-weight:700; color:#e6edf3; margin-bottom:8px; }
.header-sub { font-size:14px; color:#8b949e; margin-bottom:32px; }
.meta-tags { display:flex; gap:10px; flex-wrap:wrap; }
.tag { background:#161b22; border:1px solid #30363d; border-radius:20px; padding:5px 14px; font-size:12px; color:#c9d1d9; }
.tag.accent { background:rgba(201,168,76,0.12); border-color:rgba(201,168,76,0.35); color:#c9a84c; }
.content { padding:40px 52px; }
h2.chapter { font-size:18px; font-weight:700; color:#c9a84c; margin:48px 0 16px; padding-bottom:10px; border-bottom:1px solid #21262d; letter-spacing:2px; }
h3 { font-size:15px; font-weight:600; color:#e6edf3; margin:24px 0 10px; }
p { margin-bottom:14px; color:#c9d1d9; }
ul { padding-left:20px; margin-bottom:14px; }
li { margin-bottom:8px; color:#c9d1d9; }
li::marker { color:#c9a84c; }
strong { color:#e6edf3; font-weight:700; }
em { color:#c9a84c; font-style:normal; font-weight:600; }
table { width:100%; border-collapse:collapse; margin:16px 0; }
th { background:#161b22; color:#8b949e; padding:10px 14px; text-align:left; font-size:12px; font-weight:600; letter-spacing:1px; border-bottom:1px solid #30363d; }
td { padding:10px 14px; border-bottom:1px solid #21262d; font-size:14px; color:#c9d1d9; }
.kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:20px 0; }
.kpi { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:20px; }
.kpi-label { font-size:10px; color:#8b949e; letter-spacing:2px; margin-bottom:8px; }
.kpi-val { font-size:24px; font-weight:700; color:#c9a84c; }
.kpi-desc { font-size:12px; color:#8b949e; margin-top:4px; }
.timeline { position:relative; padding-left:28px; margin:20px 0; }
.timeline::before { content:''; position:absolute; left:8px; top:0; bottom:0; width:1px; background:#30363d; }
.tl-item { position:relative; margin-bottom:24px; }
.tl-item::before { content:''; position:absolute; left:-24px; top:6px; width:8px; height:8px; border-radius:50%; background:#30363d; border:2px solid #30363d; }
.tl-item.active::before { background:#c9a84c; border-color:#c9a84c; }
.tl-year { font-size:11px; color:#8b949e; margin-bottom:4px; }
.tl-event { font-size:14px; color:#e6edf3; }
.alert-box { background:rgba(201,168,76,0.07); border:1px solid rgba(201,168,76,0.25); border-radius:8px; padding:16px 20px; margin:16px 0; }
.alert-title { font-size:11px; color:#c9a84c; letter-spacing:2px; margin-bottom:8px; font-weight:700; }
blockquote { border-left:3px solid #c9a84c; padding:12px 20px; margin:20px 0; background:#161b22; color:#8b949e; }
.footer { text-align:center; color:#30363d; font-size:12px; padding:32px 52px; border-top:1px solid #21262d; margin-top:48px; }
</style>`;

  const body = `
<div class="header">
  <div class="header-label">善缘 · SHENYUAN · PERSONAL DESTINY ANALYSIS</div>
  <div class="header-title">Karen — 命运战略报告</div>
  <div class="header-sub">四柱八字 · CEO视角 · 2024–2039决策窗口</div>
  <div class="meta-tags">
    <span class="tag accent">戊土日主</span>
    <span class="tag accent">伤官配印格</span>
    <span class="tag">1991年10月5日 06:00</span>
    <span class="tag">辛未 丁酉 戊申 乙卯</span>
    <span class="tag">当前大运：庚子（~2029）</span>
  </div>
</div>
<div class="content">
${content}
</div>
<div class="footer">善缘 ShenYuan · shenyuan.app · 本报告基于四柱八字推演，不构成投资或人生决策建议</div>`;

  return htmlWrap('善缘 · Karen 命运战略报告（CEO版）', '', css, body);
}

// ─── PROMPTS ─────────────────────────────────────────────────────────────────
const baseInfo = `
Karen的生辰信息：
- 公历：1991年10月5日 06:00（卯时）
- 四柱八字：辛未年 丁酉月 戊申日 乙卯时
- 日主：戊土（阳土）
- 出生地：榆树市，吉林省
- 大运排列：戊戌(1-11岁) → 己亥(11-21岁) → 庚子(21-31岁) → 辛丑(31-41岁) → 壬寅(41-51岁) → 癸卯(51-61岁)
- 现在是2026年，当前处于庚子大运（2019-2029年）

格局定性：
- 戊土生于酉月，金旺泄土，土偏弱
- 月干丁火为正印，是最重要的用神（贵人运、学习运）
- 年干辛金为伤官（创新、才华、不走寻常路）
- 日支申金为食神（口才、表达、生活品质）
- 时干乙木为正官（事业心、规则感）
- 格局：伤官配印格——才华横溢，有创意但也有深度；最怕金水过旺克制印星丁火

日主戊土性格：
- 不是丁火的细腻敏感，是戊土的踏实厚重
- 有担当，执行力强，说到做到
- 包容性强，朋友多，贵人多
- 表面稳重，内心有雄心
- 善于积累，厚积薄发，不是一蹴而就型
- 喜欢实实在在的结果，不喜欢空谈
`;

const prompt1 = `你是一位精通四柱八字的命理师，用传统文风（文言文与现代文结合），为Karen撰写一份深度人生报告。

${baseInfo}

请用HTML内容（不需要<!DOCTYPE>和<html>标签，直接写内容部分）生成以下章节，每章至少600字，用丰富的命理语言，文言夹带现代分析：

<h2 class="chapter">一、命格总论·山岳之命</h2>
（分析戊土日主的核心特质、伤官配印格的格局含义、五行配置总论）

<h2 class="chapter">二、五行分析·用神喜忌</h2>
（详细分析命局中木火土金水各五行的力量，点出用神丁火、喜神木、忌神过旺金水）

<h2 class="chapter">三、性格天赋·厚德载物</h2>
（戊土性格的多维分析：领导力、包容性、执行力、才华与深度的结合）

<h2 class="chapter">四、大运流程·人生节奏</h2>
（逐个分析六步大运，重点讲庚子大运（2019-2029）和辛丑大运（2029-2039））

<h2 class="chapter">五、2026年流年·丙午之机</h2>
（丙午年对戊土的影响：丙火正印透干，午火羊刃，是什么信号？月份分析）

<h2 class="chapter">六、事业财运·厚积薄发</h2>
（戊土适合的事业方向、赚钱方式、最旺的时间窗口）

<h2 class="chapter">七、感情婚姻·日支申金</h2>
（日支申金食神坐命，婚姻性格特点，合适的伴侣类型，婚姻的挑战与优势）

<h2 class="chapter">八、健康·脾胃为本</h2>
（戊土主脾胃，健康注意事项，运势弱时的身体信号）

<h2 class="chapter">九、开运建议·用神落地</h2>
（颜色：红色、橙色、绿色；方位：南方、东方；数字：3、8；开运物品；生活建议）

每章都要有具体细节，不要泛泛而谈。引用八字原文来论证。`;

const prompt2 = `你是一位结合了东方命理与西方设计思维的分析师（风格参考Cliff Tan的简洁实用风格），为Karen撰写一份现代风格的命理报告。

${baseInfo}

请生成HTML内容（直接写内容部分，不含DOCTYPE/html标签），使用以下class：
- h2.chapter 作为章节标题
- .card 包裹洞察卡片
- .insight-grid 包裹洞察网格
- table 用于对比数据
- .dayun-row + .dayun-pill（current class用于当前大运）用于大运展示

生成章节：

<h2 class="chapter">命格概览</h2>
（用卡片形式展示：日主戊土是什么类型的人，格局一句话，用神是什么，当前处于哪个阶段）

<h2 class="chapter">你是什么样的人</h2>
（3-4个性格维度，每个维度配一个洞察卡片，基于戊土+伤官配印格）

<h2 class="chapter">大运时间线</h2>
（dayun-row展示所有大运，重点分析庚子当前大运和即将来临的辛丑大运）

<h2 class="chapter">2026年：此刻的机会</h2>
（丙午年的具体机会和挑战，按季度分析）

<h2 class="chapter">事业：你的最佳路径</h2>
（用表格对比：适合 vs 不适合；最强的赚钱时间窗口；具体行动建议）

<h2 class="chapter">感情：你需要什么样的伴侣</h2>
（日支申金食神分析，配对建议，2026-2028年感情时机）

<h2 class="chapter">开运清单</h2>
（具体行动：用神颜色、方位、数字、物品，List形式简洁清晰）

风格要求：现代简洁，像McKinsey报告但加入命理深度，每个观点有命理依据。`;

const prompt3 = `你是一位兼具古典文学素养与命理深度的作者，用诗意的笔法为Karen写一份命理报告，以山岳作为戊土的核心意象贯穿全文。

${baseInfo}

请生成HTML内容（直接写内容部分），每章以一句古诗或格言开篇，使用.poem-block class展示诗句，配合散文式的分析。

生成章节：

<h2 class="chapter">山之根脉</h2>
（命格总论，用山岳意象描述戊土，引入伤官配印的诗意解读）

<h2 class="chapter">金秋的才华</h2>
（生于酉月的天赋，辛金伤官与乙木正官的才华与规则之间的张力，像秋天的山）

<h2 class="chapter">印星·贵人如月光</h2>
（丁火正印的意义：有人愿意照亮你，贵人缘，学习力，心灵的庇护）

<h2 class="chapter">大运·时光的河流</h2>
（诗意描述六步大运，重点讲庚子大运（2019-2029）：庚金克印，是考验也是淬炼）

<h2 class="chapter">2026·丙午年的火光</h2>
（丙午年的意象：火光重现，正印回归，是复苏的年份）

<h2 class="chapter">事业·大地承载万物</h2>
（戊土的事业观：不争不抢，厚积薄发，但能承载大事）

<h2 class="chapter">情与缘·申金的温柔</h2>
（日支申金食神：享受生活、有口才、感情中的给予者，爱情的诗意面）

<h2 class="chapter">开运·与命运共舞</h2>
（给Karen的开运建议，用山与火的意象：用红色补印星，向南方借火，种木以生火）

整体风格：有温度、有深度、不说废话，像一位智慧的老师在对话，而非冷冰冰的报告。`;

const prompt4 = `你是Karen的首席战略官，基于她的四柱八字，为她写一份CEO风格的战略决策报告，帮助她在2024-2039年做出最优决策。

${baseInfo}

请生成HTML内容（直接写内容部分），大量使用table、.kpi-grid、.kpi、.timeline、.tl-item、.alert-box等class，商业报告风格。

生成以下章节：

<h2 class="chapter">01 · 执行摘要</h2>
（3个KPI：命格优势评分/当前运势评分/2026机会指数；一段100字的战略总结）

<h2 class="chapter">02 · 核心竞争力分析</h2>
（基于戊土+伤官配印格：你的护城河是什么？天然优势在哪里？哪些事绝对不做？）

<h2 class="chapter">03 · 十年大运战略地图（2019-2039）</h2>
（用timeline展示庚子大运和辛丑大运；庚子（2019-2029）：金旺印弱，是积累期还是突破期？辛丑（2029-2039）：丑土帮身，是收获期；具体年份决策建议）

<h2 class="chapter">04 · 2026年操作手册</h2>
（丙午年：Q1/Q2/Q3/Q4各季度的策略；哪些月份冲、哪些月份守；具体的行动建议）

<h2 class="chapter">05 · 事业赛道选择</h2>
（用表格：推荐赛道 vs 不推荐赛道，附理由；最适合的合伙人类型；赚钱的最优时间窗口2026-2029）

<h2 class="chapter">06 · 感情与人际战略</h2>
（不是"什么样的人和你合适"，而是：你在感情中的行为模式，风险点，2026-2028年的时机窗口）

<h2 class="chapter">07 · 风险预警与规避</h2>
（忌神金水的影响；哪些年份要谨慎；健康红线；心理盲点）

<h2 class="chapter">08 · 开运行动清单</h2>
（用Checklist形式：颜色/方位/数字/物品/习惯，每条有命理依据）

风格：精准、有数据感、商业报告语气，但核心是命理洞察。不废话，每个结论有八字依据。`;

async function main() {
  console.log('Generating 4 BaZi reports for Karen (correct: 1991-10-05, 戊土)...\n');

  console.log('Calling DeepSeek for V1 (Traditional)...');
  const c1 = await callDeepSeek(prompt1);
  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/karen-人生报告.html', await genV1(c1), 'utf8');
  console.log('✅ V1 saved\n');

  console.log('Calling DeepSeek for V2 (Modern)...');
  const c2 = await callDeepSeek(prompt2);
  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/karen-人生报告-v2-现代版.html', await genV2(c2), 'utf8');
  console.log('✅ V2 saved\n');

  console.log('Calling DeepSeek for V3 (Poetic)...');
  const c3 = await callDeepSeek(prompt3);
  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/karen-人生报告-v3-诗意版.html', await genV3(c3), 'utf8');
  console.log('✅ V3 saved\n');

  console.log('Calling DeepSeek for V4 (Strategic)...');
  const c4 = await callDeepSeek(prompt4);
  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/karen-人生报告-v4-战略版.html', await genV4(c4), 'utf8');
  console.log('✅ V4 saved\n');

  console.log('All 4 reports generated successfully with correct data (戊土, Oct 5, 1991)');
}

main().catch(console.error);
