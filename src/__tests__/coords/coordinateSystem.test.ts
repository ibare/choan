import { describe, it, expect, vi } from 'vitest'

// FRUSTUM = 10 으로 고정 (engine/scene의 WebGL 의존성 차단)
vi.mock('../../engine/scene', () => ({ FRUSTUM: 10 }))

import { pixelToWorld, worldToPixel, pixelWidthToWorld, pixelHeightToWorld } from '../../coords/coordinateSystem'

// 고정 참조 해상도: REF_W=1920, REF_H=1080, REF_ASPECT=16/9, FRUSTUM=10
// World X: [-160/9, +160/9] ≈ [-17.778, +17.778]
// World Y: [+10, -10] (top=+10, bottom=-10)

const FA = 10 * (16 / 9) // FRUSTUM * REF_ASPECT = 160/9

describe('pixelToWorld', () => {
  it('좌상단 (0,0) → (-160/9, 10)', () => {
    const [wx, wy] = pixelToWorld(0, 0)
    expect(wx).toBeCloseTo(-FA, 5)
    expect(wy).toBeCloseTo(10, 5)
  })
  it('중앙 (960,540) → (0, 0)', () => {
    const [wx, wy] = pixelToWorld(960, 540)
    expect(wx).toBeCloseTo(0, 5)
    expect(wy).toBeCloseTo(0, 5)
  })
  it('우하단 (1920,1080) → (160/9, -10)', () => {
    const [wx, wy] = pixelToWorld(1920, 1080)
    expect(wx).toBeCloseTo(FA, 5)
    expect(wy).toBeCloseTo(-10, 5)
  })
  it('좌측 중앙 (0,540) → (-160/9, 0)', () => {
    const [wx] = pixelToWorld(0, 540)
    expect(wx).toBeCloseTo(-FA, 5)
  })
})

describe('worldToPixel', () => {
  it('(-160/9, 10) → (0, 0)', () => {
    const [px, py] = worldToPixel(-FA, 10)
    expect(px).toBeCloseTo(0, 5)
    expect(py).toBeCloseTo(0, 5)
  })
  it('(0, 0) → (960, 540)', () => {
    const [px, py] = worldToPixel(0, 0)
    expect(px).toBeCloseTo(960, 5)
    expect(py).toBeCloseTo(540, 5)
  })
  it('(160/9, -10) → (1920, 1080)', () => {
    const [px, py] = worldToPixel(FA, -10)
    expect(px).toBeCloseTo(1920, 5)
    expect(py).toBeCloseTo(1080, 5)
  })
})

describe('pixelToWorld ↔ worldToPixel 라운드트립', () => {
  const cases = [
    [0, 0], [960, 540], [1920, 1080], [480, 810], [192, 972],
  ]
  for (const [px, py] of cases) {
    it(`(${px}, ${py}) 라운드트립`, () => {
      const [wx, wy] = pixelToWorld(px, py)
      const [rpx, rpy] = worldToPixel(wx, wy)
      expect(rpx).toBeCloseTo(px, 5)
      expect(rpy).toBeCloseTo(py, 5)
    })
  }
})

describe('pixelWidthToWorld', () => {
  it('1920px 너비 = 전체 world width (320/9 ≈ 35.556)', () => {
    expect(pixelWidthToWorld(1920)).toBeCloseTo(2 * FA, 5)
  })
  it('960px → world width의 절반 = 160/9', () => {
    expect(pixelWidthToWorld(960)).toBeCloseTo(FA, 5)
  })
  it('0px → 0', () => {
    expect(pixelWidthToWorld(0)).toBe(0)
  })
})

describe('pixelHeightToWorld', () => {
  it('1080px 높이 = 전체 world height = 20', () => {
    expect(pixelHeightToWorld(1080)).toBeCloseTo(20, 5)
  })
  it('540px → 10', () => {
    expect(pixelHeightToWorld(540)).toBeCloseTo(10, 5)
  })
  it('0px → 0', () => {
    expect(pixelHeightToWorld(0)).toBe(0)
  })
})
