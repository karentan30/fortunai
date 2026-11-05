'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../.review/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{error:'guest'}}));
 await page.route('**/api/friends/cities?*',r=>r.fulfill({json:{cities:[{id:'test',label:'测试城市'}]}}));
 await page.route('**/api/friends/chart',r=>r.fulfill({json:{chart:{dayMaster:'戊',element:'土',zodiac:'羊',recommendations:{stems:['丙','丁'],zodiacs:['马']}},credential:'fixture'}}));
 await page.goto('http://127.0.0.1:4188/pages/friends-connect.html');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.hero-title-line').count(),3);}
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.sample-export').count(),0);
 await page.locator('#birth-year').fill('1991');await page.locator('#birth-month').selectOption('8');await page.locator('#birth-day').selectOption('28');await page.locator('#birth-city-search').fill('测试');await page.locator('.city-result').click();await page.locator('[name=adult]').check();await page.locator('#birth-form button[type=submit]').click();
 await page.waitForURL(/#daycard$/);await page.waitForSelector('#poster-canvas');
 const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,32);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#poster-photo').setInputFiles({name:'synthetic-test.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
 await page.waitForFunction(()=>document.querySelector('#poster-photo-status').textContent.includes('照片已放入'));
 assert.deepEqual(await page.locator('#poster-canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(869,350,1,1).data)),[255,0,0,255]);
 for(const platform of ['wechat','xiaohongshu','douyin','channels']){
  await page.locator('#poster-platform').selectOption(platform);await page.locator('#poster-confirm').check();await page.locator('#generate-gallery').click();
  await page.waitForFunction(()=>document.querySelectorAll('#gallery-items img').length===2&&[...document.querySelectorAll('#gallery-items img')].every(i=>i.complete&&i.naturalWidth));
  assert.deepEqual(await page.locator('#gallery-items img').evaluateAll(imgs=>imgs.map(i=>[i.naturalWidth,i.naturalHeight])),Array(2).fill([1080,['douyin','channels'].includes(platform)?1920:1440]));
  await page.locator('#gallery-close').click();
 }
 await page.locator('#remove-poster-photo').click();assert.equal(await page.locator('#poster-confirm').isChecked(),false);
 await page.screenshot({path:path.join(__dirname,'../.review/share-preview-mobile.png'),fullPage:true});
 await page.goto('http://127.0.0.1:4188/pages/friends-profile-library.html');assert.equal(await page.locator('article').count(),100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(__dirname,'../.review/profile-library-top.png')});
 assert.deepEqual(errors,[]);console.log('PASS: responsive heading; removed sample preview button; direct birth-to-poster; local photo pixels; real 2-page x 4-platform PNGs; remove photo resets consent; 100-profile document.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
