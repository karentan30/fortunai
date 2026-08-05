#!/usr/bin/env node
// 善缘 blog generator v2 — 80 more articles, 10/10 quality standard

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) { console.error('DEEPSEEK_API_KEY not set'); process.exit(1); }

const SITE_URL = 'https://shenyuan.mylumee.cn';
const CTA_URL = 'https://shenyuan.mylumee.cn';
const BRAND = '善缘命理';

const EXISTING_SLUGS = [
  'bazi-intro', 'wuxing-guide', 'caishen-bazi', 'ganqing-timing', 'dayun-liuyun',
  'ziwei-intro', 'tarot-intro', 'liuyao-intro', 'fate-philosophy', 'overseas-fengshui',
  'marriage-timing', 'career-bazi', 'health-wuxing', 'tian-gan', 'di-zhi',
  'rizhu-analysis', 'guansha-mixed', 'yinxing-strong', 'taisui-2026', 'bazi-naming'
];

const TOPICS = [
  { title: '天干地支完整对应表：年柱月柱日柱时柱详解', slug: 'tiangan-dizhi-complete' },
  { title: '八字用神怎么找：扶抑法与调候法实战指南', slug: 'yongshen-method' },
  { title: '正财偏财区别：从八字看你的财运类型', slug: 'zhengcai-piancai' },
  { title: '正官七杀怎么区分：事业运的命理密码', slug: 'zhengguan-qisha' },
  { title: '印星在八字中的作用：正印偏印完整解析', slug: 'yinxing-analysis' },
  { title: '食神伤官详解：创造力与表达力的命理根源', slug: 'shishen-shangguan' },
  { title: '比肩劫财分析：竞争与合作的命理逻辑', slug: 'bijian-jiecai' },
  { title: '八字合婚八大步骤：专业合婚完整流程', slug: 'hehun-steps' },
  { title: '2026年流年运势：哪些生肖迎来转折年', slug: 'liuyun-2026' },
  { title: '八字看事业：哪种命格适合创业vs打工', slug: 'bazi-career-type' },
  { title: '命理看健康：五脏六腑与五行的对应关系', slug: 'health-wuxing-organs' },
  { title: '八字看子女缘：什么命格子女运旺', slug: 'bazi-children' },
  { title: '八字看父母缘：原生家庭与命运的关系', slug: 'bazi-parents' },
  { title: '命中注定的相遇：八字合婚中的天作之合', slug: 'destined-match' },
  { title: '大运交接期怎么度过：命运转折点的应对策略', slug: 'dayun-transition' },
  { title: '八字断财运的方法：流年财星分析实战', slug: 'bazi-wealth-analysis' },
  { title: '女命旺夫命格：哪些特征是旺夫相', slug: 'female-wangfu' },
  { title: '男命旺妻命格：婚姻中的阴阳平衡', slug: 'male-wangqi' },
  { title: '八字看移民：哪些命格适合出国发展', slug: 'bazi-immigration' },
  { title: '驿马星详解：奔波命与漂泊运的化解', slug: 'yima-star' },
  { title: '桃花星大全：正桃花与烂桃花的区分方法', slug: 'taohua-star' },
  { title: '红鸾天喜：婚姻喜庆流年的判断', slug: 'hongluan-tianxi' },
  { title: '华盖星详解：孤独还是艺术天赋？', slug: 'huagai-star' },
  { title: '文昌星与学业：考试运的命理分析', slug: 'wenchang-study' },
  { title: '紫微斗数十四主星性格完整对比', slug: 'ziwei-14stars' },
  { title: '紫微斗数命宫解析：12宫位详细含义', slug: 'ziwei-12palaces' },
  { title: '七政四余：传统星命学的现代应用', slug: 'qizheng-siyu' },
  { title: '塔罗大阿尔卡纳第一张：愚者牌深度解读', slug: 'tarot-fool' },
  { title: '塔罗大阿尔卡纳：魔法师到世界牌完整含义', slug: 'tarot-major-arcana' },
  { title: '塔罗三牌阵使用指南：过去现在未来的解读', slug: 'tarot-three-card' },
  { title: '塔罗凯尔特十字牌阵：专业解牌完整教程', slug: 'tarot-celtic-cross' },
  { title: '每日一塔罗：如何建立每日占卜习惯', slug: 'daily-tarot-habit' },
  { title: '六爻起卦方法：铜钱法与数字法对比', slug: 'liuyao-methods' },
  { title: '六爻六亲详解：父母爻兄弟爻子孙爻官鬼爻妻财爻', slug: 'liuyao-sixkin' },
  { title: '梅花易数入门：北宋邵雍的预测哲学', slug: 'meihua-yishu' },
  { title: '奇门遁甲基础：时间与空间的命理学', slug: 'qimen-dunjia' },
  { title: '风水与命理：居家布局如何配合八字', slug: 'fengshui-bazi' },
  { title: '海外华人风水禁忌：西方住宅的东方调整', slug: 'overseas-fengshui-tips' },
  { title: '生肖属鼠完整命理分析：性格财运感情', slug: 'shengxiao-rat' },
  { title: '生肖属牛完整命理分析：性格财运感情', slug: 'shengxiao-ox' },
  { title: '生肖属虎完整命理分析：性格财运感情', slug: 'shengxiao-tiger' },
  { title: '生肖属兔完整命理分析：性格财运感情', slug: 'shengxiao-rabbit' },
  { title: '生肖属龙完整命理分析：性格财运感情', slug: 'shengxiao-dragon' },
  { title: '生肖属蛇完整命理分析：性格财运感情', slug: 'shengxiao-snake' },
  { title: '生肖属马完整命理分析：性格财运感情', slug: 'shengxiao-horse' },
  { title: '生肖属羊完整命理分析：性格财运感情', slug: 'shengxiao-goat' },
  { title: '生肖属猴完整命理分析：性格财运感情', slug: 'shengxiao-monkey' },
  { title: '生肖属鸡完整命理分析：性格财运感情', slug: 'shengxiao-rooster' },
  { title: '生肖属狗完整命理分析：性格财运感情', slug: 'shengxiao-dog' },
  { title: '生肖属猪完整命理分析：性格财运感情', slug: 'shengxiao-pig' },
  { title: '2026年太岁星君：值年太岁的影响与化解', slug: 'taisui-2026-guide' },
  { title: '农历与阳历换算：命理起盘的时间基础', slug: 'lunar-solar-calendar' },
  { title: '八字起名：如何根据命理选择名字用字', slug: 'bazi-naming-guide' },
  { title: '公司起名与风水：企业命理学的实践', slug: 'company-naming-fengshui' },
  { title: '择日学基础：结婚搬家开业的吉日选择', slug: 'zeji-basics' },
  { title: '嫁娶择日完整指南：婚礼日期的命理考量', slug: 'wedding-date-selection' },
  { title: '开业择日：生意兴隆的日期选择方法', slug: 'business-opening-date' },
  { title: '命理师如何收费：行业透明度与价值标准', slug: 'fortune-teller-fees' },
  { title: '算命准不准：理性看待命理预测的边界', slug: 'fortune-accuracy' },
  { title: '中西方命理对比：BaZi vs Western Astrology', slug: 'bazi-vs-western' },
  { title: '印度占星与中国八字：两大体系的异同', slug: 'vedic-vs-bazi' },
  { title: '韩国四柱与中国八字：同源不同流的命理', slug: 'saju-vs-bazi' },
  { title: '日本算命文化：四柱推命在日本的发展', slug: 'japanese-fortune-culture' },
  { title: '东南亚华人命理：马来西亚新加坡的风俗', slug: 'southeast-asia-chinese-fortune' },
  { title: '美国华人如何找命理师：海外求测完整指南', slug: 'usa-chinese-fortune-guide' },
  { title: '加拿大华人算命指南：多伦多温哥华资源', slug: 'canada-chinese-fortune' },
  { title: '澳大利亚华人命理：悉尼墨尔本的选择', slug: 'australia-chinese-fortune' },
  { title: '命理与心理学：荣格原型与中国命理的共鸣', slug: 'fortune-psychology-jung' },
  { title: '命理改运方法大全：从名字到风水的全面调整', slug: 'change-fortune-methods' },
  { title: '放生积德与命运：传统改运方法的现代诠释', slug: 'release-life-merit' },
  { title: '冥想与命理：东方智慧的身心合一', slug: 'meditation-fortune' },
  { title: '节气与运势：二十四节气的命理意义', slug: 'solar-terms-fortune' },
  { title: '春节八字解读：农历新年的运势密码', slug: 'spring-festival-bazi' },
  { title: '冬至命理：一阳来复与运势转机', slug: 'winter-solstice-fortune' },
  { title: '清明节与祖先：传统节日的命理文化', slug: 'qingming-ancestors' },
  { title: '七夕与姻缘：中国情人节的命理传说', slug: 'qixi-romance' },
  { title: '中元节与风水：七月半的禁忌与化解', slug: 'zhongyuan-fengshui' },
  { title: '重阳节与长寿命格：老年运势的命理分析', slug: 'chongyang-longevity' },
  { title: '命理与职场：面试时机与升职流年', slug: 'fortune-career-timing' },
  { title: '命理新手完整入门：从零开始学八字的路线图', slug: 'bazi-beginner-roadmap' },
];

function callDeepSeek(topic) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `你是一位资深命理学者，为善缘命理平台写高质量SEO博客文章。

文章主题：${topic}

要求：
- 2500-3000字
- 第一段：真实场景钩子，前150字让人想继续读
- 目录：文章开头用"本文目录："列3-5个小节标题
- 正文：用【小节标题】标记H2，用「子标题」标记H3
- 每节500-600字，包含具体例子、历史典故、可信数据
- 语气：专业权威但亲切，像老师讲课
- 文末必须有【常见问题】小节，包含3-5个问答，格式：
  问：[问题]
  答：[100字以上的详细回答]
- 结尾自然引导读者去善缘免费测算
- 输出纯文字，【】标H2，「」标H3，"本文目录："标目录`
      }],
      max_tokens: 4000,
      temperature: 0.75
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
          if (json.error) throw new Error(json.error.message);
          resolve(json.choices[0].message.content);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function formatArticleHtml(topic, slug, content, index) {
  const dateStr = new Date().toISOString().split('T')[0];
  const wordCount = content.length;
  const readMins = Math.ceil(wordCount / 400);

  // Extract TOC if present
  let toc = '';
  const tocMatch = content.match(/本文目录：([\s\S]*?)(?=【|$)/);
  if (tocMatch) {
    const tocItems = tocMatch[1].trim().split('\n').filter(l => l.trim());
    toc = `<div class="toc"><strong>本文目录</strong><ul>${tocItems.map(t => `<li>${t.replace(/^\d+[.、]\s*/, '')}</li>`).join('')}</ul></div>`;
    content = content.replace(/本文目录：[\s\S]*?(?=【)/, '');
  }

  // Convert markers to HTML
  let body = content
    .replace(/【常见问题】/g, '</p><div class="faq-section"><h2>常见问题</h2>')
    .replace(/【([^】]+)】/g, '</p><h2>$1</h2><p>')
    .replace(/「([^」]+)」/g, '</p><h3>$1</h3><p>')
    .replace(/^问：(.+)$/mg, '</p><div class="faq-item"><div class="faq-q">❓ $1</div>')
    .replace(/^答：(.+)$/mg, '<div class="faq-a">$1</div></div><p>')
    .split('\n\n').join('</p><p>')
    .trim();
  if (!body.startsWith('<')) body = '<p>' + body;
  if (!body.endsWith('>')) body += '</p>';
  if (body.includes('class="faq-section"') && !body.includes('</div></p>')) body += '</div>';

  // Internal links — pick 3 from existing + 2 from new batch
  const relatedSlugs = [...EXISTING_SLUGS.slice(0, 3), ...TOPICS.filter((_, i) => i !== index).slice(0, 2).map(t => t.slug)];
  const relatedTopics = [
    ...EXISTING_SLUGS.slice(0, 3).map(s => ({ slug: s, title: s.replace(/-/g, ' ') })),
    ...TOPICS.filter((_, i) => i !== index).slice(0, 2)
  ];

  const description = content.replace(/【[^】]*】|「[^」]*」/g, '').replace(/\s+/g, ' ').substring(0, 155).trim() + '…';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic} | 善缘命理博客</title>
<meta name="description" content="${description.substring(0, 160)}">
<meta name="keywords" content="八字,命理,${topic.split('：')[0]},善缘,算命,运势">
<link rel="canonical" href="${SITE_URL}/blog/${slug}.html">
<meta property="og:title" content="${topic} | 善缘命理">
<meta property="og:description" content="${description.substring(0, 155)}">
<meta property="og:url" content="${SITE_URL}/blog/${slug}.html">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${topic}",
  "description": "${description.substring(0, 155).replace(/"/g, '\\"')}",
  "author": {"@type": "Organization", "name": "善缘命理研究团队"},
  "publisher": {"@type": "Organization", "name": "善缘命理", "url": "${SITE_URL}", "logo": {"@type": "ImageObject", "url": "${SITE_URL}/assets/img/logo.png"}},
  "datePublished": "${dateStr}",
  "dateModified": "${dateStr}",
  "url": "${SITE_URL}/blog/${slug}.html",
  "mainEntityOfPage": "${SITE_URL}/blog/${slug}.html",
  "inLanguage": "zh-CN",
  "about": {"@type": "Thing", "name": "命理学"}
}
</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'PingFang SC','Noto Serif SC',serif;background:#0d0820;color:#e8dff8;line-height:1.9;font-size:16px}
.nav{background:rgba(20,10,50,0.97);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(201,168,76,0.2);backdrop-filter:blur(8px)}
.nav a{color:#c9a84c;text-decoration:none;font-size:14px}.nav-brand{color:#fff;font-weight:700;font-size:17px;letter-spacing:.05em}
.breadcrumb{padding:14px 24px;font-size:13px;color:#8a7a9a}
.breadcrumb a{color:#c9a84c;text-decoration:none}
.container{max-width:800px;margin:0 auto;padding:0 24px 80px}
.article-header{padding:36px 0 28px;border-bottom:1px solid rgba(201,168,76,0.15);margin-bottom:36px}
h1{font-size:clamp(20px,4vw,30px);font-weight:700;line-height:1.4;color:#f5f0ff;margin-bottom:18px}
.meta{font-size:13px;color:#8a7a9a;display:flex;gap:18px;flex-wrap:wrap;align-items:center}
.meta-tag{background:rgba(201,168,76,0.12);color:#c9a84c;padding:2px 10px;border-radius:12px;font-size:12px}
.toc{background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:10px;padding:18px 20px;margin:0 0 32px}
.toc strong{color:#c9a84c;font-size:14px;display:block;margin-bottom:10px}
.toc ul{list-style:none;padding-left:0}
.toc li{padding:4px 0;font-size:14px;color:#b8a8d8}
.toc li::before{content:"▸ ";color:#c9a84c}
.article-body p{margin-bottom:20px;color:#ccc0e8;font-size:15.5px}
.article-body h2{font-size:21px;font-weight:700;color:#f0e8ff;margin:40px 0 16px;padding-left:14px;border-left:4px solid #c9a84c;line-height:1.4}
.article-body h3{font-size:17px;font-weight:600;color:#d4b8ff;margin:28px 0 12px}
.faq-section{background:rgba(201,168,76,0.04);border:1px solid rgba(201,168,76,0.15);border-radius:12px;padding:24px;margin:36px 0}
.faq-section h2{border:none;padding:0;margin:0 0 20px;color:#c9a84c;font-size:18px}
.faq-item{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid rgba(201,168,76,0.1)}
.faq-item:last-child{border:none;margin:0;padding:0}
.faq-q{font-weight:700;color:#f0e8ff;margin-bottom:10px;font-size:15px}
.faq-a{color:#b8a8d8;font-size:14.5px;line-height:1.8;padding-left:16px;border-left:2px solid rgba(201,168,76,0.3)}
.cta-box{margin:44px 0;padding:32px 28px;background:linear-gradient(135deg,rgba(201,168,76,0.1),rgba(160,100,220,0.08));border:1px solid rgba(201,168,76,0.3);border-radius:16px;text-align:center}
.cta-box p{color:#c8b8e8;margin-bottom:18px;font-size:15px;line-height:1.7}
.cta-btn{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#c9a84c,#a8823a);color:#fff;text-decoration:none;border-radius:28px;font-size:15px;font-weight:700;letter-spacing:0.06em;box-shadow:0 4px 20px rgba(201,168,76,0.3)}
.related{margin-top:44px;padding-top:28px;border-top:1px solid rgba(201,168,76,0.12)}
.related h3{font-size:16px;color:#c9a84c;margin-bottom:18px;font-weight:600}
.related-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.related-grid a{color:#b8a8d8;text-decoration:none;font-size:13px;padding:12px 14px;background:rgba(201,168,76,0.05);border-radius:8px;border:1px solid rgba(201,168,76,0.12);line-height:1.5}
.related-grid a:hover{border-color:rgba(201,168,76,0.3);color:#e8d8f8}
.footer{margin-top:60px;padding:28px;text-align:center;font-size:12px;color:#5a4a7a;border-top:1px solid rgba(201,168,76,0.08)}
@media(max-width:600px){.related-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-brand" href="${SITE_URL}">善缘命理</a>
  <div style="display:flex;gap:20px">
    <a href="${SITE_URL}/blog/">博客</a>
    <a href="${SITE_URL}">免费测算</a>
  </div>
</nav>
<div class="breadcrumb">
  <a href="${SITE_URL}">首页</a> › <a href="${SITE_URL}/blog/">博客</a> › ${topic.split('：')[0]}
</div>
<div class="container">
  <div class="article-header">
    <h1>${topic}</h1>
    <div class="meta">
      <span class="meta-tag">命理知识</span>
      <span>善缘命理研究团队</span>
      <span>${dateStr}</span>
      <span>约${readMins}分钟阅读 · ${wordCount}字</span>
    </div>
  </div>
  ${toc}
  <div class="article-body">
    ${body}
  </div>
  <div class="cta-box">
    <p>想了解你的个人命盘？善缘AI命理系统结合传统八字与现代算法，<br>5分钟生成专属命盘报告，财运姻缘大运一次看透。</p>
    <a class="cta-btn" href="${CTA_URL}">立即免费测算 →</a>
  </div>
  <div class="related">
    <h3>相关文章推荐</h3>
    <div class="related-grid">
      ${relatedTopics.map(t => `<a href="${SITE_URL}/blog/${t.slug}.html">${t.title}</a>`).join('\n      ')}
    </div>
  </div>
</div>
<div class="footer">
  © 2026 善缘命理 · <a href="${SITE_URL}" style="color:#5a4a7a">shenyuan.mylumee.cn</a> · 命理仅供参考，切勿沉迷，重要决策请结合实际情况
</div>
</body>
</html>`;
}

async function main() {
  const blogDir = path.join(__dirname);
  const results = [];
  let ok = 0, fail = 0;

  for (let i = 0; i < TOPICS.length; i++) {
    const { title, slug } = TOPICS[i];
    const outPath = path.join(blogDir, `${slug}.html`);
    if (fs.existsSync(outPath)) {
      console.log(`[${i+1}/${TOPICS.length}] SKIP (exists): ${slug}`);
      results.push({ title, slug, wordCount: 0, readMins: 0 });
      ok++;
      continue;
    }
    console.log(`[${i+1}/${TOPICS.length}] Generating: ${title}`);
    try {
      const content = await callDeepSeek(title);
      const wordCount = content.length;
      const readMins = Math.ceil(wordCount / 400);
      const html = formatArticleHtml(title, slug, content, i);
      fs.writeFileSync(outPath, html, 'utf8');
      results.push({ title, slug, wordCount, readMins });
      console.log(`  ✓ ${wordCount}字 → ${slug}.html`);
      ok++;
    } catch(e) {
      console.error(`  ✗ ${e.message}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  // Rebuild full index with all 100 articles
  const allFiles = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && !f.includes('generate'))
    .map(f => {
      const slug = f.replace('.html', '');
      const topic = TOPICS.find(t => t.slug === slug);
      return topic ? { slug, title: topic.title, readMins: 5 } : null;
    })
    .filter(Boolean);

  const dateStr = new Date().toISOString().split('T')[0];
  const cards = allFiles.map(a => `
    <a class="card" href="/blog/${a.slug}.html">
      <div class="card-title">${a.title}</div>
      <div class="card-meta">${dateStr} · 约${a.readMins}分钟阅读</div>
    </a>`).join('');

  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善缘命理博客 | 八字塔罗紫微命理知识库</title>
<meta name="description" content="善缘命理博客：100篇专业命理文章，八字入门到精通，塔罗解读，紫微斗数，生肖运势。海外华人命理指南，AI命理平台。">
<link rel="canonical" href="${SITE_URL}/blog/">
<meta name="robots" content="index, follow">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Blog","name":"善缘命理博客","url":"${SITE_URL}/blog/","description":"专业命理知识库，八字塔罗紫微斗数全覆盖","publisher":{"@type":"Organization","name":"善缘命理","url":"${SITE_URL}"}}
</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'PingFang SC','Noto Sans SC',sans-serif;background:#0d0820;color:#e8dff8;line-height:1.7}
.nav{background:rgba(20,10,50,0.97);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(201,168,76,0.2);backdrop-filter:blur(8px)}
.nav a{color:#c9a84c;text-decoration:none;font-size:14px}.nav-brand{color:#fff;font-weight:700}
.hero{padding:48px 24px 32px;text-align:center}
.hero h1{font-size:clamp(24px,5vw,36px);font-weight:700;color:#f5f0ff;margin-bottom:12px}
.hero p{color:#9a87c0;font-size:15px}
.hero-count{display:inline-block;background:rgba(201,168,76,0.12);color:#c9a84c;padding:4px 16px;border-radius:20px;font-size:13px;margin-top:12px}
.grid{max-width:1000px;margin:0 auto;padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
.card{display:block;padding:20px;background:rgba(201,168,76,0.04);border:1px solid rgba(201,168,76,0.15);border-radius:12px;text-decoration:none;transition:all 0.2s}
.card:hover{background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.3);transform:translateY(-2px)}
.card-title{font-size:14px;color:#e8d8f8;font-weight:600;line-height:1.5;margin-bottom:10px}
.card-meta{font-size:12px;color:#7a6a9a}
.footer{padding:32px;text-align:center;font-size:12px;color:#5a4a7a;border-top:1px solid rgba(201,168,76,0.1)}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-brand" href="${SITE_URL}">善缘命理</a>
  <a href="${SITE_URL}">免费测算 →</a>
</nav>
<div class="hero">
  <h1>命理知识博客</h1>
  <p>八字 · 塔罗 · 紫微斗数 · 生肖运势 · 海外华人命理指南</p>
  <span class="hero-count">${allFiles.length} 篇专业文章</span>
</div>
<div class="grid">${cards}</div>
<div class="footer">© 2026 善缘命理 · <a href="${SITE_URL}" style="color:#5a4a7a">shenyuan.mylumee.cn</a> · 命理仅供参考</div>
</body>
</html>`;

  fs.writeFileSync(path.join(blogDir, 'index.html'), indexHtml, 'utf8');
  console.log(`\n✓ index.html rebuilt with ${allFiles.length} articles`);
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
