'use strict';
// 自己合盘页：两个人的生辰只在这次请求里用，提交后立刻清空表单；结果默认不保存。
(()=>{
 const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
 const API='/api/friends/compatibility/self';
 const HOURS=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
 // 设备标识只用于每日限次，随机生成，存在本机；服务端只存它的 HMAC。
 function device(){try{let d=localStorage.getItem('xs-device');if(!/^[A-Za-z0-9_-]{16,64}$/.test(d||'')){const b=new Uint8Array(18);crypto.getRandomValues(b);d=btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');localStorage.setItem('xs-device',d);}return d;}catch{return null;}}
 async function api(path,{method='GET',body}={}){
  const headers={'X-Runae-Friends':'1'},d=device();if(d)headers['X-Xs-Device']=d;
  if(body)headers['Content-Type']='application/json';
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers,...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(Error(data.error||'暂时无法完成，请稍后再试'),{status:r.status});
  return data;
 }
 let purpose='romance',last=null;
 // 下拉：月、日、时辰（时辰 i 对应 2i 点整，子时取 00:00，避免跨日换日柱）
 for(const side of $$('.frame[data-side]')){
  const m=side.querySelector('[data-k=month]'),d=side.querySelector('[data-k=day]'),h=side.querySelector('[data-k=hour]');
  m.append(new Option('月',''));for(let i=1;i<=12;i++)m.append(new Option(i+' 月',String(i)));
  d.append(new Option('日',''));for(let i=1;i<=30;i++)d.append(new Option(i+' 日',String(i)));
  h.append(new Option('选择',''));HOURS.forEach((z,i)=>h.append(new Option(z+'时 '+String((i*2+23)%24).padStart(2,'0')+'–'+String(i*2+1).padStart(2,'0'),String(i))));h.append(new Option('不知道','unknown'));
  const daysIn=()=>{const y=+side.querySelector('[data-k=year]').value,mo=+m.value,cal=side.querySelector('[data-k=calendar] [aria-pressed=true]').dataset.v;const n=cal==='lunar'?30:(y&&mo?new Date(Date.UTC(y,mo,0)).getUTCDate():31);const keep=d.value;d.replaceChildren(new Option('日',''));for(let i=1;i<=n;i++)d.append(new Option(i+' 日',String(i)));if(+keep<=n)d.value=keep;};
  m.addEventListener('change',daysIn);side.querySelector('[data-k=year]').addEventListener('change',daysIn);
  for(const b of $$('[data-k=calendar] button',side))b.addEventListener('click',()=>{for(const x of $$('[data-k=calendar] button',side))x.setAttribute('aria-pressed',String(x===b));daysIn();});
  daysIn();
 }
 for(const b of $$('#purpose button'))b.addEventListener('click',()=>{purpose=b.dataset.v;for(const x of $$('#purpose button'))x.setAttribute('aria-pressed',String(x===b));});
 const boxes=['#c-informed','#c-self','#c-adult'].map($);
 const sync=()=>{const ok=boxes.every(b=>b.checked);$('#start').disabled=!ok||!user;$('#start-hint').textContent=ok?(remaining!==null?'用掉 1 次，今日剩 '+Math.max(0,remaining-1)+' 次':''):'三项都勾选后可开始';};
 for(const b of boxes)b.addEventListener('change',sync);
 let user=false,remaining=null;
 function person(side,who){
  const f=$('.frame[data-side='+side+']'),v=k=>f.querySelector('[data-k='+k+']').value;
  const y=v('year').trim();if(!/^\d{4}$/.test(y)||!v('month')||!v('day'))throw Error('请填完整'+who+'的出生日期');
  if(!v('hour'))throw Error('请选择'+who+'的时辰，不知道就选「不知道」');
  if(!v('gender'))throw Error('请选择'+who+'的性别');
  const cal=f.querySelector('[data-k=calendar] [aria-pressed=true]').dataset.v;
  return {birthday:[y,v('month').padStart(2,'0'),v('day').padStart(2,'0')].join('-'),calendar:cal,time:v('hour')==='unknown'?null:String(+v('hour')*2).padStart(2,'0')+':00',gender:v('gender')};
 }
 function clearForm(){for(const f of $$('.frame[data-side]')){f.querySelector('[data-k=year]').value='';for(const k of ['month','day','hour','gender'])f.querySelector('[data-k='+k+']').value='';}$('#ta-nickname').value='';for(const b of boxes)b.checked=false;sync();}
 async function quota(){
  try{const q=await api(API+'/quota');user=true;remaining=q.remaining;$('#remaining').textContent=String(q.remaining);$('#counter').hidden=false;$('#login-note').hidden=true;loadSaved();}
  catch(e){if(e.status===401){user=false;$('#login-note').hidden=false;}else $('#form-error').textContent=e.message;}
  sync();
 }
 async function loadSaved(){
  try{const {saved}=await api(API+'/saved');const ul=$('#saved-list');ul.replaceChildren();$('#saved-area').hidden=!saved.length;
   for(const s of saved){const li=el('li'),info=el('div');info.append(el('b','你与 '+s.nickname+' · '+s.tierLabel+' '+s.total),el('br'),el('span',s.createdAt.slice(0,10)));
    const open=el('button','查看','ghost-btn');open.type='button';open.addEventListener('click',async()=>{try{showSaved(await api(API+'/saved/'+encodeURIComponent(s.id)));}catch(e){$('#form-error').textContent=e.message;}});
    li.append(info,open);ul.append(li);}
  }catch{}
 }
 function back(){$('#result').hidden=true;$('#result').replaceChildren();$('#entry').hidden=false;$('#page-foot').hidden=false;last=null;quota();scrollTo(0,0);}
 function del(id){return async()=>{if(!confirm('删除这条保存的合盘结果？删除后无法恢复，已付费内容将一并删除。完整版还没打开过的，会登记退款或退回会员份数；打开过的不退。'))return;try{await api(API+'/saved/'+encodeURIComponent(id)+'/delete',{method:'POST',body:{}});back();}catch(e){alert(e.message);}};}

 // 自己合盘的完整版记在保存的记录上：没保存先保存，再拉保存后的报告开付款弹层。
 let savedId=null;
 async function saveOnce(keep,leave,save){
  if(savedId)return savedId;keep.disabled=true;
  try{const s=await api(API+'/saved',{method:'POST',body:{saveToken:last.saveToken}});savedId=s.id;keep.textContent='已保存';leave.textContent='返回';const d=el('button','删除这条记录','ghost-btn del');d.type='button';d.addEventListener('click',del(s.id));save.append(d);return savedId;}
  catch(e){keep.disabled=false;throw e;}
 }
 const reopen=id=>async()=>{try{showSaved(await api(API+'/saved/'+encodeURIComponent(id)));}catch(e){alert(e.message);}};
 function payFor(id,pay){window.XsHepanPay?.open({target:{type:'self',id},pay,onUnlocked:reopen(id)});}
 async function saveThenPay(keep,leave,save){
  try{const id=await saveOnce(keep,leave,save),r=await api(API+'/saved/'+encodeURIComponent(id));showSaved(r);if(r.lock?.available)payFor(id,r.pay);}catch(e){alert(e.message);}
 }
 function showSaved(r){
  const area=$('#result');area.replaceChildren(window.XsHepanReport.renderSaved(r,{onUnlock:x=>payFor(r.id,x.pay)}));
  const row=el('div',undefined,'save'),b1=el('button','返回','ghost-btn'),b2=el('button','删除这条记录','ghost-btn del');b1.type=b2.type='button';
  b1.addEventListener('click',back);b2.addEventListener('click',del(r.id));row.append(b1,b2);area.append(row);
  $('#entry').hidden=true;$('#page-foot').hidden=true;area.hidden=false;scrollTo(0,0);
 }
 function showResult(r){
  const save=el('div',undefined,'save'),keep=el('button','保存这次结果','ghost-btn'),leave=el('button','不保存，离开','ghost-btn del');keep.type=leave.type='button';
  last=r;savedId=null;const area=$('#result');area.replaceChildren(window.XsHepanReport.render(r,{onUnlock:()=>saveThenPay(keep,leave,save)}));
  keep.addEventListener('click',async()=>{try{await saveOnce(keep,leave,save);}catch(e){alert(e.message);}});
  leave.addEventListener('click',back);
  save.append(keep,leave);
  const inv=el('div',undefined,'invite'),a=el('a','发邀请链接给 TA 本人填','btn-o');a.href='/pages/friends-compatibility.html';
  inv.append(el('p','想让 TA 也看看？'),el('small','TA 本人填写后，你们俩都能看到这份报告'),a);
  area.append(save,el('p','保存只记档位和解读条目，不存任何一方的生辰；随时可以删除。','note c'),inv);
  $('#entry').hidden=true;$('#page-foot').hidden=true;area.hidden=false;scrollTo(0,0);
 }
 $('#self-form').addEventListener('submit',async e=>{e.preventDefault();$('#form-error').textContent='';
  const b=$('#start');
  try{
   const nickname=$('#ta-nickname').value.trim();if(!nickname)throw Error('请填写怎么称呼 TA');
   const body={purpose,consents:{informed:$('#c-informed').checked,selfOnly:$('#c-self').checked,adult:$('#c-adult').checked},me:person('me','你'),ta:{nickname,...person('ta','TA')}};
   b.disabled=true;b.textContent='正在合盘…';
   const r=await api(API,{method:'POST',body});
   clearForm();showResult(r);
  }catch(err){$('#form-error').textContent=err.message;if(err.status===429){remaining=0;$('#remaining').textContent='0';}}
  finally{b.textContent='开始合盘';sync();}
 });
 quota();
})();
