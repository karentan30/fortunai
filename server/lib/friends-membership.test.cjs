'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createBillingService,CATALOG}=require('./friends-billing');
const {createFriendsStore}=require('./friends-store');
const {anniversary}=require('./friends-membership');
const {createFriendsQuotas}=require('./friends-quotas');
function fixture({pilotCatalog=true,benefitsVerified=true}={}){
 const store=createFriendsStore();let now=Date.parse('2026-01-31T12:00:00Z');
 const registrations=Object.fromEntries(Object.values(CATALOG).map(p=>[p.sku,{verified:true,benefitsVerified,amountMinor:p.amountMinor,currency:p.currency,product:p.sku,channels:['stripe']}]));
 const billing=createBillingService(store,{enabled:true,merchantVerified:true,merchantName:'Capstone IQ',callbackV2Verified:true,pilotCatalog,registrations,clock:()=>now,adapter:{ready:true,projectId:'test',verify:()=>true,create:async o=>({hubOrderId:'H-'+o.id,amountMinor:o.amountMinor,currency:o.currency,channel:o.channel,checkout:{url:'https://checkout.stripe.com/c/pay/'+o.id}})}});
 const checkout=sku=>billing.checkout('a',{sku,channel:'stripe',idempotencyKey:crypto.randomUUID()});
 const notify=(id,status='paid')=>{const o=store.read().billingOrders.find(x=>x.id===id);return billing.callback(Buffer.from(JSON.stringify({project_id:'test',out_ref:o.id,order_no:o.hubOrderId,method:o.channel,product:o.remoteProduct,currency:o.currency,amount:o.amountMinor/100,status,timestamp:Math.floor(now/1000),nonce:crypto.randomUUID(),event_id:crypto.randomUUID()})),'test');};
 return {billing,store,checkout,notify,setNow:n=>now=n,quota:()=>createFriendsQuotas({clock:()=>now}).status(store.read(),'a')};
}
test('pilot products hidden and unsellable by default; benefits must be verified',async()=>{
 const f=fixture({pilotCatalog:false});assert.equal(f.billing.catalog().products.length,2);
 await assert.rejects(f.checkout('friends_month_v1'),{status:400});
 const g=fixture({benefitsVerified:false});await assert.rejects(g.checkout('friends_year_v1'),{status:400});
});
test('annual membership grants only two in current month, never 24, repeated paid and reads do not duplicate',async()=>{
 const f=fixture(),o=await f.checkout('friends_year_v1');f.notify(o.id);f.notify(o.id);
 assert.equal(f.billing.balance('a').units.pair_report,2);assert.equal(f.billing.balance('a').units.report,0);
 assert.equal(f.quota().tier,'member');
 const reservation=f.billing.reserve('a','pair_report',1,'first_report_01');assert.equal(f.billing.balance('a').units.pair_report,1);
 f.setNow(Date.parse('2026-02-28T12:00:00Z'));assert.equal(f.billing.balance('a').units.pair_report,2);
 f.billing.settle('a',reservation.id,'release');assert.equal(f.billing.balance('a').units.pair_report,2);
 assert.equal(f.billing.balance('a').units.pair_report,2);
 assert.equal(f.store.read().creditLedger.filter(e=>e.type==='monthly_grant').length,2);
 f.setNow(Date.parse('2026-05-31T12:00:00Z'));assert.equal(f.billing.balance('a').units.pair_report,2);
 assert.equal(f.store.read().creditLedger.filter(e=>e.type==='monthly_grant').length,3);
 f.setNow(Date.parse('2027-01-31T12:00:00Z'));assert.equal(f.billing.balance('a').units.pair_report,0);assert.equal(f.quota().tier,'free');
});
test('refund revokes membership and in-flight credits without resurrection',async()=>{
 const f=fixture(),o=await f.checkout('friends_month_v1');f.notify(o.id);
 const r=f.billing.reserve('a','pair_report',1,'pending_report_01');f.notify(o.id,'refunded');
 assert.equal(f.billing.balance('a').units.pair_report,0);assert.equal(f.quota().tier,'free');
 assert.throws(()=>f.billing.settle('a',r.id,'commit'),{status:409});
 f.billing.settle('a',r.id,'release');assert.equal(f.billing.balance('a').units.pair_report,0);
});
test('single pair report and legacy personal/year credits cannot grant matching privileges or cross-spend',async()=>{
 const f=fixture();
 for(const sku of ['friends_pair_report_v1','friends_report_199','friends_year_399']){const o=await f.checkout(sku);f.notify(o.id);}
 assert.equal(f.quota().tier,'free');assert.deepEqual(f.billing.balance('a').units,{report:2,pair_report:1});
 f.billing.reserve('a','pair_report',1,'pair_reserve_001');assert.throws(()=>f.billing.reserve('a','pair_report',1,'pair_reserve_002'),{status:402});
 assert.equal(f.billing.balance('a').units.report,2);
});
test('calendar anniversaries clamp without drifting and monthly access ends at next anniversary',async()=>{
 assert.equal(new Date(anniversary('2026-01-31T12:00:00Z',1)).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(new Date(anniversary('2026-01-31T12:00:00Z',2)).toISOString(),'2026-03-31T12:00:00.000Z');
 const f=fixture(),o=await f.checkout('friends_month_v1');f.notify(o.id);f.setNow(Date.parse('2026-02-28T12:00:00Z'));assert.equal(f.billing.balance('a').units.pair_report,0);assert.equal(f.quota().tier,'free');
});

test('existing or unresolved membership prevents duplicate charges with a new key',async()=>{
 const f=fixture(),o=await f.checkout('friends_month_v1');
 await assert.rejects(f.checkout('friends_year_v1'),{status:409});assert.equal(f.store.read().billingOrders.length,1);
 f.notify(o.id);await assert.rejects(f.checkout('friends_year_v1'),{status:409});
 f.setNow(Date.parse('2026-02-28T12:00:00Z'));const renewal=await f.checkout('friends_year_v1');assert.equal(renewal.status,'pending');
});
