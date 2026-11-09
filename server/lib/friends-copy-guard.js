'use strict';
// 相生对外文案的禁用词表（合规要求，2026-11-10）。页面文案与 AI 生成内容都不得出现这些词，也不得出现百分比式预测。
// 这是唯一允许写出这些词的文件：测试用它扫描新页面；AI 报告落库与展示前都用 sanitize() 再过一遍。
const FORBIDDEN=['算命','破解','化解','开光','转运','改运','择日','保证','必定','必然'];
const PERCENT=/\d+(?:\.\d+)?\s*[%％]|百分之[零〇一二三四五六七八九十百几\d]+/g;
const REPLACE={算命:'传统命理',破解:'理解',化解:'调和',开光:'',转运:'调整状态',改运:'调整心态',择日:'挑选时间',保证:'确认',必定:'可能',必然:'可能'};
function findForbidden(text){const t=String(text||'');const hits=FORBIDDEN.filter(w=>t.includes(w));PERCENT.lastIndex=0;if(PERCENT.test(t))hits.push('百分比');PERCENT.lastIndex=0;return hits;}
function sanitize(text){let t=String(text||'');for(const w of FORBIDDEN)t=t.split(w).join(REPLACE[w]);return t.replace(PERCENT,'一部分');}
module.exports={FORBIDDEN,findForbidden,sanitize};
