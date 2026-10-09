'use strict';
const fs=require('fs'), vm=require('vm'), assert=require('node:assert/strict');
const src=fs.readFileSync('web/app.js','utf8');
const start=src.indexOf('  function stopCompletionRingtone() {');
const end=src.indexOf('  function notify(message) {',start);
assert(start>0 && end>start,'Ringtone helpers missing');
const logs={starts:[],stops:[],disconnects:0};
const banner={hidden:true};
const c={
  ringtoneTimeout:null,ringtoneVoices:[], RINGTONE_SECONDS:10,
  state:{settings:{alertSound:true,volume:30}},audioCtx:null,
  $:id=>id==='ringtone-banner'?banner:null,
  unlockAudio(){ c.audioCtx={currentTime:4,destination:{},
    createOscillator(){return {frequency:{setValueAtTime(){}},connect(g){return g},start(t){logs.starts.push(t)},stop(t){logs.stops.push(t)},disconnect(){logs.disconnects++}}},
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(dest){return dest}}}}},
  setTimeout(fn,ms){c.timerDelay=ms; c.timerFn=fn; return 123},
  clearTimeout(){c.timerFn=null},timerFn:null,timerDelay:null
};
vm.createContext(c);vm.runInContext(src.slice(start,end),c);
c.playCompletionRingtone();
assert.equal(logs.starts.length,40);assert.equal(logs.stops.length,40);
assert(Math.abs(Math.max(...logs.stops)-Math.min(...logs.starts)-10)<.00001,'Audio deadline != 10s');
assert.equal(c.timerDelay,10100);assert.equal(banner.hidden,false);
c.stopCompletionRingtone();
assert.equal(logs.disconnects,40);assert.equal(banner.hidden,true);
c.state.settings.alertSound=false;c.playCompletionRingtone();
assert.equal(logs.starts.length,40,'Muted alarm scheduled sound');
assert(src.includes('Date.now() - completedDeadline < 30_000'),'No overdue suppression');
assert(src.includes("'1.2.0', VERSION].includes(raw.version)"),'v1.2 task migration would break');
// Regression: a 10-minute or 20-minute countdown must be silent until its
// exact configured deadline, then schedule exactly ten seconds of audio.
const timerStart=src.indexOf('  function completeTimer(mode) {');
const timerEnd=src.indexOf('  function resetTimer() {',timerStart);
assert(timerStart>0 && timerEnd>timerStart, 'Timer completion/controls missing');
vm.runInContext(src.slice(timerStart,timerEnd), c);
for (const minutes of [10,20]) {
  c.stopCompletionRingtone();
  const initialNotes=logs.starts.length;
  c.now=1730000000000;
  c.Date={now:()=>c.now};
  c.state={mode:'countdown',settings:{alertSound:true,volume:30},timers:{
    countdown:{durationMs:minutes*60*1000,remainingMs:minutes*60*1000,endsAt:null},
    focus:{durationMs:1500000,remainingMs:1500000,endsAt:null}
  }};
  c.persist=()=>{};c.render=()=>{};c.safeToast=()=>{};
  c.sendHost=()=>{};c.notify=()=>{};
  c.toggleTimer();
  assert.equal(c.state.timers.countdown.endsAt, c.now+minutes*60*1000);
  c.now+=minutes*60*1000-1;
  c.completeTimer('countdown');
  assert.equal(logs.starts.length, initialNotes, `${minutes}m alarm rang before end`);
  c.now+=1;
  c.completeTimer('countdown');
  assert.equal(logs.starts.length-initialNotes, 40, `${minutes}m alarm did not start at end`);
  assert.equal(c.state.timers.countdown.endsAt,null);
  assert.equal(c.timerDelay,10100, `${minutes}m alarm should automatically stop after ten seconds`);
  assert(Math.abs(Math.max(...logs.stops.slice(-40))-Math.min(...logs.starts.slice(-40))-10)<.0001);
  c.timerFn();
  assert.equal(banner.hidden,true);
  assert.equal(c.ringtoneVoices.length,0, `${minutes}m ringtone kept playing`);
}
console.log('RINGTONE: 10m/20m countdowns silent until deadline, exact 10s playback then automatic stop; mute and legacy data: PASS');
