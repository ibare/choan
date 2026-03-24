import { describe, it, expect } from 'vitest'
import { toMarkdown } from '../../export/toMarkdown'
import type { ChoanElement } from '../../store/useChoanStore'
import type { AnimationBundle } from '../../animation/types'

function makeEl(id: string, overrides: Partial<ChoanElement> = {}): ChoanElement {
  return {
    id, type: 'rectangle', label: id,
    x: 0, y: 0, z: 0,
    width: 100, height: 100,
    ...overrides,
  }
}

describe('toMarkdown — 빈 캔버스', () => {
  it('캔버스가 비어있으면 안내 문구 반환', () => {
    const result = toMarkdown([])
    expect(result).toContain('캔버스가 비어 있습니다')
  })
})

describe('toMarkdown — 기본 구조', () => {
  const els = [makeEl('Header', { width: 375, height: 812 })]

  it('# UI Spec 헤더 포함', () => {
    expect(toMarkdown(els)).toContain('# UI Spec')
  })

  it('Platform 정보 포함', () => {
    expect(toMarkdown(els)).toContain('Platform')
  })

  it('Viewport 정보 포함', () => {
    expect(toMarkdown(els)).toContain('Viewport')
  })

  it('요소 label 포함', () => {
    expect(toMarkdown(els)).toContain('Header')
  })
})

describe('toMarkdown — Viewport 계산', () => {
  it('단일 루트 요소: width × height', () => {
    const el = makeEl('Root', { x: 0, y: 0, width: 375, height: 812 })
    const result = toMarkdown([el])
    expect(result).toContain('375')
    expect(result).toContain('812')
  })

  it('복수 루트 요소: 최대 범위로 계산', () => {
    const a = makeEl('A', { x: 0, y: 0, width: 200, height: 100 })
    const b = makeEl('B', { x: 100, y: 50, width: 200, height: 100 })
    const result = toMarkdown([a, b])
    // maxW = 100+200=300, maxH = 50+100=150
    expect(result).toContain('300')
    expect(result).toContain('150')
  })
})

describe('toMarkdown — 플랫폼', () => {
  const els = [makeEl('el')]

  it('기본(web) → HTML 언급', () => {
    expect(toMarkdown(els, [], 'web')).toContain('HTML')
  })

  it('ios → SwiftUI 언급', () => {
    expect(toMarkdown(els, [], 'ios')).toContain('SwiftUI')
  })

  it('android → Jetpack Compose 언급', () => {
    expect(toMarkdown(els, [], 'android')).toContain('Jetpack Compose')
  })
})

describe('toMarkdown — 애니메이션 번들', () => {
  const els = [makeEl('el')]
  const bundle: AnimationBundle = {
    id: 'b1', name: 'Fade In',
    clips: [{
      id: 'c1', elementId: 'el', duration: 300, easing: 'ease',
      tracks: [{ property: 'y', keyframes: [{ time: 0, value: 100 }, { time: 300, value: 0 }] }],
    }],
  }

  it('번들이 있으면 번들 이름 포함', () => {
    expect(toMarkdown(els, [bundle])).toContain('Fade In')
  })

  it('번들이 없으면 애니메이션 섹션 없음', () => {
    const result = toMarkdown(els, [])
    expect(result).not.toContain('Animation')
  })
})

describe('toMarkdown — 계층 구조', () => {
  it('자식 요소가 있는 경우 label 포함', () => {
    const parent = makeEl('Container', { role: 'container' })
    const child = makeEl('Button', { parentId: 'Container' })
    const result = toMarkdown([parent, child])
    expect(result).toContain('Container')
    expect(result).toContain('Button')
  })
})
