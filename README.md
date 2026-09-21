# abdul891.camera

Native `omarchy-shell` bar widget and settings popup providing Logi Tune-like controls for Logitech webcams on Linux, specifically optimized for the Logitech MX Brio (`046d:0944`).

## Features

- **Bar Widget Integration**: Compact camera icon in the Omarchy bar displaying connection status (dimmed when `/dev/video0` is disconnected).
- **Fast & Stateless**: Communicates with hardware via non-blocking asynchronous `v4l2-ctl` and `cameractrls` calls. No background daemons and no open video streams.
- **Categorized Settings Popup**:
  - **Framing & Optics**: Hardware Field of View (FOV) selection (65°, 78°, 90°), Digital Zoom (100%–400%), and Pan & Tilt sliders with step buttons.
  - **Capture Mode**: Resolution (1080p, 720p, 480p) and frame rate selection (up to 60 fps) to configure Linux kernel driver capture defaults.
  - **Focus**: Continuous autofocus toggle and manual focus distance slider (active only when autofocus is off).
  - **Exposure**: Auto-exposure mode toggle (Aperture Priority vs Manual), manual exposure time slider (active only in manual mode), low-light compensation (dynamic framerate), and sensor gain slider.
  - **Color & Image**: Auto white balance toggle, color temperature slider (2800K–7500K, active only when AWB is off), brightness, contrast, saturation, and sharpness sliders.
  - **Utilities**: Anti-flicker power line frequency selection (Off, 50 Hz, 60 Hz) and backlight compensation toggle.
- **Factory Reset**: One-click "Reset defaults" button restores all controls to factory defaults.
- **Graceful Disconnected View**: Displays a clear "No camera connected" message and retry button when the camera is unplugged.
- **Full IPC Support**: Control any setting via `qs ipc call abdul891.camera ...` from scripts, keybindings, or other shell tools.

## Prerequisites

- **`v4l-utils`** (`v4l2-ctl`): **Required**. Provides direct Linux kernel V4L2 ioctl control.
  ```bash
  sudo pacman -S v4l-utils
  ```
- **`cameractrls`**: **Optional**. Required for Logitech vendor Extension Unit (XU) Field of View (FOV: 65°/78°/90°) adjustments. If `cameractrls` is not installed, the FOV section is cleanly omitted while all other standard UVC controls remain fully operational.
  ```bash
  sudo pacman -S cameractrls
  ```
- **`shellcheck`**: **Optional prerequisite**. Only required if `.sh` shell scripts are introduced to the repository. The plugin itself uses pure JavaScript (`Model.js`) and QML, so no shell scripts are included by default.
  ```bash
  sudo pacman -S shellcheck
  ```

## Installation

From the root of the `omarchy-plugins` repository, run:

```bash
./link.sh
```

`link.sh` scans for any directory containing `manifest.json` and creates a symlink under `~/.config/omarchy/plugins/abdul891.camera`. The shell will automatically load the bar widget.

## Capture Mode (Resolution & Frame Rate)

The plugin allows viewing the active capture mode and configuring the driver's default capture resolution and frame rate via `v4l2-ctl --set-fmt-video` and `--set-parm`.

### Behaviour & Limitations

- **Persistent Driver Default**: The configured capture mode persists in the `uvcvideo` kernel driver across process opens. It serves as the initial default for non-negotiating V4L2 tools and applications (e.g. `v4l2-ctl --stream-mmap`, `mpv av://v4l2:/dev/video0` without size arguments, or cameractrls preview).
- **Exclusive Streaming Lock (`EBUSY`)**: Capture format and frame rate cannot be modified while any process is streaming video from `/dev/video0`. Attempting to set resolution or framerate while streaming returns `EBUSY` (`Device or resource busy`), and the popup indicates that the camera is currently in use.
- **Negotiating Applications Override Mode**: Video conferencing applications, browsers, and streaming pipelines (such as Google Meet, Zoom, OBS Studio, ffmpeg, GStreamer, and PipeWire camera portal clients) negotiate their own resolution and framerate per stream upon opening the device. The plugin's default does not constrain negotiating apps; however, the popup actively displays whatever mode the streaming app negotiated.
- **USB Link Speed & 4K Availability**: 4K resolution (3840×2160) requires a USB 3 link. Over a USB 2.0 link (480 Mbps), the camera hardware enumerates modes up to 1920×1080 @ 30 fps or 1600×896 @ 60 fps in MJPG.

## Controls Inventory

The plugin manages 18 distinct camera controls:

| Category | Control Name | Type | Range / Options | Default | Backend | Notes |
|---|---|---|---|---|---|---|
| **Framing & Optics** | `logitech_brio_fov` | Menu | 65°, 78°, 90° | 65° | `cameractrls` | Logitech vendor XU control. Hidden if `cameractrls` absent. |
| | `zoom_absolute` | Integer | 100 .. 400 | 100 | `v4l2-ctl` | Digital zoom (100 = 1x, 400 = 4x). |
| | `pan_absolute` | Integer | -72000 .. 72000 | 0 | `v4l2-ctl` | Stepping: 3600. Active during digital crop/zoom. |
| | `tilt_absolute` | Integer | -72000 .. 72000 | 0 | `v4l2-ctl` | Stepping: 3600. Active during digital crop/zoom. |
| **Focus** | `focus_automatic_continuous` | Boolean | 0 (Off), 1 (On) | 1 | `v4l2-ctl` | Continuous autofocus toggle. |
| | `focus_absolute` | Integer | 0 .. 255 | 0 | `v4l2-ctl` | Manual focus distance. Disabled when autofocus is enabled. |
| **Exposure** | `auto_exposure` | Menu | 1 (Manual), 3 (Auto) | 3 | `v4l2-ctl` | 3 = Aperture Priority (Auto), 1 = Manual Mode. |
| | `exposure_time_absolute` | Integer | 3 .. 2047 | 156 | `v4l2-ctl` | Manual exposure time (100 µs units). Disabled when auto-exposure is on. |
| | `exposure_dynamic_framerate` | Boolean | 0 (Off), 1 (On) | 0 | `v4l2-ctl` | Allows camera to reduce framerate in low-light environments. |
| | `gain` | Integer | 0 .. 255 | 0 | `v4l2-ctl` | Sensor analogue/digital gain (ISO sensitivity). |
| **Color & Image** | `white_balance_automatic` | Boolean | 0 (Off), 1 (On) | 1 | `v4l2-ctl` | Auto white balance toggle. |
| | `white_balance_temperature` | Integer | 2800 .. 7500 | 5000 | `v4l2-ctl` | Color temperature in Kelvin. Disabled when auto white balance is on. |
| | `brightness` | Integer | 0 .. 255 | 128 | `v4l2-ctl` | Image brightness offset. |
| | `contrast` | Integer | 0 .. 255 | 128 | `v4l2-ctl` | Image contrast curve. |
| | `saturation` | Integer | 0 .. 255 | 128 | `v4l2-ctl` | Image chroma saturation. |
| | `sharpness` | Integer | 0 .. 255 | 128 | `v4l2-ctl` | Image edge sharpness filtering. |
| **Utilities** | `power_line_frequency` | Menu | 0 (Off), 1 (50 Hz), 2 (60 Hz) | 2 (60 Hz) | `v4l2-ctl` | Anti-flicker filter matching local AC mains power frequency. |
| | `backlight_compensation` | Integer | 0 (Off), 1 (On) | 1 | `v4l2-ctl` | Backlight shadow reduction. |

## Logi Tune Feature Support on Linux

| Feature | Supported? | Status & Technical Explanation |
|---|---|---|
| **Field of View (FOV: 65°/78°/90°)** | **Yes** | Fully supported via Logitech UVC Extension Unit (XU) through `cameractrls`. |
| **Digital Zoom (1x–4x)** | **Yes** | Fully supported via standard UVC camera control `zoom_absolute`. |
| **Pan & Tilt** | **Yes** | Fully supported via standard UVC camera controls `pan_absolute` and `tilt_absolute`. |
| **Autofocus & Manual Focus** | **Yes** | Fully supported via standard UVC controls `focus_automatic_continuous` and `focus_absolute`. |
| **Auto Exposure & Manual Shutter** | **Yes** | Fully supported via standard UVC controls `auto_exposure` and `exposure_time_absolute`. |
| **Sensor Gain (ISO)** | **Yes** | Fully supported via standard UVC control `gain`. |
| **Auto White Balance & Temperature** | **Yes** | Fully supported via standard UVC controls `white_balance_automatic` and `white_balance_temperature`. |
| **Image Tuning (Brightness/Contrast/etc.)** | **Yes** | Fully supported via standard UVC controls `brightness`, `contrast`, `saturation`, `sharpness`. |
| **Anti-flicker (50/60 Hz)** | **Yes** | Fully supported via standard UVC control `power_line_frequency`. |
| **Factory Reset** | **Yes** | Fully supported by applying default hardware values. |
| **Resolution & Frame Rate** | **Partial** | Driver default resolution and frame rate can be configured when idle; apps that negotiate per-stream (browsers, Zoom, PipeWire) override it, and settings cannot be changed while streaming (EBUSY). 4K requires a USB 3 link. |
| **HDR (High Dynamic Range)** | **No** | **Impossible on Linux**. MX Brio HDR processing is controlled via closed-source vendor firmware commands not exposed to the Linux UVC driver or reverse-engineered in open-source tools. |
| **RightSight AI Auto-Framing** | **No** | **Impossible on Linux**. RightSight is a proprietary software neural network running on the host machine inside the Logi Tune app on macOS/Windows; it is not camera hardware. |
| **Show Mode (Desk Tracking)** | **No** | **Impossible on Linux**. Show Mode relies on proprietary host software running computer vision on the video feed to detect when the camera tilts down toward a desk. |
| **Logitech Firmware Updates** | **No** | **Impossible on Linux**. Logitech firmware distribution uses proprietary encrypted USB transport. MX Brio is not supported by `fwupd` / Linux Vendor Firmware Service (LVFS). |
| **Live In-Bar Video Viewfinder** | *Omitted* | **Intentionally Out of Scope**. Opening the video stream (`/dev/video0`) inside the bar widget would acquire an exclusive V4L2 streaming lock, preventing video conferencing software (Zoom, Teams, Google Meet) from accessing the camera. |

## IPC Interface Contract

The widget exposes an `IpcHandler` with target `"abdul891.camera"`. You can interact with it via `qs ipc call`:

```bash
# Open the camera settings popup
qs ipc call abdul891.camera open

# Close the camera settings popup
qs ipc call abdul891.camera close

# Toggle the camera settings popup
qs ipc call abdul891.camera toggle

# Reset all camera controls to factory defaults
qs ipc call abdul891.camera resetDefaults

# Query the current value of a control
qs ipc call abdul891.camera getCtrl brightness
# Output: 128

qs ipc call abdul891.camera getCtrl logitech_brio_fov
# Output: 65

# Set a control value
qs ipc call abdul891.camera setCtrl brightness 150
qs ipc call abdul891.camera setCtrl white_balance_automatic 0
qs ipc call abdul891.camera setCtrl white_balance_temperature 4500
qs ipc call abdul891.camera setCtrl logitech_brio_fov 78

# Query current capture mode (resolution, fps, pixelformat)
qs ipc call abdul891.camera getCaptureMode
# Output: 1280x720@30 MJPG

# Set capture mode (resolution WxH, and optional fps)
qs ipc call abdul891.camera setCaptureMode 1920x1080 30
qs ipc call abdul891.camera setCaptureMode 1280x720 60
```

## Testing

The plugin includes two test suites located in `tests/`:

1. **Model & Parser Unit Tests** (offline):
   Validates V4L2 and cameractrls CLI output parsing, control metadata definitions, command builders, dependency rules, and factory defaults without requiring camera hardware.
   ```bash
   node tests/model.test.js
   # or from repository root:
   node abdul891.camera/tests/model.test.js
   ```

2. **Live Hardware Verification Test** (requires `/dev/video0`):
   Performs live round-trip mutation and restoration tests across all 18 supported camera controls against the physical Logitech MX Brio webcam. For each control, it records the current value, sets a different valid value, asserts hardware state change, restores original settings, and verifies factory reset behaviour. Skips cleanly if `/dev/video0` is absent.
   ```bash
   node tests/hardware.test.js
   # or from repository root:
   node abdul891.camera/tests/hardware.test.js
   ```

