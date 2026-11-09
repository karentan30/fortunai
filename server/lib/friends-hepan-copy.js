'use strict';
// 合盘 v4 文案层：固定模板、DeepSeek 提示词与校验、干支泄露扫描。
// 分数与条目只来自规则引擎；模型只负责把条目写成人话。任何一步不合格都回到固定模板。
const E=require('./friends-hepan-v4');
const GANZHI=new Set([...E.STEMS,...E.BRANCHES]);
// 日常词里也会出现干支字（自己、孩子、未来……），扫描前先剥掉，免得误报。
const COMMON_WORDS=['搭子','自己','知己','己见','日子','孩子','子女','样子','一辈子','下辈子','例子','房子','圈子','性子','脑子','法子','点子','影子','面子','未来','未必','未曾','尚未','从未','并未','时辰','生辰','辛苦','艰辛','辛劳','申请','重申','中午','下午','上午','午饭','午后','午觉','丁点'];
const BANNED=['算命','破解','化解','开光','转运','择日','相亲社','保证','必定','必然','必分','不适合结婚','不合适','不配'];
// 建议只谈行为和活动，不谈颜色、方位、物件、择日。
const SOFT_BANNED=['风水','吉日','佩戴','摆放','方位','颜色','护身符','吉祥物','百分','%','％'];
const PILLAR_AREA={year:'家庭背景与成长环境',month:'做事节奏与社会层面',day:'两个人本身',hour:'生活习惯与长远打算'};
const pName=k=>E.PILLAR_LABEL[k]+'柱';
const EPIGRAPHS={great:{text:'二人同心，其利断金。',cite:'《周易·系辞上》'},fine:{text:'君子和而不同。',cite:'《论语·子路》'},grind:{text:'和实生物，同则不继。',cite:'《国语·郑语》'}};
const LEADS={great:'合处多，磨处少',fine:'合多于磨，用心就顺',grind:'差异不小，磨合出默契'};

function stripCommon(s){let out=String(s);for(const w of COMMON_WORDS)out=out.split(w).join('');return out;}
function ganzhiIn(s){return [...stripCommon(s)].filter(c=>GANZHI.has(c));}
// 深度扫描：返回所有含禁字的字段路径（键名也扫）。allow 里的路径前缀整段跳过（如本人四柱、对方日主）。
function leakScan(value,forbidden,{allow=[]}={}){
 const bad=new Set(forbidden),hits=[];
 const walk=(v,path)=>{
  if(allow.some(a=>path===a||path.startsWith(a+'.')))return;
  if(typeof v==='string'){const found=ganzhiIn(v).filter(c=>bad.has(c));if(found.length)hits.push({path,chars:[...new Set(found)]});return;}
  if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+'.'+i));return;}
  if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){const kp=path?path+'.'+k:k;if(ganzhiIn(k).some(c=>bad.has(c)))hits.push({path:kp,chars:['(key)']});walk(x,kp);}
 };
 walk(value,'');
 return hits;
}
// 对方四柱里除日主以外的字，就是本视角下的禁字。
// 本人日主也放行：它本来就在本人四柱里展示，出现在文案里不透露对方任何信息。
function forbiddenFor(otherPillars,{alsoAllow=[]}={}){const out=new Set();for(const k of E.PILLARS){const p=E.split(otherPillars?.[k]);if(!p)continue;if(k!=='day')out.add(p.stem);out.add(p.branch);}const dm=E.split(otherPillars?.day)?.stem;out.delete(dm);for(const c of alsoAllow)out.delete(c);return [...out];}

// —— 固定模板 ——（模板本身不含任何干支字，测试会扫）
const AREA_ADVICE={
 year:['聊聊各自家里的相处方式，先理解，再比较。','和双方家人来往时，提前商量好分寸和频率。','节假日怎么安排，提早一起定，别临时拉扯。'],
 month:['一起做事前先对齐时间和分工。','接受彼此节奏不同，约一个两人都能接受的截止点。','忙的时候说一声，让对方知道不是被冷落。'],
 day:['有分歧时先复述一遍对方的意思，确认听懂了再回应。','每周留一段固定的两人时间，做一件都喜欢的事。','把感谢说出口，让对方知道自己的付出被看见。'],
 hour:['把作息、花钱这些日常习惯摊开聊一次。','长远打算分阶段讨论，不必一次说定。','给彼此留一点独处时间，不把它当成疏远。']
};
const WX_ADVICE={木:'一起定一个小目标，比如每月读一本书或学一项新技能。',火:'多把喜欢和感谢说出口，安排一些有仪式感的小约会。',土:'把说好的事写下来，过一阵一起回头看完成了多少。',金:'需要做决定时设一个期限，到点就定下来。',水:'每周固定一次不看手机的聊天时间。'};
function dirWho(dir){return dir==='AB'?['{A}','{B}']:['{B}','{A}'];}
function template(h,kind){
 const P=h.pillar?pName(h.pillar):'',area=h.pillar?PILLAR_AREA[h.pillar]:'';
 if(h.id==='wx_bu')return {title:'五行互补',meaning:'一方缺的五行，另一方正好比较旺（'+h.elements.join('、')+'），传统上看作能补足彼此。',life:'对方身上常有你欠缺的那股劲，相处久了会互相带动。'};
 if(h.id==='wx_que')return {title:'五行同缺',meaning:'你们俩都缺'+h.elements.join('、')+'，传统上看作两人在同一方面都偏弱，没人补位。',life:'遇到需要这股劲的事情时，两个人可能都想往后退。',advice:[...h.elements.map(e=>WX_ADVICE[e]),'遇到这类事情时，约好由谁先迈出第一步。'].slice(0,3)};
 if(h.pillar==='day'&&h.part==='branch'){
  const m={
   六合:{title:'配偶宫六合',meaning:'日支是配偶宫，代表两个人最贴身的相处。你们的配偶宫构成六合，是合婚里最看重的一种相合。',life:'日常里往往不用多解释就能接住对方的情绪，待在一起会觉得自在。'},
   三合:{title:'配偶宫半三合',meaning:'配偶宫两支同属一个三合局，传统上看作方向一致、能互相借力。',life:'一起定目标、做计划时比较容易想到一块去。'},
   冲:{title:'配偶宫相冲',meaning:'日支是配偶宫，你们的配偶宫相冲，传统上看作亲密相处里节奏和习惯差异较大。',life:'可能一个想多说、一个想安静；一个想马上处理，一个想缓一缓。',advice:['吵起来时先约定暂停二十分钟，各自冷静后再谈，不在气头上做决定。','每周留一段固定的两人时间，做一件都喜欢的事，比如散步或一起做饭。','把各自的生活习惯摊开说清楚，家务分工写下来，少一些默认带来的摩擦。']},
   刑:{title:'配偶宫相刑',meaning:'配偶宫相刑，传统上看作容易在细节上互相较真。',life:'小事上容易说重话，或者都觉得自己更委屈。',advice:['说感受而不是下结论：用「我觉得……」代替「你总是……」。','有分歧时先复述一遍对方的意思，确认听懂了再回应。','约一个「暂停暗号」，任何一方说出来就先停下。']},
   害:{title:'配偶宫相害',meaning:'配偶宫相害，传统上看作容易有误会，心里的话没说出口。',life:'一方以为对方懂了，另一方其实没接收到。',advice:['重要的事当面说清楚，不靠暗示。','每周一次十分钟的近况交流，聊聊最近在意的事。']}
  };return m[h.type];
 }
 if(h.pillar==='day'&&h.part==='stem'){
  const [x,y]=dirWho(h.dir);
  const m={
   合:{title:'日主相合',meaning:'两人的日主（各自的本命天干）构成天干五合，传统上看作彼此吸引、容易靠近。',life:'初见就容易有好感，相处时愿意为对方让一步。'},
   生:{title:'日主相生',meaning:x+'的日主五行生扶'+y+'的日主，传统上看作一方愿意滋养、托举另一方。',life:'一个人常常是另一个人的后盾，遇事愿意先替对方想。'},
   同:{title:'日主同气',meaning:'两人日主五行相同，传统上看作气质相近、像同类人。',life:'价值观和节奏比较接近，聊天不费劲。'},
   克:{title:'日主相克',meaning:x+'的日主五行克'+y+'的日主，传统上看作一方更强势、另一方容易感到压力。',life:'做决定时一个人容易拍板，另一个人可能觉得没被问到。',advice:['大事轮流主导，或者先各自说想法再一起定。','更强势的一方多问一句「你怎么看」，慢一点下结论。','把感谢说出口，让对方知道自己的付出被看见。']}
  };return m[h.type];
 }
 const word=h.part==='stem'?'天干':'地支',typeWord={合:'相合',生:'相生',同:'同气',克:'相克',六合:'六合',三合:'半三合',冲:'相冲',刑:'相刑',害:'相害'}[h.type];
 if(kind==='he')return {title:P+word+typeWord,meaning:P+'代表'+area+'。这一柱'+word+typeWord+'，传统上看作在这一面容易互相欣赏、互相成全。',life:'在'+area+'这类话题上，你们比较容易聊到一起。'};
 return {title:P+word+typeWord,meaning:P+'代表'+area+'。这一柱'+word+typeWord+'，传统上看作在这一面两人的习惯差异较大。',life:'涉及'+area+'的事情，可能需要多一点耐心和解释。',advice:AREA_ADVICE[h.pillar].slice(0,h.type==='冲'?3:2)};
}
function starText(analysis){
 const s=analysis.stars,mode=analysis.starMode;
 const one=(side,other)=>{const st=s[side],who='{'+side+'}',them='{'+other+'}';
  if(mode==='spouse')return {title:who+'的'+st.label+'（'+st.kind+'）属'+st.elements[0],text:(st.partnerIs==='star'?them+'的日主正好属'+st.elements[0]+'，传统上看作对方就是'+who+'命里那颗'+st.label+'。':them+'的日主不是'+st.elements[0]+'，'+st.label+'要从别处看。')+(st.present?who+'自己的盘里有'+st.label+'。':who+'自己的盘里'+st.label+'不显，感情上更需要主动经营。')};
  return {title:who+'的相处星（印星、比劫）',text:(st.partnerIs==='yin'?them+'的日主是'+who+'的印星，传统上看作对方能给'+who+'支持和照顾。':st.partnerIs==='bi'?them+'的日主是'+who+'的比劫，传统上看作像同伴、能并肩。':them+'的日主不在'+who+'的相处星上，关系靠一起做事慢慢建立。')+(st.present?'':who+'自己的盘里相处星不显，可以多主动约对方。')};
 };
 return {mode,heading:mode==='spouse'?'夫妻星':'相处星',A:one('A','B'),B:one('B','A')};
}
function templateProse(analysis,picked){
 const it={};
 for(const h of picked.he)it[h.id]=template(h,'he');
 for(const h of picked.mohe)it[h.id]=template(h,'mohe');
 const noun=analysis.purpose==='buddy'?'搭子':'一对';
 const top=picked.he[0]?it[picked.he[0].id].title:null,low=picked.mohe[0]?it[picked.mohe[0].id].title:null;
 const summary='按传统合婚规则，你们属于「'+analysis.tierLabel+'」的'+noun+'。'+(top?'最大的亮点是'+top+'。':'')+(low?'需要多用心的是'+low+'，后面写了具体怎么做。':'没有明显需要磨合的地方。');
 return {source:'template',summary,lead:LEADS[analysis.tier],items:it};
}

// —— DeepSeek ——
// 邀请合盘只发双方日主 + 每一柱关系名称 + 五行互补/同缺；自己合盘才发完整干支。从不发生日、姓名、手机号。
function promptFacts(analysis,picked,{mode,charts}){
 const facts={mode,purpose:analysis.purpose,tier:analysis.tierLabel,total:analysis.total,limited:analysis.limited,dayMasters:analysis.dayMasters,
  pillars:analysis.relations.map(r=>({pillar:pName(r.pillar),stem:r.stem.type+(r.stem.dir?('('+(r.stem.dir==='AB'?'A→B':'B→A')+')'):''),branch:r.branch.type})),
  wuxing:analysis.wuxing,starMode:analysis.starMode,
  items:[...picked.he.map(h=>({id:h.id,kind:'合',title:template(h,'he').title})),...picked.mohe.map(h=>({id:h.id,kind:'磨合',title:template(h,'mohe').title}))]};
 if(mode==='self'&&charts)facts.charts={A:charts.A.pillars,B:charts.B.pillars};
 return facts;
}
function buildMessages(facts){
 const strict=facts.mode!=='self';
 const sys=['你是熟悉传统合婚规则的相处顾问，只把已经算好的规则命中写成通俗的解释和生活化建议。',
  '分数和条目已经由规则算好，不要改动、不要新增条目、不要给出任何百分比或概率。',
  '用 {A} 和 {B} 指代两个人，不要使用真实称呼。',
  strict?'除了两人的日主（'+facts.dayMasters.A+'、'+facts.dayMasters.B+'）以外，不得写出任何天干地支字；描述柱的关系时只用「年柱/月柱/日柱/时柱」「相合/相冲」等词。':'可以引用双方的干支。',
  '每个「磨合」条目给 2-3 条相处建议，只写行为和一起做的活动（沟通方式、时间安排、分工等），不要涉及颜色、方位、物件、择日或任何改运手段。',
  '不预测关系结果，不说两人适不适合在一起。禁用词：'+BANNED.join('、')+'。',
  '只输出 JSON：{"summary":"60-120字总评","items":{"条目id":{"meaning":"传统含义，40-90字","life":"放到日常里是什么样，20-60字","advice":["仅磨合条目需要，2-3条"]}}}'].join('\n');
 return [{role:'system',content:sys},{role:'user',content:JSON.stringify(facts)}];
}
function parseOutput(raw){const s=String(raw||'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Object.assign(Error('no json'),{code:'parse_failed'});return JSON.parse(s.slice(a,b+1));}
function textProblems(s,{allowed}){
 const out=[];if(typeof s!=='string'||!s.trim())return ['empty'];
 for(const w of [...BANNED,...SOFT_BANNED])if(s.includes(w))out.push('banned:'+w);
 if(allowed){const extra=ganzhiIn(s.replaceAll('{A}','').replaceAll('{B}','')).filter(c=>!allowed.has(c));if(extra.length)out.push('ganzhi:'+[...new Set(extra)].join(''));}
 if(/\{(?![AB]\})/.test(s))out.push('placeholder');
 return out;
}
// 校验通过返回 {ok:true,prose}；否则列出问题。邀请合盘只允许出现两人日主这两个干支字。
function validateProse(parsed,analysis,picked,{mode}){
 const allowed=mode==='self'?null:new Set([analysis.dayMasters.A,analysis.dayMasters.B]),errors=[],items={};
 const len=(s,lo,hi)=>typeof s==='string'&&[...s].length>=lo&&[...s].length<=hi;
 if(!len(parsed?.summary,20,200))errors.push('summary_length');else errors.push(...textProblems(parsed.summary,{allowed}));
 for(const [kind,list] of [['he',picked.he],['mohe',picked.mohe]])for(const h of list){
  const x=parsed?.items?.[h.id];if(!x){errors.push('missing:'+h.id);continue;}
  if(!len(x.meaning,10,160)||!len(x.life,8,120))errors.push('length:'+h.id);
  errors.push(...textProblems(x.meaning,{allowed}),...textProblems(x.life,{allowed}));
  let advice;
  if(kind==='mohe'){advice=x.advice;if(!Array.isArray(advice)||advice.length<2||advice.length>3||!advice.every(a=>len(a,6,80)))errors.push('advice:'+h.id);else for(const a of advice)errors.push(...textProblems(a,{allowed}));}
  items[h.id]={meaning:x.meaning,life:x.life,...(kind==='mohe'?{advice}:{})};
 }
 return errors.length?{ok:false,errors}:{ok:true,prose:{summary:parsed.summary,items}};
}
// 生成 + 重试一次 + 回落模板。返回的 items 永远带模板标题（标题是确定性的）。
async function writeProse(analysis,picked,{mode,generate,charts,maxAttempts=2}){
 const base=templateProse(analysis,picked);
 if(typeof generate!=='function')return base;
 const messages=buildMessages(promptFacts(analysis,picked,{mode,charts}));let errors=[];
 for(let i=1;i<=maxAttempts;i++){
  let parsed;try{parsed=parseOutput(await generate(messages,{maxTokens:2048,temperature:0.4}));}catch(e){errors=[e.code||'model_call_failed'];continue;}
  const checked=validateProse(parsed,analysis,picked,{mode});
  if(checked.ok){const items={};for(const id of Object.keys(base.items))items[id]={...base.items[id],...checked.prose.items[id]};return {source:'ai',attempts:i,summary:checked.prose.summary,lead:base.lead,items};}
  errors=checked.errors;
 }
 return {...base,fallbackReason:errors.slice(0,5)};
}
// 把 {A}/{B} 换成当前视角的称呼。
function fill(value,names){
 if(typeof value==='string')return value.replaceAll('{A}',names.A).replaceAll('{B}',names.B);
 if(Array.isArray(value))return value.map(v=>fill(v,names));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fill(v,names)]));
 return value;
}
module.exports={leakScan,forbiddenFor,ganzhiIn,template,templateProse,starText,promptFacts,buildMessages,parseOutput,validateProse,writeProse,fill,BANNED,SOFT_BANNED,COMMON_WORDS,EPIGRAPHS,LEADS,PILLAR_AREA};
