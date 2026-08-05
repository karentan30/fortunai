#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const systemPrompt = `你是一位精通子平八字的命理大师，有三十年实战经验，服务过数千名客户。
语言：简体中文。格式：Markdown。总字数：9000字以上，每章600字以上。
当前年份：2026年（丙午年），命主现年35岁。

【重要】以下是命主的精确排盘结果，由万年历算法计算，请严格使用，不得自行推算：
四柱：辛未年 丁酉月 丁未日 癸卯时
日主：丁火（阴火）·身弱·用神为木（甲乙）·喜火·忌水金
大运：戊戌(1-10)→己亥(11-20)→庚子(21-30)→辛丑(31-40)→壬寅(41-50)→癸卯(51-60)
当前：庚子大运(2021-2030)·2026丙午年流年

丁火特质：如烛光，温柔坚韧，善于照亮他人，有艺术天赋和洞察力，情感细腻。
身弱丁火：需要木来生火，忌金水克制。`;

const userPrompt = `我是1991年农历8月29日（公历10月5日）卯时出生的女性，想要一份完整的人生命理分析报告。

请完整展开以下章节，每章600字以上，总计9000字以上：

## 一、命盘总览与命主特质
（丁火日主的性格特质、天赋、人生底色，结合辛未年生、酉月、卯时分析）

## 二、五行格局与用神喜忌
（五行强弱分析，用神为何，什么颜色/方位/行业适合，什么要避开）

## 三、事业运势分析（2020–2040）
（庚子大运、辛丑大运各自对事业的影响，最适合的行业/职位，2026年事业特点）

## 四、财运格局与理财建议
（丁火财星为金，身弱用神木——财运如何，理财方向，2026年财运关键）

## 五、感情婚姻分析
（桃花星分析，感情模式，何时最旺桃花，婚姻质量判断，2026年感情状态）

## 六、健康与养生提示
（丁火身弱的健康隐患，需要注意的器官，养生建议，2026年注意事项）

## 七、2026年丙午年全年运势
（流年天干地支对命主的具体影响，月份运势高低，重要时间节点）

## 八、大运流年2027–2035年预览
（未来十年每年简要分析，哪几年是人生高峰期）

## 九、开运锦囊
（具体开运方法：幸运颜色、幸运数字、开运方位、推荐佩戴物、适合居住城市方向）

## 十、命理师的叮嘱
（给这位丁火女性的真心话，关于她的人生方向和注意事项，温暖而真实，500字以上）`;

const requestBody = JSON.stringify({
  model: 'deepseek-chat',
  max_tokens: 14000,
  temperature: 0.72,
  stream: false,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
});

console.log('Calling DeepSeek API...');

const options = {
  hostname: 'api.deepseek.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('API response status:', res.statusCode);

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse response:', data.slice(0, 500));
      process.exit(1);
    }

    if (parsed.error) {
      console.error('API error:', JSON.stringify(parsed.error));
      process.exit(1);
    }

    const mdText = parsed.choices?.[0]?.message?.content || '';
    console.log(`Raw response length: ${mdText.length} chars`);

    // === AutoQC ===
    // Remove garbled chars
    let clean = mdText
      .replace(/[​-‏﻿�]/g, '')
      .trim();

    // Check key terms
    if (!clean.includes('丁火') && !clean.includes('丁未')) {
      console.warn('WARNING: 丁火/丁未 not found in response!');
    } else {
      console.log('QC PASS: 丁火/丁未 found');
    }

    // Word count (approximate by char count for CJK)
    const charCount = clean.replace(/\s/g, '').length;
    console.log(`Approximate char count: ${charCount}`);
    if (charCount < 6000) {
      console.warn(`WARNING: Content may be short (${charCount} chars < 6000 threshold)`);
    } else {
      console.log('QC PASS: Content length adequate');
    }

    // Check no wrong years
    if (clean.includes('2036年是当前') || clean.includes('现年36岁')) {
      console.warn('WARNING: Possible wrong year reference detected');
    }

    // === mdToHtml ===
    function mdToHtml(md) {
      return md
        .replace(/^#{1,2} (.+)$/gm, '<h2 class="chapter">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
        .replace(/^---+$/gm, '<hr>')
        .split(/\n{2,}/).map(para => {
          if (!para.trim()) return '';
          if (para.match(/^<[htulbqhr]/)) return para;
          return `<p>${para.trim()}</p>`;
        }).join('\n');
    }

    const htmlContent = mdToHtml(clean);

    // === Build HTML ===
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善缘 · Karen 个人人生报告</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: #1c1710;
  color: #f0e8d8;
  font-family: 'STSong','Noto Serif SC','SimSun','Georgia',serif;
  max-width: 860px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 2.05;
  -webkit-font-smoothing: antialiased;
}
.cover {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 80px 48px 64px;
  position: relative;
  background: radial-gradient(ellipse 70% 50% at 50% 20%, rgba(201,168,76,0.13) 0%, transparent 70%),
              linear-gradient(180deg, #1a1508 0%, #201a0e 55%, #1a1508 100%);
  border-bottom: 1px solid rgba(201,168,76,0.18);
}
.cover::before { content:''; position:absolute; top:28px; left:28px; width:48px; height:48px; border:1px solid rgba(201,168,76,0.3); border-right:none; border-bottom:none; }
.cover::after  { content:''; position:absolute; bottom:28px; right:28px; width:48px; height:48px; border:1px solid rgba(201,168,76,0.3); border-left:none; border-top:none; }
.cover-brand { font-size:10px; letter-spacing:10px; color:rgba(201,168,76,0.5); margin-bottom:36px; }
.cover-icon { font-size:64px; margin-bottom:20px; }
.cover-title { font-size:32px; color:#c9a84c; font-weight:300; letter-spacing:10px; margin-bottom:8px; }
.cover-sub { font-size:12px; color:rgba(201,168,76,0.5); letter-spacing:6px; margin-bottom:32px; font-style:italic; }
.gold-line { width:120px; height:1px; background:linear-gradient(90deg,transparent,#c9a84c,transparent); margin:0 auto 32px; }
.summary-card {
  background: rgba(201,168,76,0.07);
  border: 1px solid rgba(201,168,76,0.28);
  border-radius: 12px;
  padding: 24px 32px;
  margin-bottom: 24px;
  text-align: left;
  min-width: 380px;
}
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.summary-item { display: flex; flex-direction: column; gap: 3px; }
.summary-label { font-size: 10px; color: rgba(201,168,76,0.6); letter-spacing: 2px; }
.summary-value { font-size: 15px; color: #f0e8d8; }
.summary-highlight { font-size: 18px; color: #c9a84c; font-weight: 500; }
.content { padding: 52px 52px 0; }
h2.chapter {
  font-size: 20px; color: #c9a84c; font-weight:500;
  letter-spacing:3px; margin:44px 0 18px;
  padding: 15px 20px;
  border-left: 4px solid #c9a84c;
  background: linear-gradient(90deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.02) 100%);
}
h3 { font-size:16px; color:rgba(201,168,76,0.9); margin:24px 0 10px; padding-left:12px; border-left:2px solid rgba(201,168,76,0.35); }
p { margin-bottom:16px; text-indent:2em; color:#f0e8d8; }
ul { padding-left:22px; margin-bottom:16px; }
li { margin-bottom:9px; color:#f0e8d8; }
li::marker { color:rgba(201,168,76,0.5); }
strong { color:#c9a84c; font-weight:600; }
em { color:rgba(220,140,110,0.95); font-style:normal; }
blockquote { border-left:3px solid rgba(201,168,76,0.45); padding:14px 20px; margin:20px 0; background:rgba(201,168,76,0.05); color:rgba(240,232,216,0.92); font-style:italic; line-height:1.95; }
table { width:100%; border-collapse:collapse; margin:18px 0; }
th { background:rgba(201,168,76,0.14); color:#c9a84c; padding:11px 14px; text-align:left; font-weight:400; font-size:14px; border-bottom:1.5px solid rgba(201,168,76,0.3); }
td { padding:10px 14px; border-bottom:1px solid rgba(201,168,76,0.1); font-size:15px; }
hr { border:none; border-top:1px solid rgba(201,168,76,0.12); margin:32px 0; }
.why-box { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.2); border-radius:8px; padding:16px 20px; margin:16px 0; }
.why-title { font-size:11px; color:rgba(201,168,76,0.7); letter-spacing:2px; margin-bottom:8px; }
.dayun-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0; }
.dayun-card { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.2); border-radius:8px; padding:14px; text-align:center; }
.dayun-name { font-size:20px; color:#c9a84c; margin-bottom:4px; }
.dayun-age { font-size:11px; color:rgba(240,232,216,0.5); margin-bottom:8px; }
.footer { text-align:center; color:rgba(240,232,216,0.22); font-size:12px; margin-top:48px; padding:24px 52px; border-top:1px solid rgba(201,168,76,0.1); }
</style>
</head>
<body>
<div class="cover">
  <div class="cover-brand">S H E N Y U A N  ·  善 缘</div>
  <div class="cover-icon">🕯️</div>
  <div class="cover-title">人生命理报告</div>
  <div class="cover-sub">PERSONAL DESTINY READING · 丁火命主</div>
  <div class="gold-line"></div>
  <div class="summary-card">
    <div class="summary-grid">
      <div class="summary-item"><span class="summary-label">四柱八字</span><span class="summary-value">辛未 丁酉 丁未 癸卯</span></div>
      <div class="summary-item"><span class="summary-label">日主命格</span><span class="summary-highlight">丁火 · 烛火之命</span></div>
      <div class="summary-item"><span class="summary-label">当前大运</span><span class="summary-value">庚子大运（2021–2030）</span></div>
      <div class="summary-item"><span class="summary-label">流年</span><span class="summary-value">2026年 丙午年</span></div>
      <div class="summary-item"><span class="summary-label">用神</span><span class="summary-value">木（甲乙）· 喜火</span></div>
      <div class="summary-item"><span class="summary-label">幸运方位</span><span class="summary-value">东方 · 南方</span></div>
    </div>
  </div>
  <div style="font-size:11px;color:rgba(240,232,216,0.3);letter-spacing:2px">* 本报告由AI命理系统生成，仅供参考</div>
</div>
<div class="content">
${htmlContent}
</div>
<div class="footer">善缘 ShenYuan · AI 命理系统 · shenyuan.app · 仅供参考，命运终由自己主宰</div>
</body>
</html>`;

    const outputPath = '/Users/karen/projects/shenyuan/docs/karen-人生报告.html';
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`Saved to: ${outputPath}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);

    exec(`open "${outputPath}"`, (err) => {
      if (err) console.warn('Could not auto-open:', err.message);
      else console.log('Opened in browser.');
    });
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.setTimeout(120000, () => {
  console.error('Request timed out after 120s');
  req.destroy();
  process.exit(1);
});

req.write(requestBody);
req.end();
