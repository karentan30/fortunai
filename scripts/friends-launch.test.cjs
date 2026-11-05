'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {originalJob,parseAccounts,accountId,betaSettings,appendSettings,guardDatabase,procEnvironment,prepareDatabase,stopWriter,retryHealth}=require('./friends-launch.cjs');
const job=(status='online',pid=123)=>({name:'shenyuan',pid,pm2_env:{pm_exec_path:'/opt/shenyuan/server/index.js',pm_cwd:'/opt/shenyuan/server',status,watch:false,exec_mode:'fork_mode'}});
test('writer guard rejects duplicate writer watch cluster wrong cwd and status',()=>{
 assert.equal(originalJob([job()]).pid,123);
 for(const list of [[job(),job()],[{...job(),name:'other'}],[job('errored')],[{...job(),pm2_env:{...job().pm2_env,watch:true}}],[{...job(),pm2_env:{...job().pm2_env,exec_mode:'cluster_mode'}}],[{...job(),pm2_env:{...job().pm2_env,pm_cwd:'/tmp'}}]])assert.throws(()=>originalJob(list));
});
test('database recovery keys are persisted before database creation and retained when backup fails',async()=>{
 const calls=[],settings={FRIENDS_DATA_KEY:'secret'};
 await assert.rejects(prepareDatabase({settings,persistKeys:v=>{assert.equal(v,settings);calls.push('keys');},open:()=>{calls.push('open');return {health:()=>({ok:true}),backup:async()=>{calls.push('backup');throw Error('disk full');},close:()=>calls.push('close')};},destination:'/unused'}),/disk full/);
 assert.deepEqual(calls,['keys','open','backup','close']);
 let opened=false;
 await assert.rejects(prepareDatabase({settings,persistKeys:()=>{throw Error('cannot save key');},open:()=>{opened=true;}}),/cannot save key/);
 assert.equal(opened,false);
});
test('stop timeout after successful stop can recover but live original pid prevents snapshot',()=>{
 let state=job();
 stopWriter({list:()=>[state],run:()=>{state=job('stopped',0);throw Error('timeout');},alive:()=>false});
 state=job();
 assert.throws(()=>stopWriter({list:()=>[state],run:()=>{state=job('stopped',0);},alive:()=>true}),/Previous writer still exists/);
 state=job();
 assert.throws(()=>stopWriter({list:()=>[state],run:()=>{throw Error('timeout');},alive:()=>true}));
});
test('private database guard rejects both live and dangling symlinks including WAL',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'friends-launch-')),file=path.join(dir,'friends.sqlite');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(file,'fixture');guardDatabase(file);
 fs.mkdirSync(file+'-wal');assert.throws(()=>guardDatabase(file));fs.rmdirSync(file+'-wal');
 if(process.platform==='win32')return;
 fs.symlinkSync(path.join(dir,'missing'),file+'-wal');assert.throws(()=>guardDatabase(file));fs.unlinkSync(file+'-wal');
 fs.writeFileSync(path.join(dir,'other'),'fixture');fs.unlinkSync(file);fs.symlinkSync(path.join(dir,'other'),file);assert.throws(()=>guardDatabase(file));
});
test('real startup environment parsing preserves equals and does not import caller variables',()=>{
 assert.deepEqual(procEnvironment('DATA_FILE=/private/accounts.json\0TOKEN=a=b=c\0PORT=3021\0'),{DATA_FILE:'/private/accounts.json',TOKEN:'a=b=c',PORT:'3021'});
 assert.equal(procEnvironment('PORT=3021\0').FRIENDS_ENABLED,undefined);
});
test('test account must exist uniquely with valid id, malformed snapshots fail closed',()=>{
 const data=parseAccounts(JSON.stringify({users:[{id:7,email:'test@example.com'}],tokens:[],orders:[]}));
 assert.equal(accountId(data,' TEST@example.com '),'7');
 assert.throws(()=>accountId(data,'missing@example.com'));assert.throws(()=>accountId({...data,users:[...data.users,...data.users]},'test@example.com'));
 assert.throws(()=>accountId({...data,users:[{email:'test@example.com'}]},'test@example.com'));
 assert.throws(()=>parseAccounts('{"users":[]}'));
});
test('beta preserves established keys and disables paid/public release configuration',()=>{
 const env={FRIENDS_DATA_KEY:'a'.repeat(64),FRIENDS_SIGNING_KEY:'b'.repeat(64),FRIENDS_ADMIN_TOKEN:'c'.repeat(64),FRIENDS_ALLOWED_USER_IDS:'7',FRIENDS_BILLING_ENABLED:'true'};
 const settings=betaSettings(env,'8');
 assert.equal(settings.FRIENDS_DATA_KEY,env.FRIENDS_DATA_KEY);assert.equal(settings.FRIENDS_SIGNING_KEY,env.FRIENDS_SIGNING_KEY);assert.equal(settings.FRIENDS_ALLOWED_USER_IDS,'7,8');
 assert.equal(settings.FRIENDS_RELEASE_MODE,'closed_beta');assert.equal(settings.FRIENDS_BILLING_ENABLED,'false');assert.equal(settings.FRIENDS_REPORTS_ENABLED,'false');assert.equal(settings.FRIENDS_PILOT_CATALOG_ENABLED,'false');
 const appended=appendSettings('OTHER=value\n',settings);assert.ok(appended.startsWith('OTHER=value\n'));assert.ok(appended.includes('FRIENDS_ENABLED="true"'));
 const fresh=betaSettings({},'7');assert.match(fresh.FRIENDS_DATA_KEY,/^[0-9a-f]{64}$/);assert.notEqual(fresh.FRIENDS_DATA_KEY,fresh.FRIENDS_SIGNING_KEY);
});
test('rollback health waits for startup and has bounded failures',async()=>{
 let calls=0,pauses=0;
 await retryHealth(async()=>{calls++;if(calls===1)throw Error('not listening');return calls===3;},{attempts:4,pause:async()=>{pauses++;}});
 assert.equal(calls,3);assert.equal(pauses,2);
 await assert.rejects(retryHealth(async()=>false,{attempts:2,pause:async()=>{}}),/did not recover/);
});
