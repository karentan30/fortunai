'use strict';
// Offline on import. Running this CLI is a live read/reconciliation operation, never a charge.
const path=require('node:path');
const {getFriendsConfig}=require('../server/lib/friends-config');
const {createSqliteFriendsStore}=require('../server/lib/friends-sqlite');
const {configuredBilling}=require('../server/lib/friends-billing-config');
function parseArgs(args){const result={limit:25,pendingOnly:false};for(const arg of args){if(arg==='--pending-only'){result.pendingOnly=true;continue;}if(arg.startsWith('--limit=')){const raw=arg.slice(8);if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>100)throw Error('invalid_limit');result.limit=Number(raw);continue;}if(arg.startsWith('--env=')){const file=arg.slice(6);if(!path.isAbsolute(file))throw Error('absolute_env_required');result.env=file;continue;}throw Error('unsupported_argument');}return result;}
async function reconcileBatch({store,billing,limit=25,pendingOnly=false,clock=()=>Date.now()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('invalid_limit');
 if(typeof billing.reconciliationReady!=='function'||!billing.reconciliationReady())throw Error('billing_closed');
 const orders=store.read().billingOrders||[],eligible=orders.filter(o=>['pending',...(pendingOnly?[]:['paid'])].includes(o.status)&&typeof o.hubOrderId==='string'&&o.hubOrderId);
 eligible.sort((a,b)=>String(a.lastReconciledAt||a.createdAt||'').localeCompare(String(b.lastReconciledAt||b.createdAt||''))||String(a.id).localeCompare(String(b.id)));
 const selected=eligible.slice(0,limit),result={ok:true,selected:selected.length,checked:0,newlyPaid:0,paidConfirmed:0,pending:0,paymentReview:0,errors:0,skippedConcurrent:0,unresolvedCreate:orders.filter(o=>['creating','create_unknown'].includes(o.status)).length,existingManualReview:orders.filter(o=>o.status==='payment_review').length,unboundOrders:orders.filter(o=>['pending','paid'].includes(o.status)&&!o.hubOrderId).length,hasMore:eligible.length>selected.length};
 let consecutiveErrors=0;
 for(const candidate of selected){
  const latest=(store.read().billingOrders||[]).find(o=>o.id===candidate.id&&o.userId===candidate.userId);
  if(!latest||!['pending',...(pendingOnly?[]:['paid'])].includes(latest.status)||!latest.hubOrderId){result.skippedConcurrent++;continue;}
  try{const updated=await billing.refresh(latest.userId,latest.id);result.checked++;consecutiveErrors=0;if(updated.status==='paid'){result.paidConfirmed++;if(latest.status!=='paid')result.newlyPaid++;}else if(updated.status==='pending')result.pending++;else if(updated.status==='payment_review')result.paymentReview++;}
  catch(_){result.errors++;result.ok=false;consecutiveErrors++;}
  // Rotate even a failed/pending order so one old unpaid order cannot starve the queue.
  store.transaction(s=>{const o=(s.billingOrders||[]).find(o=>o.id===candidate.id&&o.userId===candidate.userId);if(o)o.lastReconciledAt=new Date(clock()).toISOString();});
  if(consecutiveErrors>=3){result.hasMore=true;break;}
 }
 return result;
}
async function main(args=process.argv.slice(2),{env=process.env,loadEnvFile=file=>process.loadEnvFile(file),openStore=createSqliteFriendsStore,configureBilling=configuredBilling,write=line=>console.log(line)}={}){
 const options=parseArgs(args);if(options.env)loadEnvFile(options.env);
 const config=getFriendsConfig(env);if(!config.enabled||!config.ok||env.FRIENDS_BILLING_ENABLED!=='true')throw Error('configuration_closed');
 const store=openStore(config.file,{key:env.FRIENDS_DATA_KEY,create:false});
 try{const billing=configureBilling(store,{env}),result=await reconcileBatch({store,billing,limit:options.limit,pendingOnly:options.pendingOnly});write(JSON.stringify(result));return result.ok?0:2;}finally{store.close();}
}
module.exports={parseArgs,reconcileBatch,main};
if(require.main===module)main().then(code=>{process.exitCode=code;}).catch(()=>{console.error(JSON.stringify({ok:false,error:'对账未执行或未完成，请检查受保护配置与数据库；未发起收款或退款'}));process.exitCode=1;});
