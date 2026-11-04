'use strict';
// No secrets are printed or accepted as CLI arguments. Supply keys via the server environment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createSqliteFriendsStore}=require('../server/lib/friends-sqlite');
const {getFriendsConfig}=require('../server/lib/friends-config');
const {purgeAttributionMarks}=require('../server/lib/friends-admin');
const args=Object.fromEntries(process.argv.slice(3).map(x=>{const i=x.indexOf('=');return i<0?[x.replace(/^--/,''),true]:[x.slice(0,i).replace(/^--/,''),x.slice(i+1)];}));
const action=process.argv[2];
function absolute(v,label){if(typeof v!=='string'||!path.isAbsolute(v))throw Error(label+'必须是绝对路径');return path.resolve(v);}
async function main(){
  if(args.env){const file=absolute(args.env,'环境配置文件');process.loadEnvFile(file);}
  if(action==='init-keys'){
    const output=absolute(args.out,'输出文件');fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
    const body=['FRIENDS_DATA_KEY='+crypto.randomBytes(32).toString('hex'),'FRIENDS_SIGNING_KEY='+crypto.randomBytes(32).toString('hex'),'FRIENDS_ADMIN_TOKEN='+crypto.randomBytes(32).toString('hex')].join('\n')+'\n';
    fs.writeFileSync(output,body,{flag:'wx',mode:0o600});console.log('密钥已写入新私密文件（未打印）。请安全合并到生产环境；不会覆盖既有配置。');return;
  }
  if(action==='preflight'){
    const c=getFriendsConfig(process.env),errors=c.errors||[];if(!c.enabled)errors.push('交友模块尚未启用');
    if(c.enabled&&c.ok){const s=createSqliteFriendsStore(c.file,{key:process.env.FRIENDS_DATA_KEY,create:false});try{
      if(!s.health().ok)errors.push('数据库完整性检查未通过');
      if(process.env.FRIENDS_REPORTS_ENABLED==='true'){
        try{require.resolve('../server/lib/llm');}catch(_){errors.push('报告模型模块缺失，不能生成付费报告');}
      }
      if(process.env.FRIENDS_BILLING_ENABLED==='true'){
        const billing=require('../server/lib/friends-billing-config').configuredBilling(s);
        if(!billing.catalog().enabled&&!billing.reconciliationReady())errors.push('计费配置未就绪：请核验共享客户端、商户与报告交付配置');
      }
    }finally{s.close();}}
    console.log(JSON.stringify({ready:!errors.length,mode:c.mode||'disabled',errors},null,2));if(errors.length)process.exitCode=1;return;
  }
  const key=process.env.FRIENDS_DATA_KEY;
  if(action==='restore'){
    const source=absolute(args.from,'备份文件'),destination=absolute(args.to,'恢复目标');
    if(fs.existsSync(destination))throw Error('恢复目标已存在；先隔离验证，禁止覆盖运行中的数据库');
    const verify=createSqliteFriendsStore(source,{key,create:false});try{if(!verify.health().ok)throw Error('备份不完整');}finally{verify.close();}
    fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);const restored=createSqliteFriendsStore(destination,{key,create:false});try{if(!restored.health().ok)throw Error('恢复后验证失败');}finally{restored.close();}console.log('已恢复到新的隔离目标并通过完整性检查；未替换在线数据库。');return;
  }
  const file=absolute(args.db||process.env.FRIENDS_DB_FILE,'数据库');
  const store=createSqliteFriendsStore(file,{key,create:action==='init-db'||action==='migrate-json'});
  try{
    if(action==='init-db'){console.log('加密数据库已就绪。');return;}
    if(action==='maintenance'){
      const removed=store.transaction(state=>{const before=state.attributionMarks.length;purgeAttributionMarks(state);return before-state.attributionMarks.length;});
      console.log(JSON.stringify({ok:true,expiredAttributionMarksRemoved:removed}));return;
    }
    if(action==='backup'){await store.backup(absolute(args.out,'备份目标'));console.log('加密备份已完成，并通过独立恢复读取验证。');return;}
    if(action==='migrate-json'){
      const source=absolute(args.from,'旧数据文件'),old=JSON.parse(fs.readFileSync(source,'utf8'));
      const target=store.read();if(Object.values(target).some(value=>Array.isArray(value)&&value.length))throw Error('迁移目标不是空库，拒绝覆盖');
      for(const k of ['profiles','requests','reports','blocks'])if(!Array.isArray(old[k]))throw Error('旧快照格式无效');
      store.transaction(next=>{for(const k of Object.keys(next))if(Array.isArray(old[k]))next[k]=structuredClone(old[k]);});console.log('旧快照已导入加密库；源文件未删除。请验证后按留存政策处理旧明文备份。');return;
    }
    if(action==='check'){console.log(JSON.stringify(store.health()));return;}
    throw Error('操作无效：init-keys / init-db / migrate-json / check / backup / restore / preflight / maintenance');
  }finally{store.close();}
}
main().catch(e=>{console.error('交友运维操作未完成：'+e.message);process.exitCode=1;});
