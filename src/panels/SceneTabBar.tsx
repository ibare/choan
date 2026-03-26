// Scene tab bar — horizontal tabs for switching between scenes.

import { useState, useRef, useEffect } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { useSceneStore } from '../store/useSceneStore'
import { cn } from '../design-system'

interface SceneTabBarProps {
  onSwitchScene: (id: string) => void
  onAddScene: () => void
  onRemoveScene: (id: string) => void
}

export default function SceneTabBar({ onSwitchScene, onAddScene, onRemoveScene }: SceneTabBarProps) {
  const scenes = useSceneStore((s) => s.scenes)
  const activeSceneId = useSceneStore((s) => s.activeSceneId)
  const renameScene = useSceneStore((s) => s.renameScene)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)

  const [editingId, setEditingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleDoubleClick = (id: string) => {
    setEditingId(id)
  }

  const handleRenameCommit = (id: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) renameScene(id, trimmed)
    setEditingId(null)
  }

  return (
    <div className="ui-scene-tab-bar">
      {sorted.map((scene) => (
        <div
          key={scene.id}
          className={cn('ui-scene-tab', scene.id === activeSceneId && 'ui-scene-tab--active')}
          onClick={() => onSwitchScene(scene.id)}
          onDoubleClick={() => handleDoubleClick(scene.id)}
        >
          {editingId === scene.id ? (
            <input
              ref={inputRef}
              className="ui-scene-tab__input"
              defaultValue={scene.name}
              onBlur={(e) => handleRenameCommit(scene.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameCommit(scene.id, (e.target as HTMLInputElement).value)
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="ui-scene-tab__label">{scene.name}</span>
          )}
          {scenes.length > 1 && (
            <button
              className="ui-scene-tab__close"
              onClick={(e) => { e.stopPropagation(); onRemoveScene(scene.id) }}
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      <button className="ui-scene-tab ui-scene-tab--add" onClick={onAddScene}>
        <Plus size={12} />
      </button>
    </div>
  )
}
