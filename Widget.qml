import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  property var bar
  property string moduleName: "abdul891.camera"
  property var settings

  readonly property bool vertical: bar ? bar.vertical : false
  implicitWidth: vertical ? (bar ? bar.barSize : 26) : row.implicitWidth + 14
  implicitHeight: vertical ? row.implicitHeight + 10 : (bar ? bar.barSize : 26)

  function luminance(c) { return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b }
  readonly property color iconColor: bar
    ? (luminance(bar.background) > 0.6 ? "#1a1a1a" : bar.foreground)
    : "white"

  property string device: (typeof Model !== "undefined" && Model.DEFAULT_DEVICE) ? Model.DEFAULT_DEVICE : "/dev/video0"
  property bool devicePresent: false
  property bool hasCameractrls: false
  property bool fovAvailable: false
  property bool refreshPending: false
  property int listGeneration: 0
  property var pendingFov: null
  property var controls: ({})
  property var fovControl: ({})
  property var captureMode: ({})
  property var captureFormats: []
  property bool captureBusy: false
  property string modelName: "Logitech MX Brio"
  property var commandQueue: []
  property bool isDragging: false

  function close() {
    popup.open = false
    root.captureBusy = false
  }
  function open() {
    popup.open = true
    refresh()
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
    root.captureBusy = false
    root.captureMode = picked
    var cmd = (typeof Model.buildV4l2SetCaptureModeCommand === "function")
      ? Model.buildV4l2SetCaptureModeCommand(root.device, picked)
      : ["v4l2-ctl", "-d", root.device, "--set-fmt-video=width=" + picked.width + ",height=" + picked.height + ",pixelformat=" + picked.pixelformat, "--set-parm=" + picked.fps]
    queueCommand(cmd, "capture")
  }

  function setCaptureModeFromIpc(resolution, fps) {
    if (!resolution) return
    var parts = resolution.split("x")
    if (parts.length === 2) {
      var w = parseInt(parts[0], 10)
      var h = parseInt(parts[1], 10)
      var f = (fps !== undefined && fps !== null && fps !== "") ? parseFloat(fps) : undefined
      root.setCaptureMode(w, h, f)
    }
  }

  function queueCommand(cmd, kind) {
    if (!cmd || !cmd.length) return
    commandQueue.push({ cmd: cmd, kind: kind || "control" })
    pumpCommandQueue()
  }

  function pumpCommandQueue() {
    if (cmdExecProc.running || commandQueue.length === 0) return
    var item = commandQueue.shift()
    if (Array.isArray(item)) {
      cmdExecProc.currentKind = "control"
      cmdExecProc.command = item
    } else {
      cmdExecProc.currentKind = item.kind || "control"
      cmdExecProc.command = item.cmd
    }
    cmdExecProc.running = true
  }

  function setControl(name, value) {
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
    root.listGeneration++
    var cmds = (typeof Model !== "undefined" && typeof Model.buildResetCommands === "function")
      ? Model.buildResetCommands(root.device)
      : []
    for (var i = 0; i < cmds.length; i++) {
      var cmd = cmds[i]
      if (cmd && cmd[0] === "cameractrls" && !root.fovAvailable) {
        if (root.hasCameractrls && cameractrlsListProc.running) {
          root.pendingFov = 65
        }
        continue
      }
      queueCommand(cmd)
    }
    if (typeof Model !== "undefined" && typeof Model.getDefaults === "function") {
      var defs = Model.getDefaults()
      var updated = Object.assign({}, root.controls)
      for (var k in defs) {
        if (k === "logitech_brio_fov") {
          if (root.fovAvailable) {
            root.fovControl = { logitech_brio_fov: defs[k] }
          } else if (root.hasCameractrls && cameractrlsListProc.running) {
            root.pendingFov = defs[k]
          }
        } else {
          if (!updated[k]) updated[k] = { name: k }
          updated[k] = Object.assign({}, updated[k], { value: defs[k] })
        }
      }
      root.controls = updated
    }
  }

  function refresh() {
    if (!checkDeviceProc.running) checkDeviceProc.running = true
    if (!detectCameractrlsProc.running) detectCameractrlsProc.running = true
  }

  function readControls() {
    if (!root.devicePresent) return
    var v4l2Busy = v4l2ListProc.running
    var fovBusy = root.fovAvailable && cameractrlsListProc.running
    if (v4l2Busy || fovBusy) {
      root.refreshPending = true
      return
    }

    if (!v4l2ListProc.running) {
      v4l2ListProc.queryGeneration = root.listGeneration
      v4l2ListProc.running = true
    }
    if (popup.open && root.fovAvailable && !cameractrlsListProc.running) {
      cameractrlsListProc.queryGeneration = root.listGeneration
      cameractrlsListProc.running = true
    }
  }

  IpcHandler {
    target: "abdul891.camera"

    function open() { root.open() }
    function close() { root.close() }
    function toggle() { root.toggle() }
    function resetDefaults() { root.resetDefaults() }
    function getCtrl(name: string): string { return root.getCtrl(name) }
    function setCtrl(name: string, value: string) { root.setCtrl(name, value) }
    function getCaptureMode(): string { return root.getCaptureMode() }
    function setCaptureMode(resolution: string, fps: string) { root.setCaptureModeFromIpc(resolution, fps) }
  }

  Process {
    id: checkDeviceProc
    command: ["test", "-e", root.device]
    onExited: function(exitCode) {
      root.devicePresent = (exitCode === 0)
      if (root.devicePresent) {
        if (root.captureFormats.length === 0 && !v4l2FormatsProc.running) {
          v4l2FormatsProc.running = true
        }
        if (root.hasCameractrls && !root.fovAvailable && !cameractrlsListProc.running) {
          cameractrlsListProc.queryGeneration = root.listGeneration
          cameractrlsListProc.running = true
        }
        root.readControls()
      } else {
        root.fovAvailable = false
        root.pendingFov = null
        root.captureFormats = []
        root.captureMode = ({})
        root.captureBusy = false
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
    command: (typeof Model !== "undefined" && typeof Model.buildV4l2ListFormatsCommand === "function")
      ? Model.buildV4l2ListFormatsCommand(root.device)
      : ["v4l2-ctl", "-d", root.device, "--list-formats-ext"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (text && typeof Model !== "undefined" && typeof Model.parseV4l2Formats === "function") {
          var fmts = Model.parseV4l2Formats(text)
          if (fmts && fmts.length > 0) {
            root.captureFormats = fmts
          }
        }
      }
    }
  }

  Process {
    id: v4l2ListProc
    property int queryGeneration: 0
    command: (typeof Model !== "undefined" && typeof Model.buildV4l2ListCommand === "function")
      ? Model.buildV4l2ListCommand(root.device)
      : ["v4l2-ctl", "-d", root.device, "--get-fmt-video", "--get-parm", "--list-ctrls-menus"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (v4l2ListProc.queryGeneration !== root.listGeneration) {
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
            root.captureMode = parsedMode
          }
        }
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.devicePresent = false
      if (root.refreshPending && !cameractrlsListProc.running) {
        root.refreshPending = false
        root.readControls()
      }
    }
  }

  Process {
    id: cameractrlsListProc
    property int queryGeneration: 0
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
            if (cameractrlsListProc.queryGeneration === root.listGeneration) {
              root.fovControl = parsed
            }
          }
        }
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0 || !cameractrlsListProc.foundFov) {
        root.fovAvailable = false
        root.pendingFov = null
      } else {
        root.fovAvailable = true
        if (root.pendingFov !== null) {
          var val = root.pendingFov
          root.pendingFov = null
          root.setControl("logitech_brio_fov", val)
        }
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
    onExited: function(exitCode) {
      if (cmdExecProc.currentKind === "capture") {
        if (exitCode !== 0) {
          root.captureBusy = true
        } else {
          root.captureBusy = false
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
    onTriggered: if (root.devicePresent) root.readControls()
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
    hasCameractrls: root.hasCameractrls
    fovAvailable: root.fovAvailable
    controls: root.controls
    fovControl: root.fovControl
    captureMode: root.captureMode
    captureFormats: root.captureFormats
    captureBusy: root.captureBusy
    modelName: root.modelName
    devicePath: root.device
    onOpenChanged: {
      if (!popup.open) {
        root.captureBusy = false
      }
    }
    onRefreshRequested: root.refresh()
    onControlChanged: function(name, val) { root.setControl(name, val) }
    onCaptureModeChanged: function(w, h, fps) { root.setCaptureMode(w, h, fps) }
    onResetRequested: root.resetDefaults()
    onIsDraggingChanged: root.isDragging = popup.isDragging
  }

  Component.onCompleted: root.refresh()
}
