import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  property var bar
  property string moduleName: "abduldotdev.camera"
  property var settings

  readonly property bool vertical: bar ? bar.vertical : false
  implicitWidth: vertical ? (bar ? bar.barSize : 26) : row.implicitWidth + 14
  implicitHeight: vertical ? row.implicitHeight + 10 : (bar ? bar.barSize : 26)

  function luminance(c) { return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b }
  readonly property color iconColor: bar
    ? (luminance(bar.background) > 0.6 ? "#1a1a1a" : bar.foreground)
    : "white"

  property string device: ""
  property var discoveredDevices: []
  property bool devicePresent: false
  property bool permissionDenied: false
  property bool hasCameractrls: false
  property bool fovAvailable: false
  property bool refreshPending: false
  property int listGeneration: 0
  property var pendingFov: null
  property var controls: ({})
  property var fovControl: ({})
  property var captureMode: ({})
  property var captureFormats: []
  property bool captureFormatsQueried: false
  property bool captureBusy: false
  property int pendingCaptureCount: 0
  readonly property bool previewPaused: pendingCaptureCount > 0
  property string modelName: "No camera connected"
  property var commandQueue: []
  property bool isDragging: false
  property bool previewWasActiveDuringSession: false
  property bool previewActive: false
  property bool mirrorPreview: false
  property string previewError: ""

  function close() {
    popup.open = false
    root.captureBusy = false
  }
  function open() {
    if (popup.open) {
      refresh()
      return
    }
    root.previewWasActiveDuringSession = false
    root.previewActive = false
    root.previewError = ""
    popup.open = true
    refresh()
  }

  function releasePreviewedDevice() {
    if (!root.previewWasActiveDuringSession) return
    root.previewWasActiveDuringSession = false
    root.reapplyCaptureMode()
  }

  function startPreview() {
    if (root.previewActive) return
    root.previewError = ""
    root.previewActive = true
  }

  function stopPreview() {
    root.previewActive = false
    root.previewError = ""
    root.releasePreviewedDevice()
  }

  function notePreviewFailure(kind) {
    if (kind !== "busy" && kind !== "permission" && kind !== "unavailable") return
    root.previewError = kind
    root.previewActive = false
    root.releasePreviewedDevice()
  }

  function setPreviewActive(active) {
    if (typeof Model === "undefined" || typeof Model.parseFlag !== "function") return
    var flag = Model.parseFlag(active)
    if (flag === null) return
    if (flag) {
      if (!popup.open) {
        root.open()
      }
      root.startPreview()
    } else {
      root.stopPreview()
    }
  }

  function setMirror(enabled) {
    if (typeof Model === "undefined" || typeof Model.parseFlag !== "function") return
    var flag = Model.parseFlag(enabled)
    if (flag === null) return
    root.mirrorPreview = flag
  }

  function getPreview() {
    return popup.previewState
  }

  function getMirror() {
    return root.mirrorPreview ? "1" : "0"
  }
  function toggle() {
    if (popup.open) close()
    else open()
  }

  function triggerPress(button) { root.toggle() }

  function getCtrl(name) {
    if (name === "logitech_brio_fov") {
      if (root.pendingFov !== null) {
        return String(root.pendingFov)
      }
      if (root.fovControl && root.fovControl.logitech_brio_fov !== undefined) {
        return String(root.fovControl.logitech_brio_fov)
      }
      return "65"
    }
    if (root.controls && root.controls[name] && root.controls[name].value !== undefined) {
      return String(root.controls[name].value)
    }
    if (typeof Model !== "undefined" && Model.CONTROLS && Model.CONTROLS[name] && Model.CONTROLS[name].defaultVal !== undefined) {
      return String(Model.CONTROLS[name].defaultVal)
    }
    return ""
  }

  function setCtrl(name, value) {
    root.setControl(name, value)
  }

  function getCaptureMode() {
    if (root.captureMode && root.captureMode.width !== undefined && root.captureMode.height !== undefined) {
      var fpsStr = root.captureMode.fps !== undefined ? ("@" + root.captureMode.fps) : ""
      var pfStr = root.captureMode.pixelformat ? (" " + root.captureMode.pixelformat) : ""
      return root.captureMode.width + "x" + root.captureMode.height + fpsStr + pfStr
    }
    return ""
  }

  function setCaptureMode(width, height, fps) {
    if (typeof Model === "undefined" || typeof Model.pickCaptureMode !== "function") return
    var picked = Model.pickCaptureMode(root.captureFormats, root.captureMode, width, height, fps)
    if (!picked) return
    root.listGeneration++
    root.pendingCaptureCount++
    root.captureMode = picked
    var cmd = (typeof Model.buildV4l2SetCaptureModeCommand === "function")
      ? Model.buildV4l2SetCaptureModeCommand(root.device, picked)
      : ["v4l2-ctl", "-d", root.device, "--set-fmt-video=width=" + picked.width + ",height=" + picked.height + ",pixelformat=" + picked.pixelformat, "--set-parm=" + picked.fps]
    queueCommand(cmd, "capture", root.device)
  }

  function setCaptureModeFromIpc(resolution, fps) {
    if (!resolution || !/^\d+x\d+$/.test(resolution)) return
    var parts = resolution.split("x")
    var w = parseInt(parts[0], 10)
    var h = parseInt(parts[1], 10)
    if (w <= 0 || h <= 0) return

    var f = undefined
    if (fps !== undefined && fps !== null && fps !== "") {
      var parsedFps = Number(fps)
      if (!isFinite(parsedFps) || isNaN(parsedFps) || parsedFps <= 0) {
        return
      }
      f = parsedFps
    }
    root.setCaptureMode(w, h, f)
  }

  function reapplyCaptureMode() {
    if (!root.devicePresent || root.permissionDenied) return
    if (!root.captureMode || root.captureMode.width === undefined || root.captureMode.height === undefined) return
    var mode = {
      width: root.captureMode.width,
      height: root.captureMode.height,
      pixelformat: root.captureMode.pixelformat || "MJPG",
      fps: root.captureMode.fps !== undefined ? root.captureMode.fps : 30
    }
    var cmd = (typeof Model !== "undefined" && typeof Model.buildV4l2SetCaptureModeCommand === "function")
      ? Model.buildV4l2SetCaptureModeCommand(root.device, mode)
      : ["v4l2-ctl", "-d", root.device, "--set-fmt-video=width=" + mode.width + ",height=" + mode.height + ",pixelformat=" + mode.pixelformat, "--set-parm=" + mode.fps]
    root.pendingCaptureCount++
    queueCommand(cmd, "capture", root.device)
  }

  function queueCommand(cmd, kind, device) {
    if (!cmd || !cmd.length) return
    var entry = { cmd: cmd, kind: kind || "control" }
    if (device) entry.device = device
    commandQueue.push(entry)
    pumpCommandQueue()
  }

  function pumpCommandQueue() {
    if (cmdExecProc.running || commandQueue.length === 0) return
    var nextItem = commandQueue[0]
    var nextKind = Array.isArray(nextItem) ? "control" : (nextItem.kind || "control")
    if (nextKind === "capture" && popup.cameraActive) {
      return
    }
    var item = commandQueue.shift()
    var baseCmd = Array.isArray(item) ? item : item.cmd
    var kind = Array.isArray(item) ? "control" : (item.kind || "control")
    cmdExecProc.currentKind = kind
    if (kind === "capture") {
      var targetDev = (!Array.isArray(item) && item.device) ? item.device : root.device
      cmdExecProc.currentDevice = targetDev
      cmdExecProc.command = ["sh", "-c", "for i in $(seq 1 15); do if ! fuser \"$1\" >/dev/null 2>&1; then break; fi; sleep 0.05; done; shift; exec \"$@\"", "--", targetDev].concat(baseCmd)
    } else {
      cmdExecProc.currentDevice = ""
      cmdExecProc.command = baseCmd
    }
    cmdExecProc.running = true
  }

  function setControl(name, value) {
    if (name === "mirror" || name === "hflip" || name === "vflip" || name === "horizontal_flip") return
    var numVal = Number(value)
    if (name === "logitech_brio_fov") {
      if (!root.fovAvailable) {
        if (root.hasCameractrls && cameractrlsListProc.running) {
          root.pendingFov = numVal
        }
        return
      }
      root.listGeneration++
      root.fovControl = { logitech_brio_fov: numVal }
      var fovCmd = (typeof Model !== "undefined" && typeof Model.buildFovSetCommand === "function")
        ? Model.buildFovSetCommand(root.device, numVal)
        : ["cameractrls", "-d", root.device, "-c", "logitech_brio_fov=" + numVal]
      queueCommand(fovCmd)
      return
    }

    root.listGeneration++
    var updated = Object.assign({}, root.controls)
    if (!updated[name]) {
      updated[name] = { name: name, value: numVal }
    } else {
      updated[name] = Object.assign({}, updated[name], { value: numVal })
    }
    root.controls = updated

    var v4l2Cmd = (typeof Model !== "undefined" && typeof Model.buildV4l2SetCommand === "function")
      ? Model.buildV4l2SetCommand(root.device, name, numVal)
      : ["v4l2-ctl", "-d", root.device, "--set-ctrl", name + "=" + numVal]
    queueCommand(v4l2Cmd)
  }

  function resetDefaults() {
    if (!root.device) return
    root.listGeneration++
    var copy = Object.assign({}, root.controls)
    if (root.fovAvailable && typeof Model !== "undefined" && Model.CONTROLS && Model.CONTROLS.logitech_brio_fov) {
      var fovDef = Model.CONTROLS.logitech_brio_fov.defaultVal
      copy.logitech_brio_fov = {
        name: "logitech_brio_fov",
        backend: "cameractrls",
        defaultVal: fovDef,
        default: fovDef
      }
    }
    if (!root.fovAvailable && root.hasCameractrls && cameractrlsListProc.running
        && typeof Model !== "undefined" && Model.CONTROLS && Model.CONTROLS.logitech_brio_fov) {
      root.pendingFov = Model.CONTROLS.logitech_brio_fov.defaultVal
    }
    var cmds = (typeof Model !== "undefined" && typeof Model.buildResetCommands === "function")
      ? Model.buildResetCommands(root.device, copy)
      : []
    for (var i = 0; i < cmds.length; i++) {
      var cmd = cmds[i]
      if (cmd && cmd[0] === "cameractrls" && !root.fovAvailable) continue
      queueCommand(cmd)
    }
    var updated = Object.assign({}, root.controls)
    for (var k in copy) {
      var entry = copy[k]
      if (!entry) continue
      var def = entry.defaultVal !== undefined ? entry.defaultVal : entry.default
      if (def === undefined) continue
      if (k === "logitech_brio_fov") {
        if (root.fovAvailable) root.fovControl = { logitech_brio_fov: def }
        continue
      }
      if (!updated[k]) updated[k] = { name: k }
      updated[k] = Object.assign({}, updated[k], { value: def })
    }
    root.controls = updated
  }

  function refresh() {
    if (!v4l2DevicesProc.running) v4l2DevicesProc.running = true
    if (!detectCameractrlsProc.running) detectCameractrlsProc.running = true
    if (root.device !== "") root.startDeviceCheck()
  }

  function readControls() {
    if (!root.devicePresent || root.permissionDenied) return
    var v4l2Busy = v4l2ListProc.running
    var fovBusy = root.fovAvailable && cameractrlsListProc.running
    if (v4l2Busy || fovBusy) {
      root.refreshPending = true
      return
    }

    if (!v4l2ListProc.running) {
      v4l2ListProc.queryGeneration = root.listGeneration
      v4l2ListProc.queryDevice = root.device
      v4l2ListProc.running = true
    }
    if (popup.open && root.fovAvailable && !cameractrlsListProc.running) {
      cameractrlsListProc.queryGeneration = root.listGeneration
      cameractrlsListProc.queryDevice = root.device
      cameractrlsListProc.running = true
    }
  }

  function applyDevices(list) {
    var devices = list || []
    root.discoveredDevices = devices
    var selected = null
    if (typeof Model !== "undefined" && typeof Model.selectActiveDevice === "function") {
      selected = Model.selectActiveDevice(devices, root.device)
    }
    if (!selected) {
      root.listGeneration++
      root.commandQueue = root.commandQueue.filter(function (it) { return !Array.isArray(it) && it.kind === "capture" })
      root.previewActive = false
      root.previewError = ""
      root.releasePreviewedDevice()
      root.device = ""
      root.modelName = "No camera connected"
      root.devicePresent = false
      root.permissionDenied = false
      root.controls = ({})
      root.fovControl = ({})
      root.fovAvailable = false
      root.pendingFov = null
      root.captureMode = ({})
      root.captureFormats = []
      root.captureFormatsQueried = false
      root.captureBusy = false
      return
    }
    if (selected.path === root.device) {
      root.modelName = selected.card || selected.name || root.modelName
      if (!root.isDragging) root.readControls()
      return
    }
    root.switchTo(selected)
  }

  function switchTo(deviceObj) {
    if (!deviceObj || !deviceObj.path) return
    root.listGeneration++
    root.commandQueue = root.commandQueue.filter(function (it) { return !Array.isArray(it) && it.kind === "capture" })
    root.previewActive = false
    root.previewError = ""
    root.releasePreviewedDevice()
    root.device = deviceObj.path
    root.modelName = deviceObj.card || deviceObj.name || "No camera connected"
    root.permissionDenied = false
    root.devicePresent = false
    root.controls = ({})
    root.fovControl = ({})
    root.fovAvailable = false
    root.pendingFov = null
    root.captureMode = ({})
    root.captureFormats = []
    root.captureFormatsQueried = false
    root.captureBusy = false
    root.startDeviceCheck()
  }

  function startDeviceCheck() {
    if (root.device === "") return
    if (checkDeviceProc.running) return
    checkDeviceProc.queryDevice = root.device
    checkDeviceProc.running = true
  }

  function getDevice() {
    return root.device
  }

  function setDevice(path) {
    if (!path || path === root.device) return
    var list = root.discoveredDevices || []
    for (var i = 0; i < list.length; i++) {
      var d = list[i]
      if (d && d.path === path) {
        root.switchTo(d)
        return
      }
    }
  }

  function listDevices() {
    var list = root.discoveredDevices || []
    var out = []
    for (var i = 0; i < list.length; i++) {
      var d = list[i]
      if (!d) continue
      out.push({ path: d.path, name: d.name || d.card || "" })
    }
    return JSON.stringify(out)
  }

  IpcHandler {
    target: "abduldotdev.camera"

    function open() { root.open() }
    function close() { root.close() }
    function toggle() { root.toggle() }
    function resetDefaults() { root.resetDefaults() }
    function getCtrl(name: string): string { return root.getCtrl(name) }
    function setCtrl(name: string, value: string) { root.setCtrl(name, value) }
    function getCaptureMode(): string { return root.getCaptureMode() }
    function setCaptureMode(resolution: string, fps: string) { root.setCaptureModeFromIpc(resolution, fps) }
    function getDevice(): string { return root.getDevice() }
    function setDevice(path: string) { root.setDevice(path) }
    function listDevices(): string { return root.listDevices() }
    function getPreview(): string { return root.getPreview() }
    function setPreviewActive(active: string) { root.setPreviewActive(active) }
    function getMirror(): string { return root.getMirror() }
    function setMirror(enabled: string) { root.setMirror(enabled) }
  }

  Process {
    id: v4l2DevicesProc
    property string stdoutText: ""
    command: (typeof Model !== "undefined" && typeof Model.buildV4l2DevicesCommand === "function")
      ? Model.buildV4l2DevicesCommand()
      : ["sh", "-c", "exit 1"]
    stdout: StdioCollector {
      id: v4l2DevicesOut
      waitForEnd: true
      onStreamFinished: v4l2DevicesProc.stdoutText = text
    }
    onExited: function(exitCode) {
      var raw = v4l2DevicesProc.stdoutText || v4l2DevicesOut.text || ""
      v4l2DevicesProc.stdoutText = ""
      if (exitCode !== 0 && raw === "") {
        root.applyDevices([])
        return
      }
      var list = []
      if (typeof Model !== "undefined" && typeof Model.parseV4l2Devices === "function") {
        list = Model.parseV4l2Devices(raw)
      }
      root.applyDevices(list || [])
    }
  }

  Process {
    id: checkDeviceProc
    property string queryDevice: ""
    command: ["sh", "-c", "test -e \"$1\" || exit 2; test -r \"$1\" && test -w \"$1\" || exit 3; exit 0", "--", root.device]
    onExited: function(exitCode) {
      if (checkDeviceProc.queryDevice !== root.device) {
        root.startDeviceCheck()
        return
      }
      root.devicePresent = (exitCode === 0 || exitCode === 3)
      root.permissionDenied = (exitCode === 3)
      if (root.devicePresent && !root.permissionDenied) {
        if (!root.captureFormatsQueried && !v4l2FormatsProc.running) {
          root.captureFormatsQueried = true
          v4l2FormatsProc.queryDevice = root.device
          v4l2FormatsProc.running = true
        }
        if (root.hasCameractrls && !root.fovAvailable && !cameractrlsListProc.running) {
          cameractrlsListProc.queryGeneration = root.listGeneration
          cameractrlsListProc.queryDevice = root.device
          cameractrlsListProc.running = true
        }
        root.readControls()
      } else {
        root.previewActive = false
        root.previewError = ""
        root.fovAvailable = false
        root.pendingFov = null
        root.captureFormats = []
        root.captureFormatsQueried = false
        root.captureMode = ({})
        root.captureBusy = false
        root.pendingCaptureCount = 0
        root.commandQueue = []
        root.previewWasActiveDuringSession = false
      }
    }
  }

  Process {
    id: detectCameractrlsProc
    command: ["sh", "-c", "command -v cameractrls"]
    onExited: function(exitCode) {
      root.hasCameractrls = (exitCode === 0)
      if (root.hasCameractrls && root.devicePresent && (!root.fovAvailable || popup.open)) {
        if (!cameractrlsListProc.running) {
          cameractrlsListProc.queryGeneration = root.listGeneration
          cameractrlsListProc.queryDevice = root.device
          cameractrlsListProc.running = true
        }
      } else if (exitCode !== 0) {
        root.fovAvailable = false
        root.pendingFov = null
      }
    }
  }

  Process {
    id: v4l2FormatsProc
    property string queryDevice: ""
    command: (typeof Model !== "undefined" && typeof Model.buildV4l2ListFormatsCommand === "function")
      ? Model.buildV4l2ListFormatsCommand(root.device)
      : ["v4l2-ctl", "-d", root.device, "--list-formats-ext"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (v4l2FormatsProc.queryDevice !== root.device) return
        if (text && typeof Model !== "undefined" && typeof Model.parseV4l2Formats === "function") {
          var fmts = Model.parseV4l2Formats(text)
          if (fmts && fmts.length > 0) {
            root.captureFormats = fmts
          }
        }
      }
    }
    onExited: {
      if (v4l2FormatsProc.queryDevice !== root.device) {
        root.captureFormatsQueried = false
        if (root.device !== "" && root.devicePresent && !root.permissionDenied && !v4l2FormatsProc.running) {
          root.captureFormatsQueried = true
          v4l2FormatsProc.queryDevice = root.device
          v4l2FormatsProc.running = true
        }
      }
    }
  }

  Process {
    id: v4l2ListProc
    property int queryGeneration: 0
    property string queryDevice: ""
    command: (typeof Model !== "undefined" && typeof Model.buildV4l2ListCommand === "function")
      ? Model.buildV4l2ListCommand(root.device)
      : ["v4l2-ctl", "-d", root.device, "--get-fmt-video", "--get-parm", "--list-ctrls-menus"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (v4l2ListProc.queryGeneration !== root.listGeneration) {
          return
        }
        if (v4l2ListProc.queryDevice !== root.device) {
          return
        }
        if (text && typeof Model !== "undefined" && typeof Model.parseV4l2Ctrls === "function") {
          var parsed = Model.parseV4l2Ctrls(text)
          if (parsed && Object.keys(parsed).length > 0) {
            root.controls = parsed
            root.devicePresent = true
          }
        }
        if (text && typeof Model !== "undefined" && typeof Model.parseV4l2CaptureMode === "function") {
          var parsedMode = Model.parseV4l2CaptureMode(text)
          if (parsedMode && parsedMode.width !== undefined) {
            if (!popup.cameraActive || root.captureMode.width === undefined) {
              root.captureMode = parsedMode
            }
          }
        }
      }
    }
    onExited: function(exitCode) {
      var sameRead = v4l2ListProc.queryDevice === root.device && v4l2ListProc.queryGeneration === root.listGeneration
      if (sameRead && exitCode !== 0) {
        root.devicePresent = false
        root.previewActive = false
        root.previewError = ""
      }
      if (root.refreshPending && !cameractrlsListProc.running) {
        root.refreshPending = false
        root.readControls()
      }
    }
  }

  Process {
    id: cameractrlsListProc
    property int queryGeneration: 0
    property string queryDevice: ""
    property bool foundFov: false
    command: (typeof Model !== "undefined" && typeof Model.buildFovListCommand === "function")
      ? Model.buildFovListCommand(root.device)
      : ["cameractrls", "-d", root.device, "-l"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        cameractrlsListProc.foundFov = false
        if (text && typeof Model !== "undefined" && typeof Model.parseCameractrls === "function") {
          var parsed = Model.parseCameractrls(text)
          if (parsed && parsed.logitech_brio_fov !== undefined) {
            cameractrlsListProc.foundFov = true
            if (cameractrlsListProc.queryDevice === root.device && cameractrlsListProc.queryGeneration === root.listGeneration) {
              root.fovControl = parsed
            }
          }
        }
      }
    }
    onExited: function(exitCode) {
      var sameDevice = cameractrlsListProc.queryDevice === root.device
      if (exitCode === 0 && cameractrlsListProc.foundFov) {
        if (sameDevice) {
          root.fovAvailable = true
          if (root.pendingFov !== null) {
            var val = root.pendingFov
            root.pendingFov = null
            root.setControl("logitech_brio_fov", val)
          }
        }
      } else if (sameDevice && cameractrlsListProc.queryGeneration === root.listGeneration) {
        root.fovAvailable = false
        root.pendingFov = null
      }
      if (root.refreshPending && !v4l2ListProc.running) {
        root.refreshPending = false
        root.readControls()
      }
    }
  }

  Process {
    id: cmdExecProc
    property string currentKind: ""
    property string currentDevice: ""
    onExited: function(exitCode) {
      if (cmdExecProc.currentKind === "capture") {
        root.pendingCaptureCount = Math.max(0, root.pendingCaptureCount - 1)
        if (cmdExecProc.currentDevice === root.device) {
          if (exitCode !== 0) {
            root.captureBusy = true
          } else {
            root.captureBusy = false
          }
        }
      }
      if (root.commandQueue.length > 0) {
        root.pumpCommandQueue()
      } else {
        root.readControls()
      }
    }
  }

  Timer {
    interval: 15000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  Timer {
    interval: 3000
    repeat: true
    running: popup.open && !root.isDragging
    onTriggered: if (root.devicePresent && !root.permissionDenied) root.readControls()
  }

  Grid {
    id: row
    anchors.centerIn: parent
    columns: 1

    Text {
      text: "󰄀"
      color: root.iconColor
      font.family: bar ? bar.fontFamily : "monospace"
      font.pixelSize: 14
      opacity: root.devicePresent ? 1.0 : 0.4
      horizontalAlignment: Text.AlignHCenter
    }
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton
    onClicked: function(mouse) {
      if (mouse.button === Qt.RightButton) {
        root.resetDefaults()
      } else {
        root.toggle()
      }
    }
  }

  CameraPopup {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    devicePresent: root.devicePresent
    permissionDenied: root.permissionDenied
    hasCameractrls: root.hasCameractrls
    fovAvailable: root.fovAvailable
    controls: root.controls
    fovControl: root.fovControl
    captureMode: root.captureMode
    captureFormats: root.captureFormats
    captureBusy: root.captureBusy
    previewPaused: root.previewPaused
    previewActive: root.previewActive
    mirrorPreview: root.mirrorPreview
    previewError: root.previewError
    modelName: root.modelName
    devicePath: root.device
    discoveredDevices: root.discoveredDevices
    onDeviceChangeRequested: function(path) { root.setDevice(path) }
    onPreviewStartRequested: root.startPreview()
    onPreviewStopRequested: root.stopPreview()
    onMirrorChangeRequested: function(enabled) { root.mirrorPreview = enabled }
    onPreviewFailed: function(kind) { root.notePreviewFailure(kind) }
    onOpenChanged: {
      if (!popup.open) {
        root.previewActive = false
        root.previewError = ""
        root.captureBusy = false
        root.releasePreviewedDevice()
      }
    }
    onCameraActiveChanged: {
      if (popup.cameraActive) {
        root.previewWasActiveDuringSession = true
      }
      root.pumpCommandQueue()
    }
    onRefreshRequested: root.refresh()
    onControlChanged: function(name, val) { root.setControl(name, val) }
    onCaptureModeRequested: function(w, h, fps) { root.setCaptureMode(w, h, fps) }
    onResetRequested: root.resetDefaults()
    onIsDraggingChanged: root.isDragging = popup.isDragging
  }

  Component.onCompleted: root.refresh()
}
