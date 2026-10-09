"""Validate the official VSCE VSIX packaging output and Marketplace presentation."""
import re, sys, json
from xml.etree import ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

root=Path(__file__).resolve().parents[1]
package=json.loads((root/'package.json').read_text(encoding='utf8'))
assert package['version']=='1.2.2' and package['publisher']=='gitwithmasum'
assert package['repository']['url'].startswith('https://github.com/gitwithmasum/Masum-Chronos')
assert package['galleryBanner']=={'color':'#080E21','theme':'dark'}
assert not (root/'.vscodeignore').exists(), 'VSCE does not allow package.json files and .vscodeignore together'
readme=(root/'README.md').read_text(encoding='utf8')
for u in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',readme):
    assert u.startswith('https://') and not u.endswith('.svg'), f'unsafe README image: {u}'
for item in ['vscode/extension.js','vscode/sync-bridge.js','web/index.html','web/styles.css','web/app.js','web/icon-192.png']:
    assert (root/item).exists(), f'missing source {item}'
vsix=Path(sys.argv[1] if len(sys.argv)>1 else root/'dist/masum-chronos-1.2.2.vsix')
with ZipFile(vsix) as z:
    paths=set(z.namelist())
    manifest=ET.fromstring(z.read('extension.vsixmanifest'))
    referenced={el.attrib['Path'] for el in manifest.iter() if el.tag.split('}')[-1]=='Asset' and 'Path' in el.attrib}
    license_values={el.text for el in manifest.iter() if el.tag.split('}')[-1]=='License' and el.text}
    assert referenced and referenced <= paths, f'Broken Marketplace asset paths: {referenced-paths}'
    assert license_values and license_values <= paths, f'Broken Marketplace license declaration: {license_values-paths}'
    assert 'extension/LICENSE.txt' in paths, 'Marketplace requires canonical LICENSE.txt packaging'
    required={'extension.vsixmanifest','extension/package.json','extension/SUPPORT.md',
      'extension/vscode/extension.js','extension/vscode/sync-bridge.js',
      'extension/web/index.html','extension/web/styles.css','extension/web/app.js','extension/web/icon-192.png'}
    for allowed in [{'extension/README.md','extension/readme.md'}, {'extension/CHANGELOG.md','extension/changelog.md'}, {'extension/LICENSE','extension/LICENSE.txt'}]:
        assert paths & allowed, f'Missing package document: {allowed}'
    missing=required-paths
    assert not missing, f'Missing VSIX files: {missing}'
    forbidden=[n for n in paths if n.startswith('extension/') and (n.startswith(('extension/.git/','extension/.github/','extension/previews/','extension/tools/','extension/releases/','extension/node_modules/')) or n.endswith(('.vsix','.zip','.svg')) or n in ('extension/web/sw.js','extension/web/manifest.webmanifest','extension/web/icon-512.png'))]
    assert not forbidden, f'Non-runtime assets bundled: {forbidden}'
    packaged=json.loads(z.read('extension/package.json'))
    assert packaged['version']==package['version']
    assert packaged['main']=='./vscode/extension.js'
    md=z.read('extension/readme.md' if 'extension/readme.md' in paths else 'extension/README.md').decode('utf-8')
    assert 'https://raw.githubusercontent.com/gitwithmasum/Masum-Chronos/main/previews/masum-chronos-timer-todo-banner.jpg' in md
    assert z.read('extension/web/icon-192.png') == (root/'web/icon-192.png').read_bytes(), 'VSIX icon differs from branded source'
    assert (root/'previews/masum-chronos-timer-todo-banner.jpg').stat().st_size > 20_000, 'Missing README hero banner'
print(f'MARKETPLACE: official VSIX asset manifest PASS ({len(paths)} entries; {vsix.stat().st_size:,} bytes)')
