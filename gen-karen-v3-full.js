#!/usr/bin/env node

/**
 * Generate Karen's 人生报告 v3 — chapter by chapter for full depth
 */

const https = require('https');
const fs = require('fs');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY not set');
  process.exit(1);
}

const SYSTEM = `你是精通八字命理的文学大师，同时也是一位深情的诗人。你写的命理报告如散文诗，如古典文学，让读者感到被深深看见、被温柔对待。你的文字既有命理的精准，又有文学的美感。请用优美的现代汉语散文书写，适当融入古典意象，但不要堆砌生僻词，要让35岁的现代女性读懂并感动。不要用条列式清单，全部用散文段落。输出HTML片段，段落用<p>，重要词句用<em>（金色高亮），引用用<blockquote>。每章必须充分展开，不少于800汉字。`;

const BAZI_CONTEXT = `主人公信息：四柱辛未年丁酉月丁未日癸卯时，日主丁火，身弱，用神木（印星），当前庚子大运（2020–2030），2026丙午年流年，女，35岁。`;

const chapters = [
  {
    id: 'ch1',
    title: '一、命如烛火 — 丁火女子的底色',
    prompt: `请为此命盘撰写第一章：《命如烛火 — 丁火女子的底色》。

${BAZI_CONTEXT}

从「丁火如烛」这个核心意象展开，深情描写这位女子的气质底色。她是那种在深秋夜晚点燃的蜡烛，光芒温柔却需要人守护。写丁火日主女性的特质：敏感、深情、内秀、有光却不张扬。写她心中住着一个诗人，也住着一个战士。写出生于辛未年、丁酉月的天地背景——辛金如刀，秋风肃杀，她就在这样的天地间点燃自己，这需要多大的勇气。写她的眼神、她的性格、她面对世界的方式。用「烛光」贯穿始终，让读者立刻认出自己。不少于900汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch2',
    title: '二、五行之歌 — 你生命中的力量与柔软',
    prompt: `请为此命盘撰写第二章：《五行之歌 — 你生命中的力量与柔软》。

${BAZI_CONTEXT}

写五行在她生命中的具体体现。身弱的丁火，在辛金（偏财克制）、癸水（七杀压制）的重围中，那一点火光如何坚持燃烧。写未土（食神、墓库）的温柔如何默默护持她；写卯木（正印）用神如何是她生命中最滋养的力量——书籍、艺术、灵性追求、有温度的智者。写她天生对「美」极度敏感，写她其实内心藏着很深的疲惫，但总能在某个清晨重新燃起。引用《周易》「柔弱胜刚强」或古诗句，自然融入。写她内心世界的丰富与外表的克制之间的张力。不少于900汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch3',
    title: '三、事业的春与秋（2020–2035）',
    prompt: `请为此命盘撰写第三章：《事业的春与秋（2020–2035）》。

${BAZI_CONTEXT}

写她的事业命运弧线。庚子大运（2020–2030）金水寒气笼罩，是一段沉潜蛰伏期——不是失败，而是地下的春天在酝酿。详细写2020–2022年：创业初期的孤独、才华与市场之间的错位感、内心的怀疑与坚持。写2023–2025年：开始找到自己的节奏，一些事情慢慢变得清晰，但仍在砥砺。然后笔锋一转：2026丙午年，流年大运交叉，丙火来援，这是她近十年最重要的一个拐点，旧业翻新，新局初现，写这一年的事业具体感受。展望2031年辛亥大运：那是她事业真正盛开的十年，写那种期待。用「春耕秋收」「蛰伏与破土」意象贯穿，语气充满信念。不少于1000汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch4',
    title: '四、财富与流水',
    prompt: `请为此命盘撰写第四章：《财富与流水》。

${BAZI_CONTEXT}

写她与钱的关系。丁火克辛金（正财），她对财有驾驭能力，但身弱时财多反累。写她的财运模式：流动型而非守财型，财来财去，但生命中一直有财，且往往在最需要时出现。写她最适合以才华变现、自主创业，而非打工换薪水。写庚子大运金水寒气压制下财运的起伏，2026年丙火生扶后财运的回暖迹象。深情写她在财富问题上最深的课题：学会相信自己「值得被支付」——很多身弱丁火的女性，才华出众却不擅长为自己要价，这是心理层面而非命运层面的困境。给她温柔而坚定的支撑。语气从容优雅，让她对钱产生从容感而非焦虑。不少于800汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch5',
    title: '五、爱与等待',
    prompt: `请为此命盘撰写第五章：《爱与等待》。

${BAZI_CONTEXT}

这是全书最诗意最私密的一章。写丁火女子在感情里的样子：全情投入，如蜡烛燃烧，她给出光和热，却害怕被风吹灭。写她渴望一段灵魂层面的深度连接，而不只是世俗婚姻的「搭伴过日子」。写她的感情功课：她常常付出比得到更多；她需要一个能「添柴」而非「吹风」的人——能滋养她、包容她的敏感、欣赏她的深度。写庚子大运感情的考验（金水克火，感情路上阻力）。写35岁的她，对爱情已经有了更成熟的理解——不再慌张，开始懂得什么叫做「缘分的火候」。写2026–2027年前后感情的转机迹象。引用李商隐「此情可待成追忆，只是当时已惘然」或纳兰性德词句，自然融入。写出那种深沉的、已经懂得等待的爱。不少于1000汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch6',
    title: '六、身体是灵魂的居所',
    prompt: `请为此命盘撰写第六章：《身体是灵魂的居所》。

${BAZI_CONTEXT}

写健康养生，但要像老中医在耳边轻声嘱咐，不是警告，是关怀。身弱丁火：心脏、眼睛、血液循环是她天生需要珍惜的部分。写她的身体模式：容易操劳过度、忘记休息；情绪与身体高度联动，压力大时容易有炎症、失眠、胸口憋闷的反应。写庚子大运水气过重，寒湿入体，需要温养。写具体而诗意的养生之道：向阳而坐，早睡，多接触木性（植物、山林、书籍、木质空间），少吹冷风，温食暖饮，少寒凉生冷，情绪要有出口。写她应该把「照顾自己」列为第一优先——因为她的光，需要她自己先守护好那根烛芯。写得像一封关于自我爱护的情书。不少于800汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch7',
    title: '七、丙午年的光与影（2026年全解）',
    prompt: `请为此命盘撰写第七章：《丙午年的光与影（2026年全解）》。

${BAZI_CONTEXT}

这是全书最重要的实操章节，但仍要保持诗意。

详细分析2026丙午年：
- 丙火天干与丁火日主比肩（同类来援）、且丙火克庚（削弱大运庚金的压制）
- 午火地支入局，丁未日柱得午未合，日支活跃
- 整体：这是庚子大运十年中，她「火力」最强、最有突破力的一年

按时间线展开：
- 上半年（1–6月，尤其3–5月）：哪些方向最有突破？事业上宜大胆展示、重要会谈、品牌发布；感情上注意出现的新机缘
- 下半年（7–12月）：丙午能量逐渐沉淀，巩固成果，注意过度消耗

四个维度：
1. 事业：最佳出手窗口，展示才华，收获之前多年的播种
2. 财运：财运回暖，但要注意「好事多磨」，谈判需要耐心
3. 感情：感情上有进展或出现重要的人
4. 健康：火气旺盛要注意心火上炎，保持睡眠

也要诚实写出「影」：丙丁比肩竞争心也强，要防止情绪冲动；午火生辰（夏）能量过旺要学会收敛。

让读者读了既燃烧又沉稳，充满力量。不少于1000汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch8',
    title: '八、未来十年的路（2026–2035）',
    prompt: `请为此命盘撰写第八章：《未来十年的路（2026–2035）》。

${BAZI_CONTEXT}

写宏观时间路线图，用散文段落而非列表。

四个阶段，每段深情展开：

第一段（2026–2027）：点火期。丙午年是发令枪，丁未年（2027）延续火气，这两年是她人生新篇章的开端。写她应该在这个窗口做什么，种什么种子。

第二段（2028–2030）：庚子大运尾声。戊申、己酉流年，土气渐重，写这段时间是巩固成果、深根固本的阶段，警惕过度扩张，保护已有成果。

第三段（2031–2033）：辛亥大运初启。新的十年格局展开，辛亥与命局关系的分析。写她进入一个更稳定、更有积累的阶段，事业上的收获开始显现，感情上也可能进入更稳定的关系。

第四段（2034–2035）：运势峰值期。写那种收获季节的感受——不是突然爆发，而是多年耕耘后安然的丰盛。

整章要让她读了对未来充满期待而非焦虑，觉得「值得」走完这段旅程。不少于900汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch9',
    title: '九、开运之道',
    prompt: `请为此命盘撰写第九章：《开运之道》。

${BAZI_CONTEXT}

用神为木（甲乙卯），写具体的开运生活美学建议。不要写成干巴巴的清单，而是写成一段关于「如何让生命更顺畅流动」的生活美学叙述。

涵盖：
- 居住方位：东方、东南方，窗户朝阳，绿植相伴，木质家具
- 色彩穿搭：绿、青、浅米、木棕——用这些颜色滋养用神
- 饮食起居：温食暖饮，规律早睡，多接触自然，森林、山林、茶园
- 精神层面：阅读是她最大的开运行为；与有智慧的人深谈；写日记、写作
- 数字与缘分：3和8是她的幸运数字
- 远离：寒湿环境（不只是物理的，也包括让她感到压抑的人际关系）；情绪内耗；过度给予而不懂得接受
- 关于金钱的开运：相信自己值得，大胆标价，清晰地谈钱

写得像一位智慧的风水师兼生活美学家在给她布置人生，让她读了想立刻改变生活方式，感觉充满希望。不少于800汉字，散文诗风格，输出HTML片段。`
  },
  {
    id: 'ch10',
    title: '十、写给你的信',
    prompt: `请为此命盘撰写第十章，也是最后一章：《写给你的信》。

${BAZI_CONTEXT}

这是全书最私密、最温柔的结尾。用第二人称「你」写一封信——就像她最信任的长者，或是另一个更智慧的自己，写给35岁的她。

这封信要写：
- 你看见了她这一路走来的疲惫和勇敢
- 你知道她有多少次在深夜怀疑过自己
- 你知道她多少次在别人不知道的地方独自撑起了一切
- 告诉她：她的烛火不会熄灭，因为那是她的本质
- 告诉她：她不需要成为更耀眼的太阳，她就是那一盏最温柔的灯，照亮所有靠近她的人
- 告诉她：35岁，不是「还没有」，而是「刚刚好」——她所有的经历都是在为接下来的绽放做准备
- 告诉她：她值得被爱，值得被看见，值得得到她自己给别人的那种温柔
- 结尾写出那种「被深深看见的感动」——不是悲伤，而是安慰，是被理解，是「终于有人懂我」

用能让人落泪的语言，但不是悲伤，而是那种「被看见」的感动。最后一句话要成为她会记住很久的句子。

不少于900汉字，散文诗风格，输出HTML片段。`
  }
];

function callDeepSeek(chapterPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: chapterPrompt }
      ],
      max_tokens: 3000,
      temperature: 0.88,
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
          reject(new Error('Parse error: ' + data.slice(0, 300)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildHtml(chaptersHtml) {
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
    --gold: #c9a84c;
    --gold-light: #e8c96a;
    --gold-dim: #8a6e32;
    --text: #e8dfc8;
    --text-dim: #a89878;
    --accent: #d4873a;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Serif SC', 'Songti SC', 'STSong', Georgia, serif;
    line-height: 2.1;
    font-size: 17px;
  }

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
    background: radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%);
    border-radius: 50%;
    top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    pointer-events: none;
  }

  .cover-icon {
    font-size: 80px;
    margin-bottom: 36px;
    animation: flicker 5s ease-in-out infinite;
    display: block;
  }

  @keyframes flicker {
    0%,100% { opacity: 1; transform: scale(1) rotate(-1deg); }
    30% { opacity: 0.87; transform: scale(0.97) rotate(1deg); }
    60% { opacity: 0.94; transform: scale(1.02) rotate(-0.5deg); }
  }

  .cover-badge {
    font-size: 12px;
    letter-spacing: 6px;
    color: var(--gold-dim);
    margin-bottom: 24px;
    text-transform: uppercase;
  }

  .cover-title {
    font-size: 40px;
    font-weight: 300;
    color: var(--gold-light);
    letter-spacing: 8px;
    margin-bottom: 8px;
    text-shadow: 0 0 60px rgba(201,168,76,0.25);
  }

  .cover-title-sub {
    font-size: 14px;
    letter-spacing: 5px;
    color: var(--gold-dim);
    margin-bottom: 48px;
  }

  .cover-line {
    width: 100px;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--gold), transparent);
    margin: 0 auto 48px;
  }

  .cover-bazi {
    font-size: 22px;
    letter-spacing: 5px;
    color: var(--gold);
    margin-bottom: 20px;
  }

  .cover-meta {
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 2px;
    line-height: 2.4;
  }

  .cover-foot {
    position: absolute;
    bottom: 48px; left: 0; right: 0;
    text-align: center;
    font-size: 12px;
    color: var(--gold-dim);
    letter-spacing: 3px;
  }

  .toc {
    background: var(--bg2);
    padding: 64px 40px;
    border-bottom: 1px solid rgba(201,168,76,0.12);
  }

  .toc-head {
    font-size: 12px;
    letter-spacing: 6px;
    color: var(--gold-dim);
    text-align: center;
    margin-bottom: 40px;
    text-transform: uppercase;
  }

  .toc-list {
    max-width: 620px;
    margin: 0 auto;
    list-style: none;
  }

  .toc-list li {
    padding: 12px 0;
    border-bottom: 1px solid rgba(201,168,76,0.07);
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .toc-n {
    font-size: 11px;
    color: var(--gold-dim);
    letter-spacing: 1px;
    width: 20px;
    flex-shrink: 0;
    text-align: right;
  }

  .toc-list a {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 15px;
    transition: color 0.25s;
  }

  .toc-list a:hover { color: var(--gold); }

  .content {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 40px;
  }

  .chapter {
    padding: 88px 0;
    border-bottom: 1px solid rgba(201,168,76,0.1);
  }

  .chapter:last-child { border-bottom: none; }

  .chapter h2 {
    font-size: 23px;
    font-weight: 400;
    color: var(--gold);
    letter-spacing: 3px;
    margin-bottom: 52px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(201,168,76,0.18);
    position: relative;
  }

  .chapter h2::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0;
    width: 48px; height: 2px;
    background: var(--gold);
  }

  .chapter h3 {
    font-size: 16px;
    font-weight: 500;
    color: var(--accent);
    letter-spacing: 2px;
    margin: 44px 0 18px;
  }

  .chapter p {
    color: var(--text);
    margin-bottom: 26px;
    text-indent: 2em;
    line-height: 2.15;
    text-align: justify;
    font-size: 17px;
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
    border-left: 2px solid var(--gold);
    padding: 20px 32px;
    margin: 40px 0;
    background: rgba(201,168,76,0.04);
    border-radius: 0 8px 8px 0;
    color: var(--gold-light);
    font-size: 15.5px;
    letter-spacing: 1px;
    line-height: 2.3;
    font-style: italic;
  }

  blockquote p { text-indent: 0; margin: 0; }

  .letter-wrap {
    background: rgba(201,168,76,0.04);
    border: 1px solid rgba(201,168,76,0.14);
    border-radius: 12px;
    padding: 48px 52px;
    margin-top: 20px;
  }

  .ornament {
    text-align: center;
    color: var(--gold-dim);
    font-size: 18px;
    letter-spacing: 10px;
    margin: 60px 0;
  }

  footer {
    text-align: center;
    padding: 64px 40px;
    border-top: 1px solid rgba(201,168,76,0.1);
    color: var(--text-dim);
    font-size: 13px;
    letter-spacing: 2px;
    line-height: 2.8;
  }

  footer .fi { font-size: 30px; display: block; margin-bottom: 12px; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 3px; }

  @media (max-width: 600px) {
    body { font-size: 15px; }
    .cover-title { font-size: 28px; letter-spacing: 4px; }
    .content { padding: 0 20px; }
    .chapter { padding: 56px 0; }
    .letter-wrap { padding: 28px 24px; }
    blockquote { padding: 16px 20px; }
  }
</style>
</head>
<body>

<div class="cover">
  <span class="cover-icon">🕯️</span>
  <div class="cover-badge">善缘 · 命理研究 · 专属报告</div>
  <h1 class="cover-title">人生命理报告</h1>
  <div class="cover-title-sub">POETIC LIFE READING &nbsp;·&nbsp; 诗意版</div>
  <div class="cover-line"></div>
  <div class="cover-bazi">辛未 · 丁酉 · 丁未 · 癸卯</div>
  <div class="cover-meta">
    日主 丁火 &nbsp;·&nbsp; 身弱 &nbsp;·&nbsp; 用神 木<br>
    庚子大运 &nbsp;·&nbsp; 2026 丙午流年 &nbsp;·&nbsp; 女 · 35岁
  </div>
  <div class="cover-foot">为你而写 &nbsp;·&nbsp; 因你而燃</div>
</div>

<div class="toc">
  <div class="toc-head">目 录</div>
  <ul class="toc-list">
    <li><span class="toc-n">一</span><a href="#ch1">命如烛火 — 丁火女子的底色</a></li>
    <li><span class="toc-n">二</span><a href="#ch2">五行之歌 — 你生命中的力量与柔软</a></li>
    <li><span class="toc-n">三</span><a href="#ch3">事业的春与秋（2020–2035）</a></li>
    <li><span class="toc-n">四</span><a href="#ch4">财富与流水</a></li>
    <li><span class="toc-n">五</span><a href="#ch5">爱与等待</a></li>
    <li><span class="toc-n">六</span><a href="#ch6">身体是灵魂的居所</a></li>
    <li><span class="toc-n">七</span><a href="#ch7">丙午年的光与影（2026年全解）</a></li>
    <li><span class="toc-n">八</span><a href="#ch8">未来十年的路（2026–2035）</a></li>
    <li><span class="toc-n">九</span><a href="#ch9">开运之道</a></li>
    <li><span class="toc-n">十</span><a href="#ch10">写给你的信</a></li>
  </ul>
</div>

<div class="content">

${chaptersHtml}

<div class="ornament">· · · · ·</div>
</div>

<footer>
  <span class="fi">🕯️</span>
  善缘命理 · 专属人生报告<br>
  愿你的烛火，永不熄灭
</footer>

</body>
</html>`;
}

async function main() {
  console.log('🕯️  开始逐章生成诗意人生报告...\n');

  const results = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    process.stdout.write(`  [${ i + 1}/10] 生成「${ch.title}」... `);

    try {
      const content = await callDeepSeek(ch.prompt);
      process.stdout.write(`✅ (${content.length} chars)\n`);
      results.push({ ...ch, content });
    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
      results.push({ ...ch, content: `<p>（本章生成失败：${err.message}）</p>` });
    }

    // Small delay between calls to avoid rate limit
    if (i < chapters.length - 1) {
      await sleep(800);
    }
  }

  console.log('\n📖 组装HTML...');

  // Build chapters HTML
  let chaptersHtml = '';
  for (const ch of results) {
    const isLetter = ch.id === 'ch10';
    let innerContent = ch.content;

    // Clean up any markdown that slipped through
    innerContent = innerContent
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Remove h2 if already using section title
    // Extract h2 from content if present, else use chapter title
    let h2Match = innerContent.match(/<h2>([^<]+)<\/h2>/);
    let h2Text = h2Match ? h2Match[1] : ch.title;
    innerContent = innerContent.replace(/<h2>[^<]+<\/h2>/, '');

    let body = innerContent.trim();

    if (isLetter) {
      body = `<div class="letter-wrap">${body}</div>`;
    }

    chaptersHtml += `
<section class="chapter" id="${ch.id}">
  <h2>${h2Text}</h2>
  ${body}
</section>`;
  }

  const html = buildHtml(chaptersHtml);
  const outPath = '/Users/karen/projects/shenyuan/docs/karen-人生报告-v3-诗意版.html';
  fs.writeFileSync(outPath, html, 'utf8');

  const size = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`✅ 已保存: ${outPath}`);
  console.log(`   文件大小: ${size} KB\n`);

  // Word count
  const totalChars = results.reduce((sum, r) => {
    const text = r.content.replace(/<[^>]+>/g, '');
    return sum + text.length;
  }, 0);
  console.log(`📊 正文总字符数: ${totalChars.toLocaleString()}`);
  console.log('🕯️  完成！');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
