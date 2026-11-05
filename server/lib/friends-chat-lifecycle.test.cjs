'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFriendsService}=require('./friends-service');
function fixture(){
 const state={version:1,profiles:[{userId:1},{userId:2},{userId:3}],requests:[{id:'r',from:1,to:2,status:'accepted'}],blocks:[],reports:[],compatibilityPairs:[
 {id:'ab',from:'1',to:2,status:'ready',revision:3,authorizations:{1:{},2:{}},messages:[{text:'private'}]},
 {id:'bc',from:2,to:3,status:'ready',revision:1,authorizations:{2:{},3:{}},messages:[{text:'unrelated'}]}]};
 const store={read:()=>structuredClone(state),transaction:fn=>fn(state)};
 return {state,service:createFriendsService(store,{})};
}
test('disconnect clears both-party pair authorization and messages, preserving unrelated pair',()=>{
 const {state,service}=fixture();service.act(1,'r','disconnect');
 assert.equal(state.compatibilityPairs[0].status,'revoked');assert.deepEqual(state.compatibilityPairs[0].messages,[]);
 assert.deepEqual(state.compatibilityPairs[0].authorizations,{});assert.equal(state.compatibilityPairs[0].revision,4);
 assert.equal(state.compatibilityPairs[1].messages[0].text,'unrelated');
});
test('deleting profile removes its pair payload even with mixed identifier types',()=>{
 const {state,service}=fixture();service.remove(1);
 assert.deepEqual(state.compatibilityPairs.map(p=>p.id),['bc']);assert.equal(state.requests.length,0);
 assert.equal(JSON.stringify(state).includes('private'),false);
});
test('outsider cannot disconnect a pair or erase messages',()=>{
 const {state,service}=fixture();assert.throws(()=>service.act(3,'r','disconnect'),e=>e.status===403);
 assert.equal(state.compatibilityPairs[0].messages[0].text,'private');
});
