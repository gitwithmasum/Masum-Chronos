'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const js = fs.readFileSync('web/cloud-sync.js', 'utf8');
const html = fs.readFileSync('web/index.html','utf8');
const code = fs.readFileSync('web/app.js','utf8');
const store = new Map();
const items = new Map();
const fetchCalls = [];
const elements = ['cloud-status','cloud-account','cloud-google-login','cloud-configure','cloud-url','cloud-key',
 'cloud-sync-now','cloud-backup-now','cloud-restore','cloud-signout'];
for (const id of elements) items.set(id,{textContent:'',value:'',disabled:false,addEventListener(name,fn){this[name]=fn}});
const fakeDoc = { hidden:false,getElementById:id => items.get(id) || null,
 addEventListener() {} };
const url = 'https://pkydbkpbayrarnwaomoa.supabase.co';
store.set('chronos-cloud-session:pkydbkpbayrarnwaomoa.supabase.co',JSON.stringify({
 access_token:'testing-user-session',refresh_token:'testing-refresh',expires_at:Date.now()+60*60*1000
}));
const data = {tasks:[{id:'loc',text:'Local task',done:false,modifiedAt:120,createdAt:120}],
 deletedTasks:{},theme:'nebula',settings:{alertSound:true,soundscape:'off'},focus:{focusMins:25,shortMins:5,longMins:15,longEvery:4},
 timers:{focus:{remainingMs:3000,endsAt:null},countdown:{remainingMs:3000,endsAt:null}},
 stopwatch:{elapsedMs:0,startedAt:null},stats:{sessions:0}};
let merged = null, backups = 0, preferenceCalls = 0;
async function fakeFetch(path,opts) {
 fetchCalls.push({path,method:opts.method,body:opts.body});
 const suffix=path.slice(url.length);
 let payload, status=200;
 if(suffix==='/auth/v1/user') payload={id:'00000000-0000-4000-8000-000000000001',email:'tester@example.test'};
 else if(suffix.startsWith('/rest/v1/chronos_missions?')) payload=[{id:'remote',payload:{id:'remote',text:'Cloud task',modifiedAt:100,createdAt:100},modified_at:100,deleted:false}];
 else if(suffix.startsWith('/rest/v1/chronos_preferences?')) payload=[];
 else if(suffix.includes('rpc/chronos_upsert_preferences')) {preferenceCalls++; payload=null;}
 else if(suffix.includes('/rest/v1/chronos_backups') && opts.method==='POST') {backups++;payload=null;status=201;}
 else if(suffix.includes('rpc/chronos_upsert_missions')) payload=null;
 else throw Error('Unexpected request '+suffix);
 return {ok:true,status,text:async()=>payload===null?'':JSON.stringify(payload)};
}
const events = {};
const fakeWindow={ addEventListener:(name,cb)=>{events[name]=cb} };
const sandbox={window:fakeWindow, document:fakeDoc,navigator:{onLine:true},history:{replaceState(){}},
 location:{protocol:'https:',origin:'https://gitwithmasum.github.io',pathname:'/Masum-Chronos/',search:'',hash:''},
 localStorage:{getItem:key=>store.get(key)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 fetch:fakeFetch,AbortController,setTimeout,clearTimeout,setInterval:()=>1,Date,URL,URLSearchParams,console};
vm.runInNewContext(js,sandbox,{filename:'cloud-sync.js'});
assert.equal(typeof fakeWindow.createChronosCloud,'function');
const cloud=fakeWindow.createChronosCloud({
 getSnapshot:()=>data,mergeMissions:remote=>{merged=remote;},
 applyPreferences:()=>{},restoreSnapshot:()=>{},
 toast:()=>{},inVSCode:false
});
cloud.init();
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(let t=0;t<30 && backups===0;t++)await sleep(10);
 assert.deepEqual(Array.from(merged.tasks, t => t.id), ['remote'], 'Cloud task should merge into local workspace');
 assert(fetchCalls.some(c=>c.path.includes('rpc/chronos_upsert_missions') && JSON.parse(c.body).p_rows[0].id==='loc'),'Local tasks must upload to cloud');
 assert(preferenceCalls>0,'Initial settings must be backed up');
 assert(backups===1,'A daily cloud backup should be made');
 assert.equal(items.get('cloud-account').textContent,'tester@example.test');
 assert.match(items.get('cloud-status').textContent,/SYNCED/);
 cloud.preferencesChanged();
 assert(Number(store.get('chronos-cloud-preferences-changed-v2:00000000-0000-4000-8000-000000000001'))>0,'Preference timestamp must persist');
 assert.match(code,/cloud\?\.init\(\)/,'Cloud panel should initialize inside app');
 assert.match(html,/id="cloud-google-login"/,'Login must be accessible');
 assert.match(html,/id="cloud-sync-now"/,'Manual sync must be accessible');
 console.log('CLOUD: authenticated REST, task merge, outbound sync RPC, preferences, backup, UI and local change tracking: PASS');
})().catch(err=>{console.error(err);process.exitCode=1});