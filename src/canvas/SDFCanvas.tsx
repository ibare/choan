import { useEffect, useRef } from 'react'
import { createSDFRenderer, type SDFRenderer } from '../engine/renderer'

export default function SDFCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SDFRenderer | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const renderer = createSDFRenderer(mount)
    rendererRef.current = renderer

    // Render loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      renderer.render()
    }
    animate()

    // Resize observer
    const ro = new ResizeObserver(() => {
      renderer.resize(mount.clientWidth, mount.clientHeight)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      renderer.dispose()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor: 'default' }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
