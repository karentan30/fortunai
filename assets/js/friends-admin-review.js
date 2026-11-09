'use strict';
// 相生 · 新卡片审核 (admin). 只判断 真实 / 完整 / 非广告；不评分，不看长相与收入。
// Photos are fetched with the admin token header and shown via short-lived blob: URLs; no public URL exists.
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABELS={age:'年龄',height:'身高',weight:'体重',education:'学历',school:'学校',occupation:'职业',industry:'行业',title:'职位'};
  let token='',toastTimer,reasons={},loadEpoch=0;const blobs=new Set();
  function toast(m){$('#review-toast').textContent=m;$('#review-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#review-toast').hidden=true,3500);}
  function revokeAll(){for(const u of blobs)URL.revokeObjectURL(u);blobs.clear();}
  function exit(){token='';revokeAll();$('#review-token').value='';$('#review-workspace').hidden=true;$('#review-login').hidden=false;$('#review-exit').hidden=true;$('#review-list').replaceChildren();}
  async function request(path,{body,raw}={}){
    if(!token)throw Error('请先输入管理凭据。');
    const r=await fetch('/api/friends/admin'+path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:{'X-Admin-Token':token,'X-Runae-Friends':'1','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(r.status===401){exit();$('#review-auth-error').textContent='管理凭据无效，请重新输入。';throw Error('管理凭据无效');}
    if(raw&&r.ok)return r.blob();
    let data;try{data=await r.json();}catch{throw Error('后台暂时不可用，请稍后重试。');}
    if(!r.ok)throw Error(data.error||'操作未完成');return data;
  }
  const reasonSelect=()=>`<select data-reason><option value="">选择不通过原因</option>${Object.entries(reasons).map(([k,l])=>`<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select>`;
  function row(p){
    const pending=p.reviewStatus==='pending';
    const facts=Object.entries(p.fields||{}).map(([k,v])=>`<dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd>`).join('');
    return `<article class="surface vf-item" data-share="${esc(p.shareId)}"><div class="vf-head"><h3>${esc(p.nickname)} · ${esc(p.city)}</h3><span class="vf-status${pending?' vf-pending':''}">${pending?'待审核':'已通过'}</span></div>
<p class="fine-print">${pending?'提交于 '+esc(p.submittedAt||'—'):'通过于 '+esc(p.reviewedAt||'（上线前已公开）')} · 认识目的：${esc((p.purposeLabels||[]).join('、'))}</p>
<div class="rv-photos">${(p.photos||[]).map(x=>`<img alt="照片" data-photo="${esc(x.id)}">`).join('')||'<span class="fine-print">未上传照片</span>'}</div>
${facts?`<dl class="rv-dl">${facts}</dl>`:''}
${p.hobbies?.length?`<p class="fine-print">爱好：${esc(p.hobbies.join('、'))}</p>`:''}${p.dateActivities?.length?`<p class="fine-print">约会想做：${esc(p.dateActivities.join('、'))}</p>`:''}
${p.bio?`<p>${esc(p.bio)}</p>`:''}
<div class="vf-actions">${pending?'<button type="button" class="primary" data-approve>通过</button>':''}${reasonSelect()}<button type="button" class="secondary" data-reject>不通过</button></div></article>`;
  }
  async function loadPhotos(epoch){
    for(const img of document.querySelectorAll('#review-list img[data-photo]')){
      const share=img.closest('[data-share]').dataset.share;
      try{const blob=await request('/reviews/'+encodeURIComponent(share)+'/photos/'+encodeURIComponent(img.dataset.photo),{raw:true});if(epoch!==loadEpoch)return;const url=URL.createObjectURL(blob);blobs.add(url);img.src=url;}catch(_){img.alt='照片读取失败';}
    }
  }
  async function load(){
    const epoch=++loadEpoch;revokeAll();$('#review-error').textContent='';
    try{const data=await request('/reviews?status='+encodeURIComponent($('#review-status').value));reasons=data.reasons||{};
      $('#review-list').innerHTML=data.profiles.length?data.profiles.map(row).join(''):'<p class="muted">暂无卡片。</p>';loadPhotos(epoch);}
    catch(e){$('#review-error').textContent=e.message;}
  }
  $('#review-list').addEventListener('click',async e=>{
    const item=e.target.closest('[data-share]');if(!item)return;const share=item.dataset.share;
    try{
      const img=e.target.closest('img[data-photo]');if(img?.src){window.open(img.src,'_blank','noopener');return;}
      if(e.target.closest('[data-approve]')){if(!confirm('确认通过？卡片会出现在推荐里。'))return;await request('/reviews/'+encodeURIComponent(share),{body:{decision:'approve'}});toast('已通过。');return load();}
      if(e.target.closest('[data-reject]')){const reason=item.querySelector('[data-reason]').value;if(!reason){toast('请选择不通过原因。');return;}if(!confirm('确认不通过？用户会看到所选原因，可修改后重新提交。'))return;await request('/reviews/'+encodeURIComponent(share),{body:{decision:'reject',reason}});toast('已标记不通过。');return load();}
    }catch(x){$('#review-error').textContent=x.message;}
  });
  $('#review-auth-form').addEventListener('submit',async e=>{e.preventDefault();const v=$('#review-token').value.trim();if(v.length<32){$('#review-auth-error').textContent='请输入至少 32 位的管理凭据。';return;}token=v;$('#review-token').value='';$('#review-auth-error').textContent='';try{await request('/reviews');$('#review-login').hidden=true;$('#review-workspace').hidden=false;$('#review-exit').hidden=false;load();}catch(x){if(token)$('#review-auth-error').textContent=x.message;}});
  $('#review-refresh').addEventListener('click',load);$('#review-status').addEventListener('change',load);$('#review-exit').addEventListener('click',exit);
  window.addEventListener('pagehide',revokeAll);
})();
