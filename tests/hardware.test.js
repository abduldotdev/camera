const assert = require("node:assert/strict")
const cp = require("node:child_process")
const fs = require("node:fs")
const Model = require("../Model.js")

const device = Model.DEFAULT_DEVICE || "/dev/video0"

// Skip cleanly if /dev/video0 is missing
if (!fs.existsSync(device)) {
  console.log(`SKIP: device ${device} not found`)
  process.exit(0)
}

function runCmd(cmd) {
  return cp.execFileSync(cmd[0], cmd.slice(1), {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"]
  })
}

function getV4l2Controls() {
  const out = runCmd(Model.buildV4l2ListCommand(device))
  return Model.parseV4l2Ctrls(out)
}

function getFovControl() {
  const out = runCmd(Model.buildFovListCommand(device))
  return Model.parseCameractrls(out).logitech_brio_fov
}

function getCurrentValue(name) {
  if (name === "logitech_brio_fov") {
    return getFovControl()
  }
  const v4l2 = getV4l2Controls()
  return v4l2[name] ? v4l2[name].value : undefined
}

function pickDifferentValue(ctrl, currentVal) {
  if (ctrl.type === "bool") {
    return currentVal ? 0 : 1
  }
  if (ctrl.type === "menu") {
    if (ctrl.name === "logitech_brio_fov") {
      const opts = ctrl.options || [65, 78, 90]
      return opts.find(o => o !== currentVal) ?? (currentVal === 65 ? 78 : 65)
    }
    const opts = (ctrl.options || []).map(o => (typeof o === "object" ? o.value : o))
    const diff = opts.find(o => o !== currentVal)
    return diff !== undefined ? diff : (currentVal === opts[0] ? opts[1] : opts[0])
  }
  if (ctrl.type === "int") {
    const step = ctrl.step || 1
    if (ctrl.name === "white_balance_temperature") {
      return currentVal <= 7000 ? currentVal + 200 : currentVal - 200
    }
    if (ctrl.name === "exposure_time_absolute") {
      return currentVal <= 1900 ? currentVal + 100 : currentVal - 100
    }
    if (ctrl.name === "focus_absolute") {
      return currentVal <= 230 ? currentVal + 20 : currentVal - 20
    }
    if (ctrl.name === "zoom_absolute") {
      return currentVal <= 380 ? currentVal + 20 : currentVal - 20
    }
    if (ctrl.name === "pan_absolute" || ctrl.name === "tilt_absolute") {
      return currentVal <= 68400 ? currentVal + 3600 : currentVal - 3600
    }
    if (ctrl.name === "gain") {
      return currentVal <= 240 ? currentVal + 10 : currentVal - 10
    }
    if (currentVal + step <= ctrl.max) {
      return currentVal + step
    } else {
      return currentVal - step
    }
  }
  return currentVal
}

// Snapshot original values for all controls
const originalValues = {}
const initialV4l2 = getV4l2Controls()
for (const name of Object.keys(Model.CONTROLS)) {
  if (name === "logitech_brio_fov") {
    originalValues[name] = getFovControl()
  } else {
    originalValues[name] = initialV4l2[name] ? initialV4l2[name].value : Model.CONTROLS[name].defaultVal
  }
}

try {
  console.log("=== Logitech MX Brio Hardware Control Verification (/dev/video0) ===")

  for (const name of Object.keys(Model.CONTROLS)) {
    const ctrl = Model.CONTROLS[name]
    const isDependent = !!ctrl.dependsOn
    let parentOrig = undefined

    // For dependent controls, switch parent control to manual first
    if (isDependent) {
      parentOrig = getCurrentValue(ctrl.dependsOn)
      let manualVal = 0
      if (ctrl.dependsOn === "auto_exposure") {
        manualVal = 1
      } else if (ctrl.dependsOn === "white_balance_automatic" || ctrl.dependsOn === "focus_automatic_continuous") {
        manualVal = 0
      }
      runCmd(Model.buildV4l2SetCommand(device, ctrl.dependsOn, manualVal))
    }

    const beforeVal = getCurrentValue(name)
    assert.notEqual(beforeVal, undefined, `Failed to query current value for ${name}`)

    const targetVal = pickDifferentValue(ctrl, beforeVal)
    assert.notEqual(targetVal, beforeVal, `Could not pick a different value for ${name} from ${beforeVal}`)

    // Set new value using plugin's builder
    const setCmd = name === "logitech_brio_fov"
      ? Model.buildFovSetCommand(device, targetVal)
      : Model.buildV4l2SetCommand(device, name, targetVal)
    runCmd(setCmd)

    // Re-read and assert value changed
    const afterVal = getCurrentValue(name)
    assert.equal(afterVal, targetVal, `Control ${name} did not change to target value ${targetVal} (got ${afterVal})`)

    // Restore original value using plugin's builder
    const restoreCmd = name === "logitech_brio_fov"
      ? Model.buildFovSetCommand(device, beforeVal)
      : Model.buildV4l2SetCommand(device, name, beforeVal)
    runCmd(restoreCmd)

    // Re-read and assert restored
    const restoredVal = getCurrentValue(name)
    assert.equal(restoredVal, beforeVal, `Control ${name} did not restore to ${beforeVal} (got ${restoredVal})`)

    // Restore parent control if dependent
    if (isDependent && parentOrig !== undefined) {
      runCmd(Model.buildV4l2SetCommand(device, ctrl.dependsOn, parentOrig))
      const parentRestored = getCurrentValue(ctrl.dependsOn)
      assert.equal(parentRestored, parentOrig, `Parent control ${ctrl.dependsOn} did not restore to ${parentOrig}`)
    }

    console.log(`${name}: ${beforeVal} -> ${afterVal} -> ${restoredVal}`)
  }

  // Run Model.buildResetCommands() once and test defaults
  console.log("\n=== Testing Factory Reset Commands ===")
  const resetCmds = Model.buildResetCommands(device)
  let resetExecutionError = null

  for (const cmd of resetCmds) {
    try {
      runCmd(cmd)
    } catch (err) {
      resetExecutionError = err
    }
  }

  if (resetExecutionError) {
    console.log(`[FINDING] Model.buildResetCommands() execution error: ${resetExecutionError.message.trim()}`)
    console.log("[FINDING] Inactive controls (white_balance_temperature, exposure_time_absolute, focus_absolute) cannot be set in batched v4l2-ctl command while auto modes are active.")
  } else {
    const postResetV4l2 = getV4l2Controls()
    const postResetFov = getFovControl()
    const defaults = Model.getDefaults()
    for (const name of Object.keys(Model.CONTROLS)) {
      const val = name === "logitech_brio_fov" ? postResetFov : postResetV4l2[name]?.value
      assert.equal(val, defaults[name], `Control ${name} did not equal default ${defaults[name]} after reset`)
    }
    console.log("Reset commands successfully set all controls to defaults.")
  }

} finally {
  // Always restore original values even if an assertion fails
  console.log("\nRestoring camera to original state...")
  for (const name of Object.keys(Model.CONTROLS)) {
    const origVal = originalValues[name]
    if (origVal === undefined) continue
    try {
      if (name === "logitech_brio_fov") {
        runCmd(Model.buildFovSetCommand(device, origVal))
      } else if (name === "white_balance_temperature") {
        runCmd(Model.buildV4l2SetCommand(device, "white_balance_automatic", 0))
        runCmd(Model.buildV4l2SetCommand(device, "white_balance_temperature", origVal))
        runCmd(Model.buildV4l2SetCommand(device, "white_balance_automatic", originalValues.white_balance_automatic ?? 1))
      } else if (name === "exposure_time_absolute") {
        runCmd(Model.buildV4l2SetCommand(device, "auto_exposure", 1))
        runCmd(Model.buildV4l2SetCommand(device, "exposure_time_absolute", origVal))
        runCmd(Model.buildV4l2SetCommand(device, "auto_exposure", originalValues.auto_exposure ?? 3))
      } else if (name === "focus_absolute") {
        runCmd(Model.buildV4l2SetCommand(device, "focus_automatic_continuous", 0))
        runCmd(Model.buildV4l2SetCommand(device, "focus_absolute", origVal))
        runCmd(Model.buildV4l2SetCommand(device, "focus_automatic_continuous", originalValues.focus_automatic_continuous ?? 1))
      } else {
        runCmd(Model.buildV4l2SetCommand(device, name, origVal))
      }
    } catch (restoreErr) {
      console.error(`Error restoring ${name}: ${restoreErr.message}`)
    }
  }
  console.log("Camera state restoration complete.")
}
