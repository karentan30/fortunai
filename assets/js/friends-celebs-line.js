'use strict';
// 测完日主后加一行「和你同是X的明星：A、B、C」，链接到明星日主库。不改 friends.js：
// 观察 #main，出现日主结果（#result 的 .reading-card 或 #hello-deck 的 .onb-me）时插入。只读公开静态数据。
(()=>{
  const main=document.getElementById('main');if(!main)return;
  const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],EL=[...'木木火火土土金金水水'];
  const ID={甲:'jia',乙:'yi',丙:'bing',丁:'ding',戊:'wu',己:'ji',庚:'geng',辛:'xin',壬:'ren',癸:'gui'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data=null,loading=null;
  const load=()=>loading||(loading=fetch('/assets/data/friends-celebs.json',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(d=>(data=d)).catch(()=>null));
  function target(){
    const card=main.querySelector('.result-wrap .reading-card');
    if(card)return {stem:(card.querySelector('.day-master')?.textContent||'').trim().charAt(0),after:card.querySelector('.tags')||card.querySelector('.element-line')};
    const me=main.querySelector('.onb-me');
    if(me)return {stem:(me.querySelector('.onb-me-glyph')?.textContent||'').trim().charAt(0),after:me};
    return null;
  }
  async function run(){
    const t=target();if(!t||!t.after||!STEMS.includes(t.stem)||main.querySelector('.celeb-line'))return;
    if(!data)await load();if(!data?.people)return;
    const t2=target();if(!t2||t2.stem!==t.stem||main.querySelector('.celeb-line'))return;
    // 优先挑不同类别的三位（演员、运动员、企业家…），顺序固定，便于复现。
    const all=data.people.filter(p=>p.dayMaster===t.stem),seen=new Set(),list=[];
    for(const p of all)if(list.length<3&&!seen.has(p.category)){seen.add(p.category);list.push(p);}
    for(const p of all)if(list.length<3&&!list.includes(p))list.push(p);
    if(!list.length)return;
    const sv=t.stem+EL[STEMS.indexOf(t.stem)];
    t2.after.insertAdjacentHTML('afterend',`<p class="celeb-line"><span class="celeb-names">和你同是${sv}的明星：${list.map(p=>`<a href="/pages/friends-celebs/${encodeURIComponent(p.slug)}.html">${esc(p.name)}</a>`).join('、')}</span><a class="celeb-more" href="/pages/friends-celebs.html#stem-${ID[t.stem]}">看全部 →</a></p>`);
  }
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});}).observe(main,{childList:true,subtree:true});
  run();
})();
