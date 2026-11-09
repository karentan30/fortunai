'use strict';
// 找朋友：年龄/身高范围筛选（免费）。只按对方对这位访客可见的资料比较；不合法参数 400，绝不放宽。
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {findForbidden}=require('./friends-copy-guard');
function setup(){
  const store=createFriendsStore(),now=Date.parse('2026-11-10T04:00:00Z');
  const service=createFriendsService(store,{verify:c=>({age:Number(c),dayMaster:'丙',zodiac:'马'})},{enabled:true,clock:()=>now});
  const base={consent:true,crossBorderConsent:true,nickname:'虚构测试',city:'北京',intent:'交朋友',fields:{weight:'60',education:'本科',school:'暂无',occupation:'暂无'},dateActivities:['羽毛球'],hobbies:['阅读'],listed:true};
  const save=(uid,age,height,visibility={age:'public',height:'public'})=>service.save(uid,{...base,credential:String(age),fields:{...base.fields,height:String(height)},visibility});
  const member=uid=>store.transaction(s=>{s.billingOrders=s.billingOrders||[];s.billingOrders.push({id:'XS-'+uid,userId:uid,provider:'direct',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:new Date(now-1000).toISOString(),accessUntil:new Date(now+30*86400000).toISOString()});});
  return {service,save,member};
}
const ids=r=>r.profiles.map(p=>p.shareId).sort();

test('age/height ranges are free, inclusive, and only match values visible to the viewer',()=>{
  const f=setup();f.save('me',30,170);
  const a=f.save('a25',25,160),b=f.save('b30',30,175),c=f.save('c40',40,185);
  const hiddenAge=f.save('hAge',30,170,{height:'public'}),hiddenHeight=f.save('hH',30,170,{age:'public'});
  const connectedOnly=f.save('conn',30,170,{age:'connected',height:'connected'});
  const d=q=>ids(f.service.discover('me',q));
  assert.equal(f.service.discover('me',{}).total,6,'no range = everyone');
  assert.deepEqual(d({ageMin:'25',ageMax:'35'}),[a.shareId,b.shareId,hiddenHeight.shareId].sort(),'hidden/connected-only age never matched');
  assert.deepEqual(d({heightMin:'170',heightMax:'185'}),[b.shareId,c.shareId,hiddenAge.shareId].sort());
  assert.deepEqual(d({ageMin:'26',ageMax:'40',heightMin:'176',heightMax:'250'}),[c.shareId]);
  assert.deepEqual(d({ageMax:'25'}),[a.shareId],'one-sided bound');
  assert.deepEqual(d({ageMin:'30',ageMax:'30'}),[b.shareId,hiddenHeight.shareId].sort(),'inclusive both ends');
  assert.ok(connectedOnly);
  // Free: no member needed, no 403. Member filters stay member-only alongside a range.
  assert.throws(()=>f.service.discover('me',{ageMin:'25',edu:'本科'}),e=>e.status===403);
  f.member('me');assert.equal(f.service.discover('me',{ageMin:'25',edu:'本科'}).total,0,'education not public to me → member filter matches nobody');
  assert.equal(f.service.discover('me',{ageMin:'25'}).total,4);
});

test('invalid range params are rejected with 400, never widened or ignored',()=>{
  const f=setup();f.save('me',30,170);f.save('x',30,170);
  const bad=[{ageMin:'17'},{ageMax:'100'},{ageMin:'abc'},{ageMin:'25.5'},{ageMin:'-1'},{ageMin:' 25'},{ageMin:'30',ageMax:'20'},
    {heightMin:'99'},{heightMax:'251'},{heightMin:'180',heightMax:'170'},{heightMin:'1e2'},{ageMin:['20','30']},{heightMax:{}}];
  for(const q of bad)assert.throws(()=>f.service.discover('me',q),e=>e.status===400,JSON.stringify(q));
  assert.equal(f.service.discover('me',{ageMin:'',ageMax:'',heightMin:'',heightMax:''}).total,1,'empty = not set');
});

test('discover UI: dual range sliders with labels and live text, prefilled from own profile, honest copy',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../../assets/js/friends-discover-filters.js'),'utf8');
  const R=require('../../assets/js/friends-discover-filters.js');
  // own age −5…+5 clamped 18–99; no gender field exists, so no gender convention is applied.
  assert.deepEqual(R.defaults({fields:{age:'30',height:'170'}}).age,[25,35]);
  assert.deepEqual(R.defaults({fields:{age:'20'}}).age,[18,25]);
  assert.deepEqual(R.defaults({fields:{age:'97'}}).age,[92,99]);
  assert.deepEqual(R.defaults({fields:{height:'170'}}).height,[150,190]);
  assert.deepEqual(R.defaults({fields:{}}),{age:[18,99],height:[140,210],preset:false},'nothing known = full range, no claim of preset');
  assert.equal(R.defaults({fields:{age:'30'}}).preset,true);
  // Full range is not sent (no filter); a narrowed side is.
  assert.deepEqual(R.toParams({age:[18,99],height:[140,210]}),[]);
  assert.deepEqual(R.toParams({age:[25,35],height:[140,190]}),[['ageMin','25'],['ageMax','35'],['heightMax','190']]);
  assert.match(ui,/已按你的资料预设，可拖动调整/);
  assert.match(ui,/type="range"/);assert.match(ui,/aria-valuetext|aria-live/);assert.match(ui,/高级选项/);
  assert.doesNotMatch(ui,/大数据|%|不合/);assert.deepEqual(findForbidden(ui),[]);
  assert.doesNotMatch(ui,/innerHTML\s*=\s*[^;]*\$\{(?!esc\()[^}]*(nickname|city)/,'no raw user data in innerHTML');
  const page=fs.readFileSync(path.join(__dirname,'../../pages/friends-connect.html'),'utf8');
  assert.ok(page.indexOf('friends-discover-filters.js')>-1&&page.indexOf('friends-discover-filters.js')<page.indexOf('/friends.js'),'loaded before friends.js');
});
