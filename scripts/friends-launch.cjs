'use strict';
// Explicit closed-beta activation. No public approval flags, payment keys or passwords are created.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const APP='/opt/shenyuan',NODE='/opt/runae-runtime/node-v24.11.0-linux-x64/bin/node',ENV=APP+'/server/.env',PRIVATE='/opt/runae-friends/private';
function command(args){try{return cp.execFileSync('pm2',args,{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});}catch{throw Error('PM2 command failed: '+args[0]+'; output withheld to protect environment');}}
function jobs(){return JSON.parse(command(['jlist']));}
function originalJob(list,allowed=['online']){const matches=list.filter(x=>x.pm2_env?.pm_exec_path===APP+'/server/index.js');if(matches.length!==1||matches[0].name!=='shenyuan')throw Error('Expected one original account writer');const j=matches[0];if(!allowed.includes(j.pm2_env.status)||j.pm2_env.watch||j.pm2_env.exec_mode!=='fork_mode'||j.pm2_env.pm_cwd!==APP+'/server')throw Error('Unexpected PM2 state; refusing automatic changes');return j;}
function regular(file){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||fs.realpathSync(file)!==path.resolve(file))throw Error('Expected real regular file: '+file);return file;}
function privateDirectory(dir){fs.mkdirSync(dir,{recursive:true,mode:0o700});if(fs.realpathSync(dir)!==path.resolve(dir))throw Error('Private directory symlink refused');fs.chmodSync(dir,0o700);}
function atomic(file,bytes,mode=0o600){const tmp=file+'.new-'+crypto.randomUUID();try{fs.writeFileSync(tmp,bytes,{flag:'wx',mode});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function parseAccounts(bytes){let data;try{data=JSON.parse(bytes);}catch{throw Error('Account snapshot is not valid JSON');}if(!Array.isArray(data.users)||!Array.isArray(data.tokens)||!Array.isArray(data.orders))throw Error('Account snapshot structure is not recognized');return data;}
function accountId(data,email){const normalized=String(email||'').trim().toLowerCase();if(!normalized)return null;const matches=data.users.filter(u=>String(u.email||'').trim().toLowerCase()===normalized);if(matches.length!==1)throw Error('Test email does not match one existing account; register first');return String(matches[0].id);}
function betaSettings(env,id){return {FRIENDS_ENABLED:'true',FRIENDS_RELEASE_MODE:'closed_beta',FRIENDS_ALLOWED_USER_IDS:[...new Set([...String(env.FRIENDS_ALLOWED_USER_IDS||'').split(',').filter(Boolean),id])].join(','),FRIENDS_DATA_KEY:env.FRIENDS_DATA_KEY||crypto.randomBytes(32).toString('hex'),FRIENDS_SIGNING_KEY:env.FRIENDS_SIGNING_KEY||crypto.randomBytes(32).toString('hex'),FRIENDS_ADMIN_TOKEN:env.FRIENDS_ADMIN_TOKEN||crypto.randomBytes(32).toString('hex'),FRIENDS_DB_FILE:env.FRIENDS_DB_FILE||PRIVATE+'/friends.sqlite',FRIENDS_BILLING_ENABLED:'false',FRIENDS_REPORTS_ENABLED:'false',FRIENDS_PILOT_CATALOG_ENABLED:'false',FRIENDS_PAIR_REPORT_DELIVERY_VERIFIED:'false',FRIENDS_QUOTAS_ENABLED:'false'};}
function appendSettings(original,settings){return original.replace(/\s*$/,'')+'\n\n# Runae closed beta; managed by friends-launch.cjs\n'+Object.entries(settings).map(([k,v])=>k+'='+JSON.stringify(String(v))).join('\n')+'\n';}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function localCheck(expected=true){for(let n=0;n<30;n++){try{const r=await fetch('http://127.0.0.1:3021/api/friends/status',{signal:AbortSignal.timeout(1500)});const state=await r.json();if(r.ok&&state.enabled===expected&&(!expected||state.mode==='closed_beta'))return state;}catch{}await sleep(500);}throw Error('Local friends readiness not confirmed');}
async function inspect(email){
 const job=originalJob(jobs()),dotenv=require(APP+'/server/node_modules/dotenv'),raw=fs.readFileSync(regular(ENV),'utf8'),env={...(job.pm2_env.env||{}),...dotenv.parse(raw)};
 const dataFile=path.resolve(APP+'/server',env.DATA_FILE||APP+'/server/data.json');regular(dataFile);
 const accountBytes=fs.readFileSync(dataFile),data=parseAccounts(accountBytes),id=accountId(data,email);
 const runtime=fs.realpathSync('/proc/'+job.pid+'/exe');regular(runtime);regular(NODE);
 const free=fs.statfsSync('/opt/runae-friends');if(Number(free.bavail)*Number(free.bsize)<accountBytes.length*3+256*1024*1024)throw Error('Insufficient free space for safe activation backups');
 if(env.FRIENDS_RELEASE_MODE==='public'||env.FRIENDS_BILLING_ENABLED==='true')throw Error('Existing public or paid release needs a separate migration');
 if(env.FRIENDS_DB_FILE&&path.resolve(env.FRIENDS_DB_FILE)!==PRIVATE+'/friends.sqlite')throw Error('Existing friends database location needs review');
 const code=fs.readFileSync(APP+'/server/index.js','utf8');if(!code.includes("require('./routes/friends').productionRouter()"))throw Error('Friends runtime files have not been installed');
 return {job,raw,env,dataFile,data,id,runtime};
}
async function activate(plan){
 if(!plan.id)throw Error('Provide --email=YOUR_REGISTERED_EMAIL for an existing test account');
 const settings=betaSettings(plan.env,plan.id),config=require(APP+'/server/lib/friends-config').getFriendsConfig({...plan.env,...settings});
 if(!config.ok)throw Error('Closed-beta configuration invalid: '+config.errors.join('; '));
 privateDirectory(PRIVATE);
 if(fs.existsSync(settings.FRIENDS_DB_FILE)&&!plan.env.FRIENDS_DATA_KEY)throw Error('Existing encrypted database without its original key; refusing replacement');
 const backup=fs.mkdtempSync('/root/runae-activation-');fs.chmodSync(backup,0o700);
 fs.writeFileSync(backup+'/environment.before',plan.raw,{mode:0o600});fs.writeFileSync(backup+'/pm2.before.json',JSON.stringify(plan.job),{mode:0o600});
 console.log('ACTIVATION_BACKUP='+backup);
 let stopped=false,changed=false;
 try{
   command(['stop','shenyuan']);stopped=true;originalJob(jobs(),['stopped']);
   // PM2 stop sends SIGINT; original store flushes pending account writes synchronously.
   try{process.kill(plan.job.pid,0);throw Error('Previous writer still exists');}catch(e){if(e.code!=='ESRCH')throw e;}
   const current=fs.readFileSync(regular(plan.dataFile));parseAccounts(current);fs.writeFileSync(backup+'/accounts.before.json',current,{mode:0o600});
   const {createSqliteFriendsStore}=require(APP+'/server/lib/friends-sqlite');
   const store=createSqliteFriendsStore(settings.FRIENDS_DB_FILE,{key:settings.FRIENDS_DATA_KEY});
   try{if(!store.health().ok)throw Error('Friends storage integrity failed');await store.backup(backup+'/friends.before.sqlite');}finally{store.close();}
   // Store keys separately before enabling; this backup is required to recover encrypted data.
   fs.writeFileSync(backup+'/friends-keys.json',JSON.stringify(settings),{mode:0o600});
   atomic(ENV,appendSettings(plan.raw,settings));changed=true;
   command(['restart','shenyuan','--interpreter',NODE,'--update-env']);
   const state=await localCheck(true),running=originalJob(jobs());
   if(fs.realpathSync('/proc/'+running.pid+'/exe')!==fs.realpathSync(NODE))throw Error('PM2 did not use the isolated Node24 runtime');
   const page=await fetch('http://127.0.0.1:3021/pages/friends-connect.html',{signal:AbortSignal.timeout(5000)});if(!page.ok)throw Error('Friends page missing');
   const catalog=await fetch('http://127.0.0.1:3021/api/friends/billing/catalog',{signal:AbortSignal.timeout(5000)});if(catalog.status!==401)throw Error('Invite catalog did not require login');
   command(['save']);
   console.log('LOCAL_ACTIVATION_OK=true');console.log('MODE='+state.mode);console.log('PAYMENTS=disabled');console.log('PUBLIC_LAUNCH=false');console.log('URL=https://runae.app/pages/friends-connect.html');
   console.log('Next: verify HTTPS and use the registered test account. Other accounts require explicit invitation access.');
 }catch(error){
   if(stopped){try{command(['stop','shenyuan']);if(changed)atomic(ENV,plan.raw);command(['restart','shenyuan','--interpreter',plan.runtime,'--update-env']);const response=await fetch('http://127.0.0.1:3021/',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Original homepage failed');console.error('ROLLBACK=original environment and interpreter restored; account data was not overwritten');}catch{console.error('ROLLBACK_REQUIRES_REVIEW='+backup);}}
   throw error;
 }
}
async function main(){
 if(process.getuid?.()!==0||Number(process.versions.node.split('.')[0])<24)throw Error('Run with the isolated Node24 in the existing root Workbench session');
 process.umask(0o077);const action=process.argv[2]||'check';if(!['check','activate'].includes(action))throw Error('Use check or activate, optionally --email=REGISTERED_EMAIL');
 const emailArg=process.argv.slice(3).find(x=>x.startsWith('--email='));const plan=await inspect(emailArg?.slice(8));
 console.log('ORIGINAL_WRITERS=1');console.log('TEST_ACCOUNT_FOUND='+Boolean(plan.id));console.log('LIVE_FILES_PRESENT=true');console.log('ACCOUNT_SNAPSHOT=valid');
 if(action==='check'){console.log('CHECK_ONLY=true; no files, accounts, process or environment changed');return;}
 await activate(plan);
}
if(require.main===module)main().catch(e=>{console.error('STOP: '+e.message);process.exitCode=1;});
module.exports={originalJob,parseAccounts,accountId,betaSettings,appendSettings};
