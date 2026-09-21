# Omarchy Plugin Marketplace Compliance Report: `abduldotdev.camera`

**Plugin ID:** `abduldotdev.camera`  
**Run ID:** `20260921-222157-0469-main`  
**Date:** 2026-09-21  

---

## 1. Compliance Audit Matrix

| # | Requirement | Source URL | Status | Evidence |
|---|---|---|---|---|
| 1 | Public GitHub repository | [`https://plugins.omarchy.org/publish.html`](https://plugins.omarchy.org/publish.html), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **USER ACTION** | Currently in local worktree repository. User must push to public GitHub repository before opening submission issue. |
| 2 | Exactly one plugin manifest present in repository root (`manifest.json`), no extra or nested manifests | [`https://plugins.omarchy.org/publish.html`](https://plugins.omarchy.org/publish.html), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`inspectPluginManifests` lines 1648-1657) | **PASS** | [`manifest.json`](../manifest.json#L1-L22) exists in repository root. Running `find . -name manifest.json -not -path './.git/*'` returns exactly one match (`./manifest.json`), confirming no additional manifests exist in the repository. |
| 3 | `schemaVersion` is exactly `1` | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` line 732) | **PASS** | [`manifest.json:2`](../manifest.json#L2): `"schemaVersion": 1`. |
| 4 | `id` field present, non-empty, trimmed, no control characters, length <= 128 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:3`](../manifest.json#L3): `"id": "abduldotdev.camera"` (18 characters, trimmed, no control characters). |
| 5 | `name` field present, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:4`](../manifest.json#L4): `"name": "Camera"` (6 characters, trimmed, no control characters). |
| 6 | `version` field present, non-empty, trimmed, no control characters, length <= 64 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:5`](../manifest.json#L5): `"version": "1.0.0"` (5 characters, trimmed, no control characters). |
| 7 | `author` field present, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:6`](../manifest.json#L6): `"author": "abduldotdev"` (11 characters, trimmed, no control characters). |
| 8 | `description` field present, non-empty, trimmed, no control characters, length <= 500 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest`, `manifestFieldLimits`) | **PASS** | [`manifest.json:8`](../manifest.json#L8): `"description": "Logitech webcam controller with Logi Tune-like settings"` (58 characters, trimmed, no control characters). |
| 9 | Optional `license` field string, non-empty, trimmed, no control characters, length <= 120 | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 752-764) | **FIXED** | Added [`manifest.json:7`](../manifest.json#L7): `"license": "MIT"` (3 characters, trimmed, no control characters). |
| 10 | `id` format: lowercase, regex `^[a-z0-9][a-z0-9._-]*$`, contains no consecutive dots (`..`) via `!manifest.id.includes("..")`, not `omarchy.*`, globally unique | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 766-778), [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | [`manifest.json:3`](../manifest.json#L3): `"abduldotdev.camera"` matches regex `^[a-z0-9][a-z0-9._-]*$`, does not contain consecutive dots (`..`), is strictly lowercase, outside `omarchy.*`, and namespaced by GitHub username. |
| 11 | `kinds` array non-empty, contains only supported kinds (`bar`, `bar-widget`, `menu`, `overlay`, `panel`, `service`) | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 779-784), [`https://raw.githubusercontent.com/omacom/omarchy/quattro/shell/plugins/README.md`](https://raw.githubusercontent.com/omacom/omarchy/quattro/shell/plugins/README.md) | **PASS** | [`manifest.json:9-11`](../manifest.json#L9-L11): `"kinds": [ "bar-widget" ]`. |
| 12 | `entryPoints` object has mapping for each kind (`bar-widget` -> `barWidget`) with safe relative path | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 785-807, `entryPointKey`) | **PASS** | Complete `entryPoints` object at [`manifest.json:12-14`](../manifest.json#L12-L14): `"entryPoints": { "barWidget": "Widget.qml" }` (safe relative path, no `..`, no `/`). |
| 13 | Declared entry point files exist | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifestFiles` lines 837-841) | **PASS** | [`Widget.qml`](../Widget.qml) exists in root. |
| 14 | `barWidget.defaultSection` in `left`, `center`, or `right` | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifest` lines 788-800) | **PASS** | [`manifest.json:20`](../manifest.json#L20): `"defaultSection": "right"`. |
| 15 | No symlinks in plugin folder | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateManifestFiles` lines 834-836), [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `find . -type l -not -path './.git/*'` returns `0` symlinks. |
| 16 | Root `README` file present | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateRepositoryDocs` lines 854-856), [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements) | **PASS** | [`README.md`](../README.md#L1-L185) present in repository root (185 lines). |
| 17 | Root `LICENSE` or `COPYING` file present | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/scripts/build-catalog.mjs) (`validateRepositoryDocs` lines 857-859), [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements) | **FIXED** | Added [`LICENSE`](../LICENSE#L1-L21) with MIT License, copyright (c) 2026 Abdul Haseeb. |
| 18 | `README.md` documents install AND removal instructions using `omarchy plugin add <repo-url> --enable` and `omarchy plugin remove <id>` | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://plugins.omarchy.org/develop.html#finished`](https://plugins.omarchy.org/develop.html#finished), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **FIXED** | Added standalone installation instructions at [`README.md:39-45`](../README.md#L39-L45) (`omarchy plugin add https://github.com/abduldotdev/camera.git --enable` at lines 41-43), uninstall instructions at [`README.md:57-65`](../README.md#L57-L65) (`omarchy plugin remove abduldotdev.camera` at lines 61-63), and preserved monorepo development instructions at [`README.md:47-55`](../README.md#L47-L55). |
| 19 | `README.md` documents license and every external dependency | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | **FIXED** | Dependencies documented at [`README.md:20-33`](../README.md#L20-L33) (`v4l-utils`, `cameractrls`, `shellcheck`), installation dependencies pointer added at [`README.md:37`](../README.md#L37), and `## License` section added at [`README.md:183-185`](../README.md#L183-L185). |
| 20 | Optional root preview: `preview.png`, `preview.jpg`, `preview.jpeg`, `preview.webp`, or `preview.avif` (limit: <= 50 MB, <= 40 megapixels) | [`https://plugins.omarchy.org/publish.html#requirements`](https://plugins.omarchy.org/publish.html#requirements), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) | **USER ACTION** | Optional screenshot asset (recommended, not mandatory). When adding, use an accepted format (`preview.png`, `preview.jpg`, `preview.jpeg`, `preview.webp`, or `preview.avif`) within the 50 MB and 40-megapixel limits. |
| 21 | Plugin does not overwrite user configuration | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md), [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | **PASS** | Verified by inspecting code and grepping `Model.js`, `Widget.qml`, `CameraPopup.qml` for file writes. The plugin executes only non-mutating status queries (`test -e`, `command -v`) and hardware ioctl/parameter commands (`v4l2-ctl`, `cameractrls`). No configuration files or caches are written to disk; plugin state is entirely in-memory and hardware-bound. Removal leaves nothing behind. |
| 22 | `omarchy plugin validate <dir>` passes | [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `omarchy plugin validate "$PWD"` exited with status `0`. |
| 23 | `qmllint` passes without errors or warnings | [`https://plugins.omarchy.org/develop.html#validate`](https://plugins.omarchy.org/develop.html#validate) | **PASS** | `qmllint -I "$OMARCHY_PATH/shell" Widget.qml CameraPopup.qml` exited with status `0`. |
| 24 | Security baseline patterns absent: no download-to-shell, no unpinned git-source execution, no sudoers edits, no privileged process control from shared temp state | [`https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) (`Automated Security Baseline`) | **PASS** | Static audit of all repository files confirms none of these dangerous patterns exist: no network downloads to shell, no unpinned git checkout/execution, no `/etc/sudoers` modifications, no shared `/tmp` privileged control. |

---

## 2. Informational Notes

- **Entry Point Filename Convention:** The Omarchy plugin development guide uses `BarWidget.qml` as an example entry point name. In `abduldotdev.camera`, the entry point is named `Widget.qml` and is explicitly referenced by `manifest.json:entryPoints.barWidget`. The marketplace validator (`build-catalog.mjs` and `omarchy plugin validate`) requires that `entryPoints.barWidget` be a safe relative path pointing to an existing file, which is fully satisfied. Renaming `Widget.qml` is not required and would constitute an unnecessary code change.
- **Plugin Identifier:** The plugin ID remains `abduldotdev.camera` (matching the repository name and author GitHub handle).

---

## 3. User Action Required

Before submitting the plugin to the official marketplace, the user must perform the following actions:

1. **Push to a public GitHub repository**:
   Push the plugin commits to a public GitHub repository, e.g. `https://github.com/abduldotdev/camera`.
2. **(Optional, recommended) Add a preview screenshot**:
   While preview assets are optional, adding one is strongly recommended. Capture a real screenshot of the camera widget on the bar with the camera settings popup open. Save it in the repository root using one of the accepted filenames: `preview.png`, `preview.jpg`, `preview.jpeg`, `preview.webp`, or `preview.avif`. Ensure the file complies with marketplace limits: maximum file size of 50 MB and maximum image resolution of 40 megapixels. The marketplace build runner will automatically strip metadata and generate optimized card and detail assets.
3. **Confirm license choice**:
   Confirm that the `MIT` license choice and copyright attribution (`Copyright (c) 2026 Abdul Haseeb`) in [`LICENSE`](../LICENSE) and [`manifest.json`](../manifest.json) align with your preferences.
4. **Choose listing metadata**:
   - **Category**: `Hardware`
   - **Tags**: `bar`, `quickshell`, `media` (up to 3 tags allowed)
5. **Review, owner confirmation, and issue submission (Mandatory owner approval gate)**:
   In strict accordance with [`SUBMISSION.md`](https://raw.githubusercontent.com/omacom/omarchy-plugin-marketplace/main/SUBMISSION.md) ("Instructions for AI agents"), the submission checklist checkboxes **must not be pre-submitted without personal confirmation from the plugin owner**.
   
   Before running the submission command:
   - The plugin owner must personally confirm ownership and verify every one of the five checklist statements:
     1. *"The repository is public and contains installation and removal instructions."*
     2. *"I have documented the plugin license and any external dependencies."*
     3. *"I confirm that I own or have permission to submit this plugin and its preview assets."*
     4. *"The plugin does not overwrite user configuration without explicit consent."*
     5. *"I understand that approval is for listing and is not a security review."*
   - The plugin owner must review the completed issue title (`[Plugin]: Camera`) and issue body text shown below.
   - Only after the owner has explicitly confirmed the checklist items and approved the submission may the GitHub issue be created.

   Once confirmed and approved by the owner, open a submission issue at [https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml](https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml) or run:
   ```bash
   cat << 'EOF' > /tmp/camera-submission.md
   ### Repository URL

   https://github.com/abduldotdev/camera

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

The following verification checks were executed in the repository root:

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

### Check 6: Repository Manifest Count Check
Command:
```bash
find . -name manifest.json -not -path './.git/*'
```
Output:
```
./manifest.json
```
Exit status: `0`

### Check 7: Combined Prescribed Check Suite
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

### Check 8: Filesystem Write Audit
Command:
```bash
grep -in -E "(writeFile|writeFileSync|fs\.|openSync|createWriteStream|touch |rm |mv |cp |mkdir |tee |>>|>|File\b|StandardPaths)" Model.js Widget.qml CameraPopup.qml
```
Output:
*No file writes, filesystem mutations, or cache operations found. Subprocesses are restricted to `test -e`, `command -v`, `v4l2-ctl`, and `cameractrls`.*
