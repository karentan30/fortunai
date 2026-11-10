'use strict';
// 相合局路由：POST 守卫、登录要求、公开邀请页、管理员接口、限流。纯内存，不连外部服务。
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createFriendsStore}=require('../lib/friends-store');

async function boot(){
  const express=require('express'),{createRouter}=require('./friends');
  const store=createFriendsStore(),adminToken=crypto.randomBytes(24).toString('hex');
  const auth=(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();};
  const app=express();app.use(express.json());
  app.use('/api/friends',createRouter({express,auth,store,secret:crypto.randomBytes(32).toString('hex'),enabled:true,adminToken,reviewGate:true}));
  const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(route,{user,body,method=body?'POST':'GET',headers={},guard=true,admin=false}={})=>{
    const r=await fetch(base+'/api/friends'+route,{method,headers:{'Content-Type':'application/json',Origin:base,...(guard?{'X-Runae-Friends':'1'}:{}),...(user?{'X-Test-User':user}:{}),...(admin?{'X-Admin-Token':adminToken}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    let j=null;try{j=await r.json();}catch(_){}
    return {status:r.status,body:j};
  };
  return {call,close:()=>server.close(),store};
}

test('路由：未登录 401；没有 X-Runae-Friends 的写请求被拒；公开邀请页不需要登录且坏 token 是 404',async()=>{
  const {call,close}=await boot();
  try{
    assert.equal((await call('/heju/me')).status,401);
    assert.equal((await call('/heju/signup',{body:{activity:'羽毛球'}})).status,401);
    const noGuard=await call('/heju/signup',{user:'u1',body:{activity:'羽毛球'},guard:false});
    assert.equal(noGuard.status,403);
    const pub=await call('/heju/public/'+'x'.repeat(43));
    assert.equal(pub.status,404);
    assert.equal((await call('/heju/public/short')).status,404);
  }finally{close();}
});
test('路由：没有卡片和底线题的人登记，得到带引导的 409；/heju/me 给出前置状态',async()=>{
  const {call,close}=await boot();
  try{
    const me=await call('/heju/me',{user:'u1'});
    assert.equal(me.status,200);assert.equal(me.body.readiness.ready,false);assert.ok(me.body.readiness.hint);
    const r=await call('/heju/signup',{user:'u1',body:{activity:'羽毛球',windows:['sat-pm'],area:'东校区',adult:true,consent:true}});
    assert.equal(r.status,409);assert.ok(r.body.code);assert.ok(r.body.error);
    assert.equal((await call('/heju/groups/not-a-group/chat',{user:'u1'})).status,404);
  }finally{close();}
});
test('路由：管理员接口要 token；俱乐部标记、立即分组、概览可用',async()=>{
  const {call,close}=await boot();
  try{
    assert.ok([401,403].includes((await call('/admin/heju/summary')).status));
    assert.equal((await call('/admin/heju/summary',{admin:true})).status,200);
    assert.equal((await call('/admin/heju/clubs',{admin:true,body:{name:'东城俱乐部',userId:'club1'}})).status,200);
    assert.equal((await call('/admin/heju/clubs',{admin:true})).body.clubs[0].name,'东城俱乐部');
    assert.equal((await call('/admin/heju/run',{admin:true,body:{}})).status,200);
    assert.ok([401,403].includes((await call('/admin/heju/run',{body:{}})).status));
    const me=await call('/heju/me',{user:'club1'});assert.equal(me.body.club.name,'东城俱乐部');
  }finally{close();}
});
test('路由：创建、报名类请求有每小时上限，超出得到 429',async()=>{
  const {call,close}=await boot();
  try{
    let last=null;
    for(let i=0;i<40;i++){last=await call('/heju/signup',{user:'spam',body:{activity:'羽毛球',windows:['sat-pm'],area:'东校区',adult:true,consent:true}});if(last.status===429)break;}
    assert.equal(last.status,429);
  }finally{close();}
});
