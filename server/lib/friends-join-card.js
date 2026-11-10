'use strict';
// 相亲名片（登记表 friends-join 的分享页）。一张可以发给相亲对象或媒人的公开名片，不需要登录就能看。
//  · 审核没通过之前：只给「昵称 + 资料审核中」，别的一个字段都不给（联系方式、照片、生日更不给）。
//  · 通过之后：昵称、日主、自我介绍、性格参考（沿用资料里各项的可见设置，只有设为公开的才给）、
//    回答过的问卷方向名称（只有方向名，没有任何答案），以及主人在名片上打开的开关：照片/城市/生日/时辰/联系方式。
//  · 开关只管这张名片，不改发现页和资料里的可见设置。永远不给：用户 ID、四柱、其他资料字段、原始问卷答案。
const {isDisabled}=require('./friends-admin');
const R=require('./friends-review');
const XB=require('./friends-cross-border');
const BANK=require('../../assets/data/friends-marriage-questionnaire.json');

const SHOW_KEYS=['photo','city','birthday','hour','contact'];
// 默认：照片、城市、生日（只显示日期）开；时辰单独开；联系方式默认关。
const SHOW_DEFAULTS=Object.freeze({photo:true,city:true,birthday:true,hour:false,contact:false});
const HOURS=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const PENDING_NOTE='资料审核中';
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};

const showOf=p=>({...SHOW_DEFAULTS,...Object.fromEntries(SHOW_KEYS.filter(k=>typeof p?.shareCard?.show?.[k]==='boolean').map(k=>[k,p.shareCard.show[k]]))});
const live=(s,p)=>!!p&&!!p.listed&&!isDisabled(s,p.userId);
const same=(a,b)=>String(a)===String(b);

function directionsOf(s,uid){
  const rec=(s.marriageQuestionnaires||[]).find(r=>r.userId!==undefined&&same(r.userId,uid));
  if(!rec)return [];
  const out=[];
  for(const d of BANK.dimensions){
    const answers=rec.dimensions?.[d.id]?.answers||{};
    const n=d.questions.filter(q=>!q.sensitive&&answers[q.id]?.state==='answered').length;
    if(n>0)out.push(d.label);
  }
  return out;
}
function photosOf(s,uid){
  const row=(s.seriousPages||[]).find(r=>r.userId===uid);
  return (row?.photos||[]).map(x=>({id:x.id,w:x.w,h:x.h}));
}
const birthOk=b=>b&&typeof b.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.date);

// 公开名片内容。返回 null = 不存在或已停用（路由给 404）。
function publicPayload(s,p){
  if(!live(s,p))return null;
  if(!R.reviewVisible(p))return {nickname:p.nickname,status:'pending',note:PENDING_NOTE};
  const show=showOf(p),card=p.shareCard||{},out={nickname:p.nickname,status:'approved'};
  if(p.chart?.dayMaster)out.dayMaster=p.chart.dayMaster+(p.chart.element||'');
  if(p.bio)out.intro=p.bio;
  const personality={};
  for(const k of ['mbti','enneagram','constellation'])if(p[k]&&p.visibility?.[k]==='public')personality[k]=p[k];
  if(Object.keys(personality).length)out.personality=personality;
  out.directions=directionsOf(s,p.userId);
  if(show.photo){const ph=photosOf(s,p.userId);if(ph.length)out.photos=ph.map(x=>({id:x.id,w:x.w,h:x.h,url:'/api/friends/public-card/'+p.shareId+'/photos/'+x.id}));}
  if(show.city&&p.city)out.city=p.city;
  if(show.birthday&&birthOk(card.birth)){out.birthday=card.birth.date;if(show.hour&&HOURS.includes(card.birth.hour))out.hour=card.birth.hour+'时';}
  if(show.contact&&card.contact)out.contact=card.contact;
  return out;
}

function createJoinCard(store){
  const byShare=(s,id)=>typeof id==='string'&&id.length<=100?(s.profiles||[]).find(p=>p.shareId===id):null;
  const mineOf=(s,uid)=>(s.profiles||[]).find(p=>same(p.userId,uid));
  return {
    SHOW_DEFAULTS,
    publicCard(shareId){const s=store.read(),out=publicPayload(s,byShare(s,shareId));if(!out)fail(404,'这张名片暂时看不到了');return out;},
    // 名片上公开的某张照片：必须已通过审核、开关打开、照片确实属于这张名片。
    photoAllowed(shareId,photoId){const s=store.read(),p=byShare(s,shareId);
      if(!live(s,p)||!R.reviewVisible(p)||!showOf(p).photo||!photosOf(s,p.userId).some(x=>x.id===photoId))fail(404,'照片不存在');return true;},
    // 主人自己的设置页：开关 + 联系方式 + 已有照片数 + 审核状态。
    own(uid){const s=store.read(),p=mineOf(s,uid);if(!p)return {hasProfile:false,show:{...SHOW_DEFAULTS}};
      return {hasProfile:true,shareId:p.shareId,show:showOf(p),contact:p.shareCard?.contact||'',hasBirth:birthOk(p.shareCard?.birth),birthHour:!!HOURS.includes(p.shareCard?.birth?.hour),photoCount:photosOf(s,uid).length,review:R.ownerReview(p),intro:p.bio||''};},
    save(uid,b={}){XB.check(store,uid);
      return store.transaction(s=>{const p=mineOf(s,uid);if(!p)fail(400,'请先保存登记表');
        const card=p.shareCard={...(p.shareCard||{})};
        if(b.show!==undefined){if(!b.show||typeof b.show!=='object'||Array.isArray(b.show))fail(400,'名片开关无效');
          const show={...showOf(p)};for(const k of Object.keys(b.show)){if(!SHOW_KEYS.includes(k)||typeof b.show[k]!=='boolean')fail(400,'名片开关无效');show[k]=b.show[k];}card.show=show;}
        if(b.contact!==undefined){if(typeof b.contact!=='string')fail(400,'联系方式无效');card.contact=b.contact.trim().slice(0,120);}
        if(b.birth!==undefined){const d=b.birth?.date,h=b.birth?.hour;
          const t=Date.parse(d+'T00:00:00Z');
          if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==d||t>Date.now()||d<'1900-01-01')fail(400,'生日格式无效');
          if(h!==null&&h!==undefined&&!HOURS.includes(h))fail(400,'时辰无效');
          card.birth={date:d,hour:HOURS.includes(h)?h:null};}
        if(b.gender!==undefined){if(!['female','male'].includes(b.gender))fail(400,'性别无效');card.gender=b.gender;}
        return {ok:true,show:showOf(p),contact:card.contact||''};});}
  };
}
module.exports={createJoinCard,publicPayload,SHOW_DEFAULTS,SHOW_KEYS,PENDING_NOTE};
