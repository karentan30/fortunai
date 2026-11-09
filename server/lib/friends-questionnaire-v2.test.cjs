'use strict';
// 2026-11-10 问卷改版：文字题改多选、旧答案升级、底线题/深入/敏感题的可见范围、展开说说、亲密节奏小结。
const test=require('node:test'),assert=require('node:assert/strict');
let express;try{express=require('express');}catch(_){express=require('../../server/node_modules/express');}
const {createFriendsStore}=require('./friends-store');
const Q=require('./friends-questionnaire');
const GUARD=require('./friends-copy-guard');
const {DATE_ACTIVITIES}=require('../../assets/js/friends-date-activities.js');
const {availableTags}=require('./friends-serious-tags');
const {createFriendsQuestionnaireRouter}=require('../routes/friends-questionnaire');
const bank=Q.BANK,V=bank.version,OLD='marriage-10d-2026-11-06-v1';
const qOf=id=>bank.dimensions.flatMap(d=>d.questions).find(q=>q.id===id);
const save=(svc,uid,dim,answers,status='done')=>svc.saveDimension(uid,dim,{version:V,consent:true,status,answers});
const QUICK={'family-marry-timing':'1to3','family-kids-wish':'want','hist-accept':'both','future-city':'stay','rel-live':'apart','finance-wedding':'simple','bound-contact':'daily','bound-meet':'few','pace-define':'1to3m','pace-steps':['chat','video'],'pace-family':'year','hab-smoke':'none','hab-pets':'want'};
function fillQuick(svc,uid,over={}){
 const by={};for(const [id,v]of Object.entries({...QUICK,...over})){const q=qOf(id);(by[q.dimensionId]||={})[id]={value:v};}
 for(const [dim,answers]of Object.entries(by))save(svc,uid,dim,answers,'in_progress');
}
function fixture(){
 const store=require('./friends-cross-border').grant(createFriendsStore(),'a','b','c','d','e','f');
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'card-a',nickname:'阿安',listed:true,purposes:['serious','friend']},{userId:'b',shareId:'card-b',nickname:'小北',listed:true,purposes:['serious']},{userId:'c',shareId:'card-c',nickname:'小陈',listed:true,purposes:['dating','serious']},{userId:'d',shareId:'card-d',nickname:'小丁',listed:false,purposes:['serious']},{userId:'e',shareId:'card-e',nickname:'小鹅',listed:true,purposes:['buddy','friend']},{userId:'f',shareId:'card-f',nickname:'小方',listed:true,purposes:['dating']}];s.requests=[{id:'r1',from:'a',to:'b',status:'accepted'}];});
 return {store,svc:Q.createFriendsQuestionnaireService({store,clock:()=>Date.parse('2026-11-10T00:00:00Z')})};
}
const answersOf=view=>Object.assign({},...Object.values(view.dimensions||{}).map(d=>d.answers));

// ---------- 题库 ----------
test('bank v2: no free-text questions left; converted questions are warm multi-choice with 2-3 picks',()=>{
 assert.equal(V,'marriage-10d-2026-11-10-v2');assert.deepEqual(bank.upgradeFrom,[OLD]);
 const all=bank.dimensions.flatMap(d=>d.questions);
 assert.equal(all.filter(q=>q.type==='text').length,0,'every text question became multi');
 for(const q of all.filter(q=>q.replaces&&q.type==='multi')){assert.ok(q.options.length>=5&&q.options.length<=8,q.id);assert.ok(q.maxSelect>=2&&q.maxSelect<=3,q.id);assert.ok(q.notePlaceholder,q.id);}
 assert.equal(all.filter(q=>q.replaces&&q.type==='multi').length,10);
 for(const q of all)assert.equal(q.dimensionId&&bank.dimensions.find(d=>d.id===q.dimensionId).questions.includes(q),true,q.id);
 // 约会活动直接复用约会活动选项
 for(const o of qOf('lei-invite').options)assert.ok(DATE_ACTIVITIES.includes(o.value),o.value);
 // 量表两端有意义的文字
 for(const q of all.filter(q=>q.type==='scale')){assert.ok(q.lowLabel&&q.highLabel&&q.lowLabel!==q.highLabel,q.id);assert.ok(!/^[1-5]$/.test(q.lowLabel),q.id);}
 // 节奏/时间题：第一个选项是「看感觉走」，并且和任何答案都合得来
 for(const id of ['family-marry-timing','bound-contact','bound-meet','pace-define','pace-family','pace-touch','pace-intimate','pace-steps']){const o=qOf(id).options[0];assert.equal(o.label,'看感觉走',id);assert.equal(o.open,true,id);}
 for(const id of bank.quickPath.questions)assert.ok(qOf(id),id);
 assert.ok(bank.quickPath.questions.length>=10&&bank.quickPath.questions.length<=14);
 assert.ok(bank.importanceOptions.some(o=>o.value==='dealbreaker'&&o.label==='这条是我的底线'));
 assert.deepEqual(bank.entry,{title:'看得见五官，也看得见三观',subtitle:'花3分钟先答底线题，见面前就知道彼此在意什么'});
 for(const id of ['family-health','rel-family','hist-marital','pace-intimate'])assert.equal(qOf(id).sensitive,true,id);
});

test('bank copy passes the copy guard and stays neutral',()=>{
 const strings=[];(function walk(v){if(typeof v==='string')strings.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);})(bank);
 for(const t of strings){assert.deepEqual(GUARD.findForbidden(t),[],t);assert.doesNotMatch(t,/[%％]|不合|人格|障碍|焦虑型|回避型|睡觉|性生活|性关系|男方|女方|老公|老婆/,t);}
 assert.equal(bank.rhythm.fineprint,'仅供了解彼此节奏，不是心理测评');
 assert.deepEqual(Object.values(bank.rhythm.summaries).map(s=>s.label),['更需要及时回应','更需要个人空间','两者比较平衡']);
});

test('「看感觉走」 and other open options are compatible with everything',()=>{
 const P=(dim,answers)=>({dimensions:{[dim]:{status:'done',answers}}}),A=v=>({state:'answered',value:v});
 assert.equal(Q.questionnaireAlignment(P('boundaries',{'pace-define':A('feel')}),P('boundaries',{'pace-define':A('6m')})).dimensions[4].signal,'unknown');
 assert.equal(Q.questionnaireAlignment(P('boundaries',{'pace-steps':A(['feel'])}),P('boundaries',{'pace-steps':A(['meet'])})).dimensions[4].signal,'unknown');
 assert.equal(Q.questionnaireAlignment(P('boundaries',{'pace-steps':A(['chat'])}),P('boundaries',{'pace-steps':A(['meet'])})).dimensions[4].signal,'talk');
 assert.equal(Q.questionnaireAlignment(P('conflict',{'conflict-silence':A('sameday')}),P('conflict',{'conflict-silence':A('keep')})).dimensions[3].signal,'close');
 // 敏感题从不进比较 / 排序信号
 assert.equal(Q.questionnaireAlignment(P('boundaries',{'pace-intimate':A('natural')}),P('boundaries',{'pace-intimate':A('wed')})).dimensions[4].signal,'unknown');
});

// ---------- 旧答案 ----------
function oldRecord(uid){return {recordId:'old-'+uid,userId:uid,version:OLD,matchingConsent:true,revision:3,updatedAt:'2026-11-07T00:00:00Z',consentVersion:'marriage-10d-private-v1',dimensions:{
 family:{status:'done',updatedAt:'x',answers:{'family-marry-timing':{state:'answered',value:'1to3',importance:'essential'},'family-kids-wish':{state:'answered',value:'want'},'family-note':{state:'answered',value:'OLD-SECRET 想离父母近一点'}}},
 boundaries:{status:'done',updatedAt:'x',answers:{'bound-pace':{state:'answered',value:'slow'},'bound-contact':{state:'answered',value:'daily'},'bound-note':{state:'discuss',note:'OLD-NOTE 想当面聊'}}},
 history:{status:'done',updatedAt:'x',answers:{'hist-learned':{state:'answered',value:'OLD-LESSON'},'hist-share':{state:'answered',value:'brief'}}}}};}

test('old v1 answers upgrade without crash, without being compared, and are never wiped or exposed',()=>{
 const {store,svc}=fixture();
 store.transaction(s=>{s.marriageQuestionnaires=[oldRecord('a'),oldRecord('b')];s.questionnaireShares=[];});
 const got=svc.get('a').questionnaire;
 assert.equal(got.version,V);
 assert.equal(got.dimensions.family.answers['family-note'],undefined);assert.equal(got.dimensions.family.answers['family-topics'],undefined,'old text never becomes a multi answer');
 assert.equal(got.dimensions.family.legacyText['family-topics'],'OLD-SECRET 想离父母近一点');
 assert.equal(got.dimensions.boundaries.legacyText['pace-intimate'],'慢慢来，需要先建立信任');
 assert.equal(got.dimensions.boundaries.legacyText['bound-respect'],'OLD-NOTE 想当面聊');
 assert.equal(got.dimensions.history.legacyText['hist-lesson'],'OLD-LESSON');
 assert.equal(got.dimensions.family.answers['family-marry-timing'].value,'1to3','unchanged choice answers carry over');
 // 排序信号照常可用（两人都同意过辅助推荐）
 const sig=Q.pairAlignment(store.read(),'a','b').signals;assert.equal(sig.find(d=>d.id==='family').signal,'close');
 // 旧格式即使漏进来也不报错
 assert.doesNotThrow(()=>Q.questionnaireAlignment(oldRecord('a'),oldRecord('b')));
 assert.ok(availableTags(oldRecord('a')).length>0,'serious-page tags keep working for old records');
 // 存一个别的方向：不再清空旧答案
 const r=save(svc,'a','habits',{'hab-smoke':{value:'none'}}).questionnaire;
 assert.equal(r.dimensions.family.answers['family-marry-timing'].value,'1to3');assert.equal(r.dimensions.family.legacyText['family-topics'],'OLD-SECRET 想离父母近一点');
 assert.equal(store.read().marriageQuestionnaires.find(x=>x.userId==='a').version,V);
 // 重新回答那题后，旧文字就不再保留
 const r2=save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-topics':{value:['near'],note:'想离父母近一点'}}).questionnaire;
 assert.equal(r2.dimensions.family.legacyText,undefined);
 // 连接的人、填了底线题的人都看不到旧文字
 fillQuick(svc,'b');
 const seen=JSON.stringify([svc.member('b','card-a'),svc.shared('b','card-a')]);
 assert.doesNotMatch(seen,/OLD-SECRET|OLD-NOTE|OLD-LESSON|legacyText|建立信任/);
});

// ---------- 可见范围 ----------
test('visibility: guests see nothing; members must finish their own 底线题; deep answers only for connected people',()=>{
 const {store,svc}=fixture();
 fillQuick(svc,'a');save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-wish':{value:'want'},'family-chores':{value:'half',note:'DEEP-NOTE'}},'in_progress');
 // 访客 / 自己
 assert.deepEqual(Q.memberView(store.read(),'a',null),{dimensions:{}});assert.deepEqual(Q.memberView(store.read(),'a',undefined),{dimensions:{}});
 assert.deepEqual(Q.memberView(store.read(),'a','a'),{dimensions:{}});
 // c 没答底线题：什么都看不到
 let c=svc.member('c','card-a');assert.deepEqual(c.peer.dimensions,{});assert.equal(c.viewerQuickReady,false);
 // c 答完底线题：看得到 a 的底线题，看不到深入话题（没互相加上）
 fillQuick(svc,'c');c=svc.member('c','card-a');const ca=answersOf(c.peer);
 assert.equal(c.viewerQuickReady,true);assert.equal(ca['family-marry-timing'].value,'1to3');assert.deepEqual(ca['pace-steps'].value,['chat','video']);
 assert.equal(ca['family-chores'],undefined);assert.doesNotMatch(JSON.stringify(c),/DEEP-NOTE/);
 // b 已互相加上、但没答底线题：看得到深入话题，看不到底线题
 let b=answersOf(svc.member('b','card-a').peer);assert.equal(b['family-chores'].note,'DEEP-NOTE');assert.equal(b['family-marry-timing'],undefined);
 fillQuick(svc,'b');b=answersOf(svc.member('b','card-a').peer);assert.equal(b['family-marry-timing'].value,'1to3');
 // 未上架、也没连接的人：直接 404，不说原因
 assert.throws(()=>svc.member('c','card-d'),e=>e.status===404);
 // 拉黑后即刻看不到
 store.transaction(s=>{s.blocks=[{by:'a',target:'c'}];});assert.throws(()=>svc.member('c','card-a'),e=>e.status===404);assert.deepEqual(Q.memberView(store.read(),'a','c'),{dimensions:{}});
});

test('sensitive questions (incl. pace-intimate) are hidden by default, even from connected viewers, until shared one by one',()=>{
 const {store,svc}=fixture();
 fillQuick(svc,'a');fillQuick(svc,'b');
 save(svc,'a','boundaries',{...Object.fromEntries(['bound-contact','bound-meet','pace-define','pace-family'].map(id=>[id,{value:QUICK[id]}])),'pace-steps':{value:QUICK['pace-steps']},'pace-touch':{value:'official'},'pace-intimate':{value:'wed',note:'INTIMATE-NOTE'}},'in_progress');
 save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-wish':{value:'want'},'family-health':{value:'yes'}},'in_progress');
 save(svc,'a','history',{'hist-accept':{value:'both'},'hist-marital':{value:'single'}},'in_progress');
 save(svc,'a','relatives',{'rel-live':{value:'apart'},'rel-family':{value:['debt'],note:'DEBT-NOTE'}},'in_progress');
 const sens=['pace-intimate','family-health','hist-marital','rel-family'];
 let seen=answersOf(svc.member('b','card-a').peer);
 assert.equal(seen['pace-touch'].value,'official','connected-only pace question is visible to connected viewer');
 for(const id of sens)assert.equal(seen[id],undefined,id+' hidden by default');
 assert.doesNotMatch(JSON.stringify([svc.member('b','card-a'),svc.shared('b','card-a'),svc.member('c','card-a')]),/INTIMATE-NOTE|DEBT-NOTE/);
 // 旧规则下双方开放了方向，敏感题也仍然藏着
 svc.setShare('a','card-b',{dimensions:['boundaries','family'],consent:true});svc.setShare('b','card-a',{dimensions:['boundaries','family'],consent:true});
 seen=answersOf(svc.shared('b','card-a').peer);for(const id of sens)assert.equal(seen[id],undefined,id);
 // 本人逐题打开后才能看到；非连接的人仍看不到（不在底线题里）
 svc.setVisibility('a',{shareSensitive:['pace-intimate']});
 seen=answersOf(svc.member('b','card-a').peer);assert.equal(seen['pace-intimate'].value,'wed');assert.equal(seen['pace-intimate'].note,'INTIMATE-NOTE');
 assert.equal(answersOf(svc.member('c','card-a').peer)['pace-intimate'],undefined);
 // 敏感题从不进排序信号
 svc.setMatching('a',{consent:true});svc.setMatching('b',{consent:true});
 save(svc,'b','boundaries',{'pace-intimate':{value:'natural'}},'in_progress');
 assert.throws(()=>svc.setVisibility('a',{shareSensitive:['pace-touch']}),e=>e.status===400,'only sensitive questions can be in shareSensitive');
 // 不一致只说「节奏不同」，并且只有双方都打开时才说
 assert.deepEqual(svc.member('b','card-a').notes,[]);
 svc.setVisibility('b',{shareSensitive:['pace-intimate']});
 const m=svc.member('b','card-a');assert.deepEqual(m.notes,['节奏不同，值得提前聊聊']);assert.ok(!m.highlights.some(h=>h.questionId==='pace-intimate'));
});

test('privateTopics switch back to 仅自己 immediately',()=>{
 const {svc}=fixture();
 fillQuick(svc,'a');fillQuick(svc,'b');fillQuick(svc,'c');save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-wish':{value:'want'},'family-chores':{value:'half'}},'in_progress');
 assert.ok(answersOf(svc.member('c','card-a').peer)['family-marry-timing']);
 svc.setVisibility('a',{privateTopics:['quick']});
 assert.deepEqual(svc.member('c','card-a').peer.dimensions,{});
 assert.equal(answersOf(svc.member('b','card-a').peer)['family-marry-timing'],undefined);assert.ok(answersOf(svc.member('b','card-a').peer)['family-chores']);
 // 自己把底线题设为仅自己，也就看不到别人的底线题（填了才能看）
 assert.equal(svc.member('a','card-c').viewerQuickReady,false);assert.deepEqual(svc.member('a','card-c').peer.dimensions,{});
 svc.setVisibility('a',{privateTopics:['family']});
 assert.equal(answersOf(svc.member('b','card-a').peer)['family-chores'],undefined);assert.equal(answersOf(svc.member('b','card-a').peer)['family-marry-timing'],undefined);
 assert.ok(answersOf(svc.member('c','card-a').peer)['hab-smoke'],'other quick answers come back');
 assert.throws(()=>svc.setVisibility('a',{privateTopics:['nope']}),e=>e.status===400);
 assert.throws(()=>svc.setVisibility('c',{adopt:false}),e=>e.status===400);
 assert.throws(()=>svc.setVisibility('d',{privateTopics:[]}),e=>e.status===400,'no record yet');
});

test('old answers are not exposed retroactively; only re-saved changes or 「按新规则展示」 open them',()=>{
 const {store,svc}=fixture();
 store.transaction(s=>{s.marriageQuestionnaires=[oldRecord('a')];});
 fillQuick(svc,'b');
 assert.deepEqual(svc.member('b','card-a').peer.dimensions,{},'nothing old is visible');
 // a 改了一题再保存：只有新改的那题按新规则展示
 save(svc,'a','family',{'family-marry-timing':{value:'1to3',importance:'essential'},'family-kids-wish':{value:'together'},'family-chores':{value:'skill'}},'done');
 let seen=answersOf(svc.member('b','card-a').peer);
 assert.equal(seen['family-chores'].value,'skill');assert.equal(seen['family-marry-timing'],undefined,'unchanged old answer stays private');
 assert.equal(seen['family-kids-wish'].value,'together','a re-saved (changed) 底线题 answer follows the new rule');
 assert.equal(Object.keys(answersOf(svc.member('c','card-a').peer)).length,0);
 assert.equal(svc.get('a').questionnaire.sharing.model,'legacy');assert.doesNotMatch(JSON.stringify(svc.get('a')),/"open"/);
 // 本人确认「按新规则展示」后才全部生效
 svc.setVisibility('a',{adopt:true});
 seen=answersOf(svc.member('b','card-a').peer);assert.equal(seen['family-marry-timing'].value,'1to3');assert.equal(seen['hist-share'].value,'brief');
});

test('底线不同 only uses answers the viewer may see; rhythm summary is owner-only and soft',()=>{
 const {svc}=fixture();
 fillQuick(svc,'a',{'family-kids-wish':'want'});save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-wish':{value:'want',importance:'dealbreaker'}},'in_progress');
 fillQuick(svc,'c',{'family-kids-wish':'nokids'});
 let m=svc.member('c','card-a');assert.deepEqual(m.highlights,[{dimensionId:'family',questionId:'family-kids-wish',text:'底线不同'}]);
 svc.setVisibility('a',{privateTopics:['quick']});m=svc.member('c','card-a');assert.deepEqual(m.highlights,[],'hidden answer → no 底线不同');
 assert.deepEqual(svc.member('a','card-c').highlights,[],'a hid own 底线题 so cannot see c either');
 // 亲密节奏小结
 assert.equal(svc.get('a').rhythm,null,'needs at least 3 answers');
 let r=save(svc,'a','boundaries',{'rhythm-reply':{value:'ask'},'rhythm-closer':{value:'more'},'rhythm-after':{value:'confirm'}},'in_progress');
 assert.deepEqual(r.rhythm,{key:'respond',label:'更需要及时回应',tip:bank.rhythm.summaries.respond.tip,fineprint:'仅供了解彼此节奏，不是心理测评'});
 assert.equal(Q.rhythmOf({'rhythm-reply':{state:'answered',value:'fine'},'rhythm-closer':{state:'answered',value:'room'},'rhythm-after':{state:'answered',value:'later'}}).label,'更需要个人空间');
 assert.equal(Q.rhythmOf({'rhythm-reply':{state:'answered',value:'ask'},'rhythm-closer':{state:'answered',value:'room'},'rhythm-after':{state:'answered',value:'later'}}).label,'两者比较平衡');
 // 两人节奏不同 → 只给一句「节奏不同，值得提前聊聊」，不暴露对方的小结
 save(svc,'b','boundaries',{'rhythm-reply':{value:'fine'},'rhythm-closer':{value:'room'},'rhythm-after':{value:'alone'}},'in_progress');
 const bm=svc.member('b','card-a');assert.deepEqual(bm.notes,['节奏不同，值得提前聊聊']);assert.doesNotMatch(JSON.stringify(bm),/更需要|rhythm"?:\{/);
});

test('HTTP: /members needs login; /visibility needs same-site write header',async()=>{
 const {store,svc}=fixture(),app=express();app.use(express.json({limit:'64kb'}));
 fillQuick(svc,'a');
 app.use('/q',createFriendsQuestionnaireRouter({express,store,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/q';
 const call=async(user,path,method='GET',body,headers={})=>{const r=await fetch(base+path,{method,headers:{...(user?{'X-Test-User':user}:{}),'Content-Type':'application/json','X-Runae-Friends':'1',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 try{
  const guest=await call(null,'/members/card-a');assert.equal(guest.status,401);assert.doesNotMatch(JSON.stringify(guest.body),/1to3|card-a/);
  assert.deepEqual((await call('c','/members/card-a')).body.peer.dimensions,{});
  assert.equal((await call('a','/visibility','PUT',{privateTopics:['quick']},{'X-Runae-Friends':'0'})).status,403);
  assert.deepEqual((await call('a','/visibility','PUT',{privateTopics:['quick']})).body.questionnaire.sharing.privateTopics,['quick']);
 }finally{await new Promise(r=>server.close(r));}
});

// ---------- 自证：故意弄坏一条规则，上面的判据会转红 ----------
test('self-proof: each privacy check goes red when its rule is broken',()=>{
 const {store,svc}=fixture();
 fillQuick(svc,'a');fillQuick(svc,'b');save(svc,'a','boundaries',{'pace-intimate':{value:'wed'}},'in_progress');
 // 1. 敏感标记被去掉 → pace-intimate 会出现在连接的人那里
 const broken=structuredClone(bank);for(const d of broken.dimensions)for(const q of d.questions)if(q.id==='pace-intimate')delete q.sensitive;
 assert.equal(answersOf(Q.memberView(store.read(),'a','b',{bank:broken}))['pace-intimate']?.value,'wed');
 assert.equal(answersOf(Q.memberView(store.read(),'a','b'))['pace-intimate'],undefined);
 // 2. 「填了才能看」被拿掉（底线题列表为空）→ 没填底线题的 c 也能看到
 const noQuick={...structuredClone(bank),quickPath:{...bank.quickPath,questions:[]}};
 assert.equal(answersOf(Q.memberView(store.read(),'a','c'))['hab-smoke'],undefined);
 assert.equal(Q.quickReady(null,noQuick),false,'quickReady still needs a record');
 const st=store.read();st.requests.push({id:'r2',from:'a',to:'c',status:'accepted'});
 assert.equal(answersOf(Q.memberView(st,'a','c',{bank:noQuick}))['hab-smoke']?.value,'none','with the gate removed (treated as deep + connected) it leaks');
 // 3. 旧记录如果被当成新规则 → 旧答案就会被追溯公开
 store.transaction(s=>{s.marriageQuestionnaires=s.marriageQuestionnaires.filter(r=>r.userId!=='a');s.marriageQuestionnaires.push(oldRecord('a'));});
 assert.deepEqual(Q.memberView(store.read(),'a','b').dimensions,{});
 store.transaction(s=>{s.marriageQuestionnaires.find(r=>r.userId==='a').visibility={model:'v2'};});
 assert.ok(answersOf(Q.memberView(store.read(),'a','b'))['family-marry-timing'],'forcing v2 on an old record exposes it — the real code never does this');
 // 4. 访客：viewer 为空时必须为空；如果 viewer 被当成任何字符串就会泄露
 assert.deepEqual(Q.memberView(store.read(),'a','').dimensions,{});
});

test('purposes: buddy/friend-only members never see marriage answers; 底线题 need an overlapping 恋爱/认真结婚 purpose',()=>{
 const {store,svc}=fixture();
 fillQuick(svc,'a');save(svc,'a','family',{'family-marry-timing':{value:'1to3'},'family-kids-wish':{value:'want'},'family-chores':{value:'half'}},'in_progress');
 for(const u of ['c','e','f'])fillQuick(svc,u);
 assert.ok(answersOf(svc.member('c','card-a').peer)['family-marry-timing'],'serious ∩ serious → visible');
 const e=svc.member('e','card-a');assert.deepEqual(e.peer.dimensions,{},'buddy-only viewer sees nothing even after filling 底线题');assert.equal(e.romance,false);
 assert.deepEqual(svc.member('a','card-e').peer.dimensions,{},'and nobody sees a buddy-only owner');
 assert.deepEqual(svc.member('f','card-a').peer.dimensions,{},'dating-only vs serious: no overlapping purpose');
 // 连接了也不行（新规则）；只有双方逐方向开放的旧互看仍然有效
 store.transaction(s=>{s.requests.push({id:'r3',from:'a',to:'e',status:'accepted'});});
 assert.deepEqual(svc.member('e','card-a').peer.dimensions,{});
 // 自证：把 e 的目的改成认真结婚，同一套判据立刻能看到
 store.transaction(s=>{s.profiles.find(p=>p.userId==='e').purposes=['serious'];});
 assert.ok(answersOf(svc.member('e','card-a').peer)['family-chores'],'self-proof: with an overlapping purpose the same viewer sees answers');
});
