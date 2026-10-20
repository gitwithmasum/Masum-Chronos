'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const analytics=require('../web/productivity-intelligence.js');
const stamp=day=>new Date(day+'T12:00:00').getTime();
const today='2026-10-21';
assert.equal(analytics.validDay('2026-02-30'),false);
assert.equal(analytics.validDay('2026-02-28'),true);
assert.equal(analytics.calendarDays('2026-03-09',3).join(','),'2026-03-07,2026-03-08,2026-03-09');
assert.equal(analytics.calendarDays(today,84).length,84);
assert.equal(analytics.calendarDays(today,1)[0],today);
const state={stats:{daily:{
 '2026-10-20':{sessions:2,focusSeconds:3000},
 '2026-10-21':{sessions:1,focusSeconds:1500},
 '2026-10-17':{sessions:1,focusSeconds:900}
}},tasks:[
 {id:'one',text:'Create package',done:true,completedAt:stamp('2026-10-20'),estimateMins:30,focusSeconds:2700,dueDate:'2026-10-20',planDate:''},
 {id:'two',text:'=HYPERLINK("https://bad.example")',done:true,completedAt:stamp('2026-10-21'),estimateMins:60,focusSeconds:0,dueDate:'',planDate:''},
 {id:'three',text:'+SUM(1,2)',done:false,completedAt:null,estimateMins:25,focusSeconds:600,dueDate:'',planDate:''}
]};
const week=analytics.summary(state,today,7);
assert.deepEqual(week,{sessions:4,focusSeconds:5400,completed:2,activeDays:3,days:7,avgMinutesPerActiveDay:30});
const series=analytics.timeline(state,today,7);
assert.equal(series[5].day,'2026-10-20');
assert.equal(series[5].activity,3);
assert.equal(series[6].activity,2);
assert.equal(analytics.timeline({stats:{daily:{}},tasks:[]},today,7).length,7);
const compare=analytics.comparisons(state.tasks);
assert.equal(compare.length,2,'Tasks with no attributed completed sessions should not be mislabelled as 0 actual');
assert.equal(compare[0].trackedMins,45);
assert.equal(compare[0].ratio,150);
assert.equal(compare[1].trackedMins,10);
const csv=analytics.csv(state,today);
assert(csv.charCodeAt(0)===0xFEFF,'Excel UTF-8 BOM missing');
assert(csv.includes('"2026-10-20","2","50","1"'));
assert(csv.includes('"\'=HYPERLINK(""https://bad.example"")"'),'CSV formula-injection protection missing');
assert(csv.includes('"\' +SUM')===false);
assert(csv.includes('"\'+' + 'SUM(1,2)"'),'Plus formula-injection protection missing');
assert.equal(analytics.quoteCsv('=1+2'),'"\'=1+2"');
assert.equal(analytics.quoteCsv('-1+2'),'"\'-1+2"');
assert.equal(analytics.quoteCsv('@SUM(1)'),'"\'@SUM(1)"');
const html=fs.readFileSync('web/index.html','utf8'),root=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('web/app.js','utf8');
for(const file of [html,root])for(const id of ['intelligence-panel','intelligence-trend','intelligence-heatmap','intelligence-csv','intelligence-pdf','intelligence-comparison-list','intelligence-range','intelligence-focus','intelligence-sessions','intelligence-completed','intelligence-active']){
 assert(file.includes('id="'+id+'"'),id+' missing from entrypoint');
}
assert(root.includes('src="./productivity-intelligence.js"'));
assert(html.includes('href="./intelligence.css"'));
assert(app.includes("focusSeconds:Number.isFinite(task.focusSeconds)"));
assert(app.includes("target.focusSeconds=Math.min("));
assert(app.includes("'2.2.0-beta.1', '2.3.0-beta.1', VERSION"),'v2.2/v2.3 user states must migrate without a reset');
assert(fs.readFileSync('vscode/sync-bridge.js','utf8').includes('focusSeconds:'),'VS Code local bridge must retain tracked focus');
const mission=require('../web/mission-engine.js');
const recurring=mission.nextOccurrence({...state.tasks[0],recurrence:'daily',recurrenceAnchor:'2026-10-20',dueDate:'2026-10-20',done:true},state.tasks,'2026-10-21',200);
assert.equal(recurring.focusSeconds,0,'Generated recurring task must not inherit the original task Focus history');
const start=app.indexOf('  function intelligenceClock(');
const end=app.indexOf('  function updateMissionHud(',start);
assert(start>0&&end>start,'Intelligence renderer missing');
const tree=new Map();
const element=()=>{
 const e={children:[],style:{},dataset:{},className:'',open:false,
 append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},
 setAttribute(k,v){this[k]=v;},classList:{add(){}},click(){}};
 return e;
};
for(const name of ['intelligence-panel','intelligence-range','intelligence-focus','intelligence-sessions','intelligence-completed','intelligence-active','intelligence-trend','intelligence-heatmap','intelligence-comparison-list'])tree.set(name,element());
tree.get('intelligence-panel').open=true;
tree.get('intelligence-range').value='7';
const mock={
 intelligence:analytics,state,dateKey:()=>today,$:name=>tree.get(name),
 document:{createElement:()=>element(),body:element()},
 inVSCode:false,safeToast:()=>{},Date,Number,Math,
 window:{print(){}}
};
vm.runInNewContext(app.slice(start,end)+'\nrenderIntelligence();',mock,{timeout:2000});
assert.equal(tree.get('intelligence-focus').textContent,'1h 30m');
assert.equal(tree.get('intelligence-sessions').textContent,'4');
assert.equal(tree.get('intelligence-completed').textContent,'2');
assert.equal(tree.get('intelligence-trend').children.length,7);
assert.equal(tree.get('intelligence-heatmap').children.length,84);
assert.equal(tree.get('intelligence-comparison-list').children.length,2);
tree.get('intelligence-range').value='30';
vm.runInNewContext(app.slice(start,end)+'\nrenderIntelligence();',mock,{timeout:2000});
assert.equal(tree.get('intelligence-trend').children.length,30);
assert.match(fs.readFileSync('web/intelligence.css','utf8'),/body\.print-intelligence/);
assert.match(app,/window\.print\(\)/);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.version,'2.4.0-beta.1');
assert(pkg.files.includes('web/productivity-intelligence.js')&&pkg.files.includes('web/intelligence.css'));
console.log('INTELLIGENCE: 7/30-day analytics, 84-day heatmap, completed task attribution, CSV formula safety, PDF print and migration PASS');
