'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../.review/node_modules/playwright-core');
const BASE=process.env.FRIENDS_REVIEW_URL||'http://127.0.0.1:4188';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_BINARY||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined)});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],sent=[],created=[];page.on('pageerror',e=>errors.push(e.message));
 let accountId='owner',firstSend=true,consented=true,messageReads=0,revoked=false,held=null,hold=false;
 const pair=id=>({id,chatReady:!revoked&&consented,myChatConsent:true,peerChatConsent:true,status:revoked?'revoked':'ready',peer:{nickname:id==='one'?'甲同学':'乙同学'},recipientClaimed:true,myAuthorized:true,peerAuthorized:true,basicReady:!revoked,direction:'outgoing',mode:'targeted'});
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname,body=route.request().postDataJSON();
  if(p==='/api/auth/me')return route.fulfill({json:{user:{id:accountId}}});
  if(p.endsWith('/status'))return route.fulfill({json:{note:'内测'}});if(p.endsWith('/pairs')){if(route.request().method()==='POST'){created.push(body);return route.fulfill({json:pair('one')});}return route.fulfill({json:{pairs:[pair('one'),pair('two')]}});}
  if(p==='/api/friends/card/target-fixture')return route.fulfill({json:{profile:{nickname:'确认目标',shareId:'target-fixture'}}});
  if(p.endsWith('/report'))return route.fulfill({json:{completeFourPillars:true,themes:[],notes:[],summary:{available:true,sixHarmonyGroupCount:1},questionnaireSupplement:{note:'补充',topics:[]},fullReport:{note:'未开放'}}});
  if(p.endsWith('/messages')){
   if(route.request().method()==='POST'){sent.push(body);if(firstSend){firstSend=false;return route.fulfill({status:500,json:{error:'测试网络故障'}});}return route.fulfill({json:{message:{id:'sent-1',text:body.text,mine:true,createdAt:'2026-11-05T10:00:00Z'},duplicate:sent.length>1}});}
   messageReads++;if(hold){held=route;return;}
   if(revoked)return route.fulfill({status:409,json:{error:'已撤回'}});
   return route.fulfill({json:{messages:url.searchParams.has('after')?[]:[{id:p.includes('/one/')?'m-one':'m-two',text:p.includes('/one/')?'<img src=x onerror=alert(1)>':'第二个邀请的消息',mine:false,createdAt:'2026-11-05T09:00:00Z'}],nextCursor:p.includes('/one/')?'m-one':'m-two',hasMore:false}});
  }
  if(p.endsWith('/revoke')){revoked=true;return route.fulfill({json:pair('one')});}
  if(/\/pairs\/(one|two)$/.test(p))return route.fulfill({json:pair(p.split('/').pop())});
  return route.fulfill({status:404,json:{error:'未模拟接口'}});
 });
 await page.goto(BASE+'/pages/friends-compatibility.html?pair=one');
 await page.waitForSelector('#chat-messages .chat-message');
 assert.equal(await page.locator('#chat-messages img').count(),0);assert.ok((await page.locator('#chat-messages').innerText()).includes('<img'));
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.locator('[data-chat-topic]').first().click();assert.equal(sent.length,0);const draft=await page.locator('#chat-draft').inputValue();assert.ok(draft.length);
 await page.locator('#chat-send').click();await page.waitForFunction(()=>document.querySelector('#chat-status').textContent.includes('测试网络故障'));
 assert.equal(await page.locator('#chat-draft').inputValue(),draft);
 await page.locator('#chat-send').click();await page.waitForFunction(()=>document.querySelector('#chat-draft').value==='');
 assert.equal(sent.length,2);assert.equal(sent[0].clientMessageId,sent[1].clientMessageId);assert.equal(sent[0].text,sent[1].text);
 // A delayed prior-pair read must not appear after switching pairs.
 hold=true;await page.locator('#chat-refresh').click();await page.waitForTimeout(100);await page.locator('#pair-list button').nth(1).click();hold=false;
 if(held){await held.fulfill({json:{messages:[{id:'late',text:'STALE-PRIVATE',mine:false,createdAt:'2026-11-05T09:00:00Z'}],nextCursor:'late',hasMore:false}}).catch(()=>{});held=null;}
 await page.locator('#chat-refresh').click();await page.waitForFunction(()=>document.querySelector('#chat-messages').textContent.includes('第二个'));
 assert.equal((await page.locator('#chat-messages').innerText()).includes('STALE-PRIVATE'),false);
 // Session switch clears both conversations, drafts and report.
 await page.locator('#chat-draft').fill('PRIVATE-DRAFT');accountId='other-account';await page.evaluate(()=>document.querySelector('#chat-refresh').click());
 await page.waitForFunction(()=>document.querySelector('#pair-chat').hidden);
 assert.equal(await page.locator('#chat-draft').inputValue(),'');assert.equal(await page.locator('#chat-messages').innerText(),'');
 // Revocation clears the visible thread.
 accountId='owner';await page.reload();await page.waitForSelector('#chat-messages .chat-message');page.once('dialog',dialog=>dialog.accept());await page.locator('#revoke-pair').click();await page.waitForFunction(()=>document.querySelector('#pair-chat').hidden);assert.equal(await page.locator('#chat-messages').innerText(),'');
 revoked=false;consented=false;const readsBefore=messageReads;await page.reload();await page.waitForSelector('#pair-room');assert.equal(await page.locator('#allow-chat').isChecked(),false);assert.equal(await page.locator('#pair-chat').isHidden(),true);assert.equal(await page.locator('#pair-next').getAttribute('data-action'),'show-report');await page.locator('#pair-next').click();await page.waitForSelector('#report-area h2');assert.ok((await page.locator('#report-area').innerText()).includes('1 组'));assert.equal(messageReads,readsBefore);
 await page.goto(BASE+'/pages/friends-compatibility.html?target=target-fixture');await page.waitForFunction(()=>document.querySelector('#target-context').textContent.includes('确认目标'));assert.equal(created.length,0);await page.locator('#create-pair button[type=submit]').click();await page.waitForSelector('#pair-room');assert.equal(created.length,1);assert.equal(created[0].targetShareId,'target-fixture');
 await page.goto(BASE+'/pages/friends-compatibility.html?target=missing-card');await page.waitForFunction(()=>document.querySelector('#target-context').textContent.includes('无法确认'));assert.equal(await page.locator('#create-pair button[type=submit]').isDisabled(),true);assert.equal(created.length,1);
 // Existing accounts with six-character passwords can submit the login form.
 await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{error:'请登录'}}));let loginPayload=null;await page.route('**/api/auth/login',r=>{loginPayload=r.request().postDataJSON();return r.fulfill({status:401,json:{error:'测试登录请求已收到'}});});
 await page.goto(BASE+'/pages/friends-compatibility.html');await page.waitForSelector('#compat-auth');await page.locator('#auth-email').fill('existing@example.invalid');await page.locator('#auth-password').fill('123456');await page.locator('#compat-auth button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#global-error').textContent.includes('测试登录请求已收到'));assert.equal(loginPayload.password,'123456');

 assert.deepEqual(errors,[]);console.log('PASS: private chat mobile layout, escaped text, draft-only topics, idempotent retry, pair/session isolation and revoke cleanup');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
