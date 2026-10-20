/* MASUM CHRONOS v2.1 — dependency-safe, local-first mission helpers.
 * Pure browser + Node module; no network, no storage, no timers.
 */
(function (root, build) {
  'use strict';
  const engine = build();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.ChronosMissionEngine = engine;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const RECURRENCE = Object.freeze(['none','daily','weekly','monthly']);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  function validDate(value) {
    if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
    const d = new Date(value+'T12:00:00');
    return !Number.isNaN(d.getTime()) && localDay(d) === value;
  }
  function localDay(date) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function extras(input, selfId = '') {
    const t = input && typeof input === 'object' ? input : {};
    const recurrence = RECURRENCE.includes(t.recurrence) ? t.recurrence : 'none';
    const dependsOn = Array.isArray(t.dependsOn) ? [...new Set(t.dependsOn
      .filter(id => typeof id === 'string' && id.length > 0 && id.length <= 100 && id !== selfId))].slice(0,8) : [];
    const reminderTime = TIME_RE.test(t.reminderTime) ? t.reminderTime : '';
    const estimateMins = Number.isInteger(t.estimateMins) && t.estimateMins >= 0 && t.estimateMins <= 480 ? t.estimateMins : 0;
    const seriesId = typeof t.seriesId === 'string' && t.seriesId.length <= 100 ? t.seriesId : '';
    // Persist the calendar series' original date to avoid month-end drift.
    const recurrenceAnchor = validDate(t.recurrenceAnchor) ? t.recurrenceAnchor : '';
    return {recurrence,dependsOn,reminderTime,estimateMins,seriesId,recurrenceAnchor};
  }
  function dependencyStatus(tasks, task) {
    const byId = new Map(tasks.map(t=>[t.id,t]));
    const required = Array.isArray(task.dependsOn) ? task.dependsOn : [];
    const waiting = required.filter(id => id !== task.id && (!byId.has(id) || !byId.get(id).done));
    return {blocked:waiting.length>0,waiting,
      names:waiting.map(id=>byId.get(id)?.text || 'Unavailable mission')};
  }
  function hasCycle(tasks, id, requested) {
    if (requested.includes(id)) return true;
    const byId = new Map(tasks.map(t=>[t.id,t]));
    const visit = (node, seen) => {
      if (node===id) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      const t=byId.get(node);
      if (!t) return false;
      return (Array.isArray(t.dependsOn)?t.dependsOn:[]).some(x=>visit(x,seen));
    };
    return requested.some(dep=>visit(dep,new Set()));
  }
  function nextDate(base, recurrence, today) {
    if (!validDate(today) || !RECURRENCE.includes(recurrence) || recurrence==='none') return '';
    const date = validDate(base) ? base : today;
    // UTC calendar arithmetic for DATE-ONLY recurrence; using local elapsed
    // milliseconds drifts on daylight-saving transitions (23/25-hour days).
    if (recurrence==='daily' || recurrence==='weekly') {
      const asDay = value => {
        const [year, month, day] = value.split('-').map(Number);
        return Date.UTC(year, month-1, day);
      };
      const interval = (recurrence === 'daily' ? 1 : 7)*86400000;
      const start = asDay(date), now = asDay(today);
      const steps = Math.max(1, Math.floor((now-start)/interval)+1);
      const result = new Date(start+steps*interval);
      return result.toISOString().slice(0,10);
    }
    // Monthly cadence uses the original day-of-month anchored to the series.
    const target = new Date(date+'T12:00:00');
    const day = target.getDate();
    for (let count=0;count<240;count++) {
      const next = new Date(target.getFullYear(),target.getMonth()+count+1,1,12);
      const days = new Date(next.getFullYear(),next.getMonth()+1,0).getDate();
      next.setDate(Math.min(day,days));
      if (localDay(next)>today) return localDay(next);
    }
    return '';
  }
  function nextOccurrence(task, allTasks, today, now = Date.now()) {
    if (!task.done || !task.recurrence || task.recurrence==='none') return null;
    const anchor = validDate(task.recurrenceAnchor) ? task.recurrenceAnchor : task.dueDate;
    const dueDate = nextDate(anchor, task.recurrence, today);
    if (!dueDate) return null;
    const seriesId = (task.seriesId || task.id).slice(0,72);
    const id = seriesId+'~'+dueDate.replace(/-/g,'');
    if (allTasks.some(t=>t.id===id)) return null;
    return { ...task, id, seriesId, recurrenceAnchor:anchor, dueDate, done:false, completedAt:null,
      createdAt:now, modifiedAt:now, dependsOn:[], reminderTime:task.reminderTime || '' };
  }
  function reminderCandidates(tasks, today, timeHHMM, receipts = {}) {
    return tasks.filter(t=>!t.done && validDate(t.dueDate) && t.dueDate<=today &&
      (!t.reminderTime || t.dueDate<today || t.reminderTime<=timeHHMM) && !receipts[t.id]);
  }
  function score(t, today) {
    const base={critical:45,high:30,medium:20,low:10}[t.priority] || 10;
    const urgency = t.dueDate ? (t.dueDate<today?45:t.dueDate===today?30:0) : 0;
    const duration = t.estimateMins>0 && t.estimateMins<=30 ? 7 : 0;
    return base+urgency+duration;
  }
  function overview(tasks, today) {
    const open=tasks.filter(t=>!t.done);
    const ready=open.filter(t=>!dependencyStatus(tasks,t).blocked);
    const blocked=open.length-ready.length;
    const due=open.filter(t=>t.dueDate && t.dueDate<=today).length;
    const planned=ready.reduce((total,t)=>total+(t.estimateMins||0),0);
    return {ready:ready.length,blocked,due,planned,
      recommended:ready.sort((a,b)=>score(b,today)-score(a,today) || a.createdAt-b.createdAt)[0]||null};
  }
  return Object.freeze({RECURRENCE,validDate,extras,dependencyStatus,hasCycle,nextDate,nextOccurrence,reminderCandidates,overview,score});
});
