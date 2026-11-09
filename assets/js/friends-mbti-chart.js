'use strict';
// 相生 MBTI 性格相配表：数据与规则来自 friends-mbti-data.js；登录用户用 /api/friends/me 预选自己的类型，未登录则手动选。
(()=>{
  const D=window.XiangshengMbtiData;if(!D)return;
  const $=id=>document.getElementById(id);
  const MARK={4:'◆',3:'',2:'',1:''};
  const grid=$('mc-grid'),pick=$('mc-pick'),result=$('mc-result'),legend=$('mc-legend'),quizBtn=$('mc-quiz'),scroll=$('mc-scroll');
  const el=(t,text,cls)=>{const x=document.createElement(t);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;};
  legend.append(...[4,3,2,1].map(l=>{const li=el('li');li.append(el('span',MARK[l],'mc-sw'),document.createTextNode(D.LEVELS.find(x=>x.level===l).name));li.firstChild.dataset.l=l;return li;}));
  D.MBTIS.forEach(t=>pick.append(new Option(t,t)));
  grid.append(el('div','我↓ 他→','mc-corner'),...D.MBTIS.map(t=>{const h=el('div',t,'mc-h');h.setAttribute('role','columnheader');return h;}));
  const rows={};
  for(const a of D.MBTIS){
    const r=el('button',a,'mc-r');r.type='button';r.dataset.t=a;r.setAttribute('role','rowheader');r.setAttribute('aria-label','选择 '+a+'，查看它和各类型的相配情况');
    r.addEventListener('click',()=>select(a,true));grid.append(r);
    rows[a]=[r];
    for(const b of D.MBTIS){const l=D.level(a,b),c=el('div',MARK[l],'mc-c');c.dataset.l=l;c.setAttribute('role','gridcell');c.setAttribute('aria-label',a+' 和 '+b+'：'+D.LEVELS.find(x=>x.level===l).name);grid.append(c);rows[a].push(c);}
  }
  function select(t,fromTap){
    if(!D.MBTIS.includes(t))return;
    for(const k of D.MBTIS)rows[k].forEach(n=>n.classList.toggle('is-row',k===t));
    grid.classList.add('has-sel');pick.value=t;
    const r=rows[t][0];if(scroll){const top=r.offsetTop-34;if(fromTap!==true||top<scroll.scrollTop||top>scroll.scrollTop+scroll.clientHeight-80)scroll.scrollTo({top:Math.max(0,top-34),behavior:'smooth'});}
    renderList(t);
  }
  function renderList(t){
    result.hidden=false;result.replaceChildren(el('h2',t+' 和各类型'),el('p','按相配程度从高到低排列，每一档都可以认识。','mc-sub'));
    for(const g of D.groupsFor(t)){
      if(!g.items.length)continue;
      const box=el('div',null,'mc-lv'),h=el('h3');const sw=el('span',MARK[g.level],'mc-sw');sw.dataset.l=g.level;h.append(sw,document.createTextNode(g.name+' · '+g.items.length+' 种'));box.append(h);
      const ul=el('ul');for(const it of g.items){const li=el('li');li.append(el('b',it.type),el('span',it.reason));ul.append(li);}
      box.append(ul);result.append(box);
    }
  }
  pick.addEventListener('change',()=>{if(pick.value)select(pick.value);});
  if(window.XiangshengMbtiQuiz){quizBtn.hidden=false;quizBtn.addEventListener('click',()=>window.XiangshengMbtiQuiz.open({onDone:t=>select(t),onClose:()=>quizBtn.focus()}));}
  const wanted=new URLSearchParams(location.search).get('type');
  if(wanted&&D.MBTIS.includes(wanted.toUpperCase()))select(wanted.toUpperCase());
  else fetch('/api/friends/me',{credentials:'same-origin',cache:'no-store',headers:{'X-Runae-Friends':'1'}}).then(r=>r.ok?r.json():null).then(d=>{const m=String(d?.profile?.mbti||'').toUpperCase();if(D.MBTIS.includes(m)&&!pick.value)select(m);}).catch(()=>{});
})();
