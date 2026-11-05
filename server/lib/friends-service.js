'use strict';
const crypto=require('node:crypto');
const {STEMS,ZODIACS,bad}=require('./friends-chart');
const {isDisabled,metric,normalize,normalizeAttribution}=require('./friends-admin');
const {recommend,typeSuggestions,normalizeTypes,normalizeAvailability,findCommonSlots}=require('./friends-preferences');
const M=require('./friends-matching');
const FIELDS=['age','height','weight','school','occupation','industry','title','income','assets','familyAssets','education','house','car','hukou'];
// Optional profile fields. Income/assets/family assets/house/car/hukou may be left empty ("收入资产允许不提供").
const OPTIONAL_FIELDS=['industry','title','income','assets','familyAssets','education','house','car','hukou'];
const ENUM_FIELDS={education:M.EDUCATION_LEVELS,house:M.HOUSE_OPTIONS,car:M.CAR_OPTIONS};
const SCOPES=['public','connected','private'];
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const missing=()=>{const e=Error('卡片不存在或已停止公开');e.status=404;throw e;};
const denied=()=>{const e=Error('没有操作权限');e.status=403;throw e;};
const conflict=m=>{const e=Error(m);e.status=409;throw e;};
const {fullAttribution}=require('./friends-campus');
const array=(v,valid,max=12)=>Array.isArray(v)?[...new Set(v.filter(x=>valid.includes(x)))].slice(0,max):[];
function createFriendsService(store,charts,options={}) {
  const quotas=require('./friends-quotas').createFriendsQuotas(options);
  // 校园漏斗：事务提交成功后再发事件，回滚的操作不计数。
  const funnel=typeof options.funnel==='function'?options.funnel:()=>{};
  const tx=fn=>{const queue=[];const result=store.transaction(s=>fn(s,queue));for(const q of queue){try{funnel(...q);}catch(_){}}return result;};
  const blocked=(s,a,b)=>s.blocks.some(x=>(x.by===a&&x.target===b)||(x.by===b&&x.target===a));
  const connection=(s,a,b)=>s.requests.some(r=>r.status==='accepted'&&((r.from===a&&r.to===b)||(r.to===a&&r.from===b)));
  const active=(s,p,viewer)=>p?.listed&&!isDisabled(s,p.userId)&&!blocked(s,p.userId,viewer);
  const isConnected=(s,p,viewer)=>!!mine(s,viewer)?.listed&&!isDisabled(s,viewer)&&connection(s,p.userId,viewer);
  // Single visibility rule shared by projection, matching and explanations.
  const visibleTo=(s,p,viewer)=>{const self=p.userId===viewer,connected=!self&&isConnected(s,p,viewer);return k=>self||p.visibility?.[k]==='public'||(connected&&p.visibility?.[k]==='connected');};
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
      // Verification placeholder: always false until a real verification flow exists; never derived from user input.
      verified:Object.fromEntries(Object.keys(M.WEALTH_TIERS).filter(k=>fields[k]!==undefined).map(k=>[k,false])),
      ...(visible('age')?{ageAsOf:p.chart.ageAsOf}:{}),...(visible('constellation')&&p.constellation?{constellation:p.constellation}:{}),...(visible('mbti')&&p.mbti?{mbti:p.mbti}:{}),...(self?{recommendations:profileRecommendations(p),targetConstellations:p.targetConstellations||[],targetMbtis:p.targetMbtis||[],expectations:structuredClone(p.expectations||{}),matchingConsent:{...(p.matchingConsent||{})}}: {}),...((self||connected)&&p.availability?{availability:structuredClone(p.availability)}:{}),hobbies:p.hobbies,targetStems:p.targetStems,targetZodiacs:p.targetZodiacs,bio:p.bio,connected};
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
  const needMine=(s,uid)=>{const p=mine(s,uid);if(isDisabled(s,uid))denied();if(!p||!p.listed)bad('请先完善个人资料并同意加入人库');return p;};
  return {
    me(uid){const p=mine(store.read(),uid);return p?structuredClone({...M.migrateProfile(p),verified:Object.fromEntries(Object.keys(M.WEALTH_TIERS).filter(k=>p.fields?.[k]).map(k=>[k,false])),recommendations:profileRecommendations(p)}):null;},
    save(uid,b) {
      if(b.consent!==true)bad('请确认本人资料及展示权限');
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
        // readable, always labelled 自述 on display; matching reads tiers by lower bound and legacy text via M.amount().
        const expectations=M.normalizeExpectations(b.expectations,prev?.expectations),matchingConsent=M.normalizeMatchingConsent(b.matchingConsent,prev?.matchingConsent);
        const height=Number(fields.height),weight=Number(fields.weight);
        if(!Number.isFinite(height)||height<80||height>250||!Number.isFinite(weight)||weight<25||weight>300)bad('身高用厘米、体重用公斤，请检查数值');
        const visibility={};for(const k of [...FIELDS,'dayMaster','zodiac']) visibility[k]=SCOPES.includes(b.visibility?.[k])?b.visibility[k]:'private';
        const types=normalizeTypes(b,prev);
        for(const k of ['constellation','mbti'])visibility[k]=Object.hasOwn(b.visibility||{},k)?(SCOPES.includes(b.visibility[k])?b.visibility[k]:'private'):(prev?.visibility?.[k]||'private');
        const hobbies=Array.isArray(b.hobbies)?[...new Set(b.hobbies.map(x=>text(x,24)).filter(Boolean))].slice(0,10):[];
        const recommendations=profileRecommendations({chart,...types});
        const targetStems=array(b.targetStems?.length?b.targetStems:recommendations.stems,[...STEMS,'不限']);const targetZodiacs=array(b.targetZodiacs?.length?b.targetZodiacs:recommendations.zodiacs,[...ZODIACS,'不限']);
        if(!hobbies.length||!targetStems.length||!targetZodiacs.length)bad('请选择爱好及想认识的日主、生肖；也可选不限');
        const p={userId:uid,shareId:prev?.shareId||crypto.randomBytes(18).toString('hex'),nickname,city,intent,purposes,expectations,matchingConsent,fields,visibility,hobbies,targetStems,targetZodiacs,...types,
          bio:text(b.bio,240),contact:text(b.contact,120),contactConsent:b.contactConsent===true,listed:b.listed===true,
          chart,recommendations,availability:Object.hasOwn(b,'availability')?normalizeAvailability(b.availability):(prev?.availability||null),residence:Object.hasOwn(b,'residence')?require('./friends-places').normalizeResidence(b.residence):(prev?.residence||null),policyVersion:b.policyVersion==='friends-2026-11-04-v1'?b.policyVersion:(prev?.policyVersion||'legacy-unversioned'),consentAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        p.acquisition=acquisition;
        if(prev)s.profiles[s.profiles.indexOf(prev)]=p;else s.profiles.push(p);
        if(!attributionMark){s.attributionMarks.push({userId:uid,...acquisition,firstProfileAt:prev?.consentAt||new Date().toISOString()});if(!prev){metric(s,'first_profile_created',acquisition);queue.push(['xs_profile_done',uid,acquisition]);}}else{delete attributionMark.expiresAt;delete attributionMark.deletedAt;}
        if(prev)metric(s,'profile_updated',acquisition);
        return structuredClone(p);
      });
    },
    quota(uid){return quotas.status(store.read(),uid);},
    discover(uid,q={}){return store.transaction(s=>{
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
      return card;},
    request(uid,shareId){return tx((s,queue)=>{
      const self=needMine(s,uid),target=s.profiles.find(p=>p.shareId===shareId);
      if(!active(s,target,uid))missing();if(target.userId===uid)bad('不能向自己申请');
      const old=s.requests.find(r=>((r.from===uid&&r.to===target.userId)||(r.to===uid&&r.from===target.userId))&&['pending','accepted'].includes(r.status));
      if(old)conflict(old.status==='accepted'?'你们已经连接':'已有待处理申请');
      if(s.requests.some(r=>r.from===uid&&r.to===target.userId&&Date.now()-Date.parse(r.createdAt)<86400000))conflict('24小时内请勿重复申请');
      quotas.request(s,uid);
      const r={id:crypto.randomUUID(),from:self.userId,to:target.userId,status:'pending',createdAt:new Date().toISOString()};s.requests.push(r);metric(s,'request_created',self.acquisition);queue.push(['xs_request_sent',uid,self.acquisition||{}]);return {id:r.id,status:r.status};
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
    event(event,attribution){if(!['poster_export','share_visit','profile_preview'].includes(event))bad('事件无效');return store.transaction(s=>{metric(s,event,attribution);return {ok:true};});},
    remove(uid){return store.transaction(s=>{normalize(s);if(s.profiles.some(p=>p.userId===uid)){const mark=s.attributionMarks.find(x=>x.userId===uid);if(mark){mark.deletedAt=new Date().toISOString();mark.expiresAt=new Date(Date.now()+90*86400000).toISOString();}}s.profiles=s.profiles.filter(p=>p.userId!==uid);s.requests=s.requests.filter(r=>r.from!==uid&&r.to!==uid);s.compatibilityPairs=(s.compatibilityPairs||[]).filter(p=>String(p.from)!==String(uid)&&String(p.to)!==String(uid));/* Keep account-level blocks and moderation across profile recreation. */return {ok:true};});}
  };
}
module.exports={createFriendsService,FIELDS,OPTIONAL_FIELDS};
