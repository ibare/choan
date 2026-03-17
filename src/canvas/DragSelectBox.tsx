// Drag-select (lasso) box overlay.

interface DragSelectBoxProps {
  box: { left: number; top: number; width: number; height: number } | null
}

export default function DragSelectBox({ box }: DragSelectBoxProps) {
  if (!box) return null
  return (
    <div style={{
      position: 'absolute',
      left: box.left, top: box.top,
      width: box.width, height: box.height,
      border: '1.5px solid rgba(66,133,244,0.8)',
      background: 'rgba(66,133,244,0.08)',
      borderRadius: 2, pointerEvents: 'none',
    }} />
  )
}
