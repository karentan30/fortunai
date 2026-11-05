'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {getFriendsConfig}=require('./friends-config');
const base=()=>({FRIENDS_ENABLED:'true',FRIENDS_DATA_KEY:crypto.randomBytes(32).toString('hex'),FRIENDS_SIGNING_KEY:crypto.randomBytes(32).toString('hex'),ADMIN_TOKEN:crypto.randomBytes(32).toString('hex'),FRIENDS_ALLOWED_USER_IDS:'123'});
test('production release config defaults to closed beta, rejects public placeholders and shared keys',()=>{
  assert.equal(getFriendsConfig({}).enabled,false);assert.equal(getFriendsConfig(base()).ok,true);
  const env=base();env.FRIENDS_RELEASE_MODE='public';assert.equal(getFriendsConfig(env).ok,false);env.FRIENDS_DATA_KEY=env.ADMIN_TOKEN;assert.ok(getFriendsConfig(env).errors.some(x=>x.includes('分离')));
  const noIds=base();noIds.FRIENDS_ALLOWED_USER_IDS='';assert.equal(getFriendsConfig(noIds).ok,false);
});
test('real Runae auth cookie revocation persists and preserves other device session',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'runae-auth-release-'));process.env.DATA_FILE=path.join(folder,'auth.json');
  const store=require('./store'),{authMiddleware}=require('../middleware');const uid=store.insertUser.run('synthetic@example.test','not-a-real-password-hash').lastInsertRowid;
  const current=crypto.randomBytes(32).toString('hex'),other=crypto.randomBytes(32).toString('hex');store.insertToken.run(uid,current);store.insertToken.run(uid,other);
  const req={headers:{cookie:'sy_token='+current},body:{},query:{}};authMiddleware(req,{},()=>{});assert.equal(req.user.id,uid);
  assert.equal(store.deleteUserToken.run(uid,store._tokenFromReq(req)),1);authMiddleware(req,{},()=>{});assert.equal(req.user,null);assert.equal(store.getToken.get(other).user_id,uid);
  assert.equal(JSON.parse(fs.readFileSync(process.env.DATA_FILE,'utf8')).tokens.some(t=>t.token===current),false);
});
