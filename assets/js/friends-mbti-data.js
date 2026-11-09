'use strict';
// 相生 MBTI 相配数据（浏览器 window.XiangshengMbtiData / 服务端 require 共用）。
// 规则：4=天生一对（网络流行的相配说法）；3=很合拍（S/N 相同）；2=可以试试（S/N 不同、T/F 相同）；1=磨合型·互补成长。
// 不给任何组合贴「不合」标签：每种性格都可以认识，仅供娱乐参考。
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.XiangshengMbtiData=api;})(typeof self!=='undefined'?self:this,function(){
  const MBTIS=['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
  const MBTI_BEST={INFJ:['ENFP','ENTP'],INTJ:['ENFP','ENTP'],INFP:['ENFJ','ENTJ'],INTP:['ENTJ','ESTJ'],ENFP:['INFJ','INTJ'],ENTP:['INFJ','INTJ'],ENFJ:['INFP','ISFP'],ENTJ:['INFP','INTP'],ISFJ:['ESFP','ESTP'],ISTJ:['ESFP','ESTP'],ESFJ:['ISFP','ISTP'],ESTJ:['ISTP','INTP'],ISFP:['ENFJ','ESFJ'],ISTP:['ESFJ','ESTJ'],ESFP:['ISFJ','ISTJ'],ESTP:['ISFJ','ISTJ']};
  const LEVELS=[
    {level:4,name:'天生一对'},
    {level:3,name:'很合拍'},
    {level:2,name:'可以试试'},
    {level:1,name:'磨合型·互补成长'}];
  function level(a,b){
    if(!MBTIS.includes(a)||!MBTIS.includes(b))return 0;
    if((MBTI_BEST[a]||[]).includes(b))return 4;
    if(a[1]===b[1])return 3;
    return a[2]===b[2]?2:1;
  }
  function reason(a,b){
    const l=level(a,b);
    if(a===b)return '同一种类型，彼此的习惯最容易懂。';
    if(l===4)return '网络上常说的天生一对：长处互补，容易越聊越有话。';
    if(l===3)return a[2]===b[2]?'看事情的角度和做决定的习惯都接近，容易聊到一块。':'看世界的角度相近，话题好接；做决定的方式略有不同，正好互相参考。';
    if(l===2)return '关注点不太一样，但判断方式相近，聊起来能互相开眼界。';
    return '想法和做事方式差别大，需要多一点耐心，也最能互相补位、一起成长。';
  }
  // 按 4→1 分组：[{level,name,items:[{type,reason}]}]
  function groupsFor(a){
    return LEVELS.map(L=>({level:L.level,name:L.name,items:MBTIS.filter(b=>level(a,b)===L.level).map(b=>({type:b,reason:reason(a,b)}))}));
  }
  // 返回 MBTI_BEST 中不对称的 [a,b]（A 列了 B，B 却没列 A）。
  function asymmetries(){const out=[];for(const a of MBTIS)for(const b of MBTI_BEST[a]||[])if(!(MBTI_BEST[b]||[]).includes(a))out.push([a,b]);return out;}
  return {MBTIS,MBTI_BEST,LEVELS,level,reason,groupsFor,asymmetries};
});
