'use strict';
// 找朋友页的会员条：今日认识申请余量 · 谁看过我的卡片 · 会员筛选（学历/收入/房车/已核验）。
// 服务端才是权限真相：免费用户带筛选参数会被 403；这里只负责展示和锁定。
(()=>{
  const EDU=[['本科','本科及以上'],['硕士','硕士及以上'],['博士','博士']];
  const INCOME=[['10–30万','年入10万以上'],['30–50万','年入30万以上'],['50–100万','年入50万以上'],['100–300万','年入100万以上']];
  const TOGGLES=[['house','有房','有房'],['car','有车','有车'],['verified','1','已核验']];
  const LOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const st={root:null,reload:null,openCard:null,member:false,picked:{},quota:null,viewers:null,open:false,salesOpen:false};
  // 会员没开卖时不把人引到死胡同：只在会员筛选下方说一次「会员即将开放」。
  const SOON='<span class="xsm-soon">会员即将开放</span>';
  async function get(path){const r=await fetch(path,{credentials:'same-origin',headers:{'X-Runae-Friends':'1'}});if(!r.ok)throw Object.assign(Error('读取失败'),{status:r.status});return r.json();}
  function quotaLine(){
    const q=st.quota;if(!q||!q.enabled||!Number.isInteger(q.remaining?.request))return '';
    return `<p class="xsm-quota">今天还能申请认识 <b>${q.remaining.request}</b>/${q.limits.request} 次${q.tier==='member'||!st.salesOpen?'':` · <a href="/pages/friends-membership.html">会员每天${esc(q.limits.memberRequest)}次</a>`}</p>`;
  }
  function viewersLine(){
    const v=st.viewers;if(!v)return '';
    const text=v.count?`最近7天有<b>${v.count}</b>人看过你的卡片`:'最近7天还没有人看过你的卡片';
    const action=!v.count?'':v.member?`<button type="button" class="text-button" data-xsm-viewers aria-expanded="${st.open}">${st.open?'收起':'看看是谁'}</button>`:st.salesOpen?'<a class="text-button" href="/pages/friends-membership.html">开通会员看是谁</a>':'';
    const list=v.member&&st.open?`<ul class="xsm-viewers">${v.viewers.map(p=>`<li><button type="button" data-xsm-card="${esc(p.shareId)}"><strong>${esc(p.nickname)}</strong><span>${esc([p.age?p.age+'岁':'',p.city].filter(Boolean).join(' · '))}</span><time>${esc(Number(p.day.slice(5,7))+'月'+Number(p.day.slice(8,10))+'日')}</time></button></li>`).join('')}</ul>`:'';
    return `<div class="xsm-views"><p>${text}</p>${action}</div>${list}`;
  }
  function pills(){
    if(!st.member)return `<div class="xsm-pills is-locked" aria-label="会员筛选（未开通）">${['学历','收入','有房','有车','已核验'].map(t=>`<span class="xsm-pill" aria-disabled="true">${LOCK}${t}</span>`).join('')}</div><p class="xsm-upsell">以上是会员筛选 · ${st.salesOpen?'<a href="/pages/friends-membership.html">了解会员</a>':SOON}</p>`;
    const sel=(key,label,opts)=>`<label class="xsm-pill${st.picked[key]?' is-on':''}"><span class="visually-hidden">${label}</span><select data-xsm-key="${key}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v,t])=>`<option value="${esc(v)}"${st.picked[key]===v?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
    return `<div class="xsm-pills" role="group" aria-label="会员筛选">${sel('edu','学历',EDU)}${sel('income','收入',INCOME)}${TOGGLES.map(([k,v,t])=>`<button type="button" class="xsm-pill${st.picked[k]?' is-on':''}" data-xsm-toggle="${k}" data-value="${v}" aria-pressed="${!!st.picked[k]}">${t}</button>`).join('')}</div><p class="xsm-hint">只按对方公开给你的资料筛选，没公开的不会被筛进来。</p>`;
  }
  function render(){
    const root=st.root;if(!root||!root.isConnected)return;
    root.className='xsm-bar';root.innerHTML=quotaLine()+viewersLine()+pills();
    root.querySelector('[data-xsm-viewers]')?.addEventListener('click',()=>{st.open=!st.open;render();});
    root.querySelectorAll('[data-xsm-card]').forEach(b=>b.addEventListener('click',()=>st.openCard?.(b.dataset.xsmCard)));
    root.querySelectorAll('[data-xsm-key]').forEach(s=>s.addEventListener('change',()=>{st.picked[s.dataset.xsmKey]=s.value||undefined;render();st.reload?.();}));
    root.querySelectorAll('[data-xsm-toggle]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.xsmToggle;st.picked[k]=st.picked[k]?undefined:b.dataset.value;render();st.reload?.();}));
  }
  async function refresh(){
    const [q,v,m]=await Promise.allSettled([get('/api/friends/quota'),get('/api/friends/viewers'),get('/api/friends/billing/membership/status')]);
    st.salesOpen=m.status==='fulfilled'&&m.value?.open===true&&Array.isArray(m.value.channels)&&m.value.channels.length>0;
    st.quota=q.status==='fulfilled'?q.value:null;st.viewers=v.status==='fulfilled'?v.value:null;
    st.member=st.quota?.tier==='member'||st.viewers?.member===true;if(!st.member)st.picked={};
    render();
  }
  window.XSMember={
    mount(root,{reload,openCard}={}){if(!root)return;st.root=root;st.reload=reload;st.openCard=openCard;st.open=false;refresh().catch(()=>{});},
    params(){return st.member?Object.entries(st.picked).filter(([,v])=>v):[];},
    refresh(){return refresh().catch(()=>{});},
    upsell(){const u=st.root?.querySelector('.xsm-quota');if(u){u.classList.add('is-flash');setTimeout(()=>u.classList.remove('is-flash'),1600);}}
  };
})();
