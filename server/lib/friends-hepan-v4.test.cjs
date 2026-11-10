'use strict';
// 合盘 v4：规则计分、确定性、可见性/泄露扫描、违禁词回落、自己合盘次数、v3 兼容。全部 mock 模型，不调真实接口。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('./friends-hepan-v4'),C=require('./friends-hepan-copy'),V=require('./friends-hepan-view');
const {createFriendsStore}=require('./friends-store'),XB=require('./friends-cross-border');
const {createCompatibilityService,VERSION,VERSION_V4,ACCEPTED_VERSIONS}=require('./friends-compatibility');
const {createHepanSelfService,LIMITS}=require('./friends-hepan-self');
const {ACCEPTED_CONSENT_VERSIONS}=require('./friends-pair-reports');
const CFG=require('./friends-hepan-config.json');

// 测试用盘：A=男 甲午日；B=女 庚子日。年/月/日/时柱全部相冲，日干庚克甲 —— 磨合点多。
const CLASH={A:{gender:'male',pillars:{year:'甲子',month:'丙寅',day:'甲午',hour:'庚午'}},B:{gender:'female',pillars:{year:'庚午',month:'壬申',day:'庚子',hour:'甲子'}}};
// 合得多：甲子日 vs 己丑日，天干五合 + 配偶宫六合。
const HARMONY={A:{gender:'male',pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'甲子'}},B:{gender:'female',pillars:{year:'己丑',month:'丁卯',day:'己丑',hour:'己丑'}}};
const SECRET='x'.repeat(40);

test('stem and branch relations follow the PRD priority order',()=>{
 assert.deepEqual(E.stemRelation('甲','己'),{type:'合',dir:null});
 assert.deepEqual(E.stemRelation('甲','丙'),{type:'生',dir:'AB'});
 assert.deepEqual(E.stemRelation('丙','甲'),{type:'生',dir:'BA'});
 assert.deepEqual(E.stemRelation('甲','戊'),{type:'克',dir:'AB'});
 assert.deepEqual(E.stemRelation('庚','甲'),{type:'克',dir:'AB'});
 assert.equal(E.stemRelation('甲','乙').type,'同');
 const br=(a,b)=>E.branchRelation(a,b).type;
 assert.equal(br('子','丑'),'六合');assert.equal(br('子','午'),'冲');assert.equal(br('子','卯'),'刑');
 assert.equal(br('寅','巳'),'刑','寅巳 同时是刑和害，按 刑>害 取刑');
 assert.equal(br('巳','申'),'六合','巳申 同时是六合和刑，按 六合 优先');
 assert.equal(br('子','未'),'害');assert.equal(br('申','辰'),'三合');assert.equal(br('辰','辰'),'刑');assert.equal(br('子','子'),'同');assert.equal(br('子','寅'),'无');
});

test('scoring: sub = clamp(base + 4 × rule points, 0..25); totals out of 100 with no floor; tiers from config',()=>{
 const h=E.analyze(HARMONY.A,HARMONY.B);
 const hit=id=>h.hits.find(x=>x.id===id);
 assert.equal(hit('day_stem').type,'合');assert.equal(hit('day_stem').points,2);
 assert.equal(hit('day_branch').type,'六合');assert.equal(hit('day_branch').points,2);
 for(const k of ['stem','branch','wuxing','star']){const pts=h.hits.filter(x=>x.sub===k).reduce((n,x)=>n+x.points,0);assert.equal(h.subs[k].points,pts);assert.equal(h.subs[k].score,Math.max(0,Math.min(25,Math.round(CFG.base+4*pts))));}
 assert.equal(h.total,h.subs.stem.score+h.subs.branch.score+h.subs.wuxing.score+h.subs.star.score);
 // 男甲木的妻星=土，女己土；女己土的夫星=木，男甲木 → 双方 +2
 assert.equal(h.starMode,'spouse');assert.equal(h.stars.A.kind,'财星');assert.equal(h.stars.A.elements[0],'土');assert.equal(h.stars.A.partnerIs,'star');assert.equal(h.stars.B.kind,'官杀');assert.equal(h.stars.B.elements[0],'木');assert.equal(h.stars.B.partnerIs,'star');
 const c=E.analyze(CLASH.A,CLASH.B);
 assert.equal(c.hits.find(x=>x.id==='day_branch').type,'冲');assert.equal(c.hits.find(x=>x.id==='day_branch').points,-2);
 assert.equal(c.hits.find(x=>x.id==='day_stem').type,'克');assert.equal(c.hits.find(x=>x.id==='day_stem').points,-1);
 assert.ok(c.total<h.total);
 assert.ok(c.total<70,'no floor: a clashing pair can score well below the median');
 for(const a of [h,c])assert.equal(a.tier,a.total>=CFG.thresholds.great?'great':a.total>=CFG.thresholds.fine?'fine':'grind');
 assert.equal(E.analyze(CLASH.A,CLASH.B,{config:{...CFG,base:0}}).subs.branch.score,0,'clamped at 0');
});

test('calibration config came from the committed 10k simulation script',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../../scripts/friends-hepan-simulate.cjs')));
 assert.equal(CFG.calibration.n,10000);assert.ok(Math.abs(CFG.calibration.median-70)<=3);
 assert.ok(CFG.thresholds.great>CFG.thresholds.fine);
 const s=CFG.calibration.shares;assert.ok(Math.abs(s.great-30)<=5&&Math.abs(s.grind-20)<=5,'tiers roughly 30/50/20');
});

test('unknown hour on either side uses three pillars and is marked limited',()=>{
 const a=E.analyze({...HARMONY.A,pillars:{...HARMONY.A.pillars,hour:null}},HARMONY.B);
 assert.equal(a.limited,true);assert.deepEqual(a.used,['year','month','day']);
 assert.ok(!a.hits.some(h=>h.pillar==='hour'));assert.equal(a.relations.length,3);
 const r=V.buildReport({analysis:a,picked:E.items(a),prose:C.templateProse(a,E.items(a)),charts:{A:{...HARMONY.A,pillars:{...HARMONY.A.pillars,hour:null}},B:HARMONY.B},mode:'self'});
 assert.match(r.limitedNote,/有限参考/);
});

test('same-sex pairs and 搭子 purpose use 相处星 (印/比劫) instead of 夫妻星',()=>{
 assert.equal(E.analyze(HARMONY.A,{...HARMONY.B,gender:'male'}).starMode,'companion');
 const b=E.analyze(HARMONY.A,HARMONY.B,{purpose:'buddy'});assert.equal(b.starMode,'companion');assert.equal(b.stars.A.kind,'印比');
 assert.equal(V.buildReport({analysis:b,picked:E.items(b),prose:C.templateProse(b,E.items(b)),charts:HARMONY,mode:'self'}).subs.find(s=>s.key==='star').label,'相处星');
});

test('determinism: the same pair always produces the same analysis, items and cache key',()=>{
 const one=E.analyze(CLASH.A,CLASH.B),two=E.analyze(structuredClone(CLASH.A),structuredClone(CLASH.B));
 assert.deepEqual(one,two);assert.deepEqual(E.items(one),E.items(two));
 assert.equal(E.cacheKey(CLASH.A,CLASH.B),E.cacheKey({pillars:{...CLASH.A.pillars},gender:'male'},CLASH.B));
 assert.notEqual(E.cacheKey(CLASH.A,CLASH.B),E.cacheKey(CLASH.A,CLASH.B,'buddy'));
 const p=E.items(one);assert.ok(p.he.length<=3&&p.mohe.length<=3);
});

test('fixed template copy contains no 干支 characters and no banned words',()=>{
 const all=[];
 for(const pillar of E.PILLARS)for(const part of ['stem','branch'])for(const type of part==='stem'?['合','生','同','克']:['六合','三合','冲','刑','害'])for(const kind of ['he','mohe']){const t=C.template({id:pillar+'_'+part,pillar,part,type,dir:'AB'},kind);if(t)all.push(t);}
 all.push(C.template({id:'wx_bu',elements:E.ELEMENTS},'he'),C.template({id:'wx_que',elements:E.ELEMENTS},'mohe'));
 for(const pair of [HARMONY,CLASH])for(const purpose of ['romance','buddy']){const a=E.analyze(pair.A,pair.B,{purpose});all.push(C.templateProse(a,E.items(a)),C.starText(a));}
 const text=JSON.stringify(all);
 assert.deepEqual(C.ganzhiIn(text),[]);
 for(const w of [...C.BANNED,'%'])assert.ok(!text.includes(w),w);
 for(const t of all.filter(t=>t.advice))assert.ok(t.advice.length>=2&&t.advice.length<=3);
});

test('leakScan flags forbidden chars in values and keys, skips whitelisted words and allowed paths',()=>{
 const f=C.forbiddenFor(CLASH.A.pillars);
 assert.ok(!f.includes('甲'),'day master is visible');assert.ok(f.includes('子')&&f.includes('丙')&&f.includes('寅')&&f.includes('午')&&f.includes('庚'));
 assert.deepEqual(C.leakScan({a:'孩子们的未来，自己决定'},f),[]);
 assert.equal(C.leakScan({a:{b:['年柱是甲子']}},f)[0].path,'a.b.0');
 assert.equal(C.leakScan({丙:'x'},f)[0].path,'丙');
 assert.deepEqual(C.leakScan({people:{me:{pillars:{year:'庚午'}}}},f,{allow:['people.me.pillars']}),[]);
});

// —— 邀请合盘（服务层）——
function fixture({generate=null,isUnlocked,clock=()=>Date.parse('2026-11-09T04:00:00Z')}={}){
 const store=XB.grant(createFriendsStore(),'a','b');
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'阿甲',listed:true},{userId:'b',shareId:'card-b',nickname:'小庚',listed:true}];});
 const charts={'1990-01-01':CLASH.A,'1990-02-02':CLASH.B,'1991-01-01':HARMONY.A,'1991-02-02':HARMONY.B};
 const calculateChart=inp=>{const c=charts[inp.birthday];if(!c)throw Object.assign(Error('bad'),{status:400});const known=inp.time!==null;return {complete:known,pillars:known?{...c.pillars}:null,basePillars:known?undefined:{...c.pillars,hour:null},dayPillar:c.pillars.day,birthLocation:{id:'x'},calculationVersion:'test'};};
 const calls=[];const gen=generate?async(messages,opts)=>{calls.push(messages);return generate(messages,calls.length);}:null;
 const service=createCompatibilityService({store,calculateChart,generateProse:gen,clock,...(isUnlocked?{isUnlocked}:{})});
 const p=service.create('a',{targetShareId:'card-b'});
 const auth=(uid,birthday,extra={})=>service.authorize(uid,p.id,{version:VERSION_V4,consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input:{birthday,calendar:'solar',cityId:'x',time:'08:00',gender:uid==='a'?'male':'female'},...extra});
 const restart=()=>createCompatibilityService({store,calculateChart,generateProse:gen,clock,...(isUnlocked?{isUnlocked}:{})});
 return {store,service,p,auth,calls,restart};
}
const stripAllowed=r=>{const c=structuredClone(r);delete c.people.me.pillars;delete c.people.me.dayMaster;delete c.people.me.nickname;delete c.people.ta.nickname;return c;};

test('invite visibility: each side sees only its own full pillars; the other side shows 日主 + ？ and no other 干支 anywhere',async()=>{
 const f=fixture();await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 for(const [viewer,mine,theirs] of [['a',CLASH.A,CLASH.B],['b',CLASH.B,CLASH.A]]){
  const r=await f.service.report(viewer,f.p.id);
  assert.equal(r.kind,'hepan_v4');
  assert.deepEqual(r.people.me.pillars,mine.pillars);
  assert.equal(r.people.ta.pillars,null);assert.equal(r.people.ta.hidden,true);assert.equal(r.people.ta.dayMaster,[...theirs.pillars.day][0]);
  assert.equal(r.people.me.zao,viewer==='a'?'乾造':'坤造');assert.equal(r.people.ta.zao,viewer==='a'?'坤造':'乾造');
  const forbidden=C.forbiddenFor(theirs.pillars),text=JSON.stringify(stripAllowed(r));
  assert.deepEqual(C.ganzhiIn(text).filter(ch=>forbidden.includes(ch)),[],'no other-side chars beyond 日主 in any field');
  assert.deepEqual(V.assertNoLeak(r,theirs.pillars),[]);
  for(const k of Object.values(theirs.pillars))assert.ok(!text.includes(k),k);
  assert.ok(!/1990|-01-01|-02-02/.test(JSON.stringify(r)),'no birthdays');
 }
});

test('free invite truncation: 天干/夫妻星 shown, 地支/五行 locked; 1 磨合点 + moreCount; no basis; unlock stub defaults locked',async()=>{
 const f=fixture();await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 const r=await f.service.report('a',f.p.id);
 assert.equal(r.unlocked,false);assert.equal(r.full,false);
 assert.deepEqual(r.subs.map(s=>[s.key,s.locked]),[['stem',false],['branch',true],['wuxing',true],['star',false]]);
 assert.ok(r.subs.every(s=>!('score' in s)&&!('max' in s)),'no per-sub score in the payload');assert.equal('total' in r,false);
 assert.equal('moheTotal' in r,false,'free tier returns only the locked count');assert.ok(r.moreCount>=1);assert.equal(r.mohe.length,1);assert.ok(r.mohe[0].advice.length>=2&&r.mohe[0].advice.length<=3);assert.match(r.lock.text,new RegExp('还有'+r.moreCount+'条'));assert.equal(r.lock.available,false);
 assert.equal(r.allShown,false);assert.equal(r.basis,null);assert.equal(r.wuxing,null);assert.equal(r.star,null);
 assert.deepEqual(r.footer,['传统文化参考，不预测关系结果。']);
 const g=fixture({isUnlocked:()=>true});await g.auth('a','1990-01-01');await g.auth('b','1990-02-02');
 const full=await g.service.report('a',g.p.id);assert.equal(full.full,true);assert.equal(full.mohe.length,full.moheTotal);assert.equal(full.moheTotal,r.moreCount+1);assert.ok(full.basis.length);assert.ok(full.subs.every(s=>!s.locked&&!('score' in s)));
 assert.deepEqual(V.assertNoLeak(full,CLASH.B.pillars),[]);
});

test('allShown=true when there is at most one 磨合点, and nothing is held back',async()=>{
 const f=fixture();await f.auth('a','1991-01-01');await f.auth('b','1991-02-02');
 const r=await f.service.report('b',f.p.id);
 assert.ok(r.moheTotal<=1,'fixture has ≤1 磨合点');assert.equal(r.allShown,true);assert.equal(r.full,true);assert.equal(r.moreCount,0);assert.equal(r.lock,null);
 assert.ok(r.subs.every(s=>!s.locked));
 assert.deepEqual(V.assertNoLeak(r,HARMONY.A.pillars),[]);
});

const goodProse=(messages)=>{const facts=JSON.parse(messages[1].content),items={};for(const it of facts.items)items[it.id]={meaning:'这是一段关于'+it.title+'的通俗解释，说明它在传统合婚里的意思。',life:'放到日常里，就是两个人相处时的一些小习惯。',...(it.kind==='磨合'?{advice:['每周约一次散步，边走边聊。','有分歧时先暂停，再约时间谈。']}:{})};return JSON.stringify({summary:'{A}和{B}的日主分别是'+facts.dayMasters.A+'、'+facts.dayMasters.B+'，整体看合处和磨处都有，用心相处会越来越顺。',items});};

test('DeepSeek prose: only 日主 + relation names are sent; output cached per pair and labelled AI 辅助生成',async()=>{
 const f=fixture({generate:goodProse});await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 const r1=await f.service.report('a',f.p.id),r2=await f.service.report('a',f.p.id),r3=await f.service.report('b',f.p.id);
 assert.equal(f.calls.length,1,'one generation per pair');
 assert.equal(r1.aiAssisted,true);assert.equal(r1.aiLabel,'AI 辅助生成');assert.deepEqual(r1,r2);assert.equal(r3.summary.includes('TA和你'),true);
 const sent=JSON.stringify(f.calls[0]);
 for(const ch of [...C.forbiddenFor(CLASH.A.pillars),...C.forbiddenFor(CLASH.B.pillars)])assert.ok(!JSON.parse(f.calls[0][1].content).items.some(i=>i.title.includes(ch)));
 assert.ok(!sent.includes('1990')&&!sent.includes('阿甲')&&!sent.includes('小庚'),'no birthdays or names');
 const facts=JSON.parse(f.calls[0][1].content);assert.equal(facts.charts,undefined);assert.ok(!JSON.stringify(facts).includes(CLASH.A.pillars.year));
});

test('banned word or leaked 干支 → retry once → fixed template fallback; second-attempt success is accepted',async()=>{
 for(const bad of [m=>goodProse(m).replace('整体看','需要化解，整体看'),m=>goodProse(m).replace('整体看','年柱子午相冲，整体看'),()=>'not json',m=>goodProse(m).replace('整体看','有百分之八十整体看')]){
  const f=fixture({generate:bad});await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
  const r=await f.service.report('a',f.p.id);
  assert.equal(f.calls.length,2,'retry exactly once');assert.equal(r.aiAssisted,false);assert.equal(r.aiLabel,null);
  assert.match(r.summary,/按传统合婚规则/);for(const w of C.BANNED)assert.ok(!JSON.stringify(r).includes(w));
  assert.deepEqual(V.assertNoLeak(r,CLASH.B.pillars),[]);
 }
 const f=fixture({generate:(m,n)=>n===1?goodProse(m).replace('整体看','必定'):goodProse(m)});await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 const r=await f.service.report('a',f.p.id);assert.equal(f.calls.length,2);assert.equal(r.aiAssisted,true);
 const a=E.analyze(CLASH.A,CLASH.B),p=E.items(a);
 assert.equal(C.validateProse(JSON.parse(goodProse(C.buildMessages(C.promptFacts(a,p,{mode:'invite'})))),a,p,{mode:'invite'}).ok,true);
 const leaky=JSON.parse(goodProse(C.buildMessages(C.promptFacts(a,p,{mode:'invite'}))));leaky.items[p.mohe[0].id].advice=['戴红色手链，往东南方向走。','选个吉日再谈。'];
 assert.equal(C.validateProse(leaky,a,p,{mode:'invite'}).ok,false);
});

test('v4 authorization requires inference consent and gender; stores pool opt-in choice only',async()=>{
 const f=fixture();
 await assert.rejects(f.auth('a','1990-01-01',{inferenceConsent:false}),{status:400});
 await assert.rejects(f.service.authorize('a',f.p.id,{version:VERSION_V4,consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input:{birthday:'1990-01-01',calendar:'solar',cityId:'x',time:'08:00'}}),{status:400});
 await f.auth('a','1990-01-01',{poolOptIn:true});
 const auth=f.store.read().compatibilityPairs[0].authorizations.a;
 assert.equal(auth.version,VERSION_V4);assert.equal(auth.inferenceConsent,true);assert.equal(auth.poolOptIn,true);assert.equal(auth.chart.gender,'male');
 assert.ok(!JSON.stringify(f.store.read()).includes('1990-01-01'),'birthday never stored');
 await f.auth('b','1990-02-02',{input:{birthday:'1990-02-02',calendar:'solar',cityId:'x',time:null,gender:'female'}});
 const r=await f.service.report('a',f.p.id);assert.equal(r.limited,true);assert.equal(r.relations.length,3);
});

test('v3 compatibility: v3 pairs keep the old guide + 「重新授权可看新版」; mixed pairs too; status/chat accept both versions',async()=>{
 assert.deepEqual(ACCEPTED_VERSIONS,[VERSION,VERSION_V4]);assert.equal(VERSION,'compatibility-guide-v3');
 assert.deepEqual([...ACCEPTED_CONSENT_VERSIONS],[VERSION,VERSION_V4]);
 const f=fixture(),v3=(uid,b)=>f.service.authorize(uid,f.p.id,{version:VERSION,consent:true,crossBorderConsent:true,allowChat:true,input:{birthday:b,calendar:'solar',cityId:'x',time:'08:00'}});
 await v3('a','1990-01-01');await v3('b','1990-02-02');
 let view=f.service.get('a',f.p.id);assert.equal(view.status,'ready');assert.equal(view.v4Ready,false);assert.equal(view.needsV4Reauthorization,true);
 let r=await f.service.report('a',f.p.id);assert.equal(r.kind,'relationship_guide_basic');assert.equal(r.v4Upgrade.text,'重新授权可看新版');
 f.service.sendMessage('a',f.p.id,{text:'你好',clientMessageId:'msg-00001'});
 await f.auth('a','1990-01-01',{allowChat:true});
 view=f.service.get('a',f.p.id);assert.equal(view.status,'ready');assert.equal(view.myVersion,VERSION_V4);assert.equal(view.peerVersion,VERSION);
 r=await f.service.report('a',f.p.id);assert.equal(r.kind,'relationship_guide_basic');assert.equal(r.v4Upgrade.mine,false);assert.equal(r.v4Upgrade.peer,true);
 assert.equal(f.service.messages('b',f.p.id).messages.length,1,'chat still works across versions');
 await f.auth('b','1990-02-02',{allowChat:true});
 assert.equal((await f.service.report('b',f.p.id)).kind,'hepan_v4');
 assert.equal((await f.service.report('b',f.p.id,{legacyGuide:true})).kind,'relationship_guide_basic','paid pair report keeps the v3 guide shape');
});

// —— 自己合盘 ——
function selfFixture({generate=null}={}){
 let now=Date.parse('2026-11-09T04:00:00Z');
 const store=XB.grant(createFriendsStore(),'me','me2','other');
 const calls=[];const service=createHepanSelfService({store,secret:SECRET,clock:()=>now,generateProse:generate?async m=>{calls.push(m);return generate(m);}:null});
 const body={purpose:'romance',consents:{informed:true,selfOnly:true,adult:true},me:{birthday:'1992-05-06',calendar:'solar',time:'10:00',gender:'female'},ta:{nickname:'阿北',birthday:'1990-11-23',calendar:'solar',time:null,gender:'male'}};
 return {store,service,body,calls,setNow:v=>now=v,now:()=>now};
}
test('self mode: 3 required consents, TA nickname, cross-border consent, TA must be adult',async()=>{
 const f=selfFixture();
 for(const k of ['informed','selfOnly','adult'])await assert.rejects(f.service.run('me',{...f.body,consents:{...f.body.consents,[k]:false}}),{status:400});
 await assert.rejects(f.service.run('me',{...f.body,ta:{...f.body.ta,nickname:''}}),{status:400});
 await assert.rejects(f.service.run('me',{...f.body,ta:{...f.body.ta,birthday:'2012-01-01'}}),{status:400,message:/对方需年满18岁/});
 await assert.rejects(f.service.run('nobody',f.body),{code:'XS_CROSS_BORDER_CONSENT_REQUIRED'});
 const r=await f.service.run('me',f.body);
 assert.equal(r.mode,'self');assert.equal(r.ownerOnly,true);assert.equal(r.inPool,false);assert.equal(r.limited,true);
 assert.ok(r.people.me.pillars.year&&r.people.ta.pillars.year,'self mode shows both full pillars');assert.equal(r.people.ta.nickname,'阿北');
 assert.ok(r.subs.every(s=>!s.locked),'self free shows all four sub-scores');
});
test('self mode limits: 3/day per account, 3/day per device, 10/day per IP; failures do not count; resets next Beijing day',async()=>{
 const f=selfFixture(),ctx={device:'dev-aaaaaaaaaaaaaaaa',ip:'1.2.3.4'};
 assert.equal(f.service.quota('me',ctx).remaining,3);
 await assert.rejects(f.service.run('me',{...f.body,consents:{}},ctx),{status:400});
 assert.equal(f.service.quota('me',ctx).remaining,3,'failed attempt not counted');
 for(let i=0;i<3;i++)assert.equal((await f.service.run('me',f.body,ctx)).remaining,2-i);
 await assert.rejects(f.service.run('me',f.body,{device:'dev-bbbbbbbbbbbbbbbb',ip:'5.6.7.8'}),{status:429},'account limit');
 await assert.rejects(f.service.run('me2',f.body,ctx),{status:429},'same device, other account');
 for(let i=0;i<3;i++)await f.service.run('me2',f.body,{device:'dev-cccccccccccccccc',ip:'1.2.3.4'});
 for(let i=0;i<3;i++)await f.service.run('other',f.body,{device:'dev-dddddddddddddddd'+i,ip:'1.2.3.4'}).catch(e=>{if(e.status!==429)throw e;});
 assert.equal(f.service.quota('fresh',{ip:'1.2.3.4'}).remaining,1,'ip used 9 of 10');
 f.setNow(f.now()+86400000);assert.equal(f.service.quota('me',ctx).remaining,3);
 const raw=JSON.stringify(f.store.read());assert.ok(!raw.includes('1.2.3.4')&&!raw.includes('dev-aaaa'),'counters are hashed');
});
test('self mode never stores TA; save keeps only tier/score/item ids; owner-only and deletable',async()=>{
 const f=selfFixture({generate:()=>'{}'}),r=await f.service.run('me',f.body);
 const raw=JSON.stringify(f.store.read());
 for(const s of ['1990-11-23','1992-05-06','阿北',...Object.values(r.people.ta.pillars).filter(Boolean),...Object.values(r.people.me.pillars).filter(Boolean)])assert.ok(!raw.includes(s),s);
 assert.equal(f.calls.length,2,'mocked model rejected twice → template');assert.equal(r.aiAssisted,false);
 assert.ok(JSON.parse(f.calls[0][1].content).charts,'self mode may send both charts (own data), but no birthday');assert.ok(!JSON.stringify(f.calls[0]).includes('1990-11-23'));
 await assert.rejects(Promise.resolve().then(()=>f.service.save('me2',{saveToken:r.saveToken})),{status:400});
 const tampered=Buffer.from(r.saveToken,'base64url');tampered[tampered.length-1]^=1;await assert.rejects(Promise.resolve().then(()=>f.service.save('me',{saveToken:tampered.toString('base64url')})),{status:400});
 const saved=f.service.save('me',{saveToken:r.saveToken});
 assert.equal('total' in r,false);assert.equal(saved.tier,r.tier);
 const rawSaved=JSON.stringify(f.store.read().hepanSelfSaved);assert.deepEqual(C.ganzhiIn(rawSaved),[],'no 干支 in saved record');assert.ok(!rawSaved.includes('1990'));
 assert.equal(f.service.list('me').saved.length,1);assert.equal(f.service.list('me2').saved.length,0);
 assert.throws(()=>f.service.get('me2',saved.id),{status:404});assert.throws(()=>f.service.remove('me2',saved.id),{status:404});
 assert.deepEqual(f.service.remove('me',saved.id),{deleted:true});assert.equal(f.service.list('me').saved.length,0);
 assert.ok(!('friendPool' in f.store.read())&&!JSON.stringify(f.store.read()).includes('pool'),'never enters any pool');
});
test('self HTTP endpoints sit behind auth + same-origin JSON and pass device/IP to the limiter',async()=>{
 let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}
 const {createCompatibilityRouter}=require('../routes/friends-compatibility'),f=selfFixture(),app=express();app.use(express.json());
 app.use(createCompatibilityRouter({express,service:{status:()=>({})},selfService:f.service,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
 try{const base='http://127.0.0.1:'+server.address().port,h={'X-Test-User':'me','Content-Type':'application/json','X-Runae-Friends':'1','X-Xs-Device':'dev-eeeeeeeeeeeeeeee'};
  assert.equal((await fetch(base+'/self/quota')).status,401);
  assert.equal((await fetch(base+'/self',{method:'POST',headers:{...h,'X-Runae-Friends':''},body:JSON.stringify(f.body)})).status,403);
  const res=await fetch(base+'/self',{method:'POST',headers:h,body:JSON.stringify(f.body)});assert.equal(res.status,200);const r=await res.json();assert.equal(r.remaining,2);
  assert.equal((await (await fetch(base+'/self/quota',{headers:h})).json()).remaining,2);
  const saved=await (await fetch(base+'/self/saved',{method:'POST',headers:h,body:JSON.stringify({saveToken:r.saveToken})})).json();
  assert.equal('total' in (await (await fetch(base+'/self/saved/'+saved.id,{headers:h})).json()),false);
  assert.equal((await fetch(base+'/self/saved/'+saved.id+'/delete',{method:'POST',headers:h,body:'{}'})).status,200);
 }finally{await new Promise(r=>server.close(r));}
});

// Runae 现有合盘库 mingyu-core 的关系表是权威来源：我们的同步检测必须与它逐对一致（按 PRD 优先级取一个类别）。
// 运行时不直接调用它：它是 ESM（需异步 import）、要求四柱齐全（做不了三柱有限参考）、做 16 组跨柱比对且含六破/天干冲（PRD 不计分）。
test('relation tables agree with mingyu-core (vendor) for all 144 branch pairs and 100 stem pairs',async()=>{
 const {pathToFileURL}=require('node:url');
 const R=await import(pathToFileURL(path.join(__dirname,'liuyao-engine/vendor/node_modules/mingyu-core/dist/ganzhi/relations.js')).href);
 const sanheSame=(a,b)=>Object.values(R.SANHE_GROUPS).some(g=>g.includes(a)&&g.includes(b));
 for(const a of E.BRANCHES)for(const b of E.BRANCHES){
  const v=a===b?(R.isSanxing(a,b)?'刑':'同'):R.LIUHE_MAP[a]===b?'六合':R.LIUCHONG_MAP[a]===b?'冲':R.isSanxing(a,b)?'刑':R.LIUHAI_MAP[a]===b?'害':sanheSame(a,b)?'三合':'无';
  assert.equal(E.branchRelation(a,b).type,v,a+b);
 }
 const W={木:'木',火:'火',土:'土',金:'金',水:'水'};
 for(const a of E.STEMS)for(const b of E.STEMS){
  const x=E.stemElement(a),y=E.stemElement(b);
  const v=R.TIAN_GAN_HE[a]?.partner===b?'合':x===y?'同':R.isSheng(W[x],W[y])||R.isSheng(W[y],W[x])?'生':'克';
  assert.equal(E.stemRelation(a,b).type,v,a+b);
 }
});

// 回归：真实排盘的随机配对，固定模板报告从两个视角都不该被泄露扫描误判。
// 曾经的坑：题记「君子和而不同」《论语·子路》里的「子」撞上对方命盘的子，整份报告 500。
test('no false positives: template invite reports for 400 real random pairs pass the leak scan from both sides',()=>{
 const {calculate}=require('./friends-chart');
 let s=20261109;const rand=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
 const pick=()=>{const y=1975+Math.floor(rand()*30),m=1+Math.floor(rand()*12),d=1+Math.floor(rand()*28),unknown=rand()<0.15;
  const r=calculate({birthday:y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),calendar:'solar',time:unknown?null:String(Math.floor(rand()*24)).padStart(2,'0')+':30'},new Date('2026-11-09T00:00:00Z'));
  return {gender:rand()<0.5?'male':'female',pillars:r.complete?r.pillars:r.basePillars};};
 const tiers=new Set();
 for(let i=0;i<400;i++){
  const A=pick(),B=pick(),an=E.analyze(A,B,{purpose:rand()<0.1?'buddy':'romance'}),picked=E.items(an),prose={...C.templateProse(an,picked),items:{}};tiers.add(an.tier);
  for(const viewer of ['A','B']){
   const r=V.buildReport({analysis:an,picked,prose,charts:{A,B},mode:'invite',viewer,taNickname:'阿屿',meNickname:'小满'});
   assert.deepEqual(V.assertNoLeak(r,(viewer==='A'?B:A).pillars),[],'pair '+i+' viewer '+viewer);
  }
 }
 assert.equal(tiers.size,3,'sample should cover all three tiers (incl. 大体合拍 whose 题记 has 子)');
 // 自证：真把对方的时柱塞进报告，扫描仍然要报。
 const an=E.analyze(CLASH.A,CLASH.B),picked=E.items(an),r=V.buildReport({analysis:an,picked,prose:{...C.templateProse(an,picked),items:{}},charts:CLASH,mode:'invite',viewer:'A'});
 r.summary+=CLASH.B.pillars.hour;
 assert.ok(V.assertNoLeak(r,CLASH.B.pillars).some(h=>h.path==='summary'));
});

// ===== 复审修正（1109 第二轮）=====
// 免费版锁住的东西，返回里一个字都不能有：锁住分项的分数、moheTotal、锁住磨合点的关系/标签/依据。
function lockedLeaks(r,analysis,picked){
 const out=[],json=JSON.stringify(r),locked=picked.mohe.slice(1);
 if('moheTotal' in r)out.push('moheTotal');
 for(const s of r.subs)if('score' in s||'max' in s)out.push('score:'+s.key);
 if(r.basis!==null)out.push('basis');if(r.wuxing!==null)out.push('wuxing');if(r.star!==null)out.push('star');
 for(const h of locked){if(json.includes('"'+h.id+'"'))out.push('id:'+h.id);if(h.pillar){const rel=r.relations.find(x=>x.pillar===h.pillar)[h.part];if(rel.type!==null||rel.locked!==true)out.push('relation:'+h.id);}}
 // 地支分项锁住：没在已展示条目里出现的地支关系都不给
 const shown=new Set([...r.he,...r.mohe].map(x=>x.id));
 for(const x of r.relations)if(!shown.has(x.pillar+'_branch')&&x.branch.type!==null)out.push('branch:'+x.pillar);
 return out;
}
test('free tier (invite, both viewers): locked subs, moheTotal, locked 磨合点 relations/tags and all unshown 地支 relations are absent; full tier has them all',async()=>{
 const an=E.analyze(CLASH.A,CLASH.B),picked=E.items(an);assert.ok(picked.mohe.length>=2,'fixture must have locked 磨合点');
 const f=fixture();await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 for(const uid of ['a','b']){const r=await f.service.report(uid,f.p.id);assert.equal(r.full,false);assert.deepEqual(lockedLeaks(r,an,picked),[]);
  assert.equal(r.moreCount,picked.mohe.length-1);assert.ok(r.relations.some(x=>x.stem.type!==null),'天干 sub is free, so unlocked 天干 relations stay');
  assert.equal('total' in r,false,'no numeric total in the payload');}
 const g=fixture({isUnlocked:()=>true});await g.auth('a','1990-01-01');await g.auth('b','1990-02-02');
 const full=await g.service.report('a',g.p.id);assert.equal(full.moheTotal,picked.mohe.length);assert.ok(full.relations.every(x=>x.stem.type!==null&&x.branch.type!==null&&!x.stem.locked&&!x.branch.locked));assert.ok(full.star&&full.wuxing&&full.basis);
 // 自证：如果把锁住的磨合点关系塞回去，检查会报
 const r=await f.service.report('a',f.p.id),h=picked.mohe.find((x,i)=>i>0&&x.pillar);if(h){r.relations.find(x=>x.pillar===h.pillar)[h.part]={type:h.type};assert.ok(lockedLeaks(r,an,picked).includes('relation:'+h.id));}
});
function clashSelf({generate=null,clock}={}){
 let now=Date.parse('2026-11-09T04:00:00Z');const store=XB.grant(createFriendsStore(),'me','me2','other'),calls=[];
 const charts={'1990-01-01':CLASH.A,'1990-02-02':CLASH.B,'1991-01-01':HARMONY.A,'1991-02-02':HARMONY.B};
 const calculateChart=inp=>{const c=charts[inp.birthday];return {complete:true,pillars:{...c.pillars},dayPillar:c.pillars.day};};
 const service=createHepanSelfService({store,secret:SECRET,calculateChart,clock:clock||(()=>now),generateProse:generate?async m=>{calls.push(m);return generate(m,calls.length);}:null});
 const body=(a='1990-01-01',b='1990-02-02')=>({purpose:'romance',consents:{informed:true,selfOnly:true,adult:true},me:{birthday:a,calendar:'solar',time:'08:00',gender:'male'},ta:{nickname:'阿北',birthday:b,calendar:'solar',time:'08:00',gender:'female'}});
 return {store,service,body,calls,setNow:v=>now=v};
}
test('self mode uses the same free/full locking for the live result, the save token and savedView',async()=>{
 const an=E.analyze(CLASH.A,CLASH.B),picked=E.items(an),f=clashSelf();
 const r=await f.service.run('me',f.body(),{device:'d'.repeat(20)});assert.equal(r.full,false);assert.deepEqual(lockedLeaks(r,an,picked),[]);
 assert.ok(r.people.ta.pillars,'self mode still shows both charts (own input)');
 // 保存凭证是密文：解码看不到分项和磨合点
 const decoded=Buffer.from(r.saveToken,'base64url').toString('latin1');assert.throws(()=>JSON.parse(decoded));for(const w of ['subs','hits','mohe','total','"score"'])assert.ok(!decoded.includes(w),w);
 const saved=f.service.save('me',{saveToken:r.saveToken}),v=f.service.get('me',saved.id);
 assert.deepEqual(v.subs.map(s=>[s.key,s.locked,'score' in s]),[['stem',false,false],['branch',true,false],['wuxing',true,false],['star',false,false]]);
 assert.equal(v.mohe.length,1);assert.equal(v.moreCount,picked.mohe.length-1);assert.equal('moheTotal' in v,false);assert.equal(v.full,false);
 for(const h of picked.mohe.slice(1))assert.ok(!JSON.stringify(v).includes('"'+h.id+'"'),h.id);
 // ≤1 条磨合点：全部展示，四项分都有
 const g=clashSelf(),r2=await g.service.run('me',g.body('1991-01-01','1991-02-02'));assert.equal(r2.full,true);assert.ok(r2.subs.every(s=>!s.locked&&!('score' in s)));
 const v2=g.service.get('me',g.service.save('me',{saveToken:r2.saveToken}).id);assert.ok(v2.subs.every(s=>!s.locked&&!('score' in s)));
});
test('self quota is reserved atomically before the model call: 10 parallel requests → exactly 3 succeed; failures refund',async()=>{
 const f=clashSelf({generate:async m=>{await new Promise(r=>setTimeout(r,25));return goodProse(m);}}),ctx={device:'p'.repeat(20),ip:'203.0.113.9'};
 const results=await Promise.allSettled(Array.from({length:10},()=>f.service.run('me',f.body(),ctx)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,LIMITS.account);
 assert.ok(results.filter(x=>x.status==='rejected').every(x=>x.reason.status===429));
 assert.equal(f.calls.length,1,'concurrent identical requests share one model call');assert.equal(f.service.quota('me',ctx).remaining,0);
 // 预占之后出错要退回：模拟组装报告时抛错
 const g=clashSelf(),orig=V.buildReport;V.buildReport=()=>{throw Error('boom');};
 try{await assert.rejects(g.service.run('me',g.body(),ctx),/boom/);}finally{V.buildReport=orig;}
 assert.equal(g.service.quota('me',ctx).remaining,LIMITS.account,'refunded');
 await g.service.run('me',g.body(),ctx);assert.equal(g.service.quota('me',ctx).remaining,LIMITS.account-1);
});
test('only AI prose is cached; template fallback is served uncached (no fallbackReason stored) and AI is retried after a cooldown',async()=>{
 let now=Date.parse('2026-11-09T04:00:00Z'),ok=false;const gen=m=>ok?goodProse(m):'not json';
 const f=fixture({generate:gen,clock:()=>now});await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 const r1=await f.service.report('a',f.p.id);assert.equal(r1.aiAssisted,false);assert.equal(f.calls.length,2);
 const stored=()=>JSON.stringify(f.store.read());assert.ok(!stored().includes('fallbackReason'));assert.equal(f.store.read().compatibilityPairs[0].v4Cache,undefined,'template is not cached');
 ok=true;const r2=await f.service.report('a',f.p.id);assert.equal(f.calls.length,2,'within cooldown: no model call');assert.equal(r2.aiAssisted,false);
 now+=11*60000;const r3=await f.service.report('a',f.p.id);assert.equal(f.calls.length,3,'after cooldown: AI retried');assert.equal(r3.aiAssisted,true);
 assert.equal(f.store.read().compatibilityPairs[0].v4Cache.prose.source,'ai');
 ok=false;const r4=await f.service.report('b',f.p.id);assert.equal(f.calls.length,3,'AI prose served from cache');assert.equal(r4.aiAssisted,true);
 // 自己合盘同一规则
 let t=Date.parse('2026-11-09T04:00:00Z'),okS=false;const s=clashSelf({generate:m=>okS?goodProse(m):'not json',clock:()=>t});
 assert.equal((await s.service.run('me',s.body())).aiAssisted,false);assert.equal(s.calls.length,2);
 okS=true;assert.equal((await s.service.run('me',s.body())).aiAssisted,false);assert.equal(s.calls.length,2,'cooldown');
 t+=11*60000;assert.equal((await s.service.run('me',s.body())).aiAssisted,true);assert.equal(s.calls.length,3);
 okS=false;assert.equal((await s.service.run('me2',s.body())).aiAssisted,true);assert.equal(s.calls.length,3,'cached AI prose');
 assert.ok(!JSON.stringify(s.store.read()).includes('fallbackReason'));
});
test('mixed v3/v4 pair: v3 guide and paid pair-report facts use only the day pillar when time is unknown (as before v4)',async()=>{
 const A=require('./friends-pair-report-adapter');
 const f=fixture();await f.service.authorize('a',f.p.id,{version:VERSION,consent:true,crossBorderConsent:true,input:{birthday:'1990-01-01',calendar:'solar',cityId:'x',time:'08:00'}});
 await f.auth('b','1990-02-02',{input:{birthday:'1990-02-02',calendar:'solar',cityId:'x',time:null,gender:'female'}});
 const pair=f.store.read().compatibilityPairs[0],chart=pair.authorizations.b.chart;
 assert.deepEqual(Object.keys(chart.pillars),['day'],'stored pillars keep the v3 shape');assert.deepEqual(Object.keys(chart.v4Pillars).filter(k=>chart.v4Pillars[k]),['year','month','day']);
 const guide=await f.service.report('a',f.p.id);assert.equal(guide.kind,'relationship_guide_basic');assert.equal(guide.completeFourPillars,false);
 assert.deepEqual(guide.themes.map(t=>t.available),[false,false,true,false]);
 const facts=A.buildPairFacts({pair,guide,purpose:Object.keys(A.PURPOSES)[0],stage:Object.keys(A.STAGES)[0]});
 assert.deepEqual(facts.traditional.filter(x=>/^t_(year|month|day|hour)$/.test(x.id)).map(x=>x.id),['t_day']);
 // 两边都升级到 v4 后，新版报告用上三柱
 await f.auth('a','1990-01-01');const v4=await f.service.report('a',f.p.id);assert.equal(v4.kind,'hepan_v4');assert.equal(v4.limited,true);assert.equal(v4.relations.length,3);
 // 付费报告的禁止字串也覆盖三柱
 const forbidden=A.collectForbiddenStrings({pair:f.store.read().compatibilityPairs[0]});for(const k of ['year','month','day'])assert.ok(forbidden.has?forbidden.has(CLASH.B.pillars[k]):forbidden.includes(CLASH.B.pillars[k]),k);
});

// ===== 复审第三轮 =====
test('invite AI cooldown is stored on the pair (survives a restart) and each user has an hourly model-call cap',async()=>{
 let now=Date.parse('2026-11-09T04:00:00Z');const f=fixture({generate:()=>'not json',clock:()=>now});await f.auth('a','1990-01-01');await f.auth('b','1990-02-02');
 await f.service.report('a',f.p.id);const n=f.calls.length;assert.ok(n>0);
 const rec=f.store.read().compatibilityPairs[0].v4AiRetry;assert.ok(rec&&rec.at===now+10*60000,'cooldown persisted on the pair');
 await f.restart().report('b',f.p.id);assert.equal(f.calls.length,n,'new process: still cooling down, no model call');
 now+=11*60000;await f.restart().report('b',f.p.id);assert.ok(f.calls.length>n,'after cooldown the model is retried');
 // 每人每小时上限：上限用完后不调模型，直接模板；一小时后恢复
 const g=fixture({generate:()=>'not json',clock:()=>now});await g.auth('a','1990-01-01');await g.auth('b','1990-02-02');
 g.store.transaction(s=>{s.hepanAiCalls={a:Array.from({length:C.AI_CALLS_PER_HOUR},()=>now-1000)};});
 const r=await g.service.report('a',g.p.id);assert.equal(g.calls.length,0,'capped: no model call');assert.equal(r.aiAssisted,false);
 assert.equal(g.store.read().compatibilityPairs[0].v4AiRetry,undefined,'cap does not start the pair cooldown');
 await g.service.report('b',g.p.id);assert.ok(g.calls.length>0,'other user has own budget');
 assert.equal(g.store.read().hepanAiCalls.b.length,1);
 // 自己合盘共用同一个桶
 let t=Date.parse('2026-11-09T04:00:00Z');const s=clashSelf({generate:goodProse,clock:()=>t});s.store.transaction(x=>{x.hepanAiCalls={me:Array.from({length:C.AI_CALLS_PER_HOUR},()=>t)};});
 assert.equal((await s.service.run('me',s.body())).aiAssisted,false);assert.equal(s.calls.length,0);
 t+=3600001;assert.equal((await s.service.run('me',s.body())).aiAssisted,true);assert.equal(s.calls.length>0,true);
});
test('paid pair-report forbidden strings include the v4 three-pillar values (time unknown)',async()=>{
 const A=require('./friends-pair-report-adapter'),f=fixture();await f.auth('a','1990-01-01');await f.auth('b','1990-02-02',{input:{birthday:'1990-02-02',calendar:'solar',cityId:'x',time:null,gender:'female'}});
 const pair=f.store.read().compatibilityPairs[0],chart=pair.authorizations.b.chart;assert.deepEqual(Object.keys(chart.pillars),['day']);
 const forbidden=[...A.collectForbiddenStrings({pair})];
 for(const k of ['year','month','day'])assert.ok(forbidden.includes(CLASH.B.pillars[k]),'b.'+k);
 // 自证：只看 chart.pillars 的话年柱月柱会漏掉
 const onlyPillars=new Set(Object.values(chart.pillars));assert.ok(!onlyPillars.has(CLASH.B.pillars.year));
});
test('self save token is single-use: replay returns the same saved record; replay after delete is rejected',async()=>{
 const f=clashSelf(),r=await f.service.run('me',f.body());
 const a=f.service.save('me',{saveToken:r.saveToken}),b=f.service.save('me',{saveToken:r.saveToken});
 assert.equal(b.id,a.id);assert.deepEqual(b,a);assert.equal(f.service.list('me').saved.length,1);
 assert.ok(!JSON.stringify(a).includes('tokenId'));
 f.service.remove('me',a.id);assert.throws(()=>f.service.save('me',{saveToken:r.saveToken}),e=>e.status===409);assert.equal(f.service.list('me').saved.length,0);
 // 新的一次合盘有新凭证，可以正常保存
 const r2=await f.service.run('me',f.body());assert.notEqual(f.service.save('me',{saveToken:r2.saveToken}).id,a.id);
 assert.throws(()=>f.service.save('other',{saveToken:r2.saveToken}),e=>e.status===400,'token bound to owner');
});
