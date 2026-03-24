import React from 'react'
import type { ChoanElement } from '../store/useChoanStore'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import { Switch } from '../components/ui/Switch'
import { SkinEditor } from '../components/panels/SkinEditor'
import TilePopover, { type TileItem } from './TilePopover'
import { paintComponent, type StrokeStyle } from '../engine/painters'
import { ALL_SKIN_IDS } from '../config/skins'

interface Props {
  el: ChoanElement
  isContainer: boolean
  onUpdate: (patch: Record<string, unknown>) => void
}

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

const SKIN_TILES: TileItem[] = ALL_SKIN_IDS.map((s) => ({
  value: s,
  label: s || 'None',
  icon: s ? <SkinPreview skin={s} /> : undefined,
}))

export default function SkinSection({ el, isContainer, onUpdate }: Props) {
  const cs = (el.componentState ?? {}) as Record<string, unknown>
  const updateCS = (patch: Record<string, unknown>) =>
    onUpdate({ componentState: { ...cs, ...patch } })

  return (
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
          onUpdate(patch)
        }}
      />

      {el.skin && (
        <PropRow label="Skin Only" columns="1-1">
          <Switch
            checked={el.skinOnly ?? false}
            onChange={(checked) => onUpdate({ skinOnly: checked })}
          />
        </PropRow>
      )}

      {el.skin && <SkinEditor skin={el.skin} state={cs} onChange={updateCS} />}

      {isContainer && !el.skin && (
        <PropRow label="Frameless" columns="1-1">
          <Switch
            checked={el.frameless ?? false}
            onChange={(checked) => onUpdate({ frameless: checked })}
          />
        </PropRow>
      )}
    </Section>
  )
}
