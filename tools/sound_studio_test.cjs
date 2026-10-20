'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const sounds = fs.readFileSync('web/sound-studio.js','utf8');
const app = fs.readFileSync('web/app.js','utf8');
const html = fs.readFileSync('web/index.html','utf8');
const sources = [];
const nodes = [];
const elements = {
  'ringtone-banner': {hidden:true},
  'ringtone-title': {textContent:''},
  'ringtone-subtitle': {textContent:''}
};
const ctx = {currentTime:4,sampleRate:22050,state:'running',destination:{},
  resume:()=>Promise.resolve(),
  createBuffer:(ch, count) => {
    const data = new Float32Array(count);
    return {duration: count / 22050, getChannelData:()=>data};
  },
  createBufferSource() {
    const source = { loop:false,onended:null, connect(){return this}, disconnect(){}, start(){this.started=true},
      stop(at) {this.stoppedAt=at===undefined?null:at;} };
    sources.push(source); return source;
  },
  createGain(){const node={gain:{value:0},connect(){return ctx.destination},disconnect(){}};nodes.push(node);return node;}
};
const sandbox={window:{AudioContext:class{constructor(){return ctx}}},document:{getElementById:id=>elements[id]||null},
  indexedDB:undefined,Option:class{},setTimeout,clearTimeout,console};
vm.runInNewContext(sounds,sandbox);
assert.equal(typeof sandbox.window.createChronosSoundStudio,'function');
const state={alertSound:true,soundStudio:undefined};let saves=0;let error='';
const studio=sandbox.window.createChronosSoundStudio({getSettings:()=>state,persist:()=>{saves++},toast:msg=>{error=msg}});
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
  studio.unlock();
  await studio.play('countdown');
  await settle();
  assert.equal(sources.length,1);
  assert.equal(sources[0].loop,true,'Manual alarms must loop');
  assert.equal(sources[0].stoppedAt,undefined,'Manual alarm should have no automatic deadline');
  assert.equal(elements['ringtone-banner'].hidden,false);
  assert.match(elements['ringtone-subtitle'].textContent,/SILENCE/);
  studio.stop();
  assert.equal(elements['ringtone-banner'].hidden,true);
  assert.equal(sources[0].stoppedAt,null,'SILENCE stops audio');
  state.soundStudio.stopMode='auto10';
  await studio.play('focus');await settle();
  assert.equal(sources[1].stoppedAt,14,'Optional auto stop uses audio clock at 10 sec');
  state.soundStudio.selections.break='off';
  const old=sources.length;
  await studio.play('break');await settle();
  assert.equal(sources.length,old,'Event mute must prevent audio');
  state.alertSound=false;
  await studio.play('taskComplete');await settle();
  assert.equal(sources.length,old,'Global mute must prevent audio');
  state.alertSound=true;
  await studio.play('stopwatchLap');await settle();
  assert.equal(sources.length,old+1);
  assert.match(app,/soundStudio\.play\('stopwatchStop'\)/);
  assert.match(app,/soundStudio\.play\('stopwatchLap'\)/);
  assert.match(app,/soundStudio\.play\('taskComplete'\)/);
  assert.match(app,/function checkTaskReminders\(\)/);
  for(const id of ['sound-studio-controls','sound-stop-mode','alert-sound']) {
    assert(sounds.includes(id) || html.includes(id),id+' missing');
  }
  assert.match(html,/src="\.\/sound-studio\.js"/);
  assert.match(html,/href="\.\/sound-studio\.css"/);
  assert.equal(error,'');
  console.log('SOUND STUDIO: manual loop, SILENCE, Web Audio 10s auto stop, separate event mute, global mute, event hooks: PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
