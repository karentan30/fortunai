'use strict';
// Demonstration-only exports. These never create profiles or enter discovery.
window.openFriendsSamplePreview = function(sample) {
  let dialog=document.getElementById('sample-export-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='sample-export-dialog';dialog.className='poster-gallery';document.body.append(dialog);}
  dialog.innerHTML='<div class="gallery-heading"><h2>一张分享图片示例</h2><button type="button" class="secondary" data-close>关闭</button></div><p>全部为虚构样例，用于设计评审。长按图片或逐张下载。</p><label>选择平台 <select id="sample-export-platform"><option value="xiaohongshu">小红书 · 1080 × 1440</option><option value="wechat">微信朋友圈 · 1080 × 1440</option><option value="douyin">抖音 · 1080 × 1920</option></select></label><div id="sample-export-images"></div>';
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  const draw=()=>{
    const platform=dialog.querySelector('select').value,h=platform==='douyin'?1920:1440;
    const target=dialog.querySelector('#sample-export-images');target.replaceChildren();
    for(let page=0;page<1;page++){
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=h;
      const ctx=canvas.getContext('2d'),off=h===1920?140:0;
      ctx.fillStyle='#f4f3e9';ctx.fillRect(0,0,1080,h);
      const text=(s,x,y,size=28,color='#2e4c38')=>{ctx.fillStyle=color;ctx.font=size+'px "Microsoft YaHei",sans-serif';ctx.fillText(s,x,y);};
      const fit=(s,max,size=28)=>{ctx.font=size+'px "Microsoft YaHei",sans-serif';while(ctx.measureText(s).width>max&&s.length>2)s=s.slice(0,-2)+'…';return s;};
      const wrap=(s,x,y,size,width,lines=3)=>{let row='',n=0;for(const c of s){ctx.font=size+'px "Microsoft YaHei",sans-serif';if(ctx.measureText(row+c).width>width){text(row,x,y+n*size*1.5,size);row='';if(++n>=lines)return;}row+=c;}if(row)text(row,x,y+n*size*1.5,size);};
      text('相生 · Runae',72,100+off,40);text('虚构样例 · 非真实用户',72,147+off,23);
      if(page===0){
        ctx.strokeStyle='#b7c5ad';ctx.lineWidth=2;ctx.strokeRect(790,205+off,210,250);
        text('本人照片',832,325+off,30);text('可选上传',840,370+off,23);
        text('我是'+sample.stem+sample.element,72,285+off,64);
        text(fit(sample.tags.join(' · '),650,28),72,350+off,28);
        text(fit('想认识 '+sample.target,650,31),72,418+off,31);
        const names=['','','','','','年收入','个人净资产','家庭资产'];
        const facts=[...sample.facts.slice(0,5),String(sample.facts[7]).replace(/\s*[/／]\s*年\s*$/,''),sample.facts[8],sample.familyAssets||'暂不提供'];
        facts.forEach((value,i)=>{const x=72+i%3*316,y=495+off+Math.floor(i/3)*155;ctx.fillStyle='#e6ebdb';ctx.fillRect(x,y,296,145);text(names[i],x+18,y+40,21,'#65735f');text(fit(value,260,30),x+18,y+(names[i]?103:84),30);});
        text('想一起  '+sample.dates.slice(0,2).map(item=>item[0]).join(' · '),72,1010+off,30);
        ctx.fillStyle='#e2e8d7';ctx.fillRect(72,h-300,936,195);
        text('输入你的生日，寻找五行互补的人。',96,h-244,33);
        text('出生日期与时间默认保密，不向对方展示。',96,h-188,25);
        text('虚构样例 · 正式入口另行配置，不展示假二维码',96,h-140,24);
      }else if(page===1){
        text('第一次见面，一起做点什么？',72,285+off,48);
        wrap(sample.sport,72,365+off,28,920,2);
        sample.dates.forEach(([name,detail],i)=>{const y=470+off+i*170;ctx.fillStyle='#e6ebdb';ctx.fillRect(72,y,936,145);text(String(i+1).padStart(2,'0')+'  '+name,96,y+50,36);wrap(detail,96,y+104,25,880,1);});
        text('先聊15分钟，再挑一个双方都喜欢的。',72,1240+off,29);
      }
      text('设计评审样例 · 学校收入资产均为虚构 · 五行不保证关系结果',72,h-65,20);
      const section=document.createElement('section'),image=document.createElement('img'),link=document.createElement('a');
      image.src=canvas.toDataURL('image/png');image.width=1080;image.height=h;image.style.width='100%';image.style.height='auto';image.alt='虚构示例 '+platform+' 第'+(page+1)+'张';
      link.href=image.src;link.download='Runae-虚构样例-'+platform+'-'+(page+1)+'-1080x'+h+'.png';link.className='secondary';link.textContent='保存第'+(page+1)+'张';section.append(image,link);target.append(section);
    }
  };
  dialog.querySelector('select').onchange=draw;draw();dialog.showModal();
};
