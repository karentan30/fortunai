'use strict';
// 相生合盘 v4 规则引擎（compatibility-guide-v4）：纯函数、确定性。
// 只吃四柱干支 + 性别 + 目的，不接触生日、城市、昵称。分数只由这里算，DeepSeek 只写解释。
// 双方记作 A/B（邀请合盘 A=发起人、B=接收者；自己合盘 A=本人、B=TA），视角转换在展示层做。
const crypto=require('node:crypto');
const CONFIG=require('./friends-hepan-config.json');
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],BRANCHES=[...'子丑寅卯辰巳午未申酉戌亥'],ELEMENTS=[...'木火土金水'];
const PILLARS=['year','month','day','hour'],PILLAR_LABEL={year:'年',month:'月',day:'日',hour:'时'};
const BRANCH_ELEMENT={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const STEM_HE=['甲己','乙庚','丙辛','丁壬','戊癸'],SIX_HE=['子丑','寅亥','卯戌','辰酉','巳申','午未'],TRIPLES=['申子辰','亥卯未','寅午戌','巳酉丑'];
const HAI=['子未','丑午','寅巳','卯辰','申亥','酉戌'],SELF_XING=[...'辰午酉亥'];
const stemElement=s=>ELEMENTS[Math.floor(STEMS.indexOf(s)/2)];
const ei=e=>ELEMENTS.indexOf(e);
const generates=(x,y)=>(ei(x)+1)%5===ei(y);// x 生 y
const controls=(x,y)=>(ei(x)+2)%5===ei(y);// x 克 y
const pairIn=(list,a,b)=>list.some(p=>p.includes(a)&&p.includes(b));
const split=p=>typeof p==='string'&&[...p].length===2&&STEMS.includes([...p][0])&&BRANCHES.includes([...p][1])?{stem:[...p][0],branch:[...p][1]}:null;

// 天干：合 > 同 > 生 > 克。dir='AB' 表示 A 生/克 B。
function stemRelation(a,b){
 if(!STEMS.includes(a)||!STEMS.includes(b))return null;
 if(a!==b&&pairIn(STEM_HE,a,b))return {type:'合',dir:null};
 const x=stemElement(a),y=stemElement(b);
 if(x===y)return {type:'同',dir:null};
 if(generates(x,y))return {type:'生',dir:'AB'};
 if(generates(y,x))return {type:'生',dir:'BA'};
 return {type:'克',dir:controls(x,y)?'AB':'BA'};
}
// 地支：一个组合只取一个类别，优先级 六合 > 六冲 > 刑 > 害 > 三合；同支不自刑记「同」（中性）。
function branchRelation(a,b){
 if(!BRANCHES.includes(a)||!BRANCHES.includes(b))return null;
 if(a===b)return {type:SELF_XING.includes(a)?'刑':'同'};
 if(pairIn(SIX_HE,a,b))return {type:'六合'};
 if(Math.abs(BRANCHES.indexOf(a)-BRANCHES.indexOf(b))===6)return {type:'冲'};
 if(a+b==='子卯'||a+b==='卯子'||[...'寅巳申'].includes(a)&&[...'寅巳申'].includes(b)||[...'丑戌未'].includes(a)&&[...'丑戌未'].includes(b))return {type:'刑'};
 if(pairIn(HAI,a,b))return {type:'害'};
 if(TRIPLES.some(t=>t.includes(a)&&t.includes(b)))return {type:'三合'};
 return {type:'无'};
}
function normalizeChart(c){
 const pillars={};
 for(const k of PILLARS){const v=c?.pillars?.[k];if(k==='hour'&&(v===null||v===undefined))pillars.hour=null;else{if(!split(v))throw Object.assign(Error('四柱数据不完整'),{status:400});pillars[k]=v;}}
 if(!['male','female'].includes(c?.gender))throw Object.assign(Error('请选择性别'),{status:400});
 return {pillars,gender:c.gender};
}
function counts(chart,used){const n=Object.fromEntries(ELEMENTS.map(e=>[e,0]));for(const k of used){const p=split(chart.pillars[k]);n[stemElement(p.stem)]++;n[BRANCH_ELEMENT[p.branch]]++;}return n;}
// 命中某五行的位置（不含日干本身），用于夫妻星/相处星强弱与「藏于何处」。
function positions(chart,used,element){const out=[];for(const k of used){const p=split(chart.pillars[k]);if(k!=='day'&&stemElement(p.stem)===element)out.push({pillar:k,part:'stem'});if(BRANCH_ELEMENT[p.branch]===element)out.push({pillar:k,part:'branch'});}return out;}
const starMode=(a,b,purpose)=>purpose==='buddy'||a.gender===b.gender?'companion':'spouse';
function starOf(chart,mode){
 const me=stemElement(split(chart.pillars.day).stem);
 if(mode==='spouse'){const el=chart.gender==='male'?ELEMENTS[(ei(me)+2)%5]:ELEMENTS[(ei(me)+3)%5];return {kind:chart.gender==='male'?'财星':'官杀',label:chart.gender==='male'?'妻星':'夫星',elements:[el]};}
 return {kind:'印比',label:'相处星',elements:[ELEMENTS[(ei(me)+4)%5],me]};// 印星（生我）、比劫（同我）
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// 类型名，不是排名词：只描述相处的样子。
const TIER={great:'相合型',fine:'平和型',grind:'互补·磨合型'};
function tierOf(total,cfg=CONFIG){return total>=cfg.thresholds.great?'great':total>=cfg.thresholds.fine?'fine':'grind';}

function analyze(rawA,rawB,{purpose='romance',config=CONFIG}={}){
 const A=normalizeChart(rawA),B=normalizeChart(rawB),limited=A.pillars.hour===null||B.pillars.hour===null;
 const used=limited?['year','month','day']:PILLARS;
 const hits=[],add=(h)=>hits.push(h);
 const relations=used.map(k=>{
  const a=split(A.pillars[k]),b=split(B.pillars[k]),stem=stemRelation(a.stem,b.stem),branch=branchRelation(a.branch,b.branch);
  // 天干：日干 生+2 同+1 克−1（日干五合按相合 +2）；其余三柱只计五合 +1。
  if(k==='day'){const pts={合:2,生:2,同:1,克:-1}[stem.type];add({id:'day_stem',sub:'stem',pillar:k,part:'stem',type:stem.type,dir:stem.dir,points:pts,rule:{合:'stem_he',生:'stem_sheng',同:'stem_same',克:'stem_ke'}[stem.type]});}
  else if(stem.type==='合')add({id:k+'_stem',sub:'stem',pillar:k,part:'stem',type:'合',dir:null,points:1,rule:'stem_he5'});
  else add({id:k+'_stem',sub:'stem',pillar:k,part:'stem',type:stem.type,dir:stem.dir,points:0,rule:'stem_'+{生:'sheng',同:'same',克:'ke'}[stem.type]+'_other'});
  // 地支：日支（配偶宫）六合+2 三合+1 冲−2 刑−1 害−1；其余地支 六合+1 冲−1。
  const dayPts={六合:2,三合:1,冲:-2,刑:-1,害:-1,同:0,无:0},otherPts={六合:1,冲:-1};
  add({id:k+'_branch',sub:'branch',pillar:k,part:'branch',type:branch.type,points:k==='day'?dayPts[branch.type]:otherPts[branch.type]||0,rule:'br_'+{六合:'he',三合:'sanhe',冲:'chong',刑:'xing',害:'hai',同:'same',无:'none'}[branch.type]+(k==='day'?'':'_other')});
  return {pillar:k,stem:{type:stem.type,dir:stem.dir},branch:{type:branch.type}};
 });
 const ca=counts(A,used),cb=counts(B,used),bu=[],que=[];
 for(const e of ELEMENTS){if(ca[e]===0&&cb[e]>=2||cb[e]===0&&ca[e]>=2)bu.push(e);if(ca[e]===0&&cb[e]===0)que.push(e);}
 if(bu.length)add({id:'wx_bu',sub:'wuxing',pillar:null,part:'wuxing',type:'互补',points:Math.min(2,bu.length),rule:'wx_bu',elements:bu});
 if(que.length)add({id:'wx_que',sub:'wuxing',pillar:null,part:'wuxing',type:'同缺',points:-Math.min(2,que.length),rule:'wx_queshared',elements:que});
 // 夫妻星：男看财星、女看官杀；同性或搭子目的换相处星（印/比劫）。
 const mode=starMode(A,B,purpose),stars={};
 for(const [side,me,other] of [['A',A,B],['B',B,A]]){
  const star=starOf(me,mode),otherDay=stemElement(split(other.pillars.day).stem),pos=star.elements.flatMap(e=>positions(me,used,e));
  let points=0,partnerIs=null;
  if(mode==='spouse'){if(star.elements[0]===otherDay){points+=2;partnerIs='star';}}
  else{if(star.elements[0]===otherDay){points+=1;partnerIs='yin';}else if(star.elements[1]===otherDay){points+=1;partnerIs='bi';}}
  if(!pos.length)points-=1;
  stars[side]={...star,partnerIs,present:pos.length>0,positions:pos,points};
 }
 const starPts=stars.A.points+stars.B.points;
 add({id:'star',sub:'star',pillar:null,part:'star',type:mode,points:starPts,rule:mode==='spouse'?'star_spouse':'star_companion'});
 const subs={};
 for(const key of ['stem','branch','wuxing','star']){const points=hits.filter(h=>h.sub===key).reduce((n,h)=>n+h.points,0);subs[key]={points,score:clamp(Math.round(config.base+config.multiplier*points),0,config.subMax)};}
 const total=subs.stem.score+subs.branch.score+subs.wuxing.score+subs.star.score,tier=tierOf(total,config);
 return {engine:config.engine,limited,used,purpose:purpose==='buddy'?'buddy':'romance',starMode:mode,genders:{A:A.gender,B:B.gender},
  dayMasters:{A:split(A.pillars.day).stem,B:split(B.pillars.day).stem},relations,counts:{A:ca,B:cb},wuxing:{bu,que},stars,hits,subs,total,tier,tierLabel:TIER[tier]};
}
// 合/磨合条目：按传统轻重排序，各取最多 3 条。
function heWeight(h){if(h.id==='wx_bu')return 7;if(h.part==='branch'){if(h.pillar==='day')return {六合:10,三合:8}[h.type]||0;return {六合:5.5,三合:4}[h.type]||0;}if(h.part==='stem'){if(h.pillar==='day')return {合:9,生:9,同:3}[h.type]||0;return {合:5,生:3,同:1}[h.type]||0;}return 0;}
function moheWeight(h){if(h.id==='wx_que')return 6;if(h.part==='branch'){if(h.pillar==='day')return {冲:10,刑:9,害:6}[h.type]||0;return {冲:h.pillar==='month'?7:5,刑:4,害:3}[h.type]||0;}if(h.part==='stem'){if(h.pillar==='day')return h.type==='克'?8:0;return h.type==='克'?2:0;}return 0;}
const ORDER={day:0,month:1,year:2,hour:3,null:4};
function pick(analysis,weight,max=3){return analysis.hits.map(h=>({h,w:weight(h)})).filter(x=>x.w>0).sort((x,y)=>y.w-x.w||ORDER[x.h.pillar]-ORDER[y.h.pillar]).slice(0,max).map(x=>x.h);}
function items(analysis){return {he:pick(analysis,heWeight),mohe:pick(analysis,moheWeight)};}
// 同一对永远同一个键：双方干支 + 性别 + 目的 + 引擎版本。
function cacheKey(a,b,purpose='romance',engine=CONFIG.engine){const A=normalizeChart(a),B=normalizeChart(b);return crypto.createHash('sha256').update(JSON.stringify([engine,purpose==='buddy'?'buddy':'romance',A,B])).digest('hex');}
module.exports={analyze,items,cacheKey,stemRelation,branchRelation,stemElement,tierOf,split,starOf,CONFIG,TIER,STEMS,BRANCHES,ELEMENTS,PILLARS,PILLAR_LABEL,BRANCH_ELEMENT};
