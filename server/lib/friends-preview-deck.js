'use strict';
// Guest preview deck for the 相生 onboarding (#hello). Unauthenticated: returns TEASER cards only.
// Allowlist projection: a field reaches a guest only if it is built below. Nickname, photo, voice, contact, school,
// income/assets/house/car/hukou, bio, shareId and exact age are never read into the output.
// Every listed, not-disabled adult profile whose 日主 scope is 'public' is eligible (owner decision 2026-11-06).
// Each response issues fresh random tokens (no stable id); a logged-in user can redeem a token once it is still valid.
const crypto=require('node:crypto');
const {isDisabled}=require('./friends-admin');
const M=require('./friends-matching');

const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],ELEMENTS=[...'木火土金水'];
const elementOf=stem=>{const i=STEMS.indexOf(stem);return i<0?'':ELEMENTS[Math.floor(i/2)];};
const MAX_CARDS=12,MIN_REAL=3,TOKEN_TTL=30*60*1000,MAX_TOKENS=5000;
// Same preset list as the profile editor. Free-text hobbies may carry identifying details, so guests only see presets.
const PRESET_HOBBIES=['羽毛球','乒乓球','网球','跑步','徒步','滑雪','游泳','保龄球','射箭','陶艺','烘焙','摄影','桌游','展览','看书','音乐','匹克球','电玩城','手工皮具','密室逃脱','剧本杀','KTV','古典舞','排练表演','午饭聊天','运动','健身','城市徒步'];
// Occupation → coarse category. Unmatched text is dropped (never echoed).
const JOB_CATEGORIES=[
  ['互联网/科技',/互联网|软件|程序|算法|工程师|开发|数据|产品|AI|人工智能|IT|技术/i],
  ['金融',/金融|银行|证券|投资|基金|保险|会计|审计|财务/],
  ['教育/科研',/教师|老师|教育|研究|科研|学者|讲师|博士后/],
  ['医疗健康',/医生|医师|护士|医疗|药|健康|康复/],
  ['设计/创意',/设计|插画|艺术|摄影|创意|编辑|媒体|内容|策划|建筑/],
  ['法律',/律师|法务|法律/],
  ['公共服务',/公务|事业单位|政府|国企/],
  ['学生',/学生|在读|研究生|本科生/],
  ['商业/管理',/销售|市场|运营|管理|经理|咨询|创业|老板|人力|HR/i]
];
function jobCategory(text){const s=String(text||'');for(const [label,re] of JOB_CATEGORIES)if(re.test(s))return label;return '';}
function ageBracket(age){const n=Number(age);if(!Number.isFinite(n)||n<18)return '';if(n<25)return '18-24';if(n>=50)return '50+';const lo=Math.floor(n/5)*5;return lo+'-'+(lo+4);}

// Clearly-labelled fictional samples (same three personas as the landing samples). Never requestable, never tokens.
const SAMPLE_LABEL='虚构示例，不可申请认识';
const SAMPLES=[
  {dayMaster:'戊',ageBracket:'25-29',city:'北京',jobCategory:'互联网/科技',hobbies:['展览','羽毛球'],purposeLabels:['享受甜甜的恋爱']},
  {dayMaster:'甲',ageBracket:'30-34',city:'上海',jobCategory:'互联网/科技',hobbies:['羽毛球','游泳'],purposeLabels:['找搭子']},
  {dayMaster:'癸',ageBracket:'25-29',city:'深圳',jobCategory:'设计/创意',hobbies:['徒步','音乐'],purposeLabels:['找搭子']}
].map(s=>({...s,element:elementOf(s.dayMaster),sample:true,label:SAMPLE_LABEL}));

const pub=(p,k)=>p.visibility?.[k]==='public';
function eligible(s,p){
  if(!p||p.listed!==true||isDisabled(s,p.userId))return false;
  if(!pub(p,'dayMaster')||!STEMS.includes(p.chart?.dayMaster))return false;
  const age=Number(p.chart?.age);if(!Number.isFinite(age)||age<18)return false;
  return true;
}
// The ONLY place a guest card is built. Add a field here only after checking the owner's scope for it.
function teaser(p){
  const card={dayMaster:p.chart.dayMaster,element:elementOf(p.chart.dayMaster),city:String(p.city||'').slice(0,12),purposeLabels:M.shownPurposes(p,false).map(k=>M.PURPOSE_LABELS[k])};
  if(pub(p,'age')){const b=ageBracket(p.chart.age);if(b)card.ageBracket=b;}
  if(pub(p,'zodiac')&&p.chart.zodiac)card.zodiac=p.chart.zodiac;
  if(pub(p,'mbti')&&p.mbti)card.mbti=p.mbti;
  if(pub(p,'constellation')&&p.constellation)card.constellation=p.constellation;
  if(pub(p,'occupation')){const c=jobCategory(p.fields?.occupation)||(pub(p,'industry')?jobCategory(p.fields?.industry):'');if(c)card.jobCategory=c;}
  const hobbies=(Array.isArray(p.hobbies)?p.hobbies:[]).filter(h=>PRESET_HOBBIES.includes(h)).slice(0,3);if(hobbies.length)card.hobbies=hobbies;
  return card;
}

function createPreviewDeck(store,{now=()=>Date.now(),random=()=>crypto.randomBytes(12).toString('base64url')}={}){
  const tokens=new Map();
  function sweep(){const t=now();for(const [k,v] of tokens)if(v.exp<=t)tokens.delete(k);while(tokens.size>MAX_TOKENS)tokens.delete(tokens.keys().next().value);}
  return {
    deck(q={}){
      const stem=STEMS.includes(q.stem)?q.stem:null,city=typeof q.city==='string'?q.city.trim().slice(0,20):'';
      // Guest purposes are optional (?purposes=buddy,dating). Unknown guest = treated as possibly dating, so married_buddy
      // cards are left out; a guest who says dating/serious never sees them, a married_buddy guest never sees daters.
      const said=String(q.purposes||'').split(',').map(x=>M.LEGACY_INTENT[x]||x).filter(k=>M.PURPOSES.includes(k)),viewer=said.length?said:['dating'];
      const s=store.read(),scored=[];
      for(const p of s.profiles||[]){
        if(!eligible(s,p)||M.purposesIsolated(viewer,M.purposesOf(p)))continue;
        const relation=stem?M.elementRelation(stem,p.chart.dayMaster):null;
        // 相生 first (生我 / 我生), then same element, then same city. Random tie-break: order is not a stable fingerprint.
        scored.push({p,score:(relation?.score||0)*10+(city&&p.city===city?1:0),tie:Math.random(),relation:relation?.kind||null});
      }
      scored.sort((a,b)=>b.score-a.score||a.tie-b.tie);
      sweep();
      const cards=scored.slice(0,MAX_CARDS).map(({p,relation})=>{const token=random();tokens.set(token,{userId:p.userId,exp:now()+TOKEN_TTL});return {...teaser(p),relation,token};});
      const samples=cards.length<MIN_REAL?SAMPLES.slice(0,MIN_REAL-cards.length).map(x=>({...x,relation:stem?M.elementRelation(stem,x.dayMaster)?.kind||null:null})):[];
      return {cards:[...cards,...samples],real:cards.length};
    },
    // Logged-in only (route enforces). Returns the owner's userId or null; caller still runs the normal visibility check.
    resolve(token){sweep();const row=typeof token==='string'?tokens.get(token):null;return row?row.userId:null;}
  };
}
module.exports={createPreviewDeck,teaser,eligible,ageBracket,jobCategory,SAMPLES,SAMPLE_LABEL,MAX_CARDS,PRESET_HOBBIES};
