'use strict';
const XB=require('./friends-cross-border');
// 认真结婚「十方向」问卷（v2）。与旧版 friends-questions.js（35题私密答卷，仍被双人关系指南引用）并存。
// 隐私规则：
//  1. 答案默认只属于本人。
//  2. 旧规则（仍然有效）：对某个人按方向逐项开放；只有双方都对彼此开放了同一个方向，双方才能看到彼此在该方向的答案。
//  3. 对外解释只说「在X方面想法接近 / 需要聊聊」，且只基于双方都开放的方向。
//  4. 后台推荐信号（不展示给任何用户）需要本人另行勾选「允许辅助推荐」，双方都勾选才计算。
//  5. 只记录本人填写的结婚/生育计划，不做任何日期或命运预测。
// 2026-11-10 可见范围新规则（产品决定，「填了才能看」，仍是双向的）：
//  6. 新规则对「新规则记录」（2026-11-10 后新建，或本人点了「按新规则展示」）的全部答案生效；旧记录只对之后新填或改过再保存的答案生效，
//     没改过的旧答案保持原来的「仅自己 / 双方都开放才互看」，不会被追溯公开。
//  7. 底线题（bank.quickPath）：登录会员，且自己也答完底线题、没把底线题设为仅自己，且双方认识目的在「享受恋爱/认真结婚」上有重合 → 才能看到别人的底线题。
//     （目的重合这一条同样适用于规则 8；只找搭子/交朋友的人按新规则什么都看不到。）
//  8. 其余题（深入聊聊）：只给已互相认识（accepted 且未拉黑/停用）的人看。
//  9. 敏感题（question.sensitive）：默认仅自己，本人逐题打开（shareSensitive）后才按 7/8 展示；不进后台排序信号，不进推荐理由。
// 10. 任何方向、或整个底线题层（'quick'），都可以设为仅自己（privateTopics），立即生效。访客、海报、预览卡片不走这里，拿不到任何答案。
// 11. 「底线不同」「节奏不同，值得提前聊聊」只用看的人有权看到的那份答案计算。
const crypto=require('node:crypto');
const BANK=require('../../assets/data/friends-marriage-questionnaire.json');
const {isDisabled}=require('./friends-admin');
const GUARD=require('./friends-copy-guard');

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const uidCheck=uid=>{if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');};
const same=(a,b)=>a!==undefined&&a!==null&&String(a)===String(b);
const clean=(v,max)=>v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);
const ANSWER_STATES=['answered','skip','discuss'];
const DIMENSION_STATUSES=['in_progress','done','skipped','discuss'];
const IMPORTANCE=BANK.importanceOptions.map(o=>o.value);
const NOTE_MAX=200; // 「待讨论」时想当面聊的点
const ANSWER_NOTE_MAX=BANK.noteMax||120; // 选了答案之后的「展开说说」
const dimensionOf=(bank,id)=>bank.dimensions.find(d=>d.id===id);
const questionOf=(bank,id)=>{for(const d of bank.dimensions)for(const q of d.questions)if(q.id===id)return q;return null;};
const quickIds=bank=>new Set(bank.quickPath?.questions||[]);

function normalizeAnswer(q,value){
 if(!plain(value)||Object.keys(value).some(k=>!['state','value','note','importance'].includes(k)))fail(400,'答案格式无效');
 const state=value.state??'answered';
 if(!ANSWER_STATES.includes(state))fail(400,'答案状态无效');
 const out={state};
 if(value.note!==undefined&&value.note!==null){
  const max=state==='answered'?ANSWER_NOTE_MAX:NOTE_MAX;
  if(typeof value.note!=='string'||value.note.length>max)fail(400,`补充说明最多${max}字`);
  const note=clean(value.note,max);
  if(note){const hit=GUARD.findForbidden(note);if(hit.length)fail(400,`补充里有暂不支持的说法（${hit.join('、')}），换个说法吧`);out.note=note;}
 }
 if(state!=='answered'){
  // 跳过 / 待讨论 都是正常答案，不是错误；只是不能同时带选项。
  if(value.value!==undefined&&value.value!==null||value.importance!==undefined&&value.importance!==null)fail(400,'跳过或待讨论时不需要选择答案');
  return out;
 }
 const v=value.value;
 if(q.type==='text'){
  if(typeof v!=='string'||v.length>q.maxLength)fail(400,`文字回答最多${q.maxLength}字`);
  const t=clean(v,q.maxLength);if(!t)fail(400,'文字回答为空，可以选择跳过');out.value=t;
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
const STRONG=['essential','dealbreaker'];
function compareQuestion(q,a,b){
 if(!a||!b||q.compare==='none'||q.type==='text')return null;
 if(a.state==='skip'||b.state==='skip')return null;
 if(a.state==='discuss'||b.state==='discuss')return {signal:'talk',essential:false,dealbreaker:false};
 const essential=STRONG.includes(a.importance)||STRONG.includes(b.importance);
 const dealbreaker=a.importance==='dealbreaker'||b.importance==='dealbreaker';
 let close;
 if(q.type==='multi'){
  // 旧格式（比如原来的文字答案）不是数组：不比较，也不报错。
  if(!Array.isArray(a.value)||!Array.isArray(b.value))return null;
  // 「看感觉走」这类 open 选项和任何答案都算合得来，不比较。
  if([...a.value,...b.value].some(v=>optionOf(q,v)?.open))return null;
  close=a.value.some(x=>b.value.includes(x));
 }
 else{
  const x=optionOf(q,a.value),y=optionOf(q,b.value);
  if(!x||!y||x.open||y.open)return null;
  if(typeof x.rank==='number'&&typeof y.rank==='number')close=Math.abs(x.rank-y.rank)<=1;
  else if(x.group||y.group)close=!!x.group&&x.group===y.group;
  else if(typeof x.rank==='number'||typeof y.rank==='number')close=false;
  else close=x.value===y.value;
 }
 return {signal:close?'close':'talk',essential:!close&&essential,dealbreaker:!close&&dealbreaker};
}
/**
 * questionnaireAlignment(profileA, profileB, {bank, explainDimensions}) -> 纯函数，不读存储。
 * profile: {dimensions:{[dimensionId]:{status, answers:{[questionId]:{state,value,importance?}}}}}
 * 调用方负责只传入允许使用的数据（见 pairAlignment）。敏感题一律不参与。
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
   for(const q of d.questions){if(q.sensitive)continue;const r=compareQuestion(q,da.answers?.[q.id],db.answers?.[q.id]);if(!r)continue;r.signal==='close'?close++:talk++;if(r.essential)essentialDifference=true;}
   if(da.status==='discuss'||db.status==='discuss')talk++;
  }
  const compared=close+talk;
  const signal=compared===0?'unknown':talk===0||(talk===1&&close>=3&&!essentialDifference)?'close':'talk';
  return {id:d.id,label:d.label,signal,compared,essentialDifference};
 });
 const explanations=dims.filter(d=>explain.has(d.id)&&d.signal!=='unknown').map(d=>({dimensionId:d.id,signal:d.signal,text:d.signal==='close'?`在${d.label}方面想法接近`:`在${d.label}方面需要聊聊`}));
 return {version:bank.version,dimensions:dims,explanations};
}

// ---------- 版本升级（旧记录 → 当前题库） ----------
/**
 * upgradeRecord(record, bank) -> 纯函数，返回新对象，不改原记录。
 * 只升级 bank.upgradeFrom 里列出的旧版本；其他版本原样返回（保存时沿用原来的「版本不同就清空」）。
 * 被替换的题（question.replaces）：旧答案不会变成新题的答案（不校验、不比较、不给别人看）；
 * 旧文字 / 旧选项原文放进该方向的 legacyText，只给本人看，前端会把它预填进「展开说说」。
 */
function upgradeRecord(record,bank=BANK){
 if(!record||record.version===bank.version||!(bank.upgradeFrom||[]).includes(record.version))return record;
 const out=structuredClone(record);out.version=bank.version;out.upgradedFrom=record.version;
 for(const d of bank.dimensions){
  const dd=out.dimensions?.[d.id];if(!dd||!plain(dd.answers))continue;
  for(const q of d.questions){
   if(!q.replaces||!dd.answers[q.replaces])continue;
   const old=dd.answers[q.replaces];delete dd.answers[q.replaces];
   const text=old.state==='answered'?(typeof old.value==='string'?(q.replacesOptions?.[old.value]||old.value):''):old.state==='discuss'?(old.note||''):'';
   if(text)dd.legacyText={...(dd.legacyText||{}),[q.id]:String(text).slice(0,300)};
  }
  for(const k of Object.keys(dd.answers))if(!d.questions.some(q=>q.id===k))delete dd.answers[k];
 }
 return out;
}

// ---------- 存储基础 ----------
const records=s=>{if(s.marriageQuestionnaires===undefined)s.marriageQuestionnaires=[];if(!Array.isArray(s.marriageQuestionnaires))throw Error('问卷存储格式异常');return s.marriageQuestionnaires;};
const shareRows=s=>{if(s.questionnaireShares===undefined)s.questionnaireShares=[];if(!Array.isArray(s.questionnaireShares))throw Error('问卷分享存储格式异常');return s.questionnaireShares;};
const recordOf=(s,uid)=>(Array.isArray(s.marriageQuestionnaires)?s.marriageQuestionnaires:[]).find(r=>same(r.userId,uid))||null;
const offered=(s,owner,peer)=>(Array.isArray(s.questionnaireShares)?s.questionnaireShares:[]).find(r=>same(r.ownerId,owner)&&same(r.peerId,peer))?.dimensions||[];
const blocked=(s,a,b)=>(s.blocks||[]).some(x=>same(x.by,a)&&same(x.target,b)||same(x.by,b)&&same(x.target,a));
const connected=(s,a,b)=>(s.requests||[]).some(r=>r.status==='accepted'&&(same(r.from,a)&&same(r.to,b)||same(r.from,b)&&same(r.to,a)));
// 底线题只在两人的认识目的都包含同一个恋爱向目的（享受恋爱 / 认真结婚）时互看；只找搭子/交朋友的人看不到别人的婚恋答案。
const ROMANCE=['dating','serious'];
const purposesOfUser=(s,uid)=>{const p=(s.profiles||[]).find(p=>same(p.userId,uid));return p?require('./friends-matching').purposesOf(p):[];};
const romanceOverlap=(s,a,b)=>{const pb=purposesOfUser(s,b);return purposesOfUser(s,a).some(k=>ROMANCE.includes(k)&&pb.includes(k));};
const pairUsable=(s,a,b)=>!same(a,b)&&connected(s,a,b)&&!blocked(s,a,b)&&!isDisabled(s,a)&&!isDisabled(s,b);

// ---------- 可见范围（新规则） ----------
const visibilityOf=r=>({model:r?.visibility?.model==='v2'?'v2':'legacy',privateTopics:Array.isArray(r?.visibility?.privateTopics)?r.visibility.privateTopics:[],shareSensitive:Array.isArray(r?.visibility?.shareSensitive)?r.visibility.shareSensitive:[]});
/** 这条答案按新规则能不能给别人看（还没看对方是谁）。 */
function answerOpen(r,q,a){
 const v=visibilityOf(r);
 if(!a||a.state==='skip')return false;
 if(v.privateTopics.includes(q.dimensionId))return false;
 if(q.sensitive&&!v.shareSensitive.includes(q.id))return false;
 if(v.model!=='v2'&&a.open!==true)return false; // 旧记录里没改过的答案：保持原来的私密状态
 return true;
}
/** 「填了才能看」：自己的底线题都答了（敏感题可以不开放），并且这些答案自己也是给别人看的。 */
function quickReady(r,bank=BANK){
 if(!r)return false;
 if(visibilityOf(r).privateTopics.includes('quick'))return false;
 for(const id of quickIds(bank)){
  const q=questionOf(bank,id);if(!q||q.sensitive)continue;
  const d=r.dimensions?.[q.dimensionId];if(!d||d.status==='skipped')return false;
  const a=d.answers?.[id];if(!a||a.state!=='answered'||!answerOpen(r,q,a))return false;
 }
 return true;
}
/** 相合局用：14 道底线题里非敏感的都答完了（不要求对别人公开）。 */
function quickDone(r,bank=BANK){
 if(!r)return false;
 for(const id of quickIds(bank)){
  const q=questionOf(bank,id);if(!q||q.sensitive)continue;
  const a=r.dimensions?.[q.dimensionId]?.answers?.[id];if(!a||a.state!=='answered')return false;
 }
 return true;
}
/** 相合局用：两个人在底线题里有「明确不同且至少一方标了很重要」的题。只返回是/否，不返回是哪一题。 */
function quickConflict(ra,rb,bank=BANK){
 if(!ra||!rb)return false;
 for(const id of quickIds(bank)){
  const q=questionOf(bank,id);if(!q||q.sensitive)continue;
  const r=compareQuestion(q,ra.dimensions?.[q.dimensionId]?.answers?.[id],rb.dimensions?.[q.dimensionId]?.answers?.[id]);
  if(r&&r.essential)return true;
 }
 return false;
}
const publicAnswer=a=>{const o={state:a.state};if(a.value!==undefined)o.value=structuredClone(a.value);if(a.importance)o.importance=a.importance;if(a.note)o.note=a.note;return o;};
/**
 * memberView(state, ownerId, viewerId) -> {dimensions:{[dimId]:{answers}}}：看的人按新规则能看到 owner 的哪些答案。
 * 不含旧规则「双方都开放」（见 shared）。访客 / 本人 / 拉黑 / 停用一律为空。
 */
function memberView(s,ownerId,viewerId,{bank=BANK}={}){
 const empty={dimensions:{}};
 if(viewerId===undefined||viewerId===null||viewerId===''||same(ownerId,viewerId))return empty;
 if(blocked(s,ownerId,viewerId)||isDisabled(s,ownerId)||isDisabled(s,viewerId))return empty;
 // 只找搭子/交朋友的人看不到别人的婚恋答案（按新规则的底线题和深入话题都不给）；原来双方逐方向开放的互看不受影响。
 if(!romanceOverlap(s,ownerId,viewerId))return empty;
 const r=upgradeRecord(recordOf(s,ownerId),bank);if(!r||r.version!==bank.version)return empty;
 const quick=quickIds(bank),isConnected=connected(s,ownerId,viewerId);
 const quickOk=!visibilityOf(r).privateTopics.includes('quick')&&quickReady(upgradeRecord(recordOf(s,viewerId),bank),bank);
 const out={};
 for(const d of bank.dimensions){
  const dd=r.dimensions?.[d.id];if(!dd||dd.status==='skipped')continue;
  for(const q of d.questions){
   const a=dd.answers?.[q.id];if(!answerOpen(r,q,a))continue;
   if(quick.has(q.id)?!quickOk:!isConnected)continue;
   (out[d.id]||={answers:{}}).answers[q.id]=publicAnswer(a);
  }
 }
 return {dimensions:out};
}

// ---------- 亲密节奏小结（只给本人看） ----------
function rhythmOf(answers,bank=BANK){
 const cfg=bank.rhythm;if(!cfg)return null;
 const count={respond:0,space:0,balanced:0};let n=0;
 for(const d of bank.dimensions)for(const q of d.questions){const a=answers?.[q.id];if(a?.state!=='answered')continue;const lean=optionOf(q,a.value)?.lean;if(lean&&lean in count){count[lean]++;n++;}}
 if(n<(cfg.minAnswered||3))return null;
 const key=count.respond-count.space>=2?'respond':count.space-count.respond>=2?'space':'balanced';
 return {key,label:cfg.summaries[key].label,tip:cfg.summaries[key].tip,fineprint:cfg.fineprint};
}
const flatAnswers=r=>Object.assign({},...Object.values(r?.dimensions||{}).filter(d=>d&&d.status!=='skipped').map(d=>d.answers||{}));
/**
 * pairNotes(viewerRecord, visibleOwnerView) -> 两人对照，只用「对方给我看到的答案」+ 我自己的答案。
 *  highlights: 底线不同 —— 任一方把这题标成「这条是我的底线」且答案差得比较多。敏感题从不用这个说法。
 *  notes: 「节奏不同，值得提前聊聊」—— 亲密节奏小结不同；或某道敏感题双方都打开了而且不一致。
 */
function pairNotes(viewerRecord,visible,{bank=BANK}={}){
 const mine=flatAnswers(viewerRecord),theirs=flatAnswers(visible),highlights=[];let rhythm=false;
 for(const d of bank.dimensions)for(const q of d.questions){
  const t=theirs[q.id],m=mine[q.id];if(t?.state!=='answered'||m?.state!=='answered')continue;
  const r=compareQuestion(q,m,t);if(!r||r.signal!=='talk')continue;
  if(q.sensitive){if(answerOpen(viewerRecord,q,m))rhythm=true;continue;}
  if(r.dealbreaker)highlights.push({dimensionId:d.id,questionId:q.id,text:'底线不同'});
 }
 const a=rhythmOf(mine,bank),b=rhythmOf(theirs,bank);if(a&&b&&a.key!==b.key)rhythm=true;
 return {highlights,notes:rhythm&&bank.rhythm?[bank.rhythm.pairDifferent]:[]};
}

// ---------- 旧规则：双方都开放的方向 ----------
/** 双方都对彼此开放、且双方都已有内容（非跳过）的方向。任何一方撤回/拉黑/断开即为空。 */
function mutualDimensions(s,a,b){
 if(!pairUsable(s,a,b))return [];
 const ra=upgradeRecord(recordOf(s,a)),rb=upgradeRecord(recordOf(s,b));if(!ra||!rb)return [];
 const theirs=new Set(offered(s,b,a));
 return offered(s,a,b).filter(id=>theirs.has(id)&&ra.dimensions?.[id]&&rb.dimensions?.[id]&&ra.dimensions[id].status!=='skipped'&&rb.dimensions[id].status!=='skipped');
}
// 敏感题即使在旧规则下开放了方向，也仍要本人逐题打开；旧文字原文（legacyText）只给本人看。
const project=(record,ids,bank=BANK)=>({dimensions:Object.fromEntries(ids.filter(id=>record?.dimensions?.[id]).map(id=>{
 const d=record.dimensions[id],share=visibilityOf(record).shareSensitive,answers={};
 for(const [qid,a]of Object.entries(d.answers||{})){const q=questionOf(bank,qid);if(!q||q.sensitive&&!share.includes(qid))continue;answers[qid]=publicAnswer(a);}
 return [id,{status:d.status,answers}];
}))});
const mergeViews=(...views)=>{const out={dimensions:{}};for(const v of views)for(const [id,d]of Object.entries(v?.dimensions||{})){const o=(out.dimensions[id]||={answers:{}});if(d.status&&!o.status)o.status=d.status;Object.assign(o.answers,structuredClone(d.answers||{}));}return out;};
/**
 * 给推荐/匹配模块用的入口。
 *  signals: 仅当双方都勾选「允许辅助推荐」时才有，用于后台排序；不要展示给用户，也不要据此写解释。敏感题不参与。
 *  explanations: 只来自双方都开放的方向，可以直接展示。
 */
function pairAlignment(s,a,b,{bank=BANK}={}){
 const ra=upgradeRecord(recordOf(s,a),bank),rb=upgradeRecord(recordOf(s,b),bank);
 const usable=!same(a,b)&&!blocked(s,a,b)&&!isDisabled(s,a)&&!isDisabled(s,b);
 const signals=usable&&ra?.matchingConsent===true&&rb?.matchingConsent===true&&ra.version===bank.version&&rb.version===bank.version?questionnaireAlignment(project(ra,Object.keys(ra.dimensions||{}),bank),project(rb,Object.keys(rb.dimensions||{}),bank),{bank}).dimensions:[];
 const mutual=mutualDimensions(s,a,b);
 const explanations=mutual.length?questionnaireAlignment(project(ra,mutual,bank),project(rb,mutual,bank),{bank,explainDimensions:mutual}).explanations:[];
 return {signals,explanations};
}
/** 推荐卡片上可直接追加的解释文字（只来自双方开放的方向）。 */
const discoverReasons=(s,viewer,candidate)=>pairAlignment(s,viewer,candidate).explanations.map(e=>e.text);

function progressOf(record,bank=BANK){
 const list=bank.dimensions.map(d=>({id:d.id,label:d.label,status:record?.dimensions?.[d.id]?.status||'not_started',answered:Object.values(record?.dimensions?.[d.id]?.answers||{}).filter(a=>a.state==='answered').length,total:d.questions.length}));
 const settled=list.filter(d=>['done','skipped','discuss'].includes(d.status)).length;
 const next=list.find(d=>d.status==='in_progress')||list.find(d=>d.status==='not_started')||null;
 const qids=[...quickIds(bank)],answered=qids.filter(id=>{const q=questionOf(bank,id),a=q&&record?.dimensions?.[q.dimensionId]?.answers?.[id];return !!a&&a.state==='answered';}).length;
 return {dimensions:list,settled,total:list.length,nextDimension:next?.id||null,quick:{answered,total:qids.length,ready:quickReady(record,bank)}};
}
const answerKey=a=>JSON.stringify([a?.state,a?.value,a?.importance||null,a?.note||null]);

function createFriendsQuestionnaireService({store,clock=()=>Date.now(),bank=BANK}={}){
 if(!store?.read||!store?.transaction)throw Error('问卷需要现有加密存储');
 const now=()=>new Date(clock()).toISOString();
 const readOf=(s,uid)=>upgradeRecord(recordOf(s,uid),bank);
 const ownDims=d=>{const o=structuredClone(d||{});for(const x of Object.values(o))for(const a of Object.values(x?.answers||{}))delete a.open;return o;};
 const view=r=>r?{recordId:r.recordId,version:r.version,dimensions:ownDims(r.dimensions),matchingConsent:r.matchingConsent===true,revision:r.revision,updatedAt:r.updatedAt,visibility:'private',sharing:visibilityOf(r)}:null;
 // result() 只回给本人：包括亲密节奏小结。
 const result=r=>({questionnaire:view(r),progress:progressOf(r,bank),rhythm:r?rhythmOf(flatAnswers(r),bank):null});
 const peerByShare=(s,uid,shareId)=>{
  if(typeof shareId!=='string'||!shareId||shareId.length>100)fail(400,'对象编号无效');
  const p=(s.profiles||[]).find(p=>p.shareId===shareId);
  // 未连接、被拉黑或不存在一律同一个提示，不泄露具体原因。
  if(!p||!pairUsable(s,uid,p.userId))fail(404,'只能和已经互相同意认识的人互看问卷');
  return p;
 };
 const touch=(s,uid,mutate)=>{const a=records(s);let r=recordOf(s,uid);if(!r){r={recordId:crypto.randomUUID(),userId:uid,version:bank.version,dimensions:{},matchingConsent:false,revision:0,consentVersion:'marriage-10d-private-v1',visibility:{model:'v2',privateTopics:[],shareSensitive:[]}};a.push(r);}mutate(r);r.revision++;r.updatedAt=now();return r;};
 return {
  bank,
  get(uid){uidCheck(uid);return result(readOf(store.read(),uid));},
  saveDimension(uid,dimensionId,body){XB.check(store,uid);
   uidCheck(uid);
   if(!plain(body)||Object.keys(body).some(k=>!['version','consent','status','answers','expectedRevision'].includes(k)))fail(400,'请求格式无效');
   if(body.version!==bank.version||body.consent!==true)fail(400,'请核对问卷版本，并同意保存本人私密答卷');
   if(body.expectedRevision!==undefined&&(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0))fail(400,'答卷版本无效');
   const dim=normalizeDimension(dimensionId,body,bank);
   return store.transaction(s=>{
    const old=recordOf(s,uid);
    if(body.expectedRevision!==undefined&&body.expectedRevision!==(old?.revision||0))fail(409,'答卷已在其他页面更新，请重新读取后再改');
    if(old&&old.version!==bank.version){
     const up=upgradeRecord(old,bank);
     if(up!==old){for(const k of Object.keys(old))delete old[k];Object.assign(old,up);}
     else{old.version=bank.version;old.dimensions={};}
    }
    const r=touch(s,uid,r=>{
     const prev=r.dimensions[dimensionId],next={...dim,updatedAt:now()};
     // 旧规则记录：只有这次新填或改过的答案按新规则展示（open），没动过的旧答案保持原状。
     if(visibilityOf(r).model!=='v2')for(const [id,a]of Object.entries(next.answers)){const p=prev?.answers?.[id];if(p?.open===true||!p||answerKey(p)!==answerKey(a))a.open=true;}
     // 旧文字原文：这题还没重新回答就继续留着（只给本人看）。
     const legacy=Object.fromEntries(Object.entries(prev?.legacyText||{}).filter(([id])=>next.status!=='skipped'&&!next.answers[id]));
     if(Object.keys(legacy).length)next.legacyText=legacy;
     r.dimensions[dimensionId]=next;
    });
    return result(r);
   });
  },
  setMatching(uid,body){XB.check(store,uid);
   uidCheck(uid);if(!plain(body)||typeof body.consent!=='boolean'||Object.keys(body).length!==1)fail(400,'请明确选择是否允许辅助推荐');
   return store.transaction(s=>{if(!recordOf(s,uid)&&!body.consent)return result(null);return result(touch(s,uid,r=>{r.matchingConsent=body.consent;}));});
  },
  /**
   * 可见范围：privateTopics（'quick' 或方向 id，设了就仅自己）、shareSensitive（逐题打开的敏感题）、
   * adopt:true（旧记录本人确认「按新规则展示」）。立即生效。
   */
  setVisibility(uid,body){XB.check(store,uid);
   uidCheck(uid);
   const topics=['quick',...bank.dimensions.map(d=>d.id)],sensitive=bank.dimensions.flatMap(d=>d.questions.filter(q=>q.sensitive).map(q=>q.id));
   const list=(v,allowed)=>Array.isArray(v)&&v.length<=allowed.length&&new Set(v).size===v.length&&v.every(x=>allowed.includes(x));
   if(!plain(body)||Object.keys(body).some(k=>!['privateTopics','shareSensitive','adopt'].includes(k)))fail(400,'请求格式无效');
   if(body.privateTopics!==undefined&&!list(body.privateTopics,topics)||body.shareSensitive!==undefined&&!list(body.shareSensitive,sensitive)||body.adopt!==undefined&&body.adopt!==true)fail(400,'可见范围选项无效');
   return store.transaction(s=>{
    if(!recordOf(s,uid))fail(400,'先填一些问卷，再设置谁能看到');
    const old=recordOf(s,uid);
    if(old.version!==bank.version){const up=upgradeRecord(old,bank);if(up!==old){for(const k of Object.keys(old))delete old[k];Object.assign(old,up);}}
    return result(touch(s,uid,r=>{const v=visibilityOf(r);r.visibility={model:body.adopt?'v2':v.model,privateTopics:[...(body.privateTopics??v.privateTopics)],shareSensitive:[...(body.shareSensitive??v.shareSensitive)]};}));
   });
  },
  /** 交友卡 / 详情页上看某位会员：只返回按新规则你能看到的答案，加上「底线不同 / 节奏不同」提示。 */
  member(uid,shareId){
   uidCheck(uid);
   if(typeof shareId!=='string'||!shareId||shareId.length>100)fail(400,'对象编号无效');
   const s=store.read(),p=(s.profiles||[]).find(p=>p.shareId===shareId);
   if(!p||same(p.userId,uid)||blocked(s,uid,p.userId)||isDisabled(s,p.userId)||isDisabled(s,uid)||(p.listed===false||!require('./friends-review').reviewVisible(p))&&!connected(s,uid,p.userId))fail(404,'暂时看不到这位会员的问卷');
   const mine=readOf(s,uid),visible=memberView(s,p.userId,uid,{bank});
   const {highlights,notes}=pairNotes(mine,visible,{bank});
   return {shareId:p.shareId,nickname:p.nickname,peer:visible,highlights,notes,viewerQuickReady:quickReady(mine,bank),romance:romanceOverlap(s,uid,p.userId),connected:pairUsable(s,uid,p.userId)};
  },
  peers(uid){
   uidCheck(uid);const s=store.read(),mine=recordOf(s,uid);
   const ids=new Set((s.requests||[]).filter(r=>r.status==='accepted'&&(same(r.from,uid)||same(r.to,uid))).map(r=>String(same(r.from,uid)?r.to:r.from)));
   const peers=(s.profiles||[]).filter(p=>ids.has(String(p.userId))&&pairUsable(s,uid,p.userId)).map(p=>({shareId:p.shareId,nickname:p.nickname,myOffered:offered(s,uid,p.userId),theirOffered:offered(s,p.userId,uid),mutualDimensions:mutualDimensions(s,uid,p.userId)}));
   return {peers,hasQuestionnaire:!!mine};
  },
  setShare(uid,shareId,body){XB.check(store,uid);
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
   const peerRecord=readOf(s,p.userId),visible=mergeViews(project(peerRecord,mutual,bank),memberView(s,p.userId,uid,{bank}));
   const {highlights,notes}=pairNotes(readOf(s,uid),visible,{bank});
   return {shareId:p.shareId,nickname:p.nickname,mutualDimensions:mutual,peer:visible,explanations:pairAlignment(s,uid,p.userId,{bank}).explanations,highlights,notes,note:'只显示对方愿意给你看的答案；其他答案不会出现在这里。'};
  },
  remove(uid){uidCheck(uid);return store.transaction(s=>{s.marriageQuestionnaires=records(s).filter(r=>!same(r.userId,uid));s.questionnaireShares=shareRows(s).filter(r=>!same(r.ownerId,uid)&&!same(r.peerId,uid));return {deleted:true};});}
 };
}
module.exports={BANK,createFriendsQuestionnaireService,questionnaireAlignment,pairAlignment,mutualDimensions,discoverReasons,normalizeDimension,progressOf,upgradeRecord,memberView,quickReady,quickDone,quickConflict,rhythmOf,pairNotes};
