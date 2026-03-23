import {
  ToggleRight, CheckSquare, RadioButton, HandTap, SlidersHorizontal,
  TextT, ChartBar, CircleHalf, Star, UserCircle,
  MagnifyingGlass, CaretDown, TextAa, Table, Image, Heart,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import type { Icon } from '@phosphor-icons/react'

export interface SkinConfig {
  id: string
  label: string
  Icon: ComponentType<{ size?: number }>
}

export const SKIN_REGISTRY: SkinConfig[] = [
  { id: 'switch',         label: 'Switch',       Icon: ToggleRight as unknown as ComponentType<{ size?: number }> },
  { id: 'checkbox',       label: 'Checkbox',     Icon: CheckSquare as unknown as ComponentType<{ size?: number }> },
  { id: 'radio',          label: 'Radio',        Icon: RadioButton as unknown as ComponentType<{ size?: number }> },
  { id: 'button',         label: 'Button',       Icon: HandTap as unknown as ComponentType<{ size?: number }> },
  { id: 'slider',         label: 'Slider',       Icon: SlidersHorizontal as unknown as ComponentType<{ size?: number }> },
  { id: 'text-input',     label: 'Text Input',   Icon: TextT as unknown as ComponentType<{ size?: number }> },
  { id: 'progress',       label: 'Progress',     Icon: ChartBar as unknown as ComponentType<{ size?: number }> },
  { id: 'badge',          label: 'Badge',        Icon: CircleHalf as unknown as ComponentType<{ size?: number }> },
  { id: 'star-rating',    label: 'Star Rating',  Icon: Star as unknown as ComponentType<{ size?: number }> },
  { id: 'avatar',         label: 'Avatar',       Icon: UserCircle as unknown as ComponentType<{ size?: number }> },
  { id: 'search',         label: 'Search',       Icon: MagnifyingGlass as unknown as ComponentType<{ size?: number }> },
  { id: 'dropdown',       label: 'Dropdown',     Icon: CaretDown as unknown as ComponentType<{ size?: number }> },
  { id: 'text',           label: 'Text',         Icon: TextAa as unknown as ComponentType<{ size?: number }> },
  { id: 'table-skeleton', label: 'Table',        Icon: Table as unknown as ComponentType<{ size?: number }> },
  { id: 'image',          label: 'Image',        Icon: Image as unknown as ComponentType<{ size?: number }> },
  { id: 'icon',           label: 'Icon',         Icon: Heart as unknown as ComponentType<{ size?: number }> },
]

// Convenience lookup map
export const SKIN_BY_ID = new Map(SKIN_REGISTRY.map((s) => [s.id, s]))

// All skin IDs including empty (no skin)
export const ALL_SKIN_IDS: string[] = ['', ...SKIN_REGISTRY.map((s) => s.id)]

void (Heart as unknown as Icon)
