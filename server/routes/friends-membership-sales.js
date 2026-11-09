'use strict';
const {errorBody:xbError}=require('../lib/friends-cross-border');
// 相生会员直连收款路由。notify 路由必须挂在任何鉴权/CSRF 中间件之前（支付平台服务器直接回调）。
function createMembershipNotifyRouter({express,service}){
  const router=express.Router();
  const handle=channel=>(req,res)=>{
    res.set('Cache-Control','no-store');
    try{const r=service.notify(channel,req.body);res.type(r.reply.type).send(r.reply.body);}
    catch(e){if(!e.reply)console.error('[friends-pay] notify error',e.status||500);res.status(e.status&&e.status<500?e.status:500).type(e.reply?.type||'text/plain').send(e.reply?.body||'fail');}
  };
  router.post('/wechat',express.text({type:'*/*',limit:'64kb'}),handle('wechat'));
  router.post('/alipay',express.urlencoded({extended:false,limit:'64kb'}),handle('alipay'));
  return router;
}
function createMembershipSalesRouter({express,auth,service}){
  const router=express.Router();
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json(e.status?xbError(e):{error:'支付服务暂不可用，请稍后再试'});}};
  // Public: whether sales are open + prices. Shows the signed-in user's own membership only if an upstream optional auth set req.user.
  router.get('/status',run(req=>service.status(req.user?.id)));
  router.use(auth);
  router.use((req,res,next)=>req.user?.id!==undefined&&req.user?.id!==null?next():res.status(401).json({error:'请先登录'}));
  router.use((req,res,next)=>{
    if(req.method==='POST'){
      if(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'请从本站操作'});
      const origin=req.get('Origin');if(origin&&origin!==`${req.protocol}://${req.get('Host')}`)return res.status(403).json({error:'不允许跨站操作'});
    }
    next();
  });
  // Signed-in view of the same status, including the caller's own membership end date.
  router.get('/me',run(req=>service.status(req.user.id)));
  router.post('/checkout',run(req=>service.checkout(req.user.id,{sku:req.body?.sku,channel:req.body?.channel},{clientIp:String(req.ip||'').replace(/^::ffff:/,'')||'127.0.0.1'})));
  router.get('/orders/:id',run(req=>service.order(req.user.id,String(req.params.id))));
  return router;
}
module.exports={createMembershipNotifyRouter,createMembershipSalesRouter};
