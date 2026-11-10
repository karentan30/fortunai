'use strict';
// 相合局：分组规则、邀请链接只存哈希、俱乐部隐私、确认/取消、群聊权限、互选、缺席、限流。
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createReviewAdmin}=require('./friends-review');
const Q=require('./friends-questionnaire');
const H=require('./friends-heju-match');
const {createHejuService,LIMITS}=require('./friends-heju');

const HOUR=3600000,DAY=24*HOUR;
// 2026-11-16 周一 09:00 北京时间 = 01:00 UTC
const T0=Date.UTC(2026,10,16,1,0,0);
function setup({gate=true}={}){
  const store=createFriendsStore(),charts={verify:c=>({age:30,dayMaster:c,zodiac:'鼠'})};
  const friends=createFriendsService(store,charts,{reviewGate:gate}),admin=createReviewAdmin(store);
  const clock={t:T0},notices=[];
  const heju=createHejuService(store,{clock:()=>clock.t,notify:(...a)=>notices.push(a)});
  const answers=(over={})=>{
    const dims={};
    for(const id of Q.BANK.quickPath.questions){
      let q,dim;for(const d of Q.BANK.dimensions)for(const x of d.questions)if(x.id===id){q=x;dim=d.id;}
      if(q.sensitive)continue;
      const v=over[id]||{};
      const value=v.value!==undefined?v.value:(q.type==='multi'?[q.options[0].value]:q.options[0].value);
      (dims[dim]=dims[dim]||{status:'done',answers:{}}).answers[id]={state:'answered',value,...(v.importance?{importance:v.importance}:{})};
    }
    return dims;
  };
  const data=(stem,extra={})=>({credential:stem,consent:true,crossBorderConsent:true,nickname:'同学'+stem,city:'北京',intent:'交朋友',
    fields:{height:'170',weight:'60',education:'本科',school:'示范大学',occupation:'暂无',industry:'暂无',title:'暂无',income:'暂不提供',assets:'暂不提供'},
    dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],visibility:{dayMaster:'public',zodiac:'public',education:'public'},listed:true,...extra});
  const people=new Map();
  function person(uid,stem,{approve=true,school,quick=true,over,card=true,extra={}}={}){
    if(card){
      const e={...extra};if(school!==undefined)e.fields={...data(stem).fields,school};
      const p=friends.save(uid,data(stem,e));people.set(uid,p);
      if(approve)admin.decide(p.shareId,{decision:'approve'});
    }
    if(quick)store.transaction(s=>{s.marriageQuestionnaires=(s.marriageQuestionnaires||[]).filter(r=>r.userId!==uid);s.marriageQuestionnaires.push({userId:uid,version:Q.BANK.version,dimensions:answers(over)});});
    return uid;
  }
  const signup=(uid,o={})=>heju.signup(uid,{activity:'羽毛球',windows:['sat-pm','sun-pm'],area:'东校区',adult:true,consent:true,...o});
  const state=()=>store.read();
  return {store,friends,admin,heju,clock,notices,person,signup,state,answers,people};
}
const ids=g=>g.members.map(m=>m.userId).sort();
const groupsOf=s=>s.hejuGroups;

// ---------- 纯函数 ----------
test('活动归一化：去空格转小写、去掉开头动词、同义词合并，不安全的拒绝',()=>{
  const n=H.normalizeActivity;
  assert.equal(n(' 打 羽球 ').key,'羽毛球');assert.equal(n('Badminton').key,'羽毛球');assert.equal(n('去爬山').key,'爬山');assert.equal(n('徒步').key,'爬山');
  assert.equal(n('Running').key,'夜跑');assert.equal(n('约饭').key,'吃饭');assert.equal(n('桌游').key,'桌游');
  for(const bad of ['去KTV唱歌','喝酒','来我家玩','宿舍聚会','','x'.repeat(40),'算命局'])assert.equal(n(bad),null,bad);
  assert.equal(n(7),null);
});
test('日主关系：五合和五行相生（两个方向）算相合，同五行和相克不算',()=>{
  assert.equal(H.relation('甲','己'),'he');assert.equal(H.relation('己','甲'),'he');
  assert.equal(H.relation('甲','壬'),'sheng');assert.equal(H.relation('壬','甲'),'sheng');assert.equal(H.relation('甲','丙'),'sheng');assert.equal(H.relation('丙','甲'),'sheng');
  assert.equal(H.relation('甲','乙'),null);assert.equal(H.relation('甲','庚'),null);assert.equal(H.relation('甲','?'),null);
  for(const w of Object.values(H.RELATION_WORDS))assert.ok(!/\d|分|%/.test(w),w);
});
test('时间段：下一次出现的时间按北京时间算，至少提前 48 小时',()=>{
  const t=H.nextOccurrence('sat-pm',T0,48);
  assert.equal(new Date(t+8*HOUR).toISOString(),'2026-11-21T14:00:00.000Z');
  assert.ok(t>=T0+48*HOUR);
  assert.equal(H.windowOf(t),'sat-pm');
  // 周三上午刚好不足 48 小时，顺延到下周
  assert.equal(new Date(H.nextOccurrence('wed-am',T0+60000,48)+8*HOUR).toISOString(),'2026-11-25T09:00:00.000Z');
  assert.equal(H.nextOccurrence('bad',T0),null);
});
test('地点文字：片区不要门牌，集合点不要私人住所',()=>{
  assert.equal(H.cleanArea('东校区'),'东校区');assert.equal(H.cleanArea('东校区 12号楼'),null);assert.equal(H.cleanArea('我家楼下'),null);
  assert.equal(H.cleanSpot('体育馆南门'),'体育馆南门');assert.equal(H.cleanSpot('我家'),null);assert.equal(H.cleanSpot('宿舍楼下'),null);
});
test('formGroups：人数 3 到 6、每人至少有一位相合的同组人、不放有冲突的人、结果与输入顺序无关',()=>{
  const mk=(userId,dayMaster,i,windows=['sat-pm'])=>({userId,dayMaster,activityKey:'羽毛球',windows,createdAt:'2026-11-0'+(i%9+1),signupId:userId});
  const all=[mk('a','甲',0),mk('b','己',1),mk('c','壬',2),mk('d','庚',3),mk('e','甲',4),mk('f','己',5),mk('g','壬',6),mk('h','丙',7)];
  const ok=()=>true;
  const out=H.formGroups(all,{ok});
  assert.ok(out.length>=1);
  for(const g of out){
    assert.ok(g.members.length>=3&&g.members.length<=6,'size '+g.members.length);
    for(const m of g.members)assert.ok(g.members.some(o=>o!==m&&H.related(m.dayMaster,o.dayMaster)),m.userId+' 没有相合的同伴');
  }
  const seen=new Set();for(const g of out)for(const m of g.members){assert.ok(!seen.has(m.userId));seen.add(m.userId);}
  const shuffled=[...all].reverse();
  assert.deepEqual(H.formGroups(shuffled,{ok}).map(g=>g.members.map(m=>m.userId)),out.map(g=>g.members.map(m=>m.userId)),'顺序不同结果一样');
  // 冲突的人不会同组
  const bad=(a,b)=>!((a.userId==='a'&&b.userId==='b')||(a.userId==='b'&&b.userId==='a'));
  for(const g of H.formGroups(all,{ok:bad}))assert.ok(!(g.members.some(m=>m.userId==='a')&&g.members.some(m=>m.userId==='b')));
  // 只有两个人、或没有共同时间，都不成组
  assert.equal(H.formGroups(all.slice(0,2),{ok}).length,0);
  assert.equal(H.formGroups([mk('a','甲',0,['sat-pm']),mk('b','己',1,['sun-pm']),mk('c','壬',2,['mon-am'])],{ok}).length,0);
  // 一个人没有相合的同伴：不放进去（庚和甲相克，和己？）
  const lone=H.formGroups([mk('a','甲',0),mk('b','己',1),mk('c','壬',2),mk('z','戊',3)],{ok});
  assert.equal(lone.length,1);assert.deepEqual(lone[0].members.map(m=>m.userId).sort(),['a','b','c'],'戊和他们都不相合，不放进去');
  // 7 个互相相合的人：拆成 3 到 6 人的组，没有人落单成 1、2 人组
  const seven=['甲','己','壬','癸','丙','丁','甲'].map((d,i)=>mk('u'+i,d,i));
  for(const g of H.formGroups(seven,{ok}))assert.ok(g.members.length>=3&&g.members.length<=6);
});

// ---------- 报名 ----------
test('报名前置条件：没卡片、没答完 14 题都会被引导；待审核的人可以登记但不会被分组',()=>{
  const {heju,person,signup,clock}=setup();
  assert.throws(()=>signup('nobody'),{code:'need_card'});
  person('noq','甲',{quick:false});
  assert.throws(()=>signup('noq'),e=>e.code==='need_questions'&&/14/.test(e.message)&&e.status===409);
  person('p1','甲',{approve:false});
  const r=signup('p1');
  assert.equal(r.awaitingReview,true);assert.equal(r.waiting,'已登记。人还少，凑齐了才会通知你，不一定很快。');
  assert.equal(r.nudge,'把资料填完整，以后遇到和你五行相合的人，我们会推给你。');
  person('p2','己');person('p3','壬');signup('p2');signup('p3');
  assert.equal(heju.run().groups,0,'待审核的 p1 不参与');
  assert.equal(heju.me('p1').signups.length,1);
});
test('报名校验：成年确认、同意、活动、时间段、片区、同校需要学校',()=>{
  const {person,signup}=setup();person('u','甲');person('nos','甲',{school:'暂无'});
  assert.throws(()=>signup('u',{adult:false}),{code:'need_adult_confirm'});
  assert.throws(()=>signup('u',{consent:false}),{code:'need_consent'});
  assert.throws(()=>signup('u',{activity:'去酒吧喝酒'}),{code:'bad_activity'});
  assert.throws(()=>signup('u',{windows:[]}),{code:'bad_windows'});
  assert.throws(()=>signup('u',{windows:['xx-yy']}),{code:'bad_windows'});
  assert.throws(()=>signup('u',{area:'东校区3号楼201室'}),{code:'bad_area'});
  assert.throws(()=>signup('nos'),{code:'need_school'});
  assert.ok(signup('nos',{sameSchool:false}).signup.id);
  assert.equal(signup('u',{activity:'打羽球'}).signup.activity,'羽毛球');
  assert.equal(signup('u',{activity:'羽毛球',windows:['mon-am']}).signup.windows.length,1,'同一活动再报是更新，不是新增');
});

// ---------- 分组任务 ----------
function four(env){
  const {person,signup}=env;
  for(const [u,s] of [['a','甲'],['b','己'],['c','壬'],['d','丙']]){person(u,s);signup(u);}
}
test('分组：同校、同活动、有共同时间、相合；成组后进入等待确认并留站内通知',()=>{
  const env=setup(),{heju,state,notices}=env;four(env);
  const out=heju.run();
  assert.equal(out.groups,1);
  const g=groupsOf(state())[0];
  assert.deepEqual(ids(g),['a','b','c','d']);assert.equal(g.status,'forming');assert.equal(g.kind,'system');
  assert.ok(g.members.every(m=>m.status==='invited'));
  assert.equal(g.windowKey,'sat-pm');assert.equal(g.activity,'羽毛球');assert.ok(g.eventAt>=T0+48*HOUR);
  assert.equal(heju.me('a').notices[0].event,'group_formed');assert.ok(/凑齐/.test(heju.me('a').notices[0].text));
  assert.equal(notices.filter(n=>n[1]==='group_formed').length,4,'notify 钩子被调用');
  assert.equal(heju.run().groups,0,'再跑一次不会重复成组');
  assert.equal(heju.me('a').signups[0].status,'grouped');
});
test('分组：不同学校、不同活动、没有共同时间、相合覆盖不到的人都不会被放进来',()=>{
  const env=setup(),{person,signup,heju,state}=env;
  for(const [u,s] of [['a','甲'],['b','己'],['c','壬']]){person(u,s);signup(u);}
  person('x','甲',{school:'另一所大学'});signup('x');            // 同校开着，学校不同
  person('y','甲');signup('y',{activity:'篮球'});                // 活动不同
  person('t','己');signup('t',{windows:['mon-eve']});             // 没有共同时间
  person('k','戊');signup('k');                                   // 日主和 a b c 都不相合
  heju.run();
  const g=groupsOf(state());
  assert.equal(g.length,1);
  assert.deepEqual(ids(g[0]),['a','b','c']);
});
test('分组：不关「只和同校」时可以跨校；两边都不要求同校才跨校',()=>{
  const env=setup(),{person,signup,heju,state}=env;
  person('a','甲');person('b','己',{school:'别的大学'});person('c','壬',{school:'第三所大学'});
  signup('a',{sameSchool:false});signup('b',{sameSchool:false});signup('c',{sameSchool:false});
  assert.equal(heju.run().groups,1);
  assert.equal(groupsOf(state())[0].members.length,3);
});
test('分组：同校需要学校一致（两人里任何一人开着都算）',()=>{
  const env=setup(),{person,signup,heju}=env;
  person('a','甲');person('b','己');person('c','壬',{school:'别的大学'});
  signup('a');signup('b');signup('c',{sameSchool:false});
  assert.equal(heju.run().groups,0,'a、b 同校但只有 2 人；c 跨校但 a、b 要求同校');
});
test('分组：底线题明确冲突的两个人不会同组；没标重要性的不同不算冲突',()=>{
  const env=setup(),{person,signup,heju,state}=env;
  person('a','甲',{over:{'family-kids-wish':{value:'want',importance:'essential'}}});
  person('b','己',{over:{'family-kids-wish':{value:'nokids'}}});
  person('c','壬');person('d','丙');
  for(const u of ['a','b','c','d'])signup(u);
  heju.run();
  for(const g of groupsOf(state()))assert.ok(!(ids(g).includes('a')&&ids(g).includes('b')),'a、b 冲突');
  // 同样的不同但没人标重要：可以同组
  const e2=setup();
  e2.person('a','甲',{over:{'family-kids-wish':{value:'want'}}});e2.person('b','己',{over:{'family-kids-wish':{value:'nokids'}}});e2.person('c','壬');
  for(const u of ['a','b','c'])e2.signup(u);
  assert.equal(e2.heju.run().groups,1);
});
test('分组：拉黑的人、被多人举报在案的人不会被分到一起；硬条件不符的人也不会',()=>{
  const env=setup(),{person,signup,heju,state,friends}=env;
  four(env);
  friends.block('a',env.people.get('b').shareId);
  heju.run();
  for(const g of groupsOf(state()))assert.ok(!(ids(g).includes('a')&&ids(g).includes('b')),'互相拉黑过的人不同组');
  // 举报在案
  const e2=setup();four(e2);
  e2.store.transaction(s=>{for(const by of ['r1','r2','r3'])s.reports.push({id:by,by,target:'d',reason:'x',status:'open'});});
  e2.heju.run();
  for(const g of groupsOf(e2.state()))assert.ok(!ids(g).includes('d'));
  // 硬条件：a 的「学历」必须硕士以上，其他人都是本科，所以 a 不会和他们同组（另一个方向也一样）
  const e3=setup();
  e3.person('a','甲',{extra:{expectations:{education:{level:'must',min:'硕士'}}}});e3.person('b','己');e3.person('c','丙');e3.person('d','丁');
  for(const u of ['a','b','c','d'])e3.signup(u);
  e3.heju.run();
  for(const g of groupsOf(e3.state()))assert.ok(!ids(g).includes('a'));
  assert.equal(groupsOf(e3.state()).length,1,'b c d 仍然成组');
});
test('分组：可复现——同样的数据，两次得到同样的组',()=>{
  const run=()=>{const env=setup();four(env);env.person('e','癸');env.signup('e');env.person('f','丁');env.signup('f');env.heju.run();return groupsOf(env.state()).map(g=>[g.windowKey,ids(g).join(',')]);};
  assert.deepEqual(run(),run());
});
test('分组：暂停中的人、被停用的人不参与',()=>{
  const env=setup(),{heju,state,store}=env;four(env);
  store.transaction(s=>{s.moderation=s.moderation||[];s.moderation.push({userId:'d',disabled:true});});
  heju.run();
  for(const g of groupsOf(state()))assert.ok(!ids(g).includes('d'));
});

// ---------- 确认与取消 ----------
test('确认：全员确认后才定下来；集合点在活动前一天才显示',()=>{
  const env=setup(),{heju,state,clock}=env;four(env);heju.run();
  const g=groupsOf(state())[0];
  for(const u of ['a','b','c']){heju.confirm(u,g.id);assert.equal(groupsOf(state())[0].status,'forming');}
  assert.equal(heju.groupView('a',g.id).group.canChat,false);
  heju.confirm('d',g.id);
  assert.equal(groupsOf(state())[0].status,'confirmed');
  const v=heju.groupView('a',g.id).group;
  assert.equal(v.canChat,true);assert.equal(v.spot,undefined);assert.ok(/集合点|发起人/.test(v.spotHint));
  const conv=['a','b','c','d'].find(u=>heju.groupView(u,g.id).group.canSetSpot);
  assert.ok(conv);
  assert.throws(()=>heju.setSpot(conv,g.id,'我家'),{code:'bad_spot'});
  const other=['a','b','c','d'].find(u=>u!==conv);
  assert.throws(()=>heju.setSpot(other,g.id,'体育馆南门'),{status:403});
  heju.setSpot(conv,g.id,'体育馆南门');
  assert.equal(heju.groupView('a',g.id).group.spot,undefined,'还没到前一天');
  clock.t=g.eventAt-20*HOUR;
  assert.equal(heju.groupView('a',g.id).group.spot,'体育馆南门');
  assert.equal(heju.groupView('b',g.id).group.spotVisible,true);
});
test('确认：集合点在全员确认之前不会显示，即使已经临近活动',()=>{
  const env=setup(),{heju,state,clock}=env;four(env);heju.run();
  const g=groupsOf(state())[0];heju.confirm('a',g.id);
  const conv=['a','b','c','d'].find(u=>heju.groupView(u,g.id).group.canSetSpot);
  heju.setSpot(conv,g.id,'体育馆南门');
  clock.t=g.eventAt-2*HOUR;
  assert.equal(heju.groupView('a',g.id).group.spot,undefined);
});
test('取消：有人拒绝后少于 3 人，局取消，其他人回到等待名单；拒绝的人登记作废',()=>{
  const env=setup(),{person,signup,heju,state}=env;
  person('a','甲');person('b','己');person('c','壬');for(const u of ['a','b','c'])signup(u);
  heju.run();const g=groupsOf(state())[0];
  heju.confirm('a',g.id);
  heju.decline('c',g.id);
  const after=groupsOf(state())[0];
  assert.equal(after.status,'cancelled');
  assert.equal(heju.me('a').signups[0].status,'waiting');assert.equal(heju.me('b').signups[0].status,'waiting');
  assert.equal(heju.me('c').signups.length,0);
  assert.ok(heju.me('a').notices.some(n=>n.event==='group_cancelled'));
  assert.equal(heju.run().groups,0,'c 不在了，剩两人不够');
});
test('取消：超过确认时间，没回复的人出局；确认的少于 3 人则取消，够 3 人则定下来',()=>{
  const env=setup(),{heju,state,clock}=env;four(env);heju.run();
  const g=groupsOf(state())[0];
  heju.confirm('a',g.id);heju.confirm('b',g.id);
  clock.t=Date.parse(g.confirmBy)+1000;
  heju.run();
  assert.equal(groupsOf(state())[0].status,'cancelled');
  assert.equal(heju.me('a').signups[0].status,'waiting');
  assert.equal(heju.me('c').signups.length,0,'没回复的人不再排队');
  // 够 3 人
  const e2=setup();four(e2);e2.heju.run();const g2=groupsOf(e2.state())[0];
  for(const u of ['a','b','c'])e2.heju.confirm(u,g2.id);
  e2.clock.t=Date.parse(g2.confirmBy)+1000;e2.heju.run();
  const done=groupsOf(e2.state())[0];assert.equal(done.status,'confirmed');
  assert.deepEqual(done.members.filter(m=>m.status==='confirmed').length,3);
  assert.equal(e2.heju.groupView('d',g2.id).group.me,null,'没回复的人已经出局');
});
