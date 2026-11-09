'use strict';
// No gateway/model requests: only the shared Hub client's network methods and model text are stubbed.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createSqliteFriendsStore}=require('../server/lib/friends-sqlite');
const {createBillingService,createHubAdapter}=require('../server/lib/friends-billing');
const {createFriendsReportsService}=require('../server/lib/friends-reports');
const {createFriendsReportAdapter,TITLES}=require('../server/lib/friends-report-adapter');
const {searchCities}=require('../server/lib/friends-location');

test('encrypted SQLite purchase -> fresh paid grant -> original report delivery -> restart and failure refund',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'runae-report-integration-'));
 const file=path.join(directory,'friends.sqlite'),key=crypto.randomBytes(32).toString('hex');
 let store=require('../server/lib/friends-cross-border').grant(createSqliteFriendsStore(file,{key}),'integration-user-one');
 const remote=new Map();let sequence=0,statusCalls=0,modelCalls=0,failModel=false;
 const now=Date.parse('2026-11-04T12:00:00Z'),clock=()=>now;
 const client={HUB_BASE:'https://hub.example.test',HUB_SECRET:'(configured)',PROJECT_ID:'test-friends-project',
  async create(method,product,amount,outRef){const order_no='test-hub-'+(++sequence);remote.set(order_no,{ok:true,order_no,out_ref:outRef,amount,currency:'cny',status:'pending',method,product});return {ok:true,order_no,amount,method,code_url:'weixin://test-only-no-real-payment'};},
  async status(id){statusCalls++;const r=remote.get(id);assert.ok(r,'fake network knows Hub order');return structuredClone(r);},
  verifyCallback(){return false;}
 };
 const billingOptions={adapter:createHubAdapter(client),enabled:true,merchantVerified:true,merchantName:'Capstone IQ',freshPullVerified:true,clock,registrations:{friends_report_199:{verified:true,amountMinor:19900,currency:'CNY',product:'test-friends-report',channels:['wechat']}}};
 let billing=createBillingService(store,billingOptions);
 const uid='integration-user-one',other='integration-user-two';
 const input={birthYear:1991,birthMonth:8,birthDay:28,birthHour:6,birthMinute:15,calendar:'lunar',gender:'female',cityId:searchCities('北京')[0].id};
 const body=TITLES.map((title,i)=>`${i+1}. ${title}\n${'这是集成测试专用正文，传统文化解释并不代表事实预测，仅提供一般自我反思与生活建议。'.repeat(3)}。`).join('\n');
 const adapter=createFriendsReportAdapter({clock:()=>new Date(now),generate:async(messages,options)=>{modelCalls++;assert.equal(options.maxTokens,16384);assert.match(messages[1].content,/出生时间：1991年10月5日/);assert.match(messages[1].content,/藏干/);assert.match(messages[0].content,/最高优先级限制/);if(failModel)throw Error('stubbed model outage');return body;}});
 const serviceOptions={...adapter,inputHashKey:crypto.randomBytes(32).toString('hex'),clock};
 let reports=createFriendsReportsService({store,billing,...serviceOptions});
 try{
  const order=await billing.checkout(uid,{sku:'friends_report_199',channel:'wechat',idempotencyKey:'integration-checkout-01'});
  assert.equal(order.status,'pending');assert.equal(billing.balance(uid).units.report,0);
  assert.equal((await billing.refresh(uid,order.id)).status,'pending');assert.equal(billing.balance(uid).units.report,0);
  const remoteOrder=[...remote.values()].find(r=>r.out_ref===order.id);remoteOrder.status='paid';
  assert.equal((await billing.refresh(uid,order.id)).status,'paid');await billing.refresh(uid,order.id);
  assert.equal(billing.balance(uid).units.report,1);
  assert.equal(store.read().creditLedger.filter(e=>e.type==='grant').length,1);
  const request={idempotencyKey:'integration-report-01',input,consentRetainReport:true};
  const delivered=await reports.create(uid,request);
  assert.equal(delivered.status,'delivered');assert.equal(delivered.report.reading,body);assert.equal(modelCalls,1);
  assert.equal(billing.balance(uid).units.report,0);
  const persisted=store.read();assert.equal(persisted.personalReportJobs[0].status,'delivered');
  assert.equal(persisted.creditReservations[0].status,'committed');assert.equal(persisted.creditLedger.filter(e=>e.type==='reserve').length,1);
  assert.doesNotMatch(JSON.stringify(persisted.personalReportJobs),/birthYear|birthMonth|birthHour/);
  const bytes=Buffer.concat([fs.readFileSync(file),...(fs.existsSync(file+'-wal')?[fs.readFileSync(file+'-wal')]:[])]);
  assert.equal(bytes.includes(Buffer.from('这是集成测试专用正文')),false,'report body is encrypted at rest');
  store.close();store=createSqliteFriendsStore(file,{key,create:false});billing=createBillingService(store,billingOptions);
  reports=createFriendsReportsService({store,billing,...serviceOptions});
  assert.equal((await reports.create(uid,request)).reportId,delivered.reportId);assert.equal(modelCalls,1);
  await assert.rejects(reports.get(other,delivered.reportId),e=>e.status===404);
  const second=await billing.checkout(uid,{sku:'friends_report_199',channel:'wechat',idempotencyKey:'integration-checkout-02'});
  [...remote.values()].find(r=>r.out_ref===second.id).status='paid';await billing.refresh(uid,second.id);
  assert.equal(billing.balance(uid).units.report,1);failModel=true;
  const failed=await reports.create(uid,{...request,idempotencyKey:'integration-report-02'});
  assert.equal(failed.status,'failed');assert.equal(modelCalls,2);assert.equal(billing.balance(uid).units.report,1);
  assert.equal(store.read().creditReservations.filter(r=>r.status==='released').length,1);
  await reports.create(uid,{...request,idempotencyKey:'integration-report-02'});assert.equal(modelCalls,2);
  assert.ok(statusCalls>=6,'actual billing adapter verifies fresh network receipts');
  assert.equal(Object.keys(require.cache).some(p=>p.replace(/\\/g,'/').endsWith('/server/lib/store.js')),false,'legacy store and monthly/referral credits are never loaded');
 }finally{store.close();fs.rmSync(directory,{recursive:true,force:true});}
});
