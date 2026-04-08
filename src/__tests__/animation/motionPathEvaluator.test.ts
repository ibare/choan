import { describe, it, expect } from 'vitest'
import { evaluateMotionPath } from '../../animation/motionPathEvaluator'
import type { LinePath } from '../../animation/motionPathTypes'

const baseLine: LinePath = {
  type: 'line',
  p0: [0, 0, 0],
  p1: [100, 200, 10],
  easing: 'linear',
  loop: false,
  reverse: false,
  originMode: 'relative',
}

// ── evaluateMotionPath — line ────────────────────────────────────────────────

describe('evaluateMotionPath — line', () => {
  it('t=0 (localTime=0) → p0', () => {
    const [x, y, z] = evaluateMotionPath(baseLine, 0, 1000)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })

  it('t=1 (localTime=duration) → p1', () => {
    const [x, y, z] = evaluateMotionPath(baseLine, 1000, 1000)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(200)
    expect(z).toBeCloseTo(10)
  })

  it('t=0.5 (linear) → 중점', () => {
    const [x, y, z] = evaluateMotionPath(baseLine, 500, 1000)
    expect(x).toBeCloseTo(50)
    expect(y).toBeCloseTo(100)
    expect(z).toBeCloseTo(5)
  })

  it('localTime > duration (loop=false) → 마지막 점에 고정', () => {
    const [x, y, z] = evaluateMotionPath(baseLine, 5000, 1000)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(200)
    expect(z).toBeCloseTo(10)
  })

  it('localTime < 0 (loop=false) → 시작점에 고정', () => {
    const [x, y, z] = evaluateMotionPath(baseLine, -500, 1000)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })
})

// ── duration fallback ────────────────────────────────────────────────────────

describe('evaluateMotionPath — duration fallback', () => {
  it('path.duration이 있으면 clipDuration 무시', () => {
    const path: LinePath = { ...baseLine, duration: 500 }
    const [x] = evaluateMotionPath(path, 250, 10000)
    expect(x).toBeCloseTo(50)  // t=0.5 using path.duration=500
  })

  it('path.duration이 없으면 clipDuration 사용', () => {
    const [x] = evaluateMotionPath(baseLine, 250, 500)
    expect(x).toBeCloseTo(50)  // t=0.5 using clipDuration=500
  })

  it('duration ≤ 0 → pathStart (p0) 반환', () => {
    const path: LinePath = { ...baseLine, duration: 0 }
    const [x, y, z] = evaluateMotionPath(path, 500, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })
})

// ── loop ─────────────────────────────────────────────────────────────────────

describe('evaluateMotionPath — loop', () => {
  const loopLine: LinePath = { ...baseLine, loop: true }

  it('localTime=duration → phase 0 (다시 시작점)', () => {
    const [x] = evaluateMotionPath(loopLine, 1000, 1000)
    expect(x).toBeCloseTo(0)
  })

  it('localTime=1.5 × duration → phase 0.5', () => {
    const [x] = evaluateMotionPath(loopLine, 1500, 1000)
    expect(x).toBeCloseTo(50)
  })

  it('localTime=2.25 × duration → phase 0.25', () => {
    const [x] = evaluateMotionPath(loopLine, 2250, 1000)
    expect(x).toBeCloseTo(25)
  })

  it('음수 localTime도 phase로 정규화', () => {
    const [x] = evaluateMotionPath(loopLine, -250, 1000)
    expect(x).toBeCloseTo(75)  // phase = 0.75
  })
})

// ── reverse ──────────────────────────────────────────────────────────────────

describe('evaluateMotionPath — reverse', () => {
  const reversedLine: LinePath = { ...baseLine, reverse: true }

  it('t=0 → p1 (끝점에서 시작)', () => {
    const [x, y, z] = evaluateMotionPath(reversedLine, 0, 1000)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(200)
    expect(z).toBeCloseTo(10)
  })

  it('t=1 → p0 (시작점에서 끝)', () => {
    const [x, y, z] = evaluateMotionPath(reversedLine, 1000, 1000)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })
})

// ── easing ───────────────────────────────────────────────────────────────────

describe('evaluateMotionPath — easing', () => {
  it('ease-in-out는 t=0.5에서 정확히 중점을 통과', () => {
    // 대칭 curve이므로 중점은 linear와 같은 위치
    const easedLine: LinePath = { ...baseLine, easing: 'ease-in-out' }
    const [x] = evaluateMotionPath(easedLine, 500, 1000)
    expect(x).toBeCloseTo(50)
  })

  it('ease-in은 t=0.5에서 linear보다 뒤쪽', () => {
    const easedLine: LinePath = { ...baseLine, easing: 'ease-in' }
    const [x] = evaluateMotionPath(easedLine, 500, 1000)
    expect(x).toBeLessThan(50)
  })

  it('ease-out은 t=0.5에서 linear보다 앞쪽', () => {
    const easedLine: LinePath = { ...baseLine, easing: 'ease-out' }
    const [x] = evaluateMotionPath(easedLine, 500, 1000)
    expect(x).toBeGreaterThan(50)
  })

  it('끝점은 easing과 무관하게 p1', () => {
    const easedLine: LinePath = { ...baseLine, easing: 'ease-in-out' }
    const [x, y, z] = evaluateMotionPath(easedLine, 1000, 1000)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(200)
    expect(z).toBeCloseTo(10)
  })
})
