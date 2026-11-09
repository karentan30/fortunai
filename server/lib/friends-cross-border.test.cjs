'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service'),{createCompatibilityService}=require('./friends-compatibility'),{searchCities}=require('./friends-location'),{CROSS_BORDER_VERSION}=require('./friends-chart');
const data={credential:'test',consent:true,crossBorderConsent:true,nickname:'测试',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'职员',income:'暂不提供',assets:'暂不提供'},hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],listed:true};
const setup=()=>{const store=createFriendsStore();return {store,service:createFriendsService(store,{verify:()=>({age:30,dayMaster:'戊',zodiac:'羊'})})};};
test('profile save without separate cross-border consent is 400 and stores nothing',()=>{
 const {store,service}=setup();
 for(const v of [undefined,false,'true',1])assert.throws(()=>service.save('a',{...data,crossBorderConsent:v}),e=>e.status===400&&/香港服务器/.test(e.message));
 assert.equal(store.read().profiles.length,0);
});
test('profile save with cross-border consent stores version and keeps first consent time while version is unchanged',()=>{
 const {store,service}=setup();
 service.save('a',data);const first=store.read().profiles[0];
 assert.equal(first.crossBorderConsentVersion,CROSS_BORDER_VERSION);assert.equal(CROSS_BORDER_VERSION,'xb-2026-11-09');assert.ok(!Number.isNaN(Date.parse(first.crossBorderConsentAt)));
 store.transaction(s=>{s.profiles[0].crossBorderConsentAt='2026-11-09T00:00:00.000Z';});
 service.save('a',{...data,nickname:'改名'});assert.equal(store.read().profiles[0].crossBorderConsentAt,'2026-11-09T00:00:00.000Z');
 assert.throws(()=>service.save('a',{...data,crossBorderConsent:false}),{status:400});
 store.transaction(s=>{s.profiles[0].crossBorderConsentVersion='xb-old';});
 service.save('a',data);const renewed=store.read().profiles[0];assert.equal(renewed.crossBorderConsentVersion,CROSS_BORDER_VERSION);assert.notEqual(renewed.crossBorderConsentAt,'2026-11-09T00:00:00.000Z');
});
test('birth authorization without separate cross-border consent is 400; with it the record carries the version',async()=>{
 const store=createFriendsStore();store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'A',listed:true},{userId:'b',shareId:'card-b',nickname:'B',listed:true}];});
 const service=createCompatibilityService({store,clock:()=>Date.parse('2026-11-09T12:00:00Z')}),p=service.create('a',{targetShareId:'card-b'});
 const input={birthday:'1991-08-28',calendar:'lunar',cityId:searchCities('长春')[0].id,time:'06:00'},body={version:'compatibility-guide-v3',consent:true,input};
 for(const v of [undefined,false,'true'])await assert.rejects(service.authorize('a',p.id,{...body,crossBorderConsent:v}),e=>e.status===400&&/香港服务器/.test(e.message));
 assert.equal(store.read().compatibilityPairs[0].authorizations.a,undefined);
 await service.authorize('a',p.id,{...body,crossBorderConsent:true});const auth=store.read().compatibilityPairs[0].authorizations.a;
 assert.equal(auth.crossBorderConsentVersion,CROSS_BORDER_VERSION);assert.equal(auth.crossBorderConsentAt,'2026-11-09T12:00:00.000Z');
});
