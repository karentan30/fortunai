'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const u=require('./friends-update-chat.cjs'),root=path.resolve(__dirname,'..');
test('chat release manifest verifies actual runtime files and excludes private/unrelated files',()=>{
 u.validateManifest(u.MANIFEST);assert.equal(u.MANIFEST.installed,'d94dbd807f598552c73b1a01f252a9e676541c34');
 assert.equal(u.MANIFEST.files.length,9);
 assert.ok(u.MANIFEST.files.reduce((n,f)=>n+f.size,0)<120000);
 for(const e of u.MANIFEST.files){const bytes=fs.readFileSync(path.join(root,e.path));assert.equal(bytes.length,e.size,e.path);assert.equal(u.hash(bytes),e.after,e.path);}
 for(const p of ['server/data.json','server/.env','server/lib/vision.js'])assert.ok(!u.MANIFEST.files.some(e=>e.path===p));
});
test('chat delta reuses the tested atomic update and rollback implementations unchanged',()=>{
 const previous=require('./friends-update.cjs');
 for(const name of ['hash','plan','apply','rollback','download','verifyBaseline','validateManifest'])assert.equal(u[name].toString(),previous[name].toString(),name);
});
