/* MASUM CHRONOS v1.3 — Smart Sound Studio, local-first audio. */
(function soundModule() {
  'use strict';
  const EVENTS = [
    ['countdown', 'Countdown complete', 'cosmic-alarm'],
    ['focus', 'Focus session complete', 'galaxy-chime'],
    ['break', 'Break complete', 'soft-aurora'],
    ['stopwatchLap', 'Stopwatch lap', 'digital-pulse'],
    ['stopwatchStop', 'Stopwatch paused', 'quantum-signal'],
    ['taskComplete', 'To-Do completed', 'victory-spark'],
    ['taskReminder', 'Task due today', 'neon-bell'],
    ['overdue', 'Overdue task warning', 'cyber-warning']
  ];
  const PRESETS = {
    'cosmic-alarm': { name: 'Cosmic Alarm', wave: 'saw', notes: [[0, 659, .22], [.30, 659, .22], [.61, 880, .43], [1.22, 659, .42]] },
    'galaxy-chime': { name: 'Galaxy Chime', wave: 'sine', notes: [[0, 523, .38], [.36, 659, .40], [.73, 784, .50], [1.2, 1047, .70]] },
    'digital-pulse': { name: 'Digital Pulse', wave: 'square', notes: [[0, 880, .12], [.18, 988, .12], [.38, 1175, .18]] },
    'victory-spark': { name: 'Victory Spark', wave: 'sine', notes: [[0, 523, .24], [.23, 659, .24], [.46, 784, .24], [.71, 1047, .58]] },
    'neon-bell': { name: 'Neon Bell', wave: 'sine', notes: [[0, 784, .58], [.83, 1047, .78]] },
    'cyber-warning': { name: 'Cyber Warning', wave: 'square', notes: [[0, 440, .27], [.4, 440, .27], [.85, 349, .40]] },
    'soft-aurora': { name: 'Soft Aurora', wave: 'sine', notes: [[0, 392, .65], [.55, 523, .65], [1.1, 659, .75]] },
    'quantum-signal': { name: 'Quantum Signal', wave: 'triangle', notes: [[0, 392, .18], [.24, 587, .18], [.50, 784, .18], [.78, 587, .30]] }
  };
  const DEFAULTS = Object.fromEntries(EVENTS.map(([key,, preset]) => [key, preset]));
  const $ = id => document.getElementById(id);
  window.createChronosSoundStudio = function createChronosSoundStudio({ getSettings, persist, toast }) {
    let context, playing = null, previewing = null, serial = 0;
    let customList = [], databasePromise;
    const presetCache = new Map(), decodedCache = new Map();
    const config = () => {
      const settings = getSettings();
      if (!settings.soundStudio || typeof settings.soundStudio !== 'object') settings.soundStudio = {};
      const sc = settings.soundStudio;
      if (!sc.selections || typeof sc.selections !== 'object') sc.selections = { ...DEFAULTS };
      for (const [key, , preset] of EVENTS) {
        if (typeof sc.selections[key] !== 'string') sc.selections[key] = preset;
      }
      if (!['manual', 'auto10'].includes(sc.stopMode)) sc.stopMode = 'manual';
      if (!Number.isFinite(sc.volume)) sc.volume = 70;
      sc.volume = Math.max(0, Math.min(100, sc.volume));
      return sc;
    };
    const audio = () => {
      if (!context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw Error('This browser does not support Web Audio.');
        context = new Ctx();
      }
      if (context.state === 'suspended') void context.resume().catch(() => {});
      return context;
    };
    const banner = (key, active) => {
      const el = $('ringtone-banner');
      if (!el) return;
      el.hidden = !active;
      if (!active) return;
      const event = EVENTS.find(([id]) => id === key);
      const label = $('ringtone-title');
      const hint = $('ringtone-subtitle');
      if (label) label.textContent = event ? event[1].toUpperCase() : 'SOUND ALERT';
      if (hint) hint.textContent = config().stopMode === 'manual' ? 'LOOPING UNTIL YOU PRESS SILENCE' : 'AUTOMATIC STOP AFTER 10 SECONDS';
    };
    function endNode(node) {
      if (!node) return;
      try { node.source.onended = null; node.source.stop(); } catch {}
      try { node.source.disconnect(); node.gain.disconnect(); } catch {}
    }
    function stop() {
      serial++;
      endNode(playing);
      playing = null;
      endNode(previewing);
      previewing = null;
      banner('', false);
    }
    function makeBuffer(id) {
      if (presetCache.has(id)) return presetCache.get(id);
      const preset = PRESETS[id];
      if (!preset) return null;
      const ctx = audio(), rate = ctx.sampleRate;
      const seconds = 2.35, length = Math.ceil(rate * seconds);
      const buffer = ctx.createBuffer(1, length, rate), data = buffer.getChannelData(0);
      for (const [at, hz, span] of preset.notes) {
        const start = Math.floor(at * rate), count = Math.min(Math.floor(span * rate), length - start);
        for (let i = 0; i < count; i++) {
          const phase = 2 * Math.PI * hz * i / rate;
          const tone = preset.wave === 'square' ? Math.tanh(2.4 * Math.sin(phase)) :
            preset.wave === 'saw' ? (2 / Math.PI) * Math.atan(Math.tan(phase / 2)) :
            preset.wave === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
          const envelope = Math.min(1, i / (rate * .018)) * Math.min(1, (count - i) / (rate * .12));
          data[start + i] += tone * envelope * .27;
        }
      }
      for (let i = 0; i < length; i++) data[i] = Math.max(-.82, Math.min(.82, data[i]));
      presetCache.set(id, buffer);
      return buffer;
    }
    function db() {
      if (!('indexedDB' in window)) return Promise.reject(Error('Custom sound storage is unavailable in this app.'));
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('masum-chronos-sound-studio', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('sounds', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || Error('Cannot open custom sound storage.'));
      }).catch(err => { databasePromise = null; throw err; });
      return databasePromise;
    }
    async function transact(method, value) {
      const database = await db();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction('sounds', method === 'read' ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('sounds');
        const request = method === 'read' ? store.getAll() : method === 'get' ? store.get(value) :
          method === 'delete' ? store.delete(value) : store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || Error('Sound storage failed.'));
      });
    }
    async function bufferFor(id) {
      if (PRESETS[id]) return makeBuffer(id);
      if (!id.startsWith('custom:')) return null;
      if (decodedCache.has(id)) return decodedCache.get(id);
      const entry = await transact('get', id.slice(7));
      if (!entry?.blob) throw Error('Custom ringtone is missing. Please upload it again.');
      const bytes = await entry.blob.arrayBuffer();
      const buffer = await audio().decodeAudioData(bytes);
      decodedCache.set(id, buffer);
      return buffer;
    }
    async function emit(key, isPreview = false) {
      const sc = config();
      if (!isPreview && !getSettings().alertSound) return;
      const id = sc.selections[key];
      if (!id || id === 'off') return;
      if (isPreview) {
        endNode(previewing); previewing = null;
      } else stop();
      const ticket = ++serial;
      try {
        const buffer = await bufferFor(id);
        if (!buffer || serial !== ticket) return;
        const ctx = audio();
        if (ctx.state === 'suspended') await ctx.resume();
        if (serial !== ticket) return;
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = !isPreview;
        gain.gain.value = sc.volume / 100;
        source.connect(gain).connect(ctx.destination);
        const record = { source, gain };
        if (isPreview) previewing = record;
        else { playing = record; banner(key, true); }
        source.onended = () => {
          try { source.disconnect(); gain.disconnect(); } catch {}
          if (isPreview && previewing === record) previewing = null;
          if (!isPreview && playing === record) { playing = null; banner('', false); }
        };
        source.start();
        if (isPreview) source.stop(ctx.currentTime + Math.min(3, buffer.duration));
        else if (sc.stopMode === 'auto10') source.stop(ctx.currentTime + 10);
      } catch (error) {
        if (serial === ticket) { banner('', false); toast(error.message || 'Unable to play this sound.'); }
      }
    }
    function render() {
      const container = $('sound-studio-controls');
      if (!container) return;
      const sc = config();
      container.replaceChildren();
      const heading = document.createElement('div');
      heading.className = 'studio-head';
      heading.innerHTML = '<div><span class="section-eyebrow">AUDIO CONTROL / V1.3</span><h3>Smart Sound Studio</h3></div><p>Choose individual sounds, preview them, or set any event to Silent.</p>';
      container.append(heading);
      const options = [...Object.entries(PRESETS).map(([id,p]) => [id,p.name]), ...customList.map(f => [`custom:${f.id}`,`Custom · ${f.name}`])];
      const grid = document.createElement('div'); grid.className = 'studio-grid';
      for (const [key, name] of EVENTS) {
        const row = document.createElement('div'); row.className = 'studio-row';
        const label = document.createElement('label'); label.textContent = name;
        const select = document.createElement('select'); select.setAttribute('aria-label', `${name} sound`);
        select.append(new Option('Silent / Off', 'off'));
        for (const [id, title] of options) select.append(new Option(title, id));
        select.value = sc.selections[key];
        if (select.selectedIndex < 0) { select.value = 'off'; }
        select.addEventListener('change', () => { sc.selections[key] = select.value; persist(); if (select.value === 'off' && playing) stop(); });
        const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'studio-preview'; preview.textContent = 'PLAY';
        preview.setAttribute('aria-label', `Preview ${name}`);
        preview.addEventListener('click', () => void emit(key, true));
        row.append(label, select, preview); grid.append(row);
      }
      container.append(grid);
      const footer = document.createElement('div'); footer.className = 'studio-settings';
      const mode = document.createElement('label'); mode.textContent = 'STOP BEHAVIOR';
      const modeSelect = document.createElement('select'); modeSelect.id = 'sound-stop-mode';
      modeSelect.append(new Option('Manual Stop · Loop until SILENCE', 'manual'), new Option('Auto Stop · After 10 seconds', 'auto10'));
      modeSelect.value = sc.stopMode;
      modeSelect.addEventListener('change', () => { sc.stopMode = modeSelect.value; persist(); stop(); toast('New ringtone stop behavior saved.'); });
      mode.append(modeSelect);
      const volume = document.createElement('label'); volume.textContent = 'ALERT VOLUME';
      const slider = document.createElement('input'); slider.id = 'alert-volume'; slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = String(sc.volume);
      const value = document.createElement('span'); value.textContent = `${sc.volume}%`;
      slider.addEventListener('input', () => {
        sc.volume = Number(slider.value);
        value.textContent = `${sc.volume}%`;
        if (playing) playing.gain.gain.value = sc.volume / 100;
        if (previewing) previewing.gain.gain.value = sc.volume / 100;
        persist();
      });
      volume.append(slider, value); footer.append(mode, volume); container.append(footer);
      const custom = document.createElement('div'); custom.className = 'studio-custom';
      const fileLabel = document.createElement('label'); fileLabel.textContent = 'UPLOAD YOUR RINGTONE (MP3, WAV, OGG · MAX 5 MB)';
      const file = document.createElement('input'); file.type = 'file'; file.accept = '.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg';
      file.addEventListener('change', async () => {
        const selected = file.files?.[0];
        if (!selected) return;
        try {
          if (!/\.(mp3|wav|ogg)$/i.test(selected.name) || selected.size > 5 * 1024 * 1024 || selected.size <= 0) throw Error('Use an MP3, WAV or OGG file no larger than 5 MB.');
          if (customList.length >= 12) throw Error('Maximum 12 custom sounds. Remove one first.');
          const bytes = await selected.arrayBuffer();
          const decoded = await audio().decodeAudioData(bytes.slice(0));
          if (decoded.duration > 120) throw Error('Please choose a sound shorter than two minutes.');
          const id = `sound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await transact('put', { id, name: selected.name.slice(0, 80), blob: selected });
          decodedCache.set(`custom:${id}`, decoded);
          await refreshCustom();
          toast('Your custom sound was saved on this device.');
        } catch (error) { toast(error.message || 'Custom sound upload failed.'); }
        file.value = '';
      });
      fileLabel.append(file); custom.append(fileLabel);
      for (const item of customList) {
        const r = document.createElement('div'); r.className = 'studio-file';
        const n = document.createElement('span'); n.textContent = item.name;
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'studio-preview'; remove.textContent = 'REMOVE';
        remove.addEventListener('click', async () => {
          try {
            await transact('delete', item.id);
            decodedCache.delete(`custom:${item.id}`);
            for (const [event, selection] of Object.entries(sc.selections)) if (selection === `custom:${item.id}`) sc.selections[event] = DEFAULTS[event] || 'off';
            stop(); persist(); await refreshCustom(); toast('Custom sound removed.');
          } catch (error) { toast(error.message || 'Could not remove custom sound.'); }
        });
        r.append(n, remove); custom.append(r);
      }
      const note = document.createElement('p'); note.textContent = 'Custom files stay in this browser/VS Code profile. For alarms to play, keep the app open and allow audio. Preview ends after 3 seconds.';
      note.className = 'studio-note'; custom.append(note); container.append(custom);
    }
    async function refreshCustom() {
      try {
        const entries = await transact('read');
        customList = entries.map(({id,name}) => ({id,name}));
      } catch { customList = []; }
      render();
    }
    void refreshCustom();
    return { play: key => emit(key), preview: key => emit(key, true), stop, unlock: () => { try { audio(); } catch {} }, render };
  };
})();
