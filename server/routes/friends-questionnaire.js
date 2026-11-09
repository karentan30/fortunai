'use strict';
const {errorBody:xbError}=require('../lib/friends-cross-border');
const {createFriendsQuestionnaireService}=require('../lib/friends-questionnaire');
// 认真结婚十方向问卷 API（挂载在 /api/friends/questionnaire）。全部需要登录；谁能看到哪些答案见 lib/friends-questionnaire.js 顶部规则。访客拿不到任何答案。
function createFriendsQuestionnaireRouter({express,auth,store,service=createFriendsQuestionnaireService({store})}={}){
 const router=express.Router();
 router.use(auth,(req,res,next)=>{res.set('Cache-Control','no-store');if(req.user?.id===undefined||req.user.id===null)return res.status(401).json({error:'请先登录'});next();});
 router.use((req,res,next)=>{if(['PUT','POST','DELETE'].includes(req.method)&&(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==`${req.protocol}://${req.get('Host')}`)))return res.status(403).json({error:'请从本站操作'});next();});
 const handle=fn=>(req,res)=>{try{res.json(fn(req));}catch(error){res.status(error.status||503).json(error.status?xbError(error):{error:'问卷暂时无法读取或保存'});}};
 router.get('/',handle(req=>service.get(req.user.id)));
 router.put('/dimensions/:dimensionId',handle(req=>service.saveDimension(req.user.id,req.params.dimensionId,req.body)));
 router.put('/matching',handle(req=>service.setMatching(req.user.id,req.body)));
 router.put('/visibility',handle(req=>service.setVisibility(req.user.id,req.body)));
 // 交友详情页：按新规则（底线题填了才能看 / 深入话题互相认识后可见 / 敏感题默认仅自己）能看到的答案。
 router.get('/members/:shareId',handle(req=>service.member(req.user.id,req.params.shareId)));
 router.get('/peers',handle(req=>service.peers(req.user.id)));
 router.put('/shares/:shareId',handle(req=>service.setShare(req.user.id,req.params.shareId,req.body)));
 router.get('/shares/:shareId',handle(req=>service.shared(req.user.id,req.params.shareId)));
 router.delete('/',handle(req=>service.remove(req.user.id)));
 return router;
}
module.exports={createFriendsQuestionnaireRouter};
