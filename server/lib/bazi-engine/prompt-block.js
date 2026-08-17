// 善缘 · 精确排盘 → LLM prompt 注入块
// 用专业万年历引擎(yiqi-core+enrich，命理专家背书零硬错误)预排盘，
// 生成一段「不得自行推算」的排盘文本，喂给 LLM 只做解读、不做排盘。
const { computeBaziChart } = require('./index');

// 输入与后端一致：{ birthYear, birthMonth, birthDay, birthHour, gender }
// 返回排盘文本块；任何异常返回空串（自动降级为原 LLM 自排行为，不阻断出报告）
function buildBaziBlock({ birthYear, birthMonth, birthDay, birthHour, gender }) {
  try {
    const { bazi: b } = computeBaziChart({
      year: Number(birthYear),
      month: Number(birthMonth),
      day: Number(birthDay),
      hour: Number(birthHour) || 0,
      gender: gender === 'male' ? 'male' : 'female',
      includeZiwei: false,
    });
    const sz = b.siZhu, ss = b.shiShen, e = b.enrichment;
    const pillar = (p) => `${sz[p].gan}${sz[p].zhi}(${ss[p]})`;
    const cg = (p) => (b.cangGan[p] || []).map((x) => `${x.gan}${x.shiShen}`).join('');
    const wx = e['五行统计'].withCangGan;
    const dy = b.dayun.map((d) => `${d.ganZhi.gan}${d.ganZhi.zhi}(${d.startAge}岁·${d.startYear}年)`).join(' ');
    return `【精确排盘结果（专业万年历算法·按真实节气交节时刻定月·子时以23:00起算次日；以下数据请严格使用，禁止自行推算或修改四柱/大运）】
四柱：年${pillar('year')}　月${pillar('month')}　日${pillar('day')}　时${pillar('hour')}
日主：${b.dayMaster}　格局：${e['格局'].primary}（${e['格局'].confidence}信度｜${e['格局'].basis}）　旺衰：${e['旺衰'].verdict}
藏干：年[${cg('year')}] 月[${cg('month')}] 日[${cg('day')}] 时[${cg('hour')}]
五行力量(计藏干)：木${wx['木']} 火${wx['火']} 土${wx['土']} 金${wx['金']} 水${wx['水']}　缺:${e['五行统计'].missing.join('') || '无'}　最旺:${e['五行统计'].strongest.join('')}
调候用神：${e['调候用神'].join('、')}
纳音：年${b.naYin.year} 月${b.naYin.month} 日${b.naYin.day} 时${b.naYin.hour}
大运（依次）：${dy}
当前年份：${new Date().getFullYear()}年`;
  } catch (err) {
    console.warn('[bazi-engine] buildBaziBlock 失败，降级为AI自排:', err && err.message);
    return '';
  }
}

module.exports = { buildBaziBlock };
