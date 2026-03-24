import { describe, it, expect } from 'vitest'
import { interpolateValue, evaluateTrack } from '../../animation/interpolate'
import type { Keyframe } from '../../animation/types'

// ── interpolateValue ─────────────────────────────────────────────────────────

describe('interpolateValue — numeric properties', () => {
  it('x: 0에서 100으로 t=0.5 → 50', () => {
    expect(interpolateValue('x', 0, 100, 0.5)).toBe(50)
  })
  it('y: t=0 → from, t=1 → to', () => {
    expect(interpolateValue('y', 10, 90, 0)).toBe(10)
    expect(interpolateValue('y', 10, 90, 1)).toBe(90)
  })
})

describe('interpolateValue — radius (0~1 clamped)', () => {
  it('정상 범위 보간', () => {
    expect(interpolateValue('radius', 0, 1, 0.5)).toBe(0.5)
  })
  it('1 초과 clamp', () => {
    expect(interpolateValue('radius', 0, 2, 1)).toBe(1)
  })
})

describe('interpolateValue — width/height (min 1)', () => {
  it('정상 보간', () => {
    expect(interpolateValue('width', 0, 100, 0.5)).toBe(50)
  })
  it('최솟값 1 보장', () => {
    expect(interpolateValue('width', 0, 0, 0.5)).toBe(1)
  })
  it('height도 동일', () => {
    expect(interpolateValue('height', 0, 0, 0)).toBe(1)
  })
})

describe('interpolateValue — color', () => {
  it('검정(0x000000)→흰색(0xffffff) t=0 → 검정', () => {
    expect(interpolateValue('color', 0x000000, 0xffffff, 0)).toBe(0x000000)
  })
  it('검정→흰색 t=1 → 흰색', () => {
    expect(interpolateValue('color', 0x000000, 0xffffff, 1)).toBe(0xffffff)
  })
  it('검정→흰색 t=0.5 → 회색', () => {
    const mid = interpolateValue('color', 0x000000, 0xffffff, 0.5)
    const r = (mid >> 16) & 0xff
    const g = (mid >> 8) & 0xff
    const b = mid & 0xff
    expect(r).toBeCloseTo(128, -1)
    expect(g).toBeCloseTo(128, -1)
    expect(b).toBeCloseTo(128, -1)
  })
  it('같은 색 보간 → 변화 없음', () => {
    expect(interpolateValue('color', 0xff0000, 0xff0000, 0.5)).toBe(0xff0000)
  })
})

// ── evaluateTrack ─────────────────────────────────────────────────────────────

function kf(time: number, value: number, easing?: Keyframe['easing']): Keyframe {
  return { time, value, easing }
}

describe('evaluateTrack — 경계 조건', () => {
  it('keyframe 없음 → 0', () => {
    expect(evaluateTrack([], 50, 'linear', 'x')).toBe(0)
  })
  it('keyframe 1개 → 그 값', () => {
    expect(evaluateTrack([kf(0, 42)], 50, 'linear', 'x')).toBe(42)
  })
  it('time이 첫 keyframe 이전 → 첫 값', () => {
    expect(evaluateTrack([kf(100, 10), kf(200, 20)], 0, 'linear', 'x')).toBe(10)
  })
  it('time이 마지막 keyframe 이후 → 마지막 값', () => {
    expect(evaluateTrack([kf(0, 10), kf(100, 20)], 999, 'linear', 'x')).toBe(20)
  })
})

describe('evaluateTrack — 보간', () => {
  const kfs = [kf(0, 0), kf(100, 100)]
  it('linear 보간 t=50 → 50', () => {
    expect(evaluateTrack(kfs, 50, 'linear', 'x')).toBe(50)
  })
  it('linear 보간 t=0 → 0', () => {
    expect(evaluateTrack(kfs, 0, 'linear', 'x')).toBe(0)
  })
  it('linear 보간 t=100 → 100', () => {
    expect(evaluateTrack(kfs, 100, 'linear', 'x')).toBe(100)
  })
  it('ease-in-out은 중간에서 linear와 거의 같음', () => {
    // easeInOut at t=0.5 is symmetric, output ≈ 0.5
    const v = evaluateTrack(kfs, 50, 'ease-in-out', 'x')
    expect(v).toBeCloseTo(50, 0)
  })
})

describe('evaluateTrack — per-keyframe easing', () => {
  it('keyframe에 easing이 설정되면 그 easing 사용', () => {
    const kfsLinear = [kf(0, 0, 'linear'), kf(100, 100)]
    const kfsEaseIn = [kf(0, 0, 'ease-in'), kf(100, 100)]
    const vLinear = evaluateTrack(kfsLinear, 30, 'linear', 'x')
    const vEaseIn = evaluateTrack(kfsEaseIn, 30, 'linear', 'x')
    // ease-in은 시작이 느리므로 linear보다 작음
    expect(vEaseIn).toBeLessThan(vLinear)
  })
})

describe('evaluateTrack — 복수 세그먼트', () => {
  const kfs = [kf(0, 0), kf(50, 100), kf(100, 0)]
  it('첫 세그먼트 중간 → ~50', () => {
    expect(evaluateTrack(kfs, 25, 'linear', 'x')).toBeCloseTo(50, 5)
  })
  it('두 번째 세그먼트 중간 → ~50', () => {
    expect(evaluateTrack(kfs, 75, 'linear', 'x')).toBeCloseTo(50, 5)
  })
})
