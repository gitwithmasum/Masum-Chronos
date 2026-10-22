/* MASUM CHRONOS v2.4 — standalone widget runtime.
 * Separate storage namespace; NEVER reads main Chronos/NovaStudy keys.
 */
(()=>{
 'use strict';
 const core=window.ChronosWidgetCore;
 const config=core.options(window.location.search);
 const $=id=>document.getElementById(id);
 const store=core.STORAGE_KEY;
 let local=load();
 let supplied=null;
 let audioContext=null;
 let chiming=null;
 let chimeTimeout=null;
 const mode=config.type==='countdown'?'countdown':'focus';
 const titles={focus:'Focus Protocol',countdown:'Mission Countdown',tasks:'Mini Mission Board',stats:'Productivity Pulse'};
 function load(){
   try{return core.restore(JSON.parse(localStorage.getItem(store)||'null'));}
   catch{return core.initial();}
 }
 function persist(){
   try{localStorage.setItem(store,JSON.stringify(local));}
   catch{/* Host browser may partition or block third-party storage. */ }
 }
 function dataView(){return config.source==='host' ? (supplied||core.snapshot({})) : local;}
 function status(value){$('cw-status').textContent=value;}
 function unlockAudio(){
   if(audioContext) {try{void audioContext.resume();}catch{}return;}
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(Ctx)try{audioContext=new Ctx();}catch{}
 }
 function stopChime(){
   if(chimeTimeout){clearTimeout(chimeTimeout);chimeTimeout=null;}
   if(chiming){try{chiming.stop();}catch{}chiming=null;}
 }
 function chime(){
   if(!audioContext||audioContext.state!=='running')return;
   stopChime();
   try{
     const sound=audioContext.createOscillator(),volume=audioContext.createGain();
     sound.type='sine';sound.frequency.value=660;volume.gain.value=.045;
     sound.connect(volume);volume.connect(audioContext.destination);
     const now=audioContext.currentTime;
     sound.frequency.setValueAtTime(660,now);
     sound.frequency.setValueAtTime(880,now+.3);
     sound.start(now);sound.stop(now+10);
     chiming=sound;
     sound.onended=()=>{if(chiming===sound)chiming=null;};
     chimeTimeout=setTimeout(stopChime,10000);
   }catch{}
 }
 function completion(){
   const timer=local[mode];
   if(!timer.endsAt||core.remaining(timer,Date.now())>0)return;
   const drift=Math.max(0,Date.now()-timer.endsAt);
   timer.endsAt=0;timer.remainingSeconds=0;
   if(mode==='focus'){
     local.stats.sessions=Math.min(1000000,local.stats.sessions+1);
     local.stats.focusSeconds=Math.min(100000000,local.stats.focusSeconds+timer.durationSeconds);
   }
   persist();
   status(mode==='focus'?'Focus complete · Session recorded.':'Countdown complete · Time elapsed.');
   if(drift<30000)chime();
 }
 function timerPaint(){
   const timer=local[mode],now=Date.now();
   if(timer.endsAt&&core.remaining(timer,now)===0)completion();
   const seconds=core.remaining(timer,now);
   $('cw-time').textContent=core.format(seconds);
   $('cw-ring').style.setProperty('--angle',(timer.durationSeconds?Math.round((timer.durationSeconds-seconds)/timer.durationSeconds*360):0)+'deg');
   const running=Boolean(timer.endsAt);
   $('cw-toggle').textContent=running?'PAUSE':seconds===0?'START AGAIN':'START';
   $('cw-caption').textContent=running?'SESSION ACTIVE':seconds===0?'SESSION COMPLETE':'READY';
   // Keep the duration input editable while a timer is ticking.
 }
 function playPause(){
   unlockAudio();
   const timer=local[mode];
   if(timer.endsAt){
     timer.remainingSeconds=core.remaining(timer,Date.now());timer.endsAt=0;
     status('Session paused.');
   }else{
     if(!timer.remainingSeconds)timer.remainingSeconds=timer.durationSeconds;
     timer.endsAt=Date.now()+timer.remainingSeconds*1000;
     status('Session started.');
   }
   persist();timerPaint();
 }
 function reset(){
   stopChime();
   const timer=local[mode];
   timer.endsAt=0;timer.remainingSeconds=timer.durationSeconds;
   persist();timerPaint();status('Timer reset.');
 }
 function durationChanged(){
   const minutes=core.bounds($('cw-minutes').value,1,180,mode==='focus'?25:10);
   const timer=local[mode];
   timer.durationSeconds=minutes*60;timer.remainingSeconds=minutes*60;timer.endsAt=0;
   stopChime();persist();timerPaint();status('Duration updated.');
 }
 function tasksPaint(){
   const data=dataView(),counts=core.progress(data);
   $('cw-active').textContent=counts.active;
   $('cw-done').textContent=counts.done;
   const target=$('cw-task-list');target.replaceChildren();
   const readOnly=config.source==='host';
   $('cw-task-form').hidden=readOnly;
   if(!data.tasks.length){
     const li=document.createElement('li');li.className='cw-empty';li.textContent=readOnly?'No tasks received from host.':'No missions yet. Add your first task.';
     target.append(li);
   }
   data.tasks.slice(0,60).forEach(t=>{
     const li=document.createElement('li');li.className=t.done?'cw-done':'';
     if(!readOnly){
       const toggle=document.createElement('button');toggle.type='button';
       toggle.textContent=t.done?'↻':'✓';toggle.setAttribute('aria-label',(t.done?'Reopen ':'Complete ')+t.text);
       toggle.addEventListener('click',()=>{t.done=!t.done;persist();tasksPaint();});
       li.append(toggle);
     }
     const title=document.createElement('span');title.textContent=t.text;li.append(title);
     if(readOnly){
       const label=document.createElement('small');label.textContent=t.done?'DONE':'OPEN';li.append(label);
     }else{
       const remove=document.createElement('button');remove.type='button';remove.textContent='×';
       remove.setAttribute('aria-label','Remove '+t.text);
       remove.addEventListener('click',()=>{local.tasks=local.tasks.filter(x=>x.id!==t.id);persist();tasksPaint();});
       li.append(remove);
     }
     target.append(li);
   });
   if(readOnly)status('Host-provided tasks · Read only.');
 }
 function addTask(event){
   event.preventDefault();
   if(config.source==='host')return;
   const field=$('cw-task-input'),text=field.value.trim().slice(0,100);
   if(!text)return;
   if(local.tasks.length>=60){status('Widget limit: 60 tasks. Remove an older task first.');return;}
   const id=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():String(Date.now())+'-'+String(Math.random()).slice(2);
   local.tasks.unshift({id,text,done:false,priority:'medium'});
   field.value='';persist();tasksPaint();field.focus();status('Mission added locally.');
 }
 function statsPaint(){
   const data=dataView(),summary=core.progress(data);
   $('cw-stat-sessions').textContent=String(summary.sessions);
   $('cw-stat-minutes').textContent=String(summary.focusMinutes);
   $('cw-stat-tasks').textContent=String(summary.done);
   $('cw-stat-progress').textContent=summary.percentage+'%';
   $('cw-progress').style.width=summary.percentage+'%';
   $('cw-stats-note').textContent=config.source==='host'
     ?'Only the data explicitly provided by this host app is shown. This widget cannot access other app data.'
     :'Stats are collected by standalone Chronos widgets on this origin. No cloud account is connected.';
   if(config.source==='host')status('Host-provided summary · Read only.');
 }
 function acceptHostData(event){
   // Parent explicitly supplies a snapshot; nothing is read from the parent.
   if(config.source!=='host'||!config.hostOrigin||!config.bridgeToken||event.source!==window.parent||event.origin!==config.hostOrigin)return;
   if(!event.data||event.data.type!=='chronos:widget:data'||event.data.version!==1||event.data.bridgeToken!==config.bridgeToken)return;
   supplied=core.snapshot(event.data.payload);
   if(config.type==='tasks')tasksPaint();
   else if(config.type==='stats')statsPaint();
 }
 function postParent(type,fields={}){
   if(!config.hostOrigin||window.parent===window)return false;
   if(!config.bridgeToken)return false;
   try{window.parent.postMessage({type,version:1,bridgeToken:config.bridgeToken,...fields},config.hostOrigin);return true;}catch{return false;}
 }
 let resizeTimer=null,lastReportedHeight=0;
 function reportSize(){
   const height=Math.ceil(Math.max(document.documentElement?.scrollHeight||0,document.body?.scrollHeight||0));
   const bounded=Math.max(220,Math.min(720,height));
   if(Math.abs(bounded-lastReportedHeight)<4)return;
   lastReportedHeight=bounded;
   postParent('chronos:widget:resize',{height:bounded});
 }
 function scheduleResize(){
   if(resizeTimer!==null)return;
   resizeTimer=setTimeout(()=>{resizeTimer=null;reportSize();},80);
 }
 function init(){
   document.body.dataset.theme=config.theme;
   document.body.dataset.size=config.size;
   $('cw-title').textContent=titles[config.type];
   $('cw-indicator').textContent=config.source==='host'?'HOST DATA':'LOCAL';
   const isTimer=config.type==='focus'||config.type==='countdown';
   $('cw-timer-panel').hidden=!isTimer;
   $('cw-tasks-panel').hidden=config.type!=='tasks';
   $('cw-stats-panel').hidden=config.type!=='stats';
   // An untouched fresh widget can honor its requested initial duration.
   const key='masum-chronos.widget.initialized.'+mode;
   let initialized=false;
   try{initialized=localStorage.getItem(key)==='1';}catch{}
   if(isTimer&&!initialized){
     local[mode].durationSeconds=config.minutes*60;local[mode].remainingSeconds=config.minutes*60;
     try{localStorage.setItem(key,'1');}catch{}
     persist();
   }
   $('cw-toggle').addEventListener('click',playPause);
   $('cw-reset').addEventListener('click',reset);
   $('cw-minutes').addEventListener('change',durationChanged);
   $('cw-task-form').addEventListener('submit',addTask);
   window.addEventListener('message',acceptHostData);
   if(isTimer){$('cw-minutes').value=String(Math.floor(local[mode].durationSeconds/60));timerPaint();setInterval(timerPaint,500);}
   if(config.type==='tasks')tasksPaint();
   if(config.type==='stats')statsPaint();
   status(config.source==='host'&&['tasks','stats'].includes(config.type)
     ?'Waiting for the host to share data…':'Ready · Independent Chronos widget.');
   postParent('chronos:widget:ready');
   window.addEventListener('resize',scheduleResize,{passive:true});
   if(typeof window.ResizeObserver==='function'){
     try{const observer=new window.ResizeObserver(scheduleResize);observer.observe(document.documentElement);}catch{}
   }
   scheduleResize();
 }
 window.addEventListener('error',()=>postParent('chronos:widget:error'),{once:true});
 init();
})();
