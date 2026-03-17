# Choan SRP 리팩토링 플랜

> 컨텍스트 압축 발생 시 이 파일을 읽어 맥락 복원
> 각 단계 완료 시 해당 행을 `[x]`로 갱신하고 커밋

## 진행 상황

- [x] 단계 0: 기반 정비 (constants, 버그 수정, 타입 통합) ✓ 완료
- [x] 단계 1: 좌표 변환 통합 (`coords/coordinateSystem.ts`) ✓ 완료
- [ ] 단계 2: 스토어 분리 (useElementStore / useAnimationStore / useUIStore)
- [ ] 단계 3: 애니메이션 평가 순수 함수화 (animationEvaluator, autoKeyframe 디커플링)
- [ ] 단계 4: SDFCanvas 인터랙션 분리 (`interaction/` 디렉토리)
- [ ] 단계 5: rAF 루프 분리 (`rendering/` 디렉토리, window.__choanKF 제거)
- [ ] 단계 6: TimelinePanel 분리 (TimelineCanvas + TimelineSidebar)
- [ ] 단계 7: JSX 컴포넌트 분리 (CanvasToolbar, DragSelectBox, DistanceLabels)

---

## 목표 디렉토리 구조

```
src/
├── constants/
│   └── index.ts                   ← 매직 넘버 중앙화
├── coords/
│   └── coordinateSystem.ts        ← 3중 중복 좌표 변환 통합
├── interaction/
│   ├── types.ts                   ← PointerMode 유니온 타입
│   ├── useInteractionState.ts     ← 21개 ref → 구조화된 상태
│   ├── usePointerHandlers.ts      ← Down/Move/Up 조합 훅
│   ├── useKeyboardHandlers.ts     ← 단축키 로직
│   ├── hitTest.ts                 ← raycast, hitTestCorner
│   ├── dragHandlers.ts            ← group drag + containment
│   ├── resizeHandlers.ts
│   ├── drawHandlers.ts
│   ├── dragSelectHandlers.ts
│   ├── colorPicker.ts             ← 3중 중복 색상 픽커 통합
│   └── elementHelpers.ts          ← applyToSiblings, resolveGroup 등 순수 헬퍼
├── rendering/
│   ├── RenderContext.tsx          ← kfAnimator Context (window.__choanKF 대체)
│   ├── useAnimateLoop.ts          ← rAF 루프 훅
│   ├── overlayCommands.ts         ← 오버레이 드로우콜 빌더 (순수 함수)
│   ├── ghostPreview.ts            ← ghost element 계산 (순수 함수)
│   └── multiSelectTint.ts         ← 멀티셀렉트 색상 오버라이드 (순수 함수)
├── animation/
│   ├── types.ts                   ← EasingType 불일치 수정
│   ├── animationEvaluator.ts      ← scrub/ghost/spring 분기 순수 함수
│   ├── autoKeyframe.ts            ← 스토어 직접 참조 제거
│   └── (기존 파일들 유지)
├── store/
│   ├── useElementStore.ts         ← elements, selectedIds, CRUD
│   ├── useAnimationStore.ts       ← clips, bundles
│   ├── useUIStore.ts              ← tool, drawColor, loadFile
│   ├── useChoanStore.ts           ← 어댑터 (마이그레이션 기간 유지 후 제거)
│   ├── usePreviewStore.ts         ← 유지
│   └── useRenderSettings.ts       ← 유지
├── canvas/
│   ├── SDFCanvas.tsx              ← 훅 조합 + JSX만 (목표 150줄)
│   ├── CanvasToolbar.tsx          ← 툴 버튼 UI
│   ├── DragSelectBox.tsx          ← 드래그셀렉트 박스
│   └── DistanceLabels.tsx         ← Alt 거리 레이블
├── panels/
│   ├── TimelinePanel.tsx          ← thin wrapper (목표 200줄)
│   ├── TimelineCanvas.tsx         ← Canvas2D 렌더링만
│   ├── TimelineSidebar.tsx        ← DOM 사이드바만
│   └── (기타 유지)
└── engine/                        ← 기존 구조 유지
```

---

## 단계별 상세

### 단계 0: 기반 정비

**작업:**
1. `src/constants/index.ts` 생성
   - `HANDLE_HIT_RADIUS = 16`
   - `MIN_ELEMENT_SIZE = 10`
   - `MAX_OBJECTS = 128`
   - `GHOST_STEPS = 8` (SDFCanvas.tsx:983 버그 수정)
   - `GHOST_OPACITY_KEYFRAME = 1.0`, `GHOST_OPACITY_INBETWEEN = 0.5`
   - `SELECTION_COLOR: [number,number,number,number] = [0.26, 0.52, 0.96, 1]`
   - `SNAP_COLOR: [number,number,number,number] = [0.0, 0.82, 0.82, 1]`
   - `DISTANCE_COLOR: [number,number,number,number] = [0.97, 0.45, 0.09, 1]`
   - `MULTI_SELECT_TINT = 0xff2222`
   - `MULTI_SELECT_OPACITY = 0.8`
   - `FRUSTUM = 10` (engine/scene.ts와 통합)
   - `COLOR_PICKER_RING_BASE = 48`, `COLOR_PICKER_RING_STEP = 28`

2. `animation/types.ts` EasingType 불일치 수정
   - `AnimationClip.easing`을 `EasingType`과 통합
   - `resolveEasing()`도 일관되게 수정

3. `SDFCanvas.tsx:983` `GHOST_STEPS` 미정의 버그 수정
   - `constants/index.ts`의 `GHOST_STEPS` 상수 사용

**완료 기준:** `tsc --noEmit` 통과, ghost preview 정상 동작

---

### 단계 1: 좌표 변환 통합

**작업:**
1. `src/coords/coordinateSystem.ts` 생성
   - `pixelToWorld(px, py, canvasW, canvasH, frustum, aspect): WorldPoint`
   - `worldToPixel(wx, wy, canvasW, canvasH, frustum, aspect): PixelPoint`
   - (screenToPixel은 renderer 참조가 필요하므로 SDFCanvas 내 유지 또는 별도 처리)

2. `engine/scene.ts` 수정: `update()` 내 좌표 변환 → `coordinateSystem` 참조

3. `SDFCanvas.tsx` 수정: `worldToPixel`, `pixelToWorld` useCallback → `coordinateSystem` 래퍼로 교체, 렌더루프 내 인라인 `p2w` 클로저도 교체

**완료 기준:** 스냅·리사이즈·오버레이 좌표 정상 동작, 중복 수식 제거

---

### 단계 2: 스토어 분리

**작업:**
1. `store/useElementStore.ts`: elements, selectedIds + CRUD + 선택 + containment
2. `store/useAnimationStore.ts`: animationClips, animationBundles + clip/bundle CRUD
3. `store/useUIStore.ts`: tool, drawColor, elementCounters, loadFile, reset
4. `useChoanStore.ts` → 어댑터: 세 스토어 합산, 기존 인터페이스 유지
5. cross-store: `removeElement` 후 `useAnimationStore.cleanupForElement(id)` 연쇄

**완료 기준:** 모든 기존 호출 사이트 정상, 각 스토어 간 직접 import 없음

---

### 단계 3: 애니메이션 평가 순수 함수화

**작업:**
1. `animation/animationEvaluator.ts`: playing/scrub/spring 분기 + ghost 계산 → 순수 함수
2. `rendering/ghostPreview.ts`: ghost element 배열 생성 분리
3. `rendering/multiSelectTint.ts`: 멀티셀렉트 색상 오버라이드 분리
4. `animation/autoKeyframe.ts`: 스토어 직접 참조 제거, 파라미터로 수신

**완료 기준:** `animationEvaluator.ts`가 store를 import하지 않음, 키프레임 플레이백 정상

---

### 단계 4: SDFCanvas 인터랙션 분리

**작업:**
1. `interaction/types.ts`: `PointerMode` 유니온 타입
2. `interaction/elementHelpers.ts`: `applyToSiblings`, `resolveGroup`, `collectDescendants` 등
3. `interaction/hitTest.ts`: `raycastElement`, `hitTestCorner`
4. `interaction/colorPicker.ts`: 3중 중복 히트 테스트 + 렌더 데이터
5. `interaction/dragHandlers.ts`, `resizeHandlers.ts`, `drawHandlers.ts`, `dragSelectHandlers.ts`
6. `interaction/usePointerHandlers.ts`: 위 핸들러 조합
7. `interaction/useKeyboardHandlers.ts`: 단축키
8. `SDFCanvas.tsx`: 훅 조합으로 교체

**완료 기준:** SDFCanvas.tsx 300줄 이하, 각 interaction/ 파일 100줄 이하

---

### 단계 5: rAF 루프 분리

**작업:**
1. `rendering/RenderContext.tsx`: kfAnimator Context (`window.__choanKF` 제거)
2. `rendering/overlayCommands.ts`: 오버레이 드로우콜 빌더 순수 함수
3. `rendering/useAnimateLoop.ts`: rAF 루프 훅
4. `SDFCanvas.tsx` useEffect: init/cleanup만 유지

**완료 기준:** SDFCanvas useEffect가 렌더러 초기화만 담당, 렌더링 회귀 없음

---

### 단계 6: TimelinePanel 분리

**작업:**
1. `panels/TimelineCanvas.tsx`: Canvas2D 엔진 + 포인터 이벤트
2. `panels/TimelineSidebar.tsx`: DOM 사이드바
3. `TimelinePanel.tsx`: thin wrapper (번들 탭, 재생 컨트롤, 상태만)
4. 유틸 이동: `buildLayerTree` 등 → `animation/` 모듈

**완료 기준:** TimelinePanel.tsx 200줄 이하, 타임라인 전체 기능 정상

---

### 단계 7: JSX 컴포넌트 분리

**작업:**
1. `canvas/CanvasToolbar.tsx`: 툴 버튼 + 색상 스와치
2. `canvas/DragSelectBox.tsx`: 드래그셀렉트 박스 div
3. `canvas/DistanceLabels.tsx`: Alt 거리 레이블

**완료 기준:** SDFCanvas.tsx 150줄 이하

---

## 위험 요소 & 대응

| 위험 | 대응 |
|------|------|
| closure stale (단계 4) | 핸들러 내부 `getState()` 패턴 일관 적용 |
| cross-store 트랜잭션 (단계 2) | cleanupForElement 연쇄 호출 패턴 |
| rAF에서 interactionRefs 접근 (단계 5) | 읽기 전용 파라미터로 수신 |
| 빅뱅 교체 금지 | 단계별 `tsc --noEmit` + 앱 동작 확인 |
