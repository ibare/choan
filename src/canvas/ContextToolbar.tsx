// Floating context toolbar — appears above selected element.
// Shows element-type-relevant quick controls to reduce trips to the right inspector.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as RadixPopover from '@radix-ui/react-popover'
import { useElementStore } from '../store/useElementStore'
import { pixelToWorld as pixelToWorldCS } from '../coords/coordinateSystem'
// SKIN_REGISTRY no longer used — skin picker removed from toolbar
import type { SDFRenderer } from '../engine/renderer'
import type { OrbitControls } from '../engine/controls'
import {
  SquareLogo, SquareSplitHorizontal, SquareSplitVertical, SquaresFour,
  Rectangle, RectangleDashed, Angle, ArrowsOutLineHorizontal, FrameCorners, Columns,
  ToggleRight, Percent, Hash, Star, ArrowsClockwise, TextB, Play, Pause,
} from '@phosphor-icons/react'
import ColorPicker from './ColorPicker'
import { ICON_NAMES, ICON_PATHS } from '../engine/iconPaths'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface Props {
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  rendererRef: MutableRefObject<SDFRenderer | null>
  isDraggingRef: MutableRefObject<boolean>
  isResizingRef: MutableRefObject<boolean>
  isDrawingRef: MutableRefObject<boolean>
  controlsRef: MutableRefObject<OrbitControls | null>
}

const DIR_OPTIONS = [
  { value: 'free',   Icon: SquareLogo,            label: 'Free'   },
  { value: 'row',    Icon: SquareSplitHorizontal, label: 'Row'    },
  { value: 'column', Icon: SquareSplitVertical,   label: 'Column' },
  { value: 'grid',   Icon: SquaresFour,           label: 'Grid'   },
] as const

type LayoutDir = 'free' | 'row' | 'column' | 'grid'

const colorToHex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const hexToColor = (s: string) => parseInt(s.slice(1), 16)

// ── Scrubable number input ───────────────────────────────────
// Hover → ew-resize cursor, drag horizontally to scrub.
// Click (no drag) → switch to keyboard text input.

function ScrubInput({ icon, value, min, max, onChange }: {
  icon: React.ReactNode
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef({ active: false, startX: 0, startVal: 0, moved: false })

  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)))

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editing) return
    dragRef.current = { active: true, startX: e.clientX, startVal: value, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 2) {
      d.moved = true
      onChange(clamp(d.startVal + dx))
    }
  }

  const handlePointerUp = () => {
    const d = dragRef.current
    if (!d.active) return
    d.active = false
    if (!d.moved) {
      setEditing(true)
      setDraft(String(value))
      requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    }
  }

  const commit = () => {
    setEditing(false)
    onChange(clamp(Number(draft) || 0))
  }

  return (
    <div
      className={`ctx-scrub${editing ? ' editing' : ''}`}
      onPointerDown={editing ? undefined : handlePointerDown}
      onPointerMove={editing ? undefined : handlePointerMove}
      onPointerUp={editing ? undefined : handlePointerUp}
    >
      <span className="ctx-scrub__icon">{icon}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="ctx-scrub__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <span className="ctx-scrub__value">{value}</span>
      )}
    </div>
  )
}

// ── Skin-specific toolbar options ─────────────────────────────
// Returns inline toolbar controls based on skin type.

type CS = Record<string, unknown>

function IconSvg({ name, size = 16 }: { name: string; size?: number }) {
  const d = (ICON_PATHS as Record<string, string>)[name]
  if (!d) return null
  return <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor"><path d={d} /></svg>
}

function SkinToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button className="ctx-btn" active={active} title={label} onClick={onClick}>
      <ToggleRight size={15} />
    </Button>
  )
}

function renderSkinOptions(skin: string, cs: CS, setCS: (patch: CS) => void, iconOpen: boolean, setIconOpen: (v: boolean) => void) {
  const bool = (key: string) => !!cs[key]
  const toggleBtn = (key: string, label: string) => (
    <SkinToggle label={label} active={bool(key)} onClick={() => setCS({ [key]: !bool(key) })} />
  )
  const pctScrub = (key: string, label: string) => (
    <ScrubInput
      icon={<Percent size={13} />}
      value={Math.round((Number(cs[key]) || 0) * 100)}
      min={0} max={100}
      onChange={(v) => setCS({ [key]: v / 100 })}
    />
  )
  const textInput = (key: string, placeholder: string) => (
    <Input
      className="ctx-text-input"
      value={(cs[key] as string) || ''}
      placeholder={placeholder}
      onChange={(e) => setCS({ [key]: e.target.value })}
    />
  )

  switch (skin) {
    case 'switch':     return toggleBtn('on', 'On/Off')
    case 'checkbox':   return toggleBtn('checked', 'Checked')
    case 'radio':      return toggleBtn('selected', 'Selected')
    case 'button':     return <>{textInput('label', 'Button')}{toggleBtn('pressed', 'Pressed')}</>
    case 'slider':     return pctScrub('value', 'Value')
    case 'text-input': return <>{textInput('placeholder', 'Type here...')}{toggleBtn('focused', 'Focused')}</>
    case 'progress':   return pctScrub('value', 'Value')
    case 'badge':
      return <ScrubInput icon={<Hash size={13} />} value={Math.max(1, Number(cs.count) || 1)} min={1} max={99} onChange={(v) => setCS({ count: Math.max(1, v) })} />
    case 'star-rating':
      return <ScrubInput icon={<Star size={13} />} value={Number(cs.rating) || 0} min={0} max={5} onChange={(v) => setCS({ rating: v })} />
    case 'avatar':     return toggleBtn('online', 'Online')
    case 'dropdown':   return toggleBtn('open', 'Open')
    case 'text':       return <>{textInput('text', 'Text')}{toggleBtn('bold', 'Bold')}</>
    case 'table-skeleton':
      return <ScrubInput icon={<Columns size={13} />} value={Number(cs.columns) || 3} min={1} max={10} onChange={(v) => setCS({ columns: v })} />
    case 'image':
      return (
        <>
          <Button className="ctx-btn" title="Shuffle" onClick={() => setCS({ seed: Math.floor(Math.random() * 9999) })}>
            <ArrowsClockwise size={15} />
          </Button>
          <Button className="ctx-btn" title={cs.playing ? 'Pause' : 'Play'} active={!!cs.playing} onClick={() => setCS({ playing: !cs.playing })}>
            {cs.playing ? <Pause size={15} /> : <Play size={15} />}
          </Button>
        </>
      )
    case 'search':     return textInput('query', 'Search...')
    case 'icon':
      return (
        <RadixPopover.Root open={iconOpen} onOpenChange={setIconOpen}>
          <RadixPopover.Trigger asChild>
            <Button className="ctx-btn" title="Change Icon">
              <IconSvg name={(cs.icon as string) || 'heart'} size={15} />
            </Button>
          </RadixPopover.Trigger>
          <RadixPopover.Portal>
            <RadixPopover.Content
              className="ctx-icon-picker"
              data-theme="dark"
              side="top"
              align="center"
              sideOffset={8}
            >
              <div className="ctx-icon-grid">
                {ICON_NAMES.map((name) => (
                  <Button
                    key={name}
                    className="ctx-icon-item"
                    active={(cs.icon || 'heart') === name}
                    title={name}
                    onClick={() => { setCS({ icon: name }); setIconOpen(false) }}
                  >
                    <IconSvg name={name} size={16} />
                  </Button>
                ))}
              </div>
              <RadixPopover.Arrow className="color-picker-arrow" />
            </RadixPopover.Content>
          </RadixPopover.Portal>
        </RadixPopover.Root>
      )
    default: return null
  }
}

// Placement transforms — must be composed with Framer Motion via transformTemplate
// to avoid inline-style overriding the CSS class transform.
const PLACEMENT_TRANSFORM = {
  top:    'translateX(-50%) translateY(calc(-100% - 10px))',
  right:  'translateY(-50%) translateX(10px)',
  bottom: 'translateX(-50%) translateY(10px)',
} as const

const SPRING        = { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 } as const
const EXIT_FAST     = { duration: 0.08, ease: 'easeIn' } as const

const TOOLBAR_VARIANTS = {
  hidden:  { opacity: 0, scale: 0.88, transition: EXIT_FAST },
  visible: { opacity: 1, scale: 1 },
}

const GROUP_VARIANTS = {
  hidden:  { opacity: 0, scale: 0.82, transition: EXIT_FAST },
  visible: { opacity: 1, scale: 1 },
}

const FLEX_ROW = { display: 'flex', alignItems: 'center', gap: 1 } as const

export default function ContextToolbar({ canvasSizeRef, rendererRef, isDraggingRef, isResizingRef, isDrawingRef, controlsRef }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; placement: 'top' | 'right' | 'bottom' } | null>(null)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const rafRef = useRef(0)
  const prevKeyRef = useRef('')

  const { selectedIds, elements, updateElement, runLayout } = useElementStore()
  const el = selectedIds.length === 1
    ? elements.find((e) => e.id === selectedIds[0]) ?? null
    : null

  // RAF — smooth position tracking (follows element during drag + zoom)
  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      // Hide during drag, resize, draw, pan, or 3D rotate
      const interacting = isDraggingRef.current || isResizingRef.current || isDrawingRef.current || (controlsRef.current?.isInteracting ?? false)
      if (interacting) { setPos(null); prevKeyRef.current = ''; return }

      const { selectedIds: ids, elements: els } = useElementStore.getState()
      if (ids.length !== 1) { setPos(null); prevKeyRef.current = ''; return }
      const elem = els.find((e) => e.id === ids[0])
      if (!elem || !rendererRef.current?.overlay) { setPos(null); prevKeyRef.current = ''; return }

      const { w, h } = canvasSizeRef.current
      const dpr = window.devicePixelRatio || 1
      const ov = rendererRef.current.overlay
      const project = (px: number, py: number) => {
        const [wx, wy] = pixelToWorldCS(px, py, w, h)
        const s = ov.projectToScreen(wx, wy, 0)
        return { x: s.px / dpr, y: s.py / dpr }
      }

      // Element bounding box in CSS pixels
      const topCenter = project(elem.x + elem.width / 2, elem.y)
      const rightCenter = project(elem.x + elem.width, elem.y + elem.height / 2)
      const bottomCenter = project(elem.x + elem.width / 2, elem.y + elem.height)

      // Container CSS size
      const containerW = w
      const containerH = h

      // Estimate toolbar size for space checks
      const TOOLBAR_H = 44
      const TOOLBAR_W = 400
      const GAP = 12

      // Decide placement: top → right → bottom
      let placement: 'top' | 'right' | 'bottom'
      let nx: number, ny: number
      if (topCenter.y > TOOLBAR_H + GAP) {
        placement = 'top'
        nx = topCenter.x
        ny = topCenter.y
      } else if (rightCenter.x + TOOLBAR_W + GAP < containerW) {
        placement = 'right'
        nx = rightCenter.x
        ny = rightCenter.y
      } else {
        placement = 'bottom'
        nx = bottomCenter.x
        ny = bottomCenter.y
      }

      const key = `${nx.toFixed(1)},${ny.toFixed(1)},${placement}`
      if (key !== prevKeyRef.current) {
        prevKeyRef.current = key
        setPos({ x: nx, y: ny, placement })
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasSizeRef, rendererRef])

  const isFrame     = !!el?.frame
  const isSkin      = !!el?.skin
  const isContainer = el?.role === 'container' && !el?.skin
  const isVisible   = !!el && !!pos && (isFrame || isSkin || isContainer)

  const dir         = el?.layoutDirection ?? 'free'
  const maxRadius   = el ? Math.min(el.width, el.height) / 2 : 0
  const radiusPx    = Math.round((el?.radius ?? 0) * maxRadius)
  const colorHex    = colorToHex(el?.color ?? 0xe0e0e0)
  const isFrameless = el?.frameless ?? false
  const cs = (el?.componentState ?? {}) as Record<string, unknown>
  const setCS = (patch: Record<string, unknown>) => {
    if (!el) return
    updateElement(el.id, { componentState: { ...cs, ...patch } })
  }

  const handleLayout = (d: LayoutDir) => {
    if (!el) return
    updateElement(el.id, { layoutDirection: d })
    queueMicrotask(() => runLayout(el.id))
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="context-toolbar"
          className={`context-toolbar context-toolbar--${pos!.placement}`}
          data-theme="dark"
          style={{ left: pos!.x, top: pos!.y }}
          layout="size"
          variants={TOOLBAR_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={SPRING}
          transformTemplate={(_, generated) => `${PLACEMENT_TRANSFORM[pos!.placement]} ${generated}`}
        >
          {/* Layout direction — Frame and Container */}
          {(isFrame || isContainer) && DIR_OPTIONS.map(({ value, Icon, label }) => (
            <Button
              key={value}
              className="ctx-btn"
              active={dir === value}
              title={label}
              onClick={() => handleLayout(value)}
            >
              <Icon size={15} />
            </Button>
          ))}

          {/* Container extras */}
          <AnimatePresence mode="popLayout">
            {isContainer && (
              <motion.div key="container-section" layout style={FLEX_ROW}
                variants={GROUP_VARIANTS} initial="hidden" animate="visible" exit="hidden"
                transition={SPRING}
              >

                {/* Layout-dependent options: Gap, Padding, Columns */}
                <AnimatePresence mode="popLayout">
                  {(dir === 'row' || dir === 'column' || dir === 'grid') && (
                    <motion.div key="layout-extras" layout style={FLEX_ROW}
                      variants={GROUP_VARIANTS} initial="hidden" animate="visible" exit="hidden"
                      transition={SPRING}
                    >
                      <div className="ctx-sep" />
                      {dir === 'grid' && (
                        <ScrubInput
                          icon={<Columns size={13} />}
                          value={el!.layoutColumns ?? 2}
                          min={1}
                          max={12}
                          onChange={(v) => { updateElement(el!.id, { layoutColumns: v }); queueMicrotask(() => runLayout(el!.id)) }}
                        />
                      )}
                      <ScrubInput
                        icon={<ArrowsOutLineHorizontal size={13} />}
                        value={el!.layoutGap ?? 8}
                        min={0}
                        max={100}
                        onChange={(v) => { updateElement(el!.id, { layoutGap: v }); queueMicrotask(() => runLayout(el!.id)) }}
                      />
                      <ScrubInput
                        icon={<FrameCorners size={13} />}
                        value={el!.layoutPadding ?? 8}
                        min={0}
                        max={100}
                        onChange={(v) => { updateElement(el!.id, { layoutPadding: v }); queueMicrotask(() => runLayout(el!.id)) }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="ctx-sep" />

                <Button
                  className="ctx-btn"
                  title="Frameless"
                  onClick={() => updateElement(el!.id, { frameless: !isFrameless })}
                >
                  {isFrameless ? <RectangleDashed size={15} /> : <Rectangle size={15} />}
                </Button>

                <ScrubInput
                  icon={<Angle size={13} />}
                  value={radiusPx}
                  min={0}
                  max={Math.round(maxRadius)}
                  onChange={(v) => updateElement(el!.id, { radius: maxRadius > 0 ? v / maxRadius : 0 })}
                />

                <RadixPopover.Root>
                  <RadixPopover.Trigger asChild>
                    <Button className="ctx-color-btn" title="Color">
                      <div className="ctx-color-swatch" style={{ background: colorHex }} />
                    </Button>
                  </RadixPopover.Trigger>
                  <RadixPopover.Portal>
                    <RadixPopover.Content
                      className="color-picker"
                      data-theme="dark"
                      side="right"
                      sideOffset={8}
                      align="start"
                      collisionPadding={8}
                    >
                      <ColorPicker
                        color={el!.color ?? 0xe0e0e0}
                        onChange={(c) => updateElement(el!.id, { color: c })}
                      />
                      <RadixPopover.Arrow className="color-picker-arrow" />
                    </RadixPopover.Content>
                  </RadixPopover.Portal>
                </RadixPopover.Root>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Skin: type-specific options + Only Skin toggle */}
          <AnimatePresence mode="popLayout">
            {isSkin && (
              <motion.div key="skin-section" layout style={FLEX_ROW}
                variants={GROUP_VARIANTS} initial="hidden" animate="visible" exit="hidden"
                transition={SPRING}
              >
                {renderSkinOptions(el!.skin!, cs, setCS, iconPickerOpen, setIconPickerOpen)}
                <div className="ctx-sep" />
                <Button
                  className="ctx-btn"
                  title="Only Skin"
                  onClick={() => updateElement(el!.id, { skinOnly: !el!.skinOnly })}
                >
                  {el!.skinOnly ? <RectangleDashed size={15} /> : <Rectangle size={15} />}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  )
}
