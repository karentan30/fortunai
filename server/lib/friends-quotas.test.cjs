'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsQuotas}=require('./friends-quotas');
const {createFriendsService}=require('./friends-service');
const {createFriendsStore}=require('./friends-store');
const cards=Array.from({length:30},(_,i)=>({shareId:'card'+i}));
test('browsing is unlimited for everyone; only 认识申请 are counted',()=>{
 const q=createFriendsQuotas({enabled:true}),s={};assert.equal(q.discover(s,1,cards).length,30);assert.equal(q.discover(s,1,cards).length,30);
 assert.equal(q.status(s,1).used.request,0);
});
test('China midnight resets; expiration/refund removes paid permissions without resetting usage',()=>{
 let now=Date.parse('2026-11-05T15:59:00Z');const q=createFriendsQuotas({enabled:true,clock:()=>now});
 const s={billingOrders:[{userId:1,matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:'2026-11-01T00:00:00Z',accessUntil:'2026-12-01T00:00:00Z'}]};
 for(let i=0;i<20;i++)q.request(s,1);
 assert.throws(()=>q.request(s,1),e=>e.status===429);
 s.billingOrders[0].status='refunded';assert.equal(q.status(s,1).tier,'free');assert.throws(()=>q.request(s,1),e=>e.status===429);
 now=Date.parse('2026-11-05T16:00:00Z');assert.equal(q.status(s,1).used.request,0);q.request(s,1);
 assert.equal(q.status(s,1).day,'2026-11-06');
 s.billingOrders[0].status='paid';s.billingOrders[0].accessUntil=new Date(now).toISOString();assert.equal(q.status(s,1).tier,'free');
});
test('free pilot does not consume quota or constrain discovery',()=>{
 const q=createFriendsQuotas(),s={};assert.equal(q.discover(s,1,cards).length,30);
 for(let i=0;i<100;i++)q.request(s,1);
 assert.equal(s.dailyQuotas,undefined);assert.equal(q.status(s,1).enabled,false);
});
test('service checks self, duplicate and blocked requests before quota and rollback preserves count',()=>{
 const store=createFriendsStore();store.transaction(s=>{s.profiles=Array.from({length:6},(_,i)=>({userId:i,shareId:'p'+i,listed:true}));});
 const svc=createFriendsService(store,null,{enabled:true});
 assert.throws(()=>svc.request(0,'p0'));assert.equal(svc.quota(0).used.request,0);
 svc.request(0,'p1');assert.throws(()=>svc.request(0,'p1'));assert.equal(svc.quota(0).used.request,1);
 svc.block(0,'p2');assert.throws(()=>svc.request(0,'p2'));assert.equal(svc.quota(0).used.request,1);
 svc.request(0,'p3');svc.request(0,'p4');assert.throws(()=>svc.request(0,'p5'),e=>e.status===429);
 assert.equal(store.read().requests.length,3);assert.equal(svc.quota(0).used.request,3);
});
test('invalid quota configurations fail instead of allowing accidental unlimited usage',()=>{
 assert.throws(()=>createFriendsQuotas({limits:{free:{request:0},member:{request:20}}}));
 assert.throws(()=>createFriendsQuotas({limits:{free:{request:3}}}));
});
