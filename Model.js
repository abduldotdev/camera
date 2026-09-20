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

// Command builder: query all standard V4L2 controls and menus
function buildV4l2ListCommand(device) {
  return ["v4l2-ctl", "-d", device || DEFAULT_DEVICE, "--list-ctrls-menus"]
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

// Export for Node.js test environment (in QML, top-level functions and vars
// are directly accessible via import namespace).
if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_DEVICE: DEFAULT_DEVICE,
    CONTROLS: CONTROLS,
    parseV4l2Ctrls: parseV4l2Ctrls,
    parseCameractrls: parseCameractrls,
    buildV4l2ListCommand: buildV4l2ListCommand,
    buildV4l2GetCommand: buildV4l2GetCommand,
    buildV4l2SetCommand: buildV4l2SetCommand,
    buildFovListCommand: buildFovListCommand,
    buildFovSetCommand: buildFovSetCommand,
    getDefaults: getDefaults,
    buildResetCommands: buildResetCommands,
    isControlActive: isControlActive
  }
}
