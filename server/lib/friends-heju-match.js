'use strict';
// 相合局 · 纯函数：活动归一化、时间段、相合判断、分组、分桌。不读存储、不看时钟（时间由调用方传入），所以结果可复现、可测试。
const D=require('../../assets/js/friends-heju-data.js');
const G=require('../../assets/js/friends-match-guide-data.js');
const {findForbidden}=require('./friends-copy-guard');

const MIN_SIZE=3,MAX_SIZE=6;
const HOUR=3600000,BJ=8*HOUR;

// ---- 日主关系：天干五合 / 五行相生（两个方向都算）。同五行、相克都不算相合。 ----
const stemOf=s=>G.STEMS.find(x=>x.stem===s);
function relation(a,b){
  const x=stemOf(a);if(!x||!stemOf(b))return null;
  if(x.groups.he.includes(b))return 'he';
  if(x.groups.shengWo.includes(b)||x.groups.woSheng.includes(b))return 'sheng';
  return null;
}
const related=(a,b)=>relation(a,b)!==null;
const RELATION_WORDS={he:'你们的日主相合（天干五合）',sheng:'你们的日主五行相生',none:'你们的日主没有特别的相合，不影响一起做这件事',unknown:'还看不出你们的日主关系，不影响一起做这件事'};
const relationWords=(a,b)=>RELATION_WORDS[!a||!b?'unknown':relation(a,b)||'none'];

// ---- 活动归一化：去空格、转小写、去掉开头的打/玩/去、同义词合并。不安全的活动返回 null。 ----
const SYN=new Map();for(const [name,list] of Object.entries(D.SYNONYMS))for(const w of list)SYN.set(w.toLowerCase(),name);
function normalizeActivity(raw){
  if(typeof raw!=='string')return null;
  const shown=raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim();
  let k=shown.toLowerCase().replace(/\s+/g,'');
  k=k.replace(/^(?:一起)?(?:打|玩|去)+/,'');
  if(k.length<1||k.length>12)return null;
  if(D.UNSAFE_ACTIVITY.some(w=>k.includes(w)))return null;
  if(findForbidden(shown).length)return null;
  if(/[<>{}\\]/.test(k))return null;
  const name=SYN.get(k);
  return name?{key:name,label:name}:{key:k,label:shown.replace(/\s+/g,' ').replace(/^(?:一起)?(?:打|玩|去)+/,'')};
}

// ---- 地点文字：只要校区/片区，不要门牌；集合点不能像私人住所。 ----
const ADDRESS_RE=/\d+\s*(?:号|室|栋|幢|单元|弄|楼|层)|第?\d+\s*(?:栋|幢)/;
const PRIVATE_RE=/我家|你家|他家|她家|家里|宿舍|寝室|小区|公寓|酒店|民宿|旅馆|宾馆|房间|住处|出租屋|别墅/;
function cleanArea(raw){
  if(typeof raw!=='string')return null;
  const t=raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,30);
  if(!t||ADDRESS_RE.test(t)||PRIVATE_RE.test(t)||findForbidden(t).length)return null;
  return t;
}
function cleanSpot(raw){
  if(typeof raw!=='string')return null;
  const t=raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!t||PRIVATE_RE.test(t)||findForbidden(t).length)return null;
  return t;
}
const normArea=a=>String(a||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
// 片区一致：任一方没填，或一方包含另一方（「东校区」与「东校区操场」）。
function areaCompatible(a,b){const x=normArea(a),y=normArea(b);return !x||!y||x===y||x.includes(y)||y.includes(x);}
const normSchool=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase().replace(/^暂无$/,'');

// ---- 时间段（北京时间 UTC+8） ----
const WIN_DAY={mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0};
const PERIOD_HOUR=Object.fromEntries(D.PERIODS.map(([k,,h])=>[k,h]));
const validWindow=k=>D.WINDOWS.includes(k);
/** 某个时间段在 now 之后（至少隔 leadHours 小时）最近的一次，返回毫秒时间戳。 */
function nextOccurrence(windowKey,now,leadHours=48){
  if(!validWindow(windowKey))return null;
  const [d,p]=windowKey.split('-'),base=new Date(now+BJ);
  for(let i=0;i<=15;i++){
    const day=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()+i));
    if(day.getUTCDay()!==WIN_DAY[d])continue;
    const t=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),PERIOD_HOUR[p])-BJ;
    if(t>=now+leadHours*HOUR)return t;
  }
  return null;
}
/** 一个具体时间落在哪个时间段（北京时间）。 */
function windowOf(ms){
  const b=new Date(ms+BJ),day=Object.keys(WIN_DAY).find(k=>WIN_DAY[k]===b.getUTCDay()),h=b.getUTCHours();
  return day+'-'+(h<12?'am':h<17?'pm':'eve');
}
const commonWindows=lists=>lists.reduce((acc,l)=>acc.filter(w=>l.includes(w)),lists[0]||[]);
/** 候选时间段里 now 之后最早的一个。 */
function earliestWindow(keys,now,leadHours=48){
  let best=null;for(const k of [...keys].sort()){const t=nextOccurrence(k,now,leadHours);if(t!==null&&(!best||t<best.at))best={key:k,at:t};}
  return best;
}
const labelOfTime=ms=>{const b=new Date(ms+BJ),k=windowOf(ms),p=k.split('-')[1];const hh=String(b.getUTCHours()).padStart(2,'0'),mm=String(b.getUTCMinutes()).padStart(2,'0');return `${b.getUTCMonth()+1}月${b.getUTCDate()}日 ${D.windowLabel(k).slice(0,2)} ${hh}:${mm}`;};

// ---- 分组 ----
// entries: [{userId, activityKey, windows, dayMaster, createdAt, signupId}]；ok(a,b) 由调用方给（拉黑/底线题/硬条件/学校/片区）。
const order=(a,b)=>(a.createdAt<b.createdAt?-1:a.createdAt>b.createdAt?1:String(a.userId)<String(b.userId)?-1:String(a.userId)>String(b.userId)?1:0);
function build(seed,free,ok,max){
  const members=[seed];let wins=seed.windows.slice();
  const rest=free.filter(e=>e!==seed);
  const first=rest.filter(e=>related(seed.dayMaster,e.dayMaster)),later=rest.filter(e=>!related(seed.dayMaster,e.dayMaster));
  for(const c of [...first,...later]){
    if(members.length>=max)break;
    const w=commonWindows([wins,c.windows]);
    if(!w.length)continue;
    if(members.every(m=>ok(m,c))){members.push(c);wins=w;}
  }
  // 每个人都要有至少一位相合的同组人；没有的人先请出去，请到稳定为止。种子自己没有就放弃这个种子。
  for(;;){
    const lone=members.find(m=>!members.some(o=>o!==m&&related(m.dayMaster,o.dayMaster)));
    if(!lone)break;
    if(lone===seed)return null;
    members.splice(members.indexOf(lone),1);
  }
  if(members.length<MIN_SIZE)return null;
  return {members,windows:commonWindows(members.map(m=>m.windows))};
}
function formGroups(entries,{ok,max=MAX_SIZE}){
  const used=new Set(),out=[],keys=[...new Set(entries.map(e=>e.activityKey))].sort();
  for(const key of keys){
    const pool=entries.filter(e=>e.activityKey===key).sort(order);
    for(;;){
      const free=pool.filter(e=>!used.has(e));
      let made=null;
      for(const seed of free){made=build(seed,free,ok,max);if(made)break;}
      if(!made)break;
      for(const m of made.members)used.add(m);
      out.push({activityKey:key,members:made.members,windows:made.windows});
    }
  }
  return out;
}
/** 用户自己开的局里「让系统补人」：从候选里挑出能补上的人（不超过空位），都要和现有成员兼容，且至少和其中一人相合。 */
function fillCandidates(existing,candidates,{ok,slots}){
  const have=existing.slice(),picked=[];
  for(const c of [...candidates].sort(order)){
    if(picked.length>=slots)break;
    if(!have.every(m=>ok(m,c)))continue;
    if(!have.some(m=>related(m.dayMaster,c.dayMaster)))continue;
    picked.push(c);have.push(c);
  }
  return picked;
}
/** 俱乐部场次：把报名的人分成每桌 2–4 人，同桌尽量有相合的人；分不进去的放「自由入座」。返回 userId 分桌。 */
function suggestTables(people,{ok,size=4}){
  const left=[...people].sort(order),tables=[];
  while(left.length){
    const seed=left.shift(),t=[seed];
    for(const c of [...left]){
      if(t.length>=size)break;
      if(related(seed.dayMaster,c.dayMaster)&&t.every(m=>ok(m,c))){t.push(c);left.splice(left.indexOf(c),1);}
    }
    if(t.length<2){
      // 种子没有相合的人：尝试并入已有的桌子（要有人与他相合），否则自由入座
      const home=tables.find(x=>x.length<size&&x.some(m=>related(m.dayMaster,seed.dayMaster))&&x.every(m=>ok(m,seed)));
      if(home)home.push(seed);else tables.push([seed]);
      continue;
    }
    tables.push(t);
  }
  return tables.map(t=>({members:t,seated:t.length>=2}));
}

module.exports={MIN_SIZE,MAX_SIZE,relation,related,relationWords,RELATION_WORDS,normalizeActivity,cleanArea,cleanSpot,areaCompatible,normSchool,nextOccurrence,windowOf,validWindow,commonWindows,earliestWindow,labelOfTime,formGroups,fillCandidates,suggestTables};
