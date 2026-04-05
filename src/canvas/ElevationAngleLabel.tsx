// Elevation angle label — shows viewport-to-target elevation angle next to the target marker.
// DOM updates are driven by useAnimateLoop (no independent rAF loop) via the shared ref.

import { useRef, useEffect, type MutableRefObject } from 'react'

interface ElevationAngleLabelProps {
  /** Shared ref to the label DOM element — useAnimateLoop writes position/text directly. */
  labelElRef: MutableRefObject<HTMLSpanElement | null>
}

export default function ElevationAngleLabel({ labelElRef }: ElevationAngleLabelProps) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    labelElRef.current = spanRef.current
    return () => { labelElRef.current = null }
  }, [labelElRef])

  return (
    <span
      ref={spanRef}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'nowrap',
        padding: '1px 5px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.85)',
        display: 'none',
      }}
    />
  )
}
