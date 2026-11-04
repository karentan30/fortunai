'use strict';
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],ANIMALS=[...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const PAIRS=[[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]],GROUPS=[[8,0,4],[11,3,7],[2,6,10],[5,9,1]];
const fail=m=>{const e=Error(m);e.status=400;throw e;};
function recommend(chart={}){const index=STEMS.indexOf(chart.dayMaster),animal=ANIMALS.indexOf(chart.zodiac),mother=index<0?-1:(Math.floor(index/2)+4)%5;const pair=PAIRS.find(p=>p.includes(animal)),group=GROUPS.find(p=>p.includes(animal));return {stems:mother<0?[]:STEMS.slice(mother*2,mother*2+2),zodiacs:animal<0?[]:[...new Set([...pair,...group].filter(i=>i!==animal))].map(i=>ANIMALS[i]),basis:{stems:'按日主五行的“生我”关系提供两个认识方向；不是完整八字喜用神，也不代表最佳对象。',zodiacs:'按传统地支六合及三合取同组生肖作为文化认识话题；不表示两人已成三合局，不保证关系结果。'},kind:'cultural_reference'};}
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
module.exports={recommend,normalizeAvailability,findCommonSlots};
