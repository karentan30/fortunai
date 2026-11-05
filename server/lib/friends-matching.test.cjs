'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const M=require('./friends-matching');
const charts={verify:c=>{const [stem,zodiac,age]=String(c).split(':');return {age:Number(age||30),dayMaster:stem||'丙',zodiac:zodiac||'马'};}};
function setup(options){
  const store=createFriendsStore(),service=createFriendsService(store,charts,options);
  const base=(extra={})=>({credential:'丙:马:30',consent:true,listed:true,nickname:'虚构测试',city:'北京',purposes:['friend'],bio:'虚构',
    fields:{height:'170',weight:'60',school:'测试大学',occupation:'工程师',income:'',assets:''},
    hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],visibility:{age:'public',height:'public',dayMaster:'public',zodiac:'public'},...extra,
    ...(extra.fields?{fields:{height:'170',weight:'60',school:'测试大学',occupation:'工程师',...extra.fields}}:{})});
  return {store,service,base};
}
const ids=r=>r.profiles.map(p=>p.shareId);

test('hard requirements are checked in both directions; unknown never satisfies 必须',()=>{
  const {service:s,base}=setup();
  s.save('a',base({expectations:{height:{level:'must',min:180}}}));
  const short=s.save('short',base({fields:{height:'175'}})),tall=s.save('tall',base({fields:{height:'182'}}));
  const hidden=s.save('hidden',base({fields:{height:'190'},visibility:{height:'private',dayMaster:'public'}}));
  assert.deepEqual(ids(s.discover('a')),[tall.shareId],'A sees only people meeting A\'s 必须 (hidden height = unknown)');
  // Reverse direction: tall requires age<=28; A is 30 → neither side sees the other.
  s.save('tall',base({fields:{height:'182'},expectations:{age:{level:'must',max:28}}}));
  assert.deepEqual(ids(s.discover('a')),[]);
  assert.ok(!ids(s.discover('tall')).includes(s.me('a').shareId));
  // The short candidate fails A's 必须, so A is excluded from short's list too (bilateral).
  assert.ok(!ids(s.discover('short')).includes(s.me('a').shareId));
  // Hidden height becomes usable only after its owner opts into private matching — and is never shown or explained.
  s.save('hidden',base({fields:{height:'190'},visibility:{height:'private',dayMaster:'public'},matchingConsent:{height:true}}));
  const card=s.discover('a').profiles.find(p=>p.shareId===hidden.shareId);
  assert.ok(card,'opted-in hidden value satisfies 必须');
  assert.equal(card.fields.height,undefined);
  assert.ok(!JSON.stringify(card).includes('190'));
  assert.ok(!card.explanation.forYou.some(r=>/身高/.test(r)));
  assert.ok(short.shareId);
});

test('purposes gate: platonic purposes bridge, romantic purposes do not; multi-select supported',()=>{
  const {service:s,base}=setup();
  s.save('a',base({purposes:['buddy']}));
  const friend=s.save('f',base({purposes:['friend']})),dating=s.save('d',base({purposes:['dating']})),multi=s.save('m',base({purposes:['serious','buddy']}));
  assert.deepEqual(new Set(ids(s.discover('a'))),new Set([friend.shareId,multi.shareId]));
  assert.deepEqual(ids(s.discover('d')),[]);
  assert.deepEqual(multi.purposes,['serious','buddy']);
  assert.equal(multi.intent,'认真婚恋');
  for(const bad of [[],['x'],['buddy','friend','dating','serious','buddy']])assert.throws(()=>s.save('a',base({purposes:bad})));
  // Purpose expectation as 必须 narrows beyond the gate.
  s.save('a',base({purposes:['buddy','friend'],expectations:{purpose:{level:'must',values:['buddy']}}}));
  assert.deepEqual(ids(s.discover('a')),[multi.shareId]);
});

test('hidden fields, hidden filters and sensitive values never leak to the other side',()=>{
  const {service:s,base}=setup();
  const SECRET='88888万-SECRET';
  // B fills sensitive values, keeps them private, opts income in for private matching only. B has its own private filters.
  const b=s.save('b',base({fields:{income:'300–500',assets:SECRET,familyAssets:SECRET,house:'有房',car:'有车',hukou:'上海'+SECRET},
    visibility:{age:'public',height:'public',dayMaster:'public',zodiac:'public'},matchingConsent:{income:true},
    expectations:{height:{level:'prefer',min:160},occupation:{level:'prefer',values:['工程']},income:{level:'must',min:1}}}));
  for(const k of M.SENSITIVE_FIELDS)assert.equal(s.me('b').visibility[k],'private','sensitive fields default to private');
  // A wants income>=100 as 必须 but has NOT opted in its own income → the filter is inactive (reciprocity) and B still shows.
  s.save('a',base({fields:{income:'200'},expectations:{income:{level:'must',min:100},assets:{level:'must',min:1}}}));
  let r=s.discover('a');
  // B's own income 必须 needs B's consent (yes) and A's opted-in income (no) → A is unknown → B's 必须 fails → hidden from A.
  assert.deepEqual(ids(r),[]);
  s.save('a',base({fields:{income:'200'},matchingConsent:{income:true},expectations:{income:{level:'must',min:100}}}));
  r=s.discover('a');assert.deepEqual(ids(r),[b.shareId]);
  const card=r.profiles[0],text=JSON.stringify({r,card:s.card(b.shareId,'a')});
  for(const leak of [SECRET,'300–500','有房','有车','matchingConsent','expectations','"must"','"prefer"','score'])assert.ok(!text.includes(leak),'leaked '+leak);
  for(const k of M.SENSITIVE_FIELDS)assert.equal(card.fields[k],undefined);
  assert.ok(!card.explanation.forYou.concat(card.explanation.forThem).some(x=>/收入|资产|房|车|户籍/.test(x)),'no explanation from hidden values');
  // Non-consented sensitive field (assets) cannot satisfy anyone's 必须 even though B filled it.
  s.save('a',base({fields:{income:'200',assets:'500'},matchingConsent:{income:true,assets:true},expectations:{assets:{level:'must',min:1}}}));
  assert.deepEqual(ids(s.discover('a')),[]);
  // Reciprocity: without opting in its own income, A's income 必须 is inactive, so a low-income opted-in person still shows.
  const low=s.save('low',base({fields:{income:'20'},matchingConsent:{income:true}}));
  s.save('a',base({fields:{income:'200'},matchingConsent:{},expectations:{income:{level:'must',min:100}}}));
  assert.ok(ids(s.discover('a')).includes(low.shareId));
  s.save('a',base({fields:{income:'200'},matchingConsent:{income:true},expectations:{income:{level:'must',min:100}}}));
  assert.ok(!ids(s.discover('a')).includes(low.shareId));
  // Owner's own view keeps everything.
  const me=s.me('b');assert.equal(me.fields.assets,SECRET);assert.equal(me.expectations.income.level,'must');assert.equal(me.matchingConsent.income,true);
});

test('explanations: TA也想认识你 only after acceptance; forThem only from TA public data',()=>{
  const {service:s,base}=setup();
  s.save('a',base({hobbies:['羽毛球','阅读']}));
  const b=s.save('b',base({credential:'壬:鼠:29',hobbies:['羽毛球'],targetStems:['丙']}));
  let card=s.discover('a').profiles[0];
  assert.equal(card.explanation.status.state,'none');
  assert.ok(!JSON.stringify(card).includes('也想认识你'));
  assert.ok(card.explanation.forThem.some(x=>x.includes('TA公开写了想认识丙日主')));
  assert.ok(card.explanation.forThem.some(x=>x.includes('羽毛球')));
  // If A hides its own day master from B, B could not see it → no such reason.
  s.save('a',base({hobbies:['羽毛球','阅读'],visibility:{age:'public',height:'public',dayMaster:'private',zodiac:'public'}}));
  card=s.discover('a').profiles[0];assert.ok(!card.explanation.forThem.some(x=>x.includes('日主')));
  const req=s.request('a',b.shareId);
  assert.equal(s.discover('a').profiles[0].explanation.status.state,'outgoing');
  assert.equal(s.discover('b').profiles[0].explanation.status.state,'incoming');
  assert.ok(!JSON.stringify(s.discover('b')).includes('也想认识你'));
  s.act('b',req.id,'decline');
  assert.ok(!JSON.stringify(s.discover('a')).includes('也想认识你'),'declined is never presented as interest');
  const c=s.save('c',base({credential:'壬:鼠:29'})),req2=s.request('a',c.shareId);s.act('c',req2.id,'accept');
  const accepted=s.discover('a').profiles.find(p=>p.shareId===c.shareId);
  assert.equal(accepted.explanation.status.state,'accepted');assert.match(accepted.explanation.status.text,/TA也想认识你/);
  assert.match(s.card(c.shareId,'a').explanation.status.text,/TA也想认识你/);
});

test('legacy profiles (single intent, no purposes/expectations) keep working and migrate on read',()=>{
  const {store,service:s,base}=setup();
  const legacy=(userId,intent,extra={})=>({userId,shareId:'legacy-'+userId,nickname:'旧资料',city:'北京',intent,
    fields:{age:'30',height:'170',weight:'60',school:'学校',occupation:'职员',industry:'',title:'',income:'暂不提供',assets:'暂不提供',familyAssets:''},
    visibility:{age:'public',height:'public',weight:'private',school:'private',occupation:'private',industry:'private',title:'private',income:'private',assets:'private',familyAssets:'private',dayMaster:'public',zodiac:'public'},
    hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],bio:'旧',contact:'',contactConsent:false,listed:true,chart:{age:30,dayMaster:'丙',zodiac:'马'},policyVersion:'legacy-unversioned',...extra});
  store.transaction(st=>{st.profiles.push(legacy('old-friend','交朋友'),legacy('old-girl','找闺蜜'),legacy('old-serious','认真恋爱'),legacy('old-dating','Dating'));});
  s.save('a',base({purposes:['buddy']}));
  assert.deepEqual(new Set(ids(s.discover('a'))),new Set(['legacy-old-friend','legacy-old-girl']));
  const card=s.card('legacy-old-serious','a');assert.deepEqual(card.purposes,['serious']);assert.equal(card.intent,'认真恋爱');
  // Legacy user can still discover without saving anything new.
  assert.deepEqual(ids(s.discover('old-serious')),[]);
  s.save('n',base({purposes:['serious']}));assert.deepEqual(ids(s.discover('old-serious')),[s.me('n').shareId]);
  const me=s.me('old-dating');assert.deepEqual(me.purposes,['dating']);assert.deepEqual(me.expectations,{});
  // Store was not rewritten by reads.
  assert.equal(store.read().profiles.find(p=>p.userId==='old-friend').purposes,undefined);
  // Re-saving with only the legacy intent still works and records purposes.
  const saved=s.save('old-friend',{...base(),intent:'找闺蜜',purposes:undefined});assert.deepEqual(saved.purposes,['friend']);assert.equal(saved.intent,'找闺蜜');
  // Re-saving without any purpose keeps the previous one.
  const kept=s.save('old-friend',{...base(),purposes:undefined});assert.deepEqual(kept.purposes,['friend']);
});

test('per-purpose ranking: 搭子 favours shared hobbies, 婚恋 favours 优先 hits and questionnaire alignment',()=>{
  let alignment={};
  const {service:s,base}=setup({alignmentScore:({candidateId})=>alignment[candidateId]??null});
  const all=['buddy','friend','dating','serious'];
  const hobbies=s.save('hobbies',base({purposes:all,credential:'壬:鼠:30',hobbies:['羽毛球','徒步','摄影','阅读']}));
  const prefer=s.save('prefer',base({purposes:all,credential:'壬:鼠:30',fields:{height:'185'},hobbies:['新爱好']}));
  const viewer=purposes=>s.save('v',base({purposes,hobbies:['羽毛球','徒步','摄影','阅读'],expectations:{height:{level:'prefer',min:180}}}));
  viewer(['buddy']);assert.deepEqual(ids(s.discover('v')),[hobbies.shareId,prefer.shareId]);
  for(const p of ['friend','dating','serious']){viewer([p]);assert.deepEqual(ids(s.discover('v')),[prefer.shareId,hobbies.shareId],p);}
  viewer(['serious']);alignment={hobbies:1,prefer:0};
  assert.deepEqual(ids(s.discover('v')),[hobbies.shareId,prefer.shareId],'alignment hook affects 认真婚恋');
  viewer(['friend']);assert.deepEqual(ids(s.discover('v')),[prefer.shareId,hobbies.shareId],'alignment ignored for other purposes');
  const out=s.discover('v');assert.ok(out.profiles.every(p=>p.score===undefined&&p.directions===undefined&&!('alignment' in p)));
  assert.notDeepEqual(M.WEIGHTS.buddy,M.WEIGHTS.serious);
});

test('expectation validation and amount parsing',()=>{
  assert.throws(()=>M.normalizeExpectations({height:{level:'very'}}));
  assert.throws(()=>M.normalizeExpectations({salary:{level:'must'}}));
  assert.throws(()=>M.normalizeExpectations({age:{level:'must',min:16}}));
  assert.throws(()=>M.normalizeExpectations({height:{level:'must',min:190,max:170}}));
  assert.equal(M.normalizeExpectations({height:{level:'must'}}).height.level,'any','empty criterion is downgraded, not a silent wall');
  assert.deepEqual(M.normalizeExpectations({purpose:{level:'prefer',values:['约会','dating']}}).purpose.values,['dating']);
  assert.equal(M.amount('20–50'),20);assert.equal(M.amount('暂无收入或资产'),0);assert.equal(M.amount('暂不提供'),null);assert.equal(M.amount(''),null);
});
