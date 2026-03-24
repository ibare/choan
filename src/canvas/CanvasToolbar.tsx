// Left-side toolbar — tool selection + skin/frame shortcuts.

import type { Tool } from '../store/useChoanStore'
import { Cursor, Rectangle, Browser, DeviceMobile } from '@phosphor-icons/react'
import { SKIN_REGISTRY } from '../config/skins'
import { Tooltip } from '../components/ui/Tooltip'
import { Button } from '../components/ui/Button'

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
        <Button
          className="side-tool"
          active={isSelectActive}
          onClick={() => { onSetTool('select'); clearAll() }}
        >
          <Cursor size={18} />
        </Button>
      </Tooltip>

      <Tooltip content="Rectangle (R)">
        <Button
          className="side-tool"
          active={isRectActive}
          onClick={() => { onSetTool('rectangle'); clearAll() }}
        >
          <Rectangle size={18} />
        </Button>
      </Tooltip>

      <div className="toolbar-separator" />

      <Tooltip content="Browser Frame">
        <Button
          className="side-tool"
          active={pendingFrame === 'browser'}
          onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingFrame('browser') }}
        >
          <Browser size={18} />
        </Button>
      </Tooltip>

      <Tooltip content="Mobile Frame">
        <Button
          className="side-tool"
          active={pendingFrame === 'mobile'}
          onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingFrame('mobile') }}
        >
          <DeviceMobile size={18} />
        </Button>
      </Tooltip>

      <div className="toolbar-separator" />

      {SKIN_REGISTRY.map(({ id, label, Icon }) => (
        <Tooltip key={id} content={label}>
          <Button
            className="side-tool"
            active={pendingSkin === id}
            onClick={() => { onSetTool('rectangle'); clearAll(); onSetPendingSkin(id) }}
          >
            <Icon size={18} />
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}
