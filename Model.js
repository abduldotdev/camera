// Model.js — Pure JavaScript camera model, control metadata, and CLI command
// builders for Logitech MX Brio and standard UVC video devices.
//
// Dual-environment module: loadable directly in Quickshell QML via:
//   import "Model.js" as Model
// and in Node.js unit tests via require("./Model.js").
//
// Controls are split between standard Linux V4L2 kernel controls (via v4l2-ctl)
// and Logitech vendor Extension Unit (XU) controls such as Field of View (FOV),
// which are managed via cameractrls.

var DEFAULT_DEVICE = "/dev/video0"

var ZOOM_WHEEL_MULTIPLIER = 10

var PREVIEW_STATES = [
  "active",
  "inactive",
  "busy",
  "permission",
  "disconnected",
  "unavailable"
]

var PIXEL_FORMAT = {
  MJPG: 29,
  YUYV: 17,
  NV12: 18
}
var PIXEL_FORMATS = PIXEL_FORMAT

// Comprehensive metadata catalog for all 18 supported camera controls.
// Standard controls map 1:1 to UVC controls queryable via v4l2-ctl.
// Vendor controls (e.g. logitech_brio_fov) specify backend: "cameractrls".
var CONTROLS = {
  brightness: {
    name: "brightness",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 128,
    category: "color"
  },
  contrast: {
    name: "contrast",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 128,
    category: "color"
  },
  saturation: {
    name: "saturation",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 128,
    category: "color"
  },
  sharpness: {
    name: "sharpness",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 128,
    category: "color"
  },
  gain: {
    name: "gain",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 0,
    category: "exposure"
  },
  backlight_compensation: {
    name: "backlight_compensation",
    type: "int",
    min: 0,
    max: 1,
    step: 1,
    defaultVal: 1,
    category: "exposure"
  },
  power_line_frequency: {
    name: "power_line_frequency",
    type: "menu",
    min: 0,
    max: 2,
    defaultVal: 2,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "50 Hz" },
      { value: 2, label: "60 Hz" }
    ],
    category: "utilities"
  },
  white_balance_automatic: {
    name: "white_balance_automatic",
    type: "bool",
    defaultVal: 1,
    category: "color"
  },
  white_balance_temperature: {
    name: "white_balance_temperature",
    type: "int",
    min: 2800,
    max: 7500,
    step: 1,
    defaultVal: 5000,
    category: "color",
    dependsOn: "white_balance_automatic",
    activeWhen: false
  },
  auto_exposure: {
    name: "auto_exposure",
    type: "menu",
    min: 0,
    max: 3,
    defaultVal: 3,
    options: [
      { value: 1, label: "Manual" },
      { value: 3, label: "Aperture Priority" }
    ],
    category: "exposure"
  },
  exposure_time_absolute: {
    name: "exposure_time_absolute",
    type: "int",
    min: 3,
    max: 2047,
    step: 1,
    defaultVal: 156,
    category: "exposure",
    dependsOn: "auto_exposure",
    activeWhen: 1
  },
  exposure_dynamic_framerate: {
    name: "exposure_dynamic_framerate",
    type: "bool",
    defaultVal: 0,
    category: "exposure"
  },
  focus_automatic_continuous: {
    name: "focus_automatic_continuous",
    type: "bool",
    defaultVal: 1,
    category: "optics"
  },
  focus_absolute: {
    name: "focus_absolute",
    type: "int",
    min: 0,
    max: 255,
    step: 1,
    defaultVal: 0,
    category: "optics",
    dependsOn: "focus_automatic_continuous",
    activeWhen: false
  },
  zoom_absolute: {
    name: "zoom_absolute",
    type: "int",
    min: 100,
    max: 400,
    step: 1,
    defaultVal: 100,
    category: "optics"
  },
  pan_absolute: {
    name: "pan_absolute",
    type: "int",
    min: -72000,
    max: 72000,
    step: 3600,
    defaultVal: 0,
    category: "optics"
  },
  tilt_absolute: {
    name: "tilt_absolute",
    type: "int",
    min: -72000,
    max: 72000,
    step: 3600,
    defaultVal: 0,
    category: "optics"
  },
  logitech_brio_fov: {
    name: "logitech_brio_fov",
    type: "menu",
    options: [65, 78, 90],
    defaultVal: 65,
    category: "optics",
    backend: "cameractrls"
  }
}

// Parse stdout from `v4l2-ctl -d <dev> --list-ctrls` or `--list-ctrls-menus`.
// Extracts each control's name, type, value, min/max limits, step, default value,
// inactive state flag, and discrete menu options when present.
function parseV4l2Ctrls(rawText) {
  if (!rawText || typeof rawText !== "string") return {}

  var controls = {}
  var lines = rawText.split(/\r?\n/)
  var currentControl = null

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]

    // Menu option items are listed on following tab-indented lines:
    // "\t\t\t\t0: Disabled"
    var menuMatch = line.match(/^\s*(\d+):\s*(.+)$/)
    if (menuMatch && currentControl) {
      if (!currentControl.menuItems) {
        currentControl.menuItems = []
      }
      currentControl.menuItems.push({
        value: parseInt(menuMatch[1], 10),
        label: menuMatch[2].trim()
      })
      continue
    }

    // Control header lines have the format:
    // " brightness 0x00980900 (int) : min=0 max=255 step=1 default=128 value=128 flags=has-min-max"
    // " power_line_frequency 0x00980918 (menu) : min=0 max=2 default=2 value=1 (50 Hz)"
    // " white_balance_automatic 0x0098090c (bool) : default=1 value=1"
    var ctrlMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s+0x[0-9a-fA-F]+\s+\(([^)]+)\)\s*:\s*(.*)$/)
    if (ctrlMatch) {
      var name = ctrlMatch[1]
      var type = ctrlMatch[2]
      var attrs = ctrlMatch[3]

      var ctrl = {
        name: name,
        type: type,
        inactive: false
      }

      var valMatch = attrs.match(/\bvalue=(-?\d+)/)
      if (valMatch) {
        ctrl.value = parseInt(valMatch[1], 10)
      }

      var minMatch = attrs.match(/\bmin=(-?\d+)/)
      if (minMatch) {
        ctrl.min = parseInt(minMatch[1], 10)
      }

      var maxMatch = attrs.match(/\bmax=(-?\d+)/)
      if (maxMatch) {
        ctrl.max = parseInt(maxMatch[1], 10)
      }

      var stepMatch = attrs.match(/\bstep=(-?\d+)/)
      if (stepMatch) {
        ctrl.step = parseInt(stepMatch[1], 10)
      }

      var defMatch = attrs.match(/\bdefault=(-?\d+)/)
      if (defMatch) {
        var d = parseInt(defMatch[1], 10)
        ctrl.defaultVal = d
        ctrl.default = d
      }

      if (/\bflags=[^:]*\binactive\b/.test(attrs)) {
        ctrl.inactive = true
      }

      if (type === "menu") {
        ctrl.menuItems = []
      }

      controls[name] = ctrl
      currentControl = ctrl
      continue
    }

    // Reset control context on section headers or blank lines
    currentControl = null
  }

  return controls
}

// Parse stdout from `cameractrls -d <dev> -l`.
// Extracts the Logitech vendor FOV setting `logitech_brio_fov = <val>`.
function parseCameractrls(rawText) {
  if (!rawText || typeof rawText !== "string") return {}

  var result = {}
  var match = rawText.match(/^\s*logitech_brio_fov\s*=\s*(-?\d+)/m)
  if (match) {
    result.logitech_brio_fov = parseInt(match[1], 10)
  }
  return result
}

// Parse stdout from `v4l2-ctl -d <dev> --list-formats-ext`.
// Returns array of format objects:
// [{ pixelformat: "MJPG", description: "...", sizes: [{ width: 1920, height: 1080, fps: [30, 24, ...] }] }]
function parseV4l2Formats(rawText) {
  if (!rawText || typeof rawText !== "string") return []

  var formats = []
  var lines = rawText.split(/\r?\n/)
  var currentFormat = null
  var currentSize = null

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]

    var fmtMatch = line.match(/^\s*\[\d+\]:\s*'([^']+)'\s*\(([^)]+)\)/)
    if (fmtMatch) {
      currentFormat = {
        pixelformat: fmtMatch[1],
        description: fmtMatch[2].trim(),
        sizes: []
      }
      formats.push(currentFormat)
      currentSize = null
      continue
    }

    var sizeMatch = line.match(/^\s*Size:\s*Discrete\s+(\d+)x(\d+)/)
    if (sizeMatch && currentFormat) {
      currentSize = {
        width: parseInt(sizeMatch[1], 10),
        height: parseInt(sizeMatch[2], 10),
        fps: []
      }
      currentFormat.sizes.push(currentSize)
      continue
    }

    var fpsMatch = line.match(/^\s*Interval:\s*Discrete\s+[\d.]+s\s+\(([\d.]+)\s*fps\)/)
    if (fpsMatch && currentSize) {
      var fpsVal = parseFloat(fpsMatch[1])
      currentSize.fps.push(fpsVal)
      continue
    }
  }

  return formats
}

// Parse stdout from `v4l2-ctl -d <dev> --get-fmt-video --get-parm`.
// Extracts active capture format and framerate into:
// { width: 1280, height: 720, pixelformat: "MJPG", fps: 30 }
function parseV4l2CaptureMode(rawText) {
  if (!rawText || typeof rawText !== "string") return {}

  var mode = {}

  var whMatch = rawText.match(/Width\/Height\s*:\s*(\d+)\/(\d+)/)
  if (whMatch) {
    mode.width = parseInt(whMatch[1], 10)
    mode.height = parseInt(whMatch[2], 10)
  }

  var pfMatch = rawText.match(/Pixel Format\s*:\s*'([^']+)'/)
  if (pfMatch) {
    mode.pixelformat = pfMatch[1]
  }

  var fpsMatch = rawText.match(/Frames per second\s*:\s*([\d.]+)/)
  if (fpsMatch) {
    mode.fps = parseFloat(fpsMatch[1])
  }

  return mode
}

// Command builder: query active format, streaming parms, and controls in one refresh
function buildV4l2ListCommand(device) {
  return [
    "v4l2-ctl",
    "-d",
    device || DEFAULT_DEVICE,
    "--get-fmt-video",
    "--get-parm",
    "--list-ctrls-menus"
  ]
}

// Command builder: list all supported video formats and frame intervals
function buildV4l2ListFormatsCommand(device) {
  return ["v4l2-ctl", "-d", device || DEFAULT_DEVICE, "--list-formats-ext"]
}

// Command builder: set active video capture resolution, pixel format, and frame rate
function buildV4l2SetCaptureModeCommand(device, mode) {
  var dev = device || DEFAULT_DEVICE
  return [
    "v4l2-ctl",
    "-d",
    dev,
    "--set-fmt-video=width=" + mode.width + ",height=" + mode.height + ",pixelformat=" + mode.pixelformat,
    "--set-parm=" + mode.fps
  ]
}

var PREFERRED_RESOLUTIONS = [
  [3840, 2160],
  [1920, 1080],
  [1280, 720],
  [640, 480]
]

var PREFERRED_FPS = [60, 30, 24, 15]

var RESOLUTION_TAGS = {
  "3840x2160": "4K",
  "1920x1080": "1080p",
  "1280x720": "720p",
  "640x480": "480p"
}

// Returns curated, de-duplicated list of { width, height, pixelformat, value, label }
// offered in the UI. For each distinct size, prefers MJPG when offered, else first format.
// Sorted largest first. By default limits to PREFERRED_RESOLUTIONS plus current size.
function resolutionOptions(formats, current, all) {
  if (!formats || !formats.length) return []

  var includeAll = false
  if (all === true) {
    includeAll = true
  } else if (current === true) {
    includeAll = true
    current = null
  } else if (current && typeof current === "object" && current.all === true) {
    includeAll = true
  }

  var curW = null
  var curH = null
  if (current) {
    if (typeof current === "string") {
      var parts = current.split("x")
      if (parts.length === 2) {
        curW = parseInt(parts[0], 10)
        curH = parseInt(parts[1], 10)
      }
    } else if (typeof current === "object") {
      if (current.width !== undefined && current.height !== undefined) {
        curW = parseInt(current.width, 10)
        curH = parseInt(current.height, 10)
      }
    }
  }

  var sizeMap = {}
  var sizeKeys = []

  for (var f = 0; f < formats.length; f++) {
    var fmt = formats[f]
    var pf = fmt.pixelformat
    var sizes = fmt.sizes || []
    for (var s = 0; s < sizes.length; s++) {
      var sz = sizes[s]
      var key = sz.width + "x" + sz.height
      if (!sizeMap[key]) {
        sizeMap[key] = {
          width: sz.width,
          height: sz.height,
          pfs: {},
          firstPf: pf
        }
        sizeKeys.push(key)
      }
      sizeMap[key].pfs[pf] = true
    }
  }

  var distinctList = []
  for (var k = 0; k < sizeKeys.length; k++) {
    var item = sizeMap[sizeKeys[k]]
    var chosenPf = item.pfs["MJPG"] ? "MJPG" : item.firstPf
    distinctList.push({
      width: item.width,
      height: item.height,
      pixelformat: chosenPf
    })
  }

  distinctList.sort(function(a, b) {
    var areaA = a.width * a.height
    var areaB = b.width * b.height
    if (areaB !== areaA) return areaB - areaA
    return b.width - a.width
  })

  var preferredMap = {}
  for (var p = 0; p < PREFERRED_RESOLUTIONS.length; p++) {
    var pref = PREFERRED_RESOLUTIONS[p]
    preferredMap[pref[0] + "x" + pref[1]] = true
  }

  var filtered = []
  for (var i = 0; i < distinctList.length; i++) {
    var res = distinctList[i]
    var resKey = res.width + "x" + res.height
    var isPreferred = !!preferredMap[resKey]
    var isCurrent = (curW !== null && curH !== null && res.width === curW && res.height === curH)

    if (includeAll || isPreferred || isCurrent) {
      filtered.push({
        width: res.width,
        height: res.height,
        pixelformat: res.pixelformat,
        value: resKey,
        label: RESOLUTION_TAGS[resKey] || (res.width + "×" + res.height)
      })
    }
  }

  return filtered
}

// Returns descending frame rate options for that exact size and format.
// By default filters to PREFERRED_FPS plus current fps if offered.
// Each option provides { fps: number, value: string, label: string } with bare number labels.
function fpsOptions(formats, width, height, pixelformat, current, all) {
  if (!formats || !formats.length || !width || !height) return []

  var includeAll = false
  if (all === true) {
    includeAll = true
  } else if (current === true) {
    includeAll = true
    current = null
  } else if (current && typeof current === "object" && current.all === true) {
    includeAll = true
  }

  var curFps = null
  if (current !== null && current !== undefined && current !== "") {
    if (typeof current === "number") {
      curFps = current
    } else if (typeof current === "object" && current.fps !== undefined) {
      curFps = parseFloat(current.fps)
    } else {
      var parsed = parseFloat(current)
      if (!isNaN(parsed)) {
        curFps = parsed
      }
    }
  }

  var w = parseInt(width, 10)
  var h = parseInt(height, 10)
  var targetPf = pixelformat || null

  var matchedFormat = null
  if (targetPf) {
    for (var i = 0; i < formats.length; i++) {
      if (formats[i].pixelformat === targetPf) {
        matchedFormat = formats[i]
        break
      }
    }
  }

  if (!matchedFormat) {
    for (var j = 0; j < formats.length; j++) {
      if (formats[j].pixelformat === "MJPG") {
        for (var s = 0; s < (formats[j].sizes || []).length; s++) {
          if (formats[j].sizes[s].width === w && formats[j].sizes[s].height === h) {
            matchedFormat = formats[j]
            break
          }
        }
      }
      if (matchedFormat) break
    }
  }
  if (!matchedFormat) {
    for (var k = 0; k < formats.length; k++) {
      for (var s2 = 0; s2 < (formats[k].sizes || []).length; s2++) {
        if (formats[k].sizes[s2].width === w && formats[k].sizes[s2].height === h) {
          matchedFormat = formats[k]
          break
        }
      }
      if (matchedFormat) break
    }
  }

  if (!matchedFormat) return []

  var matchedSize = null
  for (var m = 0; m < (matchedFormat.sizes || []).length; m++) {
    if (matchedFormat.sizes[m].width === w && matchedFormat.sizes[m].height === h) {
      matchedSize = matchedFormat.sizes[m]
      break
    }
  }

  if (!matchedSize || !matchedSize.fps) return []

  var fpsCopy = matchedSize.fps.slice().sort(function(a, b) {
    return b - a
  })

  var preferredMap = {}
  for (var p = 0; p < PREFERRED_FPS.length; p++) {
    preferredMap[PREFERRED_FPS[p]] = true
  }

  var options = []
  for (var n = 0; n < fpsCopy.length; n++) {
    var val = fpsCopy[n]
    var isPreferred = !!preferredMap[val]
    var isCurrent = (curFps !== null && val === curFps)

    if (includeAll || isPreferred || isCurrent) {
      options.push({
        fps: val,
        value: String(val),
        label: String(val)
      })
    }
  }

  return options
}

// Pure resolver: picks pixelformat (keep current if offered, else MJPG, else first)
// and clamps fps to the nearest available for that size (exact match preferred).
// Returns { width, height, pixelformat, fps } or null if size is not enumerated.
function pickCaptureMode(formats, current, width, height, fps) {
  if (!formats || !formats.length || width === undefined || height === undefined) return null

  var w = parseInt(width, 10)
  var h = parseInt(height, 10)
  if (isNaN(w) || isNaN(h)) return null

  var formatsOfferingSize = {}
  var firstOfferingPf = null
  for (var f = 0; f < formats.length; f++) {
    var fmt = formats[f]
    var sizes = fmt.sizes || []
    for (var s = 0; s < sizes.length; s++) {
      if (sizes[s].width === w && sizes[s].height === h) {
        formatsOfferingSize[fmt.pixelformat] = sizes[s]
        if (!firstOfferingPf) {
          firstOfferingPf = fmt.pixelformat
        }
        break
      }
    }
  }

  if (!firstOfferingPf) return null

  var chosenPf = null
  if (current && current.pixelformat && formatsOfferingSize[current.pixelformat]) {
    chosenPf = current.pixelformat
  } else if (formatsOfferingSize["MJPG"]) {
    chosenPf = "MJPG"
  } else {
    chosenPf = firstOfferingPf
  }

  var sizeEntry = formatsOfferingSize[chosenPf]
  var availableFps = (sizeEntry && sizeEntry.fps) ? sizeEntry.fps : []
  if (!availableFps.length) {
    return { width: w, height: h, pixelformat: chosenPf, fps: 30 }
  }

  var targetFps = undefined
  if (fps !== undefined && fps !== null && fps !== "") {
    targetFps = parseFloat(fps)
  } else if (current && current.fps !== undefined && current.fps !== null) {
    targetFps = parseFloat(current.fps)
  } else {
    targetFps = 30
  }

  var chosenFps = availableFps[0]
  var minDiff = Math.abs(chosenFps - targetFps)

  for (var i = 0; i < availableFps.length; i++) {
    var candidate = availableFps[i]
    if (candidate === targetFps) {
      chosenFps = candidate
      break
    }
    var diff = Math.abs(candidate - targetFps)
    if (diff < minDiff) {
      minDiff = diff
      chosenFps = candidate
    }
  }

  return {
    width: w,
    height: h,
    pixelformat: chosenPf,
    fps: chosenFps
  }
}

// Command builder: query a single V4L2 control value
function buildV4l2GetCommand(device, controlName) {
  return ["v4l2-ctl", "-d", device || DEFAULT_DEVICE, "--get-ctrl", controlName]
}

// Command builder: set a single V4L2 control value
function buildV4l2SetCommand(device, controlName, value) {
  return ["v4l2-ctl", "-d", device || DEFAULT_DEVICE, "--set-ctrl", controlName + "=" + value]
}

// Command builder: query cameractrls controls
function buildFovListCommand(device) {
  return ["cameractrls", "-d", device || DEFAULT_DEVICE, "-l"]
}

// Command builder: set Logitech MX Brio field of view (65, 78, or 90)
function buildFovSetCommand(device, fov) {
  return ["cameractrls", "-d", device || DEFAULT_DEVICE, "-c", "logitech_brio_fov=" + fov]
}

// Returns a key-value dictionary of default values for all 18 controls
function getDefaults() {
  var defaults = {}
  for (var name in CONTROLS) {
    if (CONTROLS.hasOwnProperty(name)) {
      defaults[name] = CONTROLS[name].defaultVal
    }
  }
  return defaults
}

// Builds CLI commands required to restore factory defaults for all controls.
// Returns an ordered array of command arrays:
// 1. Switch parent controls to manual so dependent controls become active.
// 2. Set dependent controls (white_balance_temperature, exposure_time_absolute, focus_absolute) to defaults.
// 3. Set all remaining standard V4L2 controls to defaults (including parent controls back to auto defaults).
// 4. Reset cameractrls vendor FOV to default (65).
function buildResetCommands(device) {
  var dev = device || DEFAULT_DEVICE

  // 1. Switch three parent controls to manual
  var parentManualCmd = [
    "v4l2-ctl", "-d", dev, "--set-ctrl",
    "white_balance_automatic=0,auto_exposure=1,focus_automatic_continuous=0"
  ]

  // 2. Set three dependent controls to their defaults while parents are manual
  var dependentDefaults = [
    "white_balance_temperature=" + CONTROLS.white_balance_temperature.defaultVal,
    "exposure_time_absolute=" + CONTROLS.exposure_time_absolute.defaultVal,
    "focus_absolute=" + CONTROLS.focus_absolute.defaultVal
  ]
  var dependentCmd = [
    "v4l2-ctl", "-d", dev, "--set-ctrl", dependentDefaults.join(",")
  ]

  // 3. Set remaining standard controls to defaults, including parents back to auto
  var dependentNames = {
    white_balance_temperature: true,
    exposure_time_absolute: true,
    focus_absolute: true
  }
  var remainingPairs = []
  for (var name in CONTROLS) {
    if (CONTROLS.hasOwnProperty(name)) {
      var ctrl = CONTROLS[name]
      if (ctrl.backend !== "cameractrls" && !dependentNames[name]) {
        remainingPairs.push(name + "=" + ctrl.defaultVal)
      }
    }
  }
  var remainingCmd = [
    "v4l2-ctl", "-d", dev, "--set-ctrl", remainingPairs.join(",")
  ]

  // 4. Reset cameractrls vendor FOV
  var fovCmd = [
    "cameractrls", "-d", dev, "-c", "logitech_brio_fov=" + CONTROLS.logitech_brio_fov.defaultVal
  ]

  return [parentManualCmd, dependentCmd, remainingCmd, fovCmd]
}

// Evaluates whether a control is currently active (editable) based on its
// dependency relationships (e.g. manual sliders disabled when auto mode is on).
function isControlActive(controlName, currentValues) {
  var ctrl = CONTROLS[controlName]
  if (!ctrl || !ctrl.dependsOn) return true

  var depVal = undefined
  if (currentValues && (ctrl.dependsOn in currentValues)) {
    var raw = currentValues[ctrl.dependsOn]
    if (raw !== null && typeof raw === "object" && raw.value !== undefined) {
      depVal = raw.value
    } else {
      depVal = raw
    }
  } else if (CONTROLS[ctrl.dependsOn] && CONTROLS[ctrl.dependsOn].defaultVal !== undefined) {
    depVal = CONTROLS[ctrl.dependsOn].defaultVal
  }

  if (ctrl.activeWhen === false) {
    return !depVal || depVal === 0 || depVal === "0" || depVal === false
  }
  if (ctrl.activeWhen === true) {
    return !!depVal && depVal !== 0 && depVal !== "0" && depVal !== false
  }
  return depVal == ctrl.activeWhen
}

// Step helper for mouse-wheel increments with clamping.
function wheelStep(value, angleDeltaY, step, multiplier, min, max) {
  var val = (value !== undefined && value !== null) ? Number(value) : 0
  var s = (step !== undefined && step !== null) ? Number(step) : 1
  var m = (multiplier !== undefined && multiplier !== null) ? Number(multiplier) : 1
  var dir = angleDeltaY > 0 ? 1 : (angleDeltaY < 0 ? -1 : 0)
  var next = val + (dir * s * m)
  if (min !== undefined && min !== null) {
    next = Math.max(Number(min), next)
  }
  if (max !== undefined && max !== null) {
    next = Math.min(Number(max), next)
  }
  return next
}

function _getFmtWidth(f) {
  if (!f) return 0
  if (typeof f.width === "number") return f.width
  if (f.resolution && typeof f.resolution.width === "number") return f.resolution.width
  return 0
}

function _getFmtHeight(f) {
  if (!f) return 0
  if (typeof f.height === "number") return f.height
  if (f.resolution && typeof f.resolution.height === "number") return f.resolution.height
  return 0
}

function _resolvePixelFormatInt(mode) {
  if (!mode) return null
  var pf = mode.pixelFormat !== undefined ? mode.pixelFormat : mode.pixelformat
  if (typeof pf === "number") return pf
  if (typeof pf === "string" && PIXEL_FORMAT[pf.toUpperCase()] !== undefined) {
    return PIXEL_FORMAT[pf.toUpperCase()]
  }
  return null
}

// Selects the videoFormats entry matching root.captureMode width/height/pixelformat
// and whose fps range contains captureMode.fps; falls back to resolution+pixelformat,
// then resolution only; leaves unset (returns null) if no match.
function pickCameraFormat(formats, captureMode) {
  if (!formats || !formats.length || !captureMode) return null

  var targetW = captureMode.width !== undefined ? Number(captureMode.width) : null
  var targetH = captureMode.height !== undefined ? Number(captureMode.height) : null
  if (!targetW || !targetH) return null

  var targetPf = _resolvePixelFormatInt(captureMode)
  var targetFps = (captureMode.fps !== undefined && captureMode.fps !== null && captureMode.fps !== "")
    ? Number(captureMode.fps)
    : null

  // Tier 1: resolution + pixelformat matching and fps range contains captureMode.fps
  for (var i = 0; i < formats.length; i++) {
    var f = formats[i]
    if (_getFmtWidth(f) === targetW && _getFmtHeight(f) === targetH) {
      var pfMatch = (targetPf !== null) ? (f.pixelFormat === targetPf) : true
      if (pfMatch) {
        if (targetFps !== null) {
          var minFps = (f.minFrameRate !== undefined) ? Number(f.minFrameRate) : 0
          var maxFps = (f.maxFrameRate !== undefined) ? Number(f.maxFrameRate) : Infinity
          if (targetFps >= minFps && targetFps <= maxFps) {
            return f
          }
        } else {
          return f
        }
      }
    }
  }

  // Tier 2: resolution + pixelformat fallback
  if (targetPf !== null) {
    for (var j = 0; j < formats.length; j++) {
      var f2 = formats[j]
      if (_getFmtWidth(f2) === targetW && _getFmtHeight(f2) === targetH && f2.pixelFormat === targetPf) {
        return f2
      }
    }
  }

  // Tier 3: resolution only fallback
  for (var k = 0; k < formats.length; k++) {
    var f3 = formats[k]
    if (_getFmtWidth(f3) === targetW && _getFmtHeight(f3) === targetH) {
      return f3
    }
  }

  // Tier 4: no match
  return null
}

// Export for Node.js test environment (in QML, top-level functions and vars
// are directly accessible via import namespace).
if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_DEVICE: DEFAULT_DEVICE,
    CONTROLS: CONTROLS,
    ZOOM_WHEEL_MULTIPLIER: ZOOM_WHEEL_MULTIPLIER,
    PREVIEW_STATES: PREVIEW_STATES,
    PIXEL_FORMAT: PIXEL_FORMAT,
    PIXEL_FORMATS: PIXEL_FORMAT,
    PREFERRED_RESOLUTIONS: PREFERRED_RESOLUTIONS,
    PREFERRED_FPS: PREFERRED_FPS,
    RESOLUTION_TAGS: RESOLUTION_TAGS,
    parseV4l2Ctrls: parseV4l2Ctrls,
    parseCameractrls: parseCameractrls,
    parseV4l2Formats: parseV4l2Formats,
    parseV4l2CaptureMode: parseV4l2CaptureMode,
    buildV4l2ListCommand: buildV4l2ListCommand,
    buildV4l2ListFormatsCommand: buildV4l2ListFormatsCommand,
    buildV4l2SetCaptureModeCommand: buildV4l2SetCaptureModeCommand,
    buildV4l2GetCommand: buildV4l2GetCommand,
    buildV4l2SetCommand: buildV4l2SetCommand,
    buildFovListCommand: buildFovListCommand,
    buildFovSetCommand: buildFovSetCommand,
    getDefaults: getDefaults,
    buildResetCommands: buildResetCommands,
    isControlActive: isControlActive,
    resolutionOptions: resolutionOptions,
    fpsOptions: fpsOptions,
    pickCaptureMode: pickCaptureMode,
    wheelStep: wheelStep,
    pickCameraFormat: pickCameraFormat
  }
}
