import { useEffect, useRef } from 'react'
import { createSDFRenderer, type SDFRenderer } from '../engine/renderer'
import { useChoanStore } from '../store/useChoanStore'

export default function SDFCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SDFRenderer | null>(null)
  const frameRef = useRef<number>(0)

  const elements = useChoanStore((s) => s.elements)

  // Initialize renderer
  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const renderer = createSDFRenderer(mount)
    rendererRef.current = renderer

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      renderer.render()
    }
    animate()

    const ro = new ResizeObserver(() => {
      renderer.resize(mount.clientWidth, mount.clientHeight)
      // Re-sync scene after resize (coordinate conversion depends on canvas size)
      const { elements } = useChoanStore.getState()
      renderer.updateScene(elements)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  // Sync elements → GPU
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateScene(elements)
    }
  }, [elements])

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
