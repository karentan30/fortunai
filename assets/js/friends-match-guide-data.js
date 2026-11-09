'use strict';
// 相生 · 日主/星座相合指南的文案数据（浏览器 window.XiangshengMatchGuideData / 测试 require 共用）。
// 日主分组照抄 server/lib/friends-preferences.js recommend().stemGroups 的输出（顺序、天干完全一致，测试会逐项比对）；
// 星座元素照 typeSuggestions() 的 ELEMENT_GROUPS + CONST_COMPLEMENT（同元素=同频，火↔风、土↔水=互补）。
// 文案红线：不得出现 friends-copy-guard.js 的禁用词、百分比或分数；不写「不合」；相克一律写成互补成长、多沟通。
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.XiangshengMatchGuideData=api;})(typeof self!=='undefined'?self:this,function(){
  const ELEMENTS={wood:'木',fire:'火',earth:'土',metal:'金',water:'水'};

  // 每组的标签与「日常相处常见的感受」。{me}=我的五行 {other}=对方五行。
  const GROUP_META={
    he:{label:'天生一对·天干五合',feel:'这两个天干一阴一阳、彼此吸引。日常往往是一种说不太清的默契：性格不一定像，待在一起却很自然，不用刻意找话题。'},
    shengWo:{label:'相生·对方生我',feel:'{other}生{me}。相处中常见的感受是被照顾、被托住：你忙乱的时候TA愿意兜底，会提醒你按时吃饭、早点休息。'},
    same:{label:'同频·同五行',feel:'同为{me}，节奏和想法往往接近，很多事不用多解释就懂。可以聊聊遇到分歧时谁先让一步，免得两个人都想做主。'},
    woSheng:{label:'相生·我生对方',feel:'{me}生{other}。你常是付出、照顾的那一方，看着对方因为你变得更好，会很有成就感；也别忘了说出自己需要什么。'},
    ke:{label:'相克·磨合型',feel:'五行里互相制约，这里看作互补成长型：做事方式差别较大，常能补上彼此看不到的地方。需要多沟通、把感受说清楚，磨合过后往往更稳。'}
  };

  // groups 与 recommend({dayMaster}).stemGroups 一一对应（key 顺序 + stems 完全一致）。
  const STEMS=[
    {stem:'甲',element:'wood',yin:false,image:'参天大树',hua:'土',
      portrait:'像一棵往上长的树：有主见、有方向感，答应的事会扛到底。工作里常是拍板的那个人，私下其实很需要被认可。认识甲木，往往可以从「最近在推进什么」聊起。',
      groups:{he:['己'],shengWo:['壬','癸'],same:['甲','乙'],woSheng:['丙','丁'],ke:['戊','庚','辛']}},
    {stem:'乙',element:'wood',yin:true,image:'花草藤蔓',hua:'金',
      portrait:'像花草和藤蔓：柔软、会变通，在人群里很会照顾气氛。看着随和，心里对喜欢的人和事却很有坚持。和乙木相处，细节和及时的回应往往比大道理更打动TA。',
      groups:{he:['庚'],shengWo:['壬','癸'],same:['甲','乙'],woSheng:['丙','丁'],ke:['戊','己','辛']}},
    {stem:'丙',element:'fire',yin:false,image:'正午的太阳',hua:'水',
      portrait:'像正午的太阳：热情、坦率、闲不住，走到哪里都带着光。情绪来得快去得也快，很少记仇。周末常被TA拉去吃饭、看展、来一场说走就走的短途旅行。',
      groups:{he:['辛'],shengWo:['甲','乙'],same:['丙','丁'],woSheng:['戊','己'],ke:['庚','壬','癸']}},
    {stem:'丁',element:'fire',yin:true,image:'一盏灯火',hua:'木',
      portrait:'像一盏灯：温暖但不张扬，观察细、心思密。对亲近的人特别用心，会记得你随口提过的小事。往往要先有一点安全感，才会慢慢说出真实的想法。',
      groups:{he:['壬'],shengWo:['甲','乙'],same:['丙','丁'],woSheng:['戊','己'],ke:['庚','辛','癸']}},
    {stem:'戊',element:'earth',yin:false,image:'一座山',hua:'火',
      portrait:'像一座山：稳、靠得住，不轻易被情绪带着走。话不多，做事有分寸，是朋友圈里「有事先找TA」的那个人。慢热，熟了以后很护着自己人。',
      groups:{he:['癸'],shengWo:['丙','丁'],same:['戊','己'],woSheng:['庚','辛'],ke:['壬','甲','乙']}},
    {stem:'己',element:'earth',yin:true,image:'一片田地',hua:'土',
      portrait:'像一片田地：包容、务实，很会把日子过顺。擅长照顾人、安排生活，常常先想到别人需要什么。偶尔想得太多，需要有人提醒TA也照顾一下自己。',
      groups:{he:['甲'],shengWo:['丙','丁'],same:['戊','己'],woSheng:['庚','辛'],ke:['壬','癸','乙']}},
    {stem:'庚',element:'metal',yin:false,image:'一块精钢',hua:'金',
      portrait:'像一块精钢：直接、果断、讲原则，说到做到。不喜欢拐弯抹角，话有时说得硬，心里却很讲义气。和庚金相处，坦诚往往比客气更省力。',
      groups:{he:['乙'],shengWo:['戊','己'],same:['庚','辛'],woSheng:['壬','癸'],ke:['甲','丙','丁']}},
    {stem:'辛',element:'metal',yin:true,image:'珠玉首饰',hua:'水',
      portrait:'像打磨过的珠玉：精致、有审美，对自己要求高。在意细节和体面，也在意自己的用心有没有被看见。被欣赏、被认真对待时，会给出很细腻的回应。',
      groups:{he:['丙'],shengWo:['戊','己'],same:['庚','辛'],woSheng:['壬','癸'],ke:['甲','乙','丁']}},
    {stem:'壬',element:'water',yin:false,image:'江河大海',hua:'木',
      portrait:'像江河大海：思路开阔、好奇心强，总在找新的想法和新的地方。聊天常常天南海北，跟TA出门很少无聊。需要自由的空间，被管得太紧会想往外跑。',
      groups:{he:['丁'],shengWo:['庚','辛'],same:['壬','癸'],woSheng:['甲','乙'],ke:['丙','戊','己']}},
    {stem:'癸',element:'water',yin:true,image:'雨露薄雾',hua:'火',
      portrait:'像雨露和薄雾：安静、敏感，直觉很准。不太主动表达，却很能读懂别人的情绪。熟了之后会发现TA很有想法，也很需要被温柔地回应。',
      groups:{he:['戊'],shengWo:['庚','辛'],same:['壬','癸'],woSheng:['甲','乙'],ke:['丙','丁','己']}}
  ];
  const GROUP_ORDER=['he','shengWo','same','woSheng','ke'];
  const elementOf=stem=>(STEMS.find(s=>s.stem===stem)||{}).element;
  const uniq=a=>[...new Set(a)];
  // 渲染用：把 {me}/{other} 换成五行名；五合额外点出合化。
  function groupsFor(stem){
    const s=STEMS.find(x=>x.stem===stem);if(!s)return [];
    return GROUP_ORDER.map(key=>{
      const stems=s.groups[key],others=uniq(stems.map(t=>ELEMENTS[elementOf(t)]));
      let feel=GROUP_META[key].feel.split('{me}').join(ELEMENTS[s.element]+'行').split('{other}').join(others.join('、')+'行');
      if(key==='he')feel=s.stem+stems[0]+'相合，传统说法合化为'+s.hua+'。'+feel;
      return {key,label:GROUP_META[key].label,stems,feel};
    });
  }

  // 星座：顺序与 friends-preferences.js 的 ELEMENT_GROUPS / CONST_ELEM_NAMES 一致；complement 为 CONST_COMPLEMENT 下标。
  const SIGN_ELEMENTS=[
    {key:'fire',name:'火象',signs:['白羊座','狮子座','射手座'],complement:2,
      portrait:'行动派。想到就去做，热情、直接，喜欢有目标、有新鲜感的生活。开心和不开心都写在脸上，来得快去得也快。',
      same:'同为火象，两个人都爱张罗，约饭、出游一拍即合；可以聊聊谁来收尾，别让计划只停在兴头上。',
      complementNote:'和风象常是互补：风象带来新点子和好口才，火象负责把它变成行动，聊天往往越聊越起劲。'},
    {key:'earth',name:'土象',signs:['金牛座','处女座','摩羯座'],complement:3,
      portrait:'踏实派。重视稳定、计划和看得见的结果，答应的事会认真做完。表达感情的方式常常是行动，而不是情话。',
      same:'同为土象，生活节奏和金钱观往往接近，一起规划未来很省心；可以偶尔安排点计划外的小惊喜。',
      complementNote:'和水象常是互补：水象带来情感上的细腻，土象给出生活上的安稳，一个懂心、一个顾家。'},
    {key:'air',name:'风象',signs:['双子座','天秤座','水瓶座'],complement:0,
      portrait:'沟通派。脑子转得快，兴趣广，喜欢交流观点和认识新朋友。需要精神上聊得来，也需要一点各自的空间。',
      same:'同为风象，话题多、不冷场，常常一聊就是一晚上；可以聊聊落到行动上的事，让想法真的发生。',
      complementNote:'和火象常是互补：火象的热情点燃风象的想法，风象的点子让火象有新方向，相处轻快有活力。'},
    {key:'water',name:'水象',signs:['巨蟹座','天蝎座','双鱼座'],complement:1,
      portrait:'感受派。情感丰富，共情力强，很在意关系里的安全感和信任。慢慢熟悉之后，会非常投入、非常护着对方。',
      same:'同为水象，很容易读懂彼此的情绪，相处温柔细腻；情绪低落时可以约定好，由谁先把话说开。',
      complementNote:'和土象常是互补：土象的稳定让水象安心，水象的体贴让土象放松，是一种慢慢升温的相处。'}
  ];

  const COPY={
    title:'日主·星座相合指南',
    lead:'谁和谁容易聊得来？这里把传统天干五行和星座元素的说法整理成一份相处指南。点一下你的日主，看看常见的相处方式。',
    stemIntro:'日主是出生那天的天干，传统文化里用它来描述一个人的底色。下面按五行关系把十个天干分成五种相处方式：五合、对方生我、同五行、我生对方，以及需要多一点磨合的互补型。',
    pickerLabel:'我的日主',
    pickerHint:'还不知道自己的日主？',
    pickerLink:'免费查一下',
    signIntro:'十二星座按火、土、风、水四种元素分组。常见的说法是：同元素同频，火象和风象、土象和水象互补。',
    mbtiTitle:'MBTI',
    mbti:'MBTI 把性格分成 16 种，从精力来源、获取信息的方式、做决定的习惯和生活节奏四个角度描述一个人。网络上流行的相配说法里，第二、三个字母相同的人往往想法相近，另一些组合则是互补搭档。每种性格都可以认识，相配表只是帮你多一个开口的话题。',
    mbtiLink:'看 MBTI 性格相配表',
    closeTitle:'类型只是开头的话题',
    close:'日主、星座和 MBTI 能帮你找到第一句话，但两个人能不能走近，往往要在聊天里慢慢知道：对家庭、钱、城市和生活节奏的想法，比任何类型都更重要。可以先从一份认真写的问卷开始，再去认识真实的人。',
    questionsLink:'填写婚恋问卷',
    discoverLink:'去找朋友',
    fine:'传统文化与流行性格话题，仅供认识时聊天参考'
  };

  return {ELEMENTS,GROUP_META,GROUP_ORDER,STEMS,SIGN_ELEMENTS,COPY,groupsFor};
});
