// Canvas floating toolbar — tool buttons + draw color swatches.

import type { Tool } from '../store/useChoanStore'
import { THEME_COLORS } from './materials'
import { Cursor, Rectangle, Circle, LineSegment } from '@phosphor-icons/react'

interface CanvasToolbarProps {
  tool: Tool
  drawColor: number
  onSetTool: (t: Tool) => void
  onSetDrawColor: (hex: number) => void
}

export default function CanvasToolbar({ tool, drawColor, onSetTool, onSetDrawColor }: CanvasToolbarProps) {
  return (
    <>
      <div className="canvas-toolbar">
        <button className={`canvas-tool ${tool === 'select' ? 'active' : ''}`} onClick={() => onSetTool('select')} title="Select (V)"><Cursor size={16} /></button>
        <button className={`canvas-tool ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => onSetTool('rectangle')} title="Rectangle (R)"><Rectangle size={16} /></button>
        <button className={`canvas-tool ${tool === 'circle' ? 'active' : ''}`} onClick={() => onSetTool('circle')} title="Circle (C)"><Circle size={16} /></button>
        <button className={`canvas-tool ${tool === 'line' ? 'active' : ''}`} onClick={() => onSetTool('line')} title="Line (L)"><LineSegment size={16} /></button>
      </div>
      <div className="canvas-toolbar color-picker-toolbar">
        {THEME_COLORS.map(({ name, hex }) => (
          <button
            key={hex}
            className={`color-swatch ${drawColor === hex ? 'active' : ''}`}
            style={{ background: `#${hex.toString(16).padStart(6, '0')}` }}
            onClick={() => onSetDrawColor(hex)}
            title={name}
          />
        ))}
      </div>
    </>
  )
}
