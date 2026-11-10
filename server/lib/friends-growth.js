'use strict';
// 增长看板的服务端整形：把中台 /hub/metrics/events 的返回，变成页面直接能画的行 + 漏斗 + 目标对照。
// 目标来自 docs/design-xiangsheng-2026-11-10/ops-plan-v1.md §10（方案 A，一个城市；是目标不是预测）。
// 内部页面，数字可以直接显示；中台只给计数，这里不碰任何用户标识。
const {EVENTS}=require('./friends-hub-track');
const LABELS=Object.freeze({
  profile_created:'首次建资料',profile_complete:'资料完成并公开',card_enabled:'开启名片',card_opened:'名片被打开',
  invite_created:'发出邀请',invite_claimed:'邀请被认领',compat_free_done:'看免费合盘',compat_paid:'买完整版',
  heju_signup:'局·登记',heju_grouped:'局·被分组',heju_confirmed:'局·确认',heju_attended:'局·到场',heju_mutual:'局·互选',
  connection_accepted:'连接成功'
});
const FUNNEL=Object.freeze(['profile_created','profile_complete','card_enabled','card_opened','invite_created','invite_claimed','compat_free_done','compat_paid']);
// m1/m2/m3 = 第 1/2/3 个月目标；null = 该月没有这项目标。
// 这几步和上一步不是同一批人（打开名片的是访客、被邀请的是新人），不算「转化率」。
const NO_PCT=new Set(['card_opened','invite_created','compat_free_done']);
const TARGETS=Object.freeze([
  {key:'users',label:'完成资料的用户（累计）',m1:200,m2:500,m3:1000,unit:'人'},
  {key:'invite_per_user',label:'每人带来的新人（邀请被认领 ÷ 建资料人数）',m1:0.3,m2:null,m3:null,unit:''},
  {key:'paid_per100',label:'每 100 个看过免费合盘的人，买完整版的人数',m1:null,m2:'3–5',m3:null,unit:'人'},
  {key:'first_paid',label:'第一笔合盘付费（累计笔数）',m1:1,m2:null,m3:null,unit:'笔'},
  {key:'heju_attended',label:'相合局到场（累计人次）。局数目标（M1 办成 2 场、M2 每周 ≥1 场）以相合局后台为准',m1:null,m2:null,m3:null,unit:'人次'}
]);
const num=v=>Number.isFinite(v)?v:0;
const cell=(hub,ev,day)=>{const c=hub?.events?.[ev]?.daily?.[day];return {count:num(c?.count),distinct:num(c?.distinct)};};
const totalOf=(hub,ev)=>({count:num(hub?.events?.[ev]?.total),distinct:num(hub?.events?.[ev]?.distinct)});
const round=(v,d=2)=>Math.round(v*10**d)/10**d;

/** shape(hub, window)：hub = 中台返回（按 90 天取，累计数才准）；window = 表格显示最近多少天（7 或 30）。 */
function shape(hub,window=7){
  const win=window===30?30:7,allDays=Array.isArray(hub?.days)?hub.days.map(String):[];
  const days=allDays.slice(-win);
  const rows=days.map(day=>({day,events:Object.fromEntries(EVENTS.map(e=>[e,cell(hub,e,day)]))}));
  const windowSum=e=>days.reduce((a,d)=>a+cell(hub,e,d).count,0);
  const funnel=FUNNEL.map((e,i)=>{
    const t=totalOf(hub,e),prev=i?totalOf(hub,FUNNEL[i-1]):null;
    return {event:e,label:LABELS[e],distinct:t.distinct,count:t.count,window:windowSum(e),fromPrev:prev&&prev.distinct&&!NO_PCT.has(e)?round(t.distinct/prev.distinct*100,1):null};
  });
  const users=totalOf(hub,'profile_complete').distinct,created=totalOf(hub,'profile_created').distinct;
  const freeViewers=totalOf(hub,'compat_free_done').distinct,buyers=totalOf(hub,'compat_paid').distinct;
  const actual={
    users,
    invite_per_user:created?round(totalOf(hub,'invite_claimed').distinct/created):null,
    paid_per100:freeViewers?round(buyers/freeViewers*100,1):null,
    first_paid:totalOf(hub,'compat_paid').count,
    heju_attended:totalOf(hub,'heju_attended').count
  };
  return {scope:hub?.scope||null,tz:hub?.tz||'Asia/Shanghai',window:win,days:days.length,
    events:EVENTS.map(e=>({event:e,label:LABELS[e]})),rows,windowTotals:Object.fromEntries(EVENTS.map(e=>[e,windowSum(e)])),
    funnel,targets:TARGETS.map(t=>({...t,actual:actual[t.key]}))};
}
module.exports={shape,LABELS,FUNNEL,TARGETS};
