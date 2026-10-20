'use strict';
/* Regression guard for the refactored, accessible Settings Control Center. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const css = fs.readFileSync('web/control-center.css','utf8');
const app = fs.readFileSync('web/app.js','utf8');
const host = fs.readFileSync('vscode/extension.js','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const categories = ['focus','appearance','sound','cloud','link'];
const controls = [
  'focus-mins','short-mins','long-mins','long-every','auto-break','auto-focus',
  'alert-sound','notify-btn','notification-note','save-settings','sound-studio-controls',
  'cloud-url','cloud-key','cloud-google-login','cloud-configure','cloud-account','cloud-status',
  'cloud-sync-now','cloud-backup-now','cloud-restore','cloud-signout',
  'sync-connect','sync-disconnect','sync-status','sync-key'
];
for (const path of ['index.html','web/index.html']) {
  const html = fs.readFileSync(path,'utf8');
  const start = html.indexOf('<dialog id="settings-dialog"');
  const end = html.indexOf('<dialog id="custom-dialog"',start);
  assert(start >= 0 && end > start,path+': Settings dialog missing');
  const section = html.slice(start,end);
  assert.match(html, /href="\.\/control-center\.css"/,path+': futuristic stylesheet not linked');
  assert.match(section,/aria-labelledby="settings-heading"/);
  assert.match(section,/class="settings-window glass chronos-control-center"/);
  assert.match(section,/class="cc-layout"/);
  assert.match(section,/class="cc-footer"/);
  assert.match(section,/id="cc-close-settings"/);
  assert.match(section,/role="tablist"/);
  for (let i=0;i<categories.length;i++) {
    const category=categories[i];
    assert(section.includes('id="settings-tab-'+category+'"'),category+': tab missing');
    assert(section.includes('id="settings-panel-'+category+'"'),category+': panel missing');
    assert(section.includes('data-settings-tab="'+category+'"'),category+': tab binding missing');
    assert(section.includes('data-settings-panel="'+category+'"'),category+': panel binding missing');
    const panel=section.match(new RegExp('<section[^>]*id="settings-panel-'+category+'"[^>]*>'));
    assert(panel,category+': panel markup malformed');
    assert.match(panel[0],/role="tabpanel"/);
    if (category!=='focus') assert.match(panel[0],/\bhidden\b/,category+' should be hidden at rest');
  }
  for (const id of controls) {
    const count = [...section.matchAll(new RegExp('\\bid="'+id+'"','g'))].length;
    assert.equal(count,1,path+': '+id+' should appear once in settings');
  }
  assert(section.indexOf('id="focus-mins"')<section.indexOf('id="settings-panel-appearance"'));
  assert(section.indexOf('id="sound-studio-controls"')<section.indexOf('id="settings-panel-cloud"'));
  assert(section.indexOf('id="cloud-google-login"')<section.indexOf('id="settings-panel-link"'));
}
assert.match(app,/function activateSettingsTab\(next, focusButton = false\)/);
assert.match(app,/event\.key === 'Home'/);
assert.match(app,/event\.key === 'End'/);
assert.match(app,/event\.key === 'ArrowRight'/);
assert.match(app,/event\.key === 'ArrowLeft'/);
assert.match(app,/\$\('cc-close-settings'\)\.addEventListener/);
assert.match(app,/cloud\?\.preferencesChanged\(\)/);
assert.match(app,/const VERSION = '2\.3\.0-beta\.1'/);
assert.match(host,/controlCssUri/);
assert.match(host,/href="\.\/control-center\.css"/);
assert(pkg.files.includes('web/control-center.css'));
assert.equal(pkg.version,'2.3.0-beta.1');
assert.match(css,/\.cc-panel\[hidden\]/);
assert.match(css,/@media \(max-width: 810px\)/);
assert.match(css,/data-theme="pearl-waves"/);
assert.match(fs.readFileSync('web/sw.js','utf8'),/control-center\.css/);
assert.match(fs.readFileSync('sw.js','utf8'),/control-center\.css/);

// Regression: a mistaken single-element ID accessor on a [data-*] selector
// throws before showModal() and makes clicking Settings appear to do nothing.
assert.match(app, /\$\$\('\[data-settings-tab\]'\)\.forEach/);
assert.match(app, /\$\$\('\[data-settings-panel\]'\)\.forEach/);
assert.match(app, /const tabButtons = \$\$\('\[data-settings-tab\]'\)/);
const from = app.indexOf('  const SETTINGS_TABS =');
const to = app.indexOf('  function saveSettings()', from);
assert(from > 0 && to > from, 'Settings controller source missing');
const tabs = categories.map(name => ({
  dataset:{settingsTab:name},classList:{toggle(){}},
  setAttribute(key,val){if(key==='aria-selected')this.selected=val},
  focus(){this.focused=true},tabIndex:-1
}));
const panels = categories.map(name => ({dataset:{settingsPanel:name},hidden:name!=='focus'}));
const nodes = new Map();
for (const id of ['focus-mins','short-mins','long-mins','long-every','auto-break','auto-focus','alert-sound','notification-note','notify-btn']) {
 nodes.set(id,{value:'',checked:false,textContent:'',disabled:false});
}
nodes.set('settings-dialog',{open:false,showModal(){this.open=true},querySelector(){return {scrollTop:42}}});
const getId = id => nodes.get(id) ?? null;
const queryAll = selector => {
  if(selector==='[data-settings-tab]')return tabs;
  if(selector==='[data-settings-panel]')return panels;
  if(selector==='[data-theme-choice]')return [];
  throw Error('Unexpected selector: '+selector);
};
const vm = require('node:vm');
const env = {
  $:getId,$$:queryAll,
  state:{focus:{focusMins:25,shortMins:5,longMins:15,longEvery:4},settings:{autoBreak:false,autoFocus:true,alertSound:true},theme:'nebula'},
  inVSCode:false,window:{Notification:{permission:'default'}},
  Notification:{permission:'default'},soundStudio:{render(){this.count=(this.count||0)+1}},
  console
};
vm.runInNewContext(app.slice(from,to)+"\nopenSettings(); activateSettingsTab('sound');",env,{timeout:1000,filename:'settings-ui-smoke.js'});
assert.equal(nodes.get('settings-dialog').open,true,'Settings click handler must successfully show the modal');
assert.equal(panels.filter(x=>!x.hidden).length,1,'Exactly one settings section must be visible');
assert.equal(panels[2].hidden,false,'Sound Studio tab must be visible after navigation');
assert.equal(tabs[2].selected,'true','Accessible active tab state must be updated');

console.log('CONTROL CENTER: five tabs, one instance per control, keyboard nav, responsive theme, PWA cache and VS Code bundle: PASS (runtime click verified)');
