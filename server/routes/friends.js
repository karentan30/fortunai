'use strict';
const path=require('node:path');
const {createSqliteFriendsStore}=require('../lib/friends-sqlite');
const {getFriendsConfig}=require('../lib/friends-config');
const {createChartService}=require('../lib/friends-chart');
const {createFriendsService}=require('../lib/friends-service');
const {searchCities}=require('../lib/friends-location');
const {searchAreas,suggestPlaces}=require('../lib/friends-places');
const {createAdminService,adminAuth,createRateLimit}=require('../lib/friends-admin');
function createRouter({express,auth,store,secret,enabled=true,adminToken=process.env.FRIENDS_ADMIN_TOKEN||process.env.ADMIN_TOKEN,onLogout,canAccess=()=>true,mode='local_review',requirePolicy=false}) {
  const router=express.Router();
  const charts=enabled?createChartService(secret):null;
  const service=enabled?createFriendsService(store,charts):null;
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').set('X-Content-Type-Options','nosniff');
    if(!enabled&&!['/logout','/status','/legal'].includes(req.path))return res.status(503).json({error:'交友功能尚未开放，请稍后再来'});
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
  const admin=enabled?createAdminService(store):null;
  router.use('/admin',createRateLimit({limit:60}),adminAuth(adminToken));
  router.get('/admin/summary',run(()=>admin.summary()));
  router.get('/admin/reports',run(req=>({reports:admin.reports(req.query.status)})));
  router.get('/admin/profiles',run(()=>({profiles:admin.profiles()})));
  router.get('/admin/audit',run(()=>({audit:admin.audit()})));
  router.get('/admin/delivery-review',run(req=>admin.deliveryReview({limit:req.query.limit===undefined?100:Number(req.query.limit),offset:req.query.offset===undefined?0:Number(req.query.offset)})));
  router.post('/admin/report-jobs/:id/release',async(req,res,next)=>{try{res.json(await admin.releaseReport(req.params.id,req.body,req.friendsAdminActor));}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}});
  router.get('/admin/health',run(()=>store.health?store.health():{ok:true,storage:'review-memory'}));
  router.post('/admin/reports/:id',run(req=>admin.review(req.params.id,req.body.status,req.body.note)));
  router.post('/admin/profiles/:id',run(req=>admin.moderate(req.params.id,req.body.disabled,req.body.reason)));
  router.use(createRateLimit({limit:180}));
  router.post('/chart',run(req=>charts.issue(req.body)));
  router.get('/status',run(()=>({enabled,mode})));
  router.get('/legal',run(()=>({operatorName:process.env.FRIENDS_OPERATOR_NAME||'',supportEmail:process.env.FRIENDS_SUPPORT_EMAIL||'',storageRegion:process.env.FRIENDS_STORAGE_REGION||'',retentionPolicy:process.env.FRIENDS_RETENTION_POLICY||'',publicReady:process.env.FRIENDS_PUBLIC_APPROVED==='true'&&enabled&&mode==='public'})));
  router.get('/cities',run(req=>({cities:searchCities(req.query.q)})));
  router.get('/areas',run(req=>({areas:searchAreas(req.query.q)})));
  router.post('/events',createRateLimit({limit:30}),run(req=>service.event(req.body.event,{source:req.body.source,campaign:req.body.campaign})));
  router.use(auth);
  router.post('/logout',(req,res,next)=>{try{if(onLogout)onLogout(req,res);else res.clearCookie('sy_token',{path:'/'});res.json({ok:true});}catch(e){next(e);}});
  router.use((req,res,next)=>canAccess(req)?next():res.status(403).json({error:'当前为邀请测试，请联系运营开通账号'}));
  router.get('/card/:shareId',run(req=>({profile:service.card(req.params.shareId,req.user?.id)})));
  router.use((req,res,next)=>req.user?next():res.status(401).json({error:'请先登录 Runae 账号'}));
  router.use(createRateLimit({limit:120}));
  router.get('/me',run(req=>({profile:service.me(req.user.id)})));
  router.post('/profile',run(req=>{if(requirePolicy&&req.body.listed===true&&req.body.policyVersion!=='friends-2026-11-04-v1'){const e=Error('请阅读并同意当前隐私说明与用户条款');e.status=400;throw e;}return{profile:service.save(req.user.id,req.body)};}));
  router.get('/export',run(req=>({profile:service.me(req.user.id),reports:service.reports(req.user.id),exportedAt:new Date().toISOString()})));
  router.delete('/profile',run(req=>service.remove(req.user.id)));
  router.get('/discover',run(req=>service.discover(req.user.id,req.query)));
  router.get('/requests',run(req=>({requests:service.requests(req.user.id)})));
  router.post('/plan',createRateLimit({limit:10}),run(req=>{const card=service.card(req.body.shareId,req.user.id);if(!card.connected){const e=Error('双方接受认识申请后，再查看共同空档和见面建议');e.status=403;throw e;}const own=service.me(req.user.id),other=store.read().profiles.find(p=>p.shareId===req.body.shareId);const times=service.commonSlots(req.user.id,req.body.shareId,{durationMinutes:req.body.durationMinutes||15,days:14});return{commonSlots:times.slots,...suggestPlaces(own,other),timeNote:times.note};}));
  router.post('/requests',createRateLimit({limit:10,windowMs:3600000}),run(req=>service.request(req.user.id,req.body.shareId)));
  router.post('/requests/:id',run(req=>service.act(req.user.id,req.params.id,req.body.action)));
  router.post('/block',run(req=>service.block(req.user.id,req.body.shareId)));
  router.post('/report',run(req=>service.report(req.user.id,req.body.shareId,req.body.reason)));
  router.get('/reports',run(req=>({reports:service.reports(req.user.id)})));
  router.post('/feedback',run(req=>service.feedback(req.user.id,req.body.requestId,req.body.outcome)));
  router.use((err,req,res,next)=>{console.error('[friends]',err.name);res.status(500).json({error:'交友服务暂时不可用，请稍后重试'});});
  return router;
}
function productionRouter(){
  const config=getFriendsConfig(process.env);
  const express=require('express');
  const {authMiddleware}=require('../middleware');
  const {deleteUserToken,_tokenFromReq}=require('../lib/store');
  const onLogout=(req,res)=>{if(req.user)deleteUserToken.run(req.user.id,_tokenFromReq(req));res.clearCookie('sy_token',{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});};
  if(config.enabled&&!config.ok){console.error('[friends] Configuration incomplete; feature disabled. Run friends-ops preflight.');return createRouter({express,auth:authMiddleware,enabled:false,mode:'configuration_error',onLogout});}
  try{
    const store=config.enabled?createSqliteFriendsStore(config.file,{key:process.env.FRIENDS_DATA_KEY}):null;
    const friends=createRouter({express,auth:authMiddleware,enabled:config.enabled,mode:config.mode||'disabled',secret:process.env.FRIENDS_SIGNING_KEY,store,requirePolicy:true,
      canAccess:req=>config.mode==='public'||config.allowedIds?.has(String(req.user?.id)),onLogout});
    if(!config.enabled)return friends;
    const {configuredBilling}=require('../lib/friends-billing-config');
    const {createBillingRouter,createBillingCallbackRouter}=require('./friends-billing');
    const billing=configuredBilling(store),bundle=express.Router();
    bundle.use('/billing/callback',createRateLimit({limit:120}),createBillingCallbackRouter({express,service:billing}));
    const billingAuth=(req,res,next)=>authMiddleware(req,res,()=>{
      if(!req.user)return res.status(401).json({error:'请先登录'});
      if(config.mode!=='public'&&!config.allowedIds?.has(String(req.user.id)))return res.status(403).json({error:'当前为邀请测试'});
      next();
    });
    // In an invite pilot, even an enabled catalog must not advertise purchase to outsiders.
    bundle.use('/billing',createRateLimit({limit:60}),(req,res,next)=>config.mode==='public'?next():billingAuth(req,res,next),createBillingRouter({express,auth:billingAuth,service:billing}));
    const {createPersonalReportsRouter}=require('./friends-personal-reports');
    bundle.use('/personal-reports',createRateLimit({limit:20}),billingAuth,createPersonalReportsRouter({express,auth:billingAuth,store,billing}));
    const {createFriendsQuestionsRouter}=require('./friends-questions');
    bundle.use('/questions',createRateLimit({limit:60}),billingAuth,createFriendsQuestionsRouter({express,auth:billingAuth,store}));
    const {createFriendsIntakeRouter}=require('./friends-intake');
    bundle.use('/intake',createRateLimit({limit:40}),billingAuth,createFriendsIntakeRouter({express,auth:billingAuth,store}));
    const {createCompatibilityService}=require('../lib/friends-compatibility');
    const {createCompatibilityRouter}=require('./friends-compatibility');
    const {createFriendsQuestionsService}=require('../lib/friends-questions');
    const compatibility=createCompatibilityService({store,questionnaireService:createFriendsQuestionsService({store}),questionBank:require('../../assets/data/friends-relationship-questions.json')});
    bundle.use('/compatibility',billingAuth,createCompatibilityRouter({express,auth:billingAuth,service:compatibility}));
    bundle.use(friends);return bundle;
  }catch(e){console.error('[friends] Storage not ready; feature disabled. Run protected preflight.');return createRouter({express,auth:authMiddleware,enabled:false,mode:'storage_error',onLogout});}
}
module.exports={createRouter,productionRouter};
