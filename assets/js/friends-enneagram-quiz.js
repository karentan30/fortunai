'use strict';
// 相生九型人格快速小测：18 道二选一，每个号码各出现 4 次（9 个号码两两搭配，一题只比两种倾向）。题目为相生原创，不是专业测评。
// Pure data + score() are shared with node tests (module.exports); in the browser this also exposes
// window.XiangshengEnneagramQuiz.open({onDone,onClose}) — the same in-page overlay pattern (mq-* styles) as the MBTI quiz.
(function(root){
  const QUESTIONS=[
    {id:'e1',text:'朋友搬家喊你帮忙，你更可能……',a:{text:'带上清单，把东西分好类再装箱，一样不落',type:'1'},b:{text:'早点到，顺手给大家买好水和吃的',type:'2'}},
    {id:'e2',text:'小组讨论卡住了，你通常……',a:{text:'直接拍板：先按这个方向做',type:'8'},b:{text:'先安静听一圈，把大家的话理清楚再开口',type:'5'}},
    {id:'e3',text:'接手一件新任务，你最先想的是……',a:{text:'怎样尽快做出看得见的成果',type:'3'},b:{text:'哪里可能出岔子，先备好后手',type:'6'}},
    {id:'e4',text:'周末的安排临时被打乱，你……',a:{text:'有点烦，原本都安排好了',type:'1'},b:{text:'正好，换个新地方玩玩',type:'7'}},
    {id:'e5',text:'一个人的晚上，你更可能……',a:{text:'听歌、写点东西，跟着心情走',type:'4'},b:{text:'钻研一个感兴趣的话题，查资料查到很晚',type:'5'}},
    {id:'e6',text:'朋友之间起了点小摩擦，你……',a:{text:'当面说开，不喜欢憋着',type:'8'},b:{text:'先缓一缓，等大家气消了自然就好',type:'9'}},
    {id:'e7',text:'朋友心情低落，你……',a:{text:'马上去找TA，陪着、照顾TA',type:'2'},b:{text:'先给TA一点空间，TA需要时再出现',type:'5'}},
    {id:'e8',text:'第一次去一个陌生城市，你……',a:{text:'提前查好住处、交通，连下雨怎么办都想到了',type:'6'},b:{text:'订张票就出发，路上再看',type:'7'}},
    {id:'e9',text:'大家点外卖意见不一，你……',a:{text:'都行，你们定就好',type:'9'},b:{text:'认真比一比，哪家更干净、更值',type:'1'}},
    {id:'e10',text:'被人夸的时候，你更想听到……',a:{text:'你真能干，事情办得漂亮',type:'3'},b:{text:'你很特别，跟别人都不一样',type:'4'}},
    {id:'e11',text:'心里难过的时候，你……',a:{text:'允许自己难过一阵，慢慢消化',type:'4'},b:{text:'找点开心的事做，先转移注意力',type:'7'}},
    {id:'e12',text:'看到有人被不公平对待，你……',a:{text:'站出来替TA说话',type:'8'},b:{text:'私下安慰TA，问TA需要什么帮忙',type:'2'}},
    {id:'e13',text:'遇到一个重要的决定，你更习惯……',a:{text:'自己把信息研究透再决定',type:'5'},b:{text:'找信得过的人商量，心里更有底',type:'6'}},
    {id:'e14',text:'做一件自己的作品，你更在意……',a:{text:'每个细节都做对、做规范',type:'1'},b:{text:'有自己的风格，能表达出我',type:'4'}},
    {id:'e15',text:'朋友聚会上，你更常……',a:{text:'照顾大家吃好喝好，留意谁落单了',type:'2'},b:{text:'认识新朋友，聊聊彼此在做的事',type:'3'}},
    {id:'e16',text:'朋友提议一个有点刺激的新玩法，你……',a:{text:'好玩，马上算我一个',type:'7'},b:{text:'可以，但得由我来安排怎么玩',type:'8'}},
    {id:'e17',text:'一天结束时，最让你满足的是……',a:{text:'今天平平稳稳，身边的人都相处融洽',type:'9'},b:{text:'今天搞定了几件重要的事',type:'3'}},
    {id:'e18',text:'朋友临时取消了约定，你心里……',a:{text:'会多想一下：是不是出了什么事',type:'6'},b:{text:'没关系，改天再约就好',type:'9'}},
  ];
  const TYPES=['1','2','3','4','5','6','7','8','9'];
  const DISCLAIMER='这是相生原创的快速小测，不是专业测评，结果只作参考，可以随时改成你觉得更像自己的号码。';
  // answers: {questionId:'a'|'b'}. ranked = 号码按得分从高到低（同分按号码顺序）；close = 与最高分只差 0–1 分的其他号码，供用户自己挑。
  function score(answers){
    const counts=Object.fromEntries(TYPES.map(t=>[t,0]));
    let answered=0;
    for(const q of QUESTIONS){const pick=answers?.[q.id];if(pick==='a'||pick==='b'){counts[q[pick].type]++;answered++;}}
    const ranked=[...TYPES].sort((x,y)=>counts[y]-counts[x]||Number(x)-Number(y));
    const complete=answered===QUESTIONS.length,type=complete?ranked[0]:null;
    const close=complete?ranked.slice(1).filter(t=>counts[t]>=counts[type]-1).slice(0,2):[];
    return {counts,ranked,answered,complete,type,close};
  }
  const api={QUESTIONS,TYPES,DISCLAIMER,score};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}

  // ---------- Browser overlay (same structure and mq-* classes as friends-mbti-quiz.js) ----------
  const D=()=>root.XiangshengEnneagramData;
  const name=t=>D()?D().label(t):t+'号';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let el=null,opts={},answers={},pos=0,lastFocus=null,doneSent=false;
  function close(chosen){
    if(!el)return;
    el.remove();el=null;document.documentElement.classList.remove('mq-lock');document.removeEventListener('keydown',onKey,true);
    if(chosen)opts.onDone?.(chosen);else opts.onClose?.();
    try{lastFocus?.focus({preventScroll:true});}catch{}
  }
  function onKey(e){if(e.key==='Escape'&&el){e.preventDefault();close();}}
  function frame(body){
    el.innerHTML=`<div class="mq-panel"><div class="mq-top"><button type="button" class="mq-icon mq-back" aria-label="上一题"${pos>0?'':' style="visibility:hidden"'}>‹ 上一题</button><span class="mq-name">九型人格小测</span><button type="button" class="mq-icon mq-close" aria-label="关闭小测">×</button></div>${body}</div>`;
    el.querySelector('.mq-close').onclick=()=>close();
    const back=el.querySelector('.mq-back');if(back)back.onclick=()=>{if(pos>0){pos--;render();}};
  }
  function render(){
    if(pos>=QUESTIONS.length){result();return;}
    const q=QUESTIONS[pos],pick=answers[q.id];
    frame(`<div class="mq-progress"><span class="mq-count">${pos+1} / ${QUESTIONS.length}</span><span class="mq-bar"><i style="width:${Math.round(pos/QUESTIONS.length*100)}%"></i></span></div>
      <h2 class="mq-q" id="mq-q" tabindex="-1">${esc(q.text)}</h2>
      <div class="mq-opts" role="group" aria-labelledby="mq-q">${['a','b'].map(k=>`<button type="button" class="mq-opt" data-k="${k}" aria-pressed="${pick===k}">${esc(q[k].text)}</button>`).join('')}</div>
      <p class="mq-foot">凭第一感觉选就好，没有对错。</p>`);
    el.querySelectorAll('.mq-opt').forEach(b=>b.onclick=()=>{answers[q.id]=b.dataset.k;pos++;render();});
    el.querySelector('#mq-q').focus({preventScroll:true});
  }
  function result(){
    const s=score(answers),t=s.type,info=D()?.TYPES?.[t];
    if(!doneSent){doneSent=true;try{window.XiangshengFriendsBridge?.event('enneagram_quiz_done');}catch{}}
    frame(`<div class="mq-result"><p class="mq-kicker">小测参考结果</p><h2 class="mq-type mq-type-enn" id="mq-q" tabindex="-1">${esc(name(t))}</h2>${info?`<p class="mq-desc">${esc(info.portrait)}</p>`:''}
      ${s.close.length?`<p class="mq-desc mq-alt-note">也有点像下面这些，读读看哪个更像你：</p><div class="mq-alts">${s.close.map(x=>`<button type="button" class="secondary mq-alt" data-t="${esc(x)}"><b>${esc(name(x))}</b>${D()?.TYPES?.[x]?`<small>${esc(D().TYPES[x].portrait)}</small>`:''}</button>`).join('')}</div>`:''}
      <div class="mq-actions"><button type="button" class="primary mq-use">用 ${esc(name(t))}</button><button type="button" class="secondary mq-redo">重新测</button></div>
      <p class="mq-disclaimer">${esc(DISCLAIMER)}</p></div>`);
    const back=el.querySelector('.mq-back');if(back)back.style.visibility='hidden';
    el.querySelector('.mq-use').onclick=()=>close(t);
    el.querySelectorAll('.mq-alt').forEach(b=>b.onclick=()=>close(b.dataset.t));
    el.querySelector('.mq-redo').onclick=()=>{answers={};pos=0;doneSent=false;render();};
    el.querySelector('#mq-q').focus({preventScroll:true});
  }
  function open(o={}){
    if(el)close();
    opts=o;answers={};pos=0;doneSent=false;lastFocus=document.activeElement;
    el=document.createElement('div');el.className='mq-overlay';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','九型人格小测');
    document.body.appendChild(el);document.documentElement.classList.add('mq-lock');document.addEventListener('keydown',onKey,true);
    render();
  }
  root.XiangshengEnneagramQuiz={...api,open,close:()=>close()};
})(typeof window!=='undefined'?window:globalThis);
