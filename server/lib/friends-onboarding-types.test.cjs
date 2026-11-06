'use strict';
// 游客引导：结果卡的星座按换算后的公历日期；卡片上的 MBTI/星座提示只比对双方公开/自选的值。
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {calculate}=require('./friends-chart');
const now=new Date('2026-11-06T00:00:00Z');
function hints(){
  const window={},src=fs.readFileSync(path.join(__dirname,'../../assets/js/friends-onboarding.js'),'utf8');
  vm.runInNewContext(src,{window,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}}});
  return window.XiangshengOnboarding._test;
}
test('chart returns 星座 from the solar date, also for 农历 input',()=>{
  const solar=calculate({birthday:'1995-06-15',calendar:'solar'},now);
  assert.equal(solar.constellation,'双子座');assert.equal(solar.zodiac,'猪');
  // 农历1995-05-18 = 公历1995-06-15
  const lunar=calculate({birthday:'1995-05-18',calendar:'lunar'},now);
  assert.equal(lunar.constellation,'双子座');assert.equal(lunar.dayPillar,solar.dayPillar);
  // 农历腊月出生、公历已到次年1月：星座跟公历走
  assert.equal(calculate({birthday:'1990-12-20',calendar:'lunar'},now).constellation,'水瓶座');
});
test('MBTI / 星座 hints are factual and only from given values',()=>{
  const {mbtiHint,typeHints}=hints();
  assert.equal(mbtiHint('ENFP','ENFP'),'同为ENFP');
  assert.equal(mbtiHint('ENFP','INFP'),'E/I 互补');
  assert.equal(mbtiHint('ENFP','ENTP'),'T/F 互补');
  assert.equal(mbtiHint('ENFP','ISTJ'),'');
  assert.equal(mbtiHint('','ENFP'),'');assert.equal(mbtiHint('ENFP','<b>'),'');
  assert.deepEqual([...typeHints({mbti:'ENFP',constellation:'双子座'},{mbti:'ENFP',constellation:'双子座'})],['同为ENFP','同为双子座']);
  assert.deepEqual([...typeHints({mbti:'',constellation:'双子座'},{constellation:'巨蟹座'})],[]);
  assert.deepEqual([...typeHints({mbti:'ENFP',constellation:'双子座'},{})],[]);
});
