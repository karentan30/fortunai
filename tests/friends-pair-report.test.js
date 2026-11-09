'use strict';
// Two-person report pipeline: no real model or payment calls. LLM is a fake; billing is the real
// ledger (createBillingService) on an in-memory or encrypted SQLite store with seeded credits.
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createFriendsStore}=require('../server/lib/friends-store');
const {createCompatibilityService}=require('../server/lib/friends-compatibility');
const {createFriendsQuestionsService}=require('../server/lib/friends-questions');
const {createBillingService}=require('../server/lib/friends-billing');
const {searchCities}=require('../server/lib/friends-location');
const {createPairReportsService}=require('../server/lib/friends-pair-reports');
const {createPairReportAdapter,validatePairReport,buildPairFacts,buildPairMessages,collectForbiddenStrings}=require('../server/lib/friends-pair-report-adapter');
const bank=require('../assets/data/friends-relationship-questions.json');

const input={birthday:'1991-08-28',calendar:'lunar',cityId:searchCities('长春')[0].id,time:'06:00'};
const inputB={...input,birthday:'1990-01-01',calendar:'solar'};
const BINDING_KEY='test-binding-key-never-production-0123456789';
const item=(text,source,factRef)=>({text,source,factRef});
function goodOutput(over={}){return {
 summary:[item('你们的传统文化线索里有相生意象，可以作为聊天开场。','传统文化线索','t_day')],
 traditionalBasis:[item('相处与表达话题：邀请方与受邀方的日干呈五行关系线索。','传统文化线索','t_day')],
 complementPoints:[{text:'一方说话节奏快一方慢，可能互相补位。','source':'待确认',factRef:null,howToVerify:'约一次散步，观察谁先提议、谁来收尾。'}],
 consensus:[],
 differences:[item('对本次了解目的的看法还需要另一方确认。','待确认','p_peer_view')],
 questions:[item('你理想中周末是怎样度过的？','待确认',null),item('遇到分歧时你希望怎样暂停？','待确认',null),item('你最近在认真投入的一件事是什么？','待确认',null)],
 activities:[item('一起去逛一次本地的书店。','待确认',null),item('约一次城市徒步散步。','待确认',null),item('一起做一顿简单的晚饭。','待确认',null)],
 nextSteps:[item('先各自说说本次了解目的，再决定是否见面。','本人填写','s_purpose')],
 ...over};}

function fixture({generate,enabled=true,store=require('../server/lib/friends-cross-border').grant(createFriendsStore(),'a','b','c','owner','recipient','third','new-owner','new-recipient','another-recipient','new-visitor','viewer','real-minor','real-adult','outside',1,2,3),seed=true,billingWrap}={}){
 let now=Date.parse('2026-11-04T12:00:00Z');const clock=()=>now;
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'A',listed:true},{userId:'b',shareId:'card-b',nickname:'B',listed:true}];});
 const questions=createFriendsQuestionsService({store,clock});
 const compatibility=createCompatibilityService({store,questionnaireService:questions,questionBank:bank,clock});
 const realBilling=createBillingService(store,{clock});
 const counts={reserve:0,commit:0,release:0,llm:0};
 const billing={reserve:async(...a)=>{counts.reserve++;return realBilling.reserve(...a);},settle:async(u,id,out)=>{counts[out]++;return realBilling.settle(u,id,out);},reservationByKey:(...a)=>realBilling.reservationByKey(...a),balance:u=>realBilling.balance(u),...(billingWrap||{})};
 const prompts=[];
 const llm=generate||(async()=>JSON.stringify(goodOutput()));
 const adapter=createPairReportAdapter({generate:async(messages,opts)=>{counts.llm++;prompts.push(messages);return llm(messages,opts);}});
 const options={store,billing,compatibility,adapter,questionnaireService:questions,questionBank:bank,bindingKey:BINDING_KEY,enabled,clock};
 const service=createPairReportsService(options);
 const seedCredit=(uid,unit,n=1)=>store.transaction(s=>{for(const k of ['billingOrders','creditLedger'])s[k]=s[k]||[];const id='RF-'+crypto.randomUUID();s.billingOrders.push({id,userId:uid,sku:unit==='report'?'friends_report_199':'friends_pair_report_v1',status:'paid',amountMinor:unit==='report'?19900:2990,currency:'CNY',channel:'wechat',createdAt:new Date(now).toISOString(),paidAt:new Date(now).toISOString()});s.creditLedger.push({id:crypto.randomUUID(),orderId:id,userId:uid,unit,delta:n,type:'grant',createdAt:new Date(now).toISOString()});});
 if(seed)seedCredit('a','pair_report',1);
 async function readyPair(extra={}){const p=compatibility.create('a',{targetShareId:'card-b'});await compatibility.authorize('a',p.id,{version:'compatibility-guide-v3',consent:true,crossBorderConsent:true,input,...extra});await compatibility.authorize('b',p.id,{version:'compatibility-guide-v3',consent:true,crossBorderConsent:true,input:inputB,...extra});return p;}
 const body=(pairId,key='pair-key-0001')=>({pairId,idempotencyKey:key,purpose:'dating',stage:'chatting',consentRetainReport:true});
 return {store,questions,compatibility,billing:realBilling,counts,prompts,service,options,seedCredit,readyPair,body,setNow:v=>now=v,now:clock};
}

test('delivers once, same key and same request are idempotent, both sides read, third party 404',async()=>{
 const f=fixture(),p=await f.readyPair();
 const r=await f.service.create('a',f.body(p.id));
 assert.equal(r.status,'delivered');
 assert.deepEqual(Object.keys(r.report.sections),['summary','traditionalBasis','complementPoints','consensus','differences','questions','activities','nextSteps']);
 assert.deepEqual(r.consent.map(c=>[c.role,c.consentVersion]),[['inviter','compatibility-guide-v3'],['invitee','compatibility-guide-v3']]);
 assert.equal((await f.service.create('a',f.body(p.id))).reportId,r.reportId);
 // A new key for the identical request under the same consent snapshot must not charge again.
 assert.equal((await f.service.create('a',f.body(p.id,'pair-key-0002'))).reportId,r.reportId);
 assert.deepEqual([f.counts.reserve,f.counts.commit,f.counts.release,f.counts.llm],[1,1,0,1]);
 assert.equal(f.billing.balance('a').units.pair_report,0);
 assert.equal((await f.service.get('b',r.reportId)).status,'delivered');
 await assert.rejects(f.service.get('third',r.reportId),{status:404});
 await assert.rejects(f.service.create('a',{...f.body(p.id),stage:'dating'}),{status:409});
 assert.equal(f.service.list('b')[0].report,undefined);
});

test('model prompt and stored job never carry pillars or raw birth input',async()=>{
 const f=fixture(),p=await f.readyPair();
 await f.service.create('a',f.body(p.id));
 const pair=f.store.read().compatibilityPairs[0],pillars=Object.values(pair.authorizations.a.chart.pillars).concat(Object.values(pair.authorizations.b.chart.pillars));
 const prompt=JSON.stringify(f.prompts),job=JSON.stringify(f.store.read().pairReportJobs);
 for(const v of [...pillars,'1991','1990-01-01','08-28',input.cityId,'06:00'])for(const text of [prompt,job])assert.ok(!text.includes(v),'leaked '+v);
 assert.match(prompt,/不要输出任何天干地支组合/);
});

test('generation failure releases once; retry with a new key consumes exactly one credit',async()=>{
 let fail=true;
 const f=fixture({generate:async()=>{if(fail)throw Error('provider offline');return JSON.stringify(goodOutput());}}),p=await f.readyPair();
 const r=await f.service.create('a',f.body(p.id));
 assert.equal(r.status,'failed');
 assert.equal(f.counts.llm,2,'adapter retries once internally');
 assert.deepEqual([f.counts.reserve,f.counts.release,f.counts.commit],[1,1,0]);
 assert.equal(f.billing.balance('a').units.pair_report,1);
 assert.equal((await f.service.create('a',f.body(p.id))).status,'failed','same key replays failed record without another call');
 assert.equal(f.counts.llm,2);
 fail=false;
 await assert.rejects(f.service.retry('a',r.reportId,{idempotencyKey:f.body(p.id).idempotencyKey,consentRetainReport:true}),{status:409});
 await assert.rejects(f.service.retry('b',r.reportId,{idempotencyKey:'pair-key-retry',consentRetainReport:true}),{status:403});
 const again=await f.service.retry('a',r.reportId,{idempotencyKey:'pair-key-retry',consentRetainReport:true});
 assert.equal(again.status,'delivered');
 assert.deepEqual([f.counts.reserve,f.counts.release,f.counts.commit],[2,1,1]);
 assert.equal(f.billing.balance('a').units.pair_report,0);
});

test('invalid model output is retried; still invalid fails and releases',async()=>{
 let n=0;
 const f=fixture({generate:async()=>++n===1?JSON.stringify(goodOutput({summary:[item('你们的合盘匹配度是92%，注定在一起。','传统文化线索','t_day')]})):JSON.stringify(goodOutput())}),p=await f.readyPair();
 assert.equal((await f.service.create('a',f.body(p.id))).status,'delivered');
 assert.equal(f.counts.llm,2);
 const g=fixture({generate:async()=>'not json'}),q=await g.readyPair();
 assert.equal((await g.service.create('a',g.body(q.id))).status,'failed');
 assert.equal(g.store.read().pairReportJobs[0].failureCode,'validation_failed');
 assert.deepEqual([g.counts.release,g.counts.commit],[1,0]);
});

test('revoke, decline, expiry or re-authorization cut access and purge the saved report',async()=>{
 for(const action of ['revoke','decline','expire','reauthorize']){
  const f=fixture(),p=await f.readyPair();
  const r=await f.service.create('a',f.body(p.id));assert.equal(r.status,'delivered');
  if(action==='revoke')f.compatibility.revoke('b',p.id);
  else if(action==='decline')f.compatibility.decline('b',p.id);
  else if(action==='expire')f.setNow(f.now()+8*86400000);
  else await f.compatibility.authorize('b',p.id,{version:'compatibility-guide-v3',consent:true,crossBorderConsent:true,input:{...inputB,birthday:'1992-03-03'}});
  for(const uid of ['a','b']){const v=await f.service.get(uid,r.reportId);assert.equal(v.status,'access_revoked',action);assert.equal(v.report,undefined);}
  assert.equal(f.store.read().pairReportJobs[0].result,undefined,action+' purged');
  assert.equal(f.counts.release,0,'delivered credit is not silently refunded');
 }
});

test('sweep purges delivered results after revoke without any read',async()=>{
 const f=fixture(),p=await f.readyPair();await f.service.create('a',f.body(p.id));
 f.compatibility.revoke('a',p.id);
 assert.deepEqual(f.service.sweep(),{purged:1});
 assert.equal(f.store.read().pairReportJobs[0].result,undefined);
});

test('revoke during generation: nothing delivered and the credit is released',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const f=fixture({generate:async()=>{await gate;return JSON.stringify(goodOutput());}}),p=await f.readyPair();
 const pending=f.service.create('a',f.body(p.id));
 await new Promise(r=>setTimeout(r,10));
 f.compatibility.revoke('b',p.id);release();
 const r=await pending;
 assert.equal(r.status,'cancelled_consent_changed');assert.equal(r.report,undefined);
 assert.deepEqual([f.counts.release,f.counts.commit],[1,0]);
 assert.equal(f.billing.balance('a').units.pair_report,1);
});

test('separate from single-person entitlement: report credit is never consumed by a pair report',async()=>{
 const f=fixture({seed:false}),p=await f.readyPair();
 f.seedCredit('a','report',1);
 await assert.rejects(f.service.create('a',f.body(p.id)),{status:402});
 assert.equal(f.counts.llm,0,'no model call without a pair_report credit');
 assert.deepEqual(f.billing.balance('a').units,{report:1,pair_report:0});
 f.seedCredit('a','pair_report',1);
 assert.equal((await f.service.create('a',f.body(p.id,'pair-key-0009'))).status,'delivered');
 assert.deepEqual(f.billing.balance('a').units,{report:1,pair_report:0});
 assert.ok(f.store.read().creditReservations.every(r=>r.unit==='pair_report'));
});

test('hard-closed by default; unauthorized pair or missing consent never reserves',async()=>{
 const closed=fixture({enabled:false}),cp=await closed.readyPair();
 await assert.rejects(closed.service.create('a',closed.body(cp.id)),{status:503});
 assert.throws(()=>createPairReportsService({...closed.options,bindingKey:'short'}));
 const f=fixture(),p=f.compatibility.create('a',{targetShareId:'card-b'});
 await f.compatibility.authorize('a',p.id,{version:'compatibility-guide-v3',consent:true,crossBorderConsent:true,input});
 await assert.rejects(f.service.create('a',f.body(p.id)),{status:409});
 await assert.rejects(f.service.create('third',f.body(p.id)),{status:404});
 await assert.rejects(f.service.create('a',{...f.body(p.id),consentRetainReport:false}),{status:400});
 await assert.rejects(f.service.create('a',{...f.body(p.id),purpose:'marry'}),{status:400});
 assert.equal(f.counts.reserve+closed.counts.reserve,0);
});

test('validator rejects leaks, fake scores, fate claims, invented facts and wrong shape',async()=>{
 const f=fixture(),p=await f.readyPair();
 const pair=f.store.read().compatibilityPairs[0],guide=await f.compatibility.report('a',p.id);
 const facts=buildPairFacts({pair,guide,purpose:'friendship',stage:'just_matched'});
 const forbiddenStrings=[...collectForbiddenStrings({pair}),'一起养猫的家'];
 assert.equal(validatePairReport(goodOutput(),facts,{forbiddenStrings}).ok,true);
 const day=pair.authorizations.a.chart.pillars.day;
 const bad=text=>goodOutput({summary:[item(text,'待确认',null)]});
 const cases=[
  ['邀请方日柱'+day+'，受邀方性格稳定。','forbidden:four_pillars'],
  ['邀请方生于1991年秋天，很有耐心。','forbidden:raw_birth_data'],
  ['你们大约在08:30前后容易沟通。','forbidden:raw_birth_data'],
  ['你们的关系契合度很高值得珍惜。','forbidden:fake_score'],
  ['综合来看你们可以打到90分以上。','forbidden:fake_score'],
  ['你们是命中注定的一对，放心吧。','forbidden:deterministic_fate'],
  ['受邀方在问卷里写了一起养猫的家。','forbidden:private_data']
 ];
 for(const [text,code]of cases){const r=validatePairReport(bad(text),facts,{forbiddenStrings});assert.equal(r.ok,false,text);assert.ok(r.errors.includes(code),text+' '+r.errors);}
 assert.equal(validatePairReport(bad('先问问自己未必想说出口的期待。'),facts,{forbiddenStrings}).ok,true,'自己未 is not a pillar');
 assert.ok(validatePairReport(goodOutput({summary:[item('双方问卷都偏好安静的周末活动。','本人填写','s_q99')]}),facts).errors.includes('fact_ref:summary[0]'));
 assert.ok(validatePairReport(goodOutput({traditionalBasis:[item('邀请方很会照顾人，适合恋爱。','本人填写','s_purpose')]}),facts).errors.includes('source_section:traditionalBasis[0]'));
 assert.ok(validatePairReport(goodOutput({questions:goodOutput().questions.slice(0,2)}),facts).errors.includes('section_count:questions'));
 assert.ok(validatePairReport({...goodOutput(),extra:[]},facts).errors.includes('section_keys'));
 assert.ok(validatePairReport(goodOutput({summary:[item('短','待确认',null)]}),facts).errors.includes('text_length:summary[0]'));
});

test('unshared questionnaire answers are not sent to the model; shared ones only as topic labels',async()=>{
 const f=fixture(),answers={};
 for(const q of bank.questions.filter(q=>q.topicId==='leisure'&&q.type==='single_choice'))answers[q.id]={selfAnswer:q.options[0].value,acceptablePartnerAnswers:[q.options[0].value],importance:'important'};
 const text=bank.questions.find(q=>q.type==='short_text');if(text)answers[text.id]={selfAnswer:'不想公开的私人经历文字',acceptablePartnerAnswers:null,importance:'unspecified'};
 for(const uid of ['a','b'])f.questions.save(uid,{version:bank.version,answers,consent:true});
 const p=await f.readyPair();
 await f.service.create('a',f.body(p.id));
 const firstPrompt=JSON.stringify(f.prompts[0]);
 assert.ok(!firstPrompt.includes('s_q'),'not authorized → no questionnaire facts');
 assert.ok(firstPrompt.includes('p_questionnaire'));
 const labels=bank.questions.filter(q=>answers[q.id]&&q.type==='single_choice').map(q=>q.options[0].label);
 const g=fixture();for(const uid of ['a','b'])g.questions.save(uid,{version:bank.version,answers,consent:true});
 const q=await g.readyPair({includeQuestionnaire:true});
 const r=await g.service.create('a',g.body(q.id));assert.equal(r.status,'delivered');
 const prompt=JSON.stringify(g.prompts[0]);
 assert.ok(prompt.includes('兴趣与休息'));
 for(const v of [...labels,'不想公开的私人经历文字'])assert.ok(!prompt.includes(v),'answer leaked '+v);
 assert.equal(g.store.read().pairReportJobs[0].usedQuestionnaire,true);
 // Editing the questionnaire after delivery invalidates the questionnaire stamp → access cut.
 g.questions.remove('b');
 assert.equal((await g.service.get('a',r.reportId)).status,'access_revoked');
});

test('persisted in encrypted SQLite; saved result settles after restart without another model call',async t=>{
 let sqlite;try{sqlite=require('../server/lib/friends-sqlite');require('node:sqlite');}catch(_){t.skip('node:sqlite unavailable');return;}
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pair-report-')),file=path.join(dir,'s.sqlite'),key=crypto.randomBytes(32).toString('hex');
 const store=require('../server/lib/friends-cross-border').grant(sqlite.createSqliteFriendsStore(file,{key}),'a','b','c','owner','recipient','third','new-owner','new-recipient','another-recipient','new-visitor','viewer','real-minor','real-adult','outside',1,2,3);
 try{
  const f=fixture({store}),p=await f.readyPair();
  const r=await f.service.create('a',f.body(p.id));assert.equal(r.status,'delivered');
  assert.ok(!fs.readFileSync(file).includes(Buffer.from('交流')),'report text not plaintext on disk');
  store.transaction(s=>{s.pairReportJobs[0].status='result_saved';const res=s.creditReservations.find(x=>x.unit==='pair_report');res.status='reserved';});
  const restarted=createPairReportsService(f.options);
  assert.equal((await restarted.get('a',r.reportId)).status,'delivered');
  assert.equal(f.counts.llm,1);
  store.transaction(s=>{Object.assign(s.pairReportJobs[0],{status:'generating',bootId:'old',leaseUntil:0});});
  assert.equal((await restarted.get('a',r.reportId)).status,'manual_review');
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('messages builder exposes only fact ids and labels',()=>{
 const facts={version:'pair-report-v1',detailLevel:'partial',traditional:[{id:'t_day',area:'相处与表达话题',stemRelation:'同五行',branchRelation:'同地支'}],selfReported:[{id:'s_purpose',text:'x'}],pending:[],usedQuestionnaire:false};
 const m=buildPairMessages(facts);assert.equal(m.length,2);assert.match(m[1].content,/t_day/);
});
