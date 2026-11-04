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
