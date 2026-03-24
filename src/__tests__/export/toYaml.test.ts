import { describe, it, expect } from 'vitest'
import { serialize, deserialize } from '../../export/toYaml'
import type { ChoanElement } from '../../store/useChoanStore'
import type { AnimationBundle } from '../../animation/types'

function makeEl(id: string): ChoanElement {
  return {
    id, type: 'rectangle', label: `Box ${id}`,
    x: 10, y: 20, z: 0,
    width: 100, height: 50,
  }
}

function makeBundle(id: string): AnimationBundle {
  return { id, name: `Anim ${id}`, clips: [] }
}

describe('serialize', () => {
  it('YAML 문자열 반환', () => {
    const result = serialize('Test', [makeEl('1')])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('version: 3 포함', () => {
    const result = serialize('Test', [makeEl('1')])
    expect(result).toContain('version: 3')
  })

  it('name 포함', () => {
    const result = serialize('My Project', [makeEl('1')])
    expect(result).toContain('My Project')
  })

  it('animationBundles가 비어있으면 출력에서 생략', () => {
    const result = serialize('Test', [makeEl('1')], [])
    expect(result).not.toContain('animationBundles')
  })

  it('animationBundles가 있으면 출력에 포함', () => {
    const result = serialize('Test', [makeEl('1')], [makeBundle('b1')])
    expect(result).toContain('animationBundles')
  })
})

describe('deserialize', () => {
  it('빈 elements 처리', () => {
    const input = serialize('Empty', [])
    const result = deserialize(input)
    expect(result.elements).toEqual([])
  })

  it('name 복원', () => {
    const input = serialize('Hello', [makeEl('1')])
    const result = deserialize(input)
    expect(result.name).toBe('Hello')
  })

  it('animationBundles 없으면 빈 배열', () => {
    const input = serialize('Test', [makeEl('1')], [])
    const result = deserialize(input)
    expect(result.animationBundles).toEqual([])
  })
})

describe('serialize → deserialize 라운드트립', () => {
  it('elements 복원', () => {
    const elements = [makeEl('a'), makeEl('b')]
    const yaml = serialize('RT', elements)
    const result = deserialize(yaml)
    expect(result.elements).toHaveLength(2)
    expect(result.elements[0].id).toBe('a')
    expect(result.elements[1].id).toBe('b')
  })

  it('element 필드 무결성', () => {
    const el = makeEl('x')
    const result = deserialize(serialize('Test', [el]))
    const restored = result.elements[0]
    expect(restored.id).toBe(el.id)
    expect(restored.type).toBe(el.type)
    expect(restored.x).toBe(el.x)
    expect(restored.y).toBe(el.y)
    expect(restored.width).toBe(el.width)
    expect(restored.height).toBe(el.height)
  })

  it('animationBundles 복원', () => {
    const bundles = [makeBundle('b1'), makeBundle('b2')]
    const result = deserialize(serialize('Test', [makeEl('1')], bundles))
    expect(result.animationBundles).toHaveLength(2)
    expect(result.animationBundles[0].id).toBe('b1')
    expect(result.animationBundles[1].name).toBe('Anim b2')
  })

  it('parentId 있는 요소 복원', () => {
    const parent = makeEl('p')
    const child: ChoanElement = { ...makeEl('c'), parentId: 'p' }
    const result = deserialize(serialize('Test', [parent, child]))
    const restoredChild = result.elements.find((e) => e.id === 'c')!
    expect(restoredChild.parentId).toBe('p')
  })

  it('optional 필드 복원 (radius, skin)', () => {
    const el: ChoanElement = { ...makeEl('1'), radius: 0.5, skin: 'switch' }
    const result = deserialize(serialize('Test', [el]))
    expect(result.elements[0].radius).toBe(0.5)
    expect(result.elements[0].skin).toBe('switch')
  })
})
