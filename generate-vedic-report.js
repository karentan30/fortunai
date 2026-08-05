#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const OUTPUT_PATH = path.join(__dirname, 'docs', 'karen-人生报告-印度.html');

const systemPrompt = `你是一位精通印度吠陀占星（Jyotish）的大师，在印度学习二十年，精通梵文古籍《Brihat Parashara Hora Shastra》。
语言：简体中文（术语后括号标注梵文/英文）。格式：Markdown。总字数：7000字以上。
请使用恒星黄道（Sidereal zodiac），不使用热带黄道。`;

const userPrompt = `命主：1991年10月5日出生，女性，早上6点，出生地中国广州（北纬23°，东经113°）。

请给出完整的吠陀占星报告：

## 一、命盘总览 — 你的吠陀星盘
（上升星座Lagna、月亮星座Rashi、太阳星座，主要行星位置）

## 二、上升星座深解
（Lagna的特质，对外表、性格、人生方向的影响）

## 三、月亮星座与Nakshatra
（月亮所在星座，所在的27宿是哪一宿，深度解读）

## 四、Vimshottari大运周期
（当前处于哪个行星大运，2026年是哪个小运，影响分析）

## 五、事业与财富（第二宫、第十宫分析）
（吠陀命理揭示的职业天赋、财富积累、适合行业）

## 六、感情与婚姻（第七宫分析）
（感情模式，婚姻时机，理想伴侣特质）

## 七、健康（第六宫、第八宫分析）
（健康隐患，需要注意的时期，阿育吠陀建议）

## 八、2026年行星运势
（木星、土星过境对命主的具体影响，吉凶月份）

## 九、宝石疗愈推荐
（根据命盘推荐的宝石（Ratna），颜色，金属，开运方法）

## 十、曼陀罗与修行建议
（对应的神明、咒语、斋戒日、推荐的冥想方式）`;

function callDeepSeek(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 12000,
      temperature: 0.75,
      stream: false
    });

    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    console.log('🔮 Calling DeepSeek API for Vedic report...');
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`API error: ${JSON.stringify(json.error)}`));
          } else {
            const content = json.choices[0].message.content;
            console.log(`✅ Got ${content.length} characters from DeepSeek`);
            resolve(content);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timed out after 120s'));
    });
    req.write(body);
    req.end();
  });
}

// Convert markdown to HTML
function mdToHtml(md) {
  let html = md
    // Escape HTML entities first (except we want to keep structure)
    // H2 sections → styled section headers
    .replace(/^## (.*?)$/gm, (_, title) => {
      return `</div></section>\n<section class="report-section"><div class="section-inner">\n<h2 class="section-title"><span class="section-title-text">${title}</span></h2>`;
    })
    // H3
    .replace(/^### (.*?)$/gm, '<h3 class="sub-title">$1</h3>')
    // H4
    .replace(/^#### (.*?)$/gm, '<h4 class="mini-title">$1</h4>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists — collect consecutive lines
    .replace(/^[-•] (.*)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.*)$/gm, '<li class="numbered">$1</li>')
    // Horizontal rules
    .replace(/^---+$/gm, '<div class="section-divider"><svg viewBox="0 0 200 20" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="10" x2="80" y2="10" stroke="#c9a84c" stroke-width="1" opacity="0.5"/><polygon points="100,2 110,10 100,18 90,10" fill="#c9a84c" opacity="0.7"/><line x1="120" y1="10" x2="200" y2="10" stroke="#c9a84c" stroke-width="1" opacity="0.5"/></svg></div>')
    // Paragraphs — blank lines become paragraph breaks
    .replace(/\n\n+/g, '</p>\n<p class="body-text">');

  // Wrap li elements in ul
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="vedic-list">${match}</ul>`);

  // Wrap plain text in paragraphs
  html = `<p class="body-text">${html}</p>`;

  return html;
}

function buildHtml(markdownContent) {
  const bodyHtml = mdToHtml(markdownContent);

  // Clean up empty sections created by our replacements
  const cleanedBody = bodyHtml
    .replace(/<\/div><\/section>\s*<section[^>]*><div[^>]*>\s*<p[^>]*><\/p>/g, '</div></section>\n<section class="report-section"><div class="section-inner">')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/<p[^>]*>\s*(<h[234])/g, '$1')
    .replace(/(<\/h[234]>)\s*<\/p>/g, '$1');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>人生报告 · 吠陀占星 | Karen · 1991.10.04</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Cinzel:wght@400;600;700&family=Noto+Sans+SC:wght@300;400&display=swap');

  :root {
    --bg-deep:    #0e0c08;
    --bg-surface: #1c1710;
    --bg-card:    #221e12;
    --bg-card2:   #2a2416;
    --gold:       #c9a84c;
    --gold-light: #e8c96a;
    --gold-dim:   #7a6128;
    --gold-glow:  rgba(201,168,76,0.18);
    --text-main:  #f0e6cc;
    --text-muted: #9a8a6a;
    --text-dim:   #5a4e36;
    --ruby:       #b5445a;
    --sapphire:   #4a6eb5;
    --emerald:    #3a8a5a;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg-deep);
    color: var(--text-main);
    font-family: 'Noto Sans SC', sans-serif;
    font-weight: 300;
    line-height: 1.9;
    min-height: 100vh;
  }

  /* ── Starfield background ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 20% 80%, rgba(74,110,181,0.05) 0%, transparent 60%),
      radial-gradient(ellipse 30% 30% at 80% 20%, rgba(181,68,90,0.04) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Cover ── */
  .cover {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
    overflow: hidden;
    z-index: 1;
  }

  .cover::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 60% at 50% 40%, rgba(201,168,76,0.10) 0%, transparent 70%);
  }

  .cover-mandala {
    position: absolute;
    width: 600px;
    height: 600px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.04;
    background: conic-gradient(
      from 0deg,
      transparent 0deg 30deg, var(--gold) 30deg 32deg,
      transparent 32deg 60deg, var(--gold) 60deg 62deg,
      transparent 62deg 90deg, var(--gold) 90deg 92deg,
      transparent 92deg 120deg, var(--gold) 120deg 122deg,
      transparent 122deg 150deg, var(--gold) 150deg 152deg,
      transparent 152deg 180deg, var(--gold) 180deg 182deg,
      transparent 182deg 210deg, var(--gold) 210deg 212deg,
      transparent 212deg 240deg, var(--gold) 240deg 242deg,
      transparent 242deg 270deg, var(--gold) 270deg 272deg,
      transparent 272deg 300deg, var(--gold) 300deg 302deg,
      transparent 302deg 330deg, var(--gold) 330deg 332deg,
      transparent 332deg 360deg
    );
    border-radius: 50%;
    animation: rotateSlow 120s linear infinite;
  }

  @keyframes rotateSlow {
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  .cover-icon {
    font-size: 80px;
    display: block;
    margin-bottom: 20px;
    animation: lotusGlow 3s ease-in-out infinite;
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 0 20px rgba(201,168,76,0.5));
  }

  @keyframes lotusGlow {
    0%, 100% { filter: drop-shadow(0 0 15px rgba(201,168,76,0.4)); transform: scale(1); }
    50%       { filter: drop-shadow(0 0 35px rgba(201,168,76,0.8)); transform: scale(1.05); }
  }

  .cover-label {
    font-family: 'Cinzel', serif;
    font-size: 11px;
    letter-spacing: 0.4em;
    color: var(--gold-dim);
    text-transform: uppercase;
    margin-bottom: 12px;
    position: relative;
    z-index: 2;
  }

  .cover-title {
    font-family: 'Noto Serif SC', serif;
    font-size: clamp(32px, 6vw, 52px);
    font-weight: 700;
    color: var(--gold-light);
    letter-spacing: 0.1em;
    line-height: 1.3;
    position: relative;
    z-index: 2;
    text-shadow: 0 0 40px rgba(201,168,76,0.4);
    margin-bottom: 8px;
  }

  .cover-subtitle {
    font-family: 'Cinzel', serif;
    font-size: clamp(11px, 2vw, 14px);
    letter-spacing: 0.5em;
    color: var(--gold-dim);
    margin-bottom: 48px;
    position: relative;
    z-index: 2;
  }

  /* Divider line */
  .cover-divider {
    width: 200px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    margin: 0 auto 48px;
    position: relative;
    z-index: 2;
  }

  /* Cover info cards */
  .cover-cards {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
    position: relative;
    z-index: 2;
    margin-bottom: 48px;
  }

  .cover-card {
    background: var(--bg-card);
    border: 1px solid var(--gold-dim);
    border-radius: 12px;
    padding: 20px 28px;
    min-width: 140px;
    position: relative;
    overflow: hidden;
  }

  .cover-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at top, rgba(201,168,76,0.08) 0%, transparent 70%);
  }

  .cover-card-label {
    font-family: 'Cinzel', serif;
    font-size: 9px;
    letter-spacing: 0.3em;
    color: var(--gold-dim);
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  .cover-card-value {
    font-family: 'Noto Serif SC', serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--gold-light);
  }

  .cover-card-sub {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Birth info strip */
  .birth-strip {
    font-size: 12px;
    color: var(--text-muted);
    letter-spacing: 0.15em;
    position: relative;
    z-index: 2;
  }

  /* Scroll indicator */
  .scroll-hint {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0.4;
    animation: bounce 2s ease-in-out infinite;
    z-index: 2;
  }

  .scroll-hint span {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--gold);
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
  }

  .scroll-hint::after {
    content: '';
    display: block;
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, var(--gold), transparent);
  }

  @keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50%       { transform: translateX(-50%) translateY(8px); }
  }

  /* ── Report body ── */
  .report-body {
    position: relative;
    z-index: 1;
    max-width: 860px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* ── Section ── */
  .report-section {
    margin-bottom: 64px;
    position: relative;
  }

  .section-inner {
    background: var(--bg-card);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 16px;
    padding: 40px 44px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s;
  }

  .section-inner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    opacity: 0.6;
  }

  .section-inner::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 60%);
    pointer-events: none;
  }

  .section-inner:hover {
    border-color: rgba(201,168,76,0.4);
    box-shadow: 0 0 40px rgba(201,168,76,0.06);
  }

  /* Section number badge */
  .report-section:not(:first-child) {
    counter-increment: section;
  }

  /* ── Section title ── */
  .section-title {
    font-family: 'Noto Serif SC', serif;
    font-size: clamp(18px, 3vw, 24px);
    font-weight: 700;
    color: var(--gold-light);
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(201,168,76,0.15);
    position: relative;
    z-index: 1;
  }

  .section-title-text {
    position: relative;
  }

  .section-title-text::after {
    content: '';
    position: absolute;
    left: 0; bottom: -17px;
    width: 60px; height: 2px;
    background: var(--gold);
    border-radius: 2px;
  }

  /* ── Sub headings ── */
  .sub-title {
    font-family: 'Noto Serif SC', serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--gold);
    margin: 28px 0 12px;
    position: relative;
    z-index: 1;
    padding-left: 14px;
  }

  .sub-title::before {
    content: '';
    position: absolute;
    left: 0; top: 50%;
    transform: translateY(-50%);
    width: 4px; height: 16px;
    background: var(--gold);
    border-radius: 2px;
    opacity: 0.7;
  }

  .mini-title {
    font-family: 'Noto Serif SC', serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--gold-dim);
    margin: 20px 0 8px;
    position: relative;
    z-index: 1;
  }

  /* ── Body text ── */
  .body-text {
    color: var(--text-main);
    font-size: 15px;
    line-height: 2;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
    opacity: 0.9;
  }

  .body-text strong {
    color: var(--gold-light);
    font-weight: 600;
  }

  .body-text em {
    color: var(--text-muted);
    font-style: normal;
    font-size: 13px;
  }

  /* ── Lists ── */
  .vedic-list {
    list-style: none;
    padding: 0;
    margin: 14px 0 20px;
    position: relative;
    z-index: 1;
  }

  .vedic-list li {
    padding: 10px 16px 10px 32px;
    position: relative;
    color: var(--text-main);
    font-size: 14.5px;
    line-height: 1.8;
    border-bottom: 1px solid rgba(201,168,76,0.06);
    opacity: 0.9;
  }

  .vedic-list li:last-child { border-bottom: none; }

  .vedic-list li::before {
    content: '◆';
    position: absolute;
    left: 8px;
    color: var(--gold-dim);
    font-size: 8px;
    top: 14px;
  }

  .vedic-list li.numbered::before {
    content: counter(li);
  }

  .vedic-list li strong { color: var(--gold-light); }

  /* ── Decorative section divider ── */
  .section-divider {
    text-align: center;
    margin: 32px 0;
    position: relative;
    z-index: 1;
  }

  .section-divider svg {
    width: 200px;
    height: 20px;
    overflow: visible;
  }

  /* ── Footer ── */
  .report-footer {
    text-align: center;
    padding: 48px 24px;
    position: relative;
    z-index: 1;
    border-top: 1px solid rgba(201,168,76,0.1);
    color: var(--text-dim);
    font-size: 12px;
    letter-spacing: 0.15em;
  }

  .report-footer .footer-icon {
    font-size: 32px;
    display: block;
    margin-bottom: 12px;
    opacity: 0.4;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .section-inner { padding: 28px 20px; }
    .cover-cards { gap: 10px; }
    .cover-card { padding: 14px 18px; min-width: 120px; }
  }

  /* ── Print ── */
  @media print {
    body { background: white; color: black; }
    .cover { min-height: auto; }
    .section-inner { border: 1px solid #ccc; box-shadow: none; }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-mandala"></div>

  <span class="cover-label">Jyotish · 吠陀占星</span>
  <span class="cover-icon">🪷</span>
  <h1 class="cover-title">人生报告 · 吠陀占星</h1>
  <div class="cover-subtitle">VEDIC JYOTISH READING</div>

  <div class="cover-divider"></div>

  <div class="cover-cards">
    <div class="cover-card">
      <div class="cover-card-label">Lagna · 上升</div>
      <div class="cover-card-value">处女座</div>
      <div class="cover-card-sub">Virgo · Kanya</div>
    </div>
    <div class="cover-card">
      <div class="cover-card-label">Rashi · 月亮</div>
      <div class="cover-card-value">摩羯座</div>
      <div class="cover-card-sub">Capricorn · Makara</div>
    </div>
    <div class="cover-card">
      <div class="cover-card-label">Sun · 太阳</div>
      <div class="cover-card-value">处女座</div>
      <div class="cover-card-sub">Virgo · Kanya</div>
    </div>
    <div class="cover-card">
      <div class="cover-card-label">Nakshatra · 月宿</div>
      <div class="cover-card-value">牛宿</div>
      <div class="cover-card-sub">Shravana</div>
    </div>
  </div>

  <div class="birth-strip">Karen &nbsp;·&nbsp; 1991年10月5日 &nbsp;·&nbsp; 早上6:00 &nbsp;·&nbsp; 中国广州</div>

  <div class="scroll-hint">
    <span>展开命盘</span>
  </div>
</div>

<!-- REPORT BODY -->
<div class="report-body">
${bodyHtml}
</div>

<!-- FOOTER -->
<footer class="report-footer">
  <span class="footer-icon">🕉️</span>
  <div>सर्वे भवन्तु सुखिनः · 愿众生喜乐</div>
  <div style="margin-top:8px;">善缘 · ShenYuan · 吠陀占星报告 · 2026</div>
</footer>

<script>
// Intersection observer for fade-in sections
const sections = document.querySelectorAll('.report-section');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

sections.forEach(s => {
  s.style.opacity = '0';
  s.style.transform = 'translateY(24px)';
  s.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  io.observe(s);
});
</script>
</body>
</html>`;
}

async function main() {
  try {
    // Call API
    const markdownContent = await callDeepSeek(systemPrompt, userPrompt);

    // Build HTML
    console.log('🎨 Building HTML template...');
    const htmlContent = buildHtml(markdownContent);

    // Save
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, htmlContent, 'utf8');
    console.log(`💾 Saved to: ${OUTPUT_PATH}`);
    console.log(`📄 File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);

    // Open in browser
    exec(`open "${OUTPUT_PATH}"`, (err) => {
      if (err) console.log('⚠️ Could not auto-open. Please open manually.');
      else console.log('🌐 Opened in browser!');
    });

    console.log('\n✨ Vedic astrology report generated successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
