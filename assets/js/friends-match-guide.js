'use strict';
// 相生 · 日主/星座相合指南页面渲染。文案全部来自 friends-match-guide-data.js；这里只拼 DOM（textContent，不拼 HTML）。
(function(){
  const D=window.XiangshengMatchGuideData;if(!D)return;
  const $=id=>document.getElementById(id);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const C=D.COPY;
  for(const [id,key] of [['mg-lead','lead'],['mg-stem-intro','stemIntro'],['mg-pick-label','pickerLabel'],['mg-pick-hint','pickerHint'],['mg-pick-link','pickerLink'],['mg-sign-intro','signIntro'],['mg-mbti','mbti'],['mg-mbti-link','mbtiLink'],['mg-close','close'],['mg-q-link','questionsLink'],['mg-d-link','discoverLink'],['mg-foot','fine']])$(id).textContent=C[key];

  // 01 日主
  const pick=$('mg-pick'),list=$('mg-stems'),cards={};
  // 一律带五行显示（甲木、癸水…），方便记。
  const EL=Object.fromEntries(D.STEMS.map(x=>[x.stem,D.ELEMENTS[x.element]])),full=st=>st+(EL[st]||'');
  for(const s of D.STEMS){
    const elName=D.ELEMENTS[s.element];
    const b=el('button',full(s.stem),'mg-chip');b.type='button';b.dataset.stem=s.stem;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',s.stem+(s.yin?'（阴':'（阳')+elName+'）');
    b.addEventListener('click',()=>choose(s.stem,true));pick.append(b);

    const d=el('details',null,'mg-card');d.id='stem-'+s.stem;d.dataset.element=s.element;
    const sum=el('summary',null,'mg-sum');
    sum.append(el('span',s.stem,'mg-glyph'),(()=>{const t=el('span',null,'mg-sum-txt');t.append(el('b',full(s.stem)+' · '+(s.yin?'阴':'阳')+elName),el('small',s.image));return t;})(),el('span','+','mg-plus'));
    d.append(sum);
    const body=el('div',null,'mg-card-body');
    body.append(el('p',s.portrait,'mg-portrait'));
    for(const g of D.groupsFor(s.stem)){
      const row=el('div',null,'mg-group');row.dataset.key=g.key;
      const h=el('h4',null);h.append(el('span',g.label,'mg-g-label'),el('span',g.stems.map(full).join(' '),'mg-g-stems'));
      row.append(h,el('p',g.feel));body.append(row);
    }
    d.append(body);list.append(d);cards[s.stem]=d;
    d.addEventListener('toggle',()=>{if(d.open)mark(s.stem);});
  }
  function mark(stem){for(const b of pick.children)b.setAttribute('aria-pressed',String(b.dataset.stem===stem));}
  function choose(stem,scroll){
    for(const [k,c] of Object.entries(cards))c.open=k===stem;mark(stem);
    if(scroll)cards[stem].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
    try{history.replaceState(null,'','#stem-'+stem);}catch(_){}
  }
  const fromHash=decodeURIComponent(location.hash.replace(/^#stem-/,''));
  if(cards[fromHash])choose(fromHash,false);

  // 02 星座
  const signs=$('mg-signs');
  for(const e of D.SIGN_ELEMENTS){
    const comp=D.SIGN_ELEMENTS[e.complement];
    const a=el('article',null,'mg-el');a.dataset.el=e.key;
    const h=el('h3',null);h.append(el('span',e.name,'mg-el-name'),el('span',e.signs.join(' · '),'mg-el-signs'));
    a.append(h,el('p',e.portrait,'mg-portrait'));
    const dl=el('dl',null,'mg-pairs');
    dl.append(el('dt','同频 · 同为'+e.name),el('dd',e.same),el('dt','互补 · '+comp.name+'（'+comp.signs.join('、')+'）'),el('dd',e.complementNote));
    a.append(dl);signs.append(a);
  }

  // 03 MBTI 小测：做完给一个直达相配表的链接（相配表支持 ?type=）
  const quiz=$('mg-quiz'),out=$('mg-quiz-result');
  if(window.XiangshengMbtiQuiz){quiz.hidden=false;quiz.addEventListener('click',()=>window.XiangshengMbtiQuiz.open({onDone:t=>{
    out.textContent='';out.append(document.createTextNode('你的类型参考：'),el('b',t),document.createTextNode('。'));
    const a=el('a','看 '+t+' 和谁聊得来','mg-arrow');a.href='/pages/friends-mbti-chart.html?type='+encodeURIComponent(t);out.append(a);out.hidden=false;a.focus();
  },onClose:()=>quiz.focus()}));}
})();
