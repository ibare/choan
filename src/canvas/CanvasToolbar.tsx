// Toolbar — grid layout for left side panel.

import type { Tool } from '../store/useChoanStore'
import { Cursor, Rectangle } from '@phosphor-icons/react'

interface CanvasToolbarProps {
  tool: Tool
  onSetTool: (t: Tool) => void
}

export default function CanvasToolbar({ tool, onSetTool }: CanvasToolbarProps) {
  return (
    <div className="side-toolbar">
      <button className={`side-tool ${tool === 'select' ? 'active' : ''}`} onClick={() => onSetTool('select')} title="Select (V)"><Cursor size={18} /></button>
      <button className={`side-tool ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => onSetTool('rectangle')} title="Rectangle (R)"><Rectangle size={18} /></button>
    </div>
  )
}
