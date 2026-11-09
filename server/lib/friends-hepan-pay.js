'use strict';
// 合盘 v4 完整版：付费解锁（单次走 Lumee 收款中台）+ 会员每月 2 份。
// 规则（PRD §3.2）：
// - 金额只认服务端配置（FRIENDS_HEPAN_PRICE，默认 9.9 元），客户端传什么都不看；中台回调要验签，再主动查单核对金额和单号。
// - 解锁记在「这一对」上（邀请合盘记在邀请上，自己合盘记在已保存的那条上）：一方解锁，双方都看完整版。
// - 磨合点不超过 1 处的报告本来就全展示了，不卖。
// - 退款：单次退款 → 双方都收回；会员退款 → 用该会员份数解锁的都收回；
//   解锁后 7 天内对方撤回授权、且付款人从没打开过完整版 → 单次记「待退款」、会员退回 1 份；否则不退。
// - 中台没有独立的「已退款」状态（退款/关闭都返回 failed），已付订单查到 failed 按退款处理。
const crypto=require('node:crypto');
const HE=require('./friends-hepan-v4');
const {PILOT_CATALOG,isMember}=require('./friends-membership');
const SKU='friends_pair_report_v2',DAY=86400000,REVOKE_WINDOW_MS=7*DAY,ORDER_TTL_MS=30*60000,RECHECK_PAID_MS=10*60000;
const CHANNELS=['alipay','wechat'];
const PRODUCT='相生合盘完整报告';
const REFUND_RULE='7 天内、完整版还没打开过，可申请原路退款；打开后不退。';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const same=(a,b)=>a!==undefined&&a!==null&&b!==undefined&&b!==null&&String(a)===String(b);
const iso=t=>new Date(t).toISOString();
// 北京时间自然月，会员份数按它重置。
const monthKey=now=>new Date(now+8*3600000).toISOString().slice(0,7);
function toMinor(value){const text=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(text))return NaN;const [w,f='']=text.split('.');return Number(w)*100+Number(f.padEnd(2,'0'));}
function payConfig(env=process.env){
 const base=String(env.FRIENDS_HUB_BASE||'').trim().replace(/\/+$/,''),projectId=String(env.FRIENDS_HUB_PROJECT_ID||'').trim(),secret=String(env.FRIENDS_HUB_SECRET||'').trim();
 // 中台只走本机内网（http://127.0.0.1:8765）；不接受任意外网 http 地址。
 let baseOk=false;try{const u=new URL(base);baseOk=u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&!u.username&&!u.password;}catch{}
 const price=env.FRIENDS_HEPAN_PRICE===undefined||env.FRIENDS_HEPAN_PRICE===''?990:toMinor(env.FRIENDS_HEPAN_PRICE);
 const priceMinor=Number.isSafeInteger(price)&&price>=100&&price<=100000?price:990;
 const ready=baseOk&&/^[a-z][a-z0-9_-]{1,31}$/.test(projectId)&&secret.length>=32;
 return {enabled:env.FRIENDS_HEPAN_PAY_ENABLED==='true'&&ready,ready,base,projectId,secret,priceMinor,advisorQrUrl:advisorQr(env.FRIENDS_ADVISOR_QR_URL)};
}
// 顾问微信二维码图片：只接受 https 或站内路径；没配就不显示那张卡。
function advisorQr(v){const s=String(v||'').trim();if(!s)return null;if(/^\/(?!\/)[\w./-]+\.(png|jpe?g|webp)$/i.test(s))return s;try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function createHubClient({base,projectId,secret,fetchImpl=globalThis.fetch,timeoutMs=8000}){
 const sign=raw=>crypto.createHmac('sha256',secret).update(raw).digest('hex');
 async function call(url,init){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{const r=await fetchImpl(url,{...init,signal:ctl.signal,redirect:'error'});const data=await r.json().catch(()=>null);if(!r.ok||!data||data.ok!==true)fail(502,'支付通道暂时不可用，请稍后再试');return data;}
  catch(e){if(e.status)throw e;fail(502,'支付通道暂时不可用，请稍后再试');}
  finally{clearTimeout(timer);}
 }
 return {
  create({method,product,amount,outRef}){const body=JSON.stringify({method,product,amount,out_ref:outRef});return call(base+'/hub/pay/create',{method:'POST',headers:{'Content-Type':'application/json','X-Project-Id':projectId,'X-Sign':sign(body)},body});},
  // 中台对原始 query 串验签：project_id=<pid>&order_no=<no>（两者都只含字母数字，不用转义）。
  status(orderNo){const qs='project_id='+projectId+'&order_no='+orderNo;return call(base+'/hub/pay/status?'+qs,{method:'GET',headers:{'X-Project-Id':projectId,'X-Sign':sign(qs)}});},
  verify(raw,signature){if(!Buffer.isBuffer(raw)||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;const want=Buffer.from(sign(raw),'hex'),got=Buffer.from(signature.toLowerCase(),'hex');return want.length===got.length&&crypto.timingSafeEqual(want,got);}
 };
}
const orders=s=>{if(!Array.isArray(s.hepanOrders))s.hepanOrders=[];return s.hepanOrders;};
const credits=s=>{if(!Array.isArray(s.hepanCredits))s.hepanCredits=[];return s.hepanCredits;};
const pairsOf=s=>Array.isArray(s.compatibilityPairs)?s.compatibilityPairs:[];
const savedOf=s=>Array.isArray(s.hepanSelfSaved)?s.hepanSelfSaved:[];
// 解锁标记所在的对象：邀请合盘 → 邀请本身；自己合盘 → 已保存的那条。
function targetRow(s,type,id){if(type==='pair')return pairsOf(s).find(p=>p.id===id)||null;if(type==='self')return savedOf(s).find(r=>r.id===id)||null;return null;}
const unlockOf=(type,row)=>type==='pair'?row?.v4Unlock:row?.unlock;
function setUnlock(type,row,u){if(type==='pair'){if(u)row.v4Unlock=u;else delete row.v4Unlock;}else{if(u)row.unlock=u;else delete row.unlock;}}
const memberOrderLive=(o,now)=>o&&o.matchingMembership===true&&o.benefitsVerified===true&&o.status==='paid'&&Date.parse(o.paidAt)<=now&&Date.parse(o.accessUntil)>now;
// 解锁只在来源还有效时成立：单次订单仍是已付；会员份数仍记为已用且那笔会员没退款。退款路径漏了钩子也会在这里失效。
function unlockValid(s,u){
 if(!u||!u.source)return false;
 if(u.source.kind==='order')return orders(s).some(o=>o.id===u.source.orderId&&o.status==='paid');
 if(u.source.kind==='credit'){const c=credits(s).find(c=>c.id===u.source.creditId);const m=(s.billingOrders||[]).find(o=>o.id===c?.membershipOrderId);return !!c&&c.status==='used'&&m?.status==='paid';}
 return false;
}
function isUnlockedIn(s,type,row){const u=unlockOf(type,row);return unlockValid(s,u);}
// 收回解锁（退款）：保留历史，清掉当前标记。
function revokeUnlock(s,type,row,reason,now){const u=unlockOf(type,row);if(!u)return false;if(!Array.isArray(row.v4UnlockHistory))row.v4UnlockHistory=[];row.v4UnlockHistory.push({...u,revokedAt:iso(now),revokeReason:reason});setUnlock(type,row,null);return true;}
function eachUnlock(s,fn){for(const p of pairsOf(s))if(p.v4Unlock)fn('pair',p,p.v4Unlock);for(const r of savedOf(s))if(r.unlock)fn('self',r,r.unlock);}
// 单次订单退款（运营标记或中台查到已退）：双方一起收回。
function refundOrderIn(s,order,reason,now){if(order.status==='refunded')return {duplicate:true};order.status='refunded';order.refundedAt=iso(now);order.refundReason=reason;if(order.refundRequest&&!order.refundRequest.resolvedAt)order.refundRequest.resolvedAt=iso(now);let revoked=0;eachUnlock(s,(type,row,u)=>{if(u.source?.kind==='order'&&u.source.orderId===order.id&&revokeUnlock(s,type,row,'order_refunded',now))revoked++;});return {revoked};}
// 会员退款：用这笔会员份数解锁的全部收回。
function revokeMembershipIn(s,membershipOrderId,now){let revoked=0;const ids=new Set();for(const c of credits(s))if(c.membershipOrderId===membershipOrderId&&c.status==='used'){c.status='revoked';c.revokedAt=iso(now);ids.add(c.id);}eachUnlock(s,(type,row,u)=>{if(u.source?.kind==='credit'&&ids.has(u.source.creditId)&&revokeUnlock(s,type,row,'membership_refunded',now))revoked++;});return {revoked};}
// 对方撤回/婉拒授权（在 compatibility 的同一事务里调用）：7 天内且付款人没打开过完整版 → 单次记待退款、会员退回份数。
function consentRevokedIn(s,p,revokerId,now){
 const u=p?.v4Unlock;if(!u||!unlockValid(s,u))return null;
 if(same(revokerId,u.unlockedBy))return null;
 const within=now-Date.parse(u.unlockedAt)<=REVOKE_WINDOW_MS,unopened=!u.payerFirstOpenedFullAt;
 if(!within||!unopened){u.peerRevokedAt=iso(now);return {refund:false};}
 if(u.source.kind==='order'){const o=orders(s).find(o=>o.id===u.source.orderId);if(o&&o.status==='paid'&&!o.refundRequest)o.refundRequest={at:iso(now),reason:'peer_revoked_unopened'};revokeUnlock(s,'pair',p,'peer_revoked_unopened',now);return {refund:'request'};}
 const c=credits(s).find(c=>c.id===u.source.creditId);if(c&&c.status==='used'){c.status='returned';c.returnedAt=iso(now);}revokeUnlock(s,'pair',p,'peer_revoked_unopened',now);return {refund:'credit_returned'};
}
const publicOrder=o=>({id:o.id,status:o.status,channel:o.channel,amountMinor:o.amountMinor,currency:o.currency,target:{type:o.target.type,id:o.target.id},createdAt:o.createdAt,expiresAt:o.expiresAt,paidAt:o.paidAt||null,checkout:o.status==='pending'?o.checkout:null,name:PRODUCT});
function createHepanPayService({store,config=payConfig(),hub=null,pairFacts,clock=()=>Date.now(),hooks={}}={}){
 if(!store?.read||!store?.transaction)throw Error('合盘付费需要存储');
 if(typeof pairFacts!=='function')throw Error('合盘付费需要邀请合盘的磨合点计算');
 const client=hub||(config.ready?createHubClient(config):null);
 const enabled=()=>config.enabled===true&&!!client;
 const memberMonthly=()=>Math.max(0,...Object.values(PILOT_CATALOG).filter(p=>p.matchingMembership&&p.monthlyCreditUnit==='hepan_v4').map(p=>p.monthlyReportCredits||0));
 // 读目标、核对权限、算能不能卖。只在服务端算，客户端只给 type+id。
 function target(s,uid,type,id){
  if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
  if(!['pair','self'].includes(type)||typeof id!=='string'||!id||id.length>100)fail(400,'报告编号无效');
  const row=targetRow(s,type,id);
  if(type==='pair'){
   if(!row||!(same(row.from,uid)||same(row.to,uid)))fail(404,'报告不存在');
   const facts=pairFacts(row,clock());if(!facts)fail(409,'双方都授权新版合盘后才能解锁');
   return {type,row,moheCount:facts.moheCount,basisCount:facts.basisCount,keepUntil:row.expiresAt};
  }
  if(!row||!same(row.owner,uid))fail(404,'请先保存这次合盘，再解锁完整版');
  const mohe=(row.hits||[]).filter(h=>h.kind==='mohe').length;
  return {type,row,moheCount:mohe,basisCount:null,keepUntil:null};
 }
 function memberBalance(s,uid,now){
  if(!isMember(s,uid,now))return {member:false,remaining:0,monthly:0};
  const monthly=memberMonthly();
  const used=credits(s).filter(c=>same(c.userId,uid)&&c.month===monthKey(now)&&c.status==='used').length;
  return {member:true,remaining:Math.max(0,monthly-used),monthly};
 }
 // 报告里附带的购买信息：前端据此决定是否显示付款按钮。≤1 处磨合点 → sellable:false，不出付款入口。
 function offerIn(s,uid,type,row){
  const now=clock(),t=target(s,uid,type,row.id),unlocked=isUnlockedIn(s,type,t.row),sellable=t.moheCount>1;
  const bal=memberBalance(s,uid,now);
  return {sellable,unlocked,payEnabled:enabled()&&sellable&&!unlocked,creditEnabled:sellable&&!unlocked&&bal.member&&bal.remaining>0,
   priceMinor:config.priceMinor,currency:'CNY',channels:enabled()?CHANNELS:[],moheCount:sellable?t.moheCount:null,basisCount:sellable?t.basisCount:null,
   member:bal.member,memberRemaining:bal.remaining,memberMonthly:bal.member?bal.monthly:memberMonthly(),
   keepUntil:t.keepUntil,refundRule:REFUND_RULE,unlockedBy:unlocked?(same(unlockOf(type,t.row).unlockedBy,uid)?'me':'peer'):null,
   advisorQrUrl:unlocked||!sellable?config.advisorQrUrl:null};
 }
 function applyUnlockIn(s,type,row,uid,source,now){
  if(typeof hooks.beforeUnlockWrite==='function')hooks.beforeUnlockWrite({type,row,uid,source});
  setUnlock(type,row,{unlockedAt:iso(now),unlockedBy:uid,source,payerFirstOpenedFullAt:null});
 }
 // 核对中台查单结果并落账（轮询和回调共用）。只信中台查单，不信回调正文里的金额。
 async function confirm(orderId){
  const s0=store.read(),o0=orders(s0).find(o=>o.id===orderId);if(!o0||!o0.hubOrderId)fail(404,'订单不存在');
  const r=await client.status(o0.hubOrderId);
  if(r.order_no!==o0.hubOrderId||r.out_ref!==o0.id||!['paid','pending','failed'].includes(r.status))fail(502,'支付通道返回的订单对不上');
  if(r.status==='paid'&&toMinor(r.amount)!==o0.amountMinor)return store.transaction(s=>{const o=orders(s).find(o=>o.id===orderId);if(o.status!=='paid'){o.status='payment_review';o.reviewReason='amount_mismatch';o.updatedAt=iso(clock());}return publicOrder(o);});
  return store.transaction(s=>{
   const now=clock(),o=orders(s).find(o=>o.id===orderId);o.lastHubCheckAt=iso(now);
   if(r.status==='paid'){
    if(o.status==='paid'||o.status==='refunded')return publicOrder(o);
    o.status='paid';o.paidAt=iso(now);o.updatedAt=iso(now);
    const row=targetRow(s,o.target.type,o.target.id),alive=row&&(o.target.type==='pair'?(same(row.from,o.userId)||same(row.to,o.userId))&&row.status==='ready':same(row.owner,o.userId));
    if(!alive)o.refundRequest={at:iso(now),reason:'target_gone'};
    else if(isUnlockedIn(s,o.target.type,row))o.refundRequest={at:iso(now),reason:'already_unlocked'};// 两边同时付了：后到的那笔退
    else{try{applyUnlockIn(s,o.target.type,row,o.userId,{kind:'order',orderId:o.id,orderNo:o.hubOrderId},now);}catch(e){o.refundRequest={at:iso(now),reason:'unlock_failed'};}}
    return publicOrder(o);
   }
   if(r.status==='failed'){
    if(o.status==='paid')refundOrderIn(s,o,'hub_failed_after_paid',now);
    else if(o.status==='pending'){o.status='failed';o.updatedAt=iso(now);}
   }
   return publicOrder(o);
  });
 }
 return {
  config:{priceMinor:config.priceMinor,advisorQrUrl:config.advisorQrUrl},
  enabled,
  offerFor(uid,type,row,s=store.read()){try{return offerIn(s,uid,type,row);}catch{return null;}},
  offerPreview(uid){const bal=memberBalance(store.read(),uid,clock());return {payEnabled:enabled(),creditEnabled:bal.member&&bal.remaining>0};},
  isUnlocked(type,row,s=store.read()){return isUnlockedIn(s,type,row);},
  offer(uid,{type,id}={}){const s=store.read();const t=target(s,uid,type,id);return offerIn(s,uid,type,t.row);},
  async createOrder(uid,{type,id,channel}={}){
   if(!enabled())fail(503,'完整版暂未开放购买');
   if(!CHANNELS.includes(channel))fail(400,'请选择支付宝或微信支付');
   const now=clock();
   const local=store.transaction(s=>{
    const t=target(s,uid,type,id);
    if(t.moheCount<=1)fail(409,'你们的报告已全部展示，不用解锁');
    if(isUnlockedIn(s,type,t.row))fail(409,'这份报告已经解锁了');
    const mine=orders(s).filter(o=>same(o.userId,uid));
    const open=mine.find(o=>o.status==='pending'&&o.target.type===type&&o.target.id===id&&o.channel===channel&&Date.parse(o.expiresAt)>now+5*60000);
    if(open)return {reuse:publicOrder(open)};
    if(mine.filter(o=>now-Date.parse(o.createdAt)<10*60000).length>=5||mine.filter(o=>now-Date.parse(o.createdAt)<DAY).length>=20)fail(429,'下单太频繁，请稍后再试');
    const o={id:'hp'+crypto.randomBytes(12).toString('hex'),provider:'hub_hepan',sku:SKU,userId:uid,target:{type,id},amountMinor:config.priceMinor,currency:'CNY',channel,status:'opening',createdAt:iso(now),updatedAt:iso(now),expiresAt:iso(now+ORDER_TTL_MS)};
    orders(s).push(o);return {order:o};
   });
   if(local.reuse)return local.reuse;
   const o=local.order;let r;
   try{r=await client.create({method:channel,product:PRODUCT,amount:o.amountMinor/100,outRef:o.id});}
   catch(e){store.transaction(s=>{const x=orders(s).find(x=>x.id===o.id);x.status='failed';x.updatedAt=iso(clock());});throw e;}
   const payload=channel==='wechat'?r.code_url:r.qr_code;
   const okPayload=channel==='wechat'?/^weixin:\/\/[\x21-\x7e]{4,500}$/.test(payload||''):/^https:\/\/[\x21-\x7e]{4,500}$/.test(payload||'');
   const good=typeof r.order_no==='string'&&/^[A-Za-z0-9]{6,64}$/.test(r.order_no)&&toMinor(r.amount)===o.amountMinor&&r.method===channel&&okPayload;
   const out=store.transaction(s=>{const x=orders(s).find(x=>x.id===o.id);x.updatedAt=iso(clock());
    if(!good){x.status='failed';x.reviewReason='hub_create_mismatch';if(typeof r.order_no==='string')x.hubOrderId=r.order_no.slice(0,64);return null;}
    x.status='pending';x.hubOrderId=r.order_no;x.checkout=channel==='wechat'?{codeUrl:payload}:{qrCode:payload};return publicOrder(x);});
   if(!out)fail(502,'支付通道返回的订单对不上，请稍后再试');
   return out;
  },
  // 前端轮询：待付款就去中台查一次；已付款的每 10 分钟最多复查一次（中台退款后会显示 failed）。
  async poll(uid,orderId){
   const s=store.read(),o=orders(s).find(o=>o.id===orderId&&same(o.userId,uid));if(!o)fail(404,'订单不存在');
   const recheck=o.status==='paid'&&clock()-Date.parse(o.lastHubCheckAt||o.paidAt)>RECHECK_PAID_MS;
   if(!enabled()||!o.hubOrderId||!(o.status==='pending'||recheck))return publicOrder(o);
   if(o.status==='pending'&&Date.parse(o.expiresAt)<clock()-ORDER_TTL_MS)return store.transaction(n=>{const x=orders(n).find(x=>x.id===orderId);if(x.status==='pending'){x.status='expired';x.updatedAt=iso(clock());}return publicOrder(x);});
   return confirm(orderId);
  },
  // 中台回调：先验签（原始字节），再核对项目与单号，最后主动查单确认。重复回调无副作用。
  async callback(raw,signature,projectHeader){
   if(!client||!config.ready)fail(503,'未配置');
   if(!client.verify(raw,signature))fail(401,'签名无效');
   let body;try{body=JSON.parse(raw.toString('utf8'));}catch{fail(400,'回调格式无效');}
   if(body?.project_id!==config.projectId||projectHeader&&projectHeader!==config.projectId)fail(400,'项目不匹配');
   const o=orders(store.read()).find(o=>o.hubOrderId===body.order_no&&o.id===body.out_ref);if(!o)fail(404,'订单不存在');
   if(o.status==='paid'||o.status==='refunded')return {ok:true,duplicate:true};
   if(body.status!=='paid')return {ok:true,ignored:true};
   const r=await confirm(o.id);return {ok:true,status:r.status};
  },
  // 会员用份数解锁：幂等键 = 目标 + 用户 + v4；同一事务里扣份数和写解锁，写解锁失败就退回份数。
  unlockWithCredit(uid,{type,id}={}){
   return store.transaction(s=>{
    const now=clock(),t=target(s,uid,type,id);
    if(t.moheCount<=1)fail(409,'你们的报告已全部展示，不用解锁');
    const key=type+':'+id+':'+uid+':v4',prev=credits(s).find(c=>c.key===key&&c.status==='used');
    if(isUnlockedIn(s,type,t.row))return {unlocked:true,duplicate:true,remaining:memberBalance(s,uid,now).remaining};
    const bal=memberBalance(s,uid,now);
    let c=prev;
    if(!c){
     if(!bal.member)fail(403,'会员才有每月解锁份数');
     if(bal.remaining<=0)fail(409,'本月的会员份数已用完，下个月 1 号恢复');
     const m=(s.billingOrders||[]).filter(o=>same(o.userId,uid)&&memberOrderLive(o,now)).sort((a,b)=>Date.parse(b.paidAt)-Date.parse(a.paidAt))[0];
     c={id:crypto.randomUUID(),key,userId:uid,membershipOrderId:m.id,month:monthKey(now),target:{type,id},status:'used',createdAt:iso(now)};credits(s).push(c);
    }
    try{applyUnlockIn(s,type,t.row,uid,{kind:'credit',creditId:c.id,membershipOrderId:c.membershipOrderId,month:c.month},now);}
    catch(e){if(c!==prev){const i=credits(s).indexOf(c);if(i>=0)credits(s).splice(i,1);}throw Object.assign(Error('解锁没有写入，份数已退回，请重试'),{status:500});}
    return {unlocked:true,remaining:memberBalance(s,uid,now).remaining};
   });
  },
  // 付款人第一次看到完整版时记下时间（7 天退款规则用）。只记付款人本人。
  markOpened(uid,type,id){
   const row=targetRow(store.read(),type,id),u=unlockOf(type,row);if(!u||u.payerFirstOpenedFullAt||!same(u.unlockedBy,uid))return;
   try{store.transaction(s=>{const r=targetRow(s,type,id),x=unlockOf(type,r);if(x&&!x.payerFirstOpenedFullAt&&same(x.unlockedBy,uid))x.payerFirstOpenedFullAt=iso(clock());});}catch{}
  }
 };
}
module.exports={createHepanPayService,createHubClient,payConfig,advisorQr,consentRevokedIn,refundOrderIn,revokeMembershipIn,unlockValid,isUnlockedIn,monthKey,toMinor,SKU,REFUND_RULE,REVOKE_WINDOW_MS,PRODUCT};
