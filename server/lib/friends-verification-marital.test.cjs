'use strict';
// 婚况·政务平台自查 (owner decision 2026-11-06): user screen-records their own 国家政务服务平台 婚姻登记查询; admin picks a result.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');
const {createVerificationService,sniffVideo,MAX_VIDEO_BYTES}=require('./friends-verification');
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}

const secret='test-signing-key-'.repeat(4),KEY='ab'.repeat(32),ADMIN='admin-token-for-tests-'.repeat(3);
const PNG=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('IHDR-secret-screenshot')]);
const PDF=Buffer.from('%PDF-1.7\n1 0 obj');
const MP4=Buffer.concat([Buffer.from([0,0,0,0x18]),Buffer.from('ftypisom'),Buffer.alloc(12),Buffer.from('secret-recording-of-gov-app')]);
const MOV=Buffer.concat([Buffer.from([0,0,0,0x14]),Buffer.from('ftypqt  '),Buffer.alloc(8)]);
const WEBM=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(12)]);
const b64=b=>b.toString('base64');

function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xs-marital-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createFriendsStore(),charts=createChartService(secret),service=createFriendsService(store,charts);
  const files=path.join(dir,'files'),v=createVerificationService({store,dir:files,key:KEY});
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',purposes:['serious'],fields:{height:'170',education:'硕士',school:'测试大学',occupation:'工程师'},visibility:{education:'public'},dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,...extra});
  const onDisk=()=>fs.existsSync(files)?fs.readdirSync(files).filter(n=>n.endsWith('.bin')):[];
  const makeMember=uid=>store.transaction(s=>{s.billingOrders=[...(s.billingOrders||[]),{id:'o-'+uid,userId:uid,status:'paid',matchingMembership:true,benefitsVerified:true,paidAt:new Date(Date.now()-86400000).toISOString(),accessUntil:new Date(Date.now()+30*86400000).toISOString()}];});
  return {files,store,service,v,data,onDisk,makeMember};
}
async function listen(t,f){
  const {createRouter}=require('../routes/friends');const a=express();a.use(express.json({limit:'10mb'}));
  a.use(createRouter({express,store:f.store,secret,adminToken:ADMIN,verification:f.v,auth:(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();}}));
  const server=await new Promise(r=>{const x=a.listen(0,'127.0.0.1',()=>r(x));});t.after(()=>new Promise(r=>server.close(r)));
  return 'http://127.0.0.1:'+server.address().port;
}

test('婚况 video: magic bytes, 30MB cap, raw route needs the site header, octet-stream nowhere else',async t=>{
  const f=setup(t);f.service.save('u1',f.data());
  assert.equal(sniffVideo(MP4),'video/mp4');assert.equal(sniffVideo(MOV),'video/quicktime');assert.equal(sniffVideo(WEBM),'video/webm');assert.equal(sniffVideo(PNG),null);
  const st=fn=>{try{fn();return 200;}catch(e){return e.status;}};
  assert.equal(st(()=>f.v.uploadVideo('u1',{field:'marital',buf:Buffer.concat([MP4,Buffer.alloc(MAX_VIDEO_BYTES)])})),413);
  assert.equal(st(()=>f.v.uploadVideo('u1',{field:'marital',buf:PDF})),415);
  assert.equal(st(()=>f.v.uploadVideo('u1',{field:'income',buf:MP4})),400,'video only for 婚况');
  assert.equal(st(()=>f.v.upload('u1',{field:'marital',data:b64(PDF)})),415,'no PDF for 婚况');
  assert.deepEqual(f.onDisk(),[]);
  const base=await listen(t,f);
  const raw=headers=>fetch(base+'/verification/video',{method:'POST',headers:{'X-Test-User':'u1',...headers},body:MP4});
  assert.equal((await raw({'Content-Type':'application/octet-stream'})).status,403,'missing X-Runae-Friends');
  assert.equal((await raw({'Content-Type':'text/plain','X-Runae-Friends':'1'})).status,403,'simple content type refused');
  assert.equal((await fetch(base+'/verification/submit',{method:'POST',headers:{'X-Test-User':'u1','X-Runae-Friends':'1','Content-Type':'application/octet-stream'},body:'{}'})).status,403,'octet-stream only on the video route');
  const ok=await raw({'Content-Type':'application/octet-stream','X-Runae-Friends':'1','X-File-Name':encodeURIComponent('录屏.mp4')});
  assert.equal(ok.status,200);const body=await ok.json();assert.equal(body.files[0].mime,'video/mp4');assert.equal(body.files[0].name,'录屏.mp4');
  assert.equal(f.onDisk().length,1);assert.ok(!fs.readFileSync(path.join(f.files,f.onDisk()[0])).includes('secret-recording'),'encrypted at rest');
});

test('婚况: only admin reads the upload; mark lights only after approval with a result; files purged after review',async t=>{
  const f=setup(t);f.service.save('u1',f.data());f.service.save('viewer',f.data());f.makeMember('viewer');
  f.v.uploadVideo('u1',{field:'marital',name:'a.mp4',buf:MP4});f.v.upload('u1',{field:'marital',name:'b.png',data:b64(PNG)});f.v.submit('u1',{field:'marital'});
  f.service.seriousSave('u1',{about:'认真找对象'});
  const sid=f.store.read().profiles.find(p=>p.userId==='u1').shareId;
  const strip=()=>f.service.seriousPage(sid,'viewer').sections.verify.items.find(x=>x.key==='marital');
  assert.equal(strip().label,'婚况·政务平台自查');assert.equal(strip().verified,false,'pending is not lit');assert.equal(strip().result,undefined);
  assert.match(strip().hint,/查无记录不等于法律意义上的未婚证明/);
  const base=await listen(t,f),req=f.v.pending()[0];
  assert.deepEqual(Object.values(req.choices),['未婚(无登记记录)','已婚','离异(有离婚证照)','无法判断']);
  const url=base+`/admin/verifications/${req.id}/files/${req.files[0].id}`;
  assert.equal((await fetch(url,{headers:{'X-Test-User':'u1'}})).status,401,'owner cannot read it back');
  assert.equal((await fetch(url,{headers:{'X-Test-User':'viewer','X-Admin-Token':'x'.repeat(40)}})).status,401,'wrong token');
  assert.equal((await fetch(base+`/verification/files/${req.files[0].id}`,{headers:{'X-Test-User':'u1'}})).status,404,'no owner read route');
  const r=await fetch(url,{headers:{'X-Admin-Token':ADMIN}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'video/mp4');
  assert.throws(()=>f.v.decide(req.id,{decision:'approve'}),/请选择婚况结果/);
  assert.throws(()=>f.v.decide(req.id,{decision:'approve',result:'unclear'}),/无法判断/);
  assert.equal(f.onDisk().length,2,'nothing deleted by refused decisions');
  // 无法判断 → not lit, files gone, user sees a reason.
  f.v.decide(req.id,{decision:'reject',result:'unclear'});
  assert.deepEqual(f.onDisk(),[],'files purged after review');assert.equal(strip().verified,false);
  assert.match(f.v.status('u1').fields.marital.reason,/无法判断/);
  // Resubmit, approve as 未婚.
  f.v.uploadVideo('u1',{field:'marital',buf:MP4});f.v.submit('u1',{field:'marital'});
  f.v.decide(f.v.pending()[0].id,{decision:'approve',result:'unmarried'});
  assert.deepEqual(f.onDisk(),[]);assert.deepEqual(f.store.read().verificationRequests.find(x=>x.userId==='u1').files,[]);
  assert.equal(strip().verified,true);assert.equal(strip().result,'未婚(无登记记录)');
  assert.equal(f.v.status('u1').fields.marital.result,'未婚(无登记记录)');
  // Non-members only see the one line; the result never leaks to them.
  f.service.save('plain',f.data());const plain=f.service.seriousPage(sid,'plain');
  assert.deepEqual(plain.sections.verify,{membersOnly:true});assert.ok(!JSON.stringify(plain).includes('未婚'));
  // Editing the profile keeps the 婚况 result (no profile field backs it).
  f.service.save('u1',f.data({nickname:'改名'}));assert.equal(strip().result,'未婚(无登记记录)');
});
