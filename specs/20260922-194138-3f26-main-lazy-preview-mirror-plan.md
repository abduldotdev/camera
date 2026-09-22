# Plan: Click-to-activate preview and session-scoped mirror
Spec: specs/20260922-194138-3f26-main-lazy-preview-mirror.md

## Approach

The acquire decision moves into one pure `Model.previewMayAcquire` function, and `cameraLoader.active` becomes a call to that function. Today the loader turns on from the long conjunction at `CameraPopup.qml:47`, which is true as soon as the popup is open, and the inner `Camera` is hard-coded `active: true` (`CameraPopup.qml:62`). Keeping `active: true` on the inner `Camera` and destroying it by unloading the `Loader` is the existing release mechanism; the new flag is one more term in that gate, not a second `Camera.active` binding. Both flags live on `Widget.qml`, which already owns every other property, the `Process` objects, and the `IpcHandler` (`Widget.qml:352`). The popup only displays them and emits signals, the same way `deviceChangeRequested` already reaches `setDevice`. Mirror is a `Scale` on the `VideoOutput` item alone because `v4l2-ctl -d /dev/video0 --list-ctrls` on the attached MX Brio has no `hflip`, `vflip`, or `horizontal_flip`, and a driver write would change cameras that do expose those controls. Three workers share this checkout and run in order: implement, then test, then docs.

## Decisions

1. **Mirror lifetime is settled.** `mirrorPreview` is shell-session state. It starts `false` on a newly created widget, survives popup close and device switch, and is not cleared by `resetDefaults` or by `open()`. It is not written to disk and it is not written through `property var settings` (`Widget.qml:11`), which stays unused. `previewActive` is the opposite: `open()` and `switchTo` force it `false`.
2. **Checks.** From the repo root, every worker finishes with `node tests/model.test.js`, `node tests/hardware.test.js`, and `qmllint Widget.qml CameraPopup.qml`. All three exit 0 on the base commit with the MX Brio attached. A non-zero exit is a regression. `SKIP: no capture device found` is also a failed check for this run, because the camera is attached. Per-control lines such as `SKIP: <name> not exposed` are the existing hardware-test behaviour and stay allowed.
3. **File split.** Implement owns `Model.js`, `CameraPopup.qml`, `Widget.qml`, and only the existing `PREVIEW_STATES` assertion. Test owns new coverage in `tests/model.test.js` and `tests/hardware.test.js`. Docs owns `README.md`. No step edits a file the table below does not list.
4. **Test lines that must not overlap.** The implement worker edits only the array and the length assertion at `tests/model.test.js:890-898`. The test worker does not touch those lines, does not touch `tests/model.test.js:879` (`Object.keys(Model.CONTROLS).length === 18`), and does not edit section 14. New model coverage is a new section 24 inserted immediately above the final `console.log` at `tests/model.test.js:1714`. New hardware coverage is inserted after the FOV snapshot at `tests/hardware.test.js:117` and before the `try {` at `tests/hardware.test.js:122`. The control loop and the `finally` restore stay as they are.

## Steps

1. **Model contract and the one assertion that would go red** — worker: implement — file(s): `Model.js`, `tests/model.test.js`
   - objective: Make the new pure functions importable from QML and from Node, and keep `node tests/model.test.js` green after `PREVIEW_STATES` grows. Do not add the behavioural tests; those belong to step 3.
   - change: In `Model.js`, replace `PREVIEW_STATES` (`Model.js:15-22`) with exactly `["idle", "active", "inactive", "busy", "permission", "disconnected", "unavailable"]`. Add two top-level `function` declarations, then export them on the existing `module.exports` object next to `PREVIEW_STATES` (`Model.js:1216-1219`).

     `parseFlag(value)` returns `true` only for the string `"1"`, `false` only for the string `"0"`, and `null` for every other value (`""`, `"true"`, `"false"`, `"on"`, `"off"`, `"2"`, numbers, missing).

     `previewMayAcquire(input)` returns `true` only when `input` is an object and all nine terms hold: `open === true`, `activated === true`, `devicePresent === true`, `permissionDenied` is not `true`, `captureBusy` is not `true`, `previewPaused` is not `true`, `devicePath` is a non-empty string, `previewBoundPath === devicePath`, and `hasCameraInput === true`. Any other input, including `null` or a missing field, returns `false`.

     Stay in the file's ES5 subset: `var` and `function` only. No `const`, `let`, arrow functions, template literals, or spread. Do not add `mirror`, `hflip`, `vflip`, or `horizontal_flip` to `CONTROLS`. Do not change `buildV4l2SetCommand`, `buildResetCommands`, or any other builder.

     In `tests/model.test.js`, edit only lines 890-898. The `deepEqual` array gains `"idle"` as the first element, in the order above, and the length assertion changes from `6` to `7`. Leave the comment `// 15. PREVIEW_STATES` and every other line in the file alone.
   - verify: `node tests/model.test.js` exits 0. `Model.PREVIEW_STATES.length` is 7. `grep -n "const \|let \|=>" Model.js` shows no new hits inside the added functions.
   - risk: A `const` or arrow in `Model.js` loads in Node and then fails when Quickshell imports the file. The length assertion is the only test line this worker may change; editing anything around it collides with step 3.

2. **Widget state, IPC, and popup view** — worker: implement — file(s): `Widget.qml`, `CameraPopup.qml`
   - objective: Opening the popup leaves the camera unloaded until an explicit start. Stop, close, and device switch release a stream that actually started and reapply the driver format to the device that streamed. Mirror flips only the video image and survives close and device switch.
   - change: **Widget properties**, next to `previewWasActiveDuringSession` (`Widget.qml:42`):

     - `property bool previewActive: false`
     - `property bool mirrorPreview: false`
     - `property string previewError: ""` — `""`, or `"busy"`, `"permission"`, `"unavailable"` after a failed start

     **Widget functions.**

     - `releasePreviewedDevice()`: if `previewWasActiveDuringSession` is false, return. Otherwise set that flag false, then call the existing `reapplyCaptureMode()` (`Widget.qml:123`). `reapplyCaptureMode` reads `root.device` and `root.captureMode` at call time and queues `buildV4l2SetCaptureModeCommand`. The existing pump already refuses to run a capture command while `popup.cameraActive` is true and waits on `fuser` (`Widget.qml:149-157`), and `onCameraActiveChanged` already calls `pumpCommandQueue` (`Widget.qml:659`). Do not rewrite that wait.
     - `startPreview()`: if `previewActive` is already true, return. Set `previewError` to `""` and `previewActive` to true.
     - `stopPreview()`: set `previewActive` to false and `previewError` to `""`, then `releasePreviewedDevice()`. The popup stays open. A second stop finds the flag already false and does not queue a second restore.
     - `notePreviewFailure(kind)`: accept only `"busy"`, `"permission"`, and `"unavailable"`. Set `previewError` to that kind, set `previewActive` to false, then `releasePreviewedDevice()`. A failure before `cameraActive` has ever become true does not restore, because the flag is still false.
     - `setPreviewActive(active)`: `var flag = Model.parseFlag(active)`. `null` returns without changing the popup or either flag. `true` calls `open()` only when `popup.open` is false, then calls `startPreview()`. `open()` clears `previewActive`, so `startPreview()` must run after `open()` returns. `false` calls `stopPreview()` and does not close the popup. Calling `setPreviewActive("1")` when already active, or `"0"` when already idle with no stream to restore, does not restart the camera and does not queue a restore.
     - `setMirror(enabled)`: `parseFlag`; `null` returns. Otherwise assign `mirrorPreview`. Do not change `previewActive`, `previewError`, `captureMode`, or the command queue.
     - `getPreview()` returns `popup.previewState`. `getMirror()` returns `"1"` when `mirrorPreview` is true and `"0"` otherwise.
     - At the top of `setControl` (`Widget.qml:164`), return immediately when `name` is `mirror`, `hflip`, `vflip`, or `horizontal_flip`. Do not write `root.controls` and do not queue a command. `resetDefaults` (`Widget.qml:197`) does not read or write the three new properties.

     **Activation clears.**

     - `open()` (`Widget.qml:48`): beside the existing `previewWasActiveDuringSession = false`, set `previewActive` false and `previewError` to `""`. Do not call `releasePreviewedDevice` here. `open()` runs only to show a popup that is currently closed; the previous close or stop already restored.
     - `close()` (`Widget.qml:44`) stays `popup.open = false` and `captureBusy = false`. Do not also restore inside `close()`. The popup `onOpenChanged` handler below is the close path, and `HyprlandFocusGrab.onCleared` already calls `close()` (`CameraPopup.qml:150`).
     - Popup `onOpenChanged` on the `CameraPopup` instance (`Widget.qml:650`): when `popup.open` becomes false, set `previewActive` false and `previewError` to `""`, keep the existing `captureBusy = false`, and replace the inlined reapply with `releasePreviewedDevice()`.
     - `switchTo` (`Widget.qml:298`): before `root.device = deviceObj.path` and before `captureMode` is cleared, set `previewActive` false, set `previewError` to `""`, and call `releasePreviewedDevice()`. The queued command must already contain the old device path. Do not change `mirrorPreview`.
     - `applyDevices` when `selectActiveDevice` returns nothing (`Widget.qml:272`): same three calls before `root.device = ""` and before `captureMode` is cleared. Leave `mirrorPreview` alone.
     - `checkDeviceProc` failure branch (`Widget.qml:417-427`): set `previewActive` false and `previewError` to `""`. Keep the existing assignment that clears `previewWasActiveDuringSession` without calling `reapplyCaptureMode`. The node is missing or not writable; a set-fmt there fails and latches `captureBusy`.
     - `setCaptureMode` (`Widget.qml:92`): do not assign `previewActive`. `pendingCaptureCount` already makes `previewPaused` true (`Widget.qml:38`), which makes `previewMayAcquire` false and unloads the loader. When the count returns to 0 and `captureBusy` is false, a `previewActive` that is still true acquires again with no second click. A format change while `previewActive` is false leaves it false.

     **IPC**, inside the existing handler, after `listDevices` (`Widget.qml:365`). Typed arguments, string returns for the getters, no return type on the setters:

     - `function getPreview(): string { return root.getPreview() }`
     - `function setPreviewActive(active: string) { root.setPreviewActive(active) }`
     - `function getMirror(): string { return root.getMirror() }`
     - `function setMirror(enabled: string) { root.setMirror(enabled) }`

     **Popup properties**, next to `previewBoundPath` (`CameraPopup.qml:30`): `property bool previewActive: false`, `property bool mirrorPreview: false`, `property string previewError: ""`. Bind them from the `CameraPopup` instance in `Widget.qml` (`Widget.qml:631`) the same way `previewPaused: root.previewPaused` is bound. Add:

     - `signal previewStartRequested()`
     - `signal previewStopRequested()`
     - `signal mirrorChangeRequested(bool enabled)`
     - `signal previewFailed(string kind)`

     Wire `onPreviewStartRequested: root.startPreview()`, `onPreviewStopRequested: root.stopPreview()`, `onMirrorChangeRequested: function(enabled) { root.mirrorPreview = enabled }`, `onPreviewFailed: function(kind) { root.notePreviewFailure(kind) }`.

     **Loader gate.** Replace the conjunction at `CameraPopup.qml:47` with a call to `Model.previewMayAcquire`. Pass `open: root.open`, `activated: root.previewActive`, `devicePresent: root.devicePresent`, `permissionDenied: root.permissionDenied`, `captureBusy: root.captureBusy`, `previewPaused: root.previewPaused`, `devicePath: root.devicePath`, `previewBoundPath: root.previewBoundPath`, `hasCameraInput: root.pickCameraDevice() !== null`. If `Model.previewMayAcquire` is missing, the loader is inactive. Leave the inner `Camera { active: true }` (`CameraPopup.qml:62`) unchanged. Leave `onDevicePathChanged` (`CameraPopup.qml:140`) unchanged; the one-frame `previewBoundPath` clear still forces the gate false across a path change.

     **previewState** (`CameraPopup.qml:83`) stays a pure binding. No signal emissions inside it. First match wins:

     1. `!devicePresent` → `disconnected`
     2. `permissionDenied` → `permission`
     3. `devicePath !== ""` and `pickCameraDevice()` is null → `unavailable`
     4. `!previewActive` and `captureBusy` → `busy`
     5. `!previewActive` and `previewError` is `busy`, `permission`, or `unavailable` → that string
     6. `!previewActive` → `idle`
     7. `previewActive` and (`captureBusy` or `previewPaused`) → `busy`
     8. `previewActive` and `cameraActive` → `active`
     9. `previewActive` → `inactive`

     **Camera error.** Inside the loader component, on the `Camera`, handle `errorOccurred`. Classify `errorString` with the same `indexOf` checks already at `CameraPopup.qml:91-96` (`permission` / `denied` / `access` → `permission`; `in use` / `busy` / `resource` → `busy`; otherwise `unavailable`). Emit `previewFailed(kind)` once per start attempt. Guard with `property bool previewFailureReported: false` on the popup, set true when emitting, and reset it to false when `previewActive` becomes true. Do not emit from the `previewState` binding.

     **Frame copy and buttons**, in the existing centered column (`CameraPopup.qml:628-693`). Add branches; keep the current disconnected, busy, and permission strings.

     - `idle`: title `Preview off`, detail `Click to start the live view`, button `Start preview`
     - `inactive`: title `Starting preview`, detail `Opening the camera`, button `Stop preview`
     - `active`: `VideoOutput` visible, button `Stop preview` over the frame
     - retained `busy` or `unavailable` (`previewError` equals that state and `captureBusy` is false and a Qt input matches): existing error copy plus `Start preview`
     - `permission`, `disconnected`, structural `unavailable` (no Qt input), and `busy` caused by `captureBusy`: no `Start preview`. Disconnected keeps Retry, which still only emits `refreshRequested`.
     - `busy` while `previewActive` is true (`previewPaused` or `captureBusy` during a format write): neither Start nor Stop

     `Start preview` and a click on the idle frame both emit `previewStartRequested`. `Stop preview` emits `previewStopRequested`. The frame `MouseArea` is enabled only when Start is visible, and it sits under the buttons so Retry, Start, and Stop receive their own clicks. While the video is showing, the `MouseArea` is disabled: a click on the image does not stop the preview.

     **Mirror row.** Direct child of `mainCol` (`CameraPopup.qml:517`, `spacing: 8`), between `previewFrame` and `flick`. A `CameraToggle` (`CameraPopup.qml:329`) with `label: "Mirror"`, `checked: root.mirrorPreview`, `visible: root.devicePath !== ""`, `onToggled: root.mirrorChangeRequested(!root.mirrorPreview)`. The toggle's `onToggled` carries no value; invert the current flag at the call. Do not emit `controlChanged`. The popup's `implicitWidth` stays 380 and `implicitHeight` stays 640 (`CameraPopup.qml:126-127`). The `flick` height formula (`CameraPopup.qml:704`) also subtracts `mirrorToggle.height` and one `mainCol.spacing` when the toggle is visible.

     **Flip only the video item.** On `viewfinder` (`CameraPopup.qml:617`), add a `transform: Scale` whose `origin` is the center of `viewfinder`, `xScale` is `-1` when `mirrorPreview` is true and `1` otherwise, and `yScale` is `1`. Do not set `transform` on `previewFrame`, on the clip `Rectangle`, or on the overlay `Column`. Overlay text, Start, Stop, Retry, and the Mirror row stay unflipped. Toggling mirror does not change `previewActive` and does not reload `cameraLoader`.
   - verify: `qmllint Widget.qml CameraPopup.qml` exits 0. `node tests/model.test.js` still exits 0. Inspection: `cameraLoader.active` is the `previewMayAcquire` call and includes `activated: root.previewActive`. `open()` assigns `previewActive = false`. `switchTo` calls `releasePreviewedDevice()` before writing `root.device`. The `Scale` is declared on `viewfinder` only. `grep -n "settings" Widget.qml` still shows only the unused declaration at line 11.
   - risk: Calling `reapplyCaptureMode` after `switchTo` has already changed `root.device` restores the wrong camera. Clearing `previewWasActiveDuringSession` in both `stopPreview` and `onOpenChanged` without the shared helper queues two set-fmt commands. Putting the `Scale` on the frame parent mirrors the Start and Stop labels. Setting `previewActive` false inside the `previewPaused` path means a resolution change kills the session and the preview does not come back. Setting `previewActive` true before `open()` returns leaves a bar-icon open armed, because `open()` must clear the flag and `startPreview()` must set it afterwards.

3. **New test coverage** — worker: test — file(s): `tests/model.test.js`, `tests/hardware.test.js`
   - objective: Lock `previewMayAcquire`, `parseFlag`, and the absence of a mirror device control. Do not edit the lines step 1 already changed, and do not edit QML or `Model.js`.
   - change: Append section `// 24. Lazy preview gate, parseFlag, mirror is not a device control` immediately above `console.log("All Model.js tests passed successfully!")` (`tests/model.test.js:1714`). Do not modify lines 879 or 890-898.

     `parseFlag`: `"1"` → `true`, `"0"` → `false`, and `""`, `"true"`, `"false"`, `"on"`, `"off"`, `"2"` → `null`.

     `previewMayAcquire`: one object with all nine fields true (`open`, `activated`, `devicePresent`, `permissionDenied: false`, `captureBusy: false`, `previewPaused: false`, `devicePath: "/dev/video0"`, `previewBoundPath: "/dev/video0"`, `hasCameraInput: true`) returns `true`. Nine further calls each break exactly one term and return `false`: `open` false, `activated` false, `devicePresent` false, `permissionDenied` true, `captureBusy` true, `previewPaused` true, `devicePath` `""`, `previewBoundPath` `"/dev/video2"` while `devicePath` is `"/dev/video0"`, `hasCameraInput` false. Also `previewMayAcquire(null)` and `previewMayAcquire({})` return `false`.

     Mirror is not a control: `Model.CONTROLS.mirror`, `.hflip`, `.vflip`, and `.horizontal_flip` are `undefined`. `Object.keys(Model.CONTROLS).length` is still 18, asserted again in this new section so line 879 stays untouched. Join the argv of `buildResetCommands()` and of `buildResetCommands("/dev/video0", genericParsed)` (`genericParsed` is the existing top-level generic UVC parse). Join the argv of `buildV4l2SetCommand("/dev/video0", "brightness", 1)`. None of those strings contain `hflip`, `vflip`, `horizontal_flip`, or `mirror`.

     In `tests/hardware.test.js`, after the `originalValues` / FOV snapshot (`tests/hardware.test.js:107-117`) and before the `try` at line 122, assert the same four `Model.CONTROLS` properties are `undefined`. Then assert that a missing live control is allowed: for each of `hflip`, `vflip`, and `horizontal_flip`, if `initialV4l2[name]` is `undefined`, that is a pass. Do not `process.exit`, do not skip the suite, and do not `continue` the rest of the file. Do not add a `v4l2-ctl --set-ctrl` for those names. Do not open a Qt `Camera`. Leave the `for (const name of Object.keys(Model.CONTROLS))` loop, the capture-mode round trip, the streaming brightness probe, and the `finally` restore unchanged. If the attached camera exposes a flip control, that loop may still round-trip it as a generic control; that write is not the mirror feature and this step must not add another one.
   - verify: `node tests/model.test.js` exits 0. `node tests/hardware.test.js` exits 0 against the attached MX Brio and does not print `SKIP: no capture device found`.
   - risk: Rewriting the section 15 array, or inserting section 24 in the middle of section 15, conflicts with the implement edit. Skipping the suite when `hflip` is absent turns the MX Brio into a false pass that never reaches the later restore. Adding a flip `set-ctrl` changes a real image control on cameras that have one.

4. **README** — worker: docs — file(s): `README.md`
   - objective: Document the behaviour step 2 implemented. Do not edit QML, `Model.js`, tests, `manifest.json`, `preview.png`, or older files in `specs/`.
   - change: Keep the stateless sentence at `README.md:66` true. Add that preview activation and mirror are in-memory session values and are not written to disk. State the settled lifetimes: mirror survives popup close and device switch and starts off in a fresh widget; activation resets on every popup open and on device switch.

     `README.md:12` and the in-popup viewfinder bullet: the viewfinder starts only after Start preview, a click on the idle frame, or `setPreviewActive 1`. Opening the popup does not start it. It releases on Stop preview and on close.

     `README.md:13` and the Logi Tune row at `README.md:125`: seven states, naming idle (`Preview off`) with Active, Inactive, Busy, Permission Denied, Disconnected, and Unavailable. Driver-format restore runs after a preview that actually reached active, including stop while the popup stays open and including a device switch (restore aimed at the device that streamed). Restore is skipped when the preview never became active.

     Add a features bullet for Mirror: horizontal flip of the in-popup preview image only, same on every camera, no V4L2 control. The overlay and the settings rows stay unflipped.

     Add a Logi Tune table row: Mirror, supported, preview view transform, remembered until the shell exits, not a V4L2 control. Say the MX Brio `v4l2-ctl -d /dev/video0 --list-ctrls` list has no `hflip`, `vflip`, or `horizontal_flip`, which is why the reference device cannot store it.

     In the IPC section (`README.md:129`), add the four commands in the same `omarchy-shell abduldotdev.camera` form as the existing examples:

     ```bash
     omarchy-shell abduldotdev.camera getPreview
     omarchy-shell abduldotdev.camera setPreviewActive 1
     omarchy-shell abduldotdev.camera setPreviewActive 0
     omarchy-shell abduldotdev.camera getMirror
     omarchy-shell abduldotdev.camera setMirror 1
     omarchy-shell abduldotdev.camera setMirror 0
     ```

     `getPreview` prints one of `idle`, `active`, `inactive`, `busy`, `permission`, `disconnected`, `unavailable`. `getMirror` prints `0` or `1`. Any setter value other than `0` or `1` leaves the flag unchanged.

     In Testing, add one sentence that `tests/model.test.js` covers `PREVIEW_STATES`, `previewMayAcquire`, and `parseFlag`.
   - verify: `grep -n "setPreviewActive\|setMirror\|Preview off\|previewMayAcquire" README.md` shows the new contract. The three repo checks still exit 0.
   - risk: Rewriting the stateless sentence so it claims a config file is written contradicts `Widget.qml`, which never uses `settings`. Documenting mirror as `hflip` sends the next reader toward a driver control the MX Brio does not have.

## Parallelisation

| step | owns files | may run concurrently with |
|---|---|---|
| 1. Model contract | `Model.js`; `tests/model.test.js` lines 890-898 only | none. Step 2 calls `previewMayAcquire` and `parseFlag`. |
| 2. Widget and popup | `Widget.qml`, `CameraPopup.qml` | none. Same implement worker, after step 1. Shares the checkout with steps 3 and 4. |
| 3. New tests | `tests/model.test.js` section 24 above the final `console.log`; `tests/hardware.test.js` between the snapshot and the `try` | none. Runs after step 2. Must not edit lines 890-898. |
| 4. README | `README.md` | none. Runs after step 3. |

## Checks

| command | when |
|---|---|
| `node tests/model.test.js` | End of step 1. Again at the end of steps 2, 3, and 4. Exit 0. |
| `qmllint Widget.qml CameraPopup.qml` | End of step 2, and again at the end of steps 3 and 4. Exit 0. Run from the repo root. No extra `-I` flag; that command already exits 0 on this tree. |
| `node tests/hardware.test.js` | End of steps 2, 3, and 4. Exit 0 against the attached MX Brio. `SKIP: no capture device found` fails this run. |
| All three commands | Every worker runs all three before it stops, even when its step verify names a narrower inspection. A failure is a regression against the base commit, where all three already exit 0. |

## Risks

- **Two workers, one assertion.** Step 1 owns `tests/model.test.js:890-898` and nothing else in that file. Step 3 appends section 24 above line 1714. If step 3 rewrites the `deepEqual`, the workers conflict and one result is lost. Detect by `git diff -U0 -- tests/model.test.js` showing the array change only in the implement commit and only additions at the end in the test commit.
- **ES5 in `Model.js`.** Node will run arrows; Quickshell will not. `qmllint` does not parse `Model.js`. Detect by reading the added functions for `const`, `let`, `=>`, and backticks before finishing step 1.
- **Restore aimed at the wrong device.** `reapplyCaptureMode` captures `root.device` when it is called. `switchTo` and the empty `applyDevices` branch must call `releasePreviewedDevice()` while the old path and the old `captureMode` are still in place. Detect by reading `switchTo` top to bottom: the release call appears above `root.device = deviceObj.path`.
- **Double restore.** Stop and the later close both used to be able to queue set-fmt. `releasePreviewedDevice` clears `previewWasActiveDuringSession` before queueing, so the close path's second call returns immediately. Detect by reading that helper once and confirming both call sites use it.
- **Format write drops the session.** `setCaptureMode` must not assign `previewActive`. `previewPaused` unloads the loader; when `pendingCaptureCount` hits 0 the same flag acquires again. Detect by `grep previewActive Widget.qml` and confirming `setCaptureMode` is not in the hits.
- **Overlay flips with the video.** The `Scale` belongs on `viewfinder` only. The overlay `Column` is a sibling (`CameraPopup.qml:624`), and it stays a sibling. Detect by confirming the `transform` block is inside `VideoOutput` and the Mirror `CameraToggle` is outside `previewFrame`.
- **Failed set-fmt latches `captureBusy`.** The `checkDeviceProc` failure branch keeps today's "clear `previewWasActiveDuringSession` and do not reapply" behaviour. Restoring there targets a node that just failed `test -e` or the read/write test. Detect by reading the `else` at `Widget.qml:417` and confirming it still does not call `reapplyCaptureMode`.
- **Popup grows past 640px.** The Mirror row is outside `flick`. Forgetting to subtract `mirrorToggle.height` and one spacing unit from the formula at `CameraPopup.qml:704` clips the settings list. `implicitHeight` stays 640.
- **Hardware test and real flip controls.** The generic loop may set `hflip` when a future camera exposes it. Step 3 must not add a second write, and must not treat a missing flip control as a skip. On this MX Brio the names are absent, so the new asserts pass without writing those controls.
