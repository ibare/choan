# Z축 터널 가이드 + 회전 링 구현 계획

## Context

Director 모드에서 요소의 Z축 이동과 회전이 필요하다. 기존 Bundle 모드는 XY 이동만 지원하며 이를 유지한다.
전통 Gizmo(3축 화살표)는 3D 초보에게 어렵다. 대안으로 **Z축 투시 터널 가이드**를 제안:
- 선택된 요소에서 Z축 방향으로 소실점을 향해 수렴하는 투명한 가이드라인("터널")을 표시
- 사용자는 "이 통로 안에서 물체가 앞뒤로 움직인다"는 것을 직관적으로 이해
- 터널이 공간 맥락을 잡아주므로, 그 위에 원형 회전 링을 올리면 축이 명확해짐
- **카메라 각도가 정면에 가까우면(Z축이 화면에 수직) 터널이 점으로 보이므로**, 일정 각도 이상에서만 활성화

## 전제 조건

- **Branch**: `develop`
- **적용 범위**: Director 모드에서만. Bundle 모드는 기존 XY 이동 유지.
- `useDirectorStore.directorMode`로 분기
- **기존 인프라**:
  - `overlay.drawLines3D(Float32Array, color, lineWidth)` — 3D 라인 렌더링 (이미 구현)
  - `overlay.drawDiscScreen(px, py, radius, color)` — 스크린 원 (이미 구현)
  - `overlay.projectToScreen(wx, wy, wz)` — 월드→스크린 좌표 변환 (이미 구현)
  - `src/rendering/overlayCommands.ts` — 기존 오버레이 그리기 (선택 박스, 핸들 등)
  - `src/interaction/hitTest.ts` — 요소 히트 테스트 + 코너/에지 핸들 히트 테스트
  - `src/interaction/usePointerHandlers.ts` — 포인터 이벤트 라우팅
  - `src/interaction/dragHandlers.ts` — 요소 드래그 이동 로직
  - `src/engine/controls.ts` — orbit controls (theta, phi, radius, panOffset)
  - `src/engine/camera.ts` — Camera 구조체 (position, target, fov)

## 각도 임계값

카메라의 phi(수직 각도)로 판별:
- `phi = π/2` = 정면 (Z축이 화면에 수직 → 터널 불가)
- `phi < π/4` 또는 `phi > 3π/4` = 위/아래에서 봄 (Z축이 충분히 보임)
- theta도 고려: theta=0이면 정면, theta가 충분히 기울어야 Z가 보임

**활성화 조건**: `abs(phi - π/2) > π/6` 또는 `abs(theta) > π/6`
→ 카메라가 정면에서 최소 30도 이상 기울어져야 터널 표시.
조건 미충족 시 Z 이동/회전 불가 + "카메라를 기울여주세요" 힌트 표시 가능.

## 구현 단계

### Phase 1: Z축 터널 가이드 오버레이

**신규 파일: `src/rendering/zTunnelOverlay.ts`**

```typescript
export function drawZTunnelOverlay(
  ov: OverlayRenderer,
  element: ChoanElement,       // 선택된 요소
  canvasW: number,
  canvasH: number,
  phi: number,                 // 카메라 수직 각도
  theta: number,               // 카메라 수평 각도
  dpr: number,
): void
```

그리는 것:
1. **Z축 가이드 라인 4개** — 요소의 4코너에서 Z축 방향(앞/뒤)으로 뻗는 선분
   - 요소 중심의 XY 좌표에서, Z = -20 ~ Z = +20 범위의 직선 4개
   - `drawLines3D`로 렌더링
   - 색상: 반투명 파랑 `[0.3, 0.6, 1.0, 0.3]`
2. **요소 Z 위치의 수평 단면 링** — 현재 Z 위치에서의 수평 사각형 와이어프레임
   - 요소 크기와 동일한 사각형, 현재 Z에 배치
   - 색상: 약간 밝은 파랑 `[0.3, 0.6, 1.0, 0.5]`
3. **Z값 레이블** — 스크린 좌표로 Z값 표시 (overlay에 텍스트 그리기는 없으므로, DOM 오버레이 또는 생략)

활성화 조건 체크:
```typescript
const canShowTunnel = Math.abs(phi - Math.PI / 2) > Math.PI / 6
                   || Math.abs(theta) > Math.PI / 6
if (!canShowTunnel) return  // 정면에 가까우면 터널 숨김
```

**수정 파일: `src/rendering/overlayCommands.ts`**
- Director 모드 + 요소 선택 시 `drawZTunnelOverlay` 호출 추가
- 기존 `drawOverlay` 함수 끝에 분기 추가

### Phase 2: Z축 드래그 이동

**수정 파일: `src/interaction/usePointerHandlers.ts`**

Director 모드에서 Z 이동 모드 진입 조건:
1. 요소가 선택된 상태
2. 터널이 활성화된 상태 (각도 조건 충족)
3. **Z 키를 누른 상태에서 드래그** (또는 터널 가이드 라인을 직접 잡아 드래그)

Z 이동 시:
- 마우스 Y 이동 → 요소의 Z값 변경
- 변환: 화면 위로 드래그 = Z 증가 (앞으로), 아래로 = Z 감소 (뒤로)
- 기존 `handleDragMove`에 `isZDragging` 분기 추가

새 ref:
```typescript
const isZDraggingRef = useRef(false)
```

handlePointerDown 수정:
```typescript
// Director 모드 + Z키 + 요소 선택 → Z 드래그 모드
if (directorMode && zKeyDown && selectedId) {
  isZDraggingRef.current = true
  // 시작 Z값 저장
}
```

handlePointerMove 수정:
```typescript
if (isZDraggingRef.current) {
  const dy = e.clientY - lastY
  const zDelta = -dy * zSpeed * (radius / 20)  // 화면 위 = Z 증가
  updateElement(elementId, { z: originalZ + zDelta })
  return
}
```

### Phase 3: 회전 링 오버레이

**수정 파일: `src/rendering/zTunnelOverlay.ts`에 추가**

```typescript
export function drawRotationRing(
  ov: OverlayRenderer,
  element: ChoanElement,
  canvasW: number,
  canvasH: number,
  dpr: number,
): void
```

그리는 것:
- 요소 중심에 원형 링 — Z축을 축으로 하는 원
- `drawLines3D`로 원을 N개 직선 세그먼트로 근사 (32개 정도)
- 원의 반지름 = 요소 대각선 크기의 0.7배
- 색상: 주황 `[1.0, 0.6, 0.2, 0.6]`
- 회전 핸들 (원 위의 한 점): `drawDiscScreen`으로 마커 표시

### Phase 4: 회전 드래그

**수정 파일: `src/interaction/usePointerHandlers.ts`**

회전 모드 진입:
1. Director 모드
2. 회전 링 근처 클릭 (히트 테스트: 스크린 좌표에서 원까지의 거리)

회전 드래그:
- 요소 중심으로부터의 각도 변화량 계산
- `atan2(dy, dx)` 차이로 회전량 산출
- 현재 요소에 rotation 속성이 없으므로 `ChoanElement`에 추가 필요

**수정 파일: `src/store/useElementStore.ts`**
- `ChoanElement`에 `rotationY?: number` (Y축 회전, degrees) 추가
- 기본값 0 (회전 없음)

**수정 파일: `src/engine/scene.ts`**
- UBO에 rotation 데이터 전달 추가

**수정 파일: `src/engine/shaders.ts`**
- SDF 평가 시 position에 회전 행렬 적용

### Phase 5: SDF 회전 렌더링

셰이더에서 각 오브젝트에 Y축 회전을 적용:

```glsl
// 회전 행렬 적용 (Y축)
float cosR = cos(rotation);
float sinR = sin(rotation);
vec3 rotP = vec3(
  cosR * p.x + sinR * p.z,
  p.y,
  -sinR * p.x + cosR * p.z
);
float d = sdRoundBox(rotP, size, radius);
```

UBO에 rotation float를 추가해야 함 (오브젝트당 1 float → uEffect 배열의 빈 컴포넌트 활용 가능).

## 파일 요약

| 액션 | 파일 | 단계 |
|------|------|------|
| **신규** | `src/rendering/zTunnelOverlay.ts` | Phase 1, 3 |
| **수정** | `src/rendering/overlayCommands.ts` | Phase 1 |
| **수정** | `src/interaction/usePointerHandlers.ts` | Phase 2, 4 |
| **수정** | `src/store/useElementStore.ts` | Phase 4 |
| **수정** | `src/engine/scene.ts` | Phase 5 |
| **수정** | `src/engine/shaders.ts` | Phase 5 |
| **수정** | `src/engine/controls.ts` | Phase 2 (Z키 감지) |

## 구현 순서

```
Phase 1: Z 터널 오버레이 (시각만, 인터랙션 없음) → 빌드 확인
Phase 2: Z축 드래그 이동 → 빌드 확인
Phase 3: 회전 링 오버레이 (시각만) → 빌드 확인
Phase 4: 회전 드래그 인터랙션 → 빌드 확인
Phase 5: SDF 회전 렌더링 (셰이더) → 빌드 확인
```

Phase 1~2가 핵심이고, Phase 3~5는 그 위에 쌓는 구조.

## 검증 계획

1. **Phase 1**: Director 모드에서 요소 선택 → 카메라 30도 이상 기울이면 파란 터널 가이드 표시, 정면에서는 숨김
2. **Phase 2**: Z키+드래그로 요소 Z 이동, 이동 시 터널 내에서 요소가 앞뒤로 이동하는 것 확인
3. **Phase 3**: 터널 위에 주황 회전 링 표시
4. **Phase 4**: 회전 링 드래그로 요소 Y축 회전
5. **Phase 5**: 회전된 요소가 SDF에서 올바르게 렌더링 (정면에서 돌아간 각도가 보임)

## 핵심 파일 참조

- 오버레이 프리미티브: `src/engine/overlay.ts` (drawLines3D, drawDiscScreen, projectToScreen)
- 오버레이 그리기: `src/rendering/overlayCommands.ts` (drawOverlay 함수)
- 히트 테스트: `src/interaction/hitTest.ts` (raycastElement, hitTestCorner)
- 드래그: `src/interaction/dragHandlers.ts` (handleDragMove)
- 포인터: `src/interaction/usePointerHandlers.ts` (handlePointerDown/Move/Up)
- 카메라 각도: `src/engine/controls.ts` (theta, phi — getAngles()로 접근)
- Director 상태: `src/store/useDirectorStore.ts` (directorMode)
- 요소 타입: `src/store/useElementStore.ts` (ChoanElement)
- SDF 셰이더: `src/engine/shaders.ts` (sceneSDF, rayMarch)
- 씬 UBO: `src/engine/scene.ts` (UBO 레이아웃, MAX_OBJECTS)
