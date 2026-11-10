'use strict';
const crypto=require('node:crypto');
const {calculate}=require('./friends-chart');
const XB=require('./friends-cross-border');
const {isDisabled}=require('./friends-admin');
const M=require('./friends-matching');
const VERSION='compatibility-guide-v3',VERSION_V4='compatibility-guide-v4',DAY=86400000;
// v3 老授权继续可用（看旧版指南 +「重新授权可看新版」），v4 才能看合盘新版；不自动迁移。
const ACCEPTED_VERSIONS=Object.freeze([VERSION,VERSION_V4]);
const okAuth=a=>ACCEPTED_VERSIONS.includes(a?.version),isV4=a=>a?.version===VERSION_V4;
const HE=require('./friends-hepan-v4'),HC=require('./friends-hepan-copy'),HV=require('./friends-hepan-view');
const {consentRevokedIn}=require('./friends-hepan-pay');
const PURPOSES=['romance','buddy'];
// 邀请对象：朋友/暧昧对象（friend），或在一起一段时间、在考虑结婚的恋人（couple）。只影响结果页的措辞和结尾按钮，不影响合盘规则。
const RELATIONS=['friend','couple'];
const MQ=require('./friends-questionnaire');
// 恋人版固定展示的婚前方向（没有足够答案时也列出来，作为可以聊开的话题）。
const COUPLE_FOCUS=['family','finance','future','conflict','boundaries'];
/**
 * 双方都同意后，用「认真结婚」问卷的底线题（quickPath）给每个方向一个讨论提示：同频 / 可以聊聊（恋人版：婚前值得聊开）。
 * 隐私：只读底线题；敏感题不比较；任一方把底线题层或某方向设为仅自己，就不用那部分；不返回任何原始答案、分数或百分比。
 */
function directionSupplement(s,p,{bank=MQ.BANK}={}){
 const relation=RELATIONS.includes(p.relation)?p.relation:'friend',a=p.authorizations?.[String(p.from)],b=p.authorizations?.[String(p.to)];
 const base={relation,mineIncluded:false,peerIncluded:false};
 if(!a?.includeQuestionnaire||!b?.includeQuestionnaire)return {...base,mineIncluded:!!a?.includeQuestionnaire,peerIncluded:!!b?.includeQuestionnaire,status:'not_authorized',directions:[],note:'三观部分需要双方都答底线题并同意加入，不影响日主对照。'};
 const recordOf=uid=>{const r=(Array.isArray(s.marriageQuestionnaires)?s.marriageQuestionnaires:[]).find(r=>same(r.userId,uid));return r?MQ.upgradeRecord(r,bank):null;};
 const quick=new Set(bank.quickPath?.questions||[]);
 const usable=r=>{if(!r||r.version!==bank.version)return null;const priv=new Set(Array.isArray(r.visibility?.privateTopics)?r.visibility.privateTopics:[]);if(priv.has('quick'))return {dimensions:{}};
  return {dimensions:Object.fromEntries(bank.dimensions.filter(d=>!priv.has(d.id)&&r.dimensions?.[d.id]).map(d=>{const src=r.dimensions[d.id];return [d.id,{status:src.status,answers:Object.fromEntries(Object.entries(src.answers||{}).filter(([id])=>quick.has(id)))}];}))};};
 const ra=usable(recordOf(p.from)),rb=usable(recordOf(p.to));
 const ready={...base,mineIncluded:true,peerIncluded:true};
 if(!ra||!rb)return {...ready,status:'waiting_answers',directions:[],note:'还有一方没有答底线题。答完 14 道底线题，这里就会出现你们在各个方向上的讨论提示。'};
 const {dimensions}=MQ.questionnaireAlignment(ra,rb,{bank});
 const couple=relation==='couple';
 const directions=dimensions.filter(d=>d.signal!=='unknown'||couple&&COUPLE_FOCUS.includes(d.id)).sort((x,y)=>couple?(COUPLE_FOCUS.indexOf(x.id)+1||99)-(COUPLE_FOCUS.indexOf(y.id)+1||99):0).map(d=>d.signal==='close'
  ?{id:d.id,label:d.label,tone:'same',tag:'同频',text:`在「${d.label}」上，你们的想法接近。`}
  :d.signal==='talk'?{id:d.id,label:d.label,tone:'talk',tag:couple?'婚前值得聊开':'可以聊聊',text:couple?`「${d.label}」上你们的想法有些不一样，婚前值得先聊开。`:`「${d.label}」上你们的想法有些不一样，值得聊聊。`}
  :{id:d.id,label:d.label,tone:'open',tag:'还没对上',text:`「${d.label}」的底线题还没有都答，可以从这里聊起。`});
 return {...ready,status:directions.length?'available':'waiting_answers',directions,note:'只按双方都同意加入的底线题给方向提示，不展示任何人的原始回答；想法不一样很正常，这里不评判，也不指出谁该改变。'};
}
// AI 文案失败后，同一对盘多久再试一次（期间直接给固定模板，不打模型）。
const AI_RETRY_MS=10*60000;
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],ELEMENTS=[...'木火土金水'],BRANCHES=[...'子丑寅卯辰巳午未申酉戌亥'];
const SIX_HE=['子丑','寅亥','卯戌','辰酉','巳申','午未'],TRIPLES=['申子辰','亥卯未','寅午戌','巳酉丑'];
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const rows=s=>{if(s.compatibilityPairs===undefined)s.compatibilityPairs=[];if(!Array.isArray(s.compatibilityPairs))throw Error('双人文化对照数据损坏');return s.compatibilityPairs;};
const same=(a,b)=>String(a)===String(b);
function purgeExpiredCompatibility(s,now=Date.now()){for(const p of rows(s))if(Date.parse(p.expiresAt)<=now&&!['revoked','declined','expired'].includes(p.status)){p.status='expired';p.authorizations={};p.messages=[];delete p.v4Cache;p.revision++;p.updatedAt=new Date(now).toISOString();}return s;}
function stemRelation(a,b){const ia=STEMS.indexOf(a),ib=STEMS.indexOf(b);if(ia<0||ib<0)return null;const ea=Math.floor(ia/2),eb=Math.floor(ib/2);let relation;if(ea===eb)relation='同五行';else if((ea+1)%5===eb)relation='A方五行生B方';else if((eb+1)%5===ea)relation='B方五行生A方';else if((ea+2)%5===eb)relation='A方五行克B方';else relation='B方五行克A方';return {relation,note:'传统五行关系的描述，不代表谁应付出、谁更好或关系结果。'};}
function branchRelation(a,b){if(!BRANCHES.includes(a)||!BRANCHES.includes(b))return null;if(a===b)return '同地支';if(SIX_HE.some(p=>p.includes(a)&&p.includes(b)))return '传统六合';if(Math.abs(BRANCHES.indexOf(a)-BRANCHES.indexOf(b))===6)return '传统六冲（仅文化分类，不等于现实不合）';if(TRIPLES.some(p=>p.includes(a)&&p.includes(b)))return '同属传统三合分组（两支不构成三合局）';return '未命中本基础版的同支、六合、六冲或三合同组规则';}
function relationshipSummary(a,b){
 if(!a.complete||!b.complete)return {available:false,sixHarmonyGroupCount:null,hasSameDayMaster:null,hasDifferentMonthPillar:null,hasHarm:null,note:'四柱信息不足，暂不汇总。'};
 const keys=['year','month','day','hour'],he=new Set(),harmGroups=['子未','丑午','寅巳','卯辰','申亥','酉戌'];let hasHarm=false;
 for(const ak of keys)for(const bk of keys){const x=[...a.pillars[ak]][1],y=[...b.pillars[bk]][1];if(x===y)continue;for(const group of SIX_HE)if(group.includes(x)&&group.includes(y))he.add(group);if(harmGroups.some(group=>group.includes(x)&&group.includes(y)))hasHarm=true;}
 return {available:true,sixHarmonyGroupCount:he.size,hasSameDayMaster:[...a.pillars.day][0]===[...b.pillars.day][0],hasDifferentMonthPillar:a.pillars.month!==b.pillars.month,hasHarm,note:'后台比较双方四柱的16组跨柱关系，相同六合分组只计一次；这些是文化规则线索，不是关系好坏或成功率。'};
}
// 时辰不详时 v4 用年月日三柱（v4Pillars）；chart.pillars 保持 v3 形状（只有日柱），旧版指南和付费报告事实照旧只看日柱。
const v4Chart=c=>{const p=c.v4Pillars||c.pillars;return {gender:c.gender,pillars:{year:p.year,month:p.month,day:p.day,hour:c.complete?p.hour:null}};};
// 付费模块用：这对邀请能不能看 v4、有几处磨合点、几条计分依据。不能看就返回 null。
function pairFacts(p,now=Date.now()){
 if(!p||p.status!=='ready'||Date.parse(p.expiresAt)<=now||p.to===null)return null;
 const a=p.authorizations?.[String(p.from)],b=p.authorizations?.[String(p.to)];if(!isV4(a)||!isV4(b))return null;
 const analysis=HE.analyze(v4Chart(a.chart),v4Chart(b.chart),{purpose:p.purpose||'romance'});
 return {moheCount:HE.items(analysis).mohe.length,basisCount:analysis.hits.filter(h=>h.points!==0).length};
}
function createCompatibilityService({store,calculateChart=calculate,questionnaireService=null,questionBank=null,clock=()=>Date.now(),generateProse=null,isUnlocked=()=>false,pay=null}={}){
 const proseInflight=new Map();
 if(!store?.read||!store?.transaction)throw Error('双人文化对照需要加密存储');
 const uidCheck=uid=>{if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');};
 const profile=(s,uid)=>(s.profiles||[]).find(p=>same(p.userId,uid));
 const blocked=(s,a,b)=>(s.blocks||[]).some(x=>same(x.by,a)&&same(x.target,b)||same(x.by,b)&&same(x.target,a));
 // 首批审核制: a card still under review (or not passed) can't be a 合盘 target or requester.
 // 审核只管资料里的声明（学历、照片等）；合盘用的是本人填的真实生日，审核期间也可以发起和使用（认识申请仍要等通过）。
 const liveProfile=(s,p)=>!!p?.listed&&!isDisabled(s,p.userId);
 function usable(s,p){const target=profile(s,p.to),requester=profile(s,p.from);if(isDisabled(s,p.from)||p.to!==null&&isDisabled(s,p.to)||p.to!==null&&blocked(s,p.from,p.to))return false;if(p.mode==='open_invite')return (!p.requesterShareId||requester?.shareId===p.requesterShareId)&&(!p.recipientShareId||target?.shareId===p.recipientShareId);return liveProfile(s,target)&&target.shareId===p.targetShareId&&(!p.requesterShareId||requester?.shareId===p.requesterShareId&&liveProfile(s,requester))&&(!requester||liveProfile(s,requester));}
 function snapshot(){const s=store.read();if(rows(s).some(p=>Date.parse(p.expiresAt)<=clock()&&!['revoked','declined','expired'].includes(p.status)))return store.transaction(next=>{purgeExpiredCompatibility(next,clock());return structuredClone(next);});return s;}
 function own(s,uid,id){uidCheck(uid);const p=rows(s).find(p=>p.id===id&&(same(p.from,uid)||same(p.to,uid)));if(!p)fail(404,'邀请不存在');return p;}
 function active(s,uid,id){const p=own(s,uid,id);if(!usable(s,p))fail(404,'邀请或卡片已不可用');if(!['pending_recipient','pending_recipient_confirmation','pending_authorizations','ready'].includes(p.status)||Date.parse(p.expiresAt)<=clock())fail(409,'本次授权已终止，请重新发起邀请');return p;}
 function chatReady(s,uid,id){const p=active(s,uid,id);if(p.to===null||p.status!=='ready'||p.mode==='open_invite'&&!p.recipientConfirmed||!okAuth(p.authorizations[String(p.from)])||!okAuth(p.authorizations[String(p.to)])||p.authorizations[String(p.from)]?.chatConsent!==true||p.authorizations[String(p.to)]?.chatConsent!==true)fail(409,'请先核对对象并完成双方文字交流授权，再开始对话');if(p.messages===undefined)p.messages=[];if(!Array.isArray(p.messages))throw Error('对话数据损坏');return p;}
 const publicMessage=(m,uid)=>({id:m.id,text:m.text,mine:same(m.sender,uid),createdAt:m.createdAt});
 function updateStatus(p){p.status=p.to===null?'pending_recipient':p.mode==='open_invite'&&!p.recipientConfirmed?'pending_recipient_confirmation':okAuth(p.authorizations[String(p.from)])&&okAuth(p.authorizations[String(p.to)])?'ready':'pending_authorizations';}
 function view(s,p,uid){const mine=p.authorizations?.[String(uid)],other=p.to===null?null:p.authorizations?.[String(same(p.from,uid)?p.to:p.from)],peer=profile(s,same(p.from,uid)?p.to:p.from),available=usable(s,p);return {id:p.id,status:available?p.status:'unavailable',mode:p.mode||'target_card',direction:same(p.from,uid)?'outgoing':'incoming',createdAt:p.createdAt,updatedAt:p.updatedAt,expiresAt:p.expiresAt,peer:{nickname:p.to===null?'等待对象认领':liveProfile(s,peer)?peer.nickname:same(p.from,uid)?p.recipientNickname||'对方自报昵称':p.ownerNickname||'邀请者',shareId:liveProfile(s,peer)?peer.shareId:null},recipientClaimed:p.to!==null,recipientConfirmed:p.mode!=='open_invite'||p.recipientConfirmed===true,canConfirmRecipient:p.mode==='open_invite'&&same(p.from,uid)&&p.to!==null&&!p.recipientConfirmed,myAuthorized:available&&okAuth(mine),peerAuthorized:available&&okAuth(other),myQuestionnaireIncluded:!!mine?.includeQuestionnaire,peerQuestionnaireIncluded:available&&okAuth(other)&&!!other?.includeQuestionnaire,relation:RELATIONS.includes(p.relation)?p.relation:'friend',basicReady:available&&p.status==='ready'&&okAuth(mine)&&okAuth(other),myChatConsent:available&&okAuth(mine)&&mine?.chatConsent===true,peerChatConsent:available&&okAuth(other)&&other?.chatConsent===true,chatReady:available&&p.status==='ready'&&okAuth(mine)&&okAuth(other)&&mine?.chatConsent===true&&other?.chatConsent===true,fullEnabled:!!pay?.enabled(),v4Unlocked:available&&!!pay&&pay.isUnlocked('pair',p,s),purpose:p.purpose||'romance',myVersion:mine?.version||null,peerVersion:other?.version||null,v4Ready:available&&p.status==='ready'&&isV4(mine)&&isV4(other),needsV4Reauthorization:available&&okAuth(mine)&&!isV4(mine)};}

 const checkClaim=({inviteToken,consent,nickname})=>{if(consent!==true||typeof nickname!=='string'||!nickname.trim()||nickname.trim().length>24||typeof inviteToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(inviteToken))fail(400,'请确认认领邀请并填写本人自报昵称');};
 const findInvite=(s,inviteToken)=>{const digest=crypto.createHash('sha256').update(inviteToken).digest('hex');return rows(s).find(p=>p.inviteTokenHash===digest);};
 // 认领：在事务里调用。
 function claimIn(s,uid,inviteToken,nickname){purgeExpiredCompatibility(s,clock());const p=findInvite(s,inviteToken);if(!p||p.status==='expired')fail(404,'邀请链接无效或已到期');if(same(p.from,uid))fail(403,'发起人不能认领自己的邀请');if(p.to!==null)fail(409,'此邀请已绑定接收者，不能再次认领或更换对象');if(p.status!=='pending_recipient'||!usable(s,p)||isDisabled(s,uid)||blocked(s,p.from,uid))fail(409,'本次邀请不可认领');if(!p.authorizations[String(p.from)])fail(409,'发起人尚未确认本人生辰，请先请对方完成');{const a=profile(s,p.from),b=profile(s,uid);if(a&&b&&M.purposesIsolated(M.purposesOf(a),M.purposesOf(b)))fail(403,'「婚后找搭子」和选了恋爱或婚恋的人不能互相发起合盘');}p.to=uid;p.recipientNickname=nickname.trim();p.recipientShareId=profile(s,uid)?.shareId||null;p.recipientConfirmed=false;p.claimedAt=new Date(clock()).toISOString();p.revision++;p.updatedAt=p.claimedAt;updateStatus(p);return p;}

 // 本人出生资料 → 只存计算结果（四柱/日柱），不存生日原文。校验全部在写入前完成。
 async function prepareAuth(uid,{version,consent,inferenceConsent,poolOptIn=false,crossBorderConsent,input,includeQuestionnaire=false,allowChat=false}={}){if(!ACCEPTED_VERSIONS.includes(version)||consent!==true||typeof includeQuestionnaire!=='boolean'||typeof allowChat!=='boolean')fail(400,'请分别确认本人生辰与本次双人用途授权');const v4=version===VERSION_V4;if(v4&&(inferenceConsent!==true||typeof poolOptIn!=='boolean'))fail(400,'请确认「对方可能据此推测你的部分八字」这一项授权');if(v4&&!['male','female'].includes(input?.gender))fail(400,'请选择性别');XB.accept(store,uid,{crossBorderConsent},clock());if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'请填写本人的出生资料');const result=calculateChart({birthday:input.birthday,calendar:input.calendar,cityId:input.cityId,time:input.time,leapMonth:input.leapMonth===true,disambiguation:input.disambiguation},new Date(clock()));if(input.cityId&&!result.birthLocation)fail(400,'请重新选择出生城市');const chart={complete:result.complete===true,pillars:result.complete?structuredClone(result.pillars):{day:result.dayPillar},calculationVersion:result.calculationVersion||'unknown',...(v4?{gender:input.gender,...(!result.complete&&result.basePillars?{v4Pillars:structuredClone(result.basePillars)}:{})}:{})};if(chart.complete&&['year','month','day','hour'].some(k=>!chart.pillars?.[k]||[...chart.pillars[k]].length!==2))fail(400,'四柱结果不完整');const q=includeQuestionnaire?await getQuestions(uid):null;return {version,v4,chart,includeQuestionnaire,allowChat,poolOptIn,q};}
 function writeAuth(s,p,uid,{version,v4,chart,includeQuestionnaire,allowChat,poolOptIn,q}){if(allowChat===false)p.messages=[];const at=new Date(clock()).toISOString(),xb=XB.recordOf(s,uid);p.authorizations[String(uid)]={version,at,crossBorderConsentVersion:xb.version,crossBorderConsentAt:xb.at,chart,includeQuestionnaire,chatConsent:allowChat,questionnaireStamp:stamp(q),...(v4?{inferenceConsent:true,inferenceConsentAt:at,poolOptIn,poolOptInAt:at}:{})};if(p.v4Cache)delete p.v4Cache;updateStatus(p);p.revision++;p.updatedAt=new Date(clock()).toISOString();}
 const getQuestions=async uid=>questionnaireService?(await questionnaireService.get(uid))?.questionnaire||null:null;
 const stamp=q=>q?{version:q.version,revision:q.revision,updatedAt:q.updatedAt,recordId:q.recordId||null}:null;
 const stampMatches=(a,q)=>!!a&&!!q&&a.version===q.version&&a.revision===q.revision&&a.updatedAt===q.updatedAt&&(a.recordId||null)===(q.recordId||null);
 function supplement(p,qa,qb){const a=p.authorizations[String(p.from)],b=p.authorizations[String(p.to)];if(!a.includeQuestionnaire||!b.includeQuestionnaire)return {status:'not_authorized',topics:[],note:'问卷只是可选补充，需要双方分别同意；不影响四柱基础对照。'};if(!stampMatches(a.questionnaireStamp,qa)||!stampMatches(b.questionnaireStamp,qb))return {status:'needs_reauthorization',topics:[],note:'答卷已修改、删除或尚未保存，请双方重新确认问卷摘要授权。'};if(!questionBank||qa.version!==questionBank.version||qb.version!==questionBank.version)return {status:'unavailable',topics:[],note:'问卷版本不一致，暂不比较。'};
  const safeTopics=new Set(['conflict','leisure','habits']);const topics=questionBank.topics.map(topic=>{const comparable=questionBank.questions.filter(q=>q.topicId===topic.id&&q.type==='single_choice').map(q=>[qa.answers[q.id],qb.answers[q.id]]).filter(([x,y])=>x?.selfAnswer&&y?.selfAnswer&&Array.isArray(x.acceptablePartnerAnswers)&&Array.isArray(y.acceptablePartnerAnswers)&&x.acceptablePartnerAnswers.length&&y.acceptablePartnerAnswers.length);let discussion='可以自愿聊聊这个主题的期待；本页不展示任何人的原始回答。';let category='neutral_prompt';if(safeTopics.has(topic.id)&&comparable.length>=2){const mutual=comparable.every(([x,y])=>x.acceptablePartnerAnswers.includes(y.selfAnswer)&&y.acceptablePartnerAnswers.includes(x.selfAnswer));category=mutual?'shared_direction':'discuss_further';discussion=mutual?'部分已授权偏好有共同讨论方向，可以用真实相处继续了解。':'这个主题值得进一步交流，差异不等于不合适，也不指出谁应改变。';}return {topic:topic.label,category,discussion};});return {status:'available',topics,note:'只提供双方授权的主题级讨论提示；不比较自由文本，不披露具体选项，不给关系成功率。'};
 }
 // 合盘 v4：分数由规则引擎算，文案按「双方干支+性别+目的+引擎」缓存在这对邀请上，同一对永远同一份。
 async function reportV4(uid,id){
  let s=snapshot(),p=active(s,uid,id);const a=p.authorizations[String(p.from)].chart,b=p.authorizations[String(p.to)].chart,purpose=p.purpose||'romance';
  const charts={A:v4Chart(a),B:v4Chart(b)};
  const analysis=HE.analyze(charts.A,charts.B,{purpose}),picked=HE.items(analysis),key=HE.cacheKey(charts.A,charts.B,purpose);
  let prose=p.v4Cache?.key===key&&p.v4Cache.prose?.source==='ai'?p.v4Cache.prose:null;
  if(!prose){
   // 只缓存 AI 文案；回落模板不落库（也不存 fallbackReason）。失败后的冷却记在这对邀请上（v4AiRetry），重启/换进程也不会立刻重试；
   // 另外每人每小时有调用上限（HC.takeAiCall），超了直接给模板。
   const until=p.v4AiRetry?.key===key?Number(p.v4AiRetry.at)||0:0;
   if(typeof generateProse==='function'&&until<=clock()&&(proseInflight.has(key)||HC.takeAiCall(store,uid,clock()))){
    if(!proseInflight.has(key))proseInflight.set(key,HC.writeProse(analysis,picked,{mode:'invite',generate:generateProse}).finally(()=>proseInflight.delete(key)));
    const {fallbackReason,...written}=await proseInflight.get(key);prose=written;
    const ai=prose.source==='ai';
    store.transaction(next=>{const q=rows(next).find(x=>x.id===id);if(!q)return;if(ai){delete q.v4AiRetry;if(q.v4Cache?.prose?.source!=='ai'&&q.authorizations?.[String(q.from)]&&q.authorizations?.[String(q.to)])q.v4Cache={key,prose,at:new Date(clock()).toISOString()};}else q.v4AiRetry={key,at:clock()+AI_RETRY_MS};});
    s=snapshot();p=active(s,uid,id);
   }else prose=HC.templateProse(analysis,picked);
  }
  const viewer=same(p.from,uid)?'A':'B',other=viewer==='A'?'B':'A',peer=view(s,p,uid).peer.nickname;
  // 解锁看这对邀请上的标记（且来源订单/会员份数仍有效）；offer 只告诉前端能不能买、怎么买，不含任何锁住的内容。
  const unlocked=pay?pay.isUnlocked('pair',p,s):isUnlocked(p,uid)===true,offer=pay?pay.offerFor(uid,'pair',p,s):null;
  const build=pr=>HV.buildReport({analysis,picked,prose:pr,charts,mode:'invite',viewer,unlocked,offer,taNickname:peer});
  let report=build(prose);
  // 泄露扫描：命中就退回固定模板；模板还命中则直接拒绝返回。
  if(HV.assertNoLeak(report,charts[other].pillars).length){report=build(HC.templateProse(analysis,picked));if(HV.assertNoLeak(report,charts[other].pillars).length)fail(500,'报告安全检查未通过，请稍后再试');}
  if(pay&&report.unlocked&&!report.allShown)pay.markOpened(uid,'pair',p.id);
  // 方向提示是固定文案（不含任何干支），放在泄露扫描之后附上。
  return {pairId:p.id,...report,relation:RELATIONS.includes(p.relation)?p.relation:'friend',questionnaireDirections:directionSupplement(s,p)};
 }
 return {
  status(){return {basicEnabled:true,fullEnabled:!!pay?.enabled(),authorizationVersion:VERSION_V4,acceptedVersions:[...ACCEPTED_VERSIONS],note:'基础相处指南免费。双方都看不到对方的生辰，完整报告准备中。'};},
  list(uid){uidCheck(uid);const s=snapshot();return {pairs:rows(s).filter(p=>same(p.from,uid)||same(p.to,uid)).slice(-100).reverse().map(p=>view(s,p,uid))};},
  get(uid,id){const s=snapshot();return view(s,own(s,uid,id),uid);},
  create(uid,{targetShareId,ownerNickname,purpose='romance',relation='friend'}={}){uidCheck(uid);XB.check(store,uid);if(!PURPOSES.includes(purpose))fail(400,'合盘目的无效');if(!RELATIONS.includes(relation))fail(400,'邀请对象类型无效');if(relation==='couple')purpose='romance';if(targetShareId!==undefined&&(typeof targetShareId!=='string'||targetShareId.length>100))fail(400,'公开分享卡编号无效');return store.transaction(s=>{purgeExpiredCompatibility(s,clock());const requester=profile(s,uid),target=targetShareId?(s.profiles||[]).find(p=>p.shareId===targetShareId):null;if(isDisabled(s,uid))fail(403,'账号暂不可发起邀请');if(targetShareId&&(!liveProfile(s,target)||requester&&!liveProfile(s,requester)||blocked(s,uid,target.userId)))fail(404,'公开卡片不可用');if(target&&same(target.userId,uid))fail(400,'不能邀请自己');if(target&&requester&&M.purposesIsolated(M.purposesOf(requester),M.purposesOf(target)))fail(403,'「婚后找搭子」和选了恋爱或婚恋的人不能互相发起合盘');if(target){const old=rows(s).find(p=>[p.from,p.to].some(x=>same(x,uid))&&[p.from,p.to].some(x=>same(x,target.userId))&&['pending_authorizations','ready'].includes(p.status)&&usable(s,p));if(old)return view(s,old,uid);}if(rows(s).filter(p=>same(p.from,uid)&&clock()-Date.parse(p.createdAt)<DAY).length>=10)fail(429,'每天最多发起10次关系指南邀请');const now=new Date(clock()).toISOString(),token=target?null:crypto.randomBytes(32).toString('base64url'),p={id:crypto.randomUUID(),from:uid,to:target?.userId??null,mode:target?'target_card':'open_invite',ownerNickname:typeof ownerNickname==='string'?ownerNickname.trim().slice(0,24):'邀请者',purpose,relation,targetShareId:target?.shareId||null,requesterShareId:requester?.shareId||null,recipientConfirmed:!!target,status:target?'pending_authorizations':'pending_recipient',authorizations:{},revision:1,createdAt:now,updatedAt:now,expiresAt:new Date(clock()+7*DAY).toISOString(),...(token?{inviteTokenHash:crypto.createHash('sha256').update(token).digest('hex')}:{})};rows(s).push(p);return {...view(s,p,uid),...(token?{inviteToken:token}:{})};});},
  claim(uid,{inviteToken,consent,nickname}={}){uidCheck(uid);XB.check(store,uid);checkClaim({inviteToken,consent,nickname});return store.transaction(s=>{const p=claimIn(s,uid,inviteToken,nickname);return view(s,p,uid);});},
  // 被邀请的朋友一步完成：认领邀请 + 填本人生辰 + （可选）同意用底线题生成三观提示。生辰校验失败时不会先认领。
  async join(uid,{inviteToken,nickname,claimConsent,...body}={}){uidCheck(uid);checkClaim({inviteToken,consent:claimConsent,nickname});{const p=findInvite(snapshot(),inviteToken);if(!p||p.status==='expired')fail(404,'邀请链接无效或已到期');}const x=await prepareAuth(uid,body);return store.transaction(s=>{const p=claimIn(s,uid,inviteToken,nickname);writeAuth(s,p,uid,x);return view(s,p,uid);});},
  // 打开链接、登录前：只告诉对方是谁邀请、哪种邀请。不含生辰、问卷或任何账号信息。
  invitePreview(inviteToken){if(typeof inviteToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(inviteToken))fail(404,'邀请链接无效或已到期');const s=snapshot(),p=findInvite(s,inviteToken);if(!p||p.status!=='pending_recipient'||Date.parse(p.expiresAt)<=clock()||!usable(s,p)||!p.authorizations?.[String(p.from)])fail(404,'邀请链接无效、已到期或已被认领');return {ownerNickname:p.ownerNickname||'邀请者',relation:RELATIONS.includes(p.relation)?p.relation:'friend'};},
  // 已授权后单独打开/关闭「用我的底线题生成三观提示」，不用重填生辰。
  async setQuestionnaire(uid,id,{include}={}){if(typeof include!=='boolean')fail(400,'请明确选择是否加入问卷');const p0=active(snapshot(),uid,id);if(!okAuth(p0.authorizations[String(uid)]))fail(409,'请先确认本人生辰');const q=include?await getQuestions(uid):null;return store.transaction(s=>{const p=active(s,uid,id),mine=p.authorizations[String(uid)];if(!okAuth(mine))fail(409,'请先确认本人生辰');mine.includeQuestionnaire=include;mine.questionnaireStamp=stamp(q);mine.questionnaireAt=new Date(clock()).toISOString();p.revision++;p.updatedAt=mine.questionnaireAt;return view(s,p,uid);});},
  confirmRecipient(uid,id,{consent}={}){return store.transaction(s=>{const p=active(s,uid,id);if(!same(p.from,uid))fail(403,'只有发起人可核对接收者');if(consent!==true||p.mode!=='open_invite'||p.to===null)fail(400,'请先核对已认领的接收者并明确确认');p.recipientConfirmed=true;p.recipientConfirmedAt=new Date(clock()).toISOString();p.recipientConfirmedBy=uid;p.revision++;p.updatedAt=new Date(clock()).toISOString();updateStatus(p);return view(s,p,uid);});},
  async authorize(uid,id,body={}){active(snapshot(),uid,id);const x=await prepareAuth(uid,body);return store.transaction(s=>{const p=active(s,uid,id);writeAuth(s,p,uid,x);return view(s,p,uid);});},
  // 撤回/婉拒：先按 7 天规则处理已解锁的完整版（对方撤回且付款人没打开过 → 退），再清授权。
  revoke(uid,id){return store.transaction(s=>{const p=own(s,uid,id);if(p.v4Unlock)consentRevokedIn(s,p,uid,clock());p.status='revoked';p.authorizations={};p.messages=[];delete p.v4Cache;p.revision++;p.updatedAt=new Date(clock()).toISOString();return view(s,p,uid);});},
  decline(uid,id){return store.transaction(s=>{const p=own(s,uid,id);if(!same(p.to,uid))fail(403,'只有接收者可拒绝邀请');if(p.v4Unlock)consentRevokedIn(s,p,uid,clock());p.status='declined';p.authorizations={};p.messages=[];delete p.v4Cache;p.revision++;p.updatedAt=new Date(clock()).toISOString();return view(s,p,uid);});},
  messages(uid,id,{after,limit=50}={}){const s=snapshot(),p=chatReady(s,uid,id);if(!Number.isInteger(Number(limit))||Number(limit)<1||Number(limit)>100)fail(400,'每页消息数量须为1至100');let start=0;if(after!==undefined&&after!==null&&after!==''){if(typeof after!=='string'||after.length>100)fail(400,'消息游标无效');const index=p.messages.findIndex(m=>m.id===after);if(index<0)fail(400,'消息游标无效，请重新载入对话');start=index+1;}const page=p.messages.slice(start,start+Number(limit));return {messages:page.map(m=>publicMessage(m,uid)),nextCursor:page.at(-1)?.id||after||null,hasMore:start+page.length<p.messages.length};},
  sendMessage(uid,id,{text,clientMessageId}={}){uidCheck(uid);if(typeof text!=='string'||!text.trim()||[...text.trim()].length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))fail(400,'消息请填写1至1000字的纯文本');if(typeof clientMessageId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(clientMessageId))fail(400,'消息重试编号无效');const value=text.trim();return store.transaction(s=>{purgeExpiredCompatibility(s,clock());const p=chatReady(s,uid,id),old=p.messages.find(m=>same(m.sender,uid)&&m.clientMessageId===clientMessageId);if(old){if(old.text!==value)fail(409,'同一消息编号不能用于不同内容');return {message:publicMessage(old,uid),duplicate:true};}if(p.messages.length>=2000)fail(429,'本次对话已达2000条上限');if(p.messages.filter(m=>same(m.sender,uid)&&clock()-Date.parse(m.createdAt)<60000).length>=10)fail(429,'发送太快，请稍后再试');const m={id:crypto.randomUUID(),sender:uid,text:value,clientMessageId,createdAt:new Date(clock()).toISOString()};p.messages.push(m);return {message:publicMessage(m,uid),duplicate:false};});},
  async report(uid,id,{legacyGuide=false}={}){let s=snapshot(),p=active(s,uid,id);if(!legacyGuide&&p.status==='ready'&&isV4(p.authorizations[String(p.from)])&&isV4(p.authorizations[String(p.to)]))return reportV4(uid,id);if(p.status!=='ready'||!okAuth(p.authorizations[String(p.from)])||!okAuth(p.authorizations[String(p.to)]))fail(409,'需要绑定并核对接收者，且双方分别授权后才能查看');const revision=p.revision,withQuestions=p.authorizations[String(p.from)].includeQuestionnaire&&p.authorizations[String(p.to)].includeQuestionnaire,[qa,qb]=withQuestions?await Promise.all([getQuestions(p.from),getQuestions(p.to)]):[null,null];s=snapshot();p=active(s,uid,id);if(p.revision!==revision)fail(409,'授权状态已变化，请重新读取');const a=p.authorizations[String(p.from)].chart,b=p.authorizations[String(p.to)].chart,completeFourPillars=a.complete&&b.complete;const themes=['year','month','day','hour'].map((key,index)=>{const av=a.pillars[key],bv=b.pillars[key],relation=av&&bv?stemRelation([...av][0],[...bv][0])?.relation:null,branches=av&&bv?branchRelation([...av][1],[...bv][1]):null;let culturalReference='资料不足，本维度仅保留一般沟通话题，不补造命盘。',interaction='可以自愿说说自己的期待，不必猜测对方。';if(relation){culturalReference=relation==='同五行'?'后台文化规则呈同类意象，可把它当作讨论相似与差异的开场。':relation.includes('生')?'后台文化规则呈相生意象，可把它当作讨论支持与回应的开场。':'后台文化规则呈制约意象，可把它当作讨论不同意见与边界的开场。';interaction=branches?.includes('六冲')?'节奏不同时，先约定暂停与恢复讨论的方式；文化分类不代表现实不合。':branches==='同地支'?'不要默认对方的习惯与你相同，先问具体偏好再作判断。':branches?.includes('六合')?'把容易达成共识的小事说具体，别把默契当作已经同意。':branches?.includes('三合')?'从共同活动积累真实了解，不用文化分组替代相处。':'试着分享一个真实例子，再听听对方的不同经验。';}return {area:['成长背景话题','日常节奏话题','相处与表达话题','未来安排话题'][index],available:!!relation,culturalReference,interaction};});return {pairId:p.id,kind:'relationship_guide_basic',detailLevel:completeFourPillars?'basic':'partial',completeFourPillars,summary:relationshipSummary(a,b),themes,notes:['本指南在后台参考双方四柱，不展示任一方的生辰、四柱值或个人五行；不是关系合适总分或结果保证。','关系提示本身仍可能提供间接线索，不承诺数学意义的匿名；请只邀请愿意了解的对象。',...(completeFourPillars?[]:['至少一方时辰未知：只能提供有限参考，没有推算时柱，不是完整合盘。'])],questionnaireSupplement:supplement(p,qa,qb),fullReport:{enabled:false,note:'完整报告还在准备中。现在看到的是免费的基础指南，不扣次数。'},v4Upgrade:{available:true,text:'重新授权可看新版',mine:!isV4(p.authorizations[String(uid)]),peer:!isV4(p.authorizations[String(same(p.from,uid)?p.to:p.from)])}};}
 };
}
module.exports={createCompatibilityService,directionSupplement,RELATIONS,pairFacts,purgeExpiredCompatibility,stemRelation,branchRelation,relationshipSummary,VERSION,VERSION_V4,ACCEPTED_VERSIONS};
