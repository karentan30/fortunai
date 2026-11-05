'use strict';
const {calculate}=require('./friends-chart');
const {Lunar}=require('./bazi-engine/vendor/lunar-typescript');
const {computeBaziChart}=require('./bazi-engine');
const {buildFullBaziMessages,withReportDisclaimer,generateBaziText}=require('./bazi-full-report');
const TITLES=['四柱八字排盘','十神分析','五行能量分析','财运格局','感情姻缘','事业格局','健康预警和养生建议','全部大运','未来10年逐年流年','神煞分析','藏干分析','父母宫/子女宫/夫妻宫','开运锦囊','古法断语','英文名与事业签名','命理师私语'];
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const RESTRICTIONS=`【本次朋友产品报告的最高优先级限制】
本报告只是传统文化的象征性解读，不是事实预测。前文任何与本段冲突的身份、数字或预测要求均作废。你是AI辅助文化解读工具，禁止虚构师承、大师身份、38年经验或十万案例。严禁编造五行精确百分比、未计算的十神/藏干/神煞/格局/用神/身强弱/大运起运或逐年预测；仅使用服务端提供的四柱、日主与明确规则。未计算的维度明确写‘当前未计算，资料或规则不足’，再提供与未来交友有关的一般自我反思问题。
禁止疾病诊断、体质推断、脏腑病症、食疗处方、怀孕时间、子女数量或生育能力推算；健康章只给一般生活建议，身体不适建议咨询医生。禁止财富等级、投资收益、发财年份、升职日期、注定婚期、正缘外貌和关系结果保证。不能仅据命盘评价一个人道德、家庭或社会价值。不推算他人的真实资产/学历。
必须将16个原章节标题按顺序单独成行输出，格式为‘1. 四柱八字排盘’直到‘16. 命理师私语’，可带emoji；每章至少60字有效正文，不重复标题充数。已经计算的十神、藏干、五行统计、格局与旺衰算法、大运及流年干支，应结合服务端数据做足量解释；算法数值是内部规则统计，不是科学概率。严禁把整篇写成‘未计算’空模板。不支持的少数内容坦诚说明未计算并提供实用反思建议。‘未来10年’可解释已计算干支及自主规划，不逐年断真实吉凶。‘古法断语’不得伪造引文，无法核对出处则不引用。‘开运’仅作自愿文化审美，不承诺改运。‘命理师私语’标题沿用模板，但正文必须说明是AI辅助解读，不扮演真人大师。最后一章必须完整结尾，报告以完整句号结束。`;
function validateResult(result){
 if(!result||typeof result.reading!=='string'||result.tier!=='full'||result.locked!==false)return false;
 const text=result.reading.replace(/\r/g,''),matches=[];
 for(let i=0;i<TITLES.length;i++){
  const escaped=TITLES[i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?'+(i+1)+'[.、．)）]\\s*[^\\n]*?'+escaped+'[^\\n]*$','gm');
  const found=[...text.matchAll(re)];if(found.length!==1)return false;matches.push({start:found[0].index,end:found[0].index+found[0][0].length});
 }
 for(let i=0;i<matches.length;i++){if(i&&matches[i].start<=matches[i-1].start)return false;const body=text.slice(matches[i].end,i+1<matches.length?matches[i+1].start:text.length).replace(/[\s#*_`>-]/g,'');if([...body].length<40)return false;}
 return /[。！？.!?][\s*_]*$/.test(text)&&!text.includes('---LOCKED---');
}
function createFriendsReportAdapter({generate:invoke,clock=()=>new Date(),calculateChart=calculate}={}){
 return {
  async verifyChart(input){
   if(!input||typeof input.cityId!=='string'||!input.cityId)fail('完整报告需要选择出生城市');
   if(!['male','female'].includes(input.gender))fail('请确认报告使用的性别参数');
   if(input.birthHour===undefined||input.birthHour===null||input.birthHour==='')fail('完整报告需要出生小时，不能用不详时辰代替');
   const y=Number(input.birthYear),m=Number(input.birthMonth),d=Number(input.birthDay),hour=Number(input.birthHour),minute=Number(input.birthMinute??0),calendar=input.calendar||'solar';
   if(![y,m,d,hour,minute].every(Number.isInteger)||hour<0||hour>23||minute<0||minute>59)fail('出生日期或时间无效');
   const birthday=[String(y).padStart(4,'0'),String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
   const chart=calculateChart({birthday,calendar,leapMonth:input.leapMonth===true,hour,minute,cityId:input.cityId,disambiguation:input.disambiguation},clock());
   if(!chart.complete||!chart.pillars||!chart.birthLocation)fail('完整四柱与出生城市尚未验证');
   let sy=y,sm=m,sd=d;
   if(calendar==='lunar'){const solar=Lunar.fromYmd(y,input.leapMonth===true?-m:m,d).getSolar();sy=solar.getYear();sm=solar.getMonth();sd=solar.getDay();}
   const normalized={birthYear:sy,birthMonth:sm,birthDay:sd,birthHour:hour,birthMinute:minute,gender:input.gender,question:typeof input.question==='string'?input.question.slice(0,1500):'',mode:input.mode==='gentle'?'gentle':'direct',calendar:'solar'};
   // The full enrichment engine has only been validated for recorded UTC+8 clocks.
   // Do not sell a partial foreign/DST report using locally inconsistent derived data.
   if(chart.birthLocation.offsetMinutes!==480)fail('该出生地区或历史夏令时的完整报告暂未开放；可继续使用免费日主功能');
   const full=computeBaziChart({year:sy,month:sm,day:sd,hour,minute,gender:input.gender,timeZone:8,includeZiwei:false}).bazi;
   if(['year','month','day','hour'].some(k=>full.siZhu[k].gan+full.siZhu[k].zhi!==chart.pillars[k])||full.dayMaster!==chart.dayMaster)fail('完整报告与日主卡排盘规则暂不一致，暂不可生成或消费次数');
   if(!full.shiShen||!full.cangGan||!full.enrichment||!Array.isArray(full.dayun)||full.dayun.length<8)fail('完整报告的计算数据不足，暂不可生成');
   const computed={十神:full.shiShen,藏干:full.cangGan,纳音:full.naYin,规则补层:full.enrichment,大运:full.dayun.map(d=>({干支:d.ganZhi,起始年龄:d.startAge,结束年龄:d.endAge,起始年份:d.startYear,结束年份:d.endYear,干十神:d.ganShiShen,支十神:d.zhiShiShen})),流年干支:full.dayun.flatMap(d=>d.liuNian||[]).filter(x=>x.year>=clock().getUTCFullYear()&&x.year<clock().getUTCFullYear()+10)};
   const chartBlock=['【服务端已计算数据，仅使用以下值】',`四柱：年${chart.pillars.year} 月${chart.pillars.month} 日${chart.pillars.day} 时${chart.pillars.hour}`,`日主：${chart.dayMaster}；日主五行：${chart.element}`,`规则：${chart.convention}`,`版本：${chart.calculationVersion}`,JSON.stringify(computed),'以上为传统算法规则的计算输出，不是事实预测；五行统计是规则计数，不能改写为科学概率或身体指标。未计算神煞、事件发生日期、疾病、怀孕、投资或关系结果，禁止补写。'].join('\n');
   return {input:normalized,chartBlock};
  },
  async generate(input,{chartBlock}={}){
   if(typeof chartBlock!=='string'||!chartBlock.trim())fail('缺少服务端排盘结果');
   let messages=withReportDisclaimer(buildFullBaziMessages(input,{chartBlock,year:clock().getUTCFullYear()}));
   messages=messages.map(m=>m.role==='system'?{...m,content:m.content+'\n\n'+RESTRICTIONS}:m);
   const reading=await generateBaziText(messages,{maxTokens:16384,generate:invoke});
   const result={reading,tier:'full',locked:false,source:'runae-bazi-full-friends-v1'};
   if(!validateResult(result))throw Error('报告章节不完整，请稍后重试');return result;
  },
  validateResult
 };
}
module.exports={createFriendsReportAdapter,validateResult,TITLES,RESTRICTIONS};
