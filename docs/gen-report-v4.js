#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a senior strategic consultant with deep expertise in Chinese BaZi metaphysics AND modern business strategy. You combine McKinsey-style analytical frameworks with authentic BaZi wisdom. Your reports are data-driven, strategic, and actionable — not vague fortune-telling. You speak directly, use concrete timelines, and back every recommendation with BaZi logic explained in business terms.`;

const USER_PROMPT = `请为以下命主生成一份完整的《人生战略报告》，风格如同麦肯锡顾问 + 资深八字命理师的结合。

命主信息：
- 四柱：辛未年 丁酉月 丁未日 癸卯时
- 日主：丁火（身弱）
- 用神：木
- 当前大运：庚子大运
- 2026年流年：丙午年
- 性别：女
- 年龄：35岁

请按以下章节生成，每章需要：
- 具体、战略性的分析
- 使用商业框架（SWOT、时间线、优先级排序）
- 具体日期和行动建议
- 表格和要点列表
- 商业隐喻解释命理逻辑

章节：

## 一、命主核心竞争力分析 — 丁火特质的商业价值
分析丁火日主的核心特质，转化为商业竞争力。包括：天赋优势、差异化能力、最适合的商业模式。

## 二、五行资产负债表 — 优势、弱点、机会、威胁
用SWOT框架分析五行格局。资产（用神、喜神）、负债（忌神、仇神）、机会窗口、风险点。制作表格。

## 三、事业战略路线图（2020–2040）
按大运分段，每个阶段的战略重点、机会窗口、应避免的决策。重点分析当前庚子大运和下一个辛丑大运。

## 四、财富积累策略
根据八字财星分析，制定具体的财富积累路径。哪些行业、哪些时间点、哪种财富模式最适合。

## 五、关系管理与合作伙伴选择
用神、喜神对应的合作伙伴特质。如何选择商业伙伴、投资人、核心团队。婚姻/感情中的战略考量。

## 六、健康风险管理
五行对应身体系统的风险分析。具体的预防建议和注意时间点。

## 七、2026年行动计划（按季度）
2026丙午流年，季度级别的具体行动计划。Q1/Q2/Q3/Q4分别的战略重点、机会和风险。

## 八、2027–2035年十年路线图
关键年份分析：哪些年是爆发年、哪些年是整合年、哪些年是风险年。具体建议。

## 九、开运工具与环境优化
基于用神木，给出具体的环境、颜色、方位、行业建议。不要玄学，用实际可操作的角度解释。

## 十、战略建议总结
TOP 10优先行动清单，按影响力排序。

格式要求：
- 使用Markdown格式（##标题、表格、列表）
- 每章至少500字
- 表格用标准Markdown格式
- 具体、可执行，避免模糊语言
- 商业隐喻贯穿全文`;

function callDeepSeek(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 13000,
      temperature: 0.65,
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`API Error: ${JSON.stringify(parsed.error)}`));
          } else {
            resolve(parsed.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timeout after 120s'));
    });
    req.write(body);
    req.end();
  });
}

// Convert markdown to HTML
function mdToHtml(md) {
  let html = md;

  // Escape HTML entities first (except we want to keep structure)
  // Tables - process before other things
  html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
    const rows = tableBlock.trim().split('\n');
    if (rows.length < 2) return tableBlock;

    let tableHtml = '<table>\n';
    rows.forEach((row, i) => {
      // Skip separator rows like |---|---|
      if (/^\|[\s\-:]+\|/.test(row) && row.replace(/[\|\s\-:]/g, '').length === 0) return;

      const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = (i === 0) ? 'th' : 'td';
      tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>\n';
    });
    tableHtml += '</table>\n';
    return tableHtml;
  });

  // Headings
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists — group consecutive lines
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^[-*] /, '').trim());
    return '<ul>\n' + items.map(i => `<li>${i}</li>`).join('\n') + '\n</ul>\n';
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^\d+\. /, '').trim());
    return '<ol>\n' + items.map(i => `<li>${i}</li>`).join('\n') + '\n</ol>\n';
  });

  // Paragraphs — wrap lines that aren't already HTML tags
  const lines = html.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      result.push('');
    } else if (/^<[ht]/.test(line) || /^<ul|^<ol|^<li|^<tr|^<table|^<\//.test(line)) {
      result.push(line);
    } else if (line.length > 0) {
      result.push(`<p>${line}</p>`);
    }
    i++;
  }
  html = result.join('\n');

  return html;
}

function buildHtml(content) {
  const bodyHtml = mdToHtml(content);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>人生战略报告 · 战略版</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #1c1710;
      color: #e8d9b8;
      font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Serif SC', Georgia, serif;
      line-height: 1.85;
      font-size: 16px;
    }

    /* Cover */
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: radial-gradient(ellipse at center, #2a2010 0%, #1c1710 70%);
      border-bottom: 1px solid #c9a84c44;
      padding: 60px 40px;
    }

    .cover-icon {
      font-size: 72px;
      margin-bottom: 32px;
      filter: drop-shadow(0 0 20px #c9a84c88);
    }

    .cover-label {
      font-size: 12px;
      letter-spacing: 6px;
      color: #c9a84c;
      text-transform: uppercase;
      margin-bottom: 20px;
      opacity: 0.8;
    }

    .cover-title {
      font-size: 42px;
      font-weight: 700;
      color: #c9a84c;
      letter-spacing: 4px;
      margin-bottom: 12px;
      text-shadow: 0 0 30px #c9a84c44;
    }

    .cover-subtitle {
      font-size: 18px;
      color: #e8d9b8;
      opacity: 0.75;
      margin-bottom: 48px;
      letter-spacing: 2px;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      max-width: 600px;
      margin-bottom: 48px;
    }

    .meta-item {
      text-align: center;
    }

    .meta-label {
      font-size: 11px;
      color: #c9a84c;
      letter-spacing: 2px;
      opacity: 0.7;
      margin-bottom: 6px;
    }

    .meta-value {
      font-size: 15px;
      color: #e8d9b8;
    }

    .divider {
      width: 120px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a84c, transparent);
      margin: 0 auto;
    }

    /* Main content */
    .content {
      max-width: 860px;
      margin: 0 auto;
      padding: 60px 40px 100px;
    }

    h2 {
      font-size: 26px;
      color: #c9a84c;
      font-weight: 700;
      margin: 64px 0 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #c9a84c33;
      letter-spacing: 1px;
    }

    h2:first-of-type {
      margin-top: 0;
    }

    h3 {
      font-size: 19px;
      color: #d4b86a;
      font-weight: 600;
      margin: 36px 0 14px;
      letter-spacing: 0.5px;
    }

    h4 {
      font-size: 16px;
      color: #c9a84c;
      font-weight: 600;
      margin: 24px 0 10px;
      opacity: 0.9;
    }

    p {
      margin: 12px 0;
      color: #e8d9b8;
      line-height: 1.9;
    }

    ul, ol {
      margin: 14px 0 14px 24px;
    }

    li {
      margin: 7px 0;
      color: #e8d9b8;
      line-height: 1.8;
    }

    li::marker {
      color: #c9a84c;
    }

    strong {
      color: #f0e0b0;
      font-weight: 700;
    }

    em {
      color: #d4b86a;
      font-style: italic;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 14px;
    }

    th {
      background: #2a2010;
      color: #c9a84c;
      padding: 12px 16px;
      text-align: left;
      border: 1px solid #c9a84c44;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 16px;
      border: 1px solid #c9a84c22;
      color: #e8d9b8;
      vertical-align: top;
      line-height: 1.7;
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
      color: #c9a84c;
      opacity: 0.5;
      letter-spacing: 2px;
    }

    /* Print */
    @media print {
      body { background: white; color: #1a1a1a; }
      .cover { min-height: auto; }
      h2 { color: #8B6914; }
      th { background: #f5f0e0; color: #8B6914; }
    }

    @media (max-width: 640px) {
      .cover-title { font-size: 28px; }
      .cover-meta { grid-template-columns: 1fr 1fr; }
      .content { padding: 40px 20px 60px; }
      h2 { font-size: 22px; }
    }
  </style>
</head>
<body>

  <div class="cover">
    <div class="cover-icon">🕯️</div>
    <div class="cover-label">Strategic Life Report · 战略版</div>
    <div class="cover-title">人生战略报告</div>
    <div class="cover-subtitle">四柱命理 × 战略咨询 · 个人定制版</div>
    <div class="divider" style="margin-bottom: 40px;"></div>
    <div class="cover-meta">
      <div class="meta-item">
        <div class="meta-label">四柱</div>
        <div class="meta-value">辛未 · 丁酉 · 丁未 · 癸卯</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">日主 · 格局</div>
        <div class="meta-value">丁火 · 身弱</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">当前大运</div>
        <div class="meta-value">庚子大运</div>
      </div>
    </div>
    <div class="divider"></div>
    <p style="margin-top: 32px; font-size: 13px; opacity: 0.45; letter-spacing: 2px;">2026 · 版本 V4</p>
  </div>

  <div class="content">
    ${bodyHtml}
  </div>

  <div class="footer">
    善缘 ShenYuan · 人生战略报告 V4 · 2026年8月
  </div>

</body>
</html>`;
}

async function main() {
  console.log('Calling DeepSeek API...');
  console.log('This may take 60-90 seconds for a long report...');

  const startTime = Date.now();
  const content = await callDeepSeek(SYSTEM_PROMPT, USER_PROMPT);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`API response received in ${elapsed}s`);
  console.log(`Content length: ${content.length} chars`);

  const html = buildHtml(content);

  const outputPath = path.join(__dirname, 'karen-人生报告-v4-战略版.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log(`\nSaved to: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

  // Also save raw markdown for reference
  const mdPath = path.join(__dirname, 'karen-人生报告-v4-raw.md');
  fs.writeFileSync(mdPath, content, 'utf8');
  console.log(`Raw markdown saved to: ${mdPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
