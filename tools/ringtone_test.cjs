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
console.log('RINGTONE: exact 10s audio, 40 notes, silence, mute, stale-timer gate, v1.2 compatibility passed');
