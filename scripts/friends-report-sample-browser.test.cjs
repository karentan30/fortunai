'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../.review/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({executablePath:process.env.EDGE_BINARY||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto((process.env.FRIENDS_REVIEW_URL||'http://127.0.0.1:4188')+'/pages/friends-report-sample.html');
 const body=await page.locator('body').innerText();
 assert.ok(body.includes('你们的两个合，'));for(const text of ['午未相合','卯戌相合','申亥相害','酉戌相害','匿名演示','没有完成喜用判断'])assert.ok(body.includes(text),text);
 assert.equal(/1991|1995|06:00|15:45|榆树|徐州/.test(body),false);
 assert.equal(await page.locator('a.primary').getAttribute('href'),'/pages/friends-compatibility.html');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.resolve('.review/friends-report-sample-mobile.png'),fullPage:true});
 let downloadPromise=page.waitForEvent('download');await page.locator('#save-sample-card').click();let download=await downloadPromise;
 const bytes=fs.readFileSync(await download.path());assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1440);
 await page.waitForFunction(()=>{const i=document.querySelector('#sample-save-image');return i.complete&&i.naturalWidth===1080;});
 const firstUrl=await page.locator('#sample-save-image').getAttribute('src');assert.ok(firstUrl.startsWith('blob:'));
 await download.saveAs(path.resolve('.review/friends-pair-sample-card.png'));
 downloadPromise=page.waitForEvent('download');await page.locator('#save-sample-card').click();download=await downloadPromise;
 const secondUrl=await page.locator('#sample-save-image').getAttribute('src');assert.notEqual(firstUrl,secondUrl);
 const revoked=await page.evaluate(async u=>{try{await fetch(u);return false;}catch{return true;}},firstUrl);assert.equal(revoked,true);
 assert.equal(requests.some(u=>u.includes('/api/')),false,'sample must not submit data or trigger billing');
 assert.deepEqual(errors,[]);
 console.log('Report sample: responsive, anonymous, PNG export, object URL cleanup and no API calls passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
