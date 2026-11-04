'use strict';
const $ = s => document.querySelector(s);
const extraStyle=document.createElement('link');extraStyle.rel='stylesheet';extraStyle.href='entry.css';document.head.append(extraStyle);
const dialog = $('#dialog');
const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const elements = ['阳木','阴木','阳火','阴火','阳土','阴土','阳金','阴金','阳水','阴水'];
let profile = {name:'小满（虚构示例）',city:'北京',intent:'找对象 · 以结婚为目标',stem:'戊',bio:'希望长期在北京生活，期待认真稳定的关系。以下学校、收入及家庭条件均为虚构展示。',wish:'周六打一场羽毛球，再一起体验陶艺。',interests:'羽毛球、滑雪、陶艺',height:'173',weight:'68',school:'清华大学',degree:'硕士 · 计算机',company:'某科技公司（隐去全称）',job:'产品负责人 · 私企',income:'50—80万元 · 税前',assets:'家庭净资产1000—3000万元 · 非个人资产',house:'本人名下北京一套 · 有贷款',car:'本人名下有车',mbti:'ENTP',zodiac:'天秤座',highlight:'清华硕士｜海外生活经历｜滑雪与羽毛球爱好者'};
const origins = {};
profile.assetLevel='A8';
profile.wantedStem='丁';
let toastTimer;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('on'),3500);}
function modal(html){$('#dialog-body').innerHTML=html;dialog.showModal();}
$('#close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function switchTab(tab){$('#card-view').hidden=tab!=='card';$('#invite-view').hidden=tab!=='invite';$('#edit').hidden=tab!=='card';$('#view-label').textContent=tab==='card'?'我的分享卡':'私密约会邀请';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#invite-from-card').onclick=()=>switchTab('invite');
function facts(){return [profile.height&&`${profile.height}cm`,profile.weight&&`${profile.weight}kg`,profile.zodiac,profile.mbti,profile.school,profile.degree,profile.company,profile.job,profile.income&&`年收入：${profile.income}（本人填写）`,profile.assets&&`资产：${profile.assets}（本人填写，未核验）`,profile.house&&`房产：${profile.house}`,profile.car&&`车辆：${profile.car}`].filter(Boolean);}
function render(){
 $('#card-name').textContent=profile.name;$('#card-city').textContent=profile.city;$('#card-stem').textContent=profile.stem;
 $('#card-element').textContent=elements[stems.indexOf(profile.stem)]+' · 日主是认识的起点';
 let preference=$('#card-preference');if(!preference){preference=document.createElement('div');preference.id='card-preference';$('.element-art').after(preference);}preference.textContent=profile.wantedStem?`我是${profile.stem}${elements[stems.indexOf(profile.stem)].slice(1)}，想认识${profile.wantedStem}${elements[stems.indexOf(profile.wantedStem)]?.slice(1)||''}的你。`:'';preference.hidden=!profile.wantedStem;
 $('#card-headline').textContent=profile.intent;$('#card-bio').textContent=profile.bio;$('#card-wish').textContent=profile.wish;
 $('.card-edition').textContent=profile.city+' · '+profile.intent.split(' · ')[0];
 let detail=$('#card-facts');if(!detail){detail=document.createElement('div');detail.id='card-facts';$('#card-bio').before(detail);}detail.replaceChildren();
 const groups=[['基本信息',[profile.height&&profile.height+'cm',profile.weight&&profile.weight+'kg',profile.zodiac,profile.mbti].filter(Boolean).join(' · ')],['学校学历',[profile.school,profile.degree].filter(Boolean).join(' · ')],['单位 / 工作',[profile.company,profile.job].filter(Boolean).join(' · ')],['年收入',profile.income],['家庭 / 个人资产',profile.assets],['房产',profile.house],['车辆',profile.car]];
 groups.splice(4,0,['资产等级',profile.assetLevel&&profile.assetLevel+' · 自填，未核验（归属及金额见下）']);
 for(const[label,value]of groups){if(!value)continue;const row=document.createElement('div');row.className='fact-row';const dt=document.createElement('span');dt.textContent=label;const dd=document.createElement('strong');dd.textContent=value;row.append(dt,dd);detail.append(row);}
 let highlight=$('#card-highlight');if(!highlight){highlight=document.createElement('div');highlight.id='card-highlight';$('#card-headline').after(highlight);}highlight.textContent=profile.highlight;highlight.hidden=!profile.highlight;
 $('#card-interests').replaceChildren(...profile.interests.split(/[、,，]/).filter(Boolean).slice(0,8).map(t=>{const s=document.createElement('span');s.textContent=t.trim();return s;}));
}
const fields=[['name','昵称'],['city','城市'],['height','身高（cm）'],['weight','体重（kg）'],['school','毕业学校'],['degree','学历 / 专业'],['company','工作单位（可填模糊名称）'],['job','岗位 / 编制、私企等'],['income','税前年收入区间'],['assets','资产区间及口径（如家庭净资产1000—3000万元）'],['house','房产归属、城市及贷款情况'],['car','车辆情况'],['mbti','MBTI（选填）'],['zodiac','星座（可自动填写或修改）'],['highlight','最想展示的亮点（本人确认）'],['bio','关于我'],['interests','兴趣，用顿号分隔'],['wish','想一起做的事']];
function edit(){modal(`<h2>让别人看见你的亮点</h2><p class="tiny">以下内容会出现在分享卡。可以留空；学校不代表智力，资产需区分个人与家庭。未接认证。</p><form id="profile-form"><label class="form-label">我想<select name="intent"><option>找对象 · 以结婚为目标</option><option>找对象 · 认真恋爱</option><option>找搭子 · 一起体验新活动</option></select></label>${fields.map(([k,t])=>`<label class="form-label">${t}<input name="${k}" maxlength="${k==='bio'?180:90}" value="${escapeHtml(profile[k])}" ${['name','city'].includes(k)?'required':''}></label>`).join('')}<label class="check"><input type="checkbox" required>我确认这些内容可以展示在我的卡片上。</label><label class="check"><input type="checkbox" name="matching">我愿意加入交友匹配（本地仅演示，不实际提交）</label><button class="primary">预览我的分享卡</button></form>`);const f=$('#profile-form');f.elements.intent.value=profile.intent;f.onsubmit=e=>{e.preventDefault();for(const[k]of fields)profile[k]=f.elements[k].value.trim();profile.intent=f.elements.intent.value;render();dialog.close();toast('预览已更新；尚未发布或加入真实用户池');};}
fields.splice(10,0,['assetLevel','资产标签（如A8、A9，需同时填写归属及金额区间）']);
fields.splice(2,0,['wantedStem','想认识的日主（选填一个天干，如丁；是个人偏好）']);
$('#edit').onclick=edit;
// 复用 karentan30/fortunai server/bazi.js 的 getDayGanZhi 算法。
// 只提取日柱；完整四柱、真太阳时与合盘未在此原型接入。
function dayGanZhi(year,month,day){let y=year,m=month;if(m<=2){y--;m+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);const JD=Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+day+B-1524.5;const i=((Math.floor((JD+50)%60)%60)+60)%60;return {stem:stems[i%10],branch:[...'子丑寅卯辰巳午未申酉戌亥'][i%12]};}
function zodiac(month,day){const limits=[20,19,21,20,21,22,23,23,23,24,23,22],names=['摩羯座','水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座'];return names[month-1+(day>=limits[month-1]?1:0)];}
$('#create').onclick=()=>{modal(`<h2>查日主，创建我的卡</h2><p>生辰不出现在公开卡片上。</p><form id="birth-form"><label class="form-label">公历出生日期<input type="date" name="birth" min="1900-01-01" required></label><p class="tiny">本地复用现有仓库日柱算法，按北京时间、公历日期简算。不支持农历转换；临近午夜、境外出生或需要校时的情况应进一步核对。完整合盘尚未接入。</p><label class="check"><input type="checkbox" required>我已满18周岁，同意在本页面计算出生日期；不因此加入交友匹配。</label><button class="primary">免费查看日主</button></form>`);const now=new Date();now.setFullYear(now.getFullYear()-18);$('#birth-form').elements.birth.max=now.toISOString().slice(0,10);$('#birth-form').onsubmit=e=>{e.preventDefault();const[y,m,d]=$('#birth-form').elements.birth.value.split('-').map(Number);const result=dayGanZhi(y,m,d);profile.stem=result.stem;profile.zodiac=zodiac(m,d);render();modal(`<h2>你的日主是 ${result.stem}</h2><p>日柱：${result.stem}${result.branch} · ${elements[stems.indexOf(result.stem)]}</p><p class="notice">日主不能单独判断两个人适不适合。此结果为传统文化参考，不是完整合盘。</p><p class="tiny">出生日期未保存。接下来由你选择卡片上公开哪些资料。</p><button id="complete-profile" class="primary">填写亮点，预览我的卡</button>`);$('#complete-profile').onclick=()=>{dialog.close();edit();};};};
$('#meet').onclick=()=>{modal(`<h2>我想认识TA</h2><p>真实上线后，会由对方决定是否接受申请。</p><form id="interest-form"><label class="form-label">昵称<input required maxlength="30"></label><label class="form-label">想认识TA的原因<textarea required maxlength="300"></textarea></label><label class="check"><input type="checkbox" required>我已成年，愿意提交认识申请。</label><p class="tiny">这是本地演示，不上传信息，也不会向任何人发送消息。</p><button class="primary">预览下一步</button></form>`);$('#interest-form').onsubmit=e=>{e.preventDefault();modal('<h2>下一步：等待双方确认</h2><p>真实服务会先征求双方同意，再邀请合盘或安排15分钟语音。</p><p class="notice">本次没有提交申请或发送消息。</p>');};};
function shareText(){return [`${profile.city}｜${profile.intent}`,`${profile.name}｜${profile.stem}日主`,$('#card-preference')?.textContent,profile.assetLevel&&`资产标签：${profile.assetLevel}（自填，归属及金额见下）`,...facts(),profile.highlight,profile.bio,`想一起：${profile.wish}`,'日主为传统文化参考，寻找某日主是个人偏好。'].filter(Boolean).join('\n');}
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(shareText());toast('分享文案已复制');}catch{modal('<h2>复制分享文案</h2><textarea id="copy-text" rows="12" style="width:100%"></textarea>');$('#copy-text').value=shareText();$('#copy-text').select();}};
$('#download').onclick=()=>{
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=2600;const c=canvas.getContext('2d');c.fillStyle='#f8f6ed';c.fillRect(0,0,1080,2600);c.strokeStyle='#b7c1ac';c.strokeRect(35,35,1010,2530);c.fillStyle='#345a46';
 function write(text,size,x,y){c.font=`${size}px "Microsoft YaHei", sans-serif`;c.fillText(text,x,y);}
 write('runae.  相遇有迹',40,90,130);write(profile.city+' · '+profile.intent.split(' · ')[0],28,90,190);
 c.strokeStyle='#c5cbb8';for(let i=0;i<3;i++){c.beginPath();c.ellipse(540,450,300,155,i*Math.PI/3,0,Math.PI*2);c.stroke();}write(profile.stem,170,455,505);write(elements[stems.indexOf(profile.stem)]+' · MY DAY MASTER',25,340,645);
 let y=750;function wrap(t,size){c.font=`${size}px "Microsoft YaHei", sans-serif`;let line='';for(const char of t){if(c.measureText(line+char).width>890){c.fillText(line,90,y);y+=size*1.65;line='';}line+=char;}if(line){c.fillText(line,90,y);y+=size*1.65;}}
 wrap(profile.name+'｜'+profile.intent,40);for(const t of [$('#card-preference').textContent,profile.highlight,...facts(),profile.assetLevel&&'资产等级：'+profile.assetLevel+' · 自填，未核验',profile.bio,'想一起：'+profile.wish,'先合盘，再聊聊，合意再见面','查我的日主，生成交友卡 · 邀请TA合盘'].filter(Boolean)){if(y>2380)break;wrap(t.slice(0,140),28);y+=16;}
 c.fillStyle='#6b7865';write('本地预览 · 信息本人填写，未核验 · 尚未发布',21,90,2480);write('日主为传统文化参考，不保证关系结果。',21,90,2525);
 canvas.toBlob(blob=>{if(!blob){toast('图片生成失败，请重试');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Runae-我的交友分享卡.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('已生成分享图片，请在下载文件中查看');},'image/png');
};
document.querySelectorAll('[data-origin]').forEach(b=>b.onclick=()=>{const role=b.dataset.origin;modal(`<h2>${role==='self'?'我的':'受邀方的'}出发位置</h2><form id="origin-form"><label class="form-label">附近地铁站或商圈<input name="area" required maxlength="80" placeholder="不用填写门牌号"></label><label class="form-label">出行方式<select name="mode"><option>公共交通</option><option>驾车</option><option>步行</option></select></label><p class="tiny">本地模拟双方填写，刷新清空。正式版需由服务器隔离双方位置，本原型不提供真实的多用户隐私保护。</p><button class="primary">保存本次演示位置</button></form>`);$('#origin-form').onsubmit=e=>{e.preventDefault();origins[role]={area:$('#origin-form').elements.area.value,mode:$('#origin-form').elements.mode.value};$(`#${role}-status`).textContent='已填写（模拟）';dialog.close();toast('已保留在当前页面内存中');};});
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>b.classList.toggle('on'));
$('#plans').onclick=()=>{if(!origins.self||!origins.other){toast('请先模拟填写双方的出发位置');return;}const kinds=[...document.querySelectorAll('[data-kind].on')].map(b=>b.dataset.kind);if(!kinds.length){toast('至少选择一种想一起做的事');return;}$('#recommendations').innerHTML='<p class="notice">以下为方案展示示例，未根据输入位置计算，也不是实际商家。正式版将按双方通勤时间推荐5家。</p>'+kinds.slice(0,5).map((k,i)=>`<article class="result-card"><span class="tag">方案示例 ${i+1}</span><h3>一起体验${escapeHtml(k)}</h3><p>${escapeHtml($('#date').value)} · 预算偏好 ${escapeHtml($('#budget').value)}</p><p class="route">双方路程：待接入路线计算<br>场馆、实际价格与可订时间：待核实</p><button class="secondary" data-plan="${i}">看看确认流程</button></article>`).join('');document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>modal('<h2>两个人都同意，再安排</h2><p>选择方案 → 对方确认 → 核实商家时间与报价 → 双方确认费用 → 预约。</p><p class="notice">当前没有发送邀请、下单或预订。正式预约需以商家确认结果为准。</p>'));$('#recommendations').scrollIntoView({behavior:'smooth',block:'start'});};
const entry=document.createElement('div');entry.className='entry-panel';entry.innerHTML='<span class="small-label">先了解条件，再决定认识</span><h2>你的亮点，应该被看见。</h2><p>学校学历 · 工作收入 · 身高体重 · 家庭与房车<br>日主 / 星座 / MBTI · 想一起做的事</p><div><button id="start-card" class="primary">查日主，做我的卡</button><button id="start-pair" class="secondary">已有心仪的人？邀请合盘</button></div><small>下方均为虚构示例，资产和学校未经认证。</small>';
$('#card-view').prepend(entry);$('#start-card').onclick=()=>$('#create').click();$('#start-pair').onclick=()=>modal('<h2>邀请TA，先合盘再见面</h2><p>你填写生辰 → 创建专属邀请 → 对方分别填写并授权 → 查看传统合盘解读 → 决定是否语音、见面。</p><p class="notice">完整生辰不公开；学校、收入等条件由本人选择展示。受邀者可以只合盘，不加入交友池。</p><p>网页上线并接入双人数据隔离后，才能生成真正可转发的邀请链接。</p><p class="tiny">当前原型未连接合盘服务，不会生成虚假匹配分数或发送邀请。</p>');
const note=document.createElement('p');note.className='profile-note';note.textContent='虚构人物与条件，仅供展示 · 个人和家庭资产分开填写 · 未核验';$('#card-facts')?.after(note);
render();
const avatarNote=document.createElement('span');avatarNote.className='avatar-note';avatarNote.textContent='AI动物分身示例 · 非真人照片';$('.identity').after(avatarNote);
const headline=$('#card-headline');const intention=document.createElement('div');intention.className='poster-intention';intention.textContent='先合盘，再聊聊，合意再见面';headline.after(intention);
const footer=$('.card-footer');footer.replaceChildren();
const callout=document.createElement('strong');callout.textContent='想找五行互补的搭子或对象？';
const second=document.createElement('span');second.textContent='输入你的出生信息，查日主，生成你的交友卡。';
const pairPrompt=document.createElement('span');pairPrompt.textContent='已有心仪的人？邀请TA一起合盘。';
const privacy=document.createElement('span');privacy.className='card-disclaimer';privacy.textContent='生辰、家庭住址不公开 · 双方同意后再联系';
const disclaimer=document.createElement('span');disclaimer.className='card-disclaimer';disclaimer.textContent='传统文化参考，不保证关系结果 · 本地原型，未上线';footer.append(callout,second,pairPrompt,privacy,disclaimer);
if(!note.isConnected)$('#card-facts').after(note);
if(new URLSearchParams(location.search).has('poster')){const style=document.createElement('style');style.textContent='body{display:block;padding:16px;background:#eff0ea}.intro,.side-note,.workspace-head,.entry-panel,.public-actions,.owner-actions,.preview-foot,#invite-view{display:none!important}.work{width:408px;max-width:none;margin:0 auto}.share-card{box-shadow:none}';document.head.append(style);}
