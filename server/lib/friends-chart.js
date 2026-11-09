'use strict';
// Reuse Runae's vendored calendar and chart engine. Birth input is never persisted here.
const crypto = require('node:crypto');
const { Solar, Lunar } = require('./bazi-engine/vendor/lunar-typescript');
const { computeBaziChart } = require('./bazi-engine');
const {resolveBirthTime}=require('./friends-location');
const {recommend}=require('./friends-preferences');
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const ELEMENTS = ['木','火','土','金','水'];
const ZODIACS = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const stemElement = stem => ELEMENTS[Math.floor(STEMS.indexOf(stem) / 2)];
const bad = message => { const e = new Error(message); e.status = 400; throw e; };
function directions(stem) {
  const e = ELEMENTS.indexOf(stemElement(stem));
  return [
    {index:(e+4)%5,label:'对方生我',relation:'相生',forMe:'传统五行中，对方的五行生我的五行，可作为支持与滋养的文化意象。',forThem:'从对方视角是“我生对方”；真实相处中，也需要你回应、关心与付出。'},
    {index:e,label:'同五行',relation:'同类',forMe:'传统五行中属于同类，可作为寻找共同语言的认识入口。',forThem:'双方互为同类；是否聊得来，还要看兴趣、边界和相处方式。'},
    {index:(e+1)%5,label:'我生对方',relation:'相生',forMe:'从你的视角是“我生对方”，可作为表达、分享与支持的文化意象。',forThem:'对方视角是“对方生我”；并不意味着你必须单方面照顾或承担。'}
  ].map(({index,...d})=>({...d,element:ELEMENTS[index],stems:STEMS.slice(index*2,index*2+2)}));
}
function calculate(input, now=new Date()) {
  if (!input || typeof input.birthday !== 'string') bad('请填写出生日期');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthday);
  if (!m) bad('日期格式应为 YYYY-MM-DD');
  const year=+m[1],month=+m[2],day=+m[3];
  if(year<1900 || year>now.getUTCFullYear() || month<1 || month>12 || day<1 || day>31) bad('出生日期无效');
  const calendar = input.calendar || 'solar';
  if(!['solar','lunar'].includes(calendar)) bad('请选择公历或农历');
  let solar;
  try {
    if(calendar==='lunar') {
      const lunar=Lunar.fromYmd(year,input.leapMonth===true?-month:month,day);
      solar=lunar.getSolar();
      if(lunar.getYear()!==year || Math.abs(lunar.getMonth())!==month || lunar.getDay()!==day) bad('农历日期不存在');
    } else {
      const date=new Date(Date.UTC(year,month-1,day));
      if(date.getUTCFullYear()!==year || date.getUTCMonth()+1!==month || date.getUTCDate()!==day) bad('公历日期不存在');
      solar=Solar.fromYmd(year,month,day);
    }
  } catch (_) { bad('出生日期不存在，请检查公历、农历和闰月'); }
  const sy=solar.getYear(), sm=solar.getMonth(), sd=solar.getDay();
  const date=new Date(Date.UTC(sy,sm-1,sd));
  if(date>now) bad('出生日期不能在未来');
  const age=now.getUTCFullYear()-sy-((now.getUTCMonth()+1<sm || (now.getUTCMonth()+1===sm && now.getUTCDate()<sd))?1:0);
  if(age<18) bad('交友功能仅供年满18岁的用户使用');
  let rawHour=input.hour,rawMinute=input.minute;
  if(Object.hasOwn(input,'time')){
    if(input.time===null||input.time===''){rawHour=null;rawMinute=0;}
    else {const tm=/^(\d{2}):(\d{2})$/.exec(String(input.time));if(!tm)bad('出生时间请填写为 HH:mm');rawHour=+tm[1];rawMinute=+tm[2];}
  }
  const known=rawHour!==undefined && rawHour!==null && rawHour!=='';
  const hour=known?Number(rawHour):12, minute=known?Number(rawMinute??0):0;
  if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59) bad('出生时间无效');
  const resolved=input.cityId?resolveBirthTime({year:sy,month:sm,day:sd,hour:known?hour:null,minute,cityId:input.cityId,disambiguation:input.disambiguation}):null;
  const timed=Solar.fromYmdHms(sy,sm,sd,hour,minute,0);
  const daySolar=hour===23?timed.next(1):timed;
  const dayPillar=daySolar.getLunar().getEightChar().getDay();
  // Unknown hour: do not fabricate a time pillar, strength, useful element or full match.
  let pillars=null;
  if(known){
    const full=computeBaziChart({year:sy,month:sm,day:sd,hour,minute,gender:'female',includeZiwei:false});
    pillars=Object.fromEntries(Object.entries(full.bazi.siZhu).map(([k,v])=>[k,v.gan+v.zhi]));
    if(resolved){
      // Seasonal boundaries are absolute instants; the existing calendar's ephemeris is expressed in UTC+8.
      // Day/time pillars intentionally use the recorded local civil date/time (no true-solar correction).
      const beijing=new Date(Date.parse(resolved.instant)+8*3600000);
      const seasonal=Solar.fromYmdHms(beijing.getUTCFullYear(),beijing.getUTCMonth()+1,beijing.getUTCDate(),beijing.getUTCHours(),beijing.getUTCMinutes(),0).getLunar().getEightChar();
      pillars.year=seasonal.getYear();pillars.month=seasonal.getMonth();
    }
  }
  const birthLocation=resolved?{...resolved.location,offsetMinutes:resolved.offsetMinutes}:null;
  const chart={ dayMaster:dayPillar[0],element:stemElement(dayPillar[0]),dayPillar,
    zodiac:solar.getLunar().getYearShengXiao(),constellation:solar.getXingZuo()+'座',age,ageAsOf:now.toISOString().slice(0,10),
    complete:known,pillars,birthLocation,directions:directions(dayPillar[0]),calculationVersion:'friends-chart-v2;tzdata='+process.versions.tz,
    convention:resolved?`${resolved.location.label} · ${resolved.location.timeZone}；按出生当地民用日期/时间，23点换日；年/月柱按同一瞬间的节气，生肖按春节。经纬度为城市中心；未校正真太阳时。`:'未填出生城市，暂按UTC+8民用时间；23点换日，生肖按农历春节。未校正真太阳时。',
    note:known?'四柱用于传统文化参考；认识方向仅解释五行关系，不是完整合盘或择偶结论。':'时辰未知：日柱暂按当日中午计算，若可能生于23点后，日主可能变化。没有推算时柱、身强弱或喜用神。' };
  chart.recommendations=recommend(chart);return chart;
}
function createChartService(secret) {
  if(typeof secret!=='string' || secret.length<32) throw Error('FRIENDS_SIGNING_KEY 至少32个字符');
  const mac = data => crypto.createHmac('sha256',secret).update(data).digest('base64url');
  return {
    issue(input){const chart=calculate(input);const data=Buffer.from(JSON.stringify({v:1,exp:Date.now()+2*3600000,chart})).toString('base64url');return {chart,credential:data+'.'+mac(data)};},
    verify(token){
      if(typeof token!=='string'||token.length>10000) bad('请先生成日主卡');
      const [data,sig,...rest]=token.split('.');
      const a=Buffer.from(sig||''),b=Buffer.from(mac(data||''));
      if(rest.length || a.length!==b.length || !crypto.timingSafeEqual(a,b)) bad('日主结果无效，请重新计算');
      let body;try{body=JSON.parse(Buffer.from(data,'base64url').toString());}catch(_){bad('日主结果无效');}
      if(body.v!==1||body.exp<Date.now()||!STEMS.includes(body.chart?.dayMaster)) bad('日主结果已过期，请重新计算');
      return body.chart;
    }
  };
}
// 个人信息出境（PIPL）单独同意版本：文案或接收方/存储地变更时升版本，旧同意即失效需重新勾选。
const CROSS_BORDER_VERSION='xb-2026-11-09';
module.exports={calculate,createChartService,directions,STEMS,ZODIACS,bad,CROSS_BORDER_VERSION};
