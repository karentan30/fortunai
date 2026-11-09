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
  const clock={now:NOW},store=createFriendsStore(),charts=createChartService('test-signing-key-'.repeat(4)),service=createFriendsService(store,charts,{clock:()=>clock.now});
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',education:'本科',school:'学校',occupation:'职员'},visibility:{school:'public'},dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'wx',contactConsent:true,...extra});
  const a=service.save('a',data()),b=service.save('b',data()),c=service.save('c',data());
  const r=service.request('a',b.shareId);service.act('b',r.id,'accept');
  return {s:service,store,a,b,c,r,data,clock};
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

test('step 4 without a mutual 想见面 gives a non-blocking reminder',()=>{
  const {s,a,b}=setup();
  const v=s.meetStep('a',b.shareId,{step:4,action:'confirm'});
  assert.equal(v.reminder,UI.COPY.skipReminder);assert.equal(v.skipReminder,UI.COPY.skipReminder);assert.equal(st(v,4).mine,true,'still recorded');
  s.meetStep('a',b.shareId,{step:3,action:'confirm'});s.meetStep('b',a.shareId,{step:3,action:'confirm'});
  let w=s.meetStep('b',a.shareId,{step:4,action:'confirm'});assert.equal(w.reminder,UI.COPY.skipReminder,'video alone is not enough');assert.equal(st(w,4).done,true);
  s.meetDecide('a',b.shareId,{choice:'meet'});s.meetDecide('b',a.shareId,{choice:'meet'});
  s.meetStep('b',a.shareId,{step:4,action:'undo'});w=s.meetStep('b',a.shareId,{step:4,action:'confirm'});assert.equal(w.reminder,null);assert.equal(w.skipReminder,null);
});

for(const [kind,word,minutes] of [['call','通话',15],['video','视频',30],['meet','见面',60]]){
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
  assert.equal(UI.COPY.skipReminder,'建议先视频聊聊，都想见再约');
  assert.equal(UI.STEPS[3].title,'线下见面');assert.equal(UI.STEPS[3].guide,'除了吃饭喝咖啡，也可以一起做点别的——打场球、爬个山、看个展，比干坐着吃一顿饭更容易熟。第一次见面一两个小时就好，意犹未尽比聊到没话说更好。');
  assert.deepEqual(Object.values(UI.CHOICES),['想见面','再聊聊','到这里就好']);assert.equal(UI.COPY.mutual,'你们都想见面');assert.equal(UI.COPY.closed,'这段先到这里，谢谢认识');
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

// ---- 想不想见面（双盲） ----
const talked=x=>{x.s.meetStep('a',x.b.shareId,{step:2,action:'confirm'});x.s.meetStep('b',x.a.shareId,{step:2,action:'confirm'});};
// Everything user b can fetch about this pair, as raw JSON.
const bSees=x=>JSON.stringify([x.s.meet('b',x.a.shareId),x.s.requests('b'),x.s.card(x.a.shareId,'b'),x.s.me('b')]);
const aSees=x=>JSON.stringify([x.s.meet('a',x.b.shareId),x.s.requests('a'),x.s.card(x.b.shareId,'a'),x.s.me('a')]);

test('a one-sided choice never shows up in anything the other side can fetch (raw JSON)',()=>{
  const x=setup();talked(x);const {s,a,b}=x;
  const before=bSees(x);
  for(const choice of ['meet','more','end']){
    const mine=s.meetDecide('a',b.shareId,{choice});assert.equal(mine.decision.mine,choice);assert.equal(mine.decision.outcome,null);
    assert.equal(bSees(x),before,`b's responses are byte-identical after a picks ${choice}`);
  }
  // and the other way round: b's private pick never reaches a, nor b's own decide response
  s.meetDecide('a',b.shareId,{choice:'meet'});const aBefore=aSees(x);
  for(const choice of ['more','meet']){
    if(choice==='meet')break; // meet+meet is the mutual reveal, tested below
    const r=JSON.stringify(s.meetDecide('b',a.shareId,{choice}));assert.equal(JSON.parse(r).decision.mine,'more');
    assert.doesNotMatch(r,/想见面|"meet","at"|decisions/,'b is not told a wants to meet');
    assert.equal(aSees(x),aBefore,'a is not told b picked 再聊聊');
  }
  assert.doesNotMatch(JSON.stringify(s.meet('b',a.shareId)),/decisions|"at":/);
  const html=UI.html(s.meet('b',a.shareId));assert.doesNotMatch(html,/你们都想见面/);
});

test('both 想见面 → 你们都想见面 to both; step 4 reminder goes away',()=>{
  const x=setup();talked(x);const {s,a,b}=x;
  s.meetDecide('a',b.shareId,{choice:'meet'});
  assert.equal(s.meet('a',b.shareId).skipReminder,UI.COPY.skipReminder);
  const v=s.meetDecide('b',a.shareId,{choice:'meet'});
  assert.equal(v.decision.outcome,'mutual');assert.equal(v.decision.message,'你们都想见面');assert.equal(v.skipReminder,null);
  assert.equal(s.meet('a',b.shareId).decision.message,'你们都想见面');
  assert.match(UI.html(s.meet('a',b.shareId)),/你们都想见面/);
  // Before an outcome a choice can still be changed; after it, the outcome is final (no probing by flipping).
  assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'more'})),409);assert.equal(s.meet('b',a.shareId).decision.outcome,'mutual');
  const y=setup();talked(y);y.s.meetDecide('a',y.b.shareId,{choice:'more'});y.s.meetDecide('a',y.b.shareId,{choice:'meet'});
  assert.equal(y.s.meet('a',y.b.shareId).decision.mine,'meet','re-choosing before any outcome still works');
});

test('decide is final once the outcome is closed: neither side can flip to learn the other choice',()=>{
  const x=setup();talked(x);const {s,a,b,clock}=x;
  s.meetDecide('b',a.shareId,{choice:'end'});s.meetDecide('a',b.shareId,{choice:'meet'});
  for(const [u,t] of [['a',b],['b',a]])for(const choice of ['meet','more','end'])assert.equal(code(()=>s.meetDecide(u,t.shareId,{choice})),409,u+' '+choice);
  assert.equal(s.meet('a',b.shareId).decision.mine,'meet');
  // closed by the 7-day quiet rule: also final
  const y=setup();talked(y);y.s.meetDecide('a',y.b.shareId,{choice:'end'});y.clock.now=NOW+7*86400000;
  assert.equal(code(()=>y.s.meetDecide('b',y.a.shareId,{choice:'meet'})),409);assert.equal(code(()=>y.s.meetDecide('a',y.b.shareId,{choice:'more'})),409);
});

test('connection whose purposes became isolated: meet routes 404 like blocked (married_buddy vs dating)',()=>{
  const x=setup();const {s,a,b,store,data}=x;
  assert.equal(code(()=>s.meet('a',b.shareId)),200);
  s.save('a',data({purposes:['married_buddy']}));s.save('b',data({purposes:['buddy','dating']}));
  assert.equal(code(()=>s.meet('a',b.shareId)),404);assert.equal(code(()=>s.meet('b',a.shareId)),404);
  assert.equal(code(()=>s.meetStep('a',b.shareId,{step:2,action:'confirm'})),404);
  assert.equal(code(()=>s.meetAppointment('b',a.shareId,{kind:'voice',action:'cancel'})),404);
  assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'meet'})),404);
  assert.equal(code(()=>s.commonSlots('a',b.shareId,{})),404);
  // admin-verified 婚况 has the same effect even if the stored choice is 找搭子
  const y=setup();y.s.save('b',y.data({purposes:['dating']}));
  assert.equal(code(()=>y.s.meet('a',y.b.shareId)),200);
  y.store.transaction(st=>{const p=st.profiles.find(p=>p.userId==='a');p.verified={marital:true};p.verifiedDetail={marital:'married'};});
  assert.equal(code(()=>y.s.meet('b',y.a.shareId)),404);
});

test('到这里就好: neutral close only after the other answers or after 7 days; never says who; no auto-disconnect',()=>{
  const x=setup();talked(x);const {s,a,b,clock}=x;
  s.meetDecide('a',b.shareId,{choice:'end'});
  clock.now=NOW+7*86400000-1;assert.equal(s.meet('b',a.shareId).decision.outcome,null,'not before 7 days');
  clock.now=NOW+7*86400000;
  const v=s.meet('b',a.shareId);assert.equal(v.decision.outcome,'closed');assert.equal(v.decision.message,'这段先到这里，谢谢认识');assert.equal(v.decision.mine,null);
  assert.doesNotMatch(JSON.stringify(v),/到这里就好|"end"/,'b is not told who or what');
  assert.equal(s.meet('a',b.shareId).decision.outcome,'closed');
  assert.equal(s.requests('a').find(q=>q.status==='accepted')?.status,'accepted','still connected');
  assert.doesNotMatch(UI.html(v),/约个见面时间/,'no booking button once closed');
  // the other side answering also closes it (before 7 days)
  const y=setup();talked(y);y.s.meetDecide('b',y.a.shareId,{choice:'end'});assert.equal(y.s.meet('a',y.b.shareId).decision.outcome,null);
  const w=y.s.meetDecide('a',y.b.shareId,{choice:'meet'});assert.equal(w.decision.outcome,'closed');assert.equal(w.decision.mine,'meet');
  assert.doesNotMatch(JSON.stringify(w),/"end"|到这里就好/);
});

test('decision: only after step 2 or 3, valid choices, pair only, hidden by block, removed with the pair',()=>{
  const x=setup();const {s,a,b,c}=x;
  assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'meet'})),409,'not before talking');
  assert.equal(s.meet('a',b.shareId).decision.available,false);
  s.meetStep('a',b.shareId,{step:3,action:'confirm'});s.meetStep('b',a.shareId,{step:3,action:'confirm'});
  assert.equal(s.meet('a',b.shareId).decision.available,true,'video alone (voice skipped) is enough');
  assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'maybe'})),400);
  assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'toString'})),400);
  assert.equal(code(()=>s.meetDecide('c',a.shareId,{choice:'meet'})),403);
  s.meetDecide('a',b.shareId,{choice:'meet'});
  s.block('b',a.shareId);assert.equal(code(()=>s.meet('a',b.shareId)),404);assert.equal(code(()=>s.meetDecide('a',b.shareId,{choice:'end'})),404);
  const y=setup();talked(y);y.s.meetDecide('a',y.b.shareId,{choice:'meet'});y.s.remove('a');assert.equal(JSON.stringify(y.store.read()).includes('decisions'),false);
});

test('meet: 一起做什么 is optional, from the list, shared first, shown in the booked line',()=>{
  const x=setup();const {s,a,b,data}=x;
  s.save('a',data({dateActivities:['看展','羽毛球']}));s.save('b',data({dateActivities:['羽毛球','游泳','看展']}));
  const opts=s.meet('a',b.shareId).activities;
  assert.deepEqual(opts.shared,['羽毛球','看展']);assert.deepEqual(opts.options.slice(0,4),['羽毛球','看展','吃饭','喝咖啡']);
  assert.equal(new Set(opts.options).size,opts.options.length);assert.ok(opts.options.includes('攀岩'));
  const slot=[{date:'2026-11-14',time:'15:00'}],bad=body=>code(()=>s.meetAppointment('a',b.shareId,{action:'propose',slots:slot,...body}));
  assert.equal(bad({kind:'meet',activity:'蹦极'}),400);assert.equal(bad({kind:'meet',activity:['羽毛球']}),400);assert.equal(bad({kind:'video',activity:'羽毛球'}),400);
  assert.equal(bad({kind:'meet',activity:'吃饭'}),200);
  const v=s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,activity:'羽毛球',place:'体育馆'});
  assert.equal(v.reminder,UI.COPY.skipReminder);
  const w=s.meetAppointment('b',a.shareId,{kind:'meet',action:'pick',start:v.appointments.meet.schedule.proposals[0].start});
  assert.equal(w.appointments.meet.schedule.text,'已约好：11月14日（周六）15:00 · 羽毛球 · 体育馆');
  const html=UI.html(w);assert.match(html,/运动量量力而行/);assert.match(html,/边运动边聊，不用一直找话题/);
  assert.doesNotMatch(UI.html(s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,activity:'吃饭'})),/运动量量力而行/);
  assert.match(UI.html(w,NOW,'meet'),/<optgroup label="你们都选了"><option value="(看展|羽毛球)">/);
  const all=JSON.stringify([UI.COPY,UI.CHOICES,UI.SPORT_SAFETY('徒步爬山')]);assert.deepEqual(findForbidden(all),[]);
});

test('voice call is 15 minutes everywhere: kind, step 2 copy, topic heading, .ics',()=>{
  assert.equal(UI.KINDS.call.minutes,15);assert.match(UI.STEPS[1].guide,/15分钟就好，聊得来下次再聊久一点/);assert.match(TOPICS.TOPICS[2].hint,/^15 分钟/);
  const all=JSON.stringify([UI.STEPS,UI.KINDS,TOPICS]);assert.doesNotMatch(all,/20 ?分钟/);
  const {s,a,b}=setup();const v=s.meetAppointment('a',b.shareId,{kind:'call',action:'propose',slots:[{date:'2026-11-12',time:'20:00'}]});
  const booked=s.meetAppointment('b',a.shareId,{kind:'call',action:'pick',start:v.appointments.call.schedule.proposals[0].start}).appointments.call.schedule;
  const ics=UI.ics('call',booked);assert.match(ics,/DTSTART:20261112T120000Z/);assert.match(ics,/DTEND:20261112T121500Z/);
});

test('meet length: default by activity (咖啡1h/吃饭1.5h/运动等2h/没选1h), adjustable, used for end time and .ics',()=>{
  const {s,a,b}=setup();const slot=[{date:'2026-11-14',time:'15:00'}];
  const book=body=>{const v=s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,...body});return s.meetAppointment('b',a.shareId,{kind:'meet',action:'pick',start:v.appointments.meet.schedule.proposals[0].start}).appointments.meet.schedule;};
  for(const [body,min] of [[{},60],[{activity:'喝咖啡'},60],[{activity:'吃饭'},90],[{activity:'羽毛球'},120],[{activity:'看展'},120],[{activity:'吃饭',minutes:240},240],[{activity:'羽毛球',minutes:60},60]]){
    const x=book(body);assert.equal(x.minutes,min,JSON.stringify(body));assert.equal(Date.parse(x.end)-Date.parse(x.start),min*60000);
  }
  assert.match(UI.ics('meet',book({activity:'吃饭'})),/DTEND:20261114T083000Z/,'15:00 Beijing + 1.5h');
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'meet',action:'propose',slots:slot,minutes:45})),400);
  assert.equal(code(()=>s.meetAppointment('a',b.shareId,{kind:'video',action:'propose',slots:slot,minutes:60})),400);
  assert.deepEqual(Object.values(UI.MEET_LENGTHS),['1小时','1.5小时','2小时','半天']);
  assert.match(UI.STEPS[3].guide,/第一次见面一两个小时就好，意犹未尽比聊到没话说更好/);
});
