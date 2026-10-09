/* Minimal VS Code host mock: validates webview mounting and v1.0 -> v1.1 hydration. */
'use strict';
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const sent=[];let recv;let open;
const snapshot={version:'1.0.0',updatedAt:Date.now(),mode:'focus',timers:{focus:{endsAt:Date.now()+60000}},tasks:[{id:'old',text:'Legacy task',done:false}]};
const store={ 'masumChronos.snapshot.v1': snapshot };
const mock={
 Uri:{joinPath:(uri,...segments)=>({fsPath:path.join(uri.fsPath,...segments)})},
 StatusBarAlignment:{Right:1},ViewColumn:{One:1},
 window:{
   createStatusBarItem:()=>({text:'',tooltip:'',show(){},dispose(){}}),
   registerWebviewPanelSerializer:()=>({dispose(){}}),
   showInformationMessage:()=>Promise.resolve(),
   createWebviewPanel:()=>({
       webview:{options:{},asWebviewUri:uri=>({toString:()=>`vscode-resource:${uri.fsPath}`}),postMessage:async(msg)=>{sent.push(msg)} ,onDidReceiveMessage:fn=>{recv=fn;return {dispose(){}};}},
       onDidDispose:()=>({dispose(){}}),reveal(){}
   })
 },
 commands:{registerCommand:(id,fn)=>{if(id==='masumChronos.open') open=fn;return {dispose(){}};}}
};
const origLoad=Module._load;
Module._load=function(request,parent,isMain){if(request==='vscode')return mock;return origLoad.call(this,request,parent,isMain)};
const extension=require('../vscode/extension.js');
const ctx={extensionUri:{fsPath:root}, subscriptions:[],globalState:{get:k=>store[k],update:async(k,v)=>{store[k]=v}}};
(async()=>{
 try{
   extension.activate(ctx);
   assert.ok(open);
   open();
   assert.ok(recv);
   await recv({type:'ready'});
   assert.equal(sent[0].state.version,'1.0.0');
   const updated={...snapshot,version:'1.1.0',updatedAt:Date.now()+1000,workspace:'tasks'};
   await recv({type:'snapshot',state:updated});
   assert.equal(store['masumChronos.snapshot.v1'].version,'1.1.0');
   extension.deactivate();
   console.log('VS CODE: command, webview init, legacy hydration, new snapshot accepted');
 }catch(err){extension.deactivate();console.error(err);process.exitCode=1}
})();
