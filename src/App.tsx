import { useRef, useState, useCallback } from 'react'
import SDFCanvas from './canvas/SDFCanvas'
import CanvasToolbar from './canvas/CanvasToolbar'
import LayerPanel from './panels/LayerPanel'
import PropertiesPanel from './panels/PropertiesPanel'
import TimelinePanel from './panels/TimelinePanel'
import { useChoanStore } from './store/useChoanStore'
import { toMarkdown } from './export/toMarkdown'
import { TooltipProvider } from './components/ui/Tooltip'
import { Button } from './components/ui/Button'
import { track } from './utils/analytics'

export default function App() {
  const {
    elements, animationBundles,
    tool, pendingSkin, pendingFrame,
    setTool, setPendingSkin, setPendingFrame,
  } = useChoanStore()

  const [exportMsg, setExportMsg]       = useState('')
  const [timelineHeight, setTimelineHeight] = useState(180)
  const isDraggingRef   = useRef(false)
  const dragStartYRef   = useRef(0)
  const dragStartHRef   = useRef(0)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    dragStartYRef.current = e.clientY
    dragStartHRef.current = timelineHeight
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [timelineHeight])

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dy = dragStartYRef.current - e.clientY
    setTimelineHeight(Math.max(80, Math.min(600, dragStartHRef.current + dy)))
  }, [])

  const handleResizeEnd = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  const handleExport = async () => {
    const md = toMarkdown(elements, animationBundles)
    track('export-markdown', { elementCount: elements.length })
    try {
      await navigator.clipboard.writeText(md)
      setExportMsg('Copied to clipboard!')
    } catch {
      setExportMsg('Copy failed')
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'choan.md'
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setExportMsg(''), 3000)
  }

  return (
    <TooltipProvider>
      <div className="app" data-theme="dark">
        <div className="toolbar">
          <span className="app-logo">
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="" className="app-logo__img" />
            Sketch UI · LLM Ready
          </span>
          <div className="toolbar-spacer" />
          <div className="action-group">
            <Button variant="primary" onClick={handleExport}>Export MD</Button>
          </div>
          {exportMsg && <span className="export-msg">{exportMsg}</span>}
        </div>

        <div className="main">
          <div className="left-panel">
            <CanvasToolbar
              tool={tool}
              pendingSkin={pendingSkin}
              pendingFrame={pendingFrame}
              onSetTool={setTool}
              onSetPendingSkin={setPendingSkin}
              onSetPendingFrame={setPendingFrame}
            />
            <LayerPanel />
          </div>
          <div className="main-center">
            <div className="canvas-area" data-theme="light">
              <SDFCanvas />
            </div>
            <div
              className="resize-handle-h"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
            />
            <TimelinePanel visible height={timelineHeight} />
          </div>
          <div className="right-panel">
            <PropertiesPanel />
          </div>
        </div>

      </div>
    </TooltipProvider>
  )
}
