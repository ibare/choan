// Navigation Gizmo — 3D axis indicator with click-to-snap views and drag-to-rotate.
// Renders on a small HTML canvas overlay in the top-right of the viewport.
// Shows 3D wireframe rings on hover/drag to hint that rotation is possible.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { OrbitControls } from '../engine/controls'

interface NavigationGizmoProps {
  controlsRef: MutableRefObject<OrbitControls | null>
}

const SIZE = 100
const CENTER = SIZE / 2
const AXIS_LEN = 32
const BALL_R = 10
const BALL_R_BACK = 4
const BG_R = 44
const RING_R = 44  // wireframe ring radius (slightly larger than BG)

// Axis definitions: direction in spherical (theta, phi), label, color
const AXES = [
  { label: 'X', color: '#e74c3c', theta: Math.PI / 2, phi: Math.PI / 2 },
  { label: 'Y', color: '#2ecc71', theta: 0, phi: 0 },
  { label: 'Z', color: '#3498db', theta: 0, phi: Math.PI / 2 },
]

const ROTATE_SPEED = 0.008

// Project a 3D unit vector to 2D gizmo space
function project(ax: number, ay: number, az: number, theta: number, phi: number): { x: number; y: number; z: number } {
  const st = Math.sin(theta), ct = Math.cos(theta)
  const sp = Math.sin(phi), cp = Math.cos(phi)
  const rx = ct, rz = -st
  const ux = -cp * st, uy = sp, uz = -cp * ct
  const fx = sp * st, fy = cp, fz = sp * ct
  const sx = ax * rx + ay * 0 + az * rz
  const sy = ax * ux + ay * uy + az * uz
  const depth = ax * fx + ay * fy + az * fz
  return { x: sx, y: -sy, z: depth }
}

// Draw a 3D wireframe ring (circle on a given plane) projected to 2D
function drawRing(
  ctx: CanvasRenderingContext2D,
  theta: number, phi: number,
  _planeNormal: [number, number, number],
  planeU: [number, number, number],
  planeV: [number, number, number],
  color: string, alpha: number,
  offsetY = 0,  // vertical offset for latitude lines
) {
  const segments = 64
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const px = Math.cos(a) * planeU[0] + Math.sin(a) * planeV[0]
    const py = Math.cos(a) * planeU[1] + Math.sin(a) * planeV[1] + offsetY
    const pz = Math.cos(a) * planeU[2] + Math.sin(a) * planeV[2]
    const p = project(px, py, pz, theta, phi)
    const sx = CENTER + p.x * RING_R
    const sy = CENTER + p.y * RING_R
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

export default function NavigationGizmo({ controlsRef }: NavigationGizmoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, moved: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    function draw() {
      frameRef.current = requestAnimationFrame(draw)
      const controls = controlsRef.current
      if (!controls) return

      const { theta, phi } = controls.getAngles()
      const showRings = hovered || dragging

      ctx.clearRect(0, 0, SIZE, SIZE)

      // Background circle
      ctx.fillStyle = showRings ? 'rgba(240, 240, 240, 0.85)' : 'rgba(30, 30, 40, 0)'
      ctx.beginPath()
      ctx.arc(CENTER, CENTER, BG_R, 0, Math.PI * 2)
      ctx.fill()

      // 3D wireframe rings (visible on hover/drag)
      if (showRings) {
        const ringAlpha = dragging ? 0.45 : 0.2
        const gridColor = '#888'

        // Latitude lines (horizontal rings at different heights)
        for (const lat of [-0.6, -0.3, 0.3, 0.6]) {
          const r = Math.sqrt(1 - lat * lat)
          drawRing(ctx, theta, phi, [0, 1, 0], [r, 0, 0], [0, 0, r], gridColor, ringAlpha * 0.5, lat)
        }
        // Longitude lines (vertical rings at different rotations)
        for (const ang of [0, Math.PI / 3, Math.PI * 2 / 3]) {
          const cu = Math.cos(ang), su = Math.sin(ang)
          drawRing(ctx, theta, phi, [0, 0, 0], [cu, 0, su], [0, 1, 0], gridColor, ringAlpha * 0.5)
        }

        // 3 main great circles (colored)
        const mainAlpha = dragging ? 0.6 : 0.35
        drawRing(ctx, theta, phi, [0, 0, 1], [1, 0, 0], [0, 1, 0], '#e74c3c', mainAlpha)
        drawRing(ctx, theta, phi, [0, 1, 0], [1, 0, 0], [0, 0, 1], '#2ecc71', mainAlpha)
        drawRing(ctx, theta, phi, [1, 0, 0], [0, 1, 0], [0, 0, 1], '#3498db', mainAlpha)
      }

      // Project all 6 axis endpoints (+/-)
      const items: Array<{ x: number; y: number; z: number; label: string; color: string; back: boolean }> = []
      for (const axis of AXES) {
        const dx = axis.label === 'X' ? 1 : 0
        const dy = axis.label === 'Y' ? 1 : 0
        const dz = axis.label === 'Z' ? 1 : 0
        const pos = project(dx, dy, dz, theta, phi)
        const neg = project(-dx, -dy, -dz, theta, phi)
        items.push({ x: pos.x, y: pos.y, z: pos.z, label: axis.label, color: axis.color, back: false })
        items.push({ x: neg.x, y: neg.y, z: neg.z, label: '', color: axis.color, back: true })
      }

      items.sort((a, b) => a.z - b.z)

      for (const item of items) {
        const sx = CENTER + item.x * AXIS_LEN
        const sy = CENTER + item.y * AXIS_LEN
        const r = item.back ? BALL_R_BACK : BALL_R

        ctx.strokeStyle = item.back ? 'rgba(255,255,255,0.15)' : item.color
        ctx.lineWidth = item.back ? 1 : 2
        ctx.beginPath()
        ctx.moveTo(CENTER, CENTER)
        ctx.lineTo(sx, sy)
        ctx.stroke()

        ctx.fillStyle = item.back ? 'rgba(80,80,90,0.7)' : item.color
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fill()

        if (item.label) {
          ctx.fillStyle = '#fff'
          ctx.font = `bold 9px 'Space Grotesk', system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(item.label, sx, sy)
        }
      }

      // Center dot
      ctx.fillStyle = 'rgba(200, 200, 210, 0.8)'
      ctx.beginPath()
      ctx.arc(CENTER, CENTER, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [controlsRef, hovered, dragging])

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.lastX
    const dy = e.clientY - d.lastY
    d.lastX = e.clientX
    d.lastY = e.clientY
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true

    const controls = controlsRef.current
    if (!controls) return
    const { theta, phi } = controls.getAngles()
    const newTheta = theta - dx * ROTATE_SPEED
    const newPhi = Math.max(0.01, Math.min(Math.PI - 0.01, phi - dy * ROTATE_SPEED))
    controls.setAngles(newTheta, newPhi)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    d.active = false
    setDragging(false)

    // If no drag movement, treat as click (axis snap)
    if (!d.moved) handleClick(e)
  }

  const handleClick = (e: React.PointerEvent) => {
    const controls = controlsRef.current
    if (!controls) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left - CENTER
    const my = e.clientY - rect.top - CENTER

    const { theta, phi } = controls.getAngles()

    for (const axis of AXES) {
      const dx = axis.label === 'X' ? 1 : 0
      const dy = axis.label === 'Y' ? 1 : 0
      const dz = axis.label === 'Z' ? 1 : 0

      const pos = project(dx, dy, dz, theta, phi)
      const psx = pos.x * AXIS_LEN, psy = pos.y * AXIS_LEN
      if ((mx - psx) ** 2 + (my - psy) ** 2 < BALL_R * BALL_R * 2) {
        controls.setAngles(axis.theta, axis.phi)
        return
      }

      const neg = project(-dx, -dy, -dz, theta, phi)
      const nsx = neg.x * AXIS_LEN, nsy = neg.y * AXIS_LEN
      if ((mx - nsx) ** 2 + (my - nsy) ** 2 < BALL_R_BACK * BALL_R_BACK * 2) {
        controls.setAngles(axis.theta + Math.PI, Math.PI - axis.phi)
        return
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="navigation-gizmo"
      width={SIZE}
      height={SIZE}
      style={{
        width: SIZE,
        height: SIZE,
        cursor: dragging ? 'grabbing' : hovered ? 'grab' : 'default',
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => { setHovered(false); if (!dragRef.current.active) setDragging(false) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
