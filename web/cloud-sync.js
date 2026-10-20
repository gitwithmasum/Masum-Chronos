/* MASUM CHRONOS Cloud v2 beta — browser-only, dependency-free Supabase Auth/Data API.
   No secret/server key, no automatic destructive restore, and no cloud access without opt-in. */
(() => {
  'use strict';
  // This is a public browser publishable key, never a service_role / secret key.
  // Dedicated Chronos tables and owner-only RLS share NovaStudy's Supabase infrastructure.
  const DEFAULT_CONFIG = Object.freeze({
    url: 'https://pkydbkpbayrarnwaomoa.supabase.co',
    key: 'sb_publishable_NZ2IfpTrqlhq4-UEZnGXuA_oWPZpz84'
  });
  const CFG_KEY = 'chronos-cloud-config-v2';
  const PREF_KEY = 'chronos-cloud-preferences-changed-v2';
  const EVENT_KEY = 'chronos-cloud-daily-backup-v2';
  const $ = id => document.getElementById(id);
  const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const safePut = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const keyFor = (config) => 'chronos-cloud-session:' + new URL(config.url).host;
  const isUrl = url => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url || '');
  const isPublicKey = key => typeof key === 'string' &&
    (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(key) && !key.includes('service_role')));
  const defaultStatus = 'LOCAL MODE — No cloud connection configured.';
  function headers(config, token) {
    return { apikey: config.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  }
  function messageFrom(data, fallback) {
    return data?.message || data?.msg || data?.error_description || data?.error || fallback;
  }
  window.createChronosCloud = function createChronosCloud({ getSnapshot, mergeMissions, applyPreferences, restoreSnapshot, toast, inVSCode }) {
    let config = safeRead(CFG_KEY, null) || DEFAULT_CONFIG, session = null, user = null;
    let busy = false, lastStatus = defaultStatus, confirmRestoreUntil = 0, remoteRows = [];
    let syncInterval = null;
    const setStatus = text => {
      lastStatus = text;
      if ($('cloud-status')) $('cloud-status').textContent = text;
    };
    const controls = () => {
      const active = !!user && !!session;
      for (const id of ['cloud-sync-now','cloud-backup-now','cloud-restore','cloud-signout']) {
        const el = $(id); if (el) el.disabled = !active || busy;
      }
      if ($('cloud-google-login')) $('cloud-google-login').disabled = !config || busy || active;
      if ($('cloud-configure')) $('cloud-configure').disabled = busy;
      if ($('cloud-account')) $('cloud-account').textContent = user ? (user.email || 'SIGNED IN') : 'NOT SIGNED IN';
    };
    async function request(method, path, body, auth = true) {
      if (!config || !isUrl(config.url)) throw Error('Configure a valid Supabase project URL.');
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      try {
        const response = await fetch(config.url.replace(/\/$/, '') + path, {
          method, headers: headers(config, auth ? session.access_token : config.key),
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: 'no-store', signal: ctrl.signal
        });
        const raw = await response.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { throw Error('Unexpected response from cloud service.'); }
        if (!response.ok) throw Error(messageFrom(data, 'Cloud request failed (' + response.status + ')'));
        return data;
      } finally { clearTimeout(timeout); }
    }
    async function refreshSession() {
      if (!session) throw Error('Sign in to sync.');
      if (Number(session.expires_at) > Date.now() + 70000) return;
      if (!session.refresh_token) { session = null; throw Error('Your session expired. Sign in again.'); }
      const data = await request('POST', '/auth/v1/token?grant_type=refresh_token',
        { refresh_token: session.refresh_token }, false);
      if (!data?.access_token) throw Error('Unable to refresh the cloud session.');
      session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || session.refresh_token,
        expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000
      };
      safePut(keyFor(config), session);
    }
    async function authenticatedRequest(method, path, body) {
      await refreshSession();
      return request(method, path, body);
    }
    async function establishUser() {
      if (!config || !session) return;
      const data = await authenticatedRequest('GET', '/auth/v1/user');
      if (!data?.id) throw Error('Cloud sign-in was not verified.');
      user = { id: data.id, email: data.email };
      setStatus('SIGNED IN — ' + (user.email || 'account') + ' · Ready to sync');
      controls();
      await sync();
    }
    function handleRedirect() {
      if (!config || !location.hash.includes('access_token=')) return;
      const params = new URLSearchParams(location.hash.slice(1));
      const access = params.get('access_token');
      const refresh = params.get('refresh_token');
      if (!access || !refresh) return;
      session = { access_token: access, refresh_token: refresh,
        expires_at: Date.now() + (Number(params.get('expires_in')) || 3600) * 1000 };
      safePut(keyFor(config), session);
      // Do not leave credentials visible in browser history or copied links.
      history.replaceState(null, '', location.pathname + location.search);
    }
    async function login() {
      if (!config) return;
      if (!location.protocol.startsWith('http')) return toast('Google Login needs HTTPS or localhost.');
      // The redirect URI must be allow-listed in the shared Supabase Auth settings.
      const url = new URL(config.url.replace(/\/$/, '') + '/auth/v1/authorize');
      url.searchParams.set('provider', 'google');
      url.searchParams.set('redirect_to', location.origin + location.pathname);
      location.assign(url.toString());
    }
    function localRecords(snapshot) {
      const records = new Map();
      for (const t of snapshot.tasks || []) {
        if (!t || typeof t.id !== 'string') continue;
        records.set(t.id, { id: t.id, payload: t, modified_at: Number(t.modifiedAt || t.createdAt || 0), deleted: false });
      }
      for (const [id, stamp] of Object.entries(snapshot.deletedTasks || {})) {
        const timestamp = Number(stamp);
        if (!id || !Number.isFinite(timestamp)) continue;
        if (!records.has(id) || timestamp >= records.get(id).modified_at)
          records.set(id, { id, payload: {}, modified_at: timestamp, deleted: true });
      }
      return records;
    }
    async function fetchAllMissions() {
      const all = [];
      for (let offset = 0; offset <= 2000; offset += 1000) {
        const page = await authenticatedRequest('GET',
          '/rest/v1/chronos_missions?select=id,payload,modified_at,deleted&order=id.asc&limit=1000&offset=' + offset);
        if (!Array.isArray(page)) throw Error('Invalid cloud missions response.');
        all.push(...page);
        if (page.length < 1000) break;
      }
      return all;
    }
    async function syncMissions() {
      const remote = await fetchAllMissions();
      remoteRows = remote;
      const remoteRecord = new Map(remote.map(row => [row.id, row]));
      mergeMissions({
        tasks: remote.filter(row => !row.deleted && row.payload && typeof row.payload.text === 'string').map(row =>
          ({ ...row.payload, id: row.id, modifiedAt: Number(row.modified_at) })),
        deletedTasks: Object.fromEntries(remote.filter(row => row.deleted).map(row => [row.id, Number(row.modified_at)]))
      });
      const local = localRecords(getSnapshot());
      const outbound = [...local.values()].filter(row => {
        const previous = remoteRecord.get(row.id);
        return !previous || row.modified_at > Number(previous.modified_at) ||
          (row.modified_at === Number(previous.modified_at) && row.deleted && !previous.deleted);
      });
      for (let n = 0; n < outbound.length; n += 150) {
        await authenticatedRequest('POST', '/rest/v1/rpc/chronos_upsert_missions',
          { p_rows: outbound.slice(n, n + 150) });
      }
    }
    function localPreferenceStamp() {
      try { return Number(localStorage.getItem(PREF_KEY)) || 0; } catch { return 0; }
    }
    async function syncPreferences() {
      const values = await authenticatedRequest('GET',
        '/rest/v1/chronos_preferences?select=payload,modified_at&limit=1');
      const remote = values?.[0];
      const localStamp = localPreferenceStamp();
      if (remote && Number(remote.modified_at) >= localStamp && remote.payload) {
        applyPreferences(remote.payload);
        try { localStorage.setItem(PREF_KEY, String(remote.modified_at)); } catch {}
        return;
      }
      if (localStamp || !remote) {
        const snapshot = getSnapshot();
        const stamp = localStamp || Date.now();
        await authenticatedRequest('POST', '/rest/v1/rpc/chronos_upsert_preferences',
          { p_payload: { theme: snapshot.theme, settings: snapshot.settings, focus: {
            focusMins: snapshot.focus.focusMins, shortMins: snapshot.focus.shortMins,
            longMins: snapshot.focus.longMins, longEvery: snapshot.focus.longEvery
          }}, p_modified_at: stamp });
        try { localStorage.setItem(PREF_KEY, String(stamp)); } catch {}
      }
    }
    async function createBackup(automatic = false) {
      if (!user) return;
      const snapshot = getSnapshot();
      // Only persist stable data. Running stopwatch/timer timestamps should not resume unexpectedly.
      const clean = { ...snapshot, timers: {
        focus: { ...snapshot.timers.focus, endsAt: null },
        countdown: { ...snapshot.timers.countdown, endsAt: null }
      }, stopwatch: { ...snapshot.stopwatch, startedAt: null } };
      await authenticatedRequest('POST', '/rest/v1/chronos_backups',
        { user_id: user.id, snapshot: clean });
      if (!automatic) toast('Cloud backup saved for your signed-in account.');
      safePut(EVENT_KEY + ':' + user.id, new Date().toISOString().slice(0, 10));
    }
    async function dailyBackup() {
      const today = new Date().toISOString().slice(0,10);
      if (safeRead(EVENT_KEY + ':' + user.id, '') === today) return;
      await createBackup(true);
    }
    async function sync() {
      if (busy || !user || !config || !navigator.onLine) {
        if (!navigator.onLine && user) setStatus('OFFLINE — Local tasks remain available; sync resumes online.');
        return;
      }
      busy = true; controls(); setStatus('SYNCING — reconciling your cloud and local missions…');
      try {
        await syncMissions();
        await syncPreferences();
        await dailyBackup();
        setStatus('SYNCED — ' + (user.email || 'account') + ' · ' + new Date().toLocaleTimeString());
      } catch (error) {
        setStatus('SYNC ERROR — ' + (error.message || 'Please retry.'));
      } finally { busy = false; controls(); }
    }
    async function restoreLatest() {
      if (!user || busy) return;
      if (Date.now() > confirmRestoreUntil) {
        confirmRestoreUntil = Date.now() + 15000;
        setStatus('RESTORE WARNING — Click Restore again within 15 seconds to replace local tasks/settings.');
        return;
      }
      confirmRestoreUntil = 0; busy = true; controls();
      try {
        const rows = await authenticatedRequest('GET',
          '/rest/v1/chronos_backups?select=id,snapshot,created_at&order=created_at.desc&limit=1');
        const backup = rows?.[0];
        if (!backup?.snapshot?.tasks || !Array.isArray(backup.snapshot.tasks)) throw Error('No valid backup found.');
        const latest = await fetchAllMissions();
        restoreSnapshot(backup.snapshot, latest);
        // A restored backup is an explicit user action: mark preferences as changed.
        preferencesChanged();
        setStatus('RESTORED — Local data restored from ' + new Date(backup.created_at).toLocaleString() + '.');
        toast('Backup restored locally. Syncing restored tasks to cloud.');
      } catch (error) { setStatus('RESTORE FAILED — ' + error.message); }
      finally { busy = false; controls(); }
      await sync();
    }
    function preferencesChanged() {
      try { localStorage.setItem(PREF_KEY, String(Date.now())); } catch {}
    }
    async function signout() {
      if (session && config) {
        try { await authenticatedRequest('POST', '/auth/v1/logout'); } catch {}
        try { localStorage.removeItem(keyFor(config)); } catch {}
      }
      session = null; user = null;
      setStatus(defaultStatus + ' Local missions were not deleted.');
      controls();
    }
    function init() {
      if (!$('cloud-status')) return;
      if (inVSCode) {
        setStatus('Cloud sign-in is available in Chrome/PWA. VS Code retains same-PC Local Link sync.');
        for (const id of ['cloud-configure','cloud-google-login','cloud-sync-now','cloud-backup-now','cloud-restore','cloud-signout'])
          if ($(id)) $(id).disabled = true;
        return;
      }
      if (config && isUrl(config.url) && isPublicKey(config.key)) {
        $('cloud-url').value = config.url; $('cloud-key').value = config.key;
        safePut(CFG_KEY, config);
        session = safeRead(keyFor(config), null);
      } else config = null;
      $('cloud-configure').addEventListener('click', () => {
        const url = $('cloud-url').value.trim().replace(/\/$/, '');
        const key = $('cloud-key').value.trim();
        if (!isUrl(url) || !isPublicKey(key))
          return toast('Use a Supabase HTTPS project URL and a publishable (never secret) key.');
        config = {url,key}; safePut(CFG_KEY, config);
        session = safeRead(keyFor(config), null); user = null;
        controls(); setStatus('CONFIGURED — Sign in with Google to enable cloud sync.');
        if (session) void establishUser().catch(err => setStatus('LOGIN ERROR — ' + err.message));
      });
      $('cloud-google-login').addEventListener('click', () => void login());
      $('cloud-sync-now').addEventListener('click', () => void sync());
      $('cloud-backup-now').addEventListener('click', () => void createBackup(false).catch(err => toast(err.message)));
      $('cloud-restore').addEventListener('click', () => void restoreLatest());
      $('cloud-signout').addEventListener('click', () => void signout());
      window.addEventListener('online', () => void sync());
      window.addEventListener('focus', () => void sync());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
      handleRedirect(); controls();
      setStatus(config ? 'CONFIGURED — Authenticate to start cloud sync.' : defaultStatus);
      if (session) void establishUser().catch(error => setStatus('LOGIN ERROR — ' + error.message));
      syncInterval = setInterval(() => void sync(), 30000);
    }
    return { init, sync, preferencesChanged, get status(){return lastStatus;} };
  };
})();
