'use strict';
// 「测测我们是否相配」邀请闭环：朋友一步加入（认领 + 生辰 + 可选底线题），结果附「同频 / 可以聊聊」方向提示。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store');
const {createCompatibilityService,VERSION_V4}=require('./friends-compatibility');
const {createFriendsQuestionnaireService,BANK}=require('./friends-questionnaire');
const GUARD=require('./friends-copy-guard');

const IN={birthday:'1991-08-28',calendar:'solar',time:'06:00',gender:'female'};
const IN_B={birthday:'1990-03-12',calendar:'solar',time:'14:00',gender:'male'};
const authBody=(input,extra={})=>({version:VERSION_V4,consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input,...extra});
const questionOf=id=>{for(const d of BANK.dimensions)for(const q of d.questions)if(q.id===id)return {d,q};throw Error(id);};
// 每道底线题选第 n 个非 open 选项。
function answerQuick(mq,uid,pick){
 const byDim={};
 for(const id of BANK.quickPath.questions){const {d,q}=questionOf(id),opts=q.options.filter(o=>!o.open),o=opts[Math.min(pick(id),opts.length-1)];(byDim[d.id]||={})[id]={state:'answered',value:q.type==='multi'?[o.value]:o.value};}
 for(const [dim,answers] of Object.entries(byDim))mq.saveDimension(uid,dim,{version:BANK.version,consent:true,status:'in_progress',answers});
}
function fixture({relation='friend'}={}){
 const store=require('./friends-cross-border').grant(createFriendsStore(),'owner');
 let now=Date.parse('2026-11-10T04:00:00Z');
 const service=createCompatibilityService({store,clock:()=>now}),mq=createFriendsQuestionnaireService({store,clock:()=>now});
 return {store,service,mq,async invite(ownerInclude=true){const p=service.create('owner',{ownerNickname:'小林',relation});await service.authorize('owner',p.id,authBody(IN,{includeQuestionnaire:ownerInclude}));return p;}};
}
async function joinAndConfirm(f,p,{include=true,input=IN_B}={}){
 const j=await f.service.join('friend',{inviteToken:p.inviteToken,nickname:'阿青',claimConsent:true,...authBody(input,{includeQuestionnaire:include})});
 f.service.confirmRecipient('owner',p.id,{consent:true});
 return j;
}

test('invite preview shows only inviter nickname + relation; unknown token 404',async()=>{
 const f=fixture({relation:'couple'}),p=await f.invite();
 assert.deepEqual(f.service.invitePreview(p.inviteToken),{ownerNickname:'小林',relation:'couple'});
 assert.throws(()=>f.service.invitePreview('x'.repeat(43)),{status:404});
});

test('join claims + authorizes in one step; consented quick answers produce 同频 / 可以聊聊 directions without raw answers',async()=>{
 const f=fixture(),p=await f.invite();
 answerQuick(f.mq,'owner',()=>0);
 const j=await joinAndConfirm(f,p);
 assert.equal(j.status,'pending_recipient_confirmation');assert.equal(j.myAuthorized,true);assert.equal(j.relation,'friend');
 // 朋友：与发起人前半部分相同、后半部分不同 → 既有同频也有可以聊聊。
 answerQuick(f.mq,'friend',id=>BANK.quickPath.questions.indexOf(id)<6?0:3);
 const r=await f.service.report('friend',p.id),qd=r.questionnaireDirections;
 assert.equal(r.kind,'hepan_v4');assert.equal(qd.status,'available');
 const tags=new Set(qd.directions.map(d=>d.tag));assert.ok(tags.has('同频'));assert.ok(tags.has('可以聊聊'));
 const text=JSON.stringify(qd);
 for(const raw of ['within1','"want"','simple','stay','apart','none','value','answers','"rank"'])assert.ok(!text.includes(raw),raw);
 assert.ok(!/不合|%|分数|score/.test(text));
 // 敏感题（婚史）所在方向不出现。
 assert.ok(!qd.directions.some(d=>d.id==='history'));
 // 发起人看到的是同一份方向提示。
 assert.deepEqual((await f.service.report('owner',p.id)).questionnaireDirections.directions,qd.directions);
});

test('without the friend consent the questionnaire part is excluded (answers exist on both sides)',async()=>{
 const f=fixture(),p=await f.invite();
 answerQuick(f.mq,'owner',()=>0);
 await joinAndConfirm(f,p,{include:false});
 answerQuick(f.mq,'friend',()=>0);
 const qd=(await f.service.report('owner',p.id)).questionnaireDirections;
 assert.equal(qd.status,'not_authorized');assert.deepEqual(qd.directions,[]);assert.equal(qd.peerIncluded,false);
 // 之后单独同意（不重填生辰）→ 出现方向提示；再撤回 → 又排除。
 await f.service.setQuestionnaire('friend',p.id,{include:true});
 assert.equal((await f.service.report('owner',p.id)).questionnaireDirections.status,'available');
 await f.service.setQuestionnaire('friend',p.id,{include:false});
 assert.equal((await f.service.report('owner',p.id)).questionnaireDirections.status,'not_authorized');
});

test('inviter who has not answered → waiting_answers; 底线题设为仅自己 also excluded',async()=>{
 const f=fixture(),p=await f.invite();
 await joinAndConfirm(f,p);answerQuick(f.mq,'friend',()=>0);
 assert.equal((await f.service.report('friend',p.id)).questionnaireDirections.status,'waiting_answers');
 answerQuick(f.mq,'owner',()=>0);
 assert.equal((await f.service.report('friend',p.id)).questionnaireDirections.status,'available');
 f.mq.setVisibility('owner',{privateTopics:['quick']});
 assert.equal((await f.service.report('friend',p.id)).questionnaireDirections.status,'waiting_answers');
});

test('时辰不确定 → three pillars, report marked limited; no city needed',async()=>{
 const f=fixture(),p=await f.invite();
 await joinAndConfirm(f,p,{input:{...IN_B,time:null}});
 const a=f.store.read().compatibilityPairs[0].authorizations.friend.chart;
 assert.equal(a.complete,false);assert.equal(a.v4Pillars.hour,null);assert.equal(a.v4Pillars.day.length,2);
 const r=await f.service.report('owner',p.id);
 assert.equal(r.limited,true);assert.match(r.limitedNote,/有限参考/);
 assert.ok(!JSON.stringify(f.store.read().compatibilityPairs).includes('1990-03-12'));
});

test('invalid birth data does not claim the invite (friend can retry)',async()=>{
 const f=fixture(),p=await f.invite();
 await assert.rejects(f.service.join('friend',{inviteToken:p.inviteToken,nickname:'阿青',claimConsent:true,...authBody({...IN_B,birthday:'2015-01-01'})}));
 assert.equal(f.store.read().compatibilityPairs[0].to,null);
 await assert.rejects(f.service.join('friend',{inviteToken:p.inviteToken,nickname:'阿青',claimConsent:false,...authBody(IN_B)}),{status:400});
 await joinAndConfirm(f,p);
 assert.equal(f.store.read().compatibilityPairs[0].to,'friend');
 await assert.rejects(f.service.join('other',{inviteToken:p.inviteToken,nickname:'别人',claimConsent:true,...authBody(IN_B)}),{status:409});
});

test('couple invites list the 婚前 focus directions first and say 婚前值得聊开, never a verdict',async()=>{
 const f=fixture({relation:'couple'}),p=await f.invite();
 answerQuick(f.mq,'owner',()=>0);await joinAndConfirm(f,p);answerQuick(f.mq,'friend',()=>3);
 const qd=(await f.service.report('friend',p.id)).questionnaireDirections;
 assert.equal(qd.relation,'couple');
 assert.deepEqual(qd.directions.slice(0,5).map(d=>d.id),['family','finance','future','conflict','boundaries']);
 assert.ok(qd.directions.some(d=>d.tag==='婚前值得聊开'));
 assert.equal(qd.directions.find(d=>d.id==='conflict').tone,'open');
 assert.ok(!/适合结婚|不合|%/.test(JSON.stringify(qd)));
 assert.throws(()=>f.service.create('owner',{relation:'stranger'}),{status:400});
});

test('copy guard: new invite-match strings (front end + direction copy) have no banned words, no %, no 不合',()=>{
 const root=path.join(__dirname,'../..');
 const files=['assets/js/friends-invite-match.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
 const src=fs.readFileSync(path.join(__dirname,'friends-compatibility.js'),'utf8'),start=src.indexOf('function directionSupplement'),end=src.indexOf('\n}\n',start);
 assert.ok(start>0);
 // 只看中文字符串，跳过注释里的规则说明。
 const strings=t=>(t.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'').match(/(['"`])(?:(?!\1)[^\\]|\\.)*?[一-鿿](?:(?!\1)[^\\]|\\.)*?\1/g)||[]).join('\n');
 for(const t of [...files,src.slice(start,end)].map(strings)){
  assert.ok(t.length>50);
  assert.deepEqual(GUARD.findForbidden(t),[]);
  assert.ok(!t.includes('不合'));
 }
});
