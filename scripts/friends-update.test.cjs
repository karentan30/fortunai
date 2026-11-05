'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const u=require('./friends-update.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'friends-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const source=path.join(root,'source'),target=path.join(root,'target'),backups=path.join(root,'backups');for(const p of [source,target,backups])fs.mkdirSync(p);return {root,source,target,backups};}
function manifest(bytes=Buffer.from('new')){return {release:'a'.repeat(40),files:[{path:'assets/js/friends.js',before:u.hash(Buffer.from('old')),after:u.hash(bytes),size:bytes.length}]};}
function put(root,p,value){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),value);}
test('delta manifest includes quotas membership and report sample, excludes private and unrelated files',()=>{
 u.validateManifest(u.MANIFEST);
 assert.equal(u.MANIFEST.installed,'adf46ced8e53ec1649a158a6def3944f685bfcb0');
 assert.equal(u.MANIFEST.release,'d94dbd807f598552c73b1a01f252a9e676541c34');
 assert.equal(u.MANIFEST.files.length,14);
 assert.ok(u.MANIFEST.files.reduce((n,e)=>n+e.size,0)<300000);
 for(const p of ['server/lib/friends-quotas.js','server/lib/friends-membership.js','pages/friends-report-sample.html','assets/js/friends-membership.js'])assert.ok(u.MANIFEST.files.some(e=>e.path===p));
 for(const p of ['server/data.json','server/.env','server/lib/vision.js','pages/collect.html','../escape'])assert.throws(()=>u.validateManifest({...manifest(),files:[{...manifest().files[0],path:p}]}));
});
test('verified download then apply and rollback preserve unrelated files; retry is idempotent',async t=>{
 const f=fixture(t),m=manifest(),p=m.files[0].path;put(f.target,p,'old');put(f.target,'server/data.json','private-account');put(f.target,'server/lib/vision.js','user-edit');
 const baseline=[{path:p,after:u.hash(Buffer.from('old'))}];u.verifyBaseline(f.target,m,baseline);
 let calls=0;await u.download(f.source,m,async(url,options)=>{calls++;assert.equal(url,'https://raw.githubusercontent.com/karentan30/fortunai/'+m.release+'/'+p);assert.equal(options.redirect,'error');return new Response('new');});
 assert.equal(calls,1);assert.equal(fs.readFileSync(path.join(f.target,p),'utf8'),'old');assert.equal(u.plan(f.source,f.target,m).length,1);
 const result=u.apply(f.source,f.target,f.backups,m);assert.equal(result.changed,1);u.verifyBaseline(f.target,m,baseline);assert.equal(u.apply(f.source,f.target,f.backups,m).changed,0);
 assert.equal(fs.readFileSync(path.join(f.target,'server/data.json'),'utf8'),'private-account');assert.equal(fs.readFileSync(path.join(f.target,'server/lib/vision.js'),'utf8'),'user-edit');
 u.rollback(result.backup,f.target);assert.equal(fs.readFileSync(path.join(f.target,p),'utf8'),'old');
});
test('download checksum, missing file, size overflow and redirects fail without production writes',async t=>{
 const f=fixture(t),m=manifest();put(f.target,m.files[0].path,'old');
 for(const response of [new Response('bad'),new Response('oversized'),new Response('',{status:404})])await assert.rejects(u.download(f.source,m,async()=>response));
 await assert.rejects(u.download(f.source,m,async()=>{throw Error('redirect refused');}));
 assert.equal(fs.existsSync(path.join(f.source,m.files[0].path)),false);assert.equal(fs.readFileSync(path.join(f.target,m.files[0].path),'utf8'),'old');
});
test('baseline and fresh local changes block update and rollback',async t=>{
 const f=fixture(t),m=manifest(),p=m.files[0].path;put(f.target,p,'local edit');put(f.source,p,'new');
 assert.throws(()=>u.verifyBaseline(f.target,m,[{path:p,after:u.hash(Buffer.from('old'))}]),/baseline differs/);
 assert.throws(()=>u.apply(f.source,f.target,f.backups,m),/refusing overwrite/);
 put(f.target,p,'old');const r=u.apply(f.source,f.target,f.backups,m);put(f.target,p,'new local edit');assert.throws(()=>u.rollback(r.backup,f.target),/New changes detected/);
});
test('download destination symlink is rejected before any request',async t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.source,'assets'));fs.symlinkSync(f.target,path.join(f.source,'assets/js'),'junction');let called=false;
 await assert.rejects(u.download(f.source,manifest(),async()=>{called=true;return new Response('new');}),/Symlink refused/);assert.equal(called,false);
});
