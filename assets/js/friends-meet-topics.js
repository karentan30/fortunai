'use strict';
// 相生 · 「见面三步」里第 2/3 步的「这次聊什么」：每步 3–4 个话题，每个话题配一句可以直接说的开场白。
// 静态内容只放这里；friends-meet-steps.js 负责渲染和「换一批」。文案要过 friends-copy-guard（测试会扫）。
// 特殊话题 slot：
//   activity  —— 用双方都勾了的「约会想一起做的事」填 {a}；没有共同项时用 fallback。
//   qAgree / qDiffer —— 婚恋问卷里想法接近 / 不同或标了底线的方向，填 {q}；拿不到数据时用 fallback（见 friends-meet-steps.js 的 HOOK）。
(function(root){
  const TOPICS={
    2:{hint:'15 分钟语音，聊得来再开一两分钟视频',topics:[
      {topic:'工作忙不忙、周末怎么过',opener:'最近工作忙吗？周末一般怎么安排？'},
      {slot:'activity',topic:'你们都想一起做的「{a}」',opener:'看到你也选了{a}，你接触多久了？平时常去哪儿？',fallback:{topic:'平时喜欢做点什么',opener:'不上班的时候，你最喜欢做点什么？'}},
      {topic:'一天怎么过、作息',opener:'你一般几点下班？晚上回家后通常做什么？'},
      {slot:'qAgree',topic:'问卷里想法接近的「{q}」',opener:'我看我们在{q}上想法挺接近的，你当时是怎么想的？',fallback:{topic:'理想的周末',opener:'如果有一个完全空出来的周末，你最想怎么过？'}}
    ],more:[
      {topic:'最近去过、想去的地方',opener:'最近有没有去哪儿玩？有没有一直想去的地方？'},
      {topic:'联系和见面的频率',opener:'平时你习惯多久联系一次？忙的时候会怎么说一声？'}
    ]},
    3:{hint:'可以慢慢聊聊以后',note:'有好感了再聊大事更自然；先听对方怎么想，不急着下结论。',topics:[
      {topic:'在哪个城市生活、什么时候结婚、要不要孩子',opener:'以后你想在哪个城市定下来？结婚和孩子这些事，你是怎么打算的？'},
      {slot:'qDiffer',topic:'问卷里想法不同或标了底线的「{q}」',opener:'{q}这一项我们写得不太一样，你当时是怎么想的？',fallback:{topic:'在意的事',opener:'在一段关系里，你最在意的是什么？你当时是怎么想到的？'}},
      {topic:'和家里的关系、过年怎么过',opener:'你和家里人关系怎么样？过年一般怎么过？'}
    ],more:[
      {topic:'花钱和存钱的习惯',opener:'你平时花钱是随性一点，还是会提前计划？'},
      {topic:'吵架了怎么和好',opener:'跟亲近的人有分歧时，你一般怎么处理？'}
    ]}
  };
  const api={TOPICS,TITLE:'这次聊什么',MORE:'换一批'};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.XSMeetTopics=api;
})(typeof window!=='undefined'?window:globalThis);
