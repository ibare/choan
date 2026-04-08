# Motion Path 시스템 구현 계획

## 배경

현재 스케치 모드의 애니메이션은 `x`, `y`, `width`, `height`, `color`, `radius` 6개의 독립 KeyframeTrack으로 구성된다. x/y가 독립 트랙이라 직선 이동은 자연스럽지만, **원형·타원·나선 등 연동된 곡선 경로는 표현할 수 없다**. 사용자가 원형 움직임을 만들려면 수십 개의 키프레임을 수동으로 배치해야 하며 그마저도 매끄럽지 않다.

Choan은 물체가 항상 카메라(Z축)를 바라보는 빌보드 모델이지만, **위치 자체는 XYZ 3D 공간에서 자유롭게 이동할 수 있다**. perspective 렌더링이므로 Z 이동은 원근 크기 변화로 시각화된다. 따라서 Motion Path도 3D 공간에서 정의되어야 한다.

## 설계 원칙

- **단순함 우선**: Choan의 컨셉에 맞춰 최소한의 path 타입만 제공
- **통합 모델**: 원/타원/호를 하나의 `orbit` 타입으로 통합, UI에서 찌그러뜨림·자르기로 조작
- **3D 네이티브**: 모든 path는 XYZ 공간에서 정의
- **기존 시스템과 공존**: x/y/z 키프레임 트랙과 additive overlay로 결합 (motionPath는 선택적 opt-in)

## Path 타입

### 1. `line` — 3D 직선
```typescript
interface LinePath extends MotionPathBase {
  type: 'line'
  p0: Vec3  // 시작점 (x, y, z)
  p1: Vec3  // 끝점
}
```

### 2. `orbit` — 원/타원/호 통합
```typescript
interface OrbitPath extends MotionPathBase {
  type: 'orbit'
  center: Vec3
  radiusU: number          // 장축 반경
  radiusV: number          // 단축 반경 (= radiusU이면 원)
  planeNormal: Vec3        // 원이 놓이는 평면의 법선
  startAngle: number       // 시작 각도 (radian)
  sweepAngle: number       // 진행 각도 (2π = 완전 원, < 2π = 호)
  clockwise: boolean
}
```

### 공통 베이스
```typescript
interface MotionPathBase {
  type: MotionPathType
  duration?: number           // ms (생략 시 clip duration)
  easing: EasingType          // 경로 위 속도 프로파일
  loop: boolean
  reverse: boolean
  originMode: 'relative'      // 요소 rest 위치 기준 오프셋
             | 'absolute'     // 경로 좌표 = 요소 절대 위치
}

type ElementMotionPath = LinePath | OrbitPath
```

## 좌표 단위

- `x`, `y`: 픽셀 좌표 (1920×1080 기준, 기존 ChoanElement와 동일)
- `z`: 레이어 유닛 (1 = EXTRUDE_DEPTH, 기존 z와 동일)

Vec3 = [x, y, z] — 기존 요소 필드와 같은 좌표계로 통일.

## 평가 방식

`animationEvaluator.ts`에서 motionPath가 존재할 때:

```
if (clip.motionPath) {
  const [dx, dy, dz] = evaluateMotionPath(clip.motionPath, localTime)
  if (originMode === 'relative') {
    result.x = baseX + dx
    result.y = baseY + dy
    result.z = baseZ + dz
  } else {
    result.x = dx
    result.y = dy
    result.z = dz
  }
}
```

motionPath는 기존 x/y/z 키프레임 트랙과 **additive overlay**로 결합된다. 둘 다 있으면 키프레임이 base position을 정의하고 motionPath가 그 위에 오프셋을 더한다.

## 단계별 구현 계획

### Phase 0: z 축 애니메이션 기반 구축
**목표**: 기존 키프레임 파이프라인이 z 속성을 애니메이션할 수 있도록 확장

- `AnimatableProperty`에 `'z'` 추가
- `interpolate.ts`에서 z 트랙 보간 지원
- `evaluateTrack` 경로에서 z 처리 검증
- `propagateDelta.ts`에서 z 델타도 자식에 전파
- 자동 키프레임 (`addKeyframe.ts`, `autoKeyframe.ts`)에서 z 지원
- 빌드 통과 + 간단한 z 키프레임으로 동작 확인

**완료 기준**: z 속성을 키프레임으로 애니메이션하면 요소가 원근 크기 변화와 함께 이동한다.

**커밋**: `Phase 0: AnimatableProperty에 z 축 추가`

### Phase 1: line 타입 + relative 모드
**목표**: 가장 단순한 Motion Path 타입 구현 + 평가 파이프라인 구축

- `src/animation/motionPathTypes.ts`: `MotionPathBase`, `LinePath`, `ElementMotionPath` 타입 정의
- `src/animation/motionPathEvaluator.ts`: `evaluateMotionPath()` + `evaluateLine()`
- `AnimationClip`에 `motionPath?: ElementMotionPath` 필드 추가
- `animationEvaluator.ts`에서 motionPath가 있으면 additive 적용
- `relative` / `absolute` originMode 분기
- loop / reverse / easing 지원
- 간단한 테스트: x/y/z 키프레임 없이 line path만으로 요소가 이동하는지 확인

**완료 기준**: animationBundle에 line motionPath를 설정하면 요소가 지정한 3D 직선을 따라 이동한다.

**커밋**: `Phase 1: Motion Path line 타입 + 평가 파이프라인`

### Phase 2: orbit 타입 기본 구현 (정원 + 평면 프리셋)
**목표**: orbit path를 정원 형태로만 구현, 평면 프리셋 3종 지원

- `motionPathTypes.ts`에 `OrbitPath` 타입 추가
- `motionPathEvaluator.ts`에 `evaluateOrbit()` 구현
  - `orthonormalBasisFromNormal(n)` 유틸 (n에 수직인 정규직교 기저 u,v 생성)
  - 각도 기반 위치 계산: `center + u·cosθ·r + v·sinθ·r`
- 평면 프리셋 상수: `PLANE_XY = (0,0,1)`, `PLANE_XZ = (0,1,0)`, `PLANE_YZ = (1,0,0)`
- Phase 2에서는 `radiusU === radiusV`, `sweepAngle === 2π` 로 고정 (UI 노출 전)
- 간단한 테스트: orbit motionPath로 요소가 지정한 평면상에서 원을 그리며 공전하는지 확인

**완료 기준**: animationBundle에 orbit motionPath를 설정하면 요소가 지정된 평면(XY/XZ/YZ)에서 원을 그리며 공전한다.

**커밋**: `Phase 2: Motion Path orbit 타입 (정원 + 평면 프리셋)`

### Phase 3: orbit 찌그러뜨림 + 자르기 UI
**목표**: `radiusU !== radiusV`(타원) + `sweepAngle < 2π`(호) 활성화 + 편집 UI

- `OrbitPath`의 `radiusU`, `radiusV`, `startAngle`, `sweepAngle` 모두 편집 가능
- Motion Path 편집 패널 UI:
  - Path 타입 선택 (line / orbit)
  - Orbit 전용 속성:
    - 중심점 x/y/z 입력
    - 반경 U/V 입력 (동기화 토글로 정원 유지 가능)
    - 시작 각도 / 진행 각도 슬라이더
    - 평면 프리셋 3종 버튼 (XY/XZ/YZ)
    - 방향 반전 토글 (clockwise)
  - 공통 속성: duration, easing, loop, reverse, originMode
- `components/panels/` 하위에 MotionPathEditor 추가
- 요소 속성 패널에서 "애니메이션 번들 편집" 진입 시 Motion Path 섹션 노출

**완료 기준**: 사용자가 패널에서 orbit을 타원으로 찌그러뜨리거나 호로 잘라낼 수 있고 즉시 미리보기가 반영된다.

**커밋**: `Phase 3: orbit 찌그러뜨림 + 자르기 + Motion Path 편집 패널`

### Phase 4: 커스텀 평면 법선 편집 (3D gizmo)
**목표**: `planeNormal`을 임의의 3D 벡터로 조정할 수 있는 핸들 제공

- 캔버스 오버레이: 선택된 orbit의 실제 경로 곡선을 실시간 렌더링
- 중심점 3D gizmo (기존 zTunnelOverlay/cameraPathOverlay 핸들 재사용)
- 평면 법선 조정:
  - "커스텀" 버튼 활성화 시 법선 끝점 핸들 표시
  - 끝점 드래그로 normal 방향 조정 (구면 위 이동)
- orbit 오버레이 렌더링 함수: `drawMotionPathOrbit(ctx, path, camera, ...)`
  - N개 세그먼트로 곡선 샘플링 후 projectToCanvas로 2D 투영
  - sweepAngle 반영 (부분 호만 그림)
- line path 오버레이도 함께 구현 (p0→p1 직선)

**완료 기준**: 사용자가 캔버스에서 직접 orbit의 평면과 중심점을 3D로 편집할 수 있고, 경로가 실시간으로 시각화된다.

**커밋**: `Phase 4: Motion Path 3D gizmo + 캔버스 오버레이`

## 통합 지점 요약

| 파일 | 변경 규모 |
|---|---|
| `src/animation/types.ts` | `AnimatableProperty`에 `'z'` 추가, `AnimationClip`에 `motionPath` 필드 |
| `src/animation/motionPathTypes.ts` | 신규 (Phase 1) |
| `src/animation/motionPathEvaluator.ts` | 신규 (Phase 1~2) |
| `src/animation/interpolate.ts` | z 트랙 보간 (Phase 0) |
| `src/animation/animationEvaluator.ts` | motionPath 분기 (Phase 1) |
| `src/animation/propagateDelta.ts` | z 델타 전파 (Phase 0) |
| `src/animation/addKeyframe.ts`, `autoKeyframe.ts` | z 지원 (Phase 0) |
| `src/components/panels/MotionPathEditor.tsx` | 신규 (Phase 3) |
| `src/rendering/motionPathOverlay.ts` | 신규 (Phase 4) |
| `src/rendering/useAnimateLoop.ts` | 오버레이 호출 (Phase 4) |

## 구현 원칙

- 각 Phase가 끝나면 빌드 통과 + rule-guard 검증 후 커밋
- 각 Phase는 독립적으로 동작 가능한 단위로 분할
- 기존 키프레임 파이프라인은 건드리지 않고 확장만 (backwards compatible)
- motionPath는 `optional` — 기존 애니메이션은 모두 그대로 동작
