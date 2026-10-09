/* VS Code extension ↔ authenticated loopback integration test. */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const commands = new Map(), posts = [], secure = {};
let receive, copied = '';
const vscode = {
  Uri:{joinPath:(uri,...parts)=>({fsPath:path.join(uri.fsPath,...parts)})},
  StatusBarAlignment:{Right:1},ViewColumn:{One:1},
  env:{clipboard:{writeText:async s=>{copied=s}}},
  commands:{registerCommand:(name,fn)=>{commands.set(name,fn);return {dispose(){}}}},
  window:{
    showInformationMessage:async()=>{},showWarningMessage:async()=>{},showErrorMessage:async()=>{},
    createStatusBarItem:()=>({text:'',show(){}}),registerWebviewPanelSerializer:()=>({dispose(){}}),
    createWebviewPanel:()=>({
      webview:{options:{},asWebviewUri:uri=>({toString:()=>`file:${uri.fsPath}`}),postMessage:async msg=>{posts.push(msg);return true},onDidReceiveMessage:handler=>{receive=handler;return{dispose(){}}}},
      onDidDispose:()=>({dispose(){}}),reveal(){}
    })
  }
};
const original = Module._load;
Module._load=function(id,parent,isMain){if(id==='vscode')return vscode;return original.call(this,id,parent,isMain)};
const extension = require('../vscode/extension');
const local = {};
const ctx={extensionUri:{fsPath:path.resolve(__dirname,'..')},subscriptions:[],globalState:{get:(k,v)=>local[k]??v,update:async(k,v)=>{local[k]=v}},secrets:{get:async k=>secure[k],store:async(k,v)=>{secure[k]=v}}};
function sync(tasks,key){
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify({tasks,deletedTasks:{}});
    const request=http.request({host:'127.0.0.1',port:46469,path:'/v1/sync',method:'POST',headers:{Origin:'https://gitwithmasum.github.io','X-Chronos-Key':key,'Content-Type':'application/json'}},r=>{
      let data='';r.on('data',d=>data+=d);r.on('end',()=>resolve({status:r.statusCode,result:JSON.parse(data)}));
    });request.on('error',reject);request.end(body);
  });
}
(async()=>{
  try{
    extension.activate(ctx);
    commands.get('masumChronos.open')();await receive({type:'ready'});
    await commands.get('masumChronos.startSync')();
    assert.match(copied,/^[a-f0-9]{64}$/);
    const now=Date.now();
    const task={id:'from-chrome',text:'Shared browser task',done:false,createdAt:now,modifiedAt:now,priority:'high',category:'Code',dueDate:''};
    const response=await sync([task],copied);
    assert.equal(response.status,200);
    assert.ok(posts.some(x=>x.type==='sync-tasks'&&x.payload.tasks.some(t=>t.id==='from-chrome')));
    assert.ok(local['masumChronos.snapshot.v1'].tasks.some(t=>t.id==='from-chrome'));
    await commands.get('masumChronos.stopSync')();
    extension.deactivate();
    console.log('VS CODE SYNC: start/copy pairing key, incoming Chrome task, persisted snapshot, webview broadcast and stop passed');
  }catch(err){extension.deactivate();console.error(err);process.exitCode=1;}
})();