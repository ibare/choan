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
import { Moon, Sun } from '@phosphor-icons/react'

export default function App() {
  const {
    elements, animationBundles,
    tool, pendingSkin, pendingFrame,
    setTool, setPendingSkin, setPendingFrame,
  } = useChoanStore()

  const [projectName, setProjectName]   = useState('My UI')
  const [exportMsg, setExportMsg]       = useState('')
  const [theme, setTheme]               = useState<'light' | 'dark'>('dark')
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
    try {
      await navigator.clipboard.writeText(md)
      setExportMsg('클립보드에 복사됨!')
    } catch {
      setExportMsg('복사 실패')
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.md`
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setExportMsg(''), 3000)
  }

  return (
    <TooltipProvider>
      <div className="app" data-theme={theme}>
        <div className="toolbar">
          <span className="app-logo">초안</span>
          <input
            className="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <div className="toolbar-spacer" />
          <div className="action-group">
            <Button variant="primary" onClick={handleExport}>Export MD</Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
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
