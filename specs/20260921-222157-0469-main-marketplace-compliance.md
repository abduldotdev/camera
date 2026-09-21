# Omarchy Plugin Marketplace Compliance Report: `abdul891.camera`

**Plugin ID:** `abdul891.camera`  
**Run ID:** `20260921-222157-0469-main`  
**Date:** 2026-09-21  

---

## 1. Compliance Audit Matrix

| # | Requirement | Source URL | Status | Evidence |
|---|---|---|---|---|
| 1 | Public GitHub repository | [`https://plugins.omarchy.org/publish.html`](https://plugins.omarchy.org/publish.html), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **USER ACTION** | Currently in local worktree repository. User must push to public GitHub repository before opening submission issue. |
| 2 | `manifest.json` present in repository root | [`https://plugins.omarchy.org/publish.html`](https://plugins.omarchy.org/publish.html), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`) | **PASS** | [`manifest.json`](../manifest.json#L1-L23) exists in repository root. |
| 3 | `schemaVersion` is exactly `1` | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` line 732) | **PASS** | [`manifest.json:2`](../manifest.json#L2): `"schemaVersion": 1`. |
| 4 | `id` field present, non-empty, trimmed, no control characters, length <= 128 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:3`](../manifest.json#L3): `"id": "abdul891.camera"` (15 characters, trimmed, no control characters). |
| 5 | `name` field present, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:4`](../manifest.json#L4): `"name": "Camera"` (6 characters, trimmed, no control characters). |
| 6 | `version` field present, non-empty, trimmed, no control characters, length <= 64 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:5`](../manifest.json#L5): `"version": "1.0.0"` (5 characters, trimmed, no control characters). |
| 7 | `author` field present, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:6`](../manifest.json#L6): `"author": "abdul891"` (8 characters, trimmed, no control characters). |
| 8 | `description` field present, non-empty, trimmed, no control characters, length <= 500 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:8`](../manifest.json#L8): `"description": "Logitech webcam controller with Logi Tune-like settings"` (56 characters, trimmed, no control characters). |
| 9 | Optional `license` field string, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 752-764) | **FIXED** | Added [`manifest.json:7`](../manifest.json#L7): `"license": "MIT"` (3 characters, trimmed, no control characters). |
| 10 | `id` format: lowercase, regex `^[a-z0-9][a-z0-9._-]*$`, not `omarchy.*`, globally unique | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 766-778), [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | [`manifest.json:3`](../manifest.json#L3): `"abdul891.camera"` matches regex, is strictly lowercase, outside `omarchy.*`, namespaced by GitHub username. |
| 11 | `kinds` array non-empty, contains only supported kinds (`bar`, `bar-widget`, `menu`, `overlay`, `panel`, `service`) | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 779-784), [`https://raw.githubusercontent.com/omacom/omarchy/quattro/shell/plugins/README.md`](https://raw.githubusercontent.com/omacom/omarchy/quattro/shell/plugins/README.md) | **PASS** | [`manifest.json:9-11`](../manifest.json#L9-L11): `"kinds": [ "bar-widget" ]`. |
| 12 | `entryPoints` object has mapping for each kind (`bar-widget` -> `barWidget`) with safe relative path | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 785-807, `entryPointKey`) | **PASS** | [`manifest.json:11-13`](../manifest.json#L11-L13): `"entryPoints": { "barWidget": "Widget.qml" }` (safe relative path, no `..`, no `/`). |
| 13 | Declared entry point files exist | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifestFiles` lines 837-841) | **PASS** | [`Widget.qml`](../Widget.qml) exists in root. |
| 14 | `barWidget.defaultSection` in `left`, `center`, or `right` | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 788-800) | **PASS** | [`manifest.json:20`](../manifest.json#L20): `"defaultSection": "right"`. |
| 15 | No symlinks in plugin folder | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifestFiles` lines 834-836), [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `find . -type l -not -path './.git/*'` returns `0` symlinks. |
| 16 | Root `README` file present | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateRepositoryDocs` lines 854-856), [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements) | **PASS** | [`README.md`](../README.md#L1-L186) present in repository root. |
| 17 | Root `LICENSE` or `COPYING` file present | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateRepositoryDocs` lines 857-859), [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements) | **FIXED** | Added [`LICENSE`](../LICENSE#L1-L21) with MIT License, copyright (c) 2026 Abdul Haseeb. |
| 18 | `README.md` documents install AND removal instructions using `omarchy plugin add <repo-url> --enable` and `omarchy plugin remove <id>` | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://plugins.omarchy.org/develop.html#finished`](https://plugins.omarchy.org/develop.html#finished), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **FIXED** | Added standalone installation instructions at [`README.md:39-44`](../README.md#L39-L44) (`omarchy plugin add https://github.com/abdul891/abdul891.camera.git --enable`), uninstall instructions at [`README.md:55-63`](../README.md#L55-L63) (`omarchy plugin remove abdul891.camera`), and preserved monorepo development instructions at [`README.md:46-53`](../README.md#L46-L53). |
| 19 | `README.md` documents license and every external dependency | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | **FIXED** | Dependencies documented at [`README.md:20-33`](../README.md#L20-L33) (`v4l-utils`, `cameractrls`, `shellcheck`), installation dependencies pointer added at [`README.md:36`](../README.md#L36), and `## License` section added at [`README.md:183-185`](../README.md#L183-L185). |
| 20 | Optional root `preview.png`/`jpg`/`webp`/`avif` | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **USER ACTION** | Optional screenshot asset. User should capture a real screenshot of the widget and settings popup and place it at `preview.png`. |
| 21 | Plugin does not overwrite user configuration | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | **PASS** | Verified by inspecting code and grepping `Model.js`, `Widget.qml`, `CameraPopup.qml` for file writes. The plugin executes only non-mutating status queries (`test -e`, `command -v`) and hardware ioctl/parameter commands (`v4l2-ctl`, `cameractrls`). No configuration files or caches are written to disk; plugin state is entirely in-memory and hardware-bound. Removal leaves nothing behind. |
| 22 | `omarchy plugin validate <dir>` passes | [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `omarchy plugin validate "$PWD"` exited with status `0`. |
| 23 | `qmllint` passes without errors or warnings | [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `qmllint -I "$OMARCHY_PATH/shell" Widget.qml CameraPopup.qml` exited with status `0`. |
| 24 | Security baseline patterns absent: no download-to-shell, no unpinned git-source execution, no sudoers edits, no privileged process control from shared temp state | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) (`Automated Security Baseline`) | **PASS** | Static audit of all repository files confirms none of these dangerous patterns exist: no network downloads to shell, no unpinned git checkout/execution, no `/etc/sudoers` modifications, no shared `/tmp` privileged control. |

---

## 2. Informational Notes

- **Entry Point Filename Convention:** The Omarchy plugin development guide uses `BarWidget.qml` as an example entry point name. In `abdul891.camera`, the entry point is named `Widget.qml` and is explicitly referenced by `manifest.json:entryPoints.barWidget`. The marketplace validator (`build-catalog.mjs` and `omarchy plugin validate`) requires that `entryPoints.barWidget` be a safe relative path pointing to an existing file, which is fully satisfied. Renaming `Widget.qml` is not required and would constitute an unnecessary code change.
- **Plugin Identifier:** The plugin ID remains `abdul891.camera` (matching the repository name and author GitHub handle).

---

## 3. User Action Required

Before submitting the plugin to the official marketplace, the user must perform the following actions:

1. **Push to a public GitHub repository**:
   Push the plugin commits to a public GitHub repository, e.g. `https://github.com/abdul891/abdul891.camera`.
2. **Add a `preview.png` screenshot**:
   Take a screenshot of the camera widget on the bar with the camera settings popup open, name it `preview.png` (or `.jpg`/`.webp`/`.avif`), and commit it to the repository root. The marketplace will automatically generate optimized thumbnail and card assets from this file.
3. **Confirm license choice**:
   Confirm that the `MIT` license choice and copyright attribution (`Copyright (c) 2026 Abdul Haseeb`) in [`LICENSE`](../LICENSE) and [`manifest.json`](../manifest.json) align with your preferences.
4. **Choose listing metadata**:
   - **Category**: `Hardware`
   - **Tags**: `bar`, `quickshell`, `media` (up to 3 tags allowed)
5. **Fill and submit the GitHub issue form**:
   Open a submission issue at [https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml](https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml) or create the issue via GitHub CLI:
   ```bash
   cat << 'EOF' > /tmp/camera-submission.md
   ### Repository URL

   https://github.com/abdul891/abdul891.camera

   ### Category

   Hardware

   ### Tags

   bar, quickshell, media

   ### Suggest a missing tag

   _No response_

   ### Maintainer notes

   Native Omarchy bar widget and settings popup providing Logi Tune-like controls for Logitech webcams (specifically optimized for MX Brio). Requires v4l-utils; cameractrls is optional for Logitech XU FOV controls. Stateless, unsandboxed hardware control via v4l2-ctl; writes no configuration files to disk.

   ### Submission checklist

   - [x] The repository is public and contains installation and removal instructions.
   - [x] I have documented the plugin license and any external dependencies.
   - [x] I confirm that I own or have permission to submit this plugin and its preview assets.
   - [x] The plugin does not overwrite user configuration without explicit consent.
   - [x] I understand that approval is for listing and is not a security review.
   EOF

   gh issue create \
     --repo omacom/omarchy-plugin-marketplace \
     --title "[Plugin]: Camera" \
     --body-file /tmp/camera-submission.md
   ```

---

## 4. Checks Run and Output

The following verification checks were executed in the repository root (`/home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abdul891.camera-20260921-222157-0469-main-sup-1`):

### Check 1: Model & Parser Unit Tests
Command:
```bash
node tests/model.test.js
```
Output:
```
All Model.js tests passed successfully!
```
Exit status: `0`

### Check 2: Omarchy Plugin Validator
Command:
```bash
omarchy plugin validate "$PWD"
```
Output:
*(Clean exit with no validation errors)*  
Exit status: `0`

### Check 3: QML Linting
Command:
```bash
qmllint -I "$OMARCHY_PATH/shell" Widget.qml CameraPopup.qml
```
Output:
*(Clean exit with no warnings or errors)*  
Exit status: `0`

### Check 4: Manifest JSON Syntax Validation
Command:
```bash
node -e 'JSON.parse(require("fs").readFileSync("manifest.json","utf8"))'
```
Output:
*(Valid JSON parsed successfully)*  
Exit status: `0`

### Check 5: Symlinks Check
Command:
```bash
find . -type l -not -path './.git/*' | wc -l
```
Output:
```
0
```
Exit status: `0`

### Check 6: Combined Prescribed Check Suite
Command:
```bash
node tests/model.test.js && omarchy plugin validate "$PWD" && qmllint -I "$OMARCHY_PATH/shell" Widget.qml CameraPopup.qml && node -e 'JSON.parse(require("fs").readFileSync("manifest.json","utf8"))' && find . -type l -not -path './.git/*' | wc -l
```
Output:
```
All Model.js tests passed successfully!
0
```
Exit status: `0`

### Check 7: Filesystem Write Audit
Command:
```bash
grep -in -E "(writeFile|writeFileSync|fs\.|openSync|createWriteStream|touch |rm |mv |cp |mkdir |tee |>>|>|File\b|StandardPaths)" Model.js Widget.qml CameraPopup.qml
```
Output:
*No file writes, filesystem mutations, or cache operations found. Subprocesses are restricted to `test -e`, `command -v`, `v4l2-ctl`, and `cameractrls`.*
