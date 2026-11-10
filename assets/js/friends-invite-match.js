'use strict';
// 「测测我们是否相配」邀请闭环（合盘页 friends-compatibility.html 上的一层）：
//  · 被邀请的朋友：登录后一屏填完 —— 称呼、生日、时辰（可选「不确定」）、性别、14 道底线题（可跳过）、授权 → 一次提交（/join）。
//  · 发起人：选邀请谁（朋友/暧昧对象，或在考虑结婚的恋人）、复制邀请文字；还没答底线题时在本次邀请里直接补答并加入结果。
//  · 结果页：在合盘报告下面加「三观」方向提示（同频 / 可以聊聊；恋人版：婚前值得聊开）和结尾按钮。
// 只用 createElement + textContent；不展示任何人的生日、四柱原值或原始答案。文案红线见 server/lib/friends-copy-guard.js。
(()=>{
 const $=s=>document.querySelector(s);
 function h(tag,attrs,...kids){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else n.setAttribute(k,v===true?'':v);}for(const k of kids.flat()){if(k==null)continue;n.append(typeof k==='string'?document.createTextNode(k):k);}return n;}
 const BANK_URL='/assets/data/friends-marriage-questionnaire.json',Q_API='/api/friends/questionnaire',C_API='/api/friends/compatibility';
 const HOURS=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
 const COPY={
  friend:{title:n=>[n,' 邀你测测你们是否相配'],lede:'大约三分钟：填生日，答 14 道底线题。你的生日只用来排盘，对方看不到。',share:'我在相生测了日主和三观，你也来填一下，看看我们有多同频：',dirs:'三观：哪些方向同频，哪些可以聊聊'},
  couple:{title:n=>[n,' 邀你一起看看，婚前哪些地方同频'],lede:'大约三分钟：填生日，答 14 道底线题。你的生日只用来排盘，对方看不到。',share:'我们在一起一段时间了，一起填一下日主和三观，看看婚前哪些地方同频、哪些值得先聊开：',dirs:'婚前：哪些方向同频，哪些值得先聊开'}
 };
 const rel=r=>r==='couple'?'couple':'friend';
 let bankPromise=null;
 const bank=()=>bankPromise||=fetch(BANK_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('题目暂时读不到，可以先跳过');return r.json();});
 async function api(path,{method='GET',body}={}){const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},...(body?{body:JSON.stringify(body)}:{})});let v={};try{v=await r.json();}catch{}if(!r.ok)throw Object.assign(Error(v.error||'操作未完成'),{status:r.status,code:v.code});return v;}

 // ---------- 14 道底线题（紧凑版） ----------
 // 渲染进 container；answers() 只返回答了的题；save() 合并进本人「认真结婚」问卷（不覆盖已答的其他题）。
 async function quickQuestions(container,{prefill=true}={}){
  const b=await bank(),ids=b.quickPath?.questions||[],list=[];
  for(const id of ids)for(const d of b.dimensions){const q=d.questions.find(q=>q.id===id);if(q)list.push({d,q});}
  let existing=null;
  if(prefill){try{existing=(await api(Q_API)).questionnaire;}catch{}}
  const old=id=>{for(const d of Object.values(existing?.dimensions||{}))if(d?.answers?.[id])return d.answers[id];return null;};
  const box=h('ol',{class:'im-qs'});
  list.forEach(({q},i)=>{
   const prev=old(q.id),multi=q.type==='multi',fs=h('fieldset',{class:'im-q'});
   fs.append(h('legend',{},h('small',{text:String(i+1).padStart(2,'0')}),q.text));
   const opts=h('div',{class:'im-opts'});
   for(const o of q.options){const input=h('input',{type:multi?'checkbox':'radio',name:'im-'+q.id,value:o.value});if(prev?.state==='answered'&&(multi?Array.isArray(prev.value)&&prev.value.includes(o.value):prev.value===o.value))input.checked=true;opts.append(h('label',{class:'im-opt'},input,h('span',{text:o.label})));}
   fs.append(opts);if(q.sensitive)fs.append(h('p',{class:'im-q-note',text:'这题默认只有你自己看得到，也不会用于结果。'}));
   box.append(h('li',{},fs));
  });
  container.replaceChildren(box);
  const answers=()=>{const out={};for(const {d,q} of list){const picked=[...container.querySelectorAll('input[name="im-'+q.id+'"]:checked')].map(x=>x.value);if(!picked.length)continue;(out[d.id]||={})[q.id]={state:'answered',value:q.type==='multi'?picked.slice(0,q.maxSelect||picked.length):picked[0]};}return out;};
  const count=()=>Object.values(answers()).reduce((n,a)=>n+Object.keys(a).length,0);
  async function save(){
   const add=answers();if(!Object.keys(add).length)return 0;
   const cur=(await api(Q_API)).questionnaire;let revision=cur?.revision||0;
   for(const [dim,next] of Object.entries(add)){
    const before=cur?.dimensions?.[dim],kept={};
    for(const [id,a] of Object.entries(before?.answers||{}))kept[id]=Object.fromEntries(Object.entries(a).filter(([k])=>['state','value','note','importance'].includes(k)));
    const status=['in_progress','done','discuss'].includes(before?.status)?before.status:'in_progress';
    const r=await api(Q_API+'/dimensions/'+encodeURIComponent(dim),{method:'PUT',body:{version:b.version,consent:true,status,answers:{...kept,...next},expectedRevision:revision}});
    revision=r.questionnaire?.revision??revision+1;
   }
   return count();
  }
  return {answers,count,save,total:list.length};
 }

 // ---------- 被邀请的朋友：一屏加入 ----------
 const req=(id,text)=>h('label',{class:'chk'},h('input',{id,type:'checkbox'}),h('span',{class:'box'}),h('span',{class:'t'},h('span',{class:'req',text:'必选'}),...text));
 function joinForm(preview){
  const c=COPY[rel(preview.relation)],f=h('form',{id:'im-join',class:'hv4 im-join',novalidate:true});
  const year=h('input',{class:'in',id:'im-year',type:'text',inputmode:'numeric',placeholder:'年',maxlength:'4',autocomplete:'off','aria-label':'出生年'});
  const month=h('select',{class:'in',id:'im-month','aria-label':'出生月'},h('option',{value:'',text:'月'})),day=h('select',{class:'in',id:'im-day','aria-label':'出生日'},h('option',{value:'',text:'日'}));
  for(let n=1;n<=12;n++)month.append(h('option',{value:String(n),text:n+' 月'}));for(let n=1;n<=31;n++)day.append(h('option',{value:String(n),text:n+' 日'}));
  const hours=h('div',{class:'hours im-hours',role:'radiogroup','aria-label':'出生时辰'});
  HOURS.forEach((z,i)=>hours.append(h('label',{},h('input',{type:'radio',name:'im-hour',value:String(i)}),z+'时',h('small',{text:String((i*2+23)%24).padStart(2,'0')+'–'+String(i*2+1).padStart(2,'0')}))));
  hours.append(h('label',{class:'im-unk'},h('input',{type:'radio',name:'im-hour',value:'unknown'}),'不确定',h('small',{text:'按三柱看'})));
  const qs=h('div',{class:'im-qs-wrap'},h('p',{class:'note',text:'正在读取底线题…'}));
  f.append(
   h('p',{class:'eyebrow fill-head',text:'测 测 我 们 是 否 相 配'}),
   h('p',{class:'title'},h('em',{text:preview.ownerNickname||'TA'}),c.title('')[1]),
   h('p',{class:'lede',text:c.lede}),
   h('h2',{class:'hv-h',text:'一 · 你 的 生 日'}),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'你的称呼'}),h('small',{text:'给 TA 核对是你'})),h('input',{class:'in',id:'im-nickname',maxlength:'24',autocomplete:'nickname',placeholder:'例如 阿青'})),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'出生日期'}),h('select',{class:'in cal',id:'im-calendar','aria-label':'日期类型'},h('option',{value:'solar',text:'公历'}),h('option',{value:'lunar',text:'农历'}))),h('div',{class:'row3'},year,month,day)),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'出生时辰'}),h('small',{text:'按当地时间，不确定也可以'})),hours),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'性别'}),h('small',{text:'用来定乾造/坤造'})),h('div',{class:'two'},h('label',{class:'opt'},h('input',{type:'radio',name:'im-gender',value:'female'}),'女'),h('label',{class:'opt'},h('input',{type:'radio',name:'im-gender',value:'male'}),'男'))),
   h('h2',{class:'hv-h',text:'二 · 14 道 底 线 题'}),
   h('p',{class:'note',text:'婚育、城市、见家长节奏这些最影响能不能走下去的事。每题都可以先不答。'}),
   qs,
   h('label',{class:'chk im-include'},h('input',{id:'im-include',type:'checkbox'}),h('span',{class:'box'}),h('span',{class:'t'},h('span',{class:'req o',text:'可选'}),'把我的底线题答案用于这次结果',h('small',{text:'双方都同意才出现。结果只显示「同频」或「可以聊聊」，不显示任何人的原始回答。'}))),
   h('h2',{class:'hv-h',text:'三 · 提 交 前 请 确 认'}),
   req('im-inference',['对方会看到你们每一柱之间是合、克还是冲，可能据此推测出你八字的一部分；但永远看不到你的生日。']),
   req('im-cross',['出境告知：相生由香港公司运营，你的资料（含生辰）会存储在香港服务器并在香港处理。',h('a',{href:'/pages/friends-privacy.html#cross-border',target:'_blank',rel:'noopener',text:'查看详情 ›'})]),
   req('im-adult',['我已满 18 岁，所填是我本人的真实生辰。']),
   h('button',{class:'btn-p sp',id:'im-submit',type:'submit',text:'提交，看我们的结果'}),
   h('p',{class:'hint',id:'im-hint',text:'提交即认领这份邀请，TA 会看到你填的称呼、核对是你，之后你们一起看结果。'}),
   h('p',{class:'err',id:'im-error',role:'alert'}));
  return {form:f,qs};
 }
 function readBirth(f){
  const y=f.querySelector('#im-year').value.trim(),m=f.querySelector('#im-month').value,d=f.querySelector('#im-day').value;
  if(!/^\d{4}$/.test(y)||!m||!d)throw Error('请填完整出生日期。');
  const hour=f.querySelector('input[name=im-hour]:checked')?.value;if(!hour)throw Error('请选择出生时辰，不确定就选「不确定」。');
  const gender=f.querySelector('input[name=im-gender]:checked')?.value;if(!gender)throw Error('请选择性别。');
  return {birthday:[y,m.padStart(2,'0'),d.padStart(2,'0')].join('-'),calendar:f.querySelector('#im-calendar').value==='lunar'?'lunar':'solar',time:hour==='unknown'?null:String(+hour*2).padStart(2,'0')+':00',gender};
 }
 // 未登录：只显示是谁邀请（invite-preview 不含任何生辰/问卷）。
 async function intro(token){
  const box=$('#im-intro');if(!box)return null;let p=null;
  try{p=await api(C_API+'/invite-preview/'+encodeURIComponent(token));}catch(e){box.hidden=false;box.replaceChildren(h('h1',{text:'这份邀请已失效'}),h('p',{class:'muted',text:e.message+'。可以请对方重新发一份。'}));return null;}
  const c=COPY[rel(p.relation)];box.hidden=false;
  box.replaceChildren(h('p',{class:'im-eyebrow',text:'相生 · 测测我们是否相配'}),h('h1',{},h('em',{text:p.ownerNickname||'TA'}),c.title('')[1]),h('p',{class:'muted',text:'用自己的账号参与：先登录或创建账号，再用三分钟填生日和 14 道底线题。双方都看不到对方的生日和原始回答。'}));
  return p;
 }
 // 已登录：渲染一屏表单；成功后回调 onJoined(pairId)。
 async function startJoin(token,{onJoined}){
  const host=$('#im-join-host');if(!host)return;
  let preview;try{preview=await api(C_API+'/invite-preview/'+encodeURIComponent(token));}catch(e){host.hidden=false;host.replaceChildren(h('p',{class:'error',text:e.message+'。如果你已经提交过，可以在下方「我的双人邀请」里查看。'}));return false;}
  document.body.classList.add('im-invite');
  const {form,qs}=joinForm(preview);host.hidden=false;host.replaceChildren(form);
  const q=await quickQuestions(qs).catch(e=>{qs.replaceChildren(h('p',{class:'note',text:e.message}));return null;});
  form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('#im-submit'),err=form.querySelector('#im-error');err.textContent='';
   try{
    const nickname=form.querySelector('#im-nickname').value.trim();if(!nickname)throw Error('请填一个称呼，方便 TA 核对是你。');
    const input=readBirth(form);
    if(!['im-inference','im-cross','im-adult'].every(id=>form.querySelector('#'+id).checked))throw Error('请勾选三项必选确认。');
    const include=form.querySelector('#im-include').checked;
    btn.disabled=true;btn.textContent='正在提交…';
    const pair=await api(C_API+'/join',{method:'POST',body:{inviteToken:token,nickname,claimConsent:true,version:'compatibility-guide-v4',consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,includeQuestionnaire:include,allowChat:false,input}});
    let saved=0,saveError=null;if(q)try{saved=await q.save();}catch(x){saveError=x;}
    document.body.classList.remove('im-invite');document.body.classList.add('im-joined');host.replaceChildren(h('div',{class:'panel im-done'},h('h2',{text:'已提交'}),h('p',{text:saved?'你答了 '+saved+' 道底线题，已存进你自己的问卷。':'底线题之后也可以在问卷里补答。'}),saveError?h('p',{class:'error',text:'底线题暂未保存：'+saveError.message}):null));
    await onJoined(pair.id);
   }catch(x){err.textContent=x.message;btn.disabled=false;btn.textContent='提交，看我们的结果';}
  });
  return true;
 }

 // ---------- 发起人：本次邀请里的补充 ----------
 function shareText(relation,link){return COPY[rel(relation)].share+link;}
 async function pairExtras(host,p,{onChanged}){
  if(!host)return;host.replaceChildren();
  if(!p||!p.myAuthorized||!['pending_recipient','pending_recipient_confirmation','pending_authorizations','ready'].includes(p.status))return;
  if(p.direction==='incoming'&&p.status==='pending_recipient_confirmation')host.append(h('p',{class:'im-wait',text:'已提交。等 '+(p.peer?.nickname||'TA')+' 核对一下是你，你们就能一起看结果。'}));
  if(p.myQuestionnaireIncluded){host.append(h('p',{class:'muted im-qline'},'你的底线题已加入这次结果。',h('a',{href:'/pages/friends-questions.html',text:'修改答案'})));return;}
  const box=h('section',{class:'hv4 im-mine'},h('h2',{class:'hv-h',text:'三 观 部 分'}),h('p',{class:'lede',text:p.peerQuestionnaireIncluded?'TA 已经答了底线题。你也答一下，结果里就能看到你们在哪些方向同频、哪些可以聊聊。':'答 14 道底线题并加入结果，三观部分才有内容。只显示「同频」或「可以聊聊」，不显示原始回答。'}));
  const qs=h('div',{class:'im-qs-wrap'}),err=h('p',{class:'err',role:'alert'}),btn=h('button',{type:'button',class:'btn-p',text:'保存并加入这次结果'});
  box.append(qs,btn,err);host.append(box);
  let q=null;try{q=await quickQuestions(qs);}catch(e){qs.replaceChildren(h('p',{class:'note',text:e.message}));}
  btn.addEventListener('click',async()=>{err.textContent='';btn.disabled=true;try{if(q)await q.save();const next=await api(C_API+'/pairs/'+encodeURIComponent(p.id)+'/questionnaire',{method:'POST',body:{include:true}});await onChanged(next);}catch(e){err.textContent=e.message;btn.disabled=false;}});
 }

 // ---------- 结果页：方向提示 + 结尾按钮 ----------
 function renderDirections(report,{onInclude}={}){
  const qd=report.questionnaireDirections,relation=rel(report.relation||qd?.relation),couple=relation==='couple',out=h('section',{class:'im-result'});
  if(qd){
   const sec=h('section',{class:'im-dirs','aria-labelledby':'im-dirs-title'},h('h2',{id:'im-dirs-title',text:COPY[relation].dirs}));
   if(qd.status==='available'){const ul=h('ul',{class:'im-dir-list'});for(const d of qd.directions)ul.append(h('li',{class:'im-dir '+(d.tone==='same'?'same':d.tone==='talk'?'talk':'open')},h('span',{class:'im-tag',text:d.tag}),h('b',{text:d.label}),h('span',{text:d.text})));sec.append(ul);}
   sec.append(h('p',{class:'muted',text:qd.note}));
   if(qd.status==='not_authorized'&&!qd.mineIncluded&&onInclude){const b=h('button',{type:'button',class:'btn-o',text:'答底线题并加入结果'});b.addEventListener('click',onInclude);sec.append(b);}
   out.append(sec);
  }
  const cta=couple
   ?h('section',{class:'im-cta'},h('p',{class:'im-cta-lead',text:'值得聊开的方向，不必一次谈完。'}),h('a',{class:'btn-p',href:'/pages/friends-questions.html',text:'去问卷里，一个方向一个方向聊'}),h('p',{class:'muted',text:'其余题都是选填，两个人可以各自慢慢填。'}))
   :h('section',{class:'im-cta'},h('a',{class:'btn-p',href:'/pages/friends-connect.html#profile',text:'留张卡片，遇到和你相合的人，第一时间告诉你'}),h('p',{class:'muted',text:'首批成员审核入驻中。卡片由你决定公开哪些资料。'}));
  out.append(cta);
  return out;
 }

 window.XsInviteMatch={quickQuestions,intro,startJoin,pairExtras,renderDirections,shareText};
})();
