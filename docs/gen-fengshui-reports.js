'use strict';
const https = require('https');
const fs = require('fs');
const { calcBazi } = require('../server/bazi');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!DEEPSEEK_KEY) { console.error('需要 DEEPSEEK_API_KEY'); process.exit(1); }

async function deepseek(systemPrompt, userPrompt, label, maxTokens) {
  console.log(`\n[${label}] 开始生成...`);
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    max_tokens: maxTokens || 12000,
    temperature: 0.72,
    stream: false
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) { reject(new Error(JSON.stringify(p.error))); return; }
          const text = p.choices?.[0]?.message?.content || '';
          console.log(`[${label}] 完成，字数：${text.length}`);
          resolve(text);
        } catch(e) { reject(new Error(data.slice(0,300))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('超时')); });
    req.write(body); req.end();
  });
}

function mdToHtml(md) {
  return md
    .replace(/^#{1,2} (.+)$/gm, '<h2 class="chapter">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/^\|(.+)\|$/gm, (row) => {
      const cells = row.slice(1,-1).split('|').map(c => c.trim());
      if (cells.every(c => c.match(/^[-:]+$/))) return '';
      const tag = cells.some(c => c.match(/^[\s:*]+$/)) ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table>${m}</table>`)
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .split(/\n{2,}/).map(para => {
      if (!para.trim()) return '';
      if (para.match(/^<[htulbq]/)) return para;
      return `<p>${para.trim()}</p>`;
    }).join('\n');
}

function buildHtml({ title, subtitle, icon, color, coverMeta, coverBadge, content, price }) {
  const accentHex = color || '#c9a84c';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善缘 · ${title}</title>
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

/* ══ 封面 ══ */
.cover {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 80px 48px 64px;
  position: relative; overflow: hidden;
  background:
    radial-gradient(ellipse 70% 50% at 50% 20%, rgba(${hexToRgb(accentHex)},0.13) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 50% 85%, rgba(120,60,40,0.07) 0%, transparent 60%),
    linear-gradient(180deg, #1a1508 0%, #201a0e 55%, #1a1508 100%);
  border-bottom: 1px solid rgba(${hexToRgb(accentHex)},0.18);
}
.cover::before, .cover::after {
  content:''; position:absolute;
  width:48px; height:48px;
  border-color: rgba(${hexToRgb(accentHex)},0.3); border-style:solid;
}
.cover::before { top:28px; left:28px; border-width:1px 0 0 1px; }
.cover::after  { bottom:28px; right:28px; border-width:0 1px 1px 0; }

.cover-brand { font-size:10px; letter-spacing:10px; color:rgba(${hexToRgb(accentHex)},0.5); margin-bottom:36px; }
.cover-icon  { font-size:72px; margin-bottom:20px; filter: drop-shadow(0 0 20px rgba(${hexToRgb(accentHex)},0.35)); }
.cover-title { font-size:36px; color:${accentHex}; font-weight:300; letter-spacing:12px; margin-bottom:10px; }
.cover-en    { font-size:11px; letter-spacing:7px; color:rgba(${hexToRgb(accentHex)},0.5); margin-bottom:40px; font-style:italic; }
.gold-line   { width:120px; height:1px; background:linear-gradient(90deg,transparent,${accentHex},transparent); margin:0 auto 36px; }

.info-card {
  background: rgba(${hexToRgb(accentHex)},0.06);
  border: 1px solid rgba(${hexToRgb(accentHex)},0.25);
  border-radius: 10px;
  padding: 22px 36px;
  margin-bottom: 28px;
  text-align: left;
  min-width: 340px;
}
.info-row { display:flex; gap:12px; margin-bottom:8px; font-size:14px; }
.info-label { color:rgba(${hexToRgb(accentHex)},0.7); min-width:80px; letter-spacing:1px; }
.info-val   { color:#f0e8d8; flex:1; }

.cover-price {
  font-size:32px; color:${accentHex}; font-weight:300; letter-spacing:2px;
  margin: 8px 0 4px;
  text-shadow: 0 0 24px rgba(${hexToRgb(accentHex)},0.25);
}
.cover-badge { font-size:13px; color:rgba(240,232,216,0.75); letter-spacing:3px; margin-bottom:24px; }

.algo-pills { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:20px; }
.algo-pill {
  font-size:11px; color:rgba(${hexToRgb(accentHex)},0.85);
  border:1px solid rgba(${hexToRgb(accentHex)},0.28);
  border-radius:14px; padding:4px 14px; letter-spacing:0.1em;
}
.cover-disclaimer { font-size:11px; color:rgba(240,232,216,0.35); letter-spacing:1px; margin-top:16px; }

/* ══ 正文 ══ */
.content { padding: 52px 52px 0; }

h2.chapter {
  font-size: 20px; color: ${accentHex}; font-weight:500;
  letter-spacing:3px; margin:44px 0 18px;
  padding: 15px 20px;
  border-left: 4px solid ${accentHex};
  background: linear-gradient(90deg, rgba(${hexToRgb(accentHex)},0.1) 0%, rgba(${hexToRgb(accentHex)},0.02) 100%);
}
h3 {
  font-size:16px; color:rgba(${hexToRgb(accentHex)},0.9); font-weight:500;
  margin:24px 0 10px; letter-spacing:1px;
  padding-left:12px;
  border-left:2px solid rgba(${hexToRgb(accentHex)},0.35);
}
p  { margin-bottom:16px; text-indent:2em; color:#f0e8d8; }
ul { padding-left:22px; margin-bottom:16px; }
li { margin-bottom:9px; color:#f0e8d8; }
li::marker { color:rgba(${hexToRgb(accentHex)},0.5); }
strong { color:${accentHex}; font-weight:600; }
em     { color:rgba(220,140,110,0.95); font-style:normal; }

blockquote {
  border-left:3px solid rgba(${hexToRgb(accentHex)},0.45);
  padding:14px 20px; margin:20px 0;
  background:rgba(${hexToRgb(accentHex)},0.05);
  color:rgba(240,232,216,0.92); font-style:italic; line-height:1.95; font-size:16px;
}
table { width:100%; border-collapse:collapse; margin:18px 0; }
th { background:rgba(${hexToRgb(accentHex)},0.14); color:${accentHex}; padding:11px 14px; text-align:left; font-weight:400; font-size:14px; border-bottom:1.5px solid rgba(${hexToRgb(accentHex)},0.3); }
td { padding:10px 14px; border-bottom:1px solid rgba(${hexToRgb(accentHex)},0.1); font-size:15px; color:#f0e8d8; }
hr { border:none; border-top:1px solid rgba(${hexToRgb(accentHex)},0.12); margin:32px 0; }

.score-box {
  background: rgba(${hexToRgb(accentHex)},0.06);
  border: 1px solid rgba(${hexToRgb(accentHex)},0.2);
  border-radius:8px; padding:20px 24px; margin:20px 0;
}
.score-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
.score-label { font-size:14px; color:rgba(240,232,216,0.7); min-width:110px; }
.score-track { flex:1; height:8px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; }
.score-fill  { height:100%; border-radius:4px; background:linear-gradient(90deg,${accentHex},rgba(${hexToRgb(accentHex)},0.6)); }
.score-val   { font-size:14px; color:${accentHex}; min-width:40px; text-align:right; }

.warn-box {
  background: rgba(180,60,50,0.06);
  border: 1px solid rgba(180,60,50,0.2);
  border-radius:8px; padding:18px 22px; margin:20px 0;
}
.warn-title { color:rgba(220,100,80,0.9); font-size:14px; letter-spacing:1px; margin-bottom:10px; }

.footer {
  text-align:center; color:rgba(240,232,216,0.22); font-size:12px;
  margin-top:48px; padding:24px 52px;
  border-top:1px solid rgba(${hexToRgb(accentHex)},0.1);
}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-brand">S H E N Y U A N  ·  善 缘</div>
  <div class="cover-icon">${icon}</div>
  <div class="cover-title">${title}</div>
  <div class="cover-en">${subtitle}</div>
  <div class="gold-line"></div>
  ${coverMeta}
  <div class="cover-price">${price}</div>
  <div class="cover-badge">${coverBadge}</div>
  <div class="algo-pills">
    <span class="algo-pill">玄空飞星</span>
    <span class="algo-pill">八宅明镜</span>
    <span class="algo-pill">五行生克</span>
    <span class="algo-pill">AI深度分析</span>
  </div>
  <div class="cover-disclaimer">* 本报告由AI命理系统生成，仅供参考</div>
</div>
<div class="content">
${mdToHtml(content)}
</div>
<div class="footer">善缘 ShenYuan · AI 风水命理系统 · shenyuan.app · 仅供参考，命运终由自己主宰</div>
</body>
</html>`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

async function main() {

  // ══════════════════════════════════
  // 报告1：阳宅风水 Feng Shui Report
  // ══════════════════════════════════
  const fsSys = `你是一位精通玄空飞星与八宅明镜的实战风水师，从业三十年，服务过上千个家庭。
你说话落地、实用、直接，不玩神秘，每条建议都有具体操作方法。
语言：简体中文。格式：Markdown。总字数：8000字以上，每章600字以上。
当前年份：2026年（丙午年），飞星入中宫：二黑。

【重要】所有建议必须具体到：哪个方位、放什么物件（颜色/材质/尺寸）、忌放什么、为什么这样做。
不要模糊说"南方放吉祥物"，要说"南方的客厅角落放一对高约25cm的铜制麒麟，头朝门口方向"。

请完整展开以下章节：

## 一、命主命卦与宅卦诊断
（分析命主命卦、住宅坐向、宅卦与人卦是否相配）

## 二、玄空飞星盘全解（2026年运盘）
（列出9个宫位的飞星组合，重点说明吉凶宫位）

## 三、财位精准布局
（主财位+副财位，各自放什么、忌什么，具体到颜色材质）

## 四、事业运势与贵人位
（贵人位在哪个方位，如何布局，座位/工作台如何摆放）

## 五、感情桃花位布局
（桃花位方向，未婚/已婚各自的布局重点）

## 六、健康方位与化煞
（2026年病符星、五黄煞的位置，如何化解）

## 七、家庭成员各自的吉凶方位
（根据不同命卦，家中成员应该住哪个房间、朝哪个方向睡）

## 八、厨房、卫生间、大门的风水禁忌
（实用禁忌清单，逐条列出）

## 九、2026年重点开运时间节点
（哪几个月份运势最旺，适合搬家/装修/签约）

## 十、推荐开运物品与布局清单
（完整清单：物品名称、放置方位、预算参考、购买渠道建议，可推荐Amazon/Etsy链接占位）

## 十一、风水师的叮嘱
（给这个家庭的真心话，400字以上）`;

  const fsUser = `我家的风水情况：
- 住宅：三室两厅，坐北朝南（南向大门），9楼
- 地址：美国加州洛杉矶（海外华人社区）
- 家庭成员：男主人1971年4月15日出生（辛亥日），女主人1975年8月22日出生，孩子2008年出生
- 主要困扰：近两年财运不顺，男主人升职受阻，夫妻感情有些冷淡
- 2025年刚装修完，想做完整风水布局
请给出完整的2026年家宅风水分析报告，8000字以上。`;

  const fsText = await deepseek(fsSys, fsUser, '风水报告', 14000);

  // 生成命卦信息
  const masterBazi = calcBazi(1971, 4, 15, 9, 'male');

  const fsMeta = `
  <div class="info-card">
    <div class="info-row"><span class="info-label">住宅坐向</span><span class="info-val">坐北朝南 · 南向大门 · 9楼</span></div>
    <div class="info-row"><span class="info-label">地址</span><span class="info-val">美国加州洛杉矶（海外华人）</span></div>
    <div class="info-row"><span class="info-label">男主人</span><span class="info-val">1971年4月15日 · 命卦 ${masterBazi.dayMaster}${masterBazi.dayMasterElement}</span></div>
    <div class="info-row"><span class="info-label">女主人</span><span class="info-val">1975年8月22日</span></div>
    <div class="info-row"><span class="info-label">主要困扰</span><span class="info-val">财运不顺 · 升职受阻 · 感情冷淡</span></div>
    <div class="info-row"><span class="info-label">分析基准</span><span class="info-val">2026年丙午年 · 玄空飞星二黑入中</span></div>
  </div>`;

  const fsHtml = buildHtml({
    title: '家宅风水评测报告',
    subtitle: 'FENG SHUI HOME READING',
    icon: '🏠',
    color: '#c9a84c',
    coverMeta: fsMeta,
    coverBadge: '完整报告 · 十一章节 · 玄空飞星双体系',
    price: '$19.90',
    content: fsText
  });

  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/api-风水报告-样本.html', fsHtml);
  console.log('✅ 风水报告已保存');

  // ══════════════════════════════════
  // 报告2：阴宅风水 Burial Site Report
  // ══════════════════════════════════
  const yzSys = `你是一位专精阴宅堪舆的资深风水师，精通龙穴砂水向五大要素，从业四十年，为数百个家族选定吉穴。
你说话庄重、温情、专业，深知这是家族大事，字字负责。
语言：简体中文。格式：Markdown。总字数：8000字以上，每章600字以上。
当前年份：2026年。

【重要】报告必须结合具体候选墓地信息给出评分和推荐，不能模糊。
评分使用百分制，每个候选地从龙、穴、砂、水、向五个维度各打分，给出综合推荐。

请完整展开以下章节：

## 一、亡者命盘与家族运势基础分析
（分析亡者生辰八字，判断适合的五行方位）

## 二、阴宅风水五大要素总说
（龙脉、穴位、砂手、水法、朝向——结合本案详细解释）

## 三、候选墓地A 综合评分
（从龙穴砂水向五维度逐一评分，总分，优缺点分析，具体建议）

## 四、候选墓地B 综合评分
（同上）

## 五、两地对比与最终推荐
（哪块地更适合，理由，注意事项）

## 六、安葬朝向与穴位定点建议
（朝向几度，碑文朝向，金井深度建议，石料选择）

## 七、安葬吉日选择
（2026年哪几个月份适合安葬，具体推荐3-5个吉日，附黄历依据）

## 八、子孙受荫分析
（安葬后对不同子女的影响，哪个孩子受荫最大）

## 九、后期维护与祭扫建议
（每年几月祭扫最宜，祭品禁忌，墓地日常维护注意）

## 十、风水师的慎重叮嘱
（对家属的真心话，关于此事的庄重建议，400字以上）`;

  const yzUser = `家族情况：
- 亡者：父亲，1942年农历三月初五出生，2024年10月仙逝，享年82岁
- 委托人：长子，1968年生，现居美国纽约
- 候选墓地A：新泽西州华人公墓，坐东朝西，背靠小山丘，前有小型水景，地势平缓
- 候选墓地B：纽约州郊外公墓，坐西北朝东南，视野开阔，无明显山水格局
- 家族主要诉求：希望后代（3子1女）事业顺利，家族兴旺
- 时间：计划2026年清明前后安葬
请给出完整的阴宅风水分析报告，帮助家族做出最佳决策，8000字以上。`;

  const yzText = await deepseek(yzSys, yzUser, '阴宅报告', 14000);

  const yzMeta = `
  <div class="info-card">
    <div class="info-row"><span class="info-label">亡者信息</span><span class="info-val">1942年农历三月初五生 · 2024年10月仙逝 · 享年82岁</span></div>
    <div class="info-row"><span class="info-label">委托人</span><span class="info-val">长子 · 1968年生 · 现居美国纽约</span></div>
    <div class="info-row"><span class="info-label">候选A</span><span class="info-val">新泽西华人公墓 · 坐东朝西 · 背山有水</span></div>
    <div class="info-row"><span class="info-label">候选B</span><span class="info-val">纽约州郊外公墓 · 坐西北朝东南 · 视野开阔</span></div>
    <div class="info-row"><span class="info-label">家族诉求</span><span class="info-val">3子1女事业顺遂 · 家族长远兴旺</span></div>
    <div class="info-row"><span class="info-label">计划安葬</span><span class="info-val">2026年清明前后</span></div>
  </div>`;

  const yzHtml = buildHtml({
    title: '阴宅风水分析报告',
    subtitle: 'ANCESTRAL BURIAL SITE READING',
    icon: '🪦',
    color: '#9b8a6e',
    coverMeta: yzMeta,
    coverBadge: '完整报告 · 十章节 · 龙穴砂水向五维评分',
    price: '$69.90',
    content: yzText
  });

  fs.writeFileSync('/Users/karen/projects/shenyuan/docs/api-阴宅报告-样本.html', yzHtml);
  console.log('✅ 阴宅报告已保存');

  console.log('\n🎉 两份报告生成完毕！');
}

main().catch(console.error);
