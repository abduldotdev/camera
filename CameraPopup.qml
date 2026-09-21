import QtQuick
import Quickshell
import Quickshell.Hyprland
import qs.Commons
import qs.Ui
import "Model.js" as Model

PopupWindow {
  id: root

  required property Item anchorItem
  required property QtObject bar
  property var owner: null
  property bool open: false
  property bool devicePresent: false
  property bool hasCameractrls: false
  property bool fovAvailable: false
  property var controls: ({})
  property var fovControl: ({})
  property string modelName: "Logitech MX Brio"
  property string devicePath: "/dev/video0"
  property bool isDragging: false

  signal refreshRequested()
  signal controlChanged(string name, var value)
  signal resetRequested()

  readonly property var coordinatorKey: owner || root
  readonly property var anchorWindow: anchorItem ? anchorItem.QsWindow.window : null
  readonly property color bg: Color.popups.background
  property color borderColor: Color.popups.border
  property var borderSpec: Border.localOrSurfaceSpec("popups", "border", borderColor, Color.popups.border, Math.max(1, Style.space(2)))
  readonly property color accent: Color.accent
  readonly property color muted: Color.muted
  readonly property color urgent: Color.urgent

  function luminance(c) { return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b }
  readonly property color fg: luminance(bg) > 0.6 ? "#1a1a1a" : Color.popups.text
  readonly property color safeMuted: luminance(bg) > 0.6 ? "#5a5a5a" : Qt.rgba(fg.r, fg.g, fg.b, 0.72)
  readonly property string fontFamily: bar ? bar.fontFamily : "monospace"

  property int margin: Style.gapsOut
  property int cardPadding: Style.spacing.popupPadding

  implicitWidth: 380
  implicitHeight: 560

  visible: open || card.opacity > 0
  color: "transparent"

  function close() { root.open = false }

  onOpenChanged: {
    if (!bar) return
    if (open) bar.requestPopout(coordinatorKey)
    else if (bar.activePopout === coordinatorKey) bar.releasePopout(coordinatorKey)
  }

  HyprlandFocusGrab {
    active: root.open
    windows: root.anchorWindow ? [root, root.anchorWindow] : [root]
    onCleared: root.close()
  }

  anchor {
    id: popupAnchor
    window: root.anchorWindow
    adjustment: PopupAdjustment.Slide
    edges: Edges.Top | Edges.Left
    gravity: Edges.Bottom | Edges.Right
    rect.width: 1
    rect.height: 1

    onAnchoring: {
      if (!root.anchorItem || !root.bar || !root.anchorWindow) return

      var target = root.anchorItem
      var win = root.anchorWindow
      var w = root.implicitWidth
      var h = root.implicitHeight
      var posX = 0
      var posY = 0

      if (root.bar.position === "bottom") {
        var localX = target.width / 2 - w / 2
        var point = win.contentItem.mapFromItem(target, localX, 0)
        posX = Math.max(root.margin, Math.min(point.x, win.width - w - root.margin))
        posY = -(h + root.margin)
      } else if (root.bar.position === "left") {
        var localY = target.height / 2 - h / 2
        var point = win.contentItem.mapFromItem(target, 0, localY)
        posX = win.width + root.margin
        posY = Math.max(root.margin, Math.min(point.y, win.height - h - root.margin))
      } else if (root.bar.position === "right") {
        var localY = target.height / 2 - h / 2
        var point = win.contentItem.mapFromItem(target, 0, localY)
        posX = -(w + root.margin)
        posY = Math.max(root.margin, Math.min(point.y, win.height - h - root.margin))
      } else {
        var localX = target.width / 2 - w / 2
        var point = win.contentItem.mapFromItem(target, localX, 0)
        posX = Math.max(root.margin, Math.min(point.x, win.width - w - root.margin))
        posY = win.height + root.margin
      }

      popupAnchor.rect.x = Math.round(posX)
      popupAnchor.rect.y = Math.round(posY)
    }
  }

  function getVal(name, defaultVal) {
    if (root.controls && root.controls[name] && root.controls[name].value !== undefined) {
      return root.controls[name].value
    }
    return defaultVal
  }

  function getMeta(name, field, fallback) {
    if (root.controls && root.controls[name] && root.controls[name][field] !== undefined) {
      return root.controls[name][field]
    }
    if (typeof Model !== "undefined" && Model.CONTROLS && Model.CONTROLS[name] && Model.CONTROLS[name][field] !== undefined) {
      return Model.CONTROLS[name][field]
    }
    return fallback
  }

  function isInactive(name) {
    if (root.controls && root.controls[name] && root.controls[name].inactive !== undefined) {
      return !!root.controls[name].inactive
    }
    if (typeof Model !== "undefined" && typeof Model.isControlActive === "function") {
      var vals = {}
      for (var k in root.controls) {
        if (root.controls[k] && root.controls[k].value !== undefined) {
          vals[k] = root.controls[k].value
        }
      }
      return !Model.isControlActive(name, vals)
    }
    return false
  }

  component CameraSlider: Column {
    id: cs
    property string label: ""
    property string unit: ""
    property real minimum: 0
    property real maximum: 255
    property real step: 1
    property real value: 0
    property bool controlEnabled: true
    property string disabledHint: "Controlled automatically"
    signal committed(real val)

    property real liveVal: value
    onValueChanged: if (!slider.dragging) liveVal = value

    width: parent.width
    spacing: 3

    Timer {
      id: debounceTimer
      interval: 150
      repeat: false
      onTriggered: cs.committed(cs.liveVal)
    }

    Row {
      width: parent.width

      Text {
        text: cs.label
        color: cs.controlEnabled ? root.fg : root.safeMuted
        font.family: root.fontFamily
        font.pixelSize: 12
        font.bold: true
        anchors.verticalCenter: parent.verticalCenter
        width: parent.width - valText.implicitWidth
      }

      Text {
        id: valText
        text: !cs.controlEnabled && cs.disabledHint !== ""
          ? cs.disabledHint
          : (Math.round(cs.liveVal) + (cs.unit ? (" " + cs.unit) : ""))
        color: root.safeMuted
        font.family: root.fontFamily
        font.pixelSize: 11
        anchors.verticalCenter: parent.verticalCenter
      }
    }

    PanelSlider {
      id: slider
      width: parent.width
      bar: root.bar
      enabled: cs.controlEnabled
      opacity: cs.controlEnabled ? 1.0 : 0.4
      minimum: cs.minimum
      maximum: cs.maximum
      step: cs.step
      integer: true
      value: cs.value

      onMoved: function(v) {
        cs.liveVal = Math.round(v)
        root.isDragging = true
        debounceTimer.restart()
      }
      onReleased: function(v) {
        debounceTimer.stop()
        root.isDragging = false
        cs.liveVal = Math.round(v)
        cs.committed(cs.liveVal)
      }
    }
  }

  component CameraToggle: Row {
    id: ct
    property string label: ""
    property bool checked: false
    property bool controlEnabled: true
    signal toggled()

    width: parent.width
    height: Math.max(toggleText.implicitHeight, toggleSwitch.implicitHeight)

    Text {
      id: toggleText
      text: ct.label
      color: ct.controlEnabled ? root.fg : root.safeMuted
      font.family: root.fontFamily
      font.pixelSize: 12
      font.bold: true
      anchors.verticalCenter: parent.verticalCenter
      width: parent.width - toggleSwitch.width
    }

    ToggleSwitch {
      id: toggleSwitch
      checked: ct.checked
      enabled: ct.controlEnabled
      opacity: ct.controlEnabled ? 1.0 : 0.4
      foreground: root.fg
      accent: root.accent
      anchors.verticalCenter: parent.verticalCenter
      onToggled: ct.toggled()
    }
  }

  component CameraSegmented: Column {
    id: cseg
    property string label: ""
    property var options: []
    property string value: ""
    property bool controlEnabled: true
    signal changed(string val)

    width: parent.width
    spacing: 4

    Text {
      text: cseg.label
      color: cseg.controlEnabled ? root.fg : root.safeMuted
      font.family: root.fontFamily
      font.pixelSize: 12
      font.bold: true
    }

    ButtonGroup {
      options: cseg.options
      value: cseg.value
      foreground: root.fg
      background: root.bg
      accent: root.accent
      fontFamily: root.fontFamily
      fontSize: 11
      onChanged: function(v) { cseg.changed(v) }
    }
  }

  component CameraPanTilt: Column {
    id: cpt
    property string label: ""
    property int value: 0
    property int step: 3600
    property int minimum: -72000
    property int maximum: 72000
    signal stepRequested(int nextVal)

    function snap(v) { var s = Math.max(1, cpt.step); return Math.max(cpt.minimum, Math.min(cpt.maximum, Math.round(v / s) * s)) }

    property int liveVal: value
    onValueChanged: if (!slider.dragging) liveVal = value

    width: parent.width
    spacing: 3

    Timer {
      id: debounceTimer
      interval: 150
      repeat: false
      onTriggered: cpt.stepRequested(cpt.liveVal)
    }

    Row {
      width: parent.width

      Text {
        text: cpt.label
        color: root.fg
        font.family: root.fontFamily
        font.pixelSize: 12
        font.bold: true
        anchors.verticalCenter: parent.verticalCenter
        width: parent.width - valLabel.implicitWidth
      }

      Text {
        id: valLabel
        text: cpt.liveVal > 0 ? ("+" + cpt.liveVal) : String(cpt.liveVal)
        color: root.safeMuted
        font.family: root.fontFamily
        font.pixelSize: 11
        anchors.verticalCenter: parent.verticalCenter
      }
    }

    PanelSlider {
      id: slider
      width: parent.width
      bar: root.bar
      minimum: cpt.minimum
      maximum: cpt.maximum
      step: cpt.step
      integer: true
      value: cpt.value

      onMoved: function(v) {
        cpt.liveVal = snap(v)
        root.isDragging = true
        debounceTimer.restart()
      }
      onReleased: function(v) {
        debounceTimer.stop()
        root.isDragging = false
        cpt.liveVal = snap(v)
        cpt.stepRequested(cpt.liveVal)
      }
    }

    Row {
      spacing: 8

      Button {
        text: " − "
        bordered: true
        foreground: root.fg
        background: root.bg
        accent: root.accent
        fontFamily: root.fontFamily
        fontSize: 12
        enabled: cpt.value > cpt.minimum
        onClicked: cpt.stepRequested(Math.max(cpt.minimum, cpt.value - cpt.step))
      }

      Button {
        text: " + "
        bordered: true
        foreground: root.fg
        background: root.bg
        accent: root.accent
        fontFamily: root.fontFamily
        fontSize: 12
        enabled: cpt.value < cpt.maximum
        onClicked: cpt.stepRequested(Math.min(cpt.maximum, cpt.value + cpt.step))
      }

      Button {
        text: "Center"
        bordered: true
        foreground: root.fg
        background: root.bg
        accent: root.accent
        fontFamily: root.fontFamily
        fontSize: 11
        visible: cpt.value !== 0
        onClicked: cpt.stepRequested(0)
      }
    }
  }

  BorderSurface {
    id: card
    anchors.fill: parent
    radius: Style.cornerRadius
    color: root.bg
    borderSpec: root.borderSpec
    padding: root.cardPadding
    opacity: root.open ? 1 : 0

    Behavior on opacity {
      NumberAnimation { duration: 130; easing.type: Easing.OutCubic }
    }

    Column {
      id: mainCol
      anchors.fill: parent
      anchors.topMargin: card.contentTopInset
      anchors.rightMargin: card.contentRightInset
      anchors.bottomMargin: card.contentBottomInset
      anchors.leftMargin: card.contentLeftInset
      spacing: 8

      // Header
      Item {
        id: headerItem
        width: parent.width
        height: Math.max(headerLabels.implicitHeight, resetBtn.implicitHeight)

        Row {
          id: headerLabels
          spacing: 8
          anchors.verticalCenter: parent.verticalCenter
          anchors.left: parent.left
          anchors.right: resetBtn.left
          anchors.rightMargin: 8

          Text {
            text: "󰄀"
            color: root.devicePresent ? root.accent : root.safeMuted
            font.family: root.fontFamily
            font.pixelSize: 18
            anchors.verticalCenter: parent.verticalCenter
          }

          Column {
            spacing: 1
            anchors.verticalCenter: parent.verticalCenter

            Text {
              text: root.modelName
              color: root.fg
              font.family: root.fontFamily
              font.pixelSize: 14
              font.bold: true
            }

            Text {
              text: root.devicePath + (root.devicePresent ? " · Connected" : " · Disconnected")
              color: root.devicePresent ? root.safeMuted : root.urgent
              font.family: root.fontFamily
              font.pixelSize: 10
            }
          }
        }

        Button {
          id: resetBtn
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: "Reset defaults"
          bordered: true
          visible: root.devicePresent
          foreground: root.fg
          background: root.bg
          accent: root.accent
          fontFamily: root.fontFamily
          fontSize: 11
          onClicked: root.resetRequested()
        }
      }

      PanelSeparator {
        foreground: root.fg
      }

      // Offline / Empty state
      Item {
        id: emptyState
        visible: !root.devicePresent
        width: parent.width
        height: parent.height - headerItem.height - 20

        Column {
          anchors.centerIn: parent
          spacing: 12

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "󰄀"
            color: root.safeMuted
            font.family: root.fontFamily
            font.pixelSize: 36
            opacity: 0.5
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "No camera connected"
            color: root.fg
            font.family: root.fontFamily
            font.pixelSize: 14
            font.bold: true
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Could not find video device at " + root.devicePath
            color: root.safeMuted
            font.family: root.fontFamily
            font.pixelSize: 11
          }

          Button {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Retry"
            bordered: true
            foreground: root.fg
            background: root.bg
            accent: root.accent
            fontFamily: root.fontFamily
            fontSize: 12
            onClicked: root.refreshRequested()
          }
        }
      }

      // Online controls flickable
      Flickable {
        id: flick
        visible: root.devicePresent
        width: parent.width
        height: parent.height - headerItem.height - 20
        contentWidth: width
        contentHeight: sectionsCol.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: sectionsCol
          width: flick.width - 6
          spacing: 10

          // 1. Framing & Optics
          PanelSectionHeader {
            text: "FRAMING & OPTICS"
            foreground: root.fg
            fontFamily: root.fontFamily
          }

          CameraSegmented {
            visible: root.fovAvailable
            label: "Field of View"
            options: [
              { value: "65", label: "65°" },
              { value: "78", label: "78°" },
              { value: "90", label: "90°" }
            ]
            value: (root.fovControl && root.fovControl.logitech_brio_fov !== undefined) ? String(root.fovControl.logitech_brio_fov) : "65"
            onChanged: function(v) { root.controlChanged("logitech_brio_fov", parseInt(v, 10)) }
          }

          CameraSlider {
            label: "Digital Zoom"
            unit: "%"
            minimum: 100
            maximum: 400
            step: 1
            value: root.getVal("zoom_absolute", 100)
            onCommitted: function(v) { root.controlChanged("zoom_absolute", v) }
          }

          CameraPanTilt {
            label: "Pan"
            value: root.getVal("pan_absolute", 0)
            minimum: root.getMeta("pan_absolute", "min", -72000)
            maximum: root.getMeta("pan_absolute", "max", 72000)
            step: root.getMeta("pan_absolute", "step", 3600)
            onStepRequested: function(v) { root.controlChanged("pan_absolute", v) }
          }

          CameraPanTilt {
            label: "Tilt"
            value: root.getVal("tilt_absolute", 0)
            minimum: root.getMeta("tilt_absolute", "min", -72000)
            maximum: root.getMeta("tilt_absolute", "max", 72000)
            step: root.getMeta("tilt_absolute", "step", 3600)
            onStepRequested: function(v) { root.controlChanged("tilt_absolute", v) }
          }

          PanelSeparator {
            foreground: root.fg
          }

          // 2. Focus
          PanelSectionHeader {
            text: "FOCUS"
            foreground: root.fg
            fontFamily: root.fontFamily
          }

          CameraToggle {
            label: "Autofocus"
            checked: root.getVal("focus_automatic_continuous", 1) === 1
            onToggled: root.controlChanged("focus_automatic_continuous", root.getVal("focus_automatic_continuous", 1) === 1 ? 0 : 1)
          }

          CameraSlider {
            label: "Manual Focus"
            controlEnabled: root.getVal("focus_automatic_continuous", 1) === 0 && !root.isInactive("focus_absolute")
            disabledHint: "Disabled while autofocus is on"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("focus_absolute", 0)
            onCommitted: function(v) { root.controlChanged("focus_absolute", v) }
          }

          PanelSeparator {
            foreground: root.fg
          }

          // 3. Exposure
          PanelSectionHeader {
            text: "EXPOSURE"
            foreground: root.fg
            fontFamily: root.fontFamily
          }

          CameraToggle {
            label: "Auto Exposure"
            checked: root.getVal("auto_exposure", 3) === 3
            onToggled: root.controlChanged("auto_exposure", root.getVal("auto_exposure", 3) === 3 ? 1 : 3)
          }

          CameraSlider {
            label: "Exposure Time"
            controlEnabled: root.getVal("auto_exposure", 3) === 1 && !root.isInactive("exposure_time_absolute")
            disabledHint: "Disabled while auto exposure is on"
            minimum: 3
            maximum: 2047
            step: 1
            value: root.getVal("exposure_time_absolute", 156)
            onCommitted: function(v) { root.controlChanged("exposure_time_absolute", v) }
          }

          CameraToggle {
            label: "Low-light Compensation (Dynamic Framerate)"
            checked: root.getVal("exposure_dynamic_framerate", 0) === 1
            onToggled: root.controlChanged("exposure_dynamic_framerate", root.getVal("exposure_dynamic_framerate", 0) === 1 ? 0 : 1)
          }

          CameraSlider {
            label: "Sensor Gain"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("gain", 0)
            onCommitted: function(v) { root.controlChanged("gain", v) }
          }

          PanelSeparator {
            foreground: root.fg
          }

          // 4. Color & Image
          PanelSectionHeader {
            text: "COLOR & IMAGE"
            foreground: root.fg
            fontFamily: root.fontFamily
          }

          CameraToggle {
            label: "Auto White Balance"
            checked: root.getVal("white_balance_automatic", 1) === 1
            onToggled: root.controlChanged("white_balance_automatic", root.getVal("white_balance_automatic", 1) === 1 ? 0 : 1)
          }

          CameraSlider {
            label: "Color Temperature"
            unit: "K"
            controlEnabled: root.getVal("white_balance_automatic", 1) === 0 && !root.isInactive("white_balance_temperature")
            disabledHint: "Disabled while auto white balance is on"
            minimum: 2800
            maximum: 7500
            step: 50
            value: root.getVal("white_balance_temperature", 5000)
            onCommitted: function(v) { root.controlChanged("white_balance_temperature", v) }
          }

          CameraSlider {
            label: "Brightness"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("brightness", 128)
            onCommitted: function(v) { root.controlChanged("brightness", v) }
          }

          CameraSlider {
            label: "Contrast"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("contrast", 128)
            onCommitted: function(v) { root.controlChanged("contrast", v) }
          }

          CameraSlider {
            label: "Saturation"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("saturation", 128)
            onCommitted: function(v) { root.controlChanged("saturation", v) }
          }

          CameraSlider {
            label: "Sharpness"
            minimum: 0
            maximum: 255
            step: 1
            value: root.getVal("sharpness", 128)
            onCommitted: function(v) { root.controlChanged("sharpness", v) }
          }

          PanelSeparator {
            foreground: root.fg
          }

          // 5. Utilities
          PanelSectionHeader {
            text: "UTILITIES"
            foreground: root.fg
            fontFamily: root.fontFamily
          }

          CameraSegmented {
            label: "Anti-Flicker (Power Line Frequency)"
            options: [
              { value: "0", label: "Off" },
              { value: "1", label: "50 Hz" },
              { value: "2", label: "60 Hz" }
            ]
            value: String(root.getVal("power_line_frequency", 2))
            onChanged: function(v) { root.controlChanged("power_line_frequency", parseInt(v, 10)) }
          }

          CameraToggle {
            label: "Backlight Compensation"
            checked: root.getVal("backlight_compensation", 1) === 1
            onToggled: root.controlChanged("backlight_compensation", root.getVal("backlight_compensation", 1) === 1 ? 0 : 1)
          }

          Item {
            width: parent.width
            height: 8
          }
        }
      }
    }
  }
}
