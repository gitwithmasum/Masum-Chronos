# MASUM CHRONOS — Marketplace release checklist

Release candidate: **v1.2.2**, extension ID `gitwithmasum.masum-chronos`.

## Packaging (does not publish)

1. `npm run lint`
2. `node tools/vscode_smoke.cjs` and `node tools/ringtone_test.cjs`
3. `npm install --no-save --no-package-lock @vscode/vsce`
4. `mkdir dist` (skip if it exists), then `npx --no-install vsce ls --no-dependencies`
5. `npx --no-install vsce package --no-dependencies --out dist/masum-chronos-1.2.2.vsix`
6. `python tools/marketplace_check.py dist/masum-chronos-1.2.2.vsix`
7. Install and manually try `CHRONOS: Open Focus Command Center`, To-Do CRUD, countdown 10s ringtone, restart/resume, optional local sync (if used).

CI automatically performs official packaging and uploads the resulting artifact; inspect GitHub Actions `CHRONOS Quality Checks` for its packaging and smoke-test results.

## Before public publishing

- Sign in to the **Visual Studio Marketplace** manager, confirm the `gitwithmasum` publisher and that the extension ID/version isn't already published.
- Confirm README images, license, screenshots, and icon render in the Marketplace preview.
- For a new release, ensure its version is strictly above any existing version of `gitwithmasum.masum-chronos`.
- Publish through the Marketplace manager's VSIX upload option, or through your approved publisher automation. Do not commit PATs or other secrets to this repository.
- For ongoing CI publishing, investigate [VSCE trusted publishing](https://github.com/microsoft/vscode-vsce#trusted-publishing) or official Microsoft Entra-based publishing, and explicitly configure publisher trust before enabling. This repository intentionally has **no unattended Marketplace publishing workflow**.
- Once published, verify extension acquisition/install from the public listing on a clean VS Code profile.

**Note:** This release retains all v1.2.1 runtime logic, and adjusts only Marketplace metadata, documentation and packaging. The Chrome web app does not need to be reinstalled.
