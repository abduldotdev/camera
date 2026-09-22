# Spec: Right-Edge Vertical Scrollbar, Middle-Scroll Control Isolation, and Marketplace Release (v1.1.0)

## Summary
This specification defines three cohesive enhancements to the `abduldotdev.camera` Omarchy plugin:
1. **Right-Edge Vertical Scrollbar**: Add a visible, theme-compliant vertical scrollbar (`ScrollBar.AsNeeded`) to the popup control list (`flick` in [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml#L676-L685)) with a draggable handle, clickable track, and hover-wheel support, sized and spaced to prevent collision with child control knobs.
2. **Middle-Scroll Control Isolation & Zoom Wheel Multiplier Removal**: Intercept mouse wheel events anywhere over the scrollable content area before they reach [`PanelSlider.qml`](file:///usr/share/omarchy/shell/Ui/PanelSlider.qml#L140-L147), guaranteeing that scrolling anywhere in the middle of the popup scrolls the list and never alters any slider values. Remove the Digital Zoom mouse-wheel multiplier and wheel overlay from [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml#L304-L317), deleting obsolete helpers `ZOOM_WHEEL_MULTIPLIER` and `wheelStep` from [`Model.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/Model.js#L14) and [`tests/model.test.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/tests/model.test.js#L883-L916), while preserving granular knob dragging, track clicking, step buttons, and keyboard controls.
3. **Marketplace Release Compliance (v1.1.0)**: Bump [`manifest.json`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/manifest.json#L5) from `1.0.0` to `1.1.0` (SemVer minor), verify all marketplace schema field limits, document the lack of a `changelog` manifest field, update [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/README.md#L11-L26) to reflect the scrollbar and middle-scroll behavior, and remove the obsolete 10% zoom wheel multiplier claim.

---

## Problem & Current State
1. **Missing Scrollbar & Poor Affordance**:
   In [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml#L676-L685), the online controls container is a `Flickable` (`flick`) with `sectionsCol` containing 18 camera controls (FOV, zoom, pan/tilt, capture resolution/framerate, focus, exposure, gain, white balance, brightness, contrast, saturation, sharpness, power line frequency, backlight compensation). Currently, `flick` has no attached vertical scrollbar. Users have no visual indication of their scroll offset or total list length, and have no way to scrub or click-and-drag through the list from the right edge.
2. **Scrolling From Middle Mutates Sliders**:
   In [`/usr/share/omarchy/shell/Ui/PanelSlider.qml`](file:///usr/share/omarchy/shell/Ui/PanelSlider.qml#L140-L147), the component's internal `MouseArea` handles `onWheel`:
   ```qml
   onWheel: function(wheel) {
     var delta = wheel.angleDelta.y > 0 ? root.step : -root.step
     var next = Math.max(root.minimum, Math.min(root.maximum, root.liveValue + delta))
     if (root.integer) next = Math.round(next)
     root.liveValue = next
     root.moved(next)
     root.released(next)
   }
   ```
   Furthermore, in [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml#L304-L317), `CameraSlider` layers a wheel overlay `MouseArea` for Digital Zoom (`wheelMultiplier = Model.ZOOM_WHEEL_MULTIPLIER = 10`).
   Because the popup contains 11 sliders that span the majority of the vertical content area, any natural mouse-wheel scrolling down the middle of the popup is intercepted by whichever slider the pointer happens to hover over. This unintentionally alters critical camera settings (such as zooming in/out, changing exposure time, or skewing color temperature) instead of scrolling the popup view.
3. **Obsolete Zoom Wheel Multiplier**:
   The user requirement states: *"scrolling from the middle don't change any slider"*. The existing zoom wheel multiplier (`Model.ZOOM_WHEEL_MULTIPLIER = 10` and `Model.wheelStep`) directly conflicts with this requirement. As long as any slider responds to mouse wheel events, scrolling down the middle cannot be made safe. The zoom wheel multiplier and its overlay must be removed completely.
4. **Outdated Manifest Version & Documentation for Marketplace**:
   [`manifest.json`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/manifest.json#L5) is currently at `"version": "1.0.0"`. Since the initial 1.0.0 marketplace release (https://plugins.omarchy.org/plugin.html?id=abduldotdev.camera), the plugin has received major feature enhancements: hardware FOV presets (65°/78°/90°), in-popup live video preview, dynamic capture mode negotiation, and now the right-edge scrollbar and middle-scroll control isolation. The manifest must be incremented to `1.1.0`. In addition, [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/README.md#L17) still documents the 10% zoom wheel multiplier and lacks documentation for the scrollbar and middle-scroll isolation.

---

## Scope

### In Scope / Goals
- **Right-Edge Vertical Scrollbar**:
  - Integrate a vertical scrollbar on `flick` in `CameraPopup.qml` using the Omarchy shell idiom (`import QtQuick.Controls; ScrollBar.vertical: ScrollBar { ... }`).
  - Provide custom `contentItem` styling matching Omarchy shell design tokens (`root.fg`, `root.safeMuted`, `Style.cornerRadius`) to guarantee visibility and high contrast against dark and light popup backgrounds (`root.bg`).
  - Support dragging the scrollbar handle, clicking on the track, and wheel scrolling when hovering over the scrollbar.
  - Set policy to `ScrollBar.AsNeeded` so the scrollbar appears only when `flick.contentHeight > flick.height`.
  - Adjust `sectionsCol` width and margins in `CameraPopup.qml` to provide clearance for the scrollbar without clipping slider knobs or step buttons.
- **Middle-Scroll Control Isolation**:
  - Layer an event interceptor over `sectionsCol` in `CameraPopup.qml` (transparent overlay `MouseArea` with `acceptedButtons: Qt.NoButton` or `WheelHandler` on `flick`) that intercepts wheel events, marks them accepted, and scrolls `flick.contentY`.
  - Guarantee that scrolling the mouse wheel anywhere over the content area (sliders, segmented buttons, switches, headers, labels) never modifies any slider value or triggers any `controlChanged` signal.
  - Preserve fine-grained dragging: clicking and dragging any slider knob or clicking on a slider track must continue to work with standard 1-unit precision.
  - Preserve Pan/Tilt step buttons and keyboard navigation.
- **Removal of Zoom Wheel Multiplier**:
  - Remove the wheel overlay `MouseArea` from `CameraSlider` in `CameraPopup.qml`.
  - Remove property `wheelMultiplier` from `CameraSlider` and its assignment on the Digital Zoom slider.
  - Delete `ZOOM_WHEEL_MULTIPLIER` and `wheelStep` from `Model.js` and their corresponding test cases in `tests/model.test.js`.
- **Marketplace Release Compliance (v1.1.0)**:
  - Bump `manifest.json` version to `1.1.0`.
  - Verify that `manifest.json` complies with all marketplace schema limits (ID <= 128 chars, name <= 120 chars, version <= 64 chars, description <= 500 chars).
  - Explicitly document that `manifest.json` has no `changelog` field under Omarchy manifest schema version 1.
  - Update `README.md` features list and feature support table to document the scrollbar, describe the new middle-scroll isolation behavior, and remove the 10% zoom wheel multiplier description.
- **Comprehensive Verification**:
  - Implement a Quickshell smoke test harness in the run artifacts directory using `QtTest` `TestEvent` (`mouseWheel`) that delivers synthetic wheel events over a slider and asserts that the slider value remains unchanged while `flick.contentY` moves.
  - Execute and pass: `node tests/model.test.js`, `qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml`, `omarchy plugin validate "$PWD"`, and `node tests/hardware.test.js`.

### Out of Scope / Non-Goals
- Adding horizontal scrolling or scrollbars (the popup layout is strictly vertical).
- Modifying upstream `/usr/share/omarchy/shell/Ui/PanelSlider.qml` or other system files outside the plugin directory.
- Adding a custom `changelog` field to `manifest.json` (invalid under Omarchy manifest schema version 1).
- Changing slider value ranges, steps, or driver command mappings.
- Automatic scrolling animations or kinetic physics beyond Qt Quick's standard `Flickable` behavior.

---

## Behaviour & Design

### 1. Right-Edge Vertical Scrollbar Contract
- **1.1 Component Attachment**:
  In [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml#L676), `flick` declares:
  ```qml
  import QtQuick.Controls

  // Inside Flickable id: flick
  ScrollBar.vertical: ScrollBar {
    id: vbar
    policy: ScrollBar.AsNeeded
    width: 8
    contentItem: Rectangle {
      implicitWidth: 6
      implicitHeight: 32
      radius: Style.cornerRadius
      color: vbar.pressed ? root.fg : (vbar.hovered ? root.fg : root.safeMuted)
      opacity: vbar.active || vbar.hovered ? 0.85 : 0.4
      Behavior on opacity {
        NumberAnimation { duration: 120; easing.type: Easing.OutCubic }
      }
    }
  }
  ```
- **1.2 Visibility & Policy**:
  - `policy: ScrollBar.AsNeeded`: The scrollbar is visible and interactive when `flick.contentHeight > flick.height`. When the popup content fits within the window (e.g. disconnected camera state or collapsed view), the scrollbar remains invisible.
  - High Contrast Styling: The default unstyled `QtQuick.Controls` `ScrollBar` thumb can have insufficient contrast on dark/light themes. By explicitly setting `contentItem` with `root.fg` (active/hovered) and `root.safeMuted` (resting) with `opacity` between 0.4 and 0.85, the scrollbar is clearly legible against `root.bg`.
- **1.3 Interaction Modes**:
  - **Handle Dragging**: Pressing and dragging the scrollbar handle (`vbar.contentItem`) scrubs `flick.contentY` continuously between `0` and `flick.contentHeight - flick.height`.
  - **Track Clicking**: Clicking on the track above or below the handle shifts `flick.contentY` by a page or increments toward the clicked location.
  - **Scrollbar Hover Wheel**: Scrolling the mouse wheel while hovering directly over the scrollbar scrolls `flick.contentY`.
- **1.4 Layout Spacing & Margin**:
  - In `CameraPopup.qml` line 688, `sectionsCol.width` is adjusted from `flick.width - 6` to `flick.width - 12` (or dynamic calculation `flick.width - (vbar.visible ? vbar.width + 4 : 4)`).
  - This ensures a 4px–6px clear gutter between the rightmost edge of slider knobs/track ends and the scrollbar, preventing accidental slider clicks when targeting the scrollbar.

### 2. Middle-Scroll Content Scrolling & Slider Isolation Contract
- **2.1 Problem & Root Cause**:
  `PanelSlider.qml` contains an internal `MouseArea` covering the slider with `onWheel` stepping `root.liveValue`. When scrolling the mouse wheel while the cursor is anywhere over `sectionsCol`, sliders intercept the wheel event, causing unintended value adjustments.
- **2.2 Interception Architecture**:
  In `CameraPopup.qml`, inside `flick`, an overlay `MouseArea` is positioned on top of `sectionsCol`:
  ```qml
  MouseArea {
    id: scrollWheelInterceptor
    anchors.fill: sectionsCol
    z: 10
    acceptedButtons: Qt.NoButton
    hoverEnabled: false

    onWheel: function(wheel) {
      wheel.accepted = true
      var step = 48
      var dy = wheel.angleDelta.y > 0 ? -step : (wheel.angleDelta.y < 0 ? step : 0)
      var maxY = Math.max(0, flick.contentHeight - flick.height)
      flick.contentY = Math.max(0, Math.min(maxY, flick.contentY + dy))
    }
  }
  ```
- **2.3 Pass-Through Guarantees**:
  - Setting `acceptedButtons: Qt.NoButton` guarantees that mouse press, move, release, and click events are completely ignored by the overlay and propagate directly to underlying controls (`PanelSlider`, `CameraSegmented`, `Button`, `CameraPanTilt`).
  - Knob dragging, track clicking, button pressing, and segmented control selections pass through with zero latency or obstruction.
- **2.4 Wheel Event Halting**:
  - Because `scrollWheelInterceptor` has higher z-order than `sectionsCol`'s children, Qt Quick delivers wheel events to `scrollWheelInterceptor` first.
  - `wheel.accepted = true` consumes the wheel event, preventing it from bubbling down to `PanelSlider.qml`'s `MouseArea`.
  - Rolling the mouse wheel over any slider (Brightness, Contrast, Saturation, Sharpness, Gain, Exposure Time, Color Temperature, Focus, Digital Zoom) scrolls `flick.contentY` and never alters the slider value.
- **2.5 Step Normalization & Clamping**:
  - Wheel increments are calculated from `wheel.angleDelta.y`. Standard mouse wheel ticks (angle delta $\pm 120$) step `contentY` by $\pm 48$ px.
  - `flick.contentY` is strictly clamped within $[0, \max(0, \text{contentHeight} - \text{height})]$.

### 3. Removal of Zoom Mouse-Wheel Multiplier Contract
- **3.1 Removal Decision & Justification**:
  In earlier versions, Digital Zoom supported a 10% mouse-wheel multiplier (`wheelMultiplier = 10`). However, preserving mouse-wheel stepping on Digital Zoom directly violates the user's primary requirement: *"scrolling from the middle don't change any slider"*. If any slider reacts to wheel events, scrolling down the middle cannot be reliable. Therefore, the zoom wheel multiplier is completely eliminated.
- **3.2 UI Cleanup in `CameraPopup.qml`**:
  - In `component CameraSlider`:
    - Remove the overlay `MouseArea` (lines 304–317).
    - Remove `property int wheelMultiplier: 1`.
  - In Digital Zoom instantiation (line 716):
    - Remove `wheelMultiplier: Model.ZOOM_WHEEL_MULTIPLIER`.
    - Digital Zoom becomes a standard `CameraSlider` with fine-grained 1% knob dragging and track clicking across $[100, 400]$.
- **3.3 Model Cleanup in `Model.js`**:
  - Delete `var ZOOM_WHEEL_MULTIPLIER = 10` (line 14).
  - Delete helper `function wheelStep(...)` (lines 822–835).
  - Remove `ZOOM_WHEEL_MULTIPLIER` and `wheelStep` from the exported object (lines 923, 947).
- **3.4 Test Cleanup in `tests/model.test.js`**:
  - Remove test block 15 assertion: `assert.equal(Model.ZOOM_WHEEL_MULTIPLIER, 10)` (lines 886).
  - Remove test block 16: `Model.wheelStep` assertions (lines 898–916).

### 4. Marketplace Release & Metadata Contract (v1.1.0)
- **4.1 Manifest Version Bump**:
  [`manifest.json`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/manifest.json#L5) is updated to `"version": "1.1.0"`.
- **4.2 Marketplace Schema & Limits Audit**:
  The manifest adheres strictly to Omarchy marketplace catalog constraints:
  - `schemaVersion`: `1` (integer)
  - `id`: `"abduldotdev.camera"` (18 characters, limit <= 128, regex `^[a-z0-9][a-z0-9._-]*$`, no `..`, not `omarchy.*`)
  - `name`: `"Camera"` (6 characters, limit <= 120)
  - `version`: `"1.1.0"` (5 characters, limit <= 64)
  - `author`: `"abduldotdev"` (11 characters, limit <= 120)
  - `license`: `"MIT"` (3 characters, limit <= 120)
  - `description`: `"Logi Tune-like controls for the Logitech MX Brio 4K webcam"` (58 characters, limit <= 500)
  - `kinds`: `["bar-widget"]`
  - `entryPoints`: `{"barWidget": "Widget.qml"}`
  - `barWidget.displayName`: `"Camera"` (<= 120)
  - `barWidget.description`: `"Logi Tune-like controls for the Logitech MX Brio 4K webcam"` (<= 500)
  - `barWidget.category`: `"Media"`
  - `barWidget.defaultSection`: `"right"`
  - **No Changelog Field**: Omarchy manifest schema version 1 does NOT support a `changelog` field. No `changelog` property shall be added to `manifest.json`.
- **4.3 Documentation Synchronization in `README.md`**:
  - Update `## Features`:
    - Document right-edge vertical scrollbar: *"Visible right-edge vertical scrollbar (`ScrollBar.AsNeeded`) with high-contrast Omarchy theme styling, supporting click-and-drag scrubbing, track clicks, and scroll wheel scrolling."*
    - Document middle-scroll control isolation: *"Scroll wheel navigation anywhere over popup content (sliders, segmented buttons, switches, headers) smoothly scrolls the settings list and is strictly isolated from controls, guaranteeing that scrolling never accidentally modifies any slider value."*
    - Revise Digital Zoom entry: remove *"with a 10% mouse-wheel multiplier ($M = 10$)"* and document standard fine-grained 1% dragging and track clicking.
  - Update `## Logi Tune Feature Support on Linux` table:
    - Revise `Digital Zoom (1x–4x)` row description to remove wheel multiplier references and reflect standard 1% precision.

---

## Affected Surface

| File or Module | Nature of Change |
|---|---|
| [`CameraPopup.qml`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/CameraPopup.qml) | 1. Import `QtQuick.Controls`.<br>2. Add styled `ScrollBar.vertical` to `flick`.<br>3. Add middle-scroll interceptor overlay (`acceptedButtons: Qt.NoButton`) over `sectionsCol` to scroll `flick` on wheel.<br>4. Adjust `sectionsCol.width` for scrollbar gutter.<br>5. Remove wheel overlay and `wheelMultiplier` from `CameraSlider`.<br>6. Remove `wheelMultiplier` from Digital Zoom slider. |
| [`Model.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/Model.js) | Remove obsolete `ZOOM_WHEEL_MULTIPLIER` constant, `wheelStep` function, and their exports. |
| [`tests/model.test.js`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/tests/model.test.js) | Remove unit tests covering `ZOOM_WHEEL_MULTIPLIER` and `wheelStep`. |
| [`manifest.json`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/manifest.json) | Bump `"version"` from `"1.0.0"` to `"1.1.0"`. |
| [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/README.md) | Update Features and Support Table: document right-edge scrollbar, document middle-scroll isolation, remove 10% zoom wheel multiplier claims. |

---

## Acceptance Criteria

1. **Visible Vertical Scrollbar on Overflow**:
   When the popup is opened and `sectionsCol.implicitHeight` exceeds `flick.height`, a vertical scrollbar appears on the right edge of `flick`.
2. **Scrollbar Hides When Not Needed**:
   When content height is less than or equal to `flick.height` (e.g. camera disconnected view), the scrollbar remains hidden (`policy: ScrollBar.AsNeeded`).
3. **Scrollbar Theme Contrast**:
   The scrollbar thumb is styled with `root.fg` (active/hovered) and `root.safeMuted` (resting) with `Style.cornerRadius`, remaining clearly visible against `root.bg` on both dark and light color schemes.
4. **Scrollbar Handle Dragging**:
   Clicking and dragging the scrollbar handle up or down smoothly changes `flick.contentY` proportionally across its full range.
5. **Scrollbar Track Clicking**:
   Clicking the scrollbar track above or below the handle shifts the scroll position toward the click point.
6. **Scrollbar Hover Wheel**:
   Positioning the mouse pointer directly over the scrollbar and rotating the mouse wheel changes `flick.contentY`.
7. **Content Gutter Clearance**:
   `sectionsCol.width` is sized (`flick.width - 12`) so that slider knobs, track ends, and buttons have at least 4px clearance from the scrollbar and do not overlap.
8. **Middle-Scroll Isolation (Zero Control Mutation)**:
   Positioning the mouse pointer directly over any slider track or knob (Brightness, Contrast, Saturation, Sharpness, Gain, Exposure Time, Color Temperature, Focus, Digital Zoom) and turning the mouse wheel up or down does NOT change the slider's value or emit `controlChanged`.
9. **Middle-Scroll List Progression**:
   Positioning the mouse pointer anywhere over the middle of the popup content and turning the mouse wheel downward increases `flick.contentY` (scrolling downward), and turning upward decreases `flick.contentY`.
10. **Slider Knob Dragging Preserved**:
    Clicking and dragging the knob of any slider (including Digital Zoom) adjusts the slider value with standard 1-unit precision.
11. **Slider Track Clicking Preserved**:
    Clicking anywhere along a slider track moves the knob to the clicked position and commits the value.
12. **Step Buttons & Toggles Preserved**:
    Clicking Pan/Tilt step buttons, resolution/framerate segmented controls, or autofocus/autoexposure toggles functions normally without interference from the wheel interceptor.
13. **Zoom Wheel Multiplier Removed**:
    `CameraSlider` in `CameraPopup.qml` contains no wheel overlay, `Model.js` exports neither `ZOOM_WHEEL_MULTIPLIER` nor `wheelStep`, and `tests/model.test.js` passes with those tests removed.
14. **Manifest Bumped to 1.1.0**:
    [`manifest.json`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/manifest.json) specifies `"version": "1.1.0"`, does NOT include any `changelog` property, and satisfies all marketplace schema limits.
15. **Documentation Synchronized**:
    [`README.md`](file:///home/abdul891/Documents/projects/omarchy-plugins/.orch-worktrees/abduldotdev.camera-20260922-085944-d1c8-main-sup-1/README.md) accurately documents the scrollbar, middle-scroll isolation, and removes the 10% zoom wheel multiplier.
16. **Automated Verification**:
    - `node tests/model.test.js` exits `0`.
    - `qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml` exits `0` with zero warnings.
    - `omarchy plugin validate "$PWD"` exits `0`.
    - Quickshell smoke harness delivering synthetic `TestEvent.mouseWheel` over a slider verifies that the slider value remains unchanged and `flick.contentY` moves, exiting `0`.
    - `node tests/hardware.test.js` exits `0` when run against physical `/dev/video0`.

---

## Verification Commands

### 1. Model Unit Tests
Verify model integrity after deleting obsolete wheel helpers:
```bash
node tests/model.test.js
```
*Expected output: `All Model.js tests passed successfully!` (exit status 0).*

### 2. QML Linting
Verify syntax, type bindings, and absence of deprecated APIs:
```bash
qmllint -I /usr/share/omarchy/shell Widget.qml CameraPopup.qml
```
*Expected output: Clean exit with status 0 and zero warnings.*

### 3. Omarchy Plugin Validation
Verify plugin manifest, entry points, and marketplace structure:
```bash
omarchy plugin validate "$PWD"
```
*Expected output: `Validation passed` (exit status 0).*

### 4. Quickshell Synthetic Wheel Smoke Test Harness
A standalone smoke test harness in `.orchestrator/runs/20260922-085944-d1c8-main/artifacts/smoke/` loads `Widget.qml` in a mock shell bar and uses `QtTest` `TestEvent` (`import QtTest`) to deliver synthetic mouse wheel events:
1. Open the camera popup via IPC: `qs -p <harness_dir> ipc call abduldotdev.camera open`.
2. Query initial slider values: `brightness = getCtrl brightness`, `zoom = getCtrl zoom_absolute`, and initial `contentY = 0`.
3. Synthesize mouse wheel scroll down (`TestEvent.mouseWheel(targetSlider, x, y, 0, -120)`) directly over the Brightness slider and the Digital Zoom slider.
4. Verify assertions:
   - `brightness` value remains identical to its initial value.
   - `zoom_absolute` value remains identical to its initial value.
   - `flick.contentY` has increased (greater than 0).
5. Verify scrollbar interaction:
   - Synthesize mouse drag or click on the right-edge scrollbar track and assert `flick.contentY` changes.
6. Close popup via IPC: `qs -p <harness_dir> ipc call abduldotdev.camera close` and verify `/dev/video0` is promptly released.

Run command:
```bash
bash .orchestrator/runs/20260922-085944-d1c8-main/artifacts/smoke/run-smoke.sh
```
*Expected output: `SMOKE RESULT: 0 failure(s)` (exit status 0).*

### 5. Hardware Integration Tests
Verify end-to-end hardware communication against physical `/dev/video0`:
```bash
node tests/hardware.test.js
```
*Expected output: All 18 controls round-trip verified (exit status 0).*

---

## Risks & Open Questions

### Risks & Mitigations
1. **Event Swallowing by Interceptor Overlay**:
   - *Risk*: A `MouseArea` overlay layered above `sectionsCol` could inadvertently block mouse clicks or knob drags on underlying sliders and buttons.
   - *Mitigation*: Setting `acceptedButtons: Qt.NoButton` explicitly informs Qt Quick's event dispatcher that the `MouseArea` does not accept any mouse press, move, or release events. These events are immediately routed to underlying items. Only wheel events are processed and accepted.
2. **Subtle Trackpad / Smooth Scroll Deltas**:
   - *Risk*: High-precision touchpads emit small fractional angle deltas rather than discrete 120-unit notches, which could cause erratic stepping if handled naively.
   - *Mitigation*: Compute `dy` proportionally to `wheel.angleDelta.y` (e.g. `-(wheel.angleDelta.y / 120) * 48` or `-(wheel.angleDelta.y * 0.4)`), ensuring smooth, continuous scrolling on trackpads while matching single-notch mouse wheel steps.
3. **Scrollbar Visibility on Light Themes**:
   - *Risk*: A hardcoded semi-transparent white scrollbar thumb would be invisible against light popup backgrounds.
   - *Mitigation*: The `contentItem` color binds to `root.fg` (active/hovered) and `root.safeMuted` (resting), which are dynamically computed from background luminance (`root.luminance(root.bg)`), guaranteeing high contrast across both dark and light Omarchy themes.

### Open Questions
1. **Scrollbar Policy (`ScrollBar.AsNeeded` vs `ScrollBar.AlwaysOn`)**:
   - *Question*: Should the vertical scrollbar be permanently visible or appear only when content overflows?
   - *Recommendation*: Use `ScrollBar.AsNeeded`. This matches the established Omarchy shell idiom in `/usr/share/omarchy/shell/plugins/agents/Panel.qml` and `Tray.qml`. In the camera widget, the full controls list overflows `implicitHeight: 560`, so the scrollbar will naturally remain visible whenever the camera is connected.
2. **Wheel Interceptor Scope (`flick` vs `sectionsCol`)**:
   - *Question*: Should the wheel interceptor cover the entire `flick` item or specifically `sectionsCol`?
   - *Recommendation*: Anchor the interceptor to `sectionsCol` or use `flick.contentItem`. The `ScrollBar.vertical` sits outside `sectionsCol` on the right edge of `flick`, allowing the scrollbar to handle its own wheel and drag events natively without interference.
