'use strict';
// 账号级出境同意：一条用户记录（版本+时间）；所有保存个人资料的相生写接口未同意→400+XS_CROSS_BORDER_CONSENT_REQUIRED，同意后放行；版本变化需重新同意。
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service'),{createCompatibilityService}=require('./friends-compatibility'),{searchCities}=require('./friends-location'),{CROSS_BORDER_VERSION}=require('./friends-chart');
const XB=require('./friends-cross-border');
const data={credential:'test',consent:true,nickname:'测试',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'职员',income:'暂不提供',assets:'暂不提供'},dateActivities:['羽毛球'],hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],listed:true};
const isXB=e=>e&&e.status===400&&e.code===XB.CODE&&e.version===CROSS_BORDER_VERSION&&/香港服务器/.test(e.message);
const setup=()=>{const store=createFriendsStore();return {store,service:createFriendsService(store,{verify:()=>({age:30,dayMaster:'戊',zodiac:'羊'})})};};
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'xb-'));
// Every personal-data write: [name, store=>call(uid)] — must be refused with the XB code before consent and pass the XB gate after.
const endpoints=()=>{const key=crypto.randomBytes(32).toString('hex');return [
 ['profile save',store=>uid=>createFriendsService(store,{verify:()=>({age:30,dayMaster:'戊',zodiac:'羊'})}).save(uid,data)],
 ['serious save',store=>uid=>createFriendsService(store,{verify:()=>({age:30})}).seriousSave(uid,{})],
 ['compatibility create',store=>uid=>createCompatibilityService({store}).create(uid,{targetShareId:'card-b'})],
 ['compatibility claim',store=>uid=>createCompatibilityService({store}).claim(uid,{inviteToken:'x'.repeat(43),consent:true,nickname:'本人'})],
 ['compatibility authorize',store=>uid=>{const c=createCompatibilityService({store});let id=store.read().compatibilityPairs?.[0]?.id;if(!id){store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'A',listed:true},{userId:'b',shareId:'card-b',nickname:'B',listed:true}];});XB.grant(store,'a');id=c.create('a',{targetShareId:'card-b'}).id;store.transaction(s=>{s.crossBorderConsents=[];});}return c.authorize(uid,id,{version:'compatibility-guide-v3',consent:true,input:{}});}],
 ['intake save',store=>uid=>require('./friends-intake').createFriendsIntakeService({store}).save(uid,{})],
 ['questions save',store=>uid=>require('./friends-questions').createFriendsQuestionsService({store}).save(uid,{})],
 ['questionnaire saveDimension',store=>uid=>require('./friends-questionnaire').createFriendsQuestionnaireService({store}).saveDimension(uid,'values',{})],
 ['questionnaire setMatching',store=>uid=>require('./friends-questionnaire').createFriendsQuestionnaireService({store}).setMatching(uid,{})],
 ['questionnaire setShare',store=>uid=>require('./friends-questionnaire').createFriendsQuestionnaireService({store}).setShare(uid,'card-b',{})],
 ['serious photo',store=>uid=>require('./friends-serious').createSeriousMediaService({store,dir:tmp(),key}).addPhoto(uid,{data:''})],
 ['serious voice',store=>uid=>require('./friends-serious').createSeriousMediaService({store,dir:tmp(),key}).setVoice(uid,{data:''})],
 ['verification upload',store=>uid=>require('./friends-verification').createVerificationService({store,dir:tmp(),key}).upload(uid,{field:'x',name:'a.png',data:''})],
 ['verification video',store=>uid=>require('./friends-verification').createVerificationService({store,dir:tmp(),key}).uploadVideo(uid,{field:'x',name:'a.mp4',buf:Buffer.alloc(0)})],
 ['verification submit',store=>uid=>require('./friends-verification').createVerificationService({store,dir:tmp(),key}).submit(uid,{field:'x'})],
 ['personal report create',store=>uid=>require('./friends-reports').createFriendsReportsService({store,billing:{},verifyChart:()=>({}),generate:async()=>({}),inputHashKey:'k'.repeat(40)}).create(uid,{idempotencyKey:'xb_test_key_0001',input:{}})],
 ['billing checkout',store=>uid=>require('./friends-billing').createBillingService(store,{}).checkout(uid,{sku:'none',channel:'stripe',idempotencyKey:'xb_test_key_0001'})],
 ['membership checkout',store=>uid=>require('./friends-membership-sales').createMembershipSales(store,{}).checkout(uid,{sku:'none',channel:'x'})],
];};
const outcome=async fn=>{try{await fn();return null;}catch(e){return e;}};
for(const [name,make] of endpoints()){
 test(`${name}: no account consent → 400 ${XB.CODE}; after consent the gate passes`,async()=>{
  const store=createFriendsStore();if(name==='compatibility authorize')await outcome(()=>make(store)('a'));const before=JSON.stringify(store.read());
  const refused=await outcome(()=>make(store)('a'));assert.ok(isXB(refused),`${name} must refuse with ${XB.CODE}, got ${refused&&refused.message}`);
  assert.equal(JSON.stringify(store.read()),before,`${name} must not write before consent`);
  XB.grant(store,'a');const after=await outcome(()=>make(store)('a'));assert.ok(!after||after.code!==XB.CODE,`${name} still blocked after consent`);
  store.transaction(s=>{s.crossBorderConsents[0].version='xb-old';});assert.ok(isXB(await outcome(()=>make(store)('a'))),`${name} must re-require consent after a version change`);
  XB.grant(store,'a');store.transaction(s=>XB.withdraw(s,'a'));assert.ok(isXB(await outcome(()=>make(store)('a'))),`${name} must refuse after withdrawal`);
 });
}
test('profile save: field-level consent still accepted and writes the account record (version + time); later saves need no field',()=>{
 const {store,service}=setup();
 for(const v of [undefined,false,'true',1])assert.throws(()=>service.save('a',{...data,crossBorderConsent:v}),isXB);
 assert.equal(store.read().profiles.length,0);
 service.save('a',{...data,crossBorderConsent:true});const rec=XB.recordOf(store.read(),'a'),first=store.read().profiles[0];
 assert.equal(rec.version,CROSS_BORDER_VERSION);assert.equal(CROSS_BORDER_VERSION,'xb-2026-11-09');assert.ok(!Number.isNaN(Date.parse(rec.at)));
 assert.equal(first.crossBorderConsentVersion,rec.version);assert.equal(first.crossBorderConsentAt,rec.at);
 store.transaction(s=>{s.crossBorderConsents[0].at='2026-11-09T00:00:00.000Z';});
 service.save('a',{...data,nickname:'改名'});assert.equal(XB.recordOf(store.read(),'a').at,'2026-11-09T00:00:00.000Z','same version keeps first consent time');
 store.transaction(s=>{s.crossBorderConsents[0].version='xb-old';});
 assert.throws(()=>service.save('a',data),isXB);
 service.save('a',{...data,crossBorderConsent:true});assert.equal(XB.recordOf(store.read(),'a').version,CROSS_BORDER_VERSION);assert.notEqual(XB.recordOf(store.read(),'a').at,'2026-11-09T00:00:00.000Z');
});
test('profile delete keeps the account consent record; unauthenticated is 401 not the consent code',()=>{
 const store=XB.grant(createFriendsStore(),'a');assert.throws(()=>XB.check(store,null),{status:401});assert.throws(()=>XB.check(store,''),{status:401});
 assert.equal(XB.status(store.read(),'a').consented,true);assert.equal(XB.status(store.read(),'b').consented,false);
});
test('birth authorization: field consent writes account record; account consent alone also passes',async()=>{
 const store=createFriendsStore();store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'A',listed:true},{userId:'b',shareId:'card-b',nickname:'B',listed:true}];});XB.grant(store,'a');
 const service=createCompatibilityService({store,clock:()=>Date.parse('2026-11-09T12:00:00Z')}),p=service.create('a',{targetShareId:'card-b'});
 store.transaction(s=>{s.crossBorderConsents=[];});
 const input={birthday:'1991-08-28',calendar:'lunar',cityId:searchCities('长春')[0].id,time:'06:00'},body={version:'compatibility-guide-v3',consent:true,input};
 for(const v of [undefined,false,'true'])await assert.rejects(service.authorize('a',p.id,{...body,crossBorderConsent:v}),isXB);
 assert.equal(store.read().compatibilityPairs[0].authorizations.a,undefined);
 await service.authorize('a',p.id,{...body,crossBorderConsent:true});const auth=store.read().compatibilityPairs[0].authorizations.a;
 assert.equal(auth.crossBorderConsentVersion,CROSS_BORDER_VERSION);assert.equal(auth.crossBorderConsentAt,'2026-11-09T12:00:00.000Z');assert.equal(XB.recordOf(store.read(),'a').at,'2026-11-09T12:00:00.000Z');
});
test('route: consent endpoints and the error code reach the JSON body',async()=>{
 let express;try{express=require('express');}catch{express=require('../../.review/node_modules/express');}
 const {createRouter}=require('../routes/friends'),store=createFriendsStore(),app=express();app.use(express.json());
 app.use('/api/friends',createRouter({express,auth:(req,res,next)=>{const id=req.get('X-Test-User');if(!id)return res.status(401).json({error:'login'});req.user={id};next();},store,secret:crypto.randomBytes(32).toString('hex'),adminToken:'x'.repeat(40)}));
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),base=`http://127.0.0.1:${server.address().port}/api/friends`,headers={'Content-Type':'application/json','X-Runae-Friends':'1','X-Test-User':'u1'};
 try{
  assert.deepEqual(await (await fetch(base+'/cross-border-consent',{headers})).json(),{version:CROSS_BORDER_VERSION,consented:false,at:null});
  const blocked=await fetch(base+'/profile',{method:'POST',headers,body:JSON.stringify(data)});assert.equal(blocked.status,400);const body=await blocked.json();assert.equal(body.code,XB.CODE);assert.equal(body.version,CROSS_BORDER_VERSION);
  for(const bad of [{},{consent:true},{consent:'true',version:CROSS_BORDER_VERSION},{consent:true,version:'xb-old'}]){const r=await fetch(base+'/cross-border-consent',{method:'POST',headers,body:JSON.stringify(bad)});assert.equal(r.status,400);assert.equal((await r.json()).code,XB.CODE);}
  const ok=await fetch(base+'/cross-border-consent',{method:'POST',headers,body:JSON.stringify({consent:true,version:CROSS_BORDER_VERSION})});assert.equal(ok.status,200);const st=await ok.json();assert.equal(st.consented,true);assert.ok(Date.parse(st.at));
  assert.equal((await fetch(base+'/cross-border-consent',{headers:{...headers,'X-Test-User':'u2'}}).then(r=>r.json())).consented,false,'consent is per account');
  const del=await fetch(base+'/cross-border-consent',{method:'DELETE',headers,body:'{}'});const dj=await del.json();assert.equal(dj.consented,false,JSON.stringify([del.status,dj]));
 }finally{server.close();}
});
