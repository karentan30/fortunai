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
app.use(express.json({limit:'64kb'}));
app.get('/api/friends-preview/status',(req,res)=>res.json({localReview:true,message:'本地试用环境，账号和人库与线上隔离。请勿填写真实敏感资料。'}));
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
const compatibility=createCompatibilityService({store:reviewStore,questionnaireService:createFriendsQuestionsService({store:reviewStore}),questionBank:require('../assets/data/friends-relationship-questions.json')});
app.use('/api/friends/compatibility',createCompatibilityRouter({express,auth,service:compatibility}));
app.use('/api/friends',createRouter({express,auth,store:reviewStore,secret:fs.readFileSync(keyFile,'utf8'),adminToken:fs.readFileSync(reviewAdmin,'utf8'),onLogout(req,res){const token=cookie(req);if(token)sessions.delete(token);res.clearCookie('review_session',{path:'/',httpOnly:true,sameSite:'strict'});}}));
app.get('/',(req,res)=>res.redirect('/pages/friends-connect.html'));
app.use('/pages',express.static(path.join(root,'pages')));
app.use('/assets',express.static(path.join(root,'assets')));
const server=app.listen(Number(process.env.PORT)||4188,'127.0.0.1',()=>console.log('Runae 本地集成版 http://127.0.0.1:'+server.address().port+'/pages/friends-connect.html'));
