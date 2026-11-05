'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {hash,plan,apply,rollback}=require('./friends-install-files.cjs');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'runae-install-test-'));
  const source=path.join(root,'source'),target=path.join(root,'target'),backups=path.join(root,'backups');
  for(const dir of [source,target,backups])fs.mkdirSync(dir);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  function put(dir,file,value){const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);}
  put(source,'server/index.js','new index');put(target,'server/index.js','old index');
  put(source,'pages/friends-connect.html','new page');put(target,'server/lib/vision.js','local vision edits');
  put(target,'server/data.json','private account data');
  const manifest={release:'test',files:[{path:'server/index.js',before:hash(Buffer.from('old index')),after:hash(Buffer.from('new index'))},{path:'pages/friends-connect.html',before:null,after:hash(Buffer.from('new page'))}]};
  return {source,target,backups,manifest,put};
}
test('dry run is read-only, selective install preserves local changes and data, repeat is idempotent, rollback restores originals',t=>{
  const f=fixture(t);assert.equal(plan(f.source,f.target,f.manifest).length,2);
  assert.equal(fs.readFileSync(path.join(f.target,'server/index.js'),'utf8'),'old index');
  const installed=apply(f.source,f.target,f.backups,f.manifest);assert.equal(installed.changed,2);
  assert.equal(fs.readFileSync(path.join(f.target,'server/lib/vision.js'),'utf8'),'local vision edits');
  assert.equal(fs.readFileSync(path.join(f.target,'server/data.json'),'utf8'),'private account data');
  assert.equal(apply(f.source,f.target,f.backups,f.manifest).changed,0);
  rollback(installed.backup,f.target);
  assert.equal(fs.readFileSync(path.join(f.target,'server/index.js'),'utf8'),'old index');
  assert.equal(fs.existsSync(path.join(f.target,'pages/friends-connect.html')),false);
  assert.equal(fs.readFileSync(path.join(f.target,'server/lib/vision.js'),'utf8'),'local vision edits');
});
test('changed production files stop installation before any write',t=>{
  const f=fixture(t);f.put(f.target,'server/index.js','custom live edits');
  assert.throws(()=>apply(f.source,f.target,f.backups,f.manifest),/refusing overwrite/);
  assert.equal(fs.existsSync(path.join(f.target,'pages/friends-connect.html')),false);
  assert.deepEqual(fs.readdirSync(f.backups),[]);
});
test('changed release bytes and new-file collisions stop installation',t=>{
  const f=fixture(t);f.put(f.source,'server/index.js','unexpected source');
  assert.throws(()=>plan(f.source,f.target,f.manifest),/checksum mismatch/);
  f.put(f.source,'server/index.js','new index');f.put(f.target,'pages/friends-connect.html','existing unpublished work');
  assert.throws(()=>plan(f.source,f.target,f.manifest),/refusing overwrite/);
});
test('rollback refuses fresh edits rather than erasing them',t=>{
  const f=fixture(t);const installed=apply(f.source,f.target,f.backups,f.manifest);
  f.put(f.target,'pages/friends-connect.html','new work after installation');
  assert.throws(()=>rollback(installed.backup,f.target),/New changes/);
  assert.equal(fs.readFileSync(path.join(f.target,'server/index.js'),'utf8'),'new index');
});
test('traversal and symlink destinations are rejected', {skip:process.platform==='win32'},t=>{
  const f=fixture(t);
  assert.throws(()=>plan(f.source,f.target,{files:[{path:'../outside',before:null,after:'bad'}]}),/Unsafe/);
  fs.mkdirSync(path.join(f.target,'pages'));
  fs.symlinkSync(path.join(f.source,'pages/friends-connect.html'),path.join(f.target,'pages/friends-connect.html'));
  assert.throws(()=>plan(f.source,f.target,f.manifest),/Symlink/);
});
