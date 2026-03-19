// Canvas frame indicator — shows FPS and zoom level as a floating badge.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'

interface FrameIndicatorProps {
  zoomScaleRef: MutableRefObject<number>
}

export default function FrameIndicator({ zoomScaleRef }: FrameIndicatorProps) {
  const [fps, setFps] = useState(0)
  const [zoom, setZoom] = useState(100)
  const rafRef = useRef(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      frameCountRef.current++

      const elapsed = now - lastTimeRef.current
      if (elapsed >= 500) {
        setFps(Math.round((frameCountRef.current / elapsed) * 1000))
        setZoom(Math.round(100 / zoomScaleRef.current))
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [zoomScaleRef])

  const dotColor = fps >= 55 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <div className="frame-indicator">
      <span className="frame-indicator-dot" style={{ background: dotColor }} />
      <span className="frame-indicator-fps">{fps} fps</span>
      <span className="frame-indicator-sep">/</span>
      <span className="frame-indicator-zoom">{zoom}%</span>
    </div>
  )
}
