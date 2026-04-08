import { describe, it, expect } from 'vitest'
import { evaluateMotionPath } from '../../animation/motionPathEvaluator'
import {
  PLANE_XY_NORMAL,
  PLANE_XZ_NORMAL,
  PLANE_YZ_NORMAL,
  type LinePath,
  type OrbitPath,
  type Vec3,
} from '../../animation/motionPathTypes'

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

// ── orbit ────────────────────────────────────────────────────────────────────

const baseOrbit: OrbitPath = {
  type: 'orbit',
  center: [0, 0, 0],
  radiusU: 10,
  radiusV: 10,
  planeNormal: PLANE_XY_NORMAL,
  startAngle: 0,
  sweepAngle: Math.PI * 2,
  clockwise: false,
  easing: 'linear',
  loop: false,
  reverse: false,
  originMode: 'relative',
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

describe('evaluateMotionPath — orbit: 정원 반경 유지', () => {
  it('XY 평면 정원: 모든 t에서 center로부터 거리 = radius', () => {
    const center: Vec3 = [0, 0, 0]
    for (const localTime of [0, 125, 250, 375, 500, 625, 750, 875]) {
      const p = evaluateMotionPath(baseOrbit, localTime, 1000)
      expect(dist(p, center)).toBeCloseTo(10)
    }
  })

  it('XY 평면: planeNormal 축(Z) 좌표 고정', () => {
    for (const localTime of [0, 250, 500, 750]) {
      const [, , z] = evaluateMotionPath(baseOrbit, localTime, 1000)
      expect(z).toBeCloseTo(0)
    }
  })

  it('XZ 평면: Y 좌표 고정, 거리 유지', () => {
    const path: OrbitPath = { ...baseOrbit, planeNormal: PLANE_XZ_NORMAL }
    for (const localTime of [0, 250, 500, 750]) {
      const [, y] = evaluateMotionPath(path, localTime, 1000)
      expect(y).toBeCloseTo(0)
      const p = evaluateMotionPath(path, localTime, 1000)
      expect(dist(p, [0, 0, 0])).toBeCloseTo(10)
    }
  })

  it('YZ 평면: X 좌표 고정, 거리 유지', () => {
    const path: OrbitPath = { ...baseOrbit, planeNormal: PLANE_YZ_NORMAL }
    for (const localTime of [0, 250, 500, 750]) {
      const [x] = evaluateMotionPath(path, localTime, 1000)
      expect(x).toBeCloseTo(0)
      const p = evaluateMotionPath(path, localTime, 1000)
      expect(dist(p, [0, 0, 0])).toBeCloseTo(10)
    }
  })

  it('center 오프셋 적용 시에도 거리 유지', () => {
    const path: OrbitPath = { ...baseOrbit, center: [5, -3, 2] }
    const p = evaluateMotionPath(path, 250, 1000)
    expect(dist(p, [5, -3, 2])).toBeCloseTo(10)
  })
})

describe('evaluateMotionPath — orbit: clockwise와 sweep', () => {
  it('clockwise=true → t=0.25 지점이 반시계 t=0.75와 동일', () => {
    const ccw: Vec3 = evaluateMotionPath(baseOrbit, 250, 1000)
    const cw: Vec3 = evaluateMotionPath({ ...baseOrbit, clockwise: true }, 250, 1000)
    const ccwFar: Vec3 = evaluateMotionPath(baseOrbit, 750, 1000)
    expect(cw[0]).toBeCloseTo(ccwFar[0])
    expect(cw[1]).toBeCloseTo(ccwFar[1])
    expect(cw[2]).toBeCloseTo(ccwFar[2])
    expect(cw[0]).not.toBeCloseTo(ccw[0])
  })

  it('반원 sweep(π): t=1 지점은 반대편 지름에 있음', () => {
    const halfArc: OrbitPath = { ...baseOrbit, sweepAngle: Math.PI }
    const start: Vec3 = evaluateMotionPath(halfArc, 0, 1000)
    const end: Vec3 = evaluateMotionPath(halfArc, 1000, 1000)
    // 지름 양 끝: 두 점 사이 거리 = 2r
    expect(dist(start, end)).toBeCloseTo(20)
  })

  it('정원 전체(2π) 루프는 시작점과 끝점이 동일', () => {
    const start = evaluateMotionPath(baseOrbit, 0, 1000)
    const end = evaluateMotionPath(baseOrbit, 1000, 1000)
    expect(dist(start, end)).toBeCloseTo(0)
  })
})

describe('evaluateMotionPath — orbit: 타원(일반식)', () => {
  it('radiusU=20, radiusV=5일 때 축 방향 최대거리 검증', () => {
    const ellipse: OrbitPath = { ...baseOrbit, radiusU: 20, radiusV: 5 }
    // t=0 (cos=1, sin=0) → radiusU 방향
    const p0 = evaluateMotionPath(ellipse, 0, 1000)
    expect(dist(p0, [0, 0, 0])).toBeCloseTo(20)
    // t=0.25 (cos=0, sin=1) → radiusV 방향
    const p1 = evaluateMotionPath(ellipse, 250, 1000)
    expect(dist(p1, [0, 0, 0])).toBeCloseTo(5)
  })

  it('타원은 정원과 달리 거리가 일정하지 않음', () => {
    const ellipse: OrbitPath = { ...baseOrbit, radiusU: 20, radiusV: 5 }
    const d0 = dist(evaluateMotionPath(ellipse, 0, 1000), [0, 0, 0])
    const d1 = dist(evaluateMotionPath(ellipse, 250, 1000), [0, 0, 0])
    expect(d0).not.toBeCloseTo(d1)
  })
})

describe('evaluateMotionPath — orbit: duration fallback + loop', () => {
  it('duration=0 → pathStart(= t=0 위치) 반환', () => {
    const path: OrbitPath = { ...baseOrbit, duration: 0 }
    const p = evaluateMotionPath(path, 500, 0)
    const start = evaluateMotionPath(baseOrbit, 0, 1000)
    expect(p[0]).toBeCloseTo(start[0])
    expect(p[1]).toBeCloseTo(start[1])
    expect(p[2]).toBeCloseTo(start[2])
  })

  it('loop=true: localTime > duration이어도 순환', () => {
    const looped: OrbitPath = { ...baseOrbit, loop: true }
    const p1 = evaluateMotionPath(looped, 250, 1000)
    const p2 = evaluateMotionPath(looped, 1250, 1000)
    expect(p1[0]).toBeCloseTo(p2[0])
    expect(p1[1]).toBeCloseTo(p2[1])
  })
})
