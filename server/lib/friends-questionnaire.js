'use strict';
// 认真婚恋「十方向」问卷（v2）。与旧版 friends-questions.js（35题私密答卷，仍被双人关系指南引用）并存。
// 隐私规则：
//  1. 答案只属于本人，默认谁都看不到。
//  2. 对某个人按方向逐项开放；只有双方都对彼此开放了同一个方向，双方才能看到彼此在该方向的答案。
//  3. 对外解释只说「在X方面想法接近 / 需要聊聊」，且只基于双方都开放的方向。
//  4. 后台推荐信号（不展示给任何用户）需要本人另行勾选「允许辅助推荐」，双方都勾选才计算。
//  5. 只记录本人自述的结婚/生育计划，不做任何日期或命运预测。
const crypto=require('node:crypto');
const BANK=require('../../assets/data/friends-marriage-questionnaire.json');
const {isDisabled}=require('./friends-admin');

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const uidCheck=uid=>{if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');};
const same=(a,b)=>a!==undefined&&a!==null&&String(a)===String(b);
const clean=(v,max)=>v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);
const ANSWER_STATES=['answered','skip','discuss'];
const DIMENSION_STATUSES=['in_progress','done','skipped','discuss'];
const IMPORTANCE=BANK.importanceOptions.map(o=>o.value);
const NOTE_MAX=200;
const dimensionOf=(bank,id)=>bank.dimensions.find(d=>d.id===id);

function normalizeAnswer(q,value){
 if(!plain(value)||Object.keys(value).some(k=>!['state','value','note','importance'].includes(k)))fail(400,'答案格式无效');
 const state=value.state??'answered';
 if(!ANSWER_STATES.includes(state))fail(400,'答案状态无效');
 const out={state};
 if(value.note!==undefined&&value.note!==null){if(typeof value.note!=='string'||value.note.length>NOTE_MAX)fail(400,`补充说明最多${NOTE_MAX}字`);const note=clean(value.note,NOTE_MAX);if(note)out.note=note;}
 if(state!=='answered'){
  // 跳过 / 待讨论 都是正常答案，不是错误；只是不能同时带选项。
  if(value.value!==undefined&&value.value!==null||value.importance!==undefined&&value.importance!==null)fail(400,'跳过或待讨论时不需要选择答案');
  return out;
 }
 const v=value.value;
 if(q.type==='text'){
  if(typeof v!=='string'||v.length>q.maxLength)fail(400,`自述最多${q.maxLength}字`);
  const t=clean(v,q.maxLength);if(!t)fail(400,'自述内容为空，可以选择跳过');out.value=t;
 }else if(q.type==='multi'){
  const valid=q.options.map(o=>o.value);
  if(!Array.isArray(v)||!v.length||v.length>q.maxSelect||new Set(v).size!==v.length||v.some(x=>!valid.includes(x)))fail(400,'多选答案无效');
  out.value=[...v];
 }else{
  if(!q.options.some(o=>o.value===v))fail(400,'答案选项无效');
  out.value=v;
 }
 if(value.importance!==undefined&&value.importance!==null){if(q.compare==='none'||!IMPORTANCE.includes(value.importance))fail(400,'重要程度选项无效');out.importance=value.importance;}
 return out;
}
function normalizeDimension(dimensionId,{answers,status}={},bank=BANK){
 const d=dimensionOf(bank,dimensionId);if(!d)fail(404,'没有这个方向');
 if(!DIMENSION_STATUSES.includes(status))fail(400,'方向状态无效');
 if(answers===undefined)answers={};
 if(!plain(answers)||Object.keys(answers).length>d.questions.length)fail(400,'答卷格式无效');
 const out={};
 for(const [id,value]of Object.entries(answers)){const q=d.questions.find(q=>q.id===id);if(!q)fail(400,'包含未知题目');out[id]=normalizeAnswer(q,value);}
 // 整个方向先跳过：不保留任何答案，避免「跳过了但还在被比较」。
 return {status,answers:status==='skipped'?{}:out};
}

// ---------- 纯函数：方向一致度 ----------
const optionOf=(q,v)=>q.options?.find(o=>o.value===v);
function compareQuestion(q,a,b){
 if(!a||!b||q.compare==='none'||q.type==='text')return null;
 if(a.state==='skip'||b.state==='skip')return null;
 if(a.state==='discuss'||b.state==='discuss')return {signal:'talk',essential:false};
 const essential=a.importance==='essential'||b.importance==='essential';
 let close;
 if(q.type==='multi'){close=a.value.some(x=>b.value.includes(x));}
 else{
  const x=optionOf(q,a.value),y=optionOf(q,b.value);
  if(!x||!y||x.open||y.open)return null;
  if(typeof x.rank==='number'&&typeof y.rank==='number')close=Math.abs(x.rank-y.rank)<=1;
  else if(x.group||y.group)close=!!x.group&&x.group===y.group;
  else if(typeof x.rank==='number'||typeof y.rank==='number')close=false;
  else close=x.value===y.value;
 }
 return {signal:close?'close':'talk',essential:!close&&essential};
}
/**
 * questionnaireAlignment(profileA, profileB, {bank, explainDimensions}) -> 纯函数，不读存储。
 * profile: {dimensions:{[dimensionId]:{status, answers:{[questionId]:{state,value,importance?}}}}}
 * 调用方负责只传入允许使用的数据（见 pairAlignment）。
 * 返回:
 *  dimensions: [{id,label,signal:'close'|'talk'|'unknown',compared,essentialDifference}] —— 仅供后台排序，不得原样展示给用户
 *  explanations: [{dimensionId,signal,text}] —— 只为 explainDimensions 里的方向生成，文案只有「想法接近/需要聊聊」
 */
function questionnaireAlignment(profileA,profileB,{bank=BANK,explainDimensions=[]}={}){
 const explain=new Set(explainDimensions);
 const dims=bank.dimensions.map(d=>{
  const da=profileA?.dimensions?.[d.id],db=profileB?.dimensions?.[d.id];
  let close=0,talk=0,essentialDifference=false;
  if(da&&db&&da.status!=='skipped'&&db.status!=='skipped'){
   for(const q of d.questions){const r=compareQuestion(q,da.answers?.[q.id],db.answers?.[q.id]);if(!r)continue;r.signal==='close'?close++:talk++;if(r.essential)essentialDifference=true;}
   if(da.status==='discuss'||db.status==='discuss')talk++;
  }
  const compared=close+talk;
  const signal=compared===0?'unknown':talk===0||(talk===1&&close>=3&&!essentialDifference)?'close':'talk';
  return {id:d.id,label:d.label,signal,compared,essentialDifference};
 });
 const explanations=dims.filter(d=>explain.has(d.id)&&d.signal!=='unknown').map(d=>({dimensionId:d.id,signal:d.signal,text:d.signal==='close'?`在${d.label}方面想法接近`:`在${d.label}方面需要聊聊`}));
 return {version:bank.version,dimensions:dims,explanations};
}

// ---------- 存储投影 ----------
const records=s=>{if(s.marriageQuestionnaires===undefined)s.marriageQuestionnaires=[];if(!Array.isArray(s.marriageQuestionnaires))throw Error('问卷存储格式异常');return s.marriageQuestionnaires;};
const shareRows=s=>{if(s.questionnaireShares===undefined)s.questionnaireShares=[];if(!Array.isArray(s.questionnaireShares))throw Error('问卷分享存储格式异常');return s.questionnaireShares;};
const recordOf=(s,uid)=>(Array.isArray(s.marriageQuestionnaires)?s.marriageQuestionnaires:[]).find(r=>same(r.userId,uid))||null;
const offered=(s,owner,peer)=>(Array.isArray(s.questionnaireShares)?s.questionnaireShares:[]).find(r=>same(r.ownerId,owner)&&same(r.peerId,peer))?.dimensions||[];
const blocked=(s,a,b)=>(s.blocks||[]).some(x=>same(x.by,a)&&same(x.target,b)||same(x.by,b)&&same(x.target,a));
const connected=(s,a,b)=>(s.requests||[]).some(r=>r.status==='accepted'&&(same(r.from,a)&&same(r.to,b)||same(r.from,b)&&same(r.to,a)));
const pairUsable=(s,a,b)=>!same(a,b)&&connected(s,a,b)&&!blocked(s,a,b)&&!isDisabled(s,a)&&!isDisabled(s,b);
/** 双方都对彼此开放、且双方都已有内容（非跳过）的方向。任何一方撤回/拉黑/断开即为空。 */
function mutualDimensions(s,a,b){
 if(!pairUsable(s,a,b))return [];
 const ra=recordOf(s,a),rb=recordOf(s,b);if(!ra||!rb)return [];
 const theirs=new Set(offered(s,b,a));
 return offered(s,a,b).filter(id=>theirs.has(id)&&ra.dimensions?.[id]&&rb.dimensions?.[id]&&ra.dimensions[id].status!=='skipped'&&rb.dimensions[id].status!=='skipped');
}
const project=(record,ids)=>({dimensions:Object.fromEntries(ids.filter(id=>record?.dimensions?.[id]).map(id=>[id,structuredClone(record.dimensions[id])]))});
/**
 * 给推荐/匹配模块用的入口。
 *  signals: 仅当双方都勾选「允许辅助推荐」时才有，用于后台排序；不要展示给用户，也不要据此写解释。
 *  explanations: 只来自双方都开放的方向，可以直接展示。
 */
function pairAlignment(s,a,b,{bank=BANK}={}){
 const ra=recordOf(s,a),rb=recordOf(s,b);
 const usable=!same(a,b)&&!blocked(s,a,b)&&!isDisabled(s,a)&&!isDisabled(s,b);
 const signals=usable&&ra?.matchingConsent===true&&rb?.matchingConsent===true&&ra.version===bank.version&&rb.version===bank.version?questionnaireAlignment(project(ra,Object.keys(ra.dimensions||{})),project(rb,Object.keys(rb.dimensions||{})),{bank}).dimensions:[];
 const mutual=mutualDimensions(s,a,b);
 const explanations=mutual.length?questionnaireAlignment(project(ra,mutual),project(rb,mutual),{bank,explainDimensions:mutual}).explanations:[];
 return {signals,explanations};
}
/** 推荐卡片上可直接追加的解释文字（只来自双方开放的方向）。 */
const discoverReasons=(s,viewer,candidate)=>pairAlignment(s,viewer,candidate).explanations.map(e=>e.text);

function progressOf(record,bank=BANK){
 const list=bank.dimensions.map(d=>({id:d.id,label:d.label,status:record?.dimensions?.[d.id]?.status||'not_started',answered:Object.values(record?.dimensions?.[d.id]?.answers||{}).filter(a=>a.state==='answered').length,total:d.questions.length}));
 const settled=list.filter(d=>['done','skipped','discuss'].includes(d.status)).length;
 const next=list.find(d=>d.status==='in_progress')||list.find(d=>d.status==='not_started')||null;
 return {dimensions:list,settled,total:list.length,nextDimension:next?.id||null};
}

function createFriendsQuestionnaireService({store,clock=()=>Date.now(),bank=BANK}={}){
 if(!store?.read||!store?.transaction)throw Error('问卷需要现有加密存储');
 const now=()=>new Date(clock()).toISOString();
 const view=r=>r?{recordId:r.recordId,version:r.version,dimensions:structuredClone(r.dimensions),matchingConsent:r.matchingConsent===true,revision:r.revision,updatedAt:r.updatedAt,visibility:'private'}:null;
 const result=r=>({questionnaire:view(r),progress:progressOf(r,bank)});
 const peerByShare=(s,uid,shareId)=>{
  if(typeof shareId!=='string'||!shareId||shareId.length>100)fail(400,'对象编号无效');
  const p=(s.profiles||[]).find(p=>p.shareId===shareId);
  // 未连接、被拉黑或不存在一律同一个提示，不泄露具体原因。
  if(!p||!pairUsable(s,uid,p.userId))fail(404,'只能和已经互相同意认识的人互看问卷');
  return p;
 };
 const touch=(s,uid,mutate)=>{const a=records(s);let r=recordOf(s,uid);if(!r){r={recordId:crypto.randomUUID(),userId:uid,version:bank.version,dimensions:{},matchingConsent:false,revision:0,consentVersion:'marriage-10d-private-v1'};a.push(r);}mutate(r);r.revision++;r.updatedAt=now();return r;};
 return {
  bank,
  get(uid){uidCheck(uid);return result(recordOf(store.read(),uid));},
  saveDimension(uid,dimensionId,body){
   uidCheck(uid);
   if(!plain(body)||Object.keys(body).some(k=>!['version','consent','status','answers','expectedRevision'].includes(k)))fail(400,'请求格式无效');
   if(body.version!==bank.version||body.consent!==true)fail(400,'请核对问卷版本，并同意保存本人私密答卷');
   if(body.expectedRevision!==undefined&&(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0))fail(400,'答卷版本无效');
   const dim=normalizeDimension(dimensionId,body,bank);
   return store.transaction(s=>{
    const old=recordOf(s,uid);
    if(body.expectedRevision!==undefined&&body.expectedRevision!==(old?.revision||0))fail(409,'答卷已在其他页面更新，请重新读取后再改');
    if(old&&old.version!==bank.version){old.version=bank.version;old.dimensions={};}
    const r=touch(s,uid,r=>{r.dimensions[dimensionId]={...dim,updatedAt:now()};});
    return result(r);
   });
  },
  setMatching(uid,body){
   uidCheck(uid);if(!plain(body)||typeof body.consent!=='boolean'||Object.keys(body).length!==1)fail(400,'请明确选择是否允许辅助推荐');
   return store.transaction(s=>{if(!recordOf(s,uid)&&!body.consent)return result(null);return result(touch(s,uid,r=>{r.matchingConsent=body.consent;}));});
  },
  peers(uid){
   uidCheck(uid);const s=store.read(),mine=recordOf(s,uid);
   const ids=new Set((s.requests||[]).filter(r=>r.status==='accepted'&&(same(r.from,uid)||same(r.to,uid))).map(r=>String(same(r.from,uid)?r.to:r.from)));
   const peers=(s.profiles||[]).filter(p=>ids.has(String(p.userId))&&pairUsable(s,uid,p.userId)).map(p=>({shareId:p.shareId,nickname:p.nickname,myOffered:offered(s,uid,p.userId),theirOffered:offered(s,p.userId,uid),mutualDimensions:mutualDimensions(s,uid,p.userId)}));
   return {peers,hasQuestionnaire:!!mine};
  },
  setShare(uid,shareId,body){
   uidCheck(uid);
   if(!plain(body)||Object.keys(body).some(k=>!['dimensions','consent'].includes(k))||!Array.isArray(body.dimensions)||body.dimensions.length>bank.dimensions.length||new Set(body.dimensions).size!==body.dimensions.length||body.dimensions.some(id=>!dimensionOf(bank,id)))fail(400,'请选择要开放的方向');
   if(body.dimensions.length&&body.consent!==true)fail(400,'请确认愿意向对方开放所选方向的原始答案');
   return store.transaction(s=>{
    const p=peerByShare(s,uid,shareId),rows=shareRows(s),old=rows.find(r=>same(r.ownerId,uid)&&same(r.peerId,p.userId));
    if(!body.dimensions.length){if(old)rows.splice(rows.indexOf(old),1);}
    else if(old){old.dimensions=[...body.dimensions];old.updatedAt=now();}
    else rows.push({ownerId:uid,peerId:p.userId,dimensions:[...body.dimensions],updatedAt:now()});
    return {shareId:p.shareId,myOffered:offered(s,uid,p.userId),theirOffered:offered(s,p.userId,uid),mutualDimensions:mutualDimensions(s,uid,p.userId)};
   });
  },
  shared(uid,shareId){
   uidCheck(uid);const s=store.read(),p=peerByShare(s,uid,shareId),mutual=mutualDimensions(s,uid,p.userId);
   const peerRecord=recordOf(s,p.userId);
   return {shareId:p.shareId,nickname:p.nickname,mutualDimensions:mutual,peer:project(peerRecord,mutual),explanations:pairAlignment(s,uid,p.userId,{bank}).explanations,note:'只显示你们都愿意互看的方向；其他方向的答案不会出现在这里。'};
  },
  remove(uid){uidCheck(uid);return store.transaction(s=>{s.marriageQuestionnaires=records(s).filter(r=>!same(r.userId,uid));s.questionnaireShares=shareRows(s).filter(r=>!same(r.ownerId,uid)&&!same(r.peerId,uid));return {deleted:true};});}
 };
}
module.exports={BANK,createFriendsQuestionnaireService,questionnaireAlignment,pairAlignment,mutualDimensions,discoverReasons,normalizeDimension,progressOf};
