'use strict';
// 认真相亲页: scoped media routes, owner delete, metadata stripping, size caps, questionnaire tags never leak.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');
const SP=require('./friends-serious');
const BANK=require('../../assets/data/friends-marriage-questionnaire.json');
let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}

const secret='test-signing-key-'.repeat(4),KEY='cd'.repeat(32);
const seg=(marker,payload)=>{const b=Buffer.alloc(4);b[0]=0xff;b[1]=marker;b.writeUInt16BE(payload.length+2,2);return Buffer.concat([b,payload]);};
function jpeg({w=800,h=600,gps=true}={}){
  const sof=Buffer.from([8,0,0,0,0,3,1,0x22,0,2,0x11,1,3,0x11,1]);sof.writeUInt16BE(h,1);sof.writeUInt16BE(w,3);
  return Buffer.concat([Buffer.from([0xff,0xd8]),seg(0xe0,Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0','latin1')),
    gps?seg(0xe1,Buffer.from('Exif\0\0MM\0*GPSLatitude=31.2304N;GPSLongitude=121.4737E;Make=iPhone','latin1')):Buffer.alloc(0),
    seg(0xfe,Buffer.from('comment: shot at home','latin1')),seg(0xdb,Buffer.alloc(65,1)),seg(0xc0,sof),seg(0xda,Buffer.from([3,1,0,2,0x11,3,0x11,0,0x3f,0])),Buffer.from('SCANDATA'),Buffer.from([0xff,0xd9])]);
}
const chunk=(type,data)=>{const b=Buffer.alloc(8);b.writeUInt32BE(data.length,0);b.write(type,4,'latin1');return Buffer.concat([b,data,Buffer.alloc(4)]);};
function png({w=400,h=300}={}){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('eXIf',Buffer.from('MM\0*GPSLatitude=31.2304N','latin1')),chunk('tEXt',Buffer.from('Location\0Shanghai home','latin1')),chunk('IDAT',Buffer.from('pixels')),chunk('IEND',Buffer.alloc(0))]);}
function webp(){const vp8x=Buffer.alloc(10);vp8x[0]=0x08|0x04;vp8x.writeUIntLE(299,4,3);vp8x.writeUIntLE(199,7,3);
  const c=(t,d)=>{const h=Buffer.alloc(8);h.write(t,0,'latin1');h.writeUInt32LE(d.length,4);return Buffer.concat([h,d,d.length&1?Buffer.alloc(1):Buffer.alloc(0)]);};
  const body=Buffer.concat([c('VP8X',vp8x),c('VP8L',Buffer.from([0x2f,0,0,0,0,0])),c('EXIF',Buffer.from('GPSLatitude=31.23N')),c('XMP ',Buffer.from('<x:xmpmeta>GPS</x:xmpmeta>'))]);
  const head=Buffer.alloc(12);head.write('RIFF',0,'latin1');head.writeUInt32LE(body.length+4,4);head.write('WEBP',8,'latin1');return Buffer.concat([head,body]);}
function wav(seconds,{rate=8000}={}){const data=Buffer.alloc(Math.round(seconds*rate*2));const fmt=Buffer.alloc(16);fmt.writeUInt16LE(1,0);fmt.writeUInt16LE(1,2);fmt.writeUInt32LE(rate,4);fmt.writeUInt32LE(rate*2,8);fmt.writeUInt16LE(2,12);fmt.writeUInt16LE(16,14);
  const c=(t,d)=>{const h=Buffer.alloc(8);h.write(t,0,'latin1');h.writeUInt32LE(d.length,4);return Buffer.concat([h,d]);};
  const body=Buffer.concat([c('fmt ',fmt),c('LIST',Buffer.from('INFOINAMsecret-recorded-at-home!')),c('data',data)]);const head=Buffer.alloc(12);head.write('RIFF',0,'latin1');head.writeUInt32LE(body.length+4,4);head.write('WAVE',8,'latin1');return Buffer.concat([head,body]);}
const b64=b=>b.toString('base64');

function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xs-serious-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createFriendsStore(),charts=createChartService(secret),service=createFriendsService(store,charts);
  const media=SP.createSeriousMediaService({store,dir:path.join(dir,'media'),key:KEY});
  const credential=charts.issue({birthday:'1992-03-14',calendar:'solar',hour:9}).credential;
  const save=(uid,extra={})=>service.save(uid,{credential,consent:true,crossBorderConsent:true,nickname:'用户'+uid,city:'上海',purposes:['serious'],fields:{height:'170',education:'本科',occupation:'工程师',house:'有房',car:'无车',hukou:'上海'},
    visibility:{age:'public',height:'public',education:'public',occupation:'public',house:'public',car:'private',hukou:'connected'},dateActivities:['羽毛球'],hobbies:['徒步'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,...extra});
  const connect=(a,b)=>store.transaction(s=>{s.requests.push({id:'r-'+a+b,from:a,to:b,status:'accepted',createdAt:new Date().toISOString()});});
  const files=()=>fs.existsSync(path.join(dir,'media'))?fs.readdirSync(path.join(dir,'media')).filter(n=>n.endsWith('.bin')):[];
  const shareOf=uid=>store.read().profiles.find(p=>p.userId===uid).shareId;
  const makeMember=uid=>store.transaction(s=>{s.billingOrders=[...(s.billingOrders||[]),{id:'o-'+uid,userId:uid,status:'paid',matchingMembership:true,benefitsVerified:true,paidAt:new Date(Date.now()-86400000).toISOString(),accessUntil:new Date(Date.now()+30*86400000).toISOString()}];});
  const answers=(uid,dims)=>store.transaction(s=>{s.marriageQuestionnaires=[...(s.marriageQuestionnaires||[]).filter(r=>r.userId!==uid),{recordId:'q-'+uid,userId:uid,version:BANK.version,dimensions:dims,matchingConsent:false,revision:1}];});
  return {dir,store,service,media,save,connect,files,shareOf,makeMember,answers};
}
async function listen(t,f){
  const {createRouter}=require('../routes/friends');const a=express();a.use(express.json({limit:'10mb'}));
  a.use(createRouter({express,store:f.store,secret,seriousMedia:f.media,auth:(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();}}));
  const server=await new Promise(r=>{const x=a.listen(0,'127.0.0.1',()=>r(x));});t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  return (p,user,{method='GET',body}={})=>fetch(base+p,{method,headers:{'Content-Type':'application/json','X-Runae-Friends':'1',...(user?{'X-Test-User':user}:{})},...(method!=='GET'?{body:JSON.stringify(body||{})}:{})});
}

test('media route enforces section scope: stranger / connected / public / anonymous / blocked',async t=>{
  const f=setup(t);f.save('owner');f.save('stranger');f.save('friend');f.connect('owner','friend');
  const photo=f.media.addPhoto('owner',{data:b64(jpeg())}).photos[0].id,voice=f.media.setVoice('owner',{data:b64(wav(3)),durationMs:3000}).voice.id;
  f.service.seriousSave('owner',{about:'周末爬山',scopes:{photos:'connected',voice:'connected'}});
  const req=await listen(t,f),sid=f.shareOf('owner');
  const status=async(user,id)=>{const r=await req(`/serious/${sid}/media/${id}`,user);return r.status;};
  for(const id of [photo,voice]){
    assert.equal(await status('stranger',id),404,'stranger cannot fetch connected-only media');
    assert.equal(await status('friend',id),200,'connected viewer can');
    assert.equal(await status('owner',id),200,'owner can');
    assert.equal(await status(null,id),401,'anonymous cannot');
  }
  const page=await (await req('/serious/'+sid,'stranger')).json();
  assert.equal(page.page.sections.photos,undefined);assert.equal(page.page.sections.voice,undefined);assert.equal(page.page.sections.about,'周末爬山');
  const res=await req(`/serious/${sid}/media/${photo}`,'friend');
  assert.equal(res.headers.get('content-type'),'image/jpeg');assert.match(res.headers.get('cache-control'),/no-store/);assert.match(res.headers.get('content-security-policy'),/sandbox/);
  f.service.seriousSave('owner',{scopes:{photos:'public',voice:'private'}});
  assert.equal(await status('stranger',photo),200,'public photos visible to logged-in strangers');
  assert.equal(await status('friend',voice),404,'private voice hidden even from connected');
  // A media id from another page, or a made-up one, is a plain 404.
  f.save('other');const otherPhoto=f.media.addPhoto('other',{data:b64(png())}).photos[0].id;f.service.seriousSave('other',{scopes:{photos:'public'}});
  assert.equal(await status('stranger',otherPhoto),404,'id must belong to this page');
  await req('/block','owner',{method:'POST',body:{shareId:f.shareOf('stranger')}});
  assert.equal(await status('stranger',photo),404,'blocked viewer sees nothing');
  assert.equal((await req('/serious/'+sid,'stranger')).status,404);
});

test('page needs 享受恋爱 or 认真结婚; friends-only profiles get 404 and cannot upload',async t=>{
  const f=setup(t);f.save('owner',{purposes:['friend']});f.save('viewer');
  assert.throws(()=>f.media.addPhoto('owner',{data:b64(jpeg())}),/享受恋爱/);
  assert.throws(()=>f.service.seriousSave('owner',{about:'x'}),/享受恋爱/);
  const req=await listen(t,f);assert.equal((await req('/serious/'+f.shareOf('owner'),'viewer')).status,404);
  f.save('owner',{purposes:['friend','dating']});f.service.seriousSave('owner',{about:'认真了解'});
  assert.equal((await req('/serious/'+f.shareOf('owner'),'viewer')).status,200);
  assert.equal(f.service.card(f.shareOf('owner'),'viewer').seriousPage,true,'card links to the page when it has visible content');
  f.save('owner',{purposes:['friend']});
  assert.equal(f.service.card(f.shareOf('owner'),'viewer').seriousPage,undefined,'no link once purposes no longer include dating/serious');
});

test('owner delete removes the encrypted file; profile delete purges everything',async t=>{
  const f=setup(t);f.save('owner');
  const a=f.media.addPhoto('owner',{data:b64(jpeg())}).photos[0].id;f.media.addPhoto('owner',{data:b64(png())});
  const v1=f.media.setVoice('owner',{data:b64(wav(2)),durationMs:2000}).voice.id;
  assert.equal(f.files().length,3);
  // Files are encrypted: no plaintext marker on disk.
  for(const n of f.files())assert.ok(!fs.readFileSync(path.join(f.dir,'media',n)).includes('SCANDATA'));
  f.media.removePhoto('owner',a);assert.ok(!f.files().includes(a+'.bin'),'deleted photo file is gone');assert.equal(f.files().length,2);
  const v2=f.media.setVoice('owner',{data:b64(wav(2)),durationMs:2000}).voice.id;assert.ok(!f.files().includes(v1+'.bin'),'replaced voice file is gone');
  f.media.removeVoice('owner');assert.ok(!f.files().includes(v2+'.bin'));assert.equal(f.files().length,1);
  assert.throws(()=>f.media.removePhoto('someone-else',f.store.read().seriousPages[0].photos[0].id),/不存在/,'only the owner can delete');
  const req=await listen(t,f);assert.equal((await req('/profile','owner',{method:'DELETE'})).status,200);
  assert.equal(f.files().length,0,'profile delete removes every media file');assert.equal(f.store.read().seriousPages.length,0);
});

test('EXIF / GPS / text metadata is stripped before storage (JPEG, PNG, WEBP, WAV)',t=>{
  const f=setup(t);f.save('owner');
  const stored=()=>{const r=f.store.read().seriousPages[0];return r.photos.map(p=>f.media._read(p.id));};
  f.media.addPhoto('owner',{data:b64(jpeg())});f.media.addPhoto('owner',{data:b64(png())});f.media.addPhoto('owner',{data:b64(webp())});
  const [j,p,w]=stored();
  for(const b of [j,p,w]){const s=b.toString('latin1');assert.ok(!/GPS|Exif|eXIf|Location|iPhone|xmpmeta|shot at home/.test(s),'metadata left: '+s.slice(0,80));}
  assert.ok(j.includes('SCANDATA')&&j.includes('JFIF'),'image data kept');assert.ok(p.includes('IDAT'));
  assert.equal(w[20+8]&0x0c,0,'VP8X EXIF/XMP flags cleared');assert.equal(w.readUInt32LE(4),w.length-8,'RIFF size rewritten');
  assert.deepEqual(f.store.read().seriousPages[0].photos.map(x=>[x.w,x.h]),[[800,600],[400,300],[300,200]]);
  f.media.setVoice('owner',{data:b64(wav(1)),durationMs:1000});
  assert.ok(!f.media._read(f.store.read().seriousPages[0].voice.id).includes('secret-recorded-at-home'));
});

test('size, type, count and duration caps',t=>{
  const f=setup(t);f.save('owner');
  const status=fn=>{try{fn();return 200;}catch(e){return e.status;}};
  assert.equal(status(()=>f.media.addPhoto('owner',{data:b64(Buffer.concat([jpeg(),Buffer.alloc(SP.MAX_PHOTO_BYTES)]))})),413,'>5MB');
  assert.equal(status(()=>f.media.addPhoto('owner',{data:b64(jpeg({w:2400,h:1800}))})),413,'>1600px');
  assert.equal(status(()=>f.media.addPhoto('owner',{data:b64(Buffer.from('GIF89a-not-allowed'))})),415,'gif');
  assert.equal(status(()=>f.media.addPhoto('owner',{data:b64(Buffer.from('%PDF-1.7'))})),415,'pdf');
  for(let i=0;i<6;i++)f.media.addPhoto('owner',{data:b64(jpeg())});
  assert.equal(status(()=>f.media.addPhoto('owner',{data:b64(jpeg())})),400,'7th photo');
  assert.equal(f.files().length,6,'rejected uploads leave no file behind');
  assert.equal(status(()=>f.media.setVoice('owner',{data:b64(Buffer.concat([wav(1),Buffer.alloc(SP.MAX_VOICE_BYTES)])),durationMs:1000})),413,'>200KB');
  assert.equal(status(()=>f.media.setVoice('owner',{data:b64(wav(7)),durationMs:4000})),400,'real WAV length 7s beats a false claim');
  assert.equal(status(()=>f.media.setVoice('owner',{data:b64(wav(2)),durationMs:7000})),400,'claimed >6s');
  assert.equal(status(()=>f.media.setVoice('owner',{data:b64(Buffer.from('ID3-mp3-not-allowed')),durationMs:2000})),415);
  assert.equal(f.files().length,6);
  assert.throws(()=>f.service.seriousSave('owner',{about:'字'.repeat(501)}),/500/);
  assert.throws(()=>f.service.seriousSave('owner',{plans:['想要孩子','暂不考虑孩子']}),/只能选一个/);
});

test('questionnaire: only ticked tags reach the page; raw answers, notes and unticked answers never do',t=>{
  const f=setup(t);f.save('owner');f.save('viewer');
  f.answers('owner',{family:{status:'done',answers:{'family-kids-wish':{state:'answered',value:'want',importance:'must'},'family-marry-timing':{state:'answered',value:'1to3',note:'SECRET-NOTE-前任'},'family-note':{state:'answered',value:'SECRET-TEXT-ANSWER'}}},
    habits:{status:'done',answers:{'hab-smoke':{state:'answered',value:'none'},'hab-pets':{state:'answered',value:'cannot'}}},boundaries:{answers:{'bound-pace':{state:'answered',value:'slow'}}}});
  const own=f.service.seriousOwn('owner');
  const keys=own.availableTags.map(x=>x.key);
  assert.deepEqual(keys,['family-marry-timing:1to3','family-kids-wish:want','hab-smoke:none','hab-pets:cannot'],'own answers only; text and intimacy questions offer nothing');
  assert.equal(f.service.seriousPage(f.shareOf('owner'),'viewer').sections.qtags,undefined,'default: nothing shown');
  assert.throws(()=>f.service.seriousSave('owner',{qtags:['family-kids-wish:nokids']}),/自己问卷/,'cannot tick an answer you did not give');
  f.service.seriousSave('owner',{qtags:['family-kids-wish:want','hab-smoke:none'],scopes:{qtags:'public'}});
  const page=f.service.seriousPage(f.shareOf('owner'),'viewer'),json=JSON.stringify(page);
  assert.deepEqual(page.sections.qtags.map(x=>x.label),['想要孩子','不抽烟不喝酒']);
  for(const leak of ['1-3年内结婚','1to3','不能养宠物','cannot','SECRET','must','slow','marriageQuestionnaires','importance'])assert.ok(!json.includes(leak),'leaked: '+leak);
  // Changing the answer removes the tag even though it is still ticked.
  f.answers('owner',{family:{answers:{'family-kids-wish':{state:'answered',value:'nokids'}}},habits:{answers:{'hab-smoke':{state:'answered',value:'none'}}}});
  assert.deepEqual(f.service.seriousPage(f.shareOf('owner'),'viewer').sections.qtags.map(x=>x.label),['不抽烟不喝酒']);
  // 「一致」 only when the viewer ticked the same tag themselves.
  f.answers('viewer',{habits:{answers:{'hab-smoke':{state:'answered',value:'none'}}}});
  assert.equal(f.service.seriousPage(f.shareOf('owner'),'viewer').sections.qtags[0].same,undefined,'answer alone is not opting in');
  f.service.seriousSave('viewer',{qtags:['hab-smoke:none'],scopes:{qtags:'private'}});
  assert.equal(f.service.seriousPage(f.shareOf('owner'),'viewer').sections.qtags[0].same,true);
});

test('connected-only questionnaire tags and text stay hidden until the two connect',t=>{
  const f=setup(t);f.save('owner');f.save('viewer');
  f.answers('owner',{family:{answers:{'family-kids-wish':{state:'answered',value:'want'}}}});
  f.service.seriousSave('owner',{qtags:['family-kids-wish:want'],family:'父母退休教师',plans:['倾向结婚'],scopes:{qtags:'connected',family:'connected',plans:'private'}});
  let page=f.service.seriousPage(f.shareOf('owner'),'viewer');
  assert.equal(page.sections.qtags,undefined);assert.equal(page.sections.family,undefined);assert.ok(!JSON.stringify(page).includes('想要孩子'));
  f.connect('owner','viewer');page=f.service.seriousPage(f.shareOf('owner'),'viewer');
  assert.deepEqual(page.sections.qtags.map(x=>x.label),['想要孩子']);assert.equal(page.sections.family,'父母退休教师');assert.equal(page.sections.plans,undefined,'private stays private');
  assert.equal(page.scopes,undefined,'scopes are owner-only');
  assert.ok(f.service.seriousPage(f.shareOf('owner'),'owner').scopes,'owner preview carries scopes');
});

test('认证条: per-item status only for members; others get one line; house/car/hukou follow field scopes',t=>{
  const f=setup(t);f.save('owner');f.save('viewer');
  f.store.transaction(s=>{const p=s.profiles.find(x=>x.userId==='owner');p.verified={education:true,occupation:true};});
  f.service.seriousSave('owner',{about:'hi'});
  let page=f.service.seriousPage(f.shareOf('owner'),'viewer');
  assert.deepEqual(page.sections.verify,{membersOnly:true});assert.ok(!JSON.stringify(page).includes('"verified"'));
  assert.deepEqual(page.sections.assets,{house:'有房'},'car private, hukou connected-only');
  f.makeMember('viewer');page=f.service.seriousPage(f.shareOf('owner'),'viewer');
  assert.deepEqual(page.sections.verify.items.filter(x=>x.verified).map(x=>x.label),['学历','工作']);
  assert.equal(page.sections.verify.items.length,7);
});
