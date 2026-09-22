# Spec: Click-to-activate preview and session-scoped mirror

## Problem

Opening the camera settings popup acquires the capture device and starts the live viewfinder. The plugin also has no user-facing way to mirror that preview.

1. **The popup acquires the camera by becoming visible.** [`CameraPopup.qml`](../CameraPopup.qml#L47) sets `cameraLoader.active` from `root.open && root.devicePresent && !root.permissionDenied && !root.captureBusy && !root.previewPaused && root.previewBoundPath === root.devicePath && root.devicePath !== "" && (root.pickCameraDevice() !== null)`. The loaded `Camera` sets `active: true` ([`CameraPopup.qml`](../CameraPopup.qml#L62)). `open` defaults to false ([`CameraPopup.qml`](../CameraPopup.qml#L16)), so merely loading the bar widget does not start the stream, but `Widget.open()` ([`Widget.qml`](../Widget.qml#L48)) sets `popup.open = true` with no further user step. The bar's left click calls `toggle()` ([`Widget.qml`](../Widget.qml#L622)), and IPC `open` / `toggle` call the same functions ([`Widget.qml`](../Widget.qml#L355)). README still describes that behaviour: the viewfinder "opens on demand strictly when the settings popup is open" ([`README.md`](../README.md#L12)) and "streams … only while the popup is open" ([`README.md`](../README.md#L125)).

2. **There is no not-started preview state.** [`Model.js`](../Model.js#L15) `PREVIEW_STATES` is `active`, `inactive`, `busy`, `permission`, `disconnected`, `unavailable`. [`tests/model.test.js`](../tests/model.test.js#L890) asserts that exact list and length 6. [`CameraPopup.qml`](../CameraPopup.qml#L83) maps every non-active condition onto those six tokens. The overlay's fallback copy for anything other than disconnected, busy, or permission is "Preview Unavailable" / "Video stream unavailable" ([`CameraPopup.qml`](../CameraPopup.qml#L650)). A popup that has not been asked to stream would show an error. The frame is not clickable, and the only button inside it is Retry, shown solely for `disconnected` ([`CameraPopup.qml`](../CameraPopup.qml#L690)).

3. **Closing the popup restores the driver capture mode only if a preview actually streamed.** `previewWasActiveDuringSession` starts false ([`Widget.qml`](../Widget.qml#L42)). `open()` clears it ([`Widget.qml`](../Widget.qml#L49)). It becomes true only when `popup.cameraActive` becomes true ([`Widget.qml`](../Widget.qml#L659)). On close, `reapplyCaptureMode()` runs only when that flag is set ([`Widget.qml`](../Widget.qml#L650)). `reapplyCaptureMode()` ([`Widget.qml`](../Widget.qml#L123)) queues `buildV4l2SetCaptureModeCommand` for the current device. Capture commands wait until `popup.cameraActive` is false and until `fuser` reports the device free ([`Widget.qml`](../Widget.qml#L149)). A lazy preview that never starts has nothing to reapply. A preview that starts and then stops while the popup stays open currently has no stop path, so the restore runs only on close.

4. **The reference camera has no hardware mirror control.** On 2026-09-22, `v4l2-ctl --list-devices` on this machine listed `MX Brio (usb-0000:08:00.1-2)` with capture node `/dev/video0`. `v4l2-ctl -d /dev/video0 --list-ctrls` returned these controls and no others: `brightness`, `contrast`, `saturation`, `white_balance_automatic`, `gain`, `power_line_frequency`, `white_balance_temperature`, `sharpness`, `backlight_compensation`, `auto_exposure`, `exposure_time_absolute`, `exposure_dynamic_framerate`, `pan_absolute`, `tilt_absolute`, `focus_absolute`, `focus_automatic_continuous`, `zoom_absolute`. Nothing is named `hflip`, `vflip`, or `horizontal_flip`. [`VideoOutput`](../CameraPopup.qml#L617) has no flip. A mirror that sent `v4l2-ctl --set-ctrl` would fail on the reference device and would change real image controls on cameras that do expose a flip control.

5. **The plugin does not persist UI preferences.** [`README.md`](../README.md#L66) states that removal leaves nothing behind and that the plugin "does not write any configuration files, caches, or state to disk." [`Widget.qml`](../Widget.qml#L11) declares `property var settings` and never reads or writes it. Device controls persist because they are driver state, not plugin files. A mirror flag has no driver field on the MX Brio, so it cannot follow that hardware path.

[`Widget.qml`](../Widget.qml) holds widget state, every `Process`, and the `IpcHandler` ([`Widget.qml`](../Widget.qml#L352)). [`CameraPopup.qml`](../CameraPopup.qml) holds the popup UI and the Qt Multimedia objects inside `cameraLoader`. [`Model.js`](../Model.js#L5) is the dual-environment model (QML `import` and Node `require`) and the only layer [`tests/model.test.js`](../tests/model.test.js) can execute. There is no `package.json`, no CI workflow, and no formatter.

## Scope

### In scope

1. A per-popup-session preview activation flag that defaults to off every time the popup opens and every time the selected capture device changes. The viewfinder acquires the device only after an explicit activation.
2. A start affordance on the viewfinder frame, and a stop affordance that releases the device without closing the popup. Closing the popup also releases the device.
3. A new `idle` preview state for "device available, preview not started", added to `PREVIEW_STATES` and to the popup overlay. The existing six states stay, including the transitional `inactive` state used while a requested start has not yet become active.
4. The capture-mode restore contract: reapply the driver default only after a preview stream actually became active, and reapply it when that stream is left (stop, close, or switch away). Skip reapply when the preview never started.
5. A session-scoped horizontal mirror of the rendered preview image, presented with the existing `CameraToggle` row, exposed through IPC, and applied the same way on every capture device.
6. IPC methods on the existing `abduldotdev.camera` handler, using typed arguments and string returns, for preview activation and mirror.
7. Updates to [`README.md`](../README.md) and the assertions in [`tests/model.test.js`](../tests/model.test.js) and [`tests/hardware.test.js`](../tests/hardware.test.js) described under Behaviour.

### Out of scope

- Writing either flag to disk, to `property var settings`, or to a V4L2 control.
- Vertical flip, rotation, or a per-device remembered mirror.
- A viewfinder in the bar icon, or any change to bar opacity, discovery, the 15-second refresh, or the 3-second control poll ([`Widget.qml`](../Widget.qml#L587)).
- Treating mirror as `hflip`, `vflip`, or `horizontal_flip`, including on cameras that expose those controls.
- Changing `resetDefaults()`, the control catalog, capture-mode negotiation, or device discovery.
- Replacing [`preview.png`](../preview.png), bumping [`manifest.json`](../manifest.json), or editing older files under `specs/`.
- A new QML test harness, package, formatter, or CI job.

## Behaviour

### 1. Session scope

Both new flags live in memory on the widget for the running shell process. The plugin still writes no configuration file, cache, or state file. `property var settings` stays unused.

- **Preview activation** is popup-session state. It is off when the widget is created, off after every popup open that the user did not combine with an explicit start, off after every device switch, and off after stop or close. Reopening the popup always shows a stopped preview.
- **Mirror** is shell-session state. It is off when the widget is created, which matches today's unflipped `VideoOutput`. It stays as the user set it across popup close, popup reopen, device switch, and Reset defaults. It returns to off when the shell process goes away, because there is nowhere to store it: the reference device has no flip control, and the plugin must not gain a config file.

Device controls continue to persist in the driver. Mirror is a view preference, so it does not follow that path. Reset defaults ([`Widget.qml`](../Widget.qml#L197)) restores device controls only. It does not change mirror and does not start the preview.

### 2. What counts as acquiring the camera

Acquiring means the Qt `Camera` inside `cameraLoader` is active and the shell holds a streaming file descriptor on the selected capture node.

These existing calls may keep running when the popup is open and when the preview is idle. They are control and enumeration queries, and they already run while the popup is closed:

- `v4l2-ctl` device discovery, `--list-ctrls-menus`, `--list-formats-ext`, and `--get-fmt-video` / `--get-parm`
- `cameractrls -l` when FOV is being probed
- `test -e` / `test -r` / `test -w` in `checkDeviceProc` ([`Widget.qml`](../Widget.qml#L397))
- Reading `MediaDevices.videoInputs` to match a node ([`CameraPopup.qml`](../CameraPopup.qml#L37))

None of those queries may be replaced by, or accompanied by, an active `Camera` while the activation flag is off.

### 3. Acquire gate

The viewfinder may acquire only when every term below is true. This is today's `cameraLoader.active` conjunction plus the activation flag.

| Term | Must be |
|---|---|
| Popup open | true |
| Activation flag | true |
| `devicePresent` | true |
| `permissionDenied` | false |
| `captureBusy` | false |
| `previewPaused` (`pendingCaptureCount > 0`) | false |
| `devicePath` | non-empty |
| `previewBoundPath` | equal to `devicePath` |
| A `MediaDevices` video input matches `devicePath` | true |

[`Model.js`](../Model.js) exports one pure function, `previewMayAcquire`, that takes those nine values and returns that boolean. The popup's loader follows that function's result so the QML gate and the unit test share one rule. New `Model.js` code stays in the file's current ES5 subset (`var`, `function`, no `const`, `let`, arrows, template literals, or spread) so Quickshell can still import it.

While the gate is false, `cameraLoader` is inactive. The loaded `Camera` does not exist, so it cannot stay `active: true`.

### 4. Preview states

`PREVIEW_STATES` becomes exactly:

```javascript
["idle", "active", "inactive", "busy", "permission", "disconnected", "unavailable"]
```

`getPreview()` and the popup's `previewState` return one of those seven tokens. First match wins:

1. `devicePresent` is false → `disconnected`.
2. `permissionDenied` is true → `permission`.
3. A device path is selected and no Qt video input matches it → `unavailable`.
4. Activation is off and `captureBusy` is true → `busy`.
5. Activation is off → `idle`.
6. Activation is on and (`captureBusy` or `previewPaused`) → `busy`. Activation stays on in the `previewPaused` case so the stream can resume after the format write.
7. Activation is on and the camera reports an error → classify the error as today ([`CameraPopup.qml`](../CameraPopup.qml#L89)): permission wording → `permission`, in-use / busy / resource wording → `busy`, anything else → `unavailable`. Then release the device and clear activation so the streaming fd does not stay open. The error card remains visible until the user presses Start preview or the popup closes.
8. Activation is on and `cameraActive` is true → `active`.
9. Activation is on and the camera has not yet reported active or an error → `inactive`.

`idle` copy, centered in the existing 16:9 frame ([`CameraPopup.qml`](../CameraPopup.qml#L606)):

- Title: `Preview off`
- Detail: `Click to start the live view`
- Button: `Start preview`

`inactive` copy, same frame:

- Title: `Starting preview`
- Detail: `Opening the camera`
- Button: `Stop preview`

`active` shows the video. A `Stop preview` button is drawn over the frame. The idle, error, and stop text are not part of the video item.

Existing copy stays for the other tokens: `Camera Disconnected` / `No capture device found` plus Retry; `Camera In Use` / `In use by another application`; `Permission Denied`; `Preview Unavailable` / the camera `errorString` or `Video stream unavailable`. Retry still calls `refreshRequested()` and does not start the preview. The capture-mode hint under the resolution row ([`CameraPopup.qml`](../CameraPopup.qml#L848)) is unchanged.

Sliders, toggles, segmented controls, the device selector, and Reset defaults stay usable in every preview state, including `idle` and the error states.

### 5. Start and stop affordances

- In `idle`, a click on the viewfinder frame and a click on `Start preview` do the same thing: set activation on. If the gate allows it, the camera acquires and the frame moves through `inactive` to `active`.
- In a retained `busy` or `unavailable` error card (Behaviour 4 step 7), `Start preview` is shown again and clears the remembered error before trying.
- `permission` and `disconnected` do not show `Start preview`. Disconnected keeps Retry.
- While `captureBusy` is true, `Start preview` is not shown. That flag still clears only on a later successful capture command or on `close()` ([`Widget.qml`](../Widget.qml#L46)), which is the current contract.
- In `active` and `inactive`, `Stop preview` clears activation and releases the device. A click on the video image does not stop the preview.
- `previewPaused` busy (a format write in flight) does not show Start or Stop. The stream resumes without another click when the pause ends and the gate becomes true.

### 6. Who may set the activation flag

| Action | Activation afterwards | Acquires if the gate allows |
|---|---|---|
| Widget load, `Component.onCompleted` → `refresh()` ([`Widget.qml`](../Widget.qml#L672)) | off | no |
| Bar left click that opens, IPC `open`, IPC `toggle` that opens | off | no |
| `setPreviewActive("1")` | on. If the popup is closed, this opens it (refresh included) and leaves the flag on after `open()`'s clear | yes |
| `Start preview` or clicking the idle frame | on | yes |
| `setPreviewActive("0")`, `Stop preview` | off | releases |
| IPC `close`, `toggle` that closes, `HyprlandFocusGrab.onCleared` ([`CameraPopup.qml`](../CameraPopup.qml#L150)), any other path that sets `popup.open` false | off | releases |
| Device switch ([`Widget.qml`](../Widget.qml#L298)) | off on the newly selected device | releases the previous device, does not acquire the new one |
| `applyDevices` ending with no device ([`Widget.qml`](../Widget.qml#L272)) | off | releases |
| `checkDeviceProc` finding the node missing or unreadable ([`Widget.qml`](../Widget.qml#L417)) | off | releases |
| Capture-mode change while a preview is running | unchanged (stays on) | releases for the write, then acquires again |
| Capture-mode change while idle | stays off | no |
| `setMirror`, Reset defaults, right-click on the bar icon | unchanged | no |

`open()` still clears `previewWasActiveDuringSession` before showing the popup ([`Widget.qml`](../Widget.qml#L49)). `setPreviewActive("1")` performs that open when needed, then sets activation on, so the clear inside `open()` does not cancel the IPC start.

Invalid `setPreviewActive` values do nothing. The accepted vocabulary is specified in Behaviour 9.

### 7. Release and the capture-mode restore

`previewWasActiveDuringSession` still becomes true only when `cameraActive` transitions to true. It is the record that a stream existed and may have replaced the driver format.

Reapply the configured driver capture mode, using the existing `reapplyCaptureMode()` command and the existing queue rule (wait until the camera is inactive, then wait for `fuser` on that device), when all of the following are true:

- `previewWasActiveDuringSession` is true
- the stream is being left because the user stopped it, the popup closed, or the selected device is about to change

The `-d` device on that command is the device that was previewed. On a device switch, issue it against the old path before `root.device` changes. After the reapply is queued, clear `previewWasActiveDuringSession` so a later close does not queue a second restore.

Do not call `reapplyCaptureMode()` when:

- the popup opens and closes, or the user presses Stop, before `cameraActive` has ever become true in that attempt
- a capture-mode write is the user's own format change (that write is the new mode; `previewPaused` covers the release)
- the flag is already false

Observable results:

- Open popup, do not start, close: no `v4l2-ctl --set-fmt-video` from the restore path, and no streaming fd held by the shell.
- Start, see video, stop while the popup stays open: streaming fd released, then one restore command for that device, so another application can open the camera before the popup closes.
- Start, see video, close: same release and one restore, matching today's close path.
- Start, see video, switch device: release the old device, one restore aimed at the old path, new device not streamed until a new explicit start.

### 8. Device switch and capture-mode interlock

Switching cameras while the popup is open always stops the preview. The selector and IPC `setDevice` keep their current effects (clear controls, formats, and FOV, then `startDeviceCheck`). They also clear activation. They do not restart `cameraLoader` on the new node. The idle card is shown once the new device is present, permitted, and matched by Qt. Mirror is left as it was and applies to the next preview on the new device.

Changing resolution or frame rate ([`CameraPopup.qml`](../CameraPopup.qml#L812)) still goes through `setCaptureMode` ([`Widget.qml`](../Widget.qml#L92)):

- The format command is still held while `popup.cameraActive` is true, then sent after the fd is free.
- If activation is on, it stays on across `previewPaused`. When `pendingCaptureCount` returns to 0 and `captureBusy` is false, the gate becomes true again and the same preview resumes without another click.
- If activation is off, the format command still runs, and the gate stays false when the command finishes.
- A non-zero capture exit still sets `captureBusy` ([`Widget.qml`](../Widget.qml#L573)). The gate's `!captureBusy` term keeps the device released. The urgent capture hint stays. Closing the popup still clears `captureBusy`.

### 9. Mirror

The mirror control is a `CameraToggle` ([`CameraPopup.qml`](../CameraPopup.qml#L329)): label `Mirror`, the same label-plus-`ToggleSwitch` row as Autofocus and the other boolean rows. It sits between the viewfinder frame and the scrolling settings list, outside the `Flickable`, so it stays on screen. It is visible whenever `devicePath !== ""`, including idle, active, permission denied, and cameras that expose no color controls. It is hidden when no device path is selected. The popup keeps `implicitWidth` 380 and `implicitHeight` 640 ([`CameraPopup.qml`](../CameraPopup.qml#L126)). The scrolling region's height calculation ([`CameraPopup.qml`](../CameraPopup.qml#L704)) shrinks by the toggle's height so the list still fits.

The toggle is enabled whenever it is visible. Its checked state is the mirror flag. Flipping it does not start, stop, or reopen the camera, does not change `captureMode`, and does not enqueue a `v4l2-ctl` or `cameractrls` command.

When the flag is off, the preview image is the same orientation the popup shows today. When the flag is on, the preview image is flipped horizontally (left and right exchanged). The flip is a transform of the rendered video item only. These stay unflipped: the idle and error cards, `Start preview`, `Stop preview`, the Mirror row, the header, the device selector, and every settings row. Frames other processes read from the capture node are unchanged.

Turning the flag on while `active` updates the current image without a stream restart. Turning it on while `idle` does not acquire; the next successful start shows the flipped image.

The feature does not read or write `hflip`, `vflip`, or `horizontal_flip` on any camera, including cameras that expose them. [`Model.js`](../Model.js) `CONTROLS` gains no `mirror`, `hflip`, `vflip`, or `horizontal_flip` entry. `buildV4l2SetCommand` and `buildResetCommands` gain no mirror argument. The hardware test's existing loop may still round-trip a flip control when the attached camera exposes one, because that loop walks every parsed control. That round-trip is generic control coverage. It is not the mirror feature, and the mirror toggle must not call it.

### 10. IPC

Add these methods on the existing `IpcHandler` with target `"abduldotdev.camera"` ([`Widget.qml`](../Widget.qml#L352)). Match the current style: typed parameters, string returns for queries, no return type for setters.

| Method | Signature | Result |
|---|---|---|
| `getPreview` | `getPreview(): string` | One of the seven `PREVIEW_STATES` tokens |
| `setPreviewActive` | `setPreviewActive(active: string)` | `"1"` starts (Behaviour 6). `"0"` stops and releases, and leaves the popup where it was. Any other string, including empty, `"true"`, `"on"`, `"false"`, and `"off"`, leaves both the flag and the popup unchanged |
| `getMirror` | `getMirror(): string` | `"1"` when the preview image is mirrored, `"0"` otherwise |
| `setMirror` | `setMirror(enabled: string)` | `"1"` and `"0"` set the flag. Any other string leaves it unchanged |

[`Model.js`](../Model.js) exports `parseFlag(value)`. It returns `true` for `"1"`, `false` for `"0"`, and `null` for every other value. Both setters use it. `getMirror()` returns the same two strings. Setting a flag to the value it already has does not restart the preview and does not reapply capture mode.

`getCtrl` / `setCtrl` stay limited to device controls. Passing `mirror` to `setCtrl` must not flip the preview and must not be sent to `v4l2-ctl`.

README examples, using the same `omarchy-shell` form as the current IPC section:

```bash
omarchy-shell abduldotdev.camera getPreview
# Output: idle

omarchy-shell abduldotdev.camera setPreviewActive 1
omarchy-shell abduldotdev.camera setPreviewActive 0

omarchy-shell abduldotdev.camera getMirror
# Output: 0

omarchy-shell abduldotdev.camera setMirror 1
omarchy-shell abduldotdev.camera setMirror 0
```

### 11. Camera-agnostic behaviour

Nothing in this spec keys off the MX Brio card name, USB id, or `/dev/video0`. Discovery, the multi-camera selector, dynamic control rows, and device-aware reset stay as they are. A camera with no flip control and a camera with `horizontal_flip` both get the same view transform when Mirror is on, and neither receives a mirror `v4l2-ctl` command from this feature. The generic UVC fixture already in [`tests/model.test.js`](../tests/model.test.js) keeps passing. [`tests/hardware.test.js`](../tests/hardware.test.js) keeps discovering the capture node through `buildV4l2DevicesCommand` and `selectActiveDevice` ([`tests/hardware.test.js`](../tests/hardware.test.js#L6)), and it still exits 0 with `SKIP: no capture device found` when none is connected ([`tests/hardware.test.js`](../tests/hardware.test.js#L14)).

### 12. Documentation

Update [`README.md`](../README.md) so a reader of the features list, the Logi Tune table, the IPC section, and the testing section sees the new contract:

- [`README.md`](../README.md#L12) and the live-viewfinder feature bullet: the viewfinder starts only after an explicit start, not when the popup opens. It releases on stop and on close.
- [`README.md`](../README.md#L13) and the table row at [`README.md`](../README.md#L125): seven states, naming `idle` (`Preview off`) alongside Active, Inactive, Busy, Permission Denied, Disconnected, and Unavailable. Restore of the driver capture mode happens after a preview that actually streamed, including stop-without-close, and is skipped when the preview never started.
- A features bullet for Mirror: horizontal flip of the in-popup preview, session-scoped, same on every camera, no driver control.
- A Logi Tune table row: Mirror, supported, preview view transform, not persisted, not a V4L2 control. Cite the MX Brio list from the Problem section as the reason the reference device cannot store it.
- The IPC examples from Behaviour 10.
- One sentence in Testing that `tests/model.test.js` covers `PREVIEW_STATES`, `previewMayAcquire`, and `parseFlag`.
- The stateless sentence at [`README.md`](../README.md#L66) stays true. Add that preview activation and mirror are in-memory session values and are not written to disk.

### 13. Tests

[`tests/model.test.js`](../tests/model.test.js) section 15 ([`tests/model.test.js`](../tests/model.test.js#L887)) asserts the seven-token list and `length === 7`.

`previewMayAcquire` tests: the all-true input returns true. Each case that breaks exactly one term from Behaviour 3 returns false, including an empty `devicePath`, a `previewBoundPath` that differs from `devicePath`, and `hasCameraInput` false.

`parseFlag` tests: `"1"` → true, `"0"` → false, and `""`, `"true"`, `"false"`, `"on"`, `"off"`, `"2"` → null.

Mirror model tests:

- `Model.CONTROLS` has no `mirror`, `hflip`, `vflip`, or `horizontal_flip` property.
- `buildV4l2SetCommand` and `buildResetCommands` outputs for the existing MX Brio catalog fixture and the existing generic UVC fixture contain none of those four names.
- `Object.keys(Model.CONTROLS).length` stays 18. The current assertion at [`tests/model.test.js`](../tests/model.test.js#L879) remains valid.

[`tests/hardware.test.js`](../tests/hardware.test.js):

- Keep the dynamic discovery, the per-control round trip, the capture-mode round trip, and the clean skip.
- Assert `Model.CONTROLS.mirror`, `hflip`, `vflip`, and `horizontal_flip` are absent.
- Assert the live parsed control map is allowed to omit `hflip`, `vflip`, and `horizontal_flip`. Absence is a pass on the MX Brio, not a skip.
- Do not add a mirror step that runs `v4l2-ctl --set-ctrl` for a flip control.
- Do not open a Qt `Camera`. This file cannot click the popup. The streaming lifecycle is covered by `previewMayAcquire` and by the inspections in Acceptance criteria.

## Affected surface

| file or module | change |
|---|---|
| [`Widget.qml`](../Widget.qml) | Hold the activation flag and the mirror flag. Clear activation on open, close, stop, device loss, and device switch. Teach `setPreviewActive("1")` to open without ending off. Reapply capture mode when a stream that actually started is left, aimed at the device that streamed. Add `getPreview`, `setPreviewActive`, `getMirror`, and `setMirror` to the existing `IpcHandler`. |
| [`CameraPopup.qml`](../CameraPopup.qml) | Gate `cameraLoader` on `previewMayAcquire`. Add the idle and starting cards, the frame click, and Start / Stop. Keep the error cards. Add the Mirror `CameraToggle` under the frame and give the scroller that height back. Flip only the video item. |
| [`Model.js`](../Model.js) | Extend `PREVIEW_STATES`. Export `previewMayAcquire` and `parseFlag`. Add no control and no command builder for mirror. |
| [`tests/model.test.js`](../tests/model.test.js) | Lock the seven states, the acquire gate, `parseFlag`, and the absence of a mirror device control. |
| [`tests/hardware.test.js`](../tests/hardware.test.js) | Assert mirror is not a required V4L2 control and that a missing flip control is a pass. Leave the discovery and restore behaviour in place. |
| [`README.md`](../README.md) | Describe lazy preview, seven states, the restore rule, the session-scoped mirror, and the four IPC methods. |

## Acceptance criteria

1. **Opening or loading the plugin does not acquire the camera.** After the shell has loaded the widget, and again after the popup is opened from the bar or from IPC `open` with no `setPreviewActive 1` and no Start click, `previewMayAcquire` is false for that state and `cameraLoader` is inactive. `fuser` on the selected capture node does not show the shell holding it for streaming. `node tests/model.test.js` covers the gate terms that make a merely-open popup return false.
2. **Explicit activation starts the camera and shows it.** `setPreviewActive 1`, the idle frame click, and `Start preview` each set activation on. When the other gate terms are true, the frame reaches `active` and shows the live image. `getPreview` returns `active`.
3. **Deactivating or closing releases the device.** `Stop preview`, `setPreviewActive 0`, IPC `close`, and dismissing the popup via the focus grab each leave `cameraLoader` inactive. After the release settles, `fuser` on that capture node does not show the shell. If `cameraActive` had become true, exactly one driver-format restore is queued at the previewed device and `previewWasActiveDuringSession` ends false. If the preview never became active, no restore command is queued.
4. **A mirror toggle exists and is wired end to end.** The popup shows a `Mirror` `CameraToggle` whenever a device path is selected. The toggle, `setMirror`, and `getMirror` agree: `"1"` flips the video image horizontally, `"0"` leaves it as the plugin shows it today. Overlay text and settings rows stay unflipped. No mirror action adds a `v4l2-ctl` or `cameractrls` argument. Inspect the IPC signatures against Behaviour 10.
5. **Mirror matches the plugin's settings policy.** The plugin still writes no file under the user's config for this flag (`property var settings` remains unused; [`README.md`](../README.md#L66) stays accurate). Mirror survives closing the popup and switching devices in the same shell process, and it is off in a freshly created widget. Preview activation does not survive those two events: each open and each device switch starts idle. Reset defaults changes neither flag's contract beyond leaving them alone, and it still restores device controls.
6. **Existing camera-agnostic support still works.** `node tests/model.test.js` passes, including the generic UVC fixture and `Object.keys(Model.CONTROLS).length === 18`. `node tests/hardware.test.js` either completes against the discovered capture device or prints `SKIP: no capture device found` and exits 0. The hardware run does not require `hflip`, `vflip`, or `horizontal_flip`. A device that has those controls is still discovered, and its other controls still round-trip; the mirror toggle does not set the flip control.
7. **Repo checks pass.** From the repo root: `node tests/model.test.js`, `node tests/hardware.test.js`, and `qmllint Widget.qml CameraPopup.qml`. All three exit 0. The hardware skip in criterion 6 counts as a pass when no capture device is connected.
8. **README and specs are updated.** [`README.md`](../README.md) describes lazy start, release on stop and close, the seven states, the conditional capture-mode restore, the session-scoped view-transform mirror, and the four IPC commands. This file, `specs/20260922-194138-3f26-main-lazy-preview-mirror.md`, is the spec update. Older files in `specs/` stay untouched.

## Open questions

1. **How long the mirror flag lives inside one shell process.** It cannot be stored on the MX Brio (no flip control) and must not become a new config file. Two shapes fit that: (a) remember the toggle until the shell exits, including across popup close and device switch; (b) reset it to off on every popup open, the same way activation resets. **Recommended default: (a).** Behaviour 1, 9, and acceptance criterion 5 use (a). Activation still resets on every open, because leaving it armed would acquire the camera the next time the popup appears.
