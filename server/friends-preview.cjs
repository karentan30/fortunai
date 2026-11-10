'use strict';
// Local review only. Uses the SAME feature router/engine/store with isolated review accounts.
// Never mount this file in production. Explicit localhost binding; no seeded people or production data.
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
let express;try{express=require('express');}catch(_){express=require('../.review/node_modules/express');}
const {createRouter}=require('./routes/friends');
const {createSqliteFriendsStore}=require('./lib/friends-sqlite');
const app=express(),root=path.join(__dirname,'..');
const dir=process.env.FRIENDS_PREVIEW_DATA_DIR||path.join(root,'.preview-data');fs.mkdirSync(dir,{recursive:true});
const usersFile=path.join(dir,'accounts.json');
const users=fs.existsSync(usersFile)?JSON.parse(fs.readFileSync(usersFile,'utf8')):[];
const sessions=new Map();
const cookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('review_session='))?.slice(15);
const auth=(req,res,next)=>{req.user=sessions.get(cookie(req))||null;next();};
const keyFile=path.join(dir,'signing-key');if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,crypto.randomBytes(32).toString('hex'),{mode:0o600});
const dataKeyFile=path.join(dir,'data-key');if(!fs.existsSync(dataKeyFile))fs.writeFileSync(dataKeyFile,crypto.randomBytes(32).toString('hex'),{mode:0o600});
const reviewAdmin=path.join(dir,'admin-key');if(!fs.existsSync(reviewAdmin))fs.writeFileSync(reviewAdmin,crypto.randomBytes(32).toString('hex'),{mode:0o600});
const databaseFile=path.join(dir,'friends.sqlite'),databaseExisted=fs.existsSync(databaseFile);
const reviewStore=createSqliteFriendsStore(databaseFile,{key:fs.readFileSync(dataKeyFile,'utf8')});
const legacyFile=path.join(dir,'friends.json');
if(!databaseExisted&&fs.existsSync(legacyFile)){
  const legacy=JSON.parse(fs.readFileSync(legacyFile,'utf8'));
  for(const k of ['profiles','requests','blocks','reports'])if(!Array.isArray(legacy[k]))throw Error('旧测试快照格式无效，拒绝静默清空');
  reviewStore.transaction(next=>{for(const k of Object.keys(next))if(Array.isArray(legacy[k]))next[k]=legacy[k];});
  console.log('旧本地测试资料已导入加密数据库；旧快照保留待核验处理。');
}
const hash=(password,salt)=>crypto.scryptSync(password,salt,32).toString('hex');
// Review catalog only: real payment activation requires the verified production adapter.
const {createBillingService}=require('./lib/friends-billing');
const {createBillingRouter,createBillingCallbackRouter}=require('./routes/friends-billing');
const billing=createBillingService(reviewStore);
app.use('/api/friends/billing/callback',createBillingCallbackRouter({express,service:billing}));
// 相亲页照片(≤5MB)和语音按 base64 JSON 上传；只给这一组路由放宽体积上限。
app.use('/api/friends/serious',express.json({limit:'8mb'}));
app.use(express.json({limit:'64kb'}));
app.get('/api/friends-preview/status',(req,res)=>res.json({localReview:true,message:'本地试用环境，账号和资料与线上隔离。请勿填写真实敏感资料。'}));
for(const action of ['login','register'])app.post('/api/auth/'+action,(req,res)=>{
  if(req.get('Sec-Fetch-Site')==='cross-site')return res.sendStatus(403);
  const email=String(req.body.email||'').toLowerCase().trim(),password=String(req.body.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>200)return res.status(400).json({error:'本地测试邮箱及至少8位密码'});
  let user=users.find(x=>x.email===email);
  if(action==='register'){
    if(user)return res.status(409).json({error:'测试账号已存在'});
    const salt=crypto.randomBytes(16).toString('hex');user={id:crypto.randomUUID(),email,salt,hash:hash(password,salt)};
    users.push(user);fs.writeFileSync(usersFile,JSON.stringify(users),{mode:0o600});
  } else if(!user||hash(password,user.salt)!==user.hash)return res.status(401).json({error:'邮箱或密码错误'});
  const session=crypto.randomBytes(32).toString('hex');sessions.set(session,{id:user.id,email:user.email});
  res.cookie('review_session',session,{httpOnly:true,sameSite:'strict'});res.json({user:{id:user.id,email:user.email}});
});
app.get('/api/auth/me',auth,(req,res)=>req.user?res.json({user:req.user}):res.status(401).json({error:'未登录'}));
// Small review-only request ceiling, separate from production's global rate limiter.
const buckets=new Map();app.use('/api/friends',(req,res,next)=>{const k=req.ip,now=Date.now(),b=(buckets.get(k)||[]).filter(t=>now-t<60000);if(b.length>=120)return res.status(429).json({error:'操作过于频繁'});b.push(now);buckets.set(k,b);next();});
// 会员直购：本地只能用假支付（FRIENDS_PREVIEW_MOCK_PAY=1 才开放购买）；默认与线上一样「暂未开放购买」。
const {createMembershipSales}=require('./lib/friends-membership-sales');
const {createMembershipSalesRouter}=require('./routes/friends-membership-sales');
const mockPaid=new Set(),mockPay=process.env.FRIENDS_PREVIEW_MOCK_PAY==='1';
const mockProvider={ready:()=>true,
  async create(channel,{outTradeNo}){return channel==='wechat'?{codeUrl:'weixin://wxpay/bizpayurl?pr=preview-'+outTradeNo.slice(-6)}:{qrCode:'https://qr.alipay.com/preview-'+outTradeNo.slice(-6)};},
  async query(channel,outTradeNo){if(!mockPaid.has(outTradeNo))return null;const o=reviewStore.read().billingOrders.find(o=>o.outTradeNo===outTradeNo);return {outTradeNo,amountMinor:o.amountMinor,currency:'CNY',tradeNo:'mock-'+outTradeNo,appOk:true};},
  verifyNotify:()=>({ok:false}),reply:(c,ok)=>({type:'text/plain',body:ok?'success':'fail'})};
const membershipSales=createMembershipSales(reviewStore,{provider:mockPay?mockProvider:null,salesOpen:mockPay,notifyBase:'https://preview.invalid/api/friends/billing/membership/notify'});
app.use('/api/friends/billing/membership',createMembershipSalesRouter({express,auth,service:membershipSales}));
if(mockPay)app.post('/api/friends-preview/mock-pay',auth,(req,res)=>{const o=(reviewStore.read().billingOrders||[]).find(o=>o.id===req.body?.orderId&&o.userId===req.user?.id);if(!o)return res.sendStatus(404);mockPaid.add(o.outTradeNo);res.json({ok:true});});
app.use('/api/friends/billing',createBillingRouter({express,auth,service:billing}));
const {createPersonalReportsRouter}=require('./routes/friends-personal-reports');
app.use('/api/friends/personal-reports',createPersonalReportsRouter({express,auth,store:reviewStore,billing,env:{FRIENDS_REPORTS_ENABLED:'false'}}));
const {createFriendsQuestionsRouter}=require('./routes/friends-questions');
app.use('/api/friends/questions',createFriendsQuestionsRouter({express,auth,store:reviewStore}));
app.use('/api/friends/questionnaire',require('./routes/friends-questionnaire').createFriendsQuestionnaireRouter({express,auth,store:reviewStore}));
const {createFriendsIntakeRouter}=require('./routes/friends-intake');
app.use('/api/friends/intake',createFriendsIntakeRouter({express,auth,store:reviewStore}));
const {createCompatibilityService}=require('./lib/friends-compatibility');
const {createCompatibilityRouter}=require('./routes/friends-compatibility');
const {createFriendsQuestionsService}=require('./lib/friends-questions');
// 合盘完整版付费预览：HEPAN_PREVIEW_PAY=1 时用假中台（下单给假二维码，第二次查单即到账），不碰任何真实收款。
const hepanPayLib=require('./lib/friends-hepan-pay');
const fakeHubSeen=new Map();
const fakeHub={create:async({method,amount,outRef})=>{const no='XSPREVIEW'+outRef.slice(-10);fakeHubSeen.set(no,{n:0,outRef,amount});return method==='wechat'?{ok:true,order_no:no,code_url:'weixin://wxpay/bizpayurl?pr=preview',amount,method}:{ok:true,order_no:no,qr_code:'https://qr.alipay.com/preview',amount,method};},
 status:async no=>{const x=fakeHubSeen.get(no);x.n++;return {ok:true,order_no:no,out_ref:x.outRef,amount:x.amount,currency:'cny',status:x.n>=2?'paid':'pending'};},verify:()=>false};
const previewPay=process.env.HEPAN_PREVIEW_PAY==='1';
const hepanPay=hepanPayLib.createHepanPayService({store:reviewStore,config:{...hepanPayLib.payConfig(process.env),enabled:previewPay,ready:previewPay},hub:previewPay?fakeHub:null,pairFacts:require('./lib/friends-compatibility').pairFacts});
const compatibility=createCompatibilityService({pay:hepanPay,store:reviewStore,generateProse:process.env.HEPAN_PREVIEW_AI==='1'?(m,o)=>require('./lib/llm').deepseekChat(m,o):null,questionnaireService:createFriendsQuestionsService({store:reviewStore}),questionBank:require('../assets/data/friends-relationship-questions.json')});
// 本地预览默认不调真实模型（走固定模板）；HEPAN_PREVIEW_AI=1 才接 DeepSeek。
const hepanGenerate=process.env.HEPAN_PREVIEW_AI==='1'?(m,o)=>require('./lib/llm').deepseekChat(m,o):null;
const hepanSelf=require('./lib/friends-hepan-self').createHepanSelfService({store:reviewStore,secret:fs.readFileSync(keyFile,'utf8'),generateProse:hepanGenerate,pay:hepanPay});
app.use('/api/friends/compatibility',createCompatibilityRouter({express,auth,service:compatibility,selfService:hepanSelf,payService:hepanPay}));
// Encrypted 相亲页 media must live outside the repo; the default preview data dir is inside it, so fall back to a temp dir.
const seriousMedia=require('./lib/friends-serious').createSeriousMediaService({store:reviewStore,dir:process.env.FRIENDS_MEDIA_DIR||(process.env.FRIENDS_PREVIEW_DATA_DIR?path.join(dir,'friends-media'):path.join(require('node:os').tmpdir(),'runae-preview-media')),key:fs.readFileSync(dataKeyFile,'utf8')});
let hejuOffsetHours=0;app.post('/__preview/heju-offset',express.json(),(req,res)=>{hejuOffsetHours=Number(req.body?.hours)||0;res.json({hours:hejuOffsetHours});}); /* 仅本地预览：把相合局的时钟往后拨，走一遍「活动之后」 */
// 本地预览用的假中台指标：确定性的 90 天假数字（形状同 POST /hub/metrics/events），只为让增长看板能渲染；不联网。
function fakeHubMetrics({days=90,events}={}){
  const names=events||require('./lib/friends-hub-track').EVENTS,n=Math.min(90,Math.max(1,days)),today=Date.now()+8*3600000;
  const list=Array.from({length:n},(_,i)=>new Date(today-(n-1-i)*86400000).toISOString().slice(0,10));
  const base={profile_created:9,profile_complete:6,card_enabled:5,card_opened:14,invite_created:5,invite_claimed:2,compat_free_done:7,compat_paid:0.3,heju_signup:2,heju_grouped:1,heju_confirmed:1,heju_attended:0.7,heju_mutual:0.4,connection_accepted:1.5};
  const out={scope:'xiangsheng',tz:'Asia/Shanghai',days:list,events:{}};
  for(const e of names){const daily={};let total=0,distinct=0;list.forEach((d,i)=>{const ramp=0.35+i/n*0.9,c=Math.floor(base[e]*ramp*(0.6+((i*7+e.length*3)%9)/10));if(c>0){const u=Math.max(1,Math.round(c*0.85));daily[d]={count:c,distinct:u};total+=c;distinct+=u;}});out.events[e]={daily,total,distinct:Math.round(distinct*0.8)};}
  return Promise.resolve(out);
}
const friendsRouter=createRouter({express,auth,store:reviewStore,hubMetrics:fakeHubMetrics,hejuClock:()=>Date.now()+hejuOffsetHours*3600000,reviewGate:process.env.FRIENDS_REVIEW_GATE==='true',quotaOptions:{enabled:process.env.FRIENDS_QUOTAS_ENABLED!=='false'},seriousMedia,secret:fs.readFileSync(keyFile,'utf8'),adminToken:fs.readFileSync(reviewAdmin,'utf8'),onLogout(req,res){const token=cookie(req);if(token)sessions.delete(token);res.clearCookie('review_session',{path:'/',httpOnly:true,sameSite:'strict'});}});
friendsRouter.joinCard?.useCompat(compatibility);
app.use('/api/friends',friendsRouter);
app.get('/',(req,res)=>res.redirect('/pages/friends-connect.html'));
app.use('/pages',express.static(path.join(root,'pages')));
app.use('/assets',express.static(path.join(root,'assets')));
const server=app.listen(Number(process.env.PORT)||4188,'127.0.0.1',()=>console.log('Runae 本地集成版 http://127.0.0.1:'+server.address().port+'/pages/friends-connect.html'));
