'use strict';
// 人工核验: upload validation, encrypted storage, delete-after-review, member-only display, admin auth.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');
const {createVerificationService,sniff,MAX_BYTES}=require('./friends-verification');
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}

const secret='test-signing-key-'.repeat(4),KEY='ab'.repeat(32),ADMIN='admin-token-for-tests-'.repeat(3);
const PNG=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('IHDR-secret-payslip-pixels')]);
const JPG=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.from('jpeg-body')]);
const PDF=Buffer.from('%PDF-1.7\n1 0 obj secret-bank-statement');
const WEBP=Buffer.concat([Buffer.from('RIFF'),Buffer.from([0,0,0,0]),Buffer.from('WEBPVP8 ')]);
const b64=b=>b.toString('base64');

function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xs-verify-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createFriendsStore(),charts=createChartService(secret),service=createFriendsService(store,charts);
  const files=path.join(dir,'files'),v=createVerificationService({store,dir:files,key:KEY});
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'工程师',industry:'科技',title:'工程师',income:'30–50万',assets:'100–500万',education:'硕士'},
    visibility:{school:'public',occupation:'public',income:'public',assets:'public',education:'public'},hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,...extra});
  const onDisk=()=>fs.readdirSync(files).filter(n=>n.endsWith('.bin'));
  // A paid, benefit-verified, in-window matching membership: the only thing isMember() accepts.
  const makeMember=uid=>store.transaction(s=>{s.billingOrders=[...(s.billingOrders||[]),{id:'o-'+uid,userId:uid,status:'paid',matchingMembership:true,benefitsVerified:true,paidAt:new Date(Date.now()-86400000).toISOString(),accessUntil:new Date(Date.now()+30*86400000).toISOString()}];});
  return {dir,files,store,service,v,data,onDisk,makeMember};
}
async function listen(t,app){const server=await new Promise(r=>{const x=app.listen(0,'127.0.0.1',()=>r(x));});t.after(()=>new Promise(r=>server.close(r)));return 'http://127.0.0.1:'+server.address().port;}
function app(f,{adminToken=ADMIN}={}){
  const {createRouter}=require('../routes/friends');const a=express();a.use(express.json({limit:'10mb'}));
  a.use(createRouter({express,store:f.store,secret,adminToken,verification:f.v,auth:(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();}}));
  return a;
}
const H=(user,extra={})=>({'Content-Type':'application/json','X-Runae-Friends':'1',...(user?{'X-Test-User':user}:{}),...extra});

test('magic-byte sniffing accepts JPEG/PNG/WEBP/PDF and rejects everything else regardless of name',()=>{
  assert.equal(sniff(JPG),'image/jpeg');assert.equal(sniff(PNG),'image/png');assert.equal(sniff(WEBP),'image/webp');assert.equal(sniff(PDF),'application/pdf');
  for(const bad of [Buffer.from('MZ\x90\x00 windows exe'),Buffer.from('<html><script>alert(1)</script>'),Buffer.from('GIF89a......'),Buffer.from('%PD'),Buffer.from([0x89,0x50,0x4e,0x47]),Buffer.alloc(0),'%PDF-string-not-buffer'])assert.equal(sniff(bad),null);
});

test('upload validation: bad type, oversize, bad base64, 4th file, unknown field, no profile, code format',t=>{
  const f=setup(t);
  assert.throws(()=>f.v.upload('a',{field:'income',name:'x.png',data:b64(PNG)}),/先保存个人资料/);
  f.service.save('a',f.data());
  const reject=(body,status)=>{try{f.v.upload('a',body);assert.fail('should reject');}catch(e){assert.equal(e.status,status,e.message);}};
  reject({field:'income',name:'payslip.jpg',data:b64(Buffer.from('MZ\x90\x00 exe pretending to be jpg'))},415);
  reject({field:'income',name:'a.pdf',data:b64(Buffer.from('<html>'))},415);
  reject({field:'income',name:'big.pdf',data:b64(Buffer.concat([PDF,Buffer.alloc(MAX_BYTES)]))},413);
  reject({field:'income',name:'x',data:'%%%not-base64%%%'},400);
  reject({field:'salary',name:'x.png',data:b64(PNG)},400);
  reject({field:'income',name:'x.png'},400);
  assert.deepEqual(f.onDisk(),[],'rejected uploads never touch disk');
  // exactly 5MB is allowed
  f.v.upload('a',{field:'assets',name:'max.pdf',data:b64(Buffer.concat([PDF,Buffer.alloc(MAX_BYTES-PDF.length)]))});
  for(const buf of [PNG,JPG,PDF])f.v.upload('a',{field:'income',name:'p.bin',data:b64(buf)});
  reject({field:'income',name:'4th.png',data:b64(PNG)},400);
  assert.equal(f.onDisk().length,4);
  assert.deepEqual(f.v.status('a').fields.income.files.map(x=>x.mime),['image/png','image/jpeg','application/pdf'],'type comes from content, not name');
  assert.throws(()=>f.v.submit('a',{field:'education',code:'bad code!'}),/验证码格式/);
  assert.throws(()=>f.v.submit('a',{field:'income',code:'ABCDEF123'}),/只有学历/);
  assert.throws(()=>f.v.submit('a',{field:'occupation'}),/上传证明文件/);
});

test('files are encrypted at rest with 0600, outside the repo; in-repo directory is refused',t=>{
  const f=setup(t);f.service.save('a',f.data());f.v.upload('a',{field:'assets',name:'bank.pdf',data:b64(PDF)});
  const [name]=f.onDisk(),raw=fs.readFileSync(path.join(f.files,name));
  assert.equal(raw.includes(Buffer.from('secret-bank-statement')),false,'no plaintext on disk');assert.equal(raw.includes(Buffer.from('%PDF')),false);
  if(process.platform!=='win32')assert.equal(fs.statSync(path.join(f.files,name)).mode&0o777,0o600);
  assert.throws(()=>createVerificationService({store:f.store,dir:path.resolve(__dirname,'../../assets/verify'),key:KEY}),/网站目录/);
  assert.throws(()=>createVerificationService({store:f.store,dir:f.files,key:'short'}),/密钥/);
});

test('approve: verified[field]=true with timestamp, files and code deleted immediately',t=>{
  const f=setup(t);f.service.save('a',f.data());
  f.v.upload('a',{field:'income',name:'tax.png',data:b64(PNG)});f.v.upload('a',{field:'income',name:'slip.pdf',data:b64(PDF)});
  f.v.upload('a',{field:'education',name:'chsi.jpg',data:b64(JPG)});
  assert.equal(f.v.submit('a',{field:'income'}).status,'pending');f.v.submit('a',{field:'education',code:'ABCD1234EFGH'});
  assert.throws(()=>f.v.upload('a',{field:'income',name:'late.png',data:b64(PNG)}),/审核中/);
  assert.equal(f.v.status('a').fields.income.status,'pending');
  const q=f.v.pending();assert.equal(q.length,2);const inc=q.find(r=>r.field==='income'),edu=q.find(r=>r.field==='education');
  assert.equal(edu.code,'ABCD1234EFGH');assert.deepEqual(f.v.file(inc.id,inc.files[0].id).body,PNG,'admin reads decrypted original');
  assert.equal(f.onDisk().length,3);
  const r=f.v.decide(inc.id,{decision:'approve'});assert.equal(r.status,'approved');assert.equal(r.filesDeleted,2);
  assert.equal(f.onDisk().length,1,'approved files deleted right away');
  for(const file of inc.files)assert.equal(fs.existsSync(f.v._paths.fileOf(file.id)),false);
  assert.throws(()=>f.v.file(inc.id,inc.files[0].id),/不存在|已删除/);
  const p=f.store.read().profiles.find(x=>x.userId==='a');assert.equal(p.verified.income,true);assert.ok(Date.parse(p.verifiedAt.income));
  const stored=f.store.read().verificationRequests.find(x=>x.id===inc.id);assert.deepEqual(stored.files,[]);assert.equal(stored.code,null);
  f.v.decide(edu.id,{decision:'approve'});assert.equal(f.store.read().verificationRequests.find(x=>x.id===edu.id).code,null,'学信网 code deleted too');
  assert.equal(f.onDisk().length,0);
  const st=f.v.status('a').fields;assert.equal(st.income.status,'approved');assert.equal(st.income.verified,true);assert.ok(st.income.verifiedAt);
  assert.throws(()=>f.v.decide(inc.id,{decision:'approve'}),/已处理/);
  assert.ok(f.store.read().auditLogs.some(x=>x.action==='verification.approve'&&x.target===inc.id));
});

test('reject: reason required, files deleted, reason shown to the owner only, no verified flag',t=>{
  const f=setup(t);f.service.save('a',f.data());f.v.upload('a',{field:'assets',name:'bank.pdf',data:b64(PDF)});f.v.submit('a',{field:'assets'});
  const [req]=f.v.pending();
  assert.throws(()=>f.v.decide(req.id,{decision:'reject'}),/原因/);assert.throws(()=>f.v.decide(req.id,{decision:'maybe'}),/无效/);
  assert.equal(f.onDisk().length,1,'failed decisions keep the file for review');
  f.v.decide(req.id,{decision:'reject',reason:'证明不清晰，请上传完整的银行盖章页'});
  assert.equal(f.onDisk().length,0,'rejected files deleted right away');
  const st=f.v.status('a').fields.assets;assert.equal(st.status,'rejected');assert.equal(st.reason,'证明不清晰，请上传完整的银行盖章页');assert.equal(st.verified,false);
  assert.equal(f.store.read().profiles[0].verified,undefined);
  // The user can start over after a rejection.
  assert.equal(f.v.upload('a',{field:'assets',name:'new.pdf',data:b64(PDF)}).status,'draft');
});

test('verified marks survive unrelated saves, drop when the value changes, and can never be set by the client',t=>{
  const f=setup(t);f.service.save('a',f.data({verified:{income:true,assets:true}}));
  assert.equal(f.store.read().profiles[0].verified,undefined,'client-sent verified ignored');
  f.v.upload('a',{field:'income',name:'p.png',data:b64(PNG)});f.v.submit('a',{field:'income'});f.v.decide(f.v.pending()[0].id,{decision:'approve'});
  f.service.save('a',f.data({bio:'改简介'}));assert.equal(f.service.me('a').verified.income,true);
  f.service.save('a',f.data({fields:{...f.data().fields,income:'50–100万'}}));assert.equal(f.service.me('a').verified.income,undefined,'changed value loses the mark');
});

test('API: non-member gets no verified data anywhere; member and owner do',async t=>{
  const f=setup(t);const a=f.service.save('a',f.data());f.service.save('viewer',f.data({nickname:'看的人'}));
  f.v.upload('a',{field:'income',name:'p.png',data:b64(PNG)});f.v.submit('a',{field:'income'});f.v.decide(f.v.pending()[0].id,{decision:'approve'});
  const base=await listen(t,app(f));
  const get=async(p,u)=>{const r=await fetch(base+p,{headers:H(u)});return {status:r.status,text:await r.text()};};
  for(const p of ['/card/'+a.shareId,'/discover']){
    const r=await get(p,'viewer');assert.equal(r.status,200);assert.equal(/verified|已核验/.test(r.text),false,'non-member leak on '+p+': '+r.text.slice(0,200));
  }
  const anon=await get('/card/'+a.shareId);assert.equal(/verified/.test(anon.text),false,'anonymous share link leaks nothing');
  f.makeMember('viewer');
  const card=JSON.parse((await get('/card/'+a.shareId,'viewer')).text).profile;assert.deepEqual(card.verified,{income:true});
  const disc=JSON.parse((await get('/discover','viewer')).text).profiles.find(p=>p.shareId===a.shareId);assert.deepEqual(disc.verified,{income:true});
  const me=JSON.parse((await get('/me','a')).text).profile;assert.equal(me.verified.income,true);
  const own=JSON.parse((await get('/verification','a')).text);assert.equal(own.fields.income.status,'approved');assert.equal(own.fields.income.verified,true);
  // A private field is not marked even for members (no hint about hidden data).
  f.service.save('a',f.data({visibility:{...f.data().visibility,income:'private'}}));
  assert.equal(/verified":\{"income/.test((await get('/card/'+a.shareId,'viewer')).text),false);
});

test('API: upload/submit over HTTP, admin routes and file view require the admin token, no public file URL',async t=>{
  const f=setup(t);f.service.save('a',f.data());const base=await listen(t,app(f));
  const post=(p,body,u,extra)=>fetch(base+p,{method:'POST',headers:H(u,extra),body:JSON.stringify(body)});
  assert.equal((await post('/verification/files',{field:'income',name:'x.png',data:b64(PNG)})).status,401,'login required');
  assert.equal((await fetch(base+'/verification/files',{method:'POST',headers:{'Content-Type':'application/json','X-Test-User':'a'},body:'{}'})).status,403,'CSRF header required');
  assert.equal((await post('/verification/files',{field:'income',name:'x.png',data:b64(Buffer.from('<svg onload=alert(1)>'))},'a')).status,415);
  const up=await post('/verification/files',{field:'income',name:'x.png',data:b64(PNG)},'a');assert.equal(up.status,200);
  assert.equal((await post('/verification/submit',{field:'income'},'a')).status,200);
  const [req]=f.v.pending(),fileUrl='/admin/verifications/'+req.id+'/files/'+req.files[0].id;
  for(const headers of [{},{'X-Admin-Token':'wrong'},{'X-Admin-Token':ADMIN.slice(0,-1)+'x'},{'X-Test-User':'a'}]){
    for(const p of ['/admin/verifications',fileUrl]){const r=await fetch(base+p,{headers});assert.equal(r.status,401,p);const body=Buffer.from(await r.arrayBuffer());assert.equal(body.includes(Buffer.from('secret-payslip')),false);}
    assert.equal((await post('/admin/verifications/'+req.id,{decision:'approve'},null,headers)).status,401);
  }
  assert.equal(f.onDisk().length,1,'unauthenticated decision did nothing');
  const list=await (await fetch(base+'/admin/verifications',{headers:{'X-Admin-Token':ADMIN}})).json();assert.equal(list.requests.length,1);
  {const j=JSON.stringify(list);assert.equal(/https?:|\.bin|url/i.test(j)||j.includes(f.files),false,'queue lists ids only, no URLs or paths');}
  const file=await fetch(base+fileUrl,{headers:{'X-Admin-Token':ADMIN}});assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png');assert.match(file.headers.get('cache-control'),/no-store/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()),PNG);
  // The storage directory is not reachable through the app.
  assert.notEqual((await fetch(base+'/'+path.basename(f.files)+'/'+f.onDisk()[0])).status,200);
  const rej=await post('/admin/verifications/'+req.id,{decision:'reject',reason:'看不清'},null,{'X-Admin-Token':ADMIN});assert.equal(rej.status,200);
  assert.equal(f.onDisk().length,0);assert.equal((await fetch(base+fileUrl,{headers:{'X-Admin-Token':ADMIN}})).status,404);
  const own=await (await fetch(base+'/verification',{headers:H('a')})).json();assert.equal(own.fields.income.status,'rejected');assert.equal(own.fields.income.reason,'看不清');
  // Unconfigured admin token fails closed.
  const closed=await listen(t,app(f,{adminToken:''}));assert.equal((await fetch(closed+'/admin/verifications',{headers:{'X-Admin-Token':ADMIN}})).status,503);
});

test('deleting the profile purges pending files; sweep removes orphans and stale drafts',async t=>{
  const f=setup(t);f.service.save('a',f.data());const base=await listen(t,app(f));
  f.v.upload('a',{field:'income',name:'x.png',data:b64(PNG)});f.v.submit('a',{field:'income'});assert.equal(f.onDisk().length,1);
  assert.equal((await fetch(base+'/profile',{method:'DELETE',headers:H('a'),body:'{}'})).status,200);
  assert.equal(f.onDisk().length,0);assert.equal(f.store.read().verificationRequests.length,0);
  let now=Date.now();const v=createVerificationService({store:f.store,dir:f.files,key:KEY,clock:()=>now});
  f.service.save('b',f.data());v.upload('b',{field:'assets',name:'x.pdf',data:b64(PDF)});
  fs.writeFileSync(path.join(f.files,crypto.randomBytes(16).toString('hex')+'.bin'),'orphan');
  now+=8*86400000;v.sweep();assert.equal(f.onDisk().length,0);assert.equal(f.store.read().verificationRequests.length,0);
});

test('the word 自述 appears nowhere in 相生 user-facing code, pages or data',()=>{
  const root=path.resolve(__dirname,'../..'),hits=[];
  const scan=(dir,re)=>{for(const n of fs.readdirSync(path.join(root,dir)))if(re.test(n)&&!/\.test\./.test(n)&&fs.readFileSync(path.join(root,dir,n),'utf8').includes('自述'))hits.push(dir+'/'+n);};
  scan('assets/js',/^friends.*\.js$/);scan('pages',/^friends.*\.html$/);scan('assets/data',/^friends.*\.json$/);scan('server/lib',/^friends.*\.js$/);scan('server/routes',/^friends.*\.js$/);
  assert.deepEqual(hits,[]);
});
