'use strict';
// Browser-only fixtures: no real account, profile, secret or moderation operation is created.
// Run against an already running review server. Does not modify the main E2E script.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(__dirname,'../.review/node_modules/playwright-core'));
const BASE=process.env.FRIENDS_REVIEW_URL||'http://127.0.0.1:4188';
const EDGE=process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PRIVATE='PRIVATE-FIELD-MARKER';
const POLICY='friends-2026-11-04-v1';
const fixture=()=>({id:'fixture-owner',shareId:'fixture-share',nickname:'测试昵称',city:'北京',intent:'交朋友',listed:true,bio:'这是公开的本人介绍。',contact:PRIVATE+'-CONTACT',contactConsent:false,policyVersion:POLICY,chart:{dayMaster:'戊',element:'土',zodiac:'羊',age:36,ageAsOf:'2026-11-04'},fields:{age:36,height:'171',weight:'65',school:'示例学校',occupation:'工程师',industry:'互联网',title:'工程师',income:PRIVATE+'-INCOME',assets:PRIVATE+'-ASSETS'},visibility:{age:'public',height:'public',weight:'private',school:'private',occupation:'private',industry:'private',title:'private',income:'private',assets:'private',dayMaster:'public',zodiac:'private'},hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限']});
async function mockUser(page,state){
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),pathname=url.pathname;
    const reply=(status,body)=>route.fulfill({status,json:body});
    if(pathname==='/api/auth/me')return reply(state.loggedIn?200:401,state.loggedIn?{user:{id:'fixture-user',email:'fixture@example.invalid'}}:{error:'未登录'});
    if(pathname==='/api/friends-preview/status')return reply(200,{localReview:true});
    if(pathname==='/api/friends/me')return reply(state.loggedIn?200:401,state.loggedIn?{profile:state.profile}:{error:'未登录'});
    if(pathname==='/api/friends/logout'){state.loggedIn=false;state.logoutRequests++;return reply(200,{ok:true});}
    if(pathname==='/api/friends/profile'&&request.method()==='POST'){
      state.posts.push(request.postDataJSON());
      if(state.expireProfile){state.loggedIn=false;return reply(401,{error:'登录已过期'});}
      state.profile={...state.profile,...request.postDataJSON()};return reply(200,{profile:state.profile});
    }
    if(pathname==='/api/friends/events'){const body=request.postDataJSON();assert.deepEqual(Object.keys(body),['event']);assert.ok(['profile_preview','poster_export','share_visit'].includes(body.event));state.events.push(body.event);return reply(200,{ok:true});}
    if(pathname==='/api/friends/requests')return reply(200,{requests:[]});
    if(pathname==='/api/friends/reports')return reply(200,{reports:[]});
    return reply(404,{error:'Fixture route is not configured'});
  });
}
async function userChecks(browser){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const state={loggedIn:true,profile:fixture(),posts:[],logoutRequests:0,events:[],expireProfile:false};await mockUser(page,state);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE+'/pages/friends-connect.html#profile');await page.waitForSelector('#profile-form');
  assert.equal(await page.locator('#logout-button').isVisible(),true);
  assert.match(await page.locator('#profile-form').innerText(),/年龄截至 2026-11-04/);
  assert.equal(await page.locator('#field_income').getAttribute('list'),'finance-options');
  assert.ok((await page.locator('#finance-options').innerHTML()).includes('暂不提供'));
  await page.locator('[name=consent]').check();await page.locator('[name=policyConsent]').check();
  await page.locator('#profile-form button[type=submit]').click();await page.waitForSelector('#publish-dialog[open]');
  assert.equal((await page.locator('#publish-content').innerText()).includes(PRIVATE),false);
  assert.match(await page.locator('#publish-content').innerText(),/171/);
  await page.keyboard.press('Escape');assert.equal(state.posts.length,0);
  await page.evaluate(()=>location.hash='poster');await page.waitForSelector('#poster-canvas');
  const image=await page.locator('#poster-canvas').evaluate(canvas=>canvas.toDataURL());
  state.profile.fields.income='OTHER-PRIVATE-INCOME';state.profile.fields.assets='OTHER-PRIVATE-ASSETS';state.profile.contact='OTHER-PRIVATE-CONTACT';
  await page.reload();await page.waitForSelector('#poster-canvas');assert.equal(await page.locator('#poster-canvas').evaluate(canvas=>canvas.toDataURL()),image);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#logout-button').click();await page.waitForSelector('#birth-form');assert.equal(state.logoutRequests,1);
  assert.equal(await page.locator('#logout-button').isVisible(),false);assert.equal((await page.content()).includes('OTHER-PRIVATE'),false);
  assert.equal(await page.locator('#birthday').inputValue(),'');
  state.loggedIn=true;state.profile=fixture();state.expireProfile=true;
  await page.goto(BASE+'/pages/friends-connect.html?fixture-expiry=1#profile');await page.waitForSelector('#profile-form');await page.locator('[name=consent]').check();await page.locator('[name=policyConsent]').check();await page.locator('#profile-form button[type=submit]').click();await page.waitForSelector('#publish-dialog[open]');await page.locator('#publish-dialog button[value=publish]').click();await page.waitForSelector('#auth-dialog[open]');
  assert.match(await page.locator('#auth-dialog .muted').innerText(),/登录已过期/);assert.equal(await page.locator('#profile-form').count(),0);assert.equal((await page.content()).includes(PRIVATE),false);
  assert.equal(state.posts.at(-1).policyVersion,POLICY);assert.equal('userId' in state.posts.at(-1),false);assert.equal('birthLocation' in state.posts.at(-1),false);
  assert.equal(await page.locator('#auth-agreement').isVisible(),false);
  await page.locator('[data-auth-mode=register]').click();assert.equal(await page.locator('#auth-agreement').isVisible(),true);assert.equal(await page.locator('[name=agreement]').evaluate(input=>input.required),true);
  await page.locator('[data-auth-mode=login]').click();assert.equal(await page.locator('[name=agreement]').evaluate(input=>input.required),false);
  assert.deepEqual(errors,[]);await context.close();
}
async function adminChecks(browser){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const TOKEN='fixture-only-management-token-1234567890',requests=[];let expired=false,profileDisabled=false,reportStatus='open';
  await page.route('**/api/friends/admin/**',async route=>{
    const request=route.request(),url=new URL(request.url());assert.equal(request.headers()['x-admin-token'],TOKEN);assert.equal(url.href.includes(TOKEN),false);requests.push({pathname:url.pathname,method:request.method(),body:request.postDataJSON()});
    if(expired)return route.fulfill({status:401,json:{error:'凭据无效'}});
    const prefix='/api/friends/admin';let data;
    if(url.pathname===prefix+'/summary')data={profiles:2,listed:1,disabled:profileDisabled?1:0,requests:{pending:1,accepted:1},reports:{open:1},metrics:[{day:'2026-11-04',event:'poster_export',count:2}],feedback:{met:1},privateData:PRIVATE};
    else if(url.pathname===prefix+'/reports')data={reports:[{id:'fixture-report',status:reportStatus,reason:'<img src=x onerror="window.PWNED=1">',createdAt:'2026-11-04',target:{id:'fixture-profile',nickname:'测试用户',city:'北京',birthday:PRIVATE,contact:PRIVATE}}]};
    else if(url.pathname===prefix+'/profiles')data={profiles:[{id:'fixture-profile',nickname:'测试用户',city:'北京',disabled:profileDisabled,assets:PRIVATE,email:PRIVATE}]};
    else if(url.pathname===prefix+'/audit')data={audit:[{id:'fixture-audit',action:'report.review',target:'fixture-report',createdAt:'2026-11-04',detail:{status:'open',note:'这是处理说明。',privateData:PRIVATE}}]};
    else if(url.pathname===prefix+'/reports/fixture-report'){assert.equal(request.headers()['x-runae-friends'],'1');reportStatus=request.postDataJSON().status;data={id:'fixture-report',status:reportStatus};}
    else if(url.pathname===prefix+'/profiles/fixture-profile'){profileDisabled=request.postDataJSON().disabled;data={id:'fixture-profile',disabled:profileDisabled};}
    else return route.fulfill({status:404,json:{error:'Fixture route missing'}});
    return route.fulfill({json:data});
  });
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(BASE+'/pages/friends-admin.html');await page.locator('#admin-token').fill(TOKEN);await page.locator('#admin-auth-form button').click();await page.waitForSelector('#admin-workspace:not([hidden])[aria-busy=false]');await page.waitForSelector('[data-report-id]');
  assert.equal(await page.locator('#admin-token').inputValue(),'');assert.equal((await page.content()).includes(TOKEN),false);assert.equal((await page.content()).includes(PRIVATE),false);assert.equal(await page.evaluate(()=>window.PWNED),undefined);
  assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})),{local:[],session:[]});
  await page.locator('[data-report-id] [name=status]').selectOption('reviewing');await page.locator('[data-report-id] [name=note]').fill('已开始核查，不需要额外隐私资料。');await page.locator('[data-report-id] button').click();await page.waitForFunction(()=>document.querySelector('[data-report-id] [name=status]')?.value==='reviewing'&&document.querySelector('[data-report-id] [name=note]')?.value===''&&document.querySelector('#admin-workspace').getAttribute('aria-busy')==='false');
  await page.locator('#reports-tab').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#profiles-tab').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#admin-profiles-panel').isVisible(),true);
  await page.locator('[data-profile-id] [name=reason]').fill('根据举报暂时停用。');await page.locator('[data-profile-id] button').click();await page.waitForFunction(()=>document.querySelector('[data-profile-id]')?.dataset.disabled==='1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  expired=true;await page.locator('#admin-refresh').click();await page.waitForSelector('#admin-login:not([hidden])');assert.equal((await page.locator('#admin-workspace').innerText()).includes('测试用户'),false);assert.equal(await page.locator('#admin-token').inputValue(),'');assert.deepEqual(errors,[]);
  assert.ok(requests.some(request=>request.method==='POST'&&request.pathname.endsWith('/reports/fixture-report')));assert.ok(requests.some(request=>request.method==='POST'&&request.pathname.endsWith('/profiles/fixture-profile')));
  await context.close();
}
(async()=>{const browser=await chromium.launch({executablePath:EDGE,headless:true,args:['--no-sandbox','--disable-gpu']});try{await userChecks(browser);await adminChecks(browser);console.log('PASS: privacy preview, policy consent, private canvas exclusion, logout/expiry clearing, admin token handling, moderation, XSS escaping, keyboard tabs and mobile width.');}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
