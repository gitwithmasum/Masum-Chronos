"""Offline VSIX packer for MASUM CHRONOS. Standard VSIX/OPC structure. No dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
VERSION = DATA['version']
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / f"{DATA['name']}-{VERSION}.vsix"
FILES = [
    'package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'SUPPORT.md',
    'vscode/extension.js', 'vscode/sync-bridge.js',
    'web/index.html', 'web/styles.css', 'web/app.js', 'web/icon-192.png'
]
CONTENT_TYPES = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="css" ContentType="text/css"/>
  <Default Extension="html" ContentType="text/html"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="webmanifest" ContentType="application/manifest+json"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
</Types>'''
MANIFEST = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
 <Metadata>
  <Identity Language="en-US" Id="{escape(DATA['name'])}" Version="{escape(VERSION)}" Publisher="{escape(DATA['publisher'])}" />
  <DisplayName>{escape(DATA['displayName'])}</DisplayName>
  <Description xml:space="preserve">{escape(DATA['description'])}</Description>
  <Tags>timer,pomodoro,countdown,stopwatch,focus,productivity</Tags>
  <Categories>Other</Categories>
  <GalleryFlags>Public</GalleryFlags>
  <Properties>
   <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape(DATA['engines']['vscode'])}" />
   <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
   <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
  </Properties>
 </Metadata>
 <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
 <Dependencies />
 <Assets>
  <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/web/icon-192.png" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />
 </Assets>
</PackageManifest>'''
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, 'w', compression=ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr('[Content_Types].xml', CONTENT_TYPES)
    z.writestr('extension.vsixmanifest', MANIFEST)
    for name in FILES:
        z.write(ROOT / name, 'extension/' + name)
print(f'Created VSIX: {OUTPUT}, {len(FILES)} source files')
