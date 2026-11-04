'use strict';
const path=require('node:path');
const PLACEHOLDERS=/^(test|example|change|replace|todo|your[-_ ]|待)/i;
function getFriendsConfig(env=process.env){
  const enabled=env.FRIENDS_ENABLED==='true';if(!enabled)return{enabled:false};
  const errors=[];
  if(Number(process.versions.node.split('.')[0])<24)errors.push('需要已验证的Node 24或更新运行环境');
  if(!/^[a-f0-9]{64}$/i.test(env.FRIENDS_DATA_KEY||''))errors.push('FRIENDS_DATA_KEY须为独立32字节随机密钥的hex');
  if(typeof env.FRIENDS_SIGNING_KEY!=='string'||env.FRIENDS_SIGNING_KEY.length<32||PLACEHOLDERS.test(env.FRIENDS_SIGNING_KEY))errors.push('请配置独立随机FRIENDS_SIGNING_KEY');
  const adminToken=env.FRIENDS_ADMIN_TOKEN||env.ADMIN_TOKEN;
  if(typeof adminToken!=='string'||adminToken.length<32||PLACEHOLDERS.test(adminToken))errors.push('请配置至少32字符随机管理凭证');
  if(env.FRIENDS_SIGNING_KEY===env.FRIENDS_DATA_KEY||adminToken===env.FRIENDS_DATA_KEY||adminToken===env.FRIENDS_SIGNING_KEY)errors.push('数据、签名和管理密钥必须分离');
  const mode=env.FRIENDS_RELEASE_MODE||'closed_beta';
  if(!['closed_beta','public'].includes(mode))errors.push('FRIENDS_RELEASE_MODE无效');
  const allowedIds=new Set(String(env.FRIENDS_ALLOWED_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
  if(mode==='closed_beta'&&!allowedIds.size)errors.push('邀请测试须配置允许进入的账号ID');
  if(mode==='public'){
    for(const k of ['FRIENDS_OPERATOR_NAME','FRIENDS_SUPPORT_EMAIL','FRIENDS_STORAGE_REGION','FRIENDS_RETENTION_POLICY'])if(!env[k]||PLACEHOLDERS.test(env[k]))errors.push(k+'尚未配置');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FRIENDS_SUPPORT_EMAIL||''))errors.push('客服邮箱格式无效');
    for(const k of ['FRIENDS_PUBLIC_APPROVED','FRIENDS_IDENTITY_REVIEWED','FRIENDS_LEGAL_REVIEWED','FRIENDS_BACKUP_VERIFIED'])if(env[k]!=='true')errors.push(k+'尚未确认');
  }
  const file=env.FRIENDS_DB_FILE||path.join(__dirname,'../private/friends.sqlite');
  if(!path.isAbsolute(file))errors.push('FRIENDS_DB_FILE须为绝对路径');
  // A file beneath publicly served repo directories could be downloaded even with encryption.
  const repo=path.resolve(__dirname,'../..'),relative=path.relative(repo,path.resolve(file));
  if(!relative.startsWith('..')&&!relative.startsWith('server'+path.sep))errors.push('数据库不能放在前端静态目录');
  return {enabled,mode,file,allowedIds,errors,ok:!errors.length};
}
function requireFriendsConfig(env){const config=getFriendsConfig(env);if(config.enabled&&!config.ok)throw Error('交友上线配置未就绪：'+config.errors.join('；'));return config;}
module.exports={getFriendsConfig,requireFriendsConfig};
