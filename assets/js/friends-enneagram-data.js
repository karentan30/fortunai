'use strict';
// 相生 九型人格（1–9 号）相配数据（浏览器 window.XiangshengEnneagramData / 服务端 require 共用）。全部文案为相生原创。
// 规则（产品规则，只是聊天话题）：
//   同频 = 同一组（直觉组 8·9·1 / 感受组 2·3·4 / 思考组 5·6·7），或同一个号码；
//   互补 = 九型图上有连线、且不在同一组的两个号码（1–4、1–7、2–8、5–8、3–6、3–9、6–9）；
//   其余 = 慢慢熟悉：没有固定套路，多聊聊。任何两个号码都可以好好相处，不给任何组合贴负面标签。
// 文案红线：不得出现 friends-copy-guard.js 的禁用词、百分比或分数，不给任何组合贴负面标签，不宣称测评效果（见 friends-enneagram.test.cjs）。
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.XiangshengEnneagramData=api;})(typeof self!=='undefined'?self:this,function(){
  const ENNEAGRAMS=['1','2','3','4','5','6','7','8','9'];
  const TYPES={
    '1':{name:'完美型',alias:'改进者',portrait:'认真负责，心里有一把尺，想把事情做得更好。',tip:'认可TA的用心，提建议时说具体的事；偶尔拉TA放下清单，出去走走。'},
    '2':{name:'助人型',alias:'照顾者',portrait:'热心体贴，常常先一步察觉别人需要什么。',tip:'TA常先想着别人，记得也问问TA自己需要什么，对TA的付出说声谢谢。'},
    '3':{name:'成就型',alias:'实干者',portrait:'目标清楚、行动利落，喜欢把事情做成。',tip:'欣赏TA的努力，也让TA知道：不忙的时候，TA一样被喜欢。'},
    '4':{name:'自我型',alias:'感受者',portrait:'感受细腻，看重真实，也看重属于自己的表达方式。',tip:'认真听TA的感受，不急着给建议；TA的小心思被看见时会很开心。'},
    '5':{name:'理智型',alias:'观察者',portrait:'爱琢磨、爱钻研，需要一点自己的安静空间。',tip:'给TA独处和想事情的时间，约见面早点说；聊到TA感兴趣的话题，TA会打开话匣子。'},
    '6':{name:'忠诚型',alias:'守护者',portrait:'重情义，做事前会多想一步，把准备做足。',tip:'说到做到最打动TA；计划有变时提前告诉TA，TA会更安心。'},
    '7':{name:'活跃型',alias:'探索者',portrait:'好奇又乐观，总能找到新鲜好玩的事。',tip:'和TA一起尝试新鲜事；聊到沉一点的话题时，耐心陪TA多坐一会儿。'},
    '8':{name:'领袖型',alias:'保护者',portrait:'直接、有担当，愿意站出来护着身边的人。',tip:'有话直说，TA更喜欢坦率；TA的强势背后，往往是很在乎。'},
    '9':{name:'和平型',alias:'调和者',portrait:'随和温和，待在TA身边让人放松。',tip:'多问问TA自己的想法，给TA时间慢慢说；TA的随和不等于没有主意。'}
  };
  const CENTERS=[
    {key:'gut',name:'直觉组',items:['8','9','1'],note:'做事常凭身体的直觉，在意自己的节奏和分寸'},
    {key:'heart',name:'感受组',items:['2','3','4'],note:'很在意人和人之间的感觉，也希望被看见'},
    {key:'head',name:'思考组',items:['5','6','7'],note:'遇事习惯先在脑子里过一遍，再决定怎么做'}];
  // 互补连线（无序对）及原创说明。
  const COMPLEMENTS={
    '1-4':'一个讲章法，一个讲感受：1号帮4号把想法落到地上，4号让1号松一口气。',
    '1-7':'一个认真、一个好玩：计划因为1号更靠谱，日子因为7号更有意思。',
    '2-8':'一个会照顾人，一个会护着人，彼此都愿意为对方出力。',
    '5-8':'一个想得深，一个动得快：5号出主意，8号往前冲。',
    '3-6':'3号有冲劲，6号想得周全，合在一起既有速度又稳当。',
    '3-9':'3号带来干劲，9号带来松弛，一快一慢正好互相调节。',
    '6-9':'6号细心预备，9号让人安心，在一起常常很踏实。'};
  const pairKey=(a,b)=>Number(a)<Number(b)?a+'-'+b:b+'-'+a;
  const valid=t=>ENNEAGRAMS.includes(t);
  const centerOf=t=>CENTERS.find(c=>c.items.includes(t));
  const label=t=>valid(t)?t+'号 '+TYPES[t].name:'';
  // 'same' | 'complement' | 'explore' ；无效输入返回 ''。
  function relation(a,b){
    if(!valid(a)||!valid(b))return '';
    if(a===b||centerOf(a)===centerOf(b))return 'same';
    return COMPLEMENTS[pairKey(a,b)]?'complement':'explore';
  }
  const GROUP_LABELS={same:'同频',complement:'互补',explore:'慢慢熟悉'};
  function reason(a,b){
    const r=relation(a,b);if(!r)return '';
    if(a===b)return '同为'+a+'号，很多在意的地方不用解释就懂；也给彼此留一点不一样的空间。';
    if(r==='same'){const c=centerOf(a);return '同属'+c.name+'：'+c.note+'，聊起来容易对上频道。';}
    if(r==='complement')return COMPLEMENTS[pairKey(a,b)];
    return '相处方式不太一样，没有固定套路；多聊几次，就能找到你们自己的节奏。';
  }
  // 相配表：[{key,label,items:[{type,label,reason}]}]，顺序 同频 → 互补 → 慢慢熟悉。
  function groupsFor(a){
    if(!valid(a))return [];
    return ['same','complement','explore'].map(key=>({key,label:GROUP_LABELS[key],items:ENNEAGRAMS.filter(b=>b!==a&&relation(a,b)===key).map(b=>({type:b,label:label(b),reason:reason(a,b)}))}));
  }
  // 找朋友「推荐理由」里的一句（只在同频/互补时给，不打分）。
  function matchLine(mine,theirs){
    const r=relation(mine,theirs);
    if(r==='same')return '九型人格同频：'+(mine===theirs?'你们都是'+mine+'号':'你们都属于'+centerOf(mine).name);
    if(r==='complement')return '九型人格互补：'+mine+'号和'+theirs+'号，正好互相补位';
    return '';
  }
  const COPY={
    title:'九型人格相配表',
    lead:'九型人格把常见的性格倾向分成 1 到 9 号。点一下你的号码，看看和谁容易同频、和谁正好互补。',
    basis:'同组的号码按同频推荐，九型图上相连的号码按互补推荐。这是相生整理的聊天话题，任何两个号码都可以好好相处。',
    disclaimer:'九型人格是流行的性格话题，这里只作认识时的参考，不代表关系结果。',
    quizNote:'这是相生原创的快速小测，不是专业测评，结果只作参考，可以随时改成你觉得更像自己的号码。'
  };
  return {ENNEAGRAMS,TYPES,CENTERS,COMPLEMENTS,GROUP_LABELS,COPY,label,relation,reason,groupsFor,matchLine,centerOf};
});
