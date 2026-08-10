#!/usr/bin/env node
// 善缘博客文章批量生成脚本 — DeepSeek API
const https = require('https');
const fs = require('fs');
const path = require('path');

// SECURITY: Use environment variable only. Hardcoded key (sk-8597ac6c84d344039e09c8f947e4022b) has been REVOKED
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY environment variable not set. Previous key has been revoked.');
  process.exit(1);
}
const BASE_URL = 'https://shenyuan.mylumee.cn';
const BLOG_DIR = path.join(__dirname);
const TODAY = new Date().toISOString().split('T')[0];

const TOPICS = [
  { title: '八字入门：什么是八字命理，如何看懂自己的命盘', slug: 'bazi-rumen-shenme-shi-bazi' },
  { title: '2026年丙午年运势：十二生肖完整分析', slug: '2026-bingwu-yunshi-shengxiao' },
  { title: '五行缺什么怎么补：五行平衡实用指南', slug: 'wuxing-que-zenme-bu-pingheng' },
  { title: '财星旺的八字特征：哪些命格天生带财', slug: 'caixing-wang-bazi-tezheng' },
  { title: '感情线怎么看：从八字分析姻缘时机', slug: 'ganqing-bazi-yinyuan-shixi' },
  { title: '大运流年怎么算：人生阶段的运势规律', slug: 'dayun-liunian-zenme-suan' },
  { title: '紫微斗数入门：14主星性格完整解析', slug: 'ziwei-doushu-rumen-zhuxing' },
  { title: '塔罗牌大阿尔卡纳22张：完整含义与解读方法', slug: 'tarot-da-arkana-22-zhang' },
  { title: '六爻占卜入门：摇卦、起卦、断卦完整教程', slug: 'liuyao-zhanbu-rumen-jiaocheng' },
  { title: '命中注定还是可以改变：命理学的哲学观', slug: 'mingli-zhexueguan-gaibianmingyin' },
  { title: '海外华人如何保持风水：异乡布局指南', slug: 'haiwai-huaren-fengshui-zhijnan' },
  { title: '结婚时机怎么选：八字合婚与吉日挑选', slug: 'jiehun-shiqi-bazi-hehun-jiri' },
  { title: '事业不顺怎么办：从命理找突破方向', slug: 'shiye-bushun-mingli-tupo' },
  { title: '身体健康与五行：中医命理养生完整对应', slug: 'jiankang-wuxing-zhongyi-yangshen' },
  { title: '十天干性格分析：甲乙丙丁戊己庚辛壬癸', slug: 'shi-tiangan-xingge-fenxi' },
  { title: '十二地支详解：子丑寅卯辰巳午未申酉戌亥', slug: 'shier-dizhi-xiangjie' },
  { title: '日主强弱怎么判断：旺衰分析实战教程', slug: 'rizhu-qiangruo-wangshuai-fenxi' },
  { title: '官杀混杂怎么解：常见凶格化解方法', slug: 'guansha-hunza-xiongge-huajie' },
  { title: '印星过旺的影响：如何调候命局', slug: 'yinxing-guowang-tiaohou-mingju' },
  { title: '2026年犯太岁的生肖：化解方法完整指南', slug: '2026-fantaisui-shengxiao-huajie' },
];

function callDeepSeek(topic) {
  return new Promise((resolve, reject) => {
    const prompt = `你是一位资深命理学者，为善缘命理平台写高质量博客文章。

文章主题：${topic}
要求：
- 1800-2200字
- 开头用场景钩子（读者痛点/疑问），前100字吸引人继续读
- 分4-5个小节，每节用【小节标题】格式标注（我会转为H2），每节300-500字
- 包含具体例子、数据、历史典故（可引用典籍如《滴天髓》《子平真诠》）
- 语气：专业但亲切，像朋友解释，不要卖弄术语
- 结尾自然引导读者：前往善缘测算个人命盘
- 不要用markdown符号（**、##等），只用【】标注小节
- 输出纯文章正文，不含标题本身`;

    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.7,
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error('No content: ' + data));
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

function processContent(raw) {
  // Convert 【小节标题】 to <h2>
  return raw
    .replace(/【([^】]+)】/g, '</p><h2>$1</h2><p>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function generateExcerpt(content, maxLen = 120) {
  const plain = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.slice(0, maxLen) + (plain.length > maxLen ? '...' : '');
}

function articleHtml(topic, slug, content, allTopics) {
  const processed = processContent(content);
  const excerpt = generateExcerpt(content);
  const readTime = Math.ceil(content.replace(/<[^>]+>/g, '').length / 400);

  // Related: pick 3 other topics
  const related = allTopics.filter(t => t.slug !== slug).slice(0, 3);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${topic.title} | 善缘命理博客</title>
<meta name="description" content="${excerpt}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${BASE_URL}/blog/${slug}.html">
<meta property="og:title" content="${topic.title} | 善缘命理">
<meta property="og:description" content="${excerpt}">
<meta property="og:url" content="${BASE_URL}/blog/${slug}.html">
<meta property="og:image" content="${BASE_URL}/assets/img/og-cover.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${topic.title}">
<meta name="twitter:description" content="${excerpt}">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${topic.title}",
  "description": "${excerpt}",
  "author": {"@type": "Organization", "name": "善缘命理研究团队"},
  "publisher": {"@type": "Organization", "name": "善缘命理", "url": "${BASE_URL}"},
  "datePublished": "${TODAY}",
  "dateModified": "${TODAY}",
  "mainEntityOfPage": "${BASE_URL}/blog/${slug}.html",
  "image": "${BASE_URL}/assets/img/og-cover.jpg"
}
</script>
<style>
:root{--bg:#1a0f2e;--bg-card:#231540;--gold:#d4af37;--gold-light:#e8d08a;--ink:#f5f0e8;--ink-dim:rgba(245,240,232,0.7)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:'Noto Serif SC',Georgia,serif;line-height:1.9;font-size:16px}
.top-bar{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(212,175,55,0.2);background:rgba(26,15,46,0.95)}
.top-bar a{color:var(--gold-light);text-decoration:none;font-size:13px;letter-spacing:.08em}
.top-bar a:hover{color:var(--gold)}
.breadcrumb{padding:12px 24px;font-size:12px;color:var(--ink-dim)}
.breadcrumb a{color:var(--gold-light);text-decoration:none}
.breadcrumb span{margin:0 6px;opacity:.4}
.article-wrap{max-width:760px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:clamp(20px,4vw,28px);font-weight:700;color:var(--gold-light);line-height:1.4;margin-bottom:12px}
.meta{font-size:12px;color:var(--ink-dim);margin-bottom:32px;display:flex;gap:16px;flex-wrap:wrap}
.meta span{display:flex;align-items:center;gap:4px}
.article-body h2{font-size:18px;color:var(--gold);margin:36px 0 14px;padding-left:12px;border-left:3px solid var(--gold)}
.article-body p{margin-bottom:16px;color:var(--ink-dim);line-height:1.95}
.cta-box{margin:40px 0;padding:24px;background:linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.04));border:1px solid rgba(212,175,55,0.3);border-radius:12px;text-align:center}
.cta-box p{color:var(--ink-dim);margin-bottom:14px}
.cta-btn{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a84c,#a8823a);border-radius:24px;color:#fff;text-decoration:none;font-size:14px;letter-spacing:.1em}
.related{margin-top:48px;padding-top:24px;border-top:1px solid rgba(212,175,55,0.15)}
.related h3{color:var(--gold-light);font-size:15px;margin-bottom:16px}
.related ul{list-style:none}
.related li{margin-bottom:10px}
.related a{color:var(--ink-dim);text-decoration:none;font-size:14px;padding-left:12px;border-left:2px solid rgba(212,175,55,0.3)}
.related a:hover{color:var(--gold)}
</style>
</head>
<body>
<div class="top-bar">
  <a href="${BASE_URL}">← 善缘命理</a>
  <a href="${BASE_URL}/blog/">博客</a>
</div>
<div class="breadcrumb">
  <a href="${BASE_URL}">首页</a><span>›</span>
  <a href="${BASE_URL}/blog/">博客</a><span>›</span>
  ${topic.title}
</div>
<div class="article-wrap">
  <h1>${topic.title}</h1>
  <div class="meta">
    <span>✍ 善缘命理研究团队</span>
    <span>📅 ${TODAY}</span>
    <span>⏱ 约${readTime}分钟阅读</span>
  </div>
  <div class="article-body">
    <p>${processed}</p>
  </div>
  <div class="cta-box">
    <p>每个人的命盘都是独一无二的，以上仅为通用分析。想了解你的个人八字命盘，获取专属运势解读？</p>
    <a class="cta-btn" href="${BASE_URL}">立即免费测算你的八字 →</a>
  </div>
  <div class="related">
    <h3>相关文章</h3>
    <ul>
      ${related.map(t => `<li><a href="${BASE_URL}/blog/${t.slug}.html">${t.title}</a></li>`).join('\n      ')}
    </ul>
  </div>
</div>
</body>
</html>`;
}

function buildIndex(topics, excerpts) {
  const cards = topics.map((t, i) => {
    const exc = excerpts[t.slug] || '';
    return `<a class="card" href="${BASE_URL}/blog/${t.slug}.html">
      <div class="card-title">${t.title}</div>
      <div class="card-exc">${exc}</div>
      <div class="card-meta">善缘命理研究团队 · ${TODAY}</div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>善缘命理博客 | 八字塔罗紫微知识库</title>
<meta name="description" content="善缘命理博客：深度解读八字命理、塔罗占卜、紫微斗数、六爻、风水。127,000+读者的命理知识库，每周更新。">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${BASE_URL}/blog/">
<meta property="og:title" content="善缘命理博客 | 八字塔罗紫微知识库">
<meta property="og:url" content="${BASE_URL}/blog/">
<meta property="og:image" content="${BASE_URL}/assets/img/og-cover.jpg">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Blog","name":"善缘命理博客","url":"${BASE_URL}/blog/","description":"深度命理知识库：八字、塔罗、紫微斗数、六爻、风水","publisher":{"@type":"Organization","name":"善缘命理","url":"${BASE_URL}"}}
</script>
<style>
:root{--bg:#1a0f2e;--bg-card:#231540;--gold:#d4af37;--gold-light:#e8d08a;--ink:#f5f0e8;--ink-dim:rgba(245,240,232,0.7)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:'Noto Serif SC',Georgia,serif;min-height:100vh}
.top-bar{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(212,175,55,0.2)}
.top-bar a{color:var(--gold-light);text-decoration:none;font-size:13px}
.hero{text-align:center;padding:48px 20px 32px}
.hero h1{font-size:clamp(22px,5vw,32px);color:var(--gold-light);margin-bottom:10px}
.hero p{color:var(--ink-dim);font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;max-width:1100px;margin:0 auto;padding:0 20px 60px}
.card{display:block;background:var(--bg-card);border:1px solid rgba(212,175,55,0.15);border-radius:12px;padding:20px;text-decoration:none;transition:border-color .2s,transform .2s}
.card:hover{border-color:rgba(212,175,55,0.4);transform:translateY(-2px)}
.card-title{font-size:15px;color:var(--gold-light);font-weight:600;margin-bottom:10px;line-height:1.5}
.card-exc{font-size:13px;color:var(--ink-dim);line-height:1.7;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{font-size:11px;color:rgba(245,240,232,0.35);letter-spacing:.04em}
</style>
</head>
<body>
<div class="top-bar">
  <a href="${BASE_URL}">← 善缘命理</a>
</div>
<div class="hero">
  <h1>善缘命理博客</h1>
  <p>深度命理知识库 · 八字 · 塔罗 · 紫微斗数 · 六爻 · 风水</p>
</div>
<div class="grid">
${cards}
</div>
</body>
</html>`;
}

async function main() {
  const excerpts = {};
  let succeeded = 0;

  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i];
    const filePath = path.join(BLOG_DIR, `${topic.slug}.html`);

    // Skip if already generated
    if (fs.existsSync(filePath)) {
      console.log(`[${i+1}/20] SKIP (exists): ${topic.slug}`);
      const existing = fs.readFileSync(filePath, 'utf8');
      const m = existing.match(/<meta name="description" content="([^"]+)"/);
      if (m) excerpts[topic.slug] = m[1];
      succeeded++;
      continue;
    }

    console.log(`[${i+1}/20] Generating: ${topic.title}`);
    try {
      const content = await callDeepSeek(topic.title);
      const charCount = content.length;
      console.log(`  → ${charCount} chars`);

      excerpts[topic.slug] = generateExcerpt(content);
      const html = articleHtml(topic, topic.slug, content, TOPICS);
      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`  ✓ Saved: blog/${topic.slug}.html`);
      succeeded++;

      // Small delay to be gentle on API
      if (i < TOPICS.length - 1) await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗ ERROR: ${err.message}`);
    }
  }

  // Build index
  const indexHtml = buildIndex(TOPICS, excerpts);
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHtml, 'utf8');
  console.log(`\n✓ Blog index written`);
  console.log(`✓ ${succeeded}/20 articles generated`);
}

main().catch(console.error);
