'use strict';
// 相生 · 相合局（一期）。报名 → 系统分组 / 自己开局 / 合作俱乐部 → 确认 → 群聊 → 局后互选。
// 所有状态都在 friends 的 store 里（hejuSignups / hejuGroups / hejuMessages / hejuStrikes / hejuPicks / hejuClubs / hejuNotices）。
// 站内通知只落在 hejuNotices（用户回来时看到）；对外通知只留一个钩子 notify(userId,event,data)，默认什么也不做。
const crypto=require('node:crypto');
const D=require('../../assets/js/friends-heju-data.js');
const H=require('./friends-heju-match');
const M=require('./friends-matching');
const R=require('./friends-review');
const Q=require('./friends-questionnaire');
const {isDisabled}=require('./friends-admin');
const {scopeAllows}=require('./friends-service');

const COLLECTIONS=['hejuSignups','hejuGroups','hejuMessages','hejuStrikes','hejuPicks','hejuClubs','hejuNotices'];
const HOUR=3600000,DAY=24*HOUR;
const LIMITS={
  confirmHours:24,spotRevealHours:24,leaveStrikeHours:2,pauseDays:30,strikesToPause:2,settleHours:24,chatDays:7,pickDays:30,
  systemLeadHours:48,userLeadHours:3,maxLeadDays:60,activeSignups:3,signupExpireDays:30,groupsPerDay:5,
  chatMax:500,chatPerMinute:10,chatPerGroup:300,reportHold:3,clubCapacityMax:40,noticeKeep:30
};
const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const eq=(a,b)=>a!==undefined&&a!==null&&b!==undefined&&b!==null&&String(a)===String(b);
const err=(status,message,code)=>{const e=Error(message);e.status=status;if(code)e.code=code;return e;};
const iso=ms=>new Date(ms).toISOString();
const clean=(v,n)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,n):'';
const ACTIVE_MEMBER=['requested','invited','confirmed'];

// 站内通知文案。用户回到站内时看到，不含分数、不含人数。
const NOTICE_TEXT={
  group_formed:'有一个局凑齐了，请在 24 小时内确认要不要去。',
  group_confirmed:'局定下来了，大家都确认了。',
  group_cancelled:'有一个局没凑齐，已经取消，你回到了等待名单。',
  request_new:'有人想加入你的局，去看看。',
  request_approved:'发起人通过了你的加入申请。',
  request_declined:'这次没能加入这个局。',
  member_left:'有人退出了你们的局。',
  pick_mutual:'你们互相想继续认识，可以去看看。',
  paused:'因为缺席记录，报名暂停一段时间。'
};
const STATUS_LABEL={forming:'等大家确认',open:'报名中',confirmed:'已定下来',cancelled:'没凑齐，已取消',done:'已结束'};
const defaultNotify=()=>{};

function createHejuService(store,{clock=()=>Date.now(),notify=defaultNotify}={}){
  const ensure=s=>{for(const k of COLLECTIONS)if(!Array.isArray(s[k]))s[k]=[];for(const k of ['profiles','requests','blocks','reports'])if(!Array.isArray(s[k]))s[k]=[];return s;};
  const tx=fn=>{const queue=[];const out=store.transaction(s=>fn(ensure(s),queue));for(const q of queue){try{notify(...q);}catch(_){}}return out;};
  const read=()=>ensure(store.read());
  const profileOf=(s,uid)=>s.profiles.find(p=>eq(p.userId,uid));
  const blocked=(s,a,b)=>s.blocks.some(x=>(eq(x.by,a)&&eq(x.target,b))||(eq(x.by,b)&&eq(x.target,a)));
  const nick=(s,uid)=>profileOf(s,uid)?.nickname||'一位同学';
  const stemOfUser=(s,uid)=>profileOf(s,uid)?.chart?.dayMaster||'';
  const clubOf=(s,uid)=>s.hejuClubs.find(c=>eq(c.userId,uid)&&!c.disabled)||null;

  // ---- 通知 ----
  function emit(s,q,uid,event,data={}){
    s.hejuNotices.push({id:crypto.randomUUID(),userId:uid,event,groupId:data.groupId||null,at:iso(clock()),seen:false});
    const mine=s.hejuNotices.filter(n=>eq(n.userId,uid));
    if(mine.length>LIMITS.noticeKeep){const drop=new Set(mine.slice(0,mine.length-LIMITS.noticeKeep));s.hejuNotices=s.hejuNotices.filter(n=>!drop.has(n));}
    q.push([uid,event,data]);
  }

  // ---- 缺席记录 ----
  const strikesOf=(s,uid)=>s.hejuStrikes.filter(x=>eq(x.userId,uid)&&!x.consumed);
  const pausedUntil=(s,uid,now)=>s.hejuStrikes.reduce((t,x)=>eq(x.userId,uid)&&x.pausedUntil&&Date.parse(x.pausedUntil)>now?Math.max(t,Date.parse(x.pausedUntil)):t,0);
  function addStrike(s,q,uid,groupId,reason,now){
    s.hejuStrikes.push({id:crypto.randomUUID(),userId:uid,groupId,reason,at:iso(now),consumed:false});
    const open=strikesOf(s,uid);
    if(open.length>=LIMITS.strikesToPause){
      const until=iso(now+LIMITS.pauseDays*DAY);
      for(const x of open)x.consumed=true;
      s.hejuStrikes.push({id:crypto.randomUUID(),userId:uid,groupId,reason:'pause',at:iso(now),consumed:true,pausedUntil:until});
      // 暂停期间，等待中的报名先收起来
      for(const g of s.hejuSignups)if(eq(g.userId,uid)&&g.status==='waiting')g.status='cancelled';
      emit(s,q,uid,'paused',{groupId});
    }
  }

  // ---- 能不能报名 ----
  const held=(s,uid)=>new Set(s.reports.filter(r=>eq(r.target,uid)&&(r.status||'open')==='open').map(r=>String(r.by))).size>=LIMITS.reportHold;
  function readiness(s,uid,now=clock()){
    const p=profileOf(s,uid);
    if(!p||!p.listed)return {ready:false,code:'need_card',hint:'先建好你的相生卡片，再来报名。',href:'/pages/friends-connect.html#profile'};
    if(isDisabled(s,uid))return {ready:false,code:'disabled',hint:'这个账号暂时不能报名。'};
    if(R.statusOf(p)==='rejected')return {ready:false,code:'rejected',hint:'卡片资料需要先改好，通过审核后再报名。',href:'/pages/friends-connect.html#profile'};
    if(!(Number(p.chart?.age)>=18))return {ready:false,code:'need_adult',hint:'相合局只面向年满 18 周岁的人。'};
    if(!Q.quickDone(Q.upgradeRecord(questionnaireOf(s,uid))))return {ready:false,code:'need_questions',hint:'先答完 14 道底线题（敏感的那一题可以不答），再来报名。',href:'/pages/friends-questions.html'};
    const until=pausedUntil(s,uid,now);
    if(until)return {ready:false,code:'paused',hint:'因为缺席记录，报名暂停到 '+iso(until).slice(0,10)+'。',pausedUntil:iso(until)};
    return {ready:true,approved:R.reviewVisible(p),code:'ok',hint:R.reviewVisible(p)?'':'资料审核通过后才会被分组，报名可以先登记。'};
  }
  const questionnaireOf=(s,uid)=>(s.marriageQuestionnaires||[]).find(r=>eq(r.userId,uid))||null;

  // ---- 两个人能不能放进同一个局 ----
  const isolated=(a,b)=>M.purposesIsolated(M.purposesOf(a),M.purposesOf(b));
  function matchValues(s,p,viewer){
    const allows=scopeAllows(s,p,viewer),visible=k=>allows(p.visibility?.[k]),consent=p.matchingConsent||{},fields={},types={};
    for(const k of M.PLAIN_MATCH_FIELDS)if(visible(k)||consent[k]===true)fields[k]=p.fields?.[k];
    for(const k of M.SENSITIVE_FIELDS)if(consent[k]===true)fields[k]=p.fields?.[k];
    const me=profileOf(s,viewer),typeOf=(x,k)=>['dayMaster','zodiac'].includes(k)?x?.chart?.[k]:x?.[k];
    const reciprocal=k=>!!me&&!!typeOf(me,k)&&(me.visibility?.[k]==='public'||me.matchingConsent?.[k]===true);
    for(const k of M.TYPE_MATCH_FIELDS){const v=typeOf(p,k);if(v&&(visible(k)||(consent[k]===true&&reciprocal(k))))types[k]=v;}
    return {city:p.city,purposes:M.purposesOf(p),fields,types};
  }
  function compatible(s,a,b){
    if(eq(a,b))return false;
    const pa=profileOf(s,a),pb=profileOf(s,b);
    if(!pa||!pb)return false;
    if(blocked(s,a,b)||isDisabled(s,a)||isDisabled(s,b)||held(s,a)||held(s,b))return false;
    if(isolated(pa,pb))return false;
    if(Q.quickConflict(Q.upgradeRecord(questionnaireOf(s,a)),Q.upgradeRecord(questionnaireOf(s,b))))return false;
    const x=M.migrateProfile(pa),y=M.migrateProfile(pb);
    return M.evaluate(x,matchValues(s,pb,a)).passed&&M.evaluate(y,matchValues(s,pa,b)).passed;
  }
  const schoolOf=(s,uid)=>H.normSchool(profileOf(s,uid)?.fields?.school);

  // ---- 报名 ----
  const signupView=r=>({id:r.id,activity:r.activity,windows:r.windows.map(k=>({key:k,label:D.windowLabel(k)})),area:r.area,sameSchool:r.sameSchool,status:r.status,groupId:r.groupId||null,createdAt:r.createdAt});
  function signup(uid,body={}){
    return tx((s)=>{
      const now=clock(),rd=readiness(s,uid,now);
      if(!rd.ready)throw err(409,rd.hint,rd.code);
      if(body.adult!==true)throw err(400,'请先确认你已年满 18 周岁','need_adult_confirm');
      if(body.consent!==true)throw err(400,'请先勾选同意','need_consent');
      const act=H.normalizeActivity(body.activity);
      if(!act)throw err(400,'活动请填公共场所里的轻活动，比如羽毛球、夜跑、吃饭。','bad_activity');
      const windows=[...new Set(Array.isArray(body.windows)?body.windows:[])].filter(H.validWindow).sort();
      if(!windows.length)throw err(400,'请至少选一个方便的时间段。','bad_windows');
      const area=H.cleanArea(body.area);
      if(!area)throw err(400,'片区只写校区或区域，比如「东校区」，不要写具体门牌。','bad_area');
      const sameSchool=body.sameSchool!==false;
      if(sameSchool&&!schoolOf(s,uid))throw err(400,'「只和同校的人」需要先在卡片里填学校；也可以关掉这个选项。','need_school');
      let r=s.hejuSignups.find(x=>eq(x.userId,uid)&&x.activityKey===act.key&&['waiting','grouped'].includes(x.status));
      if(r&&r.status==='grouped')throw err(409,'这项活动你已经在一个局里了。','already_grouped');
      if(!r){
        if(s.hejuSignups.filter(x=>eq(x.userId,uid)&&x.status==='waiting').length>=LIMITS.activeSignups)throw err(409,'同时最多登记 '+LIMITS.activeSignups+' 项活动，先取消一项再来。','too_many');
        r={id:crypto.randomUUID(),userId:uid,status:'waiting',createdAt:iso(now),groupId:null};s.hejuSignups.push(r);
      }
      Object.assign(r,{activity:act.label,activityKey:act.key,windows,area,sameSchool,school:schoolOf(s,uid),consent:true,updatedAt:iso(now)});
      return {signup:signupView(r),waiting:D.COPY.waiting,nudge:D.COPY.nudge,awaitingReview:!rd.approved,note:rd.approved?'':rd.hint};
    });
  }
  function cancelSignup(uid,id){
    return tx(s=>{
      const r=s.hejuSignups.find(x=>x.id===id&&eq(x.userId,uid));
      if(!r)throw err(404,'没有找到这条登记');
      if(r.status==='grouped')throw err(409,'这项活动已经分进局了，请在局里选择退出。');
      r.status='cancelled';return {ok:true};
    });
  }

  // ---- 局的工具 ----
  const groupById=(s,id)=>s.hejuGroups.find(g=>g.id===id);
  const memberOf=(g,uid)=>g.members.find(m=>eq(m.userId,uid)&&ACTIVE_MEMBER.includes(m.status));
  const count=(g,...st)=>g.members.filter(m=>st.includes(m.status)).length;
  const isCreator=(g,uid)=>g.creatorId!==null&&g.creatorId!==undefined&&eq(g.creatorId,uid);
  const newMember=(userId,status,now)=>({mid:crypto.randomBytes(6).toString('hex'),userId,status,joinedAt:iso(now),attended:null,flags:[]});
  function mint(g){const token=crypto.randomBytes(32).toString('base64url');g.tokenHash=sha(token);return token;}
  function inviteState(g,now){
    if(['cancelled','done'].includes(g.status))return 'closed';
    if(g.status==='confirmed'&&g.kind!=='club')return 'closed';
    if(g.eventAt<=now)return 'closed';
    if(count(g,'confirmed','invited')>=g.capacity)return 'full';
    return 'open';
  }
  function giveBack(s,g,uid,keep){ // 让某个人的报名回到等待（keep=true）或作废
    for(const r of s.hejuSignups)if(eq(r.userId,uid)&&r.groupId===g.id&&r.status==='grouped'){r.status=keep?'waiting':'cancelled';r.groupId=null;}
  }
  function cancelGroup(s,q,g,now){
    if(['cancelled','done'].includes(g.status))return;
    g.status='cancelled';g.cancelledAt=iso(now);
    for(const m of g.members){
      if(ACTIVE_MEMBER.includes(m.status)){giveBack(s,g,m.userId,true);emit(s,q,m.userId,'group_cancelled',{groupId:g.id});}
      else giveBack(s,g,m.userId,false);
    }
  }
  // 还能不能凑到 3 人。系统局：已确认 + 还没回复的；用户局：已确认的（定下来之后）。
  function checkViable(s,q,g,now){
    if(['cancelled','done'].includes(g.status))return;
    const live=g.status==='confirmed'?count(g,'confirmed'):count(g,'confirmed','invited');
    if(g.kind==='club')return;
    if(live<H.MIN_SIZE&&(g.status==='forming'||g.status==='confirmed'||(g.status==='open'&&g.locked)))cancelGroup(s,q,g,now);
  }
  function maybeConfirmed(s,q,g,now){
    if(!['forming','open'].includes(g.status)||g.kind==='club')return;
    const waitingOn=count(g,'invited'),yes=count(g,'confirmed');
    const full=g.kind==='user'?(yes>=g.capacity&&!waitingOn):(!waitingOn&&yes>=H.MIN_SIZE);
    if(g.kind==='system'&&full||g.kind==='user'&&full)lockGroup(s,q,g,now);
  }
  function lockGroup(s,q,g,now){
    for(const m of g.members){if(m.status==='invited'){m.status='dropped';giveBack(s,g,m.userId,false);}if(m.status==='requested'){m.status='declined';emit(s,q,m.userId,'request_declined',{groupId:g.id});}}
    if(count(g,'confirmed')<H.MIN_SIZE){cancelGroup(s,q,g,now);return;}
    g.status='confirmed';g.locked=true;g.confirmedAt=iso(now);
    for(const m of g.members)if(m.status==='confirmed')emit(s,q,m.userId,'group_confirmed',{groupId:g.id});
  }

  // ---- 创建局（用户 / 俱乐部） ----
  function parseEventAt(body,now,leadHours){
    let t=null;
    if(typeof body.eventAt==='string'&&body.eventAt.length<=40){t=Date.parse(body.eventAt);if(!Number.isFinite(t))t=null;}
    else if(typeof body.windowKey==='string')t=H.nextOccurrence(body.windowKey,now,leadHours);
    if(t===null)throw err(400,'请选一个活动时间。','bad_time');
    if(t<now+leadHours*HOUR)throw err(400,'活动时间太近了，至少留 '+leadHours+' 小时。','bad_time');
    if(t>now+LIMITS.maxLeadDays*DAY)throw err(400,'活动时间太远了，选两个月内的。','bad_time');
    return t;
  }
  function createGroup(uid,body={}){
    return tx((s,q)=>{
      const now=clock(),club=clubOf(s,uid);
      const mineToday=s.hejuGroups.filter(g=>eq(g.creatorId,uid)&&Date.parse(g.createdAt)>now-DAY).length;
      if(mineToday>=LIMITS.groupsPerDay)throw err(429,'今天开的局有点多了，明天再来。','rate');
      const act=H.normalizeActivity(body.activity);
      if(!act)throw err(400,'活动请填公共场所里的轻活动，比如羽毛球、夜跑、吃饭。','bad_activity');
      const area=H.cleanArea(body.area);
      if(!area)throw err(400,'片区只写校区或区域，不要写具体门牌。','bad_area');
      const cap=Number(body.capacity);
      const g={id:crypto.randomUUID(),kind:club?'club':'user',status:'open',activity:act.label,activityKey:act.key,area,creatorId:uid,createdAt:iso(now),members:[],locked:false,settled:false,spot:'',spotBy:null};
      if(club){
        if(!Number.isInteger(cap)||cap<H.MIN_SIZE||cap>LIMITS.clubCapacityMax)throw err(400,'人数请填 '+H.MIN_SIZE+' 到 '+LIMITS.clubCapacityMax+' 之间的整数。','bad_capacity');
        const venue=H.cleanSpot(body.venue);if(!venue)throw err(400,'请写清场地名称（公共场所）。','bad_venue');
        const fee=clean(body.feeNote,60);if(fee&&require('./friends-copy-guard').findForbidden(fee).length)throw err(400,'费用说明里有不能使用的词，请换个写法。','bad_fee');
        g.eventAt=parseEventAt(body,now,LIMITS.userLeadHours);
        Object.assign(g,{capacity:cap,clubName:club.name,venue,feeNote:fee,recurring:body.recurring===true,sameSchool:false,fillBySystem:false});
      }else{
        const rd=readiness(s,uid,now);if(!rd.ready)throw err(409,rd.hint,rd.code);
        if(body.adult!==true)throw err(400,'请先确认你已年满 18 周岁','need_adult_confirm');
        if(!Number.isInteger(cap)||cap<H.MIN_SIZE||cap>H.MAX_SIZE)throw err(400,'人数请选 '+H.MIN_SIZE+' 到 '+H.MAX_SIZE+' 人。','bad_capacity');
        g.sameSchool=body.sameSchool!==false;
        if(g.sameSchool&&!schoolOf(s,uid))throw err(400,'「只和同校的人」需要先在卡片里填学校；也可以关掉这个选项。','need_school');
        g.eventAt=parseEventAt(body,now,LIMITS.userLeadHours);
        Object.assign(g,{capacity:cap,fillBySystem:body.fillBySystem===true,recurring:false,school:g.sameSchool?schoolOf(s,uid):''});
        g.members.push(newMember(uid,'confirmed',now));
      }
      g.windowKey=H.windowOf(g.eventAt);
      g.confirmBy=iso(g.eventAt-Math.min(12*HOUR,(g.eventAt-now)/2));
      const token=mint(g);s.hejuGroups.push(g);
      return {group:view(s,g,uid,now),inviteToken:token};
    });
  }
  function rotateInvite(uid,id){
    return tx((s)=>{const g=groupById(s,id);if(!g||!isCreator(g,uid))throw err(404,'没有找到这个局');if(['cancelled','done'].includes(g.status))throw err(409,'这个局已经结束了');return {inviteToken:mint(g)};});
  }

  // ---- 视图（每个角色只拿自己该看的字段） ----
  const whenOf=g=>H.labelOfTime(g.eventAt);
  function creatorName(s,g){return g.kind==='club'?g.clubName:nick(s,g.creatorId);}
  function tablesOf(s,g){
    const people=g.members.filter(m=>m.status==='confirmed').map(m=>({userId:m.userId,mid:m.mid,dayMaster:stemOfUser(s,m.userId),createdAt:m.joinedAt}));
    return H.suggestTables(people,{ok:(a,b)=>compatible(s,a.userId,b.userId)});
  }
  function tableReason(s,t){
    if(!t.seated)return '这一桌先自由入座，到场再认识。';
    const pairs=[];
    for(let i=0;i<t.members.length;i++)for(let j=i+1;j<t.members.length;j++){const r=H.relation(t.members[i].dayMaster,t.members[j].dayMaster);if(r)pairs.push(nick(s,t.members[i].userId)+' 和 '+nick(s,t.members[j].userId)+(r==='he'?'：日主相合（天干五合）':'：日主五行相生'));}
    return pairs.join('；');
  }
  function view(s,g,uid,now=clock()){
    const me=g.members.find(m=>eq(m.userId,uid)&&m.status!=='dropped'),creator=isCreator(g,uid);
    const revealSpot=g.status==='confirmed'&&now>=g.eventAt-LIMITS.spotRevealHours*HOUR;
    const convener=g.kind==='system'?g.members.find(m=>m.status==='confirmed'||m.status==='invited'):null;
    const chatOpen=g.kind!=='club'&&g.status==='confirmed'&&now<=g.eventAt+LIMITS.chatDays*DAY;
    const out={id:g.id,kind:g.kind,status:g.status,statusLabel:STATUS_LABEL[g.status],activity:g.activity,whenLabel:whenOf(g),eventAt:iso(g.eventAt),area:g.area,capacity:g.capacity,creatorName:creatorName(s,g),
      isCreator:creator,me:me?{mid:me.mid,status:me.status}:null,confirmBy:g.confirmBy,past:g.eventAt<=now,
      members:(g.kind==='club'?[]:g.members.filter(m=>['invited','confirmed'].includes(m.status)||(creator&&m.status==='requested'))).map(m=>({mid:m.mid,nickname:nick(s,m.userId),status:m.status,mine:eq(m.userId,uid),related:!eq(m.userId,uid)&&!!me&&H.related(stemOfUser(s,uid),stemOfUser(s,m.userId))}))};
    if(g.kind==='club'){out.venue=g.venue;out.feeNote=g.feeNote;out.recurring=g.recurring;out.feeNoteHint='费用由俱乐部自己收取，相生不收费。';}
    else{
      out.canSetSpot=g.status!=='cancelled'&&g.status!=='done'&&(g.kind==='user'?creator:!!convener&&eq(convener.userId,uid));
      out.spotVisible=!!me&&revealSpot&&!!g.spot;
      if(me&&revealSpot&&g.spot)out.spot=g.spot;
      else if(me)out.spotHint=g.status==='confirmed'?(g.spot?'集合点会在活动前一天显示。':'发起人还没定集合点，可以先在群里问一句。'):'大家都确认后，集合点才会显示。';
      out.canChat=!!me&&me.status==='confirmed'&&chatOpen;
      if(out.canChat)out.chatClosesAt=iso(g.eventAt+LIMITS.chatDays*DAY);
    }
    out.canConfirm=!!me&&me.status==='invited'&&['forming','open'].includes(g.status);
    out.canLeave=!!me&&['confirmed'].includes(me.status)&&g.eventAt>now&&!['cancelled','done'].includes(g.status);
    out.canLock=creator&&g.kind==='user'&&g.status==='open'&&count(g,'confirmed')>=H.MIN_SIZE;
    out.fillBySystem=!!g.fillBySystem;
    if(g.kind==='club'&&me?.status==='confirmed'){const t=tablesOf(s,g).find(x=>x.members.some(m=>m.mid===me.mid));if(t)out.table={nicknames:t.members.map(m=>nick(s,m.userId)),reason:tableReason(s,t)};}
    out.afterOpen=!!me&&me.status==='confirmed'&&afterEligible(g)&&g.eventAt<=now&&now<=g.eventAt+LIMITS.pickDays*DAY;
    return out;
  }
  // 俱乐部只看到：昵称、人数、分桌（昵称）。没有出生信息、答案、联系方式，也没有任何账号标识。
  function clubView(s,g,now=clock()){
    const seated=g.members.filter(m=>m.status==='confirmed');
    return {id:g.id,kind:'club',status:g.status,statusLabel:STATUS_LABEL[g.status],activity:g.activity,whenLabel:whenOf(g),eventAt:iso(g.eventAt),area:g.area,venue:g.venue,feeNote:g.feeNote,capacity:g.capacity,recurring:!!g.recurring,
      count:seated.length,nicknames:seated.map(m=>nick(s,m.userId)),tables:tablesOf(s,g).map(t=>({nicknames:t.members.map(m=>nick(s,m.userId)),seated:t.seated,reason:tableReason(s,t)})),past:g.eventAt<=now};
  }
  function groupView(uid,id){
    const s=read(),g=groupById(s,id),now=clock();
    if(!g)throw err(404,'没有找到这个局');
    if(g.kind==='club'&&isCreator(g,uid))return {club:clubView(s,g,now)};
    if(!g.members.some(m=>eq(m.userId,uid))&&!isCreator(g,uid))throw err(404,'没有找到这个局');
    return {group:view(s,g,uid,now),requests:isCreator(g,uid)&&g.kind==='user'?g.members.filter(m=>m.status==='requested').map(m=>({mid:m.mid,nickname:nick(s,m.userId),related:H.related(stemOfUser(s,uid),stemOfUser(s,m.userId))})):[]};
  }

  // ---- 邀请链接 ----
  const byToken=(s,token)=>{if(typeof token!=='string'||!TOKEN_RE.test(token))throw err(404,'这个链接已经失效');const h=sha(token),g=s.hejuGroups.find(x=>x.tokenHash===h);if(!g)throw err(404,'这个链接已经失效');return g;};
  const publicFields=(s,g,now)=>({kind:g.kind,activity:g.activity,whenLabel:whenOf(g),area:g.area,creatorName:creatorName(s,g),state:inviteState(g,now)});
  function invitePublic(token){const s=read(),g=byToken(s,token);return {invite:publicFields(s,g,clock())};}
  function inviteFor(uid,token){
    const s=read(),g=byToken(s,token),now=clock(),mine=g.members.find(m=>eq(m.userId,uid));
    const out={...publicFields(s,g,now),capacity:g.capacity,isCreator:isCreator(g,uid),member:mine&&ACTIVE_MEMBER.includes(mine.status)?mine.status:null,readiness:readiness(s,uid,now),groupId:mine||isCreator(g,uid)?g.id:null};
    if(g.kind==='user'&&!isCreator(g,uid))out.relation=H.relationWords(stemOfUser(s,uid),stemOfUser(s,g.creatorId));
    if(g.kind==='club'){out.venue=g.venue;out.feeNote=g.feeNote;out.feeNoteHint='费用由俱乐部自己收取，相生不收费。';}
    return {invite:out};
  }
  function joinByInvite(uid,token,body={}){
    return tx((s,q)=>{
      const g=byToken(s,token),now=clock();
      if(isCreator(g,uid))throw err(409,'这是你自己开的局。');
      const rd=readiness(s,uid,now);if(!rd.ready)throw err(409,rd.hint,rd.code);
      if(body.adult!==true)throw err(400,'请先确认你已年满 18 周岁','need_adult_confirm');
      const st=inviteState(g,now);
      if(st==='closed')throw err(409,'这个局已经结束报名了。');
      if(st==='full')throw err(409,'这个局已经满了。');
      const old=g.members.find(m=>eq(m.userId,uid));
      if(old&&ACTIVE_MEMBER.includes(old.status))throw err(409,'你已经在这个局里了。');
      if(g.kind==='club'){
        if(g.members.some(m=>eq(m.userId,uid)&&m.status==='left'))throw err(409,'你退出过这个场次，不能再报名。');
        const m=newMember(uid,'confirmed',now);g.members.push(m);return {status:'confirmed',groupId:g.id};
      }
      // 用户的局：拉黑、举报在案、底线题明确不同、硬条件不符，都按「现在没法加入」处理，不说原因。
      if(!compatible(s,uid,g.creatorId)||g.members.some(m=>ACTIVE_MEMBER.includes(m.status)&&!compatible(s,uid,m.userId)))throw err(409,'这个局现在没法加入。');
      if(g.members.some(m=>eq(m.userId,uid)&&['declined','left','dropped'].includes(m.status)))throw err(409,'这个局现在没法加入。');
      g.members.push(newMember(uid,'requested',now));
      emit(s,q,g.creatorId,'request_new',{groupId:g.id});
      return {status:'requested',groupId:g.id};
    });
  }
  function decideRequest(uid,id,mid,approve){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock();
      if(!g||!isCreator(g,uid)||g.kind!=='user')throw err(404,'没有找到这个局');
      const m=g.members.find(x=>x.mid===mid&&x.status==='requested');
      if(!m)throw err(404,'没有找到这条申请');
      if(approve){
        if(['cancelled','done'].includes(g.status)||g.eventAt<=now)throw err(409,'这个局已经结束报名了。');
        if(count(g,'confirmed','invited')>=g.capacity)throw err(409,'这个局已经满了。');
        m.status='confirmed';emit(s,q,m.userId,'request_approved',{groupId:g.id});
        if(g.status==='confirmed'&&count(g,'confirmed')===g.capacity){/* 满员后保持已定下来 */}
        maybeConfirmed(s,q,g,now);
      }else{m.status='declined';emit(s,q,m.userId,'request_declined',{groupId:g.id});}
      return {group:view(s,g,uid,now)};
    });
  }

  // ---- 确认 / 退出 ----
  function confirm(uid,id){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock(),m=g&&memberOf(g,uid);
      if(!m)throw err(404,'没有找到这个局');
      if(m.status==='confirmed')return {group:view(s,g,uid,now)};
      if(m.status!=='invited'||!['forming','open'].includes(g.status)||g.eventAt<=now)throw err(409,'现在不能确认了。');
      const rd=readiness(s,uid,now);if(!rd.ready)throw err(409,rd.hint,rd.code);
      m.status='confirmed';maybeConfirmed(s,q,g,now);
      return {group:view(s,g,uid,now)};
    });
  }
  function leaveOrDecline(uid,id){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock(),m=g&&memberOf(g,uid);
      if(!m)throw err(404,'没有找到这个局');
      if(['cancelled','done'].includes(g.status)||g.eventAt<=now)throw err(409,'现在不能退出了。');
      const wasConfirmed=m.status==='confirmed';
      if(isCreator(g,uid)&&g.kind==='user'){cancelGroup(s,q,g,now);if(g.eventAt-now<LIMITS.leaveStrikeHours*HOUR)addStrike(s,q,uid,g.id,'late_leave',now);return {ok:true,cancelled:true};}
      m.status=wasConfirmed?'left':'declined';giveBack(s,g,uid,false);
      if(wasConfirmed&&g.eventAt-now<LIMITS.leaveStrikeHours*HOUR)addStrike(s,q,uid,g.id,'late_leave',now);
      if(g.kind==='club')return {ok:true};
      for(const o of g.members)if(o.status==='confirmed'&&!eq(o.userId,uid))emit(s,q,o.userId,'member_left',{groupId:g.id});
      checkViable(s,q,g,now);
      if(g.status==='forming')maybeConfirmed(s,q,g,now);
      return {ok:true,cancelled:g.status==='cancelled'};
    });
  }
  function lock(uid,id){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock();
      if(!g||!isCreator(g,uid)||g.kind!=='user')throw err(404,'没有找到这个局');
      if(g.status!=='open')throw err(409,'这个局现在不能这样操作。');
      if(count(g,'confirmed')<H.MIN_SIZE)throw err(409,'至少要 '+H.MIN_SIZE+' 个人确认才能定下来。');
      if(count(g,'invited'))throw err(409,'还有人没回复，等他们回复，或者到时间自动处理。');
      lockGroup(s,q,g,now);return {group:view(s,g,uid,now)};
    });
  }
  function setSpot(uid,id,raw){
    return tx((s)=>{
      const g=groupById(s,id),now=clock();
      if(!g||g.kind==='club'||!memberOf(g,uid)&&!isCreator(g,uid))throw err(404,'没有找到这个局');
      const v=view(s,g,uid,now);
      if(!v.canSetSpot)throw err(403,'只有发起人可以定集合点。');
      const spot=H.cleanSpot(raw);
      if(!spot)throw err(400,'集合点请写公共或校园内的地点，不要写私人住所。','bad_spot');
      g.spot=spot;g.spotBy=uid;return {group:view(s,g,uid,now)};
    });
  }

  // ---- 群聊（只在全员确认之后；只有成员；活动后 7 天关闭） ----
  function chatGate(s,g,uid,now){
    const m=g&&g.members.find(x=>eq(x.userId,uid));
    if(!g||!m||m.status!=='confirmed')throw err(404,'没有找到这个局');
    if(g.kind==='club')throw err(403,'这个场次没有群聊。');
    if(g.status!=='confirmed')throw err(403,'大家都确认之后，才能开聊。');
    if(now>g.eventAt+LIMITS.chatDays*DAY)throw err(403,'群聊已经关闭了。');
    return m;
  }
  function chatList(uid,id){
    const s=read(),g=groupById(s,id),now=clock(),me=chatGate(s,g,uid,now);
    const msgs=s.hejuMessages.filter(x=>x.groupId===g.id).map(x=>{const au=g.members.find(m=>m.mid===x.mid);return {x,au};}).filter(({au})=>au&&(eq(au.userId,uid)||!blocked(s,uid,au.userId)));
    return {messages:msgs.map(({x,au})=>({id:x.id,nickname:nick(s,au.userId),mine:au.mid===me.mid,text:x.text,at:x.at})),closesAt:iso(g.eventAt+LIMITS.chatDays*DAY)};
  }
  function chatPost(uid,id,text){
    return tx((s)=>{
      const g=groupById(s,id),now=clock(),me=chatGate(s,g,uid,now);
      const t=clean(typeof text==='string'?text.replace(/\r\n?/g,'\n'):'',LIMITS.chatMax);
      if(!t)throw err(400,'说点什么再发送。');
      const mine=s.hejuMessages.filter(x=>x.groupId===g.id&&x.mid===me.mid&&Date.parse(x.at)>now-60000).length;
      if(mine>=LIMITS.chatPerMinute)throw err(429,'发得有点快，稍等一下。','rate');
      if(s.hejuMessages.filter(x=>x.groupId===g.id).length>=LIMITS.chatPerGroup)throw err(409,'这个群的聊天已经满了。');
      const msg={id:crypto.randomUUID(),groupId:g.id,mid:me.mid,text:t,at:iso(now)};s.hejuMessages.push(msg);
      return {message:{id:msg.id,nickname:nick(s,uid),mine:true,text:t,at:msg.at}};
    });
  }
  function fileReport(s,by,target,reason,extra){
    const why=clean(reason,300)||'局里的行为让我不舒服';
    s.reports.push({id:crypto.randomUUID(),by,target,reason:why,status:'open',createdAt:iso(clock()),heju:true,...extra});
    if(!s.blocks.some(x=>eq(x.by,by)&&eq(x.target,target)))s.blocks.push({by,target});
  }
  function chatReport(uid,id,msgId,reason){
    return tx((s)=>{
      const g=groupById(s,id);chatGate(s,g,uid,clock());
      const msg=s.hejuMessages.find(x=>x.id===msgId&&x.groupId===g.id),au=msg&&g.members.find(m=>m.mid===msg.mid);
      if(!au||eq(au.userId,uid))throw err(404,'没有找到这条消息');
      msg.reported=true;fileReport(s,uid,au.userId,reason||'群聊内容不当',{groupId:g.id,messageId:msg.id});
      return {ok:true,message:'已举报，也不会再看到这位同学的消息。'};
    });
  }
  function memberAction(uid,id,mid,fn){
    return tx((s,q)=>{
      const g=groupById(s,id);
      if(!g||!g.members.some(m=>eq(m.userId,uid)&&ACTIVE_MEMBER.includes(m.status)))throw err(404,'没有找到这个局');
      const t=g.members.find(m=>m.mid===mid&&!eq(m.userId,uid));
      if(!t)throw err(404,'没有找到这位同学');
      return fn(s,q,g,t);
    });
  }
  const reportMember=(uid,id,mid,reason)=>memberAction(uid,id,mid,(s,q,g,t)=>{fileReport(s,uid,t.userId,reason,{groupId:g.id});return {ok:true,message:'已举报，之后不会再把你们分到同一个局。'};});
  const blockMember=(uid,id,mid)=>memberAction(uid,id,mid,(s,q,g,t)=>{if(!s.blocks.some(x=>eq(x.by,uid)&&eq(x.target,t.userId)))s.blocks.push({by:uid,target:t.userId});return {ok:true};});

  // ---- 局后：到场确认 + 私下互选 ----
  const afterEligible=g=>g.kind==='club'?g.status!=='cancelled':['confirmed','done'].includes(g.status);
  function afterGate(s,g,uid,now){
    const m=g&&g.members.find(x=>eq(x.userId,uid));
    if(!g||!m||m.status!=='confirmed'||!afterEligible(g))throw err(404,'没有找到这个局');
    if(g.eventAt>now)throw err(403,'活动结束之后才能选。');
    if(now>g.eventAt+LIMITS.pickDays*DAY)throw err(403,'这个局已经过了互选的时间。');
    return m;
  }
  function pairState(s,a,b){
    const pa=profileOf(s,a),pb=profileOf(s,b);
    if(!pa||!pb||!pa.listed||!pb.listed||isDisabled(s,a)||isDisabled(s,b)||blocked(s,a,b)||isolated(pa,pb))return 'unavailable';
    if(s.requests.some(r=>r.status==='accepted'&&((eq(r.from,a)&&eq(r.to,b))||(eq(r.from,b)&&eq(r.to,a)))))return 'connected';
    if(!R.reviewVisible(pa)||!R.reviewVisible(pb))return 'waiting_review';
    return 'ready';
  }
  function connectPair(s,a,b,groupId){
    const st=pairState(s,a,b);
    if(st!=='ready')return st;
    const old=s.requests.find(r=>r.status==='pending'&&((eq(r.from,a)&&eq(r.to,b))||(eq(r.from,b)&&eq(r.to,a))));
    if(old){old.status='accepted';old.source='heju';}
    else s.requests.push({id:crypto.randomUUID(),from:a,to:b,status:'accepted',createdAt:iso(clock()),source:'heju',groupId});
    return 'connected';
  }
  const mutualWith=(s,g,uid,t)=>s.hejuPicks.some(p=>p.groupId===g.id&&eq(p.by,uid)&&eq(p.target,t))&&s.hejuPicks.some(p=>p.groupId===g.id&&eq(p.by,t)&&eq(p.target,uid));
  function settlePicks(s,q){
    for(const p of s.hejuPicks){
      const g=groupById(s,p.groupId);if(!g||!mutualWith(s,g,p.by,p.target))continue;
      const st=pairState(s,p.by,p.target);
      if(st==='ready'){connectPair(s,p.by,p.target,g.id);for(const u of [p.by,p.target])if(!p.notified)emit(s,q,u,'pick_mutual',{groupId:g.id});p.notified=true;const o=s.hejuPicks.find(x=>x.groupId===g.id&&eq(x.by,p.target)&&eq(x.target,p.by));if(o)o.notified=true;}
    }
  }
  function attendance(uid,id,body={}){
    return tx((s)=>{
      const g=groupById(s,id),now=clock(),me=afterGate(s,g,uid,now);
      if(g.settled)throw err(409,'这个局已经结算了。');
      if(typeof body.attended!=='boolean')throw err(400,'请选「我到了」或「我没去」。');
      me.attended=body.attended;
      const absent=Array.isArray(body.absent)?body.absent:[];
      for(const m of g.members){m.flags=(m.flags||[]).filter(x=>x!==me.mid);}
      for(const mid of absent){const t=g.members.find(m=>m.mid===mid&&m.status==='confirmed'&&m.mid!==me.mid);if(t&&!t.flags.includes(me.mid))t.flags.push(me.mid);}
      return {ok:true};
    });
  }
  function pick(uid,id,mid,on=true){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock(),me=afterGate(s,g,uid,now);
      const t=g.members.find(m=>m.mid===mid&&m.status==='confirmed'&&m.mid!==me.mid);
      if(!t)throw err(404,'没有找到这位同学');
      if(g.kind==='club'){const tb=tablesOf(s,g).find(x=>x.members.some(m=>m.mid===me.mid));if(!tb||!tb.members.some(m=>m.mid===t.mid))throw err(403,'只能选同桌的人。');}
      const has=s.hejuPicks.find(p=>p.groupId===g.id&&eq(p.by,uid)&&eq(p.target,t.userId));
      if(on&&!has)s.hejuPicks.push({id:crypto.randomUUID(),groupId:g.id,by:uid,target:t.userId,at:iso(now)});
      if(!on&&has)s.hejuPicks.splice(s.hejuPicks.indexOf(has),1);
      settlePicks(s,q);
      return {ok:true};
    });
  }
  function after(uid,id){
    return tx((s,q)=>{
      const g=groupById(s,id),now=clock(),me=afterGate(s,g,uid,now);
      settlePicks(s,q);
      const pool=g.kind==='club'?(tablesOf(s,g).find(x=>x.members.some(m=>m.mid===me.mid))?.members||[]):g.members.filter(m=>m.status==='confirmed');
      const people=pool.filter(m=>m.mid!==me.mid).map(m=>{
        const uid2=m.userId,picked=s.hejuPicks.some(p=>p.groupId===g.id&&eq(p.by,uid)&&eq(p.target,uid2));
        const mutual=picked&&mutualWith(s,g,uid,uid2),state=mutual?pairState(s,uid,uid2):null;
        const out={mid:m.mid,nickname:nick(s,uid2),picked,mutual:!!mutual};
        if(mutual){out.state=state;if(state==='connected')out.shareId=profileOf(s,uid2)?.shareId||null;}
        return out;
      });
      return {group:{id:g.id,activity:g.activity,whenLabel:whenOf(g),settled:!!g.settled},attended:me.attended,people,note:'你选了谁，对方不会知道；只有互相选了，才会连上。',reviewNote:people.some(p=>p.state==='waiting_review')?'你们互相选了。资料审核通过后会自动连上，一般 24 小时内。':''};
    });
  }

  // ---- 我的状态 ----
  function me(uid){
    const s=read(),now=clock();
    const rd=readiness(s,uid,now),club=clubOf(s,uid);
    const groups=s.hejuGroups.filter(g=>(g.members.some(m=>eq(m.userId,uid)&&m.status!=='dropped')||isCreator(g,uid))&&g.eventAt>now-30*DAY).sort((a,b)=>a.eventAt-b.eventAt).map(g=>{
      const m=g.members.find(x=>eq(x.userId,uid));
      return {id:g.id,kind:g.kind,activity:g.activity,whenLabel:whenOf(g),status:g.status,statusLabel:STATUS_LABEL[g.status],myStatus:m?.status||'creator',needsAction:!!m&&m.status==='invited'&&['forming','open'].includes(g.status),afterOpen:!!m&&m.status==='confirmed'&&g.eventAt<=now&&afterEligible(g)};
    });
    const signups=s.hejuSignups.filter(r=>eq(r.userId,uid)&&['waiting','grouped'].includes(r.status)).map(signupView);
    const notices=s.hejuNotices.filter(n=>eq(n.userId,uid)&&!n.seen).map(n=>({id:n.id,event:n.event,groupId:n.groupId,text:NOTICE_TEXT[n.event]||'',at:n.at}));
    return {readiness:rd,club:club?{name:club.name}:null,signups,groups,notices,paused:rd.code==='paused',strikes:strikesOf(s,uid).length,copy:D.COPY,activities:D.ACTIVITIES,windows:D.DAYS.map(([d,l])=>({day:d,label:l,periods:D.PERIODS.map(([p,pl])=>({key:d+'-'+p,label:pl}))}))};
  }
  function seen(uid){return tx(s=>{for(const n of s.hejuNotices)if(eq(n.userId,uid))n.seen=true;return {ok:true};});}
  function clubGroups(uid){
    const s=read(),now=clock();
    if(!clubOf(s,uid))throw err(403,'这个账号不是合作俱乐部。');
    return {groups:s.hejuGroups.filter(g=>g.kind==='club'&&isCreator(g,uid)).sort((a,b)=>a.eventAt-b.eventAt).map(g=>clubView(s,g,now))};
  }

  // ---- 定时任务：收尾 + 分组 + 补人 ----
  function sweep(s,q,now){
    const out={cancelled:0,confirmed:0,settled:0,spawned:0};
    for(const r of s.hejuSignups)if(r.status==='waiting'&&now-Date.parse(r.createdAt)>LIMITS.signupExpireDays*DAY)r.status='expired';
    for(const g of s.hejuGroups){
      if(['forming','open'].includes(g.status)&&g.kind!=='club'&&(now>=Date.parse(g.confirmBy)||g.eventAt<=now)){
        const before=g.status;lockGroup(s,q,g,now);if(g.status==='cancelled')out.cancelled++;else if(before!==g.status)out.confirmed++;
      }
      if(g.status==='confirmed'&&g.kind!=='club'&&count(g,'confirmed')<H.MIN_SIZE&&g.eventAt>now){cancelGroup(s,q,g,now);out.cancelled++;}
      if(['confirmed','open'].includes(g.status)&&g.eventAt+LIMITS.settleHours*HOUR<=now&&!g.settled)out.settled+=settleGroup(s,q,g,now);
    }
    // 群聊关闭后清掉消息
    const closed=new Set(s.hejuGroups.filter(g=>now>g.eventAt+LIMITS.chatDays*DAY).map(g=>g.id));
    if(closed.size)s.hejuMessages=s.hejuMessages.filter(m=>!closed.has(m.groupId));
    // 每周一次的俱乐部场次：这一场结束后生成下一场
    for(const g of [...s.hejuGroups])if(g.kind==='club'&&g.recurring&&!g.spawned&&g.status!=='cancelled'&&g.eventAt<=now){
      g.spawned=true;const next={...structuredClone(g),id:crypto.randomUUID(),members:[],status:'open',spawned:false,settled:false,eventAt:g.eventAt+7*DAY,createdAt:iso(now)};
      while(next.eventAt<=now+LIMITS.userLeadHours*HOUR)next.eventAt+=7*DAY;
      next.windowKey=H.windowOf(next.eventAt);next.confirmBy=iso(next.eventAt-12*HOUR);mint(next);s.hejuGroups.push(next);out.spawned++;
    }
    settlePicks(s,q);
    return out;
  }
  function settleGroup(s,q,g,now){
    g.settled=true;
    if(g.kind==='club'){g.status='done';return 1;}
    const live=g.members.filter(m=>m.status==='confirmed');let n=0;
    for(const m of live){
      const others=live.length-1,flagged=(m.flags||[]).length;
      // 自己说没去，或没说到场、且被超过一半的同伴标记缺席，算一次缺席
      const noShow=m.attended===false||(m.attended!==true&&others>0&&flagged*2>others);
      if(noShow){addStrike(s,q,m.userId,g.id,'no_show',now);n++;}
    }
    g.status='done';return n;
  }
  // 候选人：等待中、资料通过审核、没被暂停、没在同活动的局里。
  function entriesFor(s,now,{activityKey,windowKey,exclude=[]}={}){
    const out=[];
    for(const r of s.hejuSignups){
      if(r.status!=='waiting')continue;
      if(activityKey&&r.activityKey!==activityKey)continue;
      if(windowKey&&!r.windows.includes(windowKey))continue;
      if(exclude.some(u=>eq(u,r.userId)))continue;
      const p=profileOf(s,r.userId);
      if(!p||!p.listed||!R.reviewVisible(p)||isDisabled(s,r.userId)||held(s,r.userId))continue;
      if(!readiness(s,r.userId,now).ready)continue;
      const busy=s.hejuGroups.some(g=>g.activityKey===r.activityKey&&['forming','open','confirmed'].includes(g.status)&&g.eventAt>now&&g.members.some(m=>eq(m.userId,r.userId)&&ACTIVE_MEMBER.includes(m.status)));
      if(busy)continue;
      out.push({userId:r.userId,signupId:r.id,activityKey:r.activityKey,activity:r.activity,windows:r.windows,area:r.area,sameSchool:r.sameSchool,school:r.school||schoolOf(s,r.userId),dayMaster:stemOfUser(s,r.userId),createdAt:r.createdAt});
    }
    return out;
  }
  const signupOk=s=>{const memo=new Map();return (a,b)=>{const k=[String(a.userId),String(b.userId)].sort().join('|');if(memo.has(k))return memo.get(k);
    const ok=compatible(s,a.userId,b.userId)&&(!(a.sameSchool||b.sameSchool)||(!!a.school&&a.school===b.school))&&H.areaCompatible(a.area,b.area);memo.set(k,ok);return ok;};};
  function group(s,q,now){
    const made=[],ok=signupOk(s),formed=H.formGroups(entriesFor(s,now),{ok});
    for(const f of formed){
      const w=H.earliestWindow(f.windows,now,LIMITS.systemLeadHours);if(!w)continue;
      const areas=f.members.map(m=>m.area).filter(Boolean).sort((a,b)=>a.length-b.length);
      const g={id:crypto.randomUUID(),kind:'system',status:'forming',activity:f.members[0].activity,activityKey:f.activityKey,area:areas[0]||'',windowKey:w.key,eventAt:w.at,capacity:H.MAX_SIZE,creatorId:null,createdAt:iso(now),
        confirmBy:iso(Math.min(now+LIMITS.confirmHours*HOUR,w.at-12*HOUR)),members:f.members.map(m=>newMember(m.userId,'invited',now)),locked:false,settled:false,spot:'',spotBy:null,sameSchool:f.members.some(m=>m.sameSchool)};
      mint(g);
      f.members.forEach((m,i)=>{const r=s.hejuSignups.find(x=>x.id===m.signupId);r.status='grouped';r.groupId=g.id;emit(s,q,m.userId,'group_formed',{groupId:g.id});});
      s.hejuGroups.push(g);made.push(g.id);
    }
    return made;
  }
  function fill(s,q,now){
    let n=0;
    for(const g of s.hejuGroups){
      const ok=signupOk(s);
      if(g.kind!=='user'||g.status!=='open'||!g.fillBySystem||g.eventAt<=now+LIMITS.userLeadHours*HOUR)continue;
      const slots=g.capacity-count(g,'confirmed','invited','requested');if(slots<=0)continue;
      const existing=g.members.filter(m=>ACTIVE_MEMBER.includes(m.status)).map(m=>({userId:m.userId,dayMaster:stemOfUser(s,m.userId),sameSchool:g.sameSchool,school:g.school||schoolOf(s,m.userId),area:g.area,createdAt:m.joinedAt}));
      const cands=entriesFor(s,now,{activityKey:g.activityKey,windowKey:g.windowKey,exclude:g.members.map(m=>m.userId)}).map(c=>({...c,sameSchool:c.sameSchool||g.sameSchool}));
      const pickedList=H.fillCandidates(existing,cands,{slots,ok:(a,b)=>ok({...a,sameSchool:a.sameSchool||g.sameSchool,school:a.school||g.school,area:a.area||g.area},{...b,area:b.area||g.area})});
      for(const c of pickedList){
        g.members.push(newMember(c.userId,'invited',now));
        const r=s.hejuSignups.find(x=>x.id===c.signupId);r.status='grouped';r.groupId=g.id;
        emit(s,q,c.userId,'group_formed',{groupId:g.id});n++;
      }
    }
    return n;
  }
  function run(){
    return tx((s,q)=>{
      const now=clock(),swept=sweep(s,q,now),made=group(s,q,now),filled=fill(s,q,now);
      return {at:iso(now),...swept,groups:made.length,filled};
    });
  }

  // ---- 运营 ----
  function markClub(body={}){
    return tx((s)=>{
      const name=clean(body.name,30);if(!name)throw err(400,'请填俱乐部名称');
      if(require('./friends-copy-guard').findForbidden(name).length)throw err(400,'名称里有不能使用的词');
      let uid=body.userId;
      if(typeof body.shareId==='string'&&body.shareId){const p=s.profiles.find(x=>x.shareId===body.shareId);if(!p)throw err(404,'没有找到这个卡片');uid=p.userId;}
      if(uid===undefined||uid===null||uid==='')throw err(400,'请填账号或卡片编号');
      if(body.disabled===true){const c=s.hejuClubs.find(x=>eq(x.userId,uid));if(!c)throw err(404,'这个账号不是俱乐部');c.disabled=true;return {ok:true,disabled:true};}
      let c=s.hejuClubs.find(x=>eq(x.userId,uid));
      if(c){c.name=name;c.disabled=false;}else{c={userId:uid,name,createdAt:iso(clock()),disabled:false};s.hejuClubs.push(c);}
      return {ok:true,club:{name:c.name}};
    });
  }
  function clubs(){return {clubs:read().hejuClubs.map(c=>({name:c.name,disabled:!!c.disabled,createdAt:c.createdAt}))};}
  function summary(){
    const s=read(),by=(arr,f)=>arr.reduce((a,x)=>{const k=f(x);a[k]=(a[k]||0)+1;return a;},{});
    return {signups:by(s.hejuSignups,x=>x.status),groups:by(s.hejuGroups,x=>x.kind+':'+x.status),clubs:s.hejuClubs.filter(c=>!c.disabled).length,strikes:s.hejuStrikes.filter(x=>x.reason!=='pause').length};
  }
  const sweepOnly=()=>tx((s,q)=>sweep(s,q,clock()));
  return {sweepOnly,signup,cancelSignup,createGroup,rotateInvite,groupView,invitePublic,inviteFor,joinByInvite,decideRequest,confirm,decline:leaveOrDecline,leave:leaveOrDecline,lock,setSpot,chatList,chatPost,chatReport,reportMember,blockMember,attendance,pick,after,me,seen,clubGroups,run,markClub,clubs,summary,readiness:uid=>readiness(read(),uid),LIMITS};
}
// 删除交友档案时一并清掉相合局里的个人数据。
function purgeUser(s,uid){
  const mine=x=>eq(x.userId,uid);
  for(const k of COLLECTIONS)if(!Array.isArray(s[k]))s[k]=[];
  const myGroups=new Set(s.hejuGroups.filter(g=>g.members.some(mine)).map(g=>g.id));
  s.hejuSignups=s.hejuSignups.filter(x=>!mine(x));
  s.hejuNotices=s.hejuNotices.filter(x=>!mine(x));
  s.hejuStrikes=s.hejuStrikes.filter(x=>!mine(x));
  s.hejuPicks=s.hejuPicks.filter(x=>!eq(x.by,uid)&&!eq(x.target,uid));
  for(const g of s.hejuGroups){
    for(const m of g.members){if(mine(m)){s.hejuMessages=s.hejuMessages.filter(x=>!(x.groupId===g.id&&x.mid===m.mid));if(ACTIVE_MEMBER.includes(m.status))m.status='left';}}
  }
  return myGroups.size;
}
module.exports={createHejuService,purgeUser,COLLECTIONS,LIMITS,TOKEN_RE,NOTICE_TEXT,defaultNotify,STATUS_LABEL};
