'use strict';
// 自己合盘：本人填 TA 的生辰，只算不存。只本人可见，不通知对方，不进任何推荐池。
// TA 的生辰与四柱从不落库、不写日志；可选「保存」只留档位、分数和解读条目 ID（不含任何一方的干支）。
const crypto=require('node:crypto');
const {calculate}=require('./friends-chart');
const XB=require('./friends-cross-border');
const {isDisabled}=require('./friends-admin');
const HE=require('./friends-hepan-v4'),HC=require('./friends-hepan-copy'),HV=require('./friends-hepan-view');
const LIMITS=Object.freeze({account:3,device:3,ip:10}),SAVED_MAX=30,TOKEN_TTL=86400000,AI_RETRY_MS=10*60000;
const CONSENT_VERSION='hepan-self-v4-2026-11-09';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const same=(a,b)=>String(a)===String(b);
const dayKey=now=>new Date(now+8*3600000).toISOString().slice(0,10);// 按北京时间自然日计数
function createHepanSelfService({store,secret,calculateChart=calculate,generateProse=null,clock=()=>Date.now(),cacheSize=200,pay=null}={}){
 if(!store?.read||!store?.transaction)throw Error('自己合盘需要存储');
 if(typeof secret!=='string'||secret.length<32)throw Error('自己合盘需要至少32位签名密钥');
 const mac=(...parts)=>crypto.createHmac('sha256',secret).update(parts.join('\u0000')).digest('base64url');
 const usage=s=>{if(!Array.isArray(s.hepanSelfUsage))s.hepanSelfUsage=[];return s.hepanSelfUsage;};
 const saved=s=>{if(!Array.isArray(s.hepanSelfSaved))s.hepanSelfSaved=[];return s.hepanSelfSaved;};
 // 计数键全部 HMAC：库里看不出是哪个账号、设备或 IP。
 const buckets=(uid,{device,ip})=>[['account',mac('acct',uid)],...(typeof device==='string'&&/^[A-Za-z0-9_-]{16,64}$/.test(device)?[['device',mac('dev',device)]]:[]),...(ip?[['ip',mac('ip',ip)]]:[])];
 function remaining(s,uid,ctx){const d=dayKey(clock()),list=usage(s);let left=LIMITS.account;for(const [kind,k] of buckets(uid,ctx)){const n=list.find(x=>x.k===k&&x.day===d)?.n||0;left=Math.min(left,LIMITS[kind]-n);}return Math.max(0,left);}
 const proseCache=new Map();// 只在内存：键是 HMAC，进程重启即清空
 const remember=(k,v)=>{proseCache.delete(k);proseCache.set(k,v);while(proseCache.size>cacheSize)proseCache.delete(proseCache.keys().next().value);};
 const inflight=new Map(),aiRetryAt=new Map();
 const bounded=(m,k,v)=>{m.delete(k);m.set(k,v);while(m.size>cacheSize)m.delete(m.keys().next().value);};
 function chartOf(person,who){
  if(!person||typeof person!=='object'||Array.isArray(person))fail(400,'请填写'+who+'的出生资料');
  if(!['male','female'].includes(person.gender))fail(400,'请选择'+who+'的性别');
  let r;try{r=calculateChart({birthday:person.birthday,calendar:person.calendar==='lunar'?'lunar':'solar',time:person.time??null,leapMonth:person.leapMonth===true},new Date(clock()));}
  catch(e){if(e.status&&/18/.test(e.message))fail(400,who==='TA'?'对方需年满18岁才能合盘':e.message);throw e;}
  const pillars=r.complete?r.pillars:r.basePillars;
  if(!pillars||!HE.split(pillars.day))fail(400,'排盘结果不完整');
  return {gender:person.gender,pillars:{year:pillars.year,month:pillars.month,day:pillars.day,hour:r.complete?pillars.hour:null}};
 }
 // 保存凭证要加密（AES-256-GCM），不能只签名：里面有锁住的分项分数和全部磨合点，免费版不能靠解码凭证看到。
 const saveKey=crypto.createHmac('sha256',secret).update('hepan-self-save-key').digest();
 function signSave(payload){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',saveKey,iv),ct=Buffer.concat([c.update(JSON.stringify(payload)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),ct]).toString('base64url');}
 function readSave(token,uid){
  if(typeof token!=='string'||token.length>8000)fail(400,'保存凭证无效');
  let body;try{const raw=Buffer.from(token,'base64url');if(raw.length<29)throw 0;const d=crypto.createDecipheriv('aes-256-gcm',saveKey,raw.subarray(0,12));d.setAuthTag(raw.subarray(12,28));body=JSON.parse(Buffer.concat([d.update(raw.subarray(28)),d.final()]).toString());}catch{fail(400,'保存凭证无效');}
  if(body.v!==1||typeof body.j!=='string'||!same(body.u,uid)||body.exp<clock())fail(400,'保存凭证已过期，请重新合盘');
  return body;
 }
 function savedView(r,uid=r.owner,s=store.read()){
  const analysis={purpose:r.purpose,tier:r.tier,tierLabel:HE.TIER[r.tier]},picked={he:r.hits.filter(h=>h.kind==='he'),mohe:r.hits.filter(h=>h.kind==='mohe')};
  // 和当场结果同一套免费/完整截断：磨合点不超过 1 条才算全部展示；否则地支、五行两项分不给数字。
  // 付费解锁（记在这条保存记录上）后给全部分项分和全部磨合点。
  const allShown=picked.mohe.length<=1,unlocked=!!pay&&pay.isUnlocked('self',r,s),offer=pay?pay.offerFor(uid,'self',r,s):null,full=allShown||unlocked,subs=HV.SUBS.map(([key,label])=>{const locked=!full&&(key==='branch'||key==='wuxing');return {key,label:key==='star'&&r.purpose==='buddy'?'相处星':label,locked};});
  const prose=HC.fill(HC.templateProse(analysis,picked),{A:'你',B:'TA'});
  const item=h=>{const t=HC.fill(HC.template(h,h.kind),{A:'你',B:'TA'});return {id:h.id,kind:h.kind,tag:HV.tagOf(h,null,'invite'),title:t.title,meaning:t.meaning,life:t.life,...(h.kind==='mohe'?{advice:t.advice||[]}:{})};};
  return {id:r.id,kind:'hepan_v4_saved',mode:'self',nickname:r.nickname,purpose:r.purpose,limited:r.limited,tier:r.tier,tierLabel:HE.TIER[r.tier],subs,summary:prose.summary,lead:prose.lead,epigraph:HC.EPIGRAPHS[r.tier],he:picked.he.map(item),mohe:(full?picked.mohe:picked.mohe.slice(0,1)).map(item),moreCount:full?0:picked.mohe.length-1,allShown,unlocked,full,lock:full?null:HV.lockOf(picked.mohe.length-1,offer),pay:HV.payView(offer,full),createdAt:r.createdAt,note:'保存只记档位和解读条目，不存任何一方的生辰。',footer:HV.FOOTER};
 }
 return {
  limits:LIMITS,consentVersion:CONSENT_VERSION,
  quota(uid,ctx={}){if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');return {limit:LIMITS.account,remaining:remaining(store.read(),uid,ctx),consentVersion:CONSENT_VERSION};},
  async run(uid,body={},ctx={}){
   if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
   XB.check(store,uid);
   if(isDisabled(store.read(),uid))fail(403,'账号暂不可使用');
   const c=body.consents||{};
   if(c.informed!==true||c.selfOnly!==true||c.adult!==true)fail(400,'请先勾选三项确认');
   const purpose=body.purpose==='buddy'?'buddy':'romance';
   const nickname=typeof body.ta?.nickname==='string'?body.ta.nickname.trim():'';
   if(!nickname||[...nickname].length>12)fail(400,'请填写 TA 的昵称（12个字以内）');
   if(remaining(store.read(),uid,ctx)<=0)fail(429,'今天的自己合盘次数已用完，明天再来');
   const charts={A:chartOf(body.me,'你'),B:chartOf(body.ta,'TA')};
   const analysis=HE.analyze(charts.A,charts.B,{purpose}),picked=HE.items(analysis),key=mac('prose',HE.cacheKey(charts.A,charts.B,purpose));
   // 先在一个事务里占掉 1 次（核对与扣减不可分），再去调模型；之后任何一步失败都退回这 1 次。
   // 这样并发请求不会都通过「还有次数」的检查、各自打一遍模型。
   const day=dayKey(clock()),reserved=buckets(uid,ctx);
   const left=store.transaction(s=>{if(remaining(s,uid,ctx)<=0)fail(429,'今天的自己合盘次数已用完，明天再来');s.hepanSelfUsage=usage(s).filter(x=>x.day===day);for(const [,k] of reserved){const row=s.hepanSelfUsage.find(x=>x.k===k);if(row)row.n++;else s.hepanSelfUsage.push({k,day,n:1});}return remaining(s,uid,ctx);});
   const refund=()=>{try{store.transaction(s=>{for(const [,k] of reserved){const row=usage(s).find(x=>x.k===k&&x.day===day);if(row&&row.n>0)row.n--;}});}catch{}};
   try{
   let prose=proseCache.get(key);
   if(!prose){
    // 只缓存 AI 文案；回落模板当次直接给、不缓存（也不留 fallbackReason），冷却期过后再试 AI。
    if(typeof generateProse!=='function'||(aiRetryAt.get(key)||0)>clock()||!(inflight.has(key)||HC.takeAiCall(store,uid,clock())))prose=HC.templateProse(analysis,picked);
    else{if(!inflight.has(key))inflight.set(key,HC.writeProse(analysis,picked,{mode:'self',generate:generateProse,charts}).finally(()=>inflight.delete(key)));const {fallbackReason,...written}=await inflight.get(key);prose=written;if(prose.source==='ai'){aiRetryAt.delete(key);remember(key,prose);}else bounded(aiRetryAt,key,clock()+AI_RETRY_MS);}
   }
   const report=HV.buildReport({analysis,picked,prose,charts,mode:'self',viewer:'A',unlocked:false,taNickname:nickname});
   const hits=[...picked.he.map(h=>({kind:'he',...descriptor(h)})),...picked.mohe.map(h=>({kind:'mohe',...descriptor(h)}))];
   const saveToken=signSave({v:1,j:crypto.randomBytes(12).toString('base64url'),u:uid,exp:clock()+TOKEN_TTL,nickname,purpose,limited:analysis.limited,total:analysis.total,tier:analysis.tier,subs:Object.fromEntries(Object.entries(analysis.subs).map(([k,v])=>[k,v.score])),hits});
   // 当场结果还没保存：解锁要记在保存的那条上，所以按钮先引导保存。
   const canBuy=!!pay&&!report.full&&(pay.enabled()||pay.offerPreview(uid).creditEnabled);
   if(report.lock)report.lock={...report.lock,cta:canBuy?'保存后解锁完整报告':report.lock.cta,available:canBuy,needsSave:canBuy};
   return {...report,remaining:left,saveToken,ownerOnly:true,inPool:false};
   }catch(e){refund();throw e;}
  },
  // 凭证一次性：记下凭证 id（j）。同一凭证再交一次 → 返回已保存的那条（幂等，不重复建）；保存后又删了 → 拒绝，不能靠旧凭证复活。
  save(uid,{saveToken}={}){const b=readSave(saveToken,uid);return store.transaction(s=>{const list=saved(s),now=clock();
   if(!Array.isArray(s.hepanSelfSaveUsed))s.hepanSelfSaveUsed=[];s.hepanSelfSaveUsed=s.hepanSelfSaveUsed.filter(x=>x&&x.exp>=now);
   const prev=list.find(r=>r.tokenId===b.j&&same(r.owner,uid));if(prev)return savedView(prev,uid,s);
   if(s.hepanSelfSaveUsed.some(x=>x.j===b.j))fail(409,'这次合盘已经保存过了');
   if(list.filter(r=>same(r.owner,uid)).length>=SAVED_MAX)fail(429,'最多保存'+SAVED_MAX+'条，请先删除旧的');
   const r={id:crypto.randomUUID(),owner:uid,tokenId:b.j,nickname:b.nickname,purpose:b.purpose,limited:b.limited,total:b.total,tier:b.tier,subs:b.subs,hits:b.hits,createdAt:new Date(now).toISOString()};list.push(r);s.hepanSelfSaveUsed.push({j:b.j,exp:b.exp});return savedView(r,uid,s);});},
  list(uid){return {saved:saved(store.read()).filter(r=>same(r.owner,uid)).slice().reverse().map(r=>({id:r.id,nickname:r.nickname,tier:r.tier,tierLabel:HE.TIER[r.tier],createdAt:r.createdAt,unlocked:!!pay&&pay.isUnlocked('self',r)}))};},
  get(uid,id){const s=store.read(),r=saved(s).find(r=>r.id===id&&same(r.owner,uid));if(!r)fail(404,'记录不存在');const v=savedView(r,uid,s);if(pay&&v.unlocked&&!v.allShown)pay.markOpened(uid,'self',r.id);return v;},
  remove(uid,id){return store.transaction(s=>{const list=saved(s),i=list.findIndex(r=>r.id===id&&same(r.owner,uid));if(i<0)fail(404,'记录不存在');
   // 已解锁的记录：留墓碑；完整版还没打开过 → 单次记待退款、会员退回份数（与弹层退款规则一致）。
   const gone=list[i].unlock?require('./friends-hepan-pay').targetRemovedIn(s,'self',list[i],clock()):null;
   list.splice(i,1);return gone?{deleted:true,refund:gone.refund}:{deleted:true};});}
 };
}
// 保存用的条目描述：只有柱位、关系类别、方向和五行名，不含干支。
function descriptor(h){return {id:h.id,pillar:h.pillar,part:h.part,type:h.type,dir:h.dir||null,...(h.elements?{elements:h.elements}:{})};}
module.exports={createHepanSelfService,LIMITS,CONSENT_VERSION};
