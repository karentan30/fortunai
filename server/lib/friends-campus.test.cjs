'use strict';
// 相生单校区试点：归因首触持久化（URL→localStorage→注册→首次建卡）与校园漏斗按渠道聚合。
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'xs-campus-'));
process.env.EVENTS_DIR=TMP;process.env.ADMIN_TOKEN='adm_campus_test';
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');
const campus=require('./friends-campus');
const {campusFunnel,router:eventsRouter}=require('../routes/events');
const attr=require('../../assets/js/friends-attribution.js');
const page=require('../../assets/js/friends-campus.js');
const SECRET='s'.repeat(40);
after(()=>fs.rmSync(TMP,{recursive:true,force:true}));
const withClub=fn=>{const before=campus.CONFIG.clubs;campus.CONFIG.clubs=[{code:'badminton_club',label:'测试社团'}];try{return fn();}finally{campus.CONFIG.clubs=before;}};
const profileBody=attribution=>({credential:'t',consent:true,nickname:'自报',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',school:'某校（自填）',occupation:'学生',income:'不填',assets:'不填'},hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'wx-test',contactConsent:true,...(attribution?{attribution}:{})});
function fixture(tests=new Set()){const rows=[],log=r=>{rows.push(r);return true;};const funnel=campus.createFunnelSink({secret:SECRET,log,tests});const store=createFriendsStore();const service=createFriendsService(store,{verify:()=>({age:20,dayMaster:'甲',zodiac:'龙'})},{funnel});return {rows,log,funnel,store,service};}

test('client first-touch: params persist, later visits/other params do not overwrite, direct visit never creates a record',()=>{
  const now=Date.parse('2026-11-06T00:00:00Z');
  assert.equal(attr.parse(''),null);assert.equal(attr.parse('?foo=1'),null);
  assert.equal(attr.parse('?source=someone@example.com&club=张三&xref=13800138000'),null,'PII-shaped values never become attribution');
  const first=attr.parse('?source=club&club=badminton_club&campus=campus01&campaign=campus01_d03');
  assert.deepEqual(first,{source:'club',campaign:'campus01_d03',club:'badminton_club',ref:'none',campus:'campus01'});
  const m1=attr.merge(null,first,now);assert.equal(m1.changed,true);
  const stored={at:m1.at,...m1.value};
  const m2=attr.merge(stored,attr.parse('?source=friend&xref=r0123456789a'),now+3*864e5);
  assert.equal(m2.changed,false);assert.equal(m2.value.club,'badminton_club','second link inside 30 days keeps first touch');
  assert.equal(attr.merge(stored,null,now+864e5).value.source,'club','login/register redirect without params keeps it');
  const m3=attr.merge(stored,attr.parse('?source=friend&xref=r0123456789a'),now+31*864e5);
  assert.equal(m3.changed,true);assert.equal(m3.value.ref,'r0123456789a','expired first touch is replaced');
  const url=attr.shareUrl('https://runae.app/pages/friends-campus.html',{source:'friend',ref:'r0123456789a',campus:'campus01',campaign:'campus01_pilot'});
  assert.match(url,/xref=r0123456789a/);assert.deepEqual(attr.parse(new URL(url).search),{source:'friend',campaign:'campus01_pilot',club:'none',ref:'r0123456789a',campus:'campus01'});
});

test('server whitelists: unknown club/campus/ref collapse to none; referral code is stable, opaque and well-formed',()=>{
  assert.deepEqual(campus.campusCodes({club:'not_registered',campus:'campus99',ref:'r123'}),{campus:'none',club:'none',ref:'none'});
  withClub(()=>assert.equal(campus.campusCodes({club:'badminton_club'}).club,'badminton_club'));
  assert.equal(campus.campusCodes({campus:'campus01'}).campus,'campus01');
  const code=campus.referralCode(SECRET,42);assert.match(code,/^r[0-9a-f]{11}$/);assert.equal(code,campus.referralCode(SECRET,'42'));assert.notEqual(code,campus.referralCode(SECRET,43));assert.ok(!code.includes('42'));
  assert.throws(()=>campus.referralCode('short',1));
  assert.equal(campus.fullAttribution({source:'campus',campaign:'campus01_d03'}).campaign,'campus01_d03');
  assert.equal(campus.fullAttribution({campaign:'campus01_张三'}).campaign,'none');
});

test('attribution persists through signup and first profile; later saves and delete/recreate keep the first touch',()=>withClub(()=>{
  const {rows,log,service}=fixture();
  const first={source:'club',campaign:'campus01_pilot',club:'badminton_club',campus:'campus01',ref:'none'};
  assert.equal(campus.logRegistration('u1',first,{secret:SECRET,log}),true);
  assert.equal(campus.logRegistration('u1',undefined,{secret:SECRET,log}),false,'non-相生 registrations are not counted');
  service.save('u1',profileBody(first));
  service.save('u1',profileBody({source:'friend',ref:'r0123456789a'}));
  assert.equal(service.me('u1').acquisition.club,'badminton_club');
  service.remove('u1');service.save('u1',profileBody({source:'wechat'}));
  const me=service.me('u1').acquisition;assert.equal(me.source,'club');assert.equal(me.club,'badminton_club');assert.equal(me.campus,'campus01');
  const reg=rows.find(r=>r.e==='xs_register'),done=rows.filter(r=>r.e==='xs_profile_done');
  assert.equal(done.length,1,'profile completion counted once per person');
  assert.equal(reg.sid,done[0].sid,'register and profile rows share one anonymous person key');
  assert.match(reg.sid,/^u[0-9a-f]{15}$/);assert.equal(reg.club,'badminton_club');assert.equal(done[0].club,'badminton_club');
  assert.ok(!JSON.stringify(rows).includes('u1')&&!JSON.stringify(rows).includes('wx-test'),'no raw user id or contact in event log');
}));

test('rolled back operations emit nothing; self-request and duplicate accept are not counted',()=>{
  const {rows,service,store}=fixture();
  assert.throws(()=>service.save('x',{...profileBody(),nickname:''}));
  assert.equal(rows.length,0);
  service.save('a',profileBody({source:'campus'}));
  const shareA=store.read().profiles.find(p=>p.userId==='a').shareId;
  assert.throws(()=>service.request('a',shareA));
  assert.equal(rows.filter(r=>r.e==='xs_request_sent').length,0);
});

test('campus funnel aggregates per channel: people, mutual-accept pairs, second contact, test accounts excluded',()=>withClub(()=>{
  const {rows,log,service,store}=fixture(new Set(['t1']));
  const pages=[];
  // 两个渠道 + 一个测试账号
  const people=[['a',{source:'club',club:'badminton_club',campus:'campus01',campaign:'campus01_pilot'}],['b',{source:'friend',ref:'r0123456789a',campus:'campus01'}],['c',{source:'club',club:'badminton_club',campus:'campus01'}],['t1',{source:'club',club:'badminton_club'}]];
  for(const [id,a] of people){campus.logRegistration(id,a,{secret:SECRET,log,tests:undefined});service.save(id,profileBody(a));}
  // logRegistration 默认读环境变量的测试名单；这里补一条显式测试标记的注册，验证剔除
  rows.filter(r=>r.e==='xs_register'&&r.sid===campus.personKey(SECRET,'t1')).forEach(r=>{r.x='test';});
  const share=id=>store.read().profiles.find(p=>p.userId===id).shareId;
  const ab=service.request('a',share('b'));service.act('b',ab.id,'accept');
  const ac=service.request('a',share('c'));service.act('c',ac.id,'decline');
  const at=service.request('t1',share('a'));service.act('a',at.id,'accept');
  service.feedback('a',ab.id,'met');
  // 双人邀请聊天：用假的 compatibility 服务验证“再次联系”口径
  const pair={id:'pair1',from:'a',to:'b',status:'ready',messages:[]};
  store.transaction(s=>{s.compatibilityPairs=[pair];});
  const fake={sendMessage(uid,id,{text,at}){store.transaction(s=>{s.compatibilityPairs[0].messages.push({sender:uid,text,createdAt:at});});return {ok:true};},authorize:async()=>({ok:true})};
  campus.instrumentCompatibility(fake,store,campus.createFunnelSink({secret:SECRET,log,tests:new Set(['t1'])}));
  fake.sendMessage('a','pair1',{text:'hi',at:'2026-11-05T02:00:00Z'});
  fake.sendMessage('b','pair1',{text:'hi',at:'2026-11-05T03:00:00Z'});
  assert.equal(rows.filter(r=>r.e==='xs_second_contact').length,0,'same day back-and-forth is not a second contact');
  fake.sendMessage('a','pair1',{text:'again',at:'2026-11-06T02:00:00Z'});
  fake.sendMessage('b','pair1',{text:'again',at:'2026-11-06T03:00:00Z'});
  assert.equal(rows.filter(r=>r.e==='xs_second_contact').length,2,'emitted once per person, not once per message');
  const bySrc=campusFunnel(rows,'src');
  const n=(g,e)=>bySrc.groups[g].find(s=>s.e===e);
  assert.equal(n('club','xs_register').n,2,'test account excluded from club registrations');
  assert.equal(n('club','xs_profile_done').n,2);
  assert.equal(n('friend','xs_register').n,1);
  assert.equal(n('club','xs_request_sent').n,1,'a sent two requests but counts as one person; t1 is test');
  assert.equal(n('club','xs_mutual_accept').n,1);assert.equal(n('friend','xs_mutual_accept').n,1);
  assert.equal(n('club','xs_mutual_accept').pairs,1,'a-b pair counted once even though both accept paths fired');
  assert.equal(n('club','xs_second_contact').n,1);assert.equal(n('friend','xs_second_contact').pairs,1);
  assert.equal(n('club','xs_met_reported').n,1);
  assert.ok(bySrc.excludedTest>=3,'test account rows (register/profile/request/accept) were excluded');
  assert.equal(campusFunnel(rows,'src',{includeTest:true}).groups.club.find(s=>s.e==='xs_register').n,3);
  const byClub=campusFunnel(rows,'club');assert.equal(byClub.groups.badminton_club.find(s=>s.e==='xs_profile_done').n,2);
  const byRef=campusFunnel(rows,'ref');assert.equal(byRef.groups.r0123456789a.find(s=>s.e==='xs_register').n,1);
  assert.deepEqual(bySrc.order,['xs_landing_view','xs_cta_click','xs_register','xs_profile_done','xs_request_sent','xs_mutual_accept','xs_second_contact']);
  void pages;
}));

test('second-contact rule uses Beijing calendar days and needs both people',()=>{
  const p=(msgs)=>({from:1,to:2,messages:msgs.map(([s,t])=>({sender:s,createdAt:t}))});
  assert.equal(campus.isSecondContact(p([[1,'2026-11-05T01:00:00Z'],[1,'2026-11-06T01:00:00Z']])),false,'one-sided');
  assert.equal(campus.isSecondContact(p([[1,'2026-11-05T15:00:00Z'],[2,'2026-11-05T15:30:00Z']])),false,'23:00 and 23:30 Beijing = same day');
  assert.equal(campus.isSecondContact(p([[1,'2026-11-05T15:00:00Z'],[2,'2026-11-05T16:30:00Z']])),true,'23:00 vs 00:30 next Beijing day');
});

test('HTTP: browser cannot forge server-only steps; funnel endpoint returns campus block; referral route issues the code',async()=>{
  const app=express();app.use(express.json());app.use('/api',eventsRouter);
  const {createRouter}=require('../routes/friends');
  const {store}=fixture();
  app.use('/api/friends',createRouter({express,store,secret:SECRET,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
  const server=await new Promise(r=>{const x=app.listen(0,'127.0.0.1',()=>r(x));});
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const beacon=o=>fetch(base+'/api/ev',{method:'POST',headers:{'content-type':'text/plain'},body:JSON.stringify(o)});
    for(const e of ['xs_register','xs_profile_done','xs_request_sent','xs_mutual_accept','xs_second_contact','xs_met_reported'])assert.equal((await beacon({e,sid:'s1',src:'club'})).status,400,e);
    assert.equal((await beacon({e:'xs_landing_view',sid:'s1',src:'club',club:'badminton_club',x:'test'})).status,204);
    assert.equal((await beacon({e:'xs_cta_click',sid:'s1',src:'club',club:'badminton_club'})).status,204);
    await new Promise(r=>setTimeout(r,80));
    const k=await (await fetch(base+'/api/kpi/funnel?days=1&campusBy=club',{headers:{'x-admin-token':'adm_campus_test'}})).json();
    assert.equal(k.campus.by,'club');assert.equal(k.campus.groups.badminton_club.find(s=>s.e==='xs_landing_view').n,1,'client cannot self-mark rows as test');
    assert.equal(k.campus.groups.badminton_club.find(s=>s.e==='xs_register').n,0);
    assert.equal((await fetch(base+'/api/kpi/funnel?days=1')).status,401);
    assert.equal((await fetch(base+'/api/friends/referral')).status,401);
    const r=await (await fetch(base+'/api/friends/referral',{headers:{'X-Test-User':'7'}})).json();
    assert.equal(r.code,campus.referralCode(SECRET,'7'));
  }finally{await new Promise(r=>server.close(r));}
});

test('landing page config: no school name shown until confirmed; entry link carries campus code without overriding first touch',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/data/friends-campus.json'),'utf8'));
  assert.equal(cfg.campus.confirmed,false,'shipped config must not assume a school');
  assert.equal(cfg.campus.schoolName,'');
  assert.ok(!/清华|北大|北京大学|清华大学/.test(JSON.stringify(cfg)));
  assert.deepEqual(page.campusLabel(cfg),{confirmed:false,text:'待确定'});
  assert.equal(page.campusLabel({campus:{schoolName:'某大学',confirmed:false}}).confirmed,false,'filled but unconfirmed stays placeholder');
  assert.deepEqual(page.campusLabel({campus:{schoolName:'某大学',campusName:'东校区',confirmed:true}}),{confirmed:true,text:'某大学 · 东校区'});
  assert.equal(page.entryParams(cfg,{source:'club',club:'x',campus:'none',campaign:'none'}).campus,'campus01');
  assert.equal(page.entryParams(cfg,{source:'club',campaign:'campus01_d03'}).campaign,'campus01_d03');
  assert.match(cfg.campaign,/^campus\d{2}_[a-z0-9]{1,16}$/,'default campaign passes the server whitelist');
  const html=fs.readFileSync(path.join(__dirname,'../../pages/friends-campus.html'),'utf8');
  assert.match(html,/18 周岁/);assert.match(html,/自填/);assert.ok(!/已认证|学籍认证用户|\d+\s*(位|名|人)(同学|用户)已/.test(html.replace(/不声称学籍认证/g,'').replace(/没有做学籍认证/g,'')));
});
