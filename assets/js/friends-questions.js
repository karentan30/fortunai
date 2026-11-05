'use strict';
// 认真婚恋十方向问卷：一次一个方向，服务端逐方向保存，可续填；跳过/待讨论都是正常答案。
(()=>{
 const $=s=>document.querySelector(s);
 const API='/api/friends/questionnaire';
 const STATUS_LABEL={not_started:'未开始',in_progress:'填写中',done:'已完成',skipped:'先跳过',discuss:'待讨论'};
 const state={bank:null,record:null,progress:null,index:0,draft:{},dirty:false,busy:false,epoch:0,peers:[]};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
 async function api(path='',method='GET',body){
  const r=await fetch(API+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},...(body?{body:JSON.stringify(body)}:{})});
  let value={};try{value=await r.json();}catch(_){}
  if(r.status===401){state.epoch++;state.record=null;$('#q-app').hidden=true;$('#q-login').hidden=false;$('#q-status').textContent='请先登录，答卷只保存在你自己的账号里。';}
  if(!r.ok)throw Error(value.error||'暂时没保存上，请稍后再试');
  return value;
 }
 const dims=()=>state.bank.dimensions;
 const current=()=>dims()[state.index];
 const saved=id=>state.record?.dimensions?.[id]||null;
 function setBusy(on){state.busy=on;document.querySelectorAll('#q-app button,#q-app input,#q-app textarea').forEach(b=>b.disabled=on);}
 function apply(result){state.record=result.questionnaire;state.progress=result.progress;}

 // ---------- 进度 ----------
 function renderProgress(){
  const p=state.progress,settled=p?.settled||0;
  $('#q-progress-text').textContent=`第 ${state.index+1} / ${dims().length} 个方向 · 已看过 ${settled} 个`;
  $('#q-bar').setAttribute('aria-valuenow',String(settled));$('#q-bar-fill').style.width=(settled/dims().length*100)+'%';
  const nav=$('#q-steps');nav.replaceChildren();
  dims().forEach((d,i)=>{const status=p?.dimensions.find(x=>x.id===d.id)?.status||'not_started',b=node('button',null,'q-step');b.type='button';b.dataset.status=status;b.setAttribute('aria-current',String(i===state.index));b.setAttribute('aria-label',`${i+1}. ${d.label}（${STATUS_LABEL[status]}）`);b.append(node('span',String(i+1),'q-step-num'),node('span',d.label,'q-step-name'));b.addEventListener('click',()=>go(i));nav.append(b);});
  nav.querySelector('[aria-current=true]')?.scrollIntoView?.({block:'nearest',inline:'center'});
 }

 // ---------- 题目 ----------
 const draftOf=q=>state.draft[q.id];
 function setAnswer(q,patch){const old=state.draft[q.id]||{};state.draft[q.id]=patch===null?undefined:{...old,...patch};if(patch===null)delete state.draft[q.id];state.dirty=true;}
 function optionList(q,box){
  const a=draftOf(q),multi=q.type==='multi',name='q-'+q.id;
  const wrap=node('div',null,q.type==='scale'?'q-scale':'q-options');
  if(q.type==='scale')wrap.append(node('span',q.lowLabel,'q-scale-end'));
  const group=node('div',null,q.type==='scale'?'q-scale-dots':'q-option-list');
  for(const o of q.options){
   const l=node('label',null,'q-opt'),input=node('input');input.type=multi?'checkbox':'radio';input.name=name;input.value=String(o.value);
   input.checked=a?.state==='answered'&&(multi?a.value.includes(o.value):a.value===o.value);
   input.addEventListener('change',()=>{
    if(multi){const set=new Set(draftOf(q)?.state==='answered'?draftOf(q).value:[]);input.checked?set.add(o.value):set.delete(o.value);
     if(set.size>q.maxSelect){input.checked=false;set.delete(o.value);$('#q-error').textContent=`这题最多选 ${q.maxSelect} 项`;return;}
     $('#q-error').textContent='';set.size?setAnswer(q,{state:'answered',value:q.options.map(x=>x.value).filter(v=>set.has(v))}):setAnswer(q,null);}
    else setAnswer(q,{state:'answered',value:o.value});
    renderMeta(q,box);
   });
   l.append(input,node('span',q.type==='scale'?o.label:o.label));group.append(l);
  }
  wrap.append(group);if(q.type==='scale')wrap.append(node('span',q.highLabel,'q-scale-end'));
  return wrap;
 }
 function renderMeta(q,box){
  const meta=box.querySelector('.q-meta');meta.replaceChildren();const a=draftOf(q);
  for(const [st,label] of [['skip','跳过这题'],['discuss','待讨论']]){
   const b=node('button',label,'q-chip');b.type='button';b.setAttribute('aria-pressed',String(a?.state===st));
   b.addEventListener('click',()=>{if(draftOf(q)?.state===st)setAnswer(q,null);else{setAnswer(q,null);setAnswer(q,{state:st});}renderQuestion(q,box);});meta.append(b);
  }
  if(a?.state==='answered'&&q.compare!=='none'){
   const l=node('label',null,'q-importance'),sel=node('select');l.append(node('span','这件事对我：'),sel);
   const none=node('option','没想好');none.value='';sel.append(none);
   for(const o of state.bank.importanceOptions){const op=node('option',o.label);op.value=o.value;sel.append(op);}
   sel.value=a.importance||'';sel.addEventListener('change',()=>{const cur=draftOf(q);if(!cur)return;const next={...cur};if(sel.value)next.importance=sel.value;else delete next.importance;state.draft[q.id]=next;state.dirty=true;});
   meta.append(l);
  }
  if(a?.state==='discuss'){const t=node('input');t.type='text';t.maxLength=200;t.placeholder='想当面聊的点（选填）';t.value=a.note||'';t.className='q-note';t.addEventListener('input',()=>{const cur=draftOf(q);if(cur){cur.note=t.value||undefined;state.dirty=true;}});meta.append(t);}
 }
 function renderQuestion(q,box){
  box.replaceChildren();box.append(node('legend',q.text));if(q.hint)box.append(node('p',q.hint,'q-hint'));
  const a=draftOf(q),off=a&&a.state!=='answered';box.classList.toggle('q-off',!!off);
  if(off)box.append(node('p',a.state==='skip'?'已跳过，之后想答随时可以回来。':'已标为待讨论，适合见面后慢慢聊。','q-off-note'));
  else if(q.type==='text'){const t=node('textarea');t.maxLength=q.maxLength;t.rows=3;t.placeholder=q.placeholder||'选填';t.value=a?.value||'';t.setAttribute('aria-label',q.text);t.addEventListener('input',()=>{const v=t.value.trim();v?setAnswer(q,{state:'answered',value:t.value}):setAnswer(q,null);});box.append(t,node('small','选填，最多300字。请只写你自己的事。','q-muted'));}
  else box.append(optionList(q,box));
  box.append(node('div',null,'q-meta'));renderMeta(q,box);
 }
 function render(){
  const d=current(),i=state.index;
  $('#q-step-label').textContent=`方向 ${i+1}`;$('#q-dim-title').textContent=d.label;$('#q-dim-intro').textContent=d.intro;
  const s=saved(d.id);
  if(s?.status==='skipped')$('#q-dim-intro').textContent=d.intro+' （你之前先跳过了这个方向，想答的话直接填就好。）';
  const items=$('#q-items');items.replaceChildren();
  for(const q of d.questions){const box=node('fieldset',null,'q-card');renderQuestion(q,box);items.append(box);}
  $('#q-prev').hidden=i===0;$('#q-next').textContent=i===dims().length-1?'保存，看看总览':'保存，下一个方向';
  $('#q-consent-wrap').hidden=!!state.record;if(state.record)$('#q-consent').checked=true;
  $('#q-error').textContent='';renderProgress();
 }
 function go(i){
  if(state.busy||i===state.index&&$('#q-summary').hidden)return;
  const leave=()=>{state.index=Math.max(0,Math.min(dims().length-1,i));state.draft=structuredClone(saved(current().id)?.answers||{});state.dirty=false;$('#q-summary').hidden=true;$('#q-form').hidden=false;render();window.scrollTo?.({top:$('#q-app').offsetTop-8,behavior:'smooth'});};
  if(state.dirty&&Object.keys(state.draft).length){const prev=saved(current().id)?.status;save(prev==='done'||prev==='discuss'?prev:'in_progress').then(ok=>{if(ok)leave();});return;}
  leave();
 }
 function payloadAnswers(){const out={};for(const [id,a]of Object.entries(state.draft)){if(!a)continue;const v={state:a.state};if(a.state==='answered'){v.value=a.value;if(a.importance)v.importance=a.importance;}if(a.note&&a.note.trim())v.note=a.note.trim();out[id]=v;}return out;}
 async function save(status){
  if(state.busy)return false;
  if(!state.record&&!$('#q-consent').checked){$('#q-error').textContent='请先勾选同意保存本人私密答卷。';$('#q-consent').focus();return false;}
  const d=current(),epoch=state.epoch;setBusy(true);
  try{const result=await api('/dimensions/'+encodeURIComponent(d.id),'PUT',{version:state.bank.version,consent:true,status,answers:status==='skipped'?{}:payloadAnswers(),expectedRevision:state.record?.revision||0});
   if(epoch!==state.epoch)return false;apply(result);state.dirty=false;state.draft=structuredClone(saved(d.id)?.answers||{});
   $('#q-status').textContent=status==='in_progress'?`已暂存「${d.label}」，只有你能看到。`:`已保存「${d.label}」，只有你能看到。`;return true;}
  catch(e){$('#q-error').textContent=e.message;return false;}
  finally{setBusy(false);}
 }
 async function advance(status){
  if(!await save(status))return;
  if(state.index<dims().length-1){state.index++;state.draft=structuredClone(saved(current().id)?.answers||{});render();window.scrollTo?.({top:$('#q-app').offsetTop-8,behavior:'smooth'});}
  else showSummary();
  loadPeers();
 }
 function showSummary(){
  renderProgress();$('#q-form').hidden=true;$('#q-summary').hidden=false;const list=$('#q-summary-list');list.replaceChildren();
  state.progress.dimensions.forEach((d,i)=>{const li=node('li'),b=node('button',`${d.label} · ${STATUS_LABEL[d.status]}`,'q-link');b.type='button';b.addEventListener('click',()=>go(i));li.append(b);list.append(li);});
 }

 // ---------- 互看 ----------
 const labelOf=id=>dims().find(d=>d.id===id)?.label||id;
 const answerText=(q,a)=>{if(!a)return '没有填写';if(a.state==='skip')return '跳过';if(a.state==='discuss')return '待讨论'+(a.note?`：${a.note}`:'');if(q.type==='text')return a.value;const opt=v=>q.options.find(o=>o.value===v);if(q.type==='scale')return `${a.value} / 5（1=${q.lowLabel}，5=${q.highLabel}）`;if(q.type==='multi')return a.value.map(v=>opt(v)?.label||v).join('、');return opt(a.value)?.label||String(a.value);};
 async function loadPeers(){
  const box=$('#q-peers');
  try{const {peers}=await api('/peers');state.peers=peers;box.replaceChildren();
   if(!peers.length){box.append(node('p','还没有互相同意认识的人。先在交友页认识朋友，再回来选择是否互看。','q-muted'));return;}
   for(const p of peers){
    const card=node('div',null,'q-peer');card.append(node('h3',p.nickname));
    if(p.theirOffered.length)card.append(node('p',`TA 愿意和你互看：${p.theirOffered.map(labelOf).join('、')}`,'q-muted'));
    if(p.mutualDimensions.length)card.append(node('p',`你们已经可以互看：${p.mutualDimensions.map(labelOf).join('、')}`,'q-ok'));
    const grid=node('div',null,'q-share-grid');
    for(const d of dims()){const st=saved(d.id)?.status;const l=node('label',null,'q-opt'),c=node('input');c.type='checkbox';c.value=d.id;c.checked=p.myOffered.includes(d.id);if(!st||st==='skipped'){c.disabled=!c.checked;l.title='先填写这个方向才能开放';}l.append(c,node('span',d.label));grid.append(l);}
    const saveBtn=node('button','保存我的开放范围','q-secondary');saveBtn.type='button';
    saveBtn.addEventListener('click',async()=>{const chosen=[...grid.querySelectorAll('input:checked')].map(c=>c.value);if(chosen.length&&!confirm(`确认向「${p.nickname}」开放：${chosen.map(labelOf).join('、')}？\n只有对方也开放同一方向时，你们才会互相看到。之后修改的答案也会按最新内容显示，可随时取消。`))return;try{await api('/shares/'+encodeURIComponent(p.shareId),'PUT',chosen.length?{dimensions:chosen,consent:true}:{dimensions:[]});$('#q-status').textContent='已更新开放范围。';loadPeers();}catch(e){$('#q-status').textContent=e.message;}});
    const viewBtn=node('button','查看互看内容','q-secondary');viewBtn.type='button';viewBtn.disabled=!p.mutualDimensions.length;viewBtn.addEventListener('click',()=>showPeer(p.shareId));
    const actions=node('div',null,'q-actions');actions.append(saveBtn,viewBtn);card.append(grid,actions);box.append(card);
   }
  }catch(e){box.replaceChildren(node('p',e.message,'q-muted'));}
 }
 async function showPeer(shareId){
  const view=$('#q-peer-view');view.hidden=false;view.replaceChildren(node('p','正在读取…','q-muted'));
  try{const r=await api('/shares/'+encodeURIComponent(shareId));view.replaceChildren(node('h3',`和「${r.nickname}」互看的方向`));
   if(r.explanations.length){const ul=node('ul',null,'q-explain');for(const e of r.explanations)ul.append(node('li',e.text,e.signal==='close'?'q-ok':'q-talk'));view.append(ul);}
   for(const id of r.mutualDimensions){const d=dims().find(x=>x.id===id),sec=node('details',null,'q-peer-dim');sec.append(node('summary',d.label));const dl=node('dl');for(const q of d.questions){dl.append(node('dt',q.text),node('dd',answerText(q,r.peer.dimensions[id]?.answers?.[q.id])));}sec.append(dl);view.append(sec);}
   view.append(node('p',r.note+' “需要聊聊”不代表不合适，只是值得见面时多聊几句。','q-muted'));
  }catch(e){view.replaceChildren(node('p',e.message,'q-muted'));}
 }

 // ---------- 启动 ----------
 async function load(){
  const epoch=++state.epoch;
  try{const r=await api();if(epoch!==state.epoch)return;apply(r);
   $('#q-app').hidden=false;$('#q-login').hidden=true;
   const next=r.progress.nextDimension;state.index=Math.max(0,next?dims().findIndex(d=>d.id===next):0);
   state.draft=structuredClone(saved(current().id)?.answers||{});state.dirty=false;
   $('#q-status').textContent=r.questionnaire?(next?`欢迎回来，从「${current().label}」接着写。`:'十个方向你都看过了，可以随时回来修改。'):'从第一个方向开始，大约每个方向两三分钟。';
   $('#q-matching').checked=!!r.questionnaire?.matchingConsent;
   if(!next&&r.questionnaire)showSummary();else{$('#q-form').hidden=false;render();}
   loadPeers();
  }catch(e){if($('#q-login').hidden)$('#q-status').textContent=e.message;}
 }
 $('#q-form').addEventListener('submit',e=>{e.preventDefault();advance('done');});
 $('#q-prev').addEventListener('click',()=>go(state.index-1));
 $('#q-skip-dim').addEventListener('click',()=>{if(Object.keys(state.draft).length&&!confirm('先跳过这个方向？这个方向已填的内容会清空。'))return;advance('skipped');});
 $('#q-discuss-dim').addEventListener('click',()=>advance('discuss'));
 $('#q-matching').addEventListener('change',async e=>{const on=e.target.checked;try{const r=await api('/matching','PUT',{consent:on});apply(r);$('#q-matching-status').textContent=on?'已开启。可以随时关掉。':'已关闭，答案不再用于推荐。';}catch(err){e.target.checked=!on;$('#q-matching-status').textContent=err.message;}});
 $('#q-delete').addEventListener('click',async()=>{if(!confirm('删除全部问卷答案和所有互看设置？删除后不能恢复。'))return;try{await api('','DELETE',{});state.record=null;$('#q-consent').checked=false;$('#q-status').textContent='已删除你的全部问卷答案。';load();}catch(e){$('#q-status').textContent=e.message;}});
 window.addEventListener('pagehide',()=>{state.epoch++;state.draft={};$('#q-items').replaceChildren();$('#q-peer-view').replaceChildren();});
 window.addEventListener('pageshow',e=>{if(e.persisted)load();});
 fetch('/assets/data/friends-marriage-questionnaire.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('问卷暂时没准备好');return r.json();}).then(bank=>{state.bank=bank;load();}).catch(e=>$('#q-status').textContent=e.message);
})();
