// Toolbar — grid layout for left side panel. Each skin is a tool button with a Phosphor icon.

import type { Tool } from '../store/useChoanStore'
import {
  Cursor, Rectangle,
  ToggleRight, CheckSquare, RadioButton, CursorClick, SlidersHorizontal,
  TextT, ChartBar, CircleHalf, Star, UserCircle,
  MagnifyingGlass, CaretDown, TextAa, Table, Image, Heart,
} from '@phosphor-icons/react'

interface CanvasToolbarProps {
  tool: Tool
  pendingSkin: string | null
  onSetTool: (t: Tool) => void
  onSetPendingSkin: (skin: string | null) => void
}

const SKIN_TOOLS: { skin: string; icon: React.ReactNode; label: string }[] = [
  { skin: 'switch', icon: <ToggleRight size={18} />, label: 'Switch' },
  { skin: 'checkbox', icon: <CheckSquare size={18} />, label: 'Checkbox' },
  { skin: 'radio', icon: <RadioButton size={18} />, label: 'Radio' },
  { skin: 'button', icon: <CursorClick size={18} />, label: 'Button' },
  { skin: 'slider', icon: <SlidersHorizontal size={18} />, label: 'Slider' },
  { skin: 'text-input', icon: <TextT size={18} />, label: 'Text Input' },
  { skin: 'progress', icon: <ChartBar size={18} />, label: 'Progress' },
  { skin: 'badge', icon: <CircleHalf size={18} />, label: 'Badge' },
  { skin: 'star-rating', icon: <Star size={18} />, label: 'Star Rating' },
  { skin: 'avatar', icon: <UserCircle size={18} />, label: 'Avatar' },
  { skin: 'search', icon: <MagnifyingGlass size={18} />, label: 'Search' },
  { skin: 'dropdown', icon: <CaretDown size={18} />, label: 'Dropdown' },
  { skin: 'text', icon: <TextAa size={18} />, label: 'Text' },
  { skin: 'table-skeleton', icon: <Table size={18} />, label: 'Table' },
  { skin: 'image', icon: <Image size={18} />, label: 'Image' },
  { skin: 'icon', icon: <Heart size={18} />, label: 'Icon' },
]

export default function CanvasToolbar({ tool, pendingSkin, onSetTool, onSetPendingSkin }: CanvasToolbarProps) {
  return (
    <div className="side-toolbar">
      <button className={`side-tool ${tool === 'select' && !pendingSkin ? 'active' : ''}`}
        onClick={() => { onSetTool('select'); onSetPendingSkin(null) }} title="Select (V)">
        <Cursor size={18} />
      </button>
      <button className={`side-tool ${tool === 'rectangle' && !pendingSkin ? 'active' : ''}`}
        onClick={() => { onSetTool('rectangle'); onSetPendingSkin(null) }} title="Rectangle (R)">
        <Rectangle size={18} />
      </button>

      <div className="toolbar-separator" />

      {SKIN_TOOLS.map(({ skin, icon, label }) => (
        <button
          key={skin}
          className={`side-tool ${pendingSkin === skin ? 'active' : ''}`}
          onClick={() => { onSetTool('rectangle'); onSetPendingSkin(skin) }}
          title={label}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
