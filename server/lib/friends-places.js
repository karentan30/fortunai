'use strict';
const fs=require('node:fs'),path=require('node:path');
const bad=message=>{const e=Error(message);e.status=400;throw e;};
function normalizeResidence(value){
  if(value===null)return null;
  if(!value||value.consent!==true)bad('请单独同意使用大致位置生成见面建议');
  const label=typeof value.label==='string'?value.label.trim().slice(0,80):'';
  if(!label||!['device','area'].includes(value.source))bad('请确认常住附近的大致位置');
  if(typeof value.lat!=='number'||typeof value.lng!=='number'||!Number.isFinite(value.lat)||!Number.isFinite(value.lng)||Math.abs(value.lat)>90||Math.abs(value.lng)>180)bad('请选择已定位的大致位置，文字地址不等于已完成定位');
  return {label,lat:Math.round(value.lat*100)/100,lng:Math.round(value.lng*100)/100,source:value.source,precision:'approximate-area',consentAt:new Date().toISOString()};
}
function places(){const file=path.join(__dirname,'../data/friends-beijing-places.json');if(!fs.existsSync(file))return[];const rows=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(rows)?rows:rows.places||[];}
function searchAreas(query){const q=String(query||'').trim().toLowerCase();if(!q)return[];const publicAreas=places().map(p=>({id:'area-'+p.id,label:p.name+'附近',city:p.city,lat:p.lat,lng:p.lng}));const cities=require('../data/city-coords.json').map((p,i)=>({id:'city-center-'+i,label:p.city+'市中心（大致位置）',city:p.city,lat:p.lat,lng:p.lng}));return [...publicAreas,...cities].filter(p=>(p.label+' '+p.city).toLowerCase().includes(q)).slice(0,15);}
const km=(a,b)=>{const r=Math.PI/180,la=(b.lat-a.lat)*r,lo=(b.lng-a.lng)*r,s=Math.sin(la/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(lo/2)**2;return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));};
function suggestPlaces(a,b){
  if(!a?.residence||!b?.residence)return{places:[],locationReady:false,note:'双方填写并同意使用大致常住位置后，再推荐公共见面区域。'};
  const first=a.residence,second=b.residence;if(km(first,second)>100)return{places:[],locationReady:true,note:'你们暂不适合按同城中点安排；可以先在微信认识。'};
  const interests=new Set([...(a.hobbies||[]),...(b.hobbies||[])]);
  const candidates=places().filter(p=>typeof p.lat==='number'&&typeof p.lng==='number'&&Math.max(km(first,p),km(second,p))<=50)
    .map(p=>({p,cost:Math.max(km(first,p),km(second,p))+Math.abs(km(first,p)-km(second,p))*0.3-(p.activities||[]).filter(x=>interests.has(x)).length*2}))
    .sort((x,y)=>x.cost-y.cost).slice(0,3).map(({p})=>({id:p.id,name:p.name,category:p.category,activities:p.activities,sourceUrl:p.sourceUrl,note:p.note||'公共区域候选；实际路线、开放及费用请向官方核对。'}));
  // Deliberately do not return the exact midpoint or either origin/distance: a midpoint reveals the other origin algebraically.
  return{places:candidates,locationReady:true,note:candidates.length?'按大致位置均衡与兴趣给出公共区域候选，不是实时店铺列表或预订确认；开放与路线请双方核对。':'这个地区还没有经过整理的公共地点候选，可以先在微信商量。'};
}
module.exports={normalizeResidence,searchAreas,suggestPlaces};
