'use strict';
// Node 24 pilot persistence. WAL + an IMMEDIATE transaction prevents lost updates across workers.
// The state payload is authenticated/encrypted; neither user profiles nor contacts appear as plaintext in the database or backups.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const COLLECTIONS=['profiles','requests','blocks','reports','moderation','auditLogs','feedback','metrics','billingOrders','billingEvents','creditLedger','creditReservations','attributionMarks','personalReportJobs','relationshipQuestionnaires','marriageQuestionnaires','questionnaireShares','compatibilityPairs','privateIntakes','pairReportJobs','verificationRequests'];
function normalize(state){
  if(!state||state.version!==1)throw Error('交友数据版本无效');
  for(const key of COLLECTIONS){if(state[key]===undefined)state[key]=[];if(!Array.isArray(state[key]))throw Error('交友数据结构损坏');}
  return state;
}
function createSqliteFriendsStore(file,{key,create=true}={}){
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('FRIENDS_DATA_KEY必须是32字节随机密钥的64位十六进制');
  if(typeof file!=='string'||!path.isAbsolute(file))throw Error('交友数据库必须使用绝对路径');
  if(!create&&!fs.existsSync(file))throw Error('交友数据库不存在');
  let DatabaseSync,backup;
  try{({DatabaseSync,backup}=require('node:sqlite'));}catch(_){throw Error('交友数据库需要Node 24运行环境');}
  const secret=Buffer.from(key,'hex'),aad=Buffer.from('runae-friends-state-v1');
  const seal=value=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(aad);const data=Buffer.concat([cipher.update(JSON.stringify(normalize(value)),'utf8'),cipher.final()]);return Buffer.concat([Buffer.from([1]),iv,cipher.getAuthTag(),data]);};
  const open=value=>{const b=Buffer.from(value);if(b[0]!==1||b.length<30)throw Error('交友加密数据格式无效');const decipher=crypto.createDecipheriv('aes-256-gcm',secret,b.subarray(1,13));decipher.setAAD(aad);decipher.setAuthTag(b.subarray(13,29));try{return normalize(JSON.parse(Buffer.concat([decipher.update(b.subarray(29)),decipher.final()]).toString('utf8')));}catch(_){throw Error('交友数据库密钥不匹配或数据损坏');}};
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const db=new DatabaseSync(file,{open:true});
  try{
    // Install the lock wait before WAL/schema initialization: concurrent process startup can lock here too.
    db.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;');
    if(!create){
      const table=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='friends_state'").get();
      if(!table||!db.prepare('SELECT id FROM friends_state WHERE id=1').get())throw Error('恢复数据库缺少交友数据，拒绝初始化空池');
    }
    db.exec('CREATE TABLE IF NOT EXISTS friends_state(id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)');
    db.exec('BEGIN IMMEDIATE');
    try{const row=db.prepare('SELECT id FROM friends_state WHERE id=1').get();if(!row)db.prepare('INSERT INTO friends_state VALUES(1,?,0,?)').run(seal({version:1}),new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    // Validate the key before returning, even if the caller only wants a health check.
    open(db.prepare('SELECT payload FROM friends_state WHERE id=1').get().payload);
    if(process.platform!=='win32')fs.chmodSync(file,0o600);
  }catch(e){db.close();throw e;}
  return {
    read(){return open(db.prepare('SELECT payload FROM friends_state WHERE id=1').get().payload);},
    transaction(fn){
      db.exec('BEGIN IMMEDIATE');
      try{const next=open(db.prepare('SELECT payload FROM friends_state WHERE id=1').get().payload),result=fn(next);if(result&&typeof result.then==='function')throw Error('交友事务不能包含异步操作');const detached=structuredClone(result);db.prepare('UPDATE friends_state SET payload=?,revision=revision+1,updated_at=? WHERE id=1').run(seal(next),new Date().toISOString());db.exec('COMMIT');return detached;}catch(e){db.exec('ROLLBACK');throw e;}
    },
    health(){const integrity=db.prepare('PRAGMA quick_check').get();return {ok:Object.values(integrity)[0]==='ok',storage:'sqlite-wal-encrypted',revision:db.prepare('SELECT revision FROM friends_state WHERE id=1').get().revision};},
    async backup(destination){
      if(!path.isAbsolute(destination)||path.resolve(destination)===path.resolve(file))throw Error('备份目标无效');
      fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});if(fs.existsSync(destination))throw Error('备份目标已存在');
      await backup(db,destination);if(process.platform!=='win32')fs.chmodSync(destination,0o600);
      const check=createSqliteFriendsStore(destination,{key,create:false});try{if(!check.health().ok)throw Error('备份验证失败');}finally{check.close();}
      return {ok:true};
    },
    close(){db.close();}
  };
}
module.exports={createSqliteFriendsStore,COLLECTIONS,normalize};
