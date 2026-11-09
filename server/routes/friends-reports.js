'use strict';
const {errorBody:xbError}=require('../lib/friends-cross-border');
function createFriendsReportsRouter({express,auth,service}){
 const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});router.use(auth);
 router.use((req,res,next)=>req.user?.id!==undefined?next():res.status(401).json({error:'请先登录'}));
 router.use((req,res,next)=>{if(req.method==='POST'){if(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'请从本站操作'});const origin=req.get('Origin');if(origin&&origin!==`${req.protocol}://${req.get('Host')}`)return res.status(403).json({error:'不允许跨站操作'});}next();});
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json(e.status?xbError(e):{error:'报告服务暂不可用'});}};
 router.post('/',run(req=>service.create(req.user.id,req.body)));router.get('/',run(req=>({reports:service.list(req.user.id)})));router.get('/:id',run(req=>service.get(req.user.id,req.params.id)));return router;
}
module.exports={createFriendsReportsRouter};
