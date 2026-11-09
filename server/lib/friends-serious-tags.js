'use strict';
// 认真相亲页 · 「我们在这些事上的想法」 (owner decision 2026-11-06, scope change).
// The owner may pick a few of their OWN marriage-questionnaire answers to show as short tags. Rules:
//  - Default: nothing shown. Only answers the owner actually gave can become a tag, and only tags the owner ticked are shown.
//  - Raw answers, notes, importance, scores and alignment numbers are never shown. Text questions offer no tag.
//  - Intimacy pace (pace-intimate / pace-touch, formerly bound-pace), professional-help and "not ready yet" answers never become tags (too sensitive for a page).
//  - Tags are re-derived from the current answers at every render: change the answer and the old tag disappears.
const BANK=require('../../assets/data/friends-marriage-questionnaire.json');

const DIMENSION_LABELS=Object.freeze({family:'婚育',finance:'消费观',future:'城市事业',conflict:'沟通',boundaries:'边界',relatives:'父母',history:'感情经历',self:'性格',leisure:'周末爱好',habits:'生活习惯'});
// questionId -> {optionValue: tag}. Scales use low (1–2) / high (4–5); the middle offers no tag.
const TAGS=Object.freeze({
  'family-marry-timing':{within1:'1年内结婚','1to3':'1-3年内结婚','3to5':'3-5年结婚',later:'5年后再结婚',nomarry:'暂不打算结婚',flow:'结婚看缘分'},
  'family-kids-wish':{want:'想要孩子',nokids:'不打算要孩子',together:'孩子一起商量'},
  'family-kids-timing':{soon:'婚后早要孩子',mid:'婚后3年要娃',late:'晚点要孩子',flow:'要娃顺其自然'},
  'family-chores':{half:'家务平分',skill:'家务按擅长分',outsource:'家务请人帮忙',trade:'家务分工互补'},
  'family-care':{low:'育儿一方为主',high:'育儿两人对半'},
  'finance-split':{joint:'共同账户',mixed:'各管各+共同基金',ratio:'按收入比例分担',aa:'大致AA'},
  'finance-style':{low:'先存后花',high:'重当下体验'},
  'finance-big':{small:'小额也商量',medium:'千元以上商量',month:'大额再商量',huge:'只商量大事'},
  'finance-parents':{own:'各管各家父母',shared:'两边父母一视同仁'},
  'finance-disclose':{early:'早聊存款负债',cohabit:'谈婚时聊财务',wedding:'婚前聊财务'},
  'future-city':{stay:'留在本城',home:'想回家乡',new:'想去新城市',open:'城市可调整'},
  'future-career':{low:'事业冲刺期',high:'生活节奏优先'},
  'future-distance':{no:'不接受异地',short:'短期异地可以',long:'可接受异地'},
  'future-plan':{preparing:'有大计划在准备',thinking:'有计划在考虑',none:'暂无大变动'},
  'conflict-first':{talk:'有事当面说开',cool:'先冷静再谈',write:'先写下来再说',wait:'希望对方先问'},
  'conflict-cooldown':{hours:'几小时内和好',day:'隔天再聊开',days:'两三天消化'},
  'conflict-heard':{listen:'先听我说完',comfort:'先安慰我',solve:'一起解决问题',space:'给我点空间',clear:'把话说清楚'},
  'conflict-repair':{low:'吵完翻篇就好',high:'吵完要说清楚'},
  'bound-contact':{anytime:'随时聊几句',daily:'每天聊一会',fewdays:'几天深聊一次'},
  'bound-privacy':{private:'手机各有隐私',open:'手机互相公开',partial:'手机部分透明'},
  'bound-others':{low:'对异性朋友放松',high:'在意单独见异性'},
  'rel-live':{apart:'和父母分开住',city:'和父母同城',together:'可和父母同住',care:'照顾老人再商量'},
  'rel-say':{low:'两人自己做主',high:'重视父母意见'},
  'rel-holiday':{alternate:'过年轮流两边',separate:'过年各回各家',gather:'两家一起过年'},
  'rel-friends':{low:'各自社交为主',high:'常一起见朋友'},
  'hist-share':{full:'过往可以坦诚聊',brief:'过往聊个大概',past:'过去的就过去'},
  'hist-support':{family:'难过找家人',friends:'难过找朋友',self:'自己消化情绪',hobby:'靠运动爱好'},
  'hist-ready':{high:'准备好认真了'},
  'self-energy':{low:'独处充电型',high:'社交充电型'},
  'self-stress':{space:'压力时要空间',listen:'压力时要陪伴',solve:'一起想办法',ask:'先问问我需要'},
  'self-decide':{low:'想清楚再行动',high:'先做再调整'},
  'self-care':{time:'陪伴最重要',words:'需要肯定的话',help:'行动派关心',gift:'喜欢小惊喜',touch:'喜欢拥抱'},
  'lei-weekend':{home:'周末宅家',outdoor:'周末户外运动',social:'周末约朋友',mix:'周末动静结合'},
  'lei-relax':{sport:'运动解压',show:'追剧看书',game:'打游戏',cook:'做饭',walk:'出门走走',chat:'找人聊天',sleep:'睡一觉解压'},
  'lei-together':{low:'爱好各有空间',high:'爱好尽量一起'},
  'lei-travel':{rare:'很少出远门',once:'一年旅行1-2次',several:'一年旅行好几次',often:'有空就去旅行'},
  'hab-sleep':{early:'早睡早起',normal:'作息正常偏晚',night:'夜猫子',irregular:'作息不规律'},
  'hab-tidy':{low:'家里随意点',high:'喜欢井井有条'},
  'hab-smoke':{none:'不抽烟不喝酒',social:'烟酒偶尔社交',often:'烟酒较经常'},
  'hab-pets':{want:'很想养宠物',ok:'能接受宠物',rather:'不太想养宠物',cannot:'不能养宠物'}
});
const QUESTIONS=new Map(BANK.dimensions.flatMap(d=>d.questions.map(q=>[q.id,{...q,dimensionId:d.id}])));
const ORDER=[...QUESTIONS.keys()];
const MAX_PICKED=24;
const keyOf=(qid,v)=>qid+':'+v;
const isKnownKey=k=>{if(typeof k!=='string')return false;const i=k.indexOf(':'),qid=k.slice(0,i),v=k.slice(i+1);return i>0&&Object.hasOwn(TAGS,qid)&&Object.hasOwn(TAGS[qid],v);};

// Every tag the owner COULD show, derived only from their own current answers. [{key,dimensionId,dimension,label}]
function availableTags(record){
  if(!record||record.version!==BANK.version&&!(BANK.upgradeFrom||[]).includes(record.version))return [];
  const out=[];
  for(const qid of ORDER){
    const q=QUESTIONS.get(qid),map=TAGS[qid];if(!map)continue;
    const a=record.dimensions?.[q.dimensionId]?.answers?.[qid];if(!a||a.state!=='answered')continue;
    const values=q.type==='multi'?(Array.isArray(a.value)?a.value:[]):q.type==='scale'?[Number(a.value)<=2?'low':Number(a.value)>=4?'high':null]:[a.value];
    for(const v of values)if(v!=null&&Object.hasOwn(map,v))out.push({key:keyOf(qid,v),dimensionId:q.dimensionId,dimension:DIMENSION_LABELS[q.dimensionId],label:map[v]});
  }
  return out;
}
// Ticked AND still backed by a current answer. This is the only path from questionnaire data to the page.
function pickedTags(record,picked){const want=new Set(Array.isArray(picked)?picked:[]);return availableTags(record).filter(t=>want.has(t.key));}
function normalizePicks(v){
  if(!Array.isArray(v)||v.length>MAX_PICKED||v.some(k=>!isKnownKey(k))){const e=Error('想法标签无效');e.status=400;throw e;}
  return [...new Set(v)];
}
module.exports={DIMENSION_LABELS,TAGS,MAX_PICKED,availableTags,pickedTags,normalizePicks,isKnownKey};
