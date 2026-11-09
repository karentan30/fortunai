'use strict';
// 认识目的 = four categories (2026-11-10): buddy / dating / serious / married_buddy. Legacy `friend` merges into buddy.
// married_buddy (已婚 · 只找搭子) is a safety rule: never shown to, nor requestable by, anyone whose purposes include
// dating or serious — even if that person also picked buddy — and vice versa.
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const M=require('./friends-matching'),D=require('./friends-preview-deck'),SP=require('./friends-serious');
const {createCompatibilityService}=require('./friends-compatibility'),XB=require('./friends-cross-border');
const charts={verify:c=>{const [stem,zodiac,age]=String(c).split(':');return {age:Number(age||30),dayMaster:stem||'丙',zodiac:zodiac||'马'};}};
function setup(){
  const store=createFriendsStore(),service=createFriendsService(store,charts);
  const base=(extra={})=>({credential:'丙:马:30',consent:true,crossBorderConsent:true,listed:true,nickname:'虚构测试',city:'北京',purposes:['buddy'],bio:'虚构',
    fields:{height:'170',weight:'60',education:'本科',school:'测试大学',occupation:'工程师',income:'',assets:''},dateActivities:['羽毛球'],hobbies:['阅读'],
    targetStems:['不限'],targetZodiacs:['不限'],visibility:{age:'public',height:'public',dayMaster:'public',zodiac:'public'},...extra});
  return {store,service,base};
}
const MARRIED_LABEL='已婚 · 只找搭子';
// One population used by the isolation tests.
function population(){
  const f=setup(),{service:s,base}=f;
  const ids={};
  for(const [uid,purposes] of [['married',['married_buddy']],['married2',['married_buddy']],['buddy',['buddy']],['buddyDating',['buddy','dating']],['serious',['serious']],['dating',['dating']]])
    ids[uid]=s.save(uid,base({purposes})).shareId;
  return {...f,ids};
}

test('four purposes in order; WEIGHTS drop friend and give married_buddy the buddy weights',()=>{
  assert.deepEqual(M.PURPOSES,['buddy','dating','serious','married_buddy']);
  assert.deepEqual(M.PURPOSE_LABELS,{buddy:'找搭子',dating:'享受甜甜的恋爱',serious:'认真考虑婚恋',married_buddy:MARRIED_LABEL});
  assert.equal(M.PURPOSE_OPTION_LABELS.married_buddy,'婚后找搭子');
  assert.equal(M.WEIGHTS.friend,undefined);
  assert.deepEqual(M.WEIGHTS.married_buddy,M.WEIGHTS.buddy);
});

test('legacy friend migrates to buddy on read, deduped; legacy labels still map',()=>{
  assert.deepEqual(M.purposesOf({purposes:['friend']}),['buddy']);
  assert.deepEqual(M.purposesOf({purposes:['friend','buddy','dating']}),['buddy','dating']);
  assert.deepEqual(M.purposesOf({intent:'交朋友·闺蜜'}),['buddy']);
  assert.deepEqual(M.purposesOf({}),['buddy'],'default for a profile with nothing is buddy, not friend');
  const map={'交朋友':'buddy','找闺蜜':'buddy','交朋友·闺蜜':'buddy','认真结婚':'serious','认真婚恋':'serious','享受恋爱':'dating','约会':'dating','婚后找搭子':'married_buddy'};
  for(const [label,key] of Object.entries(map))assert.equal(M.LEGACY_INTENT[label],key,label);
  const migrated=M.migrateProfile({purposes:['friend'],expectations:{purpose:{level:'must',values:['friend','buddy']}}});
  assert.deepEqual(migrated.purposes,['buddy']);
  assert.deepEqual(migrated.expectations.purpose.values,['buddy']);
});

test('legacy friend is migrated on save; old clients sending friend / 交朋友·闺蜜 still work',()=>{
  const {store,service:s,base}=setup();
  const viaKey=s.save('a',base({purposes:['friend','buddy']}));
  assert.deepEqual(viaKey.purposes,['buddy']);assert.equal(viaKey.intent,'找搭子');
  const viaLabel=s.save('b',base({purposes:['交朋友·闺蜜','享受恋爱']}));
  assert.deepEqual(viaLabel.purposes,['buddy','dating']);
  const viaIntent=s.save('c',{...base(),purposes:undefined,intent:'交朋友'});
  assert.deepEqual(viaIntent.purposes,['buddy']);
  // A stored profile still carrying `friend` (and a friend expectation) is rewritten to buddy on its next save.
  store.transaction(st=>{const p=st.profiles.find(x=>x.userId==='a');p.purposes=['friend'];p.expectations={purpose:{level:'prefer',values:['friend']}};});
  assert.deepEqual(s.me('a').purposes,['buddy']);
  const resaved=s.save('a',{...base(),purposes:undefined,expectations:undefined});
  assert.deepEqual(resaved.purposes,['buddy']);
  assert.deepEqual(resaved.expectations.purpose.values,['buddy']);
  assert.ok(!JSON.stringify(store.read().profiles).includes('"friend"'));
});

test('married_buddy cannot be combined with dating or serious; with buddy it is stored alone',()=>{
  const {service:s,base}=setup();
  for(const bad of [['married_buddy','dating'],['married_buddy','serious'],['buddy','married_buddy','serious'],['婚后找搭子','享受甜甜的恋爱']])
    assert.throws(()=>s.save('a',base({purposes:bad})),{status:400,message:'婚后找搭子不能同时选恋爱或婚恋'},JSON.stringify(bad));
  const both=s.save('a',base({purposes:['buddy','married_buddy']}));
  assert.deepEqual(both.purposes,['married_buddy']);
  assert.equal(both.intent,MARRIED_LABEL);
});

test('discover: married_buddy only meets buddy and married_buddy; never anyone with dating/serious (raw responses)',()=>{
  const {service:s,ids}=population();
  const raw=uid=>JSON.stringify(s.discover(uid));
  const seenBy=uid=>s.discover(uid).profiles.map(p=>p.shareId);
  assert.deepEqual(new Set(seenBy('married')),new Set([ids.married2,ids.buddy]));
  for(const uid of ['buddyDating','serious','dating']){
    const out=raw(uid);
    assert.ok(!out.includes(ids.married)&&!out.includes(ids.married2),uid+' must not see married_buddy');
    assert.ok(!out.includes(MARRIED_LABEL),uid+' raw response carries no married label');
  }
  const married=raw('married');
  for(const uid of ['buddyDating','serious','dating'])assert.ok(!married.includes(ids[uid]),'married must not see '+uid);
  // buddy-only users do see married_buddy, and the card says 已婚 · 只找搭子.
  const card=s.discover('buddy').profiles.find(p=>p.shareId===ids.married);
  assert.ok(card);assert.deepEqual(card.purposeLabels,[MARRIED_LABEL]);
  assert.deepEqual(card.explanation.sharedPurposes,['找搭子']);
  // Explanation of an isolated pair (opened from a shared link) never lists a shared purpose.
  assert.deepEqual(s.card(ids.married,'buddyDating').explanation.sharedPurposes,[]);
});

test('connection requests between married_buddy and dating/serious are refused both ways, including accept after a switch',()=>{
  const {service:s,base,ids}=population();
  for(const [from,to] of [['buddyDating','married'],['married','buddyDating'],['serious','married'],['married','dating']])
    assert.throws(()=>s.request(from,ids[to]),{status:409,message:/婚后找搭子/},from+'→'+to);
  const ok=s.request('married',ids.buddy);
  assert.equal(ok.status,'pending');
  // TA later adds dating while the request is pending: accepting is refused.
  s.save('buddy',base({purposes:['buddy','dating']}));
  assert.throws(()=>s.act('buddy',ok.id,'accept'),{status:409});
  assert.ok(!JSON.stringify(s.requests('buddy')).includes('"accepted"'));
});

test('guest deck: married_buddy cards hidden by default and from dating/serious guests; married guests never see daters',()=>{
  const {store,ids}=population();
  const deck=D.createPreviewDeck(store);
  const pubAll=()=>store.transaction(st=>{for(const p of st.profiles)p.visibility.dayMaster='public';});pubAll();
  const labels=q=>deck.deck(q).cards.filter(c=>!c.sample).map(c=>c.purposeLabels.join('|'));
  const raw=q=>JSON.stringify(deck.deck(q));
  for(const q of [{},{stem:'甲'},{purposes:'dating'},{purposes:'buddy,serious'},{purposes:'friend,dating'}])assert.ok(!raw(q).includes(MARRIED_LABEL),JSON.stringify(q));
  assert.equal(labels({}).length,4,'everyone except the two married cards');
  const married=labels({purposes:'married_buddy'});
  assert.deepEqual(married.sort(),[MARRIED_LABEL,MARRIED_LABEL,'找搭子'].sort());
  assert.ok(ids.married);
});

test('合盘 invite from a public card is refused between married_buddy and dating/serious',()=>{
  const {store,ids}=population();
  XB.grant(store,'married','buddyDating','buddy');
  const c=createCompatibilityService({store});
  assert.throws(()=>c.create('buddyDating',{targetShareId:ids.married}),{status:403});
  assert.throws(()=>c.create('married',{targetShareId:ids.buddyDating}),{status:403});
  assert.equal(c.create('married',{targetShareId:ids.buddy}).status,'pending_authorizations');
});

test('合盘 open invite: claim is refused between married_buddy and dating/serious (same rule as create)',()=>{
  const {store}=population();
  XB.grant(store,'married','buddyDating','serious','buddy');
  const c=createCompatibilityService({store});
  // Owner birth confirmation is out of scope here: mark it authorized directly so claim reaches the isolation check.
  const open=uid=>{const p=c.create(uid,{});store.transaction(st=>{st.compatibilityPairs.find(x=>x.id===p.id).authorizations[uid]={version:'x'};});return p.inviteToken;};
  const claim=(uid,token)=>c.claim(uid,{inviteToken:token,consent:true,nickname:'自报'});
  assert.throws(()=>claim('buddyDating',open('married')),{status:403});
  assert.throws(()=>claim('married',open('serious')),{status:403});
  const t=open('married');assert.equal(claim('buddy',t).status,'pending_recipient_confirmation');
});

test('admin-verified 已婚 is read as married_buddy and cannot choose dating or serious',()=>{
  const {store,service:s,base,ids}=population();
  store.transaction(st=>{const p=st.profiles.find(x=>x.userId==='dating');p.verified={marital:true};p.verifiedDetail={marital:'married'};});
  assert.deepEqual(s.me('dating').purposes,['married_buddy']);
  assert.ok(!JSON.stringify(s.discover('serious')).includes(ids.dating),'verified married no longer reaches serious users');
  assert.equal(SP.eligible(store.read().profiles.find(x=>x.userId==='dating')),false);
  assert.throws(()=>s.save('dating',base({purposes:['dating']})),{status:400,message:/婚况核验为已婚/});
  assert.deepEqual(s.save('dating',base({purposes:['married_buddy']})).purposes,['married_buddy']);
});

// P1 privacy: admin-verified 婚况 forces married_buddy for isolation, but must never leak through the 认识目的 label
// to someone who cannot see the 婚况 mark (verifiedFor gate). Isolation stays exactly as strict.
test('verified 已婚 never leaks via purpose labels/intent/explanations/guest deck/purpose filter; isolation unchanged',()=>{
  const {store,service:s,base,ids}=population();
  ids.vb=s.save('vb',base({purposes:['buddy']})).shareId;   // picked 找搭子 themselves
  // vd picked dating before the 婚况 review came back; verification overrides it for matching only.
  ids.vd=s.save('vd',base({purposes:['dating']})).shareId;
  store.transaction(st=>{for(const uid of ['vb','vd']){const p=st.profiles.find(x=>x.userId===uid);p.verified={marital:true};p.verifiedDetail={marital:'married'};}
    st.billingOrders=st.billingOrders||[];st.billingOrders.push({id:'XS-m',userId:'buddy',provider:'direct',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:new Date(Date.now()-1000).toISOString(),accessUntil:new Date(Date.now()+30*86400000).toISOString()});});
  const mine=c=>[ids.vb,ids.vd].includes(c.shareId);
  for(const viewer of ['buddy','married']){   // 'buddy' is a member: members still cannot see the 婚况 mark on cards
    const cards=s.discover(viewer).profiles.filter(mine);
    assert.equal(cards.length,2,viewer+' still meets both (buddy-style)');
    for(const c of cards){assert.deepEqual(c.purposeLabels,['找搭子'],viewer);assert.deepEqual(c.purposes,['buddy']);assert.equal(c.intent,'找搭子');}
    // explanation.sharedPurposes lists the VIEWER's own purposes (a married_buddy viewer sees their own label): excluded.
    const about=c=>JSON.stringify({...c,explanation:{...c.explanation,sharedPurposes:undefined}});
    for(const c of cards)assert.ok(!about(c).includes('已婚'),viewer+' discover');
    for(const id of [ids.vb,ids.vd])assert.ok(!about(s.card(id,viewer)).includes('已婚'),viewer+' card '+id);
  }
  // Purpose filter cannot be used to probe for verified-married people.
  assert.ok(!s.discover('married',{purpose:'married_buddy'}).profiles.some(mine));
  // Isolation exactly as strict: dating/serious/buddy+dating never see them; requests refused both ways.
  for(const viewer of ['dating','serious','buddyDating'])assert.ok(!s.discover(viewer).profiles.some(mine),viewer);
  assert.throws(()=>s.request('buddyDating',ids.vb),{status:409});assert.throws(()=>s.request('vd',ids.dating),{status:409});
  // Guest deck: only a self-chosen married_buddy shows that label.
  const deck=D.createPreviewDeck(store);store.transaction(st=>{for(const p of st.profiles)p.visibility.dayMaster='public';});
  const labels=deck.deck({purposes:'married_buddy'}).cards.filter(c=>!c.sample).map(c=>c.purposeLabels.join('|')).sort();
  assert.deepEqual(labels,[MARRIED_LABEL,MARRIED_LABEL,'找搭子','找搭子','找搭子'].sort());
  // Owner still sees their real effective purposes.
  assert.deepEqual(s.me('vb').purposes,['married_buddy']);assert.deepEqual(s.me('vd').purposes,['married_buddy']);
});
