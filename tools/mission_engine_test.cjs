'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const engine=require('../web/mission-engine.js');
const mk=(id,opts={})=>({id,text:id,createdAt:100,modifiedAt:100,done:false,priority:'medium',estimateMins:25,recurrence:'none',dependsOn:[],...opts});
assert.deepEqual(engine.extras({},'x'),{recurrence:'none',dependsOn:[],reminderTime:'',estimateMins:0,seriesId:'',recurrenceAnchor:''});
assert.deepEqual(engine.extras({recurrence:'weekly',dependsOn:['p','p','q','x'],reminderTime:'08:05',estimateMins:60},'x').dependsOn,['p','q']);
assert.equal(engine.extras({reminderTime:'99:88'}).reminderTime,'');
assert.equal(engine.validDate('2026-02-30'),false);
const tasks=[mk('a',{done:false}),mk('b',{dependsOn:['a']}),mk('c',{dependsOn:['b']})];
assert.equal(engine.dependencyStatus(tasks,tasks[1]).blocked,true);
assert.equal(engine.hasCycle(tasks,'a',['c']),true);
assert.equal(engine.hasCycle(tasks,'b',['a']),false);
tasks[0].done=true;
assert.equal(engine.dependencyStatus(tasks,tasks[1]).blocked,false);
assert.equal(engine.dependencyStatus(tasks,tasks[2]).blocked,true);
assert.equal(engine.nextDate('2026-10-19','daily','2026-10-21'),'2026-10-22');
assert.equal(engine.nextDate('2026-10-19','weekly','2026-10-21'),'2026-10-26');
assert.equal(engine.nextDate('2026-01-31','monthly','2026-01-31'),'2026-02-28');
assert.equal(engine.nextDate('2026-01-31','monthly','2026-02-28'),'2026-03-31');
// Month-end recurrence stays anchored to the original day, not Feb 28.
const jan=mk('month',{done:true,recurrence:'monthly',dueDate:'2026-01-31',recurrenceAnchor:'2026-01-31'});
const feb=engine.nextOccurrence(jan,[jan],'2026-01-31',1000);
assert.equal(feb.dueDate,'2026-02-28');
assert.equal(feb.recurrenceAnchor,'2026-01-31');
feb.done=true;
const mar=engine.nextOccurrence(feb,[jan,feb],'2026-02-28',2000);
assert.equal(mar.dueDate,'2026-03-31','Do not drift recurring 31st to 28th');
assert.equal(mar.id,'month~20260331');
const febLegacy = {...feb,recurrenceAnchor:''};
assert.equal(engine.nextOccurrence(febLegacy,[jan,febLegacy],'2026-02-28',3000).dueDate,'2026-03-31',
  'Old beta recurring tasks should recover the original anchor from completed history');
assert.equal(engine.nextOccurrence(feb,[jan,feb,mar],'2026-02-28',2100),null,'Avoid duplicate generated occurrences');
// DST spring transition: 2026-03-07 to 2026-03-09 spans 47h
// in New York, but this must still produce March 10 rather than March 9.
assert.equal(engine.nextDate('2026-03-07','daily','2026-03-09'),'2026-03-10');
assert.equal(engine.nextDate('2026-03-01','weekly','2026-03-09'),'2026-03-15');
assert.equal(engine.nextDate('2026-10-31','monthly','2026-11-30'),'2026-12-31');
const done=mk('series',{done:true,recurrence:'weekly',dueDate:'2026-10-20'});
const next=engine.nextOccurrence(done,[done],'2026-10-21',500);
assert.equal(next.id,'series~20261027');
assert.equal(next.done,false);
assert.equal(next.dueDate,'2026-10-27');
assert.equal(engine.nextOccurrence(done,[done,next],'2026-10-21',700),null,'Cross-device duplicate occurrence should be avoided');
const reminders=[mk('m1',{dueDate:'2026-10-21',reminderTime:'18:00'}),mk('m2',{dueDate:'2026-10-21',reminderTime:'09:00'}),mk('m3',{dueDate:'2026-10-20'})];
assert.deepEqual(engine.reminderCandidates(reminders,'2026-10-21','10:00').map(t=>t.id),['m2','m3']);
assert.deepEqual(engine.reminderCandidates(reminders,'2026-10-21','19:00',{m2:true,m3:true}).map(t=>t.id),['m1']);
const overview=engine.overview([mk('ready',{dueDate:'2026-10-21',priority:'critical',estimateMins:35}),mk('lock',{dependsOn:['ready'],estimateMins:15})],'2026-10-21');
assert.equal(overview.ready,1);assert.equal(overview.blocked,1);assert.equal(overview.due,1);assert.equal(overview.planned,35);assert.equal(overview.recommended.id,'ready');
const web=fs.readFileSync('web/app.js','utf8'),html=fs.readFileSync('web/index.html','utf8'), root=fs.readFileSync('index.html','utf8'),bridge=fs.readFileSync('vscode/sync-bridge.js','utf8');
for(const id of ['hud-ready','hud-blocked','hud-due','hud-estimate','hud-next-task','open-command','command-dialog','command-query','command-results','edit-task-dependency','todo-dependency','todo-recurrence','todo-reminder-time']){
  assert(html.includes('id="'+id+'"'),id+' missing from web');
  assert(root.includes('id="'+id+'"'),id+' missing from root');
}
assert.match(web,/mission\.nextOccurrence\(task,state\.tasks,dateKey\(\)\)/);
assert.match(web,/mission\.hasCycle/);
assert.match(web,/mission\.reminderCandidates/);
assert.match(web,/function openCommandPalette/);
assert.match(bridge,/recurrence:/);
assert.match(bridge,/dependsOn:/);
assert.match(bridge,/reminderTime:/);
assert.match(bridge,/recurrenceAnchor:/);
assert.match(web,/recurrenceAnchor: options\.recurrence/);

// Runtime smoke: the text command "timer 15" must actually switch to
// Countdown before starting the requested duration.
const vm=require('node:vm');
const commandSource=web.slice(web.indexOf('  const COMMAND_HINTS ='),web.indexOf('  function sortedFilteredTasks()'));
assert(commandSource.includes('function renderCommands()'),'Command module missing');
const actions=[];
const commandInput={value:'timer 15'};
const commandDialog={open:true,close(){this.open=false}};
const commandResults={children:[],replaceChildren(){this.children=[]},append(v){this.children.push(v)}};
const getId=id=>({'command-query':commandInput,'command-dialog':commandDialog,'command-results':commandResults})[id] || null;
const makeNode=()=>({append(){},setAttribute(){},addEventListener(){},classList:{toggle(){}}});
const commandContext={
 $:getId, $$:()=>[],
 document:{createElement:makeNode},
 state:{tasks:[]},mission:engine,
 switchMode:m=>actions.push('mode:'+m),setCountdown:n=>actions.push('duration:'+n),
 switchWorkspace:w=>actions.push('workspace:'+w),isRunning:()=>false,
 toggleTimer:()=>actions.push('start'),
 openSettings:()=>{},activateSettingsTab:()=>{},
 safeToast:()=>{},selectMission:()=>{}
};
vm.runInNewContext(commandSource+'\nrenderCommands(); runCommand(commandItems[0]);',commandContext,{timeout:1000});
assert.deepEqual(actions,['mode:countdown','duration:900','workspace:timer','start']);
assert.equal(commandDialog.open,false);

console.log('MISSION ENGINE: dependencies, cycles, recurring dates, duplicate guard, timed alerts, ready queue, HUD and both app entrypoints PASS');
