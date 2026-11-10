'use strict';
// 相生 · 相合局：活动、时间段、固定文案。服务端校验和各页面共用这一份（浏览器 window.XiangshengHejuData / 测试 require）。
// 文案红线：不得出现 friends-copy-guard.js 的禁用词和百分比，不写分数、不写人数，不编造热度。
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.XiangshengHejuData=api;})(typeof self!=='undefined'?self:this,function(){
  const ACTIVITIES=['羽毛球','乒乓球','网球','篮球','夜跑','飞盘','爬山','吃饭'];
  // 同义写法 → 标准名。其余自填活动按「去空格、转小写、去掉开头的打/玩/去」后原样当作一类。
  const SYNONYMS={
    羽毛球:['羽毛球','羽球','badminton'],乒乓球:['乒乓球','乒乓','pingpong','tabletennis'],网球:['网球','tennis'],篮球:['篮球','basketball'],
    夜跑:['夜跑','夜跑步','夜间跑步','跑步','慢跑','晨跑','run','running'],飞盘:['飞盘','ultimate','frisbee'],
    爬山:['爬山','登山','徒步','徒步爬山','hiking'],吃饭:['吃饭','聚餐','约饭','干饭','吃个饭','一起吃饭','食堂','美食']
  };
  // 一期只做公共场所里的轻活动：自填里带这些词的直接拒绝。
  const UNSAFE_ACTIVITY=['酒','ktv','夜店','蹦迪','开房','宿舍','你家','我家','私人'];
  const DAYS=[['mon','周一'],['tue','周二'],['wed','周三'],['thu','周四'],['fri','周五'],['sat','周六'],['sun','周日']];
  const PERIODS=[['am','上午',9],['pm','下午',14],['eve','晚上',19]];
  const WINDOWS=DAYS.flatMap(([d])=>PERIODS.map(([p])=>d+'-'+p));
  const windowLabel=k=>{const [d,p]=String(k).split('-'),D=DAYS.find(x=>x[0]===d),P=PERIODS.find(x=>x[0]===p);return D&&P?D[1]+P[1]:'';};
  const COPY={
    title:'找几个人，一起打场球',
    sub:'日主相合、想法接近的同学，凑齐了就通知你。',
    waiting:'已登记。人还少，凑齐了才会通知你，不一定很快。',
    nudge:'把资料填完整，以后遇到和你五行相合的人，我们会推给你。',
    schoolNote:'学校信息为本人自填，未经认证。',
    entryTitle:'相合局：一起做件小事',
    entryLine:'先一起打场球、跑个步或吃顿饭，聊得来，再决定要不要深聊。',
    adult:'我已年满 18 周岁',
    consent:'同意相生在后台用我的日主和底线题答案判断谁适合同组，答案不会给任何人看。',
    safety:'只在公共或校园内的场所见面，不去私人住所，不参加酒局。费用由大家自己分摊，平台不收费、不租场地。'
  };
  return {ACTIVITIES,SYNONYMS,UNSAFE_ACTIVITY,DAYS,PERIODS,WINDOWS,windowLabel,COPY};
});
