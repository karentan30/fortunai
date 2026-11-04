'use strict';
(()=>{
  const $=selector=>document.querySelector(selector);
  const state={groups:{posts:[],profiles:[],wechat:[],comments:[]},category:'posts',query:'',values:Object.create(null),activeId:null};
  const PLACEHOLDER=/［([^］\r\n]{1,100})］/g;
  const defaults=['第1页：本人日主、想认识谁，以及本人选择公开的亮点。','第2页：本人确认的资料、特长与兴趣；未公开的内容不放进去。','第3页：邀请读者测日主、生成自己的卡片；二维码与链接按平台允许的方式设置。'];
  const notices={posts:'体验与合作只写实际发生的。小红书素材默认不附站外链接码，能否发布仍需核查平台规则。',profiles:'这是个人找对象或交友的介绍模板。只填本人真实信息，不把示例身份当成真实嘉宾。',wechat:'这些是产品作者或真实团队的介绍用语。群主许可、值守人与上线链接须真实存在；本地链接不能用于线上招募。',comments:'仅供真实产品作者或团队答疑。不是虚构路人评论，不自动发布或批量互动。'};
  const wechatLabels={platformIntroShort:'微信介绍 · 简短版',platformIntroLong:'微信介绍 · 完整版',groupOwnerPermission:'向群主征求许可',groupRecruitment:'群内自愿招募',groupDescription:'试用群说明',momentsShort:'朋友圈 · 简短介绍',momentsLong:'朋友圈 · 完整介绍',brandBio:'账号简介',welcome:'公众号欢迎语',pricingReply:'价格答疑 · 尚待验证'};
  const labels={posts:'平台种草草稿',profiles:'个人介绍模板',wechat:'产品作者介绍',comments:'作者答疑参考'};
  function normalizeChannel(source,campaign){const raw=typeof source==='string'?source.trim().toLowerCase():'',channel=raw==='微信'?'wechat':raw,code=typeof campaign==='string'?campaign.trim().toLowerCase():'';return {source:['wechat','xhs','douyin','channels','direct','tiktok'].includes(channel)?channel:'direct',campaign:['none','launch_20261105','poster_a','poster_b','video_a','video_b'].includes(code)?code:'none'};}
  function channelLink(){if(!/^https?:$/.test(location.protocol)||location.origin==='null')return '';const attribution=normalizeChannel($('#channel-source').value,$('#channel-campaign').value),url=new URL('/pages/friends-connect.html',location.origin);url.searchParams.set('source',attribution.source);url.searchParams.set('campaign',attribution.campaign);url.hash='start';return url.href;}
  function refreshChannelLink(){const url=channelLink(),host=location.hostname,local=['localhost','127.0.0.1','0.0.0.0','[::1]','::1',''].includes(host)||/^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(host);$('#channel-url').value=url;$('#copy-channel-link').disabled=!url;$('#channel-link-note').textContent=!url?'请通过网页预览打开，再生成当前网站的链接。':local?'这是本地演示地址，仅可本机测试，不能公开获客。':'链接只使用当前部署域名；发布前仍需确认入口已上线且允许在目标平台展示。';}
  let toastTimer,loaded=false;
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
  function text(value){return typeof value==='string'?value:'';}
  function notify(message){$('#marketing-toast').textContent=message;$('#marketing-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#marketing-toast').hidden=true,4000);}
  function tokens(value){return [...new Set([...String(value).matchAll(PLACEHOLDER)].map(match=>match[1]))];}
  function substitute(value){return String(value).replace(PLACEHOLDER,(whole,key)=>state.values[key]?.trim()||whole);}
  function allItems(){return Object.values(state.groups).flat();}
  function itemById(id){return allItems().find(item=>item.id===id);}
  function itemTokens(item){return tokens([item.title,item.body,...item.slides,...item.replies].join('\n'));}
  function prepareData(data){
    const posts=(Array.isArray(data.posts)?data.posts:[]).filter(item=>typeof item?.body==='string').map((item,index)=>({id:'posts-'+index,title:text(item.title)||'种草草稿',subtitle:text(item.angle),body:item.body,slides:Array.isArray(item.slides)&&item.slides.length===3?item.slides.map(text):[...defaults],replies:Array.isArray(item.commentReplies)?item.commentReplies.map(text):[]}));
    const profiles=(Array.isArray(data.profiles)?data.profiles:[]).filter(item=>typeof item?.template==='string').map((item,index)=>({id:'profiles-'+index,title:text(item.style)||'个人介绍模板',subtitle:'本人填写，不代表平台真实用户',body:item.template,slides:[...defaults],replies:[]}));
    const wechat=[];for(const [key,title]of Object.entries(wechatLabels)){if(typeof data.wechat?.[key]==='string')wechat.push({id:'wechat-'+key,title,subtitle:'仅真实产品作者 / 团队使用',body:data.wechat[key],slides:[...defaults],replies:[]});}
    if(Array.isArray(data.wechat?.menus))data.wechat.menus.forEach((menu,index)=>{const items=Array.isArray(menu?.items)?menu.items.filter(value=>typeof value==='string'):[];wechat.push({id:'wechat-menu-'+index,title:'菜单建议 · '+(text(menu.name)||'待命名'),subtitle:'仅为菜单草稿，不代表已开通',body:[text(menu.name),...items.map((value,itemIndex)=>(itemIndex+1)+'. '+value),text(menu.note)].filter(Boolean).join('\n'),slides:[...defaults],replies:[]});});
    const comments=(Array.isArray(data.comments)?data.comments:[]).filter(item=>typeof item?.reply==='string').map((item,index)=>({id:'comments-'+index,title:text(item.question)||'答疑草稿',subtitle:text(item.identity)||'仅真实产品作者 / 团队使用',body:item.reply,slides:[...defaults],replies:[]}));
    state.groups={posts,profiles,wechat,comments};
  }
  function buildVariables(item){
    state.activeId=item?.id||null;const keys=item?itemTokens(item):[];$('#variable-count').textContent=keys.length?keys.length+' 项待本人确认':'';const container=$('#variable-fields');container.replaceChildren();
    if(!keys.length){container.append(element('p','fine-print','这套没有［变量］。仍请核对真实身份、研发状态和发布条件。'));return;}
    keys.forEach((key,index)=>{const wrapper=element('div','variable-field'),label=element('label','',key),input=document.createElement('input');input.id='marketing-variable-'+index;label.htmlFor=input.id;input.type='text';input.maxLength=240;input.autocomplete='off';input.placeholder='未填时保留［'+key+'］';input.value=state.values[key]||'';input.dataset.variable=key;input.addEventListener('input',()=>{state.values[key]=input.value;updateViews();});wrapper.append(label,input);container.append(wrapper);});
  }
  function updateViews(){
    document.querySelectorAll('[data-template-part]').forEach(node=>{const item=itemById(node.dataset.itemId);if(!item)return;const part=node.dataset.templatePart;node.textContent=substitute(part==='title'?item.title:part==='body'?item.body:part.startsWith('slide-')?item.slides[Number(part.slice(6))]:item.replies[Number(part.slice(6))]);});
    document.querySelectorAll('[data-missing-for]').forEach(node=>{const item=itemById(node.dataset.missingFor);if(!item)return;const unresolved=tokens(substitute([item.title,item.body,...item.slides].join('\n'))).length;node.textContent=unresolved?'仍有 '+unresolved+' 处［内容］待本人填写；复制后仍保留。':'请再核对事实、公开范围和发布条件。';});
  }
  function templateNode(tag,className,item,part){const node=element(tag,className);node.dataset.templatePart=part;node.dataset.itemId=item.id;return node;}
  function renderCard(item,index){
    const card=element('details','draft-card');card.open=index===0;const summary=document.createElement('summary'),label=element('span','draft-label',labels[state.category]+(item.subtitle?' · '+item.subtitle:'')),title=templateNode('h2','',item,'title');summary.append(label,title);card.append(summary);
    const content=element('div','draft-content'),body=templateNode('p','draft-body',item,'body'),missing=element('p','draft-missing');missing.dataset.missingFor=item.id;content.append(body,missing);
    const actions=element('div','draft-actions'),copy=element('button','secondary',state.category==='comments'?'复制作者答复':'复制文案');copy.type='button';copy.addEventListener('click',()=>copyDraft((state.category==='posts'?substitute(item.title)+'\n\n':'')+substitute(item.body)));const fill=element('button','secondary','填这套里的［变量］');fill.type='button';fill.addEventListener('click',()=>{buildVariables(item);$('#marketing-variables').open=true;$('#marketing-variables').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#variable-fields input')?.focus({preventScroll:true}),150);});const pictures=element('a','primary','生成我的3张图 ↗');pictures.href='/pages/friends-connect.html#poster';actions.append(copy,fill,pictures);content.append(actions);
    const slides=element('details','draft-slides');slides.append(element('summary','','固定3页配图建议'));const list=document.createElement('ol');for(let slide=0;slide<3;slide++)list.append(templateNode('li','',item,'slide-'+slide));const copySlides=element('button','text-button','复制3页建议');copySlides.type='button';copySlides.addEventListener('click',()=>copyDraft(item.slides.map((value,slide)=>'第'+(slide+1)+'页：'+substitute(value)).join('\n\n')));slides.append(list,copySlides);content.append(slides);
    if(item.replies.length){const replies=element('details','draft-comment-replies');replies.append(element('summary','','真实作者答疑参考'));item.replies.forEach((_,reply)=>replies.append(templateNode('p','',item,'reply-'+reply)));content.append(replies);}
    card.append(content);return card;
  }
  function render(){
    const items=state.groups[state.category],query=state.query.trim().toLowerCase(),visible=query?items.filter(item=>substitute([item.title,item.subtitle,item.body].join(' ')).toLowerCase().includes(query)):items;
    $('#category-notice').textContent=notices[state.category];$('#marketing-list').setAttribute('aria-labelledby','tab-'+state.category);$('#marketing-count').textContent=visible.length+' 条草稿';const container=$('#marketing-list');container.replaceChildren();
    if(!visible.length){container.append(element('p','marketing-empty',query?'没有匹配的草稿，可以换个关键词。':loaded?'这类素材还在整理，暂不显示虚构内容。':'素材尚未载入。'));buildVariables(null);return;}
    visible.forEach((item,index)=>container.append(renderCard(item,index)));const active=visible.find(item=>item.id===state.activeId)||visible[0];buildVariables(active);updateViews();
  }
  function localLinkWarning(value){return /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[\/#?]|\b)/i.test(value)?'\n\n【含本地演示链接，仅本机可用，不可作为线上入口发布。】':'';}
  async function copyDraft(value){
    const content=value+localLinkWarning(value),unresolved=tokens(content).length;
    try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(content);notify(unresolved?'已复制草稿，［未填项］仍保留，请先核对。':'已复制，请核对真实身份与发布条件后手动发送。');}
    catch{$('#marketing-copy-text').value=content;$('#marketing-copy-dialog').showModal();$('#marketing-copy-text').focus();$('#marketing-copy-text').select();}
  }
  async function load(){
    $('#marketing-state').textContent='正在读取素材…';
    try{const response=await fetch('/assets/data/friends-marketing.json',{credentials:'same-origin',cache:'no-store',referrerPolicy:'origin'});if(!response.ok)throw Error('not-ready');const data=await response.json();prepareData(data);loaded=true;const local=['localhost','127.0.0.1','0.0.0.0',''].includes(location.hostname)||location.protocol==='file:';$('#marketing-state').textContent=(local?'本地素材预览 · ':'')+(data.meta?.status==='draft_not_published'?'草稿未发布 · ':'')+'未知［内容］保留，链接与合作身份需本人核实。';render();}
    catch{state.groups={posts:[],profiles:[],wechat:[],comments:[]};loaded=false;$('#marketing-state').textContent='素材还在整理，暂时没有可用草稿。';$('#marketing-count').textContent='';$('#marketing-list').replaceChildren();const empty=element('div','marketing-empty','没有读取到素材。不会用虚构的套数或示例人物填充。'),retry=element('button','secondary','重新读取');retry.type='button';retry.addEventListener('click',load);empty.append(retry);$('#marketing-list').append(empty);buildVariables(null);}
  }
  const tabs=[...document.querySelectorAll('[role=tab]')];function selectTab(tab){state.category=tab.dataset.category;state.query='';$('#marketing-search').value='';tabs.forEach(other=>{const active=other===tab;other.setAttribute('aria-selected',String(active));other.tabIndex=active?0:-1;});render();}
  tabs.forEach(tab=>{tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1;tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();}});});
  $('#marketing-search').addEventListener('input',event=>{state.query=event.target.value;render();});$('#clear-variables').addEventListener('click',()=>{state.values=Object.create(null);buildVariables(itemById(state.activeId));updateViews();notify('本页填写已清空，未知［内容］已保留。');});$('#copy-dialog-close').addEventListener('click',()=>$('#marketing-copy-dialog').close());$('#marketing-copy-dialog').addEventListener('close',()=>$('#marketing-copy-text').value='');window.addEventListener('pagehide',()=>{state.values=Object.create(null);$('#marketing-copy-dialog').close();buildVariables(itemById(state.activeId));updateViews();});
  $('#channel-source').addEventListener('change',refreshChannelLink);$('#channel-campaign').addEventListener('change',refreshChannelLink);$('#copy-channel-link').addEventListener('click',()=>{const url=channelLink();if(url)copyDraft(url);});refreshChannelLink();load();
})();
