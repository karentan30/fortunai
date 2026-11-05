'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {calculate,createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService,FIELDS}=require('./friends-service');
const secret='test-signing-key-'.repeat(4);
function setup(file){const store=createFriendsStore(file),charts=createChartService(secret),service=createFriendsService(store,charts);
const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
const data=(extra={})=>({credential,consent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'职员',industry:'科技',title:'工程师',income:'自报个人暂无收入',assets:'自报个人暂无资产'},visibility:{school:'public',income:'connected'},hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'private-contact',contactConsent:true,...extra});
return {store,charts,service,data};}
test('calendar validation, known regression and unknown time',()=>{
assert.equal(calculate({birthday:'1991-08-28',calendar:'lunar',hour:6}).dayPillar,'戊申');
for(const input of [{birthday:'1991-02-30'},{birthday:'1991-08-31',calendar:'lunar'},{birthday:'1991-08-28',calendar:'lunar',leapMonth:true},{birthday:'2020-01-01'},{birthday:'2999-01-01'}])assert.throws(()=>calculate(input));
const c=calculate({birthday:'1991-08-28'});assert.equal(c.pillars,null);assert.equal(c.complete,false);
});
test('signed chart rejects tampering',()=>{const {charts,data}=setup();const token=data().credential;assert.equal(charts.verify(token).dayMaster,'戊');assert.throws(()=>charts.verify(token+'x'));const parts=token.split('.');parts[0]=Buffer.from('{}').toString('base64url');assert.throws(()=>charts.verify(parts.join('.')));});
test('core fields required; optional legacy fields and age derivation',()=>{const {service,data}=setup();for(const k of FIELDS.filter(k=>!['age','industry','title','familyAssets'].includes(k))){const b=data();delete b.fields[k];assert.throws(()=>service.save('a',b));}const p=service.save('a',data({fields:{...data().fields,age:'16'}}));assert.ok(Number(p.fields.age)>=18);assert.throws(()=>service.save('b',data({consent:false})));});
test('privacy, request permissions, contacts, duplicate concurrency and exit',async()=>{
const {service:s,data}=setup();const a=s.save('a',data()),b=s.save('b',data()),c=s.save('c',data());
let card=s.card(b.shareId,'a');assert.equal(card.fields.school,'学校');assert.equal(card.fields.income,undefined);assert.equal(card.fields.assets,undefined);assert.equal(card.contact,undefined);
const results=await Promise.allSettled([Promise.resolve().then(()=>s.request('a',b.shareId)),Promise.resolve().then(()=>s.request('a',b.shareId))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
const id=results.find(r=>r.status==='fulfilled').value.id;assert.throws(()=>s.act('c',id,'accept'));assert.throws(()=>s.act('a',id,'accept'));s.act('b',id,'accept');assert.throws(()=>s.act('b',id,'accept'));
assert.equal(s.card(b.shareId,'a').fields.income,'自报个人暂无收入');assert.equal(s.requests('a')[0].contact,'private-contact');
s.save('a',data({contactConsent:false}));assert.equal(s.requests('a')[0].contact,undefined);s.save('a',data({listed:false}));assert.equal(s.card(b.shareId,'a').fields.income,undefined);assert.equal(s.requests('b')[0].contact,undefined);assert.throws(()=>s.card(a.shareId,'b'));
s.save('a',data());s.block('a',b.shareId);assert.throws(()=>s.card(b.shareId,'a'));assert.deepEqual(s.requests('a'),[]);
s.remove('b');assert.throws(()=>s.card(b.shareId,'c'));assert.deepEqual(s.requests('a'),[]);
});
test('withdraw/decline restricted to respective party',()=>{const {service:s,data}=setup();const a=s.save('a',data()),b=s.save('b',data());const r=s.request('a',b.shareId);assert.throws(()=>s.act('b',r.id,'withdraw'));assert.throws(()=>s.act('a',r.id,'decline'));assert.equal(s.act('a',r.id,'withdraw').status,'withdrawn');assert.throws(()=>s.act('b',r.id,'accept'));});
test('deleting and recreating a profile cannot bypass account-level blocks',()=>{const {service:s,data}=setup();const a=s.save('a',data()),b=s.save('b',data());s.block('a',b.shareId);s.remove('b');s.save('b',data());assert.throws(()=>s.card(a.shareId,'b'));assert.throws(()=>s.request('b',a.shareId));assert.equal(s.discover('b').profiles.length,0);});
test('either accepted party may disconnect; permissions revoke immediately',()=>{
for(const actor of ['a','b']){const {service:s,data}=setup();s.save('a',data());const b=s.save('b',data());s.save('c',data());const r=s.request('a',b.shareId);
assert.throws(()=>s.act('a',r.id,'disconnect'));s.act('b',r.id,'accept');assert.throws(()=>s.act('c',r.id,'disconnect'));assert.equal(s.card(b.shareId,'a').fields.income,'自报个人暂无收入');
assert.equal(s.act(actor,r.id,'disconnect').status,'disconnected');assert.equal(s.card(b.shareId,'a').connected,false);assert.equal(s.card(b.shareId,'a').fields.income,undefined);assert.equal(s.requests('a')[0].contact,undefined);assert.equal(s.requests('b')[0].contact,undefined);assert.throws(()=>s.act(actor,r.id,'disconnect'));assert.throws(()=>s.act('b',r.id,'accept'));}
});
test('JSON restart persists and corrupt snapshot fails closed',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'runae-friends-'));try{const file=path.join(dir,'data.json');const {service:s,data}=setup(file);const a=s.save('a',data());assert.equal(setup(file).service.me('a').shareId,a.shareId);fs.writeFileSync(file,'{broken');assert.throws(()=>createFriendsStore(file));assert.equal(fs.readFileSync(file,'utf8'),'{broken');fs.writeFileSync(file,'{}');assert.throws(()=>createFriendsStore(file));}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('Origin protocol must match request protocol',async()=>{
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}
const {createRouter}=require('../routes/friends');const app=express();app.use(express.json());app.use(createRouter({express,store:createFriendsStore(),secret,auth:(req,res,next)=>next()}));
const server=await new Promise(resolve=>{const x=app.listen(0,'127.0.0.1',()=>resolve(x));});try{const host='127.0.0.1:'+server.address().port;
for(const [protocol,status] of [['http',200],['https',403]]){const response=await fetch('http://'+host+'/chart',{method:'POST',headers:{'Content-Type':'application/json','X-Runae-Friends':'1',Origin:protocol+'://'+host},body:JSON.stringify({birthday:'1991-08-28'})});assert.equal(response.status,status);}
}finally{await new Promise(resolve=>server.close(resolve));}
});
test('router auth, CSRF and disabled mode',async()=>{let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}const {createRouter}=require('../routes/friends');const {store}=setup();const app=express();app.use(express.json());app.use('/friends',createRouter({express,store,secret,auth:(req,res,next)=>next()}));app.use('/disabled',createRouter({express,enabled:false,auth:(req,res,next)=>next()}));const server=await new Promise(resolve=>{const x=app.listen(0,'127.0.0.1',()=>resolve(x));});try{const base='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(base+'/friends/me')).status,401);assert.equal((await fetch(base+'/friends/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);assert.equal((await fetch(base+'/friends/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Runae-Friends':'1',Origin:'https://evil.example'},body:'{}'})).status,403);assert.equal((await fetch(base+'/friends/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},body:'{}'})).status,401);assert.equal((await fetch(base+'/disabled/me')).status,503);}finally{await new Promise(resolve=>server.close(resolve));}});

test('family assets have independent public/connected/private scopes',()=>{
 const {service:s,data}=setup();s.save('a',data());
 const make=scope=>data({fields:{...data().fields,familyAssets:'A9.3'},visibility:{...data().visibility,familyAssets:scope}});
 const b=s.save('b',make('private'));assert.equal(s.card(b.shareId,'a').fields.familyAssets,undefined);
 s.save('b',make('public'));assert.equal(s.card(b.shareId,'a').fields.familyAssets,'A9.3');
 s.save('b',make('connected'));assert.equal(s.card(b.shareId,'a').fields.familyAssets,undefined);
 const r=s.request('a',b.shareId);s.act('b',r.id,'accept');assert.equal(s.card(b.shareId,'a').fields.familyAssets,'A9.3');
 s.save('b',make('private'));assert.equal(s.card(b.shareId,'a').fields.familyAssets,undefined);
 const minimal=data();delete minimal.fields.industry;delete minimal.fields.title;assert.doesNotThrow(()=>s.save('c',minimal));
});
