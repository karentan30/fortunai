'use strict';
// 本地浏览器冒烟：真实 preview 服务 + 隔离临时数据目录，手机视口走一遍十方向问卷（保存、续填、跳过、待讨论）。
// 用法：node scripts/friends-questionnaire-browser.cjs   （需要 playwright-core 与已安装的 Chromium）
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawn}=require('node:child_process');
const load=()=>{for(const p of ['playwright-core',path.join(__dirname,'../.review/node_modules/playwright-core'),path.join(__dirname,'../../../../node_modules/playwright-core')]){try{return require(p);}catch(_){}}throw Error('需要 playwright-core');};
const {chromium}=load();
(async()=>{
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'xq-preview-')),port=4300+Math.floor(Math.random()*500);
 const server=spawn(process.execPath,[path.join(__dirname,'../server/friends-preview.cjs')],{env:{...process.env,PORT:String(port),FRIENDS_PREVIEW_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<50&&!log.includes('127.0.0.1');i++)await new Promise(r=>setTimeout(r,100));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:375,height:740},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const reg=await page.request.post(base+'/api/auth/register',{data:{email:'xq-a@example.invalid',password:'password-123'}});assert.equal(reg.status(),200);
  await page.goto(base+'/pages/friends-questions.html');
  await page.waitForSelector('#q-form:not([hidden])');
  assert.match(await page.textContent('#q-progress-text'),/第 1 \/ 10 个方向/);
  assert.equal(await page.locator('#q-steps .q-step').count(),10);
  // 第一个方向：选结婚时间、生育计划，一题标待讨论
  await page.getByLabel('一到三年').check();
  await page.getByLabel('婚后三年左右').check();
  await page.locator('fieldset',{hasText:'家务你更倾向'}).getByRole('button',{name:'待讨论'}).click();
  await page.click('#q-next');assert.match(await page.textContent('#q-error'),/请先勾选/);
  await page.check('#q-consent');await page.click('#q-next');
  await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='财务');
  assert.match(await page.textContent('#q-progress-text'),/第 2 \/ 10 个方向 · 已看过 1 个/);
  // 第二个方向整体跳过
  await page.click('#q-skip-dim');await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='未来规划');
  // 量表题填一半就离开（暂存）
  await page.locator('fieldset',{hasText:'事业和生活的比重'}).locator('.q-opt').nth(3).click();
  const scrollW=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(scrollW<=375,'no horizontal overflow on mobile: '+scrollW);
  await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  await page.locator('#q-steps .q-step').nth(0).click();await page.waitForFunction(()=>document.querySelector('#q-dim-title').textContent==='家庭与生育分工');
  assert.equal(await page.getByLabel('一到三年').isChecked(),true);
  // 重新打开页面 → 从“填写中”的方向续填
  await page.reload();await page.waitForSelector('#q-form:not([hidden])');
  assert.equal(await page.textContent('#q-dim-title'),'未来规划');assert.match(await page.textContent('#q-status'),/接着写/);
  const api=await (await page.request.get(base+'/api/friends/questionnaire/')).json();
  assert.equal(api.progress.dimensions.find(d=>d.id==='finance').status,'skipped');assert.equal(api.questionnaire.dimensions.family.answers['family-chores'].state,'discuss');
  assert.equal(api.questionnaire.dimensions.future.status,'in_progress');assert.equal(api.questionnaire.dimensions.future.answers['future-career'].value,4);
  // 另一个账号看不到
  const other=await browser.newContext(),op=await other.newPage();await op.request.post(base+'/api/auth/register',{data:{email:'xq-b@example.invalid',password:'password-123'}});
  assert.equal((await (await op.request.get(base+'/api/friends/questionnaire/')).json()).questionnaire,null);
  assert.deepEqual(errors,[]);
  console.log('PASS questionnaire browser smoke (mobile 375px): save, consent gate, skip dimension, 待讨论, autosave on leave, resume after reload, per-user isolation. screenshot:',path.join(dir,'mobile.png'));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
