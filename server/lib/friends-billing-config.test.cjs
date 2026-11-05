'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {configuredBilling}=require('./friends-billing-config');
test('production billing config stays closed without verification and on missing shared client',()=>{
 let loads=0;const load=()=>{loads++;throw Error('private credential path must not leak');};
 assert.equal(configuredBilling(null,{env:{},load}).catalog().enabled,false);assert.equal(loads,0);
 const env={FRIENDS_BILLING_ENABLED:'true',FRIENDS_BILLING_MERCHANT_VERIFIED:'true',FRIENDS_BILLING_FRESH_PULL_VERIFIED:'true',FRIENDS_REPORT_DELIVERY_VERIFIED:'true',FRIENDS_REPORTS_ENABLED:'true',FRIENDS_BILLING_MERCHANT_NAME:'Capstone IQ'};
 assert.equal(configuredBilling(null,{env:{...env,FRIENDS_REPORT_DELIVERY_VERIFIED:'false'},load}).catalog().enabled,false);assert.equal(loads,0);
 assert.equal(configuredBilling(null,{env:{...env,FRIENDS_REPORTS_ENABLED:'false'},load}).catalog().enabled,false);assert.equal(loads,0);
 assert.equal(configuredBilling(null,{env:{...env,FRIENDS_BILLING_PRODUCTS:'broken'},load}).catalog().enabled,false);assert.equal(loads,0);
 assert.equal(configuredBilling(null,{env,load}).catalog().enabled,false);assert.equal(loads,1);
});
test('default Hub client resolves exactly like original payment route and explicit path wins',()=>{const path=require('node:path');const env={FRIENDS_BILLING_ENABLED:'true',FRIENDS_BILLING_MERCHANT_VERIFIED:'true',FRIENDS_BILLING_FRESH_PULL_VERIFIED:'true',FRIENDS_REPORT_DELIVERY_VERIFIED:'true',FRIENDS_REPORTS_ENABLED:'true'};let requested;const load=file=>{requested=file;return {};};configuredBilling(null,{env,load});assert.equal(requested,path.join(__dirname,'../routes/../../../shared/pay-hub-client.js'));const override=path.resolve(__dirname,'../../private/custom-hub.js');configuredBilling(null,{env:{...env,HUB_CLIENT_PATH:override},load});assert.equal(requested,override);});

test('production cannot activate unimplemented pair delivery through environment flags',()=>{
 const env={FRIENDS_BILLING_ENABLED:'true',FRIENDS_BILLING_MERCHANT_VERIFIED:'true',FRIENDS_BILLING_FRESH_PULL_VERIFIED:'true',FRIENDS_REPORT_DELIVERY_VERIFIED:'true',FRIENDS_REPORTS_ENABLED:'true',FRIENDS_BILLING_MERCHANT_NAME:'Capstone IQ',FRIENDS_BILLING_PRODUCTS:JSON.stringify({friends_month_v1:{verified:true,benefitsVerified:true,amountMinor:2990,currency:'CNY',product:'month-v1',channels:['stripe']}})};
 const load=()=>({HUB_BASE:'https://hub.example.test',HUB_SECRET:'(configured)',PROJECT_ID:'runae',create(){},status(){},verifyCallback(){}});
 const product=extra=>configuredBilling(null,{env:{...env,...extra},load}).catalog().products.find(p=>p.sku==='friends_month_v1');
 assert.equal(product({}),undefined);
 assert.equal(product({FRIENDS_PILOT_CATALOG_ENABLED:'true'}),undefined);
 assert.equal(product({FRIENDS_PAIR_REPORT_DELIVERY_VERIFIED:'true'}),undefined);
 assert.equal(product({FRIENDS_PILOT_CATALOG_ENABLED:'true',FRIENDS_PAIR_REPORT_DELIVERY_VERIFIED:'true'}),undefined);
 const service=configuredBilling(null,{env:{...env,FRIENDS_PILOT_CATALOG_ENABLED:'true',FRIENDS_PAIR_REPORT_DELIVERY_VERIFIED:'true'},load});
 return assert.rejects(service.checkout('a',{sku:'friends_month_v1',channel:'stripe',idempotencyKey:'must_not_sell_01'}),{status:400});
});
