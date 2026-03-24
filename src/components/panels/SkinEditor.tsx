import { Input } from '../ui/Input'
import { Slider } from '../ui/Slider'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Button } from '../ui/Button'
import TilePopover, { type TileItem } from '../../panels/TilePopover'
import { ICON_NAMES, ICON_PATHS } from '../../engine/iconPaths'

type CS = Record<string, unknown>

interface SkinEditorProps {
  skin: string
  state: CS
  onChange: (patch: CS) => void
}

function IconSvg({ name, size = 16 }: { name: string; size?: number }) {
  const d = (ICON_PATHS as Record<string, string>)[name]
  if (!d) return null
  return <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor"><path d={d} /></svg>
}

const ICON_TILES: TileItem[] = ICON_NAMES.map((n) => ({
  value: n, label: n, icon: <IconSvg name={n} size={20} />,
}))

const ON_OFF: Array<{ value: string; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'on',  label: 'On'  },
]

export function SkinEditor({ skin, state: cs, onChange }: SkinEditorProps) {
  const set = (patch: CS) => onChange(patch)
  const bool = (key: string) => !!cs[key]
  const setBool = (key: string, v: boolean) => set({ [key]: v })

  const toggle = (key: string) => (
    <SegmentedControl
      options={ON_OFF}
      value={bool(key) ? 'on' : 'off'}
      onChange={(v) => setBool(key, v === 'on')}
    />
  )

  const textField = (key: string, placeholder: string) => (
    <Input
      value={(cs[key] as string) || ''}
      placeholder={placeholder}
      onChange={(e) => set({ [key]: e.target.value })}
    />
  )

  const rangeField = (key: string) => (
    <Slider
      value={Number(cs[key]) || 0}
      min={0} max={1} step={0.01}
      formatValue={(v) => `${Math.round(v * 100)}%`}
      onChange={(v) => set({ [key]: v })}
    />
  )

  switch (skin) {
    case 'switch':
      return <>{toggle('on')}</>
    case 'checkbox':
      return <>{toggle('checked')}</>
    case 'radio':
      return <>{toggle('selected')}</>
    case 'button':
      return <>{textField('label', 'Button')}{toggle('pressed')}</>
    case 'slider':
      return <>{rangeField('value')}</>
    case 'text-input':
      return <>{textField('placeholder', 'Type here...')}{toggle('focused')}</>
    case 'progress':
      return <>{rangeField('value')}</>
    case 'badge':
      return (
        <Input
          type="number" min={1}
          value={String(Math.max(1, Number(cs.count) || 1))}
          onChange={(e) => set({ count: Math.max(1, Number(e.target.value)) })}
        />
      )
    case 'star-rating':
      return (
        <Input
          type="number" min={0} max={5}
          value={String(Number(cs.rating) || 0)}
          onChange={(e) => set({ rating: Number(e.target.value) })}
        />
      )
    case 'avatar':
      return <>{textField('initials', 'AB')}{toggle('online')}</>
    case 'search':
      return <>{textField('query', 'Search...')}</>
    case 'dropdown':
      return <>{textField('label', 'Select...')}{toggle('open')}</>
    case 'text':
      return (
        <>
          {textField('text', 'Text')}
          <Input
            type="number" min={8}
            value={String(Number(cs.fontSize) || '')}
            placeholder="auto"
            onChange={(e) => set({ fontSize: Number(e.target.value) || undefined })}
          />
          <SegmentedControl
            options={[
              { value: 'left',   label: 'Left'   },
              { value: 'center', label: 'Center' },
              { value: 'right',  label: 'Right'  },
            ]}
            value={(cs.align as string) || 'center'}
            onChange={(v) => set({ align: v })}
          />
          {toggle('bold')}
        </>
      )
    case 'table-skeleton':
      return (
        <Input
          type="number" min={1} max={10}
          value={String(Number(cs.columns) || 3)}
          onChange={(e) => set({ columns: Number(e.target.value) })}
        />
      )
    case 'image':
      return (
        <div className="ui-row-gap-2">
          <Input
            type="number"
            value={String(Number(cs.seed) || 42)}
            onChange={(e) => set({ seed: Number(e.target.value) })}
          />
          <Button size="sm" onClick={() => set({ seed: Math.floor(Math.random() * 9999) })}>
            Shuffle
          </Button>
        </div>
      )
    case 'icon':
      return (
        <TilePopover
          items={ICON_TILES}
          value={(cs.icon as string) || 'heart'}
          columns={6}
          layout="panel"
          onChange={(v) => set({ icon: v })}
        />
      )
    default:
      return null
  }
}
