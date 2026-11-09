'use strict';
// 相生 · 站内留言队列（运营）。凭据只在内存；回复/改状态由服务端写操作记录。
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let token='',toastTimer;
  function toast(m){$('#sp-toast').textContent=m;$('#sp-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#sp-toast').hidden=true,3500);}
  function exit(){token='';$('#sp-token').value='';$('#sp-workspace').hidden=true;$('#sp-login').hidden=false;$('#sp-exit').hidden=true;$('#sp-list').replaceChildren();}
  async function request(path,body){
    if(!token)throw Error('请先输入管理凭据。');
    const r=await fetch('/api/friends/admin'+path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:{'X-Admin-Token':token,'X-Runae-Friends':'1','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(r.status===401){exit();$('#sp-auth-error').textContent='管理凭据无效，请重新输入。';throw Error('管理凭据无效');}
    let data;try{data=await r.json();}catch{throw Error('后台暂时不可用，请稍后重试。');}
    if(!r.ok)throw Error(data.error||'操作未完成');return data;
  }
  const row=m=>`<article class="surface admin-report" data-id="${esc(m.id)}"><div class="report-header"><h3>${esc(m.typeLabel)} · ${m.profile?esc(m.profile.nickname||'未命名')+(m.profile.shareId?' · 卡片 '+esc(m.profile.shareId):''):'（无交友档案）'}</h3><span class="badge-note">${esc(m.statusLabel)}</span></div>
<p class="fine-print">账号 ${esc(m.userId)} · ${esc(m.createdAt)}</p><p class="report-reason" style="white-space:pre-wrap">${esc(m.text)}</p>
${m.replies.map(r=>`<p class="fine-print">已回复 · ${esc(r.at)}</p><p style="white-space:pre-wrap">${esc(r.text)}</p>`).join('')}
<form class="review-form" data-id="${esc(m.id)}"><label>回复（用户可见，最多1000字）<textarea name="reply" maxlength="1000" rows="3"></textarea></label><label>状态<select name="status"><option value="done">已处理</option><option value="open">待处理</option></select></label><button class="primary" type="submit">提交</button></form></article>`;
  async function load(){const st=$('#sp-status').value,data=await request('/support'+(st?'?status='+encodeURIComponent(st):''));$('#sp-list').innerHTML=data.messages.length?data.messages.map(row).join(''):'<p class="muted">没有留言。</p>';}
  $('#sp-auth-form').addEventListener('submit',async e=>{e.preventDefault();token=$('#sp-token').value.trim();$('#sp-auth-error').textContent='';try{await load();$('#sp-login').hidden=true;$('#sp-workspace').hidden=false;$('#sp-exit').hidden=false;}catch(err){if(token)$('#sp-auth-error').textContent=err.message;}});
  $('#sp-refresh').addEventListener('click',()=>load().catch(err=>$('#sp-error').textContent=err.message));
  $('#sp-status').addEventListener('change',()=>load().catch(err=>$('#sp-error').textContent=err.message));
  $('#sp-exit').addEventListener('click',exit);
  $('#sp-list').addEventListener('submit',async e=>{const f=e.target.closest('form[data-id]');if(!f)return;e.preventDefault();const reply=f.reply.value.trim(),status=f.status.value;
    try{await request('/support/'+encodeURIComponent(f.dataset.id),{...(reply?{reply}:{}),status});toast('已保存');await load();}catch(err){$('#sp-error').textContent=err.message;}});
})();
