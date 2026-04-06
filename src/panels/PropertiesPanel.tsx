import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import type { AnimatableProperty } from '../animation/types'
import { useSelectedElement } from '../hooks/useSelectedElement'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import ElementSection from './ElementSection'
import SkinSection from './SkinSection'
import ContainerLayoutSection from './ContainerLayoutSection'
import GeometrySection from './GeometrySection'
import TriggersSection from './TriggersSection'
import Viewfinder from './Viewfinder'

export default function PropertiesPanel() {
  const { updateElement, runLayout, elements, animationBundles } = useChoanStore()
  const el = useSelectedElement()

  if (!el) {
    return (
      <div className="props-panel">
        <Viewfinder />
        <div className="props-empty">No element selected</div>
      </div>
    )
  }

  const isChild     = !!el.parentId
  const parentEl    = isChild ? elements.find((e) => e.id === el.parentId) : null
  const isManaged   = isChild && parentEl?.layoutDirection !== 'free' && parentEl?.layoutDirection !== undefined
  const isContainer = el.role === 'container'
  const childCount  = isContainer ? elements.filter((e) => e.parentId === el.id).length : 0

  const onUpdate = (patch: Record<string, unknown>) => updateElement(el.id, patch)

  const onUpdateAnimatable = (prop: AnimatableProperty, value: number) => {
    updateElement(el.id, { [prop]: value })
    const ps = usePreviewStore.getState()
    if (ps.editingBundleId && ps.previewState === 'stopped') ps.holdScrub([el.id])
  }

  const onContainerChange = (patch: Record<string, unknown>) => {
    updateElement(el.id, patch)
    queueMicrotask(() => runLayout(el.id))
  }

  return (
    <div className="props-panel">

      <Viewfinder />

      <ElementSection el={el} onUpdate={onUpdate} />

      {!el.frame && (
        <SkinSection el={el} isContainer={isContainer} onUpdate={onUpdate} />
      )}

      {isContainer && (
        <ContainerLayoutSection el={el} childCount={childCount} onChange={onContainerChange} />
      )}

      {isChild && parentEl && (
        <Section title="Layout">
          <PropRow label="Parent">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{parentEl.label}</span>
          </PropRow>
        </Section>
      )}

      <GeometrySection
        el={el}
        isChild={isChild}
        isManaged={isManaged}
        isContainer={isContainer}
        onUpdate={onUpdate}
        onUpdateAnimatable={onUpdateAnimatable}
        onRunLayout={() => runLayout(el.id)}
      />

      <TriggersSection
        triggers={el.triggers ?? []}
        animationBundles={animationBundles}
        onUpdate={(triggers) => updateElement(el.id, { triggers })}
      />

    </div>
  )
}
