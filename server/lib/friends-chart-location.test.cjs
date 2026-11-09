'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {Solar}=require('./bazi-engine/vendor/lunar-typescript');
const {searchCities}=require('./friends-location');const {calculate,createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');const {createFriendsService}=require('./friends-service');
const ny=searchCities('纽约')[0],cc=searchCities('长春')[0];
test('single clock input, city search, adult and historical offset',()=>{assert.ok(ny&&cc);const c=calculate({birthday:'1990-07-01',calendar:'solar',time:'06:00',cityId:ny.id});assert.equal(c.birthLocation.offsetMinutes,-240);assert.equal(c.complete,true);assert.ok(c.age>=18);assert.throws(()=>calculate({birthday:'1990-07-01',time:'25:00',cityId:cc.id}));assert.throws(()=>calculate({birthday:'2020-07-01',time:'06:00',cityId:cc.id}));});
test('New York pillars cross the same absolute Lichun boundary',()=>{
const spring=Solar.fromYmd(1990,2,1).getLunar().getJieQiTable()['立春'];assert.ok(spring);
const instant=Date.UTC(spring.getYear(),spring.getMonth()-1,spring.getDay(),spring.getHour()-8,spring.getMinute(),spring.getSecond());
function local(t){const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:ny.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});const p={};for(const x of fmt.formatToParts(new Date(t)))p[x.type]=x.value;return {birthday:`${p.year}-${p.month}-${p.day}`,calendar:'solar',time:`${p.hour}:${p.minute}`,cityId:ny.id};}
const before=calculate(local(instant-120000)),after=calculate(local(instant+120000));assert.notEqual(before.pillars.year,after.pillars.year);assert.notEqual(before.pillars.month,after.pillars.month);
});
test('raw birth date/instant never persist; public cards exclude birth city',()=>{
const charts=createChartService('location-test-key-'.repeat(4));const issued=charts.issue({birthday:'1990-07-01',calendar:'solar',time:'06:00',cityId:ny.id});
const payload=JSON.parse(Buffer.from(issued.credential.split('.')[0],'base64url').toString());assert.deepEqual(charts.verify(issued.credential),issued.chart);
function noRaw(value){if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){assert.ok(!['birthday','instant','localTime'].includes(k),k);noRaw(v);}}
noRaw(issued.chart);noRaw(payload);
const store=createFriendsStore(),s=createFriendsService(store,charts);const p=s.save('a',{credential:issued.credential,consent:true,crossBorderConsent:true,nickname:'本人自报',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',school:'暂无',occupation:'暂无',industry:'暂无',title:'暂无',income:'自报暂无',assets:'自报暂无'},visibility:{dayMaster:'public',zodiac:'public'},dateActivities:['羽毛球'],hobbies:['运动'],targetStems:['不限'],targetZodiacs:['不限'],listed:true});noRaw(store.read());const card=s.card(p.shareId);assert.equal(card.city,'上海');assert.equal(card.birthLocation,undefined);assert.equal(card.chart.birthLocation,undefined);assert.ok(!JSON.stringify(card).includes(ny.id));
});
