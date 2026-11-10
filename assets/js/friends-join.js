'use strict';
// 相亲登记表：不需要邀请人。昵称 + 生日/时辰/性别 + 14 道底线题（可跳过）+ 一句自我介绍 + 授权，提交前需要登录。
// 复用 friends-invite-match.js 的生日表单与底线题；保存走现有接口：/chart → /profile（joinForm）→ 问卷 → /share-card。
// 提交后进「首批审核」队列，成功文案不承诺立刻匹配。只用 createElement + textContent。文案红线见 server/lib/friends-copy-guard.js。
(()=>{
 const IM=window.XsInviteMatch,{h,api,birthBlocks,readBirth,quickQuestions,profileNudge}=IM,$=s=>document.querySelector(s);
 const POLICY='friends-2026-11-04-v1',SUCCESS='已登记。首批成员审核入驻中，遇到和你相合的人，第一时间告诉你。';
 const HOURS=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
 const SWITCHES=[['photo','照片'],['city','城市'],['birthday','生日（只显示日期）'],['hour','时辰'],['contact','联系方式']];
 const MAX_PHOTOS=6,MAX_EDGE=1600;
 let user=null,q=null;
 const chk=(id,text)=>h('label',{class:'chk'},h('input',{id,type:'checkbox'}),h('span',{class:'box'}),h('span',{class:'t'},h('span',{class:'req',text:'必选'}),...text));
 function buildForm(){
  const f=h('form',{id:'jn-form',class:'hv4 im-join',novalidate:true}),qs=h('div',{class:'im-qs-wrap'},h('p',{class:'note',text:'正在读取底线题…'}));
  f.append(
   h('h2',{class:'hv-h',text:'一 · 基 本 信 息'}),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'昵称'}),h('small',{text:'别人在名片上看到的名字'})),h('input',{class:'in',id:'jn-nickname',maxlength:'24',autocomplete:'nickname',placeholder:'例如 阿青'})),
   ...birthBlocks(),
   h('h2',{class:'hv-h',text:'二 · 14 道 底 线 题'}),
   h('p',{class:'note',text:'婚育、城市、见家长节奏这些最影响能不能走下去的事。每题都可以先不答。'}),
   qs,
   h('h2',{class:'hv-h',text:'三 · 一 句 自 我 介 绍'}),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'自我介绍'}),h('small',{text:'可不填，别写联系方式'})),h('textarea',{class:'in',id:'jn-intro',maxlength:'240',rows:'3',placeholder:'例如 在杭州做设计，周末爱爬山，想认识认真谈感情的人。'})),
   h('div',{class:'fl'},h('div',{class:'lb'},h('span',{text:'照片'}),h('small',{text:'选填，最多 '+MAX_PHOTOS+' 张'})),h('input',{class:'in',id:'jn-photos',type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true}),h('p',{class:'hint',id:'jn-photo-note',text:'上传前会在本机压缩，并去掉拍摄地点等信息。审核通过后，名片才会显示照片。'})),
   h('h2',{class:'hv-h',text:'四 · 提 交 前 请 确 认'}),
   chk('jn-cross',['出境告知：相生由香港公司运营，你的资料（含生辰）会存储在香港服务器并在香港处理。',h('a',{href:'/pages/friends-privacy.html#cross-border',target:'_blank',rel:'noopener',text:'查看详情 ›'})]),
   chk('jn-adult',['我已满 18 岁，所填是我本人的真实生辰。']),
   chk('jn-policy',['我已阅读并同意',h('a',{href:'/pages/friends-terms.html',target:'_blank',rel:'noopener',text:'使用约定'}),'与',h('a',{href:'/pages/friends-privacy.html',target:'_blank',rel:'noopener',text:'隐私说明'}),'。']),
   h('button',{class:'btn-p sp',id:'jn-submit',type:'submit',text:'提交登记表'}),
   h('p',{class:'hint',text:'提交后进入首批成员审核，审核通过前别人只看得到你的昵称。生日只用来排盘。'}),
   h('p',{class:'err',id:'jn-error',role:'alert'}));
  return {f,qs};
 }
 const authState=()=>{$('#jn-auth').hidden=!!user;};
 async function refresh(){try{const v=await api('/api/auth/me');user=v.user&&['string','number'].includes(typeof v.user.id)?v.user:null;}catch{user=null;}authState();}
 function authForm(){
  $('#jn-mode').addEventListener('change',()=>{$('#jn-agreement').hidden=$('#jn-mode').value!=='register';});
  $('#jn-auth-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;
   try{if($('#jn-mode').value==='register'&&!$('#jn-terms').checked)throw Error('请先勾选使用约定与隐私说明。');
    await api('/api/auth/'+$('#jn-mode').value,{method:'POST',body:{email:$('#jn-email').value,password:$('#jn-password').value}});
    $('#jn-password').value='';$('#jn-account').textContent='';await refresh();}
   catch(x){$('#jn-account').textContent=x.message;}finally{b.disabled=false;}});
 }
 // 和相亲页（friends-serious.js）同一条处理：本机重新编码、最长边 1600、去掉 EXIF；上传走同一个 /serious/photos 接口。
 const blobToBase64=b=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).replace(/^data:[^,]*,/,''));fr.onerror=()=>rej(Error('无法读取文件'));fr.readAsDataURL(b);});
 async function photoToBase64(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('只支持 JPG、PNG、WEBP 照片');
  if(file.size>20*1024*1024)throw Error('照片太大了，请换一张');
  const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>{throw Error('这张照片打不开，请换一张');});
  const k=Math.min(1,MAX_EDGE/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*k),hh=Math.round(bmp.height*k);
  const c=document.createElement('canvas');c.width=w;c.height=hh;c.getContext('2d').drawImage(bmp,0,0,w,hh);bmp.close?.();
  let qv=.86,blob;do{blob=await new Promise(r=>c.toBlob(r,'image/jpeg',qv));qv-=.12;}while(blob&&blob.size>4.5*1024*1024&&qv>.4);
  if(!blob)throw Error('照片处理失败，请换一张');return blobToBase64(blob);
 }
 async function uploadPhotos(files){let ok=0,fail=null;for(const file of files.slice(0,MAX_PHOTOS)){try{await api('/api/friends/serious/photos',{method:'POST',body:{data:await photoToBase64(file)}});ok++;}catch(x){fail=x;}}return {ok,fail};}
 // 名片上的邀请：主人自己发起一条链接邀请并授权自己的生辰，名片按钮就打开它（主人是发起人）。审核中也能用。
 async function ensureInvite(nickname,input){
  const own=await api('/api/friends/share-card').catch(()=>null);if(own?.inviteOk)return true;
  const pair=await api('/api/friends/compatibility/pairs',{method:'POST',body:{purpose:'romance',relation:'friend',ownerNickname:nickname}});
  if(!pair.inviteToken)return false;
  await api('/api/friends/compatibility/pairs/'+encodeURIComponent(pair.id)+'/authorize',{method:'POST',body:{version:'compatibility-guide-v4',consent:true,inferenceConsent:true,poolOptIn:false,crossBorderConsent:true,input,includeQuestionnaire:false,allowChat:false}});
  await api('/api/friends/share-card',{method:'POST',body:{invite:{pairId:pair.id,token:pair.inviteToken}}});return true;
 }
 async function submit(f,btn){
  const nickname=f.querySelector('#jn-nickname').value.trim();if(!nickname)throw Error('请填一个昵称。');
  const input=readBirth(f);
  if(!['jn-cross','jn-adult','jn-policy'].every(id=>f.querySelector('#'+id).checked))throw Error('请勾选三项必选确认。');
  if(!user){authState();$('#jn-auth').scrollIntoView({behavior:'smooth',block:'start'});throw Error('请先登录或创建账号，填好的内容还在这里。');}
  btn.disabled=true;btn.textContent='正在提交…';
  const chart=await api('/api/friends/chart',{method:'POST',body:input});
  const r=await api('/api/friends/profile',{method:'POST',body:{joinForm:true,consent:true,crossBorderConsent:true,policyVersion:POLICY,listed:true,nickname,bio:f.querySelector('#jn-intro').value.trim(),purposes:['serious'],credential:chart.credential,visibility:{dayMaster:'public'},targetStems:['不限'],targetZodiacs:['不限']}});
  let saved=0,saveError=null;if(q)try{saved=await q.save();}catch(x){saveError=x;}
  const hour=input.time?HOURS[Math.floor(((+input.time.slice(0,2)+1)%24)/2)]:null;
  await api('/api/friends/share-card',{method:'POST',body:{birth:{date:input.birthday,hour},gender:input.gender}});
  const files=[...(f.querySelector('#jn-photos').files||[])];let photos={ok:0,fail:null};if(files.length)photos=await uploadPhotos(files);
  let inviteError=null;try{await ensureInvite(nickname,input);}catch(x){inviteError=x;}
  return {profile:r.profile,saved,saveError,photos,inviteError};
 }
 function share(link,btn,note){
  btn.addEventListener('click',async()=>{
   try{if(navigator.share){await navigator.share({title:'我的相亲名片',text:'这是我的相亲名片，方便的话测测我们是否相配。',url:link});note.textContent='已打开分享。';return;}}catch(x){if(x?.name==='AbortError')return;}
   try{await navigator.clipboard.writeText('这是我的相亲名片，方便的话测测我们是否相配：'+link);note.textContent='链接已复制，发给 TA 就好。';}catch{note.textContent='复制没成功，请长按下面的链接手动复制。';}
  });
 }
 async function renderDone(result){
  const box=$('#jn-done'),own=await api('/api/friends/share-card').catch(()=>null);
  const link=location.origin+'/pages/friends-card.html?c='+encodeURIComponent(result.profile.shareId);
  const show={...(own?.show||{photo:true,city:true,birthday:true,hour:false,contact:false})};
  const note=h('p',{class:'muted jn-note',role:'status'}),sw=h('div',{class:'jn-switches'}),contact=h('input',{class:'in',id:'jn-contact',maxlength:'120',placeholder:'微信号 / 手机号 / 其他',value:own?.contact||'','aria-label':'联系方式'});
  const contactRow=h('div',{class:'jn-contact',hidden:!show.contact},contact,h('p',{class:'hint',text:'打开后，拿到链接的人都能看到'}));
  let timer=null;
  const push=()=>{clearTimeout(timer);timer=setTimeout(async()=>{try{await api('/api/friends/share-card',{method:'POST',body:{show,contact:contact.value}});note.textContent='名片设置已保存。';}catch(x){note.textContent=x.message;}},300);};
  for(const [k,label] of SWITCHES){
   const input=h('input',{type:'checkbox',role:'switch','data-k':k});input.checked=!!show[k];
   input.addEventListener('change',()=>{show[k]=input.checked;if(k==='contact')contactRow.hidden=!input.checked;push();});
   sw.append(h('label',{class:'jn-sw'},h('span',{text:label}),input));if(k==='contact')sw.append(contactRow);
  }
  contact.addEventListener('input',push);
  const shareBtn=h('button',{class:'jn-pair jn-share',type:'button',text:'把我的名片发给TA'});share(link,shareBtn,note);
  box.hidden=false;box.replaceChildren(...[
   h('p',{class:'im-eyebrow',text:'登 记 完 成'}),h('h2',{id:'jn-success',text:SUCCESS}),
   result.saved?h('p',{class:'muted',text:'你答了 '+result.saved+' 道底线题，已存进你自己的问卷。'}):null,
   result.saveError?h('p',{class:'error',text:'底线题暂未保存：'+result.saveError.message}):null,
   result.photos?.ok?h('p',{class:'muted',text:'已上传 '+result.photos.ok+' 张照片，审核通过后名片才显示。'}):null,
   result.photos?.fail?h('p',{class:'error',text:'有照片没传上：'+result.photos.fail.message}):null,
   result.inviteError?h('p',{class:'error',text:'名片上的邀请暂时没建好：'+result.inviteError.message}):null,
   h('a',{class:'jn-pair',href:'/pages/friends-compatibility.html?start=friend',text:'测测我们是否相配'}),
   profileNudge(own),
   h('h3',{text:'名片上给 TA 看什么'}),h('p',{class:'muted',text:'这些开关只管名片链接，不改你在发现页和资料里的可见设置。审核通过前，名片只显示昵称和「资料审核中」。'}),
   sw,shareBtn,h('p',{class:'jn-link',text:link}),note,
   h('a',{class:'jn-preview',href:link,target:'_blank',rel:'noopener',text:'先看看名片什么样 ›'})].filter(Boolean));
  document.body.classList.add('jn-finished');window.scrollTo(0,0);
 }
 async function init(){
  authForm();
  const {f,qs}=buildForm();$('#jn-host').replaceChildren(f);
  await refresh();
  q=await quickQuestions(qs).catch(e=>{qs.replaceChildren(h('p',{class:'note',text:e.message}));return null;});
  f.addEventListener('submit',async e=>{e.preventDefault();const btn=f.querySelector('#jn-submit'),err=f.querySelector('#jn-error');err.textContent='';
   try{const res=await submit(f,btn);$('#jn-host').hidden=true;$('#jn-auth').hidden=true;await renderDone(res);}
   catch(x){err.textContent=x.message;btn.disabled=false;btn.textContent='提交登记表';}});
 }
 init();
})();
