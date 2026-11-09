'use strict';
// 九型人格（1–9 号）：字段校验、targetEnneagrams 期待、q.enneagram 筛选（与 MBTI 同样免费/同样的 403 规则）、
// 可见性（隐藏的号码不参与他人匹配/筛选、不外泄）、推荐理由只给同频/互补、文案红线。
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {typeSuggestions}=require('./friends-preferences');
const {findForbidden}=require('./friends-copy-guard');
const ENN=require('../../assets/js/friends-enneagram-data.js');
const QUIZ=require('../../assets/js/friends-enneagram-quiz.js');
const ROOT=path.join(__dirname,'..','..');

function setup(){
  const store=createFriendsStore();const now=Date.parse('2026-11-10T04:00:00Z');
  const service=createFriendsService(store,{verify:()=>({age:30,dayMaster:'丙',zodiac:'马'})},{enabled:true,clock:()=>now});
  const base={credential:'c',consent:true,crossBorderConsent:true,nickname:'虚构测试',city:'北京',intent:'交朋友',purposes:['buddy'],
    fields:{height:'170',weight:'60',education:'本科',school:'暂无',occupation:'暂无'},dateActivities:['羽毛球'],hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],
    visibility:{age:'public',dayMaster:'public',zodiac:'public',mbti:'public',enneagram:'public'},listed:true};
  const save=(uid,extra={})=>service.save(uid,{...base,...extra,fields:{...base.fields,...(extra.fields||{})},visibility:{...base.visibility,...(extra.visibility||{})}});
  const member=uid=>store.transaction(s=>{s.billingOrders=s.billingOrders||[];s.billingOrders.push({id:'XS-'+uid,userId:uid,provider:'direct',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:new Date(now-1000).toISOString(),accessUntil:new Date(now+30*86400000).toISOString()});});
  return {store,service,save,member};
}
const ids=r=>r.profiles.map(p=>p.shareId);
const status=(fn,code)=>assert.throws(fn,e=>e.status===code,'expected '+code);

test('field validation: only "1".."9" (or empty) is accepted, for enneagram and targetEnneagrams',()=>{
  const f=setup();
  for(const t of ENN.ENNEAGRAMS)assert.equal(f.save('ok'+t,{enneagram:t}).enneagram,t);
  assert.equal(f.service.me('ok5').enneagram,'5');
  for(const bad of ['0','10','a','五','5号',' ',5,['5'],{}])status(()=>f.save('bad',{enneagram:bad}),400);
  assert.equal(f.save('ok5',{enneagram:''}).enneagram||'','','empty clears');
  assert.deepEqual(f.save('t',{targetEnneagrams:['不限']}).targetEnneagrams,['不限']);
  assert.deepEqual(f.service.me('t').targetEnneagrams,['不限']);
  assert.deepEqual(f.save('t',{targetEnneagrams:['2','8']}).targetEnneagrams,['2','8']);
  for(const bad of [['0'],['10'],['ENTP'],'5'])status(()=>f.save('t',{targetEnneagrams:bad}),400);
});

test('targetEnneagrams: 优先 ranks and 必须 filters on visible 号码, like targetMbtis',()=>{
  const f=setup();
  const x=f.save('x',{enneagram:'1'}),y=f.save('y',{enneagram:'8'});
  f.save('a',{enneagram:'5',targetEnneagrams:['8']});
  assert.deepEqual(ids(f.service.discover('a')),[y.shareId,x.shareId],'优先: the 8号 card moves ahead');
  f.save('a',{enneagram:'5',targetEnneagrams:['8'],expectations:{enneagram:{level:'must'}}});
  assert.deepEqual(ids(f.service.discover('a')),[y.shareId],'必须: only 8号');
  f.save('a',{enneagram:'5',targetEnneagrams:['不限'],expectations:{enneagram:{level:'must'}}});
  assert.equal(f.service.discover('a').total,2,'不限 never filters');
  const card=f.service.discover('a',{}).profiles.find(p=>p.shareId===y.shareId);
  f.save('a',{enneagram:'5',targetEnneagrams:['8']});
  const hit=f.service.discover('a').profiles.find(p=>p.shareId===y.shareId);
  assert.ok(hit.explanation.forYou.includes('符合你选择的九型人格方向（自填）'),'reason line for a 方向 hit');
  assert.ok(card);
});

test('q.enneagram filter is free like q.mbti; member filters still 403 for non-members; invalid → 400',()=>{
  const f=setup();
  const x=f.save('x',{enneagram:'1',mbti:'INTJ'}),y=f.save('y',{enneagram:'8',mbti:'ESTP'});f.save('me',{enneagram:'5'});
  assert.deepEqual(ids(f.service.discover('me',{enneagram:'8'})),[y.shareId]);
  assert.deepEqual(ids(f.service.discover('me',{enneagram:'1'})),[x.shareId]);
  assert.equal(f.service.discover('me',{enneagram:''}).total,2,'empty = 不限');
  // Same gating as MBTI: free alone; combined with a member filter the member rule (403) applies to both.
  assert.deepEqual(ids(f.service.discover('me',{mbti:'ESTP'})),[y.shareId]);
  for(const q of [{mbti:'ESTP',edu:'本科'},{enneagram:'8',edu:'本科'}])assert.throws(()=>f.service.discover('me',q),e=>e.status===403&&e.code==='member_filter');
  for(const bad of ['0','10','8号','ESTP'])status(()=>f.service.discover('me',{enneagram:bad}),400);
  f.member('me');
  assert.deepEqual(ids(f.service.discover('me',{enneagram:'8',edu:'本科'})),[],'member: education not public → no match, but no 403');
});

test('visibility: a hidden 号码 is unused without consent, used with consent+reciprocity, never leaked or probed',()=>{
  const f=setup();
  const x=f.save('x',{enneagram:'1'});
  const h=f.save('h',{enneagram:'7',visibility:{enneagram:'private'},matchingConsent:{enneagram:false}});
  f.save('a',{enneagram:'5',targetEnneagrams:['7'],expectations:{enneagram:{level:'must'}}});
  assert.deepEqual(ids(f.service.discover('a')),[],'no consent: hidden 7号 never satisfies 必须');
  f.save('a',{enneagram:'5',targetEnneagrams:['7'],expectations:{enneagram:{level:'prefer'}}});
  assert.deepEqual(ids(f.service.discover('a')),[x.shareId,h.shareId],'no consent: no 优先 hit');
  // Consent on (仅自己，用于后台匹配).
  f.save('h',{enneagram:'7',visibility:{enneagram:'match'}});
  assert.equal(f.service.me('h').visibility.enneagram,'private');assert.equal(f.service.me('h').matchingConsent.enneagram,true);
  f.save('a',{enneagram:'5',targetEnneagrams:['7'],expectations:{enneagram:{level:'must'}}});
  assert.deepEqual(ids(f.service.discover('a')),[h.shareId],'consent + A shares its own 号码 → usable');
  // Reciprocity: A hides its own 号码 without consent → may not use H's hidden one.
  f.save('a',{enneagram:'5',targetEnneagrams:['7'],expectations:{enneagram:{level:'must'}},visibility:{enneagram:'private'},matchingConsent:{enneagram:false}});
  assert.deepEqual(ids(f.service.discover('a')),[]);
  // The q filter reads the visible card only: it cannot probe the hidden value.
  f.save('a',{enneagram:'5'});
  assert.ok(!ids(f.service.discover('a',{enneagram:'7'})).includes(h.shareId),'q.enneagram cannot probe');
  const r=f.service.discover('a'),card=r.profiles.find(p=>p.shareId===h.shareId);
  assert.ok(card);assert.equal(card.enneagram,undefined);
  // 5 and 7 are both 思考组: if the hidden value were explained, a 同频 line would appear here.
  assert.ok(![...card.explanation.forYou,...card.explanation.forThem].some(t=>/九型/.test(t)),'no 九型 reason from a hidden value');
  const leak=p=>JSON.stringify(p).includes('"enneagram":"7"');
  for(const [label,payload] of Object.entries({discover:r,cardForUser:f.service.card(h.shareId,'a'),cardForGuest:f.service.card(h.shareId,undefined)}))assert.ok(!leak(payload),label+' leaked');
  assert.ok(leak({...card,enneagram:'7'}),'self-proof: detector sees a planted value');
  assert.equal(f.service.me('h').enneagram,'7','owner still sees it');
  // Public again → shown and filterable.
  f.save('h',{enneagram:'7',visibility:{enneagram:'public'}});
  assert.deepEqual(ids(f.service.discover('a',{enneagram:'7'})),[h.shareId]);
});

test('discover reason line: only for 同频/互补, never a score',()=>{
  const f=setup();
  const comp=f.save('comp',{enneagram:'8'}),same=f.save('same',{enneagram:'6'}),twin=f.save('twin',{enneagram:'5'}),other=f.save('other',{enneagram:'2'}),none=f.save('none',{});
  f.save('a',{enneagram:'5'});
  const by=Object.fromEntries(f.service.discover('a').profiles.map(p=>[p.shareId,p.explanation.forYou.filter(t=>/九型/.test(t))]));
  assert.deepEqual(by[comp.shareId],['九型人格互补：5号和8号，正好互相补位']);
  assert.deepEqual(by[same.shareId],['九型人格同频：你们都属于思考组']);
  assert.deepEqual(by[twin.shareId],['九型人格同频：你们都是5号']);
  assert.deepEqual(by[other.shareId],[],'慢慢熟悉 pairs get no line');
  assert.deepEqual(by[none.shareId],[]);
  for(const lines of Object.values(by))for(const t of lines){assert.deepEqual(findForbidden(t),[]);assert.ok(!/\d+\s*分(?!钟)|%/.test(t));}
});

test('relation data: symmetric, every type has 同频 and 互补 partners, every pair reads as workable',()=>{
  for(const a of ENN.ENNEAGRAMS){
    const g=Object.fromEntries(ENN.groupsFor(a).map(x=>[x.key,x.items]));
    assert.ok(g.same.length>=2&&g.complement.length>=1,a+' has partners');
    assert.equal(g.same.length+g.complement.length+g.explore.length,8);
    for(const b of ENN.ENNEAGRAMS){assert.equal(ENN.relation(a,b),ENN.relation(b,a));assert.ok(ENN.reason(a,b).length>8,a+'-'+b);}
  }
  assert.equal(ENN.relation('5','0'),'');assert.equal(ENN.matchLine('5','2'),'');
  const s=typeSuggestions({enneagram:'5'});
  assert.deepEqual([...s.enneagrams].sort(),['6','7','8']);
  assert.ok(typeSuggestions({enneagram:''}).enneagrams.length===0);
});

test('quiz: 18 original two-choice questions, each 号码 four times; score is a reference only',()=>{
  assert.equal(QUIZ.QUESTIONS.length,18);
  const n=Object.fromEntries(ENN.ENNEAGRAMS.map(t=>[t,0]));
  for(const q of QUIZ.QUESTIONS){assert.notEqual(q.a.type,q.b.type);n[q.a.type]++;n[q.b.type]++;}
  for(const t of ENN.ENNEAGRAMS)assert.equal(n[t],4,t);
  const pick=t=>Object.fromEntries(QUIZ.QUESTIONS.map(q=>[q.id,q.a.type===t?'a':q.b.type===t?'b':'a']));
  for(const t of ENN.ENNEAGRAMS){const r=QUIZ.score(pick(t));assert.ok(r.complete);assert.equal(r.counts[t],4);assert.ok(r.type===t||r.close.includes(t),t);}
  assert.equal(QUIZ.score({e1:'a'}).type,null,'incomplete → no result');
  assert.match(QUIZ.DISCLAIMER,/不是专业测评/);assert.match(QUIZ.DISCLAIMER,/参考/);
});

test('copy red lines over the data, quiz, chart page and guide section',()=>{
  const strings=[];const walk=v=>{if(typeof v==='string')strings.push(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
  walk({TYPES:ENN.TYPES,CENTERS:ENN.CENTERS,COMPLEMENTS:ENN.COMPLEMENTS,GROUP_LABELS:ENN.GROUP_LABELS,COPY:ENN.COPY,Q:QUIZ.QUESTIONS,D:QUIZ.DISCLAIMER});
  for(const a of ENN.ENNEAGRAMS)for(const b of ENN.ENNEAGRAMS)strings.push(ENN.reason(a,b),ENN.matchLine(a,b));
  const files=['assets/js/friends-enneagram-data.js','assets/js/friends-enneagram-quiz.js','assets/js/friends-enneagram-chart.js','pages/friends-enneagram-chart.html'].map(p=>fs.readFileSync(path.join(ROOT,p),'utf8'));
  const guide=require('../../assets/js/friends-match-guide-data.js');
  const C=guide.COPY||guide;strings.push(C.enn,C.ennLink,C.close);
  assert.ok(strings.length>100);
  for(const t of [...strings,...files]){
    assert.deepEqual(findForbidden(t),[],t.slice(0,60));
    assert.ok(!/不合|不配|相克|科学|准确/.test(t),t.slice(0,60));
  }
  // User-visible strings: no percentages or scores (source files may use % in CSS widths, e.g. the progress bar).
  for(const t of strings)assert.ok(!/\d+\s*分(?!钟)|%|％/.test(t),t);
  // Self-proof: the guard does flag a planted bad line.
  assert.ok(findForbidden('九型人格保证你们必定合拍，契合度90%').length>=3);
});

test('match guide links the 九型人格 chart and loads the quiz; chart page supports ?type=',()=>{
  const html=fs.readFileSync(path.join(ROOT,'pages/friends-match-guide.html'),'utf8');
  assert.ok(html.includes('/pages/friends-enneagram-chart.html'));
  assert.ok(html.includes('friends-enneagram-quiz.js')&&html.includes('friends-enneagram-data.js'));
  const js=fs.readFileSync(path.join(ROOT,'assets/js/friends-enneagram-chart.js'),'utf8');
  assert.match(js,/get\('type'\)/);assert.ok(!/innerHTML/.test(js),'chart renders with textContent only');
  const app=fs.readFileSync(path.join(ROOT,'assets/js/friends.js'),'utf8');
  assert.ok(app.includes("friends-enneagram-chart.html'+(enneagrams.includes"),'type chip links to the chart with ?type=');
  const connect=fs.readFileSync(path.join(ROOT,'pages/friends-connect.html'),'utf8');
  assert.ok(connect.indexOf('friends-enneagram-data.js')>0&&connect.indexOf('friends-enneagram-data.js')<connect.indexOf('/assets/js/friends.js"'));
});
