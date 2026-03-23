import { useElementStore } from '../store/useElementStore'

/** 현재 선택된 단일 element를 반환. 없으면 null. */
export function useSelectedElement() {
  return useElementStore((s) => {
    const id = s.selectedIds[0]
    return id ? (s.elements.find((e) => e.id === id) ?? null) : null
  })
}

/** 현재 선택된 elements 배열 (다중 선택 지원). */
export function useSelectedElements() {
  return useElementStore((s) => {
    const ids = new Set(s.selectedIds)
    return s.elements.filter((e) => ids.has(e.id))
  })
}
