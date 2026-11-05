'use strict';
// Isolated browser-fixture server. Never starts production routes or reads user data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!/^\/(pages|assets)\//.test(pathname)){res.writeHead(404);res.end();return;}
    const file=path.resolve(root,'.'+pathname),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
    const data=await fs.promises.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
async function run(file,base){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(__dirname,file)],{cwd:root,env:{...process.env,FRIENDS_REVIEW_URL:base},stdio:'inherit',windowsHide:true});
    const timer=setTimeout(()=>{child.kill();reject(new Error(file+' exceeded 120 seconds'));},120000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(file+' exited '+code));});
  });
}
(async()=>{
  fs.mkdirSync(path.join(root,'.review'),{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{
    const base='http://127.0.0.1:'+server.address().port;
    await run('friends-share-preview.test.cjs',base);
    await run('friends-gallery.test.cjs',base);
    await run('friends-report-sample-browser.test.cjs',base);
    await run('friends-chat-browser.test.cjs',base);
    await run('friends-types-browser.test.cjs',base);
  }finally{server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
