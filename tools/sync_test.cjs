'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {SyncBridge,PORT}=require('../vscode/sync-bridge');
const key='a'.repeat(64),now=Date.now();
const make=(id,text,modifiedAt=Date.now())=>({id,text,createdAt:now-4000,modifiedAt,done:false,category:'Code',priority:'medium',dueDate:''});
function request({origin='https://gitwithmasum.github.io',auth=key,method='POST',body={tasks:[],deletedTasks:{}},host='127.0.0.1:46469'}={}) {
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:PORT,path:'/v1/sync',method,headers:{Host:host,Origin:origin,'X-Chronos-Key':auth,'Content-Type':'application/json'}},res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>resolve({status:res.statusCode,body:res.statusCode===200?JSON.parse(data):null,headers:res.headers}));});
  req.on('error',reject);req.end(method==='POST'?JSON.stringify(body):undefined);
 });
}
(async()=>{
 const server=new SyncBridge({key,initial:{tasks:[make('old','Legacy')]}});await server.start();
 try {
  assert.equal((await request({origin:'https://evil.test'})).status,403);
  assert.equal((await request({host:'localhost:46469'})).status,403);
  assert.equal((await request({auth:'b'.repeat(64)})).status,401);
  const pre=await request({method:'OPTIONS'});assert.equal(pre.status,204);assert.equal(pre.headers['access-control-allow-private-network'],'true');
  const add=await request({body:{tasks:[make('chrome','Added')],deletedTasks:{}}});assert.equal(add.body.tasks.length,2);
  const item=add.body.tasks.find(x=>x.id==='chrome');
  const edit=await request({body:{tasks:[make('chrome','Edited',item.modifiedAt+1000)],deletedTasks:{}}});assert.equal(edit.body.tasks.find(x=>x.id==='chrome').text,'Edited');
  const removed=await request({body:{tasks:[item],deletedTasks:{chrome:item.modifiedAt+2000}}});assert.equal(removed.body.tasks.some(x=>x.id==='chrome'),false);
  const stale=await request({body:{tasks:[item],deletedTasks:{}}});assert.equal(stale.body.tasks.some(x=>x.id==='chrome'),false);
  console.log('SYNC: merge, edit, tombstone, replay, key, Origin, Host and preflight passed');
 }finally{await server.stop();}
})().catch(e=>{console.error(e);process.exitCode=1});
