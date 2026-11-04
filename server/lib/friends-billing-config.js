'use strict';
const path=require('node:path');
const {createBillingService,createHubAdapter}=require('./friends-billing');
function configuredBilling(store,{env=process.env,load=require}={}){
 const closed=()=>createBillingService(store);
 if(env.FRIENDS_BILLING_ENABLED!=='true')return closed();
 try{
  if(env.FRIENDS_BILLING_MERCHANT_VERIFIED!=='true'||env.FRIENDS_BILLING_FRESH_PULL_VERIFIED!=='true'||env.FRIENDS_REPORT_DELIVERY_VERIFIED!=='true'||env.FRIENDS_REPORTS_ENABLED!=='true')return closed();
  const registrations=JSON.parse(env.FRIENDS_BILLING_PRODUCTS||'{}');
  if(!registrations||Array.isArray(registrations)||typeof registrations!=='object')return closed();
  const client=load(env.HUB_CLIENT_PATH||path.resolve(__dirname,'../../../shared/pay-hub-client.js'));
  return createBillingService(store,{enabled:true,salesPaused:env.FRIENDS_BILLING_SALES_PAUSED==='true',merchantVerified:true,merchantName:env.FRIENDS_BILLING_MERCHANT_NAME||'',freshPullVerified:true,adapter:createHubAdapter(client),registrations});
 }catch(_){return closed();}
}
module.exports={configuredBilling};
