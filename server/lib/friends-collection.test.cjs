'use strict';
// 打卡图鉴: counting rule, field visibility, blocked/unlisted/deleted/disabled, owner-only route, share payload has no names.
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const C=require('./friends-collection');

const charts={verify:c=>{const [,stem,zodiac]=String(c).split(':');return {age:28,dayMaster:stem,zodiac};}};
const base={consent:true,crossBorderConsent:true,city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',school:'暂无',occupation:'暂无',industry:'暂无',title:'暂无'},
  dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true};
const allPublic={dayMaster:'public',zodiac:'public',mbti:'public',constellation:'public'};
function setup(){
  const store=createFriendsStore(),service=createFriendsService(store,charts);
  const save=(uid,stem,zodiac,extra={})=>service.save(uid,{...base,credential:`c:${stem}:${zodiac}`,nickname:'昵称'+uid,mbti:'INTJ',constellation:'白羊座',visibility:allPublic,...extra});
  const connect=(a,b)=>{const target=store.read().profiles.find(p=>p.userId===b);const r=service.request(a,target.shareId);service.act(b,r.id,'accept');return r.id;};
  const cell=(uid,key,value)=>C.collectionFor(store.read(),uid).categories.find(c=>c.key===key).cells.find(c=>c.value===value);
  save('me','丙','马');
  return {store,service,save,connect,cell};
}

test('counting rule: only an accepted (mutual) connection lights a cell; pending/declined/disconnected do not',()=>{
  const {store,service,save,connect,cell}=setup();
  const a=save('a','甲','鼠');save('b','庚','牛');
  // Public but not connected: no cell lights.
  assert.equal(cell('me','dayMaster','甲').lit,false);
  const pending=service.request('me',a.shareId);
  assert.equal(cell('me','dayMaster','甲').lit,false,'pending request must not count');
  service.act('a',pending.id,'decline');
  assert.equal(cell('me','dayMaster','甲').lit,false,'declined request must not count');
  const b=store.read().profiles.find(p=>p.userId==='b');const r=service.request('b',store.read().profiles.find(p=>p.userId==='me').shareId);service.act('me',r.id,'accept');
  const c=C.collectionFor(store.read(),'me'),dm=c.categories.find(x=>x.key==='dayMaster');
  assert.equal(dm.litCount,1);assert.equal(dm.cells.find(x=>x.value==='庚').lit,true);assert.deepEqual(dm.cells.find(x=>x.value==='庚').people,['昵称b']);
  assert.equal(dm.cells.find(x=>x.value==='庚').element,'metal');
  assert.equal(c.knownCount,1);assert.equal(c.categories.find(x=>x.key==='zodiac').cells.find(x=>x.value==='牛').lit,true);
  assert.equal(c.categories.find(x=>x.key==='mbti').litCount,1);assert.equal(c.categories.find(x=>x.key==='constellation').litCount,1);
  assert.equal(dm.headline,'我已经认识了 1 种日主，还差 9 种');
  // Symmetric: b also collected me.
  assert.equal(cell('b','dayMaster','丙').lit,true);
  service.act('me',r.id,'disconnect');
  assert.equal(cell('me','dayMaster','庚').lit,false,'disconnected must not count');
  assert.ok(b);
});

test('headline wording: none, few missing, all',()=>{
  const cat=(lit)=>{const cells=['甲木','乙木','丙火','丁火'].map((name,i)=>({name,lit:i<lit}));return {label:'日主',values:cells,cells,litCount:lit};};
  assert.equal(C.headline(cat(0)),'4 种日主，等我一个个认识');
  assert.equal(C.headline(cat(2)),'我已经认识了 2 种日主，还差丙火、丁火');
  assert.equal(C.headline(cat(4)),'4 种日主，我都认识了');
});

test('visibility: a hidden attribute never lights its cell; connected-scope counts once connected',()=>{
  const {save,connect,cell}=setup();
  save('a','甲','鼠',{mbti:'ENFP',constellation:'双鱼座',visibility:{dayMaster:'private',zodiac:'connected',mbti:'private',constellation:'public'}});
  connect('a','me');
  assert.equal(cell('me','dayMaster','甲').lit,false,'private 日主 must not light');
  assert.equal(cell('me','mbti','ENFP').lit,false,'private MBTI must not light');
  assert.equal(cell('me','zodiac','鼠').lit,true,'connected-scope 生肖 is visible to a connection');
  assert.equal(cell('me','constellation','双鱼座').lit,true);
  // Missing visibility key for mbti defaults to hidden.
  save('b','乙','牛',{mbti:'ISTP',visibility:{dayMaster:'public',zodiac:'public'}});connect('b','me');
  assert.equal(cell('me','mbti','ISTP').lit,false);
  assert.equal(cell('me','dayMaster','乙').lit,true);
});

test('blocked, unlisted, deleted and disabled profiles do not count',()=>{
  const {store,service,save,connect,cell}=setup();
  const a=save('a','甲','鼠'),b=save('b','乙','牛');save('c','壬','虎');save('d','癸','兔');
  connect('a','me');connect('b','me');connect('c','me');connect('d','me');
  for(const s of ['甲','乙','壬','癸'])assert.equal(cell('me','dayMaster',s).lit,true);
  service.block('me',a.shareId);assert.equal(cell('me','dayMaster','甲').lit,false,'blocked by me');
  service.block('b',store.read().profiles.find(p=>p.userId==='me').shareId);assert.equal(cell('me','dayMaster','乙').lit,false,'blocked me');
  save('c','壬','虎',{listed:false});assert.equal(cell('me','dayMaster','壬').lit,false,'unlisted');
  service.remove('d');assert.equal(cell('me','dayMaster','癸').lit,false,'deleted');
  assert.ok(b);
  // Disabled by moderation.
  save('e','戊','龙');connect('e','me');assert.equal(cell('me','dayMaster','戊').lit,true);
  store.transaction(s=>{(s.moderation||(s.moderation=[])).push({userId:'e',disabled:true});});
  assert.equal(cell('me','dayMaster','戊').lit,false,'disabled');
  // A viewer who unlists themselves has an empty collection.
  save('f','己','蛇');connect('f','me');assert.equal(cell('me','dayMaster','己').lit,true);
  save('me','丙','马',{listed:false});assert.equal(C.collectionFor(store.read(),'me').knownCount,0);
});

test('share payload carries only types and counts: no other person\'s nickname',()=>{
  const {store,save,connect}=setup();
  save('a','甲','鼠',{nickname:'独特昵称甲'});connect('a','me');
  const c=C.collectionFor(store.read(),'me');
  assert.ok(JSON.stringify(c).includes('独特昵称甲'),'owner view may list nicknames');
  const share=JSON.stringify(C.shareSummary(c));
  assert.ok(!share.includes('独特昵称甲'));assert.ok(!share.includes('"people"'));assert.ok(!share.includes('shareId'));
  assert.ok(share.includes('昵称me'),'owner nickname is on the image');
});

test('route: login required and only the owner\'s own collection is returned',async()=>{
  const express=require('express'),{createRouter}=require('../routes/friends');
  const {store,save,connect}=setup();
  save('a','甲','鼠',{nickname:'A的昵称'});save('x','庚','牛',{nickname:'X的昵称'});connect('a','me');
  const auth=(req,res,next)=>{const id=req.get('X-Test-User');if(id)req.user={id};next();};
  const app=express();app.use(express.json());app.use('/api/friends',createRouter({express,auth,store,secret:'t'.repeat(64),enabled:true}));
  const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
  try{
    const url='http://127.0.0.1:'+server.address().port+'/api/friends/collection';
    assert.equal((await fetch(url)).status,401);
    const mine=await (await fetch(url+'?user=x&uid=x',{headers:{'X-Test-User':'me'}})).json();
    assert.equal(mine.collection.owner.nickname,'昵称me');assert.equal(mine.collection.knownCount,1);
    assert.ok(!JSON.stringify(mine).includes('X的昵称'));
    assert.ok(!JSON.stringify(mine.share).includes('A的昵称'));
    const theirs=await (await fetch(url,{headers:{'X-Test-User':'x'}})).json();
    assert.equal(theirs.collection.owner.nickname,'X的昵称');assert.equal(theirs.collection.knownCount,0);
  }finally{server.close();}
});
