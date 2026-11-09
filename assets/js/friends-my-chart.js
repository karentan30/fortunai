'use strict';
// 我的命盘页：免费部分（四柱/三柱、乾坤造、日主、五行计数、五行性格）全部来自服务端 /api/friends/my-chart。
// 完整报告：先免费核对出生资料 → 解锁（复用合盘收款弹层，金额只来自服务端）→ 生成。出生资料只在本页内存里，不存本地。
(()=>{
 const API='/api/friends/my-chart';
 const $=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=text;if(cls)x.className=cls;return x;};
 const yuan=m=>(m/100).toFixed(m%100?(m%10?2:1):0);
 const STEM_EL={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
 const BRANCH_EL={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
 const state={view:null,city:null,calendar:'solar',eligibleInput:null,idemKey:null,generating:false,pollTimer:null};
 async function api(path,{method='GET',body}={}){
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{'X-Runae-Friends':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(data.error||'暂时连不上，请稍后再试'),{status:r.status});return data;
 }
 function renderFree(v){
  const c=v.chart;
  $('mc-zao').textContent=c.zao||'';
  const grid=$('mc-pillars');grid.replaceChildren();grid.classList.toggle('three',!c.complete);
  for(const [k,label] of [['year','年柱'],['month','月柱'],['day','日柱'],['hour','时柱']]){
   const v=c.pillars[k],col=el('div',undefined,'col '+k+(k==='day'?' day':''));col.append(el('div',label,'pos'));
   const gz=el('div',undefined,'gz');
   if(v){gz.append(el('span',v[0]),el('span',v[1]));col.append(gz,el('div',STEM_EL[v[0]]+' · '+BRANCH_EL[v[1]],'wx'));}
   else{gz.append(el('span','—'));col.append(gz,el('div',k==='hour'?'时辰不详':'未记录','wx'));}
   grid.append(col);
  }
  $('mc-limited').hidden=!c.limited;if(c.limited){$('mc-limited').querySelector('b').textContent=c.limitedLabel||'有限参考';$('mc-limited-note').textContent=c.limitedNote||'';}
  $('mc-dm').textContent=c.dayMaster;$('mc-dm-el').textContent='日主 · 属'+c.dayElement;
  const wx=$('mc-wx');wx.replaceChildren();
  for(const k of ['木','火','土','金','水']){const li=el('li');li.append(el('span',k),el('b',String(c.elements[k]??0)),el('i',k===c.strongest?'最多':k===c.weakest?'最少':''));wx.append(li);}
  $('mc-wx-rule').textContent='计数规则：'+c.countRule+(c.limited?'（有限参考）':'');
  const ul=$('mc-traits');ul.replaceChildren();for(const t of v.traits)ul.append(el('li',t));
  $('mc-traits-src').textContent=v.traitsSource+' · '+v.disclaimer;
  for(const b of $('mc-gender').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.v===c.gender));
  $('mc-free').hidden=false;
 }
 function renderReading(text){
  const box=$('mc-reading-body');box.replaceChildren();
  for(const raw of String(text).split(/\n+/)){const line=raw.replace(/[*#`>]/g,'').trim();if(!line)continue;
   box.append(/^\s*(\d{1,2})[.、．)）]/.test(line)&&line.length<40?el('h3',line):el('p',line));}
  $('mc-reading').hidden=false;
 }
 function renderReport(v){
  const r=v.report,err=$('mc-report-err');err.textContent='';
  $('mc-report').hidden=false;
  const titles=$('mc-titles');titles.replaceChildren();for(const t of r.titles)titles.append(el('li',t));
  const job=r.job;
  if(r.unlocked&&job?.report?.reading){$('mc-lock').hidden=true;renderReading(job.report.reading);return;}
  $('mc-lock').hidden=false;$('mc-reading').hidden=true;
  if(job&&['reserving','generating','result_saved'].includes(job.status)){$('mc-lock-sub').textContent='完整报告正在生成，请稍候…';schedulePoll(job.reportId);}
  if(job&&job.status==='manual_review')err.textContent='报告状态待人工核对，请不要重复购买；有疑问请在「联系我们」留言。';
  // 未开放：只展示目录和「即将开放」，不出现表单和按钮。
  if(r.comingSoon){$('mc-soon').hidden=false;$('mc-form-wrap').hidden=true;return;}
  $('mc-soon').hidden=true;$('mc-form-wrap').hidden=false;
  $('mc-needs-note').textContent=r.needsNote;
  const needGender=!v.chart.gender;
  $('mc-check').disabled=needGender;$('mc-check-note').textContent=needGender?'请先在上面选择乾造或坤造':'只核对、不扣费，也不保存你的出生资料';
  const verified=!!state.eligibleInput;
  $('mc-unlock').hidden=!(r.eligible&&verified&&!r.unlocked&&r.pay?.payEnabled);
  if(r.pay?.priceMinor)$('mc-price').textContent='¥'+yuan(r.pay.priceMinor)+' · '+(r.pay.refundRule||'');
  const canGen=r.unlocked&&!r.generated&&!state.generating;
  $('mc-generate').hidden=!(canGen&&verified);$('mc-retain-wrap').hidden=!(canGen&&verified);
  if(r.unlocked&&!r.generated&&!verified)$('mc-lock-sub').textContent='已解锁。请再填一次出生资料并核对，就能生成完整报告。';
  else if(!job)$('mc-lock-sub').textContent='16 章 · AI 辅助生成 · 只你自己可见';
 }
 function schedulePoll(id){clearTimeout(state.pollTimer);if(!id)return;state.pollTimer=setTimeout(async()=>{try{const j=await api(API+'/report/'+encodeURIComponent(id));if(j.report?.reading){$('mc-lock').hidden=true;renderReading(j.report.reading);return;}if(['reserving','generating','result_saved'].includes(j.status))schedulePoll(id);else load();}catch(_){schedulePoll(id);}},5000);}
 async function load(){
  try{const v=await api(API);state.view=v;$('mc-loading').hidden=true;renderFree(v);renderReport(v);}
  catch(e){$('mc-loading').hidden=true;if(e.status===401)$('mc-login').hidden=false;else if(e.status===404)$('mc-empty').hidden=false;else{const p=$('mc-empty');p.textContent=e.message;p.hidden=false;}}
 }
 function readInput(){
  const y=Number($('mc-y').value.trim()),m=Number($('mc-m').value.trim()),d=Number($('mc-d').value.trim()),t=$('mc-time').value;
  if(!Number.isInteger(y)||y<1900||y>new Date().getFullYear()||!Number.isInteger(m)||m<1||m>12||!Number.isInteger(d)||d<1||d>31)throw Error('请完整填写出生年、月、日');
  const tm=/^(\d{1,2}):(\d{2})/.exec(t||'');if(!tm)throw Error('完整报告需要出生时间（几点几分）');
  if(!state.city)throw Error('请从搜索结果中选择出生城市');
  return {birthYear:y,birthMonth:m,birthDay:d,birthHour:Number(tm[1]),birthMinute:Number(tm[2]),calendar:state.calendar,leapMonth:state.calendar==='lunar'&&$('mc-leap').checked,cityId:state.city.id};
 }
 function invalidate(){state.eligibleInput=null;if(state.view)renderReport(state.view);}
 function bind(){
  for(const b of $('mc-gender').querySelectorAll('button'))b.addEventListener('click',async()=>{$('mc-gender-err').textContent='';try{await api(API+'/gender',{method:'POST',body:{gender:b.dataset.v}});state.eligibleInput=null;await load();}catch(e){$('mc-gender-err').textContent=e.message;}});
  for(const b of $('mc-cal').querySelectorAll('button'))b.addEventListener('click',()=>{state.calendar=b.dataset.v;for(const x of $('mc-cal').querySelectorAll('button'))x.setAttribute('aria-pressed',String(x===b));$('mc-leap-wrap').hidden=state.calendar!=='lunar';invalidate();});
  for(const id of ['mc-y','mc-m','mc-d','mc-time','mc-leap'])$(id).addEventListener('input',invalidate);
  let timer=0,seq=0;const city=$('mc-city'),results=$('mc-city-results');
  city.addEventListener('input',()=>{state.city=null;$('mc-city-picked').textContent='';invalidate();clearTimeout(timer);const q=city.value.trim(),n=++seq;if(!q){results.hidden=true;return;}
   timer=setTimeout(async()=>{try{const r=await api('/api/friends/cities?q='+encodeURIComponent(q));if(n!==seq)return;results.replaceChildren();results.hidden=false;const list=Array.isArray(r.cities)?r.cities:[];
    if(!list.length)results.append(el('p','暂未收录这个城市，请换个写法试试','note'));
    for(const c of list){const b=el('button',c.city);b.type='button';b.append(el('small',c.label||c.country||''));b.addEventListener('click',()=>{state.city=c;city.value=c.city;$('mc-city-picked').textContent=c.label||c.city;results.hidden=true;invalidate();});results.append(b);}}catch(e){$('mc-report-err').textContent=e.message;}},250);});
  $('mc-form').addEventListener('submit',async ev=>{ev.preventDefault();const err=$('mc-report-err');err.textContent='';let input;try{input=readInput();}catch(e){err.textContent=e.message;return;}
   $('mc-check').disabled=true;try{await api(API+'/eligibility',{method:'POST',body:{input}});state.eligibleInput=input;state.idemKey=null;$('mc-check-note').textContent='核对通过：资料与卡片上的命盘一致';await load();}catch(e){err.textContent=e.message;}finally{$('mc-check').disabled=false;}});
  $('mc-unlock').addEventListener('click',()=>{const r=state.view?.report;if(!r?.pay)return;window.XsHepanPay?.open({target:r.target,pay:r.pay,onUnlocked:load});});
  $('mc-generate').addEventListener('click',async()=>{const err=$('mc-report-err');err.textContent='';if(!state.eligibleInput){err.textContent='请先核对出生资料';return;}if(!$('mc-retain').checked){err.textContent='请勾选同意保存本人报告结果';return;}
   state.generating=true;$('mc-generate').disabled=true;$('mc-lock-sub').textContent='完整报告正在生成，大约 1–3 分钟…';
   state.idemKey=state.idemKey||('mc_'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):String(Date.now())+Math.random().toString(36).slice(2)));
   try{const j=await api(API+'/report',{method:'POST',body:{idempotencyKey:state.idemKey,input:state.eligibleInput,consentRetainReport:true}});
    if(j.report?.reading){state.eligibleInput=null;$('mc-lock').hidden=true;renderReading(j.report.reading);}else if(j.status==='failed'){err.textContent='报告没有生成成功，这次不算使用，可以再试一次。';state.idemKey=null;}else schedulePoll(j.reportId);}
   catch(e){err.textContent=e.message;}finally{state.generating=false;$('mc-generate').disabled=false;}});
 }
 document.addEventListener('DOMContentLoaded',()=>{bind();load();});
})();
