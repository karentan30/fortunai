'use strict';
const XB=require('../lib/friends-cross-border'),xbError=XB.errorBody;
const path=require('node:path');
const {createSqliteFriendsStore}=require('../lib/friends-sqlite');
const {getFriendsConfig,supportInfo}=require('../lib/friends-config');
const {createSupportService}=require('../lib/friends-support');
const {createChartService}=require('../lib/friends-chart');
const {createFriendsService}=require('../lib/friends-service');
const {searchCities}=require('../lib/friends-location');
const {searchAreas,suggestPlaces}=require('../lib/friends-places');
const {createAdminService,adminAuth,createRateLimit}=require('../lib/friends-admin');
const {referralCode,createFunnelSink,instrumentCompatibility}=require('../lib/friends-campus');
function createRouter({express,auth,store,secret,enabled=true,adminToken=process.env.FRIENDS_ADMIN_TOKEN||process.env.ADMIN_TOKEN,onLogout,canAccess=()=>true,mode='local_review',requirePolicy=false,quotaOptions={},funnel,verification=null,seriousMedia=null,reviewGate=false,hejuNotify,hejuClock}) {
  const router=express.Router();
  const charts=enabled?createChartService(secret):null;
  const service=enabled?createFriendsService(store,charts,{...quotaOptions,funnel,reviewGate,
    // Hidden 认真结婚 ranking signal from the marriage questionnaire (both users must have opted in). Never exposed.
    alignmentScore:require('../lib/friends-matching').questionnaireAlignmentScore}):null;
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').set('X-Content-Type-Options','nosniff');
    if(!enabled&&!['/logout','/status','/legal'].includes(req.path))return res.status(503).json({error:'交友功能尚未开放，请稍后再来'});
    if(['POST','DELETE','PUT','PATCH'].includes(req.method)) {
      // Browser client must send JSON and this same-origin-only header. Cross-origin preflights have no matching allowlist here.
      // One exception: the 婚况 screen recording is sent as raw bytes (≤30MB) — still needs the custom header (forces a preflight).
      const rawVideo=req.method==='POST'&&req.path==='/verification/video'&&req.is('application/octet-stream');
      if(req.get('X-Runae-Friends')!=='1'||!(rawVideo||req.is('application/json')))return res.status(403).json({error:'请从本站页面操作'});
      if(req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'不允许跨站操作'});
      const origin=req.get('Origin');
      if(origin){let url;try{url=new URL(origin);}catch(_){return res.sendStatus(403);}if(url.origin!==`${req.protocol}://${req.get('Host')}`)return res.status(403).json({error:'不允许跨站操作'});}
    }
    next();
  });
  const run=fn=>(req,res,next)=>{try{res.json(fn(req));}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}};
  // 相合局：状态都在同一个 store 里；站内通知只落库，对外通知只留 notify 钩子（默认不做事）。
  const heju=enabled?require('../lib/friends-heju').createHejuService(store,{notify:hejuNotify,clock:hejuClock}):null;
  const runH=fn=>(req,res,next)=>{try{res.json(fn(req));}catch(e){if(e.status)return res.status(e.status).json({error:e.message,...(e.code?{code:e.code}:{})});next(e);}};
  const admin=enabled?createAdminService(store):null;
  router.use('/admin',createRateLimit({limit:60}),adminAuth(adminToken));
  router.get('/admin/summary',run(()=>admin.summary()));
  router.get('/admin/reports',run(req=>({reports:admin.reports(req.query.status)})));
  router.get('/admin/profiles',run(()=>({profiles:admin.profiles()})));
  router.get('/admin/orders',run(()=>({orders:admin.orders()})));
  router.post('/admin/orders/:id/refund',run(req=>admin.markRefunded(req.params.id,req.body?.note)));
  router.post('/admin/orders/:id/approve',run(req=>admin.approveHepanReview(req.params.id,req.body?.note)));
  router.get('/admin/audit',run(()=>({audit:admin.audit()})));
  router.get('/admin/delivery-review',run(req=>admin.deliveryReview({limit:req.query.limit===undefined?100:Number(req.query.limit),offset:req.query.offset===undefined?0:Number(req.query.offset)})));
  router.post('/admin/report-jobs/:id/release',async(req,res,next)=>{try{res.json(await admin.releaseReport(req.params.id,req.body,req.friendsAdminActor));}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}});
  // 人工核验队列. Files are streamed only through this admin-token route; there is no public URL for any proof file.
  const needVerification=()=>{if(!verification){const e=Error('核验功能未配置');e.status=503;throw e;}return verification;};
  router.get('/admin/verifications',run(()=>({requests:needVerification().pending()})));
  router.get('/admin/verifications/:id/files/:fileId',(req,res,next)=>{try{const f=needVerification().file(req.params.id,req.params.fileId);res.set('Content-Type',f.mime).set('Content-Disposition','attachment; filename="'+f.filename+'"').set('Content-Security-Policy',"default-src 'none'; sandbox").set('Cache-Control','no-store, private');res.send(f.body);}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}});
  router.post('/admin/verifications/:id',run(req=>needVerification().decide(req.params.id,req.body,req.friendsAdminActor)));
  // 首批审核制队列: pending cards (photo/nickname/city/purposes/fields) → 通过 / 不通过(固定原因). Same admin token as above.
  const reviews=enabled?require('../lib/friends-review').createReviewAdmin(store):null;
  router.get('/admin/reviews',run(req=>({profiles:reviews.queue(req.query.status||'pending'),reasons:reviews.REVIEW_REASONS})));
  router.get('/admin/reviews/:shareId/photos/:photoId',(req,res,next)=>{try{reviews.photo(req.params.shareId,req.params.photoId);const f=needMedia().open(req.params.photoId);res.set('Content-Type',f.mime).set('Content-Disposition','inline').set('Content-Security-Policy',"default-src 'none'; sandbox").set('Cache-Control','no-store, private').set('Cross-Origin-Resource-Policy','same-origin');res.send(f.body);}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}});
  router.post('/admin/reviews/:shareId',run(req=>reviews.decide(req.params.shareId,req.body||{},req.friendsAdminActor)));
  // 站内「联系我们」留言：运营查看（可按 待处理/已处理 筛）、回复并改状态，每次操作写操作记录。
  const support=enabled?createSupportService({store}):null;
  router.get('/admin/support',run(req=>({messages:support.list(req.query.status)})));
  router.post('/admin/support/:id',run(req=>({message:support.reply(req.params.id,req.body||{},req.friendsAdminActor)})));
  // 相合局运营：标记合作俱乐部、手动跑分组、只看汇总数字（不返回任何人的资料）。
  router.get('/admin/heju/clubs',runH(()=>heju.clubs()));
  router.post('/admin/heju/clubs',runH(req=>heju.markClub(req.body||{})));
  router.post('/admin/heju/run',runH(()=>heju.run()));
  router.get('/admin/heju/summary',runH(()=>heju.summary()));
  router.get('/admin/health',run(()=>store.health?store.health():{ok:true,storage:'review-memory'}));
  router.post('/admin/reports/:id',run(req=>admin.review(req.params.id,req.body.status,req.body.note)));
  router.post('/admin/profiles/:id',run(req=>admin.moderate(req.params.id,req.body.disabled,req.body.reason)));
  router.use(createRateLimit({limit:180}));
  router.post('/chart',run(req=>charts.issue(req.body)));
  router.get('/status',run(()=>({enabled,mode})));
  router.get('/legal',run(()=>({operatorName:process.env.FRIENDS_OPERATOR_NAME||'开普斯通智信集团有限公司（Capstone IQ Group Limited）',...(()=>{const x=supportInfo(process.env);return x.channel==='inapp'?{supportEmail:'',supportChannel:'inapp',supportInapp:'站内留言：我的卡片 → 联系我们',supportUrl:'/pages/friends-contact.html'}:{supportEmail:x.email||(process.env.FRIENDS_SUPPORT_EMAIL?'':'support@runae.app'),supportChannel:'email'};})(),storageRegion:process.env.FRIENDS_STORAGE_REGION||'',retentionPolicy:process.env.FRIENDS_RETENTION_POLICY||'删除交友档案后，档案、申请和聊天记录立即从交友库移除；渠道统计标记 90 天后删除；核验材料审核完即删除原件，只留核验结果；订单记录按财税法规保存。',publicReady:process.env.FRIENDS_PUBLIC_APPROVED==='true'&&enabled&&mode==='public'})));
  router.get('/cities',run(req=>({cities:searchCities(req.query.q)})));
  router.get('/areas',run(req=>({areas:searchAreas(req.query.q)})));
  router.post('/events',createRateLimit({limit:30}),run(req=>service.event(req.body.event,{source:req.body.source,campaign:req.body.campaign})));
  // Guest onboarding deck (#hello): teaser fields only, fresh opaque tokens per response. See lib/friends-preview-deck.js.
  const previewDeck=enabled?require('../lib/friends-preview-deck').createPreviewDeck(store):null;
  router.get('/preview',createRateLimit({limit:30}),run(req=>previewDeck.deck(req.query)));
  // 相亲名片（公开，不用登录）：审核通过前只给昵称+「资料审核中」。见 lib/friends-join-card.js。
  const joinCard=enabled?require('../lib/friends-join-card').createJoinCard(store):null;
  router.post('/public-card/:shareId/invite',createRateLimit({limit:10}),run(req=>joinCard.mintInvite(req.params.shareId)));
  router.get('/public-card/:shareId',createRateLimit({limit:60}),run(req=>({card:joinCard.publicCard(req.params.shareId)})));
  router.get('/public-card/:shareId/photos/:photoId',createRateLimit({limit:120}),(req,res,next)=>{try{joinCard.photoAllowed(req.params.shareId,req.params.photoId);const f=needMedia().open(req.params.photoId);res.set('Content-Type',f.mime).set('Content-Disposition','inline').set('Content-Security-Policy',"default-src 'none'; sandbox").set('Cache-Control','no-store, private').set('Cross-Origin-Resource-Policy','same-origin');res.send(f.body);}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}});
  // 相合局邀请链接（公开，不用登录）：只给活动、时间、片区、发起人昵称。
  router.get('/heju/public/:token',createRateLimit({limit:60}),runH(req=>heju.invitePublic(req.params.token)));
  router.use(auth);
  router.post('/logout',(req,res,next)=>{try{if(onLogout)onLogout(req,res);else res.clearCookie('sy_token',{path:'/'});res.json({ok:true});}catch(e){next(e);}});
  router.use((req,res,next)=>canAccess(req)?next():res.status(403).json({error:'当前为邀请测试，请联系运营开通账号'}));
  router.get('/card/:shareId',run(req=>{const profile=service.card(req.params.shareId,req.user?.id);if(req.user?.id!==undefined){try{service.recordView(req.user.id,req.params.shareId);}catch(_){}}return {profile};}));
  router.use((req,res,next)=>req.user?next():res.status(401).json({error:'请先登录 Runae 账号'}));
  router.use(createRateLimit({limit:120}));
  router.get('/quota',run(req=>service.quota(req.user.id)));
  // 打卡图鉴: owner-only (no id parameter). `share` is the types-and-counts-only payload used for the share image.
  router.get('/collection',run(req=>{const C=require('../lib/friends-collection'),c=C.collectionFor(store.read(),req.user.id);return {collection:c,share:C.shareSummary(c)};}));
  // 想认识TA after sign-up: redeem a guest token; the normal card visibility check (listed/blocked/disabled) still applies.
  router.get('/preview/resolve/:token',run(req=>{const uid=previewDeck.resolve(req.params.token),p=uid&&store.read().profiles.find(x=>x.userId===uid);if(!p){const e=Error('这位朋友暂时看不到了');e.status=404;throw e;}return {shareId:service.card(p.shareId,req.user.id).shareId};}));
  router.get('/viewers',run(req=>service.viewers(req.user.id)));
  // 校园分享用的个人推荐码：服务器签名派生，不含用户ID/姓名，链接里只带这个码。
  router.get('/referral',run(req=>({code:referralCode(secret,req.user.id)})));
  router.get('/me',run(req=>({profile:service.me(req.user.id)})));
  // 站内「联系我们」：只能看自己的留言和回复；不需要出境同意（撤回出境同意本身也要能走这里）。每人每天最多 5 条。
  router.get('/support',run(req=>({types:support.TYPES,dailyLimit:support.DAILY_LIMIT,maxLength:support.MAX_TEXT,messages:support.mine(req.user.id)})));
  router.post('/support',run(req=>({message:support.submit(req.user.id,req.body||{})})));
  // 账号级出境同意（相生资料存储在香港服务器）：一次同意、带版本；写接口未同意时返回 code=XS_CROSS_BORDER_CONSENT_REQUIRED。
  router.get('/cross-border-consent',run(req=>XB.status(store.read(),req.user.id)));
  router.post('/cross-border-consent',run(req=>{if(req.body?.consent!==true||req.body?.version!==XB.VERSION){const e=Error('请勾选同意当前版本的出境说明');e.status=400;e.code=XB.CODE;e.version=XB.VERSION;throw e;}return store.transaction(s=>{XB.record(s,req.user.id);return XB.status(s,req.user.id);});}));
  router.delete('/cross-border-consent',run(req=>store.transaction(s=>XB.withdraw(s,req.user.id))));
  router.get('/share-card',run(req=>joinCard.own(req.user.id)));
  router.post('/share-card',createRateLimit({limit:30}),run(req=>joinCard.save(req.user.id,req.body||{})));
  router.post('/profile',run(req=>{if(requirePolicy&&req.body.listed===true&&req.body.policyVersion!=='friends-2026-11-04-v1'){const e=Error('请阅读并同意当前隐私说明与用户条款');e.status=400;throw e;}return{profile:service.save(req.user.id,req.body)};}));
  router.get('/export',run(req=>({profile:service.me(req.user.id),reports:service.reports(req.user.id),exportedAt:new Date().toISOString()})));
  // Owner's own delete: photos/voice files of the 相亲页 go with the profile.
  router.delete('/profile',run(req=>{if(seriousMedia)seriousMedia.purgeUser(req.user.id);const out=service.remove(req.user.id);if(verification)verification.purgeUser(req.user.id);return out;}));
  // 认真相亲页. Media bytes only via the scoped route below; there is no static URL for any photo or voice file.
  const needMedia=()=>{if(!seriousMedia){const e=Error('照片和语音功能未配置');e.status=503;throw e;}return seriousMedia;};
  router.get('/serious',run(req=>service.seriousOwn(req.user.id)));
  router.post('/serious',createRateLimit({limit:60}),run(req=>service.seriousSave(req.user.id,req.body)));
  router.post('/serious/photos',createRateLimit({limit:30,windowMs:3600000}),run(req=>needMedia().addPhoto(req.user.id,req.body)));
  router.delete('/serious/photos/:id',run(req=>needMedia().removePhoto(req.user.id,req.params.id)));
  router.post('/serious/voice',createRateLimit({limit:30,windowMs:3600000}),run(req=>needMedia().setVoice(req.user.id,req.body)));
  router.delete('/serious/voice',run(req=>needMedia().removeVoice(req.user.id)));
  router.get('/serious/:shareId',run(req=>({page:service.seriousPage(req.params.shareId,req.user.id)})));
  router.get('/serious/:shareId/media/:mediaId',(req,res,next)=>{try{service.seriousMedia(req.params.shareId,req.user.id,req.params.mediaId);const f=needMedia().open(req.params.mediaId);
    res.set('Content-Type',f.mime).set('Content-Disposition','inline').set('Content-Security-Policy',"default-src 'none'; sandbox").set('Cache-Control','no-store, private').set('Cross-Origin-Resource-Policy','same-origin');res.send(f.body);}catch(e){if(e.status)return res.status(e.status).json(xbError(e));next(e);}});
  // 申请核验 (owner only). One file per request keeps each JSON body under the global 10MB parser limit.
  router.get('/verification',run(req=>needVerification().status(req.user.id)));
  router.post('/verification/files',createRateLimit({limit:30}),run(req=>needVerification().upload(req.user.id,req.body)));
  router.post('/verification/video',createRateLimit({limit:10,windowMs:3600000}),express.raw({type:'application/octet-stream',limit:'31mb'}),run(req=>needVerification().uploadVideo(req.user.id,{field:'marital',name:decodeURIComponent(String(req.get('X-File-Name')||'').slice(0,240)).slice(0,80),buf:Buffer.isBuffer(req.body)?req.body:null})));
  router.delete('/verification/files/:fileId',run(req=>needVerification().removeFile(req.user.id,req.params.fileId)));
  router.post('/verification/submit',createRateLimit({limit:20}),run(req=>needVerification().submit(req.user.id,req.body)));
  router.get('/discover',run(req=>service.discover(req.user.id,req.query)));
  router.get('/requests',run(req=>({requests:service.requests(req.user.id)})));
  router.post('/plan',createRateLimit({limit:10}),run(req=>{const card=service.card(req.body.shareId,req.user.id);if(!card.connected){const e=Error('双方接受认识申请后，再查看共同空档和见面建议');e.status=403;throw e;}const own=service.me(req.user.id),other=store.read().profiles.find(p=>p.shareId===req.body.shareId);const times=service.commonSlots(req.user.id,req.body.shareId,{durationMinutes:req.body.durationMinutes||15,days:14});return{commonSlots:times.slots,...suggestPlaces(own,other),timeNote:times.note};}));
  router.post('/requests',createRateLimit({limit:10,windowMs:3600000}),run(req=>service.request(req.user.id,req.body.shareId)));
  router.post('/requests/:id',run(req=>service.act(req.user.id,req.params.id,req.body.action)));
  // 见面三步 + 约时间 (pair-only; see friends-meet-steps.js).
  router.get('/meet/:shareId',run(req=>service.meet(req.user.id,req.params.shareId)));
  router.post('/meet/:shareId',createRateLimit({limit:60}),run(req=>service.meetStep(req.user.id,req.params.shareId,req.body)));
  router.post('/meet/:shareId/decision',createRateLimit({limit:60}),run(req=>service.meetDecide(req.user.id,req.params.shareId,req.body)));
  router.post('/meet/:shareId/appointment',createRateLimit({limit:60}),run(req=>service.meetAppointment(req.user.id,req.params.shareId,req.body)));
  router.post('/block',run(req=>service.block(req.user.id,req.body.shareId)));
  router.post('/report',run(req=>service.report(req.user.id,req.body.shareId,req.body.reason)));
  router.get('/reports',run(req=>({reports:service.reports(req.user.id)})));
  router.post('/feedback',run(req=>service.feedback(req.user.id,req.body.requestId,req.body.outcome)));
  // 相合局（登录后）。写操作都要带 X-Runae-Friends（上面统一检查）。
  const H1=createRateLimit({limit:30,windowMs:3600000}),H2=createRateLimit({limit:90,windowMs:60000});
  router.get('/heju/me',runH(req=>heju.me(req.user.id)));
  router.post('/heju/seen',runH(req=>heju.seen(req.user.id)));
  router.post('/heju/signup',H1,runH(req=>heju.signup(req.user.id,req.body||{})));
  router.post('/heju/signup/:id/cancel',runH(req=>heju.cancelSignup(req.user.id,req.params.id)));
  router.post('/heju/groups',H1,runH(req=>heju.createGroup(req.user.id,req.body||{})));
  router.get('/heju/club/groups',runH(req=>heju.clubGroups(req.user.id)));
  router.get('/heju/invite/:token',runH(req=>heju.inviteFor(req.user.id,req.params.token)));
  router.post('/heju/invite/:token/join',H1,runH(req=>heju.joinByInvite(req.user.id,req.params.token,req.body||{})));
  router.get('/heju/groups/:id',runH(req=>heju.groupView(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/invite',H1,runH(req=>heju.rotateInvite(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/confirm',runH(req=>heju.confirm(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/decline',runH(req=>heju.decline(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/leave',runH(req=>heju.leave(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/lock',runH(req=>heju.lock(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/spot',runH(req=>heju.setSpot(req.user.id,req.params.id,req.body?.spot)));
  router.post('/heju/groups/:id/members/:mid/approve',runH(req=>heju.decideRequest(req.user.id,req.params.id,req.params.mid,true)));
  router.post('/heju/groups/:id/members/:mid/decline',runH(req=>heju.decideRequest(req.user.id,req.params.id,req.params.mid,false)));
  router.post('/heju/groups/:id/members/:mid/report',H1,runH(req=>heju.reportMember(req.user.id,req.params.id,req.params.mid,req.body?.reason)));
  router.post('/heju/groups/:id/members/:mid/block',runH(req=>heju.blockMember(req.user.id,req.params.id,req.params.mid)));
  router.get('/heju/groups/:id/chat',H2,runH(req=>heju.chatList(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/chat',H2,runH(req=>heju.chatPost(req.user.id,req.params.id,req.body?.text)));
  router.post('/heju/groups/:id/chat/:msgId/report',H1,runH(req=>heju.chatReport(req.user.id,req.params.id,req.params.msgId,req.body?.reason)));
  router.get('/heju/groups/:id/after',runH(req=>heju.after(req.user.id,req.params.id)));
  router.post('/heju/groups/:id/attendance',runH(req=>heju.attendance(req.user.id,req.params.id,req.body||{})));
  router.post('/heju/groups/:id/pick',runH(req=>heju.pick(req.user.id,req.params.id,req.body?.mid,req.body?.on!==false)));
  router.use((err,req,res,next)=>{console.error('[friends]',err.name);res.status(500).json({error:'交友服务暂时不可用，请稍后重试'});});
  router.joinCard=joinCard;router.heju=heju;return router;
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
    // Proof files live next to the encrypted database (outside the repo; friends-config already rejects in-repo paths).
    let verification=null;
    if(config.enabled){try{verification=require('../lib/friends-verification').createVerificationService({store,dir:process.env.FRIENDS_VERIFICATION_DIR||path.join(path.dirname(config.file),'friends-verification'),key:process.env.FRIENDS_DATA_KEY});verification.sweep();const v=verification;setInterval(()=>{try{v.sweep();}catch(_){}},3600000).unref();}catch(e){console.error('[friends] Verification storage not ready; verification disabled.');verification=null;}}
    let seriousMedia=null;
    if(config.enabled){try{seriousMedia=require('../lib/friends-serious').createSeriousMediaService({store,dir:process.env.FRIENDS_MEDIA_DIR||path.join(path.dirname(config.file),'friends-media'),key:process.env.FRIENDS_DATA_KEY});}catch(e){console.error('[friends] Media storage not ready; photos/voice disabled.');seriousMedia=null;}}
    const friends=createRouter({express,auth:authMiddleware,verification,seriousMedia,enabled:config.enabled,mode:config.mode||'disabled',secret:process.env.FRIENDS_SIGNING_KEY,store,requirePolicy:true,reviewGate:process.env.FRIENDS_REVIEW_GATE!=='false' /* 首批审核制，默认开；应急可设 false */,quotaOptions:{enabled:process.env.FRIENDS_QUOTAS_ENABLED!=='false'} /* 免费3次/会员20次认识申请；FRIENDS_QUOTAS_ENABLED=false 为应急关闭 */,funnel:createFunnelSink({secret:process.env.FRIENDS_SIGNING_KEY}),
      canAccess:req=>config.mode==='public'||config.allowedIds?.has(String(req.user?.id)),onLogout});
    // 相合局每天北京时间 03 点跑一次分组；每小时顺手做一次收尾（确认截止、缺席结算、关群聊）。
    if(config.enabled&&friends.heju){
      const job=friends.heju;let lastDay='';
      try{setInterval(()=>{try{const b=new Date(Date.now()+8*3600000),day=b.toISOString().slice(0,10);if(b.getUTCHours()===3&&day!==lastDay){lastDay=day;job.run();}else if(b.getUTCMinutes()<30&&b.getUTCHours()!==3)job.sweepOnly();}catch(_){console.error('[friends] heju job failed');}},1800000).unref();}catch(_){console.error('[friends] heju scheduler not started');}
    }
    if(!config.enabled)return friends;
    const {configuredBilling}=require('../lib/friends-billing-config');
    const {createBillingRouter,createBillingCallbackRouter}=require('./friends-billing');
    const billing=configuredBilling(store),bundle=express.Router();
    // 相生会员直连收款（支付宝/微信，复用 server/pay.js）。FRIENDS_SALES_OPEN!=='true' 时页面显示「暂未开放购买」。
    const {configuredMembershipSales}=require('../lib/friends-membership-sales');
    const {createMembershipNotifyRouter,createMembershipSalesRouter}=require('./friends-membership-sales');
    const sales=configuredMembershipSales(store);
    bundle.use('/billing/membership/notify',createMembershipNotifyRouter({express,service:sales}));
    bundle.use('/billing/membership',createRateLimit({limit:90}),createMembershipSalesRouter({express,auth:(req,res,next)=>billingAuth(req,res,next),service:sales}));
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
    const {createFriendsQuestionnaireRouter}=require('./friends-questionnaire');
    bundle.use('/questionnaire',createRateLimit({limit:120}),billingAuth,createFriendsQuestionnaireRouter({express,auth:billingAuth,store}));
    const {createFriendsIntakeRouter}=require('./friends-intake');
    bundle.use('/intake',createRateLimit({limit:40}),billingAuth,createFriendsIntakeRouter({express,auth:billingAuth,store}));
    const {createCompatibilityService}=require('../lib/friends-compatibility');
    const {createCompatibilityRouter}=require('./friends-compatibility');
    const {createFriendsQuestionsService}=require('../lib/friends-questions');
    // 合盘 v4 文案：DeepSeek 只收干支与规则命中；FRIENDS_HEPAN_AI=false 时全部走固定模板。
    const generateProse=process.env.FRIENDS_HEPAN_AI==='false'?null:(messages,opts)=>require('../lib/llm').deepseekChat(messages,opts);
    // 合盘完整版付费：FRIENDS_HEPAN_PAY_ENABLED=true 且中台三项（FRIENDS_HUB_BASE 本机地址 / PROJECT_ID / SECRET）都配好才卖；否则只是「即将开放」。
    const {createHepanPayService,payConfig}=require('../lib/friends-hepan-pay');
    const {pairFacts}=require('../lib/friends-compatibility');
    const hepanPay=createHepanPayService({store,config:payConfig(process.env),pairFacts});
    const {createHepanPayCallbackRouter}=require('./friends-compatibility');
    bundle.use('/hepan-pay/callback',createHepanPayCallbackRouter({express,service:hepanPay}));// 只对验签失败的来源限流（见路由）
    if(hepanPay.configured())hepanPay.startSweeper();// 回调丢了也能靠定时对账补上；unref，不挡进程退出
    const compatibility=createCompatibilityService({store,generateProse,pay:hepanPay,questionnaireService:createFriendsQuestionsService({store}),questionBank:require('../../assets/data/friends-relationship-questions.json')});
    instrumentCompatibility(compatibility,store,createFunnelSink({secret:process.env.FRIENDS_SIGNING_KEY}));
    friends.joinCard?.useCompat(compatibility);
    let selfService=null;try{selfService=require('../lib/friends-hepan-self').createHepanSelfService({store,secret:process.env.FRIENDS_SIGNING_KEY,generateProse,pay:hepanPay});}catch(e){console.error('[friends] 自己合盘未启用：',e.message);}
    bundle.use('/compatibility',billingAuth,createCompatibilityRouter({express,auth:billingAuth,service:compatibility,selfService,payService:hepanPay}));
    // 我的命盘：免费本人命盘 + 付费完整报告（Runae 八字完整报告引擎）。付费开关 FRIENDS_MYCHART_PAY_ENABLED，默认关。
    try{
     const {createMyChartService}=require('../lib/friends-my-chart');
     const {createMyChartRouter}=require('./friends-my-chart');
     const key=process.env.FRIENDS_SIGNING_KEY;
     const inputHashKey=typeof key==='string'&&key.length>=32?require('node:crypto').createHmac('sha256',key).update('friends-mychart-input-v1').digest('hex'):undefined;
     const myChart=createMyChartService({store,pay:hepanPay,adapter:require('../lib/friends-report-adapter').createFriendsReportAdapter(),inputHashKey});
     bundle.use('/my-chart',createRateLimit({limit:60}),billingAuth,createMyChartRouter({express,auth:billingAuth,service:myChart}));
    }catch(e){console.error('[friends] 我的命盘未启用：',e.message);}
    bundle.use(friends);return bundle;
  }catch(e){console.error('[friends] Storage not ready; feature disabled. Run protected preflight.');return createRouter({express,auth:authMiddleware,enabled:false,mode:'storage_error',onLogout});}
}
module.exports={createRouter,productionRouter};
