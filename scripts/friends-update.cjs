'use strict';
// Delta-only update. Shared plan/apply/rollback helpers are copied without modification
// from scripts/friends-install-files.cjs at d94dbd807f598552c73b1a01f252a9e676541c34.
// No dependencies, account files, environment, PM2 or proxy settings are changed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const MANIFEST={
  "base": "e7e465d31e1aabfce68f344a7ea825e5a614fe40",
  "installed": "adf46ced8e53ec1649a158a6def3944f685bfcb0",
  "release": "d94dbd807f598552c73b1a01f252a9e676541c34",
  "files": [
    {
      "path": "assets/css/friends.css",
      "before": "7fe48cbc90ec57607e0112931818dbe77a2b4dae",
      "after": "387ac56fdbcfb1f43761de95fba14e0b71f5be53",
      "size": 34346
    },
    {
      "path": "assets/js/friends-membership.js",
      "before": "7be9e84da97032af31c55eca63018e58be7d59c5",
      "after": "465c65399090428e6f2f4d8edd4809b484ec8cca",
      "size": 23099
    },
    {
      "path": "assets/js/friends-sample-preview.js",
      "before": "fa68c8510d1a22fd56ec9e8aac4735c249345923",
      "after": "95678ebcd8bed98fa3098a692afdcfca50952e8d",
      "size": 4528
    },
    {
      "path": "assets/js/friends.js",
      "before": "ad9646174fd146dce313cfc3b84b409da13a7fab",
      "after": "f9dafe5f2d74f9cf9a9c55f41fa89da798bd1d6b",
      "size": 109155
    },
    {
      "path": "pages/friends-connect.html",
      "before": "afe3418035b8fa958a91232d0f522c0c15bead50",
      "after": "a00d031a18e7322a8abbd0fdbf2e9f6141232c94",
      "size": 4356
    },
    {
      "path": "pages/friends-design-review.html",
      "before": null,
      "after": "f0ae704d09a344dd5a878f61c610eea4c8e0e20e",
      "size": 13439
    },
    {
      "path": "pages/friends-membership.html",
      "before": "05280d3e3b2081779131d01862f651e81eefdd94",
      "after": "632a4c84d12468ee268c91967e78d59a428cd95b",
      "size": 6660
    },
    {
      "path": "pages/friends-report-sample.html",
      "before": null,
      "after": "e00dbc67bd5837f1d095e475a72cd57258745a4c",
      "size": 11470
    },
    {
      "path": "server/lib/friends-billing-config.js",
      "before": "b0813bd2aa3b5dcfd11518ea1ec7acad1936a542",
      "after": "d5216e18dba3b245e8ab5bfd49d2af9b956770ce",
      "size": 1203
    },
    {
      "path": "server/lib/friends-billing.js",
      "before": "6663c1a5be85ce1468826237932dc9f464eef813",
      "after": "66cc69a3aa83cd44504b5dae1b0124a16ad143e6",
      "size": 17089
    },
    {
      "path": "server/lib/friends-membership.js",
      "before": null,
      "after": "f1451eaadecd7efc7f0cbf69108ec1a5bbb0f2c3",
      "size": 1882
    },
    {
      "path": "server/lib/friends-quotas.js",
      "before": null,
      "after": "32129b51ec298473d2c0afb401b894ddca08d05a",
      "size": 2349
    },
    {
      "path": "server/lib/friends-service.js",
      "before": "24f64f4c84e764e4785dfec8584f9d0203b1993f",
      "after": "e36314fbeccf82858a5e2c3a4b77317fd6d2907c",
      "size": 12352
    },
    {
      "path": "server/routes/friends.js",
      "before": "ebac0e09c93d2d0cdeb62086a8c41f42902b1422",
      "after": "fbfdb3a2fa5352974619e4916378c64702d6aeea",
      "size": 10191
    }
  ]
};
const BASELINE=[
  {
    "path": "assets/css/friends-admin.css",
    "after": "c4ca6da2f1d86cc004dae02295340bf4398c13b3"
  },
  {
    "path": "assets/css/friends-compatibility.css",
    "after": "4500f18b4e62bfab03112cd207c60ce44b36dda7"
  },
  {
    "path": "assets/css/friends-marketing.css",
    "after": "d4ae07e285d6d2cc35976fa41fdb0680c288b277"
  },
  {
    "path": "assets/css/friends-membership.css",
    "after": "79554491cc832cf99322bd293c340dd6e0738602"
  },
  {
    "path": "assets/css/friends-personal-reports.css",
    "after": "e1174fbd34da6c6b731a964e503fe4850b3d33d7"
  },
  {
    "path": "assets/css/friends-questions.css",
    "after": "c5babf64d1cb184b75844b6ed2a13ab4967bb42b"
  },
  {
    "path": "assets/css/friends.css",
    "after": "7fe48cbc90ec57607e0112931818dbe77a2b4dae"
  },
  {
    "path": "assets/data/friends-marketing.json",
    "after": "deb91f565cde4f2eb4cb276b8ea5e59e53fa8e3a"
  },
  {
    "path": "assets/data/friends-profile-samples.json",
    "after": "726e8a88ed69f67598ef3fcb026fd78b108b1ab0"
  },
  {
    "path": "assets/data/friends-relationship-questions.json",
    "after": "e558f9de656c7c2b651f08593459da0ddd80415b"
  },
  {
    "path": "assets/images/friends-ai/generation-manifest.json",
    "after": "812f2a3830c1a6b66c6ba4da15b685cd1c021361"
  },
  {
    "path": "assets/images/friends-ai/man-professional.png",
    "after": "2547cd6669d9ce7f2ecd2ebc5d18833b319572fb"
  },
  {
    "path": "assets/images/friends-ai/man-sport.png",
    "after": "5464bd617016e69699f1db7b69eb05e3414184ca"
  },
  {
    "path": "assets/images/friends-ai/woman-natural.png",
    "after": "e389912fa247426d9f70f9c354df061b9f4e22d9"
  },
  {
    "path": "assets/images/friends-ai/woman-professional.png",
    "after": "8b6e75c8e76869146f9e5f2cc0f0b36318842c35"
  },
  {
    "path": "assets/js/friends-admin.js",
    "after": "698baf0ab086b796078c54c72c0bef4ce2c6bcd8"
  },
  {
    "path": "assets/js/friends-compatibility.js",
    "after": "33c1af91f768c67edd11399e89758edaea1da21c"
  },
  {
    "path": "assets/js/friends-intake.js",
    "after": "dc6d2ffeee5b75f22d64fefb2b92cd139e40adfc"
  },
  {
    "path": "assets/js/friends-marketing.js",
    "after": "63c111180d72deae7be8d39281c5086867dcea9b"
  },
  {
    "path": "assets/js/friends-membership.js",
    "after": "7be9e84da97032af31c55eca63018e58be7d59c5"
  },
  {
    "path": "assets/js/friends-personal-reports.js",
    "after": "97deba42d17dead331c1b7ac493ef7e685513070"
  },
  {
    "path": "assets/js/friends-questions.js",
    "after": "fa8608b3d656b284a4dca4ada409ba1591763875"
  },
  {
    "path": "assets/js/friends-sample-preview.js",
    "after": "fa68c8510d1a22fd56ec9e8aac4735c249345923"
  },
  {
    "path": "assets/js/friends.js",
    "after": "ad9646174fd146dce313cfc3b84b409da13a7fab"
  },
  {
    "path": "assets/js/vendor/qrcode.LICENSE",
    "after": "16efdcbacbf57c08a33f65b064ab7ffd1198a37f"
  },
  {
    "path": "assets/js/vendor/qrcode.js",
    "after": "76889b589ec831dd9b791601f6592793356ce9cd"
  },
  {
    "path": "pages/friends-admin.html",
    "after": "6317b25f7381fc34ff4173cb42b8b5b42119f09b"
  },
  {
    "path": "pages/friends-compatibility.html",
    "after": "9362015236e7eba902a2b2955349afb0653285f3"
  },
  {
    "path": "pages/friends-connect.html",
    "after": "afe3418035b8fa958a91232d0f522c0c15bead50"
  },
  {
    "path": "pages/friends-help.html",
    "after": "ffa3b19977313a529e9532776adbac4dd246be94"
  },
  {
    "path": "pages/friends-intake.html",
    "after": "2b203854097ff2d83580099c30ddcda8a479d8c4"
  },
  {
    "path": "pages/friends-marketing.html",
    "after": "5fcf9c35f3dcd3b46e0933d8bf9cb1708b8cc23e"
  },
  {
    "path": "pages/friends-membership.html",
    "after": "05280d3e3b2081779131d01862f651e81eefdd94"
  },
  {
    "path": "pages/friends-personal-reports.html",
    "after": "f0ccc77821004365f6934f83d5b0e065f880bd1a"
  },
  {
    "path": "pages/friends-privacy.html",
    "after": "dd974613f570db55d4b0e0c4cd56e79a75c980f0"
  },
  {
    "path": "pages/friends-profile-library.html",
    "after": "07c7ebcdbae2b2f8496bd6a9107c08034e7f5935"
  },
  {
    "path": "pages/friends-questions.html",
    "after": "0412f54662f069676cf94c451c04d51511d3cfa6"
  },
  {
    "path": "pages/friends-terms.html",
    "after": "b747b54bbe717163d880fc64398326a7fbe522da"
  },
  {
    "path": "server/data/friends-beijing-places.json",
    "after": "ccd8440a914f0e810c97de09ddb824bf1f405b03"
  },
  {
    "path": "server/index.js",
    "after": "01be160e493ee108e601875607c63d39656e038a"
  },
  {
    "path": "server/lib/bazi-full-report.js",
    "after": "d31b0de22abfe4c1d423f279b574c5968f7d45e3"
  },
  {
    "path": "server/lib/friends-admin.js",
    "after": "b0ef025464a076c335475687e69469ae691bf094"
  },
  {
    "path": "server/lib/friends-billing-config.js",
    "after": "b0813bd2aa3b5dcfd11518ea1ec7acad1936a542"
  },
  {
    "path": "server/lib/friends-billing.js",
    "after": "6663c1a5be85ce1468826237932dc9f464eef813"
  },
  {
    "path": "server/lib/friends-chart.js",
    "after": "c3577535c5b90402bb3395515785922776dc9395"
  },
  {
    "path": "server/lib/friends-compatibility.js",
    "after": "047dccbe08e376c9d2dde65faf78785dc67801d3"
  },
  {
    "path": "server/lib/friends-config.js",
    "after": "564a43e25c17d8351ad03ee05d745becb65734c7"
  },
  {
    "path": "server/lib/friends-delivery-recovery.js",
    "after": "6dd16e3214e2a384a21f365fb34e42d4d1498e26"
  },
  {
    "path": "server/lib/friends-intake.js",
    "after": "59e4dd486c6a81948c6d53bd403b1265647fe354"
  },
  {
    "path": "server/lib/friends-location.js",
    "after": "ef0200bfee6411f533892edaea7ad0c8bb0d2f45"
  },
  {
    "path": "server/lib/friends-places.js",
    "after": "54030a4484e242206bd1e905ab0d10a55e804946"
  },
  {
    "path": "server/lib/friends-preferences.js",
    "after": "71a53079f1ac50f90f40dfaa589e4ef0ddd382a9"
  },
  {
    "path": "server/lib/friends-questions.js",
    "after": "7889a61df016928cca763d71dae739951eb68676"
  },
  {
    "path": "server/lib/friends-report-adapter.js",
    "after": "7a9e1109ae043888f86252eea14e29a0f09470f2"
  },
  {
    "path": "server/lib/friends-reports.js",
    "after": "6c3d977f6eadb8595791749f36f655b83cc36a92"
  },
  {
    "path": "server/lib/friends-service.js",
    "after": "24f64f4c84e764e4785dfec8584f9d0203b1993f"
  },
  {
    "path": "server/lib/friends-sqlite.js",
    "after": "9bc692eb8edbd7c08044ff374b977908d284c994"
  },
  {
    "path": "server/lib/friends-store.js",
    "after": "932c9ef5247b85f03037111a4e6e47f460588d17"
  },
  {
    "path": "server/lib/store.js",
    "after": "6545c2612408de1a05c6347196f0233102537ede"
  },
  {
    "path": "server/lib/vendor/tz-lookup.LICENSE",
    "after": "3bbbc1ee92562e6a2eebfc6a366f4309d06c7d54"
  },
  {
    "path": "server/lib/vendor/tz-lookup.js",
    "after": "385ac7e9f8936191f0296792e3d3ffe4d1416b6d"
  },
  {
    "path": "server/routes/divination.js",
    "after": "9edb868b5da1169735f07b2d9430f73a123145cb"
  },
  {
    "path": "server/routes/friends-billing.js",
    "after": "35be84765ab47cd1827e6bc917d7577d3a8514f6"
  },
  {
    "path": "server/routes/friends-compatibility.js",
    "after": "24bdbfc1239fec758fcd82ac5e758aecf55a37f9"
  },
  {
    "path": "server/routes/friends-intake.js",
    "after": "4fc6d6862dd263a892115bbd5d5ea1ba9268eb3b"
  },
  {
    "path": "server/routes/friends-personal-reports.js",
    "after": "a80cacba604345c5f8a8b02cdf913afec54fc6e8"
  },
  {
    "path": "server/routes/friends-questions.js",
    "after": "0917ae9030049e48964a9d2e4c3519ffba86dac1"
  },
  {
    "path": "server/routes/friends-reports.js",
    "after": "9b4c3f92d8fb49c51cfee08736a774a7bd8fcdb9"
  },
  {
    "path": "server/routes/friends.js",
    "after": "ebac0e09c93d2d0cdeb62086a8c41f42902b1422"
  }
];
function hash(data){return crypto.createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');}
function safe(root,relative){
  if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.split('/').some(x=>!x||x==='.'||x==='..')||path.isAbsolute(relative))throw Error('Unsafe relative path');
  const resolved=path.resolve(root);
  if(fs.realpathSync(resolved)!==resolved)throw Error('Root must not be a symlink');
  let cursor=resolved;
  for(const part of relative.split('/')){cursor=path.join(cursor,part);if(fs.existsSync(cursor)||isLink(cursor)){if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Symlink refused: '+relative);}}
  return cursor;
}
function isLink(file){try{return fs.lstatSync(file).isSymbolicLink();}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function current(file){if(!fs.existsSync(file))return null;if(!fs.statSync(file).isFile())throw Error('Expected regular file');return hash(fs.readFileSync(file));}
function plan(source,target,manifest=MANIFEST){
  const paths=new Set();
  return manifest.files.map(entry=>{
    if(paths.has(entry.path))throw Error('Duplicate manifest path');paths.add(entry.path);
    const from=safe(source,entry.path),to=safe(target,entry.path);
    if(current(from)!==entry.after)throw Error('Release file checksum mismatch: '+entry.path);
    const found=current(to);
    if(found!==entry.before&&found!==entry.after)throw Error('Existing file differs; refusing overwrite: '+entry.path);
    return {...entry,from,to,skip:found===entry.after};
  });
}
function atomic(file,bytes,mode=0o600){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=file+'.runae-'+crypto.randomUUID();
  try{fs.writeFileSync(temp,bytes,{flag:'wx',mode});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function rollback(backup,target){
  if(fs.realpathSync(backup)!==path.resolve(backup))throw Error('Backup symlink refused');
  const meta=JSON.parse(fs.readFileSync(safe(backup,'manifest.json'),'utf8'));
  if(meta.version!==1||meta.target!==fs.realpathSync(target))throw Error('Backup target mismatch');
  const entries=meta.files.map(entry=>{
    const to=safe(target,entry.path),found=current(to);
    if(found!==entry.before&&found!==entry.after)throw Error('New changes detected; rollback refused: '+entry.path);
    const original=entry.before===null?null:safe(backup,'original/'+entry.path);
    if(original&&current(original)!==entry.before)throw Error('Backup checksum mismatch: '+entry.path);
    return {...entry,to,original,found};
  });
  for(const entry of entries.reverse()){
    if(entry.found===entry.before)continue;
    if(entry.original)atomic(entry.to,fs.readFileSync(entry.original),entry.mode);
    else fs.unlinkSync(entry.to);
  }
  return entries.length;
}
function apply(source,target,backupParent,manifest=MANIFEST){
  const entries=plan(source,target,manifest).filter(x=>!x.skip);
  if(!entries.length)return {changed:0,backup:null};
  const backup=fs.mkdtempSync(path.join(backupParent,'runae-files-'));fs.chmodSync(backup,0o700);
  const records=entries.map(entry=>{
    const mode=entry.before===null?0o600:fs.statSync(entry.to).mode&0o777;
    if(entry.before!==null)atomic(safe(backup,'original/'+entry.path),fs.readFileSync(entry.to),mode);
    return {path:entry.path,before:entry.before,after:entry.after,mode};
  });
  atomic(safe(backup,'manifest.json'),Buffer.from(JSON.stringify({version:1,target:fs.realpathSync(target),release:manifest.release,files:records},null,2)));
  try{
    for(const entry of records){
      const to=safe(target,entry.path);
      if(current(to)!==entry.before)throw Error('Target changed during installation: '+entry.path);
      const bytes=fs.readFileSync(safe(source,entry.path));
      if(hash(bytes)!==entry.after)throw Error('Source changed during installation: '+entry.path);
      atomic(to,bytes,entry.mode);
    }
    return {changed:records.length,backup};
  }catch(error){
    try{rollback(backup,target);}catch(restoreError){throw Error(error.message+'; automatic rollback incomplete: '+restoreError.message+'; backup='+backup);}
    throw Error(error.message+'; files restored; backup='+backup);
  }
}
function pm2Guard(){
  const jobs=JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']}));
  const app=jobs.find(x=>x.name==='shenyuan'&&x.pm2_env?.pm_exec_path==='/opt/shenyuan/server/index.js');
  if(!app||app.pm2_env.status!=='online')throw Error('Expected original shenyuan process online');
  if(app.pm2_env.watch)throw Error('PM2 watch enabled; file update could trigger unplanned restart');
  if(app.pm2_env.exec_mode!=='fork_mode'||jobs.filter(x=>x.pm2_env?.pm_exec_path==='/opt/shenyuan/server/index.js').length!==1)throw Error('Expected one original writer in fork mode');
}

function validateManifest(manifest){
 if(!/^[a-f0-9]{40}$/.test(manifest.release))throw Error('Invalid pinned release');
 const paths=new Set();
 for(const entry of manifest.files){
  if(!/^(assets\/(js|css)\/friends[^/]*\.(js|css)|pages\/friends[^/]*\.html|server\/(lib|routes)\/friends[^/]*\.js)$/.test(entry.path)||entry.path.includes('..')||entry.path.includes('\\'))throw Error('Non-feature path refused');
  if(paths.has(entry.path))throw Error('Duplicate manifest path');paths.add(entry.path);
  if(!/^[a-f0-9]{40}$/.test(entry.after)||(entry.before!==null&&!/^[a-f0-9]{40}$/.test(entry.before))||!Number.isInteger(entry.size)||entry.size<0||entry.size>2*1024*1024)throw Error('Invalid manifest checksum or size');
 }
}
function verifyBaseline(target,manifest=MANIFEST,baseline=BASELINE){
 validateManifest(manifest);
 const changed=new Map(manifest.files.map(e=>[e.path,e.after]));
 for(const entry of baseline){
  const found=current(safe(target,entry.path));
  if(found!==entry.after&&found!==changed.get(entry.path))throw Error('Installed baseline differs: '+entry.path);
 }
}
async function download(source,manifest=MANIFEST,fetcher=fetch){
 validateManifest(manifest);
 for(const entry of manifest.files){
  const destination=safe(source,entry.path);
  const url='https://raw.githubusercontent.com/karentan30/fortunai/'+manifest.release+'/'+entry.path;
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Download failed: '+entry.path+' HTTP '+response.status);
  const declared=response.headers.get('content-length');
  if(declared!==null&&Number(declared)>2*1024*1024)throw Error('Download size limit exceeded');
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>entry.size||total>2*1024*1024)throw Error('Download size differs: '+entry.path);chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  const bytes=Buffer.concat(chunks);
  if(bytes.length!==entry.size||hash(bytes)!==entry.after)throw Error('Download checksum mismatch: '+entry.path);
  atomic(destination,bytes);
 }
 return manifest.files.length;
}
async function main(){
 const command=process.argv[2]||'check',target='/opt/shenyuan',parent='/opt/runae-friends';
 if(!['check','apply','rollback'].includes(command))throw Error('Use check, apply, or rollback BACKUP_DIRECTORY');
 if(process.getuid?.()!==0)throw Error('Use root Workbench');
 process.umask(0o077);
 const base=cp.execFileSync('git',['-C',target,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(base!==MANIFEST.base)throw Error('Original repository revision changed');
 pm2Guard();
 if(command==='rollback'){
  const backup=process.argv[3];
  if(!backup||!/^\/root\/runae-files-[A-Za-z0-9]+$/.test(backup))throw Error('Expected /root/runae-files-... backup');
  console.log('RESTORED_FILES='+rollback(backup,target));
  console.log('FILES_ONLY: runtime rollback must be coordinated separately.');return;
 }
 verifyBaseline(target);
 if(fs.realpathSync(parent)!==parent)throw Error('Staging root symlink refused');
 const source=fs.mkdtempSync(path.join(parent,'update-'));fs.chmodSync(source,0o700);
 await download(source);
 const entries=plan(source,target);
 console.log('RELEASE='+MANIFEST.release);
 console.log('DELTA_BYTES='+MANIFEST.files.reduce((sum,e)=>sum+e.size,0));
 console.log('STAGING_DIRECTORY='+source);
 console.log('CHECKED_FILES='+entries.length);
 console.log('PENDING_FILES='+entries.filter(e=>!e.skip).length);
 if(command==='apply'){
  verifyBaseline(target);pm2Guard();
  const result=apply(source,target,'/root');
  console.log('CHANGED_FILES='+result.changed);console.log('FILE_BACKUP='+result.backup);
 }
 console.log(command==='check'?'CHECK_ONLY: production unchanged.':'FILES_ONLY: no restart, environment/account/payment changes. Activation is separate.');
}
if(require.main===module)main().catch(error=>{console.error('STOP: '+error.message);process.exitCode=1;});
module.exports={MANIFEST,BASELINE,hash,plan,apply,rollback,validateManifest,verifyBaseline,download};
