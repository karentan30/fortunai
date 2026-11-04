const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const elements=new Map();
const handlers={};
function element(){return {innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},close(){},showModal(){}};}
const sandbox={console,Date,URL,setTimeout,clearTimeout,location:{hash:''},navigator:{},FormData:class{},document:{head:{append(){}},createElement(){return element();},querySelector(s){if(s==='#calendar-date'||s==='#inviter-form')return null;if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return[];},addEventListener(n,fn){handlers[n]=fn;}},window:{addEventListener(){},scrollTo(){}}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/friends.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);
assert.equal(run('dayPillar(1991,10,5)'),'戊申');
assert.equal(run('dayPillar(2000,1,7)'),'甲子');
assert.equal(run('dayPillar(2024,2,29)'),run('dayPillar(2024,4,29)'));
assert.match(run('discover()'),/林予/);
run("state.wanted='辛'");
assert.match(run('discover()'),/暂时没有符合条件/);
run("state.my.income='PRIVATE_INCOME';state.my.assets='PRIVATE_ASSETS';state.my.house='PRIVATE_HOUSE';state.vis.income='仅后台匹配';state.vis.assets='双方有意后解锁';state.vis.house='双方有意后解锁'");
for(const value of ['PRIVATE_INCOME','PRIVATE_ASSETS','PRIVATE_HOUSE']){assert.ok(!run('publicText()').includes(value));assert.ok(!run('myPage()').includes(value));}
run("state.vis.income='公开'");
assert.ok(run('publicText()').includes('PRIVATE_INCOME'));
assert.ok(run('myPage()').includes('PRIVATE_INCOME'));
run("state.my.name='<script>alert(1)</script>'");
assert.ok(!run('myPage()').includes('<script>'));
assert.ok(run('myPage()').includes('&lt;script&gt;'));
run("state.theme='水'");assert.match(run('today()'),/沿河散步/);
run("state.theme='土'");assert.match(run('today()'),/陶艺体验/);
assert.match(run('today()'),/黄历宜忌 · 等待数据接入/);
run('profileEditor()');
const profileHtml=elements.get('#dialog-content').innerHTML;
for(const key of ['age','height','weight','school','income','assets','job','industry','title','wantedZodiac']){
 const tag=profileHtml.match(new RegExp('<input[^>]*name="'+key+'"[^>]*>'))?.[0];assert.ok(tag&&/\brequired\b/.test(tag),'Required field: '+key);
}
assert.ok(profileHtml.includes('name="hobbies"'));
run("state.my.title='PRIVATE_TITLE';state.vis.title='仅后台匹配'");
assert.ok(!run('publicText()').includes('PRIVATE_TITLE'));
assert.ok(!run('myPage()').includes('PRIVATE_TITLE'));
run("state.my.housePhoto='blob:PRIVATE_HOUSE_PHOTO';state.my.housePhotoPublic=true;state.vis.house='双方有意后解锁'");
assert.ok(!run('myPage()').includes('blob:PRIVATE_HOUSE_PHOTO'));
run("state.vis.house='公开';state.my.housePhotoPublic=false");
assert.ok(!run('myPage()').includes('blob:PRIVATE_HOUSE_PHOTO'));
run("state.my.housePhotoPublic=true");
assert.ok(run('myPage()').includes('blob:PRIVATE_HOUSE_PHOTO'));
console.log('PASS: calendar reference dates, 60-day cycle, empty filters, public-field privacy, escaping and theme activities');
