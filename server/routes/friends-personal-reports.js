'use strict';
const crypto=require('node:crypto');
function createPersonalReportsRouter({express,auth,store,billing,env=process.env,adapter}={}){
 const router=express.Router();
 const enabled=env.FRIENDS_REPORTS_ENABLED==='true';
 router.get('/status',(req,res)=>res.set('Cache-Control','no-store').json({enabled,description:'本人传统文化报告；原始出生输入仅用于本次生成，报告结果加密保存。'}));
 if(!enabled){
   const {reportView}=require('../lib/friends-reports');
   router.use(auth,(req,res,next)=>req.user?.id!==undefined?next():res.status(401).json({error:'请先登录'}));
   router.get('/',(req,res)=>res.set('Cache-Control','no-store').json({reports:(store.read().personalReportJobs||[]).filter(j=>j.userId===req.user.id).map(reportView)}));
   router.get('/:id',(req,res)=>{const j=(store.read().personalReportJobs||[]).find(j=>j.id===req.params.id&&j.userId===req.user.id);res.set('Cache-Control','no-store');return j?res.json(reportView(j)):res.status(404).json({error:'报告不存在'});});
   router.use((req,res)=>res.status(503).json({error:'报告生成尚未开放，暂不消耗报告次数'}));return router;
 }
 if(typeof env.FRIENDS_SIGNING_KEY!=='string'||env.FRIENDS_SIGNING_KEY.length<32)throw Error('报告哈希配置缺失');
 const {createFriendsReportsService}=require('../lib/friends-reports');
 const {createFriendsReportAdapter}=require('../lib/friends-report-adapter');
 const {createFriendsReportsRouter}=require('./friends-reports');
 const selected=adapter||createFriendsReportAdapter();
 const inputHashKey=crypto.createHmac('sha256',env.FRIENDS_SIGNING_KEY).update('friends-report-input-v1').digest('hex');
 const service=createFriendsReportsService({store,billing,inputHashKey,...selected});
 router.use(createFriendsReportsRouter({express,auth,service}));return router;
}
module.exports={createPersonalReportsRouter};
