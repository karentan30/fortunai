'use strict';
const XB=require('./friends-cross-border');
// 相生会员直连收款（支付宝当面付 / 微信 Native），复用 server/pay.js，不另写支付客户端。
// 红线：总开关 FRIENDS_SALES_OPEN 默认关；回调必验签 + 订单归属 + 金额/币种/SKU 对 PILOT_CATALOG + 幂等，只发一次会员。
// Orders live in the same billingOrders collection, so isMember()/quotas read them with no special case.
const crypto=require('node:crypto');
const {PILOT_CATALOG,anniversary,memberUntil}=require('./friends-membership');
const SALE_SKUS=Object.freeze(Object.values(PILOT_CATALOG).filter(p=>p.sellable===true&&p.matchingMembership===true).map(p=>p.sku));
const CHANNELS=['alipay','wechat'];
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const yuanToMinor=v=>{const t=String(v??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(t))return NaN;const [a,b='']=t.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));};
const publicOrder=o=>({id:o.id,sku:o.sku,name:PILOT_CATALOG[o.sku]?.name||'',status:o.status,amountMinor:o.amountMinor,currency:o.currency,channel:o.channel,createdAt:o.createdAt,expiresAt:o.expiresAt,paidAt:o.paidAt||null,accessUntil:o.accessUntil||null,...(o.status==='pending'&&o.checkout?{checkout:o.checkout}:{})});
const lists=s=>{for(const k of ['billingOrders','billingEvents'])if(!Array.isArray(s[k]))s[k]=[];return s;};

// Real provider: thin adapter over server/pay.js. `pay` is injectable so tests never touch the network.
function createPayJsProvider({pay=require('../pay'),env=process.env}={}){
  return {
    ready(channel){return channel==='alipay'?pay.alipayReady():channel==='wechat'?pay.wechatReady():false;},
    async create(channel,{outTradeNo,amountMinor,subject,notifyUrl,clientIp}){
      if(channel==='wechat'){const r=await pay.wxUnifiedOrder(outTradeNo,amountMinor,subject,clientIp,notifyUrl);if(r?.return_code==='SUCCESS'&&r.result_code==='SUCCESS'&&typeof r.code_url==='string'&&r.code_url)return {codeUrl:r.code_url};fail(502,'微信下单失败，请稍后再试');}
      const r=await pay.alipayPrecreate(outTradeNo,(amountMinor/100).toFixed(2),subject,notifyUrl);if(r?.ok&&typeof r.qr_code==='string'&&r.qr_code)return {qrCode:r.qr_code};fail(502,'支付宝下单失败，请稍后再试');
    },
    // Server-to-provider query over HTTPS. Returns null when not paid / unknown.
    async query(channel,outTradeNo){
      if(channel==='wechat'){const r=await pay.wxOrderQuery(outTradeNo);if(r?.return_code!=='SUCCESS'||r.result_code!=='SUCCESS'||r.trade_state!=='SUCCESS'||r.out_trade_no!==outTradeNo)return null;return {outTradeNo,amountMinor:Number(r.total_fee),currency:(r.fee_type||'CNY').toUpperCase(),tradeNo:String(r.transaction_id||''),appOk:r.appid===env.WECHAT_APP_ID&&r.mch_id===env.WECHAT_MCH_ID};}
      const r=await pay.alipayQuery(outTradeNo);if(!r?.paid)return null;return {outTradeNo,amountMinor:yuanToMinor(r.totalAmount),currency:'CNY',tradeNo:String(r.tradeNo||''),appOk:true};
    },
    // Signed notify → normalized payment, or {ok:false} on a bad signature.
    verifyNotify(channel,body){
      if(channel==='wechat'){if(typeof body!=='string'||!body)return {ok:false};const v=pay.wxVerifyNotify(body),d=v.data||{};if(!v.ok)return {ok:false};
        return {ok:true,paid:d.return_code==='SUCCESS'&&d.result_code==='SUCCESS',outTradeNo:d.out_trade_no,amountMinor:Number(d.total_fee),currency:(d.fee_type||'CNY').toUpperCase(),tradeNo:String(d.transaction_id||''),appOk:d.appid===env.WECHAT_APP_ID&&d.mch_id===env.WECHAT_MCH_ID};}
      if(!body||typeof body!=='object'||!pay.alipayVerifyNotify({...body}))return {ok:false};
      return {ok:true,paid:['TRADE_SUCCESS','TRADE_FINISHED'].includes(body.trade_status),outTradeNo:body.out_trade_no,amountMinor:yuanToMinor(body.total_amount),currency:'CNY',tradeNo:String(body.trade_no||''),appOk:body.app_id===env.ALIPAY_APP_ID};
    },
    reply(channel,ok){return channel==='wechat'?{type:'application/xml',body:pay.wxReplyXml(ok)}:{type:'text/plain',body:ok?'success':'fail'};}
  };
}

function createMembershipSales(store,{provider=null,salesOpen=false,notifyBase='',clock=()=>Date.now(),orderTtlMs=2*3600000}={}){
  const nowISO=()=>new Date(clock()).toISOString();
  const base=(()=>{try{const u=new URL(notifyBase);return u.protocol==='https:'&&!u.username&&!u.password?u.origin+u.pathname.replace(/\/+$/,''):'';}catch(_){return '';}})();
  const channels=()=>salesOpen===true&&!!base&&provider?CHANNELS.filter(c=>{try{return provider.ready(c)===true;}catch(_){return false;}}):[];
  const open=()=>channels().length>0;
  const own=(s,uid,id)=>{const o=(s.billingOrders||[]).find(o=>o.id===id&&o.userId===uid&&o.provider==='direct');if(!o)fail(404,'订单不存在');return o;};
  const outTradeNo=()=>'xs_'+new Date(clock()).toISOString().replace(/[-:T.Z]/g,'').slice(2,14)+'_'+crypto.randomBytes(5).toString('hex');

  // The only place membership is granted. Must run inside a store transaction. Returns {ok, duplicate?, review?}.
  function settle(s,pay,source){
    lists(s);
    const o=s.billingOrders.find(o=>o.provider==='direct'&&o.outTradeNo===pay.outTradeNo);
    if(!o)return {ok:false,status:404,reason:'order_not_found'};
    const product=PILOT_CATALOG[o.sku];
    const eventId='direct:'+o.channel+':'+(pay.tradeNo||pay.outTradeNo);
    if(s.billingEvents.some(e=>e.eventId===eventId)||o.status==='paid')return {ok:true,duplicate:true,order:o};
    // Server-side truth: SKU must be sellable and amount/currency must equal the catalog and the order, app id must be ours.
    const mismatch=!product||!SALE_SKUS.includes(o.sku)||pay.amountMinor!==product.amountMinor||pay.amountMinor!==o.amountMinor||pay.currency!=='CNY'||o.currency!=='CNY'||pay.appOk!==true;
    if(mismatch){
      if(o.status==='pending'){o.status='payment_review';o.reviewReason='amount_or_merchant_mismatch';}
      s.billingEvents.push({eventId:eventId+':rejected',orderId:o.id,status:'rejected',verification:source,amountMinor:pay.amountMinor,createdAt:nowISO()});
      return {ok:false,status:400,reason:'mismatch',order:o};
    }
    if(o.status!=='pending'&&o.status!=='expired')return {ok:false,status:409,reason:'order_state',order:o};
    const now=clock(),from=Math.max(now,memberUntil(s,o.userId,now)); // manual renewal extends, never overlaps
    Object.assign(o,{status:'paid',paidAt:new Date(now).toISOString(),accessFrom:new Date(from).toISOString(),accessMonths:product.accessMonths,matchingMembership:true,
      benefitsVerified:true /* benefits enforced in code: friends-quotas, viewers, member filters */,accessUntil:new Date(anniversary(new Date(from).toISOString(),product.accessMonths)).toISOString(),providerTradeNo:pay.tradeNo||null});
    delete o.checkout;
    s.billingEvents.push({eventId,orderId:o.id,status:'paid',verification:source,createdAt:nowISO()});
    return {ok:true,duplicate:false,order:o};
  }

  return {
    SALE_SKUS,
    status(uid){
      const s=store.read(),list=channels(),until=uid!==undefined&&uid!==null?memberUntil(s,uid,clock()):0;
      return {open:list.length>0,channels:list,autoRenew:false,
        products:SALE_SKUS.map(sku=>{const p=PILOT_CATALOG[sku];return {sku,name:p.name,amountMinor:p.amountMinor,currency:p.currency,accessMonths:p.accessMonths};}),
        member:until?{active:true,until:new Date(until).toISOString()}:{active:false,until:null}};
    },
    async checkout(uid,{sku,channel}={},{clientIp}={}){XB.check(store,uid);
      if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
      if(!open())fail(503,'暂未开放购买');
      if(!SALE_SKUS.includes(sku))fail(400,'该商品暂不可购买');
      if(!channels().includes(channel))fail(400,'该支付方式暂不可用');
      const p=PILOT_CATALOG[sku];
      const order=store.transaction(s=>{lists(s);
        const fresh=s.billingOrders.filter(o=>o.userId===uid&&o.provider==='direct'&&o.status==='pending'&&Date.parse(o.createdAt)>clock()-60000);
        if(fresh.length>=3)fail(429,'下单太频繁，请稍后再试');
        const o={id:'XS-'+crypto.randomUUID(),provider:'direct',outTradeNo:outTradeNo(),userId:uid,sku,channel,amountMinor:p.amountMinor,currency:p.currency,status:'creating',createdAt:nowISO(),expiresAt:new Date(clock()+orderTtlMs).toISOString()};
        s.billingOrders.push(o);return structuredClone(o);});
      let checkout;
      try{checkout=await provider.create(channel,{outTradeNo:order.outTradeNo,amountMinor:p.amountMinor,subject:'相生'+p.name+'（不自动续费）',notifyUrl:base+'/'+channel,clientIp});}
      catch(e){store.transaction(s=>{const o=own(s,uid,order.id);if(o.status==='creating')o.status='failed';});if(e.status)throw e;fail(502,'发起支付失败，请稍后再试');}
      return store.transaction(s=>{const o=own(s,uid,order.id);if(o.status==='creating')Object.assign(o,{status:'pending',checkout});return publicOrder(o);});
    },
    // Poll: owner only. Pending orders are confirmed by a fresh server-side provider query, never by the browser.
    async order(uid,id){
      const snapshot=own(store.read(),uid,id);
      if(snapshot.status==='pending'&&provider&&channels().includes(snapshot.channel)){
        let paid=null;try{paid=await provider.query(snapshot.channel,snapshot.outTradeNo);}catch(_){paid=null;}
        if(paid&&paid.outTradeNo===snapshot.outTradeNo)store.transaction(s=>settle(s,paid,'query'));
        else if(Date.parse(snapshot.expiresAt)<clock())store.transaction(s=>{const o=own(s,uid,id);if(o.status==='pending'){o.status='expired';delete o.checkout;}});
      }
      return publicOrder(own(store.read(),uid,id));
    },
    // Provider notify. Bad signature → no state change at all.
    notify(channel,body){
      if(!CHANNELS.includes(channel)||!provider)fail(404,'未知支付渠道');
      const v=provider.verifyNotify(channel,body);
      if(!v?.ok){const e=Error('支付回调签名无效');e.status=401;e.reply=provider.reply(channel,false);throw e;}
      if(!v.paid)return {ok:true,ignored:true,reply:provider.reply(channel,true)};
      const r=store.transaction(s=>{const out=settle(s,v,'notify');return {ok:out.ok,duplicate:!!out.duplicate,status:out.status,reason:out.reason};});
      if(!r.ok){const e=Error(r.reason==='mismatch'?'回调金额或商户不符':'回调订单无法入账');e.status=r.status||400;e.reply=provider.reply(channel,false);throw e;}
      return {...r,reply:provider.reply(channel,true)};
    }
  };
}
// Production wiring: one switch FRIENDS_SALES_OPEN=true + https FRIENDS_PAY_NOTIFY_BASE + pay.js channel env.
function configuredMembershipSales(store,{env=process.env,load=()=>createPayJsProvider({env})}={}){
  const salesOpen=env.FRIENDS_SALES_OPEN==='true';
  let provider=null;if(salesOpen){try{provider=load();}catch(e){console.error('[friends] membership pay provider not ready');provider=null;}}
  return createMembershipSales(store,{provider,salesOpen,notifyBase:env.FRIENDS_PAY_NOTIFY_BASE||''});
}
module.exports={createMembershipSales,createPayJsProvider,configuredMembershipSales,SALE_SKUS,yuanToMinor};
