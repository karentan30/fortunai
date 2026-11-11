'use strict';
// 出生信息带入：本人建档时已同意保存生辰的，命盘/合盘页直接带出来，不再让人重填一遍。
// 只读本人资料；未登录或没存过生辰时静默返回 null。
(()=>{
 let pending=null;
 function load(){
  if(!pending)pending=fetch('/api/friends/intake/',{credentials:'same-origin',cache:'no-store',headers:{'X-Runae-Friends':'1'}})
   .then(r=>r.ok?r.json():null).catch(()=>null)
   .then(v=>{const b=v&&v.intake&&v.intake.birthInput;return b&&/^\d{4}-\d{2}-\d{2}$/.test(String(b.birthday||''))?b:null;});
  return pending;
 }
 async function city(id){
  if(!id)return null;
  try{
   const r=await fetch('/api/friends/cities?id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store',headers:{'X-Runae-Friends':'1'}});
   const v=await r.json();
   return r.ok&&v&&Array.isArray(v.cities)&&v.cities[0]?v.cities[0]:null;
  }catch(_){return null;}
 }
 window.XsBirthPrefill={load,city};
})();
