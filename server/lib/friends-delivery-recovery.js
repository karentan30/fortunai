'use strict';
const crypto=require('node:crypto');
const {createBillingService}=require('./friends-billing');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function createDeliveryRecoveryService(store,{billing=createBillingService(store),clock=()=>Date.now()}={}){
 const validKey=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(v);
 const log=(s,actor,action,target,detail)=>s.auditLogs.push({id:crypto.randomUUID(),actor,action,target,detail,createdAt:new Date(clock()).toISOString()});
 return {async release({reportId,idempotencyKey,expectedUpdatedAt,evidenceRef,reasonCode,actor}={}){
  if(!/^admin-token:[a-f0-9]{16}$/.test(actor||''))fail(403,'缺少可信管理员身份');
  if(!validKey(idempotencyKey)||!/^OPS-[A-Z0-9_-]{3,36}$/.test(evidenceRef||'')||reasonCode!=='execution_failed_no_result'||typeof expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(expectedUpdatedAt)))fail(400,'请提供幂等键、OPS工单编号、未交付原因及原状态时间');
  const prepared=store.transaction(s=>{
   if(s.auditLogs===undefined)s.auditLogs=[];if(!Array.isArray(s.auditLogs))throw Error('审计记录损坏');
   const previous=s.auditLogs.find(a=>a.action==='report.release.intent'&&a.detail?.idempotencyKey===idempotencyKey);
   if(previous&&(previous.target!==reportId||previous.detail.evidenceRef!==evidenceRef||previous.detail.expectedUpdatedAt!==expectedUpdatedAt||previous.detail.reasonCode!==reasonCode))fail(409,'幂等键已用于另一报告、状态或证据');
   const complete=s.auditLogs.find(a=>a.action==='report.release.complete'&&a.detail?.idempotencyKey===idempotencyKey);
   if(complete&&(complete.target!==reportId||complete.detail.evidenceRef!==evidenceRef||complete.detail.expectedUpdatedAt!==expectedUpdatedAt||complete.detail.reasonCode!==reasonCode))fail(409,'幂等键已用于另一报告、状态或证据');
   const job=(s.personalReportJobs||[]).find(j=>j.id===reportId);if(!job)fail(404,'报告不存在');
   if(complete)return {done:true,userId:job.userId,reservationId:complete.detail.reservationId};
   if(['delivered','result_saved'].includes(job.status)||job.result!==undefined&&job.result!==null)fail(409,'报告已有保存结果，不可按失败返还次数');
   if(!['manual_review','failed','reserving','generating'].includes(job.status))fail(409,'报告状态不允许失败释放');
   if(['reserving','generating'].includes(job.status)&&(!Number.isFinite(job.leaseUntil)||job.leaseUntil>clock()))fail(409,'报告执行租约仍有效，不可释放');
   if(job.releaseOperationKey&&job.releaseOperationKey!==idempotencyKey)fail(409,'已有另一人工操作，请沿原幂等键核对');
   if(!previous&&job.updatedAt!==expectedUpdatedAt)fail(409,'报告状态已变化，请重新查看队列');
   const reservation=(s.creditReservations||[]).find(r=>r.userId===job.userId&&r.key==='report_'+job.id&&(!job.reservationId||r.id===job.reservationId));
   if(!reservation)fail(409,'没有同一账号及报告的预扣证据，请核对工单，不得凭空返次');
   if(reservation.unit!=='report'||reservation.quantity!==1||(reservation.allocations||[]).some(a=>!Number.isInteger(a.quantity)||a.quantity<1)||(reservation.allocations||[]).reduce((sum,a)=>sum+a.quantity,0)!==1)fail(409,'预扣不是本报告的一次服务，不可释放');
   if(!['reserved','released'].includes(reservation.status))fail(409,'预扣已成功结算或状态异常，不可失败释放');
   if((reservation.allocations||[]).some(a=>!(s.billingOrders||[]).some(o=>o.id===a.orderId&&o.userId===job.userId)))fail(409,'原订单来源不完整，不可释放');
   if(!previous)log(s,actor,'report.release.intent',reportId,{idempotencyKey,evidenceRef,reasonCode,expectedUpdatedAt,reservationId:reservation.id,beforeStatus:job.status,beforeReservationStatus:reservation.status});
   // Fence atomically before touching the ledger. Old workers can no longer save a result.
   job.status='manual_review';job.failureCode='operator_release_pending';job.releaseOperationKey=idempotencyKey;job.reservationId=reservation.id;job.leaseUntil=0;job.bootId=null;job.updatedAt=new Date(clock()).toISOString();
   return {done:false,userId:job.userId,reservationId:reservation.id};
  });
  if(prepared.done)return {reportId,status:'failed',reservationId:prepared.reservationId,reservationStatus:'released',duplicate:true,availableReportCredits:billing.balance(prepared.userId).units.report};
  try{await billing.settle(prepared.userId,prepared.reservationId,'release');}
  catch(_){store.transaction(s=>{log(s,actor,'report.release.interrupted',reportId,{idempotencyKey,evidenceRef,reservationId:prepared.reservationId});});fail(503,'释放未完成，保持人工核对；请沿原工单与幂等键重试');}
  const duplicate=store.transaction(s=>{
   if(s.auditLogs.some(a=>a.action==='report.release.complete'&&a.detail?.idempotencyKey===idempotencyKey))return true;
   const job=(s.personalReportJobs||[]).find(j=>j.id===reportId),r=(s.creditReservations||[]).find(r=>r.id===prepared.reservationId&&r.userId===prepared.userId);
   if(!job||job.releaseOperationKey!==idempotencyKey||job.result!==undefined&&job.result!==null||r?.status!=='released')fail(409,'释放后的状态需人工核对，禁止重复返次');
   job.status='failed';job.failureCode='manual_release_confirmed';job.updatedAt=new Date(clock()).toISOString();
   log(s,actor,'report.release.complete',reportId,{idempotencyKey,evidenceRef,reasonCode,expectedUpdatedAt,reservationId:r.id,afterStatus:'failed',afterReservationStatus:'released'});return false;
  });
  return {reportId,status:'failed',reservationId:prepared.reservationId,reservationStatus:'released',duplicate,availableReportCredits:billing.balance(prepared.userId).units.report};
 }};
}
module.exports={createDeliveryRecoveryService};
