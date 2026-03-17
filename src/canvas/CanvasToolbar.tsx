// Canvas floating toolbar — tool buttons.

import type { Tool } from '../store/useChoanStore'
import { Cursor, Rectangle } from '@phosphor-icons/react'

interface CanvasToolbarProps {
  tool: Tool
  onSetTool: (t: Tool) => void
}

export default function CanvasToolbar({ tool, onSetTool }: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <button className={`canvas-tool ${tool === 'select' ? 'active' : ''}`} onClick={() => onSetTool('select')} title="Select (V)"><Cursor size={16} /></button>
      <button className={`canvas-tool ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => onSetTool('rectangle')} title="Rectangle (R)"><Rectangle size={16} /></button>
    </div>
  )
}
