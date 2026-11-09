'use strict';
const XB=require('./friends-cross-border');
const crypto=require('node:crypto');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const reportView=j=>({reportId:j.id,status:j.status,createdAt:j.createdAt,updatedAt:j.updatedAt,...(j.status==='delivered'?{report:j.result}:{}),...(j.status==='failed'?{error:'报告未完成，服务次数已释放或待核对'}:{}),...(j.status==='manual_review'?{error:'报告执行状态待人工核对，请勿重复购买'}:{})});
function createFriendsReportsService({store,billing,verifyChart,generate,clock=()=>Date.now(),inputHashKey,validateResult,leaseMs=180000,heartbeatMs=30000,collection='personalReportJobs'}={}){
 if(!store||!billing||typeof verifyChart!=='function'||typeof generate!=='function'||typeof inputHashKey!=='string'||inputHashKey.length<32)throw Error('报告服务缺少存储、权益、排盘或私密哈希配置');
 const bootId=crypto.randomUUID();
 // collection：作业存放位置。默认是会员次数买的本人报告；「我的命盘」付费报告用自己的集合，互不混看。
 const jobs=s=>{if(!s[collection])s[collection]=[];if(!Array.isArray(s[collection]))throw Error('报告作业资料损坏');return s[collection];};
 const own=(s,uid,id)=>{const j=jobs(s).find(j=>j.id===id&&j.userId===uid);if(!j)fail(404,'报告不存在');return j;};
 const view=reportView;
 const update=(uid,id,fn)=>store.transaction(s=>{const j=own(s,uid,id);fn(j);j.updatedAt=new Date(clock()).toISOString();return structuredClone(j);});
 const active=j=>['reserving','generating'].includes(j.status)&&j.bootId===bootId&&j.leaseUntil>clock();
 const writeOwned=(uid,id,fn)=>update(uid,id,j=>{if(!active(j))fail(409,'报告执行租约已失效，须人工核对');fn(j);});
 async function recoverExpired(uid,id){let j=own(store.read(),uid,id);if(['reserving','generating'].includes(j.status)&&j.leaseUntil<=clock()){j=update(uid,id,x=>{if(['reserving','generating'].includes(x.status)&&x.leaseUntil<=clock()){x.status='manual_review';x.failureCode='expired_execution_lease';}});if(!j.reservationId&&typeof billing.reservationByKey==='function'){const r=await billing.reservationByKey(uid,'report_'+j.id);if(r)j=update(uid,id,x=>{x.reservationId=r.id;});}}return j;}
 async function finalize(uid,id){const j=own(store.read(),uid,id);if(j.status!=='result_saved')return view(j);try{await billing.settle(uid,j.reservationId,'commit');return view(update(uid,id,x=>{x.status='delivered';}));}catch(e){return view(update(uid,id,x=>{x.status=e.status===409?'manual_review':'result_saved';x.failureCode='settlement_review';}));}}
 return {
  async create(uid,{idempotencyKey,input,consentRetainReport=false}={}){XB.check(store,uid);
   if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
   if(!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey||''))fail(400,'报告幂等键无效');
   if(consentRetainReport!==true)fail(400,'请明确同意保存本人报告结果及必要任务记录');
   if(!input||!['male','female'].includes(input.gender)||input.birthHour===undefined||input.birthHour===null||input.birthHour===''||!Number.isInteger(Number(input.birthHour))||Number(input.birthHour)<0||Number(input.birthHour)>23)fail(400,'完整报告需要本人确认性别和完整出生时辰');
   const inputHash=crypto.createHmac('sha256',inputHashKey).update(canonical({version:1,input})).digest('hex');
   let claimed=false;
   const job=store.transaction(s=>{const a=jobs(s),old=a.find(j=>j.userId===uid&&j.key===idempotencyKey);if(old){if(old.inputHash!==inputHash)fail(409,'该幂等键已用于另一份出生资料');return structuredClone(old);}const now=new Date(clock()).toISOString(),j={id:crypto.randomUUID(),userId:uid,key:idempotencyKey,inputHash,status:'reserving',bootId,leaseUntil:clock()+leaseMs,consentVersion:'report-retention-v1',consentedAt:now,createdAt:now,updatedAt:now};a.push(j);claimed=true;return structuredClone(j);});
   if(!claimed){if(job.status==='result_saved')return finalize(uid,job.id);return view(await recoverExpired(uid,job.id));}
   let reservation;
   const heartbeat=setInterval(()=>{try{writeOwned(uid,job.id,j=>{j.leaseUntil=clock()+leaseMs;});}catch(_){}},heartbeatMs);heartbeat.unref?.();
   try{
    // Validation/normalization runs before consuming a credit. Birth input is memory only.
    const verified=await verifyChart(input,uid);
    if(!verified||typeof verified.chartBlock!=='string'||!verified.chartBlock.trim())throw Error('排盘验证失败');
    reservation=await billing.reserve(uid,'report',1,'report_'+job.id);
    if(reservation.status!=='reserved')throw Error('服务次数预扣状态异常');
    writeOwned(uid,job.id,j=>{j.reservationId=reservation.id;j.status='generating';});
    const result=await generate(verified.input||input,{chartBlock:verified.chartBlock});
    if(!result||result.tier!=='full'||result.locked!==false||typeof result.reading!=='string'||!result.reading.trim())throw Error('完整报告结果无效');
    if(validateResult&&validateResult(result)!==true)throw Error('报告完整性验证失败');
    // The production store must encrypt this collection at rest, including backups.
    writeOwned(uid,job.id,j=>{j.result={reading:result.reading,tier:'full',locked:false,source:result.source||'runae-bazi-full-v1'};j.status='result_saved';});
   }catch(e){
    clearInterval(heartbeat);
    // Never release a saved result: it can safely resume settlement without another model call.
    const latest=own(store.read(),uid,job.id);if(latest.status==='result_saved')return finalize(uid,job.id);if(!active(latest))return view(await recoverExpired(uid,job.id));
    let released=!reservation;
    if(reservation){try{await billing.settle(uid,reservation.id,'release');released=true;}catch(_){released=false;}}
    writeOwned(uid,job.id,j=>{j.status=released?'failed':'manual_review';j.failureCode=released?'generation_failed':'release_review';});
    if(e.status)throw e;
    return view(own(store.read(),uid,job.id));
   }
   clearInterval(heartbeat);return finalize(uid,job.id);
  },
  async get(uid,id){const j=own(store.read(),uid,id);if(j.status==='result_saved')return finalize(uid,id);return view(await recoverExpired(uid,id));},
  list(uid){return jobs(store.read()).filter(j=>j.userId===uid).map(view);}
 };
}
module.exports={createFriendsReportsService,reportView};
