'use strict';
(()=>{
 const save=document.getElementById('save-sample-card'),status=document.getElementById('sample-save-status'),preview=document.getElementById('sample-save-preview'),image=document.getElementById('sample-save-image');
 let objectUrl=null,busy=false;
 function revoke(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}}
 function makeCard(){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
  const c=canvas.getContext('2d');if(!c)throw Error('当前浏览器无法生成图片');
  const ink='#24392e',muted='#657468',paper='#f5f4ed',sage='#e7eddf',line='#dce2d6';
  function text(value,x,y,size=30,color=ink,weight=400){c.fillStyle=color;c.font=weight+' '+size+'px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';c.textBaseline='top';c.fillText(value,x,y);}
  function wrap(value,x,y,width,size=28,color=muted,lineHeight=44){c.fillStyle=color;c.font='400 '+size+'px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';c.textBaseline='top';let row='';for(const ch of value){if(c.measureText(row+ch).width>width&&row){c.fillText(row,x,y);y+=lineHeight;row=ch;}else row+=ch;}if(row)c.fillText(row,x,y);return y+lineHeight;}
  function box(x,y,w,h,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,20);c.fill();}
  c.fillStyle=paper;c.fillRect(0,0,1080,1440);
  text('相生',72,60,28,ink,700);text('匿名演示 · 非实时测算',690,66,23,muted);
  c.fillStyle=line;c.fillRect(72,116,936,2);
  text('你们之间，',72,164,64,ink,700);text('有怎样的相合关系？',72,250,64,ink,700);
  text('同一日主，不同命局。',76,350,32,muted);
  box(72,420,440,138,sage);box(568,420,440,138,sage);
  text('朋友 A · 戊土',100,448,36,ink,650);text('酉月 · 演示设定',100,503,25,muted);
  text('朋友 B · 戊土',596,448,36,ink,650);text('午月 · 演示设定',596,503,25,muted);
  text('两组跨盘六合关系',72,604,27,muted);
  box(72,656,440,174,'#fffef9');box(568,656,440,174,'#fffef9');
  text('午 ↔ 未',105,689,55,ink,700);text('午未相合',105,766,28,muted);
  text('卯 ↔ 戌',601,689,55,ink,700);text('卯戌相合',601,766,28,muted);
  box(72,868,936,151,'#f4ead6');text('也同时存在',100,892,26,muted);
  text('申亥相害 · 酉戌相害',100,943,40,ink,650);
  wrap('跨盘有合，不等于已经合化；有害，也不能直接判断不适合。未做喜用判断，不提供关系成功率。',76,1070,924,29,muted,46);
  c.fillStyle=line;c.fillRect(72,1207,936,2);
  text('查看双方八字分析',76,1242,36,ink,650);
  text('分别填写并授权，了解相合依据与命局差异。',76,1298,26,muted);
  text('这是预设组合样例，不是你的测算结果。',76,1362,22,muted);
  return canvas;
 }
 async function exportCard(){
  if(busy)return;busy=true;save.disabled=true;status.textContent='正在生成示例图片…';
  try{
   if(document.fonts?.ready)await document.fonts.ready;
   const canvas=makeCard(),blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('图片未生成，请重试')),'image/png'));
   revoke();objectUrl=URL.createObjectURL(blob);image.src=objectUrl;preview.hidden=false;
   const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download='相生-两个合-演示分享卡.png';document.body.append(anchor);anchor.click();anchor.remove();
   status.textContent='示例图片已生成。若未下载，请长按下方图片保存。';
  }catch(error){status.textContent=error.message||'保存失败，请稍后重试';}finally{busy=false;save.disabled=false;}
 }
 save.addEventListener('click',exportCard);
 document.getElementById('print-report').addEventListener('click',()=>window.print());
 window.addEventListener('pagehide',()=>{revoke();image.removeAttribute('src');preview.hidden=true;});
})();
