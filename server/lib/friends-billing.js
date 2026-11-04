'use strict';
const crypto=require('node:crypto');
const COLLECTIONS=['billingOrders','billingEvents','creditLedger','creditReservations'];
const CATALOG=Object.freeze({friends_report_199:{sku:'friends_report_199',name:'个人报告',amountMinor:19900,currency:'CNY',reportCredits:1,accessDays:0},friends_year_399:{sku:'friends_year_399',name:'年卡含一份报告',amountMinor:39900,currency:'CNY',reportCredits:1,accessDays:365}});
Object.values(CATALOG).forEach(Object.freeze);
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const normalize=s=>{for(const key of COLLECTIONS){if(s[key]===undefined)s[key]=[];if(!Array.isArray(s[key]))throw Error('计费资料损坏');}return s;};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const validKey=key=>typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key);
const own=(s,uid,id)=>{const o=(s.billingOrders||[]).find(o=>o.id===id&&o.userId===uid);if(!o)fail(404,'订单不存在');return o;};
const publicOrder=o=>({id:o.id,sku:o.sku,status:o.status,amountMinor:o.amountMinor,currency:o.currency,channel:o.channel,createdAt:o.createdAt,expiresAt:o.expiresAt,paidAt:o.paidAt,accessUntil:o.accessUntil,checkout:o.checkout});
// Real shared client contract, not a payment gateway implementation. No loading of env secrets here.
function createHubAdapter(client,{timeoutMs=10000}={}){
  async function bounded(operation){let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('支付中台查询超时'),{status:502})),timeoutMs);})]);}finally{clearTimeout(timer);}}
  const secureBase=(()=>{try{return new URL(client?.HUB_BASE).protocol==='https:';}catch(_){return false;}})();
  return {ready:secureBase&&client?.HUB_SECRET==='(configured)'&&typeof client.create==='function'&&typeof client.status==='function'&&typeof client.verifyCallback==='function',projectId:client?.PROJECT_ID,
  async freshStatus(hubOrderId){const r=await bounded(()=>client.status(hubOrderId));if(r?.ok!==true||r.order_no!==hubOrderId||!['paid','pending','failed'].includes(r.status)||typeof r.out_ref!=='string'||!r.out_ref||typeof r.currency!=='string'||!r.currency.match(/^[a-z]{3}$/i))fail(502,'中台查单证据不完整');return {hubOrderId:r.order_no,localOrderId:r.out_ref,amountMinor:majorToMinor(r.amount),currency:r.currency.toUpperCase(),status:r.status,rawStatus:r.raw_status||null};},
  async create(order,registration){const r=await bounded(()=>client.create(order.channel,registration.product,order.amountMinor/100,order.id,{...registration.returnUrls,currency:order.currency.toLowerCase()}));if(r?.ok!==true||!r.order_no)fail(502,'支付中台未返回有效订单');const receipt=await this.freshStatus(r.order_no);if(receipt.localOrderId!==order.id||majorToMinor(r.amount)!==receipt.amountMinor)fail(502,'中台建单与查单绑定不一致');return {hubOrderId:r.order_no,amountMinor:receipt.amountMinor,currency:receipt.currency,channel:r.method,checkout:{...(r.url?{url:r.url}:{}),...(r.code_url?{codeUrl:r.code_url}:{}),...(r.qr_code?{qrCode:r.qr_code}:{})}};},
  verify(raw,signature){return this.ready&&client.verifyCallback(raw,signature)===true;}
};}
function majorToMinor(value){const text=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(text))fail(400,'到账金额格式无效');const [whole,fraction='']=text.split('.'),amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(amount))fail(400,'到账金额无效');return amount;}
function createBillingService(store,{adapter=null,enabled=false,merchantVerified=false,merchantName='',callbackV2Verified=false,freshPullVerified=false,registrations={},clock=()=>Date.now()}={}){
  const nowISO=()=>new Date(clock()).toISOString();
  const ready=()=>enabled&&merchantVerified&&merchantName==='Capstone IQ'&&(callbackV2Verified||(freshPullVerified&&typeof adapter?.freshStatus==='function'))&&adapter?.ready&&typeof adapter.projectId==='string'&&!!adapter.projectId;
  const registration=(sku,channel)=>{const product=CATALOG[sku],r=registrations[sku];return product&&r?.verified===true&&r.amountMinor===product.amountMinor&&r.currency===product.currency&&typeof r.product==='string'&&r.product.length>0&&Array.isArray(r.channels)&&r.channels.includes(channel)?r:null;};
  const ledger=(s,entry)=>s.creditLedger.push({id:crypto.randomUUID(),createdAt:nowISO(),...entry});
  const orderAvailable=(s,id,unit)=>(s.creditLedger||[]).filter(e=>e.orderId===id&&e.unit===unit).reduce((sum,e)=>sum+e.delta,0);
  const live=o=>o.status==='paid'&&(!o.accessUntil||Date.parse(o.accessUntil)>clock());
  const balanceIn=(s,uid,unit)=>(s.billingOrders||[]).filter(o=>o.userId===uid&&live(o)).reduce((sum,o)=>sum+Math.max(0,orderAvailable(s,o.id,unit)),0);
  async function reconcile(uid,id){const snapshot=own(store.read(),uid,id);if(!ready()||!freshPullVerified||!snapshot.hubOrderId)return publicOrder(snapshot);const receipt=await adapter.freshStatus(snapshot.hubOrderId);
    if(receipt.hubOrderId!==snapshot.hubOrderId||receipt.localOrderId!==id||receipt.amountMinor!==snapshot.amountMinor||receipt.currency!==snapshot.currency)fail(502,'查单订单、金额或币种不符');
    return store.transaction(s=>{normalize(s);const o=own(s,uid,id),digest=hash(JSON.stringify(receipt)),eventId='pull-'+hash(o.id+digest);if(s.billingEvents.some(e=>e.eventId===eventId))return publicOrder(o);
      if(receipt.status==='paid'){
        if(['refunded','expired','failed','payment_review'].includes(o.status))fail(409,'订单状态异常，到账须人工核对');
        if(o.status!=='paid'){if(o.status!=='pending')fail(409,'订单尚待绑定');o.status='paid';o.paidAt=nowISO();const product=CATALOG[o.sku];if(product.accessDays)o.accessUntil=new Date(clock()+product.accessDays*86400000).toISOString();ledger(s,{orderId:o.id,userId:o.userId,unit:'report',delta:product.reportCredits,type:'grant'});}
      }else if(receipt.status==='failed'&&!['refunded','failed','expired'].includes(o.status)){
        // Legacy Hub conflates refunded/failed/closed. Freeze instead of inventing a refund.
        o.status='payment_review';o.reviewReason='hub_failed_or_refunded';
      }
      s.billingEvents.push({eventId,digest,orderId:o.id,status:receipt.status,verification:'authenticated_fresh_pull',createdAt:nowISO()});return publicOrder(o);
    });
  }
  return {
    catalog(){return {enabled:!!ready(),merchant:merchantName||null,products:Object.values(CATALOG).map(p=>{const channels=['wechat','alipay','stripe'].filter(c=>registration(p.sku,c)&&ready());return {...p,enabled:channels.length>0,channels,disabledReason:channels.length?null:'商户、商品或安全回调尚未验收，暂不可购买'};})};},
    order(uid,id){return publicOrder(own(store.read(),uid,id));},
    byKey(uid,key){if(!validKey(key))fail(400,'订单幂等键无效');const o=(store.read().billingOrders||[]).find(o=>o.userId===uid&&o.idempotencyKey===key);if(!o)fail(404,'订单不存在');return publicOrder(o);},
    reservationByKey(uid,key){if(!validKey(key))fail(400,'服务幂等键无效');const r=(store.read().creditReservations||[]).find(r=>r.userId===uid&&r.key===key);return r?structuredClone(r):null;},
    refresh:reconcile,
    balance(uid){const s=store.read();return {units:{report:balanceIn(s,uid,'report')},yearAccessUntil:(s.billingOrders||[]).filter(o=>o.userId===uid&&live(o)&&o.accessUntil).map(o=>o.accessUntil).sort().at(-1)||null};},
    async checkout(uid,{sku,channel,idempotencyKey}={}){
      if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
      if(!ready())fail(503,'支付尚未完成验收，暂不可购买');
      const r=registration(sku,channel),p=CATALOG[sku];if(!r)fail(400,'该商品或支付方式尚不可用');if(!validKey(idempotencyKey))fail(400,'请提供有效幂等键');
      const created=store.transaction(s=>{normalize(s);const previous=s.billingOrders.find(o=>o.userId===uid&&o.idempotencyKey===idempotencyKey);if(previous){if(previous.sku!==sku||previous.channel!==channel)fail(409,'幂等键已用于其他购买');return {existing:true,order:structuredClone(previous)};}const o={id:'RF-'+crypto.randomUUID(),userId:uid,idempotencyKey,sku,channel,amountMinor:p.amountMinor,currency:p.currency,status:'creating',createdAt:nowISO(),expiresAt:new Date(clock()+1800000).toISOString()};s.billingOrders.push(o);return {existing:false,order:structuredClone(o)};});
      if(created.existing){if(created.order.status==='creating'||created.order.status==='create_unknown')fail(409,'订单创建结果待核对，请勿重复付款');return publicOrder(created.order);}
      try{const result=await adapter.create(created.order,r);if(!result?.hubOrderId||result.amountMinor!==p.amountMinor||result.currency!==p.currency||result.channel!==channel)fail(502,'中台订单金额、币种或渠道未通过核验');const checkout=result.checkout||{};if(channel==='stripe'){let url;try{url=new URL(checkout.url);}catch(_){fail(502,'支付链接无效');}if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)fail(502,'支付链接须为Stripe官方HTTPS结账地址');}else if(!(checkout.codeUrl||checkout.qrCode))fail(502,'支付中台没有提供支付入口');
        return store.transaction(s=>{normalize(s);const o=own(s,uid,created.order.id);if(s.billingOrders.some(x=>x.id!==o.id&&x.hubOrderId===result.hubOrderId))fail(409,'中台订单重复');Object.assign(o,{hubOrderId:result.hubOrderId,remoteProduct:r.product,status:'pending',checkout});return publicOrder(o);});
      }catch(e){store.transaction(s=>{const o=own(s,uid,created.order.id);if(o.status==='creating')o.status='create_unknown';});if(e.status)throw e;fail(502,'发起支付结果待核对，请稍后查看订单');}
    },
    callback(raw,signature){
      if(!ready())fail(503,'支付回调尚未完成配置');if(!Buffer.isBuffer(raw)||raw.length>65536)fail(400,'回调须为原始请求体');if(!adapter.verify(raw,signature))fail(401,'支付回调签名无效');
      let p;try{p=JSON.parse(raw.toString('utf8'));}catch(_){fail(400,'回调格式无效');}
      if(freshPullVerified){if(p.project_id!==adapter.projectId||!['paid','refunded','expired','failed'].includes(p.status))fail(400,'回调项目或状态无效');const o=(store.read().billingOrders||[]).find(o=>o.id===p.out_ref&&o.hubOrderId===p.order_no);if(!o)fail(404,'回调订单不存在');if(p.method!==o.channel||p.product!==o.remoteProduct||majorToMinor(p.amount)!==o.amountMinor)fail(400,'回调订单绑定不符');return reconcile(o.userId,o.id).then(()=>({ok:true,verification:'authenticated_fresh_pull'}));}
      if(!Number.isSafeInteger(p.timestamp)||Math.abs(clock()-p.timestamp*1000)>300000||!validKey(p.nonce)||!validKey(p.event_id))fail(400,'回调缺少有效时间戳、nonce或事件号');
      if(p.project_id!==adapter.projectId||!['paid','refunded','expired','failed'].includes(p.status))fail(400,'回调项目或状态无效');
      const digest=hash(raw);
      return store.transaction(s=>{normalize(s);const old=s.billingEvents.find(e=>e.eventId===p.event_id||e.nonce===p.nonce);if(old){if(old.digest!==digest)fail(409,'回调事件或nonce重复冲突');return {ok:true,duplicate:true};}
        const o=s.billingOrders.find(o=>o.id===p.out_ref&&o.hubOrderId===p.order_no);if(!o)fail(404,'回调订单不存在');
        if(p.method!==o.channel||p.product!==o.remoteProduct||p.currency!==o.currency||majorToMinor(p.amount)!==o.amountMinor)fail(400,'回调商品、渠道、金额或币种不符');
        if(p.status==='paid'){
          if(['refunded','expired','failed'].includes(o.status))fail(409,'订单已终结，到账须人工核对');
          if(o.status!=='paid'){if(o.status!=='pending')fail(409,'订单尚待核对');if(Date.parse(o.expiresAt)<clock())fail(409,'超时到账须人工核对');o.status='paid';o.paidAt=nowISO();const product=CATALOG[o.sku];if(product.accessDays)o.accessUntil=new Date(clock()+product.accessDays*86400000).toISOString();ledger(s,{orderId:o.id,userId:o.userId,unit:'report',delta:product.reportCredits,type:'grant'});}
        }else if(p.status==='refunded'){
          if(o.status!=='paid'&&o.status!=='refunded')fail(409,'未到账订单不可退款撤权');if(o.status!=='refunded'){const available=orderAvailable(s,o.id,'report');if(available>0)ledger(s,{orderId:o.id,userId:o.userId,unit:'report',delta:-available,type:'refund_revoke'});o.status='refunded';o.refundedAt=nowISO();}
        }else if(o.status==='pending'){o.status=p.status;}else if(o.status!==p.status)fail(409,'订单状态不可逆转');
        s.billingEvents.push({eventId:p.event_id,nonce:p.nonce,digest,orderId:o.id,status:p.status,createdAt:nowISO()});return {ok:true,duplicate:false};
      });
    },
    reserve(uid,unit,quantity,idempotencyKey){if(unit!=='report'||!Number.isInteger(quantity)||quantity<1||quantity>20||!validKey(idempotencyKey))fail(400,'服务次数预扣参数无效');return store.transaction(s=>{normalize(s);const old=s.creditReservations.find(x=>x.userId===uid&&x.key===idempotencyKey);if(old){if(old.unit!==unit||old.quantity!==quantity)fail(409,'服务幂等键冲突');return structuredClone(old);}if(balanceIn(s,uid,unit)<quantity)fail(402,'可用服务次数不足');let remaining=quantity;const allocations=[];for(const o of s.billingOrders.filter(o=>o.userId===uid&&live(o))){const n=Math.min(remaining,Math.max(0,orderAvailable(s,o.id,unit)));if(n){allocations.push({orderId:o.id,quantity:n});ledger(s,{orderId:o.id,userId:uid,unit,delta:-n,type:'reserve',key:idempotencyKey});remaining-=n;}if(!remaining)break;}const reservation={id:crypto.randomUUID(),userId:uid,key:idempotencyKey,unit,quantity,allocations,status:'reserved',createdAt:nowISO()};s.creditReservations.push(reservation);return structuredClone(reservation);});},
    settle(uid,id,outcome){if(!['commit','release'].includes(outcome))fail(400,'服务结算结果无效');return store.transaction(s=>{normalize(s);const r=s.creditReservations.find(r=>r.id===id&&r.userId===uid);if(!r)fail(404,'服务预扣不存在');if(r.status!=='reserved'){if(r.status===(outcome==='commit'?'committed':'released'))return structuredClone(r);fail(409,'服务预扣已结算');}if(outcome==='commit'){if(r.allocations.some(a=>!live(own(s,uid,a.orderId))))fail(409,'权益已退款或过期，不可交付');r.status='committed';}else{for(const a of r.allocations){const o=own(s,uid,a.orderId);if(live(o))ledger(s,{orderId:o.id,userId:uid,unit:r.unit,delta:a.quantity,type:'release',key:r.key});}r.status='released';}r.updatedAt=nowISO();return structuredClone(r);});}
  };
}
module.exports={createBillingService,createHubAdapter,normalize,COLLECTIONS,CATALOG};
