'use strict';
// 首批审核制 + 核验过的优先推荐. Gate explicitly ON here (library default is off; productionRouter turns it on).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createReviewAdmin}=require('./friends-review'),{createPreviewDeck}=require('./friends-preview-deck');
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}
const ADMIN='admin-token-for-review-tests-'.repeat(2);

function setup({reviewGate=true}={}){
  const store=createFriendsStore(),charts={verify:c=>({age:30,dayMaster:c==='other'?'壬':'丙',zodiac:c==='other'?'鼠':'马'})};
  const service=createFriendsService(store,charts,{reviewGate}),admin=createReviewAdmin(store);
  const data=(extra={})=>({credential:'match',consent:true,crossBorderConsent:true,nickname:'虚构测试',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',education:'本科',school:'暂无',occupation:'暂无',industry:'暂无',title:'暂无',income:'暂不提供',assets:'暂不提供'},
    dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],visibility:{dayMaster:'public',zodiac:'public',education:'public'},listed:true,...extra});
  return {store,service,admin,data};
}
const ids=r=>r.profiles.map(p=>p.shareId);

test('pending card is hidden from others everywhere they find people, but fully usable by its owner',()=>{
  const {store,service:s,admin,data}=setup();
  const viewer=s.save('viewer',data({nickname:'看的人'}));admin.decide(viewer.shareId,{decision:'approve'});
  const p=s.save('new',data({nickname:'新人'}));
  assert.equal(p.reviewStatus,'pending');assert.deepEqual(p.review,{status:'pending'});
  // others: discover, share link (logged in and anonymous), serious page, preview deck
  assert.equal(ids(s.discover('viewer')).includes(p.shareId),false);
  assert.throws(()=>s.card(p.shareId,'viewer'),{status:404});
  assert.throws(()=>s.card(p.shareId,undefined),{status:404});
  assert.throws(()=>s.seriousPage(p.shareId,'viewer'),{status:404});
  assert.throws(()=>s.request('viewer',p.shareId),{status:404});
  assert.equal(createPreviewDeck(store).deck({}).real,1,'only the approved viewer card is in the guest deck');
  const compat=require('./friends-compatibility').createCompatibilityService({store});
  assert.throws(()=>compat.create('viewer',{targetShareId:p.shareId}),{status:404},'no 合盘 invite to a card under review');
  assert.throws(()=>compat.create('new',{targetShareId:viewer.shareId}),{status:404},'a card under review cannot send targeted 合盘 invites either');
  // owner: sees own card and status, can browse others, cannot send requests until approved
  assert.equal(s.card(p.shareId,'new').shareId,p.shareId);
  assert.deepEqual(s.me('new').review,{status:'pending'});
  assert.deepEqual(ids(s.discover('new')),[viewer.shareId]);
  assert.throws(()=>s.request('new',viewer.shareId),{status:409});
  assert.deepEqual(admin.queue().map(x=>x.shareId),[p.shareId]);
});

test('approve makes the card visible to others; edits and unlist/relist of an approved card do not re-trigger review',()=>{
  const {service:s,admin,data}=setup();
  const viewer=s.save('viewer',data());admin.decide(viewer.shareId,{decision:'approve'});
  const p=s.save('new',data({nickname:'新人'}));
  const out=admin.decide(p.shareId,{decision:'approve'});assert.equal(out.reviewStatus,'approved');assert.ok(out.reviewedAt);
  assert.ok(ids(s.discover('viewer')).includes(p.shareId));assert.equal(s.card(p.shareId,undefined).shareId,p.shareId);
  s.save('new',data({nickname:'改了昵称',listed:false}));s.save('new',data({nickname:'改了昵称'}));
  assert.equal(s.me('new').reviewStatus,'approved');assert.ok(ids(s.discover('viewer')).includes(p.shareId));
  assert.equal(admin.queue().length,0);
  assert.throws(()=>admin.decide(p.shareId,{decision:'approve'}),{status:409});
});

test('grandfather: cards listed before review existed (no reviewStatus) stay visible and approved',()=>{
  const {store,service:s,admin,data}=setup();
  const viewer=s.save('viewer',data());admin.decide(viewer.shareId,{decision:'approve'});
  const old=s.save('old',data({nickname:'老用户'}));
  store.transaction(st=>{const x=st.profiles.find(q=>q.userId==='old');delete x.reviewStatus;delete x.reviewSubmittedAt;});
  assert.ok(ids(s.discover('viewer')).includes(old.shareId));
  assert.deepEqual(s.me('old').review,{status:'approved'});
  assert.equal(admin.queue().length,0);
  assert.equal(s.save('old',data({nickname:'老用户改名'})).reviewStatus,'approved','editing a grandfathered card keeps it approved');
  // A legacy card that was never listed is not grandfathered: listing it now goes to review.
  const draft=s.save('draft',data({listed:false}));store.transaction(st=>{delete st.profiles.find(q=>q.userId==='draft').reviewStatus;});
  assert.equal(s.save('draft',data()).reviewStatus,'pending');assert.equal(ids(s.discover('viewer')).includes(draft.shareId),false);
});

test('reject: fixed reason shown to the owner only, hidden from others, edit → back to pending; approved cards can be rejected later',()=>{
  const {store,service:s,admin,data}=setup();
  const viewer=s.save('viewer',data());admin.decide(viewer.shareId,{decision:'approve'});
  const p=s.save('new',data({nickname:'新人'}));
  assert.throws(()=>admin.decide(p.shareId,{decision:'reject'}),{status:400});
  assert.throws(()=>admin.decide(p.shareId,{decision:'reject',reason:'长得一般'}),{status:400},'only the three fixed reasons');
  admin.decide(p.shareId,{decision:'reject',reason:'ad'});
  assert.deepEqual(s.me('new').review,{status:'rejected',reason:'疑似广告或营销'});
  assert.equal(ids(s.discover('viewer')).includes(p.shareId),false);
  assert.equal(JSON.stringify(s.discover('new')).includes('疑似广告'),false);
  assert.equal(store.read().auditLogs.at(-1).action,'profile.review.reject');
  const again=s.save('new',data({nickname:'新人',bio:'改好了'}));
  assert.deepEqual(again.review,{status:'pending'});assert.equal(again.reviewReason,undefined);
  assert.deepEqual(admin.queue().map(x=>x.shareId),[p.shareId]);
  // Later rejection of an approved card removes it from discover.
  admin.decide(viewer.shareId,{decision:'reject',reason:'photo'});
  assert.deepEqual(s.me('viewer').review,{status:'rejected',reason:'照片不清楚或不是本人'});
  assert.equal(ids(s.discover('new')).includes(viewer.shareId),false);
});

test('already-connected people keep seeing each other if one card is later rejected',()=>{
  const {service:s,admin,data}=setup();
  const a=s.save('a',data({nickname:'甲'})),b=s.save('b',data({nickname:'乙'}));admin.decide(a.shareId,{decision:'approve'});admin.decide(b.shareId,{decision:'approve'});
  const r=s.request('a',b.shareId);s.act('b',r.id,'accept');
  admin.decide(b.shareId,{decision:'reject',reason:'incomplete'});
  const c=s.save('c',data({nickname:'丙'}));admin.decide(c.shareId,{decision:'approve'});
  assert.equal(s.card(b.shareId,'a').shareId,b.shareId);
  assert.ok(s.requests('a').some(x=>x.person.shareId===b.shareId));
  assert.equal(ids(s.discover('c')).includes(b.shareId),false);assert.throws(()=>s.card(b.shareId,'c'),{status:404});
});

test('gate off (library default) approves on save; grandfather predicate unchanged',()=>{
  const {service:s,data}=setup({reviewGate:false});
  assert.equal(s.save('x',data()).reviewStatus,'approved');
});

test('verified boost: reorders otherwise-equal candidates, only counts verification the viewer can see, never explained',()=>{
  const {store,service:s,admin,data}=setup();
  const self=s.save('self',data({nickname:'我'}));admin.decide(self.shareId,{decision:'approve'});
  const plain=s.save('plain',data({nickname:'甲'})),checked=s.save('checked',data({nickname:'乙'}));
  for(const x of [plain,checked])admin.decide(x.shareId,{decision:'approve'});
  assert.deepEqual(ids(s.discover('self')),[plain.shareId,checked.shareId],'baseline: insertion order on a tie');
  store.transaction(st=>{const x=st.profiles.find(q=>q.userId==='checked');x.verified={education:true};x.verifiedAt={education:new Date().toISOString()};});
  const r=s.discover('self');
  assert.deepEqual(ids(r),[checked.shareId,plain.shareId]);
  assert.equal(/核验/.test(JSON.stringify(r.profiles.map(p=>[p.reasons,p.explanation]))),false);
  // Same verification on a field this viewer cannot see gives no boost.
  store.transaction(st=>{st.profiles.find(q=>q.userId==='checked').visibility.education='private';});
  assert.deepEqual(ids(s.discover('self')),[plain.shareId,checked.shareId]);
  // A modest boost: one shared hobby still outranks verification.
  store.transaction(st=>{const x=st.profiles.find(q=>q.userId==='checked');x.visibility.education='public';st.profiles.find(q=>q.userId==='plain').hobbies=['羽毛球','徒步'];st.profiles.find(q=>q.userId==='self').hobbies=['羽毛球','徒步'];});
  assert.deepEqual(ids(s.discover('self')),[plain.shareId,checked.shareId]);
});

test('API: review queue and decisions require the admin token; production turns the gate on',async t=>{
  const {store,service:s,data}=setup();s.save('new',data());
  const {createRouter}=require('../routes/friends'),a=express();a.use(express.json());
  a.use(createRouter({express,store,secret:'test-signing-key-'.repeat(4),adminToken:ADMIN,reviewGate:true,auth:(req,res,next)=>next()}));
  const server=await new Promise(r=>{const x=a.listen(0,'127.0.0.1',()=>r(x));});t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port,H={'Content-Type':'application/json','X-Runae-Friends':'1'},share=s.me('new').shareId;
  assert.equal((await fetch(base+'/admin/reviews')).status,401);
  assert.equal((await fetch(base+'/admin/reviews',{headers:{'X-Admin-Token':'x'.repeat(ADMIN.length)}})).status,401);
  assert.equal((await fetch(base+'/admin/reviews/'+share,{method:'POST',headers:H,body:JSON.stringify({decision:'approve'})})).status,401);
  assert.equal((await fetch(base+'/admin/reviews/'+share+'/photos/x',{headers:H})).status,401);
  const q=await fetch(base+'/admin/reviews',{headers:{'X-Admin-Token':ADMIN}});assert.equal(q.status,200);
  const body=await q.json();assert.deepEqual(body.profiles.map(p=>p.shareId),[share]);assert.equal('income' in body.profiles[0].fields,false,'queue never shows income');
  const ok=await fetch(base+'/admin/reviews/'+share,{method:'POST',headers:{...H,'X-Admin-Token':ADMIN},body:JSON.stringify({decision:'approve'})});
  assert.equal(ok.status,200);assert.equal(s.me('new').reviewStatus,'approved');
  const src=fs.readFileSync(path.join(__dirname,'../routes/friends.js'),'utf8');
  assert.match(src.slice(src.indexOf('function productionRouter')),/reviewGate:process\.env\.FRIENDS_REVIEW_GATE!=='false'/);
});
