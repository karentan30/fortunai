'use strict';
// 相生快速性格小测：16 题（每个维度 4 题）+ 打平时每个维度加 1 题。题目为相生原创，不是官方 MBTI 测评。
// Pure data + score() are shared with node tests (module.exports); in the browser this also exposes
// window.XiangshengMbtiQuiz.open({onDone,onClose}) — an in-page overlay that returns the chosen type via onDone.
(function(root){
  const AXES=[['E','I'],['S','N'],['T','F'],['J','P']];
  // a/b = the two options; each option names the pole it counts toward. Option A alternates sides per axis.
  const QUESTIONS=[
    {id:'q1',axis:'EI',text:'周六下午突然空出来了，你更想……',a:{text:'发消息问问谁有空，一起出去转转',pole:'E'},b:{text:'一个人待着，做点自己喜欢的事',pole:'I'}},
    {id:'q2',axis:'SN',text:'朋友推荐了一条没走过的徒步路线，你最先想知道……',a:{text:'多远、要走多久、路好不好走',pole:'S'},b:{text:'沿途能看到什么，有没有特别的地方',pole:'N'}},
    {id:'q3',axis:'TF',text:'一起打球的朋友连输几局，有点沮丧。你的第一反应是……',a:{text:'帮他看看问题出在哪，下次怎么调整',pole:'T'},b:{text:'先陪他聊几句，让他心里好受点',pole:'F'}},
    {id:'q4',axis:'JP',text:'约朋友去爬山，你更喜欢……',a:{text:'提前定好时间、路线和集合地点',pole:'J'},b:{text:'先定个大概的日子，到时看天气和心情',pole:'P'}},
    {id:'q5',axis:'EI',text:'和十几个人徒步了一整天，回来以后你通常……',a:{text:'想回家好好歇着，今天的话说够了',pole:'I'},b:{text:'还挺来劲，想约大家一起吃个晚饭',pole:'E'}},
    {id:'q6',axis:'SN',text:'第一次学一项新运动，比如飞盘，你更喜欢……',a:{text:'先弄明白它好玩在哪，再自己摸索',pole:'N'},b:{text:'跟着教练，一个动作一个动作地练',pole:'S'}},
    {id:'q7',axis:'TF',text:'几个朋友商量周末去哪儿，意见不一样时，你更看重……',a:{text:'大家都玩得开心，别让谁觉得委屈',pole:'F'},b:{text:'哪个方案更合理、更省时省钱',pole:'T'}},
    {id:'q8',axis:'JP',text:'出门玩两三天，你的行李一般是……',a:{text:'出发前才收拾，差不多就行',pole:'P'},b:{text:'提前列好清单，一样一样装好',pole:'J'}},
    {id:'q9',axis:'EI',text:'球场上来了个不认识的新人，你多半会……',a:{text:'主动过去打个招呼，问要不要一起打',pole:'E'},b:{text:'先打自己的，熟一点了再聊',pole:'I'}},
    {id:'q10',axis:'SN',text:'和朋友闲聊时，你更常聊到……',a:{text:'最近发生的事、吃了什么、去了哪儿',pole:'S'},b:{text:'以后想做的事，或者突然冒出来的想法',pole:'N'}},
    {id:'q11',axis:'TF',text:'朋友问你：「我这个计划怎么样？」你通常会……',a:{text:'直接说出你看到的问题',pole:'T'},b:{text:'先说说哪里好，再轻轻提点建议',pole:'F'}},
    {id:'q12',axis:'JP',text:'周末早就安排好了，朋友临时喊你去别处玩，你会……',a:{text:'有点不习惯，更想按原来的安排',pole:'J'},b:{text:'挺好呀，换个玩法也不错',pole:'P'}},
    {id:'q13',axis:'EI',text:'心里有件事想不明白时，你更习惯……',a:{text:'自己先慢慢理清楚，再决定要不要说',pole:'I'},b:{text:'找朋友聊一聊，说着说着就想通了',pole:'E'}},
    {id:'q14',axis:'SN',text:'帮朋友张罗一次周末小聚，你更在意……',a:{text:'有点新花样，让大家有点小惊喜',pole:'N'},b:{text:'吃的喝的够不够，大家坐得舒不舒服',pole:'S'}},
    {id:'q15',axis:'TF',text:'你更欣赏身边哪种朋友？',a:{text:'体贴，能察觉到别人的情绪',pole:'F'},b:{text:'靠谱，遇事冷静、有条理',pole:'T'}},
    {id:'q16',axis:'JP',text:'有件事要在周五前做完，你一般……',a:{text:'快到周五再集中搞定，有点压力反而顺手',pole:'P'},b:{text:'早点开始，给自己留些余地',pole:'J'}},
  ];
  // Only asked when the 4 regular questions of that axis end 2 : 2.
  const TIE_BREAKERS={
    EI:{id:'tEI',axis:'EI',text:'好朋友过生日，你更享受哪种聚会？',a:{text:'几个老朋友围坐着慢慢聊',pole:'I'},b:{text:'人多热闹，还能认识几个新朋友',pole:'E'}},
    SN:{id:'tSN',axis:'SN',text:'看到一张好看的风景照，你先注意到……',a:{text:'照片里具体有什么：天气、颜色、人',pole:'S'},b:{text:'它给你的感觉，让你想起了什么',pole:'N'}},
    TF:{id:'tTF',axis:'TF',text:'要从两位球友里选一位长期一起打，你更会看……',a:{text:'和谁待在一起更自在',pole:'F'},b:{text:'谁的水平和时间更合适',pole:'T'}},
    JP:{id:'tJP',axis:'JP',text:'周日晚上，对接下来的一周你通常……',a:{text:'心里已经大概排好了',pole:'J'},b:{text:'走一步看一步',pole:'P'}},
  };
  const DESCRIPTIONS={
    INTJ:'喜欢把事情想深一层，有自己的节奏和长远打算。',
    INTP:'好奇心强，爱琢磨事情背后的道理，常有独到的想法。',
    ENTJ:'做事有方向感，愿意牵头把想法变成行动。',
    ENTP:'点子多，喜欢讨论，也乐意尝试新玩法。',
    INFJ:'安静而用心，在意事情的意义，也在意身边人的感受。',
    INFP:'内心温和，有自己的坚持，看重真诚和热爱的事。',
    ENFJ:'热心肠，擅长把大家聚到一起、互相照应。',
    ENFP:'热情有感染力，对新的人和事总是很有兴趣。',
    ISTJ:'踏实可靠，答应的事会认真做好。',
    ISFJ:'细心体贴，常在小事上照顾到别人。',
    ESTJ:'务实有条理，能把安排理得清清楚楚。',
    ESFJ:'热络周到，乐于张罗大家的聚会和日常。',
    ISTP:'动手能力强，遇到问题喜欢自己上手解决。',
    ISFP:'随和、有自己的审美，享受当下的小美好。',
    ESTP:'行动派，说走就走，在实践里找乐趣。',
    ESFP:'开朗爱玩，身边的气氛常因为你轻松起来。',
  };
  const DISCLAIMER='这是相生的快速性格小测，不是官方 MBTI 测评，结果仅供参考，可以随时改。';
  const byId=Object.fromEntries([...QUESTIONS,...Object.values(TIE_BREAKERS)].map(q=>[q.id,q]));

  // answers: {questionId:'a'|'b'}. Returns per-pole counts (tie-breakers included), axes still tied after
  // the regular 4 questions (needTieBreak = those whose tie-breaker hasn't been answered), and the type once complete.
  function score(answers){
    const counts={E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0},base={E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};
    for(const q of QUESTIONS){const pick=answers?.[q.id];if(pick==='a'||pick==='b'){counts[q[pick].pole]++;base[q[pick].pole]++;}}
    const answered=QUESTIONS.filter(q=>answers?.[q.id]==='a'||answers?.[q.id]==='b').length;
    const tied=AXES.filter(([x,y])=>base[x]===base[y]).map(([x,y])=>x+y);
    for(const axis of tied){const t=TIE_BREAKERS[axis],pick=answers?.[t.id];if(pick==='a'||pick==='b')counts[t[pick].pole]++;}
    const needTieBreak=answered<QUESTIONS.length?[]:tied.filter(axis=>!['a','b'].includes(answers?.[TIE_BREAKERS[axis].id]));
    const complete=answered===QUESTIONS.length&&!needTieBreak.length;
    const type=complete?AXES.map(([x,y])=>counts[x]>counts[y]?x:y).join(''):null;
    return {counts,tied:answered<QUESTIONS.length?[]:tied,needTieBreak,complete,type};
  }
  // The ordered list of questions to ask given current answers (16 regular + tie-breakers for tied axes).
  function sequence(answers){const s=score(answers);return [...QUESTIONS,...s.tied.map(a=>TIE_BREAKERS[a])];}

  const api={AXES,QUESTIONS,TIE_BREAKERS,DESCRIPTIONS,DISCLAIMER,score,sequence,byId};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}

  // ---------- Browser overlay ----------
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
    el.innerHTML=`<div class="mq-panel"><div class="mq-top"><button type="button" class="mq-icon mq-back" aria-label="上一题"${pos>0?'':' style="visibility:hidden"'}>‹ 上一题</button><span class="mq-name">快速性格小测</span><button type="button" class="mq-icon mq-close" aria-label="关闭小测">×</button></div>${body}</div>`;
    el.querySelector('.mq-close').onclick=()=>close();
    const back=el.querySelector('.mq-back');if(back)back.onclick=()=>{if(pos>0){pos--;render();}};
  }
  function render(){
    const seq=sequence(answers);
    if(pos>=seq.length){result();return;}
    const q=seq[pos],tie=pos>=QUESTIONS.length,pick=answers[q.id];
    frame(`<div class="mq-progress"><span class="mq-count">${pos+1} / ${seq.length}</span><span class="mq-bar"><i style="width:${Math.round(pos/seq.length*100)}%"></i></span></div>
      ${tie?'<p class="mq-tie">这一项两边打平了，再加一题。</p>':''}
      <h2 class="mq-q" id="mq-q" tabindex="-1">${esc(q.text)}</h2>
      <div class="mq-opts" role="group" aria-labelledby="mq-q">${['a','b'].map(k=>`<button type="button" class="mq-opt" data-k="${k}" aria-pressed="${pick===k}">${esc(q[k].text)}</button>`).join('')}</div>
      <p class="mq-foot">凭第一感觉选就好，没有对错。</p>`);
    el.querySelectorAll('.mq-opt').forEach(b=>b.onclick=()=>{answers[q.id]=b.dataset.k;pos++;render();});
    el.querySelector('#mq-q').focus({preventScroll:true});
  }
  function result(){
    const s=score(answers),t=s.type;
    if(!doneSent){doneSent=true;try{window.XiangshengFriendsBridge?.event('mbti_quiz_done');}catch{}}
    frame(`<div class="mq-result"><p class="mq-kicker">你的小测结果</p><h2 class="mq-type" id="mq-q" tabindex="-1">${esc(t)}</h2><p class="mq-desc">${esc(DESCRIPTIONS[t])}</p>
      <ul class="mq-axes">${AXES.map(([x,y])=>{const a=s.counts[x],b=s.counts[y],w=Math.round(a/Math.max(1,a+b)*100);return `<li><span class="mq-ax${a>b?' is-win':''}">${x} ${a}</span><span class="mq-axbar" aria-hidden="true"><i style="width:${w}%"></i></span><span class="mq-ax${b>a?' is-win':''}">${b} ${y}</span><span class="visually-hidden">${x} ${a} 比 ${y} ${b}</span></li>`;}).join('')}</ul>
      <div class="mq-actions"><button type="button" class="primary mq-use">用这个</button><button type="button" class="secondary mq-redo">重新测</button></div>
      <p class="mq-disclaimer">${esc(DISCLAIMER)}</p></div>`);
    const back=el.querySelector('.mq-back');if(back)back.style.visibility='hidden';
    el.querySelector('.mq-use').onclick=()=>close(t);
    el.querySelector('.mq-redo').onclick=()=>{answers={};pos=0;doneSent=false;render();};
    el.querySelector('#mq-q').focus({preventScroll:true});
  }
  function open(o={}){
    if(el)close();
    opts=o;answers={};pos=0;doneSent=false;lastFocus=document.activeElement;
    el=document.createElement('div');el.className='mq-overlay';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','快速性格小测');
    document.body.appendChild(el);document.documentElement.classList.add('mq-lock');document.addEventListener('keydown',onKey,true);
    render();
  }
  root.XiangshengMbtiQuiz={...api,open,close:()=>close()};
})(typeof window!=='undefined'?window:globalThis);
