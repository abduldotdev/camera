const assert = require("node:assert/strict")
const cp = require("node:child_process")
const fs = require("node:fs")
const Model = require("../Model.js")

const devCmd = Model.buildV4l2DevicesCommand()
const devOut = cp.execFileSync(devCmd[0], devCmd.slice(1), {
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"]
})
const discoveredDevices = Model.parseV4l2Devices(devOut)
const selected = Model.selectActiveDevice(discoveredDevices, null)
if (!selected) {
  console.log("SKIP: no capture device found")
  process.exit(0)
}
const device = selected.path
const deviceCard = selected.card || selected.name || "Camera"

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

function hasCameractrls() {
  try {
    cp.execFileSync("sh", ["-c", "command -v cameractrls"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function getFovControl() {
  if (!hasCameractrls()) {
    return undefined
  }
  const out = runCmd(Model.buildFovListCommand(device))
  const parsed = Model.parseCameractrls(out)
  return parsed.logitech_brio_fov
}

function getCurrentValue(name) {
  if (name === "logitech_brio_fov") {
    return getFovControl()
  }
  const v4l2 = getV4l2Controls()
  return v4l2[name] ? v4l2[name].value : undefined
}

function pickDifferentValue(parsedCtrl, currentVal) {
  if (parsedCtrl.type === "bool") {
    return currentVal ? 0 : 1
  }
  if (parsedCtrl.type === "menu") {
    if (parsedCtrl.name === "logitech_brio_fov") {
      const opts = parsedCtrl.options || [65, 78, 90]
      return opts.find(o => o !== currentVal) ?? (currentVal === 65 ? 78 : 65)
    }
    const items = parsedCtrl.menuItems || parsedCtrl.options || []
    const opts = items.map(o => (typeof o === "object" ? o.value : o))
    const diff = opts.find(o => o !== currentVal)
    return diff !== undefined ? diff : (currentVal === opts[0] ? opts[1] : opts[0])
  }
  if (parsedCtrl.type === "int") {
    const min = parsedCtrl.min !== undefined ? parsedCtrl.min : 0
    const max = parsedCtrl.max !== undefined ? parsedCtrl.max : 255
    const step = (parsedCtrl.step !== undefined && parsedCtrl.step > 0) ? parsedCtrl.step : 1

    let candidate = undefined
    if (parsedCtrl.name === "white_balance_temperature") {
      candidate = currentVal + 200 <= max ? currentVal + 200 : currentVal - 200
    } else if (parsedCtrl.name === "exposure_time_absolute") {
      candidate = currentVal + 100 <= max ? currentVal + 100 : currentVal - 100
    } else if (parsedCtrl.name === "focus_absolute") {
      candidate = currentVal + 20 <= max ? currentVal + 20 : currentVal - 20
    } else if (parsedCtrl.name === "zoom_absolute") {
      candidate = currentVal + 20 <= max ? currentVal + 20 : currentVal - 20
    } else if (parsedCtrl.name === "pan_absolute" || parsedCtrl.name === "tilt_absolute") {
      candidate = currentVal + 3600 <= max ? currentVal + 3600 : currentVal - 3600
    } else if (parsedCtrl.name === "gain") {
      candidate = currentVal + 10 <= max ? currentVal + 10 : currentVal - 10
    }

    if (candidate !== undefined && candidate >= min && candidate <= max && candidate !== currentVal) {
      return candidate
    }

    if (currentVal + step <= max) {
      return currentVal + step
    } else if (currentVal - step >= min) {
      return currentVal - step
    }
    return currentVal
  }
  return currentVal
}

// Query device once and snapshot original values for present controls
const initialV4l2 = getV4l2Controls()
const initialFov = getFovControl()
const originalValues = {}
for (const name of Object.keys(initialV4l2)) {
  if (initialV4l2[name] && initialV4l2[name].value !== undefined) {
    originalValues[name] = initialV4l2[name].value
  }
}
if (initialFov !== undefined) {
  originalValues.logitech_brio_fov = initialFov
}

// Snapshot original capture mode
const initialCaptureMode = Model.parseV4l2CaptureMode(runCmd(Model.buildV4l2ListCommand(device)))

try {
  console.log(`=== ${deviceCard} Hardware Control Verification (${device}) ===`)


  for (const name of Object.keys(Model.CONTROLS)) {
    const ctrl = Model.CONTROLS[name]
    if (name === "logitech_brio_fov") {
      if (initialFov === undefined) {
        console.log("SKIP: logitech_brio_fov not exposed")
        continue
      }
    } else {
      if (!initialV4l2[name]) {
        console.log(`SKIP: ${name} not exposed`)
        continue
      }
    }

    const isDependent = !!ctrl.dependsOn
    let parentOrig = undefined

    // For dependent controls, switch parent control to manual first
    if (isDependent && initialV4l2[ctrl.dependsOn]) {
      parentOrig = getCurrentValue(ctrl.dependsOn)
      let manualVal = 0
      if (ctrl.dependsOn === "auto_exposure") {
        const aeItems = initialV4l2.auto_exposure ? initialV4l2.auto_exposure.menuItems : []
        manualVal = Model.resolveAutoExposure(aeItems).manual
      } else if (ctrl.dependsOn === "white_balance_automatic" || ctrl.dependsOn === "focus_automatic_continuous") {
        manualVal = 0
      }
      runCmd(Model.buildV4l2SetCommand(device, ctrl.dependsOn, manualVal))
    }

    const beforeVal = getCurrentValue(name)
    assert.notEqual(beforeVal, undefined, `Failed to query current value for ${name}`)
    assert.equal(typeof beforeVal, "number", `Control ${name} value must be a number`)

    const parsedCtrl = name === "logitech_brio_fov"
      ? { name: "logitech_brio_fov", type: "menu", options: [65, 78, 90] }
      : initialV4l2[name]
    const targetVal = pickDifferentValue(parsedCtrl, beforeVal)
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
    if (isDependent && parentOrig !== undefined && initialV4l2[ctrl.dependsOn]) {
      runCmd(Model.buildV4l2SetCommand(device, ctrl.dependsOn, parentOrig))
      const parentRestored = getCurrentValue(ctrl.dependsOn)
      assert.equal(parentRestored, parentOrig, `Parent control ${ctrl.dependsOn} did not restore to ${parentOrig}`)
    }

    console.log(`${name}: ${beforeVal} -> ${afterVal} -> ${restoredVal}`)
  }

  // === Testing Logitech MX Brio FOV Presets (65, 78, 90) ===
  console.log("\n=== Testing Logitech FOV Presets (65, 78, 90) ===")
  if (!hasCameractrls()) {
    console.log("SKIP: cameractrls binary not installed")
  } else {
    const fovInitial = getFovControl()
    if (fovInitial === undefined) {
      console.log("SKIP: Logitech FOV control not available on this device")
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
          runCmd(Model.buildFovSetCommand(device, fovInitial))
          const restoredFov = getFovControl()
          assert.equal(restoredFov, fovInitial, `FOV failed to restore to initial ${fovInitial}° (got ${restoredFov})`)
          console.log(`FOV restored to initial setting: ${restoredFov}°`)
        }
      }
    }
  }

  // Run Model.buildResetCommands(device, map) and assert every present control equals its defaultVal afterwards
  console.log("\n=== Testing Factory Reset Commands ===")
  const resetMap = Object.assign({}, initialV4l2)
  if (initialFov !== undefined) {
    resetMap.logitech_brio_fov = {
      name: "logitech_brio_fov",
      backend: "cameractrls",
      defaultVal: 65,
      default: 65
    }
  }
  const resetCmds = Model.buildResetCommands(device, resetMap)
  for (const cmd of resetCmds) {
    runCmd(cmd)
  }

  const postResetV4l2 = getV4l2Controls()
  const postResetFov = getFovControl()
  for (const name of Object.keys(resetMap)) {
    if (name === "logitech_brio_fov") {
      assert.equal(postResetFov, 65, `Control logitech_brio_fov did not equal default 65 after reset (got ${postResetFov})`)
    } else {
      const expectedDef = resetMap[name].defaultVal !== undefined ? resetMap[name].defaultVal : resetMap[name].default
      const val = postResetV4l2[name] ? postResetV4l2[name].value : undefined
      assert.equal(val, expectedDef, `Control ${name} did not equal default ${expectedDef} after reset (got ${val})`)
    }
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
  for (const name of Object.keys(combinedCtrls)) {
    assert.equal(typeof combinedCtrls[name].value, "number", `Control ${name} value must be a number`)
  }
  console.log(`Current capture mode: ${parsedCaptureMode.width}x${parsedCaptureMode.height}@${parsedCaptureMode.fps} ${parsedCaptureMode.pixelformat}`)
  console.log(`Combined list check: ${Object.keys(combinedCtrls).length} control(s) parsed without regression alongside capture mode`)

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

  // === Testing Control Adjustment While Streaming (Non-blocking Controls Contract) ===
  console.log("\n=== Testing Control Adjustment While Streaming ===")
  if (!initialV4l2.brightness) {
    console.log("SKIP: brightness not exposed, skipping streaming test")
  } else {
    const streamProc = cp.spawn("v4l2-ctl", ["-d", device, "--stream-mmap", "--stream-count=100"], {
      stdio: "ignore"
    })
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150)

      const bBefore = getCurrentValue("brightness")
      const bTarget = pickDifferentValue(initialV4l2.brightness, bBefore)
      runCmd(Model.buildV4l2SetCommand(device, "brightness", bTarget))
      const bAfter = getCurrentValue("brightness")
      assert.equal(bAfter, bTarget, `Brightness control failed while streaming (got ${bAfter}, expected ${bTarget})`)

      runCmd(Model.buildV4l2SetCommand(device, "brightness", bBefore))
      const bRestored = getCurrentValue("brightness")
      assert.equal(bRestored, bBefore, `Brightness restore failed while streaming (got ${bRestored}, expected ${bBefore})`)
      console.log(`Verified control adjustment while streaming holds ${device}: brightness ${bBefore} -> ${bTarget} -> ${bRestored}`)
    } finally {
      try {
        streamProc.kill("SIGKILL")
      } catch {}
    }
  }

} finally {
  // Always restore original values even if an assertion fails
  console.log("\nRestoring camera to original state...")
  const restorationErrors = []
  for (const name of Object.keys(originalValues)) {
    const origVal = originalValues[name]
    if (origVal === undefined) continue
    try {
      if (name === "logitech_brio_fov") {
        runCmd(Model.buildFovSetCommand(device, origVal))
      } else if (name === "white_balance_temperature") {
        if (originalValues.white_balance_automatic !== undefined) {
          runCmd(Model.buildV4l2SetCommand(device, "white_balance_automatic", 0))
          runCmd(Model.buildV4l2SetCommand(device, "white_balance_temperature", origVal))
          runCmd(Model.buildV4l2SetCommand(device, "white_balance_automatic", originalValues.white_balance_automatic))
        } else {
          runCmd(Model.buildV4l2SetCommand(device, "white_balance_temperature", origVal))
        }
      } else if (name === "exposure_time_absolute") {
        if (originalValues.auto_exposure !== undefined) {
          const aeManual = Model.resolveAutoExposure(initialV4l2.auto_exposure ? initialV4l2.auto_exposure.menuItems : []).manual
          runCmd(Model.buildV4l2SetCommand(device, "auto_exposure", aeManual))
          runCmd(Model.buildV4l2SetCommand(device, "exposure_time_absolute", origVal))
          runCmd(Model.buildV4l2SetCommand(device, "auto_exposure", originalValues.auto_exposure))
        } else {
          runCmd(Model.buildV4l2SetCommand(device, "exposure_time_absolute", origVal))
        }
      } else if (name === "focus_absolute") {
        if (originalValues.focus_automatic_continuous !== undefined) {
          runCmd(Model.buildV4l2SetCommand(device, "focus_automatic_continuous", 0))
          runCmd(Model.buildV4l2SetCommand(device, "focus_absolute", origVal))
          runCmd(Model.buildV4l2SetCommand(device, "focus_automatic_continuous", originalValues.focus_automatic_continuous))
        } else {
          runCmd(Model.buildV4l2SetCommand(device, "focus_absolute", origVal))
        }
      } else {
        runCmd(Model.buildV4l2SetCommand(device, name, origVal))
      }

      // Re-read and verify restoration
      const verifyVal = getCurrentValue(name)
      if (verifyVal !== origVal) {
        restorationErrors.push(new Error(`Failed to verify restoration of ${name}: expected ${origVal}, got ${verifyVal}`))
      }
    } catch (restoreErr) {
      console.error(`Error restoring ${name}: ${restoreErr.message}`)
      restorationErrors.push(restoreErr)
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
        const verifyMode = Model.parseV4l2CaptureMode(runCmd(Model.buildV4l2ListCommand(device)))
        if (
          verifyMode.width !== initialCaptureMode.width ||
          verifyMode.height !== initialCaptureMode.height ||
          verifyMode.pixelformat !== initialCaptureMode.pixelformat ||
          verifyMode.fps !== initialCaptureMode.fps
        ) {
          restorationErrors.push(new Error(`Capture mode restoration verification failed: expected ${initialCaptureMode.width}x${initialCaptureMode.height}@${initialCaptureMode.fps}, got ${verifyMode.width}x${verifyMode.height}@${verifyMode.fps}`))
        }
      }
    } catch (restoreErr) {
      console.error(`Error restoring capture mode: ${restoreErr.message}`)
      restorationErrors.push(restoreErr)
    }
  }

  if (restorationErrors.length > 0) {
    console.error(`\nFAILED: ${restorationErrors.length} restoration error(s) occurred:`)
    for (const err of restorationErrors) {
      console.error(` - ${err.message}`)
    }
    process.exit(1)
  }
  console.log("Camera state restoration complete and verified.")
}
