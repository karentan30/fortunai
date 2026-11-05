'use strict';
// One quota record per account/day; membership never grants access to private data.
const DAY=86400000;
const DEFAULT_LIMITS=Object.freeze({free:{discover:5,request:3},member:{discover:15,request:10}});
function createFriendsQuotas({enabled=false,clock=()=>Date.now(),limits=DEFAULT_LIMITS}={}){
 for(const tier of ['free','member'])for(const action of ['discover','request'])if(!Number.isInteger(limits[tier]?.[action])||limits[tier][action]<1||limits[tier][action]>1000)throw Error('交友额度配置无效');
 const day=()=>new Date(clock()+8*3600000).toISOString().slice(0,10);
 const member=(s,uid)=>(s.billingOrders||[]).some(o=>o.userId===uid&&o.matchingMembership===true&&o.benefitsVerified===true&&o.status==='paid'&&Number.isFinite(Date.parse(o.paidAt))&&Date.parse(o.paidAt)<=clock()&&Number.isFinite(Date.parse(o.accessUntil))&&Date.parse(o.accessUntil)>clock());
 const limit=(s,uid,action)=>limits[member(s,uid)?'member':'free'][action];
 function record(s,uid){
  if(s.dailyQuotas===undefined)s.dailyQuotas=[];
  if(!Array.isArray(s.dailyQuotas))throw Error('交友额度记录损坏');
  // Only today's records are needed; switching membership cannot reset consumption.
  const today=day();s.dailyQuotas=s.dailyQuotas.filter(r=>r.day===today);
  let r=s.dailyQuotas.find(r=>r.userId===uid);if(!r){r={userId:uid,day:today,discovered:[],requests:0};s.dailyQuotas.push(r);}return r;
 }
 function status(s,uid){const r=(s.dailyQuotas||[]).find(r=>r.userId===uid&&r.day===day());return {enabled:!!enabled,tier:member(s,uid)?'member':'free',timezone:'Asia/Shanghai',day:day(),resetAt:new Date(Date.parse(day()+'T00:00:00+08:00')+DAY).toISOString(),limits:{discover:limit(s,uid,'discover'),request:limit(s,uid,'request')},used:{discover:r?.discovered.length||0,request:r?.requests||0}};}
 return {status,
  discover(s,uid,cards){if(!enabled)return cards;const r=record(s,uid),max=limit(s,uid,'discover');return cards.filter(p=>{if(r.discovered.includes(p.shareId))return true;if(r.discovered.length>=max)return false;r.discovered.push(p.shareId);return true;});},
  request(s,uid){if(!enabled)return;const r=record(s,uid);if(r.requests>=limit(s,uid,'request')){const e=Error('今日认识申请次数已用完，明天再来');e.status=429;throw e;}r.requests++;}
 };
}
module.exports={createFriendsQuotas,DEFAULT_LIMITS};
