'use strict';
// 公开相亲名片：不用登录。服务端只给白名单字段（见 server/lib/friends-join-card.js），这里只负责画出来。
// 审核通过前：只有昵称 + 资料审核中 + 一个按钮。永远不会出现原始问卷答案，问卷只显示方向名称。
(()=>{
 const host=document.querySelector('#cd-host');
 const h=(tag,attrs,...kids)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else n.setAttribute(k,v===true?'':v);}for(const k of kids.flat()){if(k==null)continue;n.append(typeof k==='string'?document.createTextNode(k):k);}return n;};
 const id=new URLSearchParams(location.search).get('c')||'';
 const PERS={mbti:'MBTI',enneagram:'九型',constellation:'星座'};
 const row=(k,v)=>h('li',{},h('b',{text:k}),v);
 function pairButton(){return h('a',{class:'cd-cta',href:'/pages/friends-compatibility.html?start=friend&target='+encodeURIComponent(id),text:'测测我们是否相配'});}
 function render(c){
  const card=h('section',{class:'cd-card'},h('p',{class:'cd-eyebrow',text:'相 生 · 相 亲 名 片'}),h('h1',{class:'cd-name',text:c.nickname}));
  if(c.status!=='approved'){card.append(h('p',{class:'cd-pending',text:c.note||'资料审核中'}));host.replaceChildren(card,pairButton());return;}
  const rows=h('ul',{class:'cd-rows'});
  if(c.dayMaster)rows.append(row('日主',h('span',{text:c.dayMaster})));
  if(c.intro)rows.append(row('自我介绍',h('span',{text:c.intro})));
  if(c.city)rows.append(row('城市',h('span',{text:c.city})));
  if(c.birthday)rows.append(row('生日',h('span',{text:c.birthday+(c.hour?' '+c.hour:'')})));
  for(const [k,v] of Object.entries(c.personality||{}))rows.append(row(PERS[k]||k,h('span',{text:v})));
  if(c.directions?.length)rows.append(row('回答过的方向',h('span',{class:'cd-dirs'},c.directions.map(d=>h('i',{text:d})))));
  if(c.contact)rows.append(row('联系方式',h('span',{text:c.contact})));
  card.append(rows);
  if(c.photos?.length)card.append(h('div',{class:'cd-photos'},c.photos.map(p=>h('img',{src:p.url,alt:'照片',loading:'lazy',referrerpolicy:'no-referrer'}))));
  host.replaceChildren(card,pairButton(),h('p',{class:'cd-fine',text:'名片只显示本人选择公开的内容，问卷只显示方向名称，不显示答案。'}));
 }
 async function init(){
  try{const r=await fetch('/api/friends/public-card/'+encodeURIComponent(id),{cache:'no-store',referrerPolicy:'no-referrer',headers:{'X-Runae-Friends':'1'}});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.error||'这张名片暂时看不到了');render(v.card||v);}
  catch(e){host.replaceChildren(h('section',{class:'cd-card'},h('h1',{class:'cd-name',text:'名片暂时看不到'}),h('p',{class:'cd-pending',text:e.message})));}
 }
 init();
})();
