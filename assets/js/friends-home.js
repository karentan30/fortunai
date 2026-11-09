'use strict';
// 相生 · 未登录首页（#start）的编辑排版部分。设计稿：docs/design-xiangsheng-2026-11-10/home-costar-style.html，米白主题。
// friends.js showStart() 先渲染测日主表单（.landing），再调用 XiangshengHome.mount(main) 在表单前插入下面这些区块。
// 所有区块带 .xh-mkt；#hello-birth 引导流程会整块移除它们，只留表单。
// 只用 createElement + textContent 拼 DOM；没有任何用户数据。文案红线见 server/lib/friends-copy-guard.js（禁用词、百分比，也不写否定关系的词）。
(function(){
  const NS='http://www.w3.org/2000/svg';
  function h(tag,attrs,...kids){
    const n=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){if(v==null)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else n.setAttribute(k,v);}
    for(const k of kids.flat()){if(k==null)continue;n.append(typeof k==='string'?document.createTextNode(k):k);}
    return n;
  }
  const lines=(tag,attrs,parts)=>{const n=h(tag,attrs);parts.forEach((p,i)=>{if(i)n.append(h('br'));n.append(p);});return n;};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 十天干：字、五行、意象、一句性格（设计稿原文）。
  const STEMS=[['甲','木','大树','向上长，有主见'],['乙','木','藤蔓','柔韧，会绕路'],['丙','火','太阳','热烈，照顾全场'],['丁','火','灯火','细腻，暖一个人'],['戊','土','高山','稳，靠得住'],['己','土','田园','包容，会养人'],['庚','金','钢铁','直接，讲原则'],['辛','金','珠玉','精致，有分寸'],['壬','水','江河','大气，爱自由'],['癸','水','雨露','敏感，润物无声']];
  const SEQ='甲乙丙丁戊己庚辛壬癸';
  const ORDER=['甲','丙','戊','庚','壬','乙','丁','己','辛','癸'];
  const TONE={木:'wood',火:'fire',土:'earth',金:'metal',水:'water'};
  const HE_WHY={甲己:'大树扎进田园：一个往上长，一个托得住。',乙庚:'藤蔓绕着钢铁：一个柔，一个刚，刚好撑起来。',丙辛:'阳光照在珠玉上：一个热烈，一个让光更亮。',丁壬:'灯火映在江面：一个细腻，一个包容。',戊癸:'高山接住雨露：一个稳，一个润。'};
  const by=g=>STEMS.find(s=>s[0]===g);
  const full=g=>g+(by(g)?.[1]||'');

  function hero(){
    const s=h('section',{class:'xh-mkt xh-hero','aria-labelledby':'xh-hero-title'});
    const w=h('div',{class:'xh-wrap'});
    w.append(h('p',{class:'xh-mark','aria-hidden':'true',text:'相生.'}));
    w.append(lines('h1',{class:'xh-hero-line',id:'xh-hero-title'},['古法相亲，新式见面。','先合八字，再看照片，再聊三观。']));
    w.append(wheel());
    w.append(h('p',{class:'xh-wheel-note',text:'实线 相生 · 虚线 磨合'}));
    const cta=h('button',{type:'button',class:'xh-btn',id:'start-free-reading',text:'测我的日主，看看谁和我合拍'});
    w.append(h('div',{class:'xh-hero-cta'},cta));
    w.append(h('p',{class:'xh-sub',text:'不用注册 · 一分钟 · 生日不公开'}));
    w.append(h('p',{class:'xh-login'},'已有账号？',h('a',{href:'#login',text:'登录'})));
    s.append(w);return s;
  }
  function wheel(){
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','xh-wheel');svg.setAttribute('viewBox','0 0 260 260');svg.setAttribute('aria-hidden','true');
    const el=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n;};
    const g=el('g',{fill:'none',class:'xh-wheel-lines'});
    g.append(el('circle',{cx:130,cy:130,r:118,opacity:'.35'}),el('circle',{cx:130,cy:130,r:92,opacity:'.2'}),
      el('polygon',{points:'130,38 217.5,101.6 184.1,204.4 75.9,204.4 42.5,101.6',opacity:'.75'}),
      el('polygon',{points:'130,38 184.1,204.4 42.5,101.6 217.5,101.6 75.9,204.4',opacity:'.35','stroke-dasharray':'2 4'}));
    svg.append(g);
    for(const [x,y,w] of [[130,38,'火'],[217.5,101.6,'土'],[184.1,204.4,'金'],[75.9,204.4,'水'],[42.5,101.6,'木']]){
      const n=el('g',{class:'xh-node','data-element':TONE[w]});
      n.append(el('circle',{cx:x,cy:y,r:18}),el('text',{x,y:y+6,'text-anchor':'middle'},w));svg.append(n);
    }
    return svg;
  }

  function what(){
    const s=h('section',{class:'xh-mkt xh-band xh-what','aria-labelledby':'xh-what-title'});
    const w=h('div',{class:'xh-wrap'});
    w.append(h('h2',{class:'xh-eyebrow',id:'xh-what-title',text:'相生是什么'}));
    const cols=h('div',{class:'xh-what-cols'});
    const item=(glyph,lead,rest)=>h('div',{class:'xh-what-item'},h('div',{class:'xh-glyph','aria-hidden':'true',text:glyph}),h('p',{},h('b',{text:lead}),rest));
    cols.append(
      item('八','先合八字','。日主相合、相生的人，先来到你面前。'),
      item('面','再看照片资料','。照片之外，九项资料坦诚相见：年龄、身高、体重、学校学历、职业、年收入、个人资产、家庭资产、房车户籍。'),
      item('观','再聊三观','。相亲十问，底线先对齐。语音十五分钟，视频一两分钟，彼此有意，再约相见。看得见五官，也看得见三观。'));
    w.append(cols);s.append(w);return s;
  }

  function people(){
    const s=h('section',{class:'xh-mkt xh-people-sec','aria-labelledby':'xh-people-title'});
    const w=h('div',{class:'xh-wrap'});
    w.append(h('p',{class:'xh-eyebrow',text:'认识目的'}),lines('h2',{class:'xh-h2',id:'xh-people-title'},['在这里你会认识','什么样的人']),
      h('p',{class:'xh-lede',text:'来这里做什么，自己选，可以多选。目的不同，遇见的人也不同。'}));
    const list=h('ol',{class:'xh-people'});
    const P=[
      ['找搭子','想找人一起打球、徒步、看展，身边朋友总约不齐。','一起做：周末羽毛球、城郊徒步、探一家新店。'],
      ['享受甜甜的恋爱','想好好谈一场恋爱，从聊得来开始。','只遇见同样想谈恋爱的人。先语音，聊得来再约。'],
      ['认真考虑婚恋','奔着结婚去，愿意把想法摊开说：在哪座城市长待、婚育怎么想、家务怎么分。','只遇见同样认真的人；学历、工作、婚况可人工核验。'],
      ['婚后找搭子','有家有工作，就想找几个爱好相投的伙伴，不谈感情。','不会遇见找恋爱、婚恋的人。一起打球、钓鱼、骑行。']
    ];
    P.forEach(([t,who,doing],i)=>list.append(h('li',{class:'xh-person'},h('span',{class:'xh-no','aria-hidden':'true',text:'0'+(i+1)}),h('div',{},h('h3',{text:t}),h('p',{class:'xh-who',text:who}),h('p',{class:'xh-do',text:doing})))));
    w.append(list);s.append(w);return s;
  }

  function stems(){
    const D=window.XiangshengMatchGuideData;
    const s=h('section',{class:'xh-mkt xh-band xh-stems-sec','aria-labelledby':'xh-stems-title'});
    const w=h('div',{class:'xh-wrap'});
    w.append(h('p',{class:'xh-eyebrow',text:'十天干'}),lines('h2',{class:'xh-h2',id:'xh-stems-title'},['哪些日主','互相合拍']),
      h('p',{class:'xh-lede',text:'日主是你出生那天的天干，代表你自己。点一个，看看谁和 TA 相合、相生。'}));
    const grid=h('div',{class:'xh-grid',role:'group','aria-label':'选择一个日主'});
    const panel=h('div',{class:'xh-panel','aria-live':'polite'},h('p',{class:'xh-hint',text:'点上面任意一个日主'}));
    for(const g of ORDER){
      const [stem,elName,image]=by(g);
      const b=h('button',{type:'button',class:'xh-stem','data-stem':stem,'data-element':TONE[elName],'aria-pressed':'false','aria-label':stem+elName+'，'+image},h('b',{text:stem+elName}),h('span',{text:image}));
      b.addEventListener('click',()=>show(stem));grid.append(b);
    }
    function groupRow(label,note,list,why){
      const k=h('p',{class:'xh-k'},label,h('small',{text:note}));
      return h('div',{class:'xh-grp'},k,h('p',{class:'xh-names'},list.map(x=>h('span',{text:full(x)}))),h('p',{class:'xh-why',text:why}));
    }
    function show(g){
      grid.querySelectorAll('.xh-stem').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stem===g)));
      const me=by(g),groups=Object.fromEntries((D?D.groupsFor(g):[]).map(x=>[x.key,x.stems]));
      const he=groups.he||[],gen=[...(groups.shengWo||[]),...(groups.woSheng||[])],same=groups.same||[];
      const elOf=x=>by(x)[1],shengWo=elOf((groups.shengWo||[g])[0]),woSheng=elOf((groups.woSheng||[g])[0]);
      const heWhy=he.length?HE_WHY[[g,he[0]].sort((a,b)=>SEQ.indexOf(a)-SEQ.indexOf(b)).join('')]||'':'';
      panel.replaceChildren(
        h('h3',{text:full(g)+' · '+me[2]}),h('p',{class:'xh-me',text:me[3]}),
        he.length?groupRow('相合','天干五合',he,heWhy):null,
        gen.length?groupRow('相生','五行相生',gen,shengWo+'生'+me[1]+'：TA 像给你充电的人；'+me[1]+'生'+woSheng+'：你容易成为 TA 的后盾。'):null,
        same.length?groupRow('同频','同为'+me[1],same,'节奏相近，一起玩不用多解释。'):null,
        h('a',{class:'xh-ulink',href:'/pages/friends-match-guide.html#stem-'+encodeURIComponent(g),text:'看'+full(g)+'的完整相合指南 →'}));
    }
    w.append(grid,panel,h('p',{class:'xh-fine',text:'按传统天干五合、五行相生整理，作文化参考。两个人怎样相处，见面聊过才知道。'}));
    s.append(w);return s;
  }

  function more(){
    const s=h('section',{class:'xh-mkt xh-more-sec','aria-labelledby':'xh-more-title'});
    const w=h('div',{class:'xh-wrap'});
    w.append(h('p',{class:'xh-eyebrow',text:'再多看看'}),h('h2',{class:'xh-h2',id:'xh-more-title',text:'认识之前，先读懂彼此'}));
    const list=h('ul',{class:'xh-more'});
    for(const [href,t,d] of [['/pages/friends-match-guide.html','相合指南','十个日主、四种星座元素，各自和谁聊得来。'],['/pages/friends-mbti-chart.html','MBTI 相配表','十六型人格，两两怎么相处。'],['/pages/friends-questions.html','相亲问卷','十道底线题，先对齐再见面。']])
      list.append(h('li',{},h('a',{href},h('span',{class:'xh-more-t',text:t}),h('span',{class:'xh-more-d',text:d}),h('span',{class:'xh-arr','aria-hidden':'true',text:'→'}))));
    w.append(list);s.append(w);return s;
  }

  function tagline(){
    return h('section',{class:'xh-mkt xh-tagline','aria-label':'相生'},h('div',{class:'xh-wrap'},lines('p',{class:'xh-tag-text'},['看得见五官，','也看得见三观。'])));
  }

  function mount(main){
    const form=main.querySelector('.landing');if(!form)return;
    form.classList.add('xh-start');form.id='xh-start';
    form.before(hero(),what(),people(),stems(),more(),tagline());
    const toForm=()=>{form.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});document.getElementById('birth-year')?.focus({preventScroll:true});};
    document.getElementById('start-free-reading')?.addEventListener('click',toForm);
  }
  window.XiangshengHome={mount};
})();
