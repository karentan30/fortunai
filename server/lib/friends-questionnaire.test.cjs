'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let express;try{express=require('express');}catch(_){express=require('../../server/node_modules/express');}
const {createFriendsStore}=require('./friends-store');
const Q=require('./friends-questionnaire');
const {createFriendsQuestionnaireRouter}=require('../routes/friends-questionnaire');
const bank=Q.BANK,V=bank.version;
const save=(svc,uid,dim,answers,status='done',extra={})=>svc.saveDimension(uid,dim,{version:V,consent:true,status,answers,...extra});
function fixture({connect=true}={}){
 const store=createFriendsStore();
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'阿安',listed:true},{userId:'b',shareId:'card-b',nickname:'小北',listed:true},{userId:'c',shareId:'card-c',nickname:'陌生人',listed:true}];if(connect)s.requests=[{id:'r1',from:'a',to:'b',status:'accepted'}];});
 return {store,svc:Q.createFriendsQuestionnaireService({store,clock:()=>Date.parse('2026-11-06T00:00:00Z')})};
}

test('bank has ten dimensions with several non-yes/no questions, own marriage and kids timing, no prediction',()=>{
 assert.deepEqual(bank.dimensions.map(d=>d.id),['family','finance','future','conflict','boundaries','relatives','history','self','leisure','habits']);
 for(const d of bank.dimensions){assert.ok(d.questions.length>=4,d.id);assert.ok(d.questions.some(q=>q.type!=='text'));for(const q of d.questions)if(q.options)assert.ok(q.options.length>=3,q.id+' is not yes/no');}
 const fam=bank.dimensions[0].questions.map(q=>q.id);assert.ok(fam.includes('family-marry-timing')&&fam.includes('family-kids-timing'));
 assert.match(JSON.stringify(bank),/不会用生辰、命盘或任何方式推算、预测怀孕时间/);
 assert.doesNotMatch(JSON.stringify(bank),/科学|匹配度\d|成功率/);
});

test('save per dimension, resume at next unfinished dimension, revision guard',()=>{
 const {svc}=fixture();
 assert.equal(svc.get('a').questionnaire,null);assert.equal(svc.get('a').progress.nextDimension,'family');
 let r=save(svc,'a','family',{'family-marry-timing':{value:'1to3',importance:'important'}},'in_progress');
 assert.equal(r.questionnaire.revision,1);assert.equal(r.progress.nextDimension,'family');assert.equal(r.progress.settled,0);
 r=save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-timing':{value:'mid'},'family-note':{value:'  想离父母近一点 '}},'done',{expectedRevision:1});
 assert.equal(r.progress.nextDimension,'finance');assert.equal(r.progress.settled,1);
 const resumed=svc.get('a');assert.equal(resumed.questionnaire.dimensions.family.answers['family-note'].value,'想离父母近一点');assert.equal(resumed.questionnaire.visibility,'private');
 assert.throws(()=>save(svc,'a','finance',{},'in_progress',{expectedRevision:1}),e=>e.status===409);
 save(svc,'a','future',{},'in_progress');assert.equal(svc.get('a').progress.nextDimension,'future','in-progress dimension resumes first');
 assert.equal(svc.get('b').questionnaire,null,'other users see nothing');
 assert.throws(()=>save(svc,'a','family',{},'done',{consent:false}),e=>e.status===400);
 assert.throws(()=>save(svc,'a','family',{},'done',{version:'old'}),e=>e.status===400);
 assert.throws(()=>save(svc,'a','nope',{},'done'),e=>e.status===404);
});

test('skip and 待讨论 are valid answers; whole-dimension skip clears answers; bad input is rejected',()=>{
 const {svc}=fixture();
 const r=save(svc,'a','finance',{'finance-split':{state:'skip'},'finance-style':{state:'discuss',note:'想当面聊'},'finance-big':{value:'month'}});
 assert.equal(r.questionnaire.dimensions.finance.answers['finance-split'].state,'skip');
 assert.equal(r.questionnaire.dimensions.finance.answers['finance-style'].note,'想当面聊');
 const skipped=save(svc,'a','history',{'hist-share':{value:'brief'}},'skipped');
 assert.deepEqual(skipped.questionnaire.dimensions.history.answers,{});assert.equal(skipped.progress.dimensions.find(d=>d.id==='history').status,'skipped');
 assert.equal(save(svc,'a','habits',{},'discuss').progress.settled,3);
 for(const answers of [{'finance-split':{value:'nope'}},{'finance-split':{state:'skip',value:'aa'}},{'finance-split':{state:'maybe'}},{'finance-split':{value:'aa',userId:'b'}},{'finance-style':{value:6}},{'conflict-heard':{value:['listen','solve','space']}},{'finance-note':{value:'x'.repeat(301)}},{'finance-note':{value:'ok',importance:'essential'}},{'unknown':{value:1}}])
  assert.throws(()=>save(svc,'a',Object.keys(answers)[0].startsWith('conflict')?'conflict':'finance',answers),e=>e.status===400,JSON.stringify(answers));
 assert.throws(()=>svc.saveDimension('a','finance',{version:V,consent:true,status:'whatever',answers:{}}),e=>e.status===400);
});

test('unshared answers never leak; only mutually opened dimensions are visible and explained',()=>{
 const {svc,store}=fixture();
 save(svc,'a','family',{'family-kids-wish':{value:'want'},'family-note':{value:'SECRET-A-FAMILY'}});
 save(svc,'a','finance',{'finance-split':{value:'ratio'},'finance-style':{value:2},'finance-big':{value:'medium'},'finance-note':{value:'MARKER-A-FIN'}});
 save(svc,'b','family',{'family-kids-wish':{value:'nokids'},'family-note':{value:'SECRET-B-FAMILY'}});
 save(svc,'b','finance',{'finance-split':{value:'ratio'},'finance-style':{value:3},'finance-big':{value:'month'}});
 // 只有一方开放：对方什么都看不到
 svc.setShare('a','card-b',{dimensions:['family','finance'],consent:true});
 let seen=svc.shared('b','card-a');assert.deepEqual(seen.mutualDimensions,[]);assert.deepEqual(seen.peer.dimensions,{});assert.deepEqual(seen.explanations,[]);
 assert.doesNotMatch(JSON.stringify(seen),/SECRET|MARKER|ratio|want/);
 // B 只开放财务：双方只互看财务
 svc.setShare('b','card-a',{dimensions:['finance'],consent:true});
 seen=svc.shared('b','card-a');assert.deepEqual(seen.mutualDimensions,['finance']);assert.equal(seen.peer.dimensions.finance.answers['finance-note'].value,'MARKER-A-FIN');
 const text=JSON.stringify(seen);assert.doesNotMatch(text,/SECRET-A-FAMILY|family-kids-wish|家庭与生育分工/);
 assert.deepEqual(seen.explanations,[{dimensionId:'finance',signal:'close',text:'在财务方面想法接近'}]);
 assert.deepEqual(svc.shared('a','card-b').explanations.map(e=>e.text),['在财务方面想法接近']);
 assert.deepEqual(Q.discoverReasons(store.read(),'a','b'),['在财务方面想法接近']);
 const peers=svc.peers('b').peers;assert.equal(peers.length,1);assert.deepEqual(peers[0].theirOffered,['family','finance']);assert.doesNotMatch(JSON.stringify(peers),/SECRET|MARKER/);
 // 未连接的人、拉黑、撤回
 assert.throws(()=>svc.shared('c','card-a'),e=>e.status===404);assert.throws(()=>svc.setShare('c','card-a',{dimensions:['finance'],consent:true}),e=>e.status===404);
 assert.throws(()=>svc.setShare('a','card-b',{dimensions:['finance']}),e=>e.status===400,'needs explicit consent');
 svc.setShare('a','card-b',{dimensions:[]});assert.deepEqual(svc.shared('b','card-a').mutualDimensions,[]);assert.deepEqual(Q.discoverReasons(store.read(),'a','b'),[]);
 svc.setShare('a','card-b',{dimensions:['finance'],consent:true});assert.deepEqual(svc.shared('b','card-a').mutualDimensions,['finance']);
 store.transaction(s=>{s.blocks.push({by:'b',target:'a'});});assert.throws(()=>svc.shared('a','card-b'),e=>e.status===404);assert.deepEqual(Q.pairAlignment(store.read(),'a','b').explanations,[]);
 // 跳过的方向即使双方都开放也不比较
 store.transaction(s=>{s.blocks=[];});save(svc,'a','finance',{},'skipped');assert.deepEqual(svc.shared('b','card-a').mutualDimensions,[]);
 // 删除后不留分享
 svc.remove('a');assert.equal(svc.get('a').questionnaire,null);assert.equal(store.read().questionnaireShares.length,0);
});

test('matcher signals need both users to opt in, and never come with explanations of unshared dimensions',()=>{
 const {svc,store}=fixture();
 save(svc,'a','family',{'family-kids-wish':{value:'want',importance:'essential'}});save(svc,'b','family',{'family-kids-wish':{value:'nokids'}});
 assert.deepEqual(Q.pairAlignment(store.read(),'a','b').signals,[]);
 svc.setMatching('a',{consent:true});assert.deepEqual(Q.pairAlignment(store.read(),'a','b').signals,[]);
 svc.setMatching('b',{consent:true});const p=Q.pairAlignment(store.read(),'a','b');
 const fam=p.signals.find(d=>d.id==='family');assert.equal(fam.signal,'talk');assert.equal(fam.essentialDifference,true);assert.deepEqual(p.explanations,[],'no mutual sharing → no explanation');
 assert.throws(()=>svc.setMatching('a',{consent:'yes'}),e=>e.status===400);
});

test('questionnaireAlignment pure function semantics',()=>{
 const P=(dim,answers,status='done')=>({dimensions:{[dim]:{status,answers}}});
 const A=(value,extra={})=>({state:'answered',value,...extra});
 // 排序接近：一到三年 vs 三到五年 → 接近；一年内 vs 三到五年 → 需要聊聊
 let r=Q.questionnaireAlignment(P('family',{'family-marry-timing':A('1to3')}),P('family',{'family-marry-timing':A('3to5')}),{explainDimensions:['family']});
 assert.equal(r.dimensions[0].signal,'close');assert.deepEqual(r.explanations.map(e=>e.text),['在家庭与生育分工方面想法接近']);
 r=Q.questionnaireAlignment(P('family',{'family-marry-timing':A('within1')}),P('family',{'family-marry-timing':A('3to5')}),{explainDimensions:['family']});
 assert.equal(r.dimensions[0].signal,'talk');assert.deepEqual(r.explanations.map(e=>e.text),['在家庭与生育分工方面需要聊聊']);
 // 不打算结婚 vs 有时间表 → 需要聊聊；“还没想好”不参与比较
 assert.equal(Q.questionnaireAlignment(P('family',{'family-marry-timing':A('nomarry')}),P('family',{'family-marry-timing':A('within1')})).dimensions[0].signal,'talk');
 assert.equal(Q.questionnaireAlignment(P('family',{'family-marry-timing':A('unsure')}),P('family',{'family-marry-timing':A('within1')})).dimensions[0].signal,'unknown');
 // 默认不输出解释
 assert.deepEqual(Q.questionnaireAlignment(P('family',{'family-marry-timing':A('1to3')}),P('family',{'family-marry-timing':A('1to3')})).explanations,[]);
 // 多选有交集即接近；文本从不比较；待讨论算需要聊聊；跳过不比较
 assert.equal(Q.questionnaireAlignment(P('conflict',{'conflict-heard':A(['listen','space'])}),P('conflict',{'conflict-heard':A(['space'])})).dimensions[3].signal,'close');
 assert.equal(Q.questionnaireAlignment(P('family',{'family-note':A('x')}),P('family',{'family-note':A('y')})).dimensions[0].signal,'unknown');
 assert.equal(Q.questionnaireAlignment(P('habits',{'hab-tidy':{state:'discuss'}}),P('habits',{'hab-tidy':A(5)})).dimensions[9].signal,'talk');
 assert.equal(Q.questionnaireAlignment(P('habits',{'hab-tidy':{state:'skip'}}),P('habits',{'hab-tidy':A(5)})).dimensions[9].signal,'unknown');
 assert.equal(Q.questionnaireAlignment(P('habits',{'hab-tidy':A(1)},'skipped'),P('habits',{'hab-tidy':A(1)})).dimensions[9].signal,'unknown');
 // 一处小差异 + 三处接近仍算接近；若那处差异被标为“对我很重要”则需要聊聊
 const four=(tidy,imp)=>P('habits',{'hab-sleep':A('early'),'hab-smoke':A('none'),'hab-pets':A('want'),'hab-tidy':A(tidy,imp?{importance:imp}:{})});
 assert.equal(Q.questionnaireAlignment(four(1),four(5)).dimensions[9].signal,'close');
 assert.equal(Q.questionnaireAlignment(four(1,'essential'),four(5)).dimensions[9].signal,'talk');
 // 只有两种文案
 const all=Q.questionnaireAlignment(four(1),four(5),{explainDimensions:bank.dimensions.map(d=>d.id)});for(const e of all.explanations)assert.match(e.text,/^在.+方面(想法接近|需要聊聊)$/);
 assert.doesNotThrow(()=>Q.questionnaireAlignment(null,undefined));
});

test('HTTP router: login, same-site writes, save/resume/share',async()=>{
 const {store}=fixture(),app=express();app.use(express.json({limit:'64kb'}));
 app.use('/q',createFriendsQuestionnaireRouter({express,store,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/q';
 const call=async(user,path='',method='GET',body,headers={})=>{const r=await fetch(base+path,{method,headers:{...(user?{'X-Test-User':user}:{}),'Content-Type':'application/json','X-Runae-Friends':'1',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};};
 try{
  assert.equal((await call(null)).status,401);
  const first=await call('a');assert.equal(first.status,200);assert.equal(first.cache,'no-store');assert.equal(first.body.progress.nextDimension,'family');
  assert.equal((await call('a','/dimensions/family','PUT',{version:V,consent:true,status:'done',answers:{'family-kids-wish':{state:'discuss'}}})).status,200);
  assert.equal((await call('a')).body.progress.nextDimension,'finance');
  assert.equal((await call('a','/dimensions/family','PUT',{version:V,consent:true,status:'done',answers:{}},{'X-Runae-Friends':'0'})).status,403);
  assert.equal((await call('a','/dimensions/family','PUT',{version:V,consent:true,status:'done',answers:{},userId:'b'})).status,400);
  assert.equal((await call('a','/shares/card-c','PUT',{dimensions:['family'],consent:true})).status,404);
  assert.equal((await call('a','/shares/card-b','PUT',{dimensions:['family'],consent:true})).status,200);
  const peerView=await call('b','/shares/card-a');assert.equal(peerView.status,200);assert.deepEqual(peerView.body.peer.dimensions,{});
  assert.equal((await call('a','/matching','PUT',{consent:true})).body.questionnaire.matchingConsent,true);
  assert.equal((await call('a','','DELETE',{})).body.deleted,true);assert.equal((await call('a')).body.questionnaire,null);
 }finally{await new Promise(r=>server.close(r));}
});
