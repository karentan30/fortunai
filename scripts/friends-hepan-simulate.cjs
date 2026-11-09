#!/usr/bin/env node
'use strict';
// 相生合盘 v4 分数校准：1 万对随机生辰（1970–2005，约 15% 不知时辰，性别随机），
// 搜索基础分让中位数≈70，再按 30/50/20 比例定「很合拍/大体合拍/磨合型」阈值。
// 用法：node scripts/friends-hepan-simulate.cjs [--n 10000] [--seed 20261109] [--write]
// --write 会把 base / thresholds / calibration 写回 server/lib/friends-hepan-config.json。
const fs=require('node:fs'),path=require('node:path');
const {Solar}=require('../server/lib/bazi-engine/vendor/lunar-typescript');
const E=require('../server/lib/friends-hepan-v4');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const N=Number(opt('--n',10000)),SEED=Number(opt('--seed',20261109)),WRITE=args.includes('--write');
const CONFIG_PATH=path.join(__dirname,'../server/lib/friends-hepan-config.json');
let s=SEED>>>0;const rand=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const ri=(lo,hi)=>lo+Math.floor(rand()*(hi-lo+1));
function person(){
 const start=Date.UTC(1970,0,1),end=Date.UTC(2005,11,31),d=new Date(start+Math.floor(rand()*(end-start)/864e5)*864e5);
 const unknown=rand()<0.15,hour=unknown?12:ri(0,23),ec=Solar.fromYmdHms(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),hour,ri(0,59),0).getLunar().getEightChar();
 return {gender:rand()<0.5?'male':'female',pillars:{year:ec.getYear(),month:ec.getMonth(),day:ec.getDay(),hour:unknown?null:ec.getTime()}};
}
const pairs=Array.from({length:N},()=>[person(),person(),rand()<0.1?'buddy':'romance']);
const pct=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.floor(p*sorted.length)))];
function run(base){const cfg={...E.CONFIG,base};return pairs.map(([a,b,p])=>E.analyze(a,b,{purpose:p,config:cfg}).total).sort((x,y)=>x-y);}
// 中位数同样接近 70 时，取离 PRD 基础分 15 最近的那档（分数是 4 分一跳，68 和 72 只能二选一）。
let best=null;
for(let base=8;base<=22;base+=0.5){const t=run(base),m=pct(t,0.5);if(process.env.HEPAN_SIM_DEBUG)console.error('base',base,'median',m);if(!best||Math.abs(m-70)<Math.abs(best.median-70)||Math.abs(m-70)===Math.abs(best.median-70)&&Math.abs(base-15)<Math.abs(best.base-15))best={base,median:m,totals:t};}
const t=best.totals;
// 很合拍=前 30%（70 分位起），磨合型=后 20%（20 分位以下），其余大体合拍。
// 分数是离散的，直接取分位会被并列分数带偏；在所有候选分数里挑最接近目标比例的那条线。
const uniq=[...new Set(t)],closest=(f,target)=>uniq.reduce((b,v)=>Math.abs(f(v)-target)<Math.abs(f(b)-target)?v:b,uniq[0]);
const great=closest(v=>t.filter(x=>x>=v).length/N,0.3),fine=closest(v=>t.filter(x=>x<v).length/N,0.2);
const share=(f)=>Math.round(t.filter(f).length/N*1000)/10;
const result={base:best.base,median:best.median,thresholds:{great,fine},
 shares:{great:share(x=>x>=great),fine:share(x=>x>=fine&&x<great),grind:share(x=>x<fine)},
 min:t[0],max:t[t.length-1],p10:pct(t,0.1),p90:pct(t,0.9),n:N,seed:SEED};
console.log(JSON.stringify(result,null,1));
if(WRITE){
 const cfg=JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'));
 Object.assign(cfg,{base:best.base,thresholds:{great,fine},calibration:{script:'scripts/friends-hepan-simulate.cjs',n:N,seed:SEED,median:best.median,shares:result.shares,min:result.min,max:result.max,p10:result.p10,p90:result.p90,note:'1970-2005 随机生辰，15% 不知时辰，10% 搭子目的；分数是传统规则计分，不是概率。'}});
 fs.writeFileSync(CONFIG_PATH,JSON.stringify(cfg,null,2)+'\n');
 console.log('wrote',CONFIG_PATH);
}
