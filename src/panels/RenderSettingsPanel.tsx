import { useState } from 'react'
import { useRenderSettings, DEFAULT_RENDER_SETTINGS, type RenderSettings } from '../store/useRenderSettings'
import { GearSix } from '@phosphor-icons/react'

type Vec2Key = 'sideSmooth' | 'normalEdgeThreshold' | 'idEdgeThreshold'
type Vec3Key = 'lightDir' | 'warmTone' | 'edgeColor' | 'bgColor'

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rs-row">
      <label className="rs-label">{label}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="rs-value">{value.toFixed(step < 0.01 ? 3 : 2)}</span>
    </div>
  )
}

function Vec2Slider({ label, value, min, max, step, onChange }: {
  label: string; value: [number, number]; min: number; max: number; step: number
  onChange: (v: [number, number]) => void
}) {
  return (
    <div className="rs-group">
      <span className="rs-group-label">{label}</span>
      <Slider label="min" value={value[0]} min={min} max={max} step={step}
        onChange={(v) => onChange([v, value[1]])} />
      <Slider label="max" value={value[1]} min={min} max={max} step={step}
        onChange={(v) => onChange([value[0], v])} />
    </div>
  )
}

function Vec3Slider({ label, value, min, max, step, labels, onChange }: {
  label: string; value: [number, number, number]; min: number; max: number; step: number
  labels?: [string, string, string]
  onChange: (v: [number, number, number]) => void
}) {
  const l = labels ?? ['x', 'y', 'z']
  return (
    <div className="rs-group">
      <span className="rs-group-label">{label}</span>
      <Slider label={l[0]} value={value[0]} min={min} max={max} step={step}
        onChange={(v) => onChange([v, value[1], value[2]])} />
      <Slider label={l[1]} value={value[1]} min={min} max={max} step={step}
        onChange={(v) => onChange([value[0], v, value[2]])} />
      <Slider label={l[2]} value={value[2]} min={min} max={max} step={step}
        onChange={(v) => onChange([value[0], value[1], v])} />
    </div>
  )
}

function ColorInput({ label, value, onChange }: {
  label: string; value: [number, number, number]
  onChange: (v: [number, number, number]) => void
}) {
  const toHex = (rgb: [number, number, number]) =>
    '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
  const fromHex = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
  return (
    <div className="rs-row">
      <label className="rs-label">{label}</label>
      <input type="color" value={toHex(value)}
        onChange={(e) => onChange(fromHex(e.target.value))} />
      <span className="rs-value">{toHex(value)}</span>
    </div>
  )
}

export default function RenderSettingsPanel() {
  const [open, setOpen] = useState(false)
  const store = useRenderSettings()
  const set = store.set

  if (!open) {
    return (
      <button className="rs-toggle" onClick={() => setOpen(true)} title="Render Settings">
        <GearSix size={16} />
      </button>
    )
  }

  return (
    <div className="rs-panel">
      <div className="rs-header">
        <span>Render Settings</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="rs-btn" onClick={() => store.reset()}>Reset</button>
          <button className="rs-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
      <div className="rs-body">
        <div className="rs-section">Toon Shading</div>
        <Vec3Slider label="Light Dir" value={store.lightDir} min={-1} max={1} step={0.01}
          onChange={(v) => set({ lightDir: v })} />
        <Slider label="Shadow Mul" value={store.shadowMul} min={0} max={1} step={0.01}
          onChange={(v) => set({ shadowMul: v })} />
        <Vec3Slider label="Warm Tone" value={store.warmTone} min={0} max={0.2} step={0.005} labels={['R', 'G', 'B']}
          onChange={(v) => set({ warmTone: v })} />
        <Slider label="Side Darken" value={store.sideDarken} min={0} max={1} step={0.01}
          onChange={(v) => set({ sideDarken: v })} />
        <Vec2Slider label="Side Smooth" value={store.sideSmooth} min={0} max={1} step={0.01}
          onChange={(v) => set({ sideSmooth: v })} />

        <div className="rs-section">Outline</div>
        <Slider label="Width" value={store.outlineWidth} min={0} max={4} step={0.1}
          onChange={(v) => set({ outlineWidth: v })} />
        <ColorInput label="Edge Color" value={store.edgeColor}
          onChange={(v) => set({ edgeColor: v })} />
        <Vec2Slider label="Normal Edge" value={store.normalEdgeThreshold} min={0} max={2} step={0.01}
          onChange={(v) => set({ normalEdgeThreshold: v })} />
        <Vec2Slider label="ID Edge" value={store.idEdgeThreshold} min={0} max={2} step={0.01}
          onChange={(v) => set({ idEdgeThreshold: v })} />

        <div className="rs-section">Global</div>
        <ColorInput label="BG Color" value={store.bgColor}
          onChange={(v) => set({ bgColor: v })} />
        <Slider label="Extrude Depth" value={store.extrudeDepth} min={0.01} max={0.5} step={0.005}
          onChange={(v) => set({ extrudeDepth: v })} />

        <div className="rs-section">Spring Animation</div>
        <Slider label="Stiffness" value={store.springStiffness} min={0.01} max={0.5} step={0.01}
          onChange={(v) => set({ springStiffness: v })} />
        <Slider label="Damping" value={store.springDamping} min={0.1} max={0.99} step={0.01}
          onChange={(v) => set({ springDamping: v })} />
        <Slider label="Fluidity" value={store.squashIntensity} min={0} max={3} step={0.05}
          onChange={(v) => set({ squashIntensity: v })} />
      </div>
    </div>
  )
}
