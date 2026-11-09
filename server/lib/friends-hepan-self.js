'use strict';
// 自己合盘：本人填 TA 的生辰，只算不存。只本人可见，不通知对方，不进任何推荐池。
// TA 的生辰与四柱从不落库、不写日志；可选「保存」只留档位、分数和解读条目 ID（不含任何一方的干支）。
const crypto=require('node:crypto');
const {calculate}=require('./friends-chart');
const XB=require('./friends-cross-border');
const {isDisabled}=require('./friends-admin');
const HE=require('./friends-hepan-v4'),HC=require('./friends-hepan-copy'),HV=require('./friends-hepan-view');
const LIMITS=Object.freeze({account:3,device:3,ip:10}),SAVED_MAX=30,TOKEN_TTL=86400000;
const CONSENT_VERSION='hepan-self-v4-2026-11-09';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const same=(a,b)=>String(a)===String(b);
const dayKey=now=>new Date(now+8*3600000).toISOString().slice(0,10);// 按北京时间自然日计数
function createHepanSelfService({store,secret,calculateChart=calculate,generateProse=null,clock=()=>Date.now(),cacheSize=200}={}){
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
 const inflight=new Map();
 function chartOf(person,who){
  if(!person||typeof person!=='object'||Array.isArray(person))fail(400,'请填写'+who+'的出生资料');
  if(!['male','female'].includes(person.gender))fail(400,'请选择'+who+'的性别');
  let r;try{r=calculateChart({birthday:person.birthday,calendar:person.calendar==='lunar'?'lunar':'solar',time:person.time??null,leapMonth:person.leapMonth===true},new Date(clock()));}
  catch(e){if(e.status&&/18/.test(e.message))fail(400,who==='TA'?'对方需年满18岁才能合盘':e.message);throw e;}
  const pillars=r.complete?r.pillars:r.basePillars;
  if(!pillars||!HE.split(pillars.day))fail(400,'排盘结果不完整');
  return {gender:person.gender,pillars:{year:pillars.year,month:pillars.month,day:pillars.day,hour:r.complete?pillars.hour:null}};
 }
 function signSave(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');return data+'.'+mac('save',data);}
 function readSave(token,uid){
  if(typeof token!=='string'||token.length>8000)fail(400,'保存凭证无效');
  const [data,sig,...rest]=token.split('.'),a=Buffer.from(sig||''),b=Buffer.from(mac('save',data||''));
  if(rest.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))fail(400,'保存凭证无效');
  const body=JSON.parse(Buffer.from(data,'base64url').toString());
  if(body.v!==1||!same(body.u,uid)||body.exp<clock())fail(400,'保存凭证已过期，请重新合盘');
  return body;
 }
 function savedView(r){
  const analysis={purpose:r.purpose,tier:r.tier,tierLabel:HE.TIER[r.tier]},picked={he:r.hits.filter(h=>h.kind==='he'),mohe:r.hits.filter(h=>h.kind==='mohe')};
  const prose=HC.fill(HC.templateProse(analysis,picked),{A:'你',B:'TA'});
  const item=h=>{const t=HC.fill(HC.template(h,h.kind),{A:'你',B:'TA'});return {id:h.id,kind:h.kind,tag:HV.tagOf(h,null,'invite'),title:t.title,meaning:t.meaning,life:t.life,...(h.kind==='mohe'?{advice:t.advice||[]}:{})};};
  return {id:r.id,kind:'hepan_v4_saved',mode:'self',nickname:r.nickname,purpose:r.purpose,limited:r.limited,total:r.total,tier:r.tier,tierLabel:HE.TIER[r.tier],subs:r.subs,summary:prose.summary,lead:prose.lead,epigraph:HC.EPIGRAPHS[r.tier],he:picked.he.map(item),mohe:picked.mohe.slice(0,1).map(item),moreCount:Math.max(0,picked.mohe.length-1),allShown:picked.mohe.length<=1,createdAt:r.createdAt,note:'保存只记档位和解读条目，不存任何一方的生辰。',footer:HV.FOOTER};
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
   let prose=proseCache.get(key);
   if(!prose){if(!inflight.has(key))inflight.set(key,HC.writeProse(analysis,picked,{mode:'self',generate:generateProse,charts}).finally(()=>inflight.delete(key)));prose=await inflight.get(key);remember(key,prose);}
   // 成功后才扣次数；事务里再核一次，防并发多扣。
   const left=store.transaction(s=>{if(remaining(s,uid,ctx)<=0)fail(429,'今天的自己合盘次数已用完，明天再来');const d=dayKey(clock()),list=usage(s);s.hepanSelfUsage=list.filter(x=>x.day===d);for(const [,k] of buckets(uid,ctx)){const row=s.hepanSelfUsage.find(x=>x.k===k);if(row)row.n++;else s.hepanSelfUsage.push({k,day:d,n:1});}return remaining(s,uid,ctx);});
   const report=HV.buildReport({analysis,picked,prose,charts,mode:'self',viewer:'A',unlocked:false,taNickname:nickname});
   const hits=[...picked.he.map(h=>({kind:'he',...descriptor(h)})),...picked.mohe.map(h=>({kind:'mohe',...descriptor(h)}))];
   const saveToken=signSave({v:1,u:uid,exp:clock()+TOKEN_TTL,nickname,purpose,limited:analysis.limited,total:analysis.total,tier:analysis.tier,subs:Object.fromEntries(Object.entries(analysis.subs).map(([k,v])=>[k,v.score])),hits});
   return {...report,remaining:left,saveToken,ownerOnly:true,inPool:false};
  },
  save(uid,{saveToken}={}){const b=readSave(saveToken,uid);return store.transaction(s=>{const list=saved(s);if(list.filter(r=>same(r.owner,uid)).length>=SAVED_MAX)fail(429,'最多保存'+SAVED_MAX+'条，请先删除旧的');const r={id:crypto.randomUUID(),owner:uid,nickname:b.nickname,purpose:b.purpose,limited:b.limited,total:b.total,tier:b.tier,subs:b.subs,hits:b.hits,createdAt:new Date(clock()).toISOString()};list.push(r);return savedView(r);});},
  list(uid){return {saved:saved(store.read()).filter(r=>same(r.owner,uid)).slice().reverse().map(r=>({id:r.id,nickname:r.nickname,total:r.total,tier:r.tier,tierLabel:HE.TIER[r.tier],createdAt:r.createdAt}))};},
  get(uid,id){const r=saved(store.read()).find(r=>r.id===id&&same(r.owner,uid));if(!r)fail(404,'记录不存在');return savedView(r);},
  remove(uid,id){return store.transaction(s=>{const list=saved(s),i=list.findIndex(r=>r.id===id&&same(r.owner,uid));if(i<0)fail(404,'记录不存在');list.splice(i,1);return {deleted:true};});}
 };
}
// 保存用的条目描述：只有柱位、关系类别、方向和五行名，不含干支。
function descriptor(h){return {id:h.id,pillar:h.pillar,part:h.part,type:h.type,dir:h.dir||null,...(h.elements?{elements:h.elements}:{})};}
module.exports={createHepanSelfService,LIMITS,CONSENT_VERSION};
