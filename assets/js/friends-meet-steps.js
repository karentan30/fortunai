'use strict';
// 相生 · 「见面四步」：互相认识的两个人，按 线上聊 → 语音 → 视频见真人 → 线下见面 一步步来。
// v1 不做站内通话：大家用微信语音/视频，然后在这里各自点「已完成」。双方都点了，这一步才算完成。
// 第 2/3/4 步可以「约个时间」：一方给 1–3 个时间，另一方选一个或换个时间。全部按北京时间。
// 文案与服务端共用这一份（server/lib/friends-meet-steps.js 读 STEPS / KINDS / COPY）。
(function(root){
  const STEPS=[
    {key:'chat',title:'线上聊',guide:'先在微信聊几句；想深入些，可以各自填婚恋问卷，再对比聊聊。',link:{href:'/pages/friends-questions.html',text:'去填婚恋问卷'}},
    {key:'voice',title:'语音通话',guide:'约 20 分钟微信语音，听听声音和说话节奏。',kind:'call'},
    {key:'video',title:'视频见真人',guide:'建议先视频：节省交通和时间成本，也能确认是本人。视频聊得有意向了，再约时间见面。',kind:'video'},
    {key:'offline',title:'线下见面',guide:'约一杯咖啡或一顿饭，时间别太长，舒服最重要。',kind:'meet'}
  ];
  const KINDS={call:{step:2,minutes:20,word:'通话',ask:'约个通话时间'},video:{step:3,minutes:30,word:'视频',ask:'约个视频时间'},meet:{step:4,minutes:60,word:'见面',ask:'约个见面时间'}};
  const SAFETY=['约在白天和公共场所（咖啡馆、餐厅、公园）','告诉一位朋友你去哪、和谁','自己往返，不要喝离开视线的饮品','不舒服可以随时离开'];
  const COPY={badge:'已视频见过',badgeNote:'双方自己确认，不是平台核验',skipReminder:'建议先视频聊聊：省下路上的时间，有意向再约见面，也能确认和照片是同一个人。',wait:'等TA确认',theirs:'TA已点完成，等你确认',done:'双方已完成',confirm:'已完成',undo:'先停在这一步',report:'遇到骚扰可在站内举报',title:'见面四步',lead:'推荐按顺序来，也可以跳过。每一步双方都点「已完成」才算完成。',tz:'时间均为北京时间'};
  const api={STEPS,KINDS,SAFETY,COPY};
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  const bjDate=t=>new Date(t+8*3600000).toISOString().slice(0,10);
  function apptHTML(kind,a){
    const k=KINDS[kind],s=a?.schedule,b=(act,text,cls='text-button',extra='')=>`<button type="button" class="${cls}" data-appt="${kind}" data-appt-action="${act}"${extra}>${text}</button>`;
    if(s?.status==='booked')return `<div class="ms-appt is-booked"><p class="ms-booked">${esc(s.text)}</p><div class="ms-act">${b('ics','加到日历','secondary')}${b('form','换个时间')}${b('cancel','取消')}</div></div>`;
    if(s?.status==='proposed'&&s.byMe)return `<div class="ms-appt"><p class="ms-appt-line">已发给TA：${s.proposals.map(p=>esc(p.label)).join('、')}${s.place?' · '+esc(s.place):''}，等TA选。</p><div class="ms-act">${b('form','换个时间')}${b('cancel','取消')}</div></div>`;
    if(s?.status==='proposed')return `<div class="ms-appt"><p class="ms-appt-line">TA约你${k.word}${s.place?'（'+esc(s.place)+'）':''}，选一个：</p><div class="ms-chips">${s.proposals.map(p=>b('pick',esc(p.label),'secondary ms-chip',` data-start="${esc(p.start)}"`)).join('')}</div><div class="ms-act">${b('form','换个时间')}</div></div>`;
    return `<div class="ms-appt">${b('form',k.ask,'text-button ms-ask')}</div>`;
  }
  function formHTML(kind,a,now){
    const k=KINDS[kind],min=bjDate(now),max=bjDate(now+14*86400000),sug=a?.suggested||[];
    const row=i=>`<div class="ms-slot"><input type="date" name="d${i}" min="${min}" max="${max}" aria-label="第${i+1}个时间的日期"><input type="time" name="t${i}" step="1800" aria-label="第${i+1}个时间的开始时间"></div>`;
    return `<form class="ms-form" data-appt-form="${kind}">${sug.length?`<p class="fine-print">你们都有空的时间：</p><div class="ms-chips">${sug.map(x=>`<button type="button" class="secondary ms-chip" data-fill="${esc(x.start)}">${esc(x.label)}</button>`).join('')}</div>`:''}<p class="fine-print">给 1 到 3 个时间（${k.minutes} 分钟，14 天内，${COPY.tz}）</p>${[0,1,2].map(row).join('')}${kind==='meet'?`<label class="ms-place">地点（选填）<input name="place" maxlength="40" placeholder="如 某商场一楼咖啡馆"></label>`:''}<div class="ms-act"><button type="submit" class="primary">发给TA</button><button type="button" class="text-button" data-appt-close>先不约</button></div></form>`;
  }
  // Render from the server view (GET /api/friends/meet/:shareId).
  const TOPICS=()=>(typeof module==='object'&&module.exports?require('./friends-meet-topics'):root.XSMeetTopics)||null;
  // ctx: {shared:[双方都勾了的约会活动], agree:[问卷想法接近的方向], differ:[想法不同/标了底线的方向]}; page 1 = 「换一批」.
  function topicList(step,ctx={},page=0){
    const T=TOPICS(),d=T?.TOPICS?.[step];if(!d)return null;
    const base=page?d.topics.slice(0,d.topics.length-d.more.length).concat(d.more):d.topics;
    const pick={activity:ctx.shared,qAgree:ctx.agree,qDiffer:ctx.differ};
    const items=base.map(t=>{if(!t.slot)return t;const v=(pick[t.slot]||[]).find(x=>typeof x==='string'&&x.trim());if(!v)return t.fallback;const f=s=>s.replace(/\{[aq]\}/g,v.trim().slice(0,20));return {topic:f(t.topic),opener:f(t.opener)};});
    return {title:T.TITLE,more:T.MORE,hint:d.hint,note:d.note||'',items};
  }
  function topicsHTML(step,ctx,page){
    const t=topicList(step,ctx,page);if(!t)return '';
    return `<details class="ms-topics"${page?' open':''}><summary>${esc(t.title)}<small> · ${esc(t.hint)}</small></summary><ul>${t.items.map(x=>`<li><strong>${esc(x.topic)}</strong><span>「${esc(x.opener)}」</span></li>`).join('')}</ul>${t.note?`<p class="fine-print">${esc(t.note)}</p>`:''}<button type="button" class="text-button ms-topics-more" data-topics-more="${step}">${esc(t.more)}</button></details>`;
  }
  function html(view,now=Date.now(),openForm='',ctx={},pages={}){
    const steps=view.steps||[],ap=view.appointments||{},current=(steps.find(x=>!x.done)||{step:5}).step;
    const strip='<ol class="ms-strip">'+STEPS.map((s,i)=>{const v=steps[i]||{},st=v.done?'done':v.mine||v.theirs?'half':(i+1===current?'now':'todo');return `<li class="ms-dot is-${st}"><span class="ms-num" aria-hidden="true">${v.done?'✓':i+1}</span><span class="ms-name">${esc(s.title)}</span></li>`;}).join('')+'</ol>';
    const booked=Object.keys(KINDS).map(k=>ap[k]?.schedule).filter(s=>s?.status==='booked').map(s=>`<p class="ms-booked">${esc(s.text)}</p>`).join('');
    const rows=STEPS.map((s,i)=>{const v=steps[i]||{},n=i+1,state=v.done?COPY.done:v.mine?COPY.wait:v.theirs?COPY.theirs:'';
      const act=v.mine?`<button type="button" class="text-button ms-undo" data-meet-step="${n}" data-meet-action="undo">${COPY.undo}</button>`:`<button type="button" class="secondary ms-confirm" data-meet-step="${n}" data-meet-action="confirm">${COPY.confirm}</button>`;
      const extra=s.link?` <a class="text-button" href="${s.link.href}">${esc(s.link.text)}</a>`:'';
      const appt=s.kind&&(openForm===s.kind||!v.done||ap[s.kind]?.schedule)?(openForm===s.kind?formHTML(s.kind,ap[s.kind],now):apptHTML(s.kind,ap[s.kind])):'';
      const safety=n===4?`${view.skipReminder?`<p class="ms-remind" role="status">${esc(view.skipReminder)}</p>`:''}<ul class="ms-safety">${SAFETY.map(t=>`<li>${esc(t)}</li>`).join('')}<li>${esc(COPY.report)}，<button type="button" class="text-button ms-report">去举报</button></li></ul>`:'';
      return `<li class="ms-step${n===current?' is-current':''}${v.done?' is-done':''}"><div class="ms-head"><strong>${n}. ${esc(s.title)}</strong>${state?`<span class="ms-state">${state}</span>`:''}</div><p class="ms-guide">${esc(s.guide)}${extra}</p>${appt}${n>1?topicsHTML(n,ctx,pages[n]||0):''}${safety}<div class="ms-act">${act}</div></li>`;}).join('');
    const badge=view.videoMet?`<p class="ms-badge"><span>${COPY.badge}</span><small>${COPY.badgeNote}</small></p>`:'';
    return `<h3 class="ms-title">${COPY.title}</h3>${badge}${strip}<details class="ms-more"><summary>${current<5?'下一步：'+esc(STEPS[current-1].title):'四步都完成了'}<small> · 展开看每一步</small></summary><p class="fine-print">${COPY.lead}</p><ol class="ms-steps">${rows}</ol></details>${booked?`<div class="ms-upnext">${booked}</div>`:''}`;
  }
  function ics(kind,s){
    const f=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),k=KINDS[kind];
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//xiangsheng//meet//CN','BEGIN:VEVENT','UID:'+f(s.start)+'-'+kind+'@xiangsheng','DTSTAMP:'+f(Date.now()),'DTSTART:'+f(s.start),'DTEND:'+f(s.end),'SUMMARY:相生 · '+k.word+(s.place?' · '+s.place.replace(/[,;\\\n]/g,' '):''),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  // box: container element; deps: {api,post,toast}. Re-renders after each tap.
  async function mount(box,shareId,deps){
    if(!box)return;const url='/api/friends/meet/'+encodeURIComponent(shareId);let view=null;
    const send=async(path,body,b)=>{if(b)b.disabled=true;try{const r=await deps.post(url+path,body);view=r;render('',true);if(r.reminder)deps.toast?.(r.reminder);}catch(e){if(b)b.disabled=false;deps.toast?.(e.message);}};
    const pages={},ctx={shared:Array.isArray(deps.shared)?deps.shared:[],agree:[],differ:[]};
    // [HOOK meet-topics-questionnaire] 婚恋问卷对比还在改，这里不 import 问卷文件。若以后有一个「本人可看」的对比接口，
    // 让它挂 window.XSMeetQuestionnaireTopics=async shareId=>({agree:['婚后住哪'],differ:['要不要孩子']})（只放双方都开放的方向名）。
    // 没挂、报错或格式不对时，第 3/4 步自动用通用话题。
    try{const q=await root.XSMeetQuestionnaireTopics?.(shareId);if(q&&Array.isArray(q.agree))ctx.agree=q.agree.filter(x=>typeof x==='string').slice(0,3);if(q&&Array.isArray(q.differ))ctx.differ=q.differ.filter(x=>typeof x==='string').slice(0,3);}catch(_){}
    const render=(openForm,open)=>{box.innerHTML=html(view,Date.now(),openForm,ctx,pages);if(open)box.querySelector('.ms-more').open=true;
      box.querySelectorAll('[data-topics-more]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.topicsMore;pages[n]=pages[n]?0:1;render(openForm,true);box.querySelector(`[data-topics-more="${n}"]`)?.closest('details')?.setAttribute('open','');}));
      box.querySelector('.ms-report')?.addEventListener('click',()=>document.getElementById('report-person')?.click());
      box.querySelectorAll('[data-meet-step]').forEach(b=>b.addEventListener('click',()=>send('',{step:Number(b.dataset.meetStep),action:b.dataset.meetAction},b)));
      box.querySelectorAll('[data-appt]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.appt,act=b.dataset.apptAction,s=view.appointments[kind].schedule;
        if(act==='form')return render(kind,true);
        if(act==='ics'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics(kind,s)],{type:'text/calendar'}));a.download='xiangsheng-'+kind+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;}
        if(act==='cancel'&&!confirm('取消这次约好的时间？'))return;
        send('/appointment',{kind,action:act,...(act==='pick'?{start:b.dataset.start}:{})},b);}));
      const form=box.querySelector('[data-appt-form]');if(!form)return;
      form.querySelector('[data-appt-close]').addEventListener('click',()=>render('',true));
      form.querySelectorAll('[data-fill]').forEach(b=>b.addEventListener('click',()=>{const bj=new Date(Date.parse(b.dataset.fill)+8*3600000).toISOString(),i=[0,1,2].find(i=>!form['d'+i].value)??0;form['d'+i].value=bj.slice(0,10);form['t'+i].value=bj.slice(11,16);b.disabled=true;}));
      form.addEventListener('submit',e=>{e.preventDefault();const slots=[0,1,2].map(i=>({date:form['d'+i].value,time:form['t'+i].value})).filter(x=>x.date||x.time);if(!slots.length){deps.toast?.('请至少给一个时间');return;}
        send('/appointment',{kind:form.dataset.apptForm,action:'propose',slots,...(form.place?{place:form.place.value}:{})},form.querySelector('[type=submit]'));});};
    try{view=await deps.api(url);render('',false);}catch(_){box.remove();}
  }
  Object.assign(api,{html,mount,ics,topicList});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.XSMeetSteps=api;
})(typeof window!=='undefined'?window:globalThis);
