/* MASUM CHRONOS — shared Chrome/PWA + VS Code webview client. No dependencies. */
(() => {
  'use strict';
  const VERSION = '1.2.0';
  const SYNC_KEY_STORAGE = 'masum-chronos.local-sync-key.v1';
  const SYNC_URL = 'http://127.0.0.1:46469/v1/sync';
  const STORAGE_KEY = 'masum-chronos-v1';
  const CIRCUMFERENCE = 2 * Math.PI * 178;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const MINUTE = 60_000;
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  const inVSCode = Boolean(vscode);
  let audioCtx;
  let soundNodes = [];
  let toastTimeout;
  let lastRenderedSecond = -1;
  let lastTitle = '';
  let currentTaskFilter = 'all';
  let currentTaskSearch = '';
  let editingTaskId = null;
  let syncKey = '';
  try { if(!inVSCode) syncKey = localStorage.getItem(SYNC_KEY_STORAGE) || ''; } catch {}
  let syncBusy = false;
  let syncLastStatus = '';

  const dateKey = (date = new Date()) => {
    const y = date.getFullYear();
    return `${y}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const initial = () => ({
    version: VERSION, updatedAt: Date.now(), mode: 'focus', workspace: 'timer', activeTaskId: null, theme: 'nebula',
    focus: { phase: 'focus', focusMins: 25, shortMins: 5, longMins: 15, longEvery: 4, rounds: 0 },
    timers: {
      focus: { durationMs: 25 * MINUTE, remainingMs: 25 * MINUTE, endsAt: null },
      countdown: { durationMs: 15 * MINUTE, remainingMs: 15 * MINUTE, endsAt: null }
    },
    stopwatch: { elapsedMs: 0, startedAt: null, laps: [] },
    settings: { autoBreak: false, autoFocus: false, alertSound: true, volume: 30, soundscape: 'off' },
    tasks: [], deletedTasks: {},
    stats: { sessions: 0, totalFocusSeconds: 0, daily: {} }
  });
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }
  const PRIORITIES = { low: 0, medium: 1, high: 2, critical: 3 };
  const CATEGORIES = ['Code', 'Study', 'Work', 'Personal'];
  function sanitizeTask(task) {
    return {
      id: String(task.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 100),
      text: task.text.trim().slice(0, 120), done: Boolean(task.done),
      priority: Object.hasOwn(PRIORITIES, task.priority) ? task.priority : 'medium',
      category: CATEGORIES.includes(task.category) ? task.category : 'Personal',
      dueDate: typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) && !Number.isNaN(new Date(task.dueDate+'T12:00:00').getTime()) ? task.dueDate : '',
      createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
      completedAt: Number.isFinite(task.completedAt) ? task.completedAt : null,
      modifiedAt: Number.isFinite(task.modifiedAt) ? task.modifiedAt : (Number.isFinite(task.completedAt) ? task.completedAt : (Number.isFinite(task.createdAt) ? task.createdAt : Date.now()))
    };
  }
  function isOverdue(task) { return !task.done && Boolean(task.dueDate) && task.dueDate < dateKey(); }
  function completeTask(task) { task.done = !task.done; task.completedAt = task.done ? Date.now() : null; task.modifiedAt = Date.now(); persist(); renderTasks(); }
  function addTask(text, options = {}) {
    const clean = text.trim().slice(0, 120);
    if (!clean) return safeToast('Enter a mission title first.');
    if (state.tasks.length >= 300) return safeToast('Maximum 300 missions supported. Clear completed missions to make space.');
    const task = sanitizeTask({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, text: clean, done: false, priority: options.priority || 'medium', category: options.category || 'Personal', dueDate: options.dueDate || '', createdAt: Date.now(), modifiedAt: Date.now() });
    state.tasks.unshift(task); persist(); renderTasks(); safeToast('Mission deployed.');
    return task;
  }
  function removeTask(task) {
    state.tasks = state.tasks.filter(t => t.id !== task.id);
    state.deletedTasks[task.id] = Date.now();
    if (state.activeTaskId === task.id) state.activeTaskId = null;
    persist(); renderTasks();
  }
  function selectMission(task) {
    if (state.mode !== 'focus') pauseActive();
    state.activeTaskId = task.id; state.mode = 'focus'; state.workspace = 'timer';
    // Preserve the Focus timer deadline; pause another active timer mode before switching.
    persist(); render(); safeToast(`Focus target: ${task.text}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function switchWorkspace(workspace) {
    if (!['timer', 'tasks'].includes(workspace)) return;
    state.workspace = workspace; persist(); renderWorkspace(); renderTasks();
  }
  function renderWorkspace() {
    const isTimer = state.workspace !== 'tasks';
    $('timer-workspace').classList.toggle('hidden', !isTimer);
    $('timer-mode-switch').classList.toggle('hidden', !isTimer);
    $('todo-workspace').classList.toggle('hidden', isTimer);
    $$('[data-workspace]').forEach(b => { const active = b.dataset.workspace === state.workspace; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
  }
  function normalize(raw) {
    const def = initial();
    if (!raw || typeof raw !== 'object' || !['1.0.0', '1.1.0', VERSION].includes(raw.version)) return def;
    const s = {
      ...def, ...raw,
      focus: { ...def.focus, ...raw.focus },
      timers: { focus: { ...def.timers.focus, ...raw.timers?.focus }, countdown: { ...def.timers.countdown, ...raw.timers?.countdown } },
      stopwatch: { ...def.stopwatch, ...raw.stopwatch },
      settings: { ...def.settings, ...raw.settings },
      stats: { ...def.stats, ...raw.stats, daily: raw.stats?.daily && typeof raw.stats.daily === 'object' ? raw.stats.daily : {} },
      tasks: Array.isArray(raw.tasks) ? raw.tasks.slice(0, 300).filter(t => t && typeof t.text === 'string').map(sanitizeTask) : [],
      deletedTasks: raw.deletedTasks && typeof raw.deletedTasks === 'object' && !Array.isArray(raw.deletedTasks) ? raw.deletedTasks : {}
    };
    if (!['focus', 'countdown', 'stopwatch'].includes(s.mode)) s.mode = 'focus';
    if (!['timer', 'tasks'].includes(s.workspace)) s.workspace = 'timer';
    s.version = VERSION;
    if (!['nebula', 'cyber', 'aurora', 'minimal'].includes(s.theme)) s.theme = 'nebula';
    if (!['focus', 'short', 'long'].includes(s.focus.phase)) s.focus.phase = 'focus';
    for (const key of ['focus', 'countdown']) {
      const t = s.timers[key];
      if (!Number.isFinite(t.durationMs) || t.durationMs <= 0) t.durationMs = def.timers[key].durationMs;
      if (!Number.isFinite(t.remainingMs) || t.remainingMs < 0) t.remainingMs = t.durationMs;
      if (!Number.isFinite(t.endsAt) || t.endsAt < 0) t.endsAt = null;
    }
    if (!Number.isFinite(s.stopwatch.elapsedMs) || s.stopwatch.elapsedMs < 0) s.stopwatch.elapsedMs = 0;
    if (!Number.isFinite(s.stopwatch.startedAt)) s.stopwatch.startedAt = null;
    if (!Array.isArray(s.stopwatch.laps)) s.stopwatch.laps = [];
    return s;
  }
  let state = normalize(vscode?.getState?.() || loadLocal());
  function sendHost(type, extra = {}) {
    if (vscode) vscode.postMessage({ type, ...extra });
  }
  function persist() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (vscode) {
      vscode.setState(state);
      sendHost('snapshot', { state });
    }
  }
  // Missions sync only; running timers and statistics stay device-local.
  function applySyncedMissions(remote) {
    if (!remote || !Array.isArray(remote.tasks) || remote.tasks.length > 300) return;
    const taskMap = new Map(state.tasks.map(t => [t.id, sanitizeTask(t)]));
    const deleted = { ...state.deletedTasks };
    for (const [id, ts] of Object.entries(remote.deletedTasks || {}).slice(0,900)) {
      if (id.length <= 100 && Number.isFinite(ts) && ts > 0) deleted[id] = Math.max(deleted[id]||0, ts);
    }
    for (const item of remote.tasks) {
      if (!item || typeof item.id !== 'string' || typeof item.text !== 'string' || !item.text.trim()) continue;
      const incoming = sanitizeTask(item), existing = taskMap.get(incoming.id);
      if (!existing || incoming.modifiedAt > existing.modifiedAt || (incoming.modifiedAt === existing.modifiedAt && JSON.stringify(incoming) > JSON.stringify(existing))) taskMap.set(incoming.id, incoming);
    }
    for (const [id, item] of taskMap) {
      if ((deleted[id]||0) >= item.modifiedAt) taskMap.delete(id);
      else if (deleted[id]) delete deleted[id];
    }
    const tasks = [...taskMap.values()].sort((a,b)=>b.createdAt-a.createdAt || a.id.localeCompare(b.id)).slice(0,300);
    const deletedTasks = Object.fromEntries(Object.entries(deleted).sort((a,b)=>b[1]-a[1]).slice(0,900));
    if (JSON.stringify(tasks) === JSON.stringify(state.tasks) && JSON.stringify(deletedTasks) === JSON.stringify(state.deletedTasks)) return;
    state.tasks = tasks; state.deletedTasks = deletedTasks;
    if (state.activeTaskId && !tasks.some(t=>t.id===state.activeTaskId)) state.activeTaskId = null;
    persist(); renderTasks();
  }
  function syncStatus(message, connected=false) {
    if(syncLastStatus === message) return;
    syncLastStatus = message;
    const item = $('sync-status');
    if(item) { item.textContent=message; item.dataset.connected=String(connected); }
  }
  async function exchangeMissions(key = syncKey) {
    if (inVSCode || !key || syncBusy) return false;
    syncBusy = true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),3000);
      let response;
      try {
        response = await fetch(SYNC_URL,{
          method:'POST',mode:'cors',targetAddressSpace:'loopback',cache:'no-store',signal:controller.signal,
          headers:{'Content-Type':'application/json','X-Chronos-Key':key},
          body:JSON.stringify({tasks:state.tasks,deletedTasks:state.deletedTasks})
        });
      } finally {clearTimeout(timeout);}
      if(!response.ok) throw new Error(response.status===401?'Pairing key is incorrect':'Bridge returned '+response.status);
      const payload=await response.json();
      if(!payload.ok) throw new Error('Invalid sync response');
      applySyncedMissions(payload);
      syncStatus('CONNECTED · Tasks sync every 2.5 seconds',true);
      return true;
    } catch(err) {
      syncStatus('OFFLINE · '+(err.message || 'Bridge unavailable'));
      return false;
    } finally {syncBusy=false;}
  }
  function safeToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 3700);
  }
  function boundedInt(value, min, max, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function phaseDuration(phase = state.focus.phase) {
    return (phase === 'focus' ? state.focus.focusMins : phase === 'short' ? state.focus.shortMins : state.focus.longMins) * MINUTE;
  }
  function timerRemaining(mode) {
    const t = state.timers[mode];
    return t.endsAt ? Math.max(0, t.endsAt - Date.now()) : Math.max(0, t.remainingMs);
  }
  function elapsedStopwatch() {
    return state.stopwatch.elapsedMs + (state.stopwatch.startedAt ? Math.max(0, Date.now() - state.stopwatch.startedAt) : 0);
  }
  function formatTime(ms, forceHours = false) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours || forceHours
      ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  function formatFocus(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs ? `${hrs}h ${mins}m` : `${mins}m`;
  }
  function pauseActive() {
    if (state.mode === 'stopwatch') {
      if (state.stopwatch.startedAt) {
        state.stopwatch.elapsedMs = elapsedStopwatch();
        state.stopwatch.startedAt = null;
      }
    } else {
      const t = state.timers[state.mode];
      if (t.endsAt) {
        t.remainingMs = timerRemaining(state.mode);
        t.endsAt = null;
      }
    }
  }
  function switchMode(next) {
    if (state.mode === next) return;
    pauseActive();
    state.mode = next;
    state.workspace = 'timer';
    lastRenderedSecond = -1;
    persist();
    render();
  }
  function setPhase(next, shouldPersist = true) {
    state.timers.focus.endsAt = null;
    state.focus.phase = next;
    state.timers.focus.durationMs = phaseDuration(next);
    state.timers.focus.remainingMs = phaseDuration(next);
    if (shouldPersist) persist();
    render();
  }
  function setCountdown(seconds) {
    const t = state.timers.countdown;
    t.endsAt = null;
    t.durationMs = seconds * 1000;
    t.remainingMs = t.durationMs;
    persist(); render();
  }
  function unlockAudio() {
    if (!audioCtx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) audioCtx = new Audio();
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
  }
  function beep() {
    if (!state.settings.alertSound) return;
    unlockAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [0, .2, .42].forEach((delay, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = [659.25, 783.99, 987.77][i];
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(.09, now + delay + .028);
      g.gain.exponentialRampToValueAtTime(.0001, now + delay + .22);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + delay); o.stop(now + delay + .24);
    });
  }
  function notify(message) {
    if (!inVSCode && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('MASUM CHRONOS', { body: message, icon: './icon-192.png', tag: 'chronos-finish' }); } catch {}
    }
  }
  function completeTimer(mode) {
    const t = state.timers[mode];
    if (!t.endsAt || t.endsAt > Date.now()) return;
    const completedDeadline = t.endsAt;
    t.endsAt = null; t.remainingMs = 0;
    let message = 'Countdown complete. Mission accomplished.';
    let autoStart = false;
    if (mode === 'focus') {
      const phase = state.focus.phase;
      if (phase === 'focus') {
        state.focus.rounds += 1;
        state.stats.sessions += 1;
        const seconds = Math.round(t.durationMs / 1000);
        state.stats.totalFocusSeconds += seconds;
        const today = dateKey();
        const day = state.stats.daily[today] || { sessions: 0, focusSeconds: 0 };
        day.sessions += 1; day.focusSeconds += seconds;
        state.stats.daily[today] = day;
        const nextPhase = state.focus.rounds % state.focus.longEvery === 0 ? 'long' : 'short';
        message = nextPhase === 'long' ? 'Focus session complete! Enjoy your long break.' : 'Focus session complete! Take a short break.';
        setPhase(nextPhase, false);
        autoStart = state.settings.autoBreak;
      } else {
        message = 'Break complete. Time to build something great!';
        setPhase('focus', false);
        autoStart = state.settings.autoFocus;
      }
    }
    beep(); notify(message); safeToast(message);
    sendHost('finished', { deadline: completedDeadline, message });
    if (autoStart) state.timers.focus.endsAt = Date.now() + state.timers.focus.remainingMs;
    persist(); render();
  }
  function toggleTimer() {
    unlockAudio();
    if (state.mode === 'stopwatch') {
      if (state.stopwatch.startedAt) pauseActive();
      else state.stopwatch.startedAt = Date.now();
    } else {
      const t = state.timers[state.mode];
      if (t.endsAt) pauseActive();
      else {
        if (t.remainingMs <= 0) t.remainingMs = t.durationMs;
        t.endsAt = Date.now() + t.remainingMs;
      }
    }
    persist(); render();
  }
  function resetTimer() {
    if (state.mode === 'stopwatch') state.stopwatch = { elapsedMs: 0, startedAt: null, laps: [] };
    else {
      const t = state.timers[state.mode];
      t.endsAt = null; t.remainingMs = t.durationMs;
    }
    persist(); render();
  }
  function lap() {
    if (!state.stopwatch.startedAt) return safeToast('Start the stopwatch before recording a lap.');
    const total = elapsedStopwatch();
    const previous = state.stopwatch.laps[0]?.total || 0;
    state.stopwatch.laps.unshift({ total, split: total - previous });
    state.stopwatch.laps = state.stopwatch.laps.slice(0, 50);
    persist(); renderLaps();
  }
  function doNext() {
    if (state.mode === 'focus') {
      const phase = state.focus.phase;
      setPhase(phase === 'focus' ? (state.focus.rounds && state.focus.rounds % state.focus.longEvery === 0 ? 'long' : 'short') : 'focus');
    } else if (state.mode === 'countdown') $('custom-dialog').showModal();
    else lap();
  }
  function todayStats() { return state.stats.daily[dateKey()] || { sessions: 0, focusSeconds: 0 }; }
  function dayStreak() {
    let n = 0; const date = new Date();
    if (!state.stats.daily[dateKey(date)]?.sessions) date.setDate(date.getDate() - 1);
    for (let i = 0; i < 730; i++) {
      if ((state.stats.daily[dateKey(date)]?.sessions || 0) === 0) break;
      n++; date.setDate(date.getDate() - 1);
    }
    return n;
  }
  function renderLaps() {
    const list = $('laps-list'); list.replaceChildren();
    $('laps-count').textContent = `${String(state.stopwatch.laps.length).padStart(2, '0')} TOTAL`;
    if (!state.stopwatch.laps.length) {
      const empty = document.createElement('li'); empty.className = 'empty-state';
      empty.textContent = 'Start stopwatch and hit Lap to record a split.'; list.append(empty); return;
    }
    state.stopwatch.laps.forEach((lapItem, i) => {
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = `LAP ${String(state.stopwatch.laps.length - i).padStart(2, '0')}`;
      b.textContent = `${formatTime(lapItem.split)} / ${formatTime(lapItem.total)}`;
      li.append(a, b); list.append(li);
    });
  }
  function createIconButton(icon, label, cssClass, fn) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = cssClass;
    button.title = label; button.setAttribute('aria-label', label);
    button.innerHTML = `<svg><use href="#i-${icon}"></use></svg>`;
    button.addEventListener('click', fn);
    return button;
  }
  function openTaskEditor(task) {
    editingTaskId = task.id;
    $('edit-task-text').value = task.text;
    $('edit-task-priority').value = task.priority;
    $('edit-task-category').value = task.category;
    $('edit-task-due').value = task.dueDate;
    $('edit-task-dialog').showModal();
  }
  function prettyDueDate(value) {
    if (!value) return '';
    if (value === dateKey()) return 'Due today';
    const d = new Date(`${value}T12:00:00`);
    return `Due ${d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'})}`;
  }
  function renderTaskRow(task, compact = false) {
    const row = document.createElement('article');
    row.className = `mission-row ${task.done ? 'is-done' : ''} ${isOverdue(task) ? 'is-overdue' : ''}`;
    const check = createIconButton('check', task.done ? `Reopen ${task.text}` : `Complete ${task.text}`, 'mission-check', () => completeTask(task));
    const info = document.createElement('div'); info.className = 'mission-info';
    const name = document.createElement('h3'); name.textContent = task.text;
    const tags = document.createElement('div'); tags.className = 'mission-tags';
    const cat = document.createElement('span'); cat.className = 'mission-category'; cat.textContent = task.category.toUpperCase();
    const prio = document.createElement('span'); prio.className = `mission-priority priority-${task.priority}`; prio.textContent = `◆ ${task.priority.toUpperCase()}`;
    tags.append(cat, prio);
    if (task.dueDate) { const due = document.createElement('span'); due.className = `mission-due ${isOverdue(task) ? 'late' : ''}`; due.textContent = `${isOverdue(task) ? '⚠ ' : ''}${prettyDueDate(task.dueDate)}`; tags.append(due); }
    info.append(name,tags);
    const actions = document.createElement('div'); actions.className = 'mission-actions';
    if (!task.done) { const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'mission-focus'; focus.textContent = '◉ FOCUS'; focus.addEventListener('click', () => selectMission(task)); actions.append(focus); }
    actions.append(createIconButton('pencil',`Edit ${task.text}`,'mission-icon-btn',()=>openTaskEditor(task)));
    actions.append(createIconButton('trash',`Delete ${task.text}`,'mission-icon-btn danger',()=>removeTask(task)));
    row.append(check,info,actions);
    return row;
  }
  function sortedFilteredTasks() {
    let items = state.tasks.filter(t => {
      if (currentTaskSearch && !`${t.text} ${t.category} ${t.priority}`.toLowerCase().includes(currentTaskSearch)) return false;
      if (currentTaskFilter === 'today') return !t.done && t.dueDate === dateKey();
      if (currentTaskFilter === 'upcoming') return !t.done && t.dueDate > dateKey();
      if (currentTaskFilter === 'overdue') return isOverdue(t);
      if (currentTaskFilter === 'completed') return t.done;
      return true;
    });
    const sortBy = $('todo-sort').value;
    items = items.sort((a,b) => {
      if (sortBy === 'recent') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'due') return Number(a.done) - Number(b.done) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || PRIORITIES[b.priority] - PRIORITIES[a.priority];
      return Number(a.done) - Number(b.done) || PRIORITIES[b.priority] - PRIORITIES[a.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt - a.createdAt;
    });
    return items;
  }
  function renderTasks() {
    const parent = $('tasks'); parent.replaceChildren();
    const complete = state.tasks.filter(t => t.done).length;
    const active = state.tasks.length - complete;
    $('task-count').textContent = `${complete}/${state.tasks.length}`;
    $('nav-pending').textContent = String(active);
    const quick = state.tasks.filter(t => !t.done).sort((a,b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]).slice(0, 5);
    if (!quick.length) {
      const p = document.createElement('p'); p.className='no-tasks'; p.textContent = state.tasks.length ? 'All objectives cleared. Open Mission Control for history.' : 'The mission queue is empty. Add your first objective below.'; parent.append(p);
    }
    quick.forEach(task => {
      const el = document.createElement('div'); el.className = 'task-item';
      const check = createIconButton('check',`Complete ${task.text}`,'task-check',()=>completeTask(task));
      const txt = document.createElement('span'); txt.className='task-text'; txt.textContent=task.text; txt.title = task.text;
      const del = createIconButton('trash',`Delete ${task.text}`,'task-delete',()=>removeTask(task));
      el.append(check,txt,del);parent.append(el);
    });
    if (active > 5) {const more=document.createElement('button');more.type='button';more.className='task-view-all';more.textContent=`+ ${active-5} MORE MISSIONS →`;more.addEventListener('click',()=>switchWorkspace('tasks'));parent.append(more);}
    $('todo-kpi-total').textContent=String(state.tasks.length).padStart(2,'0');
    $('todo-kpi-active').textContent=String(active).padStart(2,'0');
    $('todo-kpi-done').textContent=String(complete).padStart(2,'0');
    $('todo-kpi-overdue').textContent=String(state.tasks.filter(isOverdue).length).padStart(2,'0');
    const pct = state.tasks.length ? Math.round(100 * complete / state.tasks.length) : 0;
    $('todo-progress-pct').textContent=`${pct}%`;
    $('todo-progress-wheel').style.setProperty('--progress',`${pct}%`);
    $('todo-progress-fraction').textContent=`${complete} / ${state.tasks.length}`;
    $('todo-progress-title').textContent=pct===100 && state.tasks.length ? 'All missions cleared' : active ? 'Your future is in motion' : 'Ready to launch';
    $('todo-progress-message').textContent=active ? `${active} active mission${active === 1 ? '' : 's'}. Keep moving forward.` : 'Every great project begins with one action.';
    const next = state.tasks.filter(t=>!t.done).sort((a,b)=>PRIORITIES[b.priority]-PRIORITIES[a.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0];
    $('todo-next-content').replaceChildren();
    const nextBtn=$('todo-focus-next'); nextBtn.disabled=!next;
    nextBtn.onclick= next ? ()=>selectMission(next) : null;
    if(next) {
      const h=document.createElement('h3');h.textContent=next.text;
      const meta=document.createElement('p');meta.textContent=`${next.priority.toUpperCase()} PRIORITY · ${next.category.toUpperCase()}${next.dueDate ? ` · ${prettyDueDate(next.dueDate)}` : ''}`;
      $('todo-next-content').append(h,meta);
    } else {const p=document.createElement('p');p.textContent='No active missions. Deploy a new objective to begin.';$('todo-next-content').append(p);}
    const target=state.tasks.find(t=>t.id === state.activeTaskId);
    $('focus-target').classList.toggle('hidden', !target);
    if(target) $('focus-target').textContent=`◉ CURRENT MISSION / ${target.text}`;
    const items=sortedFilteredTasks();
    $('todo-visible-count').textContent=`${items.length} OBJECTIVE${items.length===1?'':'S'}`;
    const list=$('todo-items');list.replaceChildren();
    if(!items.length){
      const empty=document.createElement('div');empty.className='todo-empty';
      const symbol=document.createElement('div');symbol.className='empty-symbol';symbol.textContent='✧';
      const title=document.createElement('strong');title.textContent=state.tasks.length ? 'NO MATCHING MISSIONS' : 'YOUR MISSION BOARD IS CLEAR';
      const desc=document.createElement('span');desc.textContent=state.tasks.length ? 'Try a different filter or search term.' : 'Add your first task to bring your plans to life.';
      empty.append(symbol,title,desc);list.append(empty);
    }
    for (const task of items) list.append(renderTaskRow(task));
    $('clear-completed').disabled=complete===0;
  }
  function renderStats() {
    const today = todayStats();
    $('daily-sessions').textContent = today.sessions;
    $('daily-progress').style.width = `${Math.min(100, (today.sessions / 6) * 100)}%`;
    $('daily-hint').textContent = today.sessions >= 6 ? 'Mission accomplished. Brilliant work!' : `${Math.max(0, 6 - today.sessions)} focus sessions to reach your daily target.`;
    $('daily-time').textContent = formatFocus(today.focusSeconds);
    $('day-streak').textContent = `${dayStreak()} ${dayStreak() === 1 ? 'day' : 'days'}`;
    const total = state.stats.totalFocusSeconds;
    $('total-time').innerHTML = `${Math.floor(total / 3600)}<small>h</small> ${Math.floor(total % 3600 / 60)}<small>m</small>`;
    $('total-sessions').textContent = String(state.stats.sessions).padStart(2, '0');
    const counts = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i);
      counts.push({ sessions: state.stats.daily[dateKey(day)]?.sessions || 0, name: day.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), today: i === 0 });
    }
    const max = Math.max(6, ...counts.map((d) => d.sessions));
    $('week-chart').replaceChildren();
    for (const data of counts) {
      const col = document.createElement('div'); col.className = 'chart-item';
      const bar = document.createElement('div');
      bar.className = `chart-column${data.today ? ' today' : ''}${!data.sessions ? ' empty' : ''}`;
      bar.style.height = `${Math.max(6, (data.sessions / max) * 65)}px`;
      bar.title = `${data.name}: ${data.sessions} focus sessions`;
      const day = document.createElement('span'); day.textContent = data.name;
      col.append(bar, day); $('week-chart').append(col);
    }
    $('week-total').textContent = `${counts.reduce((a, v) => a + v.sessions, 0)} SESSIONS`;
  }
  function isRunning() {
    return state.mode === 'stopwatch' ? Boolean(state.stopwatch.startedAt) : Boolean(state.timers[state.mode].endsAt);
  }
  function updateDisplay() {
    const mode = state.mode;
    let ms = mode === 'stopwatch' ? elapsedStopwatch() : timerRemaining(mode);
    const formatted = formatTime(ms, mode === 'stopwatch');
    $('timer-display').textContent = formatted;
    $('timer-display').classList.toggle('compact', formatted.length > 5);
    const active = isRunning();
    const ratio = mode === 'stopwatch' ? (ms % MINUTE) / MINUTE : Math.min(1, ms / (state.timers[mode].durationMs || 1));
    const offset = CIRCUMFERENCE * (1 - ratio);
    $('progress-ring').style.strokeDasharray = String(CIRCUMFERENCE);
    $('progress-ring').style.strokeDashoffset = String(offset);
    const glow = document.querySelector('.circle-progress-glow');
    glow.style.strokeDasharray = String(CIRCUMFERENCE);
    glow.style.strokeDashoffset = String(offset);
    $('timer-status').classList.toggle('running', active);
    $('timer-status').querySelector('span:last-child').textContent = active ? 'SESSION IN PROGRESS' : ms <= 0 ? 'SESSION COMPLETE' : 'READY WHEN YOU ARE';
    $('primary-icon').querySelector('use').setAttribute('href', active ? '#i-pause' : '#i-play');
    $('primary-label').textContent = active ? 'PAUSE' : mode === 'stopwatch' ? 'START CLOCK' : mode === 'countdown' ? 'START TIMER' : state.focus.phase === 'focus' ? 'BEGIN FOCUS' : 'START BREAK';
    $('primary-btn').setAttribute('aria-label', active ? 'Pause timer' : 'Start timer');
    const browserTitle = `${formatted} • MASUM CHRONOS`;
    if (browserTitle !== lastTitle) { document.title = browserTitle; lastTitle = browserTitle; }
  }
  function render() {
    document.body.dataset.theme = state.theme;
    $$('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    const mode = state.mode;
    const copy = {
      focus: ['Enter your <em>flow state.</em>', 'One session at a time. Make every second count.', 'POMODORO PROTOCOL', 'YOUR FOCUS TIME', 'Breathe. Focus. Create.'],
      countdown: ['Own every <em>second.</em>', 'Count down to the moments that matter.', 'COUNTDOWN PROTOCOL', 'TIME REMAINING', 'Your deadline. Your rules.'],
      stopwatch: ['Measure your <em>momentum.</em>', 'Precision is a superpower.', 'STOPWATCH PROTOCOL', 'TIME ELAPSED', 'Make the next lap count.']
    }[mode];
    $('hero-title').innerHTML = copy[0];
    $('hero-subtitle').textContent = copy[1];
    $('context-text').textContent = copy[2];
    $('timer-label').textContent = copy[3];
    $('timer-subtext').textContent = copy[4];
    $('phase-tag').textContent = mode === 'focus' ? ({ focus: 'FOCUS SESSION', short: 'SHORT BREAK', long: 'LONG BREAK' })[state.focus.phase] : mode === 'countdown' ? 'COUNTING DOWN' : 'LAP TRACKING';
    $('timer-icon').querySelector('use').setAttribute('href', mode === 'stopwatch' ? '#i-stopwatch' : mode === 'countdown' ? '#i-hourglass' : '#i-spark');
    $('phase-switch').classList.toggle('hidden', mode !== 'focus');
    $('countdown-presets').classList.toggle('hidden', mode !== 'countdown');
    $('laps-wrap').classList.toggle('hidden', mode !== 'stopwatch');
    $('next-btn').title = mode === 'focus' ? 'Skip to next phase' : mode === 'countdown' ? 'Custom countdown' : 'Record lap (L)';
    $('next-btn').setAttribute('aria-label', $('next-btn').title);
    $('next-btn').querySelector('use').setAttribute('href', mode === 'stopwatch' ? '#i-plus' : mode === 'countdown' ? '#i-settings' : '#i-next');
    const phases = { focus: `${state.focus.focusMins}m`, short: `${state.focus.shortMins}m`, long: `${state.focus.longMins}m` };
    $$('[data-phase]').forEach((b) => {
      b.classList.toggle('active', b.dataset.phase === state.focus.phase);
      b.querySelector('span').textContent = phases[b.dataset.phase];
    });
    $$('[data-seconds]').forEach((b) => b.classList.toggle('active', Number(b.dataset.seconds) * 1000 === state.timers.countdown.durationMs));
    $('protocol-title').textContent = mode === 'focus' ? `${state.focus.phase === 'focus' ? 'Deep Work' : 'Recovery'} / ${formatTime(phaseDuration())}` : mode === 'countdown' ? `Countdown / ${formatTime(state.timers.countdown.durationMs)}` : 'Precision / Lap tracker';
    $('protocol-description').textContent = mode === 'focus' ? `${state.focus.rounds} focus rounds completed in this cycle.` : mode === 'countdown' ? 'Set a custom countdown for any mission.' : `${state.stopwatch.laps.length} recorded laps on this run.`;
    renderWorkspace(); renderLaps(); renderTasks(); renderStats(); updateDisplay();
    $('soundscape').value = state.settings.soundscape;
    $('volume').value = state.settings.volume;
    $('volume-value').textContent = `${state.settings.volume}%`;
  }
  function tick() {
    for (const mode of ['focus', 'countdown']) completeTimer(mode);
    if (state.mode === 'stopwatch' || isRunning()) updateDisplay();
    const time = new Date();
    const formatted = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    $('header-clock').textContent = formatted;
    $('current-date').textContent = time.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
    const thisSecond = Math.floor(time.getTime() / 1000);
    if (thisSecond !== lastRenderedSecond) {
      lastRenderedSecond = thisSecond;
      if (thisSecond % 60 === 0) renderStats();
    }
  }
  function openSettings() {
    $('focus-mins').value = state.focus.focusMins;
    $('short-mins').value = state.focus.shortMins;
    $('long-mins').value = state.focus.longMins;
    $('long-every').value = state.focus.longEvery;
    $('auto-break').checked = state.settings.autoBreak;
    $('auto-focus').checked = state.settings.autoFocus;
    $('alert-sound').checked = state.settings.alertSound;
    $('notification-note').textContent = inVSCode ? 'VS Code notifications are handled by the extension automatically.' : 'Browser notifications require HTTPS or localhost and your permission.';
    $('notify-btn').disabled = inVSCode || !('Notification' in window) || Notification.permission === 'granted';
    $('notify-btn').textContent = inVSCode ? 'VS CODE ALERTS ENABLED' : ('Notification' in window && Notification.permission === 'granted') ? 'NOTIFICATIONS ENABLED' : 'ENABLE NOTIFICATIONS';
    $$('[data-theme-choice]').forEach((b) => b.classList.toggle('active', b.dataset.themeChoice === state.theme));
    $('settings-dialog').showModal();
  }
  function saveSettings() {
    const vals = [
      ['focus-mins', 1, 180, state.focus.focusMins],
      ['short-mins', 1, 60, state.focus.shortMins],
      ['long-mins', 1, 120, state.focus.longMins],
      ['long-every', 2, 12, state.focus.longEvery]
    ];
    const valid = vals.map(([id, low, high, fallback]) => boundedInt($(id).value, low, high, fallback));
    if (vals.some(([id, low, high], i) => String(valid[i]) !== String($(id).value))) return safeToast('Please enter whole numbers within the allowed ranges.');
    [state.focus.focusMins, state.focus.shortMins, state.focus.longMins, state.focus.longEvery] = valid;
    state.settings.autoBreak = $('auto-break').checked;
    state.settings.autoFocus = $('auto-focus').checked;
    state.settings.alertSound = $('alert-sound').checked;
    if (!state.timers.focus.endsAt) {
      const duration = phaseDuration();
      state.timers.focus.durationMs = duration; state.timers.focus.remainingMs = duration;
    }
    persist(); render(); $('settings-dialog').close(); safeToast('Protocol settings updated.');
  }
  async function requestNotifications() {
    if (inVSCode || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    try {
      const perm = await Notification.requestPermission();
      $('notify-btn').textContent = perm === 'granted' ? 'NOTIFICATIONS ENABLED' : 'NOTIFICATIONS UNAVAILABLE';
      $('notify-btn').disabled = perm === 'granted';
      safeToast(perm === 'granted' ? 'Notifications enabled.' : 'Browser notification permission was not granted.');
    } catch { safeToast('Notifications are not supported in this context.'); }
  }
  function stopSound() {
    soundNodes.forEach(({ node, source }) => {
      try { node.disconnect(); } catch {}
      if (source) try { source.stop(); } catch {}
    });
    soundNodes = [];
  }
  function playSoundscape() {
    stopSound();
    if (state.settings.soundscape === 'off') return;
    unlockAudio(); if (!audioCtx) return;
    const volume = state.settings.volume / 100;
    const master = audioCtx.createGain(); master.gain.value = volume * .24; master.connect(audioCtx.destination);
    soundNodes.push({ node: master });
    if (state.settings.soundscape === 'space') {
      [86, 130.81, 174.61].forEach((freq, i) => {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle'; osc.frequency.value = freq;
        g.gain.value = i === 0 ? .4 : .12;
        osc.connect(g).connect(master); osc.start();
        soundNodes.push({ node: g, source: osc });
      });
    } else if (state.settings.soundscape === 'rain') {
      const length = audioCtx.sampleRate * 3;
      const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * .42;
      const noise = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter();
      noise.buffer = buffer; noise.loop = true; filter.type = 'lowpass'; filter.frequency.value = 1150;
      noise.connect(filter).connect(master); noise.start();
      soundNodes.push({ node: filter, source: noise });
    }
  }
  function registerServiceWorker() {
    if (!inVSCode && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
  function initStars() {
    const canvas = $('starfield'); if (!canvas?.getContext) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars = [], width = 0, height = 0, frame = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(190, Math.round(width * height / 9500));
      stars = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, radius: .35 + Math.random() * 1.2, alpha: .12 + Math.random() * .46, flicker: Math.random() * 6.28, speed: .0008 + Math.random() * .0018 }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const alpha = Math.max(.04, star.alpha * (reduceMotion ? 1 : (.72 + .28 * Math.sin(frame * star.speed + star.flicker))));
        ctx.fillStyle = `rgba(162,193,255,${alpha})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); ctx.fill();
      }
      frame++;
      if (!reduceMotion && !document.hidden) requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener('resize', () => { resize(); if (reduceMotion || document.hidden) draw(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
  }
  function bind() {
    $$('[data-mode]').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    $$('[data-workspace]').forEach((b) => b.addEventListener('click', () => switchWorkspace(b.dataset.workspace)));
    $('todo-jump-timer').addEventListener('click', () => switchWorkspace('timer'));
    $$('[data-task-filter]').forEach(b => b.addEventListener('click', () => {currentTaskFilter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>x.classList.toggle('active',x===b));renderTasks();}));
    $('todo-search').addEventListener('input', e => {currentTaskSearch=e.target.value.trim().toLowerCase();renderTasks();});
    $('todo-sort').addEventListener('change',renderTasks);
    $('todo-form').addEventListener('submit', event=>{ event.preventDefault();const field=$('todo-title');if(addTask(field.value,{priority:$('todo-priority').value,category:$('todo-category').value,dueDate:$('todo-due').value})){field.value='';field.focus();}});
    $('save-edited-task').addEventListener('click',()=>{const task=state.tasks.find(t=>t.id===editingTaskId);if(!task)return;$('edit-task-text').value=$('edit-task-text').value.trim();if(!$('edit-task-text').value)return safeToast('Mission title is required.');task.text=$('edit-task-text').value.slice(0,120);task.priority=$('edit-task-priority').value;task.category=$('edit-task-category').value;task.dueDate=$('edit-task-due').value;task.modifiedAt=Date.now();editingTaskId=null;persist();renderTasks();$('edit-task-dialog').close();safeToast('Mission updated.');});
    $('clear-completed').addEventListener('click',()=>{const count=state.tasks.filter(t=>t.done).length;if(!count)return;$('clear-task-warning').textContent=`Permanently remove ${count} completed mission${count===1?'':'s'} from this device? This cannot be undone.`;$('clear-task-dialog').showModal();});
    $('confirm-clear-completed').addEventListener('click',()=>{for(const task of state.tasks.filter(t=>t.done))state.deletedTasks[task.id]=Date.now();state.tasks=state.tasks.filter(t=>!t.done);if(!state.tasks.some(t=>t.id===state.activeTaskId))state.activeTaskId=null;persist();renderTasks();$('clear-task-dialog').close();safeToast('Completed missions cleared.');});
    $$('[data-phase]').forEach((b) => b.addEventListener('click', () => setPhase(b.dataset.phase)));
    $$('[data-seconds]').forEach((b) => b.addEventListener('click', () => setCountdown(Number(b.dataset.seconds))));
    $('primary-btn').addEventListener('click', toggleTimer);
    $('reset-btn').addEventListener('click', resetTimer);
    $('next-btn').addEventListener('click', doNext);
    $('configure-btn').addEventListener('click', () => state.mode === 'countdown' ? $('custom-dialog').showModal() : openSettings());
    $('custom-countdown-btn').addEventListener('click', () => $('custom-dialog').showModal());
    $('open-settings').addEventListener('click', openSettings);
    $('sync-connect').addEventListener('click', async () => {
      if(inVSCode){sendHost('start-sync');return;}
      const candidate=$('sync-key').value.trim();
      if(!/^[a-f0-9]{64}$/i.test(candidate))return syncStatus('Enter the 64-character key copied from VS Code');
      const success=await exchangeMissions(candidate);
      if(success){syncKey=candidate;try{localStorage.setItem(SYNC_KEY_STORAGE,syncKey);}catch{}$('sync-key').value='';safeToast('Local task sync enabled.');}
    });
    $('sync-disconnect').addEventListener('click',()=>{
      if(inVSCode){sendHost('stop-sync');return;}
      syncKey='';try{localStorage.removeItem(SYNC_KEY_STORAGE);}catch{}syncStatus('DISCONNECTED · Your tasks remain saved locally');
    });
    $('save-settings').addEventListener('click', saveSettings);
    $('notify-btn').addEventListener('click', requestNotifications);
    $$('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => {
      state.theme = b.dataset.themeChoice;
      $$('[data-theme-choice]').forEach((item) => item.classList.toggle('active', item === b));
      document.body.dataset.theme = state.theme; persist();
    }));
    $('save-custom').addEventListener('click', () => {
      const vals = [boundedInt($('custom-hours').value, 0, 99, -1), boundedInt($('custom-minutes').value, 0, 59, -1), boundedInt($('custom-seconds').value, 0, 59, -1)];
      const seconds = vals[0] * 3600 + vals[1] * 60 + vals[2];
      if (vals.some((n) => n < 0) || seconds < 1) return safeToast('Enter a valid countdown of at least 1 second.');
      setCountdown(seconds); $('custom-dialog').close();
    });
    $('task-form').addEventListener('submit', (event) => {
      event.preventDefault(); const input = $('task-input');
      if (addTask(input.value, { priority:'medium',category:'Personal' })) input.value = '';
    });
    $('soundscape').addEventListener('change', (e) => {
      state.settings.soundscape = e.target.value;
      playSoundscape(); persist();
      safeToast(state.settings.soundscape === 'off' ? 'Ambient audio off.' : 'Ambient soundscape is playing.');
    });
    $('volume').addEventListener('input', (e) => {
      state.settings.volume = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      $('volume-value').textContent = `${state.settings.volume}%`;
      if (soundNodes.length) playSoundscape();
      persist();
    });
    document.addEventListener('keydown', (event) => {
      const tag = event.target?.tagName || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || $('settings-dialog').open || $('custom-dialog').open || $('edit-task-dialog').open || $('clear-task-dialog').open || state.workspace === 'tasks' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space') { event.preventDefault(); toggleTimer(); }
      else if (event.key.toLowerCase() === 'r' && !event.repeat) resetTimer();
      else if (event.key.toLowerCase() === 'l' && !event.repeat && state.mode === 'stopwatch') lap();
    });
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'hydrate' && ['1.0.0','1.1.0', VERSION].includes(event.data.state?.version) && Number(event.data.state.updatedAt) > state.updatedAt) {
        state = normalize(event.data.state); persist(); render(); tick();
      } else if (event.data?.type === 'sync-tasks' && inVSCode) {
        applySyncedMissions(event.data.payload);
      } else if (event.data?.type === 'sync-status') {
        syncStatus(event.data.connected ? 'BRIDGE ONLINE · Pair Chrome in Settings' : 'BRIDGE OFFLINE',Boolean(event.data.connected));
      }
    });
    window.addEventListener('beforeunload', () => stopSound());
  }
  $('sync-connect').textContent = inVSCode ? 'START BRIDGE + COPY KEY' : 'CONNECT';
  $('sync-disconnect').textContent = inVSCode ? 'STOP BRIDGE' : 'DISCONNECT';
  $('sync-key').classList.toggle('hidden',inVSCode);
  syncStatus(inVSCode ? 'BRIDGE OFFLINE · Start to pair Chrome' : syncKey ? 'CONNECTING…' : 'NOT CONNECTED · Optional, local only');
  $('runtime-label').textContent = inVSCode ? 'VS CODE EXTENSION EDITION' : 'CHROME / PWA EDITION';
  bind(); render(); tick(); initStars(); registerServiceWorker();
  setInterval(tick, 180);
  if (inVSCode) sendHost('ready');
  else { if(syncKey) exchangeMissions(); setInterval(()=>{if(syncKey)exchangeMissions();},2500); }
})();
