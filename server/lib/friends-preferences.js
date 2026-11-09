'use strict';
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],ANIMALS=[...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const PAIRS=[[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]],GROUPS=[[8,0,4],[11,3,7],[2,6,10],[5,9,1]];
const fail=m=>{const e=Error(m);e.status=400;throw e;};

const CONSTELLATIONS=['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
const {MBTIS,MBTI_BEST}=require('../../assets/js/friends-mbti-data.js');
const ENN=require('../../assets/js/friends-enneagram-data.js'),ENNEAGRAMS=ENN.ENNEAGRAMS;
const ELEMENT_GROUPS=[['白羊座','狮子座','射手座'],['金牛座','处女座','摩羯座'],['双子座','天秤座','水瓶座'],['巨蟹座','天蝎座','双鱼座']];
// 星座：同元素=同频，火↔风、土↔水=互补。MBTI：常见「性格相配表」(类 Boo) 的最佳搭档 + 中间两字母相同=同频。只是认识方向，其余类型也都可以认识。
const CONST_ELEM_NAMES=['火象','土象','风象','水象'],CONST_COMPLEMENT=[2,3,0,1];
function typeGroups(constellation,mbti,enneagram){
  const gi=ELEMENT_GROUPS.findIndex(g=>g.includes(constellation)),constellationGroups=gi<0?[]:[
    {key:'same',label:'同频·同为'+CONST_ELEM_NAMES[gi]+'星座',items:ELEMENT_GROUPS[gi].filter(x=>x!==constellation)},
    {key:'complement',label:'互补·'+CONST_ELEM_NAMES[CONST_COMPLEMENT[gi]]+'星座',items:ELEMENT_GROUPS[CONST_COMPLEMENT[gi]]}];
  const best=MBTI_BEST[mbti]||[],mbtiGroups=!MBTIS.includes(mbti)?[]:[
    {key:'best',label:'性格相配·常见最佳搭档',items:best},
    {key:'same',label:'同频·想法相近',items:MBTIS.filter(x=>x!==mbti&&!best.includes(x)&&x.slice(1,3)===mbti.slice(1,3))}];
  // 九型人格：同组=同频，九型图相连且不同组=互补（friends-enneagram-data.js）。
  const enneagramGroups=ENNEAGRAMS.includes(enneagram)?ENN.groupsFor(enneagram).filter(g=>g.key!=='explore').map(g=>({key:g.key,label:g.label+(g.key==='same'?'·同属'+ENN.centerOf(enneagram).name:'·九型图相连'),items:g.items.map(x=>x.type)})):[];
  return {constellationGroups,mbtiGroups,enneagramGroups};
}
function typeSuggestions({constellation='',mbti='',enneagram=''}={}){
  const g=typeGroups(constellation,mbti,enneagram);
  return {...g,constellations:g.constellationGroups.flatMap(x=>x.items),
    mbtis:g.mbtiGroups.flatMap(x=>x.items),
    enneagrams:g.enneagramGroups.flatMap(x=>x.items),
    basis:{constellations:'按传统星座元素：同元素同频，火象配风象、土象配水象互补；可自行修改，不是科学匹配结论。',mbtis:'按网络流行的MBTI相配表和中间两个字母相同提供方向；每种性格都可以认识，不代表关系结果，可自行修改。',enneagrams:'九型人格按同组同频、九型图相连互补给出方向；任何两个号码都可以好好相处，不代表关系结果，可自行修改。'},kind:'conversation_reference'};
}
function normalizeTypes(body,previous={}){
  const out={};
  for(const [key,valid] of [['constellation',CONSTELLATIONS],['mbti',MBTIS]]){
    const raw=Object.hasOwn(body,key)?body[key]:(previous[key]||'');
    if(typeof raw!=='string')fail('请从选项中选择星座或MBTI，也可暂不填写');
    const value=key==='mbti'?raw.trim().toUpperCase():raw.trim();
    if(value&&!valid.includes(value))fail('星座或MBTI选项无效');
    out[key]=value;
  }
  for(const [key,valid] of [['targetConstellations',CONSTELLATIONS],['targetMbtis',MBTIS]]){
    const raw=Object.hasOwn(body,key)?body[key]:(previous[key]||[]);
    if(!Array.isArray(raw)||raw.length>valid.length+1||raw.some(x=>!valid.includes(x)&&x!=='不限'))fail('请选择有效的星座或MBTI认识方向');
    out[key]=raw.includes('不限')?['不限']:[...new Set(raw)];
  }
  // 九型人格：只收字符串 '1'..'9'（或空 = 暂不填写）；认识方向同 targetMbtis。
  {const raw=Object.hasOwn(body,'enneagram')?body.enneagram:(previous.enneagram||'');
    if(typeof raw!=='string'||(raw!==''&&!ENNEAGRAMS.includes(raw.trim())))fail('九型人格请选择 1–9 号，也可暂不填写');
    out.enneagram=raw.trim();
    const list=Object.hasOwn(body,'targetEnneagrams')?body.targetEnneagrams:(previous.targetEnneagrams||[]);
    if(!Array.isArray(list)||list.length>ENNEAGRAMS.length+1||list.some(x=>!ENNEAGRAMS.includes(x)&&x!=='不限'))fail('请选择有效的九型人格认识方向');
    out.targetEnneagrams=list.includes('不限')?['不限']:[...new Set(list)];}
  return out;
}

// 按传统五行给日主分组：五合=天生一对，相生/同类=推荐，相克=磨合型（只告知，不默认推荐）
function stemGroups(index){if(index<0)return [];const e=Math.floor(index/2),pick=k=>STEMS.slice(k*2,k*2+2);
  return [{key:'he',label:'天生一对·天干五合',stems:[STEMS[(index+5)%10]]},{key:'shengWo',label:'相生·对方生我',stems:pick((e+4)%5)},{key:'same',label:'同频·同五行',stems:pick(e)},{key:'woSheng',label:'相生·我生对方',stems:pick((e+1)%5)},
    {key:'ke',label:'相克·磨合型（互补成长，默认不预选）',stems:[...pick((e+2)%5),...pick((e+3)%5)].filter(x=>x!==STEMS[(index+5)%10])}];}
function recommend(chart={}){const index=STEMS.indexOf(chart.dayMaster),animal=ANIMALS.indexOf(chart.zodiac),mother=index<0?-1:(Math.floor(index/2)+4)%5;const pair=PAIRS.find(p=>p.includes(animal)),group=GROUPS.find(p=>p.includes(animal));return {stemGroups:stemGroups(index),stems:mother<0?[]:[STEMS[(index+5)%10],...STEMS.slice(mother*2,mother*2+2),...STEMS.slice(Math.floor(index/2)*2,Math.floor(index/2)*2+2),...STEMS.slice(((Math.floor(index/2)+1)%5)*2,((Math.floor(index/2)+1)%5)*2+2)],zodiacs:animal<0?[]:[...new Set([...pair,...group].filter(i=>i!==animal))].map(i=>ANIMALS[i]),basis:{stems:'按日主的天干五合、相生（生我/我生）与同五行关系提供认识方向；不是完整八字喜用神，也不代表最佳对象。',zodiacs:'按传统地支六合及三合取同组生肖作为文化认识话题；不表示两人已成三合局，不保证关系结果。'},kind:'cultural_reference'};}
function normalizeAvailability(value){
  if(value===null||value===undefined)return null;
  if(typeof value!=='object'||Array.isArray(value)||typeof value.paused!=='boolean'||typeof value.timeZone!=='string')fail('请填写空闲时段、暂停状态及IANA时区');
  if(!/^(?:[A-Za-z_+-]+\/[A-Za-z_+\/-]+|UTC|GMT)$/.test(value.timeZone))fail('请使用IANA地区时区，不使用固定偏移');
  try{new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format(0);}catch(_){fail('空闲时段时区无效');}
  if(!Array.isArray(value.slots)||value.slots.length>14)fail('每周最多14段空闲时间');
  const minute=time=>{if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('时段须使用24小时HH:mm');return Number(time.slice(0,2))*60+Number(time.slice(3));};
  const slots=value.slots.map(s=>{if(!s||!Number.isInteger(s.weekday)||s.weekday<1||s.weekday>7)fail('星期须为1至7');const start=minute(s.start),end=minute(s.end);if(start>=end)fail('结束时间须晚于开始时间；跨日请拆分');return {weekday:s.weekday,start,end};}).sort((a,b)=>a.weekday-b.weekday||a.start-b.start);
  const merged=[];for(const s of slots){const last=merged[merged.length-1];if(last&&last.weekday===s.weekday&&s.start<=last.end)last.end=Math.max(last.end,s.end);else merged.push({...s});}
  const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  return {paused:value.paused,timeZone:value.timeZone,slots:merged.map(s=>({weekday:s.weekday,start:clock(s.start),end:clock(s.end)}))};
}
function findCommonSlots(a,b,{now=new Date(),days=14,durationMinutes=15}={}){
  a=normalizeAvailability(a);b=normalizeAvailability(b);
  if(!Number.isInteger(days)||days<1||days>14||![15,60].includes(durationMinutes))fail('预约窗口最多14天，时长仅15或60分钟');
  const epoch=new Date(now).getTime();if(!Number.isFinite(epoch))fail('预约起始时间无效');
  if(!a||!b||a.paused||b.paused||!a.slots.length||!b.slots.length)return [];
  const start=Math.ceil(epoch/60000)*60000,end=start+days*86400000;
  function availabilitySet(input){
    const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:input.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const slots=input.slots.map(s=>({weekday:s.weekday,start:Number(s.start.slice(0,2))*60+Number(s.start.slice(3)),end:Number(s.end.slice(0,2))*60+Number(s.end.slice(3))}));
    const rows=[],transitionDates=new Set();let previous;
    for(let t=start-86400000;t<end+86400000;t+=60000){const p={};for(const x of fmt.formatToParts(t))if(x.type!=='literal')p[x.type]=Number(x.value);
      const wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute),key=`${p.year}-${p.month}-${p.day}`,offset=(wall-t)/60000;
      if(previous&&previous.offset!==offset){transitionDates.add(previous.key);transitionDates.add(key);}previous={key,offset};
      if(t>=start&&t<end){const weekday=new Date(wall).getUTCDay()||7,minute=p.hour*60+p.minute;if(slots.some(s=>s.weekday===weekday&&s.start<=minute&&minute<s.end))rows.push({t,key});}
    }
    return new Set(rows.filter(r=>!transitionDates.has(r.key)).map(r=>r.t));
  }
  const aa=availabilitySet(a),bb=availabilitySet(b),runs=[];let run;
  for(let t=start;t<end;t+=60000){if(aa.has(t)&&bb.has(t)){if(!run){run={start:t,end:t+60000};runs.push(run);}else run.end=t+60000;}else run=null;}
  const labelFmt=zone=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'});
  const af=labelFmt(a.timeZone),bf=labelFmt(b.timeZone),label=(fmt,s,e,zone)=>`${fmt.format(s)} – ${fmt.format(e)} (${zone})`;
  const results=[];for(const r of runs){for(let t=r.start;t+durationMinutes*60000<=r.end;t+=durationMinutes*60000){const finish=t+durationMinutes*60000;results.push({start:new Date(t).toISOString(),end:new Date(finish).toISOString(),localLabel:{a:label(af,t,finish,a.timeZone),b:label(bf,t,finish,b.timeZone)}});if(results.length>=200)return results;}}
  return results;
}
module.exports={recommend,typeSuggestions,normalizeTypes,CONSTELLATIONS,MBTIS,ENNEAGRAMS,normalizeAvailability,findCommonSlots};
