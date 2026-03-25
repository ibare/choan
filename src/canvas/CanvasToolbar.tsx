// Left-side toolbar — tool selection + frame shortcuts (2-column).
// Skins are accessed via Quick Skin Picker (S key).

import type { Tool } from '../store/useChoanStore'
import { Cursor, Rectangle, Browser, DeviceMobile, Swatches } from '@phosphor-icons/react'
import { Tooltip } from '../components/ui/Tooltip'
import { Button } from '../components/ui/Button'

interface CanvasToolbarProps {
  tool: Tool
  pendingSkin: string | null
  pendingFrame: string | null
  onSetTool: (t: Tool) => void
  onSetPendingSkin: (skin: string | null) => void
  onSetPendingFrame: (frame: string | null) => void
  onOpenSkinPicker: () => void
}

export default function CanvasToolbar({ tool, pendingSkin, pendingFrame, onSetTool, onSetPendingSkin, onSetPendingFrame, onOpenSkinPicker }: CanvasToolbarProps) {
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

      <Tooltip content="Skin Components (S)">
        <Button
          className="side-tool"
          active={!!pendingSkin}
          onClick={onOpenSkinPicker}
        >
          <Swatches size={18} />
        </Button>
      </Tooltip>
    </div>
  )
}
