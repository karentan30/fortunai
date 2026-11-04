'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let express;try{express=require('express');}catch(_){express=require('../../.review/node_modules/express');}
const {createPersonalReportsRouter}=require('./friends-personal-reports');
const {createFriendsStore}=require('../lib/friends-store');
test('personal report HTTP enforces closed mode, auth, CSRF and owner-only delivery',async()=>{
 const app=express(),store=createFriendsStore();let generated=0,reserved=0;
 const auth=(req,res,next)=>{if(req.get('X-Test-User'))req.user={id:req.get('X-Test-User')};next();};
 const billing={reserve(){reserved++;return{id:'reservation',status:'reserved'};},settle(){return{status:'committed'};}};
 const adapter={verifyChart:async()=>({chartBlock:'verified fixture'}),generate:async()=>{generated++;return {reading:'Fixture result only.',tier:'full',locked:false};},validateResult:()=>true};
 app.use(express.json());app.use('/closed',createPersonalReportsRouter({express,auth,store,billing,env:{}}));
 app.use('/reports',createPersonalReportsRouter({express,auth,store,billing,env:{FRIENDS_REPORTS_ENABLED:'true',FRIENDS_SIGNING_KEY:'x'.repeat(40)},adapter}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const base='http://127.0.0.1:'+server.address().port,body=JSON.stringify({idempotencyKey:'fixture-report-key',input:{birthYear:1991,birthMonth:1,birthDay:2,birthHour:6,gender:'female'},consentRetainReport:true});
  assert.equal((await(await fetch(base+'/closed/status')).json()).enabled,false);
  assert.equal((await fetch(base+'/closed',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,503);
  assert.equal((await fetch(base+'/reports')).status,401);
  const headers={'Content-Type':'application/json','X-Test-User':'alice','X-Runae-Friends':'1'};
  assert.equal((await fetch(base+'/reports',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body})).status,403);assert.equal(reserved,0);
  const created=await(await fetch(base+'/reports',{method:'POST',headers,body})).json();assert.equal(created.status,'delivered');
  assert.equal((await fetch(base+'/reports/'+created.reportId,{headers:{'X-Test-User':'bob'}})).status,404);
  const again=await(await fetch(base+'/reports',{method:'POST',headers,body})).json();assert.equal(again.reportId,created.reportId);assert.equal(generated,1);assert.equal(reserved,1);
  assert.ok(!JSON.stringify(store.read().personalReportJobs).includes('birthYear'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
