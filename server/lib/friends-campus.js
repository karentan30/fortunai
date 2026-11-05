'use strict';
/**
 * 相生单校区试点：渠道/社团/推荐人归因 + 漏斗事件发射。
 * - 只接受白名单形态的代码；社团必须在 assets/data/friends-campus.json 里登记，推荐码必须是服务器签发的形态。
 * - 人和人对都用 HMAC 匿名键写进 /api/ev 同一份 NDJSON，原始用户ID、姓名、生日、联系方式一律不落。
 * - 注册/资料完成/申请/双方接受/再次联系只能由服务端发出，前端 /api/ev 不能伪造（见 routes/events.js SERVER_ONLY）。
 */
const crypto=require('node:crypto');
const CONFIG=require('../../assets/data/friends-campus.json');
const {normalizeAttribution}=require('./friends-admin');
const CODE=/^[a-z0-9][a-z0-9_]{1,23}$/;
const REF=/^r[0-9a-f]{11}$/;
const NONE='none';
const str=v=>typeof v==='string'?v.trim().toLowerCase():'';
function campusCodes(value,config=CONFIG){
  const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const campus=str(input.campus),club=str(input.club),ref=str(input.ref);
  const clubs=Array.isArray(config.clubs)?config.clubs:[];
  return {
    campus:CODE.test(campus)&&campus===config.campus?.code?campus:NONE,
    club:CODE.test(club)&&clubs.some(c=>c&&c.code===club)?club:NONE,
    ref:REF.test(ref)?ref:NONE,
  };
}
const fullAttribution=(value,config)=>({...normalizeAttribution(value),...campusCodes(value,config)});
const hmac=(secret,label)=>crypto.createHmac('sha256',String(secret)).update(label).digest('hex');
/** 推荐码：服务器用签名密钥派生，同一用户永远相同；拿到码也反推不出用户ID。 */
function referralCode(secret,userId){if(typeof secret!=='string'||secret.length<32)throw Error('推荐码需要签名密钥');return 'r'+hmac(secret,'xs-ref:'+String(userId)).slice(0,11);}
const personKey=(secret,userId)=>'u'+hmac(secret,'xs-person:'+String(userId)).slice(0,15);
const pairKey=(secret,a,b)=>'p'+hmac(secret,'xs-pair:'+[String(a),String(b)].sort().join('|')).slice(0,15);
const testIds=(raw=process.env.FRIENDS_KPI_TEST_IDS)=>new Set(String(raw||'').split(',').map(x=>x.trim()).filter(Boolean));
/**
 * 生成写入 NDJSON 的发射器。log 默认是 routes/events.js 的 logEvent；测试可注入。
 * emit(event,userId,attribution,{pairWith}) 永不抛错。
 */
function createFunnelSink({secret,log,tests=testIds()}={}){
  if(typeof secret!=='string'||secret.length<32)return ()=>false;
  const write=log||((row)=>require('../routes/events').logEvent(row));
  return (event,userId,attribution,extra={})=>{try{
    if(userId===undefined||userId===null)return false;
    const a=fullAttribution(attribution);
    return write({e:event,sid:personKey(secret,userId),src:a.source,camp:a.campaign,club:a.club,cp:a.campus,ref:a.ref,
      v:extra.pairWith!==undefined?pairKey(secret,userId,extra.pairWith):'',x:tests.has(String(userId))||(extra.pairWith!==undefined&&tests.has(String(extra.pairWith)))?'test':''});
  }catch(_){return false;}};
}
const attributionOf=(state,userId)=>{const mark=(state.attributionMarks||[]).find(m=>String(m.userId)===String(userId));const p=(state.profiles||[]).find(x=>String(x.userId)===String(userId));return mark||p?.acquisition||{};};
const shanghaiDay=iso=>new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,10);
/** 再次联系（平台内可核对口径）：双方都发过消息，且消息分布在至少两个不同的北京时间日期。 */
function isSecondContact(pair){
  const messages=Array.isArray(pair?.messages)?pair.messages:[];
  const senders=new Set(messages.map(m=>String(m.sender)));
  if(!senders.has(String(pair.from))||!senders.has(String(pair.to)))return false;
  return new Set(messages.map(m=>shanghaiDay(m.createdAt))).size>=2;
}
/**
 * 双人邀请（friends-compatibility）不改原服务代码，只在外面包一层：
 * 双方授权后 pair 进入 ready → 记双方接受；之后每发一条消息检查是否满足“再次联系”。
 */
function instrumentCompatibility(service,store,emit){
  const seen=new Set();
  const once=(key,fn)=>{if(seen.has(key))return;seen.add(key);if(seen.size>20000)seen.clear();fn();};
  const check=id=>{try{
    const s=store.read(),pair=(s.compatibilityPairs||[]).find(p=>p.id===id);
    if(!pair||pair.to===null||pair.to===undefined||pair.status!=='ready')return;
    const both=fn=>{fn(pair.from,pair.to);fn(pair.to,pair.from);};
    once('accept:'+id,()=>both((a,b)=>emit('xs_mutual_accept',a,attributionOf(s,a),{pairWith:b})));
    if(isSecondContact(pair))once('second:'+id,()=>both((a,b)=>emit('xs_second_contact',a,attributionOf(s,a),{pairWith:b})));
  }catch(_){}};
  const wrap=name=>{const original=service[name];if(typeof original!=='function')return;service[name]=function(uid,id,...rest){const out=original.call(this,uid,id,...rest);if(out&&typeof out.then==='function')return out.then(v=>{check(id);return v;});check(id);return out;};};
  wrap('authorize');wrap('sendMessage');
  return service;
}
/** /api/auth/register 用：只在相生页面带来 xs 归因时记一次注册。 */
function logRegistration(userId,xs,{secret=process.env.FRIENDS_SIGNING_KEY,log}={}){
  if(!xs||typeof xs!=='object')return false;
  return createFunnelSink({secret,log})('xs_register',userId,xs);
}
module.exports={CONFIG,campusCodes,fullAttribution,referralCode,personKey,pairKey,createFunnelSink,instrumentCompatibility,isSecondContact,logRegistration,attributionOf};
