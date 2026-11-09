'use strict';
// 相生 首批审核制 (owner decision 2026-11-10).
//  - A profile that becomes listed starts as reviewStatus 'pending'; only 'approved' cards are shown to other people
//    (discover, preview deck, share link, serious page, compatibility targets, member questionnaire). The owner always
//    sees their own card. People already connected keep seeing each other (an accepted connection is not undone here;
//    hard cuts use the existing moderation 停用).
//  - Grandfather: a stored profile without reviewStatus that is listed counts as 'approved' (migration on read).
//  - Approved stays approved across edits and unlist/relist. A rejected owner who edits and saves goes back to 'pending'.
//  - Criteria are 真实 / 完整 / 非广告 only. No score, never looks or income. Reasons come from a fixed list.
const crypto=require('node:crypto');
const {isDisabled}=require('./friends-admin');
const M=require('./friends-matching');

const REVIEW_REASONS=Object.freeze({photo:'照片不清楚或不是本人',incomplete:'资料没填完整',ad:'疑似广告或营销'});
const REVIEW_PENDING_NOTE='审核中：资料通过后会出现在推荐里，一般 24 小时内';
// Admin sees only what is needed to judge 真实/完整/非广告: no income, assets, house, car or hukou.
const QUEUE_FIELDS=['age','height','weight','education','school','occupation','industry','title'];
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};

const statusOf=p=>p?.reviewStatus||(p?.listed?'approved':'pending');
const reviewVisible=p=>statusOf(p)==='approved';

// Review fields for a profile being saved. gate=false (tests / emergency off) approves directly.
function nextReview(prev,{gate,now}){
  const before=prev?statusOf(prev):null;
  if(before==='approved')return {reviewStatus:'approved',...(prev.reviewedAt?{reviewedAt:prev.reviewedAt}:{})};
  if(!gate)return {reviewStatus:'approved'};
  // Still pending and already submitted: keep the queue position. New, legacy-unlisted or rejected → (re)submitted now.
  const keep=before==='pending'&&prev.reviewStatus==='pending'&&prev.listed&&prev.reviewSubmittedAt;
  return {reviewStatus:'pending',reviewSubmittedAt:keep?prev.reviewSubmittedAt:now,...(prev?.reviewedAt?{reviewedAt:prev.reviewedAt}:{})};
}

// What the owner sees about their own card. Never sent for anyone else.
function ownerReview(p){
  const status=statusOf(p);
  return status==='rejected'?{status,reason:p.reviewReason||''}:{status};
}

function createReviewAdmin(store,{clock=()=>Date.now()}={}){
  const byShare=(s,id)=>(typeof id==='string'&&id.length<=100?(s.profiles||[]).find(p=>p.shareId===id):null);
  const row=(s,p)=>{
    const page=(s.seriousPages||[]).find(r=>r.userId===p.userId);
    return {shareId:p.shareId,nickname:p.nickname,city:p.city,purposeLabels:M.purposesOf(p).map(k=>M.PURPOSE_LABELS[k]),
      fields:Object.fromEntries(QUEUE_FIELDS.filter(k=>p.fields?.[k]).map(k=>[k,p.fields[k]])),
      hobbies:p.hobbies||[],dateActivities:p.dateActivities||[],bio:p.bio||'',
      photos:(page?.photos||[]).map(x=>({id:x.id,w:x.w,h:x.h})),
      reviewStatus:statusOf(p),submittedAt:p.reviewSubmittedAt||null,reviewedAt:p.reviewedAt||null,reason:p.reviewReason||null};
  };
  return {
    REVIEW_REASONS,
    // status 'pending' (default): listed, not disabled, oldest first. 'approved': most recent 100, so a card can be rejected later.
    queue(status='pending'){
      if(!['pending','approved'].includes(status))fail(400,'审核状态无效');
      const s=store.read(),list=(s.profiles||[]).filter(p=>p.listed&&!isDisabled(s,p.userId)&&statusOf(p)===status);
      if(status==='pending')return list.sort((a,b)=>String(a.reviewSubmittedAt||'').localeCompare(String(b.reviewSubmittedAt||''))).map(p=>row(s,p));
      return list.sort((a,b)=>String(b.reviewedAt||'').localeCompare(String(a.reviewedAt||''))).slice(0,100).map(p=>row(s,p));
    },
    // Admin may only open a photo that belongs to the card under review. Route streams the bytes afterwards.
    photo(shareId,photoId){
      const s=store.read(),p=byShare(s,shareId);if(!p)fail(404,'卡片不存在');
      const page=(s.seriousPages||[]).find(r=>r.userId===p.userId);
      if(!(page?.photos||[]).some(x=>x.id===photoId))fail(404,'照片不存在');
      return true;
    },
    decide(shareId,{decision,reason}={},actor='admin-token'){
      if(!['approve','reject'].includes(decision))fail(400,'审核结果无效');
      if(decision==='reject'&&!Object.hasOwn(REVIEW_REASONS,reason))fail(400,'请选择不通过原因');
      return store.transaction(s=>{
        const p=byShare(s,shareId);if(!p)fail(404,'卡片不存在');
        const before=statusOf(p),at=new Date(clock()).toISOString();
        if(decision==='approve'&&before==='approved')fail(409,'该卡片已通过');
        if(decision==='reject'&&before==='rejected')fail(409,'该卡片已标记不通过');
        p.reviewStatus=decision==='approve'?'approved':'rejected';p.reviewedAt=at;
        if(decision==='reject')p.reviewReason=REVIEW_REASONS[reason];else delete p.reviewReason;
        if(!Array.isArray(s.auditLogs))s.auditLogs=[];
        s.auditLogs.push({id:crypto.randomUUID(),actor,action:'profile.review.'+decision,target:p.shareId,detail:{before,...(decision==='reject'?{reason:REVIEW_REASONS[reason]}:{})},createdAt:at});
        return {shareId:p.shareId,reviewStatus:p.reviewStatus,reviewedAt:at,...(p.reviewReason?{reason:p.reviewReason}:{})};
      });
    }
  };
}

module.exports={REVIEW_REASONS,REVIEW_PENDING_NOTE,statusOf,reviewVisible,nextReview,ownerReview,createReviewAdmin};
