/**
 * 直接调本地API生成报告（绕过缓存和付款门）
 * 用法: node docs/generate-api-reports.js
 */

'use strict';
const http = require('https');
const fs = require('fs');
const path = require('path');

// 直接用排盘引擎（不走HTTP）
const { calcBazi } = require('../server/bazi');

// 直接调DeepSeek（不走server，避免缓存和auth问题）
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!DEEPSEEK_KEY) { console.error('需要 DEEPSEEK_API_KEY 环境变量'); process.exit(1); }

async function deepseekFull(systemPrompt, userPrompt, label) {
  console.log(`\n[${label}] 开始生成 (约需30-60秒)...`);
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 8000,
    temperature: 0.7,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '';
          console.log(`[${label}] 完成，字数：${text.length}`);
          resolve(text);
        } catch(e) { reject(new Error('解析失败: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('超时')); });
    req.write(body);
    req.end();
  });
}

// 生成HTML报告
function wrapHtml(title, content, subtitle) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善缘 · ${title}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0f0c07; color:rgba(245,235,215,0.95); font-family:'STSong','Georgia',serif; max-width:780px; margin:0 auto; padding:40px 32px; font-size:16px; line-height:1.95; }
h1 { font-size:28px; color:#c9a84c; font-weight:400; letter-spacing:6px; text-align:center; padding:32px 0 8px; }
.sub { text-align:center; color:rgba(201,168,76,0.5); font-size:13px; letter-spacing:4px; margin-bottom:32px; }
.divider { width:80px; height:1px; background:linear-gradient(90deg,transparent,#c9a84c,transparent); margin:24px auto; }
h2 { font-size:18px; color:#c9a84c; font-weight:500; margin:32px 0 12px; letter-spacing:2px; border-left:3px solid rgba(201,168,76,0.4); padding-left:12px; }
h3 { font-size:16px; color:rgba(201,168,76,0.85); font-weight:500; margin:20px 0 8px; }
p { margin-bottom:14px; text-indent:2em; }
ul,ol { padding-left:24px; margin-bottom:14px; }
li { margin-bottom:6px; }
strong { color:#c9a84c; font-weight:600; }
blockquote { border-left:2px solid rgba(212,115,107,0.4); padding:12px 18px; margin:16px 0; background:rgba(212,115,107,0.04); color:rgba(245,235,215,0.82); font-style:italic; }
table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
th { background:rgba(201,168,76,0.1); color:#c9a84c; padding:10px 12px; text-align:left; font-weight:400; border-bottom:1px solid rgba(201,168,76,0.2); }
td { padding:9px 12px; border-bottom:1px solid rgba(201,168,76,0.07); color:rgba(245,235,215,0.88); }
hr { border:none; border-top:1px solid rgba(201,168,76,0.15); margin:28px 0; }
code { background:rgba(201,168,76,0.1); padding:2px 6px; border-radius:3px; font-size:14px; }
.footer { text-align:center; color:rgba(245,235,215,0.25); font-size:12px; margin-top:48px; padding-top:24px; border-top:1px solid rgba(201,168,76,0.1); }
.badge { display:inline-block; background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.3); border-radius:12px; padding:3px 10px; font-size:12px; color:rgba(201,168,76,0.8); margin:2px; letter-spacing:0.1em; }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="sub">${subtitle || 'S H E N Y U A N  ·  A I  R E A D I N G'}</div>
<div class="divider"></div>
<div id="content">
${mdToHtml(content)}
</div>
<div class="footer">本报告由善缘AI命理系统生成 · 仅供参考 · 命运终由自己书写</div>
</body>
</html>`;
}

// 简单Markdown→HTML转换
function mdToHtml(md) {
  return md
    .replace(/^#{1} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{4} (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^([^<\n].+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, '');
}

async function main() {
  const outDir = path.join(__dirname);

  // ── 报告1: 人生报告（女，1991.10.5 卯时）──
  const bazi1 = calcBazi(1991, 10, 5, 5, 'female');
  const chart1 = `【精确排盘（算法计算，请严格使用）】
四柱：${bazi1.fourPillars}　日主：${bazi1.dayMaster}（${bazi1.dayMasterElement}）　身${bazi1.isStrong?'强':'弱'}
五行：金${bazi1.wuxing['金'].toFixed(1)} 木${bazi1.wuxing['木'].toFixed(1)} 水${bazi1.wuxing['水'].toFixed(1)} 火${bazi1.wuxing['火'].toFixed(1)} 土${bazi1.wuxing['土'].toFixed(1)}
大运：${bazi1.daYun.slice(0,8).map(d=>d.name+'('+d.startAge+'-'+d.endAge+'岁)').join(' ')}
当前年份：2026年`;

  const sys1 = `你是一位精通八字命理的实力派命理师。${chart1}

请严格按以上数据展开，不得自行推算修改任何数字。总字数5000字以上，Markdown格式，简体中文。
必须包含：
## 📜 四柱命盘总览（引用上方精确数据）
## 🔥 日主深度解析（日主${bazi1.dayMaster}${bazi1.dayMasterElement}的性格命运）
## 🟤 五行能量分析（各元素占比与用忌神）
## 💰 财运格局（求财方向+2026-2030逐年分析）
## 💕 感情姻缘（桃花、夫妻宫、最佳婚年）
## 💼 事业格局（最适合的行业方向）
## 🏥 健康提醒（身体弱点与养生建议）
## 📅 大运分析（当前大运+未来走势，用上方精确大运数据）
## 🎯 开运锦囊（颜色/方位/水晶/数字，当年用2026年）
## 💌 命理师的叮嘱（给这位命主的真心话）`;

  const user1 = `请为我批算八字。出生：1991年10月5日卯时，女性，请全面分析命盘。`;

  const text1 = await deepseekFull(sys1, user1, '报告1:人生报告(女)');
  fs.writeFileSync(path.join(outDir, 'api-人生报告-v1.html'),
    wrapHtml('八字命理报告', text1, `1991年10月5日 · 卯时 · 女 · 戊土日主 · ${bazi1.fourPillars}`));
  console.log('✅ 报告1已保存：api-人生报告-v1.html');

  // ── 报告2: 人生报告（男，1989.3.12 酉时）──
  const bazi2 = calcBazi(1989, 3, 12, 17, 'male');
  const chart2 = `【精确排盘】四柱：${bazi2.fourPillars}　日主：${bazi2.dayMaster}（${bazi2.dayMasterElement}）　身${bazi2.isStrong?'强':'弱'}
五行：金${bazi2.wuxing['金'].toFixed(1)} 木${bazi2.wuxing['木'].toFixed(1)} 水${bazi2.wuxing['水'].toFixed(1)} 火${bazi2.wuxing['火'].toFixed(1)} 土${bazi2.wuxing['土'].toFixed(1)}
大运：${bazi2.daYun.slice(0,8).map(d=>d.name+'('+d.startAge+'-'+d.endAge+'岁)').join(' ')}
当前年份：2026年`;

  const sys2 = `你是一位精通八字命理的实力派命理师。${chart2}\n\n请严格按以上数据展开，总字数5000字以上，Markdown格式，简体中文。包含相同的10个维度分析。`;
  const user2 = `请为我批算八字。出生：1989年3月12日酉时，男性，请全面分析命盘。`;
  const text2 = await deepseekFull(sys2, user2, '报告2:人生报告(男)');
  fs.writeFileSync(path.join(outDir, 'api-人生报告-v2.html'),
    wrapHtml('八字命理报告', text2, `1989年3月12日 · 酉时 · 男 · ${bazi2.dayMaster}${bazi2.dayMasterElement}日主 · ${bazi2.fourPillars}`));
  console.log('✅ 报告2已保存：api-人生报告-v2.html');

  // ── 报告3: 合婚报告（1991.10.5 卯时 女 + 1989.3.12 酉时 男）──
  const hChart = `【精确排盘（算法计算）】
A方（女，1991.10.5 卯时）：四柱 ${bazi1.fourPillars}　日主 ${bazi1.dayMaster}${bazi1.dayMasterElement}　身${bazi1.isStrong?'强':'弱'}
  五行：金${bazi1.wuxing['金'].toFixed(1)} 木${bazi1.wuxing['木'].toFixed(1)} 水${bazi1.wuxing['水'].toFixed(1)} 火${bazi1.wuxing['火'].toFixed(1)} 土${bazi1.wuxing['土'].toFixed(1)}
  大运：${bazi1.daYun.slice(0,5).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
B方（男，1989.3.12 酉时）：四柱 ${bazi2.fourPillars}　日主 ${bazi2.dayMaster}${bazi2.dayMasterElement}　身${bazi2.isStrong?'强':'弱'}
  五行：金${bazi2.wuxing['金'].toFixed(1)} 木${bazi2.wuxing['木'].toFixed(1)} 水${bazi2.wuxing['水'].toFixed(1)} 火${bazi2.wuxing['火'].toFixed(1)} 土${bazi2.wuxing['土'].toFixed(1)}
  大运：${bazi2.daYun.slice(0,5).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
当前年份：2026年`;

  const sys3 = `你是一位德高望重的合婚师，从业四十余年，阅人无数。${hChart}

请严格按以上精确排盘数据分析，不得修改任何四柱数字。总字数6000字以上，Markdown格式，简体中文。包含：
## 一、合婚总分（百分制，并给出各维度评分，评分要能加总到总分）
## 二、五行互补分析（基于以上精确数据）
## 三、性格匹配与气场
## 四、感情沟通模式（优势与挑战）
## 五、财运互助格局
## 六、姻缘流年分析（2026-2030逐年）
## 七、最佳结婚年份与吉日方向
## 八、婚后注意事项
## 九、命理师叮嘱（分别致A方和B方）`;

  const user3 = `A方（女）：1991年10月5日卯时\nB方（男）：1989年3月12日酉时\n请详细合婚分析。`;
  const text3 = await deepseekFull(sys3, user3, '报告3:合婚报告v1');
  fs.writeFileSync(path.join(outDir, 'api-合婚报告-v1.html'),
    wrapHtml('合婚配对报告', text3, `A方 ${bazi1.dayMaster}${bazi1.dayMasterElement} · B方 ${bazi2.dayMaster}${bazi2.dayMasterElement} · 合婚综合评分`));
  console.log('✅ 报告3已保存：api-合婚报告-v1.html');

  // ── 报告4: 合婚报告 恋爱版（温柔叙事风格）──
  const sys4 = `你是一位洞悉人心的感情命理师，风格是命运诗篇——温柔又直率。${hChart}

请用叙事散文风格写一份感情配对报告，6000字，Markdown格式，简体中文。包含：
## 💕 缘分分数与你们的相遇注定
## 🌊 两人的情感底色（各自的情感模式）
## 💬 你们是怎么吵架的（以及怎么和好的）
## 🌟 这段感情最珍贵的地方
## ⚡ 感情里的最大考验
## 📅 2026-2030 感情流年走势
## 💍 最佳结婚年份
## 💌 致这对恋人的一封信`;

  const user4 = `A方（女）：1991年10月5日卯时\nB方（男）：1989年3月12日酉时\n请用感情诗篇的风格分析这段感情。`;
  const text4 = await deepseekFull(sys4, user4, '报告4:合婚报告v2(恋爱版)');
  fs.writeFileSync(path.join(outDir, 'api-合婚报告-v2.html'),
    wrapHtml('感情配对报告', text4, `A方 ${bazi1.dayMaster}${bazi1.dayMasterElement} · B方 ${bazi2.dayMaster}${bazi2.dayMasterElement} · 感情诗篇版`));
  console.log('✅ 报告4已保存：api-合婚报告-v2.html');

  console.log('\n🎉 全部4份报告生成完毕！');
  console.log('路径：/Users/karen/projects/shenyuan/docs/');
}

main().catch(console.error);
