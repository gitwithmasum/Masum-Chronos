/* MASUM CHRONOS v1.2 — opt-in loopback-only, authenticated task sync bridge.
 * Never bind externally, never expose the pairing key through HTTP.
 * This synchronizes missions only, not timers/settings/statistics.
 */
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const PORT = 46469;
const HOST = '127.0.0.1';
const ALLOWED_ORIGINS = new Set([
  'https://gitwithmasum.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'
]);
const PRIORITIES = new Set(['low','medium','high','critical']);
const CATEGORIES = new Set(['Code','Study','Work','Personal']);
const MAX_BODY = 160 * 1024;
const TIMESTAMP_MAX_FUTURE = 5 * 60 * 1000;
const MAX_TASKS = 300;
function safeTime(value, fallback) {
  return Number.isFinite(value) && value > 0 && value < Date.now() + TIMESTAMP_MAX_FUTURE ? value : fallback;
}
function cleanTask(task) {
  if (!task || typeof task !== 'object' || typeof task.id !== 'string' || typeof task.text !== 'string') return null;
  const id = task.id.slice(0,100), text = task.text.trim().slice(0,120);
  if (!id || !text) return null;
  const createdAt = safeTime(task.createdAt, Date.now());
  return {
    id, text, done:Boolean(task.done),
    priority:PRIORITIES.has(task.priority)?task.priority:'medium',
    category:CATEGORIES.has(task.category)?task.category:'Personal',
    dueDate:typeof task.dueDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)?task.dueDate:'',
    createdAt, completedAt:safeTime(task.completedAt,null),
    modifiedAt:safeTime(task.modifiedAt, safeTime(task.completedAt,createdAt))
  };
}
function cleanDeleted(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [id,t] of Object.entries(value).slice(0,900)) {
    if (id && id.length<=100 && safeTime(t,null)) out[id] = t;
  }
  return out;
}
function signature(state) {
  return JSON.stringify({tasks:state.tasks,deletedTasks:state.deletedTasks});
}
class SyncBridge {
  constructor({onChange=()=>{},initial={},key}) {
    if (!/^[a-f0-9]{64}$/i.test(key||'')) throw new Error('A random 256-bit sync key is required');
    this.key=key;
    this.onChange=onChange;
    this.data={tasks:[],deletedTasks:{}};
    this.server=null;
    this.merge(initial.tasks||[], initial.deletedTasks||{});
  }
  getData() { return JSON.parse(JSON.stringify(this.data)); }
  merge(tasks, tombstones) {
    if (!Array.isArray(tasks) || tasks.length>MAX_TASKS) return {changed:false,error:'Invalid task payload'};
    const prev=signature(this.data);
    const taskMap=new Map(this.data.tasks.map(x=>[x.id,x]));
    const deleted={...this.data.deletedTasks};
    for(const [id,ts] of Object.entries(cleanDeleted(tombstones))) deleted[id]=Math.max(deleted[id]||0,ts);
    for(const raw of tasks){
      const incoming=cleanTask(raw); if (!incoming) continue;
      const existing=taskMap.get(incoming.id);
      if(!existing || incoming.modifiedAt>existing.modifiedAt || (incoming.modifiedAt===existing.modifiedAt && JSON.stringify(incoming)>JSON.stringify(existing))) taskMap.set(incoming.id,incoming);
    }
    for(const [id,task] of taskMap) {
      if((deleted[id]||0)>=task.modifiedAt) taskMap.delete(id);
      else if(deleted[id] && task.modifiedAt>deleted[id]) delete deleted[id];
    }
    const merged=[...taskMap.values()].sort((a,b)=>b.createdAt-a.createdAt || a.id.localeCompare(b.id)).slice(0,MAX_TASKS);
    const kept=Object.entries(deleted).sort((a,b)=>b[1]-a[1]).slice(0,900);
    this.data={tasks:merged,deletedTasks:Object.fromEntries(kept)};
    const changed=prev!==signature(this.data);
    if(changed) this.onChange(this.getData());
    return {changed,data:this.getData()};
  }
  async start() {
    if(this.server) return;
    const server=http.createServer((req,res)=>this.handle(req,res));
    try {await new Promise((resolve,reject)=>{
      server.once('error',reject); server.listen(PORT,HOST,()=>{server.off('error',reject);resolve();});
    });}catch(err){server.close();throw err;}
    this.server=server;
  }
  async stop() { if(!this.server)return;const s=this.server;this.server=null;await new Promise(resolve=>s.close(()=>resolve())); }
  handle(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.headers.origin;
    const host=req.headers.host;
    if(host!==HOST+':'+PORT || !ALLOWED_ORIGINS.has(origin)) {res.writeHead(403).end();return;}
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Chronos-Key');
    res.setHeader('Access-Control-Allow-Private-Network','true');
    if(req.url!=='/v1/sync') {res.writeHead(404).end();return;}
    if(req.method==='OPTIONS') {res.writeHead(204).end();return;}
    if(req.method!=='POST') {res.writeHead(405).end();return;}
    const incoming=String(req.headers['x-chronos-key']||'');
    const left=Buffer.from(incoming),right=Buffer.from(this.key);
    if(left.length!==right.length || !crypto.timingSafeEqual(left,right)){res.writeHead(401).end();return;}
    if(Number(req.headers['content-length'])>MAX_BODY){res.writeHead(413).end();return;}
    let body=''; let terminated=false;
    req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>MAX_BODY){terminated=true;res.writeHead(413).end();req.destroy();}});
    req.on('end',()=>{
      if(terminated)return;
      try{
        const parsed=JSON.parse(body);
        if(!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length>MAX_TASKS)throw Error('Malformed tasks');
        const merged=this.merge(parsed.tasks,parsed.deletedTasks||{});
        if(merged.error)throw Error(merged.error);
        res.setHeader('Content-Type','application/json; charset=utf-8');
        res.writeHead(200).end(JSON.stringify({ok:true,version:1,...merged.data}));
      }catch{res.writeHead(400).end(JSON.stringify({ok:false,error:'Malformed sync payload'}));}
    });
  }
}
module.exports={SyncBridge,PORT,HOST,cleanTask};
