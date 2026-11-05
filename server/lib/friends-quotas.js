'use strict';
// One quota record per account per Beijing calendar day. Browsing is unlimited; only 认识申请 are counted.
// Accepting requests is never counted. Membership never grants access to private data.
const DAY=86400000;
const DEFAULT_LIMITS=Object.freeze({free:Object.freeze({request:3}),member:Object.freeze({request:20})});
function createFriendsQuotas({enabled=false,clock=()=>Date.now(),limits=DEFAULT_LIMITS}={}){
 for(const tier of ['free','member'])if(!Number.isInteger(limits[tier]?.request)||limits[tier].request<1||limits[tier].request>1000)throw Error('交友额度配置无效');
 const day=()=>new Date(clock()+8*3600000).toISOString().slice(0,10);
 const member=(s,uid)=>require('./friends-membership').isMember(s,uid,clock());
 const tierOf=(s,uid)=>member(s,uid)?'member':'free';
 function record(s,uid){
  if(s.dailyQuotas===undefined)s.dailyQuotas=[];
  if(!Array.isArray(s.dailyQuotas))throw Error('交友额度记录损坏');
  // Only today's records are needed; switching membership cannot reset consumption.
  const today=day();s.dailyQuotas=s.dailyQuotas.filter(r=>r.day===today);
  let r=s.dailyQuotas.find(r=>r.userId===uid);if(!r){r={userId:uid,day:today,requests:0};s.dailyQuotas.push(r);}return r;
 }
 function status(s,uid){
  const r=(s.dailyQuotas||[]).find(r=>r.userId===uid&&r.day===day()),tier=tierOf(s,uid),limit=limits[tier].request,used=r?.requests||0;
  return {enabled:!!enabled,tier,timezone:'Asia/Shanghai',day:day(),resetAt:new Date(Date.parse(day()+'T00:00:00+08:00')+DAY).toISOString(),
   limits:{request:limit,memberRequest:limits.member.request},used:{request:used},remaining:{request:enabled?Math.max(0,limit-used):null}};
 }
 return {status,
  discover(s,uid,cards){return cards;},
  request(s,uid){
   if(!enabled)return;const r=record(s,uid),tier=tierOf(s,uid),limit=limits[tier].request;
   if(r.requests>=limit){const e=Error(tier==='member'?`今天的${limit}次认识申请用完了，明天再来`:`今天的${limit}次认识申请用完了，明天再来，或开通会员每天${limits.member.request}次`);e.status=429;e.code='request_quota';throw e;}
   r.requests++;
  }
 };
}
module.exports={createFriendsQuotas,DEFAULT_LIMITS};
