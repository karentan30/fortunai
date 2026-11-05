'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {typeSuggestions,normalizeTypes,CONSTELLATIONS,MBTIS}=require('./friends-preferences');
function setup(){const store=createFriendsStore(),service=createFriendsService(store,{verify:()=>({age:30,dayMaster:'戊',zodiac:'羊'})});const data={credential:'test',consent:true,nickname:'测试',city:'北京',intent:'交朋友',fields:{height:'170',weight:'60',school:'学校',occupation:'职员',income:'暂不提供',assets:'暂不提供'},hobbies:['阅读'],targetStems:['不限'],targetZodiacs:['不限'],listed:true};service.save('a',data);return {service,store,data};}
test('type suggestions are bounded, explanatory and support unknown types without inventing results',()=>{
 for(const constellation of CONSTELLATIONS){const r=typeSuggestions({constellation});assert.equal(r.constellations.length,2);assert.ok(!r.constellations.includes(constellation));assert.match(r.basis.constellations,/不是科学/);}
 for(const mbti of MBTIS){const r=typeSuggestions({mbti});assert.equal(r.mbtis.length,3);assert.ok(r.mbtis.every(x=>x!==mbti&&x.slice(1,3)===mbti.slice(1,3)));assert.match(r.basis.mbtis,/不代表/);}
 assert.deepEqual(typeSuggestions().constellations,[]);assert.deepEqual(typeSuggestions().mbtis,[]);
 for(const b of [{constellation:'未知座'},{mbti:'INTJ-A'},{targetMbtis:['fake']},{targetConstellations:'白羊座'},{mbti:null}])assert.throws(()=>normalizeTypes(b));
 assert.equal(normalizeTypes({mbti:' enfp '}).mbti,'ENFP');
});
test('old profile saves preserve optional types and their visibility; explicit clearing works',()=>{
 const {service:s,data}=setup();s.save('a',{...data,mbti:'ENFP',constellation:'白羊座',targetMbtis:['INFJ'],targetConstellations:['射手座'],visibility:{mbti:'public',constellation:'connected'}});
 const p=s.save('a',data);assert.equal(p.mbti,'ENFP');assert.equal(p.visibility.mbti,'public');assert.deepEqual(p.targetMbtis,['INFJ']);assert.ok(s.me('a').recommendations.mbtis.length);
 const empty=s.save('a',{...data,mbti:'',constellation:'',targetMbtis:[],targetConstellations:[]});assert.equal(empty.mbti,'');assert.deepEqual(empty.targetMbtis,[]);
});
test('private types cannot affect discover filters, reasons or order; connected disclosure revokes',()=>{
 const {service:s,data}=setup();s.save('a',{...data,targetMbtis:['INFJ'],targetConstellations:['射手座']});
 const plain=s.save('plain',data),hidden=s.save('hidden',{...data,mbti:'INFJ',constellation:'射手座',visibility:{mbti:'connected',constellation:'private'}});
 let r=s.discover('a');assert.equal(r.profiles[0].shareId,plain.shareId);assert.equal(s.discover('a',{mbti:'INFJ'}).total,0);assert.equal(s.discover('a',{constellation:'射手座'}).total,0);assert.ok(!r.profiles.some(p=>p.reasons.some(x=>/MBTI|星座/.test(x))));
 const request=s.request('a',hidden.shareId);s.act('hidden',request.id,'accept');r=s.discover('a');assert.equal(r.profiles[0].shareId,hidden.shareId);assert.equal(r.profiles[0].mbti,'INFJ');assert.equal(r.profiles[0].constellation,undefined);assert.equal(s.discover('a',{mbti:'INFJ'}).total,1);s.act('a',request.id,'disconnect');assert.equal(s.discover('a',{mbti:'INFJ'}).total,0);
});
test('public type preferences guide discovery without leaking desired types or fabricating mutual attraction',()=>{
 const {service:s,data}=setup();s.save('a',{...data,targetMbtis:['INFJ'],targetConstellations:['射手座']});
 s.save('other',data);const match=s.save('match',{...data,mbti:'INFJ',constellation:'射手座',targetMbtis:['ENFP'],visibility:{mbti:'public',constellation:'public'}});
 const p=s.discover('a').profiles[0];assert.equal(p.shareId,match.shareId);assert.ok(p.reasons.some(x=>/MBTI/.test(x)));assert.ok(p.reasons.some(x=>/星座/.test(x)));assert.equal(p.targetMbtis,undefined);assert.equal(p.targetConstellations,undefined);assert.equal(p.score,undefined);
 s.save('a',{...data,targetMbtis:['不限','INFJ'],targetConstellations:[]});assert.ok(!s.discover('a').profiles.some(p=>p.reasons.some(x=>/MBTI|星座/.test(x))));
});
test('poster wanted-types toggle defaults on, persists off, survives saves that omit it, and never leaks to others',()=>{
 const {service:s,data}=setup();
 assert.equal(s.save('a',data).posterShowTargets,true);
 assert.equal(s.save('a',{...data,targetMbtis:['ENFP'],posterShowTargets:false}).posterShowTargets,false);
 assert.equal(s.save('a',{...data,targetMbtis:['ENFP']}).posterShowTargets,false);assert.equal(s.me('a').posterShowTargets,false);
 assert.equal(s.save('a',{...data,posterShowTargets:true}).posterShowTargets,true);
 s.save('b',data);const seen=s.discover('b').profiles.find(p=>p.nickname===data.nickname);assert.ok(seen);assert.equal(seen.targetMbtis,undefined);assert.equal(seen.posterShowTargets,undefined);
});
test('new relationship purposes and legacy serious relationship remain accepted',()=>{
 const {service:s,data}=setup();for(const intent of ['交朋友','找搭子','找闺蜜','Dating','认真恋爱','认真结婚'])assert.equal(s.save('a',{...data,intent}).intent,intent);
});
