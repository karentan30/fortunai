#!/usr/bin/env node
/**
 * Generate Karen's personal 人生报告 v2 (现代版) via DeepSeek API
 * Bazi: 辛未年 丁酉月 丁未日 癸卯时 · 日主丁火 · 身弱 · 用神木 · 当前庚子大运 · 2026丙午年流年 · 女 · 35岁
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const OUTPUT_PATH = '/Users/karen/projects/shenyuan/docs/karen-人生报告-v2-现代版.html';

const SYSTEM_PROMPT = `你是一位现代命理解读师，风格像Cliff Tan (@dearmodern) ——接地气、讲"为什么"、零神秘腔调。

核心原则：
1. 每个命理术语都必须有方括号内的白话解释。例如：丁火（像烛光一样的能量——温柔但持久）
2. 每个建议都必须有"为什么这样做："的解释
3. 语气像一位聪明的好朋友给真实建议，不是算命先生在背诗
4. 多用列表，少用长段落
5. 建议要具体可执行（例如："2026年3月前签合同更有利" 而不是 "今年运势不错"）
6. 受众是海外华人，可能对风水命理持怀疑态度，需要用现代语言建立信任
7. 全程中文，不要用文言文
8. 输出纯Markdown格式，不要加HTML标签`;

const USER_PROMPT = `请为我（Karen）生成一份完整的个人人生报告，风格现代实用。

我的八字信息（不要重新计算，直接使用）：
- 四柱：辛未年 丁酉月 丁未日 癸卯时
- 日主：丁火
- 格局：身弱
- 用神：木
- 当前大运：庚子大运
- 2026年流年：丙午年
- 性别：女
- 年龄：35岁

请严格按照以下十个章节生成，每章500字以上：

## 一、你是什么样的人 — 丁火性格全解

分析丁火日主的核心性格特征。每个特点都要有括号内的现代解释和实际表现。包括：
- 丁火的本质特征（烛光vs太阳的区别）
- 在职场中的表现
- 在感情中的表现
- 身弱丁火特有的挑战
- 丁未日柱的特殊性格加成（未土的影响）
- 癸卯时柱对性格的修正

## 二、你的能量地图 — 五行强弱与用神

用能量电量比喻解释五行：
- 你的五行能量分布（用直观的比喻，不用数字）
- 为什么身弱（身弱的现实影响是什么）
- 用神为木（木能量如何帮助你）
- 忌神是什么，生活中如何避免
- 庚子大运（2020-2030）的能量状态分析
- 2026丙午年的能量场如何

## 三、事业赛道分析（2020–2035）

- 丁火女性最适合的行业和赛道（列表+为什么）
- 2020-2025年回顾（庚子大运前半段的典型经历模式）
- 2026年事业关键节点（月份级别，具体说明哪些月份适合推进/谨慎）
- 2027-2030年庚子大运收尾（策略建议）
- 2031-2040年辛丑大运预判（为下一个十年做铺垫）
- 丁火女性的贵人类型（具体描述什么样的人是贵人）

## 四、财运密码与理财策略

- 丁火+身弱的财运模式（为什么挣钱方式有规律）
- 哪类收入适合你（主动/被动/创业/打工的分析）
- 庚子大运的财运特点（2020-2030）
- 2026丙午年的财运具体预测（月份级别）
- 投资建议（什么类型的投资适合，什么类型要避开）
- 具体的理财行动清单

## 五、感情模式与桃花时机

- 丁火女性的感情模式（真实的，包括优点和问题）
- 丁未日支对婚姻宫的影响（未土藏干的感情含义）
- 适合你的伴侣类型（具体描述性格、行业、五行）
- 不适合的类型（为什么，用现代心理学语言解释）
- 2026年感情动向（有无桃花？已婚如何经营？）
- 感情最佳窗口期（未来十年哪年最适合推进感情）

## 六、健康信号与身体管理

- 丁火日主的先天体质特点（对应什么器官系统）
- 身弱的人最常见的身体信号
- 庚子大运对健康的影响
- 2026丙午年需要特别注意的健康风险
- 具体的养生行动方案（食物/运动/睡眠/情绪管理）
- 什么情况下是警报信号，需要马上调整

## 七、2026年月份行动指南（逐月）

按月份给出具体建议，每月包括：
- 能量状态（用1-10分或比喻）
- 事业动作建议
- 人际/感情注意点
- 健康提醒

涵盖2026年1月至12月，特别详细标注关键转折点月份。

## 八、未来十年路线图（2026–2035）

- 2026年：当下该做什么准备
- 2027-2030年：庚子大运收尾期策略
- 2031-2035年：辛丑大运开启，新周期特征
- 每个阶段的核心任务（1-3条）
- 需要避开的坑（每阶段1-2个）

## 九、你的开运工具箱

以下每条都必须有"为什么这样做："解释：
- 颜色选择（哪些颜色能量对你好，为什么）
- 方位（家里/办公室的有利方位，背后的逻辑）
- 植物/植被（为什么植物=木=用神）
- 数字与时间（幸运数字的五行逻辑）
- 社交能量管理（应该多接触什么类型的人）
- 每日/每周的能量充电习惯

## 十、给你的真心话

这是最重要的一章。用第一人称"你"和Karen对话，像一个了解她很深的朋友：
- 你在35岁这个节点，最核心的课题是什么
- 你的最大优势，很多人看不到但你有
- 你容易陷入的模式/陷阱（直说，不客套）
- 接下来五年最值得投入精力的三件事
- 一段真心话收尾（不要诗，要真实）

请开始生成，保持现代风格，每章都要有具体可操作的建议。`;

function callDeepSeek(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 13000,
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
        if (res.statusCode !== 200) {
          reject(new Error(`API error ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.choices[0].message.content);
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

function mdToHtml(md) {
  let html = md;
  // Escape any existing HTML (just in case)
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Unordered lists
  html = html.replace(/^((?:- .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      return `<li>${line.replace(/^- /, '')}</li>`;
    }).join('\n');
    return `<ul>\n${items}\n</ul>\n`;
  });
  // Ordered lists
  html = html.replace(/^((?:\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      return `<li>${line.replace(/^\d+\. /, '')}</li>`;
    }).join('\n');
    return `<ol>\n${items}\n</ol>\n`;
  });
  // Paragraphs: wrap lines that aren't already wrapped in tags
  const lines = html.split('\n');
  const processed = [];
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
      continue;
    }
    if (/^<(h[1-6]|ul|ol|li|hr|blockquote|table|tr|th|td)/.test(trimmed)) {
      processed.push(trimmed);
    } else {
      processed.push(`<p>${trimmed}</p>`);
    }
  }
  html = processed.join('\n');
  return html;
}

function buildHtml(content) {
  const htmlContent = mdToHtml(content);
  const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善缘 · Karen人生报告 · 现代解读版</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background:#1c1710;
  color:rgba(245,235,215,0.95);
  font-family:-apple-system,'PingFang SC','Helvetica Neue','STSong','Georgia',serif;
  max-width:820px;
  margin:0 auto;
  padding:48px 36px;
  font-size:16px;
  line-height:2.0;
}

/* Cover */
.cover {
  text-align:center;
  padding:60px 0 48px;
  border-bottom:1px solid rgba(201,168,76,0.15);
  margin-bottom:48px;
}
.cover-icon {
  font-size:56px;
  margin-bottom:20px;
  display:block;
  filter:drop-shadow(0 0 24px rgba(201,168,76,0.4));
}
.cover h1 {
  font-size:26px;
  color:#c9a84c;
  font-weight:300;
  letter-spacing:8px;
  margin-bottom:12px;
  text-align:center;
  border:none;
  padding:0;
}
.cover .subtitle {
  color:rgba(201,168,76,0.55);
  font-size:13px;
  letter-spacing:3px;
  margin-bottom:16px;
}
.cover .bazi-info {
  display:inline-block;
  background:rgba(201,168,76,0.07);
  border:1px solid rgba(201,168,76,0.2);
  border-radius:12px;
  padding:14px 28px;
  font-size:13px;
  color:rgba(245,235,215,0.65);
  letter-spacing:1px;
  line-height:1.9;
}
.cover .bazi-info strong {
  color:#c9a84c;
}

/* Typography */
h1 {
  font-size:22px;
  color:#c9a84c;
  font-weight:400;
  margin:48px 0 16px;
  letter-spacing:3px;
  text-align:center;
  border:none;
}
h2 {
  font-size:19px;
  color:#c9a84c;
  font-weight:500;
  margin:40px 0 14px;
  letter-spacing:2px;
  padding:12px 16px;
  background:rgba(201,168,76,0.05);
  border-left:3px solid #c9a84c;
  border-radius:0 8px 8px 0;
}
h3 {
  font-size:16px;
  color:rgba(201,168,76,0.9);
  font-weight:500;
  margin:24px 0 10px;
  letter-spacing:1px;
}
h4 {
  font-size:15px;
  color:rgba(201,168,76,0.7);
  font-weight:500;
  margin:18px 0 8px;
}
p {
  margin-bottom:14px;
  color:rgba(245,235,215,0.9);
}
ul, ol {
  padding-left:24px;
  margin-bottom:16px;
}
li {
  margin-bottom:8px;
  color:rgba(245,235,215,0.88);
  line-height:1.85;
}
strong {
  color:#c9a84c;
  font-weight:600;
}
em {
  color:rgba(245,235,215,0.7);
  font-style:italic;
}
blockquote {
  border-left:3px solid rgba(201,168,76,0.35);
  padding:14px 20px;
  margin:20px 0;
  background:rgba(201,168,76,0.04);
  color:rgba(245,235,215,0.75);
  font-style:italic;
  border-radius:0 8px 8px 0;
}
hr {
  border:none;
  border-top:1px solid rgba(201,168,76,0.12);
  margin:36px 0;
}

/* Chapter divider */
.chapter-divider {
  display:flex;
  align-items:center;
  gap:16px;
  margin:48px 0 0;
}
.chapter-divider::before,
.chapter-divider::after {
  content:'';
  flex:1;
  height:1px;
  background:linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent);
}

/* Callout boxes */
.tip-box {
  background:rgba(201,168,76,0.06);
  border:1px solid rgba(201,168,76,0.2);
  border-radius:10px;
  padding:16px 20px;
  margin:18px 0;
}
.tip-box::before {
  content:'💡 ';
}

/* Month table style */
table {
  width:100%;
  border-collapse:collapse;
  margin:16px 0;
  font-size:14px;
}
th {
  background:rgba(201,168,76,0.1);
  color:#c9a84c;
  padding:10px 12px;
  text-align:left;
  font-weight:500;
  border-bottom:1px solid rgba(201,168,76,0.2);
}
td {
  padding:9px 12px;
  border-bottom:1px solid rgba(201,168,76,0.07);
  color:rgba(245,235,215,0.85);
  vertical-align:top;
}
tr:last-child td { border-bottom:none; }

/* Footer */
.footer {
  text-align:center;
  color:rgba(245,235,215,0.2);
  font-size:12px;
  margin-top:64px;
  padding-top:28px;
  border-top:1px solid rgba(201,168,76,0.1);
  letter-spacing:2px;
}

/* Badge */
.badge {
  display:inline-block;
  background:rgba(201,168,76,0.1);
  border:1px solid rgba(201,168,76,0.25);
  border-radius:20px;
  padding:4px 12px;
  font-size:12px;
  color:rgba(201,168,76,0.8);
  margin:3px 4px;
  letter-spacing:0.5px;
}

/* Score meter */
.score {
  display:inline-block;
  font-weight:700;
  color:#c9a84c;
  font-size:18px;
}

/* Highlight block */
.highlight {
  background:linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.04));
  border:1px solid rgba(201,168,76,0.18);
  border-radius:12px;
  padding:20px 24px;
  margin:20px 0;
}

@media (max-width: 600px) {
  body { padding:28px 20px; }
  h2 { font-size:17px; }
  .cover h1 { font-size:22px; letter-spacing:4px; }
  .cover-icon { font-size:44px; }
}
</style>
</head>
<body>

<div class="cover">
  <span class="cover-icon">🕯️</span>
  <h1>人生报告 · 现代解读版</h1>
  <div class="subtitle">善缘命理 · 个人定制报告</div>
  <div class="bazi-info">
    <strong>四柱</strong>：辛未年 丁酉月 丁未日 癸卯时<br>
    <strong>日主</strong>：丁火 · <strong>格局</strong>：身弱 · <strong>用神</strong>：木<br>
    <strong>当前大运</strong>：庚子大运 · <strong>流年</strong>：2026丙午年<br>
    <strong>性别</strong>：女 · <strong>年龄</strong>：35岁
  </div>
</div>

<div id="content">
${htmlContent}
</div>

<div class="footer">
  善缘命理 · ShenYuan · 个人专属报告 · ${now}<br>
  本报告基于中国传统命理学，仅供参考，不构成任何决策依据
</div>

</body>
</html>`;
}

async function main() {
  console.log('🕯️  正在调用 DeepSeek API 生成Karen人生报告...');
  console.log('   模型: deepseek-chat | 最大Token: 13000 | 预计耗时: 60-90秒');
  console.log('');

  const startTime = Date.now();

  try {
    const content = await callDeepSeek(SYSTEM_PROMPT, USER_PROMPT);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ API响应成功 (${elapsed}秒)`);
    console.log(`   内容长度: ${content.length} 字符`);

    // Save raw markdown for debugging
    const mdPath = OUTPUT_PATH.replace('.html', '.md');
    fs.writeFileSync(mdPath, content, 'utf8');
    console.log(`📝 原始Markdown已保存: ${mdPath}`);

    // Build HTML
    const html = buildHtml(content);
    fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
    console.log(`✅ HTML报告已保存: ${OUTPUT_PATH}`);

    // Open in browser
    try {
      execSync(`open "${OUTPUT_PATH}"`);
      console.log('🌐 已在浏览器中打开');
    } catch (e) {
      console.log('(无法自动打开浏览器，请手动打开上述文件)');
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();
