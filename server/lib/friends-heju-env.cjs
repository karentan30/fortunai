'use strict';
// 相合局测试共用：建一个带审核、问卷、相合局服务的内存环境。
'use strict';
const {createFriendsStore}=require('./friends-store'),{createFriendsService}=require('./friends-service');
const {createReviewAdmin}=require('./friends-review');
const Q=require('./friends-questionnaire');
const H=require('./friends-heju-match');
const {createHejuService,LIMITS}=require('./friends-heju');

const HOUR=3600000,DAY=24*HOUR;
// 2026-11-16 周一 09:00 北京时间 = 01:00 UTC
const T0=Date.UTC(2026,10,16,1,0,0);
function setup({gate=true}={}){
  const store=createFriendsStore(),charts={verify:c=>({age:30,dayMaster:c,zodiac:'鼠'})};
  const friends=createFriendsService(store,charts,{reviewGate:gate}),admin=createReviewAdmin(store);
  const clock={t:T0},notices=[];
  const heju=createHejuService(store,{clock:()=>clock.t,notify:(...a)=>notices.push(a)});
  const answers=(over={})=>{
    const dims={};
    for(const id of Q.BANK.quickPath.questions){
      let q,dim;for(const d of Q.BANK.dimensions)for(const x of d.questions)if(x.id===id){q=x;dim=d.id;}
      if(q.sensitive)continue;
      const v=over[id]||{};
      const value=v.value!==undefined?v.value:(q.type==='multi'?[q.options[0].value]:q.options[0].value);
      (dims[dim]=dims[dim]||{status:'done',answers:{}}).answers[id]={state:'answered',value,...(v.importance?{importance:v.importance}:{})};
    }
    return dims;
  };
  const data=(stem,extra={})=>({credential:stem,consent:true,crossBorderConsent:true,nickname:'同学'+stem,city:'北京',intent:'交朋友',
    fields:{height:'170',weight:'60',education:'本科',school:'示范大学',occupation:'暂无',industry:'暂无',title:'暂无',income:'暂不提供',assets:'暂不提供'},
    dateActivities:['羽毛球'],hobbies:['羽毛球'],targetStems:['不限'],targetZodiacs:['不限'],visibility:{dayMaster:'public',zodiac:'public',education:'public'},listed:true,...extra});
  const people=new Map();
  function person(uid,stem,{approve=true,school,quick=true,over,card=true,extra={}}={}){
    if(card){
      const e={...extra};if(school!==undefined)e.fields={...data(stem).fields,school};
      const p=friends.save(uid,data(stem,e));people.set(uid,p);
      if(approve)admin.decide(p.shareId,{decision:'approve'});
    }
    if(quick)store.transaction(s=>{s.marriageQuestionnaires=(s.marriageQuestionnaires||[]).filter(r=>r.userId!==uid);s.marriageQuestionnaires.push({userId:uid,version:Q.BANK.version,dimensions:answers(over)});});
    return uid;
  }
  const signup=(uid,o={})=>heju.signup(uid,{activity:'羽毛球',windows:['sat-pm','sun-pm'],area:'东校区',adult:true,consent:true,...o});
  const state=()=>store.read();
  return {store,friends,admin,heju,clock,notices,person,signup,state,answers,people};
}
function four(env){const {person,signup}=env;for(const [u,s] of [['a','甲'],['b','己'],['c','壬'],['d','丙']]){person(u,s);signup(u);}}
module.exports={setup,four,T0,HOUR,DAY,LIMITS,H,Q};
