/* MASUM CHRONOS VS Code extension host: secure webview + resilient status-bar timer. */
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let currentPanel = null;
let activeContext = null;
let statusBar = null;
let monitor = null;
let snapshot = null;
let lastNotifiedDeadline = 0;
const SNAPSHOT_KEY = 'masumChronos.snapshot.v1';
const ALERT_KEY = 'masumChronos.lastAlert.v1';
const VERSION = '1.1.0';

function activeTimer() {
  if (!snapshot || !['1.0.0', VERSION].includes(snapshot.version)) return null;
  if (snapshot.mode === 'stopwatch' && Number.isFinite(snapshot.stopwatch?.startedAt)) {
    const elapsed = (snapshot.stopwatch?.elapsedMs || 0) + Date.now() - snapshot.stopwatch.startedAt;
    return { mode: 'stopwatch', seconds: Math.max(0, Math.floor(elapsed / 1000)) };
  }
  if (snapshot.mode === 'focus' || snapshot.mode === 'countdown') {
    const deadline = snapshot.timers?.[snapshot.mode]?.endsAt;
    if (Number.isFinite(deadline) && deadline > 0) {
      return { mode: snapshot.mode, seconds: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)), deadline };
    }
  }
  return null;
}
function humanTime(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function finishMessage() {
  if (snapshot?.mode === 'countdown') return 'Countdown finished. Mission accomplished!';
  return snapshot?.focus?.phase === 'focus' ? 'Focus session complete! Time to take a break.' : 'Break complete! Return to your flow state.';
}
function announce(deadline, message) {
  if (!Number.isFinite(deadline) || deadline <= lastNotifiedDeadline) return;
  lastNotifiedDeadline = deadline;
  if (activeContext) void activeContext.globalState.update(ALERT_KEY, deadline);
  void vscode.window.showInformationMessage(`MASUM CHRONOS: ${message}`);
}
function updateStatus() {
  if (!statusBar) return;
  const timer = activeTimer();
  if (!timer) {
    statusBar.text = '$(watch) Chronos';
    statusBar.tooltip = 'Open MASUM CHRONOS Focus Command Center';
  } else if (timer.mode === 'stopwatch') {
    statusBar.text = `$(watch) ${humanTime(timer.seconds)}`;
    statusBar.tooltip = 'CHRONOS stopwatch is running. Click to open panel.';
  } else if (timer.seconds > 0) {
    statusBar.text = `$(clock) ${humanTime(timer.seconds)}`;
    statusBar.tooltip = `CHRONOS ${timer.mode} timer is running. Click to open.`;
  } else {
    statusBar.text = '$(bell) Finished';
    statusBar.tooltip = 'CHRONOS timer finished. Click to open.';
    if (Date.now() - timer.deadline < 60 * 60 * 1000) announce(timer.deadline, finishMessage());
  }
}
function getWebviewHTML(webview, extensionUri) {
  const folder = vscode.Uri.joinPath(extensionUri, 'web');
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(folder, 'styles.css'));
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(folder, 'app.js'));
  const nonce = crypto.randomBytes(18).toString('base64');
  let html = fs.readFileSync(path.join(extensionUri.fsPath, 'web', 'index.html'), 'utf8');
  // Webviews use asWebviewUri and cannot install service workers. Icon/manifest are PWA-only.
  html = html.replace(/\s*<link rel="icon"[^>]+>/, '').replace(/\s*<link rel="manifest"[^>]+>/, '');
  html = html.replace('href="./styles.css"', `href="${styleUri}"`);
  html = html.replace('src="./app.js"', `nonce="${nonce}" src="${jsUri}"`);
  html = html.replace('<title>', `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource}; connect-src 'none';" /><title>`);
  return html;
}
function bindPanel(panel, context) {
  currentPanel = panel;
  const folder = vscode.Uri.joinPath(context.extensionUri, 'web');
  panel.webview.options = { enableScripts: true, localResourceRoots: [folder] };
  panel.webview.html = getWebviewHTML(panel.webview, context.extensionUri);
  const receiver = panel.webview.onDidReceiveMessage(async (message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      if (['1.0.0', VERSION].includes(snapshot?.version)) await panel.webview.postMessage({ type: 'hydrate', state: snapshot });
    } else if (message.type === 'snapshot') {
      const candidate = message.state;
      if (!candidate || !['1.0.0', VERSION].includes(candidate.version) || !Number.isFinite(candidate.updatedAt)) return;
      if (!snapshot || candidate.updatedAt >= snapshot.updatedAt) {
        snapshot = candidate;
        await context.globalState.update(SNAPSHOT_KEY, snapshot);
        updateStatus();
      }
    } else if (message.type === 'finished') {
      announce(Number(message.deadline), String(message.message || 'Timer finished.').slice(0, 150));
      updateStatus();
    }
  });
  const disposed = panel.onDidDispose(() => {
    receiver.dispose(); disposed.dispose();
    if (currentPanel === panel) currentPanel = null;
  });
}
function openPanel(context) {
  if (currentPanel) { currentPanel.reveal(vscode.ViewColumn.One); return; }
  const panel = vscode.window.createWebviewPanel(
    'masumChronos.panel',
    'MASUM CHRONOS',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'web')] }
  );
  bindPanel(panel, context);
}
function activate(context) {
  activeContext = context;
  snapshot = context.globalState.get(SNAPSHOT_KEY, null);
  lastNotifiedDeadline = context.globalState.get(ALERT_KEY, 0);
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBar.command = 'masumChronos.open';
  statusBar.show();
  context.subscriptions.push(statusBar);
  context.subscriptions.push(vscode.commands.registerCommand('masumChronos.open', () => openPanel(context)));
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('masumChronos.panel', {
    async deserializeWebviewPanel(panel) { bindPanel(panel, context); }
  }));
  monitor = setInterval(updateStatus, 1000);
  context.subscriptions.push({ dispose: () => { if (monitor) clearInterval(monitor); } });
  updateStatus();
}
function deactivate() { if (monitor) clearInterval(monitor); currentPanel = null; }
module.exports = { activate, deactivate };
