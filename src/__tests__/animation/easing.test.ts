import { describe, it, expect } from 'vitest'
import {
  linear, ease, easeIn, easeOut, easeInOut,
  createSpringEasing, resolveEasing,
} from '../../animation/easing'

describe('linear', () => {
  it('t=0 → 0', () => expect(linear(0)).toBe(0))
  it('t=1 → 1', () => expect(linear(1)).toBe(1))
  it('t=0.5 → 0.5', () => expect(linear(0.5)).toBe(0.5))
  it('t=0.25 → 0.25', () => expect(linear(0.25)).toBe(0.25))
})

describe('cubic-bezier easings (edge clamp)', () => {
  const fns = { ease, easeIn, easeOut, easeInOut }
  for (const [name, fn] of Object.entries(fns)) {
    it(`${name}(0) = 0`, () => expect(fn(0)).toBe(0))
    it(`${name}(1) = 1`, () => expect(fn(1)).toBe(1))
  }
})

describe('easeIn shape', () => {
  it('은 t=0.3에서 linear보다 느림 (slow start)', () => {
    expect(easeIn(0.3)).toBeLessThan(linear(0.3))
  })
  it('은 t=0.8에서도 아직 linear보다 낮음 (마지막에 가속)', () => {
    expect(easeIn(0.8)).toBeLessThan(linear(0.8))
  })
})

describe('easeOut shape', () => {
  it('은 linear보다 빠르게 시작 (t=0.3)', () => {
    expect(easeOut(0.3)).toBeGreaterThan(linear(0.3))
  })
  // easeOut은 초반에 빠르게 진행하므로 t=0.8에서도 linear보다 앞서 있음
  it('은 t=0.8에서 linear보다 앞서 있음', () => {
    expect(easeOut(0.8)).toBeGreaterThan(linear(0.8))
  })
})

describe('createSpringEasing', () => {
  it('t=0 → 0', () => {
    const spring = createSpringEasing()
    expect(spring(0)).toBe(0)
  })
  it('t=1 → overshoot (> 1, underdamped spring 특성)', () => {
    const spring = createSpringEasing()
    // spring은 underdamped이므로 t=1에서 1을 약간 초과 (overshoot)
    expect(spring(1)).toBeGreaterThan(1)
    expect(spring(1)).toBeLessThan(1.2) // 너무 크지 않음
  })
  it('t=0.5는 양수', () => {
    const spring = createSpringEasing()
    expect(spring(0.5)).toBeGreaterThan(0)
  })
  it('stiffness/damping 파라미터가 적용됨', () => {
    const stiff = createSpringEasing(0.5, 0.9)
    const loose = createSpringEasing(0.05, 0.5)
    // 두 설정의 중간값이 다름
    expect(stiff(0.5)).not.toBeCloseTo(loose(0.5), 2)
  })
})

describe('resolveEasing', () => {
  it('linear → 선형', () => {
    expect(resolveEasing('linear')(0.5)).toBe(0.5)
  })
  it('ease → 0, 1 경계값', () => {
    expect(resolveEasing('ease')(0)).toBe(0)
    expect(resolveEasing('ease')(1)).toBe(1)
  })
  it('ease-in → 0, 1 경계값', () => {
    expect(resolveEasing('ease-in')(0)).toBe(0)
    expect(resolveEasing('ease-in')(1)).toBe(1)
  })
  it('ease-out → 0, 1 경계값', () => {
    expect(resolveEasing('ease-out')(0)).toBe(0)
    expect(resolveEasing('ease-out')(1)).toBe(1)
  })
  it('ease-in-out → 0, 1 경계값', () => {
    expect(resolveEasing('ease-in-out')(0)).toBe(0)
    expect(resolveEasing('ease-in-out')(1)).toBe(1)
  })
  it('spring → t=0은 0, t=1은 overshoot', () => {
    const fn = resolveEasing('spring')
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBeGreaterThan(1)
  })
  it('알 수 없는 이름 → ease-in-out로 폴백', () => {
    const fn = resolveEasing('unknown')
    // easeInOut과 동일한 동작
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(1)
    expect(fn(0.5)).toBeCloseTo(easeInOut(0.5), 10)
  })
})
