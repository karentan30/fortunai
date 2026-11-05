'use strict';
// 打卡图鉴：每位用户「真正认识过」的人的类型合集（10 日主 / 16 MBTI / 12 星座 / 12 生肖）。
// Privacy: only the owner reads their own collection (route uses req.user.id, no parameter). A connection's attribute
// counts only when the owner of that attribute lets this viewer see it (same scope rule as the 交友卡).
const {STEMS,ZODIACS}=require('./friends-chart');
const {CONSTELLATIONS,MBTIS}=require('./friends-preferences');
const {isDisabled}=require('./friends-admin');
const {scopeAllows,connectedFor,activeFor}=require('./friends-service');

const STEM_ELEMENT={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const ELEMENT_KEY={木:'wood',火:'fire',土:'earth',金:'metal',水:'water'};
const CATEGORIES=Object.freeze([
  {key:'dayMaster',label:'日主',values:STEMS,name:v=>v+STEM_ELEMENT[v],read:p=>p.chart?.dayMaster},
  {key:'mbti',label:'MBTI',values:MBTIS,name:v=>v,read:p=>p.mbti},
  {key:'constellation',label:'星座',values:CONSTELLATIONS,name:v=>v,read:p=>p.constellation},
  {key:'zodiac',label:'生肖',values:ZODIACS,name:v=>'属'+v,read:p=>p.chart?.zodiac},
]);

// THE counting rule — the only place that decides whether someone counts as「认识了」.
// Today: both sides accepted the request (connectedFor), the person is still listed, not blocked either way,
// not disabled, and their profile still exists. To require a 15-minute voice call later, add that check here only.
function countsAsKnown(s,viewer,p){
  if(!p||p.userId===viewer)return false;
  return !!activeFor(s,p,viewer)&&connectedFor(s,p,viewer);
}
const knownPeople=(s,viewer)=>(s.profiles||[]).filter(p=>countsAsKnown(s,viewer,p));

// Value of one attribute of `p` as the viewer is allowed to see it; null when hidden or not filled in.
function visibleValue(s,p,viewer,category){
  if(!scopeAllows(s,p,viewer)(p.visibility?.[category.key]))return null;
  const v=category.read(p);
  return category.values.includes(v)?v:null;
}

function headline(cat){
  const total=cat.values.length,lit=cat.litCount,missing=cat.cells.filter(c=>!c.lit).map(c=>c.name);
  if(!lit)return `${total} 种${cat.label}，等我一个个认识`;
  if(lit===total)return `${total} 种${cat.label}，我都认识了`;
  return `我已经认识了 ${lit} 种${cat.label}，还差${missing.length<=3?missing.join('、'):` ${missing.length} 种`}`;
}

function collectionFor(s,uid){
  const me=(s.profiles||[]).find(p=>p.userId===uid);
  const active=!!me?.listed&&!isDisabled(s,uid);
  const people=active?knownPeople(s,uid):[];
  const categories=CATEGORIES.map(category=>{
    const byValue=new Map(category.values.map(v=>[v,[]]));
    for(const p of people){const v=visibleValue(s,p,uid,category);if(v)byValue.get(v).push(p.nickname);}
    const cells=category.values.map(v=>{
      const names=byValue.get(v);
      return {value:v,name:category.name(v),...(category.key==='dayMaster'?{element:ELEMENT_KEY[STEM_ELEMENT[v]]}:{}),lit:names.length>0,count:names.length,people:names};
    });
    const cat={key:category.key,label:category.label,total:category.values.length,litCount:cells.filter(c=>c.lit).length,cells,values:category.values};
    cat.headline=headline(cat);delete cat.values;
    return cat;
  });
  const stem=me?.chart?.dayMaster;
  return {
    hasProfile:!!me,listed:active,knownCount:people.length,
    owner:me?{nickname:me.nickname,dayMaster:STEMS.includes(stem)?stem:null,dayMasterName:STEMS.includes(stem)?stem+STEM_ELEMENT[stem]:null,element:ELEMENT_KEY[STEM_ELEMENT[stem]]||null}:null,
    categories,
  };
}

// Share-image payload: types and counts only. No other person's name, photo or id ever leaves through here.
function shareSummary(c){
  return {owner:c.owner?{nickname:c.owner.nickname,dayMaster:c.owner.dayMaster,dayMasterName:c.owner.dayMasterName,element:c.owner.element}:null,knownCount:c.knownCount,
    categories:c.categories.map(cat=>({key:cat.key,label:cat.label,total:cat.total,litCount:cat.litCount,headline:cat.headline,cells:cat.cells.map(x=>({value:x.value,name:x.name,element:x.element,lit:x.lit}))}))};
}

module.exports={CATEGORIES,countsAsKnown,knownPeople,visibleValue,collectionFor,shareSummary,headline};
