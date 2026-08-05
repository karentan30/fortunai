const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const apiKey = process.env.DEEPSEEK_API_KEY;

const systemPrompt = `你是一位精通玛雅历法与卓尔金历（Tzolkin）的命理专家，深度研究玛雅文明二十年。
语言：简体中文。格式：Markdown。总字数：7000字以上。
请先准确计算命主在玛雅历中的位置，然后给出完整分析。
已知命主的玛雅历精确数据：
- Kin号：117
- 太阳图腾：卡班 Caban（地球/Earth，第17号图腾）
- 音调：第13音调 宇宙音调（Cosmic Tone）
- 星系签名：宇宙地球 Cosmic Earth
- 波符：第5波符（蛇波符 Serpent Wavespell，Kin 105-117）
请基于这些精确数据进行深度解读。`;

const userPrompt = `命主：1991年10月5日出生，女性，早上6点。
玛雅历精确数据：Kin 117，宇宙地球（Cosmic Earth），第13音调，地球图腾（Caban）。

请给出完整的玛雅历命理报告，包含：

## 一、玛雅命盘 — 你的星系签名
（解释：Kin 117、图腾地球Caban、第13宇宙音调、银河音调、长历日期12.18.18.9.13）

## 二、你的图腾解读 — 地球 Caban
（地球图腾的含义、天赋、人生使命，与其他图腾的对比，深度解读至少1000字）

## 三、你的音调能量 — 第13宇宙音调
（宇宙音调的特质、行动方式、生命节奏，至少800字）

## 四、波符解读 — 蛇波符（第5波符）
（Kin 105-117蛇波符周期，你作为这个波符的最后一天/完成者意味着什么，至少700字）

## 五、天命与人生目的
（玛雅历揭示的灵魂使命和今生要学习的功课，至少800字）

## 六、2026年玛雅能量分析
（2026年的宇宙能量对Kin 117宇宙地球的影响，至少600字）

## 七、事业与财富天赋
（地球图腾+宇宙音调揭示的职业优势和财富模式，至少600字）

## 八、感情与关系密码
（玛雅历中的灵魂伴侣特质和感情模式，至少600字）

## 九、身体能量与疗愈
（对应的身体能量中心和疗愈建议，至少500字）

## 十、玛雅开运指引
（每日能量冥想、水晶推荐、颜色、方向、具体日常实践，至少500字）

总字数要求：7000字以上，每个章节要有深度，避免泛泛而谈。`;

const requestBody = JSON.stringify({
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
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

console.log('Calling DeepSeek API...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.error) {
        console.error('API Error:', response.error);
        process.exit(1);
      }
      const content = response.choices[0].message.content;
      console.log('Got content, length:', content.length);

      // Save raw markdown
      fs.writeFileSync('/Users/karen/projects/shenyuan/docs/karen-mayan-raw.md', content);
      console.log('Saved raw markdown');

      // Build HTML
      buildHTML(content);
    } catch (e) {
      console.error('Parse error:', e);
      console.error('Raw data:', data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
  process.exit(1);
});

req.write(requestBody);
req.end();

function buildHTML(markdownContent) {
  // Convert markdown sections
  const sections = markdownContent.split(/\n(?=## )/);

  let sectionsHTML = '';
  sections.forEach((section, i) => {
    if (!section.trim()) return;

    // Extract heading
    const lines = section.split('\n');
    const heading = lines[0].replace(/^## /, '');
    const body = lines.slice(1).join('\n');

    const bodyHTML = body
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/gs, (m) => `<ul>${m}</ul>`)
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => {
        p = p.trim();
        if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<blockquote')) return p;
        return `<p>${p.replace(/\n/g, ' ')}</p>`;
      })
      .join('\n');

    sectionsHTML += `
    <section class="section" style="animation-delay: ${i * 0.1}s">
      <div class="section-header">
        <h2>${heading}</h2>
      </div>
      <div class="section-body">
        ${bodyHTML}
      </div>
    </section>`;
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>人生报告 · 玛雅历解读</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&family=Cinzel:wght@400;600&display=swap');

  :root {
    --bg: #1c1710;
    --bg2: #221d14;
    --bg3: #2a2318;
    --gold: #c9a84c;
    --gold-light: #e8c96a;
    --gold-dim: #8a6f2e;
    --text: #e8dfc8;
    --text-dim: #a89878;
    --accent: #f0d890;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Serif SC', serif;
    line-height: 1.9;
    min-height: 100vh;
  }

  /* Starfield background */
  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image:
      radial-gradient(1px 1px at 20% 30%, rgba(201,168,76,0.4) 0%, transparent 100%),
      radial-gradient(1px 1px at 80% 10%, rgba(201,168,76,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 50% 80%, rgba(201,168,76,0.2) 0%, transparent 100%),
      radial-gradient(1px 1px at 10% 60%, rgba(201,168,76,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 90% 50%, rgba(201,168,76,0.2) 0%, transparent 100%),
      radial-gradient(1px 1px at 60% 20%, rgba(240,216,144,0.3) 0%, transparent 100%),
      radial-gradient(2px 2px at 35% 70%, rgba(201,168,76,0.2) 0%, transparent 100%),
      radial-gradient(1px 1px at 75% 85%, rgba(201,168,76,0.25) 0%, transparent 100%);
    pointer-events: none;
    z-index: 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px 80px;
    position: relative;
    z-index: 1;
  }

  /* Cover */
  .cover {
    text-align: center;
    padding: 80px 20px 60px;
    position: relative;
  }

  .cover-icon {
    font-size: 80px;
    display: block;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 30px rgba(201,168,76,0.6));
    animation: pulse 3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(201,168,76,0.5)); }
    50% { transform: scale(1.05); filter: drop-shadow(0 0 40px rgba(201,168,76,0.8)); }
  }

  .cover-subtitle-en {
    font-family: 'Cinzel', serif;
    font-size: 13px;
    letter-spacing: 6px;
    color: var(--gold-dim);
    margin-bottom: 16px;
    text-transform: uppercase;
  }

  .cover-title {
    font-size: 38px;
    font-weight: 700;
    color: var(--gold-light);
    margin-bottom: 8px;
    text-shadow: 0 0 40px rgba(201,168,76,0.4);
    letter-spacing: 4px;
  }

  .cover-subtitle {
    font-size: 15px;
    color: var(--text-dim);
    letter-spacing: 2px;
    margin-bottom: 50px;
  }

  /* Kin Card */
  .kin-card {
    display: inline-block;
    background: linear-gradient(135deg, #2a2318, #1c1710);
    border: 1px solid var(--gold-dim);
    border-radius: 20px;
    padding: 40px 60px;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(201,168,76,0.15), inset 0 0 40px rgba(201,168,76,0.05);
  }

  .kin-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
  }

  .kin-card::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
  }

  .kin-number {
    font-family: 'Cinzel', serif;
    font-size: 72px;
    font-weight: 600;
    color: var(--gold-light);
    line-height: 1;
    text-shadow: 0 0 40px rgba(201,168,76,0.6);
  }

  .kin-label {
    font-size: 12px;
    letter-spacing: 4px;
    color: var(--gold-dim);
    text-transform: uppercase;
    margin-bottom: 8px;
    font-family: 'Cinzel', serif;
  }

  .kin-name {
    font-size: 22px;
    color: var(--gold);
    margin-top: 8px;
    font-weight: 600;
    letter-spacing: 3px;
  }

  .kin-name-zh {
    font-size: 15px;
    color: var(--text-dim);
    margin-top: 6px;
    letter-spacing: 2px;
  }

  .kin-divider {
    width: 60px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
    margin: 20px auto;
  }

  .kin-details {
    display: flex;
    gap: 40px;
    justify-content: center;
    margin-top: 20px;
  }

  .kin-detail-item {
    text-align: center;
  }

  .kin-detail-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: var(--gold-dim);
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .kin-detail-value {
    font-size: 16px;
    color: var(--gold-light);
    font-weight: 600;
  }

  /* Birth info strip */
  .birth-strip {
    margin: 40px 0 20px;
    padding: 16px 30px;
    background: rgba(201,168,76,0.06);
    border-left: 3px solid var(--gold-dim);
    border-radius: 0 8px 8px 0;
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 1px;
    text-align: left;
    display: inline-block;
    width: 100%;
    max-width: 600px;
  }

  /* Decorative divider */
  .golden-divider {
    text-align: center;
    margin: 50px 0;
    position: relative;
  }

  .golden-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
  }

  .golden-divider span {
    position: relative;
    background: var(--bg);
    padding: 0 20px;
    color: var(--gold-dim);
    font-family: 'Cinzel', serif;
    font-size: 18px;
    letter-spacing: 4px;
  }

  /* Sections */
  .section {
    margin-bottom: 50px;
    background: linear-gradient(135deg, rgba(42,35,24,0.6), rgba(28,23,16,0.8));
    border: 1px solid rgba(201,168,76,0.15);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 30px rgba(0,0,0,0.3);
    opacity: 0;
    animation: fadeInUp 0.6s ease forwards;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .section-header {
    padding: 24px 36px;
    background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.05));
    border-bottom: 1px solid rgba(201,168,76,0.15);
    position: relative;
  }

  .section-header::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--gold), var(--gold-dim));
  }

  .section-header h2 {
    font-size: 20px;
    color: var(--gold-light);
    font-weight: 600;
    letter-spacing: 2px;
  }

  .section-body {
    padding: 30px 36px;
  }

  .section-body p {
    margin-bottom: 16px;
    font-size: 15px;
    line-height: 1.95;
    color: var(--text);
  }

  .section-body h3 {
    font-size: 17px;
    color: var(--gold);
    margin: 24px 0 12px;
    padding-left: 14px;
    border-left: 2px solid var(--gold-dim);
    letter-spacing: 1px;
  }

  .section-body h4 {
    font-size: 15px;
    color: var(--gold-light);
    margin: 20px 0 10px;
    letter-spacing: 1px;
  }

  .section-body strong {
    color: var(--gold-light);
    font-weight: 600;
  }

  .section-body em {
    color: var(--text-dim);
    font-style: normal;
  }

  .section-body ul {
    margin: 12px 0 16px 20px;
    list-style: none;
    padding: 0;
  }

  .section-body ul li {
    padding: 6px 0 6px 20px;
    position: relative;
    font-size: 15px;
    color: var(--text);
  }

  .section-body ul li::before {
    content: '✦';
    position: absolute;
    left: 0;
    color: var(--gold-dim);
    font-size: 10px;
    top: 9px;
  }

  .section-body blockquote {
    border-left: 3px solid var(--gold-dim);
    padding: 12px 20px;
    margin: 16px 0;
    background: rgba(201,168,76,0.05);
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: var(--text-dim);
  }

  /* Footer */
  .footer {
    text-align: center;
    padding: 60px 20px 40px;
    color: var(--text-dim);
    font-size: 12px;
    letter-spacing: 2px;
    border-top: 1px solid rgba(201,168,76,0.1);
  }

  .footer .brand {
    color: var(--gold-dim);
    font-family: 'Cinzel', serif;
    font-size: 14px;
    letter-spacing: 4px;
    margin-bottom: 10px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 3px; }

  @media (max-width: 600px) {
    .cover-title { font-size: 28px; }
    .kin-number { font-size: 54px; }
    .kin-card { padding: 30px 30px; }
    .kin-details { gap: 20px; }
    .section-header { padding: 20px 20px; }
    .section-body { padding: 20px 20px; }
  }
</style>
</head>
<body>
<div class="container">

  <!-- Cover -->
  <div class="cover">
    <span class="cover-icon">🌀</span>
    <div class="cover-subtitle-en">MAYAN TZOLKIN READING</div>
    <h1 class="cover-title">人生报告 · 玛雅历解读</h1>
    <p class="cover-subtitle">宇宙星系签名 · 灵魂使命揭示</p>

    <div class="kin-card">
      <div class="kin-label">Your Galactic Signature</div>
      <div class="kin-number">117</div>
      <div class="kin-name">Cosmic Earth · Caban</div>
      <div class="kin-name-zh">宇宙地球 · 卡班</div>
      <div class="kin-divider"></div>
      <div class="kin-details">
        <div class="kin-detail-item">
          <div class="kin-detail-label">Day Sign</div>
          <div class="kin-detail-value">🌍 地球</div>
        </div>
        <div class="kin-detail-item">
          <div class="kin-detail-label">Tone</div>
          <div class="kin-detail-value">13 宇宙</div>
        </div>
        <div class="kin-detail-item">
          <div class="kin-detail-label">Wavespell</div>
          <div class="kin-detail-value">🐍 蛇波符</div>
        </div>
      </div>
    </div>

    <div class="birth-strip">
      命主生辰：1991年10月5日 · 女性 · 早上6时 · Long Count 12.18.18.9.13
    </div>
  </div>

  <div class="golden-divider"><span>✦ 命盘解析 ✦</span></div>

  ${sectionsHTML}

  <div class="footer">
    <div class="brand">SHENYUAN · 善缘</div>
    <p>本报告依据玛雅卓尔金历精确计算生成 · 仅供参考</p>
    <p style="margin-top:8px">Generated ${new Date().toLocaleDateString('zh-CN')} · Kin 117 · Cosmic Earth</p>
  </div>
</div>
</body>
</html>`;

  const outputPath = '/Users/karen/projects/shenyuan/docs/karen-人生报告-玛雅.html';
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log('HTML saved to:', outputPath);

  // Open in browser
  try {
    execSync(`open "${outputPath}"`);
    console.log('Opened in browser');
  } catch(e) {
    console.log('Could not auto-open:', e.message);
  }
}
