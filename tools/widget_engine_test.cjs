'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const core=require('../web/widgets/widget-core.js');
const names=['focus','countdown','tasks','stats'];
assert.deepEqual(core.TYPES,names);
assert.equal(core.options('?type=tasks&theme=black-gold&size=compact').theme,'black-gold');
assert.equal(core.options('?type=invalid&theme=unknown&size=huge&minutes=999').type,'focus');
assert.equal(core.options('?type=invalid&theme=unknown&size=huge&minutes=999').minutes,25);
assert.equal(core.options('?type=focus&minutes=15').minutes,15);
assert.equal(core.options('?source=host&hostOrigin=https://nova.example/path').hostOrigin,'https://nova.example');
assert.equal(core.options('?source=host&hostOrigin=javascript:alert(1)').hostOrigin,'');
assert.equal(core.options('?source=host').source,'host');
const bad=core.snapshot({tasks:[
 {id:'ok',text:'<img src=x onerror=alert(1)>',done:false},
 {text:'   ',done:true},{id:'x',text:'Complete project',done:true}
],stats:{sessions:5,focusSeconds:1500}});
assert.equal(bad.tasks.length,2);
assert.equal(bad.tasks[0].text,'<img src=x onerror=alert(1)>');
assert.equal(core.progress(bad).percentage,50);
assert.equal(core.progress(bad).focusMinutes,25);
assert.equal(core.format(3700),'1:01:40');
assert.equal(core.format(25),'00:25');
assert.equal(core.remaining({endsAt:5000,durationSeconds:60,remainingSeconds:60},1000),4);
assert.equal(core.remaining({endsAt:5000,durationSeconds:60,remainingSeconds:60},10000),0);
const legacy=core.restore({version:1,tasks:[{id:'t',text:'Past job'}],stats:{sessions:2,focusSeconds:600}});
assert.equal(legacy.tasks[0].text,'Past job');
assert.equal(legacy.stats.sessions,2);
assert.equal(legacy.focus.remainingSeconds,1500);
assert.equal(core.restore({version:999,tasks:[{text:'MUST NOT LOAD'}]}).tasks.length,0);
for(const f of ['widget.html','widget.css','widget.js','widget-core.js','chronos-widgets.js','studio.html','studio.css','studio.js'])
 assert(fs.existsSync(path.join(root,'web/widgets',f)),f+' is missing');
const frame=read('web/widgets/widget.html'),main=read('web/index.html'),index=read('index.html');
for(const id of ['cw-timer-panel','cw-tasks-panel','cw-stats-panel','cw-toggle','cw-task-form','cw-stat-minutes','cw-task-list'])
 assert(frame.includes('id="'+id+'"'),id+' missing');
assert(frame.includes('connect-src &#39;none&#39;')||frame.includes("connect-src 'none'"),'widget CSP must deny network');
for(const app of [main,index]){
 assert(app.includes('widget-engine-launch')&&app.includes('web/widgets/studio.html'),'Main app must link the studio');
 assert(app.includes('V2.4 BETA'),'Main app version label missing');
}
for(const f of ['widget.js','chronos-widgets.js','studio.js'])new Function(read('web/widgets/'+f));
const widgetCode=read('web/widgets/widget.js');
assert(!widgetCode.includes('innerHTML'),'Widget runtime must use textContent for host strings');
assert(!widgetCode.includes('masum-chronos-v1'),'Widget must never read main Chronos storage key');
assert(widgetCode.includes("event.source!==window.parent||event.origin!==config.hostOrigin"),
 'Host messages must check direct parent and exact origin');
assert(widgetCode.includes("config.source==='host' ? (supplied||core.snapshot({})) : local"),
 'Host mode must not fall back to local private widget data');
assert(widgetCode.includes('setTimeout(stopChime,10000)'),'Chime must automatically stop at 10 seconds');
// Check loader uses a real HTTPS iframe URL and direct, opt-in message delivery.
const scriptURL='https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js';
const parent={children:[],appendChild(x){this.children.push(x);}};
let frameLoad=null,sent=[],removed=false;
const win={location:{origin:'https://novastudy.example'}};
const doc={
 currentScript:{src:scriptURL},
 querySelector(selector){return selector==='#host'?parent:null;},
 createElement(tag){
  assert.equal(tag,'iframe');
  return {
   style:{},setAttribute(){},addEventListener(type,cb){if(type==='load')frameLoad=cb;},
   contentWindow:{postMessage(data,target){sent.push({data,target});}},
   remove(){removed=true;}
  };
 }
};
vm.runInNewContext(read('web/widgets/chronos-widgets.js'),{window:win,location:win.location,document:doc,URL,URLSearchParams,Number,Array,Object,TypeError,JSON},{timeout:1000});
assert.equal(typeof win.ChronosWidgets.mount,'function');
const handle=win.ChronosWidgets.mount('#host',{type:'tasks',theme:'black-gold',size:'compact',source:'host',data:bad});
assert(parent.children.length===1);
const mounted=new URL(handle.iframe.src);
assert.equal(mounted.pathname,'/Masum-Chronos/web/widgets/widget.html');
assert.equal(mounted.searchParams.get('hostOrigin'),'https://novastudy.example');
assert.equal(mounted.searchParams.get('type'),'tasks');
assert.equal(mounted.searchParams.get('theme'),'black-gold');
assert.equal(mounted.searchParams.get('size'),'compact');
assert.equal(sent.length,0,'Host snapshot must wait until iframe is loaded');
frameLoad();
assert.equal(sent.length,1);
assert.equal(sent[0].target,'https://gitwithmasum.github.io');
assert.equal(sent[0].data.type,'chronos:widget:data');
assert.equal(handle.update({tasks:[],stats:{sessions:0,focusSeconds:0}}),true);
assert.equal(sent.length,2);
assert.equal(handle.update({big:'x'.repeat(65000)}),false);
assert.equal(sent.length,2);
handle.destroy();assert.equal(removed,true);
const local=win.ChronosWidgets.mount('#host',{type:'countdown',theme:'malicious',minutes:181});
assert.equal(new URL(local.iframe.src).searchParams.get('source'),'local');
assert.equal(new URL(local.iframe.src).searchParams.get('theme'),'nebula');
assert.equal(local.update({tasks:bad.tasks}),false);
// Simulate hostile parent origin and confirm the iframe ignores its data.
const elements=new Map();
function element(){
 return {children:[],style:{setProperty(){}},dataset:{},hidden:false,value:'',
  append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},
  addEventListener(name,cb){this['on'+name]=cb;},setAttribute(){},
  focus(){},classList:{add(){}}};
}
for(const match of frame.matchAll(/id="(cw-[a-z-]+)"/g))elements.set(match[1],element());
const mainStorage={};
const storage={
 getItem(k){if(k==='masum-chronos-v1')throw Error('Unauthorized main state access');return mainStorage[k]||null;},
 setItem(k,v){if(k==='masum-chronos-v1')throw Error('Unauthorized main state write');mainStorage[k]=v;}
};
let cb=null;
const w={ChronosWidgetCore:core,location:{search:'?type=tasks&source=host&hostOrigin=https%3A%2F%2Fhost.example'},parent:{},
 addEventListener(name,fn){if(name==='message')cb=fn;},
 crypto:{randomUUID:()=> 'new-id'}};
vm.runInNewContext(widgetCode,{window:w,document:{body:{dataset:{}},
 getElementById:id=>elements.get(id),createElement:element},
 localStorage:storage,setInterval:()=>1,setTimeout:()=>1,clearTimeout:()=>{},Date,Math,JSON,URLSearchParams,
 ChronosWidgetCore:core,console},{timeout:1000});
assert.equal(elements.get('cw-task-form').hidden,true);
assert(elements.get('cw-task-list').children.length===1,'Host mode should start empty');
cb({source:w.parent,origin:'https://hostile.example',data:{type:'chronos:widget:data',version:1,payload:bad}});
assert.equal(String(elements.get('cw-active').textContent),'0','Wrong-origin data must be ignored');
cb({source:w.parent,origin:'https://host.example',data:{type:'chronos:widget:data',version:1,payload:bad}});
assert.equal(String(elements.get('cw-active').textContent),'1','Approved host payload should be rendered');
assert.equal(elements.get('cw-task-list').children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
assert.equal(elements.get('cw-task-form').hidden,true,'Host list stays read-only');
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.version,'2.4.0-beta.1');
assert(pkg.files.includes('web/widgets/widget.html'));
const sw=read('web/sw.js'),rsw=read('sw.js');
assert(sw.includes("'./widgets/studio.html'")&&rsw.includes("'./web/widgets/widget.html'"),'Offline precache must include studio & widget iframe');
console.log('WIDGET ENGINE: 4 types, themes, sizes, storage separation, exact-origin snapshots, loader, Studio, PWA cache and VSIX assets PASS');
