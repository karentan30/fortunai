'use strict';
const XB=require('./friends-cross-border');
const crypto=require('node:crypto'),{calculate}=require('./friends-chart');
const VERSION='private-intake-2026-11-04-v1',PURPOSE='private_profile_and_optional_matching';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function keys(value,allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(400,'包含不支持的资料字段');}
function text(value,max){if(typeof value!=='string'||value.length>max||/data:[^;]+;base64,|file:\/\/|^[A-Za-z]:\\/i.test(value))fail(400,'请填写限长文字，不要上传图片或文件路径');return value.trim();}
function createFriendsIntakeService({store,clock=()=>Date.now(),compute=calculate}={}){
 if(!store?.read||!store?.transaction)throw Error('建档需要现有加密存储');
 const rows=s=>{if(!s.privateIntakes)s.privateIntakes=[];if(!Array.isArray(s.privateIntakes))throw Error('建档数据异常');return s.privateIntakes;};
 const own=uid=>{if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');};
 const view=r=>r?structuredClone({recordId:r.recordId,revision:r.revision,birthInput:r.birthInput,draft:r.draft,saveBirthConsent:r.saveBirthConsent,matchingConsent:r.matchingConsent,consentVersion:r.consentVersion,purpose:r.purpose,updatedAt:r.updatedAt,visibility:'private'}):null;
 return {
  get(uid){own(uid);return {intake:view(rows(store.read()).find(r=>r.userId===uid))};},
  save(uid,body){own(uid);XB.check(store,uid);keys(body,['birthInput','draft','saveBirthConsent','matchingConsent','consentVersion','purpose','expectedRevision']);if(body.consentVersion!==VERSION||body.purpose!==PURPOSE||typeof body.saveBirthConsent!=='boolean'||typeof body.matchingConsent!=='boolean'||!Number.isInteger(body.expectedRevision)||body.expectedRevision<0)fail(400,'请核对并明确选择资料保存与匹配授权');let birthInput=null;
   if(body.birthInput!==undefined&&body.birthInput!==null){if(!body.saveBirthConsent)fail(400,'保存生辰需要本人明确同意');keys(body.birthInput,['birthday','calendar','cityId','time','leapMonth','disambiguation']);const b=body.birthInput;if(!['solar','lunar'].includes(b.calendar)||typeof b.cityId!=='string'||b.cityId.length>100||b.time!==null&&(typeof b.time!=='string'||!/^\d{2}:\d{2}$/.test(b.time))||typeof b.leapMonth!=='boolean'||b.disambiguation!==undefined&&!['earlier','later'].includes(b.disambiguation))fail(400,'请核对日期、城市与小时分钟');const chart=compute(b,new Date(clock()));if(!Number.isFinite(chart.age)||chart.age<18)fail(400,'建档仅向成年人开放');birthInput={birthday:b.birthday,calendar:b.calendar,cityId:b.cityId,time:b.time,leapMonth:b.leapMonth,...(b.disambiguation?{disambiguation:b.disambiguation}:{})};}
   if(body.saveBirthConsent&&!birthInput)fail(400,'选择保存生辰时请先填写本人生辰');if(body.matchingConsent&&!birthInput)fail(400,'生辰匹配授权需要本人同意保存有效生辰');
   keys(body.draft||{},['nickname','city','intent','fields','bio','hobbies']);const d=body.draft||{},draft={};for(const k of ['nickname','city','intent'])if(d[k]!==undefined)draft[k]=text(d[k],40);if(d.intent!==undefined&&!['交朋友','找搭子','认真恋爱'].includes(draft.intent))fail(400,'认识目的无效');if(d.bio!==undefined)draft.bio=text(d.bio,500);if(d.fields!==undefined){keys(d.fields,['age','height','weight','school','occupation','industry','title','income','assets']);draft.fields={};for(const [k,v]of Object.entries(d.fields))draft.fields[k]=text(v,80);}if(d.hobbies!==undefined){if(!Array.isArray(d.hobbies)||d.hobbies.length>10)fail(400,'爱好最多10项');draft.hobbies=[...new Set(d.hobbies.map(v=>text(v,30)))];}
   return store.transaction(s=>{const a=rows(s),old=a.find(r=>r.userId===uid);if(body.expectedRevision!==(old?.revision||0))fail(409,'资料已在其他页面修改，请重新读取后核对');const row={recordId:old?.recordId||crypto.randomUUID(),userId:uid,revision:(old?.revision||0)+1,birthInput,draft,saveBirthConsent:body.saveBirthConsent,matchingConsent:body.matchingConsent,consentVersion:VERSION,purpose:PURPOSE,updatedAt:new Date(clock()).toISOString()};if(old)a[a.indexOf(old)]=row;else a.push(row);return {intake:view(row)};});
  },
  remove(uid,body){own(uid);keys(body,['expectedRevision']);if(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0)fail(400,'删除前请核对建档版本');return store.transaction(s=>{const list=rows(s),old=list.find(r=>r.userId===uid);if(body.expectedRevision!==(old?.revision||0))fail(409,'资料已更新，请重新读取后再删除');s.privateIntakes=list.filter(r=>r.userId!==uid);return {deleted:true};});}
 };
}
module.exports={createFriendsIntakeService,VERSION,PURPOSE};
