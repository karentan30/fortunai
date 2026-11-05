'use strict';
// Paired (双人) report jobs: consent-version binding, idempotent pair_report entitlement,
// release on failure, lease fencing and access cut-off on revoke.
// Separate from friends-reports.js (personal full report, unit `report`): this module only ever
// reserves the `pair_report` unit, so it can never consume a single-person report credit.
// Hard-closed by default (`enabled:false`); production wiring must not pass true until real
// delivery, model and payment acceptance are done (see docs/交友计费生产接线与操作验收).
const crypto=require('node:crypto');
const {VERSION:COMPAT_VERSION}=require('./friends-compatibility');
const {buildPairFacts,collectForbiddenStrings,PURPOSES,STAGES}=require('./friends-pair-report-adapter');

const UNIT='pair_report';
const ACCEPTED_CONSENT_VERSIONS=Object.freeze([COMPAT_VERSION]);
const ACTIVE=['reserving','generating'];
const fail=(status,message,code)=>{throw Object.assign(Error(message),{status,code});};
const same=(a,b)=>String(a)===String(b);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v===undefined?null:v);
const validKey=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(k);

function createPairReportsService({store,billing,compatibility,adapter,questionnaireService=null,questionBank=null,bindingKey,enabled=false,clock=()=>Date.now(),leaseMs=180000,heartbeatMs=30000}={}){
 if(!store?.read||!store?.transaction||!billing?.reserve||!billing?.settle||!compatibility?.report||!compatibility?.get||typeof adapter?.generate!=='function')throw Error('双人报告服务缺少存储、权益、授权或生成配置');
 if(typeof bindingKey!=='string'||bindingKey.length<32)throw Error('双人报告缺少授权绑定私密密钥');
 const bootId=crypto.randomUUID();
 const nowISO=()=>new Date(clock()).toISOString();
 const hmac=v=>crypto.createHmac('sha256',bindingKey).update(canonical(v)).digest('hex');
 const jobs=s=>{if(s.pairReportJobs===undefined)s.pairReportJobs=[];if(!Array.isArray(s.pairReportJobs))throw Error('双人报告作业资料损坏');return s.pairReportJobs;};
 const pairOf=(s,id)=>(s.compatibilityPairs||[]).find(p=>p.id===id)||null;
 const participant=(j,uid)=>j.participants.some(x=>same(x,uid));
 const find=(s,uid,id)=>{const j=jobs(s).find(j=>j.id===id&&participant(j,uid));if(!j)fail(404,'报告不存在');return j;};

 // Binding: which consent version/time of each side the report used, plus a keyed digest of the
 // full authorization snapshot (chart, questionnaire stamp). The digest is keyed so a stored
 // job cannot be used to brute-force the derived chart.
 function authDigest(pairId,uid,auth){const {chatConsent,...rest}=auth;return hmac({pairId,uid:String(uid),auth:rest});}
 function currentBinding(pair){
  const out=[];
  for(const [role,uid]of [['inviter',pair.from],['invitee',pair.to]]){
   const auth=pair.authorizations?.[String(uid)];
   if(uid===null||!auth||!ACCEPTED_CONSENT_VERSIONS.includes(auth.version))return null;
   out.push({role,userId:uid,consentVersion:auth.version,authorizedAt:auth.at,includeQuestionnaire:auth.includeQuestionnaire===true,digest:authDigest(pair.id,uid,auth)});
  }
  return out;
 }
 function bindingValid(s,j){
  const p=pairOf(s,j.pairId);
  if(!p||p.status!=='ready'||Date.parse(p.expiresAt)<=clock())return false;
  const now=currentBinding(p);
  return !!now&&now.length===j.binding.length&&now.every((b,i)=>same(b.userId,j.binding[i].userId)&&b.consentVersion===j.binding[i].consentVersion&&b.authorizedAt===j.binding[i].authorizedAt&&b.digest===j.binding[i].digest);
 }

 const view=j=>({
  reportId:j.id,pairId:j.pairId,status:j.status,purpose:j.purpose,stage:j.stage,createdAt:j.createdAt,updatedAt:j.updatedAt,
  consent:j.binding.map(b=>({role:b.role,consentVersion:b.consentVersion,authorizedAt:b.authorizedAt})),
  ...(j.status==='delivered'&&j.result?{report:j.result}:{}),
  ...(j.status==='failed'?{error:'报告未完成，双人报告次数已释放或待核对'}:{}),
  ...(j.status==='cancelled_consent_changed'?{error:'生成期间授权发生变化，本次未交付，次数已释放或待核对'}:{}),
  ...(j.status==='access_revoked'?{error:'一方已撤回或变更授权，本报告不可再查看'}:{}),
  ...(j.status==='manual_review'?{error:'报告执行状态待人工核对，请勿重复购买'}:{})
 });
 const update=(id,fn)=>store.transaction(s=>{const j=jobs(s).find(j=>j.id===id);if(!j)fail(404,'报告不存在');fn(j,s);j.updatedAt=nowISO();return structuredClone(j);});
 const live=j=>ACTIVE.includes(j.status)&&j.bootId===bootId&&j.leaseUntil>clock();
 const writeOwned=(id,fn)=>update(id,(j,s)=>{if(!live(j))fail(409,'报告执行租约已失效，须人工核对','lease_lost');fn(j,s);});
 const revokeAccess=id=>update(id,j=>{if(j.status==='delivered'||j.status==='result_saved'){delete j.result;j.status=j.status==='delivered'?'access_revoked':'cancelled_consent_changed';j.failureCode='consent_revoked';j.revokedAt=nowISO();}});

 async function recoverExpired(id){
  let j=structuredClone(jobs(store.read()).find(x=>x.id===id));
  if(ACTIVE.includes(j.status)&&j.leaseUntil<=clock()){
   j=update(id,x=>{if(ACTIVE.includes(x.status)&&x.leaseUntil<=clock()){x.status='manual_review';x.failureCode='expired_execution_lease';}});
   if(!j.reservationId&&typeof billing.reservationByKey==='function'){const r=await billing.reservationByKey(j.purchaserId,'pair_report_'+j.id);if(r)j=update(id,x=>{x.reservationId=r.id;});}
  }
  return j;
 }
 async function releaseFor(j){if(!j.reservationId)return true;try{await billing.settle(j.purchaserId,j.reservationId,'release');return true;}catch(_){return false;}}
 // Saved result: commit only while consent binding still holds; otherwise discard and release.
 async function finalize(id){
  let j=jobs(store.read()).find(x=>x.id===id);
  if(j.status!=='result_saved')return structuredClone(j);
  if(!bindingValid(store.read(),j)){
   const released=await releaseFor(j);
   return update(id,x=>{if(x.status!=='result_saved')return;delete x.result;x.status=released?'cancelled_consent_changed':'manual_review';x.failureCode=released?'consent_changed_before_delivery':'release_review';});
  }
  try{await billing.settle(j.purchaserId,j.reservationId,'commit');return update(id,x=>{if(x.status==='result_saved'){x.status='delivered';x.deliveredAt=nowISO();}});}
  catch(e){return update(id,x=>{x.status=e.status===409?'manual_review':'result_saved';x.failureCode='settlement_review';});}
 }
 // Access check for any read: participant, live compatibility pair (blocks/disable/expiry are
 // enforced by compatibility.report), unchanged binding, questionnaire stamps still valid.
 async function accessible(uid,j){
  if(j.status!=='delivered')return j;
  let guide;
  try{guide=await compatibility.report(uid,j.pairId);}
  catch(e){if([404,409,410].includes(e.status))return revokeAccess(j.id);throw e;}
  const s=store.read(),latest=jobs(s).find(x=>x.id===j.id);
  if(!bindingValid(s,latest)||latest.usedQuestionnaire&&guide?.questionnaireSupplement?.status!=='available')return revokeAccess(j.id);
  return structuredClone(latest);
 }

 async function create(uid,{pairId,idempotencyKey,purpose,stage,consentRetainReport}={},{retryOf=null}={}){
  if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
  if(enabled!==true)fail(503,'双人详细报告尚未开放，暂不收费也不生成');
  if(!validKey(idempotencyKey))fail(400,'报告幂等键无效');
  if(typeof pairId!=='string'||!pairId||pairId.length>100)fail(400,'双人邀请编号无效');
  if(!PURPOSES[purpose]||!STAGES[stage])fail(400,'请选择本次了解目的和当前关系阶段');
  if(consentRetainReport!==true)fail(400,'请明确同意保存本次双人报告结果及必要任务记录');
  const requestHash=hmac({pairId,purpose,stage});
  const existing=jobs(store.read()).find(j=>same(j.purchaserId,uid)&&j.key===idempotencyKey);
  if(existing){if(existing.requestHash!==requestHash)fail(409,'该幂等键已用于另一份双人报告请求');return get(uid,existing.id);}
  // Permission + readiness via the existing compatibility service (participant, both v3 consents,
  // recipient confirmed, not blocked/disabled/expired). Throws before any credit is touched.
  const guide=await compatibility.report(uid,pairId);
  let claimed=false;
  const job=store.transaction(s=>{
   const a=jobs(s),old=a.find(j=>same(j.purchaserId,uid)&&j.key===idempotencyKey);
   if(old){if(old.requestHash!==requestHash)fail(409,'该幂等键已用于另一份双人报告请求');return structuredClone(old);}
   const p=pairOf(s,pairId);if(!p||!(same(p.from,uid)||same(p.to,uid)))fail(404,'邀请不存在');
   const binding=currentBinding(p);if(!binding||p.status!=='ready')fail(409,'需要双方当前版本的有效授权');
   // Same purchaser, same pair, same consent snapshot and request: return the existing report
   // instead of charging again under a new key.
   const dup=a.find(j=>same(j.purchaserId,uid)&&j.requestHash===requestHash&&['reserving','generating','result_saved','delivered','manual_review'].includes(j.status)&&canonical(j.binding)===canonical(binding));
   if(dup)return structuredClone(dup);
   const now=nowISO(),j={id:crypto.randomUUID(),pairId,purchaserId:uid,participants:[p.from,p.to],key:idempotencyKey,requestHash,purpose,stage,binding,status:'reserving',bootId,leaseUntil:clock()+leaseMs,consentVersion:'pair-report-retention-v1',consentedAt:now,createdAt:now,updatedAt:now,...(retryOf?{retryOf}:{})};
   a.push(j);claimed=true;return structuredClone(j);
  });
  if(!claimed)return get(uid,job.id);
  let reservation;
  const heartbeat=setInterval(()=>{try{writeOwned(job.id,j=>{j.leaseUntil=clock()+leaseMs;});}catch(_){}},heartbeatMs);heartbeat.unref?.();
  try{
   const s=store.read(),pair=pairOf(s,pairId);
   const facts=buildPairFacts({pair,guide,purpose,stage});
   const questionnaires=questionnaireService?await Promise.all([pair.from,pair.to].map(async u=>(await questionnaireService.get(u))?.questionnaire||null)):[];
   const forbiddenStrings=collectForbiddenStrings({pair,questionnaires,questionBank});
   reservation=await billing.reserve(uid,UNIT,1,'pair_report_'+job.id);
   if(reservation?.status!=='reserved')throw Error('双人报告次数预扣状态异常');
   writeOwned(job.id,j=>{j.reservationId=reservation.id;j.status='generating';j.usedQuestionnaire=facts.usedQuestionnaire;j.detailLevel=facts.detailLevel;});
   const result=await adapter.generate(facts,{forbiddenStrings});
   if(!result?.sections)throw Error('双人报告结果无效');
   writeOwned(job.id,(j,state)=>{
    if(!bindingValid(state,j))fail(409,'生成期间授权发生变化','consent_changed');
    j.result=result;j.status='result_saved';
   });
  }catch(e){
   clearInterval(heartbeat);
   const latest=jobs(store.read()).find(x=>x.id===job.id);
   if(latest.status==='result_saved')return view(await finalize(job.id));
   if(!live(latest))return view(await recoverExpired(job.id));
   let released=!reservation;
   if(reservation){try{await billing.settle(uid,reservation.id,'release');released=true;}catch(_){released=false;}}
   const consentChanged=e.code==='consent_changed';
   writeOwned(job.id,j=>{j.status=released?(consentChanged?'cancelled_consent_changed':'failed'):'manual_review';j.failureCode=released?(consentChanged?'consent_changed_before_delivery':e.code||'generation_failed'):'release_review';if(e.validationErrors)j.validationErrors=e.validationErrors.slice(0,20);});
   if(e.status&&!consentChanged&&e.code!=='lease_lost')throw e;
   return view(jobs(store.read()).find(x=>x.id===job.id));
  }
  clearInterval(heartbeat);
  return view(await accessible(uid,await finalize(job.id)));
 }

 async function get(uid,id){
  const j=find(store.read(),uid,id);
  if(j.status==='result_saved')return view(await accessible(uid,await finalize(id)));
  if(ACTIVE.includes(j.status))return view(await recoverExpired(id));
  return view(await accessible(uid,structuredClone(j)));
 }

 return {
  unit:UNIT,
  create:(uid,body)=>create(uid,body),
  get,
  // Retry a failed/cancelled job with a new idempotency key; the failed job stays as an audit record.
  async retry(uid,id,{idempotencyKey,consentRetainReport}={}){
   const j=find(store.read(),uid,id);
   if(!same(j.purchaserId,uid))fail(403,'只有购买方可以重试');
   if(!['failed','cancelled_consent_changed'].includes(j.status))fail(409,'只有失败或已取消的报告可以重试');
   if(idempotencyKey===j.key)fail(409,'重试须使用新的幂等键');
   return create(uid,{pairId:j.pairId,idempotencyKey,purpose:j.purpose,stage:j.stage,consentRetainReport},{retryOf:j.id});
  },
  list(uid){return jobs(store.read()).filter(j=>participant(j,uid)).map(j=>{const v=view(j);delete v.report;return v;});},
  // Maintenance: purge delivered results whose consent binding no longer holds (revoked/declined/
  // expired/re-authorized). result_saved jobs are left to finalize(), which releases the credit.
 // Reads never depend on this having run.
  sweep(){return store.transaction(s=>{let purged=0;for(const j of jobs(s))if(j.status==='delivered'&&!bindingValid(s,j)){delete j.result;j.status='access_revoked';j.failureCode='consent_revoked';j.revokedAt=nowISO();j.updatedAt=j.revokedAt;purged++;}return {purged};});}
 };
}

module.exports={createPairReportsService,ACCEPTED_CONSENT_VERSIONS,UNIT};
