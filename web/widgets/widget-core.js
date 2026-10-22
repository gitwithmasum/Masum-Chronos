/* MASUM CHRONOS v2.6 / Universal Widget Core
 * Pure functions for independent, embeddable widgets; no access to main app data.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ChronosWidgetCore=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const TYPES=Object.freeze(['focus','countdown','tasks','stats']);
  const THEMES=Object.freeze(['nebula','cyber','aurora','black-gold','pearl-waves']);
  const SIZES=Object.freeze(['compact','regular','wide']);
  const STORAGE_KEY='masum-chronos.widget.v1';
  function bounds(v,min,max,fallback){
    const number=Number(v);
    return Number.isInteger(number)&&number>=min&&number<=max?number:fallback;
  }
  function options(source){
    const q=source instanceof URLSearchParams?source:new URLSearchParams(String(source||''));
    const choose=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
    return Object.freeze({
      type:choose(q.get('type'),TYPES,'focus'),
      theme:choose(q.get('theme'),THEMES,'nebula'),
      size:choose(q.get('size'),SIZES,'regular'),
      minutes:bounds(q.get('minutes'),1,180,25),
      source:q.get('source')==='host'?'host':'local',
      hostOrigin:origin(q.get('hostOrigin'))||'',
      bridgeToken:/^[a-f0-9]{48}$/.test(q.get('bridgeToken')||'')?(q.get('bridgeToken')||''):''
    });
  }
  function origin(raw){
    try{const url=new URL(raw);return ['https:','http:'].includes(url.protocol)?url.origin:'';}
    catch{return '';}
  }
  function task(input){
    if(!input||typeof input!=='object')return null;
    const title=typeof input.text==='string'?input.text.trim().slice(0,100):'';
    if(!title)return null;
    return {
      id:String(input.id||'').slice(0,80)||'',
      text:title,done:Boolean(input.done),
      priority:['low','medium','high','critical'].includes(input.priority)?input.priority:'medium'
    };
  }
  function snapshot(data){
    const raw=data&&typeof data==='object'?data:{};
    const tasks=Array.isArray(raw.tasks)?raw.tasks.slice(0,60).map(task).filter(Boolean):[];
    return {
      tasks,
      stats:{
        sessions:bounds(raw.stats?.sessions,0,1000000,0),
        focusSeconds:bounds(raw.stats?.focusSeconds,0,100000000,0)
      }
    };
  }
  function initial(){
    return {version:1,focus:{durationSeconds:1500,remainingSeconds:1500,endsAt:0},
      countdown:{durationSeconds:600,remainingSeconds:600,endsAt:0},
      tasks:[],stats:{sessions:0,focusSeconds:0}};
  }
  function restore(raw){
    const out=initial();
    if(!raw||typeof raw!=='object'||raw.version!==1)return out;
    for(const mode of ['focus','countdown']){
      const t=raw[mode]||{};
      const duration=bounds(t.durationSeconds,60,10800,out[mode].durationSeconds);
      out[mode]={durationSeconds:duration,remainingSeconds:bounds(t.remainingSeconds,0,10800,duration),
        endsAt:bounds(t.endsAt,0,Number.MAX_SAFE_INTEGER,0)};
    }
    out.tasks=snapshot(raw).tasks.map((t,i)=>({...t,id:t.id||'legacy-'+i}));
    out.stats=snapshot(raw).stats;
    return out;
  }
  function remaining(timer,now){
    const seconds=timer.endsAt?Math.ceil((timer.endsAt-now)/1000):timer.remainingSeconds;
    return Math.max(0,Math.min(timer.durationSeconds,Number.isFinite(seconds)?seconds:0));
  }
  function format(seconds){
    const n=Math.max(0,Math.floor(Number(seconds)||0));
    const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
    return (h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(s).padStart(2,'0');
  }
  function progress(snapshot){
    const total=snapshot.tasks.length,done=snapshot.tasks.filter(t=>t.done).length;
    return {total,done,active:total-done,percentage:total?Math.round(done/total*100):0,
      sessions:snapshot.stats.sessions,focusMinutes:Math.floor(snapshot.stats.focusSeconds/60)};
  }
  return Object.freeze({TYPES,THEMES,SIZES,STORAGE_KEY,bounds,options,origin,task,snapshot,initial,restore,remaining,format,progress});
});
