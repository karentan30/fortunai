'use strict';
// 合盘完整版付费解锁：金额只来自服务端、中台验签、回调幂等、轮询解锁、一方解锁双方可见、退款双方收回、
// 会员份数幂等与按月重置、7 天撤回规则、≤1 处磨合点不卖、解锁前不返回锁住内容。中台用假 fetch，不发真实请求。
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createFriendsStore}=require('./friends-store'),XB=require('./friends-cross-border');
const {createCompatibilityService,VERSION_V4,pairFacts}=require('./friends-compatibility');
const {createHepanSelfService}=require('./friends-hepan-self');
const {createAdminService}=require('./friends-admin');
const P=require('./friends-hepan-pay');
const fs=require('node:fs'),path=require('node:path');

const CLASH={A:{gender:'male',pillars:{year:'甲子',month:'丙寅',day:'甲午',hour:'庚午'}},B:{gender:'female',pillars:{year:'庚午',month:'壬申',day:'庚子',hour:'甲子'}}};
const HARMONY={A:{gender:'male',pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'甲子'}},B:{gender:'female',pillars:{year:'己丑',month:'丁卯',day:'己丑',hour:'己丑'}}};
const HUB_SECRET='h'.repeat(48),PID='xiangsheng',SELF_SECRET='x'.repeat(40);
const T0=Date.parse('2026-11-09T04:00:00Z'),DAY=86400000;
const sign=raw=>crypto.createHmac('sha256',HUB_SECRET).update(raw).digest('hex');

// 假中台：按真实 server.py 的接口形状应答，并且对我们发来的请求验签。
function fakeHub({tamper}={}){
 const orders=new Map(),seen=[];let n=0;
 const json=(status,body)=>({ok:status<400,status,json:async()=>body});
 async function fetchImpl(url,init){
  const u=new URL(url);seen.push({path:u.pathname,init});
  if(init.headers['X-Project-Id']!==PID)return json(403,{ok:false});
  if(u.pathname==='/hub/pay/create'){
   if(init.headers['X-Sign']!==sign(init.body))return json(403,{ok:false,error:'bad sign'});
   const b=JSON.parse(init.body),no='XS'+String(++n).padStart(10,'0');
   orders.set(no,{order_no:no,out_ref:b.out_ref,amount:b.amount,status:'pending'});
   const r={ok:true,order_no:no,amount:b.amount,method:b.method,...(b.method==='wechat'?{code_url:'weixin://wxpay/bizpayurl?pr='+no}:{qr_code:'https://qr.alipay.com/'+no})};
   return json(200,tamper?tamper(r,b):r);
  }
  if(u.pathname==='/hub/pay/status'){
   const qs=u.search.slice(1);if(init.headers['X-Sign']!==sign(qs))return json(403,{ok:false});
   const o=orders.get(u.searchParams.get('order_no'));if(!o)return json(404,{ok:false});
   return json(200,{ok:true,order_no:o.order_no,status:o.status,amount:o.amount,currency:'CNY',out_ref:o.out_ref});
  }
  return json(404,{ok:false});
 }
 return {fetchImpl,orders,seen,set:(no,patch)=>Object.assign(orders.get(no),patch)};
}
const CONFIG={enabled:true,ready:true,base:'http://127.0.0.1:8765',projectId:PID,secret:HUB_SECRET,priceMinor:990,advisorQrUrl:'https://example.com/qr.png'};

function world({pairs=CLASH,config=CONFIG,hubOpts,hooks}={}){
 let now=T0;const clock=()=>now;
 const store=XB.grant(createFriendsStore(),'a','b','m');
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'阿甲',listed:true},{userId:'b',shareId:'card-b',nickname:'小庚',listed:true}];});
 const hub=fakeHub(hubOpts),client=P.createHubClient({base:config.base,projectId:PID,secret:HUB_SECRET,fetchImpl:hub.fetchImpl});
 const pay=P.createHepanPayService({store,config,hub:client,pairFacts,clock,hooks});
 const charts={'1990-01-01':pairs.A,'1990-02-02':pairs.B};
 const calculateChart=inp=>{const c=charts[inp.birthday];return {complete:true,pillars:{...c.pillars},dayPillar:c.pillars.day,birthLocation:{id:'x'},calculationVersion:'test'};};
 const compat=createCompatibilityService({store,calculateChart,clock,pay});
 const p=compat.create('a',{targetShareId:'card-b'});
 const auth=(uid,birthday)=>compat.authorize(uid,p.id,{version:VERSION_V4,consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input:{birthday,calendar:'solar',cityId:'x',time:'08:00',gender:uid==='a'?'male':'female'}});
 const member=(uid,id='XS-M-'+uid)=>store.transaction(s=>{s.billingOrders=s.billingOrders||[];s.billingOrders.push({id,userId:uid,provider:'direct',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:new Date(now-1000).toISOString(),accessUntil:new Date(now+90*DAY).toISOString()});});
 return {store,hub,client,pay,compat,p,auth,member,clock,setNow:v=>now=v,now:()=>now};
}
async function ready(w){await w.auth('a','1990-01-01');await w.auth('b','1990-02-02');return w;}
const target=w=>({type:'pair',id:w.p.id});
const hubNo=(w,id)=>w.store.read().hepanOrders.find(o=>o.id===id).hubOrderId;
async function paidOrder(w,uid='a',channel='alipay'){const o=await w.pay.createOrder(uid,{...target(w),channel});w.hub.set(hubNo(w,o.id),{status:'paid'});return w.pay.poll(uid,o.id);}

test('amount comes from server config only: client amount/price fields are ignored and the hub gets 9.9',async()=>{
 const w=await ready(world());
 const o=await w.pay.createOrder('a',{...target(w),channel:'alipay',amount:0.01,amountMinor:1,priceMinor:1});
 assert.equal(o.amountMinor,990);assert.equal(o.status,'pending');assert.match(o.checkout.qrCode,/^https:\/\/qr\.alipay\.com\//);
 const sent=JSON.parse(w.hub.seen.find(x=>x.path==='/hub/pay/create').init.body);
 assert.equal(sent.amount,9.9);assert.equal(sent.out_ref,o.id);assert.equal(sent.method,'alipay');
 const wx=await w.pay.createOrder('a',{...target(w),channel:'wechat'});assert.match(wx.checkout.codeUrl,/^weixin:\/\//);
 // 价格可配置，但只走服务端环境变量
 assert.equal(P.payConfig({FRIENDS_HEPAN_PRICE:'12.8'}).priceMinor,1280);assert.equal(P.payConfig({FRIENDS_HEPAN_PRICE:'0.01'}).priceMinor,990);
 // 中台回的金额和下单金额对不上 → 不出付款码
 const bad=await ready(world({hubOpts:{tamper:r=>({...r,amount:0.01})}}));
 await assert.rejects(bad.pay.createOrder('a',{...target(bad),channel:'alipay'}),{status:502});
 assert.equal(bad.store.read().hepanOrders[0].status,'failed');
});

test('payment disabled unless base+project+secret are set AND FRIENDS_HEPAN_PAY_ENABLED=true; hub base must be internal http',async()=>{
 const env={FRIENDS_HUB_BASE:'http://127.0.0.1:8765',FRIENDS_HUB_PROJECT_ID:PID,FRIENDS_HUB_SECRET:HUB_SECRET};
 assert.equal(P.payConfig(env).enabled,false);assert.equal(P.payConfig({...env,FRIENDS_HEPAN_PAY_ENABLED:'true'}).enabled,true);
 for(const k of Object.keys(env))assert.equal(P.payConfig({...env,[k]:'',FRIENDS_HEPAN_PAY_ENABLED:'true'}).enabled,false,k);
 assert.equal(P.payConfig({...env,FRIENDS_HUB_BASE:'https://pay.example.com',FRIENDS_HEPAN_PAY_ENABLED:'true'}).enabled,false);
 const w=await ready(world({config:{...CONFIG,enabled:false}}));
 await assert.rejects(w.pay.createOrder('a',{...target(w),channel:'alipay'}),{status:503});
 assert.equal(w.hub.seen.length,0);
});

test('callback: bad / missing signature rejected; wrong project rejected; body amount never trusted; repeats are idempotent',async()=>{
 const w=await ready(world());
 const o=await w.pay.createOrder('a',{...target(w),channel:'alipay'}),no=hubNo(w,o.id);
 const body=b=>Buffer.from(JSON.stringify({project_id:PID,order_no:no,out_ref:o.id,product:P.PRODUCT,amount:9.9,method:'alipay',status:'paid',...b}));
 const raw=body();
 await assert.rejects(w.pay.callback(raw,'0'.repeat(64),PID),{status:401});
 await assert.rejects(w.pay.callback(raw,undefined,PID),{status:401});
 await assert.rejects(w.pay.callback(body({amount:0.01}),sign(raw),PID),{status:401},'signature covers the raw body');
 const other=body({project_id:'glowme'});await assert.rejects(w.pay.callback(other,sign(other),PID),{status:400});
 // 回调说已付，但中台查单还是 pending → 不解锁（只信查单）
 assert.equal((await w.pay.callback(raw,sign(raw),PID)).status,'pending');assert.equal(w.pay.isUnlocked('pair',w.store.read().compatibilityPairs[0]),false);
 w.hub.set(no,{status:'paid'});
 assert.equal((await w.pay.callback(raw,sign(raw),PID)).status,'paid');
 const after=structuredClone(w.store.read());
 assert.deepEqual(await w.pay.callback(raw,sign(raw),PID),{ok:true,duplicate:true});
 assert.deepEqual(w.store.read().hepanOrders,after.hepanOrders);assert.deepEqual(w.store.read().compatibilityPairs[0].v4Unlock,after.compatibilityPairs[0].v4Unlock);
 // 中台查单金额与本单不符 → 人工核对，不解锁
 const x=await ready(world()),xo=await x.pay.createOrder('a',{...target(x),channel:'alipay'});x.hub.set(hubNo(x,xo.id),{status:'paid',amount:0.01});
 assert.equal((await x.pay.poll('a',xo.id)).status,'payment_review');assert.equal(x.store.read().compatibilityPairs[0].v4Unlock,undefined);
});

test('poll unlocks after the hub reports paid; both sides then see the full report; only the payer may poll',async()=>{
 const w=await ready(world());
 const before=await w.compat.report('b',w.p.id);assert.equal(before.full,false);assert.equal(before.lock.available,true);assert.equal(before.lock.cta,'解锁完整报告');
 assert.equal(before.pay.sellable,true);assert.equal(before.pay.priceMinor,990);assert.equal(before.pay.advisorQrUrl,null);
 const o=await w.pay.createOrder('a',{...target(w),channel:'alipay'});
 assert.equal((await w.pay.poll('a',o.id)).status,'pending');
 await assert.rejects(w.pay.poll('b',o.id),{status:404});
 w.hub.set(hubNo(w,o.id),{status:'paid'});
 assert.equal((await w.pay.poll('a',o.id)).status,'paid');
 for(const uid of ['a','b']){const r=await w.compat.report(uid,w.p.id);assert.equal(r.full,true,uid);assert.equal(r.unlocked,true);assert.equal(r.lock,null);assert.equal(r.moreCount,0);assert.ok(r.subs.every(s=>!s.locked));assert.equal(r.pay.advisorQrUrl,CONFIG.advisorQrUrl);assert.equal(r.pay.unlockedBy,uid==='a'?'me':'peer');}
 const u=w.store.read().compatibilityPairs[0].v4Unlock;assert.equal(u.unlockedBy,'a');assert.equal(u.source.kind,'order');assert.equal(u.source.orderNo,hubNo(w,o.id));assert.ok(u.unlockedAt);
 await assert.rejects(w.pay.createOrder('b',{...target(w),channel:'wechat'}),{status:409},'already unlocked: no second sale');
});

test('locked content is never returned before unlock (report, offer, order and hub payloads)',async()=>{
 const w=await ready(world());
 const full=w.compat,pairRow=()=>w.store.read().compatibilityPairs[0];
 const locked=await full.report('a',w.p.id),facts=pairFacts(pairRow(),w.now());
 assert.ok(facts.moheCount>1);assert.equal(locked.mohe.length,1);assert.equal(locked.moreCount,facts.moheCount-1);
 assert.ok(!locked.basis?.length,'no basis rows while locked');assert.equal('moheTotal' in locked,false);
 for(const k of ['branch','wuxing'])assert.equal(locked.subs.find(s=>s.key===k).score,null);
 const o=await w.pay.createOrder('a',{...target(w),channel:'alipay'}),offer=w.pay.offer('a',target(w));
 const text=JSON.stringify({o,offer,hub:w.hub.seen.map(x=>x.init.body||'')});
 for(const word of ['advice','"score"','meaning','title','"points"'])assert.ok(!text.includes(word),word);
 w.hub.set(hubNo(w,o.id),{status:'paid'});await w.pay.poll('a',o.id);
 const open=await full.report('a',w.p.id);assert.equal(open.mohe.length,facts.moheCount);assert.ok(open.basis.length>0);
 const lockedText=JSON.stringify(locked);for(const h of open.mohe.slice(1))for(const t of [h.title,h.meaning].filter(Boolean))assert.ok(!lockedText.includes(t)&&!text.includes(t),t);
});

test('a single-purchase refund (admin or hub "failed" after paid) revokes the unlock for both sides',async()=>{
 const w=await ready(world());const o=await paidOrder(w);
 assert.equal((await w.compat.report('b',w.p.id)).full,true);
 const admin=createAdminService(w.store);
 assert.deepEqual(admin.markRefunded(o.id,'用户申请'),{ok:true,revokedUnlocks:1});
 for(const uid of ['a','b']){const r=await w.compat.report(uid,w.p.id);assert.equal(r.full,false,uid);assert.ok(r.lock);}
 assert.equal(w.store.read().compatibilityPairs[0].v4UnlockHistory[0].revokeReason,'order_refunded');
 assert.deepEqual(admin.markRefunded(o.id,'again'),{ok:true,duplicate:true});
 // 中台侧已退（查单变 failed）：10 分钟复查时自动收回
 const x=await ready(world()),xo=await paidOrder(x);x.hub.set(hubNo(x,xo.id),{status:'failed'});
 assert.equal((await x.pay.poll('a',xo.id)).status,'paid','within recheck window nothing changes');
 x.setNow(T0+11*60000);assert.equal((await x.pay.poll('a',xo.id)).status,'refunded');
 assert.equal((await x.compat.report('b',x.p.id)).full,false);
});

test('member credits: 2 per natural month, idempotent per target+user+v4, monthly reset, rollback if unlock write fails, membership refund revokes',async()=>{
 const w=await ready(world());
 assert.throws(()=>w.pay.unlockWithCredit('a',target(w)),{status:403});
 w.member('a');
 assert.equal(w.pay.offer('a',target(w)).memberRemaining,2);
 const r1=w.pay.unlockWithCredit('a',target(w));assert.equal(r1.remaining,1);
 const r2=w.pay.unlockWithCredit('a',target(w));assert.equal(r2.duplicate,true);assert.equal(r2.remaining,1,'same target twice uses one credit');
 assert.equal(w.store.read().hepanCredits.length,1);assert.equal(w.store.read().hepanCredits[0].key,'pair:'+w.p.id+':a:v4');
 assert.equal((await w.compat.report('b',w.p.id)).full,true,'credit unlock is pair-level too');
 // 再开两份自己合盘，用完本月余量
 const self=createHepanSelfService({store:w.store,secret:SELF_SECRET,calculateChart:inp=>({complete:true,pillars:{...(inp.birthday==='1990-01-01'?CLASH.A:CLASH.B).pillars}}),clock:w.clock,pay:w.pay});
 const body={purpose:'romance',consents:{informed:true,selfOnly:true,adult:true},me:{birthday:'1990-01-01',calendar:'solar',time:'08:00',gender:'male'},ta:{nickname:'阿北',birthday:'1990-02-02',calendar:'solar',time:'08:00',gender:'female'}};
 XB.grant(w.store,'a');
 const s1=self.save('a',{saveToken:(await self.run('a',body,{device:'d'.repeat(20)})).saveToken}),s2=self.save('a',{saveToken:(await self.run('a',body,{device:'d'.repeat(20)})).saveToken});
 assert.equal(w.pay.unlockWithCredit('a',{type:'self',id:s1.id}).remaining,0);
 assert.throws(()=>w.pay.unlockWithCredit('a',{type:'self',id:s2.id}),{status:409,message:/用完/});
 // 下个自然月（东八区）恢复 2 份
 w.setNow(Date.parse('2026-11-30T16:00:00Z'));assert.equal(P.monthKey(w.now()),'2026-12');
 assert.equal(w.pay.offer('a',{type:'self',id:s2.id}).memberRemaining,2);
 // 写解锁失败 → 份数退回
 const fails=await ready(world({hooks:{beforeUnlockWrite(){throw Error('disk')}}}));fails.member('a');
 assert.throws(()=>fails.pay.unlockWithCredit('a',target(fails)),{status:500});
 assert.equal((fails.store.read().hepanCredits||[]).length,0);assert.equal(fails.pay.offer('a',target(fails)).memberRemaining,2);
 // 会员退款：这笔会员份数解锁的全部收回
 const admin=createAdminService(w.store);assert.deepEqual(admin.markRefunded('XS-M-a','会员退款'),{ok:true,revokedUnlocks:2});
 // （邀请 7 天已过期，直接看存储）
 assert.equal(w.store.read().compatibilityPairs[0].v4Unlock,undefined);assert.equal(self.get('a',s1.id).full,false);
});

test('7-day revoke rule: peer revokes within 7 days and payer never opened → refund request / credit returned; otherwise nothing',async()=>{
 // 单次：付款人没看过，对方 3 天后撤回 → 记待退款
 const a=await ready(world());const ao=await paidOrder(a);
 a.setNow(T0+3*DAY);a.compat.decline('b',a.p.id);
 const order=a.store.read().hepanOrders.find(o=>o.id===ao.id);assert.equal(order.refundRequest.reason,'peer_revoked_unopened');
 assert.equal(a.store.read().compatibilityPairs[0].v4Unlock,undefined);
 // 付款人看过完整版 → 不退
 const b=await ready(world());const bo=await paidOrder(b);await b.compat.report('a',b.p.id);
 assert.ok(b.store.read().compatibilityPairs[0].v4Unlock.payerFirstOpenedFullAt);
 b.compat.decline('b',b.p.id);assert.equal(b.store.read().hepanOrders.find(o=>o.id===bo.id).refundRequest,undefined);
 // 对方看过不算付款人看过；但超过 7 天 → 不退
 const c=await ready(world());const co=await paidOrder(c);await c.compat.report('b',c.p.id);
 assert.equal(c.store.read().compatibilityPairs[0].v4Unlock.payerFirstOpenedFullAt,null);
 c.setNow(T0+8*DAY);c.compat.decline('b',c.p.id);assert.equal(c.store.read().hepanOrders.find(o=>o.id===co.id).refundRequest,undefined);
 // 付款人自己撤回 → 不退
 const d=await ready(world());const dd=await paidOrder(d);d.compat.revoke('a',d.p.id);assert.equal(d.store.read().hepanOrders.find(o=>o.id===dd.id).refundRequest,undefined);
 // 会员份数：对方撤回 → 份数退回，本月余量恢复
 const e=await ready(world());e.member('a');e.pay.unlockWithCredit('a',target(e));e.setNow(T0+DAY);e.compat.revoke('b',e.p.id);
 assert.equal(e.store.read().hepanCredits[0].status,'returned');
 const bal=e.store.read().hepanCredits.filter(c=>c.status==='used').length;assert.equal(bal,0);
 assert.equal(P.REFUND_RULE.includes('7 天'),true);
});

test('≤1 磨合点 is not sellable: no pay button, all-shown state, orders and credits refused',async()=>{
 const w=await ready(world({pairs:HARMONY}));w.member('a');
 const r=await w.compat.report('a',w.p.id);
 assert.equal(r.allShown,true);assert.equal(r.full,true);assert.equal(r.lock,null);assert.equal(r.pay.sellable,false);assert.equal(r.pay.payEnabled,false);assert.equal(r.pay.creditEnabled,false);
 assert.equal(r.pay.advisorQrUrl,CONFIG.advisorQrUrl,'nothing to sell, report is complete → advisor card allowed');
 await assert.rejects(w.pay.createOrder('a',{...target(w),channel:'alipay'}),{status:409,message:/全部展示/});
 assert.throws(()=>w.pay.unlockWithCredit('a',target(w)),{status:409});
 assert.equal(w.hub.seen.length,0);
});

test('order creation is rate limited and reuses an open order for the same target and channel',async()=>{
 const w=await ready(world());
 const o1=await w.pay.createOrder('a',{...target(w),channel:'alipay'}),o2=await w.pay.createOrder('a',{...target(w),channel:'alipay'});
 assert.equal(o1.id,o2.id);
 for(let i=0;i<4;i++){w.hub.set(hubNo(w,o1.id),{status:'pending'});w.store.transaction(s=>{for(const o of s.hepanOrders)if(o.status==='pending')o.status='failed';});await w.pay.createOrder('a',{...target(w),channel:'wechat'});}
 w.store.transaction(s=>{for(const o of s.hepanOrders)if(o.status==='pending')o.status='failed';});
 await assert.rejects(w.pay.createOrder('a',{...target(w),channel:'alipay'}),{status:429});
 await assert.rejects(w.pay.createOrder('a',{...target(w),channel:'card'}),{status:400});
 await assert.rejects(w.pay.createOrder('stranger',{...target(w),channel:'alipay'}),{status:404});
});

test('self 合盘 must be saved before paying; the unlock sits on the saved record',async()=>{
 const w=world();XB.grant(w.store,'me');
 const self=createHepanSelfService({store:w.store,secret:SELF_SECRET,calculateChart:inp=>({complete:true,pillars:{...(inp.birthday==='1990-01-01'?CLASH.A:CLASH.B).pillars}}),clock:w.clock,pay:w.pay});
 const body={purpose:'romance',consents:{informed:true,selfOnly:true,adult:true},me:{birthday:'1990-01-01',calendar:'solar',time:'08:00',gender:'male'},ta:{nickname:'阿北',birthday:'1990-02-02',calendar:'solar',time:'08:00',gender:'female'}};
 const run=await self.run('me',body,{device:'d'.repeat(20)});
 assert.equal(run.lock.needsSave,true);assert.equal(run.lock.cta,'保存后解锁完整报告');
 await assert.rejects(w.pay.createOrder('me',{type:'self',id:'nope',channel:'alipay'}),{status:404,message:/先保存/});
 const saved=self.save('me',{saveToken:run.saveToken});
 const o=await w.pay.createOrder('me',{type:'self',id:saved.id,channel:'alipay'});w.hub.set(hubNo(w,o.id),{status:'paid'});await w.pay.poll('me',o.id);
 const v=self.get('me',saved.id);assert.equal(v.full,true);assert.equal(v.unlocked,true);assert.ok(v.mohe.length>1);
 assert.ok(w.store.read().hepanSelfSaved.find(r=>r.id===saved.id).unlock.payerFirstOpenedFullAt);
 await assert.rejects(w.pay.createOrder('other',{type:'self',id:saved.id,channel:'alipay'}),{status:404});
});

test('new frontend + copy: forbidden words absent, advisor card has no price, paysheet sends no amount',()=>{
 const root=path.join(__dirname,'../..');
 const files=['assets/js/friends-hepan-pay.js','assets/js/friends-hepan-report.js','server/lib/friends-hepan-pay.js','pages/friends-compatibility.html'];
 for(const f of files){const t=fs.readFileSync(path.join(root,f),'utf8');for(const w of ['开光','功效','转运','化解','保证复合','包准'])assert.ok(!t.includes(w),f+' '+w);}
 const pay=fs.readFileSync(path.join(root,'assets/js/friends-hepan-pay.js'),'utf8');assert.ok(!/amount/i.test(pay.replace(/priceMinor/g,'')),'client never sends an amount');
 const rep=fs.readFileSync(path.join(root,'assets/js/friends-hepan-report.js'),'utf8'),card=rep.slice(rep.indexOf('function advisor'),rep.indexOf('function render('));
 assert.ok(card.includes('加顾问微信，进玄学搭子交流群'));assert.ok(!/¥|元|价格|priceMinor|购买/.test(card));
});
