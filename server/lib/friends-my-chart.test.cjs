'use strict';
// 我的命盘：只本人可见、不回传出生资料、免费/付费截断在服务端、付费默认关闭、金额只来自服务端、禁用词。
// 排盘用真实 friends-chart + 真实 Runae 完整报告引擎的 verifyChart；只把大模型生成换成假的。中台用假 fetch。
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createFriendsStore}=require('./friends-store'),XB=require('./friends-cross-border');
const {calculate}=require('./friends-chart');
const {searchCities}=require('./friends-location');
const {createFriendsReportAdapter,TITLES}=require('./friends-report-adapter');
const P=require('./friends-hepan-pay');
const {createMyChartService,elementCounts}=require('./friends-my-chart');
const {traitLines,DISCLAIMER,AI_LABEL}=require('./friends-my-chart-copy');
const {findForbidden,sanitize,FORBIDDEN}=require('./friends-copy-guard');

const HUB_SECRET='h'.repeat(48),PID='xiangsheng',HASH_KEY='k'.repeat(64);
const T0=Date.parse('2026-11-10T04:00:00Z');
const BJ=searchCities('北京')[0].id;
// 1995 年北京已无夏令时 → 在 Runae 引擎 UTC+8 支持范围内。
const BIRTH={birthYear:1995,birthMonth:3,birthDay:10,birthHour:10,birthMinute:30,calendar:'solar',cityId:BJ};
const FULL=calculate({birthday:'1995-03-10',calendar:'solar',hour:10,minute:30,cityId:BJ},new Date(T0));
const THREE=calculate({birthday:'1995-03-10',calendar:'solar',cityId:BJ},new Date(T0));
const sign=raw=>crypto.createHmac('sha256',HUB_SECRET).update(raw).digest('hex');
const READING=TITLES.map((t,i)=>`${i+1}. ${t}\n`+'这一章是测试用的正文，用来通过章节完整性校验，内容只写性格倾向与自我了解，不写结果。'.repeat(2)+(i===12?'这里故意写一个保证和 80% 的说法。':'')).join('\n')+'\n全文结束。';

function fakeHub(){
 const orders=new Map(),seen=[];let n=0;const json=(status,body)=>({ok:status<400,status,json:async()=>body});
 async function fetchImpl(url,init){
  const u=new URL(url);seen.push({path:u.pathname,init});
  if(u.pathname==='/hub/pay/create'){if(init.headers['X-Sign']!==sign(init.body))return json(403,{ok:false});const b=JSON.parse(init.body),no='XS'+String(++n).padStart(10,'0');orders.set(no,{order_no:no,out_ref:b.out_ref,amount:b.amount,status:'pending'});return json(200,{ok:true,order_no:no,amount:b.amount,method:b.method,qr_code:'https://qr.alipay.com/'+no});}
  if(u.pathname==='/hub/pay/status'){const o=orders.get(u.searchParams.get('order_no'));return o?json(200,{ok:true,order_no:o.order_no,status:o.status,amount:o.amount,currency:'CNY',out_ref:o.out_ref}):json(404,{ok:false});}
  return json(404,{ok:false});
 }
 return {fetchImpl,seen,set:(no,patch)=>Object.assign(orders.get(no),patch)};
}
const ENV={FRIENDS_HUB_BASE:'http://127.0.0.1:8765',FRIENDS_HUB_PROJECT_ID:PID,FRIENDS_HUB_SECRET:HUB_SECRET};
function world({chart=FULL,env={...ENV,FRIENDS_MYCHART_PAY_ENABLED:'true'},generate}={}){
 let now=T0;const clock=()=>now;
 const store=XB.grant(createFriendsStore(),'me','other');
 store.transaction(s=>{s.profiles=[{userId:'me',shareId:'card-me',nickname:'我',listed:true,chart},{userId:'other',shareId:'card-o',nickname:'TA',listed:true,chart:FULL}];});
 const config=P.payConfig(env),hub=fakeHub();
 const pay=P.createHepanPayService({store,config,hub:P.createHubClient({base:config.base,projectId:PID,secret:HUB_SECRET,fetchImpl:hub.fetchImpl}),pairFacts:()=>({moheCount:0,basisCount:0}),clock});
 const calls=[];
 const adapter=createFriendsReportAdapter({clock:()=>new Date(now),generate:async(...a)=>{calls.push(a);return generate?generate(...a):READING;}});
 const svc=createMyChartService({store,pay,adapter,clock,inputHashKey:HASH_KEY});
 return {store,pay,svc,hub,calls,config,setNow:v=>now=v};
}
const hubNo=(w,id)=>w.store.read().hepanOrders.find(o=>o.id===id).hubOrderId;
async function buy(w,uid='me'){const v=await w.svc.view(uid);const o=await w.pay.createOrder(uid,{...v.report.target,channel:'alipay'});w.hub.set(hubNo(w,o.id),{status:'paid'});return w.pay.poll(uid,o.id);}
async function ready(w){w.svc.setGender('me',{gender:'female'});await w.svc.eligibility('me',{input:BIRTH});return w;}
const BIRTH_KEYS=/birthYear|birthMonth|birthDay|birthHour|birthMinute|birthday|cityId|birthLocation|"lat"|"lng"|timeZone|ageAsOf|convention/;

test('free view: 4 pillars, 坤造/乾造, 日主, five-element counts, 3-4 copy-library lines, disclaimer; no birth data',async()=>{
 const w=world(),v0=await w.svc.view('me');
 assert.deepEqual(v0.chart.pillars,FULL.pillars);assert.equal(v0.chart.complete,true);assert.equal(v0.chart.limited,false);
 assert.equal(v0.chart.zao,null);assert.equal(v0.chart.dayMaster,FULL.dayMaster);
 const counts=v0.chart.elements;assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),8);assert.deepEqual(counts,elementCounts(FULL.pillars));
 assert.ok(v0.traits.length>=3&&v0.traits.length<=4);assert.equal(v0.disclaimer,DISCLAIMER);
 w.svc.setGender('me',{gender:'female'});assert.equal((await w.svc.view('me')).chart.zao,'坤造');
 w.svc.setGender('me',{gender:'male'});assert.equal((await w.svc.view('me')).chart.zao,'乾造');
 assert.throws(()=>w.svc.setGender('me',{gender:'x'}),{status:400});
 assert.doesNotMatch(JSON.stringify(await w.svc.view('me')),BIRTH_KEYS);
 // 同一张盘永远同样的几句话
 assert.deepEqual((await w.svc.view('me')).traits,(await world().svc.view('me')).traits);
});

test('no hour → 三柱 labelled 有限参考; old profile with only 日柱 still renders; no chart → 404',async()=>{
 const v=await world({chart:THREE}).svc.view('me');
 assert.equal(v.chart.complete,false);assert.equal(v.chart.limited,true);assert.equal(v.chart.limitedLabel,'有限参考');
 assert.equal(v.chart.pillars.hour,null);assert.equal(v.chart.pillars.year,THREE.basePillars.year);
 assert.equal(Object.values(v.chart.elements).reduce((a,b)=>a+b,0),6);
 const old=await world({chart:{dayMaster:'甲',element:'木',dayPillar:'甲子',complete:false}}).svc.view('me');
 assert.equal(old.chart.basis,'day');assert.equal(old.chart.limitedLabel,'有限参考');
 const w=world();w.store.transaction(s=>{s.profiles[0].chart=null;});await assert.rejects(w.svc.view('me'),{status:404});
 await assert.rejects(w.svc.view(undefined),{status:401});
});

test('pay disabled by default: config off, 完整报告即将开放, order creation refused',async()=>{
 const c=P.payConfig({...ENV});assert.equal(c.mychartEnabled,false);assert.equal(c.mychartPriceMinor,1990);
 assert.equal(P.payConfig({...ENV,FRIENDS_MYCHART_PAY_ENABLED:'1'}).mychartEnabled,false);
 assert.equal(P.payConfig({...ENV,FRIENDS_MYCHART_PAY_ENABLED:'true',FRIENDS_HEPAN_PAY_ENABLED:'true'}).enabled,true);
 assert.equal(P.payConfig({...ENV,FRIENDS_HEPAN_PAY_ENABLED:'true'}).mychartEnabled,false,'hepan switch does not turn on mychart');
 const w=world({env:{...ENV}});await ready(w);const v=await w.svc.view('me');
 assert.equal(v.report.payEnabled,false);assert.equal(v.report.comingSoon,true);assert.equal(v.report.comingSoonText,'完整报告即将开放');
 await assert.rejects(w.pay.createOrder('me',{...v.report.target,channel:'alipay'}),{status:503});
 await assert.rejects(async()=>w.pay.unlockWithCredit('me',v.report.target),{status:400});
 await assert.rejects(w.svc.createReport('me',{idempotencyKey:'k'.repeat(12),input:BIRTH,consentRetainReport:true}),{status:402});
});

test('amount only from server config (default 19.9, env override); must pass free check first',async()=>{
 const w=world();w.svc.setGender('me',{gender:'female'});
 const v=await w.svc.view('me');assert.equal(v.report.comingSoon,false,'pay on: form shown before the free check');assert.equal(v.report.pay.payEnabled,false);await assert.rejects(w.pay.createOrder('me',{...v.report.target,channel:'alipay'}),{status:409});
 await w.svc.eligibility('me',{input:BIRTH});
 const o=await w.pay.createOrder('me',{...v.report.target,channel:'alipay',amount:0.01,amountMinor:1,priceMinor:1});
 assert.equal(o.amountMinor,1990);const sent=JSON.parse(w.hub.seen.find(x=>x.path==='/hub/pay/create').init.body);
 assert.equal(sent.amount,19.9);assert.equal(sent.product,P.MYCHART_PRODUCT);
 assert.equal(w.store.read().hepanOrders[0].sku,P.MYCHART_SKU);
 assert.equal(P.payConfig({...ENV,FRIENDS_MYCHART_PRICE:'29.9'}).mychartPriceMinor,2990);
 assert.equal(P.payConfig({...ENV,FRIENDS_MYCHART_PRICE:'abc'}).mychartPriceMinor,1990);
 // 重复下单复用未付订单（幂等）
 const again=await w.pay.createOrder('me',{...v.report.target,channel:'alipay'});assert.equal(again.id,o.id);
});

test('eligibility: pillars must match the stored card; engine rejects DST birthplaces; input never stored',async()=>{
 const w=world();
 await assert.rejects(w.svc.eligibility('me',{input:BIRTH}),{status:400,message:/乾造或坤造/});
 w.svc.setGender('me',{gender:'female'});
 await assert.rejects(w.svc.eligibility('me',{input:{...BIRTH,birthDay:11}}),{status:409,message:/不一致/});
 await assert.rejects(w.svc.eligibility('me',{input:{...BIRTH,birthHour:''}}),{status:400});
 await w.svc.eligibility('me',{input:BIRTH});
 assert.doesNotMatch(JSON.stringify(w.store.read().myChartRows),BIRTH_KEYS);
 // 1990 年北京实行夏令时 → Runae 引擎不支持，如实拒绝
 const dst=calculate({birthday:'1990-05-15',calendar:'solar',hour:10,minute:30,cityId:BJ},new Date(T0));
 const d=world({chart:dst});d.svc.setGender('me',{gender:'male'});
 await assert.rejects(d.svc.eligibility('me',{input:{...BIRTH,birthYear:1990,birthMonth:5,birthDay:15}}),{status:400,message:/夏令时/});
 // 跨境同意缺失 → 统一同意码
 const x=world();x.svc.setGender('me',{gender:'female'});x.store.transaction(s=>{s.crossBorderConsents=[];});
 await assert.rejects(x.svc.eligibility('me',{input:BIRTH}),e=>e.code===XB.CODE);
});

test('server-side truncation: unpaid → titles only; paid → full reading with AI label; refunded → locked again',async()=>{
 const w=await ready(world());
 const before=await w.svc.view('me');assert.equal(before.report.unlocked,false);assert.equal(before.report.job,null);assert.equal(before.report.titles.length,16);
 await assert.rejects(w.svc.createReport('me',{idempotencyKey:'idem-0001',input:BIRTH,consentRetainReport:true}),{status:402});
 assert.equal(w.calls.length,0,'no model call before payment');
 assert.equal((await buy(w)).status,'paid');
 const job=await w.svc.createReport('me',{idempotencyKey:'idem-0001',input:BIRTH,consentRetainReport:true});
 assert.equal(job.status,'delivered');assert.equal(job.aiLabel,AI_LABEL);assert.ok(job.report.reading.includes('四柱八字排盘'));
 assert.deepEqual(findForbidden(job.report.reading),[],'AI text is sanitized');
 // 同一幂等键重放不再调用模型；同一份报告不能再生成第二次
 const again=await w.svc.createReport('me',{idempotencyKey:'idem-0001',input:BIRTH,consentRetainReport:true});assert.equal(again.reportId,job.reportId);assert.equal(w.calls.length,1);
 await assert.rejects(w.svc.createReport('me',{idempotencyKey:'idem-0002',input:BIRTH,consentRetainReport:true}),{status:409});
 const paid=await w.svc.view('me');assert.ok(paid.report.job.report.reading);assert.equal(paid.report.generated,true);
 assert.throws(()=>w.svc.setGender('me',{gender:'male'}),{status:409});
 // 存储里只有报告与哈希，没有出生资料
 assert.doesNotMatch(JSON.stringify(w.store.read().myChartReportJobs),BIRTH_KEYS);
 assert.doesNotMatch(JSON.stringify(paid),BIRTH_KEYS);
 // 退款 → 解锁失效 → 服务端不再返回正文
 w.store.transaction(s=>P.refundOrderIn(s,s.hepanOrders[0],'test',T0));
 const after=await w.svc.view('me');assert.equal(after.report.unlocked,false);assert.equal(after.report.job.locked,true);assert.equal(after.report.job.report,undefined);
 const direct=await w.svc.getReport('me',job.reportId);assert.equal(direct.report,undefined);assert.equal(direct.locked,true);
});

test('owner-only: another user cannot see, buy or read my chart/report (404), over HTTP too',async()=>{
 const w=await ready(world());await buy(w);
 const job=await w.svc.createReport('me',{idempotencyKey:'idem-0003',input:BIRTH,consentRetainReport:true});
 const mine=await w.svc.view('me'),id=mine.report.target.id;
 await assert.rejects(()=>Promise.resolve().then(()=>w.pay.offer('other',{type:'mychart',id})),{status:404});
 await assert.rejects(w.pay.createOrder('other',{type:'mychart',id,channel:'alipay'}),{status:404});
 await assert.rejects(w.svc.getReport('other',job.reportId),{status:404});
 const theirs=await w.svc.view('other');assert.notEqual(theirs.report.target.id,id);assert.equal(theirs.report.unlocked,false);assert.equal(theirs.report.job,null);
 // 公开投影里没有这些集合
 const pub=fs.readFileSync(path.join(__dirname,'friends-service.js'),'utf8');assert.doesNotMatch(pub,/myChart/);
 // HTTP：真路由 + 假登录
 const express=require('express'),{createMyChartRouter}=require('../routes/friends-my-chart');
 const app=express();app.use(express.json());
 const auth=(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();};
 app.use('/api/friends/my-chart',createMyChartRouter({express,auth,service:w.svc}));
 const srv=http.createServer(app);await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port+'/api/friends/my-chart';
 try{
  const get=(p,u)=>fetch(base+p,{headers:u?{'X-Test-User':u}:{}});
  assert.equal((await get('/')).status,401);
  const r1=await get('/report/'+job.reportId,'me');assert.equal(r1.status,200);assert.equal(r1.headers.get('cache-control'),'no-store');const b1=await r1.json();assert.ok(b1.report.reading);
  assert.equal((await get('/report/'+job.reportId,'other')).status,404);
  const r2=await get('/','me');const body=await r2.text();assert.equal(r2.status,200);assert.doesNotMatch(body,BIRTH_KEYS);
  // 写接口：没有站内头 → 403
  assert.equal((await fetch(base+'/gender',{method:'POST',headers:{'X-Test-User':'me','Content-Type':'application/json'},body:'{"gender":"male"}'})).status,403);
  const e=await fetch(base+'/eligibility',{method:'POST',headers:{'X-Test-User':'me','Content-Type':'application/json','X-Runae-Friends':'1'},body:JSON.stringify({input:BIRTH})});
  const eb=await e.text();assert.doesNotMatch(eb,BIRTH_KEYS);
 }finally{srv.close();}
});

test('failed generation releases the purchase so the user can retry',async()=>{
 let fail=true;const w=await ready(world({generate:async()=>{if(fail)throw Error('model down');return READING;}}));await buy(w);
 const j=await w.svc.createReport('me',{idempotencyKey:'idem-0004',input:BIRTH,consentRetainReport:true});assert.equal(j.status,'failed');
 assert.equal((await w.svc.view('me')).report.generated,false);
 fail=false;const ok=await w.svc.createReport('me',{idempotencyKey:'idem-0005',input:BIRTH,consentRetainReport:true});assert.equal(ok.status,'delivered');
});

test('copy library: deterministic 3-4 lines, ties resolved by 木火土金水 order, balanced case',()=>{
 const a=traitLines({dayMaster:'甲',dayElement:'木',counts:{木:3,火:1,土:2,金:1,水:1}});
 assert.equal(a.lines.length,4);assert.equal(a.strongest,'木');assert.equal(a.weakest,'火');
 const b=traitLines({dayMaster:'癸',dayElement:'水',counts:{木:2,火:2,土:2,金:2,水:2}});
 assert.equal(b.lines.length,3);assert.equal(b.strongest,null);
});

test('forbidden words: none in the new page / js / css / copy library / service; sanitize strips them from AI text',()=>{
 const root=path.join(__dirname,'../..');
 const files=['pages/friends-my-chart.html','assets/js/friends-my-chart.js','assets/css/friends-my-chart.css','assets/js/friends-hepan-pay.js','server/lib/friends-my-chart-copy.js','server/lib/friends-my-chart.js','server/routes/friends-my-chart.js'];
 for(const f of files){const t=fs.readFileSync(path.join(root,f),'utf8');assert.deepEqual(findForbidden(t),[],f);}
 const page=fs.readFileSync(path.join(root,'pages/friends-my-chart.html'),'utf8');
 for(const must of ['我的命盘','五行性格',DISCLAIMER,AI_LABEL,'完整报告即将开放','有限参考'])assert.ok(page.includes(must)||fs.readFileSync(path.join(root,'assets/js/friends-my-chart.js'),'utf8').includes(must),must);
 assert.ok(!/amount/i.test(fs.readFileSync(path.join(root,'assets/js/friends-my-chart.js'),'utf8')),'client never sends an amount');
 for(const w of FORBIDDEN)assert.deepEqual(findForbidden(sanitize('这里有'+w+'。')),[],w);
 assert.deepEqual(findForbidden(sanitize('有 85% 的可能，百分之九十')),[]);
 assert.deepEqual(findForbidden('五行木 3 个'),[]);
 // 入口在我的卡片
 assert.ok(fs.readFileSync(path.join(root,'assets/js/friends-collection.js'),'utf8').includes('/pages/friends-my-chart.html'));
});
