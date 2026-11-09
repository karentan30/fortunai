'use strict';
// 相生 九型人格相配表：数据与规则来自 friends-enneagram-data.js；支持 ?type=1..9，登录用户用 /api/friends/me 预选自己的号码。全部用 textContent 渲染。
(()=>{
  const D=window.XiangshengEnneagramData;if(!D)return;
  const $=id=>document.getElementById(id);
  const el=(t,text,cls)=>{const x=document.createElement(t);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;};
  const pick=$('ec-pick'),types=$('ec-types'),result=$('ec-result'),quizBtn=$('ec-quiz');
  $('ec-lead').textContent=D.COPY.lead;$('ec-basis').textContent=D.COPY.basis;$('ec-disclaimer').textContent=D.COPY.disclaimer;
  const chips={};
  for(const t of D.ENNEAGRAMS){
    pick.append(new Option(D.label(t),t));
    const b=el('button',null,'ec-type');b.type='button';b.dataset.t=t;b.setAttribute('aria-pressed','false');
    b.append(el('b',t+'号'),el('span',D.TYPES[t].name));b.addEventListener('click',()=>select(t,true));
    types.append(b);chips[t]=b;
  }
  function select(t,fromTap){
    if(!D.ENNEAGRAMS.includes(t))return;
    pick.value=t;for(const k of D.ENNEAGRAMS)chips[k].setAttribute('aria-pressed',String(k===t));
    const info=D.TYPES[t],c=D.centerOf(t);
    const head=el('div',null,'ec-head');head.append(el('h2',D.label(t)+' · '+info.alias),el('p',info.portrait,'ec-portrait'),el('p','属于'+c.name+'：'+c.note+'。','mc-sub'));
    const tip=el('div',null,'ec-tip');tip.append(el('h3','相处提醒'),el('p',info.tip));
    result.replaceChildren(head);
    for(const g of D.groupsFor(t)){
      if(!g.items.length)continue;
      const box=el('div',null,'ec-group');box.dataset.k=g.key;box.append(el('h3',g.label+' · '+g.items.length+' 个号码'));
      const ul=el('ul');for(const it of g.items){const li=el('li');li.append(el('b',it.label),el('span',it.reason));ul.append(li);}
      box.append(ul);result.append(box);
    }
    result.append(tip,el('p','任何两个号码都可以好好相处，以上只是聊天时的参考。','mc-sub'));
    result.hidden=false;
    if(fromTap===true)result.scrollIntoView({behavior:'smooth',block:'start'});
    try{const u=new URL(location.href);u.searchParams.set('type',t);history.replaceState(null,'',u);}catch{}
  }
  pick.addEventListener('change',()=>{if(pick.value)select(pick.value);});
  if(window.XiangshengEnneagramQuiz?.open){quizBtn.hidden=false;quizBtn.addEventListener('click',()=>window.XiangshengEnneagramQuiz.open({onDone:t=>select(t),onClose:()=>quizBtn.focus()}));}
  const wanted=String(new URLSearchParams(location.search).get('type')||'').trim();
  if(D.ENNEAGRAMS.includes(wanted))select(wanted);
  else fetch('/api/friends/me',{credentials:'same-origin',cache:'no-store',headers:{'X-Runae-Friends':'1'}}).then(r=>r.ok?r.json():null).then(d=>{const m=String(d?.profile?.enneagram||'');if(D.ENNEAGRAMS.includes(m)&&!pick.value)select(m);}).catch(()=>{});
})();
