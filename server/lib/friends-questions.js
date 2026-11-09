'use strict';
const XB=require('./friends-cross-border');
const crypto=require('node:crypto');
const bank=require('../../assets/data/friends-relationship-questions.json');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const uidCheck=uid=>{if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');};
function normalizeAnswers(input){
 if(!plain(input)||Object.keys(input).length>bank.questions.length)fail(400,'答卷格式无效');
 const answers={};
 for(const [id,value]of Object.entries(input)){
  const q=bank.questions.find(q=>q.id===id);if(!q||!plain(value)||Object.keys(value).some(k=>!['selfAnswer','acceptablePartnerAnswers','importance'].includes(k)))fail(400,'包含未知题目或字段');
  const own=value.selfAnswer??null,accepted=value.acceptablePartnerAnswers??null,importance=value.importance??'unspecified';
  if(!bank.importanceOptions.some(o=>o.value===importance))fail(400,'重要性选项无效');
  if(q.type==='short_text'){
   if(own!==null&&(typeof own!=='string'||own.length>500)||accepted!==null)fail(400,'文字回答限500字且不自动比较');
  }else{
   const values=q.options.map(o=>o.value);
   if(own!==null&&!values.includes(own)||accepted!==null&&(!Array.isArray(accepted)||accepted.length>values.length||accepted.some(v=>!values.includes(v))||new Set(accepted).size!==accepted.length))fail(400,'答案选项无效');
  }
  answers[id]={selfAnswer:typeof own==='string'?own.trim()||null:own,acceptablePartnerAnswers:accepted===null?null:[...accepted],importance};
 }
 return answers;
}
function createFriendsQuestionsService({store,clock=()=>Date.now()}={}){
 if(!store?.read||!store?.transaction)throw Error('问卷需要现有加密存储');
 const rows=s=>{if(!s.relationshipQuestionnaires)s.relationshipQuestionnaires=[];if(!Array.isArray(s.relationshipQuestionnaires))throw Error('问卷存储格式异常');return s.relationshipQuestionnaires;};
 const view=row=>row?{recordId:row.recordId,version:row.version,answers:structuredClone(row.answers),updatedAt:row.updatedAt,revision:row.revision,visibility:'private'}:null;
 return {
  get(uid){uidCheck(uid);return {questionnaire:view(rows(store.read()).find(r=>r.userId===uid))};},
  save(uid,body){uidCheck(uid);XB.check(store,uid);if(!plain(body)||Object.keys(body).some(k=>!['version','answers','consent','expectedRevision'].includes(k))||body.version!==bank.version||body.consent!==true)fail(400,'请核对题库版本并同意保存本人私密答卷');const answers=normalizeAnswers(body.answers);if(body.expectedRevision!==undefined&&(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0))fail(400,'答卷版本无效');return store.transaction(s=>{const a=rows(s),old=a.find(r=>r.userId===uid);if(body.expectedRevision!==undefined&&body.expectedRevision!==(old?.revision||0))fail(409,'答卷已在其他页面更新，请重新读取后修改');const row={recordId:old?.recordId||crypto.randomUUID(),userId:uid,version:bank.version,answers,revision:(old?.revision||0)+1,updatedAt:new Date(clock()).toISOString(),consentVersion:'questions-private-v1'};if(old)a[a.indexOf(old)]=row;else a.push(row);return {questionnaire:view(row)};});},
  remove(uid){uidCheck(uid);return store.transaction(s=>{s.relationshipQuestionnaires=rows(s).filter(r=>r.userId!==uid);return {deleted:true};});}
 };
}
module.exports={createFriendsQuestionsService,normalizeAnswers};
