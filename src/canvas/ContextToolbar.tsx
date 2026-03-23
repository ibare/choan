// Floating context toolbar — appears above selected element.
// Shows element-type-relevant quick controls to reduce trips to the right inspector.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { useElementStore } from '../store/useElementStore'
import { pixelToWorld as pixelToWorldCS } from '../coords/coordinateSystem'
import { SKIN_REGISTRY } from '../config/skins'
import type { SDFRenderer } from '../engine/renderer'
import { SquareLogo, SquareSplitHorizontal, SquareSplitVertical, SquaresFour, EyeSlash, Angle } from '@phosphor-icons/react'

interface Props {
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  rendererRef: MutableRefObject<SDFRenderer | null>
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

export default function ContextToolbar({ canvasSizeRef, rendererRef }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
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
      const { selectedIds: ids, elements: els } = useElementStore.getState()
      if (ids.length !== 1) { setPos(null); prevKeyRef.current = ''; return }
      const elem = els.find((e) => e.id === ids[0])
      if (!elem || !rendererRef.current?.overlay) { setPos(null); prevKeyRef.current = ''; return }

      const { w, h } = canvasSizeRef.current
      const dpr = window.devicePixelRatio || 1
      // top-center of the element in canvas pixel space
      const cx = elem.x + elem.width / 2
      const ty = elem.y
      const [wx, wy] = pixelToWorldCS(cx, ty, w, h)
      const screen = rendererRef.current.overlay.projectToScreen(wx, wy, 0)
      const nx = screen.px / dpr
      const ny = screen.py / dpr
      const key = `${nx.toFixed(1)},${ny.toFixed(1)}`
      if (key !== prevKeyRef.current) {
        prevKeyRef.current = key
        setPos({ x: nx, y: ny })
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasSizeRef, rendererRef])

  if (!el || !pos) return null

  const isFrame     = !!el.frame
  const isSkin      = !!el.skin
  const isContainer = el.role === 'container' && !el.skin
  if (!isFrame && !isSkin && !isContainer) return null

  const dir         = el.layoutDirection ?? 'free'
  const maxRadius   = Math.min(el.width, el.height) / 2
  const radiusPx    = Math.round((el.radius ?? 0) * maxRadius)
  const colorHex    = colorToHex(el.color ?? 0xe0e0e0)
  const isFrameless = !el.skin && (el.skinOnly ?? false)
  const currentSkin = SKIN_REGISTRY.find((s) => s.id === el.skin)

  const handleLayout = (d: LayoutDir) => {
    updateElement(el.id, { layoutDirection: d })
    queueMicrotask(() => runLayout(el.id))
  }

  return (
    <div
      className="context-toolbar"
      data-theme="dark"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Layout direction — Frame and Container */}
      {(isFrame || isContainer) && DIR_OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          className={`ctx-btn${dir === value ? ' active' : ''}`}
          title={label}
          onClick={() => handleLayout(value)}
        >
          <Icon size={15} />
        </button>
      ))}

      {/* Container extras: Frameless, Radius, Color */}
      {isContainer && (
        <>
          <div className="ctx-sep" />

          <button
            className={`ctx-btn${isFrameless ? ' active' : ''}`}
            title="Frameless"
            onClick={() => updateElement(el.id, { skinOnly: !isFrameless })}
          >
            <EyeSlash size={15} />
          </button>

          <div className="ctx-radius-wrap">
            <Angle size={13} className="ctx-label" />
            <input
              className="ctx-number"
              type="number"
              min={0}
              max={Math.round(maxRadius)}
              value={radiusPx}
              onChange={(e) => {
                const v = Math.max(0, Math.min(Math.round(maxRadius), Number(e.target.value)))
                updateElement(el.id, { radius: maxRadius > 0 ? v / maxRadius : 0 })
              }}
            />
          </div>

          <label className="ctx-color-label" title="Color">
            <div className="ctx-color-swatch" style={{ background: colorHex }} />
            <input
              type="color"
              value={colorHex}
              className="ctx-color-input"
              onChange={(e) => updateElement(el.id, { color: hexToColor(e.target.value) })}
            />
          </label>
        </>
      )}

      {/* Skin: picker + Only Skin toggle */}
      {isSkin && (
        <>
          <RadixPopover.Root>
            <RadixPopover.Trigger asChild>
              <button className="ctx-btn" title={currentSkin?.label ?? el.skin}>
                {currentSkin
                  ? <currentSkin.Icon size={15} />
                  : <span style={{ fontSize: 10 }}>{el.skin}</span>
                }
              </button>
            </RadixPopover.Trigger>
            <RadixPopover.Portal>
              <RadixPopover.Content
                className="ctx-skin-picker"
                data-theme="dark"
                side="top"
                align="center"
                sideOffset={8}
              >
                {SKIN_REGISTRY.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`ctx-btn${el.skin === id ? ' active' : ''}`}
                    title={label}
                    onClick={() => {
                      const patch: Record<string, unknown> = { skin: id }
                      if (id === 'image') patch.componentState = { seed: Math.floor(Math.random() * 9999) }
                      updateElement(el.id, patch)
                    }}
                  >
                    <Icon size={15} />
                  </button>
                ))}
                <RadixPopover.Arrow className="ctx-skin-arrow" />
              </RadixPopover.Content>
            </RadixPopover.Portal>
          </RadixPopover.Root>

          <div className="ctx-sep" />

          <button
            className={`ctx-btn${el.skinOnly ? ' active' : ''}`}
            title="Only Skin"
            onClick={() => updateElement(el.id, { skinOnly: !el.skinOnly })}
          >
            <EyeSlash size={15} />
          </button>
        </>
      )}
    </div>
  )
}
