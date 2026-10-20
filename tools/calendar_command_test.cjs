'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const engine=require('../web/mission-engine.js'),app=fs.readFileSync('web/app.js','utf8');
const fake=(id,options={})=>({id,text:id,done:false,dueDate:'',planDate:'',planStart:'',planDurationMins:0,estimateMins:30,dependsOn:[],createdAt:1,modifiedAt:1,...options});
assert.deepEqual(engine.extras({}).dependsOn,[]);
const extra=engine.extras({dependsOn:['a','b','c','d','e','f','g','h','i'],planDate:'2026-10-22',planStart:'09:30',planDurationMins:60},'owner');
assert.equal(extra.dependsOn.length,8);
assert.equal(extra.planDate,'2026-10-22');
assert.deepEqual([extra.planStart,extra.planDurationMins],['09:30',60]);
assert.equal(engine.extras({planDate:'2026-10-22',planStart:'99:00'}).planDate,'');
const tasks=[fake('A',{planDate:'2026-10-22',planStart:'09:00',planDurationMins:60}),fake('B',{dueDate:'2026-10-24'})];
assert.equal(engine.planConflicts(tasks,'B','2026-10-22','09:30',30).valid,false,'Must catch overlap');
assert.deepEqual(engine.planConflicts(tasks,'B','2026-10-22','09:30',30).overlaps.map(x=>x.id),['A']);
assert.equal(engine.planConflicts(tasks,'B','2026-10-22','10:00',30).valid,true,'Adjacency must not overlap');
assert.equal(engine.planConflicts(tasks,'B','2026-10-25','10:00',30).pastDeadline,true,'Late scheduled date should be caught');
assert.equal(engine.planConflicts(tasks,'B','2026-10-22','23:30',90).valid,false,'No midnight overrun');
assert.equal(engine.planConflicts(tasks,'unknown','2026-10-22','12:00',30).valid,false);
assert.equal(engine.weekDates('2026-10-21')[0],'2026-10-19');
assert.equal(engine.weekDates('2026-10-21')[6],'2026-10-25');
assert.equal(engine.shiftWeek('2026-10-21',1),'2026-10-26');
assert.equal(engine.shiftWeek('2026-10-21',-1),'2026-10-12');
const graph=[fake('a',{text:'Initialize'}),fake('b',{dependsOn:['a','c']}),fake('c',{done:true,text:'Completed'})];
const links=engine.dependencyLinks(graph);assert.equal(links.length,2);
assert.deepEqual(links[1].prerequisites.map(v=>[v.id,v.done]),[['a',false],['c',true]]);
assert.equal(engine.hasCycle(graph,'a',['b']),true,'Cannot create cycle through multi-dependency network');
const recurring={...fake('month',{done:true,dueDate:'2026-10-21',recurrence:'daily',recurrenceAnchor:'2026-10-21',planDate:'2026-10-21',planStart:'08:00',planDurationMins:45})};
const next=engine.nextOccurrence(recurring,[recurring],'2026-10-21',22);
assert.equal(next.planDate,'');assert.equal(next.planStart,'');assert.equal(next.planDurationMins,0);
for(const path of ['index.html','web/index.html']){
 const html=fs.readFileSync(path,'utf8');
 for(const id of ['calendar-command','calendar-prev','calendar-next','calendar-today','calendar-task','calendar-date','calendar-time','calendar-duration','calendar-schedule','calendar-backlog','calendar-grid','dependency-network','todo-dependency','edit-task-dependency']){
  assert(html.includes('id="'+id+'"'),path+': missing '+id);
 }
 assert(html.indexOf('id="todo-workspace"')<html.indexOf('id="calendar-command"'));
 assert(html.indexOf('id="calendar-command"')<html.indexOf('<footer class="footer">'));
 assert(html.includes('href="./calendar-command.css"'));
}
assert(app.includes("$$('#todo-dependency input[type=\"checkbox\"]')"));
assert(app.includes('function selectedDependencies('));
assert(app.includes("planDate:task.planDate,planStart:task.planStart,planDurationMins:task.planDurationMins"),'Edit must preserve scheduled data');
assert(app.includes("let calendarWeekAnchor = ''"),'Do not access dateKey before initialization');
const pickerStart=app.indexOf('  function selectedDependencies(');
const pickerEnd=app.indexOf('  function calendarFeedback(',pickerStart);
assert(pickerStart>0&&pickerEnd>pickerStart);
const pickup=[];
const mkElement=name=>({
  tagName:name,children:[],append(...nodes){this.children.push(...nodes);},addEventListener(name,cb){this[name]=cb;},
  replaceChildren(){this.children=[];},get options(){return this.children}
});
const pickerContainer=mkElement('div');
pickerContainer.querySelectorAll=()=>pickerContainer.children.map(label=>label.children[0]).filter(el=>el?.type==='checkbox'&&el.checked);
const ctx={
 $:()=>pickerContainer,
 document:{createElement:mkElement},
 state:{tasks:graph},mission:engine,safeToast:message=>pickup.push(message)
};
vm.runInNewContext(app.slice(pickerStart,pickerEnd)+"\npopulateDependencyOptions('edit-task-dependency','a',['c']);",ctx,{timeout:1000});
assert.equal(pickerContainer.querySelectorAll().length,1,'Selected prerequisite must persist in editor');
assert(!pickerContainer.children.some(label=>label.children[0]?.value==='b'),'Circular option should be excluded');
const status={textContent:'',dataset:{}};
let persists=0,renders=0;const shared={tasks:[fake('A',{planDate:'2026-10-22',planStart:'09:00',planDurationMins:60}),fake('B',{dueDate:'2026-10-24'})]};
const d=app.slice(app.indexOf('  function calendarFeedback('),app.indexOf('  function updateMissionHud('));
const c2={$:()=>status,state:shared,mission:engine,persist:()=>persists++,renderTasks:()=>renders++,Date};
vm.runInNewContext(d+"\nscheduleMission('B','2026-10-22','09:30',30);",c2,{timeout:1000});
assert.equal(persists,0,'Overlapping block should not save');
assert.equal(status.dataset.error,'true');
vm.runInNewContext(d+"\nscheduleMission('B','2026-10-22','10:00',30);",c2,{timeout:1000});
assert.equal(shared.tasks[1].planDate,'2026-10-22');
assert.equal(persists,1);
vm.runInNewContext(d+"\nclearScheduledMission('B');",c2,{timeout:1000});
assert.equal(shared.tasks[1].planDate,'');
assert.equal(persists,2);
const bridge=fs.readFileSync('vscode/sync-bridge.js','utf8');
assert(bridge.includes('planDurationMins:'),'VS Code bridge drops time blocks');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert(pkg.files.includes('web/calendar-command.css'));
assert.equal(pkg.version,'2.4.0-beta.1');
console.log('SMART CALENDAR: timezone-safe week, conflict guard, draggable UI markers, eight dependencies, migration, bridge, edit safety and schedule runtime PASS');
