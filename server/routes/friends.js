'use strict';
const path=require('node:path');
const {createFriendsStore}=require('../lib/friends-store');
const {createChartService}=require('../lib/friends-chart');
const {createFriendsService}=require('../lib/friends-service');
function createRouter({express,auth,store,secret,enabled=true}) {
  const router=express.Router();
  const charts=enabled?createChartService(secret):null;
  const service=enabled?createFriendsService(store,charts):null;
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').set('X-Content-Type-Options','nosniff');
    if(!enabled)return res.status(503).json({error:'交友功能尚未开放，请稍后再来'});
    if(['POST','DELETE','PUT','PATCH'].includes(req.method)) {
      // Browser client must send JSON and this same-origin-only header. Cross-origin preflights have no matching allowlist here.
      if(req.get('X-Runae-Friends')!=='1'||!req.is('application/json'))return res.status(403).json({error:'请从本站页面操作'});
      if(req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'不允许跨站操作'});
      const origin=req.get('Origin');
      if(origin){let url;try{url=new URL(origin);}catch(_){return res.sendStatus(403);}if(url.origin!==`${req.protocol}://${req.get('Host')}`)return res.status(403).json({error:'不允许跨站操作'});}
    }
    next();
  });
  const run=fn=>(req,res,next)=>{try{res.json(fn(req));}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}};
  router.post('/chart',run(req=>charts.issue(req.body)));
  router.use(auth);
  router.get('/card/:shareId',run(req=>({profile:service.card(req.params.shareId,req.user?.id)})));
  router.use((req,res,next)=>req.user?next():res.status(401).json({error:'请先登录 Runae 账号'}));
  router.get('/me',run(req=>({profile:service.me(req.user.id)})));
  router.post('/profile',run(req=>({profile:service.save(req.user.id,req.body)})));
  router.delete('/profile',run(req=>service.remove(req.user.id)));
  router.get('/discover',run(req=>service.discover(req.user.id,req.query)));
  router.get('/requests',run(req=>({requests:service.requests(req.user.id)})));
  router.post('/requests',run(req=>service.request(req.user.id,req.body.shareId)));
  router.post('/requests/:id',run(req=>service.act(req.user.id,req.params.id,req.body.action)));
  router.post('/block',run(req=>service.block(req.user.id,req.body.shareId)));
  router.post('/report',run(req=>service.report(req.user.id,req.body.shareId,req.body.reason)));
  router.use((err,req,res,next)=>{console.error('[friends]',err.name);res.status(500).json({error:'交友服务暂时不可用，请稍后重试'});});
  return router;
}
function productionRouter(){
  const enabled=process.env.FRIENDS_ENABLED==='true';
  const express=require('express');
  const {authMiddleware}=require('../middleware');
  const file=process.env.FRIENDS_DATA_FILE||path.join(__dirname,'../friends-data.json');
  return createRouter({express,auth:authMiddleware,enabled,secret:process.env.FRIENDS_SIGNING_KEY,store:enabled?createFriendsStore(file):null});
}
module.exports={createRouter,productionRouter};
