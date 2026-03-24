import { describe, it, expect, beforeEach } from 'vitest'
import { useElementStore } from '../../store/useElementStore'
import type { ChoanElement } from '../../store/useElementStore'

function makeEl(id: string, overrides: Partial<ChoanElement> = {}): ChoanElement {
  return {
    id, type: 'rectangle', label: 'Box',
    x: 0, y: 0, z: 0,
    width: 100, height: 100,
    opacity: 1,
    ...overrides,
  }
}

beforeEach(() => {
  useElementStore.getState().reset()
})

// ── addElement ────────────────────────────────────────────────────────────────

describe('addElement', () => {
  it('요소가 추가됨', () => {
    useElementStore.getState().addElement(makeEl('1'))
    expect(useElementStore.getState().elements).toHaveLength(1)
  })

  it('기본 label("Box")은 자동 번호 부여 (Box 1, Box 2, ...)', () => {
    useElementStore.getState().addElement(makeEl('1', { label: 'Box' }))
    useElementStore.getState().addElement(makeEl('2', { label: 'Box' }))
    const { elements } = useElementStore.getState()
    expect(elements[0].label).toBe('Box 1')
    expect(elements[1].label).toBe('Box 2')
  })

  it('커스텀 label은 그대로 유지', () => {
    useElementStore.getState().addElement(makeEl('1', { label: 'My Element' }))
    expect(useElementStore.getState().elements[0].label).toBe('My Element')
  })

  it('Circle, Line도 타입별 카운터 적용', () => {
    useElementStore.getState().addElement(makeEl('c1', { type: 'circle', label: 'Circle' }))
    useElementStore.getState().addElement(makeEl('l1', { type: 'line', label: 'Line' }))
    const { elements } = useElementStore.getState()
    expect(elements.find((e) => e.id === 'c1')!.label).toBe('Circle 1')
    expect(elements.find((e) => e.id === 'l1')!.label).toBe('Line 1')
  })
})

// ── updateElement ─────────────────────────────────────────────────────────────

describe('updateElement', () => {
  it('지정 필드만 업데이트', () => {
    useElementStore.getState().addElement(makeEl('1', { x: 0, y: 0 }))
    useElementStore.getState().updateElement('1', { x: 50 })
    const el = useElementStore.getState().elements[0]
    expect(el.x).toBe(50)
    expect(el.y).toBe(0) // 나머지는 유지
  })

  it('존재하지 않는 id는 무시됨', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().updateElement('999', { x: 99 })
    expect(useElementStore.getState().elements[0].x).toBe(0)
  })

  it('label 업데이트', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().updateElement('1', { label: 'Updated' })
    expect(useElementStore.getState().elements[0].label).toBe('Updated')
  })
})

// ── removeElement ─────────────────────────────────────────────────────────────

describe('removeElement', () => {
  it('요소가 제거됨', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().addElement(makeEl('2'))
    useElementStore.getState().removeElement('1')
    const { elements } = useElementStore.getState()
    expect(elements).toHaveLength(1)
    expect(elements[0].id).toBe('2')
  })

  it('selectedIds에서도 제거', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().removeElement('1')
    expect(useElementStore.getState().selectedIds).toHaveLength(0)
  })

  it('container 제거 시 자식의 parentId 해제', () => {
    useElementStore.getState().addElement(makeEl('parent', { role: 'container' }))
    useElementStore.getState().addElement(makeEl('child', { parentId: 'parent' }))
    useElementStore.getState().removeElement('parent')
    const child = useElementStore.getState().elements.find((e) => e.id === 'child')!
    expect(child.parentId).toBeUndefined()
  })
})

// ── selectElement / toggleSelectElement / setSelectedIds ─────────────────────

describe('selectElement', () => {
  it('단일 선택', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().selectElement('1')
    expect(useElementStore.getState().selectedIds).toEqual(['1'])
  })

  it('null 전달 시 선택 해제', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().selectElement(null)
    expect(useElementStore.getState().selectedIds).toEqual([])
  })

  it('다른 요소 선택 시 이전 선택 해제', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().addElement(makeEl('2'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().selectElement('2')
    expect(useElementStore.getState().selectedIds).toEqual(['2'])
  })
})

describe('toggleSelectElement', () => {
  it('선택되지 않은 요소 토글 → 추가', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().addElement(makeEl('2'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().toggleSelectElement('2')
    expect(useElementStore.getState().selectedIds).toContain('1')
    expect(useElementStore.getState().selectedIds).toContain('2')
  })

  it('이미 선택된 요소 토글 → 제거', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().toggleSelectElement('1')
    expect(useElementStore.getState().selectedIds).toHaveLength(0)
  })
})

describe('setSelectedIds', () => {
  it('여러 id 한 번에 설정', () => {
    useElementStore.getState().setSelectedIds(['a', 'b', 'c'])
    expect(useElementStore.getState().selectedIds).toEqual(['a', 'b', 'c'])
  })
})

// ── reparentElement ───────────────────────────────────────────────────────────

describe('reparentElement', () => {
  it('자식을 부모에 연결', () => {
    useElementStore.getState().addElement(makeEl('parent', { role: 'container' }))
    useElementStore.getState().addElement(makeEl('child'))
    useElementStore.getState().reparentElement('child', 'parent')
    const child = useElementStore.getState().elements.find((e) => e.id === 'child')!
    expect(child.parentId).toBe('parent')
  })

  it('null로 reparent 시 최상위로 이동', () => {
    useElementStore.getState().addElement(makeEl('parent', { role: 'container' }))
    useElementStore.getState().addElement(makeEl('child', { parentId: 'parent' }))
    useElementStore.getState().reparentElement('child', null)
    const child = useElementStore.getState().elements.find((e) => e.id === 'child')!
    expect(child.parentId).toBeUndefined()
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('모든 상태가 초기화됨', () => {
    useElementStore.getState().addElement(makeEl('1'))
    useElementStore.getState().selectElement('1')
    useElementStore.getState().reset()
    const state = useElementStore.getState()
    expect(state.elements).toHaveLength(0)
    expect(state.selectedIds).toHaveLength(0)
  })
})
