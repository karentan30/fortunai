'use strict';
// 认真结婚十方向问卷：先答底线题（约3分钟），其余「深入聊聊」选填；服务端逐方向保存，可续填；跳过/待讨论都是正常答案。
(()=>{
 const $=s=>document.querySelector(s);
 const API='/api/friends/questionnaire';
 const STATUS_LABEL={not_started:'未开始',in_progress:'填写中',done:'已完成',skipped:'先跳过',discuss:'待讨论'};
 const QUICK='__quick';
 const state={bank:null,record:null,progress:null,rhythm:null,index:0,draft:{},dirty:false,busy:false,epoch:0,peers:[],openNotes:new Set()};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
 async function api(path='',method='GET',body){
  const r=await fetch(API+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},...(body?{body:JSON.stringify(body)}:{})});
  let value={};try{value=await r.json();}catch(_){}
  if(r.status===401){state.epoch++;state.record=null;$('#q-app').hidden=true;$('#q-login').hidden=false;$('#q-status').textContent='请先登录，答卷只保存在你自己的账号里。';}
  if(!r.ok)throw Error(value.error||'暂时没保存上，请稍后再试');
  return value;
 }
 const dims=()=>state.bank.dimensions;
 const questionOf=id=>{for(const d of dims())for(const q of d.questions)if(q.id===id)return q;return null;};
 const quickPage=()=>({id:QUICK,label:state.bank.quickPath.label,intro:state.bank.quickPath.intro,questions:state.bank.quickPath.questions.map(questionOf).filter(Boolean)});
 const pages=()=>[quickPage(),...dims()];
 const current=()=>pages()[state.index];
 const saved=id=>state.record?.dimensions?.[id]||null;
 const quickSet=()=>new Set(state.bank.quickPath.questions);
 const noteMax=()=>state.bank.noteMax||120;
 function setBusy(on){state.busy=on;document.querySelectorAll('#q-app button,#q-app input,#q-app textarea,#q-app select').forEach(b=>b.disabled=on);}
 function apply(result){state.record=result.questionnaire;state.progress=result.progress;state.rhythm=result.rhythm||null;renderRhythm();renderVisibility();}
 function draftFor(page){
  if(page.id!==QUICK)return structuredClone(saved(page.id)?.answers||{});
  const out={};for(const q of page.questions){const a=saved(q.dimensionId)?.answers?.[q.id];if(a)out[q.id]=structuredClone(a);}return out;
 }

 // ---------- 进度 ----------
 function pageStatus(p){
  if(p.id!==QUICK)return state.progress?.dimensions.find(x=>x.id===p.id)?.status||'not_started';
  const q=state.progress?.quick;return q?.ready?'done':q?.answered?'in_progress':'not_started';
 }
 function renderProgress(){
  const p=state.progress,settled=p?.settled||0,q=p?.quick;
  $('#q-progress-text').textContent=state.index===0?`底线题 · 已答 ${q?.answered||0} / ${q?.total||state.bank.quickPath.questions.length}`:`深入聊聊 · 第 ${state.index} / ${dims().length} 个方向 · 已看过 ${settled} 个`;
  $('#q-bar').setAttribute('aria-valuenow',String(settled));$('#q-bar-fill').style.width=(settled/dims().length*100)+'%';
  const nav=$('#q-steps');nav.replaceChildren();
  pages().forEach((d,i)=>{const status=pageStatus(d),b=node('button',null,'q-step');b.type='button';b.dataset.status=status;b.setAttribute('aria-current',String(i===state.index));b.setAttribute('aria-label',`${i?i+'. ':''}${d.label}（${STATUS_LABEL[status]}）`);b.append(node('span',i?String(i):'★','q-step-num'),node('span',d.label,'q-step-name'));b.addEventListener('click',()=>go(i));nav.append(b);});
  nav.querySelector('[aria-current=true]')?.scrollIntoView?.({block:'nearest',inline:'center'});
 }

 // ---------- 题目 ----------
 const draftOf=q=>state.draft[q.id];
 function setAnswer(q,patch){const old=state.draft[q.id]||{};if(patch===null)delete state.draft[q.id];else state.draft[q.id]={...old,...patch};state.dirty=true;}
 function optionList(q,box){
  const a=draftOf(q),multi=q.type==='multi',name='q-'+q.id;
  const wrap=node('div',null,q.type==='scale'?'q-scale':'q-options');
  const group=node('div',null,q.type==='scale'?'q-scale-dots':'q-option-list');
  for(const o of q.options){
   const l=node('label',null,'q-opt'),input=node('input');input.type=multi?'checkbox':'radio';input.name=name;input.value=String(o.value);
   input.checked=a?.state==='answered'&&(multi?Array.isArray(a.value)&&a.value.includes(o.value):a.value===o.value);
   input.addEventListener('change',()=>{
    const cur=draftOf(q),keep=cur?.note?{note:cur.note}:{};
    if(multi){const set=new Set(cur?.state==='answered'&&Array.isArray(cur.value)?cur.value:[]);input.checked?set.add(o.value):set.delete(o.value);
     if(set.size>q.maxSelect){input.checked=false;set.delete(o.value);$('#q-error').textContent=`这题最多选 ${q.maxSelect} 项`;return;}
     $('#q-error').textContent='';if(set.size)setAnswer(q,{state:'answered',value:q.options.map(x=>x.value).filter(v=>set.has(v)),...keep});else setAnswer(q,null);}
    else setAnswer(q,{state:'answered',value:o.value,...keep});
    renderMeta(q,box);
   });
   l.append(input,node('span',o.label));group.append(l);
  }
  if(q.type==='scale'){const ends=node('div',null,'q-scale-ends');ends.append(node('span','1 '+q.lowLabel,'q-scale-end'),node('span',q.highLabel+' 5','q-scale-end'));wrap.append(group,ends);}
  else wrap.append(group);
  if(multi)wrap.prepend(node('small',`最多选 ${q.maxSelect} 项`,'q-muted'));
  return wrap;
 }
 function noteField(q,meta,a,max,placeholder){
  const t=node('input');t.type='text';t.maxLength=max;t.placeholder=placeholder;t.value=a.note||'';t.className='q-note';t.setAttribute('aria-label',placeholder);
  t.addEventListener('input',()=>{const cur=draftOf(q);if(cur){if(t.value.trim())cur.note=t.value;else delete cur.note;state.dirty=true;}});meta.append(t);return t;
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
  if(a?.state==='discuss')noteField(q,meta,a,200,'想当面聊的点（选填）');
  const legacy=saved(q.dimensionId)?.legacyText?.[q.id];
  if(legacy&&!a?.note){const p=node('p',`你之前写过：「${legacy}」`,'q-legacy');if(a?.state==='answered'){const use=node('button','放进展开说说','q-link');use.type='button';use.addEventListener('click',()=>{draftOf(q).note=legacy.slice(0,noteMax());state.dirty=true;state.openNotes.add(q.id);renderMeta(q,box);});p.append(' ',use);}else p.append(node('span','（先选一个答案，再决定要不要放进补充里）','q-muted'));meta.append(p);}
  if(a?.state==='answered'){
   if(a.note||state.openNotes.has(q.id)){const t=noteField(q,meta,a,noteMax(),q.notePlaceholder||`${state.bank.noteLabel}，最多${noteMax()}字`);if(state.openNotes.has(q.id)&&!a.note)t.focus?.();}
   else{const more=node('button',state.bank.noteLabel||'展开说说（选填）','q-link q-more');more.type='button';more.addEventListener('click',()=>{state.openNotes.add(q.id);renderMeta(q,box);});meta.append(more);}
  }
 }
 function renderQuestion(q,box){
  box.replaceChildren();box.append(node('legend',q.text));
  const tags=[];if(state.index!==0&&quickSet().has(q.id))tags.push('底线题');if(q.sensitive)tags.push('敏感题 · 默认仅自己');
  if(tags.length)box.append(node('p',tags.join(' · '),'q-tag'));
  if(q.hint)box.append(node('p',q.hint,'q-hint'));
  const a=draftOf(q),off=a&&a.state!=='answered';box.classList.toggle('q-off',!!off);
  if(off)box.append(node('p',a.state==='skip'?'已跳过，之后想答随时可以回来。':'已标为待讨论，适合见面后慢慢聊。','q-off-note'));
  else box.append(optionList(q,box));
  box.append(node('div',null,'q-meta'));renderMeta(q,box);
 }
 function render(){
  const d=current(),i=state.index,isQuick=d.id===QUICK;
  $('#q-step-label').textContent=isQuick?'先答底线题 · 约3分钟':`${state.bank.quickPath.restLabel} · 方向 ${i}`;$('#q-dim-title').textContent=d.label;$('#q-dim-intro').textContent=d.intro;
  const s=!isQuick&&saved(d.id);
  if(s?.status==='skipped')$('#q-dim-intro').textContent=d.intro+' （你之前先跳过了这个方向，想答的话直接填就好。）';
  $('#q-who').textContent=isQuick?state.bank.visibility.quick:state.bank.visibility.deep;
  const items=$('#q-items');items.replaceChildren();let section=null;
  for(const q of d.questions){
   if(!isQuick&&q.section&&q.section!==section){section=q.section;const h=node('div',null,'q-section');h.append(node('h3',q.section));if(q.sectionNote)h.append(node('p',q.sectionNote,'q-muted'));items.append(h);}
   const box=node('fieldset',null,'q-card');renderQuestion(q,box);items.append(box);
  }
  $('#q-prev').hidden=i===0;$('#q-next').textContent=isQuick?'保存底线题':i===pages().length-1?'保存，看看总览':'保存，下一个方向';
  $('#q-skip-dim').hidden=isQuick;$('#q-discuss-dim').hidden=isQuick;
  $('#q-consent-wrap').hidden=!!state.record;if(state.record)$('#q-consent').checked=true;
  $('#q-error').textContent='';renderProgress();
 }
 function go(i){
  if(state.busy||i===state.index&&$('#q-summary').hidden)return;
  const leave=()=>{state.index=Math.max(0,Math.min(pages().length-1,i));state.draft=draftFor(current());state.openNotes.clear();state.dirty=false;$('#q-summary').hidden=true;$('#q-form').hidden=false;render();window.scrollTo?.({top:$('#q-app').offsetTop-8,behavior:'smooth'});};
  if(state.dirty&&Object.keys(state.draft).length){const prev=current().id===QUICK?null:saved(current().id)?.status;save(prev==='done'||prev==='discuss'?prev:'in_progress').then(ok=>{if(ok)leave();});return;}
  leave();
 }
 const payloadOf=a=>{const v={state:a.state};if(a.state==='answered'){v.value=a.value;if(a.importance)v.importance=a.importance;}if(a.note&&a.note.trim())v.note=a.note.trim();return v;};
 function payloadAnswers(draft){const out={};for(const [id,a]of Object.entries(draft))if(a)out[id]=payloadOf(a);return out;}
 async function put(dimId,status,answers){
  return api('/dimensions/'+encodeURIComponent(dimId),'PUT',{version:state.bank.version,consent:true,status,answers:status==='skipped'?{}:answers,expectedRevision:state.record?.revision||0});
 }
 async function save(status){
  if(state.busy)return false;
  if(!state.record&&!$('#q-consent').checked){$('#q-error').textContent='请先勾选同意保存本人私密答卷。';$('#q-consent').focus();return false;}
  $('#q-error').textContent='';const d=current(),epoch=state.epoch;setBusy(true);
  try{
   if(d.id===QUICK){
    // 底线题分属不同方向：按方向逐个保存，保留每个方向里已有的其他答案。
    const byDim={};for(const q of d.questions)(byDim[q.dimensionId]||=[]).push(q);
    for(const [dimId,qs]of Object.entries(byDim)){
     const old=saved(dimId),answers=payloadAnswers(old?.answers||{});let changed=false;
     for(const q of qs){const a=state.draft[q.id],before=JSON.stringify(answers[q.id]||null);if(a)answers[q.id]=payloadOf(a);else delete answers[q.id];if(JSON.stringify(answers[q.id]||null)!==before)changed=true;}
     if(!changed)continue;
     const st=old?.status==='done'||old?.status==='discuss'?old.status:'in_progress';
     const result=await put(dimId,st,answers);if(epoch!==state.epoch)return false;apply(result);
    }
    state.dirty=false;state.draft=draftFor(d);
    $('#q-status').textContent=state.progress?.quick?.ready?'底线题已保存。也填了底线题的会员可以看到；随时可以改回仅自己。':'已暂存底线题，答完全部就能看到别人的底线题。';
    return true;
   }
   const result=await put(d.id,status,payloadAnswers(state.draft));
   if(epoch!==state.epoch)return false;apply(result);state.dirty=false;state.draft=draftFor(d);
   $('#q-status').textContent=status==='in_progress'?`已暂存「${d.label}」。`:`已保存「${d.label}」。`;return true;}
  catch(e){$('#q-error').textContent=e.message;return false;}
  finally{setBusy(false);}
 }
 async function advance(status){
  if(!await save(status))return;
  state.openNotes.clear();
  if(state.index<pages().length-1){state.index++;state.draft=draftFor(current());render();window.scrollTo?.({top:$('#q-app').offsetTop-8,behavior:'smooth'});}
  else showSummary();
  loadPeers();
 }
 function showSummary(){
  renderProgress();$('#q-form').hidden=true;$('#q-summary').hidden=false;const list=$('#q-summary-list');list.replaceChildren();
  state.progress.dimensions.forEach((d,i)=>{const li=node('li'),b=node('button',`${d.label} · ${STATUS_LABEL[d.status]}`,'q-link');b.type='button';b.addEventListener('click',()=>go(i+1));li.append(b);list.append(li);});
 }

 // ---------- 亲密节奏小结（只给自己看） ----------
 function renderRhythm(){
  const box=$('#q-rhythm');if(!box)return;const r=state.rhythm;box.hidden=!r;if(!r)return;
  box.replaceChildren(node('h2','你的亲密节奏'),node('p',r.label,'q-rhythm-label'),node('p','给对方的小提示：'+r.tip),node('p',r.fineprint+'。这段小结只有你自己能看到。','q-muted'));
 }

 // ---------- 谁能看到 ----------
 function renderVisibility(){
  const box=$('#q-visibility-body');if(!box||!state.bank)return;const v=state.bank.visibility,r=state.record;box.replaceChildren();
  const ul=node('ul',null,'q-who-list');for(const t of [v.quick,v.deep,v.sensitive])ul.append(node('li',t));box.append(ul,node('p',v.never,'q-muted'));
  if(!r){box.append(node('p','先填一些问卷，再在这里设置谁能看到。','q-muted'));return;}
  const sh=r.sharing||{model:'v2',privateTopics:[],shareSensitive:[]};
  if(sh.model!=='v2'){
   const p=node('div',null,'q-adopt');p.append(node('p','你在这次改版前保存的答案，仍保持原来的范围（只有自己，或双方都开放的方向才互看）。之后新填或改过的答案，按上面的新规则展示。'));
   const b=node('button','按新规则展示全部答案','q-secondary');b.type='button';b.addEventListener('click',async()=>{if(!confirm('确认把你之前保存的答案也按新规则展示？敏感题仍然默认仅自己，随时可以改回。'))return;await setVis({adopt:true});});p.append(b);box.append(p);
  }
  const topics=[{id:'quick',label:'底线题'},...dims().map(d=>({id:d.id,label:d.label}))];
  const grid=node('div',null,'q-share-grid');box.append(node('h3','设为仅自己'),grid);
  for(const t of topics){const l=node('label',null,'q-opt'),c=node('input');c.type='checkbox';c.checked=sh.privateTopics.includes(t.id);c.addEventListener('change',()=>{const set=new Set(state.record.sharing.privateTopics);c.checked?set.add(t.id):set.delete(t.id);setVis({privateTopics:[...set]});});l.append(c,node('span',t.label));grid.append(l);}
  const sens=dims().flatMap(d=>d.questions.filter(q=>q.sensitive&&saved(d.id)?.answers?.[q.id]?.state==='answered'));
  box.append(node('h3','敏感题（默认仅自己）'),node('p',v.sensitiveNote,'q-muted'));
  if(!sens.length)box.append(node('p','你还没有答敏感题。','q-muted'));
  for(const q of sens){const l=node('label',null,'q-opt'),c=node('input');c.type='checkbox';c.checked=sh.shareSensitive.includes(q.id);c.addEventListener('change',()=>{const set=new Set(state.record.sharing.shareSensitive);c.checked?set.add(q.id):set.delete(q.id);setVis({shareSensitive:[...set]});});l.append(c,node('span','给对方看：'+q.text));box.append(l);}
 }
 async function setVis(body){
  try{apply(await api('/visibility','PUT',body));$('#q-visibility-status').textContent='已更新，马上生效。';}
  catch(e){$('#q-visibility-status').textContent=e.message;renderVisibility();}
 }

 // ---------- 互看 ----------
 const labelOf=id=>dims().find(d=>d.id===id)?.label||id;
 const answerText=(q,a)=>{if(!a)return '没有填写';if(a.state==='skip')return '跳过';if(a.state==='discuss')return '待讨论'+(a.note?`：${a.note}`:'');const opt=v=>q.options.find(o=>o.value===v);if(q.type==='scale')return `${a.value} / 5（1=${q.lowLabel}，5=${q.highLabel}）`;if(q.type==='multi')return Array.isArray(a.value)?a.value.map(v=>opt(v)?.label||v).join('、'):'';return opt(a.value)?.label||String(a.value);};
 async function loadPeers(){
  const box=$('#q-peers');
  try{const {peers}=await api('/peers');state.peers=peers;box.replaceChildren();
   if(!peers.length){box.append(node('p','还没有互相加上的人。先在交友页认识朋友，再回来看看。','q-muted'));return;}
   for(const p of peers){
    const card=node('div',null,'q-peer');card.append(node('h3',p.nickname));
    if(p.theirOffered.length)card.append(node('p',`TA 愿意和你互看：${p.theirOffered.map(labelOf).join('、')}`,'q-muted'));
    if(p.mutualDimensions.length)card.append(node('p',`你们已经可以互看：${p.mutualDimensions.map(labelOf).join('、')}`,'q-ok'));
    const grid=node('div',null,'q-share-grid');
    for(const d of dims()){const st=saved(d.id)?.status;const l=node('label',null,'q-opt'),c=node('input');c.type='checkbox';c.value=d.id;c.checked=p.myOffered.includes(d.id);if(!st||st==='skipped'){c.disabled=!c.checked;l.title='先填写这个方向才能开放';}l.append(c,node('span',d.label));grid.append(l);}
    const saveBtn=node('button','保存我的开放范围','q-secondary');saveBtn.type='button';
    saveBtn.addEventListener('click',async()=>{const chosen=[...grid.querySelectorAll('input:checked')].map(c=>c.value);if(chosen.length&&!confirm(`确认向「${p.nickname}」开放：${chosen.map(labelOf).join('、')}？\n只有对方也开放同一方向时，你们才会互相看到。敏感题仍然要你逐题打开。可随时取消。`))return;try{await api('/shares/'+encodeURIComponent(p.shareId),'PUT',chosen.length?{dimensions:chosen,consent:true}:{dimensions:[]});$('#q-status').textContent='已更新开放范围。';loadPeers();}catch(e){$('#q-status').textContent=e.message;}});
    const viewBtn=node('button','看看TA给我看的答案','q-secondary');viewBtn.type='button';viewBtn.addEventListener('click',()=>showPeer(p.shareId));
    const actions=node('div',null,'q-actions');actions.append(saveBtn,viewBtn);card.append(grid,actions);box.append(card);
   }
  }catch(e){box.replaceChildren(node('p',e.message,'q-muted'));}
 }
 function renderPeerAnswers(view,r){
  const flagged=new Set((r.highlights||[]).map(h=>h.questionId));let any=false;
  for(const d of dims()){
   const pd=r.peer?.dimensions?.[d.id];if(!pd||!Object.keys(pd.answers||{}).length)continue;any=true;
   const sec=node('details',null,'q-peer-dim');sec.append(node('summary',d.label));const dl=node('dl');
   for(const q of d.questions){const a=pd.answers[q.id];if(!a)continue;const dt=node('dt',q.text);if(flagged.has(q.id))dt.append(' ',node('span','底线不同','q-flag'));dl.append(dt,node('dd',answerText(q,a)));if(a.note&&a.state==='answered')dl.append(node('dd','TA补充：'+a.note,'q-peer-note'));}
   sec.append(dl);view.append(sec);
  }
  for(const n of r.notes||[])view.append(node('p',n,'q-talk'));
  return any;
 }
 async function showPeer(shareId){
  const view=$('#q-peer-view');view.hidden=false;view.replaceChildren(node('p','正在读取…','q-muted'));
  try{const r=await api('/shares/'+encodeURIComponent(shareId));view.replaceChildren(node('h3',`「${r.nickname}」给你看的答案`));
   if(r.explanations.length){const ul=node('ul',null,'q-explain');for(const e of r.explanations)ul.append(node('li',e.text,e.signal==='close'?'q-ok':'q-talk'));view.append(ul);}
   if(!renderPeerAnswers(view,r))view.append(node('p','TA 暂时没有可以给你看的答案。','q-muted'));
   if(!state.progress?.quick?.ready)view.append(node('p','先答完自己的底线题，才能看到TA的底线题。','q-muted'));
   view.append(node('p',r.note+' “需要聊聊”“底线不同”都只是提醒：值得见面时多聊几句。','q-muted'));
  }catch(e){view.replaceChildren(node('p',e.message,'q-muted'));}
 }

 // ---------- 启动 ----------
 async function load(){
  const epoch=++state.epoch;
  try{const r=await api();if(epoch!==state.epoch)return;apply(r);
   $('#q-app').hidden=false;$('#q-login').hidden=true;
   const next=r.progress.nextDimension;
   state.index=!r.progress.quick?.ready?0:Math.max(1,next?dims().findIndex(d=>d.id===next)+1:1);
   state.draft=draftFor(current());state.dirty=false;state.openNotes.clear();
   $('#q-status').textContent=!r.questionnaire?'先答底线题，大约3分钟；其余都是选填。':!r.progress.quick?.ready?'欢迎回来，先把底线题答完。':next?`欢迎回来，从「${current().label}」接着写。`:'十个方向你都看过了，可以随时回来修改。';
   $('#q-matching').checked=!!r.questionnaire?.matchingConsent;
   if(!next&&r.questionnaire&&r.progress.quick?.ready)showSummary();else{$('#q-form').hidden=false;render();}
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
 fetch('/assets/data/friends-marriage-questionnaire.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('问卷暂时没准备好');return r.json();}).then(bank=>{state.bank=bank;
  if(bank.entry){$('#q-title').textContent=bank.entry.title;$('#q-lead').textContent=bank.entry.subtitle;}
  load();}).catch(e=>$('#q-status').textContent=e.message);
})();
