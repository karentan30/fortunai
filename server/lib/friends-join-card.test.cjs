'use strict';
// 相亲登记表 + 相亲名片：登记表保存（joinForm）、公开名片白名单、每个开关各管一个字段、审核前只有昵称、新文案没有禁用词。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createReviewAdmin}=require('./friends-review'),{createJoinCard,publicPayload,SHOW_DEFAULTS,PENDING_NOTE}=require('./friends-join-card');
const {createFriendsQuestionnaireService,BANK}=require('./friends-questionnaire');
const GUARD=require('./friends-copy-guard');
const {createCompatibilityService,VERSION_V4}=require('./friends-compatibility');
const XB=require('./friends-cross-border');

function setup({reviewGate=true}={}){
  const store=createFriendsStore(),charts={verify:()=>({age:30,dayMaster:'丙',element:'火',zodiac:'马'})};
  const service=createFriendsService(store,charts,{reviewGate}),admin=createReviewAdmin(store),card=createJoinCard(store),mq=createFriendsQuestionnaireService({store});
  const join=(uid='u1',extra={})=>service.save(uid,{joinForm:true,credential:'x',consent:true,crossBorderConsent:true,nickname:'阿青',bio:'周末爱爬山',purposes:['serious'],visibility:{dayMaster:'public'},targetStems:['不限'],targetZodiacs:['不限'],listed:true,...extra});
  const shared=(uid='u1',body={})=>card.save(uid,{birth:{date:'1991-08-28',hour:'卯'},gender:'female',contact:'wx-secret-123',...body});
  const addPhoto=uid=>store.transaction(s=>{(s.seriousPages||=[]).push({userId:uid,photos:[{id:'ph1',w:3,h:4}]});});
  const answer=uid=>{const d=BANK.dimensions[0],qs=d.questions.filter(q=>!q.sensitive).slice(0,2),answers={};for(const q of qs){const o=q.options.find(o=>!o.open);answers[q.id]={state:'answered',value:q.type==='multi'?[o.value]:o.value};}mq.saveDimension(uid,d.id,{version:BANK.version,consent:true,status:'in_progress',answers});return d.label;};
  return {store,service,admin,card,mq,join,shared,addPhoto,answer};
}
const FULL={city:'杭州',hobbies:['爬山'],fields:{education:'本科',school:'浙大',occupation:'设计师'}};
const approve=(f,p)=>f.admin.decide(p.shareId,{decision:'approve'});
const FIELD_KEYS=['nickname','status','dayMaster','intro','personality','directions','photos','city','birthday','hour','contact'];

test('登记表：只要昵称、生日、底线题也能存；第一次提交后进审核队列',()=>{
  const f=setup(),p=f.join();
  assert.equal(p.reviewStatus,'pending');assert.equal(p.joinForm,true);assert.deepEqual(f.admin.queue().map(x=>x.shareId),[p.shareId]);
  assert.throws(()=>f.service.save('u1',{joinForm:true,credential:'x',consent:true,crossBorderConsent:true,nickname:''}),{status:400});
});

test('默认开关：照片/城市/生日开，时辰关，联系方式关',()=>{
  assert.deepEqual({...SHOW_DEFAULTS},{photo:true,city:true,birthday:true,hour:false,contact:false});
  const f=setup();f.join('u1',{city:'杭州'});f.shared();
  assert.deepEqual(f.card.own('u1').show,{photo:true,city:true,birthday:true,hour:false,contact:false});
});

test('审核中：公开名片只有昵称 + 资料审核中，联系方式/照片/生日一个都没有',()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});f.shared('u1',{show:{contact:true,hour:true}});f.addPhoto('u1');
  const out=f.card.publicCard(p.shareId);
  assert.deepEqual(out,{nickname:'阿青',status:'pending',note:PENDING_NOTE},'没有邀请时只有这三项');
  assert.equal(JSON.stringify(out).includes('wx-secret-123'),false);
  assert.throws(()=>f.card.photoAllowed(p.shareId,'ph1'),{status:404});
});

test('通过后默认名片：昵称/日主/自我介绍/城市/生日（无时辰、无联系方式）+ 照片',()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});f.shared();f.addPhoto('u1');approve(f,p);
  const out=f.card.publicCard(p.shareId);
  assert.equal(out.status,'approved');assert.equal(out.dayMaster,'丙火');assert.equal(out.intro,'周末爱爬山');assert.equal(out.city,'杭州');assert.equal(out.birthday,'1991-08-28');
  assert.equal(out.hour,undefined);assert.equal(out.contact,undefined);assert.equal(out.photos.length,1);assert.match(out.photos[0].url,/public-card\/.+\/photos\/ph1$/);
  assert.equal(f.card.photoAllowed(p.shareId,'ph1'),true);
  for(const k of Object.keys(out))assert.ok(FIELD_KEYS.includes(k),'unexpected field '+k);
});

test('每个开关只管自己的字段',()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});f.shared();f.addPhoto('u1');approve(f,p);
  const set=show=>{f.card.save('u1',{show});return f.card.publicCard(p.shareId);};
  let o=set({photo:false});assert.equal(o.photos,undefined);assert.equal(o.city,'杭州');assert.throws(()=>f.card.photoAllowed(p.shareId,'ph1'),{status:404});
  o=set({photo:true,city:false});assert.equal(o.city,undefined);assert.equal(o.photos.length,1);
  o=set({city:true,birthday:false,hour:true});assert.equal(o.birthday,undefined);assert.equal(o.hour,undefined,'时辰跟着生日走，生日关则时辰不出');
  o=set({birthday:true,hour:true});assert.equal(o.birthday,'1991-08-28');assert.equal(o.hour,'卯时');
  o=set({hour:false,contact:true});assert.equal(o.contact,'wx-secret-123');assert.equal(o.hour,undefined);
  o=set({contact:false});assert.equal(o.contact,undefined);
  assert.throws(()=>f.card.save('u1',{show:{password:true}}),{status:400});
  assert.throws(()=>f.card.save('u1',{show:{photo:'yes'}}),{status:400});
});

test('开关只管名片：不改发现页/资料里的可见设置',()=>{
  const f=setup({reviewGate:false}),p=f.join('u1',{...FULL,contact:'private-contact'});f.shared();
  const before=JSON.stringify(f.store.read().profiles[0].visibility),beforeContact=f.store.read().profiles[0].contact;
  f.card.save('u1',{show:{city:false,birthday:true,hour:true,contact:true,photo:false}});
  const after=f.store.read().profiles[0];assert.equal(JSON.stringify(after.visibility),before);assert.equal(after.contact,beforeContact);assert.equal(after.listed,true);
  f.join('u2');
  assert.equal(JSON.stringify(f.service.card(p.shareId,'u2')).includes('wx-secret-123'),false,'名片联系方式不会进资料卡');
});

test('名片永远没有：用户 ID、四柱、原始答案；问卷只给方向名称；性格参考只给设为公开的',()=>{
  const f=setup(),p=f.join('u1',{mbti:'INFP',visibility:{dayMaster:'public',mbti:'public',enneagram:'private'}});f.shared();
  const label=f.answer('u1');approve(f,p);
  const out=f.card.publicCard(p.shareId),text=JSON.stringify(out);
  assert.deepEqual(out.directions,[label]);assert.equal(out.personality.mbti,'INFP');assert.equal(out.personality.enneagram,undefined);
  assert.equal(text.includes('"userId"'),false);assert.equal(text.includes('u1'),false);assert.equal(/pillars|四柱|answers|value/.test(text),false);
  for(const k of ['sensitive'])assert.equal(text.includes(k),false);
});

test('已停用或下架的名片 404；性别只存私有',()=>{
  const f=setup(),p=f.join();f.shared();approve(f,p);
  assert.equal(JSON.stringify(f.card.publicCard(p.shareId)).includes('female'),false);
  assert.throws(()=>f.card.publicCard('nope'),{status:404});
  f.card.save('u1',{enabled:false});
  assert.throws(()=>f.card.publicCard(p.shareId),{status:404});
  assert.equal(publicPayload(f.store.read(),null),null);
});

test('名片保存校验：生日格式、时辰、联系方式类型',()=>{
  const f=setup();f.join();
  assert.throws(()=>f.card.save('u1',{birth:{date:'2999-01-01'}}),{status:400});
  assert.throws(()=>f.card.save('u1',{birth:{date:'1991-02-30'}}),{status:400});
  assert.throws(()=>f.card.save('u1',{birth:{date:'1991-08-28',hour:'X'}}),{status:400});
  assert.throws(()=>f.card.save('u1',{contact:123}),{status:400});
  assert.throws(()=>f.card.save('nobody',{}),{status:400});
});

test('新文案没有禁用词、没有分数和百分号',()=>{
  const root=path.join(__dirname,'../..');
  const files=['assets/js/friends-join.js','assets/js/friends-card.js','pages/friends-join.html','pages/friends-card.html','server/lib/friends-join-card.js'];
  const BAN=['算命','破解','化解','开光','转运','改运','择日','保证','必定','必然','不合','不配','相克','面试','大数据','%','％','玄学'];
  const strings=src=>[...src.matchAll(/'([^'\n]*[一-龥][^'\n]*)'|"([^"\n]*[一-龥][^"\n]*)"|>([^<>\n]*[一-龥][^<>\n]*)</g)].map(m=>m[1]||m[2]||m[3]);
  for(const f of files){const txt=strings(fs.readFileSync(path.join(root,f),'utf8')).join('\n');
    for(const w of BAN)assert.equal(txt.includes(w),false,f+' contains '+w);
    assert.deepEqual(GUARD.findForbidden(txt),[],f+' trips the copy guard');}
  const nudge=fs.readFileSync(path.join(root,'assets/js/friends-invite-match.js'),'utf8');
  assert.ok(nudge.includes('把资料填完整，以后遇到和你五行相合的人，我们会推给你。'));
  assert.ok(fs.readFileSync(path.join(root,'assets/js/friends-join.js'),'utf8').includes('已登记。首批成员审核入驻中，遇到和你相合的人，第一时间告诉你。'));
});

const IN={birthday:'1991-08-28',calendar:'solar',time:'06:00',gender:'female'},IN_B={birthday:'1990-03-12',calendar:'solar',time:'14:00',gender:'male'};
const authBody=input=>({version:VERSION_V4,consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input});

async function ownerWithInvite(f,p){
  const compat=createCompatibilityService({store:f.store});f.card.useCompat(compat);
  const pair=compat.create('u1',{ownerNickname:'阿青',relation:'friend'});
  assert.equal(f.card.publicCard(p.shareId).canPair,undefined,'主人还没授权生辰时没有入口');
  await compat.authorize('u1',pair.id,authBody(IN));
  assert.throws(()=>f.card.save('u2',{invite:{pairId:pair.id,token:pair.inviteToken}}),{status:400});
  f.card.save('u1',{invite:{pairId:pair.id,token:pair.inviteToken}});
  assert.throws(()=>f.card.save('u1',{invite:{pairId:pair.id,token:'x'.repeat(43)}}),{status:400});
  return {compat,pair};
}

test('审核中的名片也能走完合盘；打开页面不发邀请，点按钮才发；页面里没有邀请令牌',async()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});f.shared('u1',{show:{contact:true}});f.addPhoto('u1');
  assert.equal(f.card.publicCard(p.shareId).status,'pending');
  const {compat,pair}=await ownerWithInvite(f,p);
  const before=f.store.read().compatibilityPairs.length;
  const out=f.card.publicCard(p.shareId);
  assert.equal(out.status,'pending');
  assert.deepEqual(Object.keys(out).sort(),['canPair','nickname','note','status'],'审核中仍然不给照片、联系方式、生日等，也不给令牌');
  f.card.publicCard(p.shareId);f.card.publicCard(p.shareId);
  assert.equal(f.store.read().compatibilityPairs.length,before,'只看页面不会发邀请');
  assert.equal(f.card.own('u1').inviteOk,true);
  XB.grant(f.store,'visitor');
  const t=f.card.mintInvite(p.shareId).inviteToken;
  assert.notEqual(t,pair.inviteToken,'库里没有令牌明文，所以补发新的');
  assert.equal(f.store.read().compatibilityPairs.length,before+1);
  assert.deepEqual(compat.invitePreview(t),{ownerNickname:'阿青',relation:'friend'});
  const j=await compat.join('visitor',{inviteToken:t,nickname:'阿木',claimConsent:true,...authBody(IN_B)});
  assert.ok(j.id);
  assert.equal(f.card.own('u1').inviteOk,true,'主人自己的原邀请没被认领');
});

test('同一张名片发给多个人：每个访客各自能走完合盘',async()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});
  const {compat}=await ownerWithInvite(f,p);
  XB.grant(f.store,'v1','v2','v3');
  const ts=[];
  for(const [v,nick] of [['v1','阿木'],['v2','阿林'],['v3','阿禾']]){
    const t=f.card.mintInvite(p.shareId).inviteToken;ts.push(t);
    const j=await compat.join(v,{inviteToken:t,nickname:nick,claimConsent:true,...authBody(IN_B)});
    assert.ok(j.id);assert.equal(j.mode,'open_invite');
  }
  assert.equal(new Set(ts).size,3,'每个访客拿到各自的新邀请');
  const rows=f.store.read().compatibilityPairs.filter(r=>r.from==='u1'&&r.viaCard);
  assert.equal(rows.length,3,'每位访客各补发一条');assert.ok(rows.every(r=>r.to&&r.authorizations.u1));
});

test('名片过期后点按钮仍能补发；每张名片每天最多 20 条',async()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});
  const {compat,pair}=await ownerWithInvite(f,p);
  f.store.transaction(s=>{s.compatibilityPairs.find(r=>r.id===pair.id).expiresAt=new Date(Date.now()-1000).toISOString();});
  assert.equal(f.card.own('u1').inviteOk,false);
  const t=f.card.mintInvite(p.shareId).inviteToken;assert.notEqual(t,pair.inviteToken);
  assert.deepEqual(compat.invitePreview(t),{ownerNickname:'阿青',relation:'friend'});
  for(let i=0;i<19;i++){f.store.transaction(s=>{const c=s.profiles.find(x=>x.shareId===p.shareId).shareCard;s.compatibilityPairs.find(r=>r.id===c.invite.pairId).expiresAt=new Date(Date.now()-1000).toISOString();});f.card.mintInvite(p.shareId);}
  f.store.transaction(s=>{const c=s.profiles.find(x=>x.shareId===p.shareId).shareCard;s.compatibilityPairs.find(r=>r.id===c.invite.pairId).expiresAt=new Date(Date.now()-1000).toISOString();});
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:429});
  const n=f.store.read().compatibilityPairs.length;
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:429});assert.equal(f.store.read().compatibilityPairs.length,n,'限流后不再发');
});

test('分享关掉或名片删除后不再发邀请',async()=>{
  const f=setup(),p=f.join('u1',{city:'杭州'});
  const {pair}=await ownerWithInvite(f,p);
  f.store.transaction(s=>{s.compatibilityPairs.find(r=>r.id===pair.id).expiresAt=new Date(Date.now()-1000).toISOString();});
  const n=f.store.read().compatibilityPairs.length;
  f.card.save('u1',{enabled:false});
  assert.throws(()=>f.card.publicCard(p.shareId),{status:404});
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:404});
  assert.equal(f.store.read().compatibilityPairs.length,n,'分享关掉后什么都没发');
  f.card.save('u1',{enabled:true});assert.ok(f.card.mintInvite(p.shareId).inviteToken);
  f.store.transaction(s=>{s.profiles.splice(0);});
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:404});
  assert.throws(()=>f.card.mintInvite('nope'),{status:404});
  assert.throws(()=>f.card.save('u1',{enabled:'no'}),{status:400});
});

test('审核中可以发起和被邀请合盘，但仍不能发认识申请',()=>{
  const f=setup(),a=f.join('u1',FULL),b=f.join('u2',{...FULL,nickname:'阿木'});
  const compat=createCompatibilityService({store:f.store});
  assert.ok(compat.create('u1',{targetShareId:b.shareId}).id,'审核中的人对审核中的名片可以发起合盘');
  approve(f,b);
  assert.throws(()=>f.service.request('u1',b.shareId),{status:409},'审核中不能发认识申请，即使对方已通过');
});

// ---- 上线前复审修复 ----
test('名片必须主人主动创建：已通过、已公开但没建过名片的资料 404（名片/邀请/照片）',async()=>{
  const f=setup({reviewGate:false});
  const p=f.service.save('u1',{credential:'x',consent:true,crossBorderConsent:true,nickname:'阿青',city:'杭州',hobbies:['爬山'],dateActivities:['羽毛球'],purposes:['serious'],visibility:{dayMaster:'public'},fields:FULL.fields,targetStems:['不限'],targetZodiacs:['不限'],listed:true});
  assert.equal(p.listed,true);f.addPhoto('u1');
  const compat=createCompatibilityService({store:f.store});f.card.useCompat(compat);
  assert.throws(()=>f.card.publicCard(p.shareId),{status:404});
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:404});
  assert.throws(()=>f.card.photoAllowed(p.shareId,'ph1'),{status:404});
  // 通过 POST /share-card 创建：照片开关默认关（只有登记表创建默认开）
  f.shared();
  const out=f.card.publicCard(p.shareId);assert.equal(out.photos,undefined);assert.equal(out.city,'杭州');
  assert.throws(()=>f.card.photoAllowed(p.shareId,'ph1'),{status:404});
  f.card.save('u1',{show:{photo:true}});assert.equal(f.card.photoAllowed(p.shareId,'ph1'),true);
});

test('日主只有资料里设为公开才上名片',()=>{
  const f=setup({reviewGate:false}),p=f.join('u1',{...FULL,visibility:{dayMaster:'private'}});f.shared();
  assert.equal(f.card.publicCard(p.shareId).dayMaster,undefined);
  f.join('u1',{...FULL,visibility:{dayMaster:'public'}});
  assert.equal(f.card.publicCard(p.shareId).dayMaster,'丙火');
});

test('问卷方向设为仅自己（privateTopics）后不上名片',()=>{
  const f=setup({reviewGate:false}),p=f.join('u1',FULL);f.shared();const label=f.answer('u1');
  assert.deepEqual(f.card.publicCard(p.shareId).directions,[label]);
  f.mq.setVisibility('u1',{privateTopics:[BANK.dimensions[0].id]});
  assert.deepEqual(f.card.publicCard(p.shareId).directions,[]);
});

test('登记表资料没补全时不进发现页（listed=false），名片照样可用且在审核队列里；补全后才 listed',()=>{
  const f=setup(),p=f.join('u1');
  assert.equal(p.listed,false);assert.equal(p.shareCard.enabled,true);
  assert.deepEqual(f.admin.queue().map(x=>x.shareId),[p.shareId]);
  f.shared();assert.equal(f.card.publicCard(p.shareId).status,'pending');
  approve(f,p);assert.equal(f.card.publicCard(p.shareId).status,'approved');
  assert.equal(f.store.read().profiles[0].listed,false);
  assert.equal(f.join('u1',FULL).listed,true);
});

async function cardWithMint(f){
  const p=f.join('u1',FULL);f.shared();
  const compat=createCompatibilityService({store:f.store});f.card.useCompat(compat);
  const pair=compat.create('u1',{ownerNickname:'阿青',relation:'friend'});
  await compat.authorize('u1',pair.id,authBody(IN));
  f.card.save('u1',{invite:{pairId:pair.id,token:pair.inviteToken}});
  return {p,compat,pair};
}

test('撤回合盘后名片不能再发邀请；补发的邀请保留原授权时间',async()=>{
  const f=setup(),{p,compat,pair}=await cardWithMint(f);XB.grant(f.store,'v');
  const at=f.store.read().compatibilityPairs.find(r=>r.id===pair.id).authorizations.u1.at;
  const t=f.card.mintInvite(p.shareId).inviteToken;
  const minted=f.store.read().compatibilityPairs.find(r=>r.viaCard);
  assert.equal(minted.authorizations.u1.at,at,'沿用当初同意的时间');assert.ok(t);
  compat.revoke('u1',pair.id);
  assert.equal(f.store.read().profiles[0].shareCard.mint,undefined);
  assert.throws(()=>f.card.mintInvite(p.shareId),{status:409});
  assert.equal(f.card.publicCard(p.shareId).canPair,undefined);
});

test('名片补发的邀请不占主人自己每天 10 次；同一人每天最多认领同一主人的 3 条',async()=>{
  const f=setup(),{p,compat}=await cardWithMint(f);XB.grant(f.store,'v');
  const ts=[];for(let i=0;i<12;i++)ts.push(f.card.mintInvite(p.shareId).inviteToken);
  for(let i=0;i<9;i++)compat.create('u1',{ownerNickname:'阿青'});// 原邀请已 1 条，再 9 条 = 10
  assert.throws(()=>compat.create('u1',{ownerNickname:'阿青'}),{status:429},'主人自己的上限仍然是 10');
  for(let i=0;i<3;i++)await compat.join('v',{inviteToken:ts[i],nickname:'阿木',claimConsent:true,...authBody(IN_B)});
  await assert.rejects(()=>compat.join('v',{inviteToken:ts[3],nickname:'阿木',claimConsent:true,...authBody(IN_B)}),{status:429});
  XB.grant(f.store,'w');
  assert.ok((await compat.join('w',{inviteToken:ts[3],nickname:'阿林',claimConsent:true,...authBody(IN_B)})).id,'别的人不受影响');
});

test('库里、me、导出、保存结果都没有邀请令牌明文，也不带授权快照',async()=>{
  const f=setup(),{p,pair}=await cardWithMint(f);XB.grant(f.store,'v');
  const t=f.card.mintInvite(p.shareId).inviteToken;
  const all=[JSON.stringify(f.store.read().profiles),JSON.stringify(f.service.me('u1')),JSON.stringify(f.join('u1',FULL)),JSON.stringify(f.card.own('u1')),JSON.stringify(f.card.publicCard(p.shareId))];
  for(const txt of all){assert.equal(txt.includes(pair.inviteToken),false);assert.equal(txt.includes(t),false);}
  for(const txt of all.slice(1))assert.equal(/"mint"|"invite"|tokenHash/.test(txt),false);
  assert.equal(f.card.own('u1').inviteOk,true);
});
