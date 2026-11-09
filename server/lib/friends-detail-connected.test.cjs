'use strict';
// Card detail opened from #discover: once two people are mutually connected, the card API says so
// and the dialog must offer 「你们已互相认识 → 看联系方式」 (→ #connections) instead of 「申请认识」.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {createChartService}=require('./friends-chart');
const {createFriendsStore}=require('./friends-store');
const {createFriendsService}=require('./friends-service');

function setup(){
  const store=createFriendsStore(),charts=createChartService('test-signing-key-'.repeat(4)),service=createFriendsService(store,charts);
  const credential=charts.issue({birthday:'1991-08-28',calendar:'lunar',hour:6}).credential;
  const data=(extra={})=>({credential,consent:true,crossBorderConsent:true,nickname:'测试',city:'上海',intent:'交朋友',fields:{height:'170',weight:'60',education:'本科',school:'学校',occupation:'职员'},visibility:{school:'public'},dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],listed:true,contact:'wx-b',contactConsent:true,...extra});
  return {service,data};
}

test('card API exposes connected=false before and true after mutual accept, false again after disconnect',()=>{
  const {service:s,data}=setup();s.save('a',data());const b=s.save('b',data());
  assert.equal(s.card(b.shareId,'a').connected,false);
  const r=s.request('a',b.shareId);
  assert.equal(s.card(b.shareId,'a').connected,false,'pending request is not connected');
  s.act('b',r.id,'accept');
  assert.equal(s.card(b.shareId,'a').connected,true);
  s.act('a',r.id,'disconnect');
  assert.equal(s.card(b.shareId,'a').connected,false);
});

test('detail dialog branches on p.connected: connected shows 看联系方式 → #connections, never 申请认识',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../../assets/js/friends.js'),'utf8');
  const start=src.indexOf('async function showDetail('),end=src.indexOf('async function showConnections(');
  assert.ok(start>0&&end>start);const body=src.slice(start,end);
  const m=body.match(/\$\{p\.connected\?`([^`]*)`:`([^`]*)`\}/);
  assert.ok(m,'showDetail must render the CTA footer conditionally on p.connected');
  const [,connected,other]=m;
  assert.match(connected,/你们已互相认识/);assert.match(connected,/看联系方式/);assert.match(connected,/href="#connections"/);
  assert.doesNotMatch(connected,/申请认识|apply-person/);
  assert.match(other,/id="apply-person"/);
  assert.match(body,/\$\('#apply-person'\)\?\.addEventListener/,'apply handler must tolerate the connected variant without the button');
});
