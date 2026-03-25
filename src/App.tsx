import { useRef, useState, useCallback, useEffect } from 'react'
import SDFCanvas from './canvas/SDFCanvas'
import CanvasToolbar from './canvas/CanvasToolbar'
import QuickSkinPicker from './canvas/QuickSkinPicker'
import LayerPanel from './panels/LayerPanel'
import PropertiesPanel from './panels/PropertiesPanel'
import TimelinePanel from './panels/TimelinePanel'
import { useChoanStore } from './store/useChoanStore'
import { toMarkdown } from './export/toMarkdown'
import { Tooltip, TooltipProvider } from './components/ui/Tooltip'
import { Toast, ToastViewport, ToastProvider } from './components/ui/Toast'
import { Button } from './components/ui/Button'
import { DownloadSimple } from '@phosphor-icons/react'
import { track } from './utils/analytics'
import { startExportAnim, MERGE_DURATION, BLOB_DURATION } from './canvas/exportAnimation'

export default function App() {
  const {
    elements, animationBundles,
    tool, pendingSkin, pendingFrame,
    setTool, setPendingSkin, setPendingFrame,
  } = useChoanStore()

  const [toastOpen, setToastOpen]       = useState(false)
  const [toastMsg, setToastMsg]         = useState('')
  const [timelineHeight, setTimelineHeight] = useState(180)
  const [leftPanelWidth, setLeftPanelWidth] = useState(160)
  const [rightPanelWidth, setRightPanelWidth] = useState(260)
  const [skinPickerOpen, setSkinPickerOpen] = useState(false)

  // S key → toggle Quick Skin Picker
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setSkinPickerOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Generic drag resize helper
  const dragRef = useRef<{ axis: 'x-left' | 'x-right' | 'y'; startPos: number; startSize: number } | null>(null)

  const handleDragStart = useCallback((axis: 'x-left' | 'x-right' | 'y') => (e: React.PointerEvent) => {
    const startPos = axis === 'y' ? e.clientY : e.clientX
    const startSize = axis === 'y' ? timelineHeight : axis === 'x-left' ? leftPanelWidth : rightPanelWidth
    dragRef.current = { axis, startPos, startSize }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [timelineHeight, leftPanelWidth, rightPanelWidth])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    if (d.axis === 'y') {
      const dy = d.startPos - e.clientY
      setTimelineHeight(Math.max(80, Math.min(600, d.startSize + dy)))
    } else if (d.axis === 'x-left') {
      const dx = e.clientX - d.startPos
      setLeftPanelWidth(Math.max(80, Math.min(320, d.startSize + dx)))
    } else {
      const dx = d.startPos - e.clientX
      setRightPanelWidth(Math.max(180, Math.min(400, d.startSize + dx)))
    }
  }, [])

  const handleDragEnd = useCallback(() => { dragRef.current = null }, [])

  const handleCopyToClipboard = async () => {
    const md = toMarkdown(elements, animationBundles)
    track('export-markdown', { elementCount: elements.length })

    // Copy immediately in background
    let copyOk = true
    try { await navigator.clipboard.writeText(md) }
    catch { copyOk = false }

    // Start visual animation, show toast at blob phase
    startExportAnim()
    setTimeout(() => {
      setToastMsg(copyOk ? 'Copied! Paste it into your AI chat.' : 'Copy failed')
      setToastOpen(true)
    }, MERGE_DURATION + BLOB_DURATION * 0.3)
  }

  const handleDownload = () => {
    const md = toMarkdown(elements, animationBundles)
    track('export-markdown', { elementCount: elements.length })
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'choan.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ToastProvider>
    <TooltipProvider>
      <div className="app" data-theme="dark">
        <div className="toolbar">
          <span className="app-logo">
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="" className="app-logo__img" />
            Sketch UI · LLM Ready
          </span>
          <div className="toolbar-spacer" />
          <div className="action-group">
            <div className="speak-btn-group">
              <Button variant="primary" className="speak-btn__main" onClick={handleCopyToClipboard}>Speak LLM</Button>
              <Tooltip content="Download .md">
                <Button variant="primary" className="speak-btn__save" onClick={handleDownload}>
                  <DownloadSimple size={15} weight="bold" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="left-panel" style={{ width: leftPanelWidth }}>
            <CanvasToolbar
              tool={tool}
              pendingSkin={pendingSkin}
              pendingFrame={pendingFrame}
              onSetTool={setTool}
              onSetPendingSkin={setPendingSkin}
              onSetPendingFrame={setPendingFrame}
              onOpenSkinPicker={() => setSkinPickerOpen(true)}
            />
            <LayerPanel />
          </div>
          <div
            className="resize-handle-v"
            onPointerDown={handleDragStart('x-left')}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          />
          <div className="main-center">
            <div className="canvas-area" data-theme="light">
              <SDFCanvas />
            </div>
            <div
              className="resize-handle-h"
              onPointerDown={handleDragStart('y')}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
            />
            <TimelinePanel visible height={timelineHeight} />
          </div>
          <div
            className="resize-handle-v"
            onPointerDown={handleDragStart('x-right')}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          />
          <div className="right-panel" style={{ width: rightPanelWidth }}>
            <PropertiesPanel />
          </div>
        </div>

        <QuickSkinPicker
          open={skinPickerOpen}
          onClose={() => setSkinPickerOpen(false)}
        />

        <Toast open={toastOpen} onOpenChange={setToastOpen}>{toastMsg}</Toast>
        <ToastViewport />
      </div>
    </TooltipProvider>
    </ToastProvider>
  )
}
