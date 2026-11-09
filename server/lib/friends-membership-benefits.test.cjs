'use strict';
// 会员权益：谁看过我的卡片 / 会员筛选（只按对方开放给我的字段）/ 每日认识申请额度。
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
function setup(){
  const store=createFriendsStore();let now=Date.parse('2026-11-06T04:00:00Z');
  const service=createFriendsService(store,{verify:()=>({age:30,dayMaster:'丙',zodiac:'马'})},{enabled:true,clock:()=>now});
  const base={credential:'c',consent:true,crossBorderConsent:true,nickname:'虚构测试',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',education:'本科',school:'暂无',occupation:'暂无',industry:'暂无',title:'暂无',income:'暂不提供',assets:'暂不提供'},dateActivities:['羽毛球'],hobbies:['阅读'],visibility:{},listed:true};
  const save=(uid,extra={})=>service.save(uid,{...base,...extra,fields:{...base.fields,...(extra.fields||{})}});
  const member=uid=>store.transaction(s=>{s.billingOrders=s.billingOrders||[];s.billingOrders.push({id:'XS-'+uid,userId:uid,provider:'direct',matchingMembership:true,benefitsVerified:true,status:'paid',paidAt:new Date(now-1000).toISOString(),accessUntil:new Date(now+30*86400000).toISOString()});});
  return {store,service,save,member,setNow:t=>now=t,now:()=>now};
}

test('card views: deduped per day, never self/blocked/unlisted; free sees real count only, member sees list',()=>{
  const f=setup(),me=f.save('me'),a=f.save('a'),b=f.save('b'),c=f.save('c');f.save('ghost',{listed:false});
  f.service.recordView('a',me.shareId);f.service.recordView('a',me.shareId);f.service.recordView('b',me.shareId);f.service.recordView('me',me.shareId);
  f.service.recordView('ghost',me.shareId);f.service.recordView(undefined,me.shareId);
  assert.equal(f.store.read().cardViews.length,2);
  let v=f.service.viewers('me');assert.equal(v.count,2);assert.equal(v.member,false);assert.deepEqual(v.viewers,[]);
  f.service.block('me',b.shareId);f.service.recordView('c',me.shareId);
  v=f.service.viewers('me');assert.equal(v.count,2,'blocked viewer drops out, c added');
  f.member('me');v=f.service.viewers('me');assert.equal(v.member,true);assert.deepEqual(v.viewers.map(x=>x.shareId).sort(),[a.shareId,c.shareId].sort());
  assert.ok(v.viewers.every(x=>!('userId' in x)),'no internal ids');
  f.setNow(f.now()+86400000);f.service.recordView('a',me.shareId);assert.equal(f.store.read().cardViews.length,4,'new day = new row');
  f.setNow(f.now()+8*86400000);assert.equal(f.service.viewers('me').count,0,'only last 7 days');
  f.service.remove('a');assert.ok(f.store.read().cardViews.every(x=>x.viewer!=='a'&&x.viewed!=='a'));
});

test('member filters are member-only and only match fields the candidate made visible to the viewer',()=>{
  const f=setup();f.save('me');
  const open=f.save('open',{fields:{education:'硕士',income:'50–100万',house:'有房',car:'有车'},visibility:{education:'public',income:'public',house:'public',car:'public'}});
  const hidden=f.save('hidden',{fields:{education:'博士',income:'300万以上',house:'有房',car:'有车'},visibility:{education:'private',income:'connected',house:'private',car:'private'}});
  f.save('low',{fields:{education:'大专',income:'10万以下',house:'无房',car:'无车'},visibility:{education:'public',income:'public',house:'public',car:'public'}});
  assert.throws(()=>f.service.discover('me',{edu:'本科'}),e=>e.status===403&&/会员功能/.test(e.message));
  assert.equal(f.service.discover('me',{}).total,3,'free browsing unaffected');
  f.member('me');
  for(const q of [{edu:'本科'},{income:'30–50万'},{house:'有房'},{car:'有车'}]){
    assert.deepEqual(f.service.discover('me',q).profiles.map(p=>p.shareId),[open.shareId],JSON.stringify(q)+' must not leak hidden values');
  }
  assert.equal(f.service.discover('me',{edu:'博士'}).total,0,'hidden 博士 never matched');
  assert.throws(()=>f.service.discover('me',{edu:'小学'}),{status:400});assert.throws(()=>f.service.discover('me',{house:'无房'}),{status:400});
  // 已核验: only admin-approved marks on visible fields.
  f.store.transaction(s=>{for(const p of s.profiles){if(p.userId==='open')p.verified={education:true};if(p.userId==='hidden')p.verified={education:true};}});
  assert.deepEqual(f.service.discover('me',{verified:'1'}).profiles.map(p=>p.shareId),[open.shareId]);
  assert.ok(hidden);
});

test('requests: 3/day free with remaining count returned, accepting is free, 4th refused in Chinese',()=>{
  const f=setup();f.save('me');const t=['t1','t2','t3','t4'].map(u=>f.save(u));
  const r1=f.service.request('me',t[0].shareId);assert.equal(r1.quota.remaining.request,2);
  f.service.request('me',t[1].shareId);f.service.request('me',t[2].shareId);
  assert.throws(()=>f.service.request('me',t[3].shareId),e=>e.status===429&&e.message==='今天的3次认识申请用完了，明天再来，或开通会员每天20次');
  // The receiver accepting costs nothing.
  const inbound=f.service.request('t4',(f.service.me('me')).shareId);f.service.act('me',inbound.id,'accept');assert.equal(f.service.quota('me').used.request,3);
  f.member('me');assert.equal(f.service.quota('me').remaining.request,17);
});
