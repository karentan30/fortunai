'use strict';
// 相生 · 申请核验 (owner side). Self-contained: watches the profile view rendered by friends.js and appends its own section.
// Server: /api/friends/verification*. Files go one per request (base64 JSON), are type-checked by magic bytes on the server,
// stored encrypted, and deleted right after review. This script never keeps file contents after the upload request.
(()=>{
  const main=document.getElementById('main');if(!main)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const HINTS={education:'学信网截图（学历/学籍在线验证报告），或只填写学信网在线验证码',occupation:'工牌照片，或劳动合同首页与签字页',income:'个税 App 收入纳税明细，或近期工资条',assets:'银行存款证明、资产证明或理财持仓截图'};
  const STATUS={none:'未申请',draft:'待提交',pending:'审核中',approved:'已核验',rejected:'未通过'};
  const MAX_BYTES=5*1024*1024,MAX_FILES=3;
  let data=null,busy=false,loading=false;
  async function api(path,options={}){
    const r=await fetch('/api/friends'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json','X-Runae-Friends':'1'}});
    let body;try{body=await r.json();}catch{throw Error('服务暂时不可用，请稍后再试。');}
    if(!r.ok){const e=Error(body.error||'操作没有完成，请重试。');e.status=r.status;throw e;}
    return body;
  }
  const readBase64=file=>new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).replace(/^data:[^,]*,/,''));fr.onerror=()=>reject(Error('无法读取文件'));fr.readAsDataURL(file);});
  const size=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
  function statusLine(f){
    if(f.verified&&f.status!=='pending'&&f.status!=='draft')return '<span class="vf-status vf-approved">已核验</span>';
    const s=f.status||'none';
    return `<span class="vf-status vf-${esc(s)}">${esc(STATUS[s]||s)}</span>${s==='rejected'&&f.reason?`<span class="vf-reason">原因：${esc(f.reason)}</span>`:''}${f.verified&&(s==='pending'||s==='draft')?'<span class="vf-reason">当前已核验，新材料审核中不影响原结果</span>':''}`;
  }
  function itemHTML(key,label,f){
    const editable=f.status!=='pending',files=f.status==='draft'?(f.files||[]):[];
    return `<div class="vf-item" data-field="${key}"><div class="vf-head"><h3>${esc(label)}</h3>${statusLine(f)}</div><p class="fine-print">${esc(HINTS[key])}</p>${
      f.status==='pending'?`<p class="muted">已提交 ${(f.files||[]).length} 个文件${f.hasCode?'及学信网验证码':''}，审核完成后会在这里显示结果。</p>`:''}${
      files.length?`<ul class="vf-files">${files.map(x=>`<li><span>${esc(x.name)} · ${size(x.size)}</span><button type="button" class="text-button" data-remove="${esc(x.id)}">移除</button></li>`).join('')}</ul>`:''}${
      editable?`<div class="vf-actions"><label class="secondary vf-pick">选择文件<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple data-upload hidden></label>${key==='education'?`<input type="text" class="vf-code" maxlength="32" placeholder="学信网在线验证码（选填）" autocomplete="off" spellcheck="false">`:''}<button type="button" class="primary" data-submit>提交审核</button></div><p class="fine-print">最多 ${MAX_FILES} 个，单个不超过 5MB；支持 JPG / PNG / WEBP / PDF。可以遮挡身份证号等与核验无关的信息。</p>`:''}<p class="error" role="alert" data-error></p></div>`;
  }
  function render(){
    const host=main.querySelector('.profile-layout')||main.querySelector('#profile-form');if(!host||!data)return;
    let section=main.querySelector('#verify-section');
    if(!section){section=document.createElement('section');section.id='verify-section';section.className='surface verify-section';host.after(section);section.addEventListener('click',onClick);section.addEventListener('change',onChange);}
    const intro=`<div class="eyebrow">OPTIONAL · MANUAL REVIEW</div><h2>申请核验</h2><p class="muted">自愿申请，逐项人工审核。证明文件加密保存，只有审核人员可以查看，不会公开。<strong>审核完成后，无论通过或未通过，原始文件都会立即删除，只保留核验结果。</strong>修改已核验项目的内容后，核验标记会自动取消。</p>`;
    if(!data.hasProfile){section.innerHTML=intro+'<p class="notice">先保存个人资料，再申请核验。</p>';return;}
    section.innerHTML=intro+`<div class="vf-grid">${Object.entries(data.labels).map(([k,l])=>itemHTML(k,l,data.fields[k]||{status:'none'})).join('')}</div>`;
  }
  async function refresh(){if(loading)return;loading=true;try{data=await api('/verification');render();}catch(e){data=null;main.querySelector('#verify-section')?.remove();}finally{loading=false;}}
  const errorOf=el=>el.closest('.vf-item')?.querySelector('[data-error]');
  async function onChange(e){
    const input=e.target.closest('[data-upload]');if(!input||busy)return;
    const item=input.closest('.vf-item'),field=item.dataset.field,err=errorOf(input),files=[...input.files];input.value='';
    const already=(data.fields[field]?.status==='draft'?data.fields[field].files.length:0);
    if(already+files.length>MAX_FILES){err.textContent=`每项最多 ${MAX_FILES} 个文件。`;return;}
    const big=files.find(f=>f.size>MAX_BYTES);if(big){err.textContent=`「${big.name}」超过 5MB。`;return;}
    busy=true;err.textContent='正在加密上传…';
    try{for(const f of files)await api('/verification/files',{method:'POST',body:JSON.stringify({field,name:f.name,data:await readBase64(f)})});err.textContent='';}
    catch(x){err.textContent=x.message;}finally{busy=false;await refresh();}
  }
  async function onClick(e){
    const remove=e.target.closest('[data-remove]'),submit=e.target.closest('[data-submit]');if((!remove&&!submit)||busy)return;
    const err=errorOf(e.target);busy=true;err.textContent='';
    try{
      if(remove)await api('/verification/files/'+encodeURIComponent(remove.dataset.remove),{method:'DELETE',body:'{}'});
      else{const item=submit.closest('.vf-item'),code=item.querySelector('.vf-code')?.value.trim();await api('/verification/submit',{method:'POST',body:JSON.stringify({field:item.dataset.field,...(code?{code}:{})})});}
    }catch(x){err.textContent=x.message;busy=false;return;}
    busy=false;await refresh();
  }
  // friends.js re-renders the whole view on navigation; re-attach whenever the profile form appears.
  new MutationObserver(()=>{if(main.querySelector('#profile-form')&&!main.querySelector('#verify-section'))refresh();}).observe(main,{childList:true});
  if(main.querySelector('#profile-form'))refresh();
})();
