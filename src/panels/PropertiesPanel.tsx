import { useChoanStore } from '../store/useChoanStore'
import type { LineStyle } from '../store/useChoanStore'
import { autoKeyframe } from '../animation/autoKeyframe'
import type { AnimatableProperty } from '../animation/types'
import { paintComponent, type StrokeStyle } from '../engine/painters'
import React from 'react'
import ContainerLayoutSection from './ContainerLayoutSection'
import TriggersSection from './TriggersSection'
import TilePopover, { type TileItem } from './TilePopover'
import { useSelectedElement } from '../hooks/useSelectedElement'
import { SkinEditor } from '../components/panels/SkinEditor'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Slider } from '../components/ui/Slider'
import { Button } from '../components/ui/Button'
import { ALL_SKIN_IDS } from '../config/skins'

const LINE_STYLE_OPTIONS = [
  { value: 'solid',  label: 'Solid'  },
  { value: 'dashed', label: 'Dashed' },
]

function SkinPreview({ skin }: { skin: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !skin) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = 60, h = 40
    canvas.width = w * 2; canvas.height = h * 2
    ctx.scale(2, 2)
    ctx.clearRect(0, 0, w, h)
    const stroke: StrokeStyle = { color: '#333', width: 1.5 }
    paintComponent(skin, ctx as unknown as OffscreenCanvasRenderingContext2D, w, h, {}, stroke)
  }, [skin])
  if (!skin) return null
  return <canvas ref={canvasRef} style={{ width: 60, height: 40, borderRadius: 'var(--radius-1)' }} />
}

// Build skin tiles once at module level
const SKIN_TILES: TileItem[] = ALL_SKIN_IDS.map((s) => ({
  value: s,
  label: s || 'None',
  icon: s ? <SkinPreview skin={s} /> : undefined,
}))

export default function PropertiesPanel() {
  const { updateElement, removeElement, runLayout, elements, animationBundles } = useChoanStore()
  const el = useSelectedElement()

  if (!el) {
    return <div className="props-empty">선택된 요소 없음</div>
  }

  // Derived flags
  const isChild      = !!el.parentId
  const parentEl     = isChild ? elements.find((e) => e.id === el.parentId) : null
  const isManaged    = isChild && parentEl?.layoutDirection !== 'free' && parentEl?.layoutDirection !== undefined
  const isContainer  = el.role === 'container'
  const childCount   = isContainer ? elements.filter((e) => e.parentId === el.id).length : 0

  const updateAnimatable = (prop: AnimatableProperty, value: number) => {
    const old = (el as unknown as Record<string, unknown>)[prop] as number | undefined
    updateElement(el.id, { [prop]: value })
    autoKeyframe(el.id, prop, value, old ?? 0)
  }

  const handleContainerProp = (patch: Record<string, unknown>) => {
    updateElement(el.id, patch)
    // Use queueMicrotask to ensure store update completes before layout
    queueMicrotask(() => runLayout(el.id))
  }

  const cs = (el.componentState ?? {}) as Record<string, unknown>
  const setCS = (patch: Record<string, unknown>) =>
    updateElement(el.id, { componentState: { ...cs, ...patch } })

  const maxRadius = Math.min(el.width, el.height) / 2

  return (
    <div className="props-panel">

      {/* ── Identity ───────────────────────────────── */}
      <Section title="Element">
        <PropRow label="Label">
          <Input
            value={el.label}
            onChange={(e) => updateElement(el.id, { label: e.target.value })}
          />
        </PropRow>
        <PropRow label="Type">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{el.type}</span>
        </PropRow>
        {el.frame && (
          <PropRow label="Frame">
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{el.frame}</span>
          </PropRow>
        )}
      </Section>

      {/* ── Skin ───────────────────────────────────── */}
      {!el.frame && (
        <Section title="Skin">
          <TilePopover
            items={SKIN_TILES}
            value={el.skin ?? ''}
            columns={3}
            placeholder="None"
            onChange={(v) => {
              const skin = v || undefined
              const patch: Record<string, unknown> = { skin, skinOnly: !!skin }
              if (skin === 'image') patch.componentState = { seed: Math.floor(Math.random() * 9999) }
              updateElement(el.id, patch)
            }}
          />

          {el.skin && (
            <PropRow label="Skin Only" columns="1-1">
              <input
                type="checkbox"
                checked={el.skinOnly ?? false}
                onChange={(e) => updateElement(el.id, { skinOnly: e.target.checked })}
              />
            </PropRow>
          )}

          {el.skin && <SkinEditor skin={el.skin} state={cs} onChange={setCS} />}
        </Section>
      )}

      {/* ── Container ──────────────────────────────── */}
      {isContainer && (
        <>
          <PropRow label="Frameless" className="props-field-group">
            <input
              type="checkbox"
              checked={!el.skin && (el.skinOnly ?? false)}
              onChange={(e) => updateElement(el.id, { skinOnly: e.target.checked, skin: e.target.checked ? undefined : el.skin })}
            />
          </PropRow>
          <ContainerLayoutSection el={el} childCount={childCount} onChange={handleContainerProp} />
        </>
      )}

      {/* ── Parent info ────────────────────────────── */}
      {isChild && parentEl && (
        <Section title="Layout">
          <PropRow label="Parent">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{parentEl.label}</span>
          </PropRow>
        </Section>
      )}

      {/* ── Geometry ───────────────────────────────── */}
      <Section title="Geometry">
        {el.type === 'rectangle' && (
          <PropRow label="Radius">
            <Slider
              value={Math.round((el.radius ?? 0) * maxRadius)}
              min={0} max={maxRadius} step={1}
              formatValue={(v) => `${v}px`}
              onChange={(v) => updateAnimatable('radius', maxRadius > 0 ? v / maxRadius : 0)}
            />
          </PropRow>
        )}

        {el.type === 'line' && (
          <>
            <PropRow label="Style">
              <Select
                options={LINE_STYLE_OPTIONS}
                value={el.lineStyle ?? 'solid'}
                onChange={(v) => updateElement(el.id, { lineStyle: v as LineStyle })}
              />
            </PropRow>
            <PropRow label="Arrow">
              <input
                type="checkbox"
                checked={el.hasArrow ?? false}
                onChange={(e) => updateElement(el.id, { hasArrow: e.target.checked })}
              />
            </PropRow>
          </>
        )}

        <PropRow label={`Z${isChild ? ' (auto)' : ''}`}>
          <div className="ui-row-gap-2">
            <Input
              type="number" inputSize="sm"
              value={String(el.z)} disabled={isChild}
              onChange={(e) => {
                updateElement(el.id, { z: Number(e.target.value) })
                if (isContainer) queueMicrotask(() => runLayout(el.id))
              }}
            />
          </div>
        </PropRow>

        <PropRow label="Opacity">
          <Slider
            value={el.opacity}
            min={0} max={1} step={0.05}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => updateAnimatable('opacity', v)}
          />
        </PropRow>

        <PropRow label={`Position${isManaged ? ' (auto)' : ''}`}>
          <div className="ui-row-gap-2">
            <Input
              type="number" inputSize="sm" placeholder="X"
              value={String(Math.round(el.x))} disabled={isManaged}
              onChange={(e) => updateAnimatable('x', Number(e.target.value))}
            />
            <Input
              type="number" inputSize="sm" placeholder="Y"
              value={String(Math.round(el.y))} disabled={isManaged}
              onChange={(e) => updateAnimatable('y', Number(e.target.value))}
            />
          </div>
        </PropRow>

        <PropRow label={`Size${isManaged ? ' (auto)' : ''}`}>
          <div className="ui-row-gap-2">
            <Input
              type="number" inputSize="sm" placeholder="W"
              value={String(Math.round(el.width))} disabled={isManaged}
              onChange={(e) => updateAnimatable('width', Number(e.target.value))}
            />
            <Input
              type="number" inputSize="sm" placeholder="H"
              value={String(Math.round(el.height))} disabled={isManaged}
              onChange={(e) => updateAnimatable('height', Number(e.target.value))}
            />
          </div>
        </PropRow>
      </Section>

      {/* ── Triggers ───────────────────────────────── */}
      <TriggersSection
        triggers={el.triggers ?? []}
        animationBundles={animationBundles}
        onUpdate={(triggers) => updateElement(el.id, { triggers })}
      />

      {/* ── Delete ─────────────────────────────────── */}
      <div style={{ padding: 'var(--space-3)' }}>
        <Button
          variant="danger"
          style={{ width: '100%' }}
          onClick={() => removeElement(el.id)}
        >
          Delete
        </Button>
      </div>

    </div>
  )
}
