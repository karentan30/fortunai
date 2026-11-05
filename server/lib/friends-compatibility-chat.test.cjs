'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store');
const {createCompatibilityService,relationshipSummary,VERSION}=require('./friends-compatibility');
const input={birthday:'1991-01-01',cityId:'test-city',time:'06:00'};
function fixture(store=createFriendsStore()){
 let now=Date.parse('2026-11-05T12:00:00Z');
 store.transaction(s=>{s.profiles=[{userId:'a',shareId:'a-card',listed:true},{userId:'b',shareId:'b-card',listed:true},{userId:'c',shareId:'c-card',listed:true}];});
 const service=createCompatibilityService({store,clock:()=>now,calculateChart:()=>({birthLocation:{},complete:true,pillars:{year:'甲子',month:'丙寅',day:'戊辰',hour:'庚午'}})});
 const authorize=(uid,id)=>service.authorize(uid,id,{version:VERSION,consent:true,input});
 async function ready(){const p=service.create('a',{targetShareId:'b-card'});await authorize('a',p.id);await authorize('b',p.id);return p;}
 return {store,service,authorize,ready,now:()=>now,setNow:n=>now=n};
}
test('chat requires both authorizations and owner confirmation; third party cannot access',async()=>{
 const f=fixture(),p=f.service.create('a',{ownerNickname:'A'});
 assert.throws(()=>f.service.messages('a',p.id),{status:409});
 await f.authorize('a',p.id);f.service.claim('b',{inviteToken:p.inviteToken,consent:true,nickname:'B'});
 await f.authorize('b',p.id);assert.throws(()=>f.service.sendMessage('b',p.id,{text:'你好',clientMessageId:'message_01'}),{status:409});
 f.service.confirmRecipient('a',p.id,{consent:true});
 const result=f.service.sendMessage('a',p.id,{text:'你好',clientMessageId:'message_01',sender:'b'});
 assert.equal(result.message.mine,true);assert.deepEqual(Object.keys(result.message).sort(),['createdAt','id','mine','text']);
 assert.equal(f.service.messages('b',p.id).messages[0].mine,false);
 assert.throws(()=>f.service.messages('c',p.id),{status:404});
 assert.throws(()=>f.service.sendMessage('c',p.id,{text:'hi',clientMessageId:'message_02'}),{status:404});
});
test('message retries are idempotent and conflict if text changed; sender keys independent',async()=>{
 const f=fixture(),p=await f.ready(),body={text:' hello ',clientMessageId:'message_01'};
 const a=f.service.sendMessage('a',p.id,body),b=f.service.sendMessage('a',p.id,body);
 assert.equal(a.message.id,b.message.id);assert.equal(b.duplicate,true);
 assert.throws(()=>f.service.sendMessage('a',p.id,{...body,text:'changed'}),{status:409});
 f.service.sendMessage('b',p.id,body);assert.equal(f.service.messages('a',p.id).messages.length,2);
});
test('chat pagination is bounded and pair-local; invalid text and frequency caps reject without writing',async()=>{
 const f=fixture(),p=await f.ready();
 for(const text of ['', '  ', 'x'.repeat(1001), '\u0000'])assert.throws(()=>f.service.sendMessage('a',p.id,{text,clientMessageId:'invalid_01'}),{status:400});
 assert.throws(()=>f.service.sendMessage('a',p.id,{text:'hi',clientMessageId:'short'}),{status:400});
 for(let i=0;i<10;i++)f.service.sendMessage('a',p.id,{text:'内容'+i,clientMessageId:'message_'+i});
 assert.throws(()=>f.service.sendMessage('a',p.id,{text:'too fast',clientMessageId:'message_10'}),{status:429});
 assert.equal(f.service.sendMessage('a',p.id,{text:'内容0',clientMessageId:'message_0'}).duplicate,true);
 const first=f.service.messages('b',p.id,{limit:3});assert.equal(first.messages.length,3);assert.equal(first.hasMore,true);
 const next=f.service.messages('b',p.id,{after:first.nextCursor,limit:100});assert.equal(next.messages.length,7);assert.equal(next.hasMore,false);
 assert.equal(f.service.messages('b',p.id,{after:next.nextCursor}).messages.length,0);
 for(const limit of [0,101,1.5,'bad'])assert.throws(()=>f.service.messages('a',p.id,{limit}),{status:400});
 const other=f.service.create('a',{targetShareId:'c-card'});await f.authorize('a',other.id);await f.authorize('c',other.id);
 assert.throws(()=>f.service.messages('a',other.id,{after:first.nextCursor}),{status:400});
 f.setNow(f.now()+60000);f.service.sendMessage('a',p.id,{text:'now okay',clientMessageId:'message_10'});
 f.store.transaction(s=>{const pair=s.compatibilityPairs.find(x=>x.id===p.id);pair.messages=Array.from({length:2000},(_,i)=>({id:String(i),sender:'a',text:'old',clientMessageId:'old_'+i,createdAt:'2020-01-01T00:00:00Z'}));});
 assert.throws(()=>f.service.sendMessage('b',p.id,{text:'full',clientMessageId:'message_full'}),{status:429});
});
test('revoke decline expiry remove messages; blocks moderation and unavailable cards deny read/send',async()=>{
 for(const action of ['revoke','decline','expiry','block','disabled','unlisted']){
  const f=fixture(),p=await f.ready();f.service.sendMessage('a',p.id,{text:'私密讨论',clientMessageId:'message_01'});
  if(action==='revoke')f.service.revoke('a',p.id);
  if(action==='decline')f.service.decline('b',p.id);
  if(action==='expiry')f.setNow(f.now()+8*86400000);
  if(action==='block')f.store.transaction(s=>s.blocks.push({by:'b',target:'a'}));
  if(action==='disabled')f.store.transaction(s=>{s.moderation=[{userId:'b',disabled:true}];});
  if(action==='unlisted')f.store.transaction(s=>{s.profiles.find(x=>x.userId==='b').listed=false;});
  assert.throws(()=>f.service.messages('a',p.id));
  assert.throws(()=>f.service.sendMessage('a',p.id,{text:'no',clientMessageId:'message_02'}));
  if(['revoke','decline','expiry'].includes(action))assert.deepEqual(f.store.read().compatibilityPairs[0].messages,[]);
 }
});
test('cross-pillar summary deduplicates groups, handles unknown time and exposes no pillar values',()=>{
 const a={complete:true,pillars:{year:'甲子',month:'丙子',day:'戊寅',hour:'庚卯'}},b={complete:true,pillars:{year:'乙丑',month:'丁丑',day:'戊亥',hour:'辛未'}};
 const summary=relationshipSummary(a,b);
 assert.equal(summary.sixHarmonyGroupCount,2);assert.equal(summary.hasSameDayMaster,true);assert.equal(summary.hasDifferentMonthPillar,true);assert.equal(summary.hasHarm,true);
 for(const value of [...Object.values(a.pillars),...Object.values(b.pillars)])assert.ok(!JSON.stringify(summary).includes(value));
 const incomplete=relationshipSummary({...a,complete:false},b);assert.equal(incomplete.available,false);assert.equal(incomplete.sixHarmonyGroupCount,null);
});
test('chat endpoints enforce auth CSRF and server sender identity',async()=>{
 const express=require('express'),{createCompatibilityRouter}=require('../routes/friends-compatibility'),f=fixture(),p=await f.ready();
 const app=express();app.use(express.json());app.use(createCompatibilityRouter({express,service:f.service,auth:(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const url='http://127.0.0.1:'+server.address().port+'/pairs/'+p.id+'/messages';
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{'X-Test-User':'c'}})).status,404);
  const body=JSON.stringify({text:'你好',clientMessageId:'route_msg_01',sender:'b'}),headers={'Content-Type':'application/json','X-Test-User':'a'};
  assert.equal((await fetch(url,{method:'POST',headers,body})).status,403);
  const response=await fetch(url,{method:'POST',headers:{...headers,'X-Runae-Friends':'1'},body});assert.equal(response.status,200);
  const result=await(await fetch(url,{headers:{'X-Test-User':'b'}})).json();assert.equal(result.messages[0].mine,false);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
