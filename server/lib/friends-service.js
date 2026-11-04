'use strict';
const crypto=require('node:crypto');
const {STEMS,ZODIACS,bad}=require('./friends-chart');
const FIELDS=['age','height','weight','school','occupation','industry','title','income','assets'];
const SCOPES=['public','connected','private'];
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const missing=()=>{const e=Error('卡片不存在或已停止公开');e.status=404;throw e;};
const denied=()=>{const e=Error('没有操作权限');e.status=403;throw e;};
const conflict=m=>{const e=Error(m);e.status=409;throw e;};
const array=(v,valid,max=12)=>Array.isArray(v)?[...new Set(v.filter(x=>valid.includes(x)))].slice(0,max):[];
function createFriendsService(store,charts) {
  const blocked=(s,a,b)=>s.blocks.some(x=>(x.by===a&&x.target===b)||(x.by===b&&x.target===a));
  const connection=(s,a,b)=>s.requests.some(r=>r.status==='accepted'&&((r.from===a&&r.to===b)||(r.to===a&&r.from===b)));
  const active=(s,p,viewer)=>p?.listed&&!blocked(s,p.userId,viewer);
  function project(s,p,viewer) {
    if(!p || !active(s,p,viewer)) missing();
    const connected=!!mine(s,viewer)?.listed&&connection(s,p.userId,viewer),self=p.userId===viewer;
    const visible=k=>self||p.visibility[k]==='public'||(connected&&p.visibility[k]==='connected');
    const fields=Object.fromEntries(FIELDS.filter(visible).map(k=>[k,p.fields[k]]));
    const chart=Object.fromEntries(['dayMaster','zodiac'].filter(visible).map(k=>[k,p.chart[k]]));
    return {id:p.shareId,shareId:p.shareId,nickname:p.nickname,city:p.city,intent:p.intent,fields,chart,
      hobbies:p.hobbies,targetStems:p.targetStems,targetZodiacs:p.targetZodiacs,bio:p.bio,connected};
  }
  const mine=(s,uid)=>s.profiles.find(p=>p.userId===uid);
  const needMine=(s,uid)=>{const p=mine(s,uid);if(!p||!p.listed)bad('请先完善个人资料并同意加入人库');return p;};
  return {
    me(uid){return structuredClone(mine(store.read(),uid)||null);},
    save(uid,b) {
      if(b.consent!==true)bad('请确认本人资料及展示权限');
      return store.transaction(s=>{
        const prev=mine(s,uid), chart=b.credential?charts.verify(b.credential):prev?.chart;
        if(!chart || chart.age<18)bad('请先生成日主卡');
        const nickname=text(b.nickname,24),city=text(b.city,24),intent=b.intent;
        if(!nickname||!city||!['交朋友','找搭子','认真恋爱'].includes(intent))bad('请补全昵称、城市和认识目的');
        const fields={age:String(chart.age)};
        for(const k of FIELDS.slice(1)){fields[k]=text(b.fields?.[k],80);if(!fields[k])bad('请补齐九项个人资料');}
        const height=Number(fields.height),weight=Number(fields.weight);
        if(!Number.isFinite(height)||height<80||height>250||!Number.isFinite(weight)||weight<25||weight>300)bad('身高用厘米、体重用公斤，请检查数值');
        const visibility={};for(const k of [...FIELDS,'dayMaster','zodiac']) visibility[k]=SCOPES.includes(b.visibility?.[k])?b.visibility[k]:'private';
        const hobbies=Array.isArray(b.hobbies)?[...new Set(b.hobbies.map(x=>text(x,24)).filter(Boolean))].slice(0,10):[];
        const targetStems=array(b.targetStems,[...STEMS,'不限']);const targetZodiacs=array(b.targetZodiacs,[...ZODIACS,'不限']);
        if(!hobbies.length||!targetStems.length||!targetZodiacs.length)bad('请选择爱好及想认识的日主、生肖；也可选不限');
        const p={userId:uid,shareId:prev?.shareId||crypto.randomBytes(18).toString('hex'),nickname,city,intent,fields,visibility,hobbies,targetStems,targetZodiacs,
          bio:text(b.bio,240),contact:text(b.contact,120),contactConsent:b.contactConsent===true,listed:b.listed===true,
          chart,consentAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        if(prev)s.profiles[s.profiles.indexOf(prev)]=p;else s.profiles.push(p);
        return structuredClone(p);
      });
    },
    discover(uid,q={}){
      const s=store.read();needMine(s,uid);
      const all=s.profiles.filter(p=>p.userId!==uid&&active(s,p,uid)).map(p=>project(s,p,uid))
        .filter(p=>(!q.city||p.city===q.city)&&(!q.stem||p.chart.dayMaster===q.stem)&&(!q.zodiac||p.chart.zodiac===q.zodiac));
      const offset=Math.max(0,Math.min(10000,Number(q.offset)||0));
      return {profiles:all.slice(offset,offset+24),total:all.length,nextOffset:offset+24<all.length?offset+24:null};
    },
    card(id,uid){const s=store.read();return project(s,s.profiles.find(p=>p.shareId===id),uid);},
    request(uid,shareId){return store.transaction(s=>{
      const self=needMine(s,uid),target=s.profiles.find(p=>p.shareId===shareId);
      if(!active(s,target,uid))missing();if(target.userId===uid)bad('不能向自己申请');
      const old=s.requests.find(r=>((r.from===uid&&r.to===target.userId)||(r.to===uid&&r.from===target.userId))&&['pending','accepted'].includes(r.status));
      if(old)conflict(old.status==='accepted'?'你们已经连接':'已有待处理申请');
      if(s.requests.some(r=>r.from===uid&&r.to===target.userId&&Date.now()-Date.parse(r.createdAt)<86400000))conflict('24小时内请勿重复申请');
      const r={id:crypto.randomUUID(),from:self.userId,to:target.userId,status:'pending',createdAt:new Date().toISOString()};s.requests.push(r);return {id:r.id,status:r.status};
    });},
    requests(uid){const s=store.read();return s.requests.filter(r=>(r.from===uid||r.to===uid)&&!blocked(s,r.from,r.to)).map(r=>{
      const other=mine(s,r.from===uid?r.to:r.from),self=mine(s,uid);
      const person=other&&other.listed?project(s,other,uid):{nickname:'对方已退出人库',shareId:null};
      const out={id:r.id,status:r.status,createdAt:r.createdAt,direction:r.to===uid?'incoming':'outgoing',person};
      if(r.status==='accepted'&&other?.listed&&self?.listed&&other.contactConsent&&self.contactConsent)out.contact=other.contact;
      return out;
    });},
    act(uid,id,action){return store.transaction(s=>{
      const r=s.requests.find(x=>x.id===id);if(!r){missing();}if(r.from!==uid&&r.to!==uid)denied();
      if(blocked(s,r.from,r.to))denied();
      if(action==='disconnect'){
        if(r.status!=='accepted')conflict('只有已连接的双方可以解除连接');
        r.status='disconnected';r.updatedAt=new Date().toISOString();return {id:r.id,status:r.status};
      }
      if(r.status!=='pending')conflict('申请已经处理');
      if(action==='withdraw'&&r.from===uid)r.status='withdrawn';
      else if(['accept','decline'].includes(action)&&r.to===uid){
        if(action==='accept'){needMine(s,r.from);needMine(s,r.to);}r.status=action==='accept'?'accepted':'declined';
      }else denied();
      r.updatedAt=new Date().toISOString();return {id:r.id,status:r.status};
    });},
    block(uid,shareId){return store.transaction(s=>{const p=s.profiles.find(x=>x.shareId===shareId);if(!p)missing();if(p.userId===uid)bad('不能拉黑自己');if(!s.blocks.some(x=>x.by===uid&&x.target===p.userId))s.blocks.push({by:uid,target:p.userId});return {ok:true};});},
    report(uid,shareId,reason){return store.transaction(s=>{const p=s.profiles.find(x=>x.shareId===shareId);if(!p)missing();const why=text(reason,300);if(!why)bad('请填写举报原因');s.reports.push({id:crypto.randomUUID(),by:uid,target:p.userId,reason:why,createdAt:new Date().toISOString()});return {ok:true,message:'举报已记录，试用期间由管理员人工处理'};});},
    remove(uid){return store.transaction(s=>{s.profiles=s.profiles.filter(p=>p.userId!==uid);s.requests=s.requests.filter(r=>r.from!==uid&&r.to!==uid);/* Keep account-level blocks: deleting/recreating a profile must not reset someone else's refusal. */return {ok:true};});}
  };
}
module.exports={createFriendsService,FIELDS};
