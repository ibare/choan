// Orbit Camera Controls
// Right-click: rotate, Middle-click: pan, Scroll: zoom
// Left-click reserved for app interaction

import type { Camera } from './camera'

export interface OrbitControls {
  update(): void
  dispose(): void
  getAngles(): { theta: number; phi: number }
  setAngles(theta: number, phi: number): void
  wheelEnabled: boolean
  readonly isInteracting: boolean
  readonly isSpaceDown: boolean
}

export function createOrbitControls(canvas: HTMLCanvasElement, camera: Camera): OrbitControls {
  // Spherical coordinates
  let theta = 0   // horizontal angle (radians)
  let phi = Math.PI / 2  // vertical angle (radians, PI/2 = front view)
  let radius = 20  // distance from target

  // Pan offset in world space
  let panX = 0
  let panY = 0

  // Damping state
  let thetaVel = 0
  let phiVel = 0
  let panXVel = 0
  let panYVel = 0
  let radiusVel = 0
  const dampingFactor = 0.1

  // Drag state
  let isRotating = false
  let isPanning = false
  let lastX = 0
  let lastY = 0
  let spaceDown = false

  const rotateSpeed = 0.005
  const panSpeed = 0.04
  const zoomSpeed = 0.001

  // Clamp phi to avoid gimbal lock
  const PHI_MIN = 0.01
  const PHI_MAX = Math.PI - 0.01

  function onPointerDown(e: PointerEvent) {
    if (e.button === 2) {
      // Right-click: rotate
      isRotating = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    } else if (e.button === 1 || (e.button === 0 && spaceDown)) {
      // Middle-click or Space + left-click: pan
      isPanning = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY

    if (isRotating) {
      thetaVel -= dx * rotateSpeed
      phiVel -= dy * rotateSpeed
    } else if (isPanning) {
      // Screen-space panning
      panXVel -= dx * panSpeed * (radius / 20)
      panYVel += dy * panSpeed * (radius / 20)
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (e.button === 2) isRotating = false
    if (e.button === 1 || e.button === 0) isPanning = false
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !e.repeat) {
      spaceDown = true
      canvas.style.cursor = 'grab'
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceDown = false
      if (isPanning) isPanning = false
      canvas.style.cursor = ''
    }
  }

  let wheelEnabled = true

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    if (!wheelEnabled) return

    // Cursor-centered zoom: compute the world point under the cursor,
    // apply zoom, then pan so that point stays under the cursor.
    const rect = canvas.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2

    // World-space offset of cursor relative to target at current radius
    const aspect = rect.width / rect.height
    const fovRad = camera.fov * Math.PI / 180
    const halfH = Math.tan(fovRad / 2) * radius
    const halfW = halfH * aspect
    const cursorWX = ndcX * halfW
    const cursorWY = ndcY * halfH

    const delta = e.deltaY * zoomSpeed * radius
    const newRadius = Math.max(1, Math.min(200, radius + delta))
    const scale = 1 - newRadius / radius

    // Pan toward cursor proportionally to zoom change
    panX += cursorWX * scale
    panY += cursorWY * scale
    radius = newRadius
  }

  function onContextMenu(e: Event) {
    e.preventDefault()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  function update() {
    // Apply velocities with damping
    theta += thetaVel
    phi += phiVel
    panX += panXVel
    panY += panYVel
    radius += radiusVel

    // Damping
    thetaVel *= (1 - dampingFactor)
    phiVel *= (1 - dampingFactor)
    panXVel *= (1 - dampingFactor)
    panYVel *= (1 - dampingFactor)
    radiusVel *= (1 - dampingFactor)

    // Clamp
    phi = Math.max(PHI_MIN, Math.min(PHI_MAX, phi))
    radius = Math.max(1, Math.min(200, radius))

    // Spherical → cartesian (camera position relative to target)
    const sinPhi = Math.sin(phi)
    const cosPhi = Math.cos(phi)
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    camera.position[0] = panX + radius * sinPhi * sinTheta
    camera.position[1] = panY + radius * cosPhi
    camera.position[2] = radius * sinPhi * cosTheta

    camera.target[0] = panX
    camera.target[1] = panY
    camera.target[2] = 0
  }

  function dispose() {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  function getAngles() { return { theta, phi } }
  function setAngles(t: number, p: number) { theta = t; phi = p }

  // Initialize camera position
  update()

  return {
    update, dispose, getAngles, setAngles,
    get wheelEnabled() { return wheelEnabled },
    set wheelEnabled(v: boolean) { wheelEnabled = v },
    get isInteracting() { return isRotating || isPanning },
    get isSpaceDown() { return spaceDown },
  }
}
