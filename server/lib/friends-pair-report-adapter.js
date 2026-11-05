'use strict';
// Two-person (双人) relationship report adapter.
// Deliberately separate from friends-report-adapter.js (single-person full report):
// different inputs, different output contract, different entitlement unit (pair_report).
//
// Contract:
//  - Traditional facts are computed on the server from the derived charts stored with each
//    side's authorization. The model never receives pillar values or birth input and is
//    never asked to cast a chart (排盘). It only receives relation labels.
//  - Only data both sides authorized: questionnaire topics appear only when the existing
//    compatibility service says both sides opted in and stamps still match (topic-level only).
//  - Every claim carries a source tag and a factRef that must point at a supplied fact.
const {stemRelation,branchRelation,relationshipSummary}=require('./friends-compatibility');

const PAIR_REPORT_VERSION='pair-report-v1';
const SOURCES=Object.freeze(['传统文化线索','本人自述','待确认']);
const PURPOSES=Object.freeze({friendship:'交朋友',dating:'以恋爱为前提了解',activity:'找兴趣活动搭子'});
const STAGES=Object.freeze({just_matched:'刚认识或刚匹配',chatting:'线上聊过几次',met_offline:'线下见过面',dating:'正在交往'});
const KEYS=['year','month','day','hour'];
const AREAS={year:'成长背景话题',month:'日常节奏话题',day:'相处与表达话题',hour:'未来安排话题'};
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],BRANCHES=[...'子丑寅卯辰巳午未申酉戌亥'];
const DISCLAIMER='本报告由AI依据服务端已计算的传统文化规则与双方授权资料整理，仅供交流参考；传统文化线索不是性格事实、关系结果或婚恋预测，不构成任何决策建议。';
const SECTION_LIMITS=Object.freeze({summary:[1,3],traditionalBasis:[0,6],complementPoints:[1,4],consensus:[0,4],differences:[0,4],questions:[3,3],activities:[3,3],nextSteps:[1,3]});

const fail=(status,message,code)=>{throw Object.assign(Error(message),{status,code});};
const roleText=s=>String(s).replace(/A方/g,'邀请方').replace(/B方/g,'受邀方');

// Server-side facts. `pair` is the stored compatibility pair (with derived charts);
// `guide` is the output of compatibility.report() (already permission-checked, topic-level).
function buildPairFacts({pair,guide,purpose,stage}){
 if(!PURPOSES[purpose])fail(400,'请选择本次了解目的');
 if(!STAGES[stage])fail(400,'请选择当前关系阶段');
 const a=pair?.authorizations?.[String(pair.from)]?.chart,b=pair?.authorizations?.[String(pair.to)]?.chart;
 if(!a||!b)fail(409,'需要双方有效授权后才能生成双人报告');
 const traditional=[],pending=[],selfReported=[];
 KEYS.forEach(key=>{
  const av=a.pillars?.[key],bv=b.pillars?.[key];
  if(!av||!bv){pending.push({id:'p_'+key,text:`${AREAS[key]}：至少一方资料不足（如出生时辰未知），该维度未计算，不作推断。`});return;}
  const [as,ab]=[...av],[bs,bb]=[...bv];
  if(!STEMS.includes(as)||!STEMS.includes(bs)||!BRANCHES.includes(ab)||!BRANCHES.includes(bb))fail(500,'服务端派生盘数据异常');
  traditional.push({id:'t_'+key,area:AREAS[key],stemRelation:roleText(stemRelation(as,bs).relation),branchRelation:roleText(branchRelation(ab,bb))});
 });
 const summary=relationshipSummary(a,b);
 const rules=summary.available?{id:'t_rules',sixHarmonyGroupCount:summary.sixHarmonyGroupCount,sameDayStem:summary.hasSameDayMaster,differentMonthPillar:summary.hasDifferentMonthPillar,hasHarm:summary.hasHarm,note:'跨柱规则计数，仅为文化分类线索'}:null;
 if(rules)traditional.push(rules);
 selfReported.push({id:'s_purpose',text:`购买方填写的本次了解目的：${PURPOSES[purpose]}`});
 selfReported.push({id:'s_stage',text:`购买方填写的当前关系阶段：${STAGES[stage]}`});
 pending.push({id:'p_peer_view',text:'另一方对本次了解目的与关系阶段的看法尚未确认。'});
 const supplement=guide?.questionnaireSupplement;
 let usedQuestionnaire=false;
 if(supplement?.status==='available'&&Array.isArray(supplement.topics)){
  usedQuestionnaire=true;
  supplement.topics.forEach((t,i)=>{
   if(t.category==='shared_direction')selfReported.push({id:'s_q'+i,text:`双方授权的问卷主题「${t.topic}」：有共同讨论方向（只有主题级摘要，无具体选项）`});
   else if(t.category==='discuss_further')selfReported.push({id:'s_q'+i,text:`双方授权的问卷主题「${t.topic}」：值得进一步交流（只有主题级摘要，无具体选项）`});
  });
 }else{
  pending.push({id:'p_questionnaire',text:'双方未同时授权问卷补充（或答卷已变更），现实偏好的共识与差异需要当面确认。'});
 }
 return {version:PAIR_REPORT_VERSION,detailLevel:guide?.completeFourPillars&&traditional.length>=4?'full_four_pillars':'partial',traditional,selfReported,pending,usedQuestionnaire};
}

function factIds(facts){
 return {
  传统文化线索:new Set(facts.traditional.map(f=>f.id)),
  本人自述:new Set(facts.selfReported.map(f=>f.id)),
  待确认:new Set(facts.pending.map(f=>f.id))
 };
}

function buildPairMessages(facts){
 const system=`你是“相生”交友产品的AI文字整理助手，不是命理师，不扮演真人大师。你的任务是把服务端提供的事实整理成一份双人关系交流指南。
硬性规则：
1. 只能使用下方JSON中的事实。禁止自行排盘、推算或补写任何干支、四柱、日期、时辰、出生地、五行百分比。不要输出任何天干地支组合（如两字干支）。
2. 每条内容必须标注source，只能是“传统文化线索”“本人自述”“待确认”之一，并用factRef填写所依据事实的id：传统文化线索只能引用traditional中的id；本人自述只能引用selfReported中的id；待确认可引用pending中的id或填null。没有依据就写成“待确认”，不得编造。
3. 禁止任何分数、百分比、匹配度、指数或排名；禁止宿命化或保证性措辞，包括以下词语（即使是否定句也不要使用）：注定、命中注定、天生一对、天作之合、绝配、必然、必定、一定会、肯定会、保证、正缘、孽缘、克夫、克妻、旺夫、旺妻、婚期、离婚、分手、怀孕、生育、子女。
4. 不评价任何人的道德、家庭、收入、外貌或社会价值；不暗示谁应该付出或改变。称呼只用“邀请方”“受邀方”“你们”。
5. 只输出一个JSON对象，不要Markdown，不要解释。结构：
{"summary":[item],"traditionalBasis":[item],"complementPoints":[{"text":"","source":"","factRef":"","howToVerify":""}],"consensus":[item],"differences":[item],"questions":[item×3],"activities":[item×3],"nextSteps":[item]}
其中item为{"text":"6到200字","source":"","factRef":"事实id或null"}。summary 1-3条（关系摘要）；traditionalBasis 0-6条且全部为传统文化线索（traditional非空时至少1条）；complementPoints 1-4条，每条给出双方可以在真实相处中验证的方法howToVerify；consensus/differences各0-4条，只能基于本人自述或标为待确认；questions恰好3条交流问题；activities恰好3个活动建议；nextSteps 1-3条下一步。`;
 const user='【服务端事实，仅使用以下内容】\n'+JSON.stringify({traditional:facts.traditional,selfReported:facts.selfReported,pending:facts.pending,detailLevel:facts.detailLevel});
 return [{role:'system',content:system},{role:'user',content:user}];
}

function parsePairOutput(text){
 if(typeof text!=='string'||!text.trim())fail(502,'模型返回空内容','empty_output');
 let body=text.trim();
 const fenced=body.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)body=fenced[1];
 try{return JSON.parse(body);}catch(_){fail(502,'模型返回格式无效','invalid_json');}
}

// Valid sexagenary pairs only (stem and branch parity match). "己" after common words such as
// 自己/知己 is ordinary Chinese ("自己未必"), not a pillar.
const GANZHI=new RegExp(STEMS.flatMap((s,i)=>BRANCHES.filter((_,j)=>i%2===j%2).map(b=>(s==='己'?'(?<![自知利异舍为克律])':'')+s+b)).join('|'));
const FORBIDDEN_PATTERNS=Object.freeze([
 ['raw_birth_data',/(?:19|20)\d{2}\s*年/],
 ['raw_birth_data',/\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}/],
 ['raw_birth_data',/\d{1,2}\s*月\s*\d{1,2}\s*[日号]/],
 ['raw_birth_data',/\d{1,2}\s*[:：]\s*\d{2}/],
 ['raw_birth_data',/[子丑寅卯辰巳午未申酉戌亥]时(?![间候刻光代])/],
 ['raw_birth_data',/出生于|出生在|生于|农历生日|阳历生日|出生城市是/],
 ['four_pillars',GANZHI],
 ['four_pillars',/[年月日时]柱[为是：:]/],
 ['fake_score',/\d+(?:\.\d+)?\s*[%％]|百分之|百分百/],
 ['fake_score',/\d+\s*分(?![钟享别开析])/],
 ['fake_score',/匹配度|契合度|合适度|配对指数|缘分指数|满分|打分|评分|得分|排名/],
 ['deterministic_fate',/注定|天生一对|天作之合|绝配|必然|必定|一定会|肯定会|保证|正缘|孽缘|克夫|克妻|旺夫|旺妻|婚期|离婚|分手|怀孕|生育|子女/],
 ['persona',/大师|师承|算命先生|命理师/]
]);
const ITEM_KEYS=['text','source','factRef'];

// Returns {ok:true,report} or {ok:false,errors:[code...]}; never throws on model content.
function validatePairReport(raw,facts,{forbiddenStrings=[]}={}){
 const errors=[],ids=factIds(facts);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {ok:false,errors:['not_object']};
 const expected=Object.keys(SECTION_LIMITS);
 if(Object.keys(raw).length!==expected.length||expected.some(k=>!Object.hasOwn(raw,k)))errors.push('section_keys');
 const report={};
 const texts=[];
 for(const section of expected){
  const list=raw[section],[min,max]=SECTION_LIMITS[section];
  if(!Array.isArray(list)){errors.push('section_type:'+section);continue;}
  let lo=min;if(section==='traditionalBasis'&&facts.traditional.length)lo=1;
  if(list.length<lo||list.length>max)errors.push('section_count:'+section);
  report[section]=list.map((item,index)=>{
   const where=section+'['+index+']';
   const keys=section==='complementPoints'?[...ITEM_KEYS,'howToVerify']:ITEM_KEYS;
   if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!keys.includes(k))){errors.push('item_shape:'+where);return null;}
   const text=typeof item.text==='string'?item.text.trim():'';
   if([...text].length<6||[...text].length>200)errors.push('text_length:'+where);
   if(!SOURCES.includes(item.source))errors.push('source:'+where);
   const ref=item.factRef===undefined||item.factRef===''?null:item.factRef;
   if(item.source==='待确认'){if(ref!==null&&!ids['待确认'].has(ref))errors.push('fact_ref:'+where);}
   else if(SOURCES.includes(item.source)&&(typeof ref!=='string'||!ids[item.source].has(ref)))errors.push('fact_ref:'+where);
   if(section==='traditionalBasis'&&item.source!=='传统文化线索')errors.push('source_section:'+where);
   if((section==='consensus'||section==='differences')&&item.source==='传统文化线索')errors.push('source_section:'+where);
   const out={text,source:item.source,factRef:ref};texts.push(text);
   if(section==='complementPoints'){
    const how=typeof item.howToVerify==='string'?item.howToVerify.trim():'';
    if([...how].length<6||[...how].length>160)errors.push('verify_length:'+where);
    out.howToVerify=how;texts.push(how);
   }
   return out;
  });
 }
 const all=texts.join('\n');
 for(const [code,re]of FORBIDDEN_PATTERNS)if(re.test(all))errors.push('forbidden:'+code);
 for(const s of forbiddenStrings)if(typeof s==='string'&&s.length>=2&&all.includes(s))errors.push('forbidden:private_data');
 return errors.length?{ok:false,errors:[...new Set(errors)]}:{ok:true,report};
}

// Strings that must never appear in output: both sides' pillar values and every questionnaire
// answer text (option labels and free text) of both sides, whether or not they were shared.
function collectForbiddenStrings({pair,questionnaires=[],questionBank=null}){
 const out=new Set();
 for(const uid of [pair.from,pair.to]){const pillars=pair.authorizations?.[String(uid)]?.chart?.pillars||{};for(const v of Object.values(pillars))if(typeof v==='string')out.add(v);}
 for(const q of questionnaires){
  if(!q?.answers)continue;
  for(const [id,answer]of Object.entries(q.answers)){
   const def=questionBank?.questions?.find(x=>x.id===id);
   const values=[answer?.selfAnswer,...(Array.isArray(answer?.acceptablePartnerAnswers)?answer.acceptablePartnerAnswers:[])].filter(v=>typeof v==='string');
   for(const v of values){const label=def?.options?.find(o=>o.value===v)?.label;if(label&&[...label].length>=4)out.add(label);else if(!def?.options&&[...v.trim()].length>=4)out.add(v.trim());}
  }
 }
 return [...out];
}

function createPairReportAdapter({generate,maxAttempts=2,maxTokens=4096}={}){
 const invoke=generate||((messages,opts)=>require('./llm').deepseekChat(messages,opts));
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error('双人报告重试次数配置无效');
 return {
  version:PAIR_REPORT_VERSION,
  async generate(facts,{forbiddenStrings=[]}={}){
   if(!facts||facts.version!==PAIR_REPORT_VERSION||!Array.isArray(facts.traditional))fail(500,'缺少服务端双人事实');
   const messages=buildPairMessages(facts);
   let lastErrors=[];
   for(let attempt=1;attempt<=maxAttempts;attempt++){
    let parsed;
    try{parsed=parsePairOutput(await invoke(messages,{maxTokens,temperature:0.4}));}
    catch(e){lastErrors=[e.code||'model_call_failed'];continue;}
    const checked=validatePairReport(parsed,facts,{forbiddenStrings});
    if(checked.ok)return {version:PAIR_REPORT_VERSION,detailLevel:facts.detailLevel,sections:checked.report,sourceLegend:SOURCES,disclaimer:DISCLAIMER,attempts:attempt};
    lastErrors=checked.errors;
   }
   throw Object.assign(Error('双人报告未通过结果校验'),{code:'validation_failed',validationErrors:lastErrors});
  }
 };
}

module.exports={createPairReportAdapter,buildPairFacts,buildPairMessages,parsePairOutput,validatePairReport,collectForbiddenStrings,PAIR_REPORT_VERSION,SOURCES,PURPOSES,STAGES,DISCLAIMER,FORBIDDEN_PATTERNS};
