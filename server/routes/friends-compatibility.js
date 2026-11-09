'use strict';
const {errorBody:xbError}=require('../lib/friends-cross-border');
const {createRateLimit}=require('../lib/friends-admin');
function createCompatibilityRouter({express,auth,service,selfService=null,canAccess=()=>true}={}){const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');next();});router.get('/status',(req,res)=>res.json(service.status()));router.use(auth);router.use((req,res,next)=>req.user?.id!==undefined?next():res.status(401).json({error:'请先登录'}));router.use((req,res,next)=>canAccess(req)?next():res.status(403).json({error:'当前为邀请测试'}));router.use(createRateLimit({limit:60}));router.use((req,res,next)=>{if(req.method==='POST'&&(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||req.get('Origin')&&req.get('Origin')!==`${req.protocol}://${req.get('Host')}`))return res.status(403).json({error:'请从本站操作'});next();});const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json(e.status?xbError(e):{error:'双人关系指南暂不可用'});}};router.get('/pairs',run(req=>service.list(req.user.id)));router.post('/pairs',run(req=>service.create(req.user.id,req.body)));router.post('/claim',run(req=>service.claim(req.user.id,req.body)));router.get('/pairs/:id',run(req=>service.get(req.user.id,req.params.id)));router.post('/pairs/:id/confirm-recipient',run(req=>service.confirmRecipient(req.user.id,req.params.id,req.body)));router.post('/pairs/:id/authorize',run(req=>service.authorize(req.user.id,req.params.id,req.body)));router.post('/pairs/:id/revoke',run(req=>service.revoke(req.user.id,req.params.id)));router.post('/pairs/:id/decline',run(req=>service.decline(req.user.id,req.params.id)));router.get('/pairs/:id/messages',run(req=>service.messages(req.user.id,req.params.id,req.query)));router.post('/pairs/:id/messages',run(req=>service.sendMessage(req.user.id,req.params.id,req.body)));router.get('/pairs/:id/report',run(req=>service.report(req.user.id,req.params.id)));
 // 自己合盘：只本人可见；次数按账号/设备/IP 三重计（设备号来自本地随机 ID，IP 走 trust proxy）。
 if(selfService){const ctx=req=>({device:req.get('X-Xs-Device')||null,ip:req.ip||null});
  router.get('/self/quota',run(req=>selfService.quota(req.user.id,ctx(req))));
  router.post('/self',createRateLimit({limit:10}),run(req=>selfService.run(req.user.id,req.body,ctx(req))));
  router.get('/self/saved',run(req=>selfService.list(req.user.id)));
  router.post('/self/saved',run(req=>selfService.save(req.user.id,req.body)));
  router.get('/self/saved/:id',run(req=>selfService.get(req.user.id,req.params.id)));
  router.post('/self/saved/:id/delete',run(req=>selfService.remove(req.user.id,req.params.id)));}
 return router;}
module.exports={createCompatibilityRouter};
