const assert = require("node:assert/strict")
const Model = require("../Model.js")

// ---------------------------------------------------------------------------
// Real hardware output fixtures from sup-1 probe (Logitech MX Brio on /dev/video0)
// ---------------------------------------------------------------------------

const V4L2_FIXTURE = `
User Controls

                     brightness 0x00980900 (int)    : min=0 max=255 step=1 default=128 value=128 flags=has-min-max
                       contrast 0x00980901 (int)    : min=0 max=255 step=1 default=128 value=127 flags=has-min-max
                     saturation 0x00980902 (int)    : min=0 max=255 step=1 default=128 value=137 flags=has-min-max
        white_balance_automatic 0x0098090c (bool)   : default=1 value=1
                           gain 0x00980913 (int)    : min=0 max=255 step=1 default=0 value=0 flags=has-min-max
           power_line_frequency 0x00980918 (menu)   : min=0 max=2 default=2 value=1 (50 Hz)
				0: Disabled
				1: 50 Hz
				2: 60 Hz
      white_balance_temperature 0x0098091a (int)    : min=2800 max=7500 step=1 default=5000 value=3997 flags=inactive, has-min-max
                      sharpness 0x0098091b (int)    : min=0 max=255 step=1 default=128 value=128 flags=has-min-max
         backlight_compensation 0x0098091c (int)    : min=0 max=1 step=1 default=1 value=1 flags=has-min-max

Camera Controls

                  auto_exposure 0x009a0901 (menu)   : min=0 max=3 default=3 value=3 (Aperture Priority Mode)
				1: Manual Mode
				3: Aperture Priority Mode
         exposure_time_absolute 0x009a0902 (int)    : min=3 max=2047 step=1 default=156 value=625 flags=inactive, has-min-max
     exposure_dynamic_framerate 0x009a0903 (bool)   : default=0 value=0
                   pan_absolute 0x009a0908 (int)    : min=-72000 max=72000 step=3600 default=0 value=-21600 flags=has-min-max
                  tilt_absolute 0x009a0909 (int)    : min=-72000 max=72000 step=3600 default=0 value=50400 flags=has-min-max
                 focus_absolute 0x009a090a (int)    : min=0 max=255 step=1 default=0 value=20 flags=inactive, has-min-max
     focus_automatic_continuous 0x009a090c (bool)   : default=1 value=1
                  zoom_absolute 0x009a090d (int)    : min=100 max=400 step=1 default=100 value=152 flags=has-min-max
`

const CAMERACTRLS_FIXTURE = `Basic / Crop
 logitech_brio_fov = 65	( values: 65, 78, 90 )
 zoom_absolute = 152	( default: 100 min: 100 max: 400 )
 pan_absolute = -21600	( default: 0 min: -72000 max: 72000 step: 3600 )
 tilt_absolute = 50400	( default: 0 min: -72000 max: 72000 step: 3600 )
Basic / Focus
 focus_automatic_continuous = 1	( default: 1 min: 0 max: 1 )
 focus_absolute = 20	( default: 0 min: 0 max: 255 ) | inactive
Exposure / Exposure
 auto_exposure = aperture_priority_mode	( default: aperture_priority_mode values: manual_mode, aperture_priority_mode )
 exposure_time_absolute = 625	( default: 156 min: 3 max: 2047 ) | inactive
 exposure_dynamic_framerate = 0	( default: 0 min: 0 max: 1 )
 gain = 0	( default: 0 min: 0 max: 255 )
Exposure / Dynamic Range
 backlight_compensation = 1	( default: 1 min: 0 max: 1 )
Color / Color Preset
 color_preset		( buttons: default, blossom, bright, film, forest, glaze, gray, vibrant, vivid )
Color / Balance
 white_balance_automatic = 1	( default: 1 min: 0 max: 1 )
 white_balance_temperature = 3997	( default: 5000 min: 2800 max: 7500 ) | inactive
Color / Color
 brightness = 128	( default: 128 min: 0 max: 255 )
 contrast = 127	( default: 128 min: 0 max: 255 )
 saturation = 137	( default: 128 min: 0 max: 255 )
 sharpness = 128	( default: 128 min: 0 max: 255 )
Advanced / Power Line
 power_line_frequency = 50_hz	( default: 60_hz values: disabled, 50_hz, 60_hz )
Advanced / Cameractrlsd
 systemd_cameractrlsd = False	( default: None min: None max: None )
Capture / Capture
 pixelformat = NV12	( values: YUYV, MJPG, NV12 )
 resolution = 640x480	( values: 640x480, 640x360 )
 fps = 30	( values: 30, 24, 20, 15, 10, 7.5, 5 )
Capture / Info
 card = MX Brio
 driver = uvcvideo
 path = /dev/video0
 real_path = /dev/video0
Settings / Save
 preset		( buttons: load_1, load_2, load_3, load_4, save_1, save_2, save_3, save_4 )
`

const V4L2_COMBINED_FIXTURE = `Format Video Capture:
	Width/Height      : 1280/720
	Pixel Format      : 'MJPG' (Motion-JPEG)
	Field             : None
	Bytes per Line    : 0
	Size Image        : 529066
	Colorspace        : sRGB
	Transfer Function : Rec. 709
	YCbCr/HSV Encoding: ITU-R 601
	Quantization      : Default (maps to Full Range)
	Flags             : 
Streaming Parameters Video Capture:
	Capabilities     : timeperframe
	Frames per second: 30.000 (30/1)
	Read buffers     : 0

User Controls

                     brightness 0x00980900 (int)    : min=0 max=255 step=1 default=128 value=128 flags=has-min-max
                       contrast 0x00980901 (int)    : min=0 max=255 step=1 default=128 value=127 flags=has-min-max
                     saturation 0x00980902 (int)    : min=0 max=255 step=1 default=128 value=137 flags=has-min-max
        white_balance_automatic 0x0098090c (bool)   : default=1 value=1
                           gain 0x00980913 (int)    : min=0 max=255 step=1 default=0 value=0 flags=has-min-max
           power_line_frequency 0x00980918 (menu)   : min=0 max=2 default=2 value=1 (50 Hz)
				0: Disabled
				1: 50 Hz
				2: 60 Hz
      white_balance_temperature 0x0098091a (int)    : min=2800 max=7500 step=1 default=5000 value=3997 flags=inactive, has-min-max
                      sharpness 0x0098091b (int)    : min=0 max=255 step=1 default=128 value=128 flags=has-min-max
         backlight_compensation 0x0098091c (int)    : min=0 max=1 step=1 default=1 value=1 flags=has-min-max

Camera Controls

                  auto_exposure 0x009a0901 (menu)   : min=0 max=3 default=3 value=3 (Aperture Priority Mode)
				1: Manual Mode
				3: Aperture Priority Mode
         exposure_time_absolute 0x009a0902 (int)    : min=3 max=2047 step=1 default=156 value=625 flags=inactive, has-min-max
     exposure_dynamic_framerate 0x009a0903 (bool)   : default=0 value=0
                   pan_absolute 0x009a0908 (int)    : min=-72000 max=72000 step=3600 default=0 value=-21600 flags=has-min-max
                  tilt_absolute 0x009a0909 (int)    : min=-72000 max=72000 step=3600 default=0 value=50400 flags=has-min-max
                 focus_absolute 0x009a090a (int)    : min=0 max=255 step=1 default=0 value=20 flags=inactive, has-min-max
     focus_automatic_continuous 0x009a090c (bool)   : default=1 value=1
                  zoom_absolute 0x009a090d (int)    : min=100 max=400 step=1 default=100 value=152 flags=has-min-max
`

const V4L2_FORMATS_FIXTURE = `ioctl: VIDIOC_ENUM_FMT
	Type: Video Capture

	[0]: 'YUYV' (YUYV 4:2:2)
		Size: Discrete 640x480
			Interval: Discrete 0.033s (30.000 fps)
			Interval: Discrete 0.042s (24.000 fps)
			Interval: Discrete 0.050s (20.000 fps)
			Interval: Discrete 0.067s (15.000 fps)
			Interval: Discrete 0.100s (10.000 fps)
			Interval: Discrete 0.133s (7.500 fps)
			Interval: Discrete 0.200s (5.000 fps)
	[1]: 'MJPG' (Motion-JPEG, compressed)
		Size: Discrete 1920x1080
			Interval: Discrete 0.033s (30.000 fps)
			Interval: Discrete 0.042s (24.000 fps)
			Interval: Discrete 0.050s (20.000 fps)
			Interval: Discrete 0.067s (15.000 fps)
			Interval: Discrete 0.100s (10.000 fps)
			Interval: Discrete 0.133s (7.500 fps)
			Interval: Discrete 0.200s (5.000 fps)
		Size: Discrete 1280x720
			Interval: Discrete 0.017s (60.000 fps)
			Interval: Discrete 0.033s (30.000 fps)
			Interval: Discrete 0.042s (24.000 fps)
			Interval: Discrete 0.050s (20.000 fps)
			Interval: Discrete 0.067s (15.000 fps)
			Interval: Discrete 0.100s (10.000 fps)
			Interval: Discrete 0.133s (7.500 fps)
			Interval: Discrete 0.200s (5.000 fps)
		Size: Discrete 640x480
			Interval: Discrete 0.017s (60.000 fps)
			Interval: Discrete 0.033s (30.000 fps)
			Interval: Discrete 0.042s (24.000 fps)
			Interval: Discrete 0.050s (20.000 fps)
			Interval: Discrete 0.067s (15.000 fps)
			Interval: Discrete 0.100s (10.000 fps)
			Interval: Discrete 0.133s (7.500 fps)
			Interval: Discrete 0.200s (5.000 fps)
	[2]: 'NV12' (Y/UV 4:2:0)
		Size: Discrete 640x360
			Interval: Discrete 0.033s (30.000 fps)
			Interval: Discrete 0.042s (24.000 fps)
			Interval: Discrete 0.050s (20.000 fps)
			Interval: Discrete 0.067s (15.000 fps)
			Interval: Discrete 0.100s (10.000 fps)
			Interval: Discrete 0.133s (7.500 fps)
			Interval: Discrete 0.200s (5.000 fps)
`

// ---------------------------------------------------------------------------
// 1. Parser verification: parseV4l2Ctrls on probe output
// ---------------------------------------------------------------------------

const v4l2 = Model.parseV4l2Ctrls(V4L2_FIXTURE)

// Check every one of the 17 standard V4L2 controls:
// brightness
assert.equal(v4l2.brightness.name, "brightness")
assert.equal(v4l2.brightness.type, "int")
assert.equal(v4l2.brightness.value, 128)
assert.equal(v4l2.brightness.min, 0)
assert.equal(v4l2.brightness.max, 255)
assert.equal(v4l2.brightness.step, 1)
assert.equal(v4l2.brightness.defaultVal, 128)
assert.equal(v4l2.brightness.inactive, false)

// contrast
assert.equal(v4l2.contrast.name, "contrast")
assert.equal(v4l2.contrast.type, "int")
assert.equal(v4l2.contrast.value, 127)
assert.equal(v4l2.contrast.min, 0)
assert.equal(v4l2.contrast.max, 255)
assert.equal(v4l2.contrast.step, 1)
assert.equal(v4l2.contrast.defaultVal, 128)
assert.equal(v4l2.contrast.inactive, false)

// saturation
assert.equal(v4l2.saturation.name, "saturation")
assert.equal(v4l2.saturation.type, "int")
assert.equal(v4l2.saturation.value, 137)
assert.equal(v4l2.saturation.min, 0)
assert.equal(v4l2.saturation.max, 255)
assert.equal(v4l2.saturation.step, 1)
assert.equal(v4l2.saturation.defaultVal, 128)
assert.equal(v4l2.saturation.inactive, false)

// white_balance_automatic (bool line without min/max)
assert.equal(v4l2.white_balance_automatic.name, "white_balance_automatic")
assert.equal(v4l2.white_balance_automatic.type, "bool")
assert.equal(v4l2.white_balance_automatic.value, 1)
assert.equal(v4l2.white_balance_automatic.defaultVal, 1)
assert.equal(v4l2.white_balance_automatic.min, undefined)
assert.equal(v4l2.white_balance_automatic.max, undefined)
assert.equal(v4l2.white_balance_automatic.step, undefined)
assert.equal(v4l2.white_balance_automatic.inactive, false)

// gain
assert.equal(v4l2.gain.name, "gain")
assert.equal(v4l2.gain.type, "int")
assert.equal(v4l2.gain.value, 0)
assert.equal(v4l2.gain.min, 0)
assert.equal(v4l2.gain.max, 255)
assert.equal(v4l2.gain.step, 1)
assert.equal(v4l2.gain.defaultVal, 0)
assert.equal(v4l2.gain.inactive, false)

// power_line_frequency (menu with value suffix 'value=1 (50 Hz)' and menu items)
assert.equal(v4l2.power_line_frequency.name, "power_line_frequency")
assert.equal(v4l2.power_line_frequency.type, "menu")
assert.equal(v4l2.power_line_frequency.value, 1)
assert.equal(v4l2.power_line_frequency.min, 0)
assert.equal(v4l2.power_line_frequency.max, 2)
assert.equal(v4l2.power_line_frequency.defaultVal, 2)
assert.equal(v4l2.power_line_frequency.inactive, false)
assert.deepEqual(v4l2.power_line_frequency.menuItems, [
  { value: 0, label: "Disabled" },
  { value: 1, label: "50 Hz" },
  { value: 2, label: "60 Hz" }
])

// white_balance_temperature (flags=inactive, has-min-max)
assert.equal(v4l2.white_balance_temperature.name, "white_balance_temperature")
assert.equal(v4l2.white_balance_temperature.type, "int")
assert.equal(v4l2.white_balance_temperature.value, 3997)
assert.equal(v4l2.white_balance_temperature.min, 2800)
assert.equal(v4l2.white_balance_temperature.max, 7500)
assert.equal(v4l2.white_balance_temperature.step, 1)
assert.equal(v4l2.white_balance_temperature.defaultVal, 5000)
assert.equal(v4l2.white_balance_temperature.inactive, true)

// sharpness
assert.equal(v4l2.sharpness.name, "sharpness")
assert.equal(v4l2.sharpness.type, "int")
assert.equal(v4l2.sharpness.value, 128)
assert.equal(v4l2.sharpness.min, 0)
assert.equal(v4l2.sharpness.max, 255)
assert.equal(v4l2.sharpness.step, 1)
assert.equal(v4l2.sharpness.defaultVal, 128)
assert.equal(v4l2.sharpness.inactive, false)

// backlight_compensation
assert.equal(v4l2.backlight_compensation.name, "backlight_compensation")
assert.equal(v4l2.backlight_compensation.type, "int")
assert.equal(v4l2.backlight_compensation.value, 1)
assert.equal(v4l2.backlight_compensation.min, 0)
assert.equal(v4l2.backlight_compensation.max, 1)
assert.equal(v4l2.backlight_compensation.step, 1)
assert.equal(v4l2.backlight_compensation.defaultVal, 1)
assert.equal(v4l2.backlight_compensation.inactive, false)

// auto_exposure (menu with value suffix 'value=3 (Aperture Priority Mode)' and menu items)
assert.equal(v4l2.auto_exposure.name, "auto_exposure")
assert.equal(v4l2.auto_exposure.type, "menu")
assert.equal(v4l2.auto_exposure.value, 3)
assert.equal(v4l2.auto_exposure.min, 0)
assert.equal(v4l2.auto_exposure.max, 3)
assert.equal(v4l2.auto_exposure.defaultVal, 3)
assert.equal(v4l2.auto_exposure.inactive, false)
assert.deepEqual(v4l2.auto_exposure.menuItems, [
  { value: 1, label: "Manual Mode" },
  { value: 3, label: "Aperture Priority Mode" }
])

// exposure_time_absolute (flags=inactive)
assert.equal(v4l2.exposure_time_absolute.name, "exposure_time_absolute")
assert.equal(v4l2.exposure_time_absolute.type, "int")
assert.equal(v4l2.exposure_time_absolute.value, 625)
assert.equal(v4l2.exposure_time_absolute.min, 3)
assert.equal(v4l2.exposure_time_absolute.max, 2047)
assert.equal(v4l2.exposure_time_absolute.step, 1)
assert.equal(v4l2.exposure_time_absolute.defaultVal, 156)
assert.equal(v4l2.exposure_time_absolute.inactive, true)

// exposure_dynamic_framerate (bool line)
assert.equal(v4l2.exposure_dynamic_framerate.name, "exposure_dynamic_framerate")
assert.equal(v4l2.exposure_dynamic_framerate.type, "bool")
assert.equal(v4l2.exposure_dynamic_framerate.value, 0)
assert.equal(v4l2.exposure_dynamic_framerate.defaultVal, 0)
assert.equal(v4l2.exposure_dynamic_framerate.inactive, false)

// pan_absolute (negative values: min=-72000, value=-21600)
assert.equal(v4l2.pan_absolute.name, "pan_absolute")
assert.equal(v4l2.pan_absolute.type, "int")
assert.equal(v4l2.pan_absolute.value, -21600)
assert.equal(v4l2.pan_absolute.min, -72000)
assert.equal(v4l2.pan_absolute.max, 72000)
assert.equal(v4l2.pan_absolute.step, 3600)
assert.equal(v4l2.pan_absolute.defaultVal, 0)
assert.equal(v4l2.pan_absolute.inactive, false)

// tilt_absolute
assert.equal(v4l2.tilt_absolute.name, "tilt_absolute")
assert.equal(v4l2.tilt_absolute.type, "int")
assert.equal(v4l2.tilt_absolute.value, 50400)
assert.equal(v4l2.tilt_absolute.min, -72000)
assert.equal(v4l2.tilt_absolute.max, 72000)
assert.equal(v4l2.tilt_absolute.step, 3600)
assert.equal(v4l2.tilt_absolute.defaultVal, 0)
assert.equal(v4l2.tilt_absolute.inactive, false)

// focus_absolute (flags=inactive)
assert.equal(v4l2.focus_absolute.name, "focus_absolute")
assert.equal(v4l2.focus_absolute.type, "int")
assert.equal(v4l2.focus_absolute.value, 20)
assert.equal(v4l2.focus_absolute.min, 0)
assert.equal(v4l2.focus_absolute.max, 255)
assert.equal(v4l2.focus_absolute.step, 1)
assert.equal(v4l2.focus_absolute.defaultVal, 0)
assert.equal(v4l2.focus_absolute.inactive, true)

// focus_automatic_continuous (bool)
assert.equal(v4l2.focus_automatic_continuous.name, "focus_automatic_continuous")
assert.equal(v4l2.focus_automatic_continuous.type, "bool")
assert.equal(v4l2.focus_automatic_continuous.value, 1)
assert.equal(v4l2.focus_automatic_continuous.defaultVal, 1)
assert.equal(v4l2.focus_automatic_continuous.inactive, false)

// zoom_absolute
assert.equal(v4l2.zoom_absolute.name, "zoom_absolute")
assert.equal(v4l2.zoom_absolute.type, "int")
assert.equal(v4l2.zoom_absolute.value, 152)
assert.equal(v4l2.zoom_absolute.min, 100)
assert.equal(v4l2.zoom_absolute.max, 400)
assert.equal(v4l2.zoom_absolute.step, 1)
assert.equal(v4l2.zoom_absolute.defaultVal, 100)
assert.equal(v4l2.zoom_absolute.inactive, false)

// ---------------------------------------------------------------------------
// 2. Parser verification: parseCameractrls on probe output
// ---------------------------------------------------------------------------

const fovParsed = Model.parseCameractrls(CAMERACTRLS_FIXTURE)
assert.equal(fovParsed.logitech_brio_fov, 65)
assert.equal(Model.parseCameractrls("Basic / Crop\n logitech_brio_fov = 78\n").logitech_brio_fov, 78)
assert.equal(Model.parseCameractrls("Basic / Crop\n logitech_brio_fov = 90\n").logitech_brio_fov, 90)

// Edge cases for parsers
assert.deepEqual(Model.parseCameractrls(""), {})
assert.deepEqual(Model.parseCameractrls("no fov control in this output"), {})
assert.deepEqual(Model.parseCameractrls(null), {})
assert.deepEqual(Model.parseCameractrls(undefined), {})

assert.deepEqual(Model.parseV4l2Ctrls(""), {})
assert.deepEqual(Model.parseV4l2Ctrls(null), {})
assert.deepEqual(Model.parseV4l2Ctrls(undefined), {})

// ---------------------------------------------------------------------------
// 3. CONTROLS metadata catalog check (all 18 controls defined)
// ---------------------------------------------------------------------------

const controlKeys = Object.keys(Model.CONTROLS)
assert.equal(controlKeys.length, 18)

// Check backend tag on vendor control
assert.equal(Model.CONTROLS.logitech_brio_fov.backend, "cameractrls")
assert.deepEqual(Model.CONTROLS.logitech_brio_fov.options, [65, 78, 90])

// Ensure each control has required metadata fields
for (const name of controlKeys) {
  const ctrl = Model.CONTROLS[name]
  assert.equal(ctrl.name, name)
  assert.ok(ctrl.type, `missing type for ${name}`)
  assert.ok(ctrl.defaultVal !== undefined, `missing defaultVal for ${name}`)
  assert.ok(ctrl.category, `missing category for ${name}`)
}

// ---------------------------------------------------------------------------
// 4. getDefaults: map of default values for all 18 controls
// ---------------------------------------------------------------------------

const defaults = Model.getDefaults()
assert.equal(Object.keys(defaults).length, 18)
assert.equal(defaults.brightness, 128)
assert.equal(defaults.contrast, 128)
assert.equal(defaults.saturation, 128)
assert.equal(defaults.sharpness, 128)
assert.equal(defaults.gain, 0)
assert.equal(defaults.backlight_compensation, 1)
assert.equal(defaults.power_line_frequency, 2)
assert.equal(defaults.white_balance_automatic, 1)
assert.equal(defaults.white_balance_temperature, 5000)
assert.equal(defaults.auto_exposure, 3)
assert.equal(defaults.exposure_time_absolute, 156)
assert.equal(defaults.exposure_dynamic_framerate, 0)
assert.equal(defaults.focus_automatic_continuous, 1)
assert.equal(defaults.focus_absolute, 0)
assert.equal(defaults.zoom_absolute, 100)
assert.equal(defaults.pan_absolute, 0)
assert.equal(defaults.tilt_absolute, 0)
assert.equal(defaults.logitech_brio_fov, 65)

// ---------------------------------------------------------------------------
// 5. Command builders: build* command arrays
// ---------------------------------------------------------------------------

// buildV4l2ListCommand (now includes --get-fmt-video and --get-parm before --list-ctrls-menus)
assert.deepEqual(Model.buildV4l2ListCommand(), [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--get-fmt-video",
  "--get-parm",
  "--list-ctrls-menus"
])
assert.deepEqual(Model.buildV4l2ListCommand("/dev/video2"), [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--get-fmt-video",
  "--get-parm",
  "--list-ctrls-menus"
])

// buildV4l2GetCommand
assert.deepEqual(Model.buildV4l2GetCommand(null, "brightness"), [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--get-ctrl",
  "brightness"
])
assert.deepEqual(Model.buildV4l2GetCommand("/dev/video2", "contrast"), [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--get-ctrl",
  "contrast"
])

// buildV4l2SetCommand
assert.deepEqual(Model.buildV4l2SetCommand(null, "brightness", 130), [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--set-ctrl",
  "brightness=130"
])
assert.deepEqual(Model.buildV4l2SetCommand("/dev/video2", "gain", 15), [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--set-ctrl",
  "gain=15"
])

// buildFovListCommand
assert.deepEqual(Model.buildFovListCommand(), [
  "cameractrls",
  "-d",
  "/dev/video0",
  "-l"
])
assert.deepEqual(Model.buildFovListCommand("/dev/video2"), [
  "cameractrls",
  "-d",
  "/dev/video2",
  "-l"
])

// buildFovSetCommand
assert.deepEqual(Model.buildFovSetCommand(null, 65), [
  "cameractrls",
  "-d",
  "/dev/video0",
  "-c",
  "logitech_brio_fov=65"
])
assert.deepEqual(Model.buildFovSetCommand(null, 78), [
  "cameractrls",
  "-d",
  "/dev/video0",
  "-c",
  "logitech_brio_fov=78"
])
assert.deepEqual(Model.buildFovSetCommand("/dev/video2", 90), [
  "cameractrls",
  "-d",
  "/dev/video2",
  "-c",
  "logitech_brio_fov=90"
])

// ---------------------------------------------------------------------------
// 6. buildResetCommands: resets all V4L2 controls + FOV reset
// ---------------------------------------------------------------------------

const resetCmds = Model.buildResetCommands()
assert.equal(resetCmds.length, 4)

// 1. First command switches three parents to manual
assert.deepEqual(resetCmds[0], [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--set-ctrl",
  "white_balance_automatic=0,auto_exposure=1,focus_automatic_continuous=0"
])

// 2. Second command sets dependent controls to defaults while parents are manual
assert.deepEqual(resetCmds[1], [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--set-ctrl",
  "white_balance_temperature=5000,exposure_time_absolute=156,focus_absolute=0"
])

// 3. Third command sets remaining standard controls to defaults (including parents back to auto)
assert.equal(resetCmds[2][0], "v4l2-ctl")
assert.equal(resetCmds[2][1], "-d")
assert.equal(resetCmds[2][2], "/dev/video0")
assert.equal(resetCmds[2][3], "--set-ctrl")

const remainingStr = resetCmds[2][4]
const dependentNames = ["white_balance_temperature", "exposure_time_absolute", "focus_absolute"]
for (const name of controlKeys) {
  if (name !== "logitech_brio_fov" && !dependentNames.includes(name)) {
    const expectedPair = `${name}=${Model.CONTROLS[name].defaultVal}`
    assert.ok(
      remainingStr.includes(expectedPair),
      `Reset command 3 missing pair for ${expectedPair}`
    )
  }
}
// Dependent controls must NOT be in command 3
for (const name of dependentNames) {
  assert.ok(
    !remainingStr.includes(`${name}=`),
    `Reset command 3 should not include dependent control ${name}`
  )
}

// 4. Fourth command is cameractrls FOV reset to default 65
assert.deepEqual(resetCmds[3], [
  "cameractrls",
  "-d",
  "/dev/video0",
  "-c",
  "logitech_brio_fov=65"
])

// Device override parameter check
const customResetCmds = Model.buildResetCommands("/dev/video1")
assert.equal(customResetCmds[0][2], "/dev/video1")
assert.equal(customResetCmds[1][2], "/dev/video1")
assert.equal(customResetCmds[2][2], "/dev/video1")
assert.equal(customResetCmds[3][2], "/dev/video1")

// ---------------------------------------------------------------------------
// 7. isControlActive dependency rules
// ---------------------------------------------------------------------------

// focus_absolute dependsOn focus_automatic_continuous (active when false / 0)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: 0 }), true)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: 1 }), false)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: false }), true)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: true }), false)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: { value: 0 } }), true)
assert.equal(Model.isControlActive("focus_absolute", { focus_automatic_continuous: { value: 1 } }), false)
// Default state (autofocus continuous = 1) means focus_absolute is inactive
assert.equal(Model.isControlActive("focus_absolute", {}), false)

// exposure_time_absolute dependsOn auto_exposure (active when 1, manual mode)
assert.equal(Model.isControlActive("exposure_time_absolute", { auto_exposure: 1 }), true)
assert.equal(Model.isControlActive("exposure_time_absolute", { auto_exposure: 3 }), false)
assert.equal(Model.isControlActive("exposure_time_absolute", { auto_exposure: { value: 1 } }), true)
assert.equal(Model.isControlActive("exposure_time_absolute", { auto_exposure: { value: 3 } }), false)
// Default state (auto_exposure = 3, Aperture Priority) means exposure_time_absolute is inactive
assert.equal(Model.isControlActive("exposure_time_absolute", {}), false)

// white_balance_temperature dependsOn white_balance_automatic (active when false / 0)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: 0 }), true)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: 1 }), false)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: false }), true)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: true }), false)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: { value: 0 } }), true)
assert.equal(Model.isControlActive("white_balance_temperature", { white_balance_automatic: { value: 1 } }), false)
// Default state (white_balance_automatic = 1) means white_balance_temperature is inactive
assert.equal(Model.isControlActive("white_balance_temperature", {}), false)

// Controls without dependencies are always active
assert.equal(Model.isControlActive("brightness", {}), true)
assert.equal(Model.isControlActive("zoom_absolute", {}), true)
assert.equal(Model.isControlActive("pan_absolute", {}), true)
assert.equal(Model.isControlActive("logitech_brio_fov", {}), true)
assert.equal(Model.isControlActive("unknown_control", {}), true)

// ---------------------------------------------------------------------------
// 8. Capture Mode: parseV4l2CaptureMode & parseV4l2Ctrls combined output
// ---------------------------------------------------------------------------

// parseV4l2CaptureMode parses width, height, pixelformat, and fps
const captureMode = Model.parseV4l2CaptureMode(V4L2_COMBINED_FIXTURE)
assert.equal(captureMode.width, 1280)
assert.equal(captureMode.height, 720)
assert.equal(captureMode.pixelformat, "MJPG")
assert.equal(captureMode.fps, 30)

// parseV4l2CaptureMode edge cases
assert.deepEqual(Model.parseV4l2CaptureMode(""), {})
assert.deepEqual(Model.parseV4l2CaptureMode(null), {})
assert.deepEqual(Model.parseV4l2CaptureMode(undefined), {})
assert.deepEqual(Model.parseV4l2CaptureMode("random text without capture blocks"), {})

// Combined fixture must still parse all 17 V4L2 controls cleanly via parseV4l2Ctrls
const combinedCtrls = Model.parseV4l2Ctrls(V4L2_COMBINED_FIXTURE)
assert.equal(Object.keys(combinedCtrls).length, 17)
assert.equal(combinedCtrls.brightness.value, 128)
assert.equal(combinedCtrls.contrast.value, 127)
assert.equal(combinedCtrls.auto_exposure.value, 3)
assert.equal(combinedCtrls.zoom_absolute.value, 152)

// ---------------------------------------------------------------------------
// 9. Capture Formats: parseV4l2Formats on --list-formats-ext fixture
// ---------------------------------------------------------------------------

const formats = Model.parseV4l2Formats(V4L2_FORMATS_FIXTURE)
assert.equal(formats.length, 3)

// Format 0: YUYV
assert.equal(formats[0].pixelformat, "YUYV")
assert.equal(formats[0].description, "YUYV 4:2:2")
assert.equal(formats[0].sizes.length, 1)
assert.equal(formats[0].sizes[0].width, 640)
assert.equal(formats[0].sizes[0].height, 480)
assert.deepEqual(formats[0].sizes[0].fps, [30, 24, 20, 15, 10, 7.5, 5])
// Verify 7.5 is preserved as floating point number
assert.equal(typeof formats[0].sizes[0].fps[5], "number")
assert.equal(formats[0].sizes[0].fps[5], 7.5)

// Format 1: MJPG
assert.equal(formats[1].pixelformat, "MJPG")
assert.equal(formats[1].description, "Motion-JPEG, compressed")
assert.equal(formats[1].sizes.length, 3)
assert.equal(formats[1].sizes[0].width, 1920)
assert.equal(formats[1].sizes[0].height, 1080)
assert.deepEqual(formats[1].sizes[0].fps, [30, 24, 20, 15, 10, 7.5, 5])
assert.equal(formats[1].sizes[1].width, 1280)
assert.equal(formats[1].sizes[1].height, 720)
assert.deepEqual(formats[1].sizes[1].fps, [60, 30, 24, 20, 15, 10, 7.5, 5])
assert.equal(formats[1].sizes[2].width, 640)
assert.equal(formats[1].sizes[2].height, 480)

// Format 2: NV12
assert.equal(formats[2].pixelformat, "NV12")
assert.equal(formats[2].description, "Y/UV 4:2:0")
assert.equal(formats[2].sizes.length, 1)
assert.equal(formats[2].sizes[0].width, 640)
assert.equal(formats[2].sizes[0].height, 360)

// parseV4l2Formats edge cases
assert.deepEqual(Model.parseV4l2Formats(""), [])
assert.deepEqual(Model.parseV4l2Formats(null), [])
assert.deepEqual(Model.parseV4l2Formats(undefined), [])

// ---------------------------------------------------------------------------
// 10. Capture Command Builders
// ---------------------------------------------------------------------------

// buildV4l2ListFormatsCommand
assert.deepEqual(Model.buildV4l2ListFormatsCommand(), [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--list-formats-ext"
])
assert.deepEqual(Model.buildV4l2ListFormatsCommand("/dev/video1"), [
  "v4l2-ctl",
  "-d",
  "/dev/video1",
  "--list-formats-ext"
])

// buildV4l2SetCaptureModeCommand
assert.deepEqual(
  Model.buildV4l2SetCaptureModeCommand(null, {
    width: 1920,
    height: 1080,
    pixelformat: "MJPG",
    fps: 30
  }),
  [
    "v4l2-ctl",
    "-d",
    "/dev/video0",
    "--set-fmt-video=width=1920,height=1080,pixelformat=MJPG",
    "--set-parm=30"
  ]
)
assert.deepEqual(
  Model.buildV4l2SetCaptureModeCommand("/dev/video2", {
    width: 1280,
    height: 720,
    pixelformat: "MJPG",
    fps: 60
  }),
  [
    "v4l2-ctl",
    "-d",
    "/dev/video2",
    "--set-fmt-video=width=1280,height=720,pixelformat=MJPG",
    "--set-parm=60"
  ]
)

// ---------------------------------------------------------------------------
// 11. resolutionOptions
// ---------------------------------------------------------------------------

// Preferred resolutions filtering (3840x2160 absent from fixture, so only 1080p, 720p, 480p)
const resOpts = Model.resolutionOptions(formats)
assert.equal(resOpts.length, 3)
assert.deepEqual(resOpts.map(function(r) { return r.value }), ["1920x1080", "1280x720", "640x480"])
assert.deepEqual(resOpts.map(function(r) { return r.label }), ["1080p", "720p", "480p"])

// MJPG preference: 640x480 is present in both YUYV and MJPG, must select MJPG
assert.equal(resOpts[2].pixelformat, "MJPG")

// Currently-set size included even if not in PREFERRED_RESOLUTIONS
const resWithCurrent = Model.resolutionOptions(formats, { width: 640, height: 360 })
assert.equal(resWithCurrent.length, 4)
assert.deepEqual(
  resWithCurrent.map(function(r) { return r.value }),
  ["1920x1080", "1280x720", "640x480", "640x360"]
)
assert.equal(resWithCurrent[3].value, "640x360")
assert.equal(resWithCurrent[3].label, "640×360")
assert.equal(resWithCurrent[3].pixelformat, "NV12")

// All resolutions returned when all: true
const resAll = Model.resolutionOptions(formats, null, true)
assert.equal(resAll.length, 4)
assert.deepEqual(
  resAll.map(function(r) { return r.value }),
  ["1920x1080", "1280x720", "640x480", "640x360"]
)

// Edge case: empty formats
assert.deepEqual(Model.resolutionOptions([]), [])
assert.deepEqual(Model.resolutionOptions(null), [])

// ---------------------------------------------------------------------------
// 12. fpsOptions
// ---------------------------------------------------------------------------

assert.deepEqual(Model.PREFERRED_FPS, [60, 30, 24, 15])

// Preferred-only filtering (1080p MJPG offers 30, 24, 20, 15, 10, 7.5, 5; returns 30, 24, 15)
const fps1080 = Model.fpsOptions(formats, 1920, 1080, "MJPG")
assert.equal(fps1080.length, 3)
assert.deepEqual(
  fps1080.map(function(o) { return o.fps }),
  [30, 24, 15]
)
assert.deepEqual(
  fps1080.map(function(o) { return o.value }),
  ["30", "24", "15"]
)
assert.deepEqual(
  fps1080.map(function(o) { return o.label }),
  ["30", "24", "15"]
)

// Current fps always included even when not in PREFERRED_FPS
const fpsWith75 = Model.fpsOptions(formats, 1920, 1080, "MJPG", 7.5)
assert.equal(fpsWith75.length, 4)
assert.deepEqual(
  fpsWith75.map(function(o) { return o.fps }),
  [30, 24, 15, 7.5]
)
assert.deepEqual(
  fpsWith75.map(function(o) { return o.label }),
  ["30", "24", "15", "7.5"]
)

const fpsWith20 = Model.fpsOptions(formats, 1920, 1080, "MJPG", 20)
assert.equal(fpsWith20.length, 4)
assert.deepEqual(
  fpsWith20.map(function(o) { return o.fps }),
  [30, 24, 20, 15]
)

// All frame rates returned when all: true
const fpsAll = Model.fpsOptions(formats, 1920, 1080, "MJPG", null, true)
assert.equal(fpsAll.length, 7)
assert.deepEqual(
  fpsAll.map(function(o) { return o.fps }),
  [30, 24, 20, 15, 10, 7.5, 5]
)
assert.deepEqual(
  fpsAll.map(function(o) { return o.label }),
  ["30", "24", "20", "15", "10", "7.5", "5"]
)

// 720p preferred fps (offers 60, 30, 24, 20, 15, 10, 7.5, 5; returns 60, 30, 24, 15)
const fps720 = Model.fpsOptions(formats, 1280, 720, "MJPG")
assert.equal(fps720.length, 4)
assert.deepEqual(
  fps720.map(function(o) { return o.fps }),
  [60, 30, 24, 15]
)
assert.equal(fps720[0].fps, 60)
assert.equal(fps720[0].label, "60")

// Unknown size / missing format
assert.deepEqual(Model.fpsOptions(formats, 9999, 9999, "MJPG"), [])
assert.deepEqual(Model.fpsOptions([], 1920, 1080), [])

// ---------------------------------------------------------------------------
// 13. pickCaptureMode
// ---------------------------------------------------------------------------

// Exact match
const picked1 = Model.pickCaptureMode(formats, null, 1920, 1080, 30)
assert.deepEqual(picked1, {
  width: 1920,
  height: 1080,
  pixelformat: "MJPG",
  fps: 30
})

// Nearest-fps fallback: 60 requested at 1920x1080 (where max is 30) clamps to 30
const pickedNearest = Model.pickCaptureMode(formats, null, 1920, 1080, 60)
assert.equal(pickedNearest.fps, 30)

// Nearest-fps fallback: 22 requested clamps to 20 or 24
const picked22 = Model.pickCaptureMode(formats, null, 1920, 1080, 22)
assert.ok(picked22.fps === 20 || picked22.fps === 24)

// Format fallback: current format is YUYV, which does NOT offer 1920x1080 -> fall back to MJPG
const pickedFallbackPf = Model.pickCaptureMode(formats, { pixelformat: "YUYV" }, 1920, 1080, 30)
assert.equal(pickedFallbackPf.pixelformat, "MJPG")

// Format retention: current format is YUYV, which DOES offer 640x480 -> retain YUYV
const pickedRetainPf = Model.pickCaptureMode(formats, { pixelformat: "YUYV" }, 640, 480, 30)
assert.equal(pickedRetainPf.pixelformat, "YUYV")

// Format fallback to first offering when neither current nor MJPG offers it
const pickedNV12 = Model.pickCaptureMode(formats, null, 640, 360, 30)
assert.equal(pickedNV12.pixelformat, "NV12")

// Unknown size returns null
assert.equal(Model.pickCaptureMode(formats, null, 9999, 8888, 30), null)
assert.equal(Model.pickCaptureMode([], null, 1920, 1080, 30), null)

// ---------------------------------------------------------------------------
// 14. Verification: CONTROLS, getDefaults, buildResetCommands untouched
// ---------------------------------------------------------------------------

assert.equal(Object.keys(Model.CONTROLS).length, 18)
assert.equal(Object.keys(Model.getDefaults()).length, 18)
assert.equal(Model.buildResetCommands().length, 4)
assert.equal(Model.CONTROLS.capture_mode, undefined)
assert.equal(Model.CONTROLS.resolution, undefined)
assert.equal(Model.CONTROLS.pixelformat, undefined)

// ---------------------------------------------------------------------------
// 15. PREVIEW_STATES
// ---------------------------------------------------------------------------

assert.deepEqual(Model.PREVIEW_STATES, [
  "active",
  "inactive",
  "busy",
  "permission",
  "disconnected",
  "unavailable"
])
assert.equal(Model.PREVIEW_STATES.length, 6)

// ---------------------------------------------------------------------------
// 16. PIXEL_FORMAT map and pickCameraFormat
// ---------------------------------------------------------------------------

assert.equal(Model.PIXEL_FORMAT.MJPG, 29)
assert.equal(Model.PIXEL_FORMAT.YUYV, 17)
assert.equal(Model.PIXEL_FORMAT.NV12, 18)

const sampleVideoFormats = [
  { width: 3840, height: 2160, pixelFormat: 29, minFrameRate: 5, maxFrameRate: 30 },
  { width: 1920, height: 1080, pixelFormat: 29, minFrameRate: 5, maxFrameRate: 60 },
  { width: 1920, height: 1080, pixelFormat: 17, minFrameRate: 5, maxFrameRate: 30 },
  { width: 1280, height: 720, pixelFormat: 29, minFrameRate: 5, maxFrameRate: 60 }
]

// Exact match (width, height, pixelFormat, fps within [minFrameRate, maxFrameRate])
const exactFmt = Model.pickCameraFormat(sampleVideoFormats, { width: 1920, height: 1080, pixelformat: "MJPG", fps: 30 })
assert.equal(exactFmt, sampleVideoFormats[1])
assert.equal(exactFmt.width, 1920)
assert.equal(exactFmt.height, 1080)
assert.equal(exactFmt.pixelFormat, 29)

// fps-range fallback (fps outside range, falls back to resolution + pixelformat)
const fpsFallbackFmt = Model.pickCameraFormat(sampleVideoFormats, { width: 1920, height: 1080, pixelformat: "YUYV", fps: 60 })
assert.equal(fpsFallbackFmt, sampleVideoFormats[2])
assert.equal(fpsFallbackFmt.pixelFormat, 17)

// Resolution-only fallback (pixel format not matching, falls back to resolution)
const resFallbackFmt = Model.pickCameraFormat(sampleVideoFormats, { width: 1280, height: 720, pixelformat: "NV12", fps: 30 })
assert.equal(resFallbackFmt, sampleVideoFormats[3])
assert.equal(resFallbackFmt.width, 1280)

// No match -> null
assert.equal(Model.pickCameraFormat(sampleVideoFormats, { width: 9999, height: 9999, pixelformat: "MJPG", fps: 30 }), null)
assert.equal(Model.pickCameraFormat([], { width: 1920, height: 1080, pixelformat: "MJPG", fps: 30 }), null)
assert.equal(Model.pickCameraFormat(sampleVideoFormats, null), null)
assert.equal(Model.pickCameraFormat(null, { width: 1920, height: 1080 }), null)

// Supports Qt QCameraFormat resolution structure with .resolution.width/.height
const qtSampleFormats = [
  { resolution: { width: 1920, height: 1080 }, pixelFormat: 29, minFrameRate: 5, maxFrameRate: 60 }
]
const qtMatchedFmt = Model.pickCameraFormat(qtSampleFormats, { width: 1920, height: 1080, pixelformat: "MJPG", fps: 30 })
assert.equal(qtMatchedFmt, qtSampleFormats[0])

// ---------------------------------------------------------------------------
// 17. Device Discovery: buildV4l2DevicesCommand, parseV4l2Devices, selectActiveDevice
// ---------------------------------------------------------------------------

const DISCOVERY_FIXTURE = `card=MX Brio
bus=usb-0000:08:00.1-2
path=/dev/video0
caps=0x04200001 Video Capture Streaming Extended Pix Format
---
card=MX Brio
bus=usb-0000:08:00.1-2
path=/dev/video1
caps=0x04a00000 Metadata Capture Streaming Extended Pix Format
---
`

const discovered = Model.parseV4l2Devices(DISCOVERY_FIXTURE)
assert.equal(discovered.length, 1)
assert.equal(discovered[0].path, "/dev/video0")
assert.equal(discovered[0].name, "MX Brio")
assert.equal(discovered[0].card, "MX Brio")
assert.equal(discovered[0].bus, "usb-0000:08:00.1-2")

// Multi-device fixture
const MULTI_DEVICE_FIXTURE = `card=MX Brio
bus=usb-0000:08:00.1-2
path=/dev/video0
caps=0x04200001 Video Capture Streaming Extended Pix Format
---
card=MX Brio
bus=usb-0000:08:00.1-2
path=/dev/video1
caps=0x04a00000 Metadata Capture Streaming Extended Pix Format
---
card=Integrated Camera
bus=usb-0000:00:14.0-5
path=/dev/video2
caps=0x04200001 Video Capture Streaming Extended Pix Format
---
card=Integrated Camera
bus=usb-0000:00:14.0-5
path=/dev/video3
caps=0x04a00000 Metadata Capture Streaming Extended Pix Format
---
`

const multiDiscovered = Model.parseV4l2Devices(MULTI_DEVICE_FIXTURE)
assert.equal(multiDiscovered.length, 2)
assert.equal(multiDiscovered[0].path, "/dev/video0")
assert.equal(multiDiscovered[0].name, "MX Brio")
assert.equal(multiDiscovered[0].card, "MX Brio")
assert.equal(multiDiscovered[0].bus, "usb-0000:08:00.1-2")
assert.equal(multiDiscovered[1].path, "/dev/video2")
assert.equal(multiDiscovered[1].name, "Integrated Camera")
assert.equal(multiDiscovered[1].card, "Integrated Camera")
assert.equal(multiDiscovered[1].bus, "usb-0000:00:14.0-5")
assert.ok(!multiDiscovered.some(d => d.path === "/dev/video1"))
assert.ok(!multiDiscovered.some(d => d.path === "/dev/video3"))

// parseV4l2Devices edge cases
assert.deepEqual(Model.parseV4l2Devices(""), [])
assert.deepEqual(Model.parseV4l2Devices(null), [])
assert.deepEqual(Model.parseV4l2Devices(undefined), [])

// selectActiveDevice assertions
assert.equal(Model.selectActiveDevice(multiDiscovered, "/dev/video2"), multiDiscovered[1])
assert.equal(Model.selectActiveDevice(multiDiscovered, ""), multiDiscovered[0])
assert.equal(Model.selectActiveDevice(multiDiscovered, "/dev/video1"), multiDiscovered[0])
assert.equal(Model.selectActiveDevice(multiDiscovered, null), multiDiscovered[0])
assert.equal(Model.selectActiveDevice([], "/dev/video0"), null)
assert.equal(Model.selectActiveDevice(null, "/dev/video0"), null)

// deviceSelectorOptions assertions
const selectorOpts = Model.deviceSelectorOptions(multiDiscovered)
assert.deepEqual(selectorOpts, [
  { value: "/dev/video0", label: "MX Brio" },
  { value: "/dev/video2", label: "Integrated Camera" }
])

const dualSameCard = [
  { path: "/dev/video2", name: "Integrated Camera", card: "Integrated Camera", bus: "bus-1" },
  { path: "/dev/video4", name: "Integrated Camera", card: "Integrated Camera", bus: "bus-2" }
]
const dualSelectorOpts = Model.deviceSelectorOptions(dualSameCard)
assert.deepEqual(dualSelectorOpts, [
  { value: "/dev/video2", label: "Integrated Camera · /dev/video2" },
  { value: "/dev/video4", label: "Integrated Camera · /dev/video4" }
])
assert.deepEqual(Model.deviceSelectorOptions([]), [])
assert.deepEqual(Model.deviceSelectorOptions(null), [])

// ---------------------------------------------------------------------------
// 18. Auto-Exposure Resolver and Power Line Options
// ---------------------------------------------------------------------------

// resolveAutoExposure assertions
// Brio menu
assert.deepEqual(
  Model.resolveAutoExposure([
    { value: 1, label: "Manual Mode" },
    { value: 3, label: "Aperture Priority Mode" }
  ]),
  { manual: 1, auto: 3 }
)
// Generic menu with 0 Auto Mode, 1 Manual Mode
assert.deepEqual(
  Model.resolveAutoExposure([
    { value: 0, label: "Auto Mode" },
    { value: 1, label: "Manual Mode" }
  ]),
  { manual: 1, auto: 0 }
)
// Generic menu with 1 Manual, 8 Shutter Priority
assert.deepEqual(
  Model.resolveAutoExposure([
    { value: 1, label: "Manual" },
    { value: 8, label: "Shutter Priority" }
  ]),
  { manual: 1, auto: 8 }
)
// Empty / null fallbacks
assert.deepEqual(Model.resolveAutoExposure([]), { manual: 1, auto: 3 })
assert.deepEqual(Model.resolveAutoExposure(null), { manual: 1, auto: 3 })
assert.deepEqual(Model.resolveAutoExposure(undefined), { manual: 1, auto: 3 })

// powerLineOptions assertions
const brioPowerLine = [
  { value: 0, label: "Disabled" },
  { value: 1, label: "50 Hz" },
  { value: 2, label: "60 Hz" }
]
assert.deepEqual(Model.powerLineOptions(brioPowerLine), [
  { value: "0", label: "Disabled" },
  { value: "1", label: "50 Hz" },
  { value: "2", label: "60 Hz" }
])
assert.deepEqual(Model.powerLineOptions([]), [
  { value: "0", label: "Off" },
  { value: "1", label: "50 Hz" },
  { value: "2", label: "60 Hz" }
])
assert.deepEqual(Model.powerLineOptions(null), [
  { value: "0", label: "Off" },
  { value: "1", label: "50 Hz" },
  { value: "2", label: "60 Hz" }
])

// ---------------------------------------------------------------------------
// 19. Discovery Command Builders
// ---------------------------------------------------------------------------

const devCmd = Model.buildV4l2DevicesCommand()
assert.equal(devCmd.length, 3)
assert.equal(devCmd[0], "sh")
assert.equal(devCmd[1], "-c")
assert.ok(devCmd[2].includes("v4l2-ctl --list-devices"))
assert.ok(devCmd[2].includes("--info"))
assert.ok(devCmd[2].includes("Device Caps"))

assert.deepEqual(Model.buildV4l2InfoCommand("/dev/video2"), [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--info"
])
assert.deepEqual(Model.buildV4l2InfoCommand(), [
  "v4l2-ctl",
  "-d",
  "/dev/video0",
  "--info"
])

// ---------------------------------------------------------------------------
// 20. Generic UVC Fixture and Device-Aware Reset Commands
// ---------------------------------------------------------------------------

const GENERIC_UVC_FIXTURE = `User Controls

                     brightness 0x00980900 (int)    : min=-64 max=64 step=1 default=0 value=0 flags=has-min-max
                       contrast 0x00980901 (int)    : min=0 max=64 step=1 default=32 value=32 flags=has-min-max
                     saturation 0x00980902 (int)    : min=0 max=128 step=1 default=64 value=64 flags=has-min-max
        white_balance_automatic 0x0098090c (bool)   : default=1 value=1
                          gamma 0x00980910 (int)    : min=100 max=300 step=1 default=100 value=100 flags=has-min-max
                           gain 0x00980913 (int)    : min=0 max=15 step=1 default=0 value=0 flags=has-min-max
           power_line_frequency 0x00980918 (menu)   : min=0 max=2 default=1 value=1 (50 Hz)
				0: Disabled
				1: 50 Hz
				2: 60 Hz
                      sharpness 0x0098091b (int)    : min=0 max=6 step=1 default=2 value=2 flags=has-min-max
         backlight_compensation 0x0098091c (int)    : min=0 max=1 step=1 default=0 value=0 flags=has-min-max

Camera Controls

                  auto_exposure 0x009a0901 (menu)   : min=0 max=1 default=0 value=0 (Auto Mode)
				0: Auto Mode
				1: Manual Mode
         exposure_time_absolute 0x009a0902 (int)    : min=1 max=5000 step=1 default=166 value=166 flags=inactive, has-min-max
`

const genericParsed = Model.parseV4l2Ctrls(GENERIC_UVC_FIXTURE)

// Assert parsed fields on generic fixture
assert.equal(genericParsed.brightness.min, -64)
assert.equal(genericParsed.brightness.max, 64)
assert.equal(genericParsed.brightness.step, 1)
assert.equal(genericParsed.brightness.defaultVal, 0)

assert.equal(genericParsed.contrast.min, 0)
assert.equal(genericParsed.contrast.max, 64)
assert.equal(genericParsed.contrast.step, 1)
assert.equal(genericParsed.contrast.defaultVal, 32)

assert.equal(genericParsed.saturation.min, 0)
assert.equal(genericParsed.saturation.max, 128)
assert.equal(genericParsed.saturation.step, 1)
assert.equal(genericParsed.saturation.defaultVal, 64)

assert.equal(genericParsed.white_balance_automatic.type, "bool")
assert.equal(genericParsed.white_balance_automatic.defaultVal, 1)

assert.equal(genericParsed.gamma.min, 100)
assert.equal(genericParsed.gamma.max, 300)
assert.equal(genericParsed.gamma.step, 1)
assert.equal(genericParsed.gamma.defaultVal, 100)

assert.equal(genericParsed.gain.min, 0)
assert.equal(genericParsed.gain.max, 15)
assert.equal(genericParsed.gain.step, 1)
assert.equal(genericParsed.gain.defaultVal, 0)

assert.equal(genericParsed.power_line_frequency.type, "menu")
assert.equal(genericParsed.power_line_frequency.defaultVal, 1)
assert.deepEqual(genericParsed.power_line_frequency.menuItems, [
  { value: 0, label: "Disabled" },
  { value: 1, label: "50 Hz" },
  { value: 2, label: "60 Hz" }
])

assert.equal(genericParsed.sharpness.min, 0)
assert.equal(genericParsed.sharpness.max, 6)
assert.equal(genericParsed.sharpness.step, 1)
assert.equal(genericParsed.sharpness.defaultVal, 2)

assert.equal(genericParsed.backlight_compensation.min, 0)
assert.equal(genericParsed.backlight_compensation.max, 1)
assert.equal(genericParsed.backlight_compensation.step, 1)
assert.equal(genericParsed.backlight_compensation.defaultVal, 0)

assert.equal(genericParsed.auto_exposure.type, "menu")
assert.equal(genericParsed.auto_exposure.defaultVal, 0)
assert.deepEqual(genericParsed.auto_exposure.menuItems, [
  { value: 0, label: "Auto Mode" },
  { value: 1, label: "Manual Mode" }
])

assert.equal(genericParsed.exposure_time_absolute.min, 1)
assert.equal(genericParsed.exposure_time_absolute.max, 5000)
assert.equal(genericParsed.exposure_time_absolute.step, 1)
assert.equal(genericParsed.exposure_time_absolute.defaultVal, 166)
assert.equal(genericParsed.exposure_time_absolute.inactive, true)

// Assert absent controls
assert.equal(genericParsed.pan_absolute, undefined)
assert.equal(genericParsed.tilt_absolute, undefined)
assert.equal(genericParsed.zoom_absolute, undefined)
assert.equal(genericParsed.focus_absolute, undefined)
assert.equal(genericParsed.focus_automatic_continuous, undefined)
assert.equal(genericParsed.white_balance_temperature, undefined)
assert.equal(genericParsed.exposure_dynamic_framerate, undefined)

// buildResetCommands on genericParsed
const genericResetCmds = Model.buildResetCommands("/dev/video2", genericParsed)
assert.equal(genericResetCmds.length, 3)

// Command 1: auto_exposure=1
assert.deepEqual(genericResetCmds[0], [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--set-ctrl",
  "auto_exposure=1"
])

// Command 2: exposure_time_absolute=166
assert.deepEqual(genericResetCmds[1], [
  "v4l2-ctl",
  "-d",
  "/dev/video2",
  "--set-ctrl",
  "exposure_time_absolute=166"
])

// Command 3: remaining controls
assert.equal(genericResetCmds[2][0], "v4l2-ctl")
assert.equal(genericResetCmds[2][1], "-d")
assert.equal(genericResetCmds[2][2], "/dev/video2")
assert.equal(genericResetCmds[2][3], "--set-ctrl")

const cmd3Str = genericResetCmds[2][4]
assert.ok(cmd3Str.includes("brightness=0"))
assert.ok(cmd3Str.includes("contrast=32"))
assert.ok(cmd3Str.includes("saturation=64"))
assert.ok(cmd3Str.includes("white_balance_automatic=1"))
assert.ok(cmd3Str.includes("gamma=100"))
assert.ok(cmd3Str.includes("gain=0"))
assert.ok(cmd3Str.includes("power_line_frequency=1"))
assert.ok(cmd3Str.includes("sharpness=2"))
assert.ok(cmd3Str.includes("backlight_compensation=0"))
assert.ok(cmd3Str.includes("auto_exposure=0"))

assert.ok(!cmd3Str.includes("exposure_time_absolute"))
assert.ok(!cmd3Str.includes("pan_absolute"))
assert.ok(!cmd3Str.includes("tilt_absolute"))
assert.ok(!cmd3Str.includes("zoom_absolute"))
assert.ok(!cmd3Str.includes("focus_absolute"))
assert.ok(!cmd3Str.includes("white_balance_temperature"))
assert.ok(!cmd3Str.includes("logitech_brio_fov"))

// Empty map reset returns []
assert.deepEqual(Model.buildResetCommands("/dev/video0", {}), [])

// Passing existing Brio parseV4l2Ctrls + logitech_brio_fov
const brioWithFov = Object.assign({}, v4l2, {
  logitech_brio_fov: {
    name: "logitech_brio_fov",
    backend: "cameractrls",
    defaultVal: 65,
    default: 65
  }
})
const brioResetCmds = Model.buildResetCommands("/dev/video0", brioWithFov)
assert.equal(brioResetCmds.length, 4)
assert.ok(brioResetCmds[0][4].includes("auto_exposure=1"))
assert.ok(brioResetCmds[0][4].includes("white_balance_automatic=0"))
assert.ok(brioResetCmds[0][4].includes("focus_automatic_continuous=0"))
assert.deepEqual(brioResetCmds[3], [
  "cameractrls",
  "-d",
  "/dev/video0",
  "-c",
  "logitech_brio_fov=65"
])

// Verify all 17 standard V4L2 controls are mentioned across commands 0-2
const allV4l2InReset = brioResetCmds[0][4] + "," + brioResetCmds[1][4] + "," + brioResetCmds[2][4]
for (const ctrlName of Object.keys(v4l2)) {
  assert.ok(
    allV4l2InReset.includes(ctrlName + "="),
    `Brio reset commands missing mention of ${ctrlName}`
  )
}

console.log("All Model.js tests passed successfully!")

