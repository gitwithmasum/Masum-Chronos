/* MASUM CHRONOS v2.3 — local-first productivity intelligence.
 * Pure module: analysis and CSV generation; no network, browser APIs or mutation.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ChronosIntelligence=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  function dayKey(date) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function validDay(value) {
    if(typeof value!=='string'||!iso.test(value))return false;
    const [y,m,d]=value.split('-').map(Number);
    const day=new Date(y,m-1,d,12);
    return dayKey(day)===value;
  }
  function calendarDays(today,count=84) {
    if(!validDay(today)||!Number.isInteger(count)||count<1||count>366)return [];
    const [y,m,d]=today.split('-').map(Number);
    return Array.from({length:count},(_,i)=>{
      const point=new Date(y,m-1,d-(count-1-i),12);
      return dayKey(point);
    });
  }
  function nonnegative(value) {
    return Number.isFinite(value)&&value>=0?Math.min(value,1e10):0;
  }
  function completedOn(task,day) {
    return Boolean(task?.done&&Number.isFinite(task.completedAt)&&dayKey(new Date(task.completedAt))===day);
  }
  function timeline(snapshot,today,count=84) {
    const daily=snapshot?.stats?.daily||{},tasks=Array.isArray(snapshot?.tasks)?snapshot.tasks:[];
    return calendarDays(today,count).map(day=>{
      const dayStat=daily[day]||{};
      const sessions=Math.floor(nonnegative(dayStat.sessions));
      const focusSeconds=Math.floor(nonnegative(dayStat.focusSeconds));
      const completed=tasks.reduce((n,task)=>n+(completedOn(task,day)?1:0),0);
      return {day,sessions,focusSeconds,completed,activity:sessions+completed};
    });
  }
  function summary(snapshot,today,count=7) {
    const records=timeline(snapshot,today,count);
    const sessions=records.reduce((n,r)=>n+r.sessions,0);
    const focusSeconds=records.reduce((n,r)=>n+r.focusSeconds,0);
    const completed=records.reduce((n,r)=>n+r.completed,0);
    const activeDays=records.filter(x=>x.activity>0).length;
    return {sessions,focusSeconds,completed,activeDays,days:records.length,
      avgMinutesPerActiveDay:activeDays?Math.round(focusSeconds/60/activeDays):0};
  }
  function comparisons(tasks,limit=8) {
    if(!Array.isArray(tasks))return [];
    return tasks.filter(t=>t&&Number.isFinite(t.focusSeconds)&&t.focusSeconds>0)
      .map(t=>({
        id:String(t.id||''),text:String(t.text||'Untitled mission').slice(0,120),
        estimatedMins:Math.max(0,Math.min(480,Number(t.estimateMins)||0)),
        trackedMins:Math.round(nonnegative(t.focusSeconds)/60),
        done:Boolean(t.done),
        ratio:Math.max(0,Number(t.estimateMins)||0)? Math.round(nonnegative(t.focusSeconds)/60/Number(t.estimateMins)*100):null
      }))
      .sort((a,b)=>b.trackedMins-a.trackedMins)
      .slice(0,Math.max(0,Math.min(30,limit)));
  }
  function exportRows(snapshot,today) {
    const rows=[['MASUM CHRONOS','Productivity Intelligence Report','Generated',today],
      [],['DAY','FOCUS SESSIONS','RECORDED FOCUS MINUTES','COMPLETED MISSIONS']];
    for(const item of timeline(snapshot,today,84))
      rows.push([item.day,item.sessions,+(item.focusSeconds/60).toFixed(2),item.completed]);
    const week=summary(snapshot,today,7);
    rows.push([],['LAST 7 DAYS','Sessions',week.sessions,'Completed missions',week.completed,'Focus minutes',+(week.focusSeconds/60).toFixed(2)],
      [],['MISSION','STATUS','ESTIMATED MINUTES','RECORDED FOCUS MINUTES','DUE DATE','PLANNED DATE']);
    for(const t of Array.isArray(snapshot?.tasks)?snapshot.tasks:[])
      rows.push([String(t.text||''),t.done?'Completed':'Open',Number(t.estimateMins)||0,
        Number(t.focusSeconds)>0?+(t.focusSeconds/60).toFixed(2):'Not tracked',
        String(t.dueDate||''),String(t.planDate||'')]);
    return rows;
  }
  function quoteCsv(value) {
    let s=String(value??'');
    // Spreadsheet software interprets these as formulas. Keep user task titles inert.
    if(/^[\s\x00-\x1f]*[=+\-@]/.test(s)) s="'"+s;
    s=s.replace(/\r\n?/g,'\n');
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function csv(snapshot,today) {
    return '\uFEFF'+exportRows(snapshot,today).map(row=>row.map(quoteCsv).join(',')).join('\r\n')+'\r\n';
  }
  return Object.freeze({dayKey,validDay,calendarDays,timeline,summary,comparisons,exportRows,quoteCsv,csv});
});
