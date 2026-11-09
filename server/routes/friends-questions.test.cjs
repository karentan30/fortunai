'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let express;try{express=require('express');}catch(_){express=require('../../.review/node_modules/express');}
const {createFriendsStore}=require('../lib/friends-store');
const {createFriendsQuestionsRouter}=require('./friends-questions');
const bank=require('../../assets/data/friends-relationship-questions.json');
test('same-clock deletion and recreation cannot revive an old questionnaire grant',()=>{
 const {createFriendsQuestionsService}=require('../lib/friends-questions'),service=createFriendsQuestionsService({store:require('../lib/friends-cross-border').grant(createFriendsStore(),'a','b','c','owner','recipient','third','new-owner','new-recipient','another-recipient','new-visitor','viewer','real-minor','real-adult','outside',1,2,3),clock:()=>1234567890000});
 const payload={version:bank.version,consent:true,answers:{}};
 const first=service.save('a',payload).questionnaire,edited=service.save('a',payload).questionnaire;
 assert.ok(first.recordId);assert.equal(first.recordId,edited.recordId);service.remove('a');
 const rebuilt=service.save('a',payload).questionnaire;
 assert.equal(first.updatedAt,rebuilt.updatedAt);assert.equal(first.revision,rebuilt.revision);assert.notEqual(first.recordId,rebuilt.recordId);
});
test('private questionnaire ownership, validation, concurrency and deletion',async()=>{
 const app=express(),store=require('../lib/friends-cross-border').grant(createFriendsStore(),'a','b','c','owner','recipient','third','new-owner','new-recipient','another-recipient','new-visitor','viewer','real-minor','real-adult','outside',1,2,3);app.use(express.json({limit:'64kb'}));app.use('/q',createFriendsQuestionsRouter({express,store,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/q';
 const call=async(user,method='GET',body)=>{const r=await fetch(base,{method,headers:{...(user?{'X-Test-User':user}:{}),'Content-Type':'application/json','X-Runae-Friends':'1'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 try{assert.equal((await call(null)).status,401);const payload={version:bank.version,consent:true,answers:{'family-01':{selfAnswer:'option_1',acceptablePartnerAnswers:['option_1','option_2'],importance:'important'}}};const a=await call('a','PUT',payload);assert.equal(a.status,200);assert.equal(a.body.questionnaire.visibility,'private');assert.equal((await call('b')).body.questionnaire,null);assert.equal((await call('a')).body.questionnaire.answers['family-01'].selfAnswer,'option_1');assert.equal((await call('b','DELETE',{})).status,200);assert.ok((await call('a')).body.questionnaire);assert.equal((await call('a','PUT',{...payload,userId:'b'})).status,400);assert.equal((await call('a','PUT',{...payload,expectedRevision:0})).status,409);for(const answers of [{'unknown':{}},{'family-01':{selfAnswer:'option_999'}},{'family-01':{acceptablePartnerAnswers:['option_1','option_1']}},{'history-01':{selfAnswer:'x'.repeat(501)}},{'history-01':{acceptablePartnerAnswers:['anything']}},{'family-01':{importance:'high'}},{'family-01':{userId:'b'}}])assert.equal((await call('a','PUT',{...payload,answers})).status,400);assert.equal((await call('a','PUT',{...payload,consent:false})).status,400);assert.equal((await call('a','PUT',{...payload,answers:{}})).status,200);assert.equal((await call('a','DELETE',{})).body.deleted,true);assert.equal((await call('a')).body.questionnaire,null);const csrf=await fetch(base,{method:'DELETE',headers:{'X-Test-User':'a'}});assert.equal(csrf.status,403);
 }finally{await new Promise(r=>server.close(r));}
});
