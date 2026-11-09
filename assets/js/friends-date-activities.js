'use strict';
// 相生 · 「约会除了吃饭喝咖啡，还想一起做什么」的固定选项。服务端校验与前端 chip 共用这一份（后续约会/运动页也从这里取）。
(function(root){
  const SPORTS=['羽毛球','乒乓球','网球','匹克球','篮球','足球','排球','游泳','跑步','骑行','徒步爬山','攀岩','飞盘','滑板','滑雪','健身','瑜伽','普拉提','舞蹈','拳击/搏击','高尔夫','台球','保龄球','桨板/皮划艇','露营'];
  const OTHERS=['看展','逛书店','桌游/剧本杀','手作','学乐器','拍照散步','志愿活动'];
  const api={DATE_ACTIVITY_GROUPS:[{label:'运动',items:SPORTS},{label:'其他',items:OTHERS}],DATE_ACTIVITIES:[...SPORTS,...OTHERS],DATE_ACTIVITY_MAX:8};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.XiangshengDateActivities=api;
})(typeof window!=='undefined'?window:globalThis);
