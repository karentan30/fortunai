'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('./friends-hub-track');
const {shape}=require('./friends-growth');
const ENV={FRIENDS_HUB_TRACK_ENABLED:'true',FRIENDS_HUB_BASE:'http://127.0.0.1:8765',FRIENDS_HUB_PROJECT_ID:'xiangsheng',FRIENDS_HUB_SECRET:'s'.repeat(40)};
const wait=()=>new Promise(r=>setTimeout(r,5));

test('disabled by default: nothing is queued or sent',async()=>{
  const sent=[];const t=T.createTracker({env:{...ENV,FRIENDS_HUB_TRACK_ENABLED:undefined},send:p=>sent.push(p)});
  assert.equal(t.enabled,false);assert.equal(t.track('profile_created',{uid:'u1'}),false);await wait();assert.equal(sent.length,0);
  const t2=T.createTracker({env:{...ENV,FRIENDS_HUB_SECRET:'short'},send:p=>sent.push(p)});assert.equal(t2.track('profile_created',{uid:'u1'}),false);
});

test('payload is whitelisted: pseudonymous id, no raw uid, forbidden props dropped',async()=>{
  const sent=[];const t=T.createTracker({env:ENV,send:async p=>{sent.push(p);}});
  const uid='user-12345-real-id';
  t.track('invite_created',{uid,props:{via:'card',email:'a@b.com',phone:'13800000000',birth:'1999-01-01',dayMaster:'甲',answers:[1,2],photo:'x.jpg',contact:'wx123',school:'某大学',note:'自由文本',extra:7}});
  t.track('profile_created',{uid,props:{source:'<script>'}});
  t.track('not_an_event',{uid});
  t.track('card_opened',{uid:'',props:{}});
  await wait();
  assert.equal(sent.length,2);
  assert.deepEqual(Object.keys(sent[0]).sort(),['distinct_id','event','props']);
  assert.deepEqual(sent[0].props,{via:'card'});
  assert.deepEqual(sent[1].props,{});
  const blob=JSON.stringify(sent);
  for(const bad of [uid,'a@b.com','13800000000','1999-01-01','甲','x.jpg','wx123','某大学','自由文本','script'])assert.ok(!blob.includes(bad),'leaked '+bad);
  assert.match(sent[0].distinct_id,/^[0-9a-f]{32}$/);
  assert.equal(sent[0].distinct_id,T.pseudonym(ENV.FRIENDS_HUB_SECRET,uid));
  assert.notEqual(T.pseudonym('x'.repeat(40),uid),sent[0].distinct_id);
});

test('never throws or blocks: failing sender, bounded queue, per-day dedupe',async()=>{
  let n=0;const t=T.createTracker({env:ENV,maxQueue:3,send:()=>{n++;return new Promise(()=>{});}}); // sender that never resolves
  assert.doesNotThrow(()=>{for(let i=0;i<10;i++)t.track('compat_free_done',{uid:'u'+i});});
  assert.ok(t._queueLength()<=3);
  const bad=T.createTracker({env:ENV,send:async()=>{throw Error('down');}});
  assert.equal(bad.track('heju_signup',{uid:'u'}),true);await wait();assert.equal(bad._queueLength(),0);
  let day=Date.parse('2026-11-10T01:00:00Z');const sent=[];
  const d=T.createTracker({env:ENV,now:()=>day,send:async p=>{sent.push(p);}});
  assert.equal(d.track('card_opened',{uid:'card:a',dedupe:'a'}),true);
  assert.equal(d.track('card_opened',{uid:'card:a',dedupe:'a'}),false);
  assert.equal(d.track('card_opened',{uid:'card:b',dedupe:'b'}),true);
  day+=86400000;assert.equal(d.track('card_opened',{uid:'card:a',dedupe:'a'}),true);
});

test('growth shaping: funnel, targets and window',()=>{
  const days=Array.from({length:40},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0'));
  const ev=(c,d)=>({daily:{[days[39]]:{count:c,distinct:d}},total:c,distinct:d});
  const hub={scope:'xiangsheng',tz:'Asia/Shanghai',days,events:{profile_created:ev(100,100),profile_complete:ev(80,80),invite_claimed:ev(30,30),compat_free_done:ev(50,50),compat_paid:ev(2,2)}};
  const s=shape(hub,30);
  assert.equal(s.rows.length,30);assert.equal(shape(hub,7).rows.length,7);
  const by=k=>s.targets.find(t=>t.key===k).actual;
  assert.equal(by('users'),80);assert.equal(by('invite_per_user'),0.3);assert.equal(by('paid_per100'),4);assert.equal(by('first_paid'),2);
  assert.equal(s.funnel[1].fromPrev,80);
  assert.equal(shape({}).rows.length,0);
});

test('call sites fire with a fake sender (invite/claim/free-compat/profile/card)',async()=>{
  const sent=[];T._setTrackerForTest(T.createTracker({env:ENV,send:async p=>{sent.push(p);}}));
  try{
    const {createSqliteFriendsStore}=require('./friends-sqlite');void createSqliteFriendsStore;
    // 路由层：假 service，只验证埋点钩子在成功后触发、失败时不触发
    const express=require('express'),{createCompatibilityRouter}=require('../routes/friends-compatibility');
    const ok={create:async()=>({inviteToken:'t'}),claim:async()=>({}),join:async()=>({}),report:async()=>({}),status:()=>({}),list:()=>({})};
    const bad={...ok,claim:async()=>{throw Object.assign(Error('x'),{status:404});}};
    const mk=svc=>{const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:'42'};next();});app.use('/c',createCompatibilityRouter({express,auth:(q,r,n)=>n(),service:svc,canAccess:()=>true}));return app;};
    const go=async(app,method,path,body)=>{const srv=app.listen(0,'127.0.0.1');await new Promise(r=>srv.once('listening',r));try{const r=await fetch('http://127.0.0.1:'+srv.address().port+path,{method,headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},body:body?JSON.stringify(body):undefined});return r.status;}finally{srv.close();}};
    await go(mk(ok),'POST','/c/pairs',{});await go(mk(ok),'POST','/c/claim',{});await go(mk(ok),'POST','/c/join',{});
    await go(mk(ok),'GET','/c/pairs/abc/report');await go(mk(ok),'GET','/c/pairs/abc/report'); // 同一天同一对只记一次
    await go(mk(bad),'POST','/c/claim',{});
    await wait();
    const names=sent.map(p=>p.event+(p.props.via?':'+p.props.via:'')+(p.props.kind?':'+p.props.kind:''));
    assert.deepEqual(names.sort(),['compat_free_done:pair','invite_claimed:claim','invite_claimed:join','invite_created:direct'].sort());
  }finally{T._setTrackerForTest(null);}
});

test('heju: confirmed group fires heju_confirmed after commit (real service)',async()=>{
  const sent=[];T._setTrackerForTest(T.createTracker({env:ENV,send:async p=>{sent.push(p);}}));
  try{
    const {setup}=require('./friends-heju-env.cjs'),env=setup(),{heju}=env;
    for(const [u,s] of [['a','甲'],['b','己'],['c','壬']])env.person(u,s);
    const {inviteToken}=heju.createGroup('a',{activity:'羽毛球',windowKey:'sat-pm',area:'东校区',capacity:3,adult:true});
    const g=()=>env.state().hejuGroups[0],mid=u=>g().members.find(m=>m.userId===u).mid;
    heju.joinByInvite('b',inviteToken,{adult:true});heju.decideRequest('a',g().id,mid('b'),true);
    heju.joinByInvite('c',inviteToken,{adult:true});heju.decideRequest('a',g().id,mid('c'),true);
    await wait();
    const confirmed=sent.filter(p=>p.event==='heju_confirmed');
    assert.ok(confirmed.length>=3,'every confirmed member counted');
    assert.equal(new Set(confirmed.map(p=>p.distinct_id)).size,confirmed.length);
    assert.ok(!JSON.stringify(sent).match(/"a"|"b"|"c"|羽毛球|东校区|甲/));
  }finally{T._setTrackerForTest(null);}
});
