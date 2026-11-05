'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {createSqliteFriendsStore}=require('./friends-sqlite');
test('maintenance persists expiry purge without exposing identities; migration refuses billing-only target',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'friends-maintenance-')),file=path.join(dir,'state.sqlite'),key=crypto.randomBytes(32).toString('hex');
 const run=(...args)=>spawnSync(process.execPath,[path.resolve(__dirname,'../..','scripts/friends-ops.cjs'),...args,'--db='+file],{encoding:'utf8',env:{...process.env,FRIENDS_DATA_KEY:key},windowsHide:true});
 try{
  let s=createSqliteFriendsStore(file,{key});s.transaction(state=>{state.attributionMarks=[{userId:'private-expired',expiresAt:new Date(Date.now()-1000).toISOString()},{userId:'private-live',expiresAt:new Date(Date.now()+86400000).toISOString()}];state.billingOrders=[{id:'preserve-order'}];});s.close();
  const result=run('maintenance');assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{ok:true,expiredAttributionMarksRemoved:1,expiredCompatibilityAuthorizationsCleared:0});assert.ok(!result.stdout.includes('private'));
  s=createSqliteFriendsStore(file,{key,create:false});assert.deepEqual(s.read().attributionMarks.map(x=>x.userId),['private-live']);s.transaction(state=>{state.attributionMarks=[];});s.close();
  const legacy=path.join(dir,'old.json');fs.writeFileSync(legacy,JSON.stringify({version:1,profiles:[],requests:[],reports:[],blocks:[]}));const migration=run('migrate-json','--from='+legacy);assert.equal(migration.status,1);assert.match(migration.stderr,/不是空库/);
  s=createSqliteFriendsStore(file,{key,create:false});assert.deepEqual(s.read().billingOrders,[{id:'preserve-order'}]);s.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
