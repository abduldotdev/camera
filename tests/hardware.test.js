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
    stdio: ["pipe", "pipe", "pipe"]
  })
}

function getV4l2Controls() {
  const out = runCmd(Model.buildV4l2ListCommand(device))
  return Model.parseV4l2Ctrls(out)
}

function getFovControl() {
  try {
    const out = runCmd(Model.buildFovListCommand(device))
    return Model.parseCameractrls(out).logitech_brio_fov
  } catch {
    return undefined
  }
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

// Snapshot original capture mode
const initialCaptureMode = Model.parseV4l2CaptureMode(runCmd(Model.buildV4l2ListCommand(device)))

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
    if (beforeVal === undefined && name === "logitech_brio_fov") {
      console.log(`SKIP: ${name} not available on device or cameractrls missing`)
      continue
    }
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

  // === Testing Logitech MX Brio FOV Presets (65, 78, 90) ===
  console.log("\n=== Testing Logitech FOV Presets (65, 78, 90) ===")
  const fovInitial = getFovControl()
  if (fovInitial === undefined) {
    console.log("SKIP: Logitech FOV control or cameractrls not available")
  } else {
    const fovPresets = [65, 78, 90]
    let fovMutated = false
    try {
      for (const preset of fovPresets) {
        runCmd(Model.buildFovSetCommand(device, preset))
        fovMutated = true
        const readbackOut = runCmd(Model.buildFovListCommand(device))
        const readbackFov = Model.parseCameractrls(readbackOut).logitech_brio_fov
        assert.equal(readbackFov, preset, `FOV did not change to preset ${preset} (got ${readbackFov})`)
        console.log(`logitech_brio_fov preset ${preset}° verified`)
      }
    } finally {
      if (fovMutated && fovInitial !== undefined) {
        try {
          runCmd(Model.buildFovSetCommand(device, fovInitial))
          const restoredFov = getFovControl()
          assert.equal(restoredFov, fovInitial, `FOV failed to restore to initial ${fovInitial}° (got ${restoredFov})`)
          console.log(`FOV restored to initial setting: ${restoredFov}°`)
        } catch (restoreErr) {
          console.error(`Error restoring FOV in finally: ${restoreErr.message}`)
        }
      }
    }
  }

  // Run Model.buildResetCommands() once and assert every control equals its default afterwards
  console.log("\n=== Testing Factory Reset Commands ===")
  const resetCmds = Model.buildResetCommands(device)
  for (const cmd of resetCmds) {
    runCmd(cmd)
  }

  const postResetV4l2 = getV4l2Controls()
  const postResetFov = getFovControl()
  const defaults = Model.getDefaults()
  for (const name of Object.keys(Model.CONTROLS)) {
    if (name === "logitech_brio_fov" && postResetFov === undefined) {
      continue
    }
    const val = name === "logitech_brio_fov" ? postResetFov : postResetV4l2[name]?.value
    assert.equal(val, defaults[name], `Control ${name} did not equal default ${defaults[name]} after reset (got ${val})`)
  }
  console.log("Reset check: every control verified at factory default value")

  // === Testing Capture Mode Round Trip ===
  console.log("\n=== Testing Capture Mode Round Trip ===")

  // (a) run buildV4l2ListFormatsCommand and parse it;
  //     assert at least one format with sizes and fps is enumerated and that parsed sizes/fps are numbers
  const formatsOut = runCmd(Model.buildV4l2ListFormatsCommand(device))
  const formats = Model.parseV4l2Formats(formatsOut)
  assert.ok(Array.isArray(formats) && formats.length > 0, "Expected at least one enumerated video format")
  let totalSizes = 0
  let totalFps = 0
  for (const fmt of formats) {
    assert.equal(typeof fmt.pixelformat, "string", "Format pixelformat must be a string")
    assert.ok(fmt.pixelformat.length > 0, "Format pixelformat must not be empty")
    assert.ok(Array.isArray(fmt.sizes), `Format ${fmt.pixelformat} missing sizes array`)
    for (const sz of fmt.sizes) {
      totalSizes++
      assert.equal(typeof sz.width, "number", `Size width must be a number (got ${typeof sz.width})`)
      assert.equal(typeof sz.height, "number", `Size height must be a number (got ${typeof sz.height})`)
      assert.ok(sz.width > 0 && sz.height > 0, "Width and height must be positive numbers")
      assert.ok(Array.isArray(sz.fps), `FPS array missing for ${sz.width}x${sz.height}`)
      for (const f of sz.fps) {
        totalFps++
        assert.equal(typeof f, "number", `FPS must be a number (got ${typeof f})`)
        assert.ok(f > 0, "FPS must be a positive number")
      }
    }
  }
  assert.ok(totalSizes > 0, "At least one size must be enumerated across formats")
  assert.ok(totalFps > 0, "At least one fps must be enumerated across formats")
  console.log(`Formats enumerated: ${formats.length} format(s), ${totalSizes} size(s), ${totalFps} fps option(s)`)

  // (b) run buildV4l2ListCommand and assert parseV4l2CaptureMode yields width/height/pixelformat/fps
  //     AND parseV4l2Ctrls on the same combined output still yields all 18-1=17 standard V4L2 controls
  const listCombinedOut = runCmd(Model.buildV4l2ListCommand(device))
  const parsedCaptureMode = Model.parseV4l2CaptureMode(listCombinedOut)
  assert.equal(typeof parsedCaptureMode.width, "number", "parseV4l2CaptureMode must yield width as number")
  assert.equal(typeof parsedCaptureMode.height, "number", "parseV4l2CaptureMode must yield height as number")
  assert.equal(typeof parsedCaptureMode.pixelformat, "string", "parseV4l2CaptureMode must yield pixelformat as string")
  assert.ok(parsedCaptureMode.pixelformat.length > 0, "parseV4l2CaptureMode must yield non-empty pixelformat")
  assert.equal(typeof parsedCaptureMode.fps, "number", "parseV4l2CaptureMode must yield fps as number")
  assert.ok(parsedCaptureMode.fps > 0, "parseV4l2CaptureMode must yield positive fps")

  const combinedCtrls = Model.parseV4l2Ctrls(listCombinedOut)
  const standardCtrls = Object.keys(Model.CONTROLS).filter(name => Model.CONTROLS[name].backend !== "cameractrls")
  assert.equal(standardCtrls.length, 17, `Expected 17 standard V4L2 controls, got ${standardCtrls.length}`)
  for (const name of standardCtrls) {
    assert.ok(combinedCtrls[name] !== undefined, `Control ${name} missing from parseV4l2Ctrls on combined list command output`)
    assert.equal(typeof combinedCtrls[name].value, "number", `Control ${name} value must be a number`)
  }
  console.log(`Current capture mode: ${parsedCaptureMode.width}x${parsedCaptureMode.height}@${parsedCaptureMode.fps} ${parsedCaptureMode.pixelformat}`)
  console.log("Combined list check: all 17 standard controls parsed without regression alongside capture mode")

  // (c) record current capture mode, choose a different enumerated size/fps via pickCaptureMode
  //     (e.g. the first preferred size that differs from current, at a different fps if available),
  //     apply buildV4l2SetCaptureModeCommand; if the command fails and stderr/message contains 'busy'
  //     (VIDIOC_S_FMT: failed: Device or resource busy — happens when any app is streaming),
  //     log 'SKIP: capture mode busy' and skip (c)-(d) without failing;
  //     otherwise re-read and assert the driver reports the chosen width/height/pixelformat/fps;
  // (d) restore the original mode with buildV4l2SetCaptureModeCommand and assert it is back — this restore must run in a try/finally
  const origCaptureMode = {
    width: parsedCaptureMode.width,
    height: parsedCaptureMode.height,
    pixelformat: parsedCaptureMode.pixelformat,
    fps: parsedCaptureMode.fps
  }

  let targetCaptureMode = null
  for (const [w, h] of Model.PREFERRED_RESOLUTIONS) {
    if (w !== origCaptureMode.width || h !== origCaptureMode.height) {
      let altFps = undefined
      for (const fmt of formats) {
        for (const sz of (fmt.sizes || [])) {
          if (sz.width === w && sz.height === h) {
            const diffFps = (sz.fps || []).find(f => f !== origCaptureMode.fps)
            if (diffFps !== undefined) {
              altFps = diffFps
              break
            }
          }
        }
        if (altFps !== undefined) break
      }
      const candidate = Model.pickCaptureMode(formats, origCaptureMode, w, h, altFps)
      if (candidate) {
        targetCaptureMode = candidate
        break
      }
    }
  }

  if (!targetCaptureMode) {
    for (const fmt of formats) {
      for (const sz of (fmt.sizes || [])) {
        if (sz.width !== origCaptureMode.width || sz.height !== origCaptureMode.height) {
          const altFps = (sz.fps || []).find(f => f !== origCaptureMode.fps)
          const candidate = Model.pickCaptureMode(formats, origCaptureMode, sz.width, sz.height, altFps)
          if (candidate) {
            targetCaptureMode = candidate
            break
          }
        }
      }
      if (targetCaptureMode) break
    }
  }

  assert.ok(targetCaptureMode !== null, "Failed to pick a different capture mode from enumerated formats")
  assert.ok(
    targetCaptureMode.width !== origCaptureMode.width ||
    targetCaptureMode.height !== origCaptureMode.height ||
    targetCaptureMode.fps !== origCaptureMode.fps ||
    targetCaptureMode.pixelformat !== origCaptureMode.pixelformat,
    "Target capture mode must differ from original capture mode"
  )

  let captureModeMutated = false
  try {
    try {
      runCmd(Model.buildV4l2SetCaptureModeCommand(device, targetCaptureMode))
      captureModeMutated = true
    } catch (setErr) {
      const errText = `${setErr.stdout || ""} ${setErr.stderr || ""} ${setErr.message || ""}`.toLowerCase()
      if (errText.includes("busy")) {
        console.log("SKIP: capture mode busy")
      } else {
        throw setErr
      }
    }

    if (captureModeMutated) {
      // Re-read and assert the driver reports the chosen width/height/pixelformat/fps
      const postSetOut = runCmd(Model.buildV4l2ListCommand(device))
      const postSetMode = Model.parseV4l2CaptureMode(postSetOut)
      assert.equal(postSetMode.width, targetCaptureMode.width, `Capture width did not change to ${targetCaptureMode.width} (got ${postSetMode.width})`)
      assert.equal(postSetMode.height, targetCaptureMode.height, `Capture height did not change to ${targetCaptureMode.height} (got ${postSetMode.height})`)
      assert.equal(postSetMode.pixelformat, targetCaptureMode.pixelformat, `Capture pixelformat did not change to ${targetCaptureMode.pixelformat} (got ${postSetMode.pixelformat})`)
      assert.equal(postSetMode.fps, targetCaptureMode.fps, `Capture fps did not change to ${targetCaptureMode.fps} (got ${postSetMode.fps})`)
      console.log(`capture_mode: ${origCaptureMode.width}x${origCaptureMode.height}@${origCaptureMode.fps} ${origCaptureMode.pixelformat} -> ${postSetMode.width}x${postSetMode.height}@${postSetMode.fps} ${postSetMode.pixelformat}`)

      // (d) restore the original mode with buildV4l2SetCaptureModeCommand and assert it is back
      runCmd(Model.buildV4l2SetCaptureModeCommand(device, origCaptureMode))
      captureModeMutated = false

      const restoredOut = runCmd(Model.buildV4l2ListCommand(device))
      const restoredMode = Model.parseV4l2CaptureMode(restoredOut)
      assert.equal(restoredMode.width, origCaptureMode.width, `Capture width did not restore to ${origCaptureMode.width} (got ${restoredMode.width})`)
      assert.equal(restoredMode.height, origCaptureMode.height, `Capture height did not restore to ${origCaptureMode.height} (got ${restoredMode.height})`)
      assert.equal(restoredMode.pixelformat, origCaptureMode.pixelformat, `Capture pixelformat did not restore to ${origCaptureMode.pixelformat} (got ${restoredMode.pixelformat})`)
      assert.equal(restoredMode.fps, origCaptureMode.fps, `Capture fps did not restore to ${origCaptureMode.fps} (got ${restoredMode.fps})`)
      console.log(`capture_mode restored: ${restoredMode.width}x${restoredMode.height}@${restoredMode.fps} ${restoredMode.pixelformat}`)
    }
  } finally {
    if (captureModeMutated) {
      try {
        runCmd(Model.buildV4l2SetCaptureModeCommand(device, origCaptureMode))
        console.log(`Emergency restore: capture mode restored to ${origCaptureMode.width}x${origCaptureMode.height}@${origCaptureMode.fps} ${origCaptureMode.pixelformat}`)
      } catch (e) {
        console.error(`Error restoring capture mode in finally: ${e.message}`)
      }
    }
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
  if (initialCaptureMode && initialCaptureMode.width) {
    try {
      const curMode = Model.parseV4l2CaptureMode(runCmd(Model.buildV4l2ListCommand(device)))
      if (
        curMode.width !== initialCaptureMode.width ||
        curMode.height !== initialCaptureMode.height ||
        curMode.pixelformat !== initialCaptureMode.pixelformat ||
        curMode.fps !== initialCaptureMode.fps
      ) {
        runCmd(Model.buildV4l2SetCaptureModeCommand(device, initialCaptureMode))
      }
    } catch (restoreErr) {
      console.error(`Error restoring capture mode: ${restoreErr.message}`)
    }
  }
  console.log("Camera state restoration complete.")
}
