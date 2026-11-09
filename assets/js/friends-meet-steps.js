'use strict';
// 相生 · 「见面四步」：互相认识的两个人，按 线上聊 → 语音 → 视频见真人 → 线下见面 一步步来。
// v1 不做站内通话：大家用微信语音/视频，然后在这里各自点「已完成」。双方都点了，这一步才算完成。
// 第 2/3/4 步可以「约个时间」：一方给 1–3 个时间，另一方选一个或换个时间。全部按北京时间。
// 文案与服务端共用这一份（server/lib/friends-meet-steps.js 读 STEPS / KINDS / COPY）。
(function(root){
  const STEPS=[
    {key:'chat',title:'线上聊',guide:'先在微信聊几句；想深入些，可以各自填婚恋问卷，再对比聊聊。',link:{href:'/pages/friends-questions.html',text:'去填婚恋问卷'}},
    {key:'voice',title:'语音通话',guide:'约个微信语音，听听声音和说话节奏。15分钟就好，聊得来下次再聊久一点。',kind:'call'},
    {key:'video',title:'视频见真人',guide:'建议先视频：节省交通和时间成本，也能确认是本人。视频聊得有意向了，再约时间见面。',kind:'video'},
    {key:'offline',title:'线下见面',guide:'除了吃饭喝咖啡，也可以一起做点别的——打场球、爬个山、看个展，比干坐着吃一顿饭更容易熟。第一次见面一两个小时就好，意犹未尽比聊到没话说更好。',kind:'meet'}
  ];
  // 一起做什么：双方卡片上都勾了的放最前，然后吃饭、喝咖啡，再是 friends-date-activities.js 的其余选项。服务端按同一份清单校验。
  const ACT=()=>(typeof module==='object'&&module.exports?require('./friends-date-activities'):root.XiangshengDateActivities)||{DATE_ACTIVITIES:[],DATE_ACTIVITY_GROUPS:[]};
  const MEALS=['吃饭','喝咖啡'];
  const activityOptions=(shared=[])=>{const all=[...MEALS,...ACT().DATE_ACTIVITIES];return [...new Set([...(shared||[]).filter(x=>all.includes(x)),...all])];};
  const isSport=a=>!!a&&(ACT().DATE_ACTIVITY_GROUPS[0]?.items||[]).includes(a);
  const OUTDOOR=['徒步爬山','骑行','跑步','露营','滑雪','桨板/皮划艇','游泳'];
  const SPORT_SAFETY=a=>isSport(a)?['运动量量力而行，先热身，带上水'].concat(OUTDOOR.includes(a)?['户外项目走熟悉、人多的路线，出发前看天气']:[]):[];
  // 聊过之后各自悄悄选；只有都选「想见面」才同时告诉两个人。单方面的选择不会给对方看到。
  // 见面时长：默认跟着「一起做什么」走，用户可以改。
  const MEET_LENGTHS={60:'1小时',90:'1.5小时',120:'2小时',240:'半天'};
  const meetMinutes=a=>!a||a==='喝咖啡'?60:a==='吃饭'?90:120;
  const CHOICES={meet:'想见面',more:'再聊聊',end:'到这里就好'};
  const KINDS={call:{step:2,minutes:15,word:'通话',ask:'约个通话时间'},video:{step:3,minutes:30,word:'视频',ask:'约个视频时间'},meet:{step:4,minutes:60,word:'见面',ask:'约个见面时间'}};
  const SAFETY=['约在白天和公共场所（咖啡馆、餐厅、公园）','告诉一位朋友你去哪、和谁','自己往返，不要喝离开视线的饮品','不舒服可以随时离开'];
  const COPY={badge:'已视频见过',badgeNote:'双方自己确认，不是平台核验',skipReminder:'建议先视频聊聊，都想见再约',mutual:'你们都想见面',closed:'这段先到这里，谢谢认识',decideTitle:'聊过之后，想见面吗？',decideNote:'各自悄悄选。只有你们都选「想见面」才会同时告诉你们俩，其他选择TA看不到。',decideMine:'你选了「{c}」，随时可以改。',sportTopic:'边运动边聊，不用一直找话题',playTopic:'边玩边聊，不用一直找话题',wait:'等TA确认',theirs:'TA已点完成，等你确认',done:'双方已完成',confirm:'已完成',undo:'先停在这一步',report:'遇到骚扰可在站内举报',title:'见面四步',lead:'推荐按顺序来，也可以跳过。每一步双方都点「已完成」才算完成。',tz:'时间均为北京时间'};
  const api={STEPS,KINDS,SAFETY,COPY,CHOICES,MEALS,MEET_LENGTHS,meetMinutes,activityOptions,SPORT_SAFETY};
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  const bjDate=t=>new Date(t+8*3600000).toISOString().slice(0,10);
  function apptHTML(kind,a){
    const k=KINDS[kind],s=a?.schedule,b=(act,text,cls='text-button',extra='')=>`<button type="button" class="${cls}" data-appt="${kind}" data-appt-action="${act}"${extra}>${text}</button>`;
    if(s?.status==='booked')return `<div class="ms-appt is-booked"><p class="ms-booked">${esc(s.text)}</p><div class="ms-act">${b('ics','加到日历','secondary')}${b('form','换个时间')}${b('cancel','取消')}</div></div>`;
    if(s?.status==='proposed'&&s.byMe)return `<div class="ms-appt"><p class="ms-appt-line">已发给TA：${s.proposals.map(p=>esc(p.label)).join('、')}${s.activity?' · '+esc(s.activity):''}${s.place?' · '+esc(s.place):''}${kind==='meet'&&MEET_LENGTHS[s.minutes]?' · '+MEET_LENGTHS[s.minutes]:''}，等TA选。</p><div class="ms-act">${b('form','换个时间')}${b('cancel','取消')}</div></div>`;
    if(s?.status==='proposed')return `<div class="ms-appt"><p class="ms-appt-line">TA约你${s.activity?esc(s.activity):k.word}${s.place?'（'+esc(s.place)+'）':''}${kind==='meet'&&MEET_LENGTHS[s.minutes]?' · '+MEET_LENGTHS[s.minutes]:''}，选一个：</p><div class="ms-chips">${s.proposals.map(p=>b('pick',esc(p.label),'secondary ms-chip',` data-start="${esc(p.start)}"`)).join('')}</div><div class="ms-act">${b('form','换个时间')}</div></div>`;
    return `<div class="ms-appt">${b('form',k.ask,'text-button ms-ask')}</div>`;
  }
  function activitySelect(acts){
    const opts=acts?.options||activityOptions([]),shared=acts?.shared||[],o=x=>`<option value="${esc(x)}">${esc(x)}</option>`;
    const rest=opts.filter(x=>!shared.includes(x)&&!MEALS.includes(x));
    return `<label class="ms-place">一起做什么（选填）<select name="activity"><option value="">先不定</option>${shared.length?`<optgroup label="你们都选了">${shared.map(o).join('')}</optgroup>`:''}<optgroup label="常见">${MEALS.map(o).join('')}</optgroup><optgroup label="还可以">${rest.map(o).join('')}</optgroup></select></label>`;
  }
  function formHTML(kind,a,now,acts){
    const k=KINDS[kind],min=bjDate(now),max=bjDate(now+14*86400000),sug=a?.suggested||[];
    const row=i=>`<div class="ms-slot"><input type="date" name="d${i}" min="${min}" max="${max}" aria-label="第${i+1}个时间的日期"><input type="time" name="t${i}" step="1800" aria-label="第${i+1}个时间的开始时间"></div>`;
    return `<form class="ms-form" data-appt-form="${kind}">${sug.length?`<p class="fine-print">你们都有空的时间：</p><div class="ms-chips">${sug.map(x=>`<button type="button" class="secondary ms-chip" data-fill="${esc(x.start)}">${esc(x.label)}</button>`).join('')}</div>`:''}<p class="fine-print">给 1 到 3 个时间（${kind==='meet'?'':k.minutes+' 分钟，'}14 天内，${COPY.tz}）</p>${[0,1,2].map(row).join('')}${kind==='meet'?activitySelect(acts)+`<label class="ms-place">见面多久<select name="minutes">${Object.entries(MEET_LENGTHS).map(([m,t])=>`<option value="${m}"${+m===60?' selected':''}>${t}</option>`).join('')}</select></label><label class="ms-place">地点（选填）<input name="place" maxlength="40" placeholder="如 某商场一楼咖啡馆"></label>`:''}<div class="ms-act"><button type="submit" class="primary">发给TA</button><button type="button" class="text-button" data-appt-close>先不约</button></div></form>`;
  }
  // Render from the server view (GET /api/friends/meet/:shareId).
  const TOPICS=()=>(typeof module==='object'&&module.exports?require('./friends-meet-topics'):root.XSMeetTopics)||null;
  // ctx: {shared:[双方都勾了的约会活动], agree:[问卷想法接近的方向], differ:[想法不同/标了底线的方向]}; page 1 = 「换一批」.
  function topicList(step,ctx={},page=0){
    const T=TOPICS(),d=T?.TOPICS?.[step];if(!d)return null;
    const base=page?d.topics.slice(0,d.topics.length-d.more.length).concat(d.more):d.topics;
    const pick={activity:ctx.shared,qAgree:ctx.agree,qDiffer:ctx.differ};
    const items=base.map(t=>{if(!t.slot)return t;const v=(pick[t.slot]||[]).find(x=>typeof x==='string'&&x.trim());if(!v)return t.fallback;const f=s=>s.replace(/\{[aq]\}/g,v.trim().slice(0,20));return {topic:f(t.topic),opener:f(t.opener)};});
    const hint=step===4&&ctx.activity&&!MEALS.includes(ctx.activity)?(isSport(ctx.activity)?COPY.sportTopic:COPY.playTopic):d.hint;
    return {title:T.TITLE,more:T.MORE,hint,note:d.note||'',items};
  }
  function topicsHTML(step,ctx,page){
    const t=topicList(step,ctx,page);if(!t)return '';
    return `<details class="ms-topics"${page?' open':''}><summary>${esc(t.title)}<small> · ${esc(t.hint)}</small></summary><ul>${t.items.map(x=>`<li><strong>${esc(x.topic)}</strong><span>「${esc(x.opener)}」</span></li>`).join('')}</ul>${t.note?`<p class="fine-print">${esc(t.note)}</p>`:''}<button type="button" class="text-button ms-topics-more" data-topics-more="${step}">${esc(t.more)}</button></details>`;
  }
  function decideHTML(d){
    if(!d)return '';
    if(d.outcome)return `<p class="ms-decided is-${d.outcome}" role="status">${esc(d.outcome==='mutual'?COPY.mutual:COPY.closed)}</p>`;
    if(!d.available)return '';
    return `<div class="ms-decide"><p class="ms-decide-title">${COPY.decideTitle}</p><div class="ms-chips" role="group" aria-label="${COPY.decideTitle}">${Object.entries(CHOICES).map(([k,t])=>`<button type="button" class="secondary ms-chip${d.mine===k?' is-on':''}" aria-pressed="${d.mine===k}" data-decide="${k}">${t}</button>`).join('')}</div><p class="fine-print">${d.mine?esc(COPY.decideMine.replace('{c}',CHOICES[d.mine]))+' ':''}${COPY.decideNote}</p></div>`;
  }
  function html(view,now=Date.now(),openForm='',ctx={},pages={}){
    const steps=view.steps||[],ap=view.appointments||{},current=(steps.find(x=>!x.done)||{step:5}).step,closed=view.decision?.outcome==='closed';
    const act4=ap.meet?.schedule?.activity||'';ctx={...ctx,activity:act4};
    const strip='<ol class="ms-strip">'+STEPS.map((s,i)=>{const v=steps[i]||{},st=v.done?'done':v.mine||v.theirs?'half':(i+1===current?'now':'todo');return `<li class="ms-dot is-${st}"><span class="ms-num" aria-hidden="true">${v.done?'✓':i+1}</span><span class="ms-name">${esc(s.title)}</span></li>`;}).join('')+'</ol>';
    const booked=Object.keys(KINDS).map(k=>ap[k]?.schedule).filter(s=>s?.status==='booked').map(s=>`<p class="ms-booked">${esc(s.text)}</p>`).join('');
    const rows=STEPS.map((s,i)=>{const v=steps[i]||{},n=i+1,state=v.done?COPY.done:v.mine?COPY.wait:v.theirs?COPY.theirs:'';
      const act=v.mine?`<button type="button" class="text-button ms-undo" data-meet-step="${n}" data-meet-action="undo">${COPY.undo}</button>`:`<button type="button" class="secondary ms-confirm" data-meet-step="${n}" data-meet-action="confirm">${COPY.confirm}</button>`;
      const extra=s.link?` <a class="text-button" href="${s.link.href}">${esc(s.link.text)}</a>`:'';
      const appt=s.kind&&!(n===4&&closed)&&(openForm===s.kind||!v.done||ap[s.kind]?.schedule)?(openForm===s.kind?formHTML(s.kind,ap[s.kind],now,view.activities):apptHTML(s.kind,ap[s.kind])):'';
      const safety=n===4?`${view.decision?.outcome==='mutual'?`<p class="ms-decided is-mutual">${COPY.mutual}</p>`:view.skipReminder?`<p class="ms-remind" role="status">${esc(view.skipReminder)}</p>`:''}<ul class="ms-safety">${[...SAFETY,...SPORT_SAFETY(act4)].map(t=>`<li>${esc(t)}</li>`).join('')}<li>${esc(COPY.report)}，<button type="button" class="text-button ms-report">去举报</button></li></ul>`:'';
      return `<li class="ms-step${n===current?' is-current':''}${v.done?' is-done':''}"><div class="ms-head"><strong>${n}. ${esc(s.title)}</strong>${state?`<span class="ms-state">${state}</span>`:''}</div><p class="ms-guide">${esc(s.guide)}${extra}</p>${appt}${n>1?topicsHTML(n,ctx,pages[n]||0):''}${safety}<div class="ms-act">${act}</div></li>`;}).join('');
    const badge=view.videoMet?`<p class="ms-badge"><span>${COPY.badge}</span><small>${COPY.badgeNote}</small></p>`:'';
    return `<h3 class="ms-title">${COPY.title}</h3>${badge}${strip}${decideHTML(view.decision)}<details class="ms-more"><summary>${current<5?'下一步：'+esc(STEPS[current-1].title):'四步都完成了'}<small> · 展开看每一步</small></summary><p class="fine-print">${COPY.lead}</p><ol class="ms-steps">${rows}</ol></details>${booked?`<div class="ms-upnext">${booked}</div>`:''}`;
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
      box.querySelectorAll('[data-decide]').forEach(b=>b.addEventListener('click',()=>send('/decision',{choice:b.dataset.decide},b)));
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
      form.activity?.addEventListener('change',()=>{if(!form.minutes.dataset.touched)form.minutes.value=String(meetMinutes(form.activity.value));});
      form.minutes?.addEventListener('change',()=>{form.minutes.dataset.touched='1';});
      form.addEventListener('submit',e=>{e.preventDefault();const slots=[0,1,2].map(i=>({date:form['d'+i].value,time:form['t'+i].value})).filter(x=>x.date||x.time);if(!slots.length){deps.toast?.('请至少给一个时间');return;}
        send('/appointment',{kind:form.dataset.apptForm,action:'propose',slots,...(form.place?{place:form.place.value}:{}),...(form.activity?.value?{activity:form.activity.value}:{}),...(form.minutes?{minutes:Number(form.minutes.value)}:{})},form.querySelector('[type=submit]'));});};
    try{view=await deps.api(url);render('',false);}catch(_){box.remove();}
  }
  Object.assign(api,{html,mount,ics,topicList});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.XSMeetSteps=api;
})(typeof window!=='undefined'?window:globalThis);
