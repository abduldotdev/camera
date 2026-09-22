# Spec: Camera Controls Enhancement, Zoom Wheel Multiplier, and Safe In-Popup Live Preview

## Problem
In the current repository state:
1. **Field of View Ambiguity & State Reflection**: Ambiguous requirement phrasing has referred to "65, 78, and 90 degrees" without explicitly locking them to hardware Field of View presets. While [`Model.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/Model.js#L175-L182) catalogs `logitech_brio_fov` with menu options `[65, 78, 90]` and [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml#L559-L568) provides a `CameraSegmented` component, past references have left ambiguity regarding whether 65/78/90 represent pan/tilt angles, digital crop ratios, or hardware FOV commands. Furthermore, the active state must be strictly bound to real `cameractrls` vendor commands and visibly reflected without desynchronizing across UI interactions, resets, and external tool mutations.
2. **Zoom Slider Mouse-Wheel Sluggishness**: In [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml#L571-L578), the Digital Zoom control (`zoom_absolute`, range 100% to 400%, step 1) delegates wheel events to [`PanelSlider.qml`](file:///usr/share/omarchy/shell/Ui/PanelSlider.qml#L140-L147), which increments/decrements by `root.step` (1 unit) per wheel event. Traversing the 300% zoom range with a scroll wheel requires 300 notches, which feels unresponsive. However, globally modifying `step` on the slider would degrade dragging resolution (forcing coarse increments) and alter non-wheel stepping. A zoom-slider-specific mouse-wheel multiplier is required while preserving granular dragging and leaving keyboard navigation and all other 10 sliders untouched.
3. **Lack of Live Viewfinder & Outdated Architectural Assumption**: In [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/README.md#L121-L122), a live viewfinder was classified as "Intentionally Out of Scope" based on the assumption that opening `/dev/video0` in the bar widget would acquire a persistent streaming lock that prevents video conferencing applications (Zoom, Teams, Google Meet, OBS) from accessing the camera. As a result, [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml) provides no visual feedback when users adjust framing, FOV, zoom, pan/tilt, exposure, focus, and color controls.
4. **V4L2 Ownership Safety & Missing State Distinctions**: The Linux `uvcvideo` kernel driver enforces single-opener exclusive streaming on `/dev/video0`. Naive video streaming in the UI can cause `EBUSY` conflicts or starve external apps. When a preview stream fails, current error presentation in [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml#L485-L533) only distinguishes full device disconnection from normal operation. It lacks visual states for device busy (`EBUSY`), permission denied (`EACCES`), and generic pipeline errors, and must guarantee that preview failures never block camera control adjustments.

## Scope
### In scope
- **Field of View (FOV) Presets (65°, 78°, 90°)**:
  - Explicitly define 65, 78, and 90 as hardware Field of View presets mapped to `cameractrls` control `logitech_brio_fov`.
  - Issue real `cameractrls -d <device> -c logitech_brio_fov=<val>` commands on selection.
  - Visibly reflect the active FOV preset in the segmented control (highlight/accent on the active value).
  - Graceful fallback: hide the FOV section when `cameractrls` is absent or the hardware does not expose the vendor extension unit.
  - Maintain full IPC support via `qs ipc call abduldotdev.camera setCtrl logitech_brio_fov <val>` and `getCtrl`.
- **Zoom-Slider-Only Mouse-Wheel Multiplier**:
  - Define a mouse-wheel multiplier specifically for the Digital Zoom slider (`zoom_absolute`).
  - Scroll wheel events over the zoom slider step by a defined multiplier $M$ (recommended $M = 10$, yielding $\pm 10\%$ per standard wheel notch), clamped to $[100, 400]$.
  - Slider dragging (mouse click and drag on knob or track) remains at fine-grained 1% integer stepping.
  - Keyboard navigation and direct IPC inputs remain standard (step = 1).
  - All other sliders (Brightness, Contrast, Saturation, Sharpness, Gain, Exposure Time, Color Temperature, Focus, Pan, Tilt) remain completely unchanged with no multiplier applied.
- **Safe In-Popup Live Preview**:
  - Provide an in-popup live video preview frame in `CameraPopup.qml` using installed Qt/Quickshell capabilities (`QtMultimedia` / `VideoOutput`).
  - Strict V4L2 lifecycle: open `/dev/video0` only when the popup is open (`open === true`) and the camera is idle.
  - Prompt release: synchronously/immediately deactivate the video stream and close `/dev/video0` as soon as the popup closes (`open === false`).
  - Coexistence with capture mode settings: release the preview stream prior to executing `v4l2-ctl --set-fmt-video` capture mode mutations to prevent `EBUSY`.
  - Distinct stream states: render clear visual feedback for (1) Active streaming, (2) Disconnected (`/dev/video0` missing), (3) Busy (device in use by external app / `EBUSY`), (4) Permission denied (`EACCES`), and (5) Generic unavailable / pipeline error.
  - Non-blocking contract: camera controls (sliders, toggles, segmented buttons, factory reset, IPC) must remain completely unblocked and functional regardless of preview state.
- **Documentation & Test Parity**:
  - Update `README.md` to document the in-popup preview lifecycle, FOV presets, and zoom wheel multiplier.
  - Update `tests/model.test.js` to validate model constants, helpers, and builders.
  - Ensure `tests/hardware.test.js` verifies hardware FOV presets and non-interfering operation.

### Out of scope
- Continuous background streaming or viewfinder rendering in the bar widget itself (the bar icon remains a status indicator, never opening video streams).
- Multi-camera device switching or dynamic selection of non-default devices (targeted to `/dev/video0` / Logitech MX Brio).
- Proprietary host-side software features impossible on Linux (RightSight AI auto-framing, Show Mode desk tracking, HDR, firmware flashing).
- Video recording, audio capture, or saving snapshots to disk.
- Installing new external system packages or binary dependencies.

## Behaviour
### 1. Field of View (FOV) Presets Contract
- **1.1 Preset Semantics**: The values 65, 78, and 90 represent hardware diagonal Field of View (in degrees) supported by the Logitech MX Brio UVC Extension Unit (XU). They map directly to `logitech_brio_fov`.
- **1.2 UI Trigger**: Clicking the "65°", "78°", or "90°" button in the "Field of View" segmented control in [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml#L559-L568):
  - Sets the optimistic UI selection state immediately.
  - Issues CLI command `cameractrls -d <device> -c logitech_brio_fov=<val>`.
- **1.3 State Reflection**: The active FOV preset must be visibly distinct from inactive presets (e.g. highlighted background/accent color defined in `ButtonGroup`). State updates from periodic queries (`cameractrls -d <device> -l`) or IPC mutations must update the selected preset indicator.
- **1.4 Availability Guard**: If `cameractrls` is not installed or returns non-zero during probe, or if `logitech_brio_fov` is absent from the hardware control list, the FOV segmented control is hidden from the popup, and other controls function normally.
- **1.5 Factory Reset Behavior**: Invoking factory reset (via UI "Reset defaults" button or IPC `resetDefaults`) issues `cameractrls -d <device> -c logitech_brio_fov=65` and resets the visible FOV selection to 65°.
- **1.6 IPC Parity**:
  - `qs ipc call abduldotdev.camera setCtrl logitech_brio_fov <65|78|90>` sets the hardware FOV and updates popup state.
  - `qs ipc call abduldotdev.camera getCtrl logitech_brio_fov` returns the current integer value (`"65"`, `"78"`, or `"90"`).

### 2. Zoom-Slider-Only Mouse-Wheel Multiplier Contract
- **2.1 Target Isolation**: The mouse-wheel multiplier applies strictly to the Digital Zoom slider (`zoom_absolute`) in `CameraPopup.qml`.
- **2.2 Wheel Multiplier Magnitude**: Each standard mouse-wheel tick (angleDelta $\pm 120$) increments or decrements the zoom value by $M \times \text{step}$, where multiplier $M = 10$ and base step = 1 (effective adjustment: $\pm 10\%$ per wheel notch).
- **2.3 Range Clamping**: Zoom values adjusted via wheel are clamped to $[100, 400]$.
- **2.4 Dragging Invariance**: Dragging the Digital Zoom slider knob or clicking along the slider track retains fine-grained 1% integer stepping, without applying the wheel multiplier.
- **2.5 Keyboard & IPC Invariance**: Keyboard arrow stepping (if slider has active focus) and IPC `setCtrl zoom_absolute <val>` operate with base 1% step precision.
- **2.6 Other Sliders Unaffected**: All other sliders in `CameraPopup.qml` (Brightness, Contrast, Saturation, Sharpness, Sensor Gain, Exposure Time, Color Temperature, Focus, Pan, Tilt) maintain their respective base stepping on mouse wheel, dragging, and keyboard navigation without applying any multiplier.

### 3. In-Popup Live Preview & V4L2 Ownership Contract
- **3.1 Visual Presentation & Placement**:
  - A 16:9 widescreen preview viewfinder is positioned at the top of `CameraPopup.qml` content (above or within the Framing & Optics section).
  - While streaming, live video frames are displayed using `VideoOutput` with aspect ratio preservation (`PreserveAspectCrop` or `PreserveAspectFit`).
- **3.2 Popup Open Activation**:
  - When the popup opens (`open` transitions to `true`), the preview initiates video capture on `/dev/video0` if the device is present and idle.
  - Streaming starts asynchronously without blocking the UI thread or delaying popup presentation.
- **3.3 Popup Close Immediate Deactivation**:
  - When the popup closes (`open` transitions to `false`), the preview immediately deactivates (`camera.active = false`) and closes the underlying `/dev/video0` file descriptor.
  - No streaming process, background thread, or Qt multimedia capture session may hold `/dev/video0` while the popup is closed.
- **3.4 Coexistence with External Applications**:
  - If an external application (e.g., Zoom, Google Meet, Teams, OBS, ffmpeg) is streaming `/dev/video0` when the popup opens, the preview must detect that the device is unavailable/busy, fail gracefully, release any pending open attempts, and display the "Busy" state.
  - If an external application requests the camera while the popup is open, the user closing the popup must immediately release the camera device so the external app can open it without requiring a system restart or shell reload.
- **3.5 Capture Mode Mutation Interlock**:
  - When the user selects a new resolution or framerate via the Capture section (`setCaptureMode`), the preview stream must be stopped before issuing `v4l2-ctl --set-fmt-video` (since the driver rejects format changes while any stream is open with `EBUSY`), and reactivated after the format change completes if the popup remains open.
- **3.6 Stream State Presentation**:
  The preview container must present five distinct, mutually exclusive states:
  1. **Active**: Video stream rendering live camera frames.
  2. **Disconnected**: `/dev/video0` is not present in the filesystem. Displays an offline camera icon with text: "Camera Disconnected".
  3. **Busy**: `/dev/video0` exists but cannot be opened because another application is streaming (`EBUSY`). Displays a warning icon with text: "Camera In Use" and subtext: "In use by another application".
  4. **Permission Denied**: `/dev/video0` exists but cannot be opened due to file permission restrictions (`EACCES`). Displays a lock/shield icon with text: "Permission Denied" and subtext: "Check video group / udev permissions".
  5. **Generic Unavailable**: Device error, unsupported pixel format, or GStreamer/FFmpeg pipeline initialization failure. Displays an alert icon with text: "Preview Unavailable".
- **3.7 Non-Blocking Controls Contract**:
  - The live preview status is decoupled from the control plane.
  - When the preview is in Disconnected, Busy, Permission Denied, or Unavailable state, all control sliders, toggles, segmented buttons, and the factory reset button remain interactive and capable of sending V4L2/cameractrls commands.
  - In particular, in the Busy state, V4L2 control ioctls (`v4l2-ctl --set-ctrl`) and `cameractrls` remain fully functional because the Linux UVC driver allows control ioctls while a video stream is active in another process.

## Affected surface
| file or module | change |
|---|---|
| [`Model.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/Model.js) | Export constants and pure helpers: FOV preset options catalog (`[65, 78, 90]`), zoom mouse-wheel multiplier factor ($M = 10$), and preview state enumeration (`STREAMING`, `DISCONNECTED`, `BUSY`, `PERMISSION_DENIED`, `UNAVAILABLE`). |
| [`Widget.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/Widget.qml) | Expose preview state properties, coordinate preview deactivation on popup close, interlock capture mode changes with preview deactivation, and ensure IPC handlers reflect FOV and zoom state. |
| [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/CameraPopup.qml) | Implement the in-popup preview frame using `QtMultimedia` (`Camera`, `CaptureSession`, `VideoOutput`), render visual overlay cards for the 5 stream states, implement zoom-slider-only mouse-wheel multiplier, bind FOV segmented buttons to issue real cameractrls commands and reflect selection, and ensure controls remain non-blocking during preview errors. |
| [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/README.md) | Update feature inventory and feature support table (revise line 121 from "Omitted / Out of Scope" to supported on-demand in-popup preview with safe V4L2 ownership), document FOV presets and zoom mouse-wheel multiplier. |
| [`tests/model.test.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/tests/model.test.js) | Add unit tests covering FOV preset constants/builders, zoom wheel multiplier calculations, and preview state models. |
| [`tests/hardware.test.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-070140-1e32-main-sup-1/tests/hardware.test.js) | Verify round-trip FOV preset mutations across all three options (65, 78, 90) against physical hardware and verify control adjustments while the device is in streaming state. |

## Acceptance criteria
1. **FOV Preset Hardware Command Verification**: Selecting 65°, 78°, or 90° in `CameraPopup.qml` or via `Widget.qml` executes `cameractrls -d <device> -c logitech_brio_fov=<val>` where `<val>` matches the selected preset.
2. **FOV State Reflection**: The Field of View segmented control in `CameraPopup.qml` visually marks the active setting as selected (highlighted style), matching the value returned by `cameractrls -d <device> -l`.
3. **FOV Factory Reset**: Clicking "Reset defaults" or executing `qs ipc call abduldotdev.camera resetDefaults` sets `logitech_brio_fov=65` and updates the segmented button selection to 65°.
4. **FOV IPC Parity**: Executing `qs ipc call abduldotdev.camera setCtrl logitech_brio_fov 78` switches the hardware FOV to 78, updates the popup selection, and subsequent `getCtrl logitech_brio_fov` outputs `"78"`.
5. **Zoom Wheel Multiplier Increment**: Disagreeing with default single-step wheeling, scrolling the mouse wheel up or down over the Digital Zoom slider increments or decrements the zoom value by 10% per standard wheel tick ($M = 10$), clamped to $[100, 400]$.
6. **Zoom Dragging Granularity Preserved**: Dragging the Digital Zoom slider knob or clicking the track allows selecting any integer value in 1% steps across the $[100, 400]$ range without snapping to multiples of 10.
7. **Other Sliders Multiplier Invariance**: Scrolling the mouse wheel over non-zoom sliders (Brightness, Contrast, Saturation, Sharpness, Gain, Exposure Time, Color Temperature, Focus, Pan, Tilt) steps by each slider's defined base step (e.g. 1 for color, 50 for temperature, 3600 for pan/tilt), verifying no multiplier is applied.
8. **Closed Popup V4L2 Release Verification**: With the camera popup closed, running `fuser /dev/video0` or `lsof /dev/video0` verifies that no quickshell or plugin process holds an open file descriptor or streaming handle on `/dev/video0`.
9. **Open Popup Preview Activation**: Opening the camera popup when `/dev/video0` is present and idle activates the live video viewfinder, displaying frames within the 16:9 preview container.
10. **Prompt Deactivation on Close**: Closing the camera popup immediately stops video streaming and releases `/dev/video0` within 200 ms.
11. **Busy State Graceful Handling**: When an external process holds `/dev/video0` (e.g. `mpv av://v4l2:/dev/video0` or `v4l2-ctl --stream-mmap`), opening the popup displays the "Camera In Use" overlay in the preview frame without crashing or locking up the shell.
12. **Non-Blocking Controls in Busy State**: While the preview frame displays the "Camera In Use" state, adjusting Brightness, Contrast, Saturation, FOV, or Zoom sends control updates to the driver successfully without being disabled or blocked.
13. **Disconnected State Presentation**: When `/dev/video0` does not exist, the preview frame displays the "Camera Disconnected" state, and popup controls handle the missing device cleanly.
14. **Permission Denied State Presentation**: When `/dev/video0` cannot be opened due to permissions (`EACCES`), the preview displays the "Permission Denied" indicator.
15. **Capture Mode Interlock**: Changing capture mode (resolution/framerate) while popup is open pauses/releases the preview stream before executing `v4l2-ctl --set-fmt-video`, preventing `EBUSY` failures during format configuration.
16. **Linting & Validation**: Running `qmllint -I "$OMARCHY_PATH/shell" Widget.qml CameraPopup.qml` exits with status 0 and zero warnings; running `omarchy plugin validate "$PWD"` exits with status 0.
17. **Unit Test Suite**: Running `node tests/model.test.js` passes all assertions, including tests for FOV presets, zoom wheel multiplier, and preview state definitions.
18. **Hardware Test Suite**: Running `node tests/hardware.test.js` passes all 18 hardware control round-trips against `/dev/video0`, verifying FOV presets (65, 78, 90) and capture mode round trip.
19. **Documentation Alignment**: `README.md` accurately documents the in-popup live preview lifecycle, safe V4L2 ownership guarantees, FOV presets, and zoom wheel multiplier behavior.

## Open questions
1. **Zoom Mouse-Wheel Multiplier Value**:
   - *Question*: What is the optimal multiplier value $M$ for the Digital Zoom mouse wheel?
   - *Recommendation*: Set $M = 10$ (yielding a step of 10% per standard 120-unit wheel notch). Over the 300% range (100%–400%), 10% requires exactly 30 wheel notches to traverse the full spectrum, offering a balance between swift adjustment and framing control. Dragging remains available for 1% fine-tuning.
2. **Preview Stream Default Resolution**:
   - *Question*: What stream resolution should the in-popup preview request from the V4L2 driver?
   - *Recommendation*: Use 640×360 or 640×480 in MJPG or native YUYV (or allow QtMultimedia to negotiate default capture format). High resolutions like 4K (3840×2160) impose unnecessary GPU/CPU decoding overhead in the shell process for a small popup container.
3. **Capture Mode Change Workflow**:
   - *Question*: How should preview stream handle capture resolution changes made within the popup?
   - *Recommendation*: Temporarily deactivate the preview (`camera.active = false`), execute `buildV4l2SetCaptureModeCommand`, and then restart the preview stream after the driver has accepted the new format parameters.
