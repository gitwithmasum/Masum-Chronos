'use strict';
// Regression coverage for the optional Pearl Waves light theme.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const css=read('web/styles.css'), app=read('web/app.js');
const pages=['index.html','web/index.html'];
for(const file of pages){
  const html=read(file);
  for(const key of ['nebula','cyber','aurora','minimal','pearl-waves']){
    assert(html.includes(`data-theme-choice="${key}"`),`${file}: missing ${key} theme`);
  }
}
assert(css.includes('body[data-theme="pearl-waves"]'), 'Pearl Waves CSS missing');
assert(css.includes('data:image/svg+xml,'), 'Pink-purple line art is missing');
assert(css.includes('#d632a2') && css.includes('#6d49b4'), 'Theme colors changed unexpectedly');
assert(app.includes("'pearl-waves'].includes(s.theme)"), 'Pearl Waves not accepted in persisted state');
assert(app.includes("'1.2.2', '1.2.3', VERSION"), 'Existing v1.2.2 user state may be discarded');
assert(app.includes('persist();'), 'Local persistence removed');
assert(read('web/sw.js').includes('v1.3.0-sound-studio'), 'PWA cache version not updated');
assert(read('vscode/extension.js').includes("const VERSION = '1.3.0'"), 'VS Code extension version mismatch');
console.log('THEMES: Pearl Waves, original themes, stored preferences, migration and PWA cache: PASS');
