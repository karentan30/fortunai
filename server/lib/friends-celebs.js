'use strict';
// 明星日主库：只用公开的出生日期推算日主 / 星座 / 生肖。复用交友日主引擎（friends-chart.calculate），不另写历法。
// 时辰未知 → 按引擎约定取当日中午；只有公开资料写明生于 23:00–24:00（ziHour）才按 23 点换日，并在页面提示。
const {calculate}=require('./friends-chart');
const {Solar}=require('./bazi-engine/vendor/lunar-typescript');
const CATEGORIES=Object.freeze(['华语演员','华语歌手','导演','运动员','企业家','文化人物','国际明星']);
const STEMS=[...'甲乙丙丁戊己庚辛壬癸'];
const TONES={木:'wood',火:'fire',土:'earth',金:'metal',水:'water'};
const ELEMENTS=[...'木火土金水'];
// 每个日主一句说明：只复用 App 现有的五行关系句式（friends.js 样例卡 relation），不新增性格/命运断语。
function stemLine(stem){
  const i=Math.floor(STEMS.indexOf(stem)/2),el=ELEMENTS[i],mother=ELEMENTS[(i+4)%5],child=ELEMENTS[(i+1)%5];
  return `${stem}为${STEMS.indexOf(stem)%2?'阴':'阳'}${el}。传统五行里，${mother}生${el}，${el}生${child}。`;
}
function compute(person,now=new Date()){
  const chart=calculate({birthday:person.birthDate,calendar:'solar',...(person.ziHour?{time:'23:30'}:{})},now);
  const [y,m,d]=person.birthDate.split('-').map(Number);
  return {dayMaster:chart.dayMaster,element:chart.element,dayPillar:chart.dayPillar,
    constellation:Solar.fromYmd(y,m,d).getXingZuo()+'座',zodiac:chart.zodiac};
}
module.exports={CATEGORIES,STEMS,TONES,compute,stemLine};
