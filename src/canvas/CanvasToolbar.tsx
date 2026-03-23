// Left-side toolbar — tool selection + skin/frame shortcuts.

import type { Tool } from '../store/useChoanStore'
import { Cursor, Rectangle, Browser, DeviceMobile } from '@phosphor-icons/react'
import { SKIN_REGISTRY } from '../config/skins'
import { Tooltip } from '../components/ui/Tooltip'

interface CanvasToolbarProps {
  tool: Tool
  pendingSkin: string | null
  pendingFrame: string | null
  onSetTool: (t: Tool) => void
  onSetPendingSkin: (skin: string | null) => void
  onSetPendingFrame: (frame: string | null) => void
}

export default function CanvasToolbar({ tool, pendingSkin, pendingFrame, onSetTool, onSetPendingSkin, onSetPendingFrame }: CanvasToolbarProps) {
  const clearAll = () => { onSetPendingSkin(null); onSetPendingFrame(null) }

  const isSelectActive   = tool === 'select' && !pendingSkin && !pendingFrame
  const isRectActive     = tool === 'rectangle' && !pendingSkin && !pendingFrame

  return (
    <div className="side-toolbar">
      <Tooltip content="Select (V)">
        <button
          className={`side-tool ${isSelectActive ? 'active' : ''}`}
          onClick={() => { onSetTool('select'); clearAll() }}
        >
          <Cursor size={18} />
        </button>
      </Tooltip>

      <Tooltip content="Rectangle (R)">
        <button
          className={`side-tool ${isRectActive ? 'active' : ''}`}
          onClick={() => { onSetTool('rectangle'); clearAll() }}
        >
          <Rectangle size={18} />
        </button>
      </Tooltip>

      <div className="toolbar-separator" />

      <Tooltip content="Browser Frame">
        <button
          className={`side-tool ${pendingFrame === 'browser' ? 'active' : ''}`}
          onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingFrame('browser') }}
        >
          <Browser size={18} />
        </button>
      </Tooltip>

      <Tooltip content="Mobile Frame">
        <button
          className={`side-tool ${pendingFrame === 'mobile' ? 'active' : ''}`}
          onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingFrame('mobile') }}
        >
          <DeviceMobile size={18} />
        </button>
      </Tooltip>

      <div className="toolbar-separator" />

      {SKIN_REGISTRY.map(({ id, label, Icon }) => (
        <Tooltip key={id} content={label}>
          <button
            className={`side-tool ${pendingSkin === id ? 'active' : ''}`}
            onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingSkin(id) }}
          >
            <Icon size={18} />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
