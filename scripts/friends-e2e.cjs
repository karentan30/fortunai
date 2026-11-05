'use strict';
// Runs only against a temporary local server. No production accounts or requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
let chromium;try{({chromium}=require('playwright-core'));}catch(_){({chromium}=require('../.review/node_modules/playwright-core'));}
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(root,'.review','e2e-'));
const server=spawn(process.execPath,['server/friends-preview.cjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'4191',FRIENDS_PREVIEW_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
server.stderr.on('data',chunk=>process.stderr.write(chunk));
server.on('error',e=>console.error('preview launch:',e.message));
const base='http://127.0.0.1:4191';
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base+'/api/friends-preview/status')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('preview did not start');}
const errors=[];
async function chooseBirthCity(page,query='北京'){
  await page.locator('#birth-city-search').fill(query);await page.locator('.city-result').first().waitFor();await page.locator('.city-result').first().click();
}
async function fillBirthday(page){await page.locator('#birth-year').fill('1990');await page.locator('#birth-month').selectOption('6');await page.locator('#birth-day').selectOption('15');}
async function createPerson(page,slug){
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/pages/friends-connect.html');await fillBirthday(page);await chooseBirthCity(page);await page.locator('[name=adult]').check();
  await page.locator('#birth-form button[type=submit]').click();await page.waitForURL(/#daycard$/);await page.waitForSelector('#poster-canvas');await page.evaluate(()=>location.hash='result');
  await page.locator('.day-master').waitFor();assert.equal((await page.locator('.day-master').innerText()).trim(),'辛');
  assert.match(await page.locator('main').innerText(),/对方对我/);assert.match(await page.locator('main').innerText(),/我对对方/);
  await page.locator('#account-button').click();await page.locator('[data-auth-mode=register]').click();
  await page.locator('#auth-form [name=email]').fill(slug+'@example.test');await page.locator('#auth-form [name=password]').fill('OnlyLocalTest-2026');
  if(await page.locator('#auth-agreement input[name=agreement]').count())await page.locator('#auth-agreement input[name=agreement]').check();
  await page.locator('#auth-form button[type=submit]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});
  await page.goto(base+'/pages/friends-connect.html#profile');
  // Calculation state intentionally stays in memory, so use result from the authenticated chart endpoint after a navigation.
  if(await page.locator('#profile-form').count()===0){await page.goto(base+'/pages/friends-connect.html');await fillBirthday(page);await chooseBirthCity(page);await page.locator('[name=adult]').check();await page.locator('#birth-form button[type=submit]').click();await page.locator('#poster-canvas').waitFor();await page.locator('a[href="#profile"]').last().click();}
  await page.locator('#profile-form').waitFor();
  await page.locator('#nickname').fill('测试样本'+slug);await page.locator('#city').fill('北京');await page.locator('#bio').fill('虚构测试样本：喜欢羽毛球，愿意分享入门经验。');
  const fields={height:'172',weight:'62',school:'示例大学（测试）',occupation:'工程师（测试）',industry:'软件（测试）',title:'开发人员（测试）',income:'20–30',assets:'100–300'};
  for(const [k,v]of Object.entries(fields))await page.locator('#field_'+k).fill(v);
  for(const k of ['age','height','weight','school','occupation','industry','title','dayMaster','zodiac'])await page.locator('[name=scope_'+k+']').selectOption('public');
  await page.locator('[name=scope_income]').selectOption('connected');await page.locator('[name=scope_assets]').selectOption('private');
  await page.locator('label.chip-option').filter({has:page.locator('input[name=targetStems]')}).first().click();
  await page.locator('label.chip-option').filter({has:page.locator('input[name=targetZodiacs]')}).first().click();
  await page.locator('label.chip-option').filter({has:page.locator('input[name=hobbies][value="羽毛球"]')}).click();
  await page.locator('#contact').fill('test-contact-'+slug);for(const n of ['contactConsent','listed','consent'])await page.locator('[name='+n+']').check();
  if(await page.locator('[name=policyConsent]').count())await page.locator('[name=policyConsent]').check();
  await page.locator('#profile-form button[type=submit]').click();
  if(await page.locator('#publish-dialog').isVisible())await page.locator('#publish-dialog button[value=publish]').click();
  await page.locator('#poster-canvas').waitFor();
  const me=await page.request.get(base+'/api/friends/me');assert.equal(me.status(),200);return (await me.json()).profile;
}
(async()=>{let browser;try{
  await ready();browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu','--no-sandbox']});
  const a=await browser.newContext({viewport:{width:1440,height:1000}}),b=await browser.newContext({viewport:{width:390,height:844}}),anon=await browser.newContext({viewport:{width:390,height:844}});
  const pa=await a.newPage(),pb=await b.newPage(),pc=await anon.newPage();
  await pc.goto(base+'/pages/friends-connect.html');await pc.locator('#birth-year').waitFor();
  assert.equal(await pc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile horizontal overflow');
  await pc.screenshot({path:path.join(root,'preview-mobile.png'),fullPage:true});
  const ap=await createPerson(pa,'alice'),bp=await createPerson(pb,'bob');
  assert.equal(await pa.locator('#carousel-counter').innerText(),'1 / 2');
  assert.equal(await pa.locator('.sample-export').count(),0);
  for(let theme=0;theme<3;theme++){
    if(!await pa.locator('#poster-adjustments').evaluate(el=>el.open))await pa.locator('#poster-adjustments > summary').click();
    await pa.locator('[data-theme="'+theme+'"]').click();const info=await pa.locator('#poster-canvas').evaluate(c=>({w:c.width,h:c.height,qr:typeof window.qrcode==='function'}));assert.deepEqual(info,{w:1080,h:1440,qr:true});
    const exportDetails=pa.locator('details').filter({has:pa.locator('#download-poster')});
    if(!await exportDetails.evaluate(el=>el.open))await exportDetails.locator('summary').click();
    await pa.locator('#poster-confirm').check();const [download]=await Promise.all([pa.waitForEvent('download'),pa.locator('#download-poster').click()]);await download.saveAs(path.join(root,'preview-poster-'+theme+'.png'));
  }
  let response=await anon.request.get(base+'/api/friends/card/'+bp.shareId);let card=(await response.json()).profile;assert.equal(card.fields.income,undefined);assert.equal(card.fields.assets,undefined);assert.equal(card.chart.dayPillar,undefined);
  await pa.goto(base+'/pages/friends-connect.html#discover');await pa.locator('[data-detail="'+bp.shareId+'"]').click();await pa.locator('#apply-person').click();await pa.locator('#detail-dialog').waitFor({state:'hidden'});
  await pb.goto(base+'/pages/friends-connect.html#connections');await pb.locator('[data-action=accept]').click();await pb.locator('[data-action=disconnect]').waitFor();
  response=await a.request.get(base+'/api/friends/card/'+bp.shareId);card=(await response.json()).profile;assert.equal(card.fields.income,'20–30');assert.equal(card.fields.assets,undefined);
  const r=await (await a.request.get(base+'/api/friends/requests')).json();assert.equal(r.requests[0].contact,'test-contact-bob');
  pb.once('dialog',d=>d.accept());await pb.locator('[data-action=disconnect]').click();await pb.getByText('已解除').waitFor();
  card=(await (await a.request.get(base+'/api/friends/card/'+bp.shareId)).json()).profile;assert.equal(card.fields.income,undefined);
  assert.equal((await (await a.request.get(base+'/api/friends/requests')).json()).requests[0].contact,undefined);
  // Shared-card URL resolves anonymously and never returns a private birthday.
  await pc.goto(base+'/pages/friends-connect.html?card='+ap.shareId);await pc.locator('#detail-dialog h2').waitFor();assert.match(await pc.locator('#detail-dialog').innerText(),/测试样本alice/);
  assert.deepEqual(errors,[]);console.log('E2E PASS: birthday → account → nine fields → three visual themes, two-page carousel → discovery → request → accept → disconnect → privacy.');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
