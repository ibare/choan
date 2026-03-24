import { describe, it, expect } from 'vitest'
import { buildLayerTree } from '../../animation/buildLayerTree'
import type { ChoanElement } from '../../store/useChoanStore'

function el(id: string, parentId?: string): ChoanElement {
  return {
    id, parentId,
    type: 'rectangle', label: id,
    x: 0, y: 0, z: 0,
    width: 100, height: 100,
  }
}

describe('buildLayerTree', () => {
  it('빈 배열 → 빈 결과', () => {
    expect(buildLayerTree([])).toEqual([])
  })

  it('최상위 요소들 → depth 0', () => {
    const result = buildLayerTree([el('a'), el('b'), el('c')])
    expect(result).toHaveLength(3)
    result.forEach((r) => expect(r.depth).toBe(0))
  })

  it('단순 부모/자식 → 부모 depth 0, 자식 depth 1', () => {
    const result = buildLayerTree([el('parent'), el('child', 'parent')])
    const parent = result.find((r) => r.el.id === 'parent')!
    const child = result.find((r) => r.el.id === 'child')!
    expect(parent.depth).toBe(0)
    expect(child.depth).toBe(1)
  })

  it('부모가 자식보다 먼저 나옴', () => {
    const result = buildLayerTree([el('child', 'parent'), el('parent')])
    const parentIdx = result.findIndex((r) => r.el.id === 'parent')
    const childIdx = result.findIndex((r) => r.el.id === 'child')
    expect(parentIdx).toBeLessThan(childIdx)
  })

  it('3단계 중첩 → depth 0, 1, 2', () => {
    const result = buildLayerTree([
      el('grandchild', 'child'),
      el('child', 'parent'),
      el('parent'),
    ])
    expect(result.find((r) => r.el.id === 'parent')!.depth).toBe(0)
    expect(result.find((r) => r.el.id === 'child')!.depth).toBe(1)
    expect(result.find((r) => r.el.id === 'grandchild')!.depth).toBe(2)
  })

  it('형제 노드는 부모 다음에 연속으로 나옴', () => {
    const result = buildLayerTree([
      el('b', 'parent'),
      el('a', 'parent'),
      el('parent'),
    ])
    const parentIdx = result.findIndex((r) => r.el.id === 'parent')
    const aIdx = result.findIndex((r) => r.el.id === 'a')
    const bIdx = result.findIndex((r) => r.el.id === 'b')
    expect(aIdx).toBeGreaterThan(parentIdx)
    expect(bIdx).toBeGreaterThan(parentIdx)
  })

  it('독립된 여러 트리', () => {
    const result = buildLayerTree([
      el('b-child', 'b'),
      el('a-child', 'a'),
      el('a'),
      el('b'),
    ])
    expect(result).toHaveLength(4)
    // a 트리: a → a-child 순
    const aIdx = result.findIndex((r) => r.el.id === 'a')
    const aChildIdx = result.findIndex((r) => r.el.id === 'a-child')
    expect(aIdx).toBeLessThan(aChildIdx)
    // b 트리: b → b-child 순
    const bIdx = result.findIndex((r) => r.el.id === 'b')
    const bChildIdx = result.findIndex((r) => r.el.id === 'b-child')
    expect(bIdx).toBeLessThan(bChildIdx)
  })

  it('parentId가 없는 요소는 depth 0', () => {
    const result = buildLayerTree([el('solo')])
    expect(result[0].depth).toBe(0)
  })
})
