'use strict';
const {createFriendsQuestionsService}=require('../lib/friends-questions');
function createFriendsQuestionsRouter({express,auth,store}={}){
 const router=express.Router(),service=createFriendsQuestionsService({store});
 router.use(auth,(req,res,next)=>{res.set('Cache-Control','no-store');if(req.user?.id===undefined||req.user.id===null)return res.status(401).json({error:'请先登录'});next();});
 router.use((req,res,next)=>{if(['PUT','DELETE'].includes(req.method)&&(!req.is('application/json')||req.get('X-Runae-Friends')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==`${req.protocol}://${req.get('Host')}`)))return res.status(403).json({error:'请从本站操作'});next();});
 const handle=fn=>(req,res)=>{try{res.json(fn(req));}catch(error){res.status(error.status||503).json({error:error.status?error.message:'问卷暂时无法读取或保存'});}};
 router.get('/',handle(req=>service.get(req.user.id)));
 router.put('/',handle(req=>service.save(req.user.id,req.body)));
 router.delete('/',handle(req=>service.remove(req.user.id)));
 return router;
}
module.exports={createFriendsQuestionsRouter};
