// Motion Path editor — edits the optional clip.motionPath field of an
// AnimationClip. Visible in PropertiesPanel only while a bundle is being
// edited and the selected element has a clip in that bundle.

import { Section } from '../ui/Section'
import { PropRow } from '../ui/PropRow'
import { Input } from '../ui/Input'
import { Slider } from '../ui/Slider'
import { SegmentedControl } from '../ui/SegmentedControl'
import type { AnimationClip, EasingType } from '../../animation/types'
import {
  PLANE_XY_NORMAL,
  PLANE_XZ_NORMAL,
  PLANE_YZ_NORMAL,
  type ElementMotionPath,
  type LinePath,
  type OrbitPath,
  type Vec3,
} from '../../animation/motionPathTypes'

const TAU = Math.PI * 2

// ── Defaults used when enabling or switching types ───────────────────────────

const DEFAULT_LINE: LinePath = {
  type: 'line',
  p0: [0, 0, 0],
  p1: [100, 100, 0],
  easing: 'ease-in-out',
  loop: false,
  reverse: false,
  originMode: 'relative',
}

const DEFAULT_ORBIT: OrbitPath = {
  type: 'orbit',
  center: [0, 0, 0],
  radiusU: 100,
  radiusV: 100,
  planeNormal: PLANE_XY_NORMAL,
  startAngle: 0,
  sweepAngle: TAU,
  clockwise: false,
  easing: 'ease-in-out',
  loop: true,
  reverse: false,
  originMode: 'relative',
}

// ── Preset helpers ───────────────────────────────────────────────────────────

type PlanePreset = 'xy' | 'xz' | 'yz'

function normalToPreset(n: Vec3): PlanePreset {
  if (n[2] !== 0 && n[0] === 0 && n[1] === 0) return 'xy'
  if (n[1] !== 0 && n[0] === 0 && n[2] === 0) return 'xz'
  return 'yz'
}

function presetToNormal(p: PlanePreset): Vec3 {
  if (p === 'xy') return PLANE_XY_NORMAL
  if (p === 'xz') return PLANE_XZ_NORMAL
  return PLANE_YZ_NORMAL
}

// ── Shared field helpers ─────────────────────────────────────────────────────

function Vec3Row({
  label, value, onChange,
}: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  const set = (idx: 0 | 1 | 2, n: number) => {
    const next = [...value] as Vec3
    next[idx] = n
    onChange(next)
  }
  return (
    <PropRow label={label}>
      <div className="ui-row-gap-2">
        <Input
          type="number" inputSize="sm" value={String(value[0])}
          onChange={(e) => set(0, Number(e.target.value))}
        />
        <Input
          type="number" inputSize="sm" value={String(value[1])}
          onChange={(e) => set(1, Number(e.target.value))}
        />
        <Input
          type="number" inputSize="sm" value={String(value[2])}
          onChange={(e) => set(2, Number(e.target.value))}
        />
      </div>
    </PropRow>
  )
}

function NumberField({
  label, value, step = 1, min, onChange,
}: { label: string; value: number; step?: number; min?: number; onChange: (v: number) => void }) {
  return (
    <PropRow label={label}>
      <Input
        type="number" inputSize="sm" step={step} min={min} value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </PropRow>
  )
}

// ── Sub-editors ──────────────────────────────────────────────────────────────

const EASING_OPTIONS: Array<{ value: EasingType; label: string }> = [
  { value: 'linear',      label: 'Linear' },
  { value: 'ease',        label: 'Ease'   },
  { value: 'ease-in',     label: 'In'     },
  { value: 'ease-out',    label: 'Out'    },
  { value: 'ease-in-out', label: 'In/Out' },
]

const ON_OFF_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on',  label: 'On'  },
]

const ORIGIN_OPTIONS = [
  { value: 'relative', label: 'Relative' },
  { value: 'absolute', label: 'Absolute' },
]

const PLANE_OPTIONS: Array<{ value: PlanePreset; label: string }> = [
  { value: 'xy', label: 'XY' },
  { value: 'xz', label: 'XZ' },
  { value: 'yz', label: 'YZ' },
]

function CommonFields({
  path, update,
}: { path: ElementMotionPath; update: (patch: Partial<ElementMotionPath>) => void }) {
  return (
    <>
      <NumberField
        label="Duration (ms)"
        value={path.duration ?? 0}
        step={10}
        min={0}
        onChange={(v) => update({ duration: v > 0 ? v : undefined })}
      />
      <PropRow label="Easing">
        <SegmentedControl<EasingType>
          options={EASING_OPTIONS}
          value={path.easing}
          onChange={(v) => update({ easing: v })}
        />
      </PropRow>
      <PropRow label="Loop">
        <SegmentedControl
          options={ON_OFF_OPTIONS}
          value={path.loop ? 'on' : 'off'}
          onChange={(v) => update({ loop: v === 'on' })}
        />
      </PropRow>
      <PropRow label="Reverse">
        <SegmentedControl
          options={ON_OFF_OPTIONS}
          value={path.reverse ? 'on' : 'off'}
          onChange={(v) => update({ reverse: v === 'on' })}
        />
      </PropRow>
      <PropRow label="Origin">
        <SegmentedControl
          options={ORIGIN_OPTIONS}
          value={path.originMode}
          onChange={(v) => update({ originMode: v as 'relative' | 'absolute' })}
        />
      </PropRow>
    </>
  )
}

function LinePathFields({
  path, update,
}: { path: LinePath; update: (patch: Partial<LinePath>) => void }) {
  return (
    <>
      <Vec3Row label="Start (p0)" value={path.p0} onChange={(v) => update({ p0: v })} />
      <Vec3Row label="End (p1)"   value={path.p1} onChange={(v) => update({ p1: v })} />
    </>
  )
}

function OrbitPathFields({
  path, update,
}: { path: OrbitPath; update: (patch: Partial<OrbitPath>) => void }) {
  const preset = normalToPreset(path.planeNormal)
  return (
    <>
      <Vec3Row label="Center" value={path.center} onChange={(v) => update({ center: v })} />
      <NumberField
        label="Radius U" value={path.radiusU} step={1} min={0}
        onChange={(v) => update({ radiusU: Math.max(0, v) })}
      />
      <NumberField
        label="Radius V" value={path.radiusV} step={1} min={0}
        onChange={(v) => update({ radiusV: Math.max(0, v) })}
      />
      <PropRow label="Plane">
        <SegmentedControl<PlanePreset>
          options={PLANE_OPTIONS}
          value={preset}
          onChange={(v) => update({ planeNormal: presetToNormal(v) })}
        />
      </PropRow>
      <PropRow label="Start angle">
        <Slider
          value={path.startAngle}
          min={0} max={TAU} step={TAU / 360}
          formatValue={(v) => `${Math.round((v * 180) / Math.PI)}°`}
          onChange={(v) => update({ startAngle: v })}
        />
      </PropRow>
      <PropRow label="Sweep">
        <Slider
          value={path.sweepAngle}
          min={0} max={TAU} step={TAU / 360}
          formatValue={(v) => `${Math.round((v * 180) / Math.PI)}°`}
          onChange={(v) => update({ sweepAngle: v })}
        />
      </PropRow>
      <PropRow label="Clockwise">
        <SegmentedControl
          options={ON_OFF_OPTIONS}
          value={path.clockwise ? 'on' : 'off'}
          onChange={(v) => update({ clockwise: v === 'on' })}
        />
      </PropRow>
    </>
  )
}

// ── Top-level editor ─────────────────────────────────────────────────────────

interface MotionPathEditorProps {
  motionPath: ElementMotionPath | undefined
  onChange: (patch: Partial<AnimationClip>) => void
}

export function MotionPathEditor({ motionPath, onChange }: MotionPathEditorProps) {
  const enabled = motionPath != null

  const setPath = (next: ElementMotionPath | undefined) => {
    onChange({ motionPath: next })
  }

  const updatePath = (patch: Partial<ElementMotionPath>) => {
    if (!motionPath) return
    // Cast is safe: patch only contains fields that match the current
    // discriminated variant since the sub-editors are type-parameterized.
    setPath({ ...motionPath, ...patch } as ElementMotionPath)
  }

  const setType = (type: 'line' | 'orbit') => {
    if (!motionPath) {
      setPath(type === 'line' ? DEFAULT_LINE : DEFAULT_ORBIT)
      return
    }
    if (motionPath.type === type) return
    // Preserve the common base fields when switching types.
    const base = {
      duration: motionPath.duration,
      easing: motionPath.easing,
      loop: motionPath.loop,
      reverse: motionPath.reverse,
      originMode: motionPath.originMode,
    }
    setPath(type === 'line' ? { ...DEFAULT_LINE, ...base } : { ...DEFAULT_ORBIT, ...base })
  }

  return (
    <Section title="Motion Path">
      <PropRow label="Enable">
        <SegmentedControl
          options={ON_OFF_OPTIONS}
          value={enabled ? 'on' : 'off'}
          onChange={(v) => setPath(v === 'on' ? DEFAULT_LINE : undefined)}
        />
      </PropRow>

      {motionPath && (
        <>
          <PropRow label="Type">
            <SegmentedControl<'line' | 'orbit'>
              options={[
                { value: 'line',  label: 'Line'  },
                { value: 'orbit', label: 'Orbit' },
              ]}
              value={motionPath.type}
              onChange={setType}
            />
          </PropRow>

          <CommonFields path={motionPath} update={updatePath} />

          {motionPath.type === 'line' && (
            <LinePathFields
              path={motionPath}
              update={(patch) => updatePath(patch)}
            />
          )}
          {motionPath.type === 'orbit' && (
            <OrbitPathFields
              path={motionPath}
              update={(patch) => updatePath(patch)}
            />
          )}
        </>
      )}
    </Section>
  )
}
