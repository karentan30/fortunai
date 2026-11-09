'use strict';
// 日主/生肖/星座/MBTI 「仅自己（用于后台匹配）」: hidden from everyone else, usable for ranking/filter only with the owner's consent.
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createPreviewDeck}=require('./friends-preview-deck');
const charts={verify:c=>{const [stem,zodiac,age]=String(c).split(':');return {age:Number(age||30),dayMaster:stem||'丙',zodiac:zodiac||'马'};}};
// The hidden person's values. None of them is used by any other profile or by the preview-deck samples.
const HIDDEN={dayMaster:'壬',zodiac:'猴',mbti:'ENTP',constellation:'天蝎座'};
const SECRET_TOKENS=[...Object.values(HIDDEN),'天蝎'];
function setup(){
  const store=createFriendsStore(),service=createFriendsService(store,charts);
  const base=(extra={})=>({credential:'丙:马:30',consent:true,crossBorderConsent:true,listed:true,nickname:'虚构测试',city:'北京',purposes:['friend'],bio:'虚构',dateActivities:['羽毛球'],
    fields:{height:'170',weight:'60',school:'测试大学',occupation:'工程师'},hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],
    visibility:{age:'public',height:'public',dayMaster:'public',zodiac:'public',constellation:'public',mbti:'public'},...extra});
  return {store,service,base};
}
const ids=r=>r.profiles.map(p=>p.shareId);
// Leak detector used on every response another person / guest can receive.
function assertNoLeak(label,payload){
  const text=JSON.stringify(payload);
  for(const v of SECRET_TOKENS)assert.ok(!text.includes(v),label+' leaked '+v);
  for(const k of ['matchingConsent','expectations','score','"must"','"prefer"'])assert.ok(!text.includes(k),label+' leaked '+k);
}
// X: public 庚 (not in A's targets). H: hidden 壬/猴/ENTP/天蝎座, saved after X so a tie keeps X first.
function people(s,base,hiddenExtra={}){
  const x=s.save('x',base({credential:'庚:虎:30',mbti:'ISFJ',constellation:'金牛座'}));
  const h=s.save('h',base({credential:'壬:猴:30',mbti:HIDDEN.mbti,constellation:HIDDEN.constellation,
    visibility:{age:'public',height:'public',dayMaster:'private',zodiac:'private',constellation:'private',mbti:'private'},...hiddenExtra}));
  return {x,h};
}

test('consent off: a hidden 日主/MBTI is not used for ranking or 必须',()=>{
  const {service:s,base}=setup();
  const {x,h}=people(s,base);
  s.save('a',base({targetStems:['壬'],targetMbtis:['ENTP'],mbti:'INTJ'}));
  assert.deepEqual(ids(s.discover('a')),[x.shareId,h.shareId],'no prefer hit from a non-consented hidden value');
  s.save('a',base({targetStems:['壬'],mbti:'INTJ',expectations:{dayMaster:{level:'must'}}}));
  assert.deepEqual(ids(s.discover('a')),[],'hidden 日主 without consent = unknown, never satisfies 必须');
});

test('consent on: hidden value ranks and filters, but no response to anyone else contains it',()=>{
  const {store,service:s,base}=setup();
  const {x,h}=people(s,base,{visibility:{age:'public',height:'public',dayMaster:'match',zodiac:'match',constellation:'match',mbti:'match'}});
  const me=s.me('h');
  for(const k of Object.keys(HIDDEN)){assert.equal(me.visibility[k],'private');assert.equal(me.matchingConsent[k],true);}
  // Ranking: A's 优先 on 壬 now hits H, so H moves ahead of X.
  s.save('a',base({targetStems:['壬'],mbti:'INTJ'}));
  assert.deepEqual(ids(s.discover('a')),[h.shareId,x.shareId]);
  // MBTI 必须 (A shares its own MBTI publicly → reciprocity satisfied).
  s.save('a',base({mbti:'INTJ',targetMbtis:['ENTP'],expectations:{mbti:{level:'must'}}}));
  assert.deepEqual(ids(s.discover('a')),[h.shareId]);
  s.save('a',base({mbti:'INTJ',targetMbtis:['ISFJ'],expectations:{mbti:{level:'must'}}}));
  assert.deepEqual(ids(s.discover('a')),[x.shareId]);
  // Reciprocity (same as sensitive fields): A hides its own MBTI without consent → may not use H's hidden MBTI.
  s.save('a',base({mbti:'INTJ',targetMbtis:['ENTP'],expectations:{mbti:{level:'must'}},visibility:{age:'public',height:'public',dayMaster:'public',zodiac:'public',mbti:'private'},matchingConsent:{mbti:false}}));
  assert.deepEqual(ids(s.discover('a')),[]);
  // The client-side filter (q.stem / q.mbti) reads only the visible card: it cannot be used to probe the hidden value.
  s.save('a',base({targetStems:['壬'],mbti:'INTJ'}));
  for(const q of [{stem:'壬'},{zodiac:'猴'},{mbti:'ENTP'},{constellation:'天蝎座'}])assert.ok(!ids(s.discover('a',q)).includes(h.shareId),'filter '+JSON.stringify(q));
  // Collect everything another user, a guest or the preview deck can receive.
  const r=s.discover('a'),card=r.profiles.find(p=>p.shareId===h.shareId);
  assert.ok(card);for(const k of ['dayMaster','zodiac'])assert.equal(card.chart[k],undefined);assert.equal(card.mbti,undefined);assert.equal(card.constellation,undefined);
  assert.ok(![...card.explanation.forYou,...card.explanation.forThem].some(t=>/日主|生肖|星座|MBTI/.test(t)),'why-recommended never names the hidden field');
  assert.equal(card.explanation.element,null,'no 五行 text from a hidden 日主');
  s.request('a',h.shareId);
  const deck=createPreviewDeck(store).deck({stem:'丙'});
  assert.ok(!deck.cards.some(c=>c.token&&createPreviewDeck(store).resolve(c.token)==='h'),'hidden 日主 never enters the guest deck');
  const responses={discover:r,cardForUser:s.card(h.shareId,'a'),cardForGuest:s.card(h.shareId,undefined),requestsA:s.requests('a'),deck,
    seriousPageless:s.discover('x')};
  for(const [label,payload] of Object.entries(responses))assertNoLeak(label,payload);
  // Self-proof arm: the same detector turns red when the value is deliberately put into the card.
  assert.throws(()=>assertNoLeak('tampered',{...r,profiles:[{...card,chart:{...card.chart,dayMaster:HIDDEN.dayMaster}}]}),/leaked 壬/);
  assert.throws(()=>assertNoLeak('tampered',{...card,mbti:HIDDEN.mbti}),/leaked ENTP/);
  // The owner still sees everything.
  assert.equal(s.me('h').mbti,'ENTP');assert.equal(s.me('h').chart.dayMaster,'壬');
});

test('new profile defaults 星座/MBTI to 仅自己（用于后台匹配）; existing profiles keep their settings',()=>{
  const {service:s,base}=setup();
  const fresh=s.save('n',base({mbti:'INTJ',constellation:'白羊座',visibility:{age:'public',dayMaster:'public',zodiac:'public'}}));
  for(const k of ['constellation','mbti']){assert.equal(fresh.visibility[k],'private');assert.equal(fresh.matchingConsent[k],true);}
  for(const k of ['dayMaster','zodiac'])assert.notEqual(fresh.matchingConsent[k],true,'日主/生肖 have no new default');
  // Existing public profile re-saved by an older client (no constellation/mbti scope, sensitive-only consent): unchanged.
  s.save('o',base({mbti:'INTJ'}));
  const again=s.save('o',base({mbti:'INTJ',visibility:{age:'public',dayMaster:'public',zodiac:'public'},matchingConsent:{income:false}}));
  assert.equal(again.visibility.mbti,'public');assert.notEqual(again.matchingConsent.mbti,true);
  // An existing match choice survives an older client that omits the type keys from matchingConsent.
  s.save('o',base({mbti:'INTJ',visibility:{age:'public',dayMaster:'public',zodiac:'public',mbti:'match'}}));
  const kept=s.save('o',base({mbti:'INTJ',visibility:{age:'public',dayMaster:'public',zodiac:'public',mbti:'private'},matchingConsent:{income:false}}));
  assert.equal(kept.matchingConsent.mbti,true);
  // Explicit private (UI sends consent false) turns it off.
  const off=s.save('o',base({mbti:'INTJ',visibility:{age:'public',dayMaster:'public',zodiac:'public',mbti:'private'},matchingConsent:{mbti:false}}));
  assert.equal(off.matchingConsent.mbti,false);
});
