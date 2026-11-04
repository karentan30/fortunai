'use strict';
// Entirely offline: coordinates -> IANA zone; birth-date Intl rules -> actual offset.
const path=require('node:path');
const crypto=require('node:crypto');
const fail=message=>{const e=Error(message);e.status=400;throw e;};
function defaultLookup(){return require('./vendor/tz-lookup');}
function createLocationService(rows,lookup){
  lookup=lookup||defaultLookup();
  if(!rows)rows=require(path.join(__dirname,'../data/city-coords.json'));
  const source=Array.isArray(rows)?rows:(rows.cities||rows.data||Object.values(rows));
  if(!Array.isArray(source))throw Error('城市资料格式无效');
  const normalize=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase();
  const cities=source.map(r=>{
    const lat=Number(r.lat),lng=Number(r.lng??r.lon);
    if(r.lat===null||r.lat===undefined||(r.lng??r.lon)===null||(r.lng??r.lon)===undefined||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('城市经纬度无效');
    // Mainland hospital records normally use official Beijing clock time, including Xinjiang.
    const regionalZones={'中国':'Asia/Shanghai','香港':'Asia/Hong_Kong','中国香港':'Asia/Hong_Kong','澳门':'Asia/Macau','中国澳门':'Asia/Macau','台湾':'Asia/Taipei','中国台湾':'Asia/Taipei'};
    const timeZone=regionalZones[r.country]||lookup(lat,lng);new Intl.DateTimeFormat('en',{timeZone}).format(0);
    const city=String(r.city||r.name||'').trim(),country=String(r.country||'').trim();if(!city)throw Error('城市名称缺失');
    const stableId='city-'+crypto.createHash('sha256').update(JSON.stringify([city,country,lat,lng])).digest('hex').slice(0,20);
    const publicRow={id:String(r.id??stableId),city,country,label:country?`${city} · ${country}`:city,lat,lng,timeZone};
    return {publicRow,search:normalize([city,country,...(Array.isArray(r.aliases)?r.aliases:[r.aliases||''])].join(' '))};
  });
  const byId=new Map(cities.map(x=>[x.publicRow.id,x.publicRow]));
  if(byId.size!==cities.length)throw Error('城市ID重复');
  const getById=id=>{const row=byId.get(String(id));return row?{...row}:null;};
  function searchCities(query,limit=20){const q=normalize(query);if(!q)return [];const n=Math.max(0,Math.min(50,Math.trunc(Number(limit)||20)));return cities.filter(x=>x.search.includes(q)).slice(0,n).map(x=>({...x.publicRow}));}
  function resolveBirthTime({year,month,day,hour,minute=0,cityId,disambiguation}={}){
    const location=getById(cityId);if(!location)fail('出生城市无匹配，请选择城市列表中的地点；当前仅覆盖常见城市');
    if(disambiguation!==undefined&&!['earlier','later','reject'].includes(disambiguation))fail('重复时间选择无效，请选择earlier或later');
    const timeKnown=hour!==null&&hour!==undefined&&hour!=='';
    if(![year,month,day].every(Number.isInteger)||year<1900||year>2100)fail('出生日期无效');
    const h=timeKnown?Number(hour):12,m=timeKnown?Number(minute):0;
    if(!Number.isInteger(h)||h<0||h>23||!Number.isInteger(m)||m<0||m>59)fail('出生时间无效');
    const wall=Date.UTC(year,month-1,day,h,m),date=new Date(wall);
    if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)fail('出生日期不存在');
    const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:location.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const parts=instant=>{const values={};for(const p of fmt.formatToParts(new Date(instant)))if(p.type!=='literal')values[p.type]=Number(p.value);return values;};
    const localEpoch=instant=>{const p=parts(instant);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);};
    const offsets=new Set();
    for(let delta=-36*60;delta<=36*60;delta+=30){const t=wall+delta*60000;offsets.add((localEpoch(t)-t)/60000);}
    const candidates=[...offsets].map(offsetMinutes=>({value:wall-offsetMinutes*60000,offsetMinutes})).filter(x=>localEpoch(x.value)===wall).sort((a,b)=>a.value-b.value);
    if(!candidates.length)fail('该城市此时间因夏令时或历史时区调整而不存在，请核对当地出生时间');
    if(candidates.length>1&&(!disambiguation||disambiguation==='reject'))fail('该城市此时间重复出现，请选择earlier（第一次）或later（第二次）');
    const chosen=disambiguation==='later'?candidates[candidates.length-1]:candidates[0];
    return {instant:new Date(chosen.value).toISOString(),offsetMinutes:chosen.offsetMinutes,location,timeKnown,localTime:{year,month,day,hour:h,minute:m}};
  }
  return {searchCities,getById,resolveBirthTime};
}
let service;const current=()=>service||(service=createLocationService());
module.exports={createLocationService,searchCities:(...a)=>current().searchCities(...a),getById:(...a)=>current().getById(...a),resolveBirthTime:(...a)=>current().resolveBirthTime(...a)};
