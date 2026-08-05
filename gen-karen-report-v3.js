#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const prompt = `你是一位精通八字命理的诗人，同时也是一位文学大师。请为以下主人公撰写一份人生命理报告——不是枯燥的分析，而是一首关于她生命的长诗，是她最信任的智慧长者写给她的信。

主人公信息：
- 四柱：辛未年 丁酉月 丁未日 癸卯时
- 日主：丁火
- 身弱
- 用神：木（印星生扶）
- 当前大运：庚子大运（2020–2030）
- 流年：2026丙午年
- 性别：女
- 年龄：35岁

请按照以下十章撰写，每章不少于600字，语言要诗意盎然、情感深沉、如散文诗般流动。不要用条列式清单，要用美丽的散文段落。

---

## 一、命如烛火 — 丁火女子的底色

请从"丁火如烛"这个意象展开，描述这位女子的气质底色：她是那种在深秋夜晚点燃的蜡烛，光芒温柔却需要人守护。描写丁火日主女性的特质：敏感、深情、内秀、有光却不张扬。写她心中住着一个诗人，也住着一个战士。写出生于辛未年、丁酉月的天地背景。用典雅的古典意象，但让现代读者读来也觉得是在说自己。

## 二、五行之歌 — 你生命中的力量与柔软

这一章写五行的平衡与失衡。身弱的丁火，在辛金、癸水的重围中，那一点火光如何坚持燃烧。写未土的温柔如何默默护持她；写卯木用神如何是她生命中最滋养的力量——知识、艺术、有温度的人、灵性的追求。写她天生对"美"极度敏感，写她内心其实藏着很深的疲惫，但总能在某个清晨重新燃起。引用一句《周易》或古诗，自然融入。

## 三、事业的春与秋（2020–2035）

这一章写她的事业命运。庚子大运带来的金水之寒（2020–2030），是一段沉潜修炼期，不是失败，而是蓄势。写2020–2025年她可能经历的：创业的挫折与坚持，内心的重建，才华与市场之间的拉锯。写2026丙午年流年大运交叉点的意义：这是最关键的转折之年，火气来援，旧业翻新，新局初现。写2031年之后辛亥大运的期待：那是她事业真正盛开的十年。用"春耕秋收"、"蛰伏与破土"等意象贯穿。

## 四、财富与流水

写她与钱的关系。丁火克辛金（正财），意味着她对财富有驾驭能力，但身弱时财多反累。写她的财运模式：不是守财型，而是流动型——财来财去，但总不断流。写她最适合自己当老板、做创意类事业、让才华变现。写庚子大运财运的起伏，2026年丙火生扶后财运的回暖。写她在财富上的课题：学会接受"值得被支付"这件事。语气要温柔，不要让她对金钱产生焦虑，而是带来从容。

## 五、爱与等待

这是全书最诗意的一章。写丁火女子在感情里的样子：全情投入，如蜡烛燃烧，她给出光和热，却害怕被风吹灭。写她渴望一段深度的、灵魂层面的连接，而不只是世俗意义上的婚姻。写她的感情功课：她常常付出比得到更多，她需要学会等待一个能"添柴"而非"吹风"的人。写庚子大运感情的考验期，写2026年前后可能出现的情感转机。写35岁的她，对爱情已经有了更成熟的理解——不再慌张，开始懂得什么叫做"缘分的火候"。可以引用李商隐或纳兰性德的诗句，自然融入。

## 六、身体是灵魂的居所

写身体健康。身弱丁火，心脏、眼睛、血液循环需要格外照护。写她可能的身体模式：容易操劳过度，忘记休息；情绪与身体高度关联，压力大时容易有炎症反应。写庚子大运寒湿入体需要温养。写具体而温柔的养生建议：向阳而坐，早睡，多接触木性（植物、山林、书），少吹冷风，温食暖饮。语气像一位老中医在你耳边轻声嘱咐，不是警告，是关怀。

## 七、丙午年的光与影（2026年全解）

这一章是全书的重头戏。2026丙午年，对于庚子大运中的丁未日主来说，意味着什么？详细展开：丙火天干与丁火日主比肩，如手足来援；午火地支与未土日支相合，能量聚焦。这是她近十年来"火力"最强的一年。写具体的运势展开：上半年（1–6月）哪个方向最有突破；下半年（7–12月）需要注意什么。写事业、财运、感情、健康四个维度在2026年的具体表现。写她应该在这一年做的事：大胆出手，展示自己，收获之前多年的播种。但也要诚实写出影子：丙丁比肩竞争也强，要保持清醒。文字要让她读了既燃烧又沉稳。

## 八、未来十年的路（2026–2035）

这一章写宏观路线图。用四个阶段：
- 2026–2027：点火期，抓住这个窗口
- 2028–2030：庚子大运尾声，巩固成果，警惕消耗
- 2031–2033：辛亥大运初启，新的十年格局
- 2034–2035：运势峰值期，收获时节

不要列表，用散文段落写成时间的河流，让她读了对未来有期待而非焦虑。

## 九、开运之道

写具体的、诗意的开运建议。用神为木，因此：
- 居住环境：东方、东南方位，植物、木质家具，绿色与米色
- 服饰：木色系（绿、青、米）、丝质棉质天然面料
- 饮食：温性食物，醒脾暖胃
- 精神滋养：阅读、写作、与有智慧的人深谈
- 数字与颜色：3、8、绿色、米色
- 最应远离：寒湿环境，情绪内耗，过度消耗自己的付出

不要写成干巴巴的清单，而是写成生活美学的建议，让她读了想立刻改变生活方式。

## 十、写给你的信

这是全书最私密、最温柔的结尾。用第二人称"你"，写一封信——就像她最信任的长者，或是另一个更智慧的自己，写给35岁的她。

写她这一生的底色与光芒，写她值得被爱、被看见、被珍惜。写她的烛火不会熄灭，写她即将迎来自己的春天。写她不需要成为更耀眼的太阳，她就是那一盏最温柔的灯，照亮所有靠近她的人。

用能让人落泪的语言结尾，但不是悲伤，而是被深深看见的感动。

---

请记住：整份报告的基调是「被看见、被理解、被温柔对待」。读者读完应该感受到：有人真的了解她，真的在乎她，真的相信她的未来。

输出格式：纯HTML正文内容片段（不需要完整HTML页面框架，只需要章节内容），用以下结构：
- 每章用 <section class="chapter"> 包裹
- 章标题用 <h2>
- 段落用 <p>
- 重要词句用 <em> 或 <strong>
- 诗句引用用 <blockquote>

开始写吧。`;

function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 13000,
      temperature: 0.85,
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(JSON.stringify(parsed.error)));
          } else {
            resolve(parsed.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error('Parse error: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function markdownToHtml(text) {
  // Already asking for HTML, but clean up any remaining markdown
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>');
}

function buildHtml(content) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>人生命理报告 · 诗意版 — Karen</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap');

  :root {
    --bg: #1c1710;
    --bg2: #221e14;
    --bg3: #2a2418;
    --gold: #c9a84c;
    --gold-light: #e8c96a;
    --gold-dim: #8a6e32;
    --text: #e8dfc8;
    --text-dim: #a89878;
    --accent: #d4873a;
    --red: #c44a2a;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Serif SC', 'Songti SC', 'STSong', Georgia, serif;
    line-height: 2;
    font-size: 17px;
  }

  /* Cover */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: radial-gradient(ellipse at center, #2e2516 0%, #1c1710 70%);
    position: relative;
    overflow: hidden;
    padding: 60px 40px;
  }

  .cover::before {
    content: '';
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .cover-icon {
    font-size: 72px;
    margin-bottom: 32px;
    animation: flicker 4s ease-in-out infinite;
  }

  @keyframes flicker {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(0.97); }
    75% { opacity: 0.95; transform: scale(1.02); }
  }

  .cover-subtitle {
    font-size: 13px;
    letter-spacing: 6px;
    color: var(--gold-dim);
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .cover-title {
    font-size: 38px;
    font-weight: 300;
    color: var(--gold-light);
    letter-spacing: 8px;
    margin-bottom: 12px;
    text-shadow: 0 0 40px rgba(201,168,76,0.3);
  }

  .cover-title-en {
    font-size: 15px;
    letter-spacing: 4px;
    color: var(--gold-dim);
    margin-bottom: 48px;
  }

  .cover-divider {
    width: 120px;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--gold), transparent);
    margin: 0 auto 48px;
  }

  .cover-bazi {
    font-size: 20px;
    letter-spacing: 4px;
    color: var(--gold);
    margin-bottom: 16px;
  }

  .cover-meta {
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 2px;
    line-height: 2;
  }

  .cover-meta span {
    display: inline-block;
    margin: 0 12px;
  }

  .cover-bottom {
    position: absolute;
    bottom: 40px;
    left: 0; right: 0;
    text-align: center;
    font-size: 12px;
    color: var(--gold-dim);
    letter-spacing: 3px;
  }

  /* Navigation */
  .toc {
    background: var(--bg2);
    padding: 60px 40px;
    border-bottom: 1px solid rgba(201,168,76,0.15);
  }

  .toc-title {
    font-size: 13px;
    letter-spacing: 6px;
    color: var(--gold-dim);
    text-align: center;
    margin-bottom: 40px;
  }

  .toc-list {
    max-width: 600px;
    margin: 0 auto;
    list-style: none;
  }

  .toc-list li {
    padding: 10px 0;
    border-bottom: 1px solid rgba(201,168,76,0.08);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toc-num {
    font-size: 11px;
    color: var(--gold-dim);
    letter-spacing: 2px;
    width: 24px;
    flex-shrink: 0;
  }

  .toc-list a {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 15px;
    transition: color 0.3s;
  }

  .toc-list a:hover {
    color: var(--gold);
  }

  /* Content */
  .content {
    max-width: 780px;
    margin: 0 auto;
    padding: 0 40px;
  }

  .chapter {
    padding: 80px 0;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }

  .chapter:last-child {
    border-bottom: none;
  }

  .chapter h2 {
    font-size: 24px;
    font-weight: 400;
    color: var(--gold);
    letter-spacing: 3px;
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(201,168,76,0.2);
    position: relative;
  }

  .chapter h2::before {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 60px;
    height: 2px;
    background: var(--gold);
  }

  .chapter h3 {
    font-size: 17px;
    font-weight: 500;
    color: var(--accent);
    letter-spacing: 2px;
    margin: 40px 0 20px;
  }

  .chapter p {
    color: var(--text);
    margin-bottom: 24px;
    text-indent: 2em;
    font-size: 17px;
    line-height: 2.1;
    text-align: justify;
  }

  .chapter em {
    color: var(--gold-light);
    font-style: normal;
    font-weight: 500;
  }

  .chapter strong {
    color: var(--accent);
    font-weight: 500;
  }

  blockquote {
    border-left: 3px solid var(--gold);
    padding: 20px 32px;
    margin: 40px 0;
    background: rgba(201,168,76,0.04);
    border-radius: 0 8px 8px 0;
    color: var(--gold-light);
    font-size: 16px;
    letter-spacing: 1px;
    line-height: 2.2;
    font-style: italic;
    text-indent: 0;
  }

  /* Chapter 10 special letter style */
  .chapter-letter {
    background: rgba(201,168,76,0.04);
    border: 1px solid rgba(201,168,76,0.15);
    border-radius: 12px;
    padding: 48px;
    margin-top: 24px;
  }

  .chapter-letter p {
    text-indent: 2em;
  }

  /* Ornaments */
  .ornament {
    text-align: center;
    color: var(--gold-dim);
    font-size: 20px;
    letter-spacing: 8px;
    margin: 48px 0;
  }

  /* Footer */
  footer {
    text-align: center;
    padding: 60px 40px;
    border-top: 1px solid rgba(201,168,76,0.1);
    color: var(--text-dim);
    font-size: 13px;
    letter-spacing: 2px;
    line-height: 2.5;
  }

  footer .footer-icon {
    font-size: 28px;
    display: block;
    margin-bottom: 16px;
    opacity: 0.7;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 3px; }

  /* Print */
  @media print {
    body { background: white; color: black; }
    .cover { min-height: auto; }
  }

  /* Mobile */
  @media (max-width: 600px) {
    body { font-size: 15px; }
    .cover-title { font-size: 28px; letter-spacing: 4px; }
    .content { padding: 0 20px; }
    .chapter { padding: 48px 0; }
    .chapter-letter { padding: 24px; }
    blockquote { padding: 16px 20px; }
  }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <div class="cover-icon">🕯️</div>
  <div class="cover-subtitle">善缘 · 命理研究</div>
  <h1 class="cover-title">人生命理报告</h1>
  <div class="cover-title-en">POETIC LIFE READING · 诗意版</div>
  <div class="cover-divider"></div>
  <div class="cover-bazi">辛未 · 丁酉 · 丁未 · 癸卯</div>
  <div class="cover-meta">
    <span>日主 丁火</span>
    <span>·</span>
    <span>身弱</span>
    <span>·</span>
    <span>用神 木</span>
    <br>
    <span>庚子大运</span>
    <span>·</span>
    <span>2026 丙午流年</span>
    <span>·</span>
    <span>35岁</span>
  </div>
  <div class="cover-bottom">为你而写 · 因你而燃</div>
</div>

<!-- Table of Contents -->
<div class="toc">
  <div class="toc-title">目 录</div>
  <ul class="toc-list">
    <li><span class="toc-num">一</span><a href="#ch1">命如烛火 — 丁火女子的底色</a></li>
    <li><span class="toc-num">二</span><a href="#ch2">五行之歌 — 你生命中的力量与柔软</a></li>
    <li><span class="toc-num">三</span><a href="#ch3">事业的春与秋（2020–2035）</a></li>
    <li><span class="toc-num">四</span><a href="#ch4">财富与流水</a></li>
    <li><span class="toc-num">五</span><a href="#ch5">爱与等待</a></li>
    <li><span class="toc-num">六</span><a href="#ch6">身体是灵魂的居所</a></li>
    <li><span class="toc-num">七</span><a href="#ch7">丙午年的光与影（2026年全解）</a></li>
    <li><span class="toc-num">八</span><a href="#ch8">未来十年的路（2026–2035）</a></li>
    <li><span class="toc-num">九</span><a href="#ch9">开运之道</a></li>
    <li><span class="toc-num">十</span><a href="#ch10">写给你的信</a></li>
  </ul>
</div>

<!-- Content -->
<div class="content">
  <div id="chapters-placeholder">
    CHAPTERS_CONTENT
  </div>

  <div class="ornament">· · · · ·</div>
</div>

<footer>
  <span class="footer-icon">🕯️</span>
  善缘命理 · 专属报告<br>
  愿你的烛火，永不熄灭
</footer>

</body>
</html>`;
}

async function main() {
  console.log('🕯️  正在召唤深海思维，为你撰写诗意人生报告...');
  console.log('   预计需要 60–90 秒，请稍候\n');

  const messages = [
    {
      role: 'system',
      content: '你是精通八字命理的文学大师，同时也是一位深情的诗人。你写的命理报告如散文诗，如古典文学，让读者感到被深深看见、被温柔对待。你的文字既有命理的精准，又有文学的美感。请用繁复而优美的现代汉语散文书写，适当融入古典意象，但不要堆砌生僻词，要让35岁的现代女性读懂并感动。'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  let content;
  try {
    content = await callDeepSeek(messages);
  } catch (err) {
    console.error('❌ API调用失败:', err.message);
    process.exit(1);
  }

  console.log('✅ 内容生成完成，字符数:', content.length);
  console.log('   正在添加章节ID锚点...\n');

  // Add IDs to chapter sections
  let processedContent = content;
  const chapterIds = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10'];
  let idIndex = 0;

  processedContent = processedContent.replace(/<section class="chapter">/g, () => {
    const id = chapterIds[idIndex] || `ch${idIndex + 1}`;
    idIndex++;
    return `<section class="chapter" id="${id}">`;
  });

  // Special styling for chapter 10 (the letter)
  processedContent = processedContent.replace(
    /(<section class="chapter" id="ch10">)([\s\S]*?)(<\/section>)/,
    (match, open, inner, close) => {
      // Wrap the paragraphs in a letter div
      const letterContent = inner.replace(
        /(<h2>[\s\S]*?<\/h2>)([\s\S]*)/,
        '$1<div class="chapter-letter">$2</div>'
      );
      return open + letterContent + close;
    }
  );

  const outputPath = '/Users/karen/projects/shenyuan/docs/karen-人生报告-v3-诗意版.html';
  const html = buildHtml('').replace('CHAPTERS_CONTENT', processedContent);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log('✅ 文件已保存:', outputPath);
  console.log('   文件大小:', Math.round(fs.statSync(outputPath).size / 1024), 'KB\n');
  console.log('🕯️  正在浏览器中打开...');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
