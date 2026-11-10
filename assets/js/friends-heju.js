'use strict';
// 相生 · 相合局：各页面的控制器。页面用 <body data-heju="hub|signup|new|invite|group|chat|after|club"> 指定。
// 只用 createElement + textContent 拼界面；不显示分数，不显示人数。文案红线见 server/lib/friends-copy-guard.js。
(function(){
  const D=window.XiangshengHejuData,body=document.body,page=body.dataset.heju;
  const main=document.getElementById('hj-root');
  const LOGIN='/pages/friends-connect.html#login',CARD='/pages/friends-connect.html#profile',QUESTIONS='/pages/friends-questions.html';

  // ---- 小工具 ----
  function h(tag,attrs,...kids){
    const n=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){
      if(v==null||v===false)continue;
      if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v===true)n.setAttribute(k,'');else n.setAttribute(k,v);
    }
    for(const c of kids.flat()){if(c==null||c===false)continue;n.append(typeof c==='string'?document.createTextNode(c):c);}
    return n;
  }
  const clear=n=>{n.replaceChildren();return n;};
  let toastTimer;
  function toast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},3600);}
  class ApiError extends Error{constructor(m,status,code){super(m);this.status=status;this.code=code;}}
  async function api(path,{method,body:payload}={}){
    const m=method||(payload!==undefined?'POST':'GET');
    let r;
    try{r=await fetch('/api/friends'+path,{method:m,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},...(m!=='GET'?{body:JSON.stringify(payload||{})}:{})});}
    catch(_){throw new ApiError('网络不太稳，稍后再试。',0);}
    let data=null;try{data=await r.json();}catch(_){}
    if(!r.ok)throw new ApiError((data&&data.error)||'这一步没成功，请稍后再试。',r.status,data&&data.code);
    return data||{};
  }
  const hashId=()=>decodeURIComponent((location.hash||'').replace(/^#/,''));
  const linkOf=token=>location.origin+'/pages/friends-heju-invite.html#'+token;
  function loginCard(){
    return h('div',{class:'hj-card'},h('h2',{text:'先登录'}),h('p',{text:'登录后才能使用相合局。'}),h('div',{class:'hj-actions'},h('a',{class:'primary',href:LOGIN,text:'去登录'})));
  }
  function guideCard(rd){
    if(!rd||rd.ready)return null;
    const links=[];
    if(['need_card','rejected'].includes(rd.code))links.push(h('a',{class:'primary',href:CARD,text:'去做我的卡片'}));
    if(rd.code==='need_questions')links.push(h('a',{class:'primary',href:QUESTIONS,text:'去答 14 道底线题'}));
    if(!links.length&&rd.code!=='paused')links.push(h('a',{class:'secondary',href:CARD,text:'看看我的卡片'}));
    return h('div',{class:'hj-warn',role:'status'},h('p',{text:rd.hint||'还差一步才能用相合局。'}),links.length?h('div',{class:'hj-actions'},links):null);
  }
  async function guard(fn){
    try{await fn();}catch(e){
      if(e.status===401){clear(main).append(loginCard());return;}
      clear(main).append(h('div',{class:'hj-warn',role:'alert'},h('p',{text:e.message||'打不开，请稍后再试。'}),h('div',{class:'hj-actions'},h('a',{class:'secondary',href:'/pages/friends-heju.html',text:'回相合局首页'}))));
    }
  }
  async function act(btn,fn,okMsg){
    if(btn)btn.disabled=true;
    try{const r=await fn();if(okMsg)toast(okMsg);return r;}
    catch(e){toast(e.message);return null;}
    finally{if(btn)btn.disabled=false;}
  }
  const chipGroup=(items,selected,{multi=true,onChange}={})=>{
    const box=h('div',{class:'hj-chips'});
    const draw=()=>{for(const b of box.children)b.setAttribute('aria-pressed',selected.has(b.dataset.v)?'true':'false');};
    for(const [v,label] of items){
      const b=h('button',{type:'button',class:'hj-chip','data-v':v,'aria-pressed':'false',text:label,onclick:()=>{
        if(multi){selected.has(v)?selected.delete(v):selected.add(v);}else{selected.clear();selected.add(v);}
        draw();onChange&&onChange();
      }});box.append(b);
    }
    draw();return box;
  };
  const activityField=(input)=>{
    const wrap=h('div');
    const chips=h('div',{class:'hj-chips'},D.ACTIVITIES.map(a=>h('button',{type:'button',class:'hj-chip',text:a,onclick:()=>{input.value=a;}})));
    wrap.append(h('label',{class:'hj-field'},h('span',{text:'想一起做什么'}),input),h('p',{class:'hj-hint',text:'可以直接填，也可以点下面的建议。公共场所里的轻活动就好。'}),chips);
    return wrap;
  };

  // ---- 首页：状态、等待、我的局 ----
  async function hub(){
    const me=await api('/heju/me');clear(main);
    main.append(h('h1',{text:D.COPY.title}),h('p',{class:'hj-lead',text:D.COPY.sub}));
    for(const n of me.notices||[])main.append(h('div',{class:'hj-notice',role:'status'},n.text,n.groupId?[' ',h('a',{class:'hj-plain',href:'/pages/friends-heju-group.html#'+n.groupId,text:'去看看'})]:null));
    if(me.notices&&me.notices.length)api('/heju/seen',{method:'POST',body:{}}).catch(()=>{});
    const g=guideCard(me.readiness);if(g)main.append(g);
    if(me.paused)main.append(h('div',{class:'hj-warn',role:'status'},h('p',{text:'因为缺席记录，报名暂时暂停了。暂停结束后可以继续登记。'})));
    if(me.signups&&me.signups.length){
      const card=h('section',{class:'hj-card','aria-labelledby':'hj-wait'},h('h2',{id:'hj-wait',text:'我的登记'}),h('p',{text:D.COPY.waiting}),h('p',{class:'hj-hint',text:D.COPY.nudge}));
      const ul=h('ul',{class:'hj-list'});
      for(const s of me.signups){
        const li=h('li',{},h('div',{class:'hj-grow'},h('strong',{text:s.activity}),h('small',{text:(s.windows||[]).map(w=>w.label).join('、')+' · '+s.area+(s.sameSchool?' · 只和同校':'')})),
          s.status==='grouped'&&s.groupId?h('a',{class:'hj-small-btn',href:'/pages/friends-heju-group.html#'+s.groupId,text:'去确认'}):h('button',{type:'button',class:'hj-small-btn',text:'取消登记',onclick:async e=>{const r=await act(e.currentTarget,()=>api('/heju/signup/'+s.id+'/cancel',{body:{}}),'已取消');if(r)hub().catch(()=>{});}}));
        ul.append(li);
      }
      card.append(ul);main.append(card);
    }
    if(me.groups&&me.groups.length){
      const card=h('section',{class:'hj-card','aria-labelledby':'hj-groups'},h('h2',{id:'hj-groups',text:'我的局'}));
      const ul=h('ul',{class:'hj-list'});
      for(const x of me.groups){
        ul.append(h('li',{},h('div',{class:'hj-grow'},h('strong',{text:x.activity}),x.needsAction?h('span',{class:'hj-tag',text:'等你确认'}):null,h('small',{text:x.whenLabel+' · '+x.statusLabel})),
          h('a',{class:'hj-small-btn',href:(x.afterOpen&&!['cancelled'].includes(x.status)?'/pages/friends-heju-after.html#':'/pages/friends-heju-group.html#')+x.id,text:x.afterOpen?'局后':'查看'})));
      }
      card.append(ul);main.append(card);
    }
    main.append(h('div',{class:'hj-actions'},
      h('a',{class:'primary',href:'/pages/friends-heju-signup.html',text:'登记，等人凑齐'}),
      h('a',{class:'secondary',href:'/pages/friends-heju-new.html',text:'自己开一个局'})));
    if(me.club)main.append(h('p',{class:'hj-quiet'},'合作俱乐部：',h('a',{href:'/pages/friends-heju-club.html',text:'管理我的场次'})));
    main.append(h('p',{class:'hj-quiet',text:D.COPY.safety}));
  }

  // ---- 登记页 ----
  async function signup(){
    const me=await api('/heju/me');clear(main);
    main.append(h('h1',{text:'登记，等人凑齐'}),h('p',{class:'hj-lead',text:'只在同一片区、时间合得上的人之间凑局。凑齐三到六个人才会通知你，不一定很快。'}));
    const g=guideCard(me.readiness);if(g)main.append(g);
    const activity=h('input',{type:'text',maxlength:'12',placeholder:'比如：羽毛球',autocomplete:'off'});
    const windows=new Set(),area=h('input',{type:'text',maxlength:'30',placeholder:'比如：东校区',autocomplete:'off'});
    const school=h('input',{type:'checkbox',id:'hj-school',checked:true}),adult=h('input',{type:'checkbox',id:'hj-adult'}),consent=h('input',{type:'checkbox',id:'hj-consent'});
    const days=h('div',{class:'hj-days'});
    const dayBox=new Set();
    for(const [dk,dl] of D.DAYS){
      const row=h('div',{class:'hj-day'},h('b',{text:dl}));
      for(const [pk,pl] of D.PERIODS){
        const key=dk+'-'+pk;
        row.append(h('button',{type:'button',class:'hj-chip','data-v':key,'aria-pressed':'false',text:pl,onclick:e=>{const b=e.currentTarget;windows.has(key)?windows.delete(key):windows.add(key);b.setAttribute('aria-pressed',windows.has(key)?'true':'false');}}));
      }
      days.append(row);
    }
    void dayBox;
    const submit=h('button',{type:'submit',class:'primary',text:'登记'});
    const form=h('form',{class:'hj-card',novalidate:true},
      activityField(activity),
      h('div',{class:'hj-field'},h('span',{text:'方便的时间（可多选）'}),days),
      h('label',{class:'hj-field'},h('span',{text:'校区或片区'}),area,h('p',{class:'hj-hint',text:'只写校区或区域，不要写具体门牌。'})),
      h('label',{class:'hj-check',for:'hj-school'},school,h('span',{text:'只和同校的人凑局。'+D.COPY.schoolNote})),
      h('label',{class:'hj-check',for:'hj-adult'},adult,h('span',{text:D.COPY.adult})),
      h('label',{class:'hj-check',for:'hj-consent'},consent,h('span',{text:D.COPY.consent})),
      h('p',{class:'hj-hint',text:D.COPY.safety}),
      h('div',{class:'hj-actions'},submit));
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const r=await act(submit,()=>api('/heju/signup',{body:{activity:activity.value,windows:[...windows],area:area.value,sameSchool:school.checked,adult:adult.checked,consent:consent.checked}}));
      if(!r)return;
      clear(main).append(h('h1',{text:'已登记'}),h('div',{class:'hj-card',role:'status'},h('p',{text:D.COPY.waiting}),h('p',{class:'hj-hint',text:D.COPY.nudge}),r.awaitingReview?h('p',{class:'hj-hint',text:r.note||'卡片通过审核后才会参与凑局。'}):null),
        h('div',{class:'hj-actions'},h('a',{class:'primary',href:'/pages/friends-heju.html',text:'回相合局首页'}),h('a',{class:'secondary',href:CARD,text:'把资料补完整'})));
    });
    main.append(form);
  }

  // ---- 自己开局 ----
  async function create(){
    const me=await api('/heju/me');clear(main);
    main.append(h('h1',{text:'自己开一个局'}),h('p',{class:'hj-lead',text:'定好活动、时间和片区，把链接发给想一起的人。对方申请，你来通过。'}));
    const g=guideCard(me.readiness);if(g)main.append(g);
    const activity=h('input',{type:'text',maxlength:'12',placeholder:'比如：夜跑',autocomplete:'off'}),area=h('input',{type:'text',maxlength:'30',placeholder:'比如：南门操场一带',autocomplete:'off'});
    const win=h('select',{id:'hj-win'},h('option',{value:'',text:'选一个时间'}),D.WINDOWS.map(k=>h('option',{value:k,text:D.windowLabel(k)})));
    const cap=h('select',{id:'hj-cap'},h('option',{value:'',text:'选人数'}),[3,4,5,6].map(n=>h('option',{value:String(n),text:n+' 人（含你）'})));
    const school=h('input',{type:'checkbox',id:'hj-school',checked:true}),fill=h('input',{type:'checkbox',id:'hj-fill'}),adult=h('input',{type:'checkbox',id:'hj-adult'});
    const submit=h('button',{type:'submit',class:'primary',text:'开局'});
    const form=h('form',{class:'hj-card',novalidate:true},activityField(activity),
      h('label',{class:'hj-field'},h('span',{text:'时间'}),win,h('p',{class:'hj-hint',text:'会选这个时间之后最近的一次，至少提前 3 小时。'})),
      h('label',{class:'hj-field'},h('span',{text:'片区'}),area,h('p',{class:'hj-hint',text:'只写校区或区域，不要写具体门牌。集合点等大家都确认后再定。'})),
      h('label',{class:'hj-field'},h('span',{text:'人数'}),cap),
      h('label',{class:'hj-check',for:'hj-school'},school,h('span',{text:'只让同校的人加入。'+D.COPY.schoolNote})),
      h('label',{class:'hj-check',for:'hj-fill'},fill,h('span',{text:'让系统帮我补几个相合的人（对方会先收到邀请，自己确认）'})),
      h('label',{class:'hj-check',for:'hj-adult'},adult,h('span',{text:D.COPY.adult})),
      h('p',{class:'hj-hint',text:D.COPY.safety}),h('div',{class:'hj-actions'},submit));
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const r=await act(submit,()=>api('/heju/groups',{body:{activity:activity.value,windowKey:win.value,area:area.value,capacity:Number(cap.value),sameSchool:school.checked,fillBySystem:fill.checked,adult:adult.checked}}));
      if(!r)return;
      const url=linkOf(r.inviteToken),input=h('input',{type:'text',readonly:true,value:url,'aria-label':'邀请链接'});
      clear(main).append(h('h1',{text:'局开好了'}),h('div',{class:'hj-card',role:'status'},h('p',{text:'把下面的链接发给想一起的人。这个链接只显示一次，之后可以在局的页面换一个新的。'}),
        h('div',{class:'hj-link'},input,h('button',{type:'button',class:'secondary',text:'复制',onclick:()=>{input.select();(navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('已复制'),()=>toast('请长按链接复制'));}}))),
        h('div',{class:'hj-actions'},h('a',{class:'primary',href:'/pages/friends-heju-group.html#'+r.group.id,text:'去看这个局'})));
    });
    main.append(form);
  }

  // ---- 邀请落地页（链接放在 # 后面，不进服务器日志） ----
  async function invite(){
    const token=hashId();clear(main);
    if(!token){main.append(h('div',{class:'hj-warn'},h('p',{text:'这个链接不完整，请向发起人再要一次。'})));return;}
    let pub;
    try{pub=(await api('/heju/public/'+encodeURIComponent(token))).invite;}
    catch(e){main.append(h('div',{class:'hj-warn',role:'alert'},h('p',{text:'这个链接已经失效，请向发起人再要一个新的。'})));return;}
    main.append(h('h1',{text:pub.creatorName+' 邀请你一起'+pub.activity}),
      h('div',{class:'hj-card'},h('p',{text:'活动：'+pub.activity}),h('p',{text:'时间：'+pub.whenLabel}),h('p',{text:'片区：'+pub.area}),h('p',{text:'发起人：'+pub.creatorName})));
    let mine=null;
    try{mine=(await api('/heju/invite/'+encodeURIComponent(token))).invite;}catch(e){if(e.status!==401)main.append(h('div',{class:'hj-warn'},h('p',{text:e.message})));}
    if(!mine){main.append(h('div',{class:'hj-card'},h('p',{text:'登录后可以看到你们的相合关系，并申请加入。'}),h('div',{class:'hj-actions'},h('a',{class:'primary',href:LOGIN,text:'登录后回来'}))));return;}
    if(mine.isCreator){main.append(h('div',{class:'hj-actions'},h('a',{class:'primary',href:'/pages/friends-heju-group.html#'+mine.groupId,text:'去我的局'})));return;}
    if(mine.relation)main.append(h('div',{class:'hj-card'},h('p',{text:mine.relation})));
    if(mine.venue)main.append(h('div',{class:'hj-card'},h('p',{text:'场地：'+mine.venue}),mine.feeNote?h('p',{text:'费用：'+mine.feeNote}):null,h('p',{class:'hj-hint',text:mine.feeNoteHint||''})));
    if(mine.member){main.append(h('div',{class:'hj-notice'},mine.member==='requested'?'申请已发出，等发起人通过。':'你已经在这个局里了。'),mine.groupId?h('div',{class:'hj-actions'},h('a',{class:'primary',href:'/pages/friends-heju-group.html#'+mine.groupId,text:'查看'})):null);return;}
    const g=guideCard(mine.readiness);if(g){main.append(g);return;}
    if(mine.state==='closed'||mine.state==='full'){main.append(h('div',{class:'hj-warn'},h('p',{text:mine.state==='full'?'这个局已经满了。':'这个局已经结束报名了。'})));return;}
    const adult=h('input',{type:'checkbox',id:'hj-adult'}),btn=h('button',{type:'submit',class:'primary',text:mine.kind==='club'?'报名':'申请加入'});
    const form=h('form',{class:'hj-card',novalidate:true},h('label',{class:'hj-check',for:'hj-adult'},adult,h('span',{text:D.COPY.adult})),h('p',{class:'hj-hint',text:D.COPY.safety}),h('div',{class:'hj-actions'},btn));
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const r=await act(btn,()=>api('/heju/invite/'+encodeURIComponent(token)+'/join',{body:{adult:adult.checked}}));
      if(!r)return;
      clear(form).append(h('p',{role:'status',text:r.status==='confirmed'?'报名成功。':'申请已发出，等发起人通过，通过后会在站内通知你。'}),h('div',{class:'hj-actions'},h('a',{class:'primary',href:'/pages/friends-heju-group.html#'+r.groupId,text:'查看'})));
    });
    main.append(form);
  }

  // ---- 局详情 ----
  const relatedTag=m=>m.related?h('span',{class:'hj-tag',text:'和你相合'}):null;
  function clubBlock(c){
    const box=h('div',{class:'hj-card'},h('h2',{text:c.activity}),h('p',{text:c.whenLabel+' · '+c.area}),h('p',{text:'场地：'+c.venue}),c.feeNote?h('p',{text:'费用：'+c.feeNote+'（俱乐部自己收取，相生不收费）'}):null,
      h('p',{text:'已报名 '+c.count+' 人，名额 '+c.capacity+' 个。'}));
    if(c.nicknames&&c.nicknames.length)box.append(h('p',{class:'hj-hint',text:'报名的同学：'+c.nicknames.join('、')}));
    if(c.tables&&c.tables.length){
      box.append(h('h2',{text:'建议的座位'}));
      for(const t of c.tables)box.append(h('div',{class:'hj-table'},h('strong',{text:t.nicknames.join('、')}),h('p',{class:'hj-hint',text:t.reason})));
    }
    return box;
  }
  async function group(){
    const id=hashId();if(!id)throw new ApiError('没有找到这个局',404);
    const r=await api('/heju/groups/'+encodeURIComponent(id));clear(main);
    if(r.club){
      main.append(h('h1',{text:'场次详情'}),clubBlock(r.club));
      const out=h('div');main.append(out,h('div',{class:'hj-actions'},h('a',{class:'secondary',href:'/pages/friends-heju-club.html',text:'回俱乐部页'})));return;
    }
    const g=r.group;
    main.append(h('h1',{text:g.activity}),h('p',{class:'hj-lead',text:g.whenLabel+' · '+g.area}));
    main.append(h('div',{class:'hj-card'},h('p',{},h('strong',{text:g.statusLabel}),g.creatorName&&g.kind!=='system'?['　发起人：'+g.creatorName]:null),
      g.venue?h('p',{text:'场地：'+g.venue}):null,g.feeNote?h('p',{text:'费用：'+g.feeNote}):null,g.feeNoteHint?h('p',{class:'hj-hint',text:g.feeNoteHint}):null));
    if(g.status==='cancelled')main.append(h('div',{class:'hj-notice',text:'这个局没凑齐，已经取消。你还在等待名单里的话，会继续帮你凑。'}));
    // 集合点
    if(g.kind!=='club'&&g.status!=='cancelled'){
      const box=h('div',{class:'hj-card'},h('h2',{text:'集合点'}));
      if(g.spot)box.append(h('p',{text:g.spot}));else box.append(h('p',{class:'hj-hint',text:g.spotHint||''}));
      if(g.canSetSpot){
        const spot=h('input',{type:'text',maxlength:'60',placeholder:'比如：体育馆南门',autocomplete:'off'}),b=h('button',{type:'submit',class:'secondary',text:'保存集合点'});
        const f=h('form',{novalidate:true},h('label',{class:'hj-field'},h('span',{text:'定集合点（公共或校园内的地点）'}),spot),h('div',{class:'hj-actions'},b));
        f.addEventListener('submit',async e=>{e.preventDefault();const x=await act(b,()=>api('/heju/groups/'+id+'/spot',{body:{spot:spot.value}}),'已保存');if(x)group().catch(()=>{});});
        box.append(f);
      }
      main.append(box);
    }
    // 成员
    if(g.members&&g.members.length){
      const card=h('div',{class:'hj-card'},h('h2',{text:'这个局的人'}));const ul=h('ul',{class:'hj-list'});
      for(const m of g.members){
        const li=h('li',{},h('div',{class:'hj-grow'},h('strong',{text:m.nickname+(m.mine?'（你）':'')}),relatedTag(m),h('small',{text:m.status==='confirmed'?'已确认':m.status==='requested'?'申请中':'还没回复'})));
        if(!m.mine&&g.me){
          li.append(h('button',{type:'button',class:'hj-small-btn',text:'举报',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/members/'+m.mid+'/report',{body:{reason:'局里的行为让我不舒服'}}));if(x)toast(x.message||'已举报');}}),
            h('button',{type:'button',class:'hj-small-btn danger',text:'屏蔽',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/members/'+m.mid+'/block',{body:{}}),'已屏蔽，之后不会分到一起');if(x)group().catch(()=>{});}}));
        }
        ul.append(li);
      }
      card.append(ul);main.append(card);
    }
    if(r.requests&&r.requests.length){
      const card=h('div',{class:'hj-card'},h('h2',{text:'想加入的人'}));const ul=h('ul',{class:'hj-list'});
      for(const q of r.requests){
        ul.append(h('li',{},h('div',{class:'hj-grow'},h('strong',{text:q.nickname}),q.related?h('span',{class:'hj-tag',text:'和你相合'}):null),
          h('button',{type:'button',class:'hj-small-btn',text:'通过',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/members/'+q.mid+'/approve',{body:{}}),'已通过');if(x)group().catch(()=>{});}}),
          h('button',{type:'button',class:'hj-small-btn',text:'婉拒',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/members/'+q.mid+'/decline',{body:{}}),'已婉拒');if(x)group().catch(()=>{});}})));
      }
      card.append(ul);main.append(card);
    }
    if(g.table)main.append(h('div',{class:'hj-card'},h('h2',{text:'建议同桌'}),h('p',{text:g.table.nicknames.join('、')}),h('p',{class:'hj-hint',text:g.table.reason})));
    // 操作
    const actions=h('div',{class:'hj-actions'});
    if(g.canConfirm){
      actions.append(h('button',{type:'button',class:'primary',text:'我确认参加',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/confirm',{body:{}}),'已确认');if(x)group().catch(()=>{});}}),
        h('button',{type:'button',class:'secondary',text:'这次不去',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/decline',{body:{}}),'已退出');if(x)location.href='/pages/friends-heju.html';}}));
      main.append(h('p',{class:'hj-hint',text:'要在 '+(g.confirmBy?new Date(g.confirmBy).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'约定时间')+' 前回复，没回复会被请出这个局。'}));
    }
    if(g.canLock)actions.append(h('button',{type:'button',class:'secondary',text:'人够了，定下来',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/lock',{body:{}}),'已定下来');if(x)group().catch(()=>{});}}));
    if(g.canChat)actions.append(h('a',{class:'primary',href:'/pages/friends-heju-chat.html#'+id,text:'进群聊'}));
    if(g.afterOpen)actions.append(h('a',{class:'primary',href:'/pages/friends-heju-after.html#'+id,text:'局后：想继续认识谁'}));
    if(g.canLeave)actions.append(h('button',{type:'button',class:'secondary',text:'退出这个局',onclick:async e=>{if(!confirm('确定退出吗？活动开始前不到 2 小时退出，会记一次缺席。'))return;const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/leave',{body:{}}),'已退出');if(x)location.href='/pages/friends-heju.html';}}));
    if(g.isCreator&&g.kind==='user'&&!['cancelled','done'].includes(g.status)){
      const out=h('div');
      actions.append(h('button',{type:'button',class:'secondary',text:'换一个新的邀请链接',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/invite',{body:{}}));if(!x)return;const url=linkOf(x.inviteToken),input=h('input',{type:'text',readonly:true,value:url,'aria-label':'新的邀请链接'});clear(out).append(h('div',{class:'hj-card'},h('p',{text:'新链接只显示一次，旧链接已经失效。'}),h('div',{class:'hj-link'},input,h('button',{type:'button',class:'secondary',text:'复制',onclick:()=>{input.select();(navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('已复制'),()=>toast('请长按链接复制'));}}))));}}));
      main.append(actions,out);
    }else main.append(actions);
    main.append(h('p',{class:'hj-quiet'},h('a',{href:'/pages/friends-heju.html',text:'回相合局首页'})));
  }

  // ---- 群聊 ----
  let chatTimer;
  async function chat(){
    const id=hashId();if(!id)throw new ApiError('没有找到这个局',404);
    clear(main).append(h('h1',{text:'群聊'}),h('p',{class:'hj-hint',text:'只有这个局的人看得到，只能发文字。活动结束 7 天后关闭。遇到不舒服的内容，点「举报」，对方的消息会对你隐藏。'}));
    const list=h('div',{class:'hj-chat',role:'log','aria-live':'polite'}),text=h('textarea',{maxlength:'500',rows:'1',placeholder:'说点什么','aria-label':'消息'}),send=h('button',{type:'submit',class:'primary',text:'发送'});
    const form=h('form',{class:'hj-send',novalidate:true},text,send);
    main.append(list,form,h('p',{class:'hj-quiet'},h('a',{href:'/pages/friends-heju-group.html#'+id,text:'回这个局'})));
    let last='';
    async function load(){
      const r=await api('/heju/groups/'+encodeURIComponent(id)+'/chat');
      const sig=r.messages.map(m=>m.id).join(',');if(sig===last)return;last=sig;
      const stick=list.scrollTop+list.clientHeight>=list.scrollHeight-40;
      clear(list);
      if(!r.messages.length)list.append(h('p',{class:'hj-hint',text:'还没有消息。先打个招呼，问问大家想几点到。'}));
      for(const m of r.messages){
        const b=h('div',{class:'hj-msg'+(m.mine?' mine':'')},h('small',{text:m.nickname}),m.text);
        if(!m.mine)b.append(h('button',{type:'button',class:'hj-small-btn',text:'举报',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/chat/'+m.id+'/report',{body:{reason:'群聊内容不当'}}));if(x){toast(x.message||'已举报');last='';load().catch(()=>{});}}}));
        list.append(b);
      }
      if(stick)list.scrollTop=list.scrollHeight;
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();const v=text.value;if(!v.trim())return;
      const r=await act(send,()=>api('/heju/groups/'+id+'/chat',{body:{text:v}}));
      if(r){text.value='';last='';await load().catch(()=>{});list.scrollTop=list.scrollHeight;}
    });
    await load();list.scrollTop=list.scrollHeight;
    clearInterval(chatTimer);chatTimer=setInterval(()=>{if(!document.hidden)load().catch(()=>{});},8000);
  }

  // ---- 局后 ----
  async function after(){
    const id=hashId();if(!id)throw new ApiError('没有找到这个局',404);
    const r=await api('/heju/groups/'+encodeURIComponent(id)+'/after');clear(main);
    main.append(h('h1',{text:'局后：想继续认识谁'}),h('p',{class:'hj-lead',text:r.group.activity+' · '+r.group.whenLabel}),h('p',{class:'hj-hint',text:r.note}));
    if(r.reviewNote)main.append(h('div',{class:'hj-notice',role:'status',text:r.reviewNote}));
    if(!r.group.settled){
      const card=h('div',{class:'hj-card'},h('h2',{text:'你到场了吗'}),h('p',{class:'hj-hint',text:'如实选就好。也可以标出没来的人，只有多数人都标出，才会记一次缺席。'}));
      const absent=new Set(),opts=r.people.map(p=>[p.mid,p.nickname+' 没来']);
      const chips=chipGroup(opts,absent);
      const yes=h('button',{type:'button',class:'primary',text:'我到了',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/attendance',{body:{attended:true,absent:[...absent]}}),'已记下');if(x)after().catch(()=>{});}});
      const no=h('button',{type:'button',class:'secondary',text:'我没去',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/attendance',{body:{attended:false,absent:[]}}),'已记下');if(x)after().catch(()=>{});}});
      card.append(r.people.length?chips:null,h('div',{class:'hj-actions'},yes,no),r.attended===true?h('p',{class:'hj-hint',text:'你已标记：到场。'}):r.attended===false?h('p',{class:'hj-hint',text:'你已标记：没去。'}):null);
      main.append(card);
    }
    const card=h('div',{class:'hj-card'},h('h2',{text:'想继续认识谁'}),h('p',{class:'hj-hint',text:'私下选。你选了谁，对方不会知道；只有互相选了，才会连上。'}));
    const ul=h('ul',{class:'hj-list'});
    if(!r.people.length)ul.append(h('li',{},h('span',{class:'hj-hint',text:'这个局里没有可以选的人。'})));
    for(const p of r.people){
      const li=h('li',{},h('div',{class:'hj-grow'},h('strong',{text:p.nickname}),p.mutual?h('small',{text:p.state==='connected'?'你们互相选了，已经连上':p.state==='waiting_review'?'你们互相选了，资料审核通过后自动连上':'你们互相选了'}):null));
      if(p.mutual&&p.state==='connected'&&p.shareId)li.append(h('a',{class:'hj-small-btn',href:'/pages/friends-card.html?c='+encodeURIComponent(p.shareId),text:'去看卡片'}));
      li.append(h('button',{type:'button',class:'hj-small-btn','aria-pressed':p.picked?'true':'false',text:p.picked?'已选':'想认识',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+id+'/pick',{body:{mid:p.mid,on:!p.picked}}));if(x)after().catch(()=>{});}}));
      ul.append(li);
    }
    card.append(ul);main.append(card,h('p',{class:'hj-quiet'},h('a',{href:'/pages/friends-heju.html',text:'回相合局首页'})));
  }

  // ---- 俱乐部：开场次、看报名 ----
  async function club(){
    const me=await api('/heju/me');clear(main);
    if(!me.club){main.append(h('h1',{text:'俱乐部场次'}),h('div',{class:'hj-warn'},h('p',{text:'这个账号还不是合作俱乐部。需要开通的话，请联系相生运营。'})));return;}
    main.append(h('h1',{text:me.club.name}),h('p',{class:'hj-lead',text:'开场次，同学自己报名。你只会看到昵称和报名人数。'}));
    const activity=h('input',{type:'text',maxlength:'12',placeholder:'比如：羽毛球',autocomplete:'off'}),venue=h('input',{type:'text',maxlength:'60',placeholder:'比如：体育馆三号场'}),fee=h('input',{type:'text',maxlength:'60',placeholder:'比如：场地费现场向俱乐部交'}),area=h('input',{type:'text',maxlength:'30',placeholder:'比如：东校区'}),cap=h('input',{type:'text',inputmode:'numeric',maxlength:'2',placeholder:'3 到 40'});
    const win=h('select',{id:'hj-win'},h('option',{value:'',text:'选一个时间'}),D.WINDOWS.map(k=>h('option',{value:k,text:D.windowLabel(k)}))),rec=h('input',{type:'checkbox',id:'hj-rec'});
    const submit=h('button',{type:'submit',class:'primary',text:'开场次'});
    const form=h('form',{class:'hj-card',novalidate:true},h('h2',{text:'新场次'}),activityField(activity),
      h('label',{class:'hj-field'},h('span',{text:'时间'}),win),h('label',{class:'hj-field'},h('span',{text:'片区'}),area),h('label',{class:'hj-field'},h('span',{text:'场地（公共场所）'}),venue),
      h('label',{class:'hj-field'},h('span',{text:'费用说明'}),fee,h('p',{class:'hj-hint',text:'费用由俱乐部自己收，相生不收费，也不经手。'})),h('label',{class:'hj-field'},h('span',{text:'名额'}),cap),
      h('label',{class:'hj-check',for:'hj-rec'},rec,h('span',{text:'每周同一时间自动开下一场'})),h('div',{class:'hj-actions'},submit));
    const out=h('div'),listBox=h('div');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const r=await act(submit,()=>api('/heju/groups',{body:{activity:activity.value,windowKey:win.value,area:area.value,venue:venue.value,feeNote:fee.value,capacity:Number(cap.value),recurring:rec.checked}}));
      if(!r)return;showLink(out,r.inviteToken);loadList();
    });
    function showLink(box,token){
      const url=linkOf(token),input=h('input',{type:'text',readonly:true,value:url,'aria-label':'报名链接'});
      clear(box).append(h('div',{class:'hj-card',role:'status'},h('p',{text:'报名链接只显示一次，发给同学。'}),h('div',{class:'hj-link'},input,h('button',{type:'button',class:'secondary',text:'复制',onclick:()=>{input.select();(navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('已复制'),()=>toast('请长按链接复制'));}}))));
    }
    async function loadList(){
      const r=await api('/heju/club/groups');clear(listBox);
      if(!r.groups.length){listBox.append(h('p',{class:'hj-hint',text:'还没有场次。'}));return;}
      for(const c of r.groups){
        const box=clubBlock(c);
        if(!['cancelled','done'].includes(c.status))box.append(h('div',{class:'hj-actions'},h('button',{type:'button',class:'secondary',text:'换一个新的报名链接',onclick:async e=>{const x=await act(e.currentTarget,()=>api('/heju/groups/'+c.id+'/invite',{body:{}}));if(x)showLink(out,x.inviteToken);}})));
        listBox.append(box);
      }
    }
    main.append(form,out,h('h2',{text:'我的场次'}),listBox);
    await loadList();
  }

  const PAGES={hub,signup,new:create,invite,group,chat,after,club};
  if(main&&PAGES[page])guard(PAGES[page]);
  if(page==='group'||page==='chat'||page==='after'||page==='invite')window.addEventListener('hashchange',()=>{guard(PAGES[page]);});
})();
