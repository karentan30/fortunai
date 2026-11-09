'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {getFriendsConfig,supportInfo}=require('./friends-config');
const {createSupportService,DAILY_LIMIT}=require('./friends-support');
const {createFriendsStore}=require('./friends-store');
const ADMIN='admin-test-token-long-random-credential-42';
const publicEnv=extra=>({FRIENDS_ENABLED:'true',FRIENDS_RELEASE_MODE:'public',FRIENDS_DATA_KEY:crypto.randomBytes(32).toString('hex'),FRIENDS_SIGNING_KEY:crypto.randomBytes(32).toString('hex'),ADMIN_TOKEN:crypto.randomBytes(32).toString('hex'),FRIENDS_DB_FILE:'/var/lib/xiangsheng/friends.sqlite',
 FRIENDS_OPERATOR_NAME:'开普斯通智信集团有限公司',FRIENDS_STORAGE_REGION:'中国香港',FRIENDS_RETENTION_POLICY:'删除后立即移除',FRIENDS_PUBLIC_APPROVED:'true',FRIENDS_IDENTITY_REVIEWED:'true',FRIENDS_LEGAL_REVIEWED:'true',FRIENDS_BACKUP_VERIFIED:'true',...extra});
const supportErrors=env=>getFriendsConfig(env).errors.filter(e=>/SUPPORT|邮箱|站内/.test(e));

test('public config: in-app channel OR a valid email; neither fails; placeholder email is fine with channel=inapp',()=>{
 assert.deepEqual(getFriendsConfig(publicEnv({FRIENDS_SUPPORT_CHANNEL:'inapp'})).errors,[]);
 assert.equal(getFriendsConfig(publicEnv({FRIENDS_SUPPORT_CHANNEL:'inapp',FRIENDS_SUPPORT_EMAIL:'你的邮箱'})).ok,true,'the placeholder that took the test site down');
 assert.equal(getFriendsConfig(publicEnv({FRIENDS_SUPPORT_CHANNEL:'inapp',FRIENDS_SUPPORT_EMAIL:''})).ok,true);
 assert.equal(getFriendsConfig(publicEnv({FRIENDS_SUPPORT_EMAIL:'help@xiangsheng.example.org'})).ok,true);
 for(const env of [publicEnv({}),publicEnv({FRIENDS_SUPPORT_EMAIL:'你的邮箱'}),publicEnv({FRIENDS_SUPPORT_EMAIL:'your_email@x.com'}),publicEnv({FRIENDS_SUPPORT_CHANNEL:'email',FRIENDS_SUPPORT_EMAIL:''})]){assert.equal(getFriendsConfig(env).ok,false);assert.equal(supportErrors(env).length,1,JSON.stringify(supportErrors(env)));}
 assert.ok(supportErrors(publicEnv({FRIENDS_SUPPORT_CHANNEL:'wechat',FRIENDS_SUPPORT_EMAIL:'a@b.co'})).length);
 // 选站内留言时一律不公示邮箱
 assert.deepEqual(supportInfo({FRIENDS_SUPPORT_CHANNEL:'inapp',FRIENDS_SUPPORT_EMAIL:'a@b.co'}),{channel:'inapp',email:''});
});

function router(){
 let express;try{express=require('express');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;express=require('../../.review/node_modules/express');}
 const {createRouter}=require('../routes/friends');const store=createFriendsStore();
 const app=express();app.use(express.json());
 app.use('/api/friends',createRouter({express,store,secret:'a'.repeat(40),adminToken:ADMIN,auth:(req,res,next)=>{const u=req.get('X-Test-User');if(u)req.user={id:u};next();}}));
 return {store,app,express};
}
async function serve(app,fn){const server=await new Promise(r=>{const x=app.listen(0,'127.0.0.1',()=>r(x));});try{return await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
const H=(user,extra={})=>({'Content-Type':'application/json','X-Runae-Friends':'1',...(user?{'X-Test-User':user}:{}),...extra});

test('in-app 联系我们: login required, 5/day per user, owner-only reads, admin list/reply with status and audit',async()=>{
 const {store,app}=router();
 await serve(app,async base=>{
  const post=(user,body)=>fetch(base+'/api/friends/support',{method:'POST',headers:H(user),body:JSON.stringify(body)});
  assert.equal((await post(null,{type:'delete',text:'请删除'})).status,401);
  assert.equal((await fetch(base+'/api/friends/support')).status,401);
  const types=(await (await fetch(base+'/api/friends/support',{headers:H('u1')})).json()).types;
  assert.deepEqual(Object.values(types),['查阅/复制','更正','删除','撤回出境同意','投诉举报','其他']);
  assert.equal((await post('u1',{type:'nope',text:'x'})).status,400);assert.equal((await post('u1',{type:'other',text:'   '})).status,400);
  assert.equal((await post('u1',{type:'other',text:'字'.repeat(1001)})).status,400);assert.equal((await post('u1',{type:'other',text:'字'.repeat(1000)})).status,200);
  // 不需要出境同意（撤回出境同意也走这里）
  for(let i=1;i<DAILY_LIMIT;i++)assert.equal((await post('u1',{type:'xb_withdraw',text:'撤回 '+i})).status,200);
  assert.equal((await post('u1',{type:'complaint',text:'第六条'})).status,429);
  assert.equal((await post('u2',{type:'complaint',text:'u2 的投诉：卡片 card-x 骚扰'})).status,200,'limit is per user');
  // 只能看自己的
  const mine=await (await fetch(base+'/api/friends/support',{headers:H('u1')})).json();assert.equal(mine.messages.length,5);assert.ok(!JSON.stringify(mine).includes('u2 的投诉'));assert.ok(!JSON.stringify(mine).includes('userId'));
  const other=await (await fetch(base+'/api/friends/support',{headers:H('u2')})).json();assert.equal(other.messages.length,1);
  // 运营：凭据、列表、回复
  assert.equal((await fetch(base+'/api/friends/admin/support')).status,401);
  const A=H(null,{'X-Admin-Token':ADMIN});
  const open=await (await fetch(base+'/api/friends/admin/support?status=open',{headers:A})).json();assert.equal(open.messages.length,6);assert.equal(open.messages[0].statusLabel,'待处理');
  const target=open.messages.find(m=>m.text.startsWith('u2'));
  assert.equal((await fetch(base+'/api/friends/admin/support/'+target.id,{method:'POST',headers:A,body:'{}'})).status,400);
  const r=await fetch(base+'/api/friends/admin/support/'+target.id,{method:'POST',headers:A,body:JSON.stringify({reply:'已处理，该卡片已停用。'})});assert.equal(r.status,200);assert.equal((await r.json()).message.statusLabel,'已处理');
  assert.equal((await (await fetch(base+'/api/friends/admin/support?status=done',{headers:A})).json()).messages.length,1);
  const seen=await (await fetch(base+'/api/friends/support',{headers:H('u2')})).json();assert.deepEqual(seen.messages[0].replies.map(x=>x.text),['已处理，该卡片已停用。']);assert.equal(seen.messages[0].status,'done');
  assert.equal((await (await fetch(base+'/api/friends/support',{headers:H('u1')})).json()).messages.every(m=>!m.replies.length),true);
  await fetch(base+'/api/friends/admin/support/'+target.id,{method:'POST',headers:A,body:JSON.stringify({status:'open'})});
  const audit=store.read().auditLogs.filter(a=>a.action==='support.reply');assert.equal(audit.length,2);assert.deepEqual(audit.map(a=>[a.detail.before,a.detail.status,a.detail.replied]),[['open','done',true],['done','open',false]]);
  assert.ok(!JSON.stringify(audit).includes('骚扰'),'audit keeps no message text');assert.ok(audit[0].actor.startsWith('admin-token:'));
 });
});
test('daily limit is a rolling 24h window and messages live in the encrypted store state',()=>{
 let now=Date.parse('2026-11-09T04:00:00Z');const store=createFriendsStore(),s=createSupportService({store,clock:()=>now});
 for(let i=0;i<DAILY_LIMIT;i++)s.submit('u',{type:'access',text:'查 '+i});assert.throws(()=>s.submit('u',{type:'access',text:'x'}),e=>e.status===429);
 now+=86400001;assert.equal(s.submit('u',{type:'access',text:'次日'}).status,'open');assert.equal(store.read().supportMessages.length,DAILY_LIMIT+1);
 assert.throws(()=>s.reply('missing',{reply:'x'}),e=>e.status===404);assert.throws(()=>s.list('weird'),e=>e.status===400);
});

// 页面：用 /api/friends/legal 的真实返回跑页面里的脚本（简易 DOM），站内留言模式下不能再出现「待配置」。
function renderLegalPage(file,legal){
 const html=fs.readFileSync(path.join(__dirname,'../../pages',file),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const els=[],re=/<(\w+)((?:\s[^>]*)?)>([^<]*)<\/\1>/g;let m;
 while((m=re.exec(html)))if(/data-legal=|data-config-pending|data-ready-notice|data-effective|class="badge"/.test(m[2]))els.push({start:m.index,end:m.index+m[0].length,tag:m[1],attrs:m[2],text:m[3],hidden:false,link:null,
  set textContent(v){this.text=v;this.link=null;},replaceChildren(a){this.text=a.textContent;this.link=a.href;}});
 const match=(e,sel)=>{const k=sel.match(/^\[data-legal="(\w+)"\]$/);if(k)return e.attrs.includes('data-legal="'+k[1]+'"');if(sel==='.badge')return e.attrs.includes('class="badge"');return e.attrs.includes(sel.slice(1,-1));};
 const document={querySelectorAll:sel=>els.filter(e=>match(e,sel)),createElement:()=>({href:'',textContent:''})};
 return vm.runInNewContext(script,{document,fetch:async()=>({ok:true,json:async()=>legal})}).then(()=>{
  let out='',at=0;for(const e of els){out+=html.slice(at,e.start)+(e.hidden?'':e.link?`<a href="${e.link}">${e.text}</a>`:e.text);at=e.end;}out+=html.slice(at);
  return {text:out.replace(/<script>[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,''),html:out,els};});
}
async function legalFor(env){
 const {app}=router(),keys=Object.keys(env),saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,env);
 try{return await serve(app,async base=>(await fetch(base+'/api/friends/legal')).json());}finally{for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
}
test('help/privacy/terms show 站内留言 (linked) instead of an email and no 待配置 when channel=inapp',async()=>{
 const env={FRIENDS_SUPPORT_CHANNEL:'inapp',FRIENDS_SUPPORT_EMAIL:'你的邮箱',FRIENDS_OPERATOR_NAME:'开普斯通智信集团有限公司',FRIENDS_STORAGE_REGION:'中国香港',FRIENDS_RETENTION_POLICY:'删除后立即移除',FRIENDS_PUBLIC_APPROVED:'true'};
 const legal=await legalFor(env);assert.equal(legal.supportEmail,'');assert.equal(legal.supportChannel,'inapp');assert.ok(!JSON.stringify(legal).includes('@'),'no email published');
 // 路由里 publicReady 还要求 enabled+public 模式；这里按上线后的状态模拟
 for(const page of ['friends-help.html','friends-privacy.html','friends-terms.html']){
  const r=await renderLegalPage(page,{...legal,publicReady:true});
  assert.ok(!/待配置|待运营方确认/.test(r.text),page+': '+(r.text.match(/.{20}(待配置|待运营方确认).{10}/)||[''])[0]);
  assert.ok(r.els.filter(e=>e.attrs.includes('data-legal=')).every(e=>!/^(待|尚未)/.test(e.text)),page);assert.ok(r.els.filter(e=>e.attrs.includes('data-config-pending')).every(e=>e.hidden),page);
  const links=r.els.filter(e=>e.attrs.includes('data-legal="supportEmail"'));assert.ok(links.length>=1);
  for(const e of links){assert.equal(e.link,'/pages/friends-contact.html');assert.equal(e.text,'站内留言：我的卡片 → 联系我们');}
  assert.ok(!/邮箱：|发邮件/.test(r.text),page+' still labels it as an email');
  // 自证：同样的页面在邮箱模式、邮箱没配时还会显示「待配置」
  const bad=await renderLegalPage(page,{...legal,supportChannel:'email',supportEmail:'',publicReady:true});assert.ok(/待配置/.test(bad.text),page);
 }
 // 邮箱模式照旧显示邮箱
 const r=await renderLegalPage('friends-help.html',{...legal,supportChannel:'email',supportEmail:'help@x.org',publicReady:true});assert.ok(r.text.includes('help@x.org'));
});
test('我的卡片 has the 联系我们 entry and the contact page keeps the no-password/ID/birth warning',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../../assets/js/friends.js'),'utf8');assert.ok(js.includes('href="/pages/friends-contact.html" id="profile-contact">联系我们</a>'));
 const page=fs.readFileSync(path.join(__dirname,'../../pages/friends-contact.html'),'utf8');assert.ok(/请不要填写密码、身份证照片或证件号、银行卡号或完整出生信息/.test(page));assert.ok(page.includes('maxlength="1000"'));
 const help=fs.readFileSync(path.join(__dirname,'../../pages/friends-help.html'),'utf8');assert.ok(help.includes('请不要发送密码、身份证照片、银行卡号或完整出生信息'));
});
