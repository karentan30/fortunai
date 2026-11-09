'use strict';
// 相生 · 站内「联系我们」：登录后提交留言、查看自己的留言和运营回复。
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,body){
    const r=await fetch('/api/friends'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Runae-Friends':'1'}:{},...(body?{body:JSON.stringify(body)}:{})});
    let data={};try{data=await r.json();}catch{}
    if(!r.ok){const e=Error(data.error||'暂时没提交成功，请稍后再试');e.status=r.status;throw e;}return data;
  }
  const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('zh-CN',{hour12:false});};
  function render(list){
    $('#list-wrap').hidden=false;
    $('#support-list').innerHTML=list.length?list.map(m=>`<article class="msg"><div><span class="tag ${m.status==='open'?'open':''}">${esc(m.statusLabel)}</span><strong>${esc(m.typeLabel)}</strong> <small>${esc(when(m.createdAt))}</small></div><p class="text">${esc(m.text)}</p>${m.replies.map(r=>`<div class="reply"><small>相生回复 · ${esc(when(r.at))}</small><br>${esc(r.text)}</div>`).join('')}</article>`).join(''):'<p class="muted">还没有留言。</p>';
  }
  async function load(){
    let data;try{data=await api('/support');}catch(e){if(e.status===401){$('#login-needed').hidden=false;return;}$('#support-status').textContent=e.message;$('#form-wrap').hidden=false;return;}
    const sel=$('#support-type');if(sel.options.length<2)for(const [k,v] of Object.entries(data.types||{})){const o=document.createElement('option');o.value=k;o.textContent=v;sel.appendChild(o);}
    const want=new URLSearchParams(location.search).get('type');if(want&&data.types&&Object.hasOwn(data.types,want))sel.value=want;
    $('#form-wrap').hidden=false;render(data.messages||[]);
  }
  $('#support-text').addEventListener('input',e=>{$('#support-count').textContent=[...e.target.value].length+'/1000';});
  $('#support-form').addEventListener('submit',async e=>{
    e.preventDefault();const type=$('#support-type').value,text=$('#support-text').value.trim(),st=$('#support-status');st.className='';
    if(!type){st.className='error';st.textContent='请选择想办什么';return;}if(!text){st.className='error';st.textContent='请写一下具体说明';return;}
    $('#support-submit').disabled=true;st.textContent='提交中…';
    try{await api('/support',{type,text});$('#support-text').value='';$('#support-count').textContent='0/1000';st.className='ok';st.textContent='已收到，我们会在这里回复你。';await load();}
    catch(err){st.className='error';st.textContent=err.status===401?'登录已过期，请重新登录后再提交':err.message;}
    finally{$('#support-submit').disabled=false;}
  });
  load();
})();
