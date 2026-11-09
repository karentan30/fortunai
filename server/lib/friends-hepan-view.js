'use strict';
// 合盘 v4 报告组装：视角转换（A/B → 你/TA）、免费/完整截断、可见性和泄露扫描都在服务端完成。
const E=require('./friends-hepan-v4');
const C=require('./friends-hepan-copy');
const SUBS=[['stem','天干'],['branch','地支 · 配偶宫'],['wuxing','五行互补'],['star','夫妻星']];
const FOOTER=['按传统合婚规则计分，仅供参考','传统文化参考，不预测关系结果'];
const ZAO={male:'乾造',female:'坤造'};
const PILLAR_NAME={year:'年',month:'月',day:'日',hour:'时'};
function tagOf(h,charts,mode){
 if(!h.pillar)return h.id==='star'?'夫妻星':'五行';
 const part=h.part==='stem'?'干':'支',head=PILLAR_NAME[h.pillar]+part;
 const typeWord=h.type==='六合'||h.type==='三合'?h.type:h.part==='stem'?'相'+h.type:'相'+h.type;
 const extra=h.pillar==='day'&&h.part==='branch'?'（配偶宫）':'';
 if(mode!=='self')return head+' · '+typeWord+extra;
 const idx=h.part==='stem'?0:1,a=[...charts.A.pillars[h.pillar]][idx],b=[...charts.B.pillars[h.pillar]][idx];
 return head+' · '+a+b+(h.type==='同'?'同':typeWord.replace(/^相/,''))+extra;
}
function sideNames(viewer){return viewer==='A'?{A:'你',B:'TA'}:{A:'TA',B:'你'};}
// 视角：me 永远是看报告的人。dir 'AB' 在 B 视角下要反过来。
function flipDir(dir,viewer){if(!dir)return null;const mine=viewer==='A'?'AB':'BA';return dir===mine?'me_to_ta':'ta_to_me';}
/**
 * mode: 'invite' | 'self'
 * viewer: 'A' | 'B'（自己合盘恒为 A）
 * unlocked: 完整版标志（第 1 批恒为 false，付费在后续批次）
 */
function buildReport({analysis,picked,prose,charts,mode,viewer='A',unlocked=false,taNickname=null,meNickname=null}){
 const other=viewer==='A'?'B':'A',names=sideNames(viewer);
 const allShown=picked.mohe.length<=1,full=unlocked||allShown;
 const lockSub=k=>mode==='invite'&&!full&&(k==='branch'||k==='wuxing');
 const subs=SUBS.map(([key,label])=>({key,label:key==='star'&&analysis.starMode==='companion'?'相处星':label,max:25,locked:lockSub(key),score:lockSub(key)?null:analysis.subs[key].score}));
 const item=(h,kind)=>{const t=prose.items[h.id]||C.template(h,kind);return {id:h.id,kind,tag:tagOf(h,charts,mode),title:t.title,meaning:t.meaning,life:t.life,...(kind==='mohe'?{advice:t.advice||C.template(h,kind).advice||[]}:{})};};
 const he=picked.he.map(h=>item(h,'he')),moheAll=picked.mohe.map(h=>item(h,'mohe'));
 const mohe=full?moheAll:moheAll.slice(0,1);
 const person=(side)=>{const c=charts[side],showAll=mode==='self'||side===viewer;return {label:side===viewer?'你':'TA',gender:c.gender,zao:ZAO[c.gender],dayMaster:analysis.dayMasters[side],hidden:!showAll,pillars:showAll?{...c.pillars}:null};};
 const relations=analysis.relations.map(r=>({pillar:r.pillar,label:PILLAR_NAME[r.pillar]+'柱',stem:{type:r.stem.type,dir:flipDir(r.stem.dir,viewer)},branch:{type:r.branch.type},spousePalace:r.pillar==='day'}));
 const report={
  kind:'hepan_v4',version:'compatibility-guide-v4',engine:analysis.engine,mode,purpose:analysis.purpose,limited:analysis.limited,
  limitedNote:analysis.limited?'至少一方不知道时辰，只按年、月、日三柱计算，是有限参考。':null,
  total:analysis.total,tier:analysis.tier,tierLabel:analysis.tierLabel,tiers:['很合拍','大体合拍','磨合型'],
  lead:prose.lead,summary:C.fill(prose.summary,names),epigraph:C.EPIGRAPHS[analysis.tier],
  aiAssisted:prose.source==='ai',aiLabel:prose.source==='ai'?'AI 辅助生成':null,
  people:{me:{...person(viewer),nickname:meNickname},ta:{...person(other),nickname:taNickname}},
  subs,relations,
  he:C.fill(he,names),mohe:C.fill(mohe,names),moheTotal:moheAll.length,moreCount:full?0:Math.max(0,moheAll.length-1),allShown,unlocked:!!unlocked,full,
  star:full||mode==='self'?C.fill(starView(analysis,viewer),names):null,
  wuxing:full?{bu:analysis.wuxing.bu,que:analysis.wuxing.que,mine:analysis.counts[viewer],...(mode==='self'?{ta:analysis.counts[other]}:{})}:null,
  basis:full?analysis.hits.filter(h=>h.points!==0).map(h=>({id:h.id,tag:tagOf(h,charts,mode),points:h.points,sub:h.sub})):null,
  lock:full?null:{moreCount:Math.max(0,moheAll.length-1),text:'还有'+Math.max(0,moheAll.length-1)+'条磨合点和对应的相处建议',cta:'完整版即将开放',available:false},
  footer:FOOTER
 };
 return report;
}
function starView(analysis,viewer){const t=C.starText(analysis),other=viewer==='A'?'B':'A';return {mode:t.mode,heading:t.heading,mine:t[viewer],theirs:t[other]};}
// 邀请合盘：每个返回给看报告者的字段都扫一遍，对方四柱里除日主以外的干支字一个都不能出现。
// 允许的路径只有：本人四柱、双方昵称（用户自填，不由命盘派生）。
function assertNoLeak(report,otherPillars){
 const hits=C.leakScan(report,C.forbiddenFor(otherPillars,{alsoAllow:[report.people?.me?.dayMaster].filter(Boolean)}),{allow:['people.me.pillars','people.me.dayMaster','people.me.nickname','people.ta.nickname']});
 return hits;
}
module.exports={buildReport,assertNoLeak,tagOf,FOOTER,SUBS};
