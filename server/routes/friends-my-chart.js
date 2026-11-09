'use strict';
// 「我的命盘」路由：/api/friends/my-chart。只服务登录用户本人，所有读写都按 req.user.id 取，没有按他人 id 查询的入口。
// 付款不在这里：复用 /api/friends/compatibility/pay/*（type='mychart'），金额只取服务端配置。
const {errorBody:xbError}=require('../lib/friends-cross-border');
function createMyChartRouter({express,auth,service}){
 const router=express.Router();
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.use(auth);
 router.use((req,res,next)=>req.user?.id!==undefined?next():res.status(401).json({error:'请先登录'}));
 router.use((req,res,next)=>{if(req.method==='POST'){if(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'请从本站操作'});const origin=req.get('Origin');if(origin&&origin!==`${req.protocol}://${req.get('Host')}`)return res.status(403).json({error:'不允许跨站操作'});}next();});
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json(e.status?xbError(e):{error:'我的命盘暂时不可用，请稍后再试'});}};
 router.get('/',run(req=>service.view(req.user.id)));
 router.post('/gender',run(req=>service.setGender(req.user.id,req.body||{})));
 router.post('/eligibility',run(req=>service.eligibility(req.user.id,req.body||{})));
 router.post('/report',run(req=>service.createReport(req.user.id,req.body||{})));
 router.get('/report/:id',run(req=>service.getReport(req.user.id,req.params.id)));
 return router;
}
module.exports={createMyChartRouter};
