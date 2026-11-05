'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const u=require('./friends-update-types.cjs'),old=require('./friends-update-loop.cjs');
test('types delta is pinned, complete and based on all 74 installed loop files',()=>{
 u.validateManifest(u.MANIFEST);
 assert.equal(u.MANIFEST.installed,'1bae5c5f6bf8b88dd80ced6f11d47e54aab3a4b8');
 assert.equal(u.MANIFEST.release,'6372ae2ce7f772b339ce0f1af354e13990b907c7');
 assert.deepEqual(u.MANIFEST.files.map(e=>e.path),['assets/js/friends.js','pages/friends-privacy.html','server/lib/friends-preferences.js','server/lib/friends-service.js']);
 assert.equal(u.MANIFEST.files.reduce((n,e)=>n+e.size,0),156061);
 const expected=new Map(old.BASELINE.map(e=>[e.path,e.after]));for(const e of old.MANIFEST.files)expected.set(e.path,e.after);
 assert.equal(u.BASELINE.length,74);assert.equal(new Set(u.BASELINE.map(e=>e.path)).size,74);
 assert.deepEqual(new Map(u.BASELINE.map(e=>[e.path,e.after])),expected);
 for(const e of u.MANIFEST.files){assert.equal(e.before,expected.get(e.path));assert.notEqual(e.before,e.after);}
});
test('types update core file checks, atomic backup and rollback helpers remain unchanged',()=>{
 for(const name of ['hash','plan','apply','rollback','download','verifyBaseline','validateManifest'])assert.equal(u[name].toString(),old[name].toString());
});
test('types updater accepts installed or applied files but refuses unknown edits and missing unchanged dependencies',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'friends-types-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file='assets/js/friends.js',dependency='server/lib/friends-preferences.js';
 for(const p of [file,dependency])fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});
 fs.writeFileSync(path.join(root,dependency),'required');
 const manifest={release:'a'.repeat(40),files:[{path:file,before:u.hash(Buffer.from('before')),after:u.hash(Buffer.from('after')),size:5}]};
 const baseline=[{path:file,after:manifest.files[0].before},{path:dependency,after:u.hash(Buffer.from('required'))}],candidate={manifest,baseline};
 for(const value of ['before','after']){fs.writeFileSync(path.join(root,file),value);assert.equal(u.selectInstalled(root,[candidate]),candidate);}
 fs.writeFileSync(path.join(root,file),'local edit');assert.throws(()=>u.selectInstalled(root,[candidate]),/refusing automatic update/);
 fs.writeFileSync(path.join(root,file),'before');fs.unlinkSync(path.join(root,dependency));assert.throws(()=>u.selectInstalled(root,[candidate]),/refusing automatic update/);
});
