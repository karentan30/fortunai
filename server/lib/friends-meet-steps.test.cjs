'use strict';
// 见面四步 + 约时间：双方都确认才算完成、只有这两个人能读写、拉黑/解除/删号后看不到。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');
const {findForbidden}=require('./friends-copy-guard');
const UI=require('../../assets/js/friends-meet-steps');
const TOPICS=require('../../assets/js/friends-meet-topics');

// 2026-11-10 10:00 Beijing (Tuesday)
const NOW=Date.parse('2026-11-10T10:00:00+08:00');
function setup(){
  const store=createFriendsStore(),charts=createChartService('test-signing-key-'.repeat(4)),service=createFriendsService(store,charts,{clock:()=>NOW});
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'职员'},visibility:{school:'public'},dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'wx',contactConsent:true,...extra});
  const a=service.save('a',data()),b=service.save('b',data()),c=service.save('c',data());
  const r=service.request('a',b.shareId);service.act('b',r.id,'accept');
  return {s:service,store,a,b,c,r,data};
}
const st=(v,n)=>v.steps[n-1];
const code=fn=>{try{fn();}catch(e){return e.status;}return 200;};

test('a step completes only when both confirm; one side shows waiting; undo reverts',()=>{
  const {s,a,b}=setup();
  let v=s.meetStep('a',b.shareId,{step:2,action:'confirm'});
  assert.equal(st(v,2).mine,true);assert.equal(st(v,2).done,false);
  const other=s.meet('b',a.shareId);assert.equal(st(other,2).theirs,true);assert.equal(st(other,2).mine,false);assert.equal(st(other,2).done,false);
  v=s.meetStep('b',a.shareId,{step:2,action:'confirm'});assert.equal(st(v,2).done,true);
  v=s.meetStep('a',b.shareId,{step:2,action:'undo'});assert.equal(st(v,2).done,false);assert.equal(st(v,2).mine,false);assert.equal(st(v,2).theirs,true);
  assert.equal(code(()=>s.meetStep('a',b.shareId,{step:5,action:'confirm'})),400);
  assert.equal(code(()=>s.meetStep('a',b.shareId,{step:1,action:'nope'})),400);
});

test('non-connected users can neither read nor write; pending is not connected',()=>{
  const {s,a,b,c}=setup();
  assert.equal(code(()=>s.meet('c',a.shareId)),403);
  assert.equal(code(()=>s.meetStep('c',a.shareId,{step:1,action:'confirm'})),403);
  assert.equal(code(()=>s.meetAppointment('c',a.shareId,{kind:'video',action:'propose',slots:[{date:'2026-11-12',time:'20:00'}]})),403);
  assert.equal(code(()=>s.meet('a',a.shareId)),404,'not with yourself');
  s.request('c',a.shareId);assert.equal(code(()=>s.meet('c',a.shareId)),403,'pending request is not enough');
  assert.equal(code(()=>s.meet('a','nope')),404);
  assert.equal(code(()=>s.meet('b',a.shareId)),200);
});

test('已视频见过 badge only after both confirm step 3, only to the pair, never on card/discover',()=>{
  const {s,a,b,c}=setup();
  s.meetStep('a',b.shareId,{step:3,action:'confirm'});
  assert.equal(s.meet('a',b.shareId).videoMet,false,'one side is not enough');
  s.meetStep('b',a.shareId,{step:3,action:'confirm'});
  assert.equal(s.meet('a',b.shareId).videoMet,true);assert.equal(s.meet('b',a.shareId).videoMet,true);
  const leak=x=>JSON.stringify(x).match(/videoMet|已视频见过|meetSteps|appointments/);
  assert.equal(leak(s.card(a.shareId,'c')),null);assert.equal(leak(s.card(a.shareId,'b')),null,'not even in the card API');
  assert.equal(leak(s.discover('c')),null);
  assert.equal(code(()=>s.meet('c',a.shareId)),403);
  const html=UI.html(s.meet('a',b.shareId));assert.match(html,/已视频见过/);assert.match(html,/双方自己确认，不是平台核验/);assert.doesNotMatch(html,/实名|认证/);
});

test('blocking hides the state; disconnect purges it; reconnect starts fresh; delete removes it',()=>{
  const {s,store,a,b,r}=setup();
  s.meetStep('a',b.shareId,{step:1,action:'confirm'});s.meetAppointment('a',b.shareId,{kind:'call',action:'propose',slots:[{date:'2026-11-12',time:'20:00'}]});
  s.block('b',a.shareId);
  assert.equal(code(()=>s.meet('a',b.shareId)),404);assert.equal(code(()=>s.meet('b',a.shareId)),404);
  assert.equal(code(()=>s.meetStep('a',b.shareId,{step:1,action:'confirm'})),404);
  // fresh pair for disconnect/delete
  const x=setup();x.s.meetStep('a',x.b.shareId,{step:1,action:'confirm'});
  x.s.act('a',x.r.id,'disconnect');assert.equal(code(()=>x.s.meet('a',x.b.shareId)),403);
  assert.equal((x.store.read().meetSteps||[]).length,0,'disconnect deletes the record');
  const again=x.s.request('b',x.a.shareId);x.s.act('a',again.id,'accept');assert.equal(st(x.s.meet('a',x.b.shareId),1).mine,false,'reconnect starts fresh');
  const y=setup();y.s.meetStep('a',y.b.shareId,{step:4,action:'confirm'});assert.equal(y.store.read().meetSteps.length,1);
  y.s.remove('a');assert.equal(y.store.read().meetSteps.length,0,'account deletion removes it');
  assert.ok(r);
});

test('skipping video to mark step 4 gives a non-blocking reminder',()=>{
  const {s,a,b}=setup();
  const v=s.meetStep('a',b.shareId,{step:4,action:'confirm'});
  assert.equal(v.reminder,UI.COPY.skipReminder);assert.equal(v.skipReminder,UI.COPY.skipReminder);assert.equal(st(v,4).mine,true,'still recorded');
  s.meetStep('a',b.shareId,{step:3,action:'confirm'});s.meetStep('b',a.shareId,{step:3,action:'confirm'});
  const w=s.meetStep('b',a.shareId,{step:4,action:'confirm'});assert.equal(w.reminder,null);assert.equal(w.skipReminder,null);assert.equal(st(w,4).done,true);
});

for(const [kind,word,minutes] of [['call','通话',20],['video','视频',30],['meet','见面',60]]){
  test(`appointment ${kind}: propose → counter → pick → cancel, with ${minutes} min`,()=>{
    const {s,a,b}=setup();
    let v=s.meetAppointment('a',b.shareId,{kind,action:'propose',slots:[{date:'2026-11-12',time:'20:00'},{date:'2026-11-13',time:'19:30'}],...(kind==='meet'?{place:'静安寺附近咖啡馆'}:{})});
    assert.equal(v.appointments[kind].schedule.status,'proposed');assert.equal(v.appointments[kind].schedule.byMe,true);
    assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind,action:'pick',start:v.appointments[kind].schedule.proposals[0].start})),409,'proposer cannot pick own slot');
    // 换个时间: b counters
    v=s.meetAppointment('b',a.shareId,{kind,action:'propose',slots:[{date:'2026-11-14',time:'15:00'}]});
    const mineView=s.meet('a',b.shareId).appointments[kind].schedule;assert.equal(mineView.byMe,false);assert.equal(mineView.proposals.length,1);
    v=s.meetAppointment('a',b.shareId,{kind,action:'pick',start:mineView.proposals[0].start,...(kind==='meet'?{}:{})});
    const booked=v.appointments[kind].schedule;assert.equal(booked.status,'booked');
    assert.equal(booked.text,'已约好：11月14日（周六）15:00 '+word);
    assert.equal(Date.parse(booked.end)-Date.parse(booked.start),minutes*60000);
    assert.equal(s.meet('b',a.shareId).appointments[kind].schedule.text,booked.text,'both see it');
    const row=s.requests('a').find(q=>q.status==='accepted');assert.equal(row.upcoming.tag,'待'+word);
    assert.equal(s.requests('c').length,0);
    s.meetAppointment('b',a.shareId,{kind,action:'cancel'});assert.equal(s.meet('a',b.shareId).appointments[kind].schedule,null);
    assert.equal(s.requests('a').find(q=>q.status==='accepted').upcoming,undefined);
  });
}

test('meet place: optional, ≤40 chars, copy guard, pair only; shown as 见面 · 地点',()=>{
  const {s,a,b}=setup();const slot=[{date:'2026-11-12',time:'12:00'}];
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,place:'x'.repeat(41)})),400);
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,place:'去庙里开光'})),400);
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'video',action:'propose',slots:slot,place:'咖啡馆'})),400);
  const v=s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,place:'  国金中心 一楼咖啡 '});
  const w=s.meetAppointment('b',a.shareId,{kind:'meet',action:'pick',start:v.appointments.meet.schedule.proposals[0].start});
  assert.equal(w.appointments.meet.schedule.text,'已约好：11月12日（周四）12:00 见面 · 国金中心 一楼咖啡');
  assert.equal(w.skipReminder,UI.COPY.skipReminder,'meeting before video gets the reminder');
});

test('past, too-far, malformed and too many slots are rejected',()=>{
  const {s,b}=setup();const p=slots=>code(()=>s.meetAppointment('a',b.shareId,{kind:'video',action:'propose',slots}));
  assert.equal(p([{date:'2026-11-10',time:'09:30'}]),400,'past');
  assert.equal(p([{date:'2026-11-10',time:'10:00'}]),400,'now');
  assert.equal(p([{date:'2026-11-24',time:'10:30'}]),400,'beyond 14 days');
  assert.equal(p([{date:'2026-11-24',time:'10:00'}]),200,'exactly 14 days is fine');
  assert.equal(p([{date:'2026-11-12',time:'25:00'}]),400);
  assert.equal(p([]),400);
  assert.equal(p([1,2,3,4].map(d=>({date:'2026-11-1'+d,time:'20:00'}))),400);
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'toString',action:'cancel'})),400);
});

test('suggested slots come from both availabilities, in Beijing time, on the half hour',()=>{
  const {s,a,b,data}=setup();
  const av={paused:false,timeZone:'Asia/Shanghai',slots:[{weekday:4,start:'19:00',end:'21:00'}]};
  s.save('a',data({availability:av}));
  assert.deepEqual(s.meet('a',b.shareId).appointments.video.suggested,[],'only one side has availability');
  s.save('b',data({availability:{...av,slots:[{weekday:4,start:'20:00',end:'22:00'}]}}));
  const sug=s.meet('a',b.shareId).appointments.video.suggested;
  assert.ok(sug.length>=1);assert.equal(sug[0].label,'11月12日（周四）20:00');
  assert.equal(s.meet('b',a.shareId).appointments.meet.suggested.length>=1,true,'60 min fits 20:00–21:00');
});

test('UI copy: no forbidden words or percent; step 3/skip copy from owner; topics personalise and fall back',()=>{
  const all=JSON.stringify([UI.STEPS,UI.SAFETY,UI.COPY,UI.KINDS,TOPICS]);
  assert.deepEqual(findForbidden(all),[]);assert.doesNotMatch(all,/不合/);
  assert.equal(UI.STEPS[2].guide,'建议先视频：节省交通和时间成本，也能确认是本人。视频聊得有意向了，再约时间见面。');
  assert.equal(UI.COPY.skipReminder,'建议先视频聊聊：省下路上的时间，有意向再约见面，也能确认和照片是同一个人。');
  for(const n of [2,3,4]){const t=TOPICS.TOPICS[n];assert.ok(t.topics.length>=3&&t.topics.length<=4);assert.equal(t.more.length,2);for(const x of [...t.topics,...t.more])assert.ok((x.opener||x.fallback?.opener));}
  assert.match(JSON.stringify(UI.topicList(2,{shared:['羽毛球']})),/羽毛球/);
  const generic=JSON.stringify(UI.topicList(3,{}))+JSON.stringify(UI.topicList(4,{agree:[],differ:[null]}));assert.doesNotMatch(generic,/\{[aq]\}|undefined/);
  assert.notDeepEqual(UI.topicList(2,{},1).items,UI.topicList(2,{},0).items,'换一批 rotates');
  assert.match(TOPICS.TOPICS[4].note,/有好感了再聊大事更自然；先听对方怎么想，不急着下结论/);
});

test('detail dialog mounts 见面四步 only for connected cards, and routes exist',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../../assets/js/friends.js'),'utf8');
  const body=src.slice(src.indexOf('async function showDetail('),src.indexOf('async function showConnections('));
  assert.match(body,/\$\{p\.connected\?'<section id="meet-steps"/);assert.match(body,/if\(p\.connected\)window\.XSMeetSteps\?\.mount\(/);
  const routes=fs.readFileSync(path.join(__dirname,'../routes/friends.js'),'utf8');
  assert.match(routes,/router\.get\('\/meet\/:shareId'/);assert.match(routes,/router\.post\('\/meet\/:shareId'/);assert.match(routes,/router\.post\('\/meet\/:shareId\/appointment'/);
  const ui=fs.readFileSync(path.join(__dirname,'../../assets/js/friends-meet-steps.js'),'utf8');assert.match(ui,/'\/api\/friends\/meet\/'\+encodeURIComponent/);assert.match(ui,/url\+'\/appointment'|send\('\/appointment'/);
  const page=fs.readFileSync(path.join(__dirname,'../../pages/friends-connect.html'),'utf8');assert.ok(page.indexOf('friends-meet-steps.js')<page.indexOf('/assets/js/friends.js"'));assert.match(page,/friends-meet-topics\.js/);
});
