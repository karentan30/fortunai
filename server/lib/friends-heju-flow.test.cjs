'use strict';
// 相合局：邀请链接、用户局、俱乐部隐私、群聊权限、互选、缺席暂停、文案红线。
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {setup,four,T0,HOUR,DAY,LIMITS}=require('./friends-heju-env.cjs');

function mkUserGroup(env,uid='a',o={}){
  return env.heju.createGroup(uid,{activity:'羽毛球',windowKey:'sat-pm',area:'东校区',capacity:4,adult:true,...o});
}
const gOf=env=>env.state().hejuGroups;

// ---------- 邀请链接 ----------
test('邀请链接：状态里只有哈希；坏 token 一律 404；换链接后旧链接失效',()=>{
  const env=setup(),{heju,state}=env;env.person('a','甲');
  const {inviteToken,group}=mkUserGroup(env);
  assert.match(inviteToken,/^[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify(state()).includes(inviteToken),'原始 token 不落库');
  const g=gOf(env)[0];
  assert.equal(g.tokenHash,crypto.createHash('sha256').update(inviteToken).digest('hex'));
  assert.equal(JSON.stringify(group).includes(inviteToken),false);
  for(const bad of ['x','',inviteToken.slice(1),inviteToken+'a','../etc',g.tokenHash])assert.throws(()=>heju.invitePublic(bad),{status:404},bad);
  const fresh=heju.rotateInvite('a',g.id).inviteToken;
  assert.notEqual(fresh,inviteToken);
  assert.throws(()=>heju.invitePublic(inviteToken),{status:404});
  assert.ok(heju.invitePublic(fresh).invite);
});
test('邀请落地页：访客只看到活动、时间、片区、发起人昵称；登录后才有白话相合，没有数字',()=>{
  const env=setup(),{heju}=env;env.person('a','甲');env.person('b','己');
  const {inviteToken}=mkUserGroup(env);
  const text=JSON.stringify(heju.invitePublic(inviteToken).invite);
  assert.ok(text.includes('羽毛球')&&text.includes('东校区')&&text.includes('同学甲'));
  assert.ok(!/userId|members|"mid"|relation|相合/.test(text),'访客看不到成员和关系');
  const mine=JSON.stringify(heju.inviteFor('b',inviteToken));
  assert.ok(/日主相合/.test(mine));
  assert.ok(!/\d\s*[%％]|分数/.test(mine));
});
test('加入申请：创建者通过后才是成员；非创建者不能审批；满员、重复、创建者自己都被拒',()=>{
  const env=setup(),{heju}=env;
  for(const [u,s] of [['a','甲'],['b','己'],['c','壬'],['d','丙']])env.person(u,s);
  const {inviteToken}=mkUserGroup(env,'a',{capacity:3});const gid=gOf(env)[0].id;
  assert.throws(()=>heju.joinByInvite('b',inviteToken,{}),{code:'need_adult_confirm'});
  assert.throws(()=>heju.joinByInvite('a',inviteToken,{adult:true}),{status:409});
  assert.equal(heju.joinByInvite('b',inviteToken,{adult:true}).status,'requested');
  assert.throws(()=>heju.joinByInvite('b',inviteToken,{adult:true}),{status:409});
  const mid=u=>gOf(env)[0].members.find(m=>m.userId===u).mid;
  assert.throws(()=>heju.decideRequest('c',gid,mid('b'),true),{status:404});
  heju.decideRequest('a',gid,mid('b'),true);
  assert.equal(heju.groupView('b',gid).group.me.status,'confirmed');
  heju.joinByInvite('c',inviteToken,{adult:true});
  heju.decideRequest('a',gid,mid('c'),true);
  assert.equal(gOf(env)[0].status,'confirmed');
  assert.throws(()=>heju.joinByInvite('d',inviteToken,{adult:true}),{status:409});
});
test('加入申请：被拉黑的人得到中性提示，不说原因',()=>{
  const env=setup(),{heju,store}=env;env.person('a','甲');env.person('b','己');
  const {inviteToken}=mkUserGroup(env);
  store.transaction(s=>{s.blocks.push({by:'a',target:'b'});});
  assert.throws(()=>heju.joinByInvite('b',inviteToken,{adult:true}),e=>e.status===409&&!/拉黑|举报|底线|条件/.test(e.message));
  assert.equal(gOf(env)[0].members.length,1);
});
test('建局：前置条件、人数 3–6、时间太近、私人地址、每天上限',()=>{
  const env=setup(),{heju}=env;env.person('a','甲');env.person('x','乙',{quick:false});
  assert.throws(()=>mkUserGroup(env,'x'),e=>e.status===409);
  assert.throws(()=>mkUserGroup(env,'a',{adult:false}),{code:'need_adult_confirm'});
  for(const capacity of [2,7,'x'])assert.throws(()=>mkUserGroup(env,'a',{capacity}),{code:'bad_capacity'});
  assert.throws(()=>mkUserGroup(env,'a',{area:'3号楼201室'}),{code:'bad_area'});
  assert.throws(()=>mkUserGroup(env,'a',{activity:'喝酒'}),{code:'bad_activity'});
  assert.throws(()=>mkUserGroup(env,'a',{windowKey:undefined,eventAt:new Date(T0+HOUR).toISOString()}),{code:'bad_time'});
  for(let i=0;i<LIMITS.groupsPerDay;i++)mkUserGroup(env);
  assert.throws(()=>mkUserGroup(env),{status:429});
  assert.ok(heju);
});
test('让系统补人：只邀请相合、兼容、同活动同时间、已审核的人',()=>{
  const env=setup(),{heju}=env;
  env.person('a','甲');env.person('b','己');env.person('c','壬');env.person('y','丙',{approve:false});
  mkUserGroup(env,'a',{fillBySystem:true,capacity:4});
  for(const u of ['b','c','y'])env.signup(u,{windows:['sat-pm']});
  heju.run();
  const inv=gOf(env)[0].members.filter(m=>m.status==='invited').map(m=>m.userId).sort();
  assert.deepEqual(inv,['b','c']);
  assert.equal(heju.me('b').groups[0].needsAction,true);
});

// ---------- 俱乐部 ----------
function clubSetup(){
  const env=setup(),{heju}=env;
  env.person('club','甲');
  heju.markClub({name:'东城羽毛球俱乐部',userId:'club'});
  for(const [u,s] of [['p','己'],['q','壬'],['r','丙'],['s','庚'],['t','癸']])env.person(u,s);
  const {group,inviteToken}=heju.createGroup('club',{activity:'羽毛球',windowKey:'sat-pm',area:'东校区',venue:'体育馆三号场',feeNote:'场地费现场向俱乐部交',capacity:8,recurring:true});
  return {...env,gid:group.id,tok:inviteToken};
}
test('俱乐部：只有标记的账号能开场次；俱乐部只看到昵称和人数，没有 id、学校、日主',()=>{
  const env=clubSetup(),{heju,tok}=env;
  assert.throws(()=>heju.clubGroups('p'),{status:403});
  assert.throws(()=>heju.markClub({name:'算命俱乐部',userId:'p'}));
  for(const u of ['p','q','r','s'])assert.equal(heju.joinByInvite(u,tok,{adult:true}).status,'confirmed');
  const v=heju.clubGroups('club').groups[0],text=JSON.stringify(v);
  for(const f of ['userId','"mid"','school','dayMaster','chart','shareId','credential','createdAt'])assert.ok(!text.includes(f),f);
  assert.ok(text.includes('同学己')&&text.includes('体育馆三号场')&&text.includes('场地费现场向俱乐部交'));
  assert.ok(!/\d\s*[%％]/.test(text));
  assert.equal(v.count,4);
});
test('俱乐部：分桌每桌不超过 4 人，有白话理由；循环场次结束后生成下一场且不重复',()=>{
  const env=clubSetup(),{heju,tok,clock}=env;
  for(const u of ['p','q','r','s','t'])heju.joinByInvite(u,tok,{adult:true});
  const v=heju.clubGroups('club').groups[0];
  const seated=v.tables.filter(t=>t.nicknames.length>=2);
  assert.ok(seated.length>=1);
  for(const t of v.tables)assert.ok(t.nicknames.length<=4);
  for(const t of seated)assert.ok(/相合|相生/.test(t.reason),t.reason);
  const g0=gOf(env)[0];
  clock.t=g0.eventAt+HOUR;heju.run();
  let clubs=gOf(env).filter(g=>g.kind==='club');
  assert.equal(clubs.length,2);assert.equal(clubs[1].eventAt,g0.eventAt+7*DAY);
  heju.run();assert.equal(gOf(env).filter(g=>g.kind==='club').length,2);
});
test('俱乐部：容量范围、没有群聊、局后只能选同桌',()=>{
  const env=clubSetup(),{heju,gid,tok,clock}=env;
  assert.throws(()=>heju.createGroup('club',{activity:'羽毛球',windowKey:'sat-pm',area:'东校区',venue:'体育馆',capacity:99}),{code:'bad_capacity'});
  for(const u of ['p','q','r'])heju.joinByInvite(u,tok,{adult:true});
  assert.throws(()=>heju.chatList('p',gid),{status:403});
  clock.t=gOf(env)[0].eventAt+HOUR;
  assert.throws(()=>heju.pick('p',gid,'ffffffffffff'),{status:404});
});

// ---------- 群聊 ----------
function confirmedGroup(){
  const env=setup(),{heju}=env;four(env);heju.run();
  const g=gOf(env)[0];for(const u of ['a','b','c','d'])heju.confirm(u,g.id);
  return {...env,gid:g.id};
}
test('群聊：成员才能进；未全员确认不能聊；外人 404；活动后 7 天关闭并清掉消息',()=>{
  const env=setup(),{heju,clock}=env;four(env);env.person('x','丁');heju.run();
  const gid=gOf(env)[0].id;
  heju.confirm('a',gid);
  assert.throws(()=>heju.chatPost('a',gid,'hi'),{status:403});
  for(const u of ['b','c','d'])heju.confirm(u,gid);
  assert.throws(()=>heju.chatList('x',gid),{status:404});
  assert.throws(()=>heju.chatPost('x',gid,'hi'),{status:404});
  heju.chatPost('a',gid,'大家好，我带球拍');
  const list=heju.chatList('b',gid);
  assert.equal(list.messages.length,1);assert.equal(list.messages[0].mine,false);
  assert.ok(!JSON.stringify(list).includes('userId'));
  clock.t=gOf(env)[0].eventAt+7*DAY+1000;
  assert.throws(()=>heju.chatList('a',gid),{status:403});
  heju.sweepOnly();assert.equal(env.state().hejuMessages.length,0);
});
test('群聊：限长、限速、空消息；举报自动拉黑并隐藏对方消息',()=>{
  const env=confirmedGroup(),{heju,gid,clock,state}=env;
  assert.throws(()=>heju.chatPost('a',gid,'   '),{status:400});
  assert.equal(heju.chatPost('a',gid,'x'.repeat(900)).message.text.length,LIMITS.chatMax);
  for(let i=1;i<LIMITS.chatPerMinute;i++)heju.chatPost('a',gid,'m'+i);
  assert.throws(()=>heju.chatPost('a',gid,'太快了'),{status:429});
  clock.t+=61000;heju.chatPost('a',gid,'过一分钟又能发');
  const msg=heju.chatList('b',gid).messages[0];
  heju.chatReport('b',gid,msg.id,'骚扰');
  assert.equal(heju.chatList('b',gid).messages.length,0);
  assert.ok(state().reports.some(r=>r.by==='b'&&r.target==='a'&&r.heju));
  assert.ok(state().blocks.some(b=>b.by==='b'&&b.target==='a'));
  assert.throws(()=>heju.chatReport('a',gid,msg.id),{status:404});
});
test('举报与拉黑：成员之间用 mid 操作，外人不行',()=>{
  const env=confirmedGroup(),{heju,gid,state}=env;
  const mid=gOf(env)[0].members.find(m=>m.userId==='c').mid;
  heju.blockMember('a',gid,mid);
  assert.ok(state().blocks.some(b=>b.by==='a'&&b.target==='c'));
  assert.throws(()=>heju.reportMember('a',gid,'ffffffffffff'),{status:404});
  assert.throws(()=>heju.reportMember('zzz',gid,mid),{status:404});
  heju.reportMember('a',gid,mid,'不舒服');
  assert.ok(state().reports.some(r=>r.by==='a'&&r.target==='c'));
});

// ---------- 局后互选 ----------
test('互选：单方选择对方不知道；双方互选才连上；局前不能选',()=>{
  const env=confirmedGroup(),{heju,gid,state,clock}=env;
  const g=gOf(env)[0],mid=u=>g.members.find(m=>m.userId===u).mid;
  assert.throws(()=>heju.after('a',gid),{status:403});
  clock.t=g.eventAt+HOUR;
  heju.pick('a',gid,mid('b'));
  assert.ok(heju.after('b',gid).people.every(p=>!p.picked&&!p.mutual));
  assert.equal(state().requests.length,0);
  heju.pick('b',gid,mid('a'));
  assert.equal(state().requests.filter(r=>r.status==='accepted'&&r.source==='heju').length,1);
  const va=heju.after('a',gid).people.find(p=>p.mid===mid('b'));
  assert.equal(va.mutual,true);assert.equal(va.state,'connected');assert.ok(va.shareId);
  assert.ok(heju.me('a').notices.some(n=>n.event==='pick_mutual'));
  assert.ok(heju.after('c',gid).people.every(p=>!p.mutual));
});
test('互选：待审核的人互选后等审核，通过后自动连上且不重复',()=>{
  const env=setup(),{heju,clock,admin,people,store,state}=env;
  env.person('a','甲');env.person('b','己');env.person('c','壬');
  for(const u of ['a','b','c'])env.signup(u);
  heju.run();const g=gOf(env)[0];for(const u of ['a','b','c'])heju.confirm(u,g.id);
  const mid=u=>gOf(env)[0].members.find(m=>m.userId===u).mid;
  clock.t=g.eventAt+HOUR;
  store.transaction(s=>{const p=s.profiles.find(x=>x.userId==='c');p.reviewStatus='pending';});
  heju.pick('a',g.id,mid('c'));heju.pick('c',g.id,mid('a'));
  const st=heju.after('a',g.id);
  assert.equal(st.people.find(p=>p.mid===mid('c')).state,'waiting_review');assert.ok(st.reviewNote);
  assert.equal(state().requests.filter(r=>r.source==='heju').length,0);
  store.transaction(s=>{const p=s.profiles.find(x=>x.userId==='c');p.reviewStatus='approved';});
  heju.sweepOnly();heju.sweepOnly();
  assert.equal(state().requests.filter(r=>r.source==='heju').length,1);
  assert.ok(admin&&people);
});

// ---------- 缺席与暂停 ----------
test('缺席：活动前不到 2 小时退出记 1 次，2 次暂停 30 天；创建者提前取消不记',()=>{
  const env=setup(),{heju,state,clock}=env;
  env.person('a','甲');env.person('b','己');env.person('c','壬');
  const early=mkUserGroup(env,'a',{capacity:3});
  heju.leave('a',early.group.id);
  assert.equal(state().hejuStrikes.length,0);
  const mkFull=()=>{
    const {inviteToken,group}=mkUserGroup(env,'b',{capacity:3});
    for(const u of ['a','c'])heju.joinByInvite(u,inviteToken,{adult:true});
    const gg=state().hejuGroups.find(x=>x.id===group.id);
    for(const u of ['a','c'])heju.decideRequest('b',gg.id,gg.members.find(m=>m.userId===u).mid,true);
    return gg.id;
  };
  const at=id=>state().hejuGroups.find(g=>g.id===id).eventAt;
  const id1=mkFull();clock.t=at(id1)-HOUR;heju.leave('a',id1);
  assert.equal(state().hejuStrikes.filter(x=>x.userId==='a').length,1);
  assert.equal(heju.me('a').paused,false);
  clock.t=T0+10*DAY;
  const id2=mkFull();clock.t=at(id2)-HOUR;heju.leave('a',id2);
  assert.ok(state().hejuStrikes.some(x=>x.userId==='a'&&x.pausedUntil));
  assert.throws(()=>env.signup('a',{windows:['mon-eve']}),{code:'paused'});
  assert.equal(heju.me('a').paused,true);
  clock.t+=31*DAY;
  assert.equal(heju.me('a').paused,false);
});
test('缺席：提前很久退出不记；自称到场的人不被少数人标记扣分',()=>{
  const env=confirmedGroup(),{heju,gid,state,clock}=env;
  const g=gOf(env)[0],mid=u=>g.members.find(m=>m.userId===u).mid;
  clock.t=g.eventAt+HOUR;
  heju.attendance('a',gid,{attended:true,absent:[mid('d')]});
  heju.attendance('b',gid,{attended:true});
  heju.attendance('c',gid,{attended:true});
  heju.attendance('d',gid,{attended:true});
  clock.t=g.eventAt+25*HOUR;heju.run();
  assert.equal(state().hejuStrikes.length,0);
});
test('缺席：自己选「我没去」记 1 次，结算只发生一次',()=>{
  const env=confirmedGroup(),{heju,gid,state,clock}=env;
  const g=gOf(env)[0];
  clock.t=g.eventAt+HOUR;
  heju.attendance('d',gid,{attended:false});
  clock.t=g.eventAt+25*HOUR;heju.run();heju.run();
  assert.equal(state().hejuStrikes.filter(x=>x.userId==='d').length,1);
  assert.equal(gOf(env)[0].status,'done');
});

// ---------- 文案红线 ----------
test('文案红线：新增的服务端、数据、页面和脚本里没有禁用词、百分比、分数',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const root=path.join(__dirname,'..','..'),files=['server/lib/friends-heju.js','server/lib/friends-heju-match.js','assets/js/friends-heju-data.js'];
  for(const dir of ['pages','assets/js'])for(const f of fs.readdirSync(path.join(root,dir)))if(/^friends-heju.*\.(html|js)$/.test(f))files.push(dir+'/'+f);
  const extra=['算命','破解','化解','开光','转运','改运','择日','保证','必定','必然','不合','不配','相克','面试','大数据','邮箱'];
  const {findForbidden}=require('./friends-copy-guard');
  for(const f of [...new Set(files)]){
    const src=fs.readFileSync(path.join(root,f),'utf8').replace(/^\s*\/\/.*$/gm,'').replace(/<!--[\s\S]*?-->/g,'');
    assert.deepEqual(findForbidden(src),[],f);
    for(const w of extra)assert.ok(!src.includes(w),f+' 含 '+w);
    assert.ok(!/\d\s*[%％]/.test(src),f+' 含百分比');
  }
});
