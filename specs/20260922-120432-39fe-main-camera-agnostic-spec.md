# Spec: Camera-Agnostic V4L2/UVC Device Support, Runtime Discovery, and Multi-Camera Selector

## Problem

The `abduldotdev.camera` Omarchy plugin is currently coupled to a single specific webcam model—the Logitech MX Brio 4K—at a single hardcoded device path (`/dev/video0`). Specifically:

1. **Hardcoded Device Path & Fixed Model Metadata**:
   - In [`Model.js`](../Model.js#L12), line 12 hardcodes `var DEFAULT_DEVICE = "/dev/video0"`.
   - In [`Widget.qml`](../Widget.qml#L22), line 22 binds `property string device: (typeof Model !== "undefined" && Model.DEFAULT_DEVICE) ? Model.DEFAULT_DEVICE : "/dev/video0"`, line 38 hardcodes `property string modelName: "Logitech MX Brio"`, and `checkDeviceProc` (lines 267–295) tests only that single file path via `test -e "$1"`.
   - In [`CameraPopup.qml`](../CameraPopup.qml#L27-L28), lines 27–28 hardcode `modelName: "Logitech MX Brio"` and `devicePath: "/dev/video0"`. The header (lines 531–539) unconditionally renders this static string. If the user's camera is registered at `/dev/video2` or `/dev/video4`, the plugin reports the device as disconnected.
   - The plugin does not discover devices dynamically at runtime. On Linux systems, UVC webcams register multiple character device nodes (e.g. `/dev/video0` for Video Capture alongside `/dev/video1` for Metadata Capture). Without querying capabilities, naive path iteration or static paths can target metadata nodes where video capture and controls fail.

2. **Rigid Hardcoded Control Catalog & Inflexible Reset Commands**:
   - In [`Model.js`](../Model.js#L33-L199), `var CONTROLS = { ... }` hardcodes fixed ranges, step values, and defaults for 18 controls tailored exclusively to the MX Brio (e.g. `white_balance_temperature` min 2800 max 7500 default 5000; `exposure_time_absolute` min 3 max 2047 default 156; `pan_absolute`/`tilt_absolute` min -72000 max 72000 step 3600; `zoom_absolute` min 100 max 400).
   - In [`Model.js`](../Model.js#L746-L790), `buildResetCommands(device)` unconditionally emits `v4l2-ctl --set-ctrl` commands for ALL catalog controls regardless of device support:
     - Line 752 forces `white_balance_automatic=0,auto_exposure=1,focus_automatic_continuous=0`.
     - Lines 757–759 force `white_balance_temperature=5000,exposure_time_absolute=156,focus_absolute=0`.
     - Lines 771–782 force catalog defaults for all remaining controls.
     - Lines 785–787 unconditionally issue `cameractrls -d dev -c logitech_brio_fov=65`.
     When executed against any camera lacking these specific controls (or with different default values or auto-exposure menu options), these commands return nonzero exit codes and fail to restore settings.

3. **Static UI Controls with "Phantom" Widgets & Hardcoded Slider Bounds**:
   - In [`CameraPopup.qml`](../CameraPopup.qml#L690-L984), `sectionsCol` renders every single control unconditionally. Only `logitech_brio_fov` is gated on `root.fovAvailable` (line 702), and only Pan & Tilt use `getMeta()` for limits (lines 727–729, 736–738).
   - Sliders for Digital Zoom (lines 717–719), Manual Focus (lines 830–832), Exposure Time (lines 859–861), Sensor Gain (lines 875–877), Color Temperature (lines 905–907), Brightness (lines 915–917), Contrast (lines 925–927), Saturation (lines 935–937), and Sharpness (lines 945–947) use hardcoded literal `minimum`, `maximum`, and `step` properties.
   - On generic UVC cameras lacking hardware pan/tilt, optical/digital zoom, autofocus, or manual focus, the popup presents unresponsive "phantom" sliders. Interacting with them dispatches `v4l2-ctl` commands that fail with errors. Furthermore, on cameras with different control ranges (e.g. brightness `0..100` or `-64..64`, sharpness `0..6`), sliders clip or fail to set valid values.
   - The auto-exposure toggle (lines 850–851) assumes hardcoded values `1` (Manual) and `3` (Aperture Priority), failing on cameras whose drivers use `0` (Auto) and `1` (Manual), or other menu IDs. The power-line frequency segmented control (lines 965–969) hardcodes options `Off`, `50 Hz`, `60 Hz` without validating device-supported menu items.

4. **Missing Multi-Camera Selection & Switching**:
   - When a workstation has multiple video capture devices connected (e.g. a built-in laptop camera and an external USB webcam, or dual streaming cameras), the user has no way to select which device to view or configure. The plugin remains locked to `/dev/video0`.

5. **Outdated Manifest & Documentation**:
   - [`manifest.json`](../manifest.json#L8) and [`README.md`](../README.md#L3) state that the plugin is made specifically for the Logitech MX Brio 4K (`046d:0944`), warning that only the MX Brio is tested and supported.

6. **Test Suite Blind Spots**:
   - [`tests/model.test.js`](../tests/model.test.js#L8-L36) only contains fixtures for the Logitech MX Brio. It lacks test coverage for generic UVC webcams with different control sets, limits, and menu values, as well as device discovery parsing.
   - [`tests/hardware.test.js`](../tests/hardware.test.js#L6) hardcodes `/dev/video0` and unconditionally iterates the MX Brio catalog, failing on machines where a non-Brio camera is connected or when the camera is on a different node.

---

## Scope

### In scope

1. **Runtime Device Discovery**:
   - Enumerate video devices dynamically via `v4l2-ctl --list-devices` and per-node capability queries (`v4l2-ctl -d <dev> --info`).
   - Filter device nodes to identify genuine video capture devices by verifying that `Device Caps` includes `Video Capture` (explicitly filtering out metadata capture nodes such as `/dev/video1`, radio, and non-capture devices).
   - Extract device path (e.g. `/dev/video0`) and card name (e.g. `"MX Brio"`, `"HD Pro Webcam C920"`, `"Integrated Camera"`).
   - Dynamically establish the active camera device without hardcoded `/dev/videoN` or static model strings.
   - Provide graceful fallback when zero capture devices are discovered (disconnected state).
2. **Multi-Camera Selection in Popup UI**:
   - When more than one video capture device is discovered, present a clean device selector in [`CameraPopup.qml`](../CameraPopup.qml) allowing the user to select the active camera.
   - When exactly one capture device is discovered, hide or keep the selector inert, displaying the active card name and path in the header.
   - When switching devices: update active device path and model name, re-read controls (`v4l2ListProc`), re-read capture formats and mode (`v4l2FormatsProc`), check FOV support (`cameractrlsListProc`), and seamlessly restart the live viewfinder preview against the newly selected device.
3. **Dynamic Control Rendering & Dynamic Slider Limits**:
   - In [`CameraPopup.qml`](../CameraPopup.qml), render ONLY controls that the selected device actually exposes in `root.controls` (no phantom controls, no failed CLI commands).
   - Dynamically bind every slider's `minimum`, `maximum`, `step`, and default values to the parsed control object (`ctrl.min`, `ctrl.max`, `ctrl.step`, `ctrl.defaultVal` / `ctrl.default`).
   - Dynamically configure auto-exposure toggle and menu options from the device's parsed `menuItems` (preferring Aperture Priority or non-manual options for auto, and Manual mode for manual).
   - Dynamically populate discrete menu options for `power_line_frequency` based on the device's parsed `menuItems`.
   - Gate section headers (Framing & Optics, Focus, Exposure, Color & Image, Utilities) and separators so that an empty section is omitted when none of its child controls are supported by the active camera.
4. **Dynamic Factory Reset**:
   - In [`Model.js`](../Model.js), extend `buildResetCommands(device, controls)` so that it only emits reset commands for controls that are actually present on the active device.
   - Use each control's parsed `default` / `defaultVal` rather than static catalog constants.
   - Auto-exposure reset dynamically selects the device's default auto value from its menu options.
   - Issue `cameractrls` FOV reset command if and only if `logitech_brio_fov` is reported on the device.
5. **IPC Contract Preservation & Extension**:
   - Preserve all existing IPC commands (`open`, `close`, `toggle`, `resetDefaults`, `getCtrl`, `setCtrl`, `getCaptureMode`, `setCaptureMode`).
   - Add new IPC commands: `getDevice`, `setDevice`, and `listDevices` to enable programmatic inspection and camera switching.
6. **Documentation & Manifest Modernization**:
   - Update [`manifest.json`](../manifest.json) to describe the plugin as a camera-agnostic V4L2/UVC webcam controller, citing the Logitech MX Brio as the reference hardware.
   - Update [`README.md`](../README.md) to detail universal V4L2/UVC webcam support, dynamic control enumeration, multi-camera switching, and extended IPC commands.
7. **Comprehensive Test Suite Extension**:
   - Extend [`tests/model.test.js`](../tests/model.test.js) with:
     - Fixture output and tests for multi-device discovery parsing (`v4l2-ctl --list-devices` + `--info`).
     - Real/synthetic fixture output for a generic UVC webcam (exposing only basic controls with different ranges and no pan/tilt, zoom, or FOV).
     - Unit tests verifying dynamic reset command construction for both the MX Brio and generic webcam fixtures.
     - Tests for new device helper functions.
   - Update [`tests/hardware.test.js`](../tests/hardware.test.js) to:
     - Use dynamic discovery to identify the capture device rather than hardcoding `/dev/video0`.
     - Skip cleanly if no capture device is connected.
     - Dynamically test only controls supported by the discovered hardware.

### Out of scope

- Proprietary non-UVC vendor protocols (e.g. Elgato proprietary USB commands, Razer Synapse protocols). Standard V4L2 kernel controls and cameractrls XU controls remain the supported backends.
- Non-Linux platforms or non-V4L2 capture subsystems (e.g. Windows Media Foundation, macOS AVFoundation, PipeWire native wire protocols outside V4L2 emulation).
- Audio input device selection or volume control (audio is managed by Omarchy's audio/mic widgets).
- Modifying system files outside the plugin repository directory.
- Altering the Omarchy plugin manifest schema version (stays at schema version 1 without custom unsupported keys).

---

## Behaviour

### 1. Device Discovery Contract
- **1.1 Discovery Execution**:
  - The plugin executes `v4l2-ctl --list-devices` via an asynchronous process on startup, on periodic refresh (15s timer), on popup open, or on user request.
  - For each device node listed under a card entry, capability information is checked via `v4l2-ctl -d <node> --info` (or an equivalent single-pass inspection script).
- **1.2 Node Classification & Metadata Filtering**:
  - The discovery parser evaluates the `Device Caps` field of each device node:
    - If `Device Caps` contains `Video Capture` (e.g. `0x04200001` or `Video Capture`), the node is classified as a valid video capture device.
    - If `Device Caps` contains only `Metadata Capture` (e.g. `/dev/video1` on Logitech MX Brio) or lacks `Video Capture`, the node is strictly excluded.
  - Nodes that do not exist or cannot be accessed are discarded.
- **1.3 Discovery Output Structure**:
  - The discovery process produces an ordered array of device objects:
    ```javascript
    [
      {
        path: "/dev/video0",
        name: "MX Brio",
        bus: "usb-0000:08:00.1-2",
        card: "MX Brio"
      },
      ...
    ]
    ```
- **1.4 Active Device Resolution**:
  - If one or more capture devices are discovered:
    - If a previously selected device path remains in the discovered list, it is preserved as the active device.
    - Otherwise, the first discovered capture device becomes the active device.
    - `root.devicePresent` is set to `true`.
    - `root.modelName` is updated to the active device's `name` or `card`.
    - `root.device` is updated to the active device's `path`.
  - If zero capture devices are discovered:
    - `root.devicePresent` is set to `false`.
    - `root.device` remains empty or fallback.
    - `root.modelName` is set to `"No camera connected"`.
    - Viewfinder displays `"Camera Disconnected"` with detail `"No capture device found"`.
    - The bar widget icon opacity is set to `0.4`.

### 2. Single vs. Multi-Device Header & Selector Contract
- **2.1 Header Presentation**:
  - The header displays the active camera's card name (`root.modelName`) in bold text and its device node path (`root.devicePath`) with connection status.
- **2.2 Single-Device Mode**:
  - When `discoveredDevices.length <= 1`, the device selector is hidden or rendered inert. The header presents a clean single-device display matching existing visual design.
- **2.3 Multi-Device Mode (>1 Camera)**:
  - When `discoveredDevices.length > 1`, a device selector control is visible in the popup (positioned in the header area or directly below the header separator above the viewfinder).
  - The selector lists each discovered camera displaying its card name (e.g. `"MX Brio"`, `"Integrated Camera"`).
  - The currently active camera is visibly highlighted as selected.
  - Clicking or activating another device option triggers an immediate device switch.

### 3. Device Selection & State Transition Contract
- **3.1 Transition Lifecycle**:
  - When the active device changes (via UI selector or IPC `setDevice`):
    1. `root.device` and `root.devicePath` update to the new path.
    2. `root.modelName` updates to the new device card name.
    3. `root.controls` and `root.captureMode` are reset/cleared for the new device.
    4. `root.captureFormats` are cleared and re-queried via `v4l2FormatsProc` against the new device.
    5. `v4l2ListProc` executes `--get-fmt-video --get-parm --list-ctrls-menus` against the new device.
    6. `cameractrlsListProc` executes `cameractrls -d <new_device> -l` to check vendor FOV support.
    7. `cameraLoader` unloads the previous capture session and re-initializes against the new `MediaDevices.videoInputs` item matching the new device path.
- **3.2 Seamless Viewfinder Continuity**:
  - If the popup is open and live preview is active during switching, the viewfinder unbinds from the previous device file descriptor and starts streaming from the new device node without throwing unhandled exceptions or deadlocking.

### 4. Dynamic Control Visibility & Grouping Contract
- **4.1 Per-Control Visibility**:
  - Every individual control item in `CameraPopup.qml` binds its visibility directly to the presence of that control in the active device's parsed control set (`root.controls`):
    - `logitech_brio_fov`: visible only if `root.fovAvailable === true`.
    - `zoom_absolute`: visible only if `"zoom_absolute" in root.controls`.
    - `pan_absolute`: visible only if `"pan_absolute" in root.controls`.
    - `tilt_absolute`: visible only if `"tilt_absolute" in root.controls`.
    - `focus_automatic_continuous`: visible only if `"focus_automatic_continuous" in root.controls`.
    - `focus_absolute`: visible only if `"focus_absolute" in root.controls`.
    - `auto_exposure`: visible only if `"auto_exposure" in root.controls`.
    - `exposure_time_absolute`: visible only if `"exposure_time_absolute" in root.controls`.
    - `exposure_dynamic_framerate`: visible only if `"exposure_dynamic_framerate" in root.controls`.
    - `gain`: visible only if `"gain" in root.controls`.
    - `white_balance_automatic`: visible only if `"white_balance_automatic" in root.controls`.
    - `white_balance_temperature`: visible only if `"white_balance_temperature" in root.controls`.
    - `brightness`: visible only if `"brightness" in root.controls`.
    - `contrast`: visible only if `"contrast" in root.controls`.
    - `saturation`: visible only if `"saturation" in root.controls`.
    - `sharpness`: visible only if `"sharpness" in root.controls`.
    - `power_line_frequency`: visible only if `"power_line_frequency" in root.controls`.
    - `backlight_compensation`: visible only if `"backlight_compensation" in root.controls`.
    - Capture formats (Resolution and Frame Rate): visible only if `root.captureFormats && root.captureFormats.length > 0`.
- **4.2 Section & Separator Gating**:
  - A section header (e.g. `FRAMING & OPTICS`, `FOCUS`, `EXPOSURE`, `COLOR & IMAGE`, `UTILITIES`) and its accompanying separator are visible IF AND ONLY IF at least one child control belonging to that category is currently visible.
  - If a connected webcam does not support any controls in a category (for example, a webcam without optics controls: no zoom, no pan/tilt, no FOV), the entire `FRAMING & OPTICS` section header and spacer are hidden, avoiding empty headers or awkward gaps.

### 5. Dynamic Control Limits, Stepping & Values Contract
- **5.1 Slider Metadata Binding**:
  - For each rendered slider in `CameraPopup.qml`:
    - `minimum`: dynamically bound to `getMeta(name, "min", fallbackMin)`.
    - `maximum`: dynamically bound to `getMeta(name, "max", fallbackMax)`.
    - `step`: dynamically bound to `getMeta(name, "step", fallbackStep)`.
    - `value`: dynamically bound to `getVal(name, fallbackDefault)`.
  - Under no circumstances shall literal numbers override a camera's reported `min`, `max`, or `step`.
- **5.2 Inactive Dependency State**:
  - The `controlEnabled` property of dependent sliders continues to respect parent auto modes:
    - Manual focus disabled when continuous autofocus is on, or when driver reports control inactive flag (`flags=inactive`).
    - Exposure time disabled when auto-exposure is active, or when driver reports inactive.
    - Color temperature disabled when auto white balance is on, or when driver reports inactive.

### 6. Auto-Exposure & Menu Controls Contract
- **6.1 Auto-Exposure Dynamic Resolution**:
  - The `auto_exposure` menu control is parsed from driver output.
  - The plugin dynamically inspects `menuItems` of `root.controls.auto_exposure`:
    - Manual value: menu item whose label matches `/manual/i` or value `1`.
    - Auto value: menu item whose label matches `/aperture priority/i`, or `/auto/i`, or value `3`, or any non-manual option.
  - The Auto Exposure toggle displays checked when current value matches the resolved auto value, and unchecked when matching manual.
  - Toggling switches between the resolved auto and manual values.
- **6.2 Discrete Menu Options**:
  - For `power_line_frequency`, discrete options are constructed from the control's parsed `menuItems` when present, falling back to standard `[ { value: "0", label: "Off" }, { value: "1", label: "50 Hz" }, { value: "2", label: "60 Hz" } ]` if `menuItems` is empty.

### 7. Dynamic Factory Reset Contract
- **7.1 Selective Command Construction**:
  - In `Model.buildResetCommands(device, controls)`:
    - The function receives the target `device` and the map of parsed `controls` currently exposed by that device. (If `controls` is omitted for backward compatibility, it defaults to `CONTROLS`).
    - Commands are constructed ONLY for controls that exist in the passed `controls` map.
    - Each control is reset to its parsed `default` / `defaultVal` value.
- **7.2 Dependency-Safe Reset Sequence**:
  - Step 1: If dependent controls exist on the device (`white_balance_temperature`, `exposure_time_absolute`, `focus_absolute`) and their respective parent controls exist (`white_balance_automatic`, `auto_exposure`, `focus_automatic_continuous`):
    - Switch parent controls to manual mode in a single `v4l2-ctl --set-ctrl` invocation.
    - Set dependent controls to their respective default values.
  - Step 2: Set all remaining supported V4L2 controls to their defaults (including restoring parents to their auto defaults).
  - Step 3: If `logitech_brio_fov` exists in the controls set and `cameractrls` is available, issue `cameractrls -d <dev> -c logitech_brio_fov=<default>`.
  - If a control is absent on the target camera, it is never included in any reset command. Zero commands shall fail with V4L2 control unknown errors.

### 8. Live Preview Viewfinder & Lifecycle Contract
- **8.1 Viewfinder Device Binding**:
  - `pickCameraDevice()` in `CameraPopup.qml` matches `MediaDevices.videoInputs` against `root.devicePath`.
  - When switching cameras, `cameraLoader` unloads the previous camera and binds to the newly selected input.
  - Video stream opens strictly on demand when the popup is open, and releases device file descriptors immediately upon popup close.
- **8.2 Format Reapplication**:
  - Re-applying capture mode on popup close restores driver defaults specifically on the currently selected camera device (`root.device`).

### 9. Extended IPC Handler Contract
- The `IpcHandler` for target `"abduldotdev.camera"` preserves all 8 existing methods and introduces 3 device management methods:
  - `open()`: Opens the settings popup.
  - `close()`: Closes the settings popup and releases the camera.
  - `toggle()`: Toggles the popup open or closed.
  - `resetDefaults()`: Restores factory defaults on the currently active camera.
  - `getCtrl(name: string): string`: Returns the current string value of the named control on the active camera.
  - `setCtrl(name: string, value: string)`: Sets the named control value on the active camera.
  - `getCaptureMode(): string`: Returns the current capture mode string (e.g. `"1280x720@30 MJPG"`) of the active camera.
  - `setCaptureMode(resolution: string, fps: string)`: Sets the capture mode on the active camera.
  - `getDevice(): string`: Returns the currently active device path (e.g. `"/dev/video0"`).
  - `setDevice(path: string)`: Switches the active camera to the specified device path (e.g. `"/dev/video2"`).
  - `listDevices(): string`: Returns a JSON-formatted string listing all discovered capture devices (`[{"path":"/dev/video0","name":"MX Brio"},...]`).

### 10. Automated Testing Contract
- **10.1 Model Unit Tests (`tests/model.test.js`)**:
  - Must parse discovery output (`v4l2-ctl --list-devices` + `--info`) for both single-device and multi-device setups, verifying that video capture nodes are included and metadata nodes are excluded.
  - Must parse the reference Logitech MX Brio fixture (all 17 controls + FOV) with 100% backward compatibility.
  - Must parse a generic UVC webcam fixture (exposing only brightness, contrast, saturation, white balance automatic, gamma, gain, power line frequency, sharpness, backlight compensation, auto-exposure, and exposure time absolute with different ranges and no pan/tilt, zoom, or FOV).
  - Must verify that `buildResetCommands` generates full 18-control reset commands for the MX Brio, and generates selective, error-free reset commands containing only supported controls for the generic webcam.
- **10.2 Hardware Verification Test (`tests/hardware.test.js`)**:
  - Must discover the active capture device dynamically instead of assuming `/dev/video0`.
  - Must skip cleanly with exit code 0 when no capture device is connected.
  - Must dynamically test only controls that are actually reported by the discovered device.

---

## Affected Surface

| File or Module | Nature of Change |
|---|---|
| [`Model.js`](../Model.js) | 1. Add device discovery parser `parseV4l2Devices(listText, infoMap)` to parse `--list-devices` and `--info`, filtering nodes with `Device Caps` containing `Video Capture`.<br>2. Add command builders `buildV4l2ListDevicesCommand()` and `buildV4l2InfoCommand(device)`.<br>3. Extend `buildResetCommands(device, controls)` to accept parsed controls, issuing reset commands only for present controls using their parsed defaults and dynamic auto-exposure auto values.<br>4. Add helper to resolve auto-exposure menu options (manual vs auto values).<br>5. Export new functions for test and QML environments. |
| [`Widget.qml`](../Widget.qml) | 1. Replace static `device` and `modelName` defaults with dynamic discovered properties (`discoveredDevices`, `selectedDevice`).<br>2. Add device discovery process invoking `v4l2-ctl --list-devices` and inspecting device capabilities.<br>3. Update `checkDeviceProc` and refresh logic to operate against the discovered/selected device.<br>4. Implement camera switching logic (refreshing controls, formats, mode, FOV).<br>5. Extend `IpcHandler` with `getDevice()`, `setDevice()`, and `listDevices()`.<br>6. Pass `discoveredDevices` and device change handlers to `CameraPopup`. |
| [`CameraPopup.qml`](../CameraPopup.qml) | 1. Add device selector in header/top area, visible when `discoveredDevices.length > 1`.<br>2. Bind header title to active camera card name and path.<br>3. Gate all individual controls on `root.controls[name]` presence (no phantom controls).<br>4. Dynamically bind slider `minimum`, `maximum`, and `step` from `getMeta()`.<br>5. Dynamically configure auto-exposure toggle and power-line frequency menu options.<br>6. Gate section headers and separators on child control visibility.<br>7. Pass `root.controls` to `resetRequested` / `buildResetCommands`.<br>8. Handle live preview restart upon device switching. |
| [`manifest.json`](../manifest.json) | Update `description` and `barWidget.description` to describe the plugin as a camera-agnostic V4L2/UVC webcam controller (with Logitech MX Brio as reference device), adhering to schema limits. |
| [`README.md`](../README.md) | Update title, features, prerequisites, controls inventory, and IPC interface documentation to reflect universal V4L2/UVC support, dynamic control rendering, multi-camera switching, and extended IPC commands. |
| [`tests/model.test.js`](../tests/model.test.js) | 1. Add fixtures and unit tests for multi-device discovery parsing.<br>2. Add generic UVC webcam fixture and unit tests for partial control set parsing.<br>3. Add unit tests for dynamic reset command generation across multiple camera types.<br>4. Retain and verify all existing MX Brio tests. |
| [`tests/hardware.test.js`](../tests/hardware.test.js) | 1. Replace hardcoded `/dev/video0` check with dynamic discovery.<br>2. Skip cleanly if no capture device is connected.<br>3. Test only controls supported by the discovered hardware. |

---

## Acceptance Criteria

1. **Runtime Device Discovery**:
   Executing device discovery correctly parses `v4l2-ctl --list-devices` and per-node `--info`, identifying all video capture devices while filtering out metadata nodes (such as `/dev/video1`) and non-capture nodes.

2. **Selected Device & Card Name in Header**:
   When a camera is connected, the popup header displays the active device's real card name (e.g. `"MX Brio"`, `"HD Pro Webcam C920"`, `"Integrated Camera"`) and its device path (e.g. `"/dev/video0 · Connected"`), with zero hardcoded model strings deciding the output.

3. **Graceful Zero-Camera State**:
   When no video capture devices are discovered on the system, the popup displays `"No camera connected"` in the header, `"Camera Disconnected"` with `"No capture device found"` in the viewfinder card, hides the controls flickable, and dims the bar widget icon to 0.4 opacity without crashing or throwing errors.

4. **Single-Camera Clean Header**:
   When exactly one video capture device is discovered, the device selector is hidden or inert, presenting a clean header layout displaying the single connected camera.

5. **Multi-Camera Selector Display**:
   When more than one video capture device is discovered, a device selector is displayed in `CameraPopup.qml` listing the discovered cameras by card name, clearly indicating the currently selected device.

6. **Interactive Device Switching**:
   Selecting a different camera from the device selector (or via IPC `setDevice <path>`) switches the active device path and card name, reloads controls and formats from the new device, re-checks FOV support, and switches the live viewfinder stream to the newly selected camera.

7. **Zero Phantom Controls**:
   Only controls that the selected device exposes in its parsed control listing are rendered in `CameraPopup.qml`. If a camera lacks pan, tilt, zoom, manual focus, or low-light compensation, those widgets are completely omitted from the UI.

8. **Empty Section Header Omission**:
   If none of the controls belonging to a section (e.g. Framing & Optics) are supported by the active camera, the section header and its separating line are omitted from the popup list.

9. **Dynamic Slider Limits and Stepping**:
   Every rendered slider binds its `minimum`, `maximum`, `step`, and initial value directly to the parsed control object (`ctrl.min`, `ctrl.max`, `ctrl.step`, `ctrl.value`), correctly adapting to cameras with arbitrary ranges (e.g. brightness `0..100` or `-64..64`) without clipping or using literal numbers.

10. **Dynamic Auto-Exposure & Menu Controls**:
    The Auto Exposure toggle dynamically discovers manual and auto values from the device's parsed `menuItems` (preferring Aperture Priority or non-manual for auto, and Manual for manual). Power-line frequency renders discrete options derived from the device's menu items.

11. **Dynamic Error-Free Reset Commands**:
    `buildResetCommands(device, controls)` constructs reset commands exclusively for controls present in the active device's control set, resetting each to its parsed default value and dynamically restoring auto-exposure to default. If `logitech_brio_fov` is absent, no cameractrls command is emitted. Executing the generated commands against the target camera produces zero "unknown control" errors.

12. **Preserved & Extended IPC Contract**:
    The widget responds successfully to existing IPC commands (`open`, `close`, `toggle`, `resetDefaults`, `getCtrl`, `setCtrl`, `getCaptureMode`, `setCaptureMode`), and implements `getDevice`, `setDevice`, and `listDevices` via `qs ipc call abduldotdev.camera`.

13. **Model Unit Test Verification**:
    Running `node tests/model.test.js` exits with code 0, successfully passing all existing tests and new unit tests covering:
    - Discovery parsing for single and multi-device outputs.
    - Logitech MX Brio fixture parsing.
    - Generic UVC webcam fixture parsing (different controls and ranges).
    - Dynamic reset command generation for both MX Brio and generic webcam.

14. **Hardware Verification Test Dynamic Execution**:
    Running `node tests/hardware.test.js`:
    - Automatically discovers the capture device instead of hardcoding `/dev/video0`.
    - If no capture device is connected, exits cleanly with code 0 and logs a skip message.
    - If a capture device is connected, tests all controls supported by that hardware, restores initial values, and exits with code 0.

15. **Marketplace & Documentation Compliance**:
    - `manifest.json` describes the plugin as a camera-agnostic V4L2/UVC webcam controller (with MX Brio as reference device), contains no unsupported fields (such as `changelog`), and adheres strictly to all schema length limits.
    - `README.md` accurately documents camera-agnostic support, multi-camera switching, dynamic control rendering, and extended IPC commands.

16. **Code Quality and Lint Validation**:
    - `qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml` exits with code 0 and zero warnings.
    - `omarchy plugin validate "$PWD"` exits with code 0 (`Validation passed`).

---

## Open Questions

1. **Discovery Command Strategy: Single Pipeline vs. Two-Stage Query**:
   - *Question*: Should device discovery run `v4l2-ctl --list-devices` followed by individual `--info` queries per device, or run a single composite shell pipeline?
   - *Recommendation*: Use a compact single shell command in `v4l2DevicesProc` that lists devices and inspects their capabilities in one invocation (e.g. `v4l2-ctl --list-devices | ...` or a helper script), outputting the consolidated device paths and card names. In `Model.js`, provide `parseV4l2Devices` to parse this structured output purely without side-effects.

2. **Placement of Multi-Camera Selector**:
   - *Question*: Where should the camera selector appear in `CameraPopup.qml` when multiple cameras are connected?
   - *Recommendation*: Place the camera selector directly below the header separator and immediately above the viewfinder frame as a compact `CameraSegmented` or pill selector. This keeps the header title clean and places camera switching in prominent view right above the live viewfinder.

3. **Handling of Missing Controls in Reset Command for Offline Calls**:
   - *Question*: What should `buildResetCommands(device, controls)` do if the caller does not supply the `controls` dictionary?
   - *Recommendation*: Fall back to the existing `CONTROLS` catalog when `controls` is `undefined` or null. This ensures 100% backward compatibility with any legacy caller or test that invokes `buildResetCommands(device)` with a single argument.
