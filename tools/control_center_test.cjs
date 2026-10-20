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
assert.match(app,/const VERSION = '2\.0\.0-beta\.2'/);
assert.match(host,/controlCssUri/);
assert.match(host,/href="\.\/control-center\.css"/);
assert(pkg.files.includes('web/control-center.css'));
assert.equal(pkg.version,'2.0.0-beta.2');
assert.match(css,/\.cc-panel\[hidden\]/);
assert.match(css,/@media \(max-width: 810px\)/);
assert.match(css,/data-theme="pearl-waves"/);
assert.match(fs.readFileSync('web/sw.js','utf8'),/control-center\.css/);
assert.match(fs.readFileSync('sw.js','utf8'),/control-center\.css/);
console.log('CONTROL CENTER: five tabs, one instance per control, keyboard nav, responsive theme, PWA cache and VS Code bundle: PASS');
