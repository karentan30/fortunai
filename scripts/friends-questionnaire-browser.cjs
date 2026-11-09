'use strict';
// 本地浏览器冒烟：真实 preview 服务 + 隔离临时数据目录，手机视口走一遍问卷（先答底线题 → 深入聊聊；保存、续填、跳过、待讨论、展开说说、可见范围）。
// 用法：node scripts/friends-questionnaire-browser.cjs [截图输出路径]   （需要 playwright-core 与已安装的 Chromium）
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawn}=require('node:child_process');
const load=()=>{for(const p of ['playwright-core',path.join(__dirname,'../.review/node_modules/playwright-core'),path.join(__dirname,'../../../../node_modules/playwright-core')]){try{return require(p);}catch(_){}}throw Error('需要 playwright-core');};
const {chromium}=load();
const shotOut=process.argv[2];
(async()=>{
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'xq-preview-')),port=4300+Math.floor(Math.random()*500);
 const server=spawn(process.execPath,[path.join(__dirname,'../server/friends-preview.cjs')],{env:{...process.env,PORT:String(port),FRIENDS_PREVIEW_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<50&&!log.includes('127.0.0.1');i++)await new Promise(r=>setTimeout(r,100));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const reg=await page.request.post(base+'/api/auth/register',{data:{email:'xq-a@example.invalid',password:'password-123'}});assert.equal(reg.status(),200);
  // 账号级出境同意（PIPL）先走接口确认，否则写接口会弹同意框
  {const st=await (await page.request.get(base+'/api/friends/cross-border-consent')).json();assert.equal((await page.request.post(base+'/api/friends/cross-border-consent',{headers:{'X-Runae-Friends':'1'},data:{consent:true,version:st.version||st.currentVersion}})).status(),200);}
  await page.goto(base+'/pages/friends-questions.html');
  await page.waitForSelector('#q-form:not([hidden])');
  assert.equal(await page.textContent('#q-title'),'看得见五官，也看得见三观');
  assert.equal(await page.textContent('#q-dim-title'),'先答底线题');
  assert.match(await page.textContent('#q-progress-text'),/底线题 · 已答 0 \/ 14/);
  assert.equal(await page.locator('#q-steps .q-step').count(),11);
  // 底线题：结婚时间第一个选项是「看感觉走」
  const marry=page.locator('#q-items fieldset').first();
  assert.equal((await marry.locator('.q-opt').first().textContent()).trim(),'看感觉走');
  await page.getByLabel('一到三年').first().check();
  await page.locator('fieldset',{hasText:'见面前，你希望先经过哪几步'}).getByLabel('站内先聊几句').check();
  await page.locator('fieldset',{hasText:'见面前，你希望先经过哪几步'}).getByLabel('视频见一下真人').check();
  // 展开说说：默认收起，点开后最多 120 字
  const steps=page.locator('fieldset',{hasText:'见面前，你希望先经过哪几步'});
  await steps.getByRole('button',{name:'展开说说（选填）'}).click();
  assert.equal(await steps.locator('.q-note').getAttribute('maxlength'),'120');
  await steps.locator('.q-note').fill('想先确认是真人再约');
  await page.click('#q-next');assert.match(await page.textContent('#q-error'),/请先勾选/);
  await page.check('#q-consent');await page.click('#q-next');
  await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='家庭与生育分工'||document.querySelector('#q-error').textContent,null,{timeout:8000}).catch(async e=>{throw Error(`quick save did not advance: title=${await page.textContent('#q-dim-title')} status=${await page.textContent('#q-status')} errors=${errors.join(';')}`);});
  assert.equal(await page.textContent('#q-error'),'');
  let api=await (await page.request.get(base+'/api/friends/questionnaire/')).json();
  assert.equal(api.questionnaire.dimensions.family.answers['family-marry-timing'].value,'1to3');
  assert.deepEqual(api.questionnaire.dimensions.boundaries.answers['pace-steps'].value,['chat','video']);
  assert.equal(api.questionnaire.dimensions.boundaries.answers['pace-steps'].note,'想先确认是真人再约');
  assert.equal(await page.getByLabel('一到三年').first().isChecked(),true,'quick answers show inside the deep dimension too');
  // 原来的文字题现在是多选：最多 3 项
  const topics=page.locator('fieldset',{hasText:'婚后哪些家里的事'});
  if(await topics.count()){for(const o of await topics.locator('.q-opt').all())await o.click();assert.match(await page.textContent('#q-error'),/最多选/);}
  await page.locator('fieldset',{hasText:'家务你更倾向'}).getByRole('button',{name:'待讨论'}).click();
  await page.click('#q-next');await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='财务');
  // 第二个方向整体跳过
  await page.click('#q-skip-dim');await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='未来规划');
  const scrollW=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(scrollW<=390,'no horizontal overflow on mobile: '+scrollW);
  // 截图：亲密关系边界（含亲密节奏小节、量表两端文字、多选）
  await page.locator('#q-steps .q-step').nth(5).click();await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='亲密关系边界');
  assert.ok(await page.locator('.q-section h3',{hasText:'亲密节奏'}).count());
  await page.locator('fieldset',{hasText:'伴侣和前任'}).locator('.q-opt').nth(2).click();
  const respect=page.locator('fieldset',{hasText:'哪些'}).filter({has:page.locator('input[type=checkbox]')}).first();
  await respect.locator('.q-opt').nth(0).click();await respect.locator('.q-opt').nth(1).click();
  await page.locator('fieldset',{hasText:'伴侣和前任'}).scrollIntoViewIfNeeded();
  const shot=shotOut||path.join(dir,'mobile.png');fs.mkdirSync(path.dirname(shot),{recursive:true});
  await respect.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-70));
  await page.screenshot({path:shot,fullPage:false});
  await page.screenshot({path:path.join(dir,'full.png'),fullPage:true});
  // 可见范围面板
  assert.match(await page.textContent('#q-visibility'),/底线题：也填了底线题的会员可以看到/);
  assert.match(await page.textContent('#q-visibility'),/深入话题：互相加上后可见/);
  assert.match(await page.textContent('#q-visibility'),/敏感题：默认仅自己/);
  // 重新打开页面 → 底线题没答完，回到底线题
  await page.reload();await page.waitForSelector('#q-form:not([hidden])');
  assert.equal(await page.textContent('#q-dim-title'),'先答底线题');assert.match(await page.textContent('#q-status'),/底线题/);
  api=await (await page.request.get(base+'/api/friends/questionnaire/')).json();
  assert.equal(api.progress.dimensions.find(d=>d.id==='finance').status,'skipped');assert.equal(api.questionnaire.dimensions.family.answers['family-chores'].state,'discuss');
  // 另一个账号看不到
  const other=await browser.newContext(),op=await other.newPage();await op.request.post(base+'/api/auth/register',{data:{email:'xq-b@example.invalid',password:'password-123'}});
  assert.equal((await (await op.request.get(base+'/api/friends/questionnaire/')).json()).questionnaire,null);
  assert.deepEqual(errors,[]);
  console.log('PASS questionnaire browser smoke (mobile 390px): quick path first, multi + 展开说说, consent gate, skip dimension, 待讨论, 亲密节奏 section, visibility panel, resume, per-user isolation. screenshot:',shot,'full:',path.join(dir,'full.png'));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
