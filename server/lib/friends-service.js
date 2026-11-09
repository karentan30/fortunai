'use strict';
const crypto=require('node:crypto');
const {STEMS,ZODIACS,bad,CROSS_BORDER_VERSION}=require('./friends-chart');
const {isDisabled,metric,normalize,normalizeAttribution}=require('./friends-admin');
const {recommend,typeSuggestions,normalizeTypes,normalizeAvailability,findCommonSlots}=require('./friends-preferences');
const M=require('./friends-matching');
const {isMember}=require('./friends-membership');
const {VERIFY_FIELDS}=require('./friends-verification');
const FIELDS=['age','height','weight','school','occupation','industry','title','income','assets','familyAssets','education','house','car','hukou'];
// Optional profile fields. Income/assets/family assets/house/car/hukou may be left empty ("收入资产允许不提供").
const OPTIONAL_FIELDS=['height','weight','school','occupation','industry','title','income','assets','familyAssets','education','house','car','hukou'];
const ENUM_FIELDS={education:M.EDUCATION_LEVELS,house:M.HOUSE_OPTIONS,car:M.CAR_OPTIONS};
const SCOPES=['public','connected','private'];
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const missing=()=>{const e=Error('卡片不存在或已停止公开');e.status=404;throw e;};
const denied=()=>{const e=Error('没有操作权限');e.status=403;throw e;};
const conflict=m=>{const e=Error(m);e.status=409;throw e;};
const {fullAttribution}=require('./friends-campus');
const array=(v,valid,max=12)=>Array.isArray(v)?[...new Set(v.filter(x=>valid.includes(x)))].slice(0,max):[];
const SP=require('./friends-serious'),SPT=require('./friends-serious-tags');
const questionnaireOf=(s,uid)=>(s.marriageQuestionnaires||[]).find(r=>r.userId!==undefined&&r.userId!==null&&String(r.userId)===String(uid))||null;
// Visibility rule shared by the 交友卡, matching, explanations and the 认真相亲页 (one definition, used everywhere).
const blockedPair=(s,a,b)=>s.blocks.some(x=>(x.by===a&&x.target===b)||(x.by===b&&x.target===a));
const connectedPair=(s,a,b)=>s.requests.some(r=>r.status==='accepted'&&((r.from===a&&r.to===b)||(r.to===a&&r.from===b)));
const profileOf=(s,uid)=>s.profiles.find(p=>p.userId===uid);
const activeFor=(s,p,viewer)=>p?.listed&&!isDisabled(s,p.userId)&&!blockedPair(s,p.userId,viewer);
const connectedFor=(s,p,viewer)=>!!profileOf(s,viewer)?.listed&&!isDisabled(s,viewer)&&connectedPair(s,p.userId,viewer);
const scopeAllows=(s,p,viewer)=>{const self=p.userId===viewer,connected=!self&&connectedFor(s,p,viewer);return scope=>self||scope==='public'||(connected&&scope==='connected');};
const viewDay=t=>new Date(t+8*3600000).toISOString().slice(0,10);
const INCOME_LOWER=new Map(M.INCOME_TIERS.filter(([,lower])=>lower!==null));
// 会员筛选: 学历(最低) / 收入区间(最低) / 有房 / 有车 / 已核验. Unknown values are rejected, never widened.
function memberFilters(q){
  const out=[],bad400=m=>{const e=Error(m);e.status=400;throw e;};
  if(q.edu){const min=M.EDUCATION_LEVELS.indexOf(q.edu);if(min<0)bad400('学历筛选无效');out.push(c=>M.EDUCATION_LEVELS.indexOf(c.fields?.education)>=min);}
  if(q.income){if(!INCOME_LOWER.has(q.income))bad400('收入筛选无效');const min=INCOME_LOWER.get(q.income);out.push(c=>INCOME_LOWER.has(c.fields?.income)&&INCOME_LOWER.get(c.fields.income)>=min);}
  if(q.house){if(q.house!=='有房')bad400('房产筛选无效');out.push(c=>c.fields?.house==='有房');}
  if(q.car){if(q.car!=='有车')bad400('车产筛选无效');out.push(c=>c.fields?.car==='有车');}
  if(q.verified){if(q.verified!=='1')bad400('已核验筛选无效');out.push(c=>!!c.verified&&Object.values(c.verified).some(Boolean));}
  return out;
}
function createFriendsService(store,charts,options={}) {
  const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
  const quotas=require('./friends-quotas').createFriendsQuotas(options);
  // 校园漏斗：事务提交成功后再发事件，回滚的操作不计数。
  const funnel=typeof options.funnel==='function'?options.funnel:()=>{};
  const tx=fn=>{const queue=[];const result=store.transaction(s=>fn(s,queue));for(const q of queue){try{funnel(...q);}catch(_){}}return result;};
  const blocked=blockedPair,connection=connectedPair,active=activeFor,isConnected=connectedFor;
  // Single visibility rule shared by projection, matching, explanations and the long page.
  const visibleTo=(s,p,viewer)=>{const allows=scopeAllows(s,p,viewer);return k=>allows(p.visibility?.[k]);};
  // Values the viewer's expectations may be tested against: visible fields, plus fields the owner opted into private matching.
  // Sensitive fields (income/assets/house/car/hukou) need the owner's opt-in even when public.
  function matchValues(s,p,viewer){
    const visible=visibleTo(s,p,viewer),consent=p.matchingConsent||{},fields={},types={};
    for(const k of M.PLAIN_MATCH_FIELDS)if(visible(k)||consent[k]===true)fields[k]=p.fields?.[k];
    for(const k of M.SENSITIVE_FIELDS)if(consent[k]===true)fields[k]=p.fields?.[k];
    for(const k of ['dayMaster','zodiac'])if(visible(k))types[k]=p.chart?.[k];
    for(const k of ['constellation','mbti'])if(visible(k)&&p[k])types[k]=p[k];
    return {city:p.city,purposes:M.purposesOf(p),fields,types};
  }
  function project(s,p,viewer) {
    if(!p || !active(s,p,viewer)) missing();
    const connected=isConnected(s,p,viewer),self=p.userId===viewer;
    const visible=visibleTo(s,p,viewer),purposes=M.purposesOf(p);
    const fields=Object.fromEntries(FIELDS.filter(visible).map(k=>[k,p.fields[k]]));
    const chart=Object.fromEntries(['dayMaster','zodiac'].filter(visible).map(k=>[k,p.chart[k]]));
    return {id:p.shareId,shareId:p.shareId,nickname:p.nickname,city:p.city,intent:p.intent||M.PURPOSE_LABELS[purposes[0]],purposes,purposeLabels:purposes.map(k=>M.PURPOSE_LABELS[k]),fields,chart,
      // 已核验 marks: only the owner and members receive this key at all. Non-members get no verified data in JSON.
      ...verifiedFor(s,p,viewer,self,visible),
      ...(visible('age')?{ageAsOf:p.chart.ageAsOf}:{}),...(visible('constellation')&&p.constellation?{constellation:p.constellation}:{}),...(visible('mbti')&&p.mbti?{mbti:p.mbti}:{}),...(self?{recommendations:profileRecommendations(p),targetConstellations:p.targetConstellations||[],targetMbtis:p.targetMbtis||[],expectations:structuredClone(p.expectations||{}),matchingConsent:{...(p.matchingConsent||{})}}: {}),...((self||connected)&&p.availability?{availability:structuredClone(p.availability)}:{}),hobbies:p.hobbies,targetStems:p.targetStems,targetZodiacs:p.targetZodiacs,bio:p.bio,connected};
  }
  // Only fields an admin approved (friends-verification.decide) and the viewer can see. Never derived from user input.
  function verifiedFor(s,p,viewer,self,visible){
    if(!self&&!isMember(s,viewer,clock()))return {};
    return {verified:Object.fromEntries(VERIFY_FIELDS.filter(k=>p.verified?.[k]===true&&visible(k)).map(k=>[k,true]))};
  }
  const profileRecommendations=p=>{const culture=recommend(p.chart),types=typeSuggestions(p);return {...culture,constellations:types.constellations,mbtis:types.mbtis,basis:{...culture.basis,...types.basis}};};
  const mine=(s,uid)=>s.profiles.find(p=>p.userId===uid);
  // Per-side explanation for viewer `self` looking at `p`. Uses only what p made visible to self, self's own data/expectations,
  // and p's public card. Never uses p's expectations, p's hidden fields or opted-in hidden values.
  function explain(s,self,p,card,mineEval){
    const visible=visibleTo(s,p,self.userId),forYou=[],forThem=[];
    const myPurposes=M.purposesOf(self),theirPurposes=M.purposesOf(p),same=myPurposes.filter(k=>theirPurposes.includes(k));
    if(same.length)forYou.push('认识目的相同：'+same.map(k=>M.PURPOSE_LABELS[k]).join('、'));
    const typeReason={dayMaster:'符合你选择的日主方向',zodiac:'符合你选择的生肖方向',constellation:'符合你选择的星座方向（自填）',mbti:'符合你选择的MBTI方向（自填）'};
    for(const key of [...mineEval.mustHits,...mineEval.preferHits]){
      if(M.TYPE_KEYS[key]){if(visible(key))forYou.push(typeReason[key]);continue;}
      if(['city','purpose'].includes(key)){forYou.push('TA的'+M.LABELS[key]+'符合你的期待');continue;}
      // A hit found through an opted-in hidden value is never explained.
      if(visible(key)&&card.fields?.[key]!==undefined)forYou.push('TA展示的'+M.LABELS[key]+'符合你的期待');
    }
    const interests=card.hobbies.filter(h=>self.hobbies.includes(h));
    for(const hobby of interests.slice(0,2))forYou.push('都喜欢'+hobby);
    const relation=card.chart.dayMaster&&self.chart?.dayMaster?M.elementRelation(self.chart.dayMaster,card.chart.dayMaster):null;
    // Why TA might want to meet you: only from TA's public card, and only about your data TA can actually see.
    const mineVisibleToThem=visibleTo(s,self,p.userId);
    const sharedForThem=theirPurposes.filter(k=>myPurposes.includes(k));
    if(sharedForThem.length)forThem.push('TA公开选择的认识目的里也有「'+sharedForThem.map(k=>M.PURPOSE_LABELS[k]).join('、')+'」');
    if(mineVisibleToThem('dayMaster')&&Array.isArray(p.targetStems)&&!p.targetStems.includes('不限')&&p.targetStems.includes(self.chart?.dayMaster))forThem.push('TA公开写了想认识'+self.chart.dayMaster+'日主，你的日主正是'+self.chart.dayMaster);
    if(mineVisibleToThem('zodiac')&&Array.isArray(p.targetZodiacs)&&!p.targetZodiacs.includes('不限')&&p.targetZodiacs.includes(self.chart?.zodiac))forThem.push('TA公开写了想认识属'+self.chart.zodiac+'的人，你正好属'+self.chart.zodiac);
    if(interests.length)forThem.push('你填写的'+interests.slice(0,2).join('、')+'也是TA写下的爱好，可以作为TA认识你的话题');
    const r=s.requests.filter(x=>((x.from===self.userId&&x.to===p.userId)||(x.to===self.userId&&x.from===p.userId))).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))[0];
    // Only an accepted request lets us say TA也想认识你. Matching someone's preferences is not consent.
    const status=r?.status==='accepted'&&isConnected(s,p,self.userId)?{state:'accepted',text:'TA也想认识你：你们已互相接受认识。'}:
      r?.status==='pending'&&r.from===p.userId?{state:'incoming',text:'TA向你发出了认识申请，等你决定是否接受。'}:
      r?.status==='pending'?{state:'outgoing',text:'你已发出申请，TA还没有回应。'}:
      {state:'none',text:'这只是推荐：TA还没有表示是否想认识你，要等TA自己回应。'};
    return {forYou,forThem,element:relation?relation.text:null,status,sharedPurposes:M.compatiblePurposes(myPurposes,theirPurposes).map(k=>M.PURPOSE_LABELS[k]),note:'推荐只依据双方可见资料与你自己的期待；不代表对方已同意，也不是关系结论或评分。'};
  }
  function seriousPayload(s,p,viewer){
    const self=p.userId===viewer;
    return SP.buildSeriousPage({row:SP.rowOf(s,p.userId),profile:p,self,allows:scopeAllows(s,p,viewer),fieldVisible:visibleTo(s,p,viewer),member:!self&&isMember(s,viewer,clock()),
      ownerRecord:questionnaireOf(s,p.userId),viewerRecord:self?null:questionnaireOf(s,viewer),viewerRow:self?null:SP.rowOf(s,viewer)});
  }
  const needMine=(s,uid)=>{const p=mine(s,uid);if(isDisabled(s,uid))denied();if(!p||!p.listed)bad('请先完善个人资料并公开你的卡片');return p;};
  return {
    me(uid){const p=mine(store.read(),uid);return p?structuredClone({...M.migrateProfile(p),verified:Object.fromEntries(VERIFY_FIELDS.filter(k=>p.verified?.[k]===true).map(k=>[k,true])),recommendations:profileRecommendations(p)}):null;},
    save(uid,b) {
      if(b.consent!==true)bad('请确认本人资料及展示权限');
      if(b.crossBorderConsent!==true)bad('请单独确认同意资料存储在香港服务器');
      return tx((s,queue)=>{
        normalize(s);
        const prev=mine(s,uid), chart=b.credential?charts.verify(b.credential):prev?.chart;
        const attributionMark=s.attributionMarks.find(x=>x.userId===uid),acquisition=attributionMark?fullAttribution(attributionMark):fullAttribution(prev?{}:b.attribution);
        if(!chart || chart.age<18)bad('请先生成日主卡');
        const nickname=text(b.nickname,24),city=text(b.city,24);
        if(!nickname||!city)bad('请补全昵称、城市和认识目的');
        const {purposes,intent}=M.normalizePurposes(b,prev);
        const fields={age:String(chart.age)};
        for(const k of FIELDS.slice(1)){fields[k]=text(b.fields?.[k],80);if(!fields[k]&&!OPTIONAL_FIELDS.includes(k))bad('请补齐个人资料');if(fields[k]&&ENUM_FIELDS[k]&&!ENUM_FIELDS[k].includes(fields[k]))bad('学历、房产或车辆选项无效');}
        // Income/assets: the UI offers only range tiers (M.WEALTH_TIERS). Older/legacy free text is still accepted and stays
        // readable as-is; matching reads tiers by lower bound and legacy text via M.amount().
        const expectations=M.normalizeExpectations(b.expectations,prev?.expectations),matchingConsent=M.normalizeMatchingConsent(b.matchingConsent,prev?.matchingConsent);
        const height=Number(fields.height),weight=Number(fields.weight);
        if((fields.height&&(!Number.isFinite(height)||height<80||height>250))||(fields.weight&&(!Number.isFinite(weight)||weight<25||weight>300)))bad('身高用厘米、体重用公斤，请检查数值');
        const visibility={};for(const k of [...FIELDS,'dayMaster','zodiac']) visibility[k]=SCOPES.includes(b.visibility?.[k])?b.visibility[k]:'private';
        const types=normalizeTypes(b,prev);
        for(const k of ['constellation','mbti'])visibility[k]=Object.hasOwn(b.visibility||{},k)?(SCOPES.includes(b.visibility[k])?b.visibility[k]:'private'):(prev?.visibility?.[k]||'private');
        const hobbies=Array.isArray(b.hobbies)?[...new Set(b.hobbies.map(x=>text(x,24)).filter(Boolean))].slice(0,10):[];
        const recommendations=profileRecommendations({chart,...types});
        const targetStems=array(b.targetStems?.length?b.targetStems:recommendations.stems,[...STEMS,'不限']);const targetZodiacs=array(b.targetZodiacs?.length?b.targetZodiacs:recommendations.zodiacs,[...ZODIACS,'不限']);
        if(!hobbies.length||!targetStems.length||!targetZodiacs.length)bad('请选择爱好及想认识的日主、生肖；也可选不限');
        const p={userId:uid,shareId:prev?.shareId||crypto.randomBytes(18).toString('hex'),nickname,city,intent,purposes,expectations,matchingConsent,fields,visibility,hobbies,targetStems,targetZodiacs,...types,
          bio:text(b.bio,240),contact:text(b.contact,120),contactConsent:b.contactConsent===true,listed:b.listed===true,posterShowTargets:Object.hasOwn(b,'posterShowTargets')?b.posterShowTargets!==false:prev?.posterShowTargets!==false,
          chart,recommendations,availability:Object.hasOwn(b,'availability')?normalizeAvailability(b.availability):(prev?.availability||null),residence:Object.hasOwn(b,'residence')?require('./friends-places').normalizeResidence(b.residence):(prev?.residence||null),policyVersion:b.policyVersion==='friends-2026-11-04-v1'?b.policyVersion:(prev?.policyVersion||'legacy-unversioned'),consentAt:new Date().toISOString(),crossBorderConsentVersion:CROSS_BORDER_VERSION,crossBorderConsentAt:prev?.crossBorderConsentVersion===CROSS_BORDER_VERSION&&prev.crossBorderConsentAt?prev.crossBorderConsentAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        // Keep admin-approved verification only while the verified value is unchanged; editing the value drops the mark.
        const keep=VERIFY_FIELDS.filter(k=>prev?.verified?.[k]===true&&prev.fields?.[k]===fields[k]);
        if(keep.length){p.verified=Object.fromEntries(keep.map(k=>[k,true]));p.verifiedAt=Object.fromEntries(keep.map(k=>[k,prev.verifiedAt?.[k]||null]));}
        if(keep.includes('marital')&&prev.verifiedDetail?.marital)p.verifiedDetail={marital:prev.verifiedDetail.marital}; // 婚况 result (admin-set), members-only via 认证条
        p.acquisition=acquisition;
        if(prev)s.profiles[s.profiles.indexOf(prev)]=p;else s.profiles.push(p);
        if(!attributionMark){s.attributionMarks.push({userId:uid,...acquisition,firstProfileAt:prev?.consentAt||new Date().toISOString()});if(!prev){metric(s,'first_profile_created',acquisition);queue.push(['xs_profile_done',uid,acquisition]);}}else{delete attributionMark.expiresAt;delete attributionMark.deletedAt;}
        if(prev)metric(s,'profile_updated',acquisition);
        return structuredClone(p);
      });
    },
    quota(uid){return quotas.status(store.read(),uid);},
    // 「谁看过我的卡片」: one row per (viewer, viewed, Beijing day). Only listed, non-disabled, non-blocked viewers; never self.
    recordView(uid,shareId){if(uid===undefined||uid===null||uid==='')return {recorded:false};return store.transaction(s=>{
      const viewer=mine(s,uid),target=s.profiles.find(p=>p.shareId===shareId);
      if(!viewer?.listed||isDisabled(s,uid)||!target||target.userId===uid||!active(s,target,uid))return {recorded:false};
      if(!Array.isArray(s.cardViews))s.cardViews=[];
      const day=viewDay(clock()),keep=viewDay(clock()-30*86400000);s.cardViews=s.cardViews.filter(v=>v.day>=keep);
      if(s.cardViews.some(v=>v.viewer===uid&&v.viewed===target.userId&&v.day===day))return {recorded:false,duplicate:true};
      s.cardViews.push({viewer:uid,viewed:target.userId,day});return {recorded:true};});},
    viewers(uid){const s=store.read(),self=needMine(s,uid),since=viewDay(clock()-6*86400000),latest=new Map();
      for(const v of s.cardViews||[])if(v.viewed===uid&&v.viewer!==uid&&v.day>=since&&(!latest.has(v.viewer)||latest.get(v.viewer)<v.day))latest.set(v.viewer,v.day);
      // Count and list use the same rule: viewer's card is still listed, not disabled, not blocked either way.
      const rows=[...latest].map(([id,day])=>({p:mine(s,id),day})).filter(x=>x.p&&active(s,x.p,self.userId)).sort((a,b)=>b.day.localeCompare(a.day));
      const member=isMember(s,uid,clock());
      return {days:7,count:rows.length,member,viewers:member?rows.slice(0,100).map(({p,day})=>{const c=project(s,p,uid);return {shareId:c.shareId,nickname:c.nickname,city:c.city,purposeLabels:c.purposeLabels,...(c.fields.age!==undefined?{age:c.fields.age}:{}),day};}):[]};},
    discover(uid,q={}){
      const filters=memberFilters(q);
      if(filters.length&&!isMember(store.read(),uid,clock())){const e=Error('学历、收入、房车和已核验筛选是会员功能');e.status=403;e.code='member_filter';throw e;}
      return store.transaction(s=>{
      const self=M.migrateProfile(needMine(s,uid)),myPurposes=M.purposesOf(self);
      const scored=[];
      for(const other of s.profiles){
        if(other.userId===uid||!active(s,other,uid))continue;
        const p=M.migrateProfile(other),theirPurposes=M.purposesOf(p);
        // 1) Purpose compatibility. 2) My 必须 on their usable values. 3) Their 必须 on my usable values (bilateral).
        const shared=M.compatiblePurposes(myPurposes,theirPurposes);if(!shared.length)continue;
        const mineEval=M.evaluate(self,matchValues(s,p,uid));if(!mineEval.passed)continue;
        const theirEval=M.evaluate(p,matchValues(s,self,p.userId));if(!theirEval.passed)continue;
        const card=project(s,p,uid);
        // Member filters read only the projected card (fields/verified already limited to what this viewer may see).
        if(filters.some(f=>!f(card)))continue;
        if((q.city&&card.city!==q.city)||(q.stem&&card.chart.dayMaster!==q.stem)||(q.zodiac&&card.chart.zodiac!==q.zodiac)||(q.constellation&&card.constellation!==q.constellation)||(q.mbti&&card.mbti!==q.mbti)||(q.purpose&&!theirPurposes.includes(q.purpose)))continue;
        const purpose=shared[0],interests=card.hobbies.filter(h=>self.hobbies.includes(h)).length,relation=M.elementRelation(self.chart?.dayMaster,card.chart.dayMaster);
        const samePurpose=myPurposes.some(k=>theirPurposes.includes(k));
        const alignment=purpose==='serious'&&typeof options.alignmentScore==='function'?options.alignmentScore({state:s,viewerId:uid,candidateId:p.userId,purpose}):null;
        const explanation=explain(s,self,p,card,mineEval);
        // [HOOK questionnaire-alignment] 默认关闭。传入 options.questionnaireReasons=require('./friends-questionnaire').discoverReasons 后，只追加双方互相开放方向的「在X方面想法接近/需要聊聊」，不改排序；后台排序信号见 friends-questionnaire.pairAlignment().signals。
        if(typeof options.questionnaireReasons==='function')for(const r of options.questionnaireReasons(s,uid,p.userId).slice(0,2))explanation.forYou.push(r);
        scored.push({card:{...card,reasons:explanation.forYou,explanation,rankingPurpose:purpose},score:M.rankScore({purpose,mine:mineEval,theirs:theirEval,interests,relation,samePurpose,alignment})});
      }
      // Score stays server-side: no per-person value or compatibility number is returned.
      const all=scored.sort((a,b)=>b.score-a.score).map(x=>x.card);
      const offset=Math.max(0,Math.min(10000,Number(q.offset)||0));
      const available=quotas.discover(s,uid,all);
      return {profiles:available.slice(offset,offset+24),total:available.length,nextOffset:offset+24<available.length?offset+24:null,quota:quotas.status(s,uid),rankingBasis:'先核对双方认识目的和双方的必须条件，再按你的优先条件、共同兴趣和可见日主关系排序；类型不代表关系结论，完整双方合盘需另行授权'};
    });},
    card(id,uid){const s=store.read(),target=s.profiles.find(p=>p.shareId===id),card=project(s,target,uid),viewer=uid&&mine(s,uid);
      // Explanations only (no must/pass state): opening a shared link must not reveal whether anyone's hidden filter passed.
      if(viewer?.listed&&target.userId!==uid&&!isDisabled(s,uid)){const self=M.migrateProfile(viewer),p=M.migrateProfile(target);card.explanation=explain(s,self,p,card,M.evaluate(self,matchValues(s,p,uid)));}
      // 「看TA的相亲资料」 link: only when TA picked 享受恋爱/认真结婚 and the page has something this viewer may see.
      if(SP.eligible(target)&&SP.rowOf(s,target.userId)&&SP.hasContent(seriousPayload(s,target,uid)))card.seriousPage=true;
      return card;},
    // ---- 认真相亲页 ----
    seriousOwn(uid){const s=store.read(),p=mine(s,uid);if(!p)return {eligible:false,hasProfile:false};
      const r=SP.rowOf(s,uid),row=r||SP.blankRow(uid);
      return {eligible:SP.eligible(p),hasProfile:true,shareId:p.shareId,listed:!!p.listed,
        page:{about:row.about,family:row.family,ideal:row.ideal,hobby:{...row.hobby},plans:[...row.plans],qtags:[...(row.qtags||[])],scopes:{...SP.DEFAULT_SCOPES,...row.scopes},photos:row.photos.map(x=>({id:x.id,w:x.w,h:x.h})),voice:row.voice?{id:row.voice.id,durationMs:row.voice.durationMs,...(row.voice.peaks?{peaks:row.voice.peaks}:{})}:null},
        // Owner-only: the tags they could tick, from their own current answers. Never sent to anyone else.
        availableTags:SPT.availableTags(questionnaireOf(s,uid)).map(({key,dimensionId,dimension,label})=>({key,dimensionId,dimension,label})),
        planTags:[...SP.PLAN_TAGS],preview:seriousPayload(s,p,uid)};},
    seriousSave(uid,body){return store.transaction(s=>{const p=mine(s,uid);if(!p)bad('请先保存交友卡');if(!SP.eligible(p))bad('认识目的选了「享受恋爱」或「认真结婚」，才能填写相亲资料');
      const list=SP.rows(s);let r=SP.rowOf(s,uid);const next=SP.normalizeSerious(body,r);
      // Only tags backed by the owner's own current answers can be ticked.
      const allowed=new Set(SPT.availableTags(questionnaireOf(s,uid)).map(t=>t.key));if(next.qtags.some(k=>!allowed.has(k)))bad('只能选择你自己问卷里的回答');
      if(!r){r=SP.blankRow(uid);list.push(r);}Object.assign(r,next,{updatedAt:new Date().toISOString()});return {ok:true};});},
    // Viewer must be logged in (route). Same 404 for missing / unlisted / blocked / not eligible: nothing leaks.
    seriousPage(shareId,uid){const s=store.read(),p=s.profiles.find(x=>x.shareId===shareId);
      if(!p||!(p.userId===uid||active(s,p,uid))||!SP.eligible(p))missing();
      return {shareId:p.shareId,nickname:p.nickname,city:p.city,purposeLabels:M.purposesOf(p).map(k=>M.PURPOSE_LABELS[k]),
        ...(visibleTo(s,p,uid)('age')?{age:p.fields?.age}:{}),...(visibleTo(s,p,uid)('dayMaster')?{dayMaster:p.chart?.dayMaster}:{}),
        own:p.userId===uid,connected:p.userId!==uid&&isConnected(s,p,uid),...seriousPayload(s,p,uid)};},
    // Returns true only if this exact media id is currently visible to the viewer on that page; route streams bytes after.
    seriousMedia(shareId,uid,mediaId){const s=store.read(),p=s.profiles.find(x=>x.shareId===shareId);
      if(!p||!(p.userId===uid||active(s,p,uid))||!SP.eligible(p))missing();
      const sec=seriousPayload(s,p,uid).sections;
      if(!(sec.photos||[]).some(x=>x.id===mediaId)&&sec.voice?.id!==mediaId)missing();
      return true;},
    request(uid,shareId){return tx((s,queue)=>{
      const self=needMine(s,uid),target=s.profiles.find(p=>p.shareId===shareId);
      if(!active(s,target,uid))missing();if(target.userId===uid)bad('不能向自己申请');
      const old=s.requests.find(r=>((r.from===uid&&r.to===target.userId)||(r.to===uid&&r.from===target.userId))&&['pending','accepted'].includes(r.status));
      if(old)conflict(old.status==='accepted'?'你们已经连接':'已有待处理申请');
      if(s.requests.some(r=>r.from===uid&&r.to===target.userId&&Date.now()-Date.parse(r.createdAt)<86400000))conflict('24小时内请勿重复申请');
      quotas.request(s,uid);
      const r={id:crypto.randomUUID(),from:self.userId,to:target.userId,status:'pending',createdAt:new Date().toISOString()};s.requests.push(r);metric(s,'request_created',self.acquisition);queue.push(['xs_request_sent',uid,self.acquisition||{}]);return {id:r.id,status:r.status,quota:quotas.status(s,uid)};
    });},
    requests(uid){const s=store.read();return s.requests.filter(r=>(r.from===uid||r.to===uid)&&!blocked(s,r.from,r.to)).map(r=>{
      const other=mine(s,r.from===uid?r.to:r.from),self=mine(s,uid);
      const person=other&&active(s,other,uid)?project(s,other,uid):{nickname:'对方暂不可见',shareId:null};
      const out={id:r.id,status:r.status,createdAt:r.createdAt,direction:r.to===uid?'incoming':'outgoing',person};
      if(r.status==='accepted'&&other?.listed&&self?.listed&&!isDisabled(s,uid)&&!isDisabled(s,other.userId)&&other.contactConsent&&self.contactConsent)out.contact=other.contact;
      return out;
    });},
    act(uid,id,action){return tx((s,queue)=>{
      const r=s.requests.find(x=>x.id===id);if(!r){missing();}if(r.from!==uid&&r.to!==uid)denied();
      if(blocked(s,r.from,r.to))denied();
      if(action==='disconnect'){
        if(r.status!=='accepted')conflict('只有已连接的双方可以解除连接');
        r.status='disconnected';r.updatedAt=new Date().toISOString();for(const pair of s.compatibilityPairs||[]){if([pair.from,pair.to].some(x=>String(x)===String(r.from))&&[pair.from,pair.to].some(x=>String(x)===String(r.to))){pair.status='revoked';pair.authorizations={};pair.messages=[];pair.revision=(pair.revision||0)+1;pair.updatedAt=r.updatedAt;}}return {id:r.id,status:r.status};
      }
      if(r.status!=='pending')conflict('申请已经处理');
      if(action==='withdraw'&&r.from===uid)r.status='withdrawn';
      else if(['accept','decline'].includes(action)&&r.to===uid){
        if(action==='accept'){needMine(s,r.from);needMine(s,r.to);}r.status=action==='accept'?'accepted':'declined';
      }else denied();
      metric(s,'request_'+r.status,mine(s,uid)?.acquisition);if(r.status==='accepted')for(const [a,b] of [[r.from,r.to],[r.to,r.from]])queue.push(['xs_mutual_accept',a,mine(s,a)?.acquisition||{},{pairWith:b}]);r.updatedAt=new Date().toISOString();return {id:r.id,status:r.status};
    });},
    block(uid,shareId){return store.transaction(s=>{const p=s.profiles.find(x=>x.shareId===shareId);if(!p)missing();if(p.userId===uid)bad('不能拉黑自己');if(!s.blocks.some(x=>x.by===uid&&x.target===p.userId))s.blocks.push({by:uid,target:p.userId});return {ok:true};});},
    report(uid,shareId,reason){return store.transaction(s=>{const p=s.profiles.find(x=>x.shareId===shareId);if(!p)missing();const why=text(reason,300);if(!why)bad('请填写举报原因');const prior=s.reports.find(r=>r.by===uid&&r.target===p.userId&&r.reason===why&&['open','reviewing'].includes(r.status||'open'));if(prior)return {ok:true,id:prior.id,status:prior.status||'open',message:'已收到相同举报，无需重复提交'};const report={id:crypto.randomUUID(),by:uid,target:p.userId,reason:why,status:'open',createdAt:new Date().toISOString()};s.reports.push(report);metric(s,'report_created');return {ok:true,id:report.id,status:'open',message:'举报已记录，试用期间由管理员人工处理'};});},
    commonSlots(uid,shareId,options){const s=store.read(),self=needMine(s,uid),other=s.profiles.find(p=>p.shareId===shareId);if(!active(s,other,uid))missing();if(!connection(s,uid,other.userId))denied();return {slots:findCommonSlots(self.availability,other.availability,options),note:'仅为候选时间，尚未预约；DST切换当日暂不推荐'};},
    reports(uid){return store.read().reports.filter(r=>r.by===uid).map(r=>({id:r.id,status:r.status||'open',createdAt:r.createdAt,updatedAt:r.updatedAt}));},
    feedback(uid,id,outcome){if(!['met','helpful','not_helpful','unsafe'].includes(outcome))bad('反馈选项无效');return tx((s,queue)=>{normalize(s);const r=s.requests.find(r=>r.id===id&&[r.from,r.to].includes(uid)&&['accepted','disconnected'].includes(r.status));if(!r)denied();if(s.feedback.some(x=>x.by===uid&&x.requestId===id))conflict('已提交反馈');s.feedback.push({by:uid,requestId:id,outcome,createdAt:new Date().toISOString()});metric(s,'feedback_'+outcome);if(outcome==='met')queue.push(['xs_met_reported',uid,mine(s,uid)?.acquisition||{},{pairWith:r.from===uid?r.to:r.from}]);return {ok:true};});},
    event(event,attribution){if(!['poster_export','share_visit','profile_preview','onboarding_view','chart_done','deck_swipe','want_to_meet_click','signup_done','mbti_quiz_done'].includes(event))bad('事件无效');return store.transaction(s=>{metric(s,event,attribution);return {ok:true};});},
    remove(uid){return store.transaction(s=>{normalize(s);if(s.profiles.some(p=>p.userId===uid)){const mark=s.attributionMarks.find(x=>x.userId===uid);if(mark){mark.deletedAt=new Date().toISOString();mark.expiresAt=new Date(Date.now()+90*86400000).toISOString();}}s.profiles=s.profiles.filter(p=>p.userId!==uid);if(Array.isArray(s.seriousPages))s.seriousPages=s.seriousPages.filter(r=>r.userId!==uid);s.requests=s.requests.filter(r=>r.from!==uid&&r.to!==uid);if(Array.isArray(s.cardViews))s.cardViews=s.cardViews.filter(v=>v.viewer!==uid&&v.viewed!==uid);s.compatibilityPairs=(s.compatibilityPairs||[]).filter(p=>String(p.from)!==String(uid)&&String(p.to)!==String(uid));/* Keep account-level blocks and moderation across profile recreation. */return {ok:true};});}
  };
}
module.exports={createFriendsService,FIELDS,OPTIONAL_FIELDS,scopeAllows,connectedFor,activeFor};
