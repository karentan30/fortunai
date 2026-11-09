'use strict';
// 相生 guest onboarding: #hello (why 相生) → #hello-birth (existing 日主 form) → #hello-deck (teaser deck of real people)
// → 想认识TA → existing auth dialog → profile from guest draft → discover with that person's card opened.
// Talks to friends.js only through window.XiangshengFriendsBridge. Guests only ever receive teaser fields
// (see server/lib/friends-preview-deck.js); tokens are per-response and opaque.
(() => {
  const PENDING='xs_onb_pending_v1',MBTI_KEY='xs_onb_mbti_v1';
  const MBTIS=['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
  const MBTI_PAIRS=['E/I','N/S','T/F','J/P'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STEMS=[...'甲乙丙丁戊己庚辛壬癸'],ELEMENTS=[...'木火土金水'],TONES=['wood','fire','earth','metal','water'];
  const idx=stem=>Math.floor(STEMS.indexOf(stem)/2);
  const PURPOSE_KEYS={'找搭子':'buddy','交朋友·闺蜜':'buddy','享受恋爱':'dating','认真结婚':'serious','享受甜甜的恋爱':'dating','认真考虑婚恋':'serious','已婚 · 只找搭子':'married_buddy'};
  const RELATION_TEXT={generates_me:'生你',i_generate:'你生',same:'同类',different:''};
  const CITIES=['北京','上海','广州','深圳','杭州','成都','南京','武汉','西安','苏州','重庆','天津','长沙','厦门','香港'];
  let lastView='',deckCity='',swiped=false,lastCards=[];
  const B=()=>window.XiangshengFriendsBridge;
  // Visitor's MBTI pick ('' = skipped / not chosen). Only kept for this browser session.
  const myMbti={get(){try{const v=sessionStorage.getItem(MBTI_KEY)||'';return MBTIS.includes(v)?v:'';}catch{return '';}},set(v){try{sessionStorage.setItem(MBTI_KEY,MBTIS.includes(v)?v:'skip');}catch{}},picked(){try{return !!sessionStorage.getItem(MBTI_KEY);}catch{return false;}}};
  // Short, factual type hints for a card: only compares the visitor's own MBTI / 星座 with what the card publicly shows.
  function mbtiHint(mine,theirs){
    if(!MBTIS.includes(mine)||!MBTIS.includes(theirs))return '';
    if(mine===theirs)return '同为'+mine;
    const diff=[0,1,2,3].filter(k=>mine[k]!==theirs[k]);
    if(diff.length!==1)return '';
    return MBTI_PAIRS[diff[0]]+' 互补';
  }
  // 星座 pair hint from classic Western-astrology groupings — a fun culture reference, never a relationship claim.
  // Same sign → 同为X座; opposite sign (6 apart) → 对宫; same element → 同属X象; fire+air → 风火相投; earth+water → 水土相合; else ''.
  const SIGNS=['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'],SIGN_ELEMENTS=['火','土','风','水'];
  const signIdx=v=>SIGNS.indexOf(String(v||'').replace(/座$/,''));
  function signHint(mine,theirs){
    const a=signIdx(mine),b=signIdx(theirs);if(a<0||b<0)return '';
    if(a===b)return '同为'+SIGNS[a]+'座';
    if((a+6)%12===b)return '对宫星座，互补';
    const ea=SIGN_ELEMENTS[a%4],eb=SIGN_ELEMENTS[b%4];
    if(ea===eb)return '同属'+ea+'象';
    const pair=ea+eb;
    if(pair==='火风'||pair==='风火')return '风火相投';
    if(pair==='土水'||pair==='水土')return '水土相合';
    return '';
  }
  // e.g. 「双子 × 天秤 · 同属风象」 for the card detail; '' when there is no hint.
  function signPairText(mine,theirs){const h=signHint(mine,theirs);return h?SIGNS[signIdx(mine)]+' × '+SIGNS[signIdx(theirs)]+' · '+h:'';}
  function typeHints(me,card){
    const out=[],m=mbtiHint(me?.mbti,card?.mbti);if(m)out.push(m);
    const c=signHint(me?.constellation,card?.constellation);if(c)out.push(c);
    return out;
  }
  const pending={get(){try{return JSON.parse(sessionStorage.getItem(PENDING)||'null');}catch{return null;}},set(v){try{sessionStorage.setItem(PENDING,JSON.stringify(v));}catch{}},clear(){try{sessionStorage.removeItem(PENDING);}catch{}}};

  function intro(){
    const b=B();b.setView(`<section class="onb onb-intro"><p class="onb-step">相生 · 认识新朋友</p>
      <h1 class="onb-title">合得来的人，<br>约着一起做件事。</h1>
      <ul class="onb-points">
        <li><b>不靠刷脸</b><span>按日主、MBTI、星座认识人</span></li>
        <li><b>不止吃饭</b><span>一起打羽毛球、徒步，边玩边认识</span></li>
        <li><b>双方同意</b><span>都点头了，才互相看到联系方式</span></li>
      </ul>
      <a class="primary onb-cta" href="#hello-birth">填生日，看谁和我相生</a>
      <p class="onb-note">不用注册就能看。生日只用来算日主，不会公开。</p>
      ${b.state.user?'':'<p class="onb-login">已有账号？<a href="#login">登录</a></p>'}</section>`);
    b.event('onboarding_view');
  }

  function birth(){
    const b=B();b.showStart();
    const main=document.getElementById('main');main.classList.add('onb-birth-mode');
    const hero=main.querySelector('.landing');if(hero)hero.insertAdjacentHTML('afterbegin','<p class="onb-step onb-step-inline">第 1 步，共 2 步 · 先测日主</p>');
    main.querySelectorAll('.landing-samples,.xh-mkt').forEach(n=>n.remove());
  }

  function cardHTML(c,i,total,me){
    const tone=TONES[idx(c.dayMaster)]||'',rel=RELATION_TEXT[c.relation]||'',hints=typeHints(me,c);
    const facts=[c.ageBracket&&c.ageBracket+'岁',c.city,c.jobCategory].filter(Boolean);
    const types=[c.mbti,c.constellation,c.zodiac&&'属'+c.zodiac].filter(Boolean);
    const action=c.sample?`<p class="onb-sample-label">${esc(c.label)}</p>`:`<button type="button" class="primary onb-meet" data-index="${i}">想认识TA</button>`;
    return `<article class="onb-card${c.sample?' is-sample':''}" data-element="${tone}" role="group" aria-roledescription="卡片" aria-label="第${i+1}张，共${total}张">
      ${c.sample?'<span class="onb-badge">虚构示例</span>':'<span class="onb-badge is-real">真实用户</span>'}
      <div class="onb-card-head"><div class="onb-glyph">${esc(c.dayMaster)}<small>${esc(c.element)}</small></div>
        <div class="onb-card-meta">${rel||hints.length?`<p class="onb-rels">${rel?`<span class="onb-rel">${rel==='同类'?'和你同属'+esc(c.element):esc(rel==='生你'?c.element+'生你':'你生'+c.element)}</span>`:''}${hints.map(h=>`<span class="onb-rel onb-hint">${esc(h)}</span>`).join('')}</p>`:''}
        <p class="onb-facts">${facts.map(f=>'<span>'+esc(f)+'</span>').join('<i aria-hidden="true"> · </i>')||'资料未公开'}</p></div></div>
      ${types.length?`<div class="onb-chips">${types.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
      ${c.purposeLabels?.length?`<p class="onb-purpose">${c.purposeLabels.map(esc).join('、')}</p>`:''}
      ${c.hobbies?.length?`<p class="onb-hobbies"><span>想一起</span>${c.hobbies.map(esc).join(' · ')}</p>`:''}
      ${action}</article>`;
  }

  async function deck(prev){
    const b=B(),chart=b.state.chart||b.state.profile?.chart;
    if(!chart){location.hash='hello-birth';return;}
    if(prev==='hello-birth')b.event('chart_done');
    const stem=chart.dayMaster,i=idx(stem),el=ELEMENTS[i];
    const mother=ELEMENTS[(i+4)%5],child=ELEMENTS[(i+1)%5];
    deckCity=deckCity||b.state.profile?.city||'';
    b.setView(`<section class="onb onb-deck-wrap"><p class="onb-step">看看和你相生的人</p>
      <div class="onb-me" data-element="${TONES[i]}"><div class="onb-me-glyph">${esc(stem)}</div>
        <div><h1 class="onb-me-title">你是${esc(stem+el)}</h1>
          <p class="onb-me-types">${[chart.constellation,chart.zodiac&&'属'+chart.zodiac].filter(Boolean).map(t=>'<span>'+esc(t)+'</span>').join('')}<span id="onb-me-mbti"${myMbti.get()?'':' hidden'}>${esc(myMbti.get())}</span></p>
          <p class="onb-me-text">${esc(mother)}生${esc(el)}，${esc(el)}生${esc(child)}。下面先排和你相生的人。</p></div></div>
      <div class="onb-mbti" id="onb-mbti"></div>
      <div class="onb-deck-bar"><label class="onb-city"><span>城市</span><select id="onb-city"><option value="">不限</option>${CITIES.map(c=>`<option ${c===deckCity?'selected':''}>${c}</option>`).join('')}</select></label>
        <span class="onb-count" id="onb-count" aria-live="polite"></span></div>
      <div class="onb-deck" id="onb-deck" tabindex="0" aria-label="和你相生的人，左右滑动"><p class="loading">正在找和你相生的人…</p></div>
      <div class="onb-nav"><button type="button" class="secondary onb-prev" aria-label="上一张">上一张</button><button type="button" class="secondary onb-next" aria-label="下一张">下一张</button></div>
      <p class="onb-note">只显示本人公开的日主、年龄段和爱好，<br>不显示名字、照片和学校。</p></section>`);
    document.getElementById('onb-city').addEventListener('change',e=>{deckCity=e.target.value;loadDeck(stem);});
    renderMbti(myMbti.picked());
    await loadDeck(stem);
  }

  // Optional MBTI pick: 16 compact chips + skip. Collapses to one line once answered.
  function renderMbti(collapsed){
    const box=document.getElementById('onb-mbti');if(!box)return;
    const cur=myMbti.get(),tag=document.getElementById('onb-me-mbti');
    if(tag){tag.textContent=cur;tag.hidden=!cur;}
    if(collapsed){
      box.innerHTML=`<p class="onb-mbti-done">${cur?'你的 MBTI：<b>'+esc(cur)+'</b>':'没选 MBTI'}<button type="button" class="text-button onb-mbti-edit">${cur?'改':'补选'}</button></p>`;
      box.querySelector('.onb-mbti-edit').onclick=()=>renderMbti(false);return;
    }
    box.innerHTML=`<p class="onb-mbti-q">你的 MBTI？<span>选了会显示和谁同类型，可不选</span></p>
      <div class="onb-mbti-grid" role="group" aria-label="选择你的 MBTI">${MBTIS.map(t=>`<button type="button" class="onb-mbti-chip" data-mbti="${t}" aria-pressed="${t===cur}">${t}</button>`).join('')}</div>
      ${window.XiangshengMbtiQuiz?'<button type="button" class="secondary onb-mbti-quiz">不知道？1 分钟测一下</button>':''}
      <button type="button" class="text-button onb-mbti-skip">${window.XiangshengMbtiQuiz?'先跳过':'不知道，跳过'}</button>`;
    box.querySelectorAll('.onb-mbti-chip').forEach(btn=>btn.addEventListener('click',()=>{myMbti.set(btn.dataset.mbti);renderMbti(true);renderCards();}));
    box.querySelector('.onb-mbti-skip').onclick=()=>{myMbti.set('');renderMbti(true);renderCards();};
    const quiz=box.querySelector('.onb-mbti-quiz');
    if(quiz)quiz.onclick=()=>window.XiangshengMbtiQuiz.open({onDone:t=>{myMbti.set(t);renderMbti(true);renderCards();},onClose:()=>box.querySelector('.onb-mbti-quiz')?.focus()});
  }
  function me(){const b=B(),chart=b.state.chart||b.state.profile?.chart;return {mbti:myMbti.get(),constellation:chart?.constellation||''};}

  async function loadDeck(stem){
    const b=B(),box=document.getElementById('onb-deck');if(!box)return;
    let data;
    try{data=await b.api('/api/friends/preview?stem='+encodeURIComponent(stem)+(deckCity?'&city='+encodeURIComponent(deckCity):''));}
    catch(error){box.innerHTML=`<p class="onb-error">${esc(error.message||'暂时打不开，请稍后再试')}</p>`;return;}
    lastCards=data.cards||[];renderCards();
  }

  // Re-rendered when the visitor picks an MBTI, so handlers always read the live card list.
  function renderCards(){
    const b=B(),box=document.getElementById('onb-deck'),cards=lastCards;if(!box)return;
    if(!cards.length){box.innerHTML='<p class="onb-error">这里还没有人公开资料。先建好你的卡片，有人加入时你会排在前面。</p>';return;}
    const keep=box.scrollLeft,mine=me();
    box.innerHTML=cards.map((c,i)=>cardHTML(c,i,cards.length,mine)).join('');box.scrollLeft=keep;
    const items=()=>[...box.querySelectorAll('.onb-card')];
    const current=()=>{const it=items();return it.length?Math.round(box.scrollLeft/Math.max(1,it[0].offsetWidth+12)):0;};
    const update=()=>{const it=items(),count=document.getElementById('onb-count');if(!it.length||!count)return;const n=Math.min(it.length-1,current());count.textContent=(n+1)+' / '+it.length;document.querySelector('.onb-prev').disabled=n<=0;document.querySelector('.onb-next').disabled=n>=it.length-1;};
    const markSwipe=()=>{if(!swiped){swiped=true;b.event('deck_swipe');}};
    const go=d=>{const it=items();if(!it.length)return;const n=Math.max(0,Math.min(it.length-1,current()+d));box.scrollTo({left:it[n].offsetLeft-it[0].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});markSwipe();};
    if(!box.dataset.bound){
      box.dataset.bound='1';
      let t;box.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(()=>{update();if(box.scrollLeft>8)markSwipe();},80);},{passive:true});
      box.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}});
    }
    document.querySelector('.onb-prev').onclick=()=>go(-1);document.querySelector('.onb-next').onclick=()=>go(1);
    box.querySelectorAll('.onb-meet').forEach(btn=>btn.addEventListener('click',()=>wantToMeet(cards[Number(btn.dataset.index)])));
    box.querySelectorAll('.onb-card:not(.is-sample)').forEach(card=>card.addEventListener('click',e=>{if(!e.target.closest('button'))card.querySelector('.onb-meet')?.click();}));
    update();
  }

  function wantToMeet(card){
    const b=B();if(!card||card.sample||!card.token)return;
    b.event('want_to_meet_click');
    pending.set({token:card.token,purpose:PURPOSE_KEYS[card.purposeLabels?.[0]]||'',city:deckCity,at:Date.now()});
    if(b.state.user){continueFlow();return;}
    b.openAuth();
    document.querySelector('[data-auth-mode="register"]')?.click();
    const note=document.querySelector('#auth-dialog .muted');
    if(note)note.textContent='注册后补全你的卡片，就能向TA发出认识申请。对方同意后，你们才互相看到联系方式。';
  }

  // Called by friends.js after a successful login/register. Returns true when the onboarding flow takes over navigation.
  function afterAuth(mode){
    const p=pending.get();if(!p)return false;
    if(mode==='register')B().event('signup_done');
    continueFlow();return true;
  }
  function continueFlow(){
    const b=B(),s=b.state,p=pending.get()||{};
    if(s.profile?.listed){location.hash='discover';return;}
    if(!s.profile&&!s.guestProfileDraft){
      // Reuse the existing guest-draft mechanism: showProfile() reads state.guestProfileDraft for this user.
      s.guestProfileDraft={ownerId:s.user?.id||null,data:{city:p.city||'',mbti:myMbti.get(),purposes:p.purpose?[p.purpose]:[],fields:{},visibility:{},hobbies:[],listed:true,contactConsent:false}};
    }
    if(location.hash==='#profile')b.showProfile();else location.hash='profile';
    b.toast('补全并公开你的卡片，就能向TA申请认识。');
  }

  async function openPending(){
    const b=B(),p=pending.get();pending.clear();if(!p?.token)return;
    try{const r=await b.api('/api/friends/preview/resolve/'+encodeURIComponent(p.token));b.showDetail(r.shareId);}
    catch{b.toast('刚才那位暂时看不到了，先看看其他人。');}
  }

  // Router hook: handles hello* views and the post-signup continuation. Returns true when it handled the view.
  async function route(view){
    const prev=lastView;lastView=view;
    document.getElementById('main')?.classList.toggle('onb-birth-mode',view==='hello-birth');
    if(view==='hello'){intro();return true;}
    if(view==='hello-birth'){birth();return true;}
    if(view==='hello-deck'){await deck(prev);return true;}
    const p=pending.get();if(!p)return false;
    if(Date.now()-(p.at||0)>3600000){pending.clear();return false;}
    const s=B().state;
    if(view==='poster'&&s.profile?.listed){location.hash='discover';return true;}
    if(view==='poster'){pending.clear();return false;}
    if(view==='discover'&&s.profile?.listed){await B().showDiscover();await openPending();return true;}
    return false;
  }
  window.XiangshengOnboarding={route,afterAuth,signHint,signPairText,_test:{mbtiHint,typeHints,signHint,signPairText}};
})();
