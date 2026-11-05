'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const u=require('./friends-update-loop.cjs');
test('integrated manifest covers both verified installed baselines and only friends files',()=>{
 for(const c of [{manifest:u.MANIFEST,baseline:u.BASELINE},u.ALTERNATE]){
 u.validateManifest(c.manifest);assert.equal(c.manifest.files.length,12);
 for(const e of c.manifest.files)assert.equal(e.before,c.baseline.find(b=>b.path===e.path)?.after??null);
 }
 assert.equal(u.MANIFEST.installed,'d94dbd807f598552c73b1a01f252a9e676541c34');
 assert.equal(u.ALTERNATE.manifest.installed,'daf2aae4716cd0d933676d213ffe96f3a5237b93');
 assert.ok(u.MANIFEST.files.reduce((n,f)=>n+f.size,0)<300000);
});
test('selects known base or intermediate version; latest idempotent; refuses local edits',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'friends-loop-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file='assets/js/friends.js';fs.mkdirSync(path.join(root,'assets/js'),{recursive:true});
 const make=value=>({manifest:{release:'a'.repeat(40),files:[{path:file,before:u.hash(Buffer.from(value)),after:u.hash(Buffer.from('new')),size:3}]},baseline:[{path:file,after:u.hash(Buffer.from(value))}]});
 const candidates=[make('base'),make('intermediate')];
 for(const [value,index] of [['base',0],['intermediate',1],['new',0]]){fs.writeFileSync(path.join(root,file),value);assert.equal(u.selectInstalled(root,candidates),candidates[index]);}
 fs.writeFileSync(path.join(root,file),'local-edit');assert.throws(()=>u.selectInstalled(root,candidates),/refusing automatic update/);
});
test('atomic update and checksum guards unchanged from reviewed updater',()=>{
 const old=require('./friends-update.cjs');for(const name of ['hash','plan','apply','rollback','download','verifyBaseline','validateManifest'])assert.equal(u[name].toString(),old[name].toString());
});
