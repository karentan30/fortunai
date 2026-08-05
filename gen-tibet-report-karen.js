#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const SYSTEM_PROMPT = `你是一位精通藏历命理与藏传佛教占星的大师，深度研究三十年，融合中国天文历法与印度占星传统。
语言：简体中文。格式：Markdown。总字数：7000字以上。
藏历命理体系包含：十二生肖（与中国相同）、五行（土火水木金）、九宫数字（九宫飞星）、帕巴（pakpa）、拉（la）等要素。`;

const USER_PROMPT = `命主：1991年10月5日出生，女性，早上6点。藏历铁羊年。

请给出完整的藏历命理报告：

## 一、藏历命盘总览
（生肖属相、元素、九宫数、帕巴、拉的基本信息）

## 二、本命生肖深解 — 铁羊
（羊的深层含义，铁元素加持的特质，性格、天赋、弱点）

## 三、九宫数解读
（命主的九宫数是多少，对应的能量特质）

## 四、藏传佛教命理 — 今生业力与使命
（根据藏历揭示的灵魂课题，前世痕迹，今生修行方向）

## 五、事业与财富运势
（藏历揭示的职业天赋，财富积累方式，适合的行业）

## 六、感情与姻缘
（藏历配对法则，最佳匹配生肖，感情模式）

## 七、健康与长寿分析
（藏医结合命理的健康建议，需要注意的身体部位）

## 八、2026年藏历运势
（火马年（藏历）的能量分析，今年吉凶月份）

## 九、护法神与守护修行
（对应的藏传佛教守护神，推荐的咒语、法器、开光物品）

## 十、藏密开运指引
（唐卡推荐、水晶、香薰、颜色、方位，藏传佛教式的日常修行）`;

function callDeepSeek(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 12000,
      temperature: 0.75,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
          } else {
            resolve(json.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(180000, () => {
      req.destroy(new Error('Request timed out after 180s'));
    });
    req.write(body);
    req.end();
  });
}

function markdownToHtml(md) {
  return md
    // H2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // H4
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]+?<\/li>)(\n(?!<li>))/g, (m, list) => `<ul>${list}</ul>\n`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/^(?!<[hul]|<li|<hr|<strong|<em)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Fix nested ul wrapping
    .replace(/(<\/li>\n<li>)/g, '</li>\n<li>');
}

function buildHtml(markdownContent) {
  const bodyHtml = markdownToHtml(markdownContent);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>人生报告 · 藏历命理</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --gold: #c9a84c;
      --gold-light: #e8c96e;
      --gold-dim: #8a6a28;
      --bg: #1c1710;
      --bg2: #221e12;
      --bg3: #2a2414;
      --text: #e8d9b8;
      --text-dim: #b8a888;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Noto Serif SC', 'Songti SC', serif;
      line-height: 1.9;
      font-size: 16px;
    }

    /* ── Cover ── */
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      text-align: center;
      background: radial-gradient(ellipse at 50% 30%, #2e2412 0%, var(--bg) 70%);
      border-bottom: 1px solid #c9a84c33;
      position: relative;
      overflow: hidden;
    }

    .cover::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      opacity: 0.4;
    }

    .cover-icon {
      font-size: 72px;
      margin-bottom: 24px;
      filter: drop-shadow(0 0 30px #c9a84c66);
      position: relative;
    }

    .cover-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 13px;
      letter-spacing: 6px;
      color: var(--gold);
      opacity: 0.7;
      text-transform: uppercase;
      margin-bottom: 16px;
      position: relative;
    }

    .cover-title {
      font-size: 42px;
      font-weight: 600;
      color: var(--gold-light);
      letter-spacing: 8px;
      margin-bottom: 12px;
      position: relative;
      text-shadow: 0 0 60px #c9a84c44;
    }

    .cover-subtitle {
      font-family: 'Cormorant Garamond', serif;
      font-size: 16px;
      font-style: italic;
      color: var(--gold);
      opacity: 0.6;
      letter-spacing: 3px;
      margin-bottom: 40px;
      position: relative;
    }

    .divider {
      width: 200px;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--gold), transparent);
      margin: 0 auto 40px;
      position: relative;
    }

    .divider::before {
      content: '✦';
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      color: var(--gold);
      font-size: 12px;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      max-width: 680px;
      width: 100%;
      position: relative;
    }

    .meta-item {
      background: #ffffff08;
      border: 1px solid #c9a84c22;
      border-radius: 8px;
      padding: 20px 16px;
    }

    .meta-label {
      font-size: 11px;
      letter-spacing: 3px;
      color: var(--gold);
      opacity: 0.6;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .meta-value {
      font-size: 17px;
      font-weight: 600;
      color: var(--gold-light);
      letter-spacing: 1px;
    }

    /* ── Content ── */
    .content {
      max-width: 860px;
      margin: 0 auto;
      padding: 80px 40px 100px;
    }

    h2 {
      font-size: 26px;
      font-weight: 600;
      color: var(--gold-light);
      letter-spacing: 3px;
      margin: 64px 0 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #c9a84c33;
      position: relative;
    }

    h2::before {
      content: '◆';
      color: var(--gold);
      margin-right: 12px;
      font-size: 14px;
      opacity: 0.7;
    }

    h3 {
      font-size: 19px;
      font-weight: 600;
      color: var(--gold);
      letter-spacing: 1px;
      margin: 36px 0 14px;
    }

    h4 {
      font-size: 16px;
      color: var(--gold-dim);
      letter-spacing: 1px;
      margin: 24px 0 10px;
      font-weight: 600;
    }

    p {
      margin-bottom: 18px;
      color: var(--text);
      line-height: 2;
    }

    strong {
      color: var(--gold-light);
      font-weight: 600;
    }

    em {
      color: var(--text-dim);
      font-style: italic;
    }

    ul, ol {
      margin: 16px 0 20px 24px;
    }

    li {
      margin-bottom: 10px;
      color: var(--text);
      line-height: 1.9;
    }

    li::marker {
      color: var(--gold);
    }

    hr {
      border: none;
      border-top: 1px solid #c9a84c22;
      margin: 40px 0;
    }

    blockquote {
      border-left: 3px solid var(--gold);
      margin: 24px 0;
      padding: 16px 24px;
      background: #c9a84c0a;
      border-radius: 0 8px 8px 0;
      color: var(--text-dim);
      font-style: italic;
    }

    /* Highlight box */
    .highlight-box {
      background: #c9a84c0d;
      border: 1px solid #c9a84c33;
      border-radius: 10px;
      padding: 24px 28px;
      margin: 28px 0;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0 32px;
      font-size: 14px;
    }

    th {
      background: #2a2010;
      color: var(--gold);
      padding: 12px 16px;
      text-align: left;
      border: 1px solid #c9a84c44;
      font-weight: 600;
      letter-spacing: 1px;
    }

    td {
      padding: 10px 16px;
      border: 1px solid #c9a84c22;
      color: var(--text);
      vertical-align: top;
      line-height: 1.8;
    }

    tr:nth-child(even) td {
      background: #201c12;
    }

    tr:hover td {
      background: #2a2414;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 40px;
      border-top: 1px solid #c9a84c22;
      font-size: 12px;
      color: var(--gold);
      opacity: 0.4;
      letter-spacing: 3px;
    }

    @media (max-width: 640px) {
      .cover-title { font-size: 28px; }
      .cover-meta { grid-template-columns: 1fr 1fr; }
      .content { padding: 40px 20px 60px; }
      h2 { font-size: 20px; }
    }

    @media print {
      body { background: #fff; color: #1a1a1a; }
      h2 { color: #8B6914; border-bottom-color: #c9a84c55; }
      strong { color: #7a5c1e; }
    }
  </style>
</head>
<body>

  <div class="cover">
    <div class="cover-icon">🏔️</div>
    <div class="cover-label">Personal Destiny Report · 个人定制</div>
    <div class="cover-title">人生报告 · 藏历命理</div>
    <div class="cover-subtitle">TIBETAN ASTROLOGY READING</div>
    <div class="divider"></div>
    <div class="cover-meta">
      <div class="meta-item">
        <div class="meta-label">出生日期</div>
        <div class="meta-value">1991年10月5日</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">藏历年份</div>
        <div class="meta-value">铁羊年 · 辛未</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">出生时辰</div>
        <div class="meta-value">卯时 · 清晨</div>
      </div>
    </div>
    <div class="divider" style="margin-top: 40px; margin-bottom: 0;"></div>
    <p style="margin-top: 28px; font-size: 12px; opacity: 0.4; letter-spacing: 3px; position: relative;">2026 · 善缘 ShenYuan · 藏历命理研究</p>
  </div>

  <div class="content">
    ${bodyHtml}
  </div>

  <div class="footer">
    善缘 ShenYuan · 藏历命理报告 · 2026年8月
  </div>

</body>
</html>`;
}

async function main() {
  console.log('🏔️  Generating Tibetan Astrology Report for Karen...');
  console.log('Calling DeepSeek API (this may take 90-120 seconds)...\n');

  const startTime = Date.now();
  const content = await callDeepSeek(SYSTEM_PROMPT, USER_PROMPT);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ API response received in ${elapsed}s`);
  console.log(`Content length: ${content.length} chars (~${Math.round(content.length/2)} Chinese chars)`);

  const html = buildHtml(content);

  const outputPath = '/Users/karen/projects/shenyuan/docs/karen-人生报告-西藏.html';
  fs.writeFileSync(outputPath, html, 'utf8');

  const size = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log(`File size: ${size} KB`);

  // Open in browser
  try {
    execSync(`open "${outputPath}"`);
    console.log('📖 Opened in browser');
  } catch (e) {
    console.log('Note: Could not auto-open browser:', e.message);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
