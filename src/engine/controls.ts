// Orbit Camera Controls
// Right-click: rotate, Middle-click: pan, Scroll: zoom
// Left-click reserved for app interaction

import type { Camera } from './camera'

export interface OrbitControls {
  update(): void
  dispose(): void
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
    } else if (e.button === 1) {
      // Middle-click: pan
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
    if (e.button === 1) isPanning = false
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    radiusVel += e.deltaY * zoomSpeed * radius
  }

  function onContextMenu(e: Event) {
    e.preventDefault()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

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
  }

  // Initialize camera position
  update()

  return { update, dispose }
}
