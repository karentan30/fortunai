'use strict';
// 相生 · 认真相亲页 (long page for 享受恋爱 / 认真结婚). Two parts, both self-contained:
//  1. Owner editor appended to the #profile view (like friends-verification.js).
//  2. The long page itself at #serious/<shareId>, rendered into #main. friends.js route() calls XiangshengSerious.show().
// Photos/voice are only ever fetched through /api/friends/serious/<shareId>/media/<id>, which checks each section's scope.
// Photos are re-encoded in a canvas before upload (drops EXIF/GPS, max 1600px); the server strips metadata again.
(()=>{
  const main=document.getElementById('main');if(!main)return;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SCOPE_LABELS={private:'仅自己可见',connected:'互相认识后',public:'公开展示'};
  const TEXTS=[['about','关于我','工作节奏、周末怎么过、消费观'],['family','家庭背景','家里几口人、父母在哪个城市、和家里怎么相处'],['ideal','理想的另一半','性格、生活方式、你最在意的一两点']];
  const EXCLUSIVE=[['倾向结婚','享受恋爱为主'],['想要孩子','暂不考虑孩子'],['希望尽快见面','慢慢了解']];
  const MAX_PHOTOS=6,MAX_EDGE=1600,MAX_VOICE_MS=5000,TEXT_MAX=500;
  const mediaURL=(sid,id)=>'/api/friends/serious/'+encodeURIComponent(sid)+'/media/'+encodeURIComponent(id);
  async function api(path,options={}){
    const r=await fetch('/api/friends'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json','X-Runae-Friends':'1'}});
    let body;try{body=await r.json();}catch{throw Error('服务暂时不可用，请稍后再试。');}
    if(!r.ok){const e=Error(body.error||'操作没有完成，请重试。');e.status=r.status;throw e;}
    return body;
  }
  const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});
  let toastTimer;
  function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4000);}
  const blobToBase64=b=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).replace(/^data:[^,]*,/,''));fr.onerror=()=>rej(Error('无法读取文件'));fr.readAsDataURL(b);});
  const clock=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  const DEFAULT_PEAKS=[.35,.5,.7,.55,.8,.95,.7,.5,.65,.85,.6,.4,.55,.75,.9,.6,.45,.7,.5,.35,.55,.4,.3,.2];

  // ---------- shared pieces ----------
  function voiceHTML(v,src){
    const peaks=(v.peaks?.length?v.peaks:DEFAULT_PEAKS);
    return `<div class="sp-voice" data-src="${esc(src)}" data-ms="${Number(v.durationMs)||5000}"><button type="button" class="sp-play" aria-label="播放招呼语音"><span aria-hidden="true">▶</span></button><div class="sp-wave" aria-hidden="true">${peaks.map(p=>`<i style="height:${Math.round(18+p*82)}%"></i>`).join('')}</div><span class="sp-time"><b>0:00</b> / ${clock(Number(v.durationMs)||5000)}</span></div>`;
  }
  let playing=null;
  function bindVoice(root){
    root.querySelectorAll('.sp-voice').forEach(box=>{
      const btn=$('.sp-play',box),time=$('.sp-time b',box),bars=[...box.querySelectorAll('.sp-wave i')],total=Number(box.dataset.ms)||5000;
      btn.addEventListener('click',()=>{
        if(playing&&playing.box===box){playing.audio.pause();return;}
        if(playing)playing.audio.pause();
        const audio=new Audio(box.dataset.src);playing={box,audio};let raf=0;
        const paint=()=>{const t=audio.currentTime*1000,f=Math.min(1,t/total);time.textContent=clock(t);bars.forEach((b,i)=>b.classList.toggle('on',i/bars.length<f));raf=requestAnimationFrame(paint);};
        const stop=()=>{cancelAnimationFrame(raf);box.classList.remove('is-playing');btn.firstElementChild.textContent='▶';btn.setAttribute('aria-label','播放招呼语音');if(playing?.audio===audio)playing=null;};
        audio.addEventListener('play',()=>{box.classList.add('is-playing');btn.firstElementChild.textContent='❚❚';btn.setAttribute('aria-label','暂停');paint();});
        audio.addEventListener('pause',stop);audio.addEventListener('ended',()=>{stop();time.textContent=clock(total);bars.forEach(b=>b.classList.add('on'));});
        audio.addEventListener('error',()=>{stop();toast('语音暂时无法播放。');});
        audio.play().catch(()=>{stop();});
      });
    });
  }
  const scopeBadge=(scopes,key)=>scopes?`<span class="sp-scope sp-scope-${esc(scopes[key])}">${esc(SCOPE_LABELS[scopes[key]]||'')}</span>`:'';

  // ---------- the long page ----------
  async function show(shareId){
    if(playing){playing.audio.pause();playing=null;}
    main.innerHTML='<section class="page-wrap sp-wrap"><p class="loading">正在打开相亲资料…</p></section>';window.scrollTo({top:0,behavior:'instant'});
    let r;
    try{r=(await api('/serious/'+encodeURIComponent(shareId))).page;}
    catch(e){
      const login=e.status===401;
      main.innerHTML=`<section class="page-wrap sp-wrap"><div class="surface sp-empty"><h1>${login?'登录后查看相亲资料':'这份相亲资料暂时看不到'}</h1><p class="muted">${login?'相亲资料只给登录的相生用户看，照片和语音按TA设置的范围展示。':'可能TA已暂停展示、修改了认识目的，或你们之间设置了不再遇见。'}</p><div class="actions">${login?'<a class="primary" href="#login">登录 / 注册</a>':''}<a class="secondary" href="#discover">回到发现</a></div></div></section>`;
      return;
    }
    render(r,shareId);
  }
  function render(p,shareId){
    const s=p.sections||{},own=!!p.own,sc=p.scopes||null;
    const meta=[p.city,p.age?p.age+'岁':'',p.dayMaster?'日主'+p.dayMaster:''].filter(Boolean).map(esc).join(' · ');
    const blocks=[];
    if(s.photos?.length)blocks.push(`<section class="sp-block sp-photos-block"><h2 class="sp-h">照片${scopeBadge(sc,'photos')}</h2><div class="sp-photos sp-n${Math.min(s.photos.length,6)}">${s.photos.map((x,i)=>`<figure class="sp-photo"><img src="${esc(mediaURL(shareId,x.id))}" alt="${esc(p.nickname)}的照片 ${i+1}" loading="${i?'lazy':'eager'}" decoding="async" width="${x.w}" height="${x.h}"></figure>`).join('')}</div></section>`);
    if(s.voice)blocks.push(`<section class="sp-block"><h2 class="sp-h">听TA打个招呼${scopeBadge(sc,'voice')}</h2>${voiceHTML(s.voice,mediaURL(shareId,s.voice.id))}</section>`);
    if(s.verify){
      const v=s.verify;
      blocks.push(`<section class="sp-block"><h2 class="sp-h">核验情况${scopeBadge(sc,'verify')}</h2>${v.membersOnly?'<p class="sp-members">核验状态·会员可见</p>':`<ul class="sp-verify">${v.items.map(x=>`<li class="${x.verified?'is-on':''}"${x.hint?` title="${esc(x.hint)}"`:''}><span class="sp-dot" aria-hidden="true"></span>${esc(x.label)}${x.result?`<em>${esc(x.result)}</em>`:''}<span class="sr-only">${x.verified?'已核验':'未核验'}</span></li>`).join('')}</ul>${v.items.some(x=>x.hint)?`<p class="sp-fine">婚况为本人在国家政务服务平台自查，人工核对录屏。${esc(v.items.find(x=>x.hint).hint)}。</p>`:''}`}</section>`);
    }
    if(s.assets){const A={house:'房产',car:'车产',hukou:'户口'};blocks.push(`<section class="sp-block"><dl class="sp-assets">${Object.entries(s.assets).map(([k,v])=>`<div><dt>${A[k]}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`);}
    for(const [k,label] of TEXTS)if(s[k])blocks.push(`<section class="sp-block"><h2 class="sp-h">${label}${scopeBadge(sc,k)}</h2><p class="sp-text">${esc(s[k])}</p></section>`);
    if(s.hobby)blocks.push(`<section class="sp-block"><h2 class="sp-h">兴趣爱好${scopeBadge(sc,'hobby')}</h2><p class="sp-text">${s.hobby.name?`<b class="sp-hobby">${esc(s.hobby.name)}</b>`:''}${esc(s.hobby.text)}</p></section>`);
    if(s.plans?.length)blocks.push(`<section class="sp-block"><h2 class="sp-h">接下来的打算${scopeBadge(sc,'plans')}</h2><ul class="sp-pills">${s.plans.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`);
    if(s.qtags?.length){
      const groups=new Map();for(const t of s.qtags){if(!groups.has(t.dimension))groups.set(t.dimension,[]);groups.get(t.dimension).push(t);}
      const anySame=s.qtags.some(t=>t.same);
      blocks.push(`<section class="sp-block"><h2 class="sp-h">我们在这些事上的想法${scopeBadge(sc,'qtags')}</h2>${anySame?'<p class="sp-fine">标「一致」的，是你也在自己页面上选了的。</p>':''}<div class="sp-qtags">${[...groups].map(([d,list])=>`<div class="sp-qrow"><h3>${esc(d)}</h3><ul class="sp-pills">${list.map(t=>`<li class="${t.same?'is-same':''}">${esc(t.label)}${t.same?'<span class="sp-same">一致</span>':''}</li>`).join('')}</ul></div>`).join('')}</div></section>`);
    }
    const sparse=!blocks.some(b=>!b.includes('sp-members')&&!b.includes('sp-assets'));
    main.innerHTML=`<section class="page-wrap sp-wrap"><article class="sp" aria-labelledby="sp-name">
<nav class="sp-back"><a href="${own?'#profile':'#discover'}">← ${own?'回到我的资料':'返回'}</a></nav>
${own?`<p class="sp-ownbar">这是你的相亲资料预览。每一块右侧标着谁能看到；没有内容或别人看不到的块，不会出现在别人的页面上。<a href="#profile">去编辑</a></p>`:''}
<header class="sp-head"><h1 id="sp-name">${esc(p.nickname)}</h1>${meta?`<p class="sp-meta">${meta}</p>`:''}${p.purposeLabels?.length?`<ul class="sp-purposes">${p.purposeLabels.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}</header>
${blocks.join('')}
${sparse?`<p class="sp-sparse">${own?'还没有填写内容。照片、招呼语音和几段文字都可选，填一两项就够。':'TA还在慢慢补充资料。可以先申请认识，用15分钟语音聊聊。'}</p>`:''}
<footer class="ps-cta sp-cta">${own?'<button class="ps-apply" disabled>这是你自己的页面</button>':p.connected?'<a class="ps-apply" href="#connections">你们已互相认识 <span aria-hidden="true">→</span> 看联系方式</a>':'<button id="sp-apply" class="ps-apply">申请认识 <span aria-hidden="true">→</span> 15分钟语音</button>'}${p.connected&&!own?'':`<p class="fine-print">${own?'别人看到的是同一个页面，但只包含TA有权限看的部分。':'TA同意后，先语音15分钟听听声音，聊得来再见面。'}</p>`}${own?'':'<p class="sp-safety"><button type="button" class="text-button" id="sp-report">举报</button><button type="button" class="text-button" id="sp-block">不再遇见</button></p>'}</footer>
</article></section>`;
    window.scrollTo({top:0,behavior:'instant'});
    bindVoice(main);
    main.querySelectorAll('.sp-photo img').forEach(img=>img.addEventListener('error',()=>img.closest('.sp-photo')?.classList.add('is-broken'),{once:true}));
    $('#sp-apply')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{await post('/requests',{shareId});toast('认识申请已发出，等待对方回应。');}catch(err){toast(err.status===400&&/资料/.test(err.message)?'先完善你的交友卡，再来申请认识。':err.message);}finally{b.disabled=false;}});
    $('#sp-block')?.addEventListener('click',async()=>{if(!confirm('确认不再展示这位用户，并阻止彼此申请认识？'))return;try{await post('/block',{shareId});toast('已设置不再遇见。');location.hash='discover';}catch(e){toast(e.message);}});
    $('#sp-report')?.addEventListener('click',async()=>{const reason=prompt('请描述需要举报的问题（请勿填写额外的个人敏感信息）。');if(!reason?.trim())return;try{await post('/report',{shareId,reason:reason.trim()});toast('已提交举报，试用期间人工处理。');}catch(e){toast(e.message);}});
  }

  // ---------- owner editor ----------
  let own=null,busy=false,loading=false,recorder=null;
  function scopeSel(key){const v=own.page.scopes[key];return `<label class="sp-scope-pick"><span class="sr-only">谁能看到</span><select data-scope="${key}">${Object.entries(SCOPE_LABELS).map(([k,l])=>`<option value="${k}"${v===k?' selected':''}>${l}</option>`).join('')}</select></label>`;}
  function edHead(title,key,note=''){return `<div class="se-head"><h3>${title}</h3>${scopeSel(key)}</div>${note?`<p class="se-note">${note}</p>`:''}`;}
  function editorHTML(){
    const pg=own.page,sid=own.shareId;
    const photos=pg.photos.map(x=>`<li><img src="${esc(mediaURL(sid,x.id))}" alt="" loading="lazy"><button type="button" class="se-x" data-del-photo="${esc(x.id)}" aria-label="删除这张照片">×</button></li>`).join('');
    const groups=new Map();for(const t of own.availableTags){if(!groups.has(t.dimension))groups.set(t.dimension,[]);groups.get(t.dimension).push(t);}
    const picked=new Set(pg.qtags);
    return `<div class="se-intro"><h2>认真相亲页</h2><p class="muted">比交友卡多一些：照片、一句招呼、几段文字。每一块都可以单独选谁能看到，都可以不填。</p></div>
<form id="se-form" novalidate>
<div class="se-block">${edHead('照片','photos',`最多 ${MAX_PHOTOS} 张。上传前会在本机压缩到 1600 像素，并去掉拍摄地点等信息。`)}
<ul class="se-photos">${photos}${pg.photos.length<MAX_PHOTOS?`<li class="se-add"><label>＋ 添加照片<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-photo hidden></label></li>`:''}</ul></div>
<div class="se-block">${edHead('听TA打个招呼','voice','5 秒以内，比如「你好，我是…，周末常去…」。')}
<div class="se-voice">${pg.voice?voiceHTML(pg.voice,mediaURL(sid,pg.voice.id))+'<button type="button" class="text-button" data-del-voice>删除语音</button>':''}
<div class="se-voice-actions"><button type="button" class="secondary" data-rec>${pg.voice?'重新录一句':'录一句招呼'}</button><label class="text-button se-file">或上传音频<input type="file" accept="audio/*" data-voice-file hidden></label><span class="se-rec-state" aria-live="polite"></span></div></div></div>
${TEXTS.map(([k,l,h])=>`<div class="se-block">${edHead(l,k)}<textarea name="${k}" maxlength="${TEXT_MAX}" rows="4" placeholder="${esc(h)}">${esc(pg[k])}</textarea><p class="se-count"><span>${[...(pg[k]||'')].length}</span>/${TEXT_MAX}</p></div>`).join('')}
<div class="se-block">${edHead('兴趣爱好','hobby')}<input name="hobbyName" maxlength="16" placeholder="一个爱好，比如：徒步" value="${esc(pg.hobby?.name)}"><textarea name="hobbyText" maxlength="${TEXT_MAX}" rows="2" placeholder="一句话说说为什么喜欢">${esc(pg.hobby?.text)}</textarea></div>
<div class="se-block">${edHead('接下来的打算','plans','每组最多选一个。')}<div class="chip-options">${own.planTags.map(t=>`<label class="chip-option"><input type="checkbox" name="plan" value="${esc(t)}"${pg.plans.includes(t)?' checked':''}><span>${esc(t)}</span></label>`).join('')}</div></div>
<div class="se-block">${edHead('我们在这些事上的想法','qtags','从你自己的婚恋问卷回答里挑几条，默认一条都不展示。只显示你勾的这几个词，不显示分数和匹配度。')}
${own.availableTags.length?[...groups].map(([d,list])=>`<div class="se-qrow"><h4>${esc(d)}</h4><div class="chip-options">${list.map(t=>`<label class="chip-option"><input type="checkbox" name="qtag" value="${esc(t.key)}"${picked.has(t.key)?' checked':''}><span>${esc(t.label)}</span></label>`).join('')}</div></div>`).join(''):'<p class="notice">填完婚恋问卷后，这里会出现可以挑选的词。<a href="/pages/friends-questions.html">去填问卷</a></p>'}</div>
<div class="se-block se-row">${edHead('核验情况','verify','已核验的项目点亮，只有会员能看到每一项；其他人只看到一行「核验状态·会员可见」。')}</div>
<p class="error" role="alert" id="se-error"></p>
<div class="se-actions"><button type="submit" class="primary">保存相亲资料</button><a class="secondary" href="#serious/${esc(sid)}">预览我的相亲页</a></div>
</form>`;
  }
  function renderEditor(){
    const host=main.querySelector('.profile-layout')||main.querySelector('#profile-form');if(!host||!own)return;
    let sec=main.querySelector('#serious-editor');
    if(!sec){sec=document.createElement('section');sec.id='serious-editor';sec.className='surface serious-editor';host.after(sec);sec.addEventListener('click',onClick);sec.addEventListener('change',onChange);sec.addEventListener('input',onInput);sec.addEventListener('submit',onSubmit);}
    if(!own.hasProfile){sec.innerHTML='<div class="se-intro"><h2>认真相亲页</h2><p class="notice">先保存交友卡，再填写相亲资料。</p></div>';return;}
    if(!own.eligible){sec.innerHTML='<div class="se-intro"><h2>认真相亲页</h2><p class="notice">认识目的选「享受恋爱」或「认真结婚」后，可以多写一页相亲资料：照片、招呼语音和几段文字。</p></div>';return;}
    sec.innerHTML=editorHTML();bindVoice(sec);
  }
  async function refreshEditor(){if(loading)return;loading=true;try{own=await api('/serious');renderEditor();}catch(_){own=null;main.querySelector('#serious-editor')?.remove();}finally{loading=false;}}
  const err=m=>{const e=$('#se-error');if(e)e.textContent=m||'';};
  function collect(form){
    const fd=new FormData(form),scopes={};form.querySelectorAll('[data-scope]').forEach(s=>scopes[s.dataset.scope]=s.value);
    return {about:fd.get('about')||'',family:fd.get('family')||'',ideal:fd.get('ideal')||'',hobby:{name:fd.get('hobbyName')||'',text:fd.get('hobbyText')||''},plans:fd.getAll('plan'),qtags:fd.getAll('qtag'),scopes};
  }
  async function onSubmit(e){
    e.preventDefault();if(busy)return;busy=true;err('');const b=e.target.querySelector('[type=submit]');b.disabled=true;
    try{await post('/serious',collect(e.target));toast('相亲资料已保存。');own=await api('/serious');}
    catch(x){err(x.message);}finally{busy=false;b.disabled=false;}
  }
  function onInput(e){const t=e.target;if(t.tagName==='TEXTAREA'){const c=t.parentElement.querySelector('.se-count span');if(c)c.textContent=[...t.value].length;}}
  async function photoToBase64(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('只支持 JPG、PNG、WEBP 照片');
    if(file.size>20*1024*1024)throw Error('照片太大了，请换一张');
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>{throw Error('这张照片打不开，请换一张');});
    const k=Math.min(1,MAX_EDGE/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bmp,0,0,w,h);bmp.close?.();
    let q=.86,blob;do{blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));q-=.12;}while(blob&&blob.size>4.5*1024*1024&&q>.4);
    if(!blob)throw Error('照片处理失败，请换一张');return blobToBase64(blob);
  }
  async function peaksOf(blob){
    try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),buf=await ctx.decodeAudioData(await blob.arrayBuffer());ctx.close?.();
      const d=buf.getChannelData(0),n=24,step=Math.floor(d.length/n)||1,out=[];
      for(let i=0;i<n;i++){let m=0;for(let j=i*step;j<Math.min(d.length,(i+1)*step);j+=8)m=Math.max(m,Math.abs(d[j]));out.push(m);}
      const max=Math.max(...out)||1;return {peaks:out.map(x=>Math.round(x/max*100)/100),durationMs:Math.round(buf.duration*1000)};}
    catch(_){return {peaks:null,durationMs:null};}
  }
  async function sendVoice(blob,fallbackMs){
    if(blob.size>200*1024)throw Error('语音太长了，请录5秒以内');
    const {peaks,durationMs}=await peaksOf(blob),ms=durationMs||fallbackMs;
    if(!ms)throw Error('读不出这段音频的长度，请直接在页面录音');
    if(ms>6000)throw Error('打招呼语音最长5秒');
    await post('/serious/voice',{data:await blobToBase64(blob),durationMs:ms,...(peaks?{peaks}:{})});
  }
  async function record(btn){
    const state=btn.parentElement.querySelector('.se-rec-state');
    if(recorder){recorder.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){state.textContent='这个浏览器不能直接录音，请用「上传音频」。';return;}
    let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(_){state.textContent='没有拿到麦克风权限，可以改用「上传音频」。';return;}
    const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported?.(t))||'';
    const chunks=[],started=performance.now();recorder=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:48000}:{});
    recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
    let tick=setInterval(()=>{const left=Math.max(0,MAX_VOICE_MS-(performance.now()-started));state.textContent=`录音中… 还剩 ${Math.ceil(left/1000)} 秒`;},200);
    const auto=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),MAX_VOICE_MS);
    recorder.onstop=async()=>{clearInterval(tick);clearTimeout(auto);stream.getTracks().forEach(t=>t.stop());const ms=Math.min(MAX_VOICE_MS,Math.round(performance.now()-started));recorder=null;btn.textContent='重新录一句';
      state.textContent='正在加密上传…';busy=true;try{await sendVoice(new Blob(chunks,{type:chunks[0]?.type||type||'audio/webm'}),ms);state.textContent='';toast('招呼语音已保存。');await refreshEditor();}catch(x){state.textContent=x.message;}finally{busy=false;}};
    recorder.start();btn.textContent='停止';
  }
  async function onClick(e){
    const del=e.target.closest('[data-del-photo]'),dv=e.target.closest('[data-del-voice]'),rec=e.target.closest('[data-rec]');
    if(rec){if(!busy||recorder)record(rec);return;}
    if((!del&&!dv)||busy)return;
    if(!confirm(del?'删除这张照片？文件会从服务器上删掉。':'删除招呼语音？文件会从服务器上删掉。'))return;
    busy=true;err('');
    try{await api(del?'/serious/photos/'+encodeURIComponent(del.dataset.delPhoto):'/serious/voice',{method:'DELETE',body:'{}'});toast('已删除。');}
    catch(x){err(x.message);}finally{busy=false;}
    await refreshEditor();
  }
  async function onChange(e){
    const t=e.target;
    if(t.name==='plan'&&t.checked){const pair=EXCLUSIVE.find(p=>p.includes(t.value));if(pair)t.form.querySelectorAll('input[name=plan]').forEach(x=>{if(x!==t&&pair.includes(x.value))x.checked=false;});return;}
    if(t.matches('[data-photo]')){
      const files=[...t.files];t.value='';if(busy||!files.length)return;
      if(own.page.photos.length+files.length>MAX_PHOTOS){err(`最多 ${MAX_PHOTOS} 张照片。`);return;}
      busy=true;err('正在压缩并加密上传…');
      try{for(const f of files)await post('/serious/photos',{data:await photoToBase64(f)});err('');toast('照片已保存。');}catch(x){err(x.message);}finally{busy=false;}
      await refreshEditor();return;
    }
    if(t.matches('[data-voice-file]')){
      const f=t.files[0];t.value='';if(!f||busy)return;const state=$('.se-rec-state',main);busy=true;state.textContent='正在加密上传…';
      try{await sendVoice(f,null);state.textContent='';toast('招呼语音已保存。');}catch(x){state.textContent=x.message;}finally{busy=false;}
      await refreshEditor();
    }
  }
  new MutationObserver(()=>{if(main.querySelector('#profile-form')&&!main.querySelector('#serious-editor'))refreshEditor();}).observe(main,{childList:true});
  if(main.querySelector('#profile-form'))refreshEditor();

  window.XiangshengSerious={show};
  // friends.js may have routed before this script loaded.
  const m=/^#serious\/([A-Za-z0-9_-]{1,100})$/.exec(location.hash);if(m)show(m[1]);
})();
