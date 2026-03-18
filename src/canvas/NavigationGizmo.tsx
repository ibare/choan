// Blender-style Navigation Gizmo — 3D axis indicator with click-to-snap views.
// Renders on a small HTML canvas overlay in the top-right of the viewport.

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { OrbitControls } from '../engine/controls'

interface NavigationGizmoProps {
  controlsRef: MutableRefObject<OrbitControls | null>
}

const SIZE = 100
const CENTER = SIZE / 2
const AXIS_LEN = 32
const BALL_R = 10
const BALL_R_BACK = 6
const BG_R = 44

// Axis definitions: direction in spherical (theta, phi), label, color
const AXES = [
  { label: 'X', color: '#e74c3c', theta: Math.PI / 2, phi: Math.PI / 2 },   // +X: right
  { label: 'Y', color: '#2ecc71', theta: 0, phi: 0 },                        // +Y: up
  { label: 'Z', color: '#3498db', theta: 0, phi: Math.PI / 2 },              // +Z: front
]

// Project a 3D unit vector to 2D gizmo space using the current camera angles
function project(ax: number, ay: number, az: number, theta: number, phi: number): { x: number; y: number; z: number } {
  const st = Math.sin(theta), ct = Math.cos(theta)
  const sp = Math.sin(phi), cp = Math.cos(phi)

  // Camera basis vectors (same math as OrbitControls)
  // View matrix: rotate by -theta around Y, then tilt by -(phi - PI/2) around X
  const rx = ct, rz = -st
  const ux = -cp * st, uy = sp, uz = -cp * ct
  const fx = sp * st, fy = cp, fz = sp * ct

  // Project onto screen (right, up) — discard forward
  const sx = ax * rx + ay * 0 + az * rz
  const sy = ax * ux + ay * uy + az * uz
  const depth = ax * fx + ay * fy + az * fz

  return { x: sx, y: -sy, z: depth }
}

export default function NavigationGizmo({ controlsRef }: NavigationGizmoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)

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
      ctx.clearRect(0, 0, SIZE, SIZE)

      // Background circle
      ctx.fillStyle = 'rgba(30, 30, 40, 0)'
      ctx.beginPath()
      ctx.arc(CENTER, CENTER, BG_R, 0, Math.PI * 2)
      ctx.fill()

      // Project all 6 axis endpoints (+/-)
      const items: Array<{ x: number; y: number; z: number; label: string; color: string; back: boolean }> = []
      for (const axis of AXES) {
        // Unit direction vector for this axis
        const dx = axis.label === 'X' ? 1 : 0
        const dy = axis.label === 'Y' ? 1 : 0
        const dz = axis.label === 'Z' ? 1 : 0

        const pos = project(dx, dy, dz, theta, phi)
        const neg = project(-dx, -dy, -dz, theta, phi)

        items.push({ x: pos.x, y: pos.y, z: pos.z, label: axis.label, color: axis.color, back: false })
        items.push({ x: neg.x, y: neg.y, z: neg.z, label: '', color: axis.color, back: true })
      }

      // Sort by depth (back to front)
      items.sort((a, b) => a.z - b.z)

      // Draw
      for (const item of items) {
        const sx = CENTER + item.x * AXIS_LEN
        const sy = CENTER + item.y * AXIS_LEN
        const r = item.back ? BALL_R_BACK : BALL_R

        // Axis line from center
        ctx.strokeStyle = item.back ? 'rgba(255,255,255,0.15)' : item.color
        ctx.lineWidth = item.back ? 1 : 2
        ctx.beginPath()
        ctx.moveTo(CENTER, CENTER)
        ctx.lineTo(sx, sy)
        ctx.stroke()

        // Ball
        ctx.fillStyle = item.back ? 'rgba(80,80,90,0.7)' : item.color
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fill()

        // Label
        if (item.label) {
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 9px Inter, system-ui, sans-serif'
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
  }, [controlsRef])

  const handleClick = (e: React.MouseEvent) => {
    const controls = controlsRef.current
    if (!controls) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left - CENTER
    const my = e.clientY - rect.top - CENTER

    const { theta, phi } = controls.getAngles()

    // Check which axis ball was clicked
    for (const axis of AXES) {
      const dx = axis.label === 'X' ? 1 : 0
      const dy = axis.label === 'Y' ? 1 : 0
      const dz = axis.label === 'Z' ? 1 : 0

      // Positive
      const pos = project(dx, dy, dz, theta, phi)
      const psx = pos.x * AXIS_LEN, psy = pos.y * AXIS_LEN
      if ((mx - psx) ** 2 + (my - psy) ** 2 < BALL_R * BALL_R * 2) {
        controls.setAngles(axis.theta, axis.phi)
        return
      }

      // Negative
      const neg = project(-dx, -dy, -dz, theta, phi)
      const nsx = neg.x * AXIS_LEN, nsy = neg.y * AXIS_LEN
      if ((mx - nsx) ** 2 + (my - nsy) ** 2 < BALL_R_BACK * BALL_R_BACK * 2) {
        // Opposite view
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
      style={{ width: SIZE, height: SIZE }}
      onClick={handleClick}
    />
  )
}
