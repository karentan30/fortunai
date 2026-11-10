'use strict';
// 相亲登记表 + 相亲名片：登记表保存（joinForm）、公开名片白名单、每个开关各管一个字段、审核前只有昵称、新文案没有禁用词。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createReviewAdmin}=require('./friends-review'),{createJoinCard,publicPayload,SHOW_DEFAULTS,PENDING_NOTE}=require('./friends-join-card');
const {createFriendsQuestionnaireService,BANK}=require('./friends-questionnaire');
const GUARD=require('./friends-copy-guard');

function setup({reviewGate=true}={}){
  const store=createFriendsStore(),charts={verify:()=>({age:30,dayMaster:'丙',element:'火',zodiac:'马'})};
  const service=createFriendsService(store,charts,{reviewGate}),admin=createReviewAdmin(store),card=createJoinCard(store),mq=createFriendsQuestionnaireService({store});
  const join=(uid='u1',extra={})=>service.save(uid,{joinForm:true,credential:'x',consent:true,crossBorderConsent:true,nickname:'阿青',bio:'周末爱爬山',purposes:['serious'],visibility:{dayMaster:'public'},targetStems:['不限'],targetZodiacs:['不限'],listed:true,...extra});
  const shared=(uid='u1',body={})=>card.save(uid,{birth:{date:'1991-08-28',hour:'卯'},gender:'female',contact:'wx-secret-123',...body});
  const addPhoto=uid=>store.transaction(s=>{(s.seriousPages||=[]).push({userId:uid,photos:[{id:'ph1',w:3,h:4}]});});
  const answer=uid=>{const d=BANK.dimensions[0],qs=d.questions.filter(q=>!q.sensitive).slice(0,2),answers={};for(const q of qs){const o=q.options.find(o=>!o.open);answers[q.id]={state:'answered',value:q.type==='multi'?[o.value]:o.value};}mq.saveDimension(uid,d.id,{version:BANK.version,consent:true,status:'in_progress',answers});return d.label;};
  return {store,service,admin,card,join,shared,addPhoto,answer};
}
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
  assert.deepEqual(out,{nickname:'阿青',status:'pending',note:PENDING_NOTE});
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
  const f=setup({reviewGate:false}),p=f.join('u1',{city:'杭州',contact:'private-contact'});f.shared();
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
  f.store.transaction(s=>{s.profiles[0].listed=false;});
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
