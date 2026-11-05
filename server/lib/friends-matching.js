'use strict';
// Bilateral recommendation for 相生. Pure functions only: the service decides which values each side may see.
// Rules: (1) purposes must be compatible, (2) BOTH sides' 必须 expectations must hold, (3) rank by per-purpose weights.
// No score, hidden filter or hidden field is ever returned to the other person. Explanations use visible data only.
const fail=m=>{const e=Error(m);e.status=400;throw e;};

// Four meeting purposes. Keys are stored; labels are display text.
const PURPOSES=['buddy','friend','dating','serious'];
const PURPOSE_LABELS={buddy:'找搭子',friend:'交朋友·闺蜜',dating:'享受恋爱',serious:'认真结婚'};
// Legacy single-value intent (stored before 2026-11-06) → purpose key. Legacy profiles keep working without a rewrite.
const LEGACY_INTENT={'找搭子':'buddy','交朋友':'friend','找闺蜜':'friend','交朋友·闺蜜':'friend','Dating':'dating','约会':'dating','认真恋爱':'serious','认真结婚':'serious','认真婚恋':'serious','享受恋爱':'dating'};
// Platonic purposes may meet each other; romantic purposes only meet the same purpose (serious users do not get casual dating).
const BRIDGES=[['buddy','friend']];
const LEVELS=['must','prefer','any'];
const LEVEL_LABELS={must:'必须满足',prefer:'优先',any:'不介意'};
const EDUCATION_LEVELS=['高中及以下','大专','本科','硕士','博士'];
const HOUSE_OPTIONS=['有房','无房','暂不提供'],CAR_OPTIONS=['有车','无车','暂不提供'];
// Sensitive: can be filled, default private, used for anyone's private filter ONLY after the owner opts in (matchingConsent).
const SENSITIVE_FIELDS=['income','assets','familyAssets','house','car','hukou'];
// Non-sensitive matchable fields: usable if visible to the other person, or the owner opted in to hidden matching.
const PLAIN_MATCH_FIELDS=['age','height','education','school','occupation'];
const RANGE_KEYS=['age','height','income','assets','familyAssets'];
const MIN_KEYS=['education'];
const LIST_KEYS=['school','occupation','city','purpose','house','car','hukou'];
const TYPE_KEYS={dayMaster:'targetStems',zodiac:'targetZodiacs',constellation:'targetConstellations',mbti:'targetMbtis'};
const EXPECTATION_KEYS=[...RANGE_KEYS,...MIN_KEYS,...LIST_KEYS.filter(k=>!RANGE_KEYS.includes(k)),...Object.keys(TYPE_KEYS)];
const LABELS={age:'年龄',height:'身高',education:'学历',school:'学校',occupation:'职业',city:'城市',purpose:'认识目的',income:'年收入',assets:'个人净资产',familyAssets:'家庭资产',house:'本人房产',car:'车辆',hukou:'户籍',dayMaster:'日主',zodiac:'生肖',constellation:'星座',mbti:'MBTI'};

// Per-purpose ranking weights. prefer = my 优先 hits on them; mutual = their 优先 hits on me (internal only, never explained);
// hobby = shared hobbies (capped); element = five-element relation; samePurpose = exact same purpose; alignment = external
// questionnaire alignment in [0,1] (认真结婚 only, supplied by the questionnaire service).
const WEIGHTS={
  buddy:{prefer:3,mutual:1,hobby:2,hobbyCap:4,element:0.5,samePurpose:0.5,alignment:0},
  friend:{prefer:4,mutual:1.5,hobby:1,hobbyCap:3,element:1,samePurpose:0.5,alignment:0},
  dating:{prefer:5,mutual:2.5,hobby:1,hobbyCap:3,element:1.5,samePurpose:0.5,alignment:0},
  serious:{prefer:6,mutual:3,hobby:0.5,hobbyCap:3,element:1,samePurpose:0.5,alignment:6}
};

function purposesOf(p){
  if(Array.isArray(p?.purposes)){const valid=[...new Set(p.purposes.filter(k=>PURPOSES.includes(k)))];if(valid.length)return valid;}
  const legacy=LEGACY_INTENT[p?.intent];return legacy?[legacy]:['friend'];
}
// Accepts body.purposes (keys or labels, multi-select up to 4) or legacy body.intent. Returns {purposes,intent}.
function normalizePurposes(body={},prev){
  if(body.purposes!==undefined){
    if(!Array.isArray(body.purposes)||!body.purposes.length||body.purposes.length>PURPOSES.length)fail('请至少选择一个认识目的');
    const keys=body.purposes.map(x=>PURPOSES.includes(x)?x:LEGACY_INTENT[x]);
    if(keys.some(k=>!k))fail('认识目的选项无效');
    const purposes=PURPOSES.filter(k=>keys.includes(k)).sort((a,b)=>keys.indexOf(a)-keys.indexOf(b));
    // Keep a legacy intent string for old readers; prefer the caller's legacy value if it agrees with the primary purpose.
    const intent=LEGACY_INTENT[body.intent]===purposes[0]?body.intent:PURPOSE_LABELS[purposes[0]];
    return {purposes,intent};
  }
  if(body.intent!==undefined){if(!LEGACY_INTENT[body.intent])fail('请补全昵称、城市和认识目的');return {purposes:[LEGACY_INTENT[body.intent]],intent:body.intent};}
  if(prev)return {purposes:purposesOf(prev),intent:prev.intent||PURPOSE_LABELS[purposesOf(prev)[0]]};
  fail('请补全昵称、城市和认识目的');
}
// Which of the viewer's purposes can meet the other person. Empty => not compatible.
function compatiblePurposes(mine,theirs){return mine.filter(a=>theirs.some(b=>a===b||BRIDGES.some(pair=>pair.includes(a)&&pair.includes(b))));}

const str=(v,n=24)=>typeof v==='string'?v.trim().slice(0,n):'';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
function normalizeExpectations(input,prev={}){
  if(input===undefined)return structuredClone(prev||{});
  if(input===null)return {};
  if(typeof input!=='object'||Array.isArray(input))fail('期待格式无效');
  const out={};
  for(const [key,raw] of Object.entries(input)){
    if(!EXPECTATION_KEYS.includes(key))fail('期待项目无效');
    if(!raw||typeof raw!=='object'||!LEVELS.includes(raw.level))fail('请为每项期待选择 必须满足 / 优先 / 不介意');
    const e={level:raw.level};
    if(RANGE_KEYS.includes(key)){
      const min=raw.min===undefined||raw.min===''||raw.min===null?null:num(raw.min),max=raw.max===undefined||raw.max===''||raw.max===null?null:num(raw.max);
      if((raw.min!==undefined&&raw.min!==''&&raw.min!==null&&min===null)||(raw.max!==undefined&&raw.max!==''&&raw.max!==null&&max===null))fail(LABELS[key]+'期待需填写数字');
      if(min!==null&&max!==null&&min>max)fail(LABELS[key]+'期待的最小值不能大于最大值');
      if(key==='age'&&min!==null&&min<18)fail('只能认识成年人，年龄期待最小为18');
      if(min!==null)e.min=min;if(max!==null)e.max=max;
      if(e.level!=='any'&&e.min===undefined&&e.max===undefined)e.level='any';
    }else if(MIN_KEYS.includes(key)){
      if(raw.min!==undefined&&raw.min!==''&&!EDUCATION_LEVELS.includes(raw.min))fail('学历期待选项无效');
      if(raw.min)e.min=raw.min;else if(e.level!=='any')e.level='any';
    }else if(LIST_KEYS.includes(key)){
      const values=Array.isArray(raw.values)?raw.values:[];
      if(values.length>12)fail(LABELS[key]+'期待最多12项');
      let clean=[...new Set(values.map(v=>str(v,key==='purpose'?16:40)).filter(Boolean))];
      if(key==='purpose'){clean=clean.map(v=>PURPOSES.includes(v)?v:LEGACY_INTENT[v]);if(clean.some(v=>!v))fail('认识目的期待选项无效');clean=[...new Set(clean)];}
      if(key==='house'&&clean.some(v=>!HOUSE_OPTIONS.includes(v)))fail('房产期待选项无效');
      if(key==='car'&&clean.some(v=>!CAR_OPTIONS.includes(v)))fail('车辆期待选项无效');
      e.values=clean;if(e.level!=='any'&&!clean.length)e.level='any';
    }
    out[key]=e;
  }
  return out;
}
function normalizeMatchingConsent(input,prev={}){
  if(input===undefined)return {...(prev||{})};
  if(!input||typeof input!=='object'||Array.isArray(input))fail('资料用于匹配的授权格式无效');
  const out={};for(const k of [...SENSITIVE_FIELDS,...PLAIN_MATCH_FIELDS])out[k]=input[k]===true;return out;
}
// Profile view stored before purposes/expectations existed. Read-time migration only: never rewrites the store implicitly.
function migrateProfile(p){
  if(!p)return p;
  const out={...p,purposes:purposesOf(p)};
  if(!out.expectations||typeof out.expectations!=='object')out.expectations={};
  if(!out.matchingConsent||typeof out.matchingConsent!=='object')out.matchingConsent={};
  if(!out.intent)out.intent=PURPOSE_LABELS[out.purposes[0]];
  return out;
}

// Income/asset ranges (万元人民币). Stored as the tier string; matching uses the tier's lower bound.
// Asset slang: A7 = 7-digit yuan (100万–999万), A8 = 8-digit, A9 = 9-digit (亿级). Values are self-reported unless an admin approved a verification (see friends-verification.js).
const INCOME_TIERS=[['暂不提供',null],['10万以下',0],['10–30万',10],['30–50万',30],['50–100万',50],['100–300万',100],['300万以上',300]];
const ASSET_TIERS=[['暂不提供',null,''],['100万以下',0,''],['100–500万',100,'A7'],['500–1000万',500,'A7'],['1000–2000万',1000,'A8'],['2000万–1亿',2000,'A8'],['1亿以上',10000,'A9']];
const WEALTH_TIERS={income:INCOME_TIERS,assets:ASSET_TIERS,familyAssets:ASSET_TIERS};
const TIER_LOWER=new Map([...INCOME_TIERS,...ASSET_TIERS].map(([label,lower])=>[label,lower]));
const isWealthTier=(key,v)=>!!WEALTH_TIERS[key]?.some(([label])=>label===v);
// Display: "A8 · 1000–2000万"; legacy free text shown as-is. Verification status is never part of this label.
function wealthLabel(key,v){const s=String(v??'').trim();if(!s||s==='暂不提供')return s;const tier=WEALTH_TIERS[key]?.find(([label])=>label===s);return (tier?.[2]?tier[2]+' · ':'')+s;}
// Tiers → lower bound; legacy "A8.2" → 1000 (8-digit yuan); "20–50" → 20; "暂无收入或资产" → 0; "暂不提供"/'' → null (unknown).
function amount(v){if(typeof v!=='string'&&typeof v!=='number')return null;const s=String(v).trim();if(TIER_LOWER.has(s))return TIER_LOWER.get(s);if(!s||/暂不提供|不提供|保密/.test(s))return null;const slang=/^A(\d{1,2})(?:\.\d+)?$/i.exec(s);if(slang){const digits=Number(slang[1]);return digits>=5?10**(digits-1)/1e4:0;}if(/暂无|无收入|无资产/.test(s))return 0;const m=s.match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
function valueOf(key,values){
  if(key==='city')return values.city||null;
  if(key==='purpose')return values.purposes||null;
  if(TYPE_KEYS[key])return values.types?.[key]||null;
  const raw=values.fields?.[key];
  if(raw===undefined||raw===null||raw==='')return null;
  if(['age','height'].includes(key))return num(raw);
  if(['income','assets','familyAssets'].includes(key))return amount(raw);
  if(['house','car'].includes(key))return raw==='暂不提供'?null:raw;
  return String(raw);
}
// true / false / null(unknown). Unknown never satisfies 必须 and never counts as an 优先 hit.
function test(key,e,owner,values){
  if(TYPE_KEYS[key]){const targets=owner[TYPE_KEYS[key]];if(!Array.isArray(targets)||!targets.length||targets.includes('不限'))return undefined;const v=valueOf(key,values);return v===null?null:targets.includes(v);}
  const v=valueOf(key,values);if(v===null)return null;
  if(RANGE_KEYS.includes(key))return (e.min===undefined||v>=e.min)&&(e.max===undefined||v<=e.max);
  if(key==='education'){const a=EDUCATION_LEVELS.indexOf(v),b=EDUCATION_LEVELS.indexOf(e.min);return a<0?null:a>=b;}
  if(key==='purpose')return v.some(x=>e.values.includes(x));
  if(['school','occupation','hukou'].includes(key))return e.values.some(x=>v.includes(x));
  return e.values.includes(v);
}
// Which expectations are active for this owner. Type preferences reuse the existing target lists (default level 优先).
function activeExpectations(owner){
  const ex=owner.expectations||{},consent=owner.matchingConsent||{},out=[];
  for(const key of EXPECTATION_KEYS){
    let e=ex[key];
    if(TYPE_KEYS[key])e={level:ex[key]?.level||'prefer'};
    if(!e||e.level==='any')continue;
    // Reciprocity: filtering others on a sensitive field requires opting your own same field into matching.
    if(SENSITIVE_FIELDS.includes(key)&&consent[key]!==true)continue;
    out.push([key,e]);
  }
  return out;
}
// Evaluate owner's expectations against values the owner is allowed to use. Returns internal result (never sent to the other side).
function evaluate(owner,values){
  const result={passed:true,preferHits:[],mustHits:[]};
  for(const [key,e] of activeExpectations(owner)){
    const ok=test(key,e,owner,values);if(ok===undefined)continue;
    if(e.level==='must'){if(ok!==true)result.passed=false;else result.mustHits.push(key);}
    else if(ok===true)result.preferHits.push(key);
  }
  return result;
}

const STEM_LIST=[...'甲乙丙丁戊己庚辛壬癸'],ELEMENTS=[...'木火土金水'];
function elementRelation(own,other){
  const a=STEM_LIST.indexOf(own),b=STEM_LIST.indexOf(other);if(a<0||b<0)return null;
  const x=Math.floor(a/2),y=Math.floor(b/2);
  if((y+1)%5===x)return {kind:'generates_me',score:1,text:'传统五行里，'+ELEMENTS[y]+'生'+ELEMENTS[x]+'，可作为探索支持与回应的认识方向。'};
  if((x+1)%5===y)return {kind:'i_generate',score:0.75,text:'传统五行里，'+ELEMENTS[x]+'生'+ELEMENTS[y]+'，你也可以从主动支持对方开始建立连接。'};
  if(x===y)return {kind:'same',score:0.5,text:'你们的日主同属'+ELEMENTS[x]+'，可以从共同话题开始了解各自的不同。'};
  return {kind:'different',score:0,text:'你们的日主五行不同，可以先了解彼此的节奏与边界；单凭日主不能判断是否适合。'};
}

function rankScore({purpose,mine,theirs,interests,relation,samePurpose,alignment}){
  const w=WEIGHTS[purpose]||WEIGHTS.friend;
  return w.prefer*mine.preferHits.length+w.mutual*theirs.preferHits.length+w.hobby*Math.min(interests,w.hobbyCap)+w.element*(relation?.score||0)+w.samePurpose*(samePurpose?1:0)+w.alignment*(Number.isFinite(alignment)?Math.max(0,Math.min(1,alignment)):0);
}

// Adapter for friends-questionnaire pairAlignment().signals (present only when both users opted in).
// close dimension = 1, talk = 0, essential difference = -0.5; averaged over compared dimensions, clamped 0..1.
// null when nothing comparable. Used only as a hidden ranking signal for 认真结婚; never returned or explained.
function alignmentFromSignals(signals){const known=(Array.isArray(signals)?signals:[]).filter(d=>d&&(d.signal==='close'||d.signal==='talk'));if(!known.length)return null;const v=known.reduce((sum,d)=>sum+(d.signal==='close'?1:0)-(d.essentialDifference?0.5:0),0)/known.length;return Math.max(0,Math.min(1,v));}

// Ready-made options.alignmentScore for createFriendsService (wired in routes/friends.js). Serious purpose only; fails soft.
function questionnaireAlignmentScore({state,viewerId,candidateId,purpose}){if(purpose!=='serious'||!state)return null;try{return alignmentFromSignals(require('./friends-questionnaire').pairAlignment(state,viewerId,candidateId).signals);}catch{return null;}}

module.exports={alignmentFromSignals,questionnaireAlignmentScore,INCOME_TIERS,ASSET_TIERS,WEALTH_TIERS,isWealthTier,wealthLabel,PURPOSES,PURPOSE_LABELS,LEGACY_INTENT,LEVELS,LEVEL_LABELS,EDUCATION_LEVELS,HOUSE_OPTIONS,CAR_OPTIONS,SENSITIVE_FIELDS,PLAIN_MATCH_FIELDS,TYPE_KEYS,EXPECTATION_KEYS,LABELS,WEIGHTS,
  purposesOf,normalizePurposes,compatiblePurposes,normalizeExpectations,normalizeMatchingConsent,migrateProfile,amount,evaluate,elementRelation,rankScore};
