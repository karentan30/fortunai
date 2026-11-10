'use strict';
// 相生 → Lumee 中台增长埋点（POST /hub/track）。
// 铁律：
// - 默认关（FRIENDS_HUB_TRACK_ENABLED==='true' 且中台三项配置齐全才发）；
// - fire-and-forget：track() 同步返回、永不抛错、永不等网络；队列有上限，满了直接丢；发失败直接丢；
// - 隐私（PIPL 最小化）：distinct_id = HMAC(secret, uid) 的假名，不是 uid/邮箱/手机；
//   事件名和 props 走白名单，props 只收枚举值 / 布尔 / 小整数，其他一律丢弃——
//   生辰、日主、答案、照片、联系方式、学校、自由文本在这里根本没有通道。
const crypto=require('node:crypto');

// 事件 → 允许的 props 及其取值。未列出的事件整条丢弃。
const SOURCES=['wechat','xhs','douyin','channels','direct','tiktok','campus','club','friend'];
const SCHEMA=Object.freeze({
  profile_created:{source:SOURCES},          // 第一次保存资料
  profile_complete:{},                        // 资料完成并公开（listed 变 true）
  card_enabled:{},                            // 开启分享名片
  card_opened:{},                             // 名片被打开（每张卡每天只记一次）
  invite_created:{via:['direct','card']},     // 发出合盘邀请链接
  invite_claimed:{via:['claim','join']},      // 被邀请的人认领
  compat_free_done:{kind:['pair','self']},    // 看到免费合盘
  compat_paid:{via:['order'],kind:['pair','self','mychart']}, // 付费解锁
  heju_signup:{},heju_grouped:{},heju_confirmed:{},heju_attended:{},heju_mutual:{},
  connection_accepted:{via:['request','heju']}
});
const EVENTS=Object.freeze(Object.keys(SCHEMA));

/** 只留白名单里的 props；值必须是枚举内的字符串、布尔、或 0..1000 的整数。 */
function cleanProps(event,props){
  const spec=SCHEMA[event]||{},out={};
  if(!props||typeof props!=='object'||Array.isArray(props))return out;
  for(const k of Object.keys(spec)){
    const v=props[k],allow=spec[k];
    if(Array.isArray(allow)){if(typeof v==='string'&&allow.includes(v))out[k]=v;}
    else if(allow==='bool'){if(typeof v==='boolean')out[k]=v;}
    else if(allow==='int'){if(Number.isInteger(v)&&v>=0&&v<=1000)out[k]=v;}
  }
  return out;
}
const pseudonym=(secret,uid)=>crypto.createHmac('sha256',secret).update('xs-hub-did:'+String(uid)).digest('hex').slice(0,32);
const beijingDay=now=>new Date(now+8*3600000).toISOString().slice(0,10);

/**
 * createTracker({env,send,now,maxQueue,maxDedupe})
 * send(payload) → Promise；默认走 createHubClient(...).signedPost('/hub/track')。测试注入假 send。
 */
function createTracker({env=process.env,send,now=()=>Date.now(),maxQueue=200,maxDedupe=20000}={}){
  const {payConfig,createHubClient}=require('./friends-hepan-pay'); // 懒加载：避免和收款模块循环引用
  const cfg=payConfig(env);
  const enabled=env.FRIENDS_HUB_TRACK_ENABLED==='true'&&cfg.ready;
  let sender=send||null;
  if(!sender&&enabled){const client=createHubClient({...cfg,timeoutMs:2500});sender=p=>client.signedPost('/hub/track',p,{timeoutMs:2500});}
  const active=enabled;
  const queue=[];let draining=false,dedupe=new Set(),dedupeDay='';
  async function drain(){
    if(draining)return;draining=true;
    try{while(queue.length){const p=queue.shift();try{await sender(p);}catch(_){/* 丢弃 */}}}
    finally{draining=false;}
  }
  function track(event,{uid,props,dedupe:dk}={}){
    try{
      if(!active||!sender||!SCHEMA[event]||uid===undefined||uid===null||uid==='')return false;
      const secret=cfg.secret;
      if(dk!==undefined){
        const day=beijingDay(now());if(day!==dedupeDay){dedupe=new Set();dedupeDay=day;}
        const key=event+'|'+pseudonym(secret,dk);if(dedupe.has(key))return false;
        if(dedupe.size>=maxDedupe)return false;dedupe.add(key);
      }
      if(queue.length>=maxQueue)return false;
      queue.push({event,distinct_id:pseudonym(secret,uid),props:cleanProps(event,props)});
      drain().catch(()=>{});
      return true;
    }catch(_){return false;}
  }
  return {track,enabled:active,_queueLength:()=>queue.length};
}

/** 看板用：签名 POST /hub/metrics/events。中台没配好 → null（路由返回 503）。密钥只在服务端。 */
function defaultMetricsFetcher(env=process.env){
  const {payConfig,createHubClient}=require('./friends-hepan-pay');
  const cfg=payConfig(env);if(!cfg.ready)return null;
  const client=createHubClient({...cfg,timeoutMs:8000});
  return ({days=90,events}={})=>client.signedPost('/hub/metrics/events',{days:Math.min(90,Math.max(1,days|0)),events:events||EVENTS},{timeoutMs:8000});
}

// 进程级默认实例：第一次用到才按环境变量创建；测试用 _setTrackerForTest 换成假的。
let shared=null;
const tracker=()=>shared||(shared=createTracker());
function track(event,opts){try{return tracker().track(event,opts);}catch(_){return false;}}
function _setTrackerForTest(t){shared=t;}
module.exports={defaultMetricsFetcher,track,createTracker,cleanProps,pseudonym,EVENTS,SCHEMA,_setTrackerForTest};
