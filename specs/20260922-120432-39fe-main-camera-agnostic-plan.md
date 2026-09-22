# Plan: Camera-agnostic V4L2 discovery, dynamic controls, and multi-camera selector
Spec: specs/20260922-120432-39fe-main-camera-agnostic-spec.md

## Approach

Discovery is one shell command. `Model.buildV4l2DevicesCommand()` returns `["sh", "-c", <script>]`, the script prints one text record per `/dev/videoN`, and `parseV4l2Devices` keeps a node only when that record's Device Caps line contains `Video Capture`. On this machine that keeps `/dev/video0` (`MX Brio`) and drops the metadata node `/dev/video1`. Reset, auto-exposure, the selector labels, and the active-device choice are pure Model.js functions so `Widget.qml` and `CameraPopup.qml` never parse `v4l2-ctl` text themselves. `buildResetCommands(device)` with the controls argument omitted stays the current MX Brio catalog sequence, so the existing unit assertions keep passing; the popup passes the live parsed map and only those controls are reset. The selector is a `CameraSegmented` between the header separator and the viewfinder, shown only when more than one capture device is present, labelled by card name, with the device path appended when two cards share a name.

## Decisions

1. **One discovery command.** Do not add a per-node `--info` Process in QML. The script below captures `v4l2-ctl --list-devices` to completion, then runs `v4l2-ctl -d <node> --info` for each `/dev/videoN`. Concurrent `--info` while `--list-devices` is still running fails on this machine. `/dev/mediaN` is ignored. A node whose `--info` fails is skipped. `buildV4l2InfoCommand(device)` is still exported for tests and returns `["v4l2-ctl", "-d", device || "/dev/video0", "--info"]`. Step 2 does not call it.
2. **Auto-exposure resolver.** `resolveAutoExposure(menuItems)` returns `{ manual: number, auto: number }`. Manual is the first item whose label matches `/manual/i`, else the item whose numeric value is `1`, else `1`. Auto is the first label matching `/aperture priority/i`, else the first label matching `/auto/i` and not `/manual/i`, else the first item that is not that manual item, else `3` when `3 !== manual`, else `manual`. Empty or missing `menuItems` therefore yields `{ manual: 1, auto: 3 }`. MX Brio (`Manual Mode` / `Aperture Priority Mode`) yields `{ manual: 1, auto: 3 }`. A generic menu (`Auto Mode` value 0, `Manual Mode` value 1) yields `{ manual: 1, auto: 0 }`.
3. **Selector placement.** In `CameraPopup.qml`, directly under `headerSep` and directly above `previewFrame`. Hidden when `discoveredDevices.length <= 1`. Options come from `deviceSelectorOptions`. The segmented value is the device path.
4. **Omitted reset map.** `buildResetCommands(device)` and `buildResetCommands(device, null)` keep today's four-command catalog body unchanged, including key order. An empty object `{}` emits no commands. Step 2 always passes the live map (with `logitech_brio_fov` added only when FOV was reported).

## Steps

1. **Model parsers, device-aware reset, and tests** — file(s): `Model.js`, `tests/model.test.js`, `tests/hardware.test.js`
   - change: Stay in the existing `var` / `function` dialect in `Model.js`. Quickshell imports that file; do not add `const`, `let`, arrow functions, or template literals. Leave `CONTROLS`, `DEFAULT_DEVICE` (`"/dev/video0"`), `getDefaults`, `isControlActive`, and every current command builder's omitted-device fallback unchanged. Update the file header comment so it describes a camera-agnostic V4L2 model whose catalog remains the MX Brio reference.

     **Discovery script.** `buildV4l2DevicesCommand()` returns `["sh", "-c", SCRIPT]` where `SCRIPT` is exactly this program:

     ```sh
     list=$(v4l2-ctl --list-devices 2>/dev/null || true)
     printf "%s\n" "$list" | awk '
       /^[^[:space:]]/ {
         card = $0
         sub(/[[:space:]]*\(.*$/, "", card)
         bus = ""
         if (match($0, /\(([^)]*)\)/)) bus = substr($0, RSTART + 1, RLENGTH - 2)
         next
       }
       $1 ~ /^\/dev\/video[0-9]+$/ {
         print card "\t" bus "\t" $1
       }
     ' | while IFS="$(printf '\t')" read -r card bus path; do
       info=$(v4l2-ctl -d "$path" --info 2>/dev/null) || continue
       caps=$(printf '%s\n' "$info" | awk '
         /^[[:space:]]*Device Caps[[:space:]]*:/ {
           on = 1
           line = $0
           sub(/^[[:space:]]*Device Caps[[:space:]]*:[[:space:]]*/, "", line)
           printf "%s", line
           next
         }
         on && /^[[:space:]]/ {
           gsub(/^[[:space:]]+/, "")
           printf " %s", $0
           next
         }
         on { exit }
       ')
       printf 'card=%s\nbus=%s\npath=%s\ncaps=%s\n---\n' "$card" "$bus" "$path" "$caps"
     done
     ```

     The awk flag variable is `on`. The name `in` is a syntax error in awk. Do not search the Capabilities block: it lists `Video Capture` even for the metadata node. Only the `Device Caps` section is printed. Verified stdout for the MX Brio on this machine:

     ```text
     card=MX Brio
     bus=usb-0000:08:00.1-2
     path=/dev/video0
     caps=0x04200001 Video Capture Streaming Extended Pix Format
     ---
     card=MX Brio
     bus=usb-0000:08:00.1-2
     path=/dev/video1
     caps=0x04a00000 Metadata Capture Streaming Extended Pix Format
     ---
     ```

     **`parseV4l2Devices(rawText) -> device[]`.** Non-string or empty input returns `[]`. Split records on lines that are exactly `---`. Each record has `card=`, `bus=`, `path=`, `caps=` lines; take the value after the first `=`. Keep the record only when `path` matches `/^\/dev\/video[0-9]+$/` and `caps.indexOf("Video Capture") !== -1`. `Metadata Capture` does not contain that substring. Return objects in encounter order: `{ path, name: card, bus, card }`. `name` and `card` are the same string. Drop a record with no caps. Ignore a duplicate path.

     **`selectActiveDevice(devices, previousPath) -> device | null`.** `null` when `devices` is missing or empty. When `previousPath` equals some `device.path`, return that object. Otherwise return `devices[0]`. `""`, `null`, and a metadata path that is not in the list all fall through to the first capture device.

     **`deviceSelectorOptions(devices) -> { value: string, label: string }[]`.** `value` is `path`. `label` is `card` or `name`. When more than one device shares that card string, `label` is `card + " · " + path` (the same middle-dot separator the header already uses). Order matches `devices`. Empty input returns `[]`.

     **`resolveAutoExposure(menuItems) -> { manual: number, auto: number }`.** Implement decision 2. Accept an array of `{ value, label }`. Coerce `value` with `Number`. `menuItems` may be the parsed `menuItems` array or the catalog `options` array.

     **`powerLineOptions(menuItems) -> { value: string, label: string }[]`.** When `menuItems` is a non-empty array, map each entry to `{ value: String(item.value), label: String(item.label) }` and return it unchanged (MX Brio's driver label is `Disabled`, not `Off`). Otherwise return `[{ value: "0", label: "Off" }, { value: "1", label: "50 Hz" }, { value: "2", label: "60 Hz" }]`.

     **`buildResetCommands(device, controls)`.** `dev = device || DEFAULT_DEVICE`. When `controls` is `undefined` or `null`, execute the current function body and return the same four argv arrays the tests already expect (`white_balance_automatic=0,auto_exposure=1,focus_automatic_continuous=0`, then the three dependents at catalog defaults, then the remaining catalog controls, then `cameractrls ... logitech_brio_fov=65`). When `controls` is an object, emit a command only for names present in that object. Read each default as `defaultVal` if present, else `default`. Skip a control that has neither. Dependency pairs, in this order, and only when both sides are present: `white_balance_temperature` forces `white_balance_automatic=0`; `exposure_time_absolute` forces `auto_exposure=<resolveAutoExposure(menuItems or options).manual>`; `focus_absolute` forces `focus_automatic_continuous=0`. Command 1 is one `v4l2-ctl -d dev --set-ctrl` with those parent assignments joined by commas, omitted when none apply. Command 2 sets the present dependents to their defaults, omitted when none apply. Command 3 sets every remaining present control whose `backend !== "cameractrls"` and whose name is not `logitech_brio_fov`, including the parents restored to their own defaults, omitted when none apply. Command 4 is `cameractrls -d dev -c logitech_brio_fov=<default>` only when `logitech_brio_fov` is in the map; if that entry has no default, use `65`. Do not emit a control the map does not contain. Gamma and any other parsed name that is not in `CONTROLS` is still reset when it is in the map. Return only the commands that were actually built.

     **`buildV4l2InfoCommand(device) -> string[]`.** `["v4l2-ctl", "-d", device || DEFAULT_DEVICE, "--info"]`.

     Export every new function from `module.exports` as well as declaring it at top level.

     **API Step 2 is allowed to call.** Step 2 consumes only these names. Signatures are the QML/JS forms (no TypeScript).

     | name | signature and return |
     |---|---|
     | `DEFAULT_DEVICE` | string `"/dev/video0"`. Command-builder fallback only. Step 2 does not use it as the selected device. |
     | `CONTROLS` | existing catalog object. Slider fallback inside `getMeta` only. |
     | `buildV4l2DevicesCommand` | `() -> ["sh", "-c", string]` |
     | `parseV4l2Devices` | `(rawText: string) -> { path: string, name: string, bus: string, card: string }[]` |
     | `selectActiveDevice` | `(devices, previousPath: string) -> device or null` |
     | `deviceSelectorOptions` | `(devices) -> { value: string, label: string }[]` |
     | `resolveAutoExposure` | `(menuItems) -> { manual: number, auto: number }` |
     | `powerLineOptions` | `(menuItems) -> { value: string, label: string }[]` |
     | `buildResetCommands` | `(device: string, controls: object or null) -> string[][]` |
     | `buildV4l2ListCommand` | `(device) -> string[]` (unchanged) |
     | `buildV4l2ListFormatsCommand` | `(device) -> string[]` (unchanged) |
     | `buildV4l2SetCaptureModeCommand` | `(device, mode) -> string[]` (unchanged) |
     | `buildV4l2SetCommand` | `(device, name, value) -> string[]` (unchanged) |
     | `buildFovListCommand` | `(device) -> string[]` (unchanged) |
     | `buildFovSetCommand` | `(device, fov) -> string[]` (unchanged) |
     | `parseV4l2Ctrls` | `(rawText) -> { [name]: control }` (unchanged; control has `name`, `type`, `value`, `min`, `max`, `step`, `default`, `defaultVal`, `inactive`, `menuItems`) |
     | `parseV4l2Formats` | `(rawText) -> format[]` (unchanged) |
     | `parseV4l2CaptureMode` | `(rawText) -> { width, height, pixelformat, fps }` (unchanged) |
     | `parseCameractrls` | `(rawText) -> { logitech_brio_fov?: number }` (unchanged) |
     | `pickCaptureMode` | `(formats, current, width, height, fps) -> mode or null` (unchanged) |
     | `pickCameraFormat` | `(formats, captureMode) -> format or null` (unchanged) |
     | `resolutionOptions` | `(formats, current) -> option[]` (unchanged) |
     | `fpsOptions` | `(formats, width, height, pixelformat, current) -> option[]` (unchanged) |
     | `getDefaults` | `() -> { [name]: number }` catalog defaults (unchanged) |
     | `isControlActive` | `(name, currentValues) -> boolean` (unchanged) |

     Step 2 does not call `buildV4l2InfoCommand`, `buildV4l2GetCommand`, `PREFERRED_RESOLUTIONS`, `PREFERRED_FPS`, `RESOLUTION_TAGS`, `PREVIEW_STATES`, or `PIXEL_FORMAT`.

     **`tests/model.test.js`.** Keep every existing assertion, including the one-argument `buildResetCommands()` / `buildResetCommands("/dev/video1")` block. Add fixtures and assertions:

     - Discovery fixture equal to the verified MX Brio stdout above. `parseV4l2Devices` returns one device, `/dev/video0`, `name` and `card` `"MX Brio"`, `bus` `"usb-0000:08:00.1-2"`.
     - Multi-device fixture: that pair, plus an `Integrated Camera` capture node at `/dev/video2` (`bus` `usb-0000:00:14.0-5`, caps `0x04200001 Video Capture Streaming Extended Pix Format`) and its metadata node `/dev/video3` (caps `0x04a00000 Metadata Capture Streaming Extended Pix Format`). Result length 2: `/dev/video0` then `/dev/video2`. No `/dev/video1`, no `/dev/video3`.
     - `parseV4l2Devices("")`, `null`, and `undefined` return `[]`.
     - `selectActiveDevice` keeps `/dev/video2` when it is in the list, falls back to the first device for `""` and for `/dev/video1`, and returns `null` for an empty list.
     - `deviceSelectorOptions` on MX Brio plus Integrated Camera labels `MX Brio` and `Integrated Camera` with no path. A second fixture with two capture devices both named `Integrated Camera` at `/dev/video2` and `/dev/video4` labels `Integrated Camera · /dev/video2` and `Integrated Camera · /dev/video4`.
     - `resolveAutoExposure` on the Brio menu (`1 Manual Mode`, `3 Aperture Priority Mode`) returns `{ manual: 1, auto: 3 }`. On `0 Auto Mode`, `1 Manual Mode` returns `{ manual: 1, auto: 0 }`. On `1 Manual`, `8 Shutter Priority` returns `{ manual: 1, auto: 8 }`. On `[]` and `null` returns `{ manual: 1, auto: 3 }`.
     - `powerLineOptions` on the Brio menu items returns string values `"0"`, `"1"`, `"2"` with labels `Disabled`, `50 Hz`, `60 Hz`. Empty input returns the Off / 50 Hz / 60 Hz fallback.
     - `buildV4l2DevicesCommand()` has length 3, `[0] === "sh"`, `[1] === "-c"`, and the script contains `v4l2-ctl --list-devices`, `--info`, and `Device Caps`. `buildV4l2InfoCommand("/dev/video2")` equals `["v4l2-ctl", "-d", "/dev/video2", "--info"]`. `buildV4l2InfoCommand()` uses `/dev/video0`.
     - Generic UVC stdout fixture, parsed with the existing `parseV4l2Ctrls`. Include only these controls, with these ranges: `brightness` min `-64` max `64` step `1` default `0`; `contrast` min `0` max `64` step `1` default `32`; `saturation` min `0` max `128` step `1` default `64`; `white_balance_automatic` bool default `1`; `gamma` min `100` max `300` step `1` default `100`; `gain` min `0` max `15` step `1` default `0`; `power_line_frequency` menu default `1`, items `0 Disabled`, `1 50 Hz`, `2 60 Hz`; `sharpness` min `0` max `6` step `1` default `2`; `backlight_compensation` min `0` max `1` default `0`; `auto_exposure` menu default `0`, items `0 Auto Mode`, `1 Manual Mode`; `exposure_time_absolute` min `1` max `5000` step `1` default `166` with `flags=inactive`. Assert those parsed fields. Assert `pan_absolute`, `tilt_absolute`, `zoom_absolute`, `focus_absolute`, `focus_automatic_continuous`, `white_balance_temperature`, and `exposure_dynamic_framerate` are absent.
     - `buildResetCommands("/dev/video2", genericParsed)` returns three argv arrays and no `cameractrls` entry. Command 1 is `auto_exposure=1`. Command 2 is `exposure_time_absolute=166`. Command 3 contains `brightness=0`, `contrast=32`, `saturation=64`, `white_balance_automatic=1`, `gamma=100`, `gain=0`, `power_line_frequency=1`, `sharpness=2`, `backlight_compensation=0`, `auto_exposure=0`, and does not contain `exposure_time_absolute`, `pan_absolute`, `tilt_absolute`, `zoom_absolute`, `focus_absolute`, `white_balance_temperature`, or `logitech_brio_fov`.
     - `buildResetCommands("/dev/video0", {})` returns `[]`.
     - Passing the existing Brio `parseV4l2Ctrls` result plus `logitech_brio_fov: { name: "logitech_brio_fov", backend: "cameractrls", defaultVal: 65, default: 65 }` still mentions all 17 V4L2 controls and ends with the fov `cameractrls` command. Manual auto-exposure in command 1 is `1`.

     **`tests/hardware.test.js`.** Replace the `Model.DEFAULT_DEVICE` / `fs.existsSync` gate. Run `buildV4l2DevicesCommand()` via `execFileSync`, parse with `parseV4l2Devices`, and choose `selectActiveDevice(devices, null)`. When that returns `null`, print `SKIP: no capture device found` and `process.exit(0)`. Use `selected.path` as `device` everywhere the file currently uses the hardcoded path. Log the card and path in the banner instead of `Logitech MX Brio Hardware Control Verification (/dev/video0)`.

     Query the device once. For each `Model.CONTROLS` name, skip with a `SKIP: <name> not exposed` line when `parseV4l2Ctrls` has no such key, or when `logitech_brio_fov` is absent from `parseCameractrls`. Mutate only the names that are present. `pickDifferentValue` must use the parsed control's `min`, `max`, `step`, and `menuItems`. The existing Brio-sized jumps (white balance ±200, exposure ±100, focus ±20, zoom ±20, pan/tilt ±3600, gain ±10) may stay only when the candidate lies inside the parsed min/max; otherwise step by the parsed `step`. Delete the assertion that the combined list contains all 17 standard controls. Assert each control the device actually returned has a numeric `value`. The factory-reset block calls `buildResetCommands(device, map)` where `map` is the parsed V4L2 object plus a `logitech_brio_fov` entry only if FOV was reported. Assert each present control equals its parsed `defaultVal` (FOV default `65`) afterwards. If `brightness` is absent, skip the streaming round-trip instead of failing. The streaming log names `device`, not a hardcoded `/dev/video0`. Capture-mode enumeration stays, against the discovered device, and still skips with `SKIP: capture mode busy` when the driver reports busy.
   - verify: `node tests/model.test.js` exits 0. `node tests/hardware.test.js` exits 0. On this machine the hardware run discovers the MX Brio capture node and must not print `SKIP: no capture device found`.

2. **Discovery process, selector, and dynamic controls** — file(s): `Widget.qml`, `CameraPopup.qml`
   - change: Call only the Model API listed in step 1. Do not parse `--list-devices` or `--info` in QML, and do not spawn one Process per node.

     **`Widget.qml` state.** Change the initial `device` from `Model.DEFAULT_DEVICE` to `""`. Change the initial `modelName` from `"Logitech MX Brio"` to `"No camera connected"`. Add `property var discoveredDevices: []`. Add `function applyDevices(list)`, `function switchTo(deviceObj)`, `function getDevice()`, `function setDevice(path)`, and `function listDevices()`.

     `refresh()` starts `v4l2DevicesProc` when it is not running, and still starts `detectCameractrlsProc`. It does not start `checkDeviceProc` until a path has been selected. The 15s timer, `open()`, `Component.onCompleted`, and the popup retry signal keep calling `refresh()`, so discovery runs on startup, on the 15s timer, and on popup open.

     Add `Process { id: v4l2DevicesProc }` whose `command` is `Model.buildV4l2DevicesCommand()`. `stdout` is a `StdioCollector` with `waitForEnd: true` that stores the text on the Process. In `onExited`, parse that text with `Model.parseV4l2Devices` and call `applyDevices`. A non-zero exit with empty stdout calls `applyDevices([])`.

     `applyDevices(list)` stores `discoveredDevices`. `var selected = Model.selectActiveDevice(list, root.device)`. When `selected` is `null`: set `device` to `""`, `modelName` to `"No camera connected"`, `devicePresent` to false, `permissionDenied` to false, and clear `controls`, `fovControl`, `fovAvailable`, `pendingFov`, `captureMode`, `captureFormats`, `captureFormatsQueried`, `captureBusy`, `pendingCaptureCount`, and `commandQueue`. When `selected.path === root.device`, update `modelName` from `selected.card` or `selected.name` and call the existing `readControls` path. When the path differs, call `switchTo(selected)`.

     `switchTo(deviceObj)` increments `listGeneration`, clears `commandQueue`, sets `device` and `modelName`, clears the same control and capture fields as the empty case, sets `devicePresent` true only after `checkDeviceProc` says the node exists, then sets `checkDeviceProc.running = true` after `device` is assigned so the bound command sees the new path. Existing `checkDeviceProc` behaviour (present vs permission exit 3, then formats and `readControls`) stays.

     Guard `v4l2ListProc.onExited`: a non-zero exit sets `devicePresent` false only when `queryGeneration === root.listGeneration`. Give that Process a `queryDevice` property, set it to `root.device` when the read starts, and ignore an exit whose `queryDevice` is not the current `root.device`. Do the same generation check before `cameractrlsListProc.onExited` clears `fovAvailable`. Stale processes from the previous camera must not mark the new camera disconnected.

     `setDevice(path)` finds `path` in `discoveredDevices`. A path that is not in that list is a no-op, which refuses metadata nodes and unknown paths. The current path is a no-op. Any other match calls `switchTo`. `getDevice()` returns `root.device` (possibly `""`). `listDevices()` returns `JSON.stringify` of `[{ path, name }]` in discovery order, `name` from `name` or `card`. Example: `[{"path":"/dev/video0","name":"MX Brio"}]`.

     `resetDefaults()` copies `root.controls`. When `fovAvailable` is true, set `logitech_brio_fov` on that copy to `{ name: "logitech_brio_fov", backend: "cameractrls", defaultVal: Model.CONTROLS.logitech_brio_fov.defaultVal, default: Model.CONTROLS.logitech_brio_fov.defaultVal }`. Call `Model.buildResetCommands(root.device, copy)`. Queue those argv arrays. Skip a `cameractrls` argv when `fovAvailable` is false. Optimistic values come from each map entry's `defaultVal` or `default`, not from `getDefaults()`, so a generic camera is not painted with Brio defaults. Do not insert catalog keys the map does not contain.

     Extend the `IpcHandler` after `setCaptureMode` with `getDevice(): string`, `setDevice(path: string)`, and `listDevices(): string`, forwarding to those functions. Leave the existing eight handlers in place.

     Pass `discoveredDevices: root.discoveredDevices` into `CameraPopup`. Handle `onDeviceChangeRequested` with `root.setDevice(path)`.

     **`CameraPopup.qml`.** Default `modelName` to `"No camera connected"` and `devicePath` to `""`. Add `property var discoveredDevices: []` and `signal deviceChangeRequested(string path)`.

     Insert this control as the next child of `mainCol` after `headerSep` and before `previewFrame`:

     ```qml
     CameraSegmented {
       id: cameraSelector
       visible: root.discoveredDevices && root.discoveredDevices.length > 1
       label: "Camera"
       options: (typeof Model !== "undefined" && typeof Model.deviceSelectorOptions === "function")
         ? Model.deviceSelectorOptions(root.discoveredDevices)
         : []
       value: root.devicePath
       onChanged: function(v) {
         if (v && v !== root.devicePath) root.deviceChangeRequested(v)
       }
     }
     ```

     `CameraSegmented` already sets `width: parent.width`. One camera, or zero, leaves the selector `visible: false`, so the Column does not reserve a gap. Update `flick.height` so a visible selector is subtracted along with one extra `mainCol.spacing`. Use `cameraSelector.implicitHeight` when `cameraSelector.visible` is true. Leave `implicitHeight: 640` and `implicitWidth: 380` as they are.

     Header title stays `root.modelName`. The path line is `root.devicePath + (root.devicePresent ? " · Connected" : " · Disconnected")` when `devicePath !== ""`. When `devicePath` is empty, the line is `Disconnected`. The disconnected viewfinder detail (today `No camera at ` + path, around the `previewState === "disconnected"` branch) becomes `No capture device found`. The bar icon already uses opacity `0.4` when `devicePresent` is false; do not change that binding.

     **Preview restart.** Add `property string previewBoundPath: ""` on the popup. Include `previewBoundPath === root.devicePath && root.devicePath !== ""` in `cameraLoader.active`. On `devicePath` change, set `previewBoundPath = ""` and assign `root.devicePath` inside `Qt.callLater`, so the Loader deactivates and releases the previous camera before `pickCameraDevice()` binds the new `MediaDevices` entry. `pickCameraDevice()` already matches `inputs[i].id` to `root.devicePath`.

     **Per-control visibility.** Add `function hasCtrl(name)` that is true when `root.controls[name]` is not `undefined`. Set `visible: root.hasCtrl("<name>")` on each of these widgets: `zoom_absolute`, `pan_absolute`, `tilt_absolute`, `focus_automatic_continuous`, `focus_absolute`, `auto_exposure`, `exposure_time_absolute`, `exposure_dynamic_framerate`, `gain`, `white_balance_automatic`, `white_balance_temperature`, `brightness`, `contrast`, `saturation`, `sharpness`, `power_line_frequency`, `backlight_compensation`. `logitech_brio_fov` stays `visible: root.fovAvailable`. The Capture column stays visible only when `captureFormats.length > 0`.

     Wrap each of Framing & Optics, Focus, Exposure, Color & Image, and Utilities (the header, its controls, and that section's trailing `PanelSeparator`) so the whole group is visible only when at least one of its children is visible. Framing also counts `fovAvailable`. Capture is already its own column and is not part of Framing. A hidden group must not leave an empty header or a leftover separator. Do not add a widget for `gamma` or any other name that has no row today; those names still travel in `root.controls` and are reset by step 1.

     **Slider limits.** Every slider and both pan/tilt controls bind `minimum`, `maximum`, and `step` through `root.getMeta(name, field, fallback)`. Pan and tilt already do. Replace the literal bounds on Digital Zoom (`100/400/1`), Manual Focus (`0/255/1`), Exposure Time (`3/2047/1`), Sensor Gain (`0/255/1`), Color Temperature (`2800/7500` and the literal `step: 50`), Brightness, Contrast, Saturation, and Sharpness (each `0/255/1`). Color temperature step goes through `getMeta("white_balance_temperature", "step", 1)`. `getMeta` already prefers the parsed field, then `Model.CONTROLS`, then the fallback, so a reported range wins over the Brio catalog. `value` stays `getVal(name, fallback)`. Keep the existing `controlEnabled` / `isInactive` behaviour for manual focus and color temperature.

     **Auto exposure.** Read `var ae = Model.resolveAutoExposure(root.controls.auto_exposure && root.controls.auto_exposure.menuItems)`. The toggle is checked when `getVal("auto_exposure", ae.auto) === ae.auto`. Toggling writes `ae.manual` when the current value is `ae.auto`, otherwise `ae.auto`. Exposure Time `controlEnabled` is true when the current auto-exposure value equals `ae.manual` and `isInactive("exposure_time_absolute")` is false.

     **Power line.** `options: Model.powerLineOptions(root.controls.power_line_frequency && root.controls.power_line_frequency.menuItems)`. Keep `value: String(root.getVal("power_line_frequency", 2))` and the existing `parseInt` write.
   - verify: `qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml` exits 0 with no warnings. `node tests/model.test.js` still exits 0.

3. **README and manifest** — file(s): `README.md`, `manifest.json`
   - change: Leave `schemaVersion` at `1`, `version` at `"1.1.0"`, `id`, `name`, `author`, `license`, `kinds`, `entryPoints`, and the rest of `barWidget` as they are. Do not add keys. Set both `description` and `barWidget.description` to this exact string (171 characters, under the 500-character schema limit):

     `V4L2/UVC webcam controls for any camera. Discovers capture devices, shows only controls the camera exposes, and switches cameras. Logitech MX Brio is the reference device.`

     In `README.md`, change the opening paragraph so the plugin is a V4L2/UVC webcam controller for the capture devices the kernel exposes. Name the Logitech MX Brio 4K (`046d:0944`) as the reference device. Delete the sentence that says only the MX Brio is tested and supported.

     Update Features: the bar icon dims when no capture device is discovered; the viewfinder opens the selected capture node and releases it on close; the disconnected card says `No capture device found`; a Camera selector sits under the header separator and above the viewfinder only when more than one capture device is discovered, labelled by card name, with the path appended when two cards share a name; each settings row is shown only when the active camera exposes that control; slider min, max, and step come from the device; a section whose controls are all absent is omitted; Reset defaults restores the controls that camera reports, each to its reported default.

     In Capture Mode, Prerequisites, and the viewfinder sentences, replace a hardcoded `/dev/video0` assumption with the selected capture device. Keep the `v4l-utils` and optional `cameractrls` requirements. `cameractrls` remains the FOV path for cameras that expose `logitech_brio_fov`.

     Above the controls table, state that the table is the MX Brio reference inventory and that a connected camera shows only the rows it exposes, using that camera's min, max, step, default, and menu items. Leave the table's Brio ranges in place.

     Add one sentence above the Logi Tune table: FOV is the MX Brio vendor control, and the other rows apply when the active camera exposes the matching V4L2 control. Leave the table itself.

     Add these IPC examples under the existing contract, without removing the current eight commands:

     ```bash
     qs ipc call abduldotdev.camera getDevice
     qs ipc call abduldotdev.camera setDevice /dev/video2
     qs ipc call abduldotdev.camera listDevices
     ```

     Document `getDevice` as the active capture path, `setDevice` as a switch to a discovered capture path, and `listDevices` as a JSON array of `{path, name}` objects.

     In Testing, state that `node tests/hardware.test.js` discovers the capture device, skips with exit 0 and `SKIP: no capture device found` when none is connected, and exercises only the controls that device exposes. State that `node tests/model.test.js` also covers discovery parsing, the auto-exposure resolver, and a generic UVC fixture.
   - verify: `omarchy plugin validate "$PWD"` exits 0 and prints `Validation passed`.

## Parallelisation

| step | owns files | may run concurrently with |
|---|---|---|
| 1 | `Model.js`, `tests/model.test.js`, `tests/hardware.test.js` | none (sequential, one shared checkout; step 2 calls the API this step freezes) |
| 2 | `Widget.qml`, `CameraPopup.qml` | none (starts only after step 1) |
| 3 | `README.md`, `manifest.json` | none (starts only after step 2) |

## Checks

| command | when |
|---|---|
| `node tests/model.test.js` | After step 1, and again after step 2 |
| `node tests/hardware.test.js` | After step 1. Exit 0. On this machine an MX Brio capture node is present, so the run must exercise that device rather than skip |
| `qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml` | After step 2 |
| `omarchy plugin validate "$PWD"` | After step 3 |

## Risks

- Matching `Video Capture` against the whole `--info` text keeps the metadata node, because the Capabilities block lists it for `/dev/video1` too. The script prints only the Device Caps line. The model test's metadata record must be excluded. Cheapest check: `node tests/model.test.js` on the verified MX Brio fixture.
- Running `--info` in the same pipeline as a still-open `--list-devices` returns a failed info query here. The script assigns `list=$(v4l2-ctl --list-devices ...)` before the per-node loop. Cheapest check: `node tests/hardware.test.js` discovers `/dev/video0` and does not skip.
- `v4l2ListProc.onExited` currently clears `devicePresent` on any non-zero exit. A stale read from the previous camera will mark the new one disconnected. The generation and `queryDevice` guards in step 2 are the fix. Cheapest check: `qmllint`, then a manual device switch once two cameras are attached. With one camera, the guard is still required for the 15s rediscovery.
- Setting the Loader's bound path in the same turn it is cleared does not drop the previous file descriptor. `Qt.callLater` is required. A switch that leaves the preview on the old node is the symptom.
- `flick.height` is a hand-written remainder. Forgetting the selector makes the controls clip when two cameras are connected. The formula change in step 2 is the fix; `qmllint` will not catch the arithmetic.
- Rewriting the one-argument `buildResetCommands` body changes command order and breaks the current assertions. That branch stays verbatim. Cheapest check: the existing reset block in `node tests/model.test.js`.
- `pickDifferentValue` using catalog maxima (sharpness 255, brightness 255) fails on a camera whose parsed maximum is lower. The hardware test must use parsed min/max/step. Cheapest check: the generic fixture's reset assertions, plus the hardware run against the live Brio.
- `Model.js` syntax that Quickshell cannot parse (`const`, arrows, template strings) passes Node and fails when the shell imports the widget. The dialect constraint in step 1 is the fix. `qmllint` is the check.
- A manifest key outside schema version 1, or a description over 500 characters, fails `omarchy plugin validate`. Step 3 changes only the two description strings and leaves `version` at `1.1.0`.
