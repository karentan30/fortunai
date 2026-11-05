'use strict';
// 相生会员直连收款：支付平台全部 mock，绝不联网、绝不真实付款。
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createMembershipSales,createPayJsProvider,configuredMembershipSales}=require('./friends-membership-sales');
const {createFriendsStore}=require('./friends-store');
const {createFriendsQuotas}=require('./friends-quotas');
const {isMember}=require('./friends-membership');
const KEY='mock-provider-secret';
const sign=p=>crypto.createHmac('sha256',KEY).update(JSON.stringify(p)).digest('hex');
function mockProvider(){
  const created=[],paidRemote=new Map();
  return {created,paidRemote,
    ready:()=>true,
    async create(channel,o){created.push({channel,...o});return channel==='wechat'?{codeUrl:'weixin://wxpay/bizpayurl?pr=MOCK'}:{qrCode:'https://qr.alipay.com/MOCK'};},
    async query(channel,no){return paidRemote.get(no)||null;},
    verifyNotify(channel,body){if(!body?.payload||body.sig!==sign(body.payload))return {ok:false};return {ok:true,paid:true,appOk:true,currency:'CNY',...body.payload};},
    reply:(channel,ok)=>({type:'text/plain',body:ok?'success':'fail'})};
}
function fixture({salesOpen=true,notifyBase='https://xs.example.com/api/friends/billing/membership/notify',provider=mockProvider()}={}){
  const store=createFriendsStore();let now=Date.parse('2026-11-06T04:00:00Z');const clock=()=>now;
  const sales=createMembershipSales(store,{provider,salesOpen,notifyBase,clock});
  const notifyFor=(order,extra={})=>{const o=store.read().billingOrders.find(x=>x.id===order.id);const payload={outTradeNo:o.outTradeNo,amountMinor:o.amountMinor,tradeNo:'T-'+o.outTradeNo,...extra};return {payload,sig:sign(payload)};};
  return {store,sales,provider,clock,setNow:t=>now=t,now:()=>now,notifyFor,quota:uid=>createFriendsQuotas({enabled:true,clock}).status(store.read(),uid)};
}
const buy=(f,uid='u1',sku='friends_month_v1',channel='alipay')=>f.sales.checkout(uid,{sku,channel});

test('sales off or unconfigured: status closed and checkout refused with 暂未开放购买',async()=>{
  for(const opts of [{salesOpen:false},{notifyBase:''},{notifyBase:'http://insecure.example.com/n'},{provider:null}]){
    const f=fixture(opts);assert.equal(f.sales.status('u1').open,false);
    await assert.rejects(buy(f),{status:503,message:'暂未开放购买'});assert.equal((f.store.read().billingOrders||[]).length,0);
  }
  const env=configuredMembershipSales(createFriendsStore(),{env:{},load:()=>mockProvider()});assert.equal(env.status().open,false,'FRIENDS_SALES_OPEN defaults off');
  const on=configuredMembershipSales(createFriendsStore(),{env:{FRIENDS_SALES_OPEN:'true',FRIENDS_PAY_NOTIFY_BASE:'https://xs.example.com/n'},load:()=>mockProvider()});assert.equal(on.status().open,true);
});

test('paid notify → member with 20 requests/day; order has no checkout after payment; notify URL per channel',async()=>{
  const f=fixture(),o=await buy(f,'u1','friends_month_v1','wechat');
  assert.equal(o.status,'pending');assert.ok(o.checkout.codeUrl);assert.equal(f.quota('u1').tier,'free');
  assert.equal(f.provider.created[0].notifyUrl,'https://xs.example.com/api/friends/billing/membership/notify/wechat');
  assert.equal(f.provider.created[0].amountMinor,2990);
  const r=f.sales.notify('wechat',f.notifyFor(o));assert.equal(r.ok,true);assert.equal(r.reply.body,'success');
  assert.equal(isMember(f.store.read(),'u1',f.now()),true);
  const q=f.quota('u1');assert.equal(q.tier,'member');assert.equal(q.limits.request,20);
  const polled=await f.sales.order('u1',o.id);assert.equal(polled.status,'paid');assert.equal(polled.checkout,undefined);
  assert.equal(f.sales.status('u1').member.active,true);
});

test('duplicate notify grants exactly once',async()=>{
  const f=fixture(),o=await buy(f,'u1','friends_year_v1');const n=f.notifyFor(o);
  f.sales.notify('alipay',n);const first=structuredClone(f.store.read().billingOrders[0]);
  f.setNow(f.now()+60000);const again=f.sales.notify('alipay',n);assert.equal(again.duplicate,true);
  f.sales.notify('alipay',f.notifyFor(o,{tradeNo:'OTHER-TRADE'}));
  const after=f.store.read();assert.equal(after.billingOrders.length,1);
  assert.equal(after.billingOrders[0].accessUntil,first.accessUntil,'no second grant / extension');
  assert.equal(after.billingEvents.filter(e=>e.status==='paid').length,1);
});

test('wrong amount is rejected and frozen for review, never grants',async()=>{
  const f=fixture(),o=await buy(f);
  assert.throws(()=>f.sales.notify('alipay',f.notifyFor(o,{amountMinor:1})),{status:400});
  assert.equal(isMember(f.store.read(),'u1',f.now()),false);assert.equal(f.store.read().billingOrders[0].status,'payment_review');
  // A later correct-looking notify cannot unfreeze it.
  assert.throws(()=>f.sales.notify('alipay',f.notifyFor(o)),{status:409});assert.equal(isMember(f.store.read(),'u1',f.now()),false);
  const g=fixture(),p=await buy(g);assert.throws(()=>g.sales.notify('alipay',g.notifyFor(p,{currency:'USD'})),{status:400});
  const h=fixture(),q=await buy(h);assert.throws(()=>h.sales.notify('alipay',h.notifyFor(q,{appOk:false})),{status:400},'other merchant app id');
  assert.equal(isMember(h.store.read(),'u1',h.now()),false);
});

test('forged signature is rejected with no state change',async()=>{
  const f=fixture(),o=await buy(f);const n=f.notifyFor(o);const before=JSON.stringify(f.store.read());
  assert.throws(()=>f.sales.notify('alipay',{payload:n.payload,sig:'0'.repeat(64)}),{status:401});
  assert.throws(()=>f.sales.notify('alipay',{payload:{...n.payload,amountMinor:2990},sig:sign({...n.payload,outTradeNo:'other'})}),{status:401});
  assert.equal(JSON.stringify(f.store.read()),before);assert.equal(isMember(f.store.read(),'u1',f.now()),false);
});

test('only sellable membership SKUs; pair report never sold; order belongs to its user',async()=>{
  const f=fixture();
  await assert.rejects(buy(f,'u1','friends_pair_report_v1'),{status:400});await assert.rejects(buy(f,'u1','friends_report_199'),{status:400});
  await assert.rejects(buy(f,'u1','friends_month_v1','stripe'),{status:400});
  const o=await buy(f,'u1');await assert.rejects(f.sales.order('u2',o.id),{status:404});
  assert.deepEqual(f.sales.status().products.map(p=>p.sku),['friends_month_v1','friends_year_v1']);
});

test('poll confirms payment via server-side query; client cannot mark paid',async()=>{
  const f=fixture(),o=await buy(f);assert.equal((await f.sales.order('u1',o.id)).status,'pending');
  const no=f.store.read().billingOrders[0].outTradeNo;f.provider.paidRemote.set(no,{outTradeNo:no,amountMinor:2990,currency:'CNY',tradeNo:'T1',appOk:true});
  assert.equal((await f.sales.order('u1',o.id)).status,'paid');assert.equal(isMember(f.store.read(),'u1',f.now()),true);
  f.sales.notify('alipay',f.notifyFor(o,{tradeNo:'T1'}));assert.equal(f.store.read().billingEvents.filter(e=>e.status==='paid').length,1);
});

test('expired membership falls back to free quotas; manual renewal extends instead of overlapping',async()=>{
  const f=fixture(),o=await buy(f);f.sales.notify('alipay',f.notifyFor(o));
  const until=Date.parse(f.store.read().billingOrders[0].accessUntil);assert.equal(new Date(until).toISOString(),'2026-12-06T04:00:00.000Z');
  const r=await buy(f,'u1','friends_month_v1');f.sales.notify('alipay',f.notifyFor(r));
  assert.equal(f.store.read().billingOrders[1].accessUntil,'2027-01-06T04:00:00.000Z','renewal starts at old end');
  f.setNow(Date.parse('2027-01-06T04:00:00Z'));
  assert.equal(isMember(f.store.read(),'u1',f.now()),false);const q=f.quota('u1');assert.equal(q.tier,'free');assert.equal(q.limits.request,3);
});

test('quota: free 3/day with clear Chinese error, member 20, reset at Beijing midnight not UTC midnight',()=>{
  let now=Date.parse('2026-11-06T15:30:00Z');const q=createFriendsQuotas({enabled:true,clock:()=>now}),s={};
  for(let i=0;i<3;i++)q.request(s,'u1');
  assert.throws(()=>q.request(s,'u1'),e=>e.status===429&&e.message==='今天的3次认识申请用完了，明天再来，或开通会员每天20次');
  assert.equal(q.status(s,'u1').remaining.request,0);
  now=Date.parse('2026-11-06T15:59:59Z');assert.throws(()=>q.request(s,'u1'),{status:429});
  now=Date.parse('2026-11-06T16:00:00Z');assert.equal(q.status(s,'u1').remaining.request,3);assert.equal(q.status(s,'u1').day,'2026-11-07');q.request(s,'u1');
  s.billingOrders=[{userId:'m',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:'2026-11-01T00:00:00Z',accessUntil:'2026-12-01T00:00:00Z'}];
  for(let i=0;i<20;i++)q.request(s,'m');assert.throws(()=>q.request(s,'m'),e=>e.status===429&&e.message==='今天的20次认识申请用完了，明天再来');
});

test('pay.js adapter maps signed notify and rejects bad signature / foreign merchant',async()=>{
  const pay={alipayReady:()=>true,wechatReady:()=>true,
    wxVerifyNotify:xml=>({ok:xml.includes('GOODSIG'),data:{return_code:'SUCCESS',result_code:'SUCCESS',out_trade_no:'xs_1',total_fee:'2990',transaction_id:'W1',appid:xml.includes('OTHERAPP')?'wxOTHER':'wxAPP',mch_id:'MCH'}}),
    alipayVerifyNotify:b=>b.sign==='GOOD',wxReplyXml:ok=>'<xml>'+(ok?'SUCCESS':'FAIL')+'</xml>',
    wxUnifiedOrder:async(no,fee,subject,ip,notifyUrl)=>({return_code:'SUCCESS',result_code:'SUCCESS',code_url:'weixin://x',notifyUrl}),
    alipayPrecreate:async(no,amount,subject,notifyUrl)=>{assert.equal(amount,'29.90');assert.ok(notifyUrl.endsWith('/alipay'));return {ok:true,qr_code:'https://qr.alipay.com/x'};}};
  const p=createPayJsProvider({pay,env:{WECHAT_APP_ID:'wxAPP',WECHAT_MCH_ID:'MCH',ALIPAY_APP_ID:'2021'}});
  assert.deepEqual(p.verifyNotify('wechat','<xml>GOODSIG</xml>'),{ok:true,paid:true,outTradeNo:'xs_1',amountMinor:2990,currency:'CNY',tradeNo:'W1',appOk:true});
  assert.equal(p.verifyNotify('wechat','<xml>BAD</xml>').ok,false);assert.equal(p.verifyNotify('wechat','<xml>GOODSIG OTHERAPP</xml>').appOk,false);
  const a=p.verifyNotify('alipay',{sign:'GOOD',out_trade_no:'xs_2',total_amount:'199.00',trade_status:'TRADE_SUCCESS',trade_no:'A1',app_id:'2021'});assert.equal(a.amountMinor,19900);assert.equal(a.paid,true);assert.equal(a.appOk,true);
  assert.equal(p.verifyNotify('alipay',{sign:'BAD',out_trade_no:'xs_2'}).ok,false);
  assert.deepEqual(await p.create('alipay',{outTradeNo:'xs_2',amountMinor:2990,subject:'s',notifyUrl:'https://x/alipay'}),{qrCode:'https://qr.alipay.com/x'});
  assert.equal(p.reply('alipay',true).body,'success');
});

test('HTTP: notify route answers provider format; checkout needs login + same-site header',async()=>{
  let express;try{express=require('express');}catch(e){express=require('../../.review/node_modules/express');}
  const {createMembershipNotifyRouter,createMembershipSalesRouter}=require('../routes/friends-membership-sales');
  const f=fixture(),app=express();
  app.use('/n',createMembershipNotifyRouter({express,service:f.sales}));app.use(express.json());
  app.use('/m',createMembershipSalesRouter({express,service:f.sales,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
  const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await (await fetch(base+'/m/status')).json()).open,true);
    assert.equal((await fetch(base+'/m/checkout',{method:'POST',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},body:'{}'})).status,401);
    assert.equal((await fetch(base+'/m/me')).status,401);const mine=await (await fetch(base+'/m/me',{headers:{'X-Test-User':'u1'}})).json();assert.equal(mine.member.active,false);assert.equal(mine.open,true);
    assert.equal((await fetch(base+'/m/checkout',{method:'POST',headers:{'Content-Type':'application/json','X-Test-User':'u1'},body:JSON.stringify({sku:'friends_month_v1',channel:'alipay'})})).status,403);
    const o=await (await fetch(base+'/m/checkout',{method:'POST',headers:{'Content-Type':'application/json','X-Runae-Friends':'1','X-Test-User':'u1'},body:JSON.stringify({sku:'friends_month_v1',channel:'alipay'})})).json();
    assert.equal(o.status,'pending');
    const bad=await fetch(base+'/n/alipay',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'x=1'});assert.equal(bad.status,401);assert.equal(await bad.text(),'fail');
  }finally{await new Promise(r=>server.close(r));}
});
