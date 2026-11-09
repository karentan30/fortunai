'use strict';
// 相生 · 「见面四步」per connected pair. Pure state helpers; access control (pair-only, blocked/disabled hidden) is done by
// friends-service before any of these run. One record per accepted request id: a disconnect deletes it, a later new
// connection starts fresh. Confirmations are mutual self-report, never platform verification.
const {findCommonSlots}=require('./friends-preferences');
const {findForbidden}=require('./friends-copy-guard');
const {STEPS,COPY,KINDS}=require('../../assets/js/friends-meet-steps');
const KEYS=STEPS.map(s=>s.key);
const MAX_DAYS=14,MAX_SLOTS=3,BJ=8*3600000,GRID=30*60000,PLACE_MAX=40;
const fail=(m,status=400)=>{const e=Error(m);e.status=status;throw e;};
const id=v=>String(v);
const list=s=>{if(!Array.isArray(s.meetSteps))s.meetSteps=[];return s.meetSteps;};
const find=(s,r)=>(s.meetSteps||[]).find(x=>x.requestId===r.id)||null;
function ensure(s,r){let rec=find(s,r);if(!rec){rec={requestId:r.id,pair:[id(r.from),id(r.to)],confirms:Object.fromEntries(KEYS.map(k=>[k,[]])),appts:{}};list(s).push(rec);}rec.appts||={};return rec;}
// 「11月12日（周三）20:00」 in Beijing time, same as the rest of the app.
function label(iso){const d=new Date(Date.parse(iso)+BJ),p=n=>String(n).padStart(2,'0');return `${d.getUTCMonth()+1}月${d.getUTCDate()}日（周${'日一二三四五六'[d.getUTCDay()]}）${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;}
const done=(rec,k)=>!!rec&&rec.pair.every(u=>rec.confirms[k].includes(u));
// Suggested slots (on the half hour, long enough for this kind) from the overlap of both availabilities.
// Connected people can already see each other's availability (friends-service project()), so nothing new is revealed.
function suggest(a,b,now,minutes){
  let rows;try{rows=findCommonSlots(a,b,{now:new Date(now),days:MAX_DAYS,durationMinutes:15});}catch(_){return [];}
  const starts=new Set(rows.map(x=>Date.parse(x.start))),need=Math.ceil(minutes/15),out=[],days=new Set();
  for(const t of [...starts].sort((x,y)=>x-y)){
    if(t%GRID||t<=now)continue;let ok=true;for(let i=1;i<need;i++)if(!starts.has(t+i*15*60000))ok=false;if(!ok)continue;
    const day=label(new Date(t).toISOString()).split('（')[0];if(days.has(day))continue;days.add(day);out.push(new Date(t).toISOString());if(out.length>=MAX_SLOTS)break;
  }
  return out.map(start=>({start,label:label(start)}));
}
function apptView(a,kind,me,now){
  const k=KINDS[kind];if(!a)return null;
  if(a.status==='booked'){
    if(Date.parse(a.start)+k.minutes*60000<=now)return null; // past bookings drop off
    return {status:'booked',start:a.start,end:new Date(Date.parse(a.start)+k.minutes*60000).toISOString(),label:label(a.start),...(a.place?{place:a.place}:{}),text:'已约好：'+label(a.start)+' '+k.word+(a.place?' · '+a.place:'')};
  }
  const proposals=a.proposals.filter(t=>Date.parse(t)>now).map(start=>({start,label:label(start)}));
  return proposals.length?{status:'proposed',byMe:a.by===me,proposals,...(a.place?{place:a.place}:{})}:null;
}
function view(s,r,uid,{now,mineAvail,theirAvail}={}){
  const rec=find(s,r),me=id(uid);
  const steps=KEYS.map((k,i)=>{const c=rec?.confirms[k]||[];return {step:i+1,key:k,mine:c.includes(me),theirs:c.some(u=>u!==me),done:done(rec,k)};});
  const videoMet=steps[2].done,appointments={};
  for(const [kind,k] of Object.entries(KINDS)){const a=apptView(rec?.appts?.[kind],kind,me,now);appointments[kind]={kind,step:k.step,minutes:k.minutes,schedule:a,suggested:a?.status==='booked'||steps[k.step-1].done?[]:suggest(mineAvail,theirAvail,now,k.minutes)};}
  // Don't suggest a time that overlaps something this pair already booked.
  const busy=Object.values(appointments).map(x=>x.schedule).filter(x=>x?.status==='booked').map(x=>[Date.parse(x.start),Date.parse(x.end)]);
  for(const x of Object.values(appointments))x.suggested=x.suggested.filter(g=>{const t=Date.parse(g.start),e=t+x.minutes*60000;return !busy.some(([b0,b1])=>t<b1&&e>b0);});
  const offlineTouched=steps[3].mine||steps[3].theirs||!!appointments.meet.schedule;
  return {steps,videoMet,skipReminder:!videoMet&&offlineTouched?COPY.skipReminder:null,appointments,timeZone:'北京时间',note:COPY.badgeNote};
}
function step(s,r,uid,body){
  const n=Number(body?.step),k=KEYS[n-1];if(!Number.isInteger(n)||!k)fail('步骤无效');
  if(!['confirm','undo'].includes(body?.action))fail('操作无效');
  const rec=ensure(s,r),me=id(uid),c=rec.confirms[k];
  if(body.action==='confirm'){if(!c.includes(me))c.push(me);}else rec.confirms[k]=c.filter(u=>u!==me);
  rec.updatedAt=new Date().toISOString();
  return {reminder:k==='offline'&&body.action==='confirm'&&!done(rec,'video')?COPY.skipReminder:null};
}
// slots: [{date:'2026-11-12',time:'20:00'}] in Beijing time. Only from now up to 14 days ahead.
function parseSlot(x,now){
  if(!x||!/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time||''))fail('请选择日期和开始时间');
  const t=Date.parse(x.date+'T'+x.time+':00+08:00');if(!Number.isFinite(t))fail('时间无效');
  if(t<=now)fail('只能约之后的时间');if(t>now+MAX_DAYS*86400000)fail('最多约 14 天以内的时间');
  return new Date(t).toISOString();
}
function parsePlace(v){
  if(v===undefined||v===null||v==='')return '';if(typeof v!=='string')fail('地点无效');
  const t=v.replace(/\s+/g,' ').trim();if(t.length>PLACE_MAX)fail('地点最多 '+PLACE_MAX+' 个字');
  if(findForbidden(t).length)fail('地点里有不能使用的词，请换个写法');return t;
}
// action: propose (also 「换个时间」 and rescheduling a booked time) | pick | cancel
function appointment(s,r,uid,body,now){
  const kind=body?.kind,k=Object.hasOwn(KINDS,kind||'')?KINDS[kind]:null;if(!k)fail('预约类型无效');
  const rec=ensure(s,r),me=id(uid),a=body.action;
  if(a==='propose'){
    const raw=Array.isArray(body.slots)?body.slots:[];if(raw.length<1||raw.length>MAX_SLOTS)fail('请给 1 到 3 个时间');
    if(kind!=='meet'&&body.place)fail('只有线下见面可以写地点');
    const proposals=[...new Set(raw.map(x=>parseSlot(x,now)))].sort(),place=kind==='meet'?parsePlace(body.place):'';
    rec.appts[kind]={status:'proposed',by:me,proposals,...(place?{place}:{})};
  }else if(a==='pick'){
    const v=rec.appts[kind];if(!v||v.status!=='proposed')fail('现在没有待选的时间',409);if(v.by===me)fail('请等TA选一个时间，或者取消后重新约',409);
    const start=v.proposals.find(t=>t===body.start&&Date.parse(t)>now);if(!start)fail('这个时间已经过了或不在可选里，请换个时间');
    rec.appts[kind]={status:'booked',by:v.by,pickedBy:me,start,...(v.place?{place:v.place}:{})};
  }else if(a==='cancel'){delete rec.appts[kind];}
  else fail('操作无效');
  rec.updatedAt=new Date().toISOString();
  return {};
}
const purgeRequest=(s,requestId)=>{if(Array.isArray(s.meetSteps))s.meetSteps=s.meetSteps.filter(x=>x.requestId!==requestId);};
const purgeUser=(s,uid)=>{if(Array.isArray(s.meetSteps))s.meetSteps=s.meetSteps.filter(x=>!x.pair.includes(id(uid)));};
// Connections list marker: the next booked appointment for this pair (only in the pair's own list).
function upcoming(s,r,now){const rec=find(s,r);let best=null;for(const [kind,k] of Object.entries(KINDS)){const a=rec?.appts?.[kind];if(a?.status==='booked'&&Date.parse(a.start)+k.minutes*60000>now&&(!best||a.start<best.start))best={kind,start:a.start,tag:'待'+k.word};}return best;}
module.exports={view,step,appointment,purgeRequest,purgeUser,upcoming,label,KEYS,KINDS};
