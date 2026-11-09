'use strict';
// 相生 · 「见面三步」per connected pair. Pure state helpers; access control (pair-only, blocked/disabled hidden) is done by
// friends-service before any of these run. One record per accepted request id: a disconnect deletes it, a later new
// connection starts fresh. Confirmations are mutual self-report, never platform verification.
const {findCommonSlots}=require('./friends-preferences');
const {findForbidden}=require('./friends-copy-guard');
const {STEPS,COPY,KINDS,CHOICES,MEALS,MEET_LENGTHS,meetMinutes,activityOptions}=require('../../assets/js/friends-meet-steps');
const {DATE_ACTIVITIES}=require('../../assets/js/friends-date-activities');
const KEYS=STEPS.map(s=>s.key); // chat, call, offline
// Records written before the 3-step change (2026-11-10) used chat/voice/video/offline. They are read as-is, never rewritten:
// a person counts as having confirmed step 2 if they are in call, voice OR video. Only an explicit undo of step 2 removes
// them from those legacy lists too (otherwise undo would be impossible). Old booked/proposed 'video' appointments stay
// under KINDS.video (legacy: shown, pickable, cancellable, no new proposals).
const ALIASES={call:['call','voice','video']};
const keysOf=k=>ALIASES[k]||[k];
const MAX_DAYS=14,MAX_SLOTS=3,BJ=8*3600000,GRID=30*60000,PLACE_MAX=40,QUIET_DAYS=7;
const ACTIVITY_OK=new Set([...MEALS,...DATE_ACTIVITIES]);
const fail=(m,status=400)=>{const e=Error(m);e.status=status;throw e;};
const id=v=>String(v);
const list=s=>{if(!Array.isArray(s.meetSteps))s.meetSteps=[];return s.meetSteps;};
const find=(s,r)=>(s.meetSteps||[]).find(x=>x.requestId===r.id)||null;
function ensure(s,r){let rec=find(s,r);if(!rec){rec={requestId:r.id,pair:[id(r.from),id(r.to)],confirms:Object.fromEntries(KEYS.map(k=>[k,[]])),appts:{}};list(s).push(rec);}rec.appts||={};return rec;}
// 「11月12日（周三）20:00」 in Beijing time, same as the rest of the app.
function label(iso){const d=new Date(Date.parse(iso)+BJ),p=n=>String(n).padStart(2,'0');return `${d.getUTCMonth()+1}月${d.getUTCDate()}日（周${'日一二三四五六'[d.getUTCDay()]}）${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;}
const confirmed=(rec,k,u)=>!!rec&&keysOf(k).some(x=>(rec.confirms?.[x]||[]).includes(u));
const confirmers=(rec,k)=>rec?[...new Set(keysOf(k).flatMap(x=>rec.confirms?.[x]||[]))]:[];
const done=(rec,k)=>!!rec&&rec.pair.every(u=>confirmed(rec,k,u));
// 已视频见过: both confirmed the new 语音 · 视频 step (it includes a short video) or the old video step. An old voice-only
// confirmation does not count, so this badge never claims a video that did not happen.
const videoMet=rec=>!!rec&&rec.pair.every(u=>['call','video'].some(x=>(rec.confirms?.[x]||[]).includes(u)));
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
const lenOf=(a,k)=>Number.isInteger(a?.minutes)?a.minutes:k.minutes;
function apptView(a,kind,me,now){
  const k=KINDS[kind];if(!a)return null;
  if(a.status==='booked'){
    const len=lenOf(a,k);if(Date.parse(a.start)+len*60000<=now)return null; // past bookings drop off
    return {status:'booked',start:a.start,end:new Date(Date.parse(a.start)+len*60000).toISOString(),minutes:len,label:label(a.start),...(a.place?{place:a.place}:{}),...(a.activity?{activity:a.activity}:{}),text:'已约好：'+label(a.start)+(a.activity?' · '+a.activity:' '+k.word)+(a.place?' · '+a.place:'')};
  }
  const proposals=a.proposals.filter(t=>Date.parse(t)>now).map(start=>({start,label:label(start)}));
  return proposals.length?{status:'proposed',byMe:a.by===me,proposals,minutes:lenOf(a,k),...(a.activity?{activity:a.activity}:{}),...(a.place?{place:a.place}:{})}:null;
}
// 想不想见面：each side picks privately. The other side's own choice is NEVER put in a view; only two pair-level outcomes are:
//   mutual —— both picked 想见面; closed —— someone picked 到这里就好 and (both have answered, or that pick is 7+ days old).
// Neither outcome says who picked what. Available once step 2 (语音 · 视频, incl. legacy voice/video) is done by both.
const canDecide=rec=>done(rec,'call');
function outcome(rec,now){
  const d=rec?.decisions||{},all=rec?rec.pair.map(u=>d[u]).filter(Boolean):[];
  if(all.length===2&&all.every(x=>x.choice==='meet'))return 'mutual';
  const ends=all.filter(x=>x.choice==='end');
  if(ends.length&&(all.length===2||ends.some(x=>now-Date.parse(x.at)>=QUIET_DAYS*86400000)))return 'closed';
  return null;
}
function decisionView(rec,me,now){
  const out=outcome(rec,now);
  return {available:!!rec&&canDecide(rec),mine:rec?.decisions?.[me]?.choice||null,outcome:out,message:out==='mutual'?COPY.mutual:out==='closed'?COPY.closed:null};
}
function view(s,r,uid,{now,mineAvail,theirAvail,shared=[]}={}){
  const rec=find(s,r),me=id(uid);
  const steps=KEYS.map((k,i)=>{const c=confirmers(rec,k);return {step:i+1,key:k,mine:c.includes(me),theirs:c.some(u=>u!==me),done:done(rec,k)};});
  const appointments={};
  for(const [kind,k] of Object.entries(KINDS)){const a=apptView(rec?.appts?.[kind],kind,me,now);appointments[kind]={kind,step:k.step,minutes:k.minutes,...(k.legacy?{legacy:true}:{}),schedule:a,suggested:k.legacy||a?.status==='booked'||steps[k.step-1].done?[]:suggest(mineAvail,theirAvail,now,k.minutes)};}
  // Don't suggest a time that overlaps something this pair already booked.
  const busy=Object.values(appointments).map(x=>x.schedule).filter(x=>x?.status==='booked').map(x=>[Date.parse(x.start),Date.parse(x.end)]);
  for(const x of Object.values(appointments))x.suggested=x.suggested.filter(g=>{const t=Date.parse(g.start),e=t+x.minutes*60000;return !busy.some(([b0,b1])=>t<b1&&e>b0);});
  const decision=decisionView(rec,me,now);
  return {steps,videoMet:videoMet(rec),decision,skipReminder:decision.outcome==='mutual'?null:COPY.skipReminder,appointments,activities:{shared:activityOptions(shared).filter(x=>shared.includes(x)),options:activityOptions(shared)},timeZone:'北京时间',note:COPY.badgeNote};
}
function step(s,r,uid,body,now=Date.now()){
  const n=Number(body?.step),k=KEYS[n-1];if(!Number.isInteger(n)||!k)fail('步骤无效');
  if(!['confirm','undo'].includes(body?.action))fail('操作无效');
  const rec=ensure(s,r),me=id(uid);rec.confirms[k]||=[];
  if(body.action==='confirm'){if(!confirmed(rec,k,me))rec.confirms[k].push(me);}
  else for(const x of keysOf(k))if(Array.isArray(rec.confirms[x]))rec.confirms[x]=rec.confirms[x].filter(u=>u!==me);
  rec.updatedAt=new Date(now).toISOString();
  return {reminder:k==='offline'&&body.action==='confirm'&&outcome(rec,now)!=='mutual'?COPY.skipReminder:null};
}
function decide(s,r,uid,body,now){
  const choice=body?.choice;if(!Object.hasOwn(CHOICES,choice||''))fail('选择无效');
  const rec=ensure(s,r);if(!canDecide(rec))fail('先语音视频聊过，再来选',409);
  // Once the pair-level outcome exists it is final: flipping a choice afterwards could reveal what the other side picked.
  if(outcome(rec,now))fail('这一步已经有结果了，不能再改',409);
  rec.decisions||={};rec.decisions[id(uid)]={choice,at:new Date(now).toISOString()};rec.updatedAt=new Date(now).toISOString();
  return {};
}
// slots: [{date:'2026-11-12',time:'20:00'}] in Beijing time. Only from now up to 14 days ahead.
function parseSlot(x,now){
  if(!x||!/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time||''))fail('请选择日期和开始时间');
  const t=Date.parse(x.date+'T'+x.time+':00+08:00');if(!Number.isFinite(t))fail('时间无效');
  if(t<=now)fail('只能约之后的时间');if(t>now+MAX_DAYS*86400000)fail('最多约 14 天以内的时间');
  return new Date(t).toISOString();
}
function parseActivity(v){
  if(v===undefined||v===null||v==='')return '';if(typeof v!=='string'||!ACTIVITY_OK.has(v))fail('请从列表里选一起做什么');return v;
}
// 见面时长：没传就按一起做什么给默认（喝咖啡 1 小时、吃饭 1.5 小时、运动和其他 2 小时、没选 1 小时）；传了必须是可选档之一。
function parseMinutes(v,activity){
  if(v===undefined||v===null||v==='')return meetMinutes(activity);const n=Number(v);if(!Object.hasOwn(MEET_LENGTHS,String(n)))fail('见面时长无效');return n;
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
    if(k.legacy)fail('视频已并入「语音 · 视频」，请约个通话时间');
    const raw=Array.isArray(body.slots)?body.slots:[];if(raw.length<1||raw.length>MAX_SLOTS)fail('请给 1 到 3 个时间');
    if(kind!=='meet'&&(body.place||body.activity||body.minutes))fail('只有线下见面可以写地点、一起做什么和时长');
    const proposals=[...new Set(raw.map(x=>parseSlot(x,now)))].sort(),place=kind==='meet'?parsePlace(body.place):'',activity=kind==='meet'?parseActivity(body.activity):'';
    rec.appts[kind]={status:'proposed',by:me,proposals,...(kind==='meet'?{minutes:parseMinutes(body.minutes,activity)}:{}),...(activity?{activity}:{}),...(place?{place}:{})};
  }else if(a==='pick'){
    const v=rec.appts[kind];if(!v||v.status!=='proposed')fail('现在没有待选的时间',409);if(v.by===me)fail('请等TA选一个时间，或者取消后重新约',409);
    const start=v.proposals.find(t=>t===body.start&&Date.parse(t)>now);if(!start)fail('这个时间已经过了或不在可选里，请换个时间');
    rec.appts[kind]={status:'booked',by:v.by,pickedBy:me,start,...(v.minutes?{minutes:v.minutes}:{}),...(v.activity?{activity:v.activity}:{}),...(v.place?{place:v.place}:{})};
  }else if(a==='cancel'){delete rec.appts[kind];}
  else fail('操作无效');
  rec.updatedAt=new Date(now).toISOString();
  return {reminder:kind==='meet'&&a==='propose'&&outcome(rec,now)!=='mutual'?COPY.skipReminder:null};
}
const purgeRequest=(s,requestId)=>{if(Array.isArray(s.meetSteps))s.meetSteps=s.meetSteps.filter(x=>x.requestId!==requestId);};
const purgeUser=(s,uid)=>{if(Array.isArray(s.meetSteps))s.meetSteps=s.meetSteps.filter(x=>!x.pair.includes(id(uid)));};
// Connections list marker: the next booked appointment for this pair (only in the pair's own list).
function upcoming(s,r,now){const rec=find(s,r);let best=null;for(const [kind,k] of Object.entries(KINDS)){const a=rec?.appts?.[kind];if(a?.status==='booked'&&Date.parse(a.start)+lenOf(a,k)*60000>now&&(!best||a.start<best.start))best={kind,start:a.start,tag:'待'+k.word};}return best;}
module.exports={view,step,decide,appointment,purgeRequest,purgeUser,upcoming,label,KEYS,KINDS};
