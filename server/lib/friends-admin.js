'use strict';
const crypto=require('node:crypto');
const error=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const SOURCES=Object.freeze(['wechat','xhs','douyin','channels','direct','tiktok','campus','club','friend']);
const CAMPAIGNS=Object.freeze(['none','launch_20261105','poster_a','poster_b','collection','celeb','video_a','video_b']);
// 校园试点活动码按形态放行（如 campus01_d03），不收任意文本。
const CAMPUS_CAMPAIGN=/^campus\d{2}_[a-z0-9]{1,16}$/;
function normalizeAttribution(value){const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};return {source:input.source==='微信'?'wechat':SOURCES.includes(input.source)?input.source:'direct',campaign:CAMPAIGNS.includes(input.campaign)||(typeof input.campaign==='string'&&CAMPUS_CAMPAIGN.test(input.campaign))?input.campaign:'none'};}
function purgeAttributionMarks(state,now=Date.now()){if(state.attributionMarks===undefined)state.attributionMarks=[];if(!Array.isArray(state.attributionMarks))throw Error('归因标记损坏');state.attributionMarks=state.attributionMarks.filter(mark=>!mark.expiresAt||Date.parse(mark.expiresAt)>now);return state;}
const normalize=s=>{for(const k of ['moderation','auditLogs','feedback','metrics','attributionMarks']){if(s[k]===undefined)s[k]=[];if(!Array.isArray(s[k]))throw Error('运营快照损坏');}return purgeAttributionMarks(s);};
const isDisabled=(s,uid)=>(s.moderation||[]).some(x=>x.userId===uid&&x.disabled);
function metric(s,event,attribution){normalize(s);const day=new Date().toISOString().slice(0,10),{source,campaign}=normalizeAttribution(attribution);let row=s.metrics.find(x=>x.day===day&&x.event===event&&(x.source||'direct')===source&&(x.campaign||'none')===campaign);if(!row){row={day,event,count:0,source,campaign};s.metrics.push(row);}else{row.source=source;row.campaign=campaign;}row.count++;}
const minimal=p=>p?{id:p.shareId,nickname:p.nickname,city:p.city}:null;
function deliveryReview(state,{limit=100,offset=0,now=Date.now()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)error(400,'队列分页参数无效');
 const allOrders=state.billingOrders||[],reservations=state.creditReservations||[],jobs=state.personalReportJobs||[];
 const orders=allOrders.filter(o=>['creating','create_unknown','payment_review'].includes(o.status));
 const reports=jobs.filter(j=>['manual_review','result_saved'].includes(j.status)||(['reserving','generating'].includes(j.status)&&Number.isFinite(j.leaseUntil)&&j.leaseUntil<=now));
 const reason=value=>['expired_execution_lease','settlement_review','generation_failed','release_review','hub_failed_or_refunded','operator_release_pending'].includes(value)?value:'unknown';
 const linked=j=>reservations.find(r=>r.userId===j.userId&&(j.reservationId?r.id===j.reservationId:r.key==='report_'+j.id));
 const reportRows=reports.slice(offset,offset+limit).map(j=>{const r=linked(j),intent=(state.auditLogs||[]).find(a=>a.action==='report.release.intent'&&a.target===j.id&&a.detail?.idempotencyKey===j.releaseOperationKey);return {...(intent?{pendingRelease:{idempotencyKey:intent.detail.idempotencyKey,evidenceRef:intent.detail.evidenceRef,expectedUpdatedAt:intent.detail.expectedUpdatedAt}}:{}),reportId:j.id,status:j.status,createdAt:j.createdAt,updatedAt:j.updatedAt,failureCode:reason(j.failureCode||(j.status==='result_saved'?'settlement_review':'expired_execution_lease')),reservationId:r?.id||null,reservationStatus:r?.status||null,orderIds:r?[...new Set((r.allocations||[]).filter(a=>allOrders.some(o=>o.id===a.orderId&&o.userId===j.userId)).map(a=>a.orderId))]:[],hasSavedResult:!!j.result,linkStatus:r?'linked':'missing'};});
 const orderRows=orders.slice(offset,offset+limit).map(o=>({orderId:o.id,hubOrderId:o.hubOrderId||null,status:o.status,sku:o.sku,createdAt:o.createdAt,updatedAt:o.updatedAt,reasonCode:reason(o.reviewReason),reservationIds:reservations.filter(r=>r.userId===o.userId&&(r.allocations||[]).some(a=>a.orderId===o.id)).map(r=>r.id)}));
 const hasMore=orders.length>offset+limit||reports.length>offset+limit;
 return {readOnly:true,orderCount:orders.length,reportCount:reports.length,orders:orderRows,reports:reportRows,limit,offset,hasMore,nextOffset:hasMore?offset+limit:null};
}
function createAdminService(store){
const recovery=require('./friends-delivery-recovery').createDeliveryRecoveryService(store);
const audit=(s,action,target,detail)=>s.auditLogs.push({id:crypto.randomUUID(),actor:'admin-token',action,target,detail,createdAt:new Date().toISOString()});
return {
summary(){const s=store.read();return {profiles:s.profiles.length,listed:s.profiles.filter(p=>p.listed&&!isDisabled(s,p.userId)).length,disabled:(s.moderation||[]).filter(x=>x.disabled).length,requests:s.requests.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),reports:s.reports.reduce((a,r)=>{const k=r.status||'open';a[k]=(a[k]||0)+1;return a;},{}),metrics:(s.metrics||[]).map(row=>({day:row.day,event:row.event,count:row.count,...normalizeAttribution(row)})),metricUnit:'event_count',metricDayTimeZone:'UTC',attributionScope:'first_profile_creation_not_account_registration',feedback:(s.feedback||[]).reduce((a,r)=>(a[r.outcome]=(a[r.outcome]||0)+1,a),{})};},
profiles(){const s=store.read();return s.profiles.slice(-200).reverse().map(p=>({...minimal(p),disabled:isDisabled(s,p.userId)}));},
reports(status){const s=store.read();return s.reports.filter(r=>!status||(r.status||'open')===status).slice(-200).reverse().map(r=>({id:r.id,status:r.status||'open',reason:r.reason,createdAt:r.createdAt,updatedAt:r.updatedAt,target:minimal(s.profiles.find(p=>p.userId===r.target))}));},
orders(){const s=store.read(),nick=uid=>((s.profiles||[]).find(p=>p.userId===uid)||{}).nickname||'(未建卡)';
  const direct=(s.billingOrders||[]).filter(o=>o.provider==='direct'&&['paid','refunded'].includes(o.status)).map(o=>({id:o.id,status:o.status,sku:o.sku,amountMinor:o.amountMinor,channel:o.channel,paidAt:o.paidAt,accessUntil:o.accessUntil,refundedAt:o.refundedAt||null,nickname:nick(o.userId)}));
  // 合盘完整版单次订单（收款中台）：refundRequest = 对方 7 天内撤回且付款人没打开过 / 双方重复付款 / 目标已删，需要运营去中台退款后在这里标记。
  const hepan=(s.hepanOrders||[]).filter(o=>['paid','refunded','payment_review'].includes(o.status)).map(o=>({id:o.id,status:o.status,sku:o.sku,amountMinor:o.amountMinor,channel:o.channel,paidAt:o.paidAt||null,accessUntil:null,refundedAt:o.refundedAt||null,hubOrderId:o.hubOrderId||null,refundRequest:o.refundRequest&&!o.refundRequest.resolvedAt?o.refundRequest.reason:null,nickname:nick(o.userId)}));
  return [...direct,...hepan].sort((a,b)=>String(b.paidAt||'').localeCompare(String(a.paidAt||''))).slice(0,200);},
// 直购退款：钱在支付宝/微信商户后台人工退，这里只撤销会员权益并留审计。isMember 只认 status==='paid'。
markRefunded(id,note){const clean=typeof note==='string'?note.trim().slice(0,300):'';if(!clean)error(400,'请填写退款说明');return store.transaction(s=>{normalize(s);const pay=require('./friends-hepan-pay'),now=Date.now();
  // 合盘完整版单次订单：标记退款 → 双方的完整版一起收回。
  const h=(s.hepanOrders||[]).find(o=>o.id===id);if(h){if(h.status==='refunded')return {ok:true,duplicate:true};if(h.status!=='paid'&&h.status!=='payment_review')error(409,'只有已到账或待核对订单可标记退款');const r=pay.refundOrderIn(s,h,'admin',now);audit(s,'order.refund',h.id,clean);return {ok:true,revokedUnlocks:r.revoked};}
  const o=(s.billingOrders||[]).find(o=>o.id===id&&o.provider==='direct');if(!o)error(404,'订单不存在');if(o.status==='refunded')return {ok:true,duplicate:true};if(o.status!=='paid')error(409,'只有已到账订单可标记退款');o.status='refunded';o.refundedAt=new Date(now).toISOString();
  // 会员退款：用这笔会员每月份数解锁的合盘完整版一并收回。
  const r=o.matchingMembership?pay.revokeMembershipIn(s,o.id,now):{revoked:0};audit(s,'order.refund',o.id,clean);return r.revoked?{ok:true,revokedUnlocks:r.revoked}:{ok:true};});},
// 合盘完整版金额待核对的单：运营在中台核对确实收到款后放行（解锁），否则走上面的标记退款。
approveHepanReview(id,note){const clean=typeof note==='string'?note.trim().slice(0,300):'';if(!clean)error(400,'请填写核对说明');return store.transaction(s=>{normalize(s);const pay=require('./friends-hepan-pay'),h=(s.hepanOrders||[]).find(o=>o.id===id);if(!h)error(404,'订单不存在');const r=pay.approveReviewIn(s,h,Date.now());audit(s,'order.approve',h.id,clean);return r;});},
audit(){return structuredClone((store.read().auditLogs||[]).slice(-200).reverse());},
deliveryReview(options){return deliveryReview(store.read(),options);},
releaseReport(reportId,body,actor){return recovery.release({...body,reportId,actor});},
review(id,status,note){if(!['open','reviewing','resolved','dismissed'].includes(status))error(400,'处理状态无效');const clean=typeof note==='string'?note.trim().slice(0,300):'';if(!clean)error(400,'请填写处理说明');return store.transaction(s=>{normalize(s);const r=s.reports.find(r=>r.id===id);if(!r)error(404,'举报不存在');const before=r.status||'open';r.status=status;r.updatedAt=new Date().toISOString();audit(s,'report.review',id,{before,status,note:clean});return {id,status,updatedAt:r.updatedAt};});},
moderate(id,disabled,reason){if(typeof disabled!=='boolean')error(400,'disabled必须为布尔值');const clean=typeof reason==='string'?reason.trim().slice(0,300):'';if(!clean)error(400,'请填写处理原因');return store.transaction(s=>{normalize(s);const p=s.profiles.find(p=>p.shareId===id);if(!p)error(404,'卡片不存在');let row=s.moderation.find(x=>x.userId===p.userId);if(!row){row={userId:p.userId};s.moderation.push(row);}row.disabled=disabled;row.updatedAt=new Date().toISOString();audit(s,'profile.moderate',id,{disabled,reason:clean});return {...minimal(p),disabled};});}
};}
function adminAuth(token){return (req,res,next)=>{if(typeof token!=='string'||Buffer.byteLength(token)<32)return res.status(503).json({error:'管理功能未配置'});const raw=req.get('X-Admin-Token')||req.get('Authorization')?.replace(/^Bearer /,'')||'';const a=Buffer.from(raw),b=Buffer.from(token);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'管理凭证无效'});req.friendsAdminActor='admin-token:'+crypto.createHash('sha256').update(token).digest('hex').slice(0,16);next();};}
function createRateLimit({limit=60,windowMs=60000,maxKeys=10000}={}){const buckets=new Map();return (req,res,next)=>{const now=Date.now();for(const [key,row] of buckets)if(row.until<=now)buckets.delete(key);const keys=['ip:'+req.ip,...(req.user?['user:'+req.user.id]:[])];for(const key of keys){let row=buckets.get(key);if(!row){if(buckets.size>=maxKeys)return res.status(429).json({error:'请求过于频繁'});row={count:0,until:now+windowMs};buckets.set(key,row);}if(++row.count>limit){res.set('Retry-After',String(Math.ceil((row.until-now)/1000)));return res.status(429).json({error:'请求过于频繁，请稍后重试'});}}next();};}
module.exports={CAMPUS_CAMPAIGN,normalize,isDisabled,metric,normalizeAttribution,purgeAttributionMarks,deliveryReview,SOURCES,CAMPAIGNS,createAdminService,adminAuth,createRateLimit};
