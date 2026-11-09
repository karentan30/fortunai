'use strict';
// 「约会除了吃饭喝咖啡，还想一起做什么」：固定清单校验、老资料兼容、卡片展示、文案红线。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const DA=require('../../assets/js/friends-date-activities');
const {findForbidden}=require('./friends-copy-guard');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');

function setup(){
  const store=createFriendsStore(),charts=createChartService('test-signing-key-'.repeat(4)),service=createFriendsService(store,charts);
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',education:'本科',school:'学校',occupation:'职员'},visibility:{school:'public'},dateActivities:['羽毛球','看展'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'wx',contactConsent:true,...extra});
  return {store,service,data};
}

test('shared list: 25 sports + 7 others, grouped, no duplicates, max 8',()=>{
  assert.equal(DA.DATE_ACTIVITY_GROUPS[0].label,'运动');assert.equal(DA.DATE_ACTIVITY_GROUPS[0].items.length,25);
  assert.equal(DA.DATE_ACTIVITY_GROUPS[1].label,'其他');assert.equal(DA.DATE_ACTIVITY_GROUPS[1].items.length,7);
  assert.equal(new Set(DA.DATE_ACTIVITIES).size,32);assert.equal(DA.DATE_ACTIVITY_MAX,8);
});

test('validation: 1-8 items from the fixed list, bio optional',()=>{
  const {service:s,data}=setup();
  const p=s.save('a',data({bio:''}));assert.deepEqual(p.dateActivities,['羽毛球','看展']);assert.equal(p.bio,'');
  assert.throws(()=>s.save('b',data({dateActivities:[]})),/至少/);
  assert.throws(()=>s.save('b',data({dateActivities:['吃饭']})),/无效/);
  assert.throws(()=>s.save('b',data({dateActivities:'羽毛球'})),/无效/);
  assert.throws(()=>s.save('b',data({dateActivities:DA.DATE_ACTIVITIES.slice(0,9)})),/最多/);
  assert.equal(s.save('b',data({dateActivities:DA.DATE_ACTIVITIES.slice(0,8)})).dateActivities.length,8);
  const {service:t,data:d2}=setup();const b=d2();delete b.dateActivities;assert.throws(()=>t.save('c',b),/至少/);
});

test('legacy profile (bio, no dateActivities) re-saves untouched; editing requires >=1',()=>{
  const {store,service:s,data}=setup();
  s.save('a',data({bio:'旧的一句话'}));
  store.transaction(st=>{delete st.profiles.find(x=>x.userId==='a').dateActivities;});
  const b=s.save('b',data());
  const seen=s.card(b.shareId,'a');assert.ok(seen);
  const legacy=data({bio:'旧的一句话'});delete legacy.dateActivities;
  const saved=s.save('a',legacy);assert.equal(saved.dateActivities,undefined);assert.equal(saved.bio,'旧的一句话');
  const viewed=s.card(saved.shareId,'b');assert.equal(viewed.dateActivities,undefined);assert.equal(viewed.bio,'旧的一句话');
  assert.throws(()=>s.save('a',data({dateActivities:[]})),/至少/);
  assert.deepEqual(s.save('a',data({dateActivities:['游泳']})).dateActivities,['游泳']);
  const keep=data();delete keep.dateActivities;assert.deepEqual(s.save('a',keep).dateActivities,['游泳']);
});

test('card shows activities and bio; page copy updated',()=>{
  const {service:s,data}=setup();
  const a=s.save('a',data({bio:'羽毛球打了三年，可以带新手'}));s.save('b',data());
  const card=s.card(a.shareId,'b');assert.deepEqual(card.dateActivities,['羽毛球','看展']);assert.equal(card.bio,'羽毛球打了三年，可以带新手');
  const js=fs.readFileSync(path.join(__dirname,'../../assets/js/friends.js'),'utf8');
  assert.match(js,/ps-acts[^`]*\$\{p\.dateActivities\.map/);assert.match(js,/想多说一句（选填）/);assert.doesNotMatch(js,/我能与你分享什么/);
});

test('copy guard: new copy has no forbidden words or percentages',()=>{
  const all=[...DA.DATE_ACTIVITIES,'约会除了吃饭喝咖啡，还想一起做什么','想多说一句（选填）','羽毛球打了三年，可以带新手'].join(' ');
  assert.deepEqual(findForbidden(all),[]);
});

test('shared activities: reason 「都想约着一起…」, filter by activity, ranks above non-shared',()=>{
  const {service:s,data}=setup();
  s.save('me',data({dateActivities:['健身','攀岩'],hobbies:['读书']}));
  s.save('gym',data({nickname:'健身搭子',dateActivities:['健身'],hobbies:['电影']}));
  s.save('other',data({nickname:'不健身',dateActivities:['看展'],hobbies:['电影']}));
  const all=s.discover('me').profiles;
  assert.equal(all[0].nickname,'健身搭子');
  assert.ok(all[0].reasons.includes('都想约着一起健身'));
  assert.ok(!all[1].reasons.some(r=>r.startsWith('都想约着一起')));
  const only=s.discover('me',{activity:'健身'}).profiles;
  assert.deepEqual(only.map(p=>p.nickname),['健身搭子']);
  assert.equal(s.discover('me',{activity:'游泳'}).profiles.length,0);
});
