'use strict';
// 「我的命盘」：本人自己的命盘页（免费）+ 完整个人报告（付费，复用 Runae 八字完整报告引擎）。
// - 只读本人：所有方法只接收登录用户 uid，没有任何按别人 id 查询的入口；公开卡片投影不含这里的任何字段。
// - 免费部分只用交友资料里已存的命盘（profile.chart：四柱或三柱），不重新收集、不保存生日。
// - 相生不保存出生日期/时间/城市（friends-chart 设计如此），而 Runae 完整报告引擎需要它们：
//   付费报告前由本人在页面上再填一次，服务端核对「算出来的柱 = 卡片上已存的柱」后只在内存里用，不落库。
// - 付费走合盘同一套收款中台（friends-hepan-pay，type='mychart'）；未解锁时服务端不返回报告正文。
const crypto=require('node:crypto');
const XB=require('./friends-cross-border');
const {calculate}=require('./friends-chart');
const {createFriendsReportsService}=require('./friends-reports');
const {TITLES}=require('./friends-report-adapter');
const {traitLines,DISCLAIMER,AI_LABEL,ORDER}=require('./friends-my-chart-copy');
const {sanitize}=require('./friends-copy-guard');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const same=(a,b)=>a!==undefined&&a!==null&&b!==undefined&&b!==null&&String(a)===String(b);
const iso=t=>new Date(t).toISOString();
const STEM_EL={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BRANCH_EL={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const KEYS=['year','month','day','hour'];
const GZ=/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
// 从已存的命盘取柱：时辰已知 → 四柱；时辰不详 → 年月日三柱（有限参考）；老资料只有日柱 → 仅日柱。
function pillarsOf(chart){
 const pick=src=>Object.fromEntries(KEYS.map(k=>[k,GZ.test(src?.[k]||'')?src[k]:null]));
 if(chart?.complete&&chart.pillars){const p=pick(chart.pillars);if(KEYS.every(k=>p[k]))return {pillars:p,complete:true,basis:'four'};}
 if(chart?.basePillars){const p={...pick(chart.basePillars),hour:null};if(p.year&&p.month&&p.day)return {pillars:p,complete:false,basis:'three'};}
 return {pillars:{year:null,month:null,day:GZ.test(chart?.dayPillar||'')?chart.dayPillar:null,hour:null},complete:false,basis:'day'};
}
// 五行计数：每柱天干 + 地支本气各计 1。
function elementCounts(pillars){
 const counts=Object.fromEntries(ORDER.map(k=>[k,0]));
 for(const k of KEYS){const v=pillars[k];if(!v)continue;const [g,z]=[...v];counts[STEM_EL[g]]++;counts[BRANCH_EL[z]]++;}
 return counts;
}
const chartKeyOf=pillars=>KEYS.map(k=>pillars[k]||'-').join('|');
const rowsOf=s=>{if(!Array.isArray(s.myChartRows))s.myChartRows=[];return s.myChartRows;};
const profileOf=(s,uid)=>(s.profiles||[]).find(p=>same(p.userId,uid));
function needChart(s,uid){
 if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
 const p=profileOf(s,uid);if(!p?.chart?.dayMaster)fail(404,'请先在「我的卡片」生成日主卡');
 const info=pillarsOf(p.chart);if(!info.pillars.day)fail(404,'请先在「我的卡片」重新计算生日');
 return {profile:p,...info,key:chartKeyOf(info.pillars)};
}
// 每个账号 + 每张命盘一条记录（卡片上的生日改了 → 新记录；旧记录连同付款留档）。
function ensureRow(s,uid,key,now){
 const rows=rowsOf(s);let row=rows.find(r=>same(r.owner,uid)&&r.chartKey===key);
 if(!row){row={id:'mc'+crypto.randomBytes(12).toString('hex'),owner:uid,chartKey:key,gender:null,createdAt:iso(now)};rows.push(row);}
 return row;
}
const currentRow=(s,uid)=>{const c=needChart(s,uid);return rowsOf(s).find(r=>same(r.owner,uid)&&r.chartKey===c.key)||null;};
function createMyChartService({store,pay=null,adapter,calculateChart=calculate,clock=()=>Date.now(),inputHashKey,leaseMs,heartbeatMs}={}){
 if(!store?.read||!store?.transaction)throw Error('我的命盘需要存储');
 const unlockedIn=(s,row)=>!!(pay&&row&&pay.isUnlocked('mychart',row,s));
 // 付费权益：一次购买 = 一份完整报告。给 friends-reports 用的「预扣/结算」接口，状态记在本人的命盘记录上。
 const entitlement={
  reserve(uid,unit,qty,key){return store.transaction(s=>{
   const row=currentRow(s,uid);
   if(!row||!unlockedIn(s,row))fail(402,'请先解锁完整报告');
   if(row.reportId)fail(409,'这份完整报告已经生成过');
   if(row.reservation?.status==='reserved'&&row.reservation.key!==key)fail(409,'完整报告正在生成，请稍后刷新');
   if(row.reservation?.status==='reserved')return {id:row.reservation.id,status:'reserved'};
   row.reservation={id:crypto.randomUUID(),key,jobId:String(key).replace(/^report_/,''),status:'reserved',at:iso(clock())};
   return {id:row.reservation.id,status:'reserved'};
  });},
  settle(uid,id,action){return store.transaction(s=>{
   const row=rowsOf(s).find(r=>same(r.owner,uid)&&r.reservation?.id===id);if(!row)fail(409,'没有找到这次报告的预留记录');
   if(action==='commit'){if(row.reservation.status!=='committed'){row.reservation.status='committed';row.reportId=row.reservation.jobId;
     // 报告生成即视为已打开：之后不再按「未打开」退款。
     if(row.unlock&&!row.unlock.payerFirstOpenedFullAt)row.unlock.payerFirstOpenedFullAt=iso(clock());}
    return {status:'committed'};}
   if(row.reservation.status==='committed')fail(409,'报告已生成，不能释放');
   row.reservation.status='released';return {status:'released'};
  });},
  reservationByKey(uid,key){const row=rowsOf(store.read()).find(r=>same(r.owner,uid)&&r.reservation?.key===key);return row?{id:row.reservation.id}:null;}
 };
 // 本人再填的出生资料 → 算出的柱必须和卡片上已存的一致（防止拿别人的生日买报告），再交给 Runae 引擎做完整校验。
 async function verify(uid,input){
  const s=store.read(),c=needChart(s,uid),row=rowsOf(s).find(r=>same(r.owner,uid)&&r.chartKey===c.key);
  if(!row?.gender)fail(400,'请先选择乾造或坤造');
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'请填写本人的出生资料');
  if(input.gender!==undefined&&input.gender!==row.gender)fail(400,'性别与页面上选择的乾造/坤造不一致');
  if(typeof input.cityId!=='string'||!input.cityId)fail(400,'完整报告需要选择出生城市');
  const y=Number(input.birthYear),m=Number(input.birthMonth),d=Number(input.birthDay),hour=Number(input.birthHour),minute=Number(input.birthMinute??0);
  if(input.birthHour===undefined||input.birthHour===null||input.birthHour==='')fail(400,'完整报告需要出生时间（几点几分）');
  if(![y,m,d,hour,minute].every(Number.isInteger)||hour<0||hour>23||minute<0||minute>59)fail(400,'出生日期或时间无效');
  const birthday=[String(y).padStart(4,'0'),String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  const calc=calculateChart({birthday,calendar:input.calendar==='lunar'?'lunar':'solar',leapMonth:input.leapMonth===true,hour,minute,cityId:input.cityId,disambiguation:input.disambiguation},new Date(clock()));
  if(!calc?.complete||!calc.pillars)fail(400,'没有算出完整四柱，请核对出生时间');
  for(const k of KEYS)if(c.pillars[k]&&c.pillars[k]!==calc.pillars[k])fail(409,'填写的出生资料与你卡片上的命盘不一致。完整报告只为卡片本人生成；如果卡片上的生日有误，或出生在 23 点以后，请先在「我的卡片」重新计算生日。');
  if(!adapter||typeof adapter.verifyChart!=='function')fail(503,'完整报告暂未开放');
  return adapter.verifyChart({...input,gender:row.gender});
 }
 let reports=null;
 if(adapter&&typeof inputHashKey==='string'&&inputHashKey.length>=32){
  reports=createFriendsReportsService({store,billing:entitlement,inputHashKey,clock,collection:'myChartReportJobs',leaseMs,heartbeatMs,
   verifyChart:(input,uid)=>verify(uid,input),
   generate:async(input,ctx)=>{const r=await adapter.generate(input,ctx);return r&&typeof r.reading==='string'?{...r,reading:sanitize(r.reading),source:'runae-bazi-full-mychart-v1'}:r;},
   validateResult:typeof adapter.validateResult==='function'?adapter.validateResult:undefined});
 }
 // 服务端截断：没有有效解锁（未付、已退款）时只回状态，不回正文。
 function shape(job,unlocked){
  if(!job)return null;const {report,...rest}=job;
  if(unlocked&&report&&typeof report.reading==='string')return {...rest,report:{reading:sanitize(report.reading),tier:'full'},aiLabel:AI_LABEL};
  return {...rest,locked:true};
 }
 const jobIdOf=row=>row?.reportId||(row?.reservation&&row.reservation.status!=='released'?row.reservation.jobId:null);
 return {
  entitlement,
  async view(uid){
   const now=clock();
   // 读路径：已有记录直接用；第一次打开才写一条空记录（只含 owner + 柱字符串，不含任何出生资料）。
   if(!currentRow(store.read(),uid))store.transaction(s=>{const c=needChart(s,uid);ensureRow(s,uid,c.key,now);});
   const s=store.read(),c=needChart(s,uid),live=currentRow(s,uid);
   const counts=elementCounts(c.pillars),dm=c.profile.chart.dayMaster,dayElement=STEM_EL[dm];
   const traits=traitLines({dayMaster:dm,dayElement,counts});
   const unlocked=unlockedIn(s,live),offer=pay?pay.offerFor(uid,'mychart',live,s):null;
   const jobId=jobIdOf(live);let job=null;
   if(jobId&&reports){try{job=await reports.get(uid,jobId);}catch(_){job=null;}}
   const payEnabled=!!pay?.enabledFor?.('mychart');// 产品开关（未核对资料前 offer.payEnabled 也是 false，不能拿来判断「即将开放」）
   return {
    chart:{pillars:c.pillars,complete:c.complete,basis:c.basis,limited:!c.complete,limitedLabel:c.complete?null:'有限参考',
     limitedNote:c.complete?null:(c.basis==='three'?'卡片上没有出生时辰，这里只排年、月、日三柱；五行计数和性格描述只作有限参考。':'卡片上只有日柱，五行计数只作有限参考；可在「我的卡片」重新计算生日。'),
     gender:live.gender||null,zao:live.gender==='male'?'乾造':live.gender==='female'?'坤造':null,
     dayMaster:dm,dayElement,elements:counts,strongest:traits.strongest,weakest:traits.weakest,countRule:'每柱天干与地支本气各计 1'},
    traits:traits.lines,traitsSource:'固定文案库，非 AI 生成',
    disclaimer:DISCLAIMER,
    report:{titles:TITLES,aiLabel:AI_LABEL,eligible:!!live.eligibleAt,unlocked,payEnabled,comingSoon:!unlocked&&!payEnabled,comingSoonText:'完整报告即将开放',
     needs:['出生年月日','出生时间（几点几分）','出生城市'],needsNote:'相生不保存你的生日、出生时间和城市。生成完整报告时请再填一次，只用于本次核对和生成，不会保存。',
     generated:!!live.reportId,target:{type:'mychart',id:live.id},pay:offer,job:shape(job,unlocked)}
   };
  },
  setGender(uid,{gender}={}){
   if(!['male','female'].includes(gender))fail(400,'请选择乾造（男）或坤造（女）');
   return store.transaction(s=>{const c=needChart(s,uid),row=ensureRow(s,uid,c.key,clock());
    if(row.reportId||row.reservation?.status==='reserved')fail(409,'完整报告生成后不能再改');
    row.gender=gender;return {gender,zao:gender==='male'?'乾造':'坤造'};});
  },
  // 免费核对：资料与卡片命盘一致、且在 Runae 引擎支持范围内，才开放购买。出生资料不落库。
  async eligibility(uid,{input}={}){
   XB.check(store,uid);
   await verify(uid,input);
   store.transaction(s=>{const c=needChart(s,uid),row=ensureRow(s,uid,c.key,clock());if(!row.eligibleAt)row.eligibleAt=iso(clock());});
   return {eligible:true,note:'资料与卡片上的命盘一致，在完整报告支持范围内。本次只做核对，没有保存你的出生资料，也没有扣费。'};
  },
  async createReport(uid,body={}){
   if(!reports)fail(503,'完整报告暂未开放');
   const s=store.read(),row=currentRow(s,uid);
   if(!row||!unlockedIn(s,row))fail(402,'请先解锁完整报告');
   const input=body.input&&typeof body.input==='object'&&!Array.isArray(body.input)?{...body.input,gender:row.gender}:body.input;
   return shape(await reports.create(uid,{idempotencyKey:body.idempotencyKey,input,consentRetainReport:body.consentRetainReport}),true);
  },
  async getReport(uid,id){
   if(!reports)fail(404,'报告不存在');
   if(typeof id!=='string'||!/^[A-Za-z0-9-]{8,100}$/.test(id))fail(404,'报告不存在');
   const job=await reports.get(uid,id);// 不是本人的作业 → 404
   const s=store.read(),row=rowsOf(s).find(r=>same(r.owner,uid)&&jobIdOf(r)===id);
   return shape(job,unlockedIn(s,row));
  }
 };
}
module.exports={createMyChartService,pillarsOf,elementCounts,STEM_EL,BRANCH_EL};
