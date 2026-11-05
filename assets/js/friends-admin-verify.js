'use strict';
// 相生 · 人工核验队列 (admin). Proof files are fetched with the admin token header and shown via a short-lived blob: URL;
// the server never exposes a public URL for them.
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let token='',toastTimer;const blobs=new Set();
  function toast(m){$('#verify-toast').textContent=m;$('#verify-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#verify-toast').hidden=true,3500);}
  function revokeAll(){for(const u of blobs)URL.revokeObjectURL(u);blobs.clear();}
  function exit(){token='';revokeAll();$('#verify-token').value='';$('#verify-workspace').hidden=true;$('#verify-login').hidden=false;$('#verify-exit').hidden=true;$('#verify-list').replaceChildren();}
  async function request(path,{body,raw}={}){
    if(!token)throw Error('请先输入管理凭据。');
    const r=await fetch('/api/friends/admin'+path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:{'X-Admin-Token':token,'X-Runae-Friends':'1','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(r.status===401){exit();$('#verify-auth-error').textContent='管理凭据无效，请重新输入。';throw Error('管理凭据无效');}
    if(raw&&r.ok)return r.blob();
    let data;try{data=await r.json();}catch{throw Error('后台暂时不可用，请稍后重试。');}
    if(!r.ok)throw Error(data.error||'操作未完成');return data;
  }
  const size=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
  function row(r){
    const who=r.profile?`${esc(r.profile.nickname)} · ${esc(r.profile.city)}`:'（资料已删除）';
    return `<article class="surface vf-item" data-id="${esc(r.id)}"><div class="vf-head"><h3>${esc(r.fieldLabel)} · ${who}</h3><span class="vf-status vf-pending">审核中</span></div>
<p class="fine-print">提交于 ${esc(r.submittedAt)}${r.profile?` · 用户填写：${esc(r.profile.claimed??'未填写')}`:''}</p>
${r.code?`<p>学信网在线验证码：<code>${esc(r.code)}</code>（请在学信网官网自行查验）</p>`:''}
<ul class="vf-files">${r.files.map(f=>`<li><span>${esc(f.name)} · ${esc(f.mime)} · ${size(f.size)}</span><button type="button" class="text-button" data-view="${esc(f.id)}">查看文件</button></li>`).join('')||'<li>无文件</li>'}</ul>
<div class="vf-actions"><button type="button" class="primary" data-approve>通过</button><input type="text" class="vf-code" maxlength="200" placeholder="不通过原因（会展示给用户）" data-reason><button type="button" class="secondary" data-reject>不通过</button></div></article>`;
  }
  async function load(){revokeAll();$('#verify-error').textContent='';try{const {requests}=await request('/verifications');$('#verify-list').innerHTML=requests.length?requests.map(row).join(''):'<p class="muted">暂无待审核申请。</p>';}catch(e){$('#verify-error').textContent=e.message;}}
  $('#verify-list').addEventListener('click',async e=>{
    const item=e.target.closest('[data-id]');if(!item)return;const id=item.dataset.id;
    const view=e.target.closest('[data-view]');
    try{
      if(view){const blob=await request('/verifications/'+encodeURIComponent(id)+'/files/'+encodeURIComponent(view.dataset.view),{raw:true});const url=URL.createObjectURL(blob);blobs.add(url);window.open(url,'_blank','noopener');return;}
      if(e.target.closest('[data-approve]')){if(!confirm('确认通过？原始文件将立即删除。'))return;await request('/verifications/'+encodeURIComponent(id),{body:{decision:'approve'}});toast('已通过，原始文件已删除。');return load();}
      if(e.target.closest('[data-reject]')){const reason=item.querySelector('[data-reason]').value.trim();if(!reason){toast('请填写不通过原因。');return;}await request('/verifications/'+encodeURIComponent(id),{body:{decision:'reject',reason}});toast('已标记未通过，原始文件已删除。');return load();}
    }catch(x){$('#verify-error').textContent=x.message;}
  });
  $('#verify-auth-form').addEventListener('submit',async e=>{e.preventDefault();const v=$('#verify-token').value.trim();if(v.length<32){$('#verify-auth-error').textContent='请输入至少 32 位的管理凭据。';return;}token=v;$('#verify-token').value='';$('#verify-auth-error').textContent='';try{await request('/verifications');$('#verify-login').hidden=true;$('#verify-workspace').hidden=false;$('#verify-exit').hidden=false;load();}catch(x){if(token)$('#verify-auth-error').textContent=x.message;}});
  $('#verify-refresh').addEventListener('click',load);$('#verify-exit').addEventListener('click',exit);
  window.addEventListener('pagehide',revokeAll);
})();
