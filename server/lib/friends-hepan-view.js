'use strict';
// 合盘 v4 报告组装：视角转换（A/B → 你/TA）、免费/完整截断、可见性和泄露扫描都在服务端完成。
const E=require('./friends-hepan-v4');
const C=require('./friends-hepan-copy');
const SUBS=[['stem','天干'],['branch','地支 · 配偶宫'],['wuxing','五行互补'],['star','夫妻星']];
const FOOTER=['传统文化参考，不预测关系结果。'];
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
 * 免费版（邀请和自己合盘一样）：总分、档位、天干/夫妻星两项分、合之处、第一条磨合点、锁住的条数。
 * 锁住的东西不能从返回里看出来：锁住的分项不给分数，不给 moheTotal，关系图只留
 * 天干（未锁分项）和已展示条目对应的地支关系，夫妻星、五行明细、计分依据都不给。
 */
function buildReport({analysis,picked,prose,charts,mode,viewer='A',unlocked=false,offer=null,taNickname=null,meNickname=null}){
 const other=viewer==='A'?'B':'A',names=sideNames(viewer);
 const allShown=picked.mohe.length<=1,full=unlocked||allShown;
 const lockSub=k=>!full&&(k==='branch'||k==='wuxing');
 const subs=SUBS.map(([key,label])=>({key,label:key==='star'&&analysis.starMode==='companion'?'相处星':label,locked:lockSub(key)}));
 const item=(h,kind)=>{const t=prose.items[h.id]||C.template(h,kind);return {id:h.id,kind,tag:tagOf(h,charts,mode),title:t.title,meaning:t.meaning,life:t.life,...(kind==='mohe'?{advice:t.advice||C.template(h,kind).advice||[]}:{})};};
 const he=picked.he.map(h=>item(h,'he')),moheAll=picked.mohe.map(h=>item(h,'mohe'));
 const mohe=full?moheAll:moheAll.slice(0,1);
 const shownIds=new Set([...picked.he,...picked.mohe.slice(0,full?Infinity:1)].map(h=>h.id)),lockedIds=new Set(full?[]:picked.mohe.slice(1).map(h=>h.id));
 const hitAt=(pillar,part)=>analysis.hits.find(h=>h.pillar===pillar&&h.part===part);
 // 免费版：天干关系属于未锁的天干分项，照给（除非它就是锁住的磨合点）；地支关系属于锁住的地支分项，只给已展示条目里出现过的。
 const stemOpen=p=>{const h=hitAt(p,'stem');return full||!h||!lockedIds.has(h.id);},branchOpen=p=>{const h=hitAt(p,'branch');return full||!!h&&shownIds.has(h.id);};
 const person=(side)=>{const c=charts[side],showAll=mode==='self'||side===viewer;return {label:side===viewer?'你':'TA',gender:c.gender,zao:ZAO[c.gender],dayMaster:analysis.dayMasters[side],hidden:!showAll,pillars:showAll?{...c.pillars}:null};};
 const relations=analysis.relations.map(r=>({pillar:r.pillar,label:PILLAR_NAME[r.pillar]+'柱',stem:stemOpen(r.pillar)?{type:r.stem.type,dir:flipDir(r.stem.dir,viewer)}:{type:null,locked:true},branch:branchOpen(r.pillar)?{type:r.branch.type}:{type:null,locked:true},spousePalace:r.pillar==='day'}));
 const report={
  kind:'hepan_v4',version:'compatibility-guide-v4',engine:analysis.engine,mode,purpose:analysis.purpose,limited:analysis.limited,
  limitedNote:analysis.limited?'至少一方不知道时辰，只按年、月、日三柱计算，是有限参考。':null,
  tier:analysis.tier,tierLabel:analysis.tierLabel,
  lead:prose.lead,summary:C.fill(prose.summary,names),epigraph:C.EPIGRAPHS[analysis.tier],
  aiAssisted:prose.source==='ai',aiLabel:prose.source==='ai'?'AI 辅助生成':null,
  people:{me:{...person(viewer),nickname:meNickname},ta:{...person(other),nickname:taNickname}},
  subs,relations,
  he:C.fill(he,names),mohe:C.fill(mohe,names),...(full?{moheTotal:moheAll.length}:{}),moreCount:full?0:Math.max(0,moheAll.length-1),allShown,unlocked:!!unlocked,full,
  star:full?C.fill(starView(analysis,viewer),names):null,
  wuxing:full?{bu:analysis.wuxing.bu,que:analysis.wuxing.que,mine:analysis.counts[viewer],...(mode==='self'?{ta:analysis.counts[other]}:{})}:null,
  basis:full?analysis.hits.filter(h=>h.points!==0).map(h=>({id:h.id,tag:tagOf(h,charts,mode),negative:h.points<0,sub:h.sub})):null,
  lock:full?null:lockOf(moheAll.length-1,offer),
  pay:payView(offer,full),
  footer:FOOTER
 };
 return report;
}
// 锁区按钮：能付款或有会员份数才可点；否则维持「即将开放」。
function lockOf(more,offer){const n=Math.max(0,more),open=!!offer&&offer.sellable&&!offer.unlocked&&(offer.payEnabled||offer.creditEnabled);return {moreCount:n,text:'还有'+n+'条磨合点和对应的相处建议',cta:open?'解锁完整报告':'完整版即将开放',available:open};}
// 给前端付款弹层的公开信息：价格、渠道、会员余量、退款规则；不含任何锁住的内容。
function payView(offer,full){if(!offer)return null;const {advisorQrUrl,...rest}=offer;return {...rest,advisorQrUrl:full?advisorQrUrl||null:null};}
function starView(analysis,viewer){const t=C.starText(analysis),other=viewer==='A'?'B':'A';return {mode:t.mode,heading:t.heading,mine:t[viewer],theirs:t[other]};}
// 邀请合盘：每个返回给看报告者的字段都扫一遍，对方四柱里除日主以外的干支字一个都不能出现。
// 允许的路径只有：本人四柱、双方昵称（用户自填，不由命盘派生），以及只随档位变化的固定文字（古语题记、页脚、档位名表）。
// 题记「君子和而不同」《论语·子路》里的「子」不是命盘字，不能因此误判泄露、把整份报告挡掉。
const FIXED_PATHS=['epigraph.text','epigraph.cite','footer','pay'];// pay：价格、退款规则等固定文字，不由命盘派生
function assertNoLeak(report,otherPillars){
 const hits=C.leakScan(report,C.forbiddenFor(otherPillars,{alsoAllow:[report.people?.me?.dayMaster].filter(Boolean)}),{allow:['people.me.pillars','people.me.dayMaster','people.me.nickname','people.ta.nickname',...FIXED_PATHS]});
 return hits;
}
module.exports={buildReport,assertNoLeak,tagOf,lockOf,payView,FOOTER,SUBS};
