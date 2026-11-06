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
test('星座 pair hint follows classic element groupings, one short hint only',()=>{
  const {signHint,signPairText,typeHints}=hints();
  assert.equal(signHint('双子座','双子座'),'同为双子座');
  assert.equal(signHint('双子座','天秤座'),'同属风象');
  assert.equal(signHint('白羊座','射手座'),'同属火象');
  assert.equal(signHint('金牛座','摩羯座'),'同属土象');
  assert.equal(signHint('巨蟹','双鱼座'),'同属水象');
  assert.equal(signHint('白羊座','双子座'),'风火相投');
  assert.equal(signHint('水瓶座','狮子座'),'对宫星座，互补');
  assert.equal(signHint('狮子座','天秤座'),'风火相投');
  assert.equal(signHint('处女座','天蝎座'),'水土相合');
  assert.equal(signHint('巨蟹座','金牛座'),'水土相合');
  // opposite signs (6 apart) win over the element pair
  for(const [a,b] of [['白羊座','天秤座'],['金牛座','天蝎座'],['双子座','射手座'],['巨蟹座','摩羯座'],['狮子座','水瓶座'],['处女座','双鱼座']]){assert.equal(signHint(a,b),'对宫星座，互补');assert.equal(signHint(b,a),'对宫星座，互补');}
  // fire–earth, fire–water, air–earth, air–water: nothing
  for(const [a,b] of [['白羊座','金牛座'],['狮子座','巨蟹座'],['双子座','处女座'],['天秤座','双鱼座']])assert.equal(signHint(a,b),'');
  assert.equal(signHint('','双子座'),'');assert.equal(signHint('双子座','<b>'),'');
  assert.equal(signPairText('双子座','天秤座'),'双子 × 天秤 · 同属风象');
  assert.equal(signPairText('双子座','金牛座'),'');
  assert.deepEqual([...typeHints({mbti:'',constellation:'双子座'},{constellation:'天秤座'})],['同属风象']);
  const all=['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
  for(const a of all)for(const b of all){const h=signHint(a,b);assert.equal(h,signHint(b,a));assert.doesNotMatch(h,/配|姻|缘|注定|最佳|天生一对/);}
});
