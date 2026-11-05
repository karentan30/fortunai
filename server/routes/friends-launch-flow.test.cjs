'use strict';
// Real auth routes and encrypted storage, temporary files only. No live server, email or payments.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
test('real registration -> chart -> private/public profiles -> QR destination -> request -> accept -> revoke -> login',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'friends-launch-')),originalData=process.env.DATA_FILE;
 process.env.DATA_FILE=path.join(dir,'accounts.json');
 const express=require('express'),accounts=require('../lib/store'),{authMiddleware}=require('../middleware');
 const {createSqliteFriendsStore}=require('../lib/friends-sqlite'),{createRouter}=require('./friends');
 const store=createSqliteFriendsStore(path.join(dir,'friends.sqlite'),{key:crypto.randomBytes(32).toString('hex')});
 const app=express();app.use(express.json());app.use('/api/auth',require('./auth'));
 app.use('/api/friends',createRouter({express,auth:authMiddleware,store,secret:crypto.randomBytes(32).toString('hex'),enabled:true,requirePolicy:true,onLogout:(req,res)=>{accounts.deleteUserToken.run(req.user.id,accounts._tokenFromReq(req));res.clearCookie('sy_token',{path:'/'});}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base='http://127.0.0.1:'+server.address().port;
 async function call(route,{cookie,body,method=body?'POST':'GET'}={}){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Runae-Friends':'1',Origin:base,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const birthday='1991-08-28';
 const payload=(credential,nickname)=>({credential,nickname,city:'北京',intent:'认真恋爱',bio:'虚构验收账号，喜欢打羽毛球。',consent:true,listed:true,policyVersion:'friends-2026-11-04-v1',fields:{height:'180',weight:'75',school:'测试大学',occupation:'AI算法工程师',income:'50',assets:'A8.2',familyAssets:'A9.3'},visibility:{age:'public',height:'public',weight:'public',school:'public',occupation:'public',income:'connected',assets:'private',familyAssets:'private',dayMaster:'public',zodiac:'private'},targetStems:['不限'],targetZodiacs:['不限'],hobbies:['羽毛球','陶艺'],contact:'test-only-'+nickname,contactConsent:true});
 try{
   const a=await call('/api/auth/register',{body:{email:'alice@example.test',password:'Local-only-password-2026'}}),b=await call('/api/auth/register',{body:{email:'bob@example.test',password:'Local-only-password-2026'}});
   assert.equal(a.status,200);assert.equal(b.status,200);assert.match(a.cookie,/^sy_token=/);assert.equal(a.body.token,undefined);
   const chart=await call('/api/friends/chart',{body:{birthday,calendar:'lunar',hour:6}});assert.equal(chart.status,200);assert.equal(chart.body.chart.dayMaster,'戊');
   const pa=await call('/api/friends/profile',{cookie:a.cookie,body:payload(chart.body.credential,'alice')}),pb=await call('/api/friends/profile',{cookie:b.cookie,body:payload(chart.body.credential,'bob')});assert.equal(pa.status,200);assert.equal(pb.status,200);
   const share=pa.body.profile.shareId;
   // This is the same opaque card identifier encoded into the poster; no DOB is needed.
   const publicCard=await call('/api/friends/card/'+share);assert.equal(publicCard.status,200);
   assert.equal(publicCard.body.profile.fields.income,undefined);assert.equal(publicCard.body.profile.fields.familyAssets,undefined);assert.equal(publicCard.body.profile.fields.assets,undefined);assert.equal(publicCard.body.profile.chart.zodiac,undefined);
   assert.equal(JSON.stringify(publicCard.body).includes(birthday),false);
   assert.equal((await call('/api/friends/me')).status,401);
   const discovery=await call('/api/friends/discover',{cookie:b.cookie});assert.equal(discovery.status,200);assert.ok(discovery.body.profiles.some(p=>p.shareId===share));
   const request=await call('/api/friends/requests',{cookie:b.cookie,body:{shareId:share}});assert.equal(request.status,200);
   assert.notEqual((await call('/api/friends/requests/'+request.body.id,{cookie:b.cookie,body:{action:'accept'}})).status,200);
   assert.equal((await call('/api/friends/requests/'+request.body.id,{cookie:a.cookie,body:{action:'accept'}})).status,200);
   let revealed=await call('/api/friends/card/'+share,{cookie:b.cookie});assert.equal(revealed.body.profile.fields.income,'50');assert.equal(revealed.body.profile.fields.assets,undefined);assert.equal(revealed.body.profile.fields.familyAssets,undefined);
   let inbox=await call('/api/friends/requests',{cookie:b.cookie});assert.equal(inbox.body.requests[0].contact,'test-only-alice');
   assert.equal((await call('/api/friends/requests/'+request.body.id,{cookie:a.cookie,body:{action:'disconnect'}})).status,200);
   revealed=await call('/api/friends/card/'+share,{cookie:b.cookie});assert.equal(revealed.body.profile.fields.income,undefined);
   inbox=await call('/api/friends/requests',{cookie:b.cookie});assert.equal(inbox.body.requests[0].contact,undefined);
   assert.equal((await call('/api/friends/logout',{cookie:a.cookie,body:{}})).status,200);assert.equal((await call('/api/auth/me',{cookie:a.cookie})).status,401);
   const login=await call('/api/auth/login',{body:{email:'alice@example.test',password:'Local-only-password-2026'}});assert.equal(login.status,200);assert.equal((await call('/api/friends/me',{cookie:login.cookie})).body.profile.shareId,share);
   assert.equal((await call('/api/friends/profile',{cookie:login.cookie,method:'DELETE',body:{}})).status,200);assert.equal((await call('/api/friends/card/'+share,{cookie:b.cookie})).status,404);
   accounts._flushStore();const disk=JSON.parse(fs.readFileSync(process.env.DATA_FILE,'utf8'));assert.equal(disk.users.length,2);
   assert.equal(fs.readFileSync(path.join(dir,'friends.sqlite')).includes(Buffer.from(birthday)),false);
 }finally{await new Promise(resolve=>server.close(resolve));accounts._flushStore();store.close();if(originalData===undefined)delete process.env.DATA_FILE;else process.env.DATA_FILE=originalData;fs.rmSync(dir,{recursive:true,force:true});}
});
