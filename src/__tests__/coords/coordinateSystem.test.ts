import { describe, it, expect, vi } from 'vitest'

// FRUSTUM = 10 으로 고정 (engine/scene의 WebGL 의존성 차단)
vi.mock('../../engine/scene', () => ({ FRUSTUM: 10 }))

import { pixelToWorld, worldToPixel, pixelWidthToWorld, pixelHeightToWorld } from '../../coords/coordinateSystem'

// 캔버스 100×100, aspect=1, FRUSTUM=10
// World: x ∈ [-10, 10], y ∈ [10, -10] (top=+10, bottom=-10)

describe('pixelToWorld', () => {
  it('좌상단 (0,0) → (-10, 10)', () => {
    const [wx, wy] = pixelToWorld(0, 0, 100, 100)
    expect(wx).toBeCloseTo(-10, 5)
    expect(wy).toBeCloseTo(10, 5)
  })
  it('중앙 (50,50) → (0, 0)', () => {
    const [wx, wy] = pixelToWorld(50, 50, 100, 100)
    expect(wx).toBeCloseTo(0, 5)
    expect(wy).toBeCloseTo(0, 5)
  })
  it('우하단 (100,100) → (10, -10)', () => {
    const [wx, wy] = pixelToWorld(100, 100, 100, 100)
    expect(wx).toBeCloseTo(10, 5)
    expect(wy).toBeCloseTo(-10, 5)
  })
  it('가로로 긴 캔버스 (200×100) — aspect=2', () => {
    const [wx] = pixelToWorld(0, 50, 200, 100)
    // FRUSTUM * aspect = 10 * 2 = 20, 좌측 끝 → -20
    expect(wx).toBeCloseTo(-20, 5)
  })
})

describe('worldToPixel', () => {
  it('(-10, 10) → (0, 0)', () => {
    const [px, py] = worldToPixel(-10, 10, 100, 100)
    expect(px).toBeCloseTo(0, 5)
    expect(py).toBeCloseTo(0, 5)
  })
  it('(0, 0) → (50, 50)', () => {
    const [px, py] = worldToPixel(0, 0, 100, 100)
    expect(px).toBeCloseTo(50, 5)
    expect(py).toBeCloseTo(50, 5)
  })
  it('(10, -10) → (100, 100)', () => {
    const [px, py] = worldToPixel(10, -10, 100, 100)
    expect(px).toBeCloseTo(100, 5)
    expect(py).toBeCloseTo(100, 5)
  })
})

describe('pixelToWorld ↔ worldToPixel 라운드트립', () => {
  const cases = [
    [0, 0], [50, 50], [100, 100], [25, 75], [10, 90],
  ]
  for (const [px, py] of cases) {
    it(`(${px}, ${py}) 라운드트립`, () => {
      const [wx, wy] = pixelToWorld(px, py, 100, 100)
      const [rpx, rpy] = worldToPixel(wx, wy, 100, 100)
      expect(rpx).toBeCloseTo(px, 5)
      expect(rpy).toBeCloseTo(py, 5)
    })
  }
})

describe('pixelWidthToWorld', () => {
  it('100px 너비 = 전체 world width (aspect=1: 20)', () => {
    expect(pixelWidthToWorld(100, 100, 100)).toBeCloseTo(20, 5)
  })
  it('50px → world width의 절반 = 10', () => {
    expect(pixelWidthToWorld(50, 100, 100)).toBeCloseTo(10, 5)
  })
  it('0px → 0', () => {
    expect(pixelWidthToWorld(0, 100, 100)).toBe(0)
  })
})

describe('pixelHeightToWorld', () => {
  it('100px 높이 = 전체 world height = 20', () => {
    expect(pixelHeightToWorld(100, 100)).toBeCloseTo(20, 5)
  })
  it('50px → 10', () => {
    expect(pixelHeightToWorld(50, 100)).toBeCloseTo(10, 5)
  })
  it('0px → 0', () => {
    expect(pixelHeightToWorld(0, 100)).toBe(0)
  })
})
