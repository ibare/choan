# 초안 (Choan) — 설계 문서

> 현재 코드가 어떻게 만들어져 있는지(As-built)를 기술하는 공식 설계 문서다.
> 제안이나 계획이 아니라 **기준 커밋 시점에 실제로 동작하는 구조**만 적는다. 계획 단계의 문서는 [관련 문서](#03-관련-문서)를 본다.

---

## 0. 문서 정보

### 0.1 기준

| 항목 | 값 |
|------|----|
| 기준 브랜치 / 커밋 | `develop` / `858268e` (모션 패스 핸들 3D 기즈모 드래그 편집 구현) |
| 작성일 | 2026-10-16 |
| 코드 규모 | `src/` 약 28,000줄 (TS/TSX/CSS) |
| 타입 체크 | `tsc -b` 통과 |
| 테스트 | `vitest run` 204건 중 164건 통과, 40건 실패 — [14장](#14-테스트) 참고 |

### 0.2 표기 규칙

- 근거는 `파일 경로` + `함수/식별자` 단위로 적는다. 줄 번호는 금방 바뀌므로 쓰지 않는다.
- "미연결"은 코드는 있지만 앱 실행 경로에서 호출되지 않는다는 뜻이다.
- "legacy"는 이전 모델과의 호환을 위해 남아 있는 코드다.

### 0.3 관련 문서

| 문서 | 성격 | 상태 |
|------|------|------|
| `README.md` | 사용자용 기능 소개(영문) | 일부 내용이 코드와 다름 — [부록 A](#부록-a-readme와-코드의-차이) |
| `docs/choan-expansion-design.md` | 멀티씬 / Subdivision / 카메라+Export 확장 제안서 | 일부만 구현 — [17장](#17-확장-제안-대비-구현-현황) |
| `docs/plan-z-tunnel-gizmo.md` | Z 터널 가이드 + 회전 링 구현 계획 | 구현 완료(계획과 차이 있음) |
| `tasks/plan-motion-path.md` | 모션 패스 구현 계획 (Phase 0~4) | 구현 완료 |
| `REFACTOR_PLAN.md` | SRP 리팩터링 계획 (단계 0~7) | 완료 |
| `rules/INDEX.yaml` 외 | 구현 규칙 (MUST / MUST NOT) | 현행 — [15장](#15-구현-규칙) |

### 0.4 갱신 규칙

- 모듈 경계, 데이터 모델, 프레임 파이프라인, 저장 포맷이 바뀌는 커밋은 이 문서의 해당 장을 함께 고친다.
- 고친 뒤 0.1의 기준 커밋과 작성일을 갱신한다.
- 16장의 이슈를 해결하면 항목을 지우지 말고 "해결(커밋)"으로 표시한 뒤 다음 갱신 때 정리한다.

---

## 1. 개요

### 1.1 제품 목적

Choan은 캔버스에 UI를 스케치하면 그것을 **LLM에 바로 붙여 넣을 수 있는 구조화된 Markdown 스펙**으로 바꿔 주는 브라우저 도구다. 스크린샷이나 장황한 설명 대신, 요소 트리·레이아웃·컴포넌트 상태·애니메이션을 정형화된 텍스트로 전달하는 것이 목표다.

시각적으로는 직접 만든 **WebGL2 SDF 레이마칭 렌더러**로 요소를 압출된 3D 형태 + 툰 셰이딩 + 균일한 외곽선으로 그린다. 이 비주얼이 Choan의 고유한 표현 언어다.

### 1.2 두 가지 작업 모드

| 모드 | UI 라벨 | 하는 일 |
|------|---------|---------|
| 스케치 모드 | `UI Sketch` | 요소 그리기, 스킨·레이아웃 지정, 번들 단위 키프레임 애니메이션, 트리거 연결, Markdown 내보내기 |
| 디렉터 모드 | `Director` | 3D 공간에 카메라를 배치하고 레일로 움직임을 정의, 카메라 클립과 이벤트 마커로 연출 타임라인 구성, WebM 영상 내보내기 |

모드는 타임라인 패널 헤더의 SegmentedControl(`TimelinePanel`)에서 바꾸며, 실제 상태는 `useDirectorStore.directorMode` 하나다.

### 1.3 설계 목표

1. **LLM 친화적 출력** — 반복 패턴을 접어서(`groupSiblings`) 짧고 정확한 스펙을 만든다.
2. **해상도 독립 렌더링** — 모든 형태를 SDF 수식으로 정의해 외곽선 두께와 모서리가 해상도와 무관하게 일정하다.
3. **개념 최소화** — 디렉터 모드는 키프레임 대신 "카메라 위치 + 바라보는 대상 + 레일"만으로 움직임을 정의한다.
4. **로컬 우선** — 서버 없이 브라우저 IndexedDB에 자동 저장한다.

### 1.4 비목표

- 실제 실행 가능한 UI 코드 생성 (플랫폼 힌트만 제공)
- 협업, 계정, 서버 저장
- 범용 3D 모델링 (요소는 압출된 사각형·원·선 세 종류뿐)

---

## 2. 시스템 구성

### 2.1 기술 스택

| 영역 | 기술 | 실사용 |
|------|------|--------|
| UI 프레임워크 | React 19 + TypeScript 5.9 (`strict`, `noUnusedLocals`) | 사용 |
| 빌드 / 테스트 | Vite 8 / Vitest 4 (`environment: 'node'`) | 사용 |
| 라우팅 | react-router-dom 7 (`HashRouter`) | 사용 |
| 상태 관리 | Zustand 5 | 사용 |
| 렌더링 | 자체 WebGL2 SDF 엔진 (`src/engine/`) | 사용 |
| UI 프리미티브 | Radix UI (`components/ui/` 래퍼 경유), CVA, clsx | 사용 |
| UI 모션 | framer-motion | `ContextToolbar` 한 곳 |
| 저장소 | idb (IndexedDB 래퍼) | 사용 |
| 아이콘 | Phosphor Icons (React 컴포넌트 + 엔진용 SVG path 586개) | 사용 |
| YAML | js-yaml | `export/toYaml.ts`만 사용, 이 모듈은 앱에서 호출되지 않음 |
| 상태 머신 | xstate, @xstate/react | **미사용** (의존성만 선언) |
| 손그림 | perfect-freehand | **미사용** (의존성만 선언) |

배포: `.github/workflows/deploy.yml`이 `main` 브랜치 푸시 시 `npm ci && npm run build` 후 GitHub Pages에 올린다. Vite `base`는 `/choan/`이다.

### 2.2 디렉터리와 계층

```
src/
├── engine/        WebGL2 렌더러, 셰이더, SDF/BVH, 카메라, OrbitControls, 텍스처 아틀라스,
│                  스킨 페인터, 오버레이 렌더러, Canvas2D 타임라인 엔진, 비디오 레코더
├── coords/        픽셀 ↔ 월드 좌표 변환 (단일 출처)
├── store/         Zustand 스토어, 멀티씬 타입, Undo/Redo, IndexedDB 영속화
├── animation/     키프레임 보간·easing·평가, 모션 패스, 디렉터 도메인 타입과 평가기
├── layout/        자동 레이아웃, 포함 판정, 스프링 레이아웃 애니메이터
├── interaction/   포인터/키보드 핸들러, 히트테스트, 핫키 레지스트리, 기즈모 드래그
├── rendering/     단일 rAF 루프(useAnimateLoop), 오버레이 드로우 커맨드, 디렉터 오버레이
├── canvas/        SDFCanvas 및 캔버스 위 React 오버레이(툴바, 라벨, 컬러 피커 등)
├── panels/        속성/레이어/타임라인/디렉터 타임라인/뷰파인더 등 편집 패널
├── components/    ui/ (Radix 래퍼), panels/ (MotionPathEditor, SkinEditor, KeyframeButton)
├── export/        Markdown 스펙 생성 (core → render → platforms), .choan YAML
├── config/        스킨 레지스트리, 머티리얼 팔레트
├── constants/     공용 상수
├── design-system/ 디자인 토큰(tokens.css), cn()
├── pages/         랜딩 / 앱 페이지
├── hooks/, utils/ 셀렉터 훅, 스냅·이름·nanoid·analytics 유틸
└── __tests__/     Vitest 테스트 (원본 디렉터리 구조 미러링)
```

의존 방향 규칙(`rules/principles.md` 원칙 2):

```
engine  →  store  →  interaction / rendering  →  canvas / panels / pages
(하위 계층은 상위 계층을 import 하지 않는다. engine 은 React·Zustand 에 의존하지 않는다.)
```

현재 `engine/`은 React와 Zustand를 런타임에 import하지 않는다. 단 `renderer.ts`, `scene.ts`, `sdf.ts`가 `store/`에서 **타입만** import한다(`ChoanElement`, `RenderSettings`). 런타임 의존은 없지만 타입 정의 위치가 계층과 맞지 않는다.

### 2.3 런타임 구성

```
main.tsx ── HashRouter
  ├─ "/"     LandingPage
  └─ "/app"  AppPage ── lazy(App) + Suspense
                 │
                 ▼
App.tsx  (마운트 시)  restoreLastProject() → initPersistence() → initHistory()
  │
  ├─ 패널(React) ──────── 액션 호출 ─────────────▶  Zustand 스토어
  │                                                (Element / Animation / UI / Preview /
  │                                                 Scene / Director / RenderSettings)
  ├─ SDFCanvas  (1회 생성, 언마운트 시 dispose)            ▲         │ subscribe
  │    ├─ createSDFRenderer ── WebGL2 컨텍스트(유일)       │         ▼
  │    ├─ createOrbitControls                       history.ts / persistence.ts
  │    ├─ createSceneManager(gl, quad)                (자동 스냅샷 / 자동 저장)
  │    ├─ usePointerHandlers / useKeyboardHandlers ──┘ (스토어 변경)
  │    └─ useAnimateLoop  ── 단일 rAF 루프
  │         매 프레임 getState() 로 스토어를 읽고
  │         평가 → updateScene → render → overlay
  │
  └─ rendererSingleton (rendering/rendererRef.ts)
       Viewfinder, TimelinePanel/DirectorTimelinePanel(비디오 내보내기)이 같은 렌더러를 빌려 쓴다.
```

핵심 원칙:

- **렌더러와 WebGL 컨텍스트는 하나다.** 메인 뷰, 뷰파인더, 영상 내보내기가 모두 같은 `SDFRenderer`를 쓴다(`rules/concerns/C2-shared-resources.md`).
- **rAF 루프는 `useAnimateLoop` 하나다.** 렌더 루프는 스토어를 React 구독이 아니라 `getState()` 폴링으로 읽는다. 따라서 렌더링은 React 리렌더와 독립적이다.
- 예외적으로 자체 rAF나 그리기 루프를 가진 곳: `NavigationGizmo`(2D 캔버스), `RailTimeLabels`(DOM 라벨), 두 타임라인 패널(이벤트 기반 Canvas2D 재그리기).

---

## 3. 좌표계와 단위

`coords/coordinateSystem.ts`가 단일 출처다.

| 공간 | 정의 |
|------|------|
| 요소 좌표(ref px) | 기준 해상도 `REF_W = 1920`, `REF_H = 1080`. 원점은 좌상단, Y는 아래로 증가. `ChoanElement.x/y/width/height`가 이 단위 |
| 월드 좌표 | `FRUSTUM = 10`, 종횡비 A = 16/9. X ∈ [−17.78, 17.78], Y ∈ [−10, 10], Y는 위로 증가. 1 world ≈ 54 ref px |
| Z | `ChoanElement.z`는 레이어 인덱스. 월드 Z = `z × extrudeDepth` |
| 압출 두께 | `useRenderSettings.extrudeDepth` (기본 0.15). `engine/scene.ts`의 `EXTRUDE_DEPTH = 0.05`는 인자 기본값일 뿐 실제로는 설정값이 전달된다 |
| 디렉터 카메라 | 월드 좌표를 직접 쓴다 (픽셀 아님) |

변환식:

```
wx = −F·A + (px / 1920) · 2F·A
wy =  F   − (py / 1080) · 2F
요소 중심 z      = el.z · ed
요소 앞면 z      = el.z · ed + ed/2      (기즈모·오버레이·모션 패스 핸들이 놓이는 평면)
```

- 캔버스 크기는 좌표계에 영향을 주지 않는다. 캔버스가 커지면 같은 월드를 더 넓게 볼 뿐이다(커밋 `c1d65f5`).
- 화면 → 레이: `engine/sdf.ts`의 `screenToRay`(DPR 반영, Y 반전). 레이-평면 교차는 `rayPlaneIntersect`, 레이-축 최근접점은 `rayAxisClosestT`.
- 뷰포트 카메라(`engine/camera.ts`): 기본 위치 (0, 0, 20), 수직 FOV 50°, near 0.1, far 1000.
- 디렉터 카메라 기본값: 위치 [0, 0, 18], 38mm, 16:9. 초점거리 → FOV는 `mmToFov(mm) = 2·atan(36 / (2·mm))`.

---

## 4. 도메인 모델

### 4.1 관계도

```
ProjectRecord (IndexedDB 1건 = 프로젝트 1개)
 └─ scenes: Scene[]                    (order 순)
     ├─ elements: ChoanElement[]       (parentId 로 트리 구성)
     │    └─ triggers: ElementTrigger[] ──▶ AnimationBundle.id
     ├─ animationBundles: AnimationBundle[]
     │    └─ clips: AnimationClip[]    (요소당 1개)
     │         ├─ tracks: KeyframeTrack[] ─ keyframes: Keyframe[]
     │         └─ motionPath?: ElementMotionPath (line | orbit)
     └─ directorTimeline?: DirectorTimeline
          ├─ cameras: DirectorCamera[]          ── setup: DirectorCameraSetup
          ├─ cameraClips: CameraClip[]          ── cameraId, cameraSetup(스냅샷), lane
          ├─ eventMarkers: EventMarker[]        ── bundleId ──▶ AnimationBundle.id
          └─ (legacy) cameraMarks, cameraKeyframes, axisMarks, cameraSetup
```

### 4.2 요소 — `ChoanElement` (`store/useElementStore.ts`)

```ts
interface ChoanElement {
  id: string
  type: 'rectangle' | 'circle' | 'line'
  label: string
  role?: 'container'                 // 사각형을 그리면 자동으로 container
  x: number; y: number; z: number    // ref px, z = 레이어 인덱스
  width: number; height: number
  color?: number                     // 0xRRGGBB, 없으면 팔레트 순번 색
  radius?: number                    // 0–1 비율 (rectangle)
  opacity?: number                   // 렌더 힌트
  lineStyle?; lineDirection?; hasArrow?   // line 전용 (현재 렌더러는 미반영)
  parentId?: string
  // 컨테이너 레이아웃
  layoutDirection?: 'free' | 'row' | 'column' | 'grid'
  layoutGap?; layoutPadding?; layoutColumns?
  layoutSizing?: 'equal' | 'fill' | 'fixed-ratio' | 'fixed-px'   // 자식 쪽 설정
  layoutRatio?
  // 프레임·스킨
  frame?: 'browser' | 'mobile'; safeInset?: { top; bottom; left; right }
  skin?: string; skinOnly?: boolean; frameless?: boolean
  componentState?: Record<string, unknown>
  triggers?: ElementTrigger[]        // { event: 'click' | 'hover', animationBundleId }
  rotationY?: number                 // 라디안, 디렉터 모드 회전 링으로 편집
}
```

- 프레임 기본 safeInset: browser `{ top: 14 }`, mobile `{ top: 20, bottom: 10 }`.
- 스킨은 `config/skins.ts`의 `SKIN_REGISTRY`에 정의된 16종이다(목록 첫 항목 `''`는 "스킨 없음"). 엔진 페인터는 여기에 `browser-frame`, `mobile-frame`을 더해 18종이다.
- `skinOnly`는 SDF 몸체 없이 스킨 텍스처 평면만 그린다. `frameless`는 컨테이너 배경을 숨긴다. 둘 다 렌더러에서 같은 "평면 경로"로 처리된다.

### 4.3 애니메이션 (`animation/types.ts`, `animation/motionPathTypes.ts`)

```ts
type AnimatableProperty = 'x' | 'y' | 'z' | 'width' | 'height' | 'color' | 'radius'
type EasingType = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'

interface Keyframe       { time: number; value: number; easing?: EasingType }  // easing = 다음 키프레임까지
interface KeyframeTrack  { property: AnimatableProperty; keyframes: Keyframe[] }
interface AnimationClip  { id; elementId; duration; easing; tracks: KeyframeTrack[]
                           motionPath?: ElementMotionPath }
interface AnimationBundle { id; name; clips: AnimationClip[] }

type ElementMotionPath = LinePath | OrbitPath
interface MotionPathBase { duration?; easing; loop; reverse; originMode: 'relative' | 'absolute' }
interface LinePath  extends MotionPathBase { type: 'line';  p0: Vec3; p1: Vec3 }
interface OrbitPath extends MotionPathBase { type: 'orbit'; center: Vec3; radiusU; radiusV
                                             planeNormal: Vec3; startAngle; sweepAngle; clockwise }
```

- 번들은 "하나의 인터랙션에 반응하는 요소별 클립 묶음"이다. 트리거와 디렉터 이벤트 마커가 번들 단위로 참조한다.
- 모션 패스의 Vec3는 요소와 같은 단위다: x, y는 ref px, z는 레이어 유닛.
- `useAnimationStore.animationClips`(번들 밖 클립)는 legacy 필드다. 씬 로드 시 항상 빈 배열이 된다.

### 4.4 씬 (`store/sceneTypes.ts`)

```ts
interface Scene {
  id; name; order
  elements: ChoanElement[]
  animationBundles: AnimationBundle[]
  duration: number                      // ms, 기본 3000
  transitionOut?: { type: 'fade'; duration; easing }
  directorTimeline?: DirectorTimeline
}
```

### 4.5 디렉터 (`animation/directorTypes.ts`)

```ts
interface RailExtents {
  neg: number; pos: number                 // anchor 기준 음/양 방향 확장량 (최소 RAIL_MIN_STUB = 0.5)
  startTime: number; endTime: number       // 클립 로컬 ms. start > end 이면 역방향
  easing?: EasingType
}
interface DirectorRails {
  truck: RailExtents; boom: RailExtents; dolly: RailExtents     // X / Y / Z
  truckMode: 'linear' | 'circular'; boomMode: 'linear' | 'circular'   // dolly 는 직선 전용
}
interface DirectorCameraSetup {
  cameraPos: Vec3; targetPos: Vec3
  targetMode: 'fixed' | 'locked'
  rails: DirectorRails
  railWorldAnchor: Vec3                     // 레일이 붙는 월드 기준점
  targetAttachedTo: string | null           // 타겟을 붙인 요소 id
}
interface DirectorCamera { id; name; setup: DirectorCameraSetup; focalLengthMm; viewfinderAspect }
interface CameraClip {
  id; name; cameraId
  timelineStart: number; duration: number   // ms, 기본 3000
  cameraSetup: DirectorCameraSetup          // 생성 시점 리그의 깊은 복사본
  focalLengthMm: number
  lane?: number                             // 생략 시 0
}
interface EventMarker { id; time; bundleId; durationOverride?; lane? }
```

- 축이 "애니메이션된다"는 조건(`isRailAnimated`): stub보다 확장됨 **그리고** `startTime ≠ endTime`.
- `CameraClip.cameraSetup`은 스냅샷이다. 클립을 만든 뒤 카메라 리그를 바꿔도 기존 클립은 영향받지 않는다.
- 불변식: 카메라 클립이 하나라도 있으면 **타임라인 0ms는 반드시 어떤 클립이 덮는다** (`hasZeroCoverage`; 클립 삭제·이동·배치 갱신에서 강제).
- legacy 모델(`AxisMark`, `CameraMark`, `CameraViewKeyframe`, 단일 `cameraSetup`)은 디렉터 모드 진입 시 `migrateDirectorTimeline`이 현 모델로 옮긴다.

### 4.6 프로젝트 레코드 (`store/persistence.ts`)

```ts
interface ProjectRecord { id; name; createdAt; updatedAt; scenes: Scene[]; activeSceneId }
```

---

## 5. 상태 관리

### 5.1 스토어 목록

| 스토어 | 파일 | 소유 상태 | 저장 여부 |
|--------|------|-----------|-----------|
| Element | `useElementStore.ts` | `elements`, `selectedIds` | 씬을 통해 저장 |
| Animation | `useAnimationStore.ts` | `animationBundles`, legacy `animationClips` | 씬을 통해 저장 |
| UI | `useUIStore.ts` | `tool`, `drawColor`, `pendingSkin`, `pendingFrame` | 일시 |
| Preview | `usePreviewStore.ts` | `previewState`, `playheadTime`, `editingBundleId`, `ghostPreview`, `scrubHeldIds` | 일시 |
| Scene | `useSceneStore.ts` | `scenes`, `activeSceneId`, `transitionState` | **저장 원본** |
| Director | `useDirectorStore.ts` | 디렉터 모드·재생·선택·리그 편집 버퍼 | 리그는 씬의 `directorTimeline`에 반영 |
| RenderSettings | `useRenderSettings.ts` | 툰 셰이딩·외곽선·배경·압출·스프링 파라미터 | 일시 (저장 안 함) |

### 5.2 의존 방향과 크로스 스토어 작업

```
Element  Animation  UI  Preview  RenderSettings     ← 서로 import 하지 않음
    ▲        ▲
    └────────┴──── useChoanStore (파사드 + 크로스 스토어 함수)
                        │ injectSceneCallbacks(loadSceneIntoStores, syncActiveToScenes)
                        ▼
                    Scene  ◀──── Director (updateActiveSceneDirectorTimeline 으로 직접 수정)
                        ▲
history.ts / persistence.ts  (Element·Animation·Scene 구독)
```

- `useSceneStore`는 다른 스토어를 import하지 않는다. 대신 파사드가 **콜백을 주입**해 "씬 데이터를 스토어로 로드"와 "스토어 내용을 씬으로 동기화"를 수행하게 한다.
- 2개 이상 스토어를 동시에 바꾸는 작업은 `useChoanStore.ts`의 모듈 함수로 둔다(`rules/specifics/S-store.md`): `removeElement`(요소 + 클립 정리), `removeAnimationBundle`(번들 + 트리거 정리), `loadFile`, `reset`, `loadSceneIntoStores`, `syncActiveToScenes`.
- `useChoanStore()` 훅은 이전 단일 스토어와의 호환 어댑터다. 셀렉터 없이 4개 스토어를 구독하므로 이 훅을 쓰는 컴포넌트는 어느 스토어가 바뀌어도 리렌더된다. 새 코드는 하위 스토어를 셀렉터로 직접 구독한다(`useSelectedElement` 등).

### 5.3 멀티씬: "라이브 스토어 + 씬 스냅샷" 모델

활성 씬의 **실제 편집 원본은 Element/Animation 스토어**이고, `scenes[]` 배열의 활성 씬 항목은 동기화 시점에만 갱신되는 사본이다.

```
            syncActiveToScenes()                      loadSceneIntoStores(scene)
Element/Animation 스토어 ───────────▶ scenes[active]   scenes[target] ───────────▶ Element/Animation 스토어
                                        │                                     (loadElements 가 컨테이너
   호출 시점: 씬 전환·추가·복제 직전,      │                                       레이아웃을 재적용, 선택 해제)
   history 스냅샷 직전, 자동 저장 직전     ▼
                                    IndexedDB / Undo 스냅샷
```

- 씬 전환(`setActiveScene`): 현재 씬 동기화 → `activeSceneId` 변경 → 대상 씬 로드.
- 씬별로 분리되는 것: 요소, 번들, 디렉터 타임라인. UI/Preview/Director/RenderSettings의 일시 상태는 씬과 무관하게 유지된다.
- `directorTimeline`은 씬 객체 안에 직접 저장되므로 load/sync 대상이 아니다. `useDirectorStore`가 `updateActiveSceneDirectorTimeline`으로 직접 고친다.
- 씬 탭(`SceneTabBar`)은 클릭 전환·추가·삭제·이름 변경을 지원한다. 복제·순서 변경·길이·전환 효과 UI는 없다.

### 5.4 Undo / Redo (`store/history.ts`)

- 스냅샷 = `JSON.stringify({ scenes, activeSceneId })`. 찍기 직전에 `syncActiveSceneData()`를 호출하므로 디렉터 타임라인까지 포함된다.
- 최대 50개, 직전과 같은 문자열이면 건너뛴다. Undo 상태에서 새 스냅샷을 넣으면 Redo 기록을 잘라낸다.
- 스냅샷을 만드는 두 경로:
  1. **명시적** `pushSnapshot()` — 포인터업 시점(그리기·리사이즈·드래그·모션 패스 핸들·회전·축 드래그·키프레임), 삭제/붙여넣기, 선택 프레이밍 등.
  2. **자동** — Element/Animation/Scene 구독 + 500ms 디바운스.
- **현재 동작상 2번은 사실상 발생하지 않는다.** 자동 저장 루프가 300ms마다 Scene 스토어를 갱신해 디바운스를 계속 미루기 때문이다([16장 D1·D2](#161-결함)). 실질적으로 Undo 지점은 1번 경로에서만 생긴다.
- 복원: `loadScenes`로 전체 씬을 되돌리고, 다음 rAF까지 `isRestoring` 플래그로 재스냅샷을 막는다.
- 카메라 바디·타겟·레일 핸들 드래그는 `pushSnapshot`을 호출하지 않는다.

### 5.5 영속화 (`store/persistence.ts`)

| 항목 | 값 |
|------|----|
| DB | `choan-db`, 버전 1 |
| object store | `projects` (keyPath `id`), `meta` (out-of-line key) |
| meta 키 | `lastOpenedProjectId` |
| 자동 저장 | Element/Animation/Scene 구독 → 300ms 디바운스 → `syncActiveSceneData()` → `saveProject` |
| 시작 | `restoreLastProject()`: 마지막 프로젝트를 읽어 `loadScenes`. 없으면 새 id + `Untitled` |

- 저장 데이터의 스키마 마이그레이션은 없다(DB `upgrade`는 object store 생성만 한다). 디렉터 타임라인만 디렉터 모드 진입 시 지연 마이그레이션된다.
- `listProjects`, `deleteProject`, `setCurrentProject`가 있지만 이를 쓰는 UI가 없다. 현재는 **단일 프로젝트**만 사용한다.
- 디렉터 리그 편집 버퍼는 `useDirectorStore` 모듈 수준 구독이 300ms 디바운스로 `saveCameraSetup`을 불러 씬에 반영한다.

---

## 6. 프레임 파이프라인 (`rendering/useAnimateLoop.ts`)

`SDFCanvas`가 마운트될 때 한 번 시작되는 단일 rAF 루프다. 마운트 시 `kfAnimator.onComplete`를 스토어 갱신에 연결하고, 레이아웃 애니메이터를 만들고, 디렉터 단축키(Q/F)를 등록한다.

매 프레임 순서:

| # | 단계 | 내용 |
|---|------|------|
| 1 | 가드 | 다음 rAF 예약. 렌더러가 없거나 `useDirectorStore.exporting`이면 종료(디렉터 영상 내보내기가 캔버스를 점유) |
| 2 | 컨트롤 | `controls.update()` (OrbitControls 감쇠·애니메이션) |
| 3 | 스토어 읽기 | `useChoanStore.getState()`, `usePreviewStore.getState()`, `useRenderSettings.getState()` |
| 4 | 디렉터 재생 | 재생 중이면 경과 시간으로 플레이헤드 갱신, 총 길이 = 클립 끝 최댓값(없으면 `scene.duration`). `evaluateDirectorEvents`로 활성 번들 계산. 재생 중 OrbitControls 비활성 |
| 5 | 조작 중 요소 | 드래그·리사이즈·그리기 중인 요소 id 수집(스프링 보간에서 제외) |
| 6 | 애니메이션 평가 | `evaluateAnimation(...)` — [8.2](#82-평가-모드-animationevaluatorts) |
| 7 | 고스트 | 번들 편집 + 정지 + 고스트 토글이면 `addGhostElements`로 반투명 복제본 추가 |
| 8 | 텍스처 아틀라스 | 스킨/프레임 요소의 키를 비교해 바뀌었으면 아틀라스 재빌드. 재생 중인 image 스킨은 해당 영역을 다시 그림 |
| 9 | Export 연출 | "Speak LLM" 병합 연출(`animation/exportAnimation.ts`) 진행 → smooth union 계수 계산 |
| 10 | 씬 업로드 | `renderer.updateScene(applyMultiSelectTint(elements), extrudeDepth, hoveredColor)` |
| 11 | 디렉터 마스크 준비 | Q 스포트라이트가 켜져 있으면 디렉터 카메라 viewProj 계산 |
| 12 | 렌더 | 씬 전환 / FrustumMask / 일반 `render` 중 하나 ([7.2](#72-렌더-패스)) |
| 13 | 오버레이 | `drawOverlay`(선택·핸들·스냅·거리·컬러휠·분할선) → 모션 패스 → 디렉터 오버레이(그리드, Z 터널, 회전 링, 카메라별 frustum·레일·footprint·축 핸들) |
| 13a | 타겟 부착 | 디렉터 오버레이 단계 도중, 타겟이 요소에 붙어 있으면 요소 앞면 중심으로 `setDirectorTargetPos` |

---

## 7. 렌더링 엔진

### 7.1 구성 요소

| 모듈 | 역할 |
|------|------|
| `engine/gl.ts` | WebGL2 컨텍스트 생성(`antialias:false, alpha:false, depth:false, preserveDrawingBuffer:true`), 셰이더 컴파일/링크(실패 시 throw) |
| `engine/renderer.ts` | `createSDFRenderer` — 패스 실행, 리사이즈, 씬 업로드, 뷰파인더 렌더, dispose |
| `engine/shaders.ts` | 레이마칭·엣지·전환 셰이더 소스, `SceneData` UBO 정의 |
| `engine/scene.ts` | `ChoanElement[]` → UBO 데이터 변환, 색 변경 pulse/flash, 색 hover 글로우 상태 |
| `engine/fbo.ts` | GBuffer(MRT)와 단순 FBO |
| `engine/sdf.ts`, `engine/bvh.ts` | CPU 레이마칭 히트테스트와 BVH |
| `engine/textureAtlas.ts`, `engine/painters.ts`, `engine/iconPaths.ts` | Canvas2D 스킨 페인터 → 4096² 텍스처 아틀라스 |
| `engine/overlay.ts`, `engine/overlayShaders.ts` | 즉시 모드 오버레이(3D 라인, 화면 공간 디스크/사각형) |
| `engine/dofShaders.ts` | FrustumMask(사용) / DoF(미연결) 후처리 |
| `engine/sceneManager.ts` | 씬 전환 fade (미연결) |
| `engine/camera.ts`, `engine/controls.ts` | 원근 카메라, OrbitControls |
| `engine/videoExporter.ts` | MediaRecorder 기반 WebM 녹화 |
| `engine/timeline2d*.ts` | 번들 타임라인용 Canvas2D 엔진 |

### 7.2 렌더 패스

```
updateScene(elements)
  ├─ 일반 요소 / 평면 요소(skinOnly·frameless) 분리
  ├─ 일반 요소 월드 AABB 로 BVH 구축 → bvhData (CPU 히트테스트용)
  └─ UBO(SceneData, binding 0) 업로드 + 아틀라스 texRect 수집
        │
        ▼
[Pass 1] Geometry → GBuffer (SS 해상도)
   레이마칭 128 step, MAX_DIST 500, EPS 0.001
   RT0 RGBA8   : 툰 셰이딩 색 + opacity
   RT1 RGBA16F : 월드 노멀 xyz + objectId(w)       (배경 −1)
   RT2 R16F    : 선형 깊이 t/500                    (배경 1.0)
   평면 요소(skinOnly)는 같은 패스에서 앞면 평면 교차로 합성
        │
        ▼
[Pass 2] Edge + Composite → resolveFB (RGBA8, SS 해상도)
   RT1 에 Roberts Cross: objectId 차이(전 픽셀) + 노멀 차이(객체 픽셀)
   mix(배경색, 색, opacity) → 외곽선 색 합성
        │
        ├── (디렉터 모드 · 비재생 · 카메라 선택 · Q 토글) FrustumMask → dofFB
        ▼
[Blit] blitFramebuffer(LINEAR) → 기본 프레임버퍼 (SS → 네이티브 다운샘플)
        ▼
[Overlay] 기본 프레임버퍼에 즉시 모드 드로우 (DEPTH_TEST 끔, 알파 블렌드)
```

- **슈퍼샘플링 배율**: `dpr ≥ 2`면 1배, 아니면 2배. GBuffer 크기 = `round(css × dpr) × ss`.
- **리사이즈 지연 적용**: 크기 변경은 pending으로 두었다가 다음 프레임 시작 시 `applyPendingResize`에서 적용한다(그리기 직후 버퍼 초기화 방지).
- **반투명**: opacity는 배경색과만 섞인다. 뒤에 있는 다른 객체가 비치지 않는다.
- 깊이 RT2는 Edge 패스에서 쓰지 않고 FrustumMask의 월드 좌표 복원에 쓴다.

### 7.3 씬 데이터 UBO

```glsl
layout(std140) uniform SceneData {
  vec4 uNumObjPad;        // x = 객체 수, z = 일반 객체 수
  vec4 uPosType[128];     // xyz = 월드 중심(+hover z 오프셋), w = 형태(0 rect, 1 circle, 2 line)
  vec4 uSizeRadius[128];  // 반폭, 반높이, 반두께(ed/2), radius 비율
  vec4 uColorAlpha[128];  // rgb, opacity
  vec4 uEffect[128];      // pulse, flash, glow, skinOnly 플래그
  vec4 uTexRect[128];     // 아틀라스 UV offset(xy), size(zw)
  vec4 uExtra[128];       // x = rotationY
};
```

- 크기 12,304 B. WebGL2 최소 보장 UBO 크기(16,384 B) 안에 들어간다. 128개 기준으로 vec4 배열을 하나 더 넣을 여유는 있지만 둘은 없다.
- **요소 수 상한은 128개**(`MAX_OBJECTS`, `shaders.ts`와 `scene.ts` 두 곳에 정의). 초과분은 아무 표시 없이 잘린다. 고스트 미리보기 복제본도 이 예산을 함께 쓴다.
- UBO 순서는 [일반 요소(BVH 리프 순서)] → [평면 요소]다.

### 7.4 SDF와 셰이딩

| 형태 | SDF |
|------|-----|
| rectangle | `sdExtrudedRoundRect` — XY 라운드 사각형을 Z로 압출, r = `radius × min(반폭, 반높이)` |
| circle | 같은 함수, r = `min(반폭, 반높이)` (정사각형일 때만 원, 아니면 stadium) |
| line | 로컬 X축 구간의 `sdCapsule`, 반지름 = 반높이 |

- **합성**: 기본은 hard union. 요소를 선형으로 돌며 XY AABB 거리로 조기 건너뛰기한다(GPU는 BVH를 순회하지 않는다). "Speak LLM" 연출 중에만 smooth union(`smin` + 색 지수 가중 블렌드).
- **회전**: `uExtra.x`(rotationY)로 로컬 좌표를 Y축 회전.
- **노멀**: 맞은 객체 하나만 4-tap 테트라헤드론(`singleSDFWithPulse`)으로 계산해 O(1). smooth union 모드에서는 전체 SDF로 계산.
- **툰 셰이딩**: 측면(|n.z| 작음) 어둡게 → NdotL 2단(밝음/그림자, fwidth 기반 smoothstep) → 그림자 색 = `surf × shadowMul + warmTone`.
- **효과**:
  - pulse — 색이 바뀌면 300ms 동안 SDF를 살짝 부풀림
  - flash — 같은 시점에 흰색으로 섞음
  - glow — 색 히스토리 팔레트 hover 시 같은 색 요소에 림 발광 + z 앞으로, 다른 색 요소는 뒤로 + 흐리게
  - 텍스처 — 앞면에 아틀라스 스킨을 알파 합성
- pulse/flash/hover 강도 상태는 `scene.ts` 모듈 전역이며 벽시계(`performance.now()`) 기준이다.

### 7.5 CPU 히트테스트

```
raycastElement (interaction/hitTest.ts)
  screenToRay → cpuRayMarch(BVH 순회, 128 step, EPS 0.005) → cpuSkinOnlyHit(더 가까운 평면 우선)
```

- BVH(`engine/bvh.ts`): 암묵적 힙, 리프 수 `nextPow2(n)`, 최대 256 노드, 가장 긴 축 기준 중앙 분할. 매 프레임 `updateScene`에서 재구축.
- CPU 쪽은 rotationY, pulse 팽창, hover z 이동, smooth union을 반영하지 않는다. 시각과 판정이 미세하게 어긋날 수 있다.

### 7.6 텍스처 아틀라스와 스킨

- 4096 × 4096 RGBA8, shelf 패킹, 여백 1px. 가득 차면 해당 요소는 텍스처 없이 그린다.
- 키 = `skinKey : W×H : 외곽선색 : 외곽선폭 : 요소색 : 상태해시`. 키가 같은 요소끼리 영역을 공유한다.
- **요소 하나라도 키가 바뀌거나 사라지면 아틀라스 전체를 지우고 다시 그린 뒤 전체를 `texImage2D`로 업로드한다.**
- 텍스처 배율: 프레임 요소는 2, 그 외는 DPR.
- 페인터(`painters.ts`) 시그니처: `(ctx, w, h, state, stroke, time?)`. 아이콘 스킨은 `iconPaths.ts`의 Phosphor path를 `Path2D`로 그린다.

### 7.7 렌더 타깃 활용

| 용도 | 방식 |
|------|------|
| 메인 뷰 | `render(rs)` → 기본 프레임버퍼 |
| 뷰파인더 | `renderViewfinderFrame(pose, w, h)` — 전용 `vfCamera`, `vfGBuffer`, `vfResolveFB`로 같은 파이프라인 실행(커밋 `8c179cd`). `blitViewfinderToCtx`가 `readPixels` → Y 반전 → 2D 캔버스로 복사 |
| 디렉터 영상 | `renderViewfinderFrame` → `blitViewfinderToMainCanvas` → `captureStream` |
| FrustumMask | Q 토글 시 Pass 2 결과에 디렉터 카메라 frustum 마스크 적용 |
| 씬 전환 | `sceneManager.renderTransition` — **미연결** ([16.2](#162-미연결미사용-코드)) |
| DoF | `applyDoF` — **미연결** |

- 뷰파인더는 UBO·아틀라스·셰이더를 메인과 공유한다. 호출하는 쪽이 직전에 `updateScene`을 불러야 하며, 그 결과 다음 메인 프레임 전까지 공유 `bvhData`가 바뀐다.

### 7.8 렌더 설정 (`store/useRenderSettings.ts`)

| 분류 | 항목 (기본값) |
|------|---------------|
| 툰 셰이딩 | `lightDir` [0.8, 0.6, 0.35], `shadowMul` 0.52, `warmTone` [0.05, 0.02, 0], `sideDarken` 0.72, `sideSmooth` [0.3, 0.7] |
| 외곽선 | `outlineWidth` 4.0 (SS 텍셀), `edgeColor` 회색 0.133, `normalEdgeThreshold` [0.3, 0.6], `idEdgeThreshold` [0.1, 0.6] |
| 전역 | `bgColor` #F7F3EE, `extrudeDepth` 0.15 |
| 레이아웃 스프링 | `springStiffness` 0.15, `springDamping` 0.75, `squashIntensity` 1.75 |

`RenderSettingsPanel`이 캔버스 위 오버레이로 슬라이더를 제공한다. 렌더 루프는 구독하지 않고 매 프레임 `getState()`로 읽는다.

---

## 8. 애니메이션 (스케치 모드)

### 8.1 구성

| 모듈 | 역할 |
|------|------|
| `animation/interpolate.ts` | 트랙 구간 탐색 + 보간. 키프레임 easing 우선, 없으면 클립 easing. 색은 RGB 채널별, radius 0–1·크기 ≥ 1 클램프 |
| `animation/easing.ts` | cubic-bezier(Newton → 이분법), spring(감쇠 진동, t=1 정규화), 알 수 없는 이름은 ease-in-out |
| `animation/motionPathEvaluator.ts` | line/orbit 경로 평가. duration 없으면 클립 duration, loop = 모듈로, reverse = 1−t, orbit 은 법선으로 정규직교 기저 생성 |
| `animation/propagateDelta.ts` | 오버라이드된 요소의 x/y/z 변화량을 자손에게 재귀 누적 |
| `animation/animationEvaluator.ts` | 프레임별 평가 진입점 (순수 함수, 스토어 미참조) |
| `animation/keyframeEngine.ts` | 트리거 재생용 런타임 엔진 (`rendering/kfAnimator.ts` 싱글턴) |
| `animation/addKeyframe.ts` | 플레이헤드 위치에 키프레임 토글(10ms 이내 병합, 클립 자동 생성) |

### 8.2 평가 모드 (`animationEvaluator.ts`)

위에서부터 먼저 맞는 분기 하나만 적용한다.

```
evaluateAnimation
 ├─ ① 디렉터 활성 번들 있음      → evaluateBundles(활성 번들, 로컬 시간) + 부모 delta 전파
 ├─ ② previewState = playing    → kfAnimator.tick()  (트리거로 시작된 클립 재생)
 ├─ ③ 번들 편집 중 + stopped     → 스크럽: 번들 클립을 playheadTime 으로 평가
 │                                 → propagateParentDelta → 조작 중/hold 요소 제외
 │                                 → 나머지에 레이아웃 스프링 적용
 └─ ④ 편집                       → 레이아웃 스프링 애니메이터만
```

클립 하나의 평가 순서:

```
tracks → patch(x, y, z, width, height, color, radius)
motionPath 있으면:
   absolute → x, y, z 를 경로 값으로 교체
   relative → (트랙 값, 없으면 요소 현재 값) + 경로 값
같은 요소에 여러 클립이 쓰면 마지막 값이 이긴다
```

### 8.3 재생과 트리거

- 타임라인 **Play**는 현재 요소 상태를 스냅샷으로 저장하고 `previewState = 'playing'`으로 바꾸는 "트리거 반응 프리뷰 모드"다. 클립을 실제로 시작시키는 것은 캔버스의 **click 트리거**다(`usePointerHandlers` pointerDown).
- 클립이 끝나면 `onComplete`가 최종값을 `updateElement`로 스토어에 반영한다. **Stop**은 저장해 둔 스냅샷으로 되돌린다.
- `hover` 트리거는 타입과 UI에만 있고 실행 경로가 없다.
- 키프레임 재생 엔진은 `motionPath`를 적용하지 않는다. 모션 패스는 스크럽과 디렉터 이벤트 재생에서만 보인다([16.1 D8](#161-결함)).

### 8.4 키프레임 작성

- `KeyframeButton`(다이아몬드)이 `toggleKeyframeAtPlayhead`를 부른다. `GeometrySection`에서 radius, z, x, y에 붙어 있다.
- 타임라인 캔버스(`TimelineCanvas`)에서 키프레임 이동·값 편집(`KfValueEditor`)·easing(`EasingPopover`)을 한다.
- 편집 중 사용자가 직접 조작한 요소는 `holdScrub`으로 스크럽 오버라이드에서 제외되어, 조작 결과가 즉시 보인다.
- 고스트 미리보기(`rendering/ghostPreview.ts`): 키프레임 시점은 불투명, 중간은 반투명 복제본(`__ghost_<id>_<t>`).

### 8.5 모션 패스

- 편집 UI: `components/panels/MotionPathEditor.tsx` — on/off, line ↔ orbit, 평면 프리셋(xy / xz / yz), 반경·각도·loop·reverse·originMode.
- 캔버스 오버레이: `rendering/motionPathOverlay.ts` — line은 선과 양 끝점, orbit은 96분할 원과 중심점.
- 3D 핸들 드래그: `interaction/motionPathHandlers.ts` — line은 p1 → p0 순, orbit은 center만 히트. 핸들의 현재 월드 Z 평면과 레이 교차로 XY만 바꾼다(Z는 보존).

---

## 9. 레이아웃 엔진

### 9.1 자동 레이아웃 (`layout/autoLayout.ts` — `computeAutoLayout`, 순수 함수)

- 내부 영역 = 컨테이너 크기 − padding − safeInset.
- `free`: 계산하지 않는다(스토어는 자식 z만 부모+1로 맞춘다).
- `grid`: 열 수 `layoutColumns`(기본 2), 균등 셀.
- `row` / `column`: 주축 분배 규칙
  1. `fixed-px` 먼저 차감
  2. `fixed-ratio` = 전체 가용 공간 × 비율
  3. `fill`이 있으면 `equal`은 최소 크기(10)만 받고 나머지를 `fill`끼리 나눔
  4. `fill`이 없으면 남은 공간을 `equal`끼리 균등 분할
- 교차축은 내부 영역 전체를 쓴다. 기본값: gap 8, padding 8.

### 9.2 스토어 적용 (`useElementStore.ts`의 모듈 함수 `applyLayout`)

- 컨테이너 자식의 위치·크기·z를 쓰고 하위 컨테이너로 재귀한다.
- 적용 시점: reparent, `runLayout`, `loadElements`(모든 컨테이너), 자식 삭제 시 부모.
- 컨테이너를 삭제하면 자식은 루트로 승격된다.

### 9.3 포함 판정과 자동 reparent

- `layout/containment.ts`의 `detectContainment`: 요소의 네 모서리가 모두 들어가는 컨테이너 중 **가장 작은 것**을 부모로 고른다(파일 헤더 주석의 "center-point"와 다름).
- 드래그 종료(`dragHandlers`)와 그리기 종료(`drawHandlers`)에서 실행. 자손은 후보에서 빼서 순환을 막고, 옛 부모·새 부모 모두 재레이아웃한다.
- 자식 크기 모드는 `canvas/PinOverlay.tsx`의 핀 버튼으로 equal → fill → fixed-px 순환.

### 9.4 스프링 레이아웃 애니메이터 (`layout/animator.ts`)

- 스토어 값이 바뀌면 화면 표시값을 스프링으로 따라가게 하는 **렌더 전용 보간**이다(스토어에 쓰지 않는다).
- 사각형 네 변에 각각 스프링. 진행 방향 앞변은 강성 높게, 뒷변은 낮게 → 늘어나는 듯한 squash.
- 속도에 비례해 radius를 키우는 "fluid" 효과.
- 조작 중인 요소(`skipIds`)는 즉시 스냅.

---

## 10. 디렉터 모드

### 10.1 설계 개념

- 사용자는 **"카메라가 어디 있나"와 "무엇을 보나"** 두 가지만 다룬다.
- 움직임은 축별 **레일**로 정의한다: truck(X), boom(Y), dolly(Z). 레일을 늘린 만큼이 이동 범위이고, 축마다 독립적인 시작/끝 시간과 easing을 가진다.
- truck/boom은 원형 모드를 지원한다. 원형 레일에서는 확장량이 원 위의 호 길이가 된다.
- 연출은 **카메라 클립**(어느 카메라를 언제 얼마나)과 **이벤트 마커**(어떤 번들을 언제 재생)로 타임라인에 배치한다.
- 레거시 키프레임/마크 모델은 호환용으로 남아 있고, 프리셋(`cameraPresets.ts`: orbit, dolly, crane, flythrough, pan)이 이 레거시 키프레임을 생성한다.

### 10.2 축별 레일 평가 (`animation/cameraMarkEvaluator.ts`)

```
evaluateRailAxis(rail, t, anchor)
  범위: 양쪽 확장 [anchor−neg, anchor+pos] / pos 만 [anchor, anchor+pos] / neg 만 [anchor−neg, anchor]
  startTime > endTime 이면 역방향, 구간 밖은 clamp, easing 적용 후 lerp

evaluateRailAnimation(rails, t, anchor, baseTarget, focalMm, targetMode, baseCameraPos)
  ├─ 애니메이션 없는 축은 anchor 값
  ├─ truck 원형: 중심 (0, camY, 0), XZ 평면 원 위 점
  ├─ boom  원형: 중심 원점, 고도각 변화
  ├─ target: locked → position + (baseTarget − baseCameraPos)  ※ 평행 이동 오프셋 유지
  │          fixed  → baseTarget
  └─ fov = mmToFov(focalMm)
```

### 10.3 시간 → 카메라 포즈

소비자에 따라 두 경로가 있다.

**A. 편집·뷰파인더 경로** — `findCameraDerivedPose(cameraId, clips, time, targetMode)` (`animation/cameraTimeTrack.ts`)

```
해당 카메라의 클립만 시작 시간순 정렬
활성 클립 = time ∈ [start, start + duration) 인 클립 중 가장 늦게 시작한 것 (lane 무관)
localTime = clamp(time − start, 0, duration)
첫 클립 이전  → 첫 클립 t = 0 포즈
클립 사이 갭 / 끝 이후 → 직전 클립의 끝 포즈 유지
→ evaluateRailAnimation(clip.cameraSetup …), null 이면 정적 포즈
```

사용처: 캔버스의 카메라 frustum, 뷰파인더, Q 스포트라이트, 카메라 히트테스트. 단 `lastInteraction === 'playhead'`일 때만 쓴다.

**B. 영상 내보내기 경로** — `DirectorTimelinePanel`의 export 루프

```
findActiveClip(모든 카메라의 클립, time) → 가장 늦게 시작한 클립 = 그 순간의 "컷"
있으면 evaluateRailAnimation(clip.cameraSetup …)
없으면 transient 레일 → axisMarks → cameraMarks → legacy keyframes → 뷰포트 카메라 순으로 대체
```

여러 카메라 사이의 **컷 전환은 B 경로에만 존재한다.** 메인 뷰포트는 디렉터 재생 중에도 디렉터 카메라 시점으로 바뀌지 않는다. 디렉터 시점은 뷰파인더와 영상 내보내기에서만 볼 수 있다.

### 10.4 `useDirectorStore`

`useDirectorStore`는 **일시적 편집 버퍼 + 씬 데이터 CRUD 파사드**다. 영속 데이터(카메라·클립·마커)는 `scenes[active].directorTimeline`에 있다.

| 그룹 | 상태 / 액션 |
|------|-------------|
| 모드·재생 | `directorMode`, `directorPlayheadTime`, `directorPlaying`, `exporting` / `setDirectorMode`(진입 시 마이그레이션 → 카메라 없으면 생성 → 첫 카메라 로드), 재생 제어 |
| 뷰 | `focalLengthMm`(10–200), `viewfinderAspect`, `frustumSpotlightOn` |
| 리그 편집 버퍼 | `directorCameraPos`, `directorTargetPos`, `directorRails`, `railWorldAnchor`, `directorTargetMode`, `directorTargetAttachedTo`, `selectedRailHandle`, `activeRailAxis` / `extendRail`(stub → 확장 순간 타이밍을 0..클립 길이로 자동 설정), `toggleRailMode`, `alignCameraFront`, `setRailTiming`, `setRailEasing` |
| 다중 카메라 | `addCamera`, `removeCamera`(최소 1대, 해당 클립도 삭제), `selectCamera`, `loadCameraSetup`, `saveCameraSetup` |
| 클립 | `selectedClipId`, `activeClipId`, `detailClipId` / `addCameraClip`(첫 클립 0ms, 이후 플레이헤드, `assignLane`), `removeCameraClip`, `updateCameraClipsBatch`(0ms 커버 불변식 위반 시 거부), `enterClipDetail` / `exitClipDetail`, `loadClipSetup` / `saveClipSetup` |
| 이벤트 마커 | 추가·갱신·삭제 (시간순 정렬) |
| 선택 우선순위 | `lastInteraction: 'camera' \| 'playhead'` |
| legacy | camera mark / keyframe / axis mark CRUD |

**`lastInteraction` 선택 우선순위**

- `'playhead'`로 바뀜: 플레이헤드 이동, 재생 시작, 모드 진입.
- `'camera'`로 바뀜: 카메라 추가·선택, 클립 선택, 캔버스에서 카메라·타겟·레일 드래그 시작.
- 소비: `'playhead'`면 [10.3 A](#103-시간--카메라-포즈) 파생 포즈를, `'camera'`면 편집 버퍼(transient) 포즈를 보여 준다. "지금 화면의 카메라가 시간의 결과인가, 사용자가 잡고 있는 상태인가"를 가리는 장치다.

### 10.5 디렉터 타임라인 (`panels/DirectorTimelinePanel.tsx`)

- React 패널이 자체 `<canvas>`에 **즉시 모드 Canvas2D**로 그린다. `ResizeObserver`와 React 의존성 변경 시에만 다시 그린다(rAF 없음). 눈금자·플레이헤드·다이아몬드는 `engine/timeline2dRenderer.ts`, `timeline2dPrimitives.ts`를 공유한다.
- 고정 축척 `PX_PER_MS = 0.15`(줌/스크롤 없음), 사이드바 폭 120px.
- 카메라 영역 표시:
  - 클립 뷰 — lane별 클립 블록(lane 0이 맨 아래)
  - 디테일 뷰(클립 더블클릭) 또는 레일 확장 시 — X/Y/Z 축 트랙에 레일 타이밍 바, 클립 로컬 시간 기준
  - legacy 통합 트랙
- 그 아래 **Animations** lane: 이벤트 마커를 길이 있는 막대로 표시. 오른쪽 끝 드래그 = `durationOverride`(time-stretch), 더블클릭 = 해당 번들 편집으로 전환.
- 히트 우선순위: 카메라 클립 → 레일 바 → axis mark → camera mark → keyframe → 이벤트 바 → 빈 곳(스크럽).

**클립 드래그 편집**

```
드래그 시작: 전체 클립 스냅샷 저장 (매 프레임 스냅샷 기준으로 재계산)
applyCameraClipDragFrame
  ├─ 마그네틱 스냅 후보: 0ms, 플레이헤드, 같은 lane 다른 클립의 시작/끝
  │    임계값 10px ÷ 0.15 px/ms ≈ 67ms, 최소 길이 100ms
  ├─ resolveLane: 같은 lane 안 겹침 해소 — 드래그 클립 기준 좌측 그룹은 왼쪽, 우측 그룹은 오른쪽으로 연쇄 push
  │    (0ms 아래로 밀리면 드래그 클립을 오른쪽으로 제약)
  ├─ 0ms 커버 불변식 보정
  └─ updateCameraClipsBatch 로 일괄 반영
세로 드래그 → lane 변경
```

- `assignLane`: 새 클립·마커를 겹치지 않는 **가장 낮은 lane**에 배정한다. `resolveLane`은 lane 배정이 아니라 **같은 lane 안의 겹침 해소**다. 갭은 닫지 않는다.

### 10.6 이벤트 마커 → 번들 재생 (`animation/directorEventEvaluator.ts`)

- 번들 길이 = 클립 duration 최댓값. `durationOverride`가 있으면 로컬 시간을 선형으로 늘이거나 줄인다.
- `time ≥ marker.time`이면 활성이다. 번들이 끝난 뒤에도 **마지막 값을 유지**한다.
- 재생 중에는 `useAnimateLoop` → `evaluateAnimation({ activeBundles })`로 메인 캔버스에 적용된다. 재생하지 않을 때는 메인 캔버스에 적용되지 않고, 뷰파인더와 영상 내보내기에만 적용된다.

### 10.7 뷰파인더 (`panels/Viewfinder.tsx`)

- 속성 패널 맨 위에 있으며 `directorMode && selectedCameraId`일 때만 보인다.
- rAF가 아니라 `useEffect`로 다시 그린다. 포즈 결정은 `lastInteraction` 규칙을 따른다.
- 종횡비: 16:9, 4:3, 1:1, 9:16, 2.35:1. 초점거리 슬라이더는 디렉터 타임라인 헤더에 있다.

### 10.8 영상 내보내기

| 경로 | 카메라 | 루프 처리 |
|------|--------|-----------|
| 디렉터 (`DirectorTimelinePanel`) | [10.3 B](#103-시간--카메라-포즈), 뷰파인더 FBO → 메인 캔버스 blit | `exporting = true`로 메인 rAF 정지 |
| 스케치 번들 (`TimelinePanel`) | 뷰포트 카메라, 활성 번들을 시간별 평가 | 메인 rAF를 멈추지 않음 ([16.1 D10](#161-결함)) |

- 공통 레코더 `engine/videoExporter.ts`: `canvas.captureStream(fps)` + `MediaRecorder`(vp9 → vp8 → webm 순으로 시도, 8 Mbps). 프레임마다 그린 뒤 `setTimeout(1000/fps)`로 기다리는 **실시간 캡처**라 프레임 단위 정확도는 보장되지 않는다.
- 출력 포맷은 WebM 하나다. 설정 UI는 `VideoExportDialog`.

### 10.9 디렉터 오버레이 (`rendering/`)

| 모듈 | 그리는 것 |
|------|-----------|
| `cameraPathOverlay.ts` | 카메라 바디(Blender 스타일 frustum), 축별 색 레일(빨강/초록/파랑)과 핸들, 레일 슬라이더, 타겟 마커, 경로 |
| `zTunnelOverlay.ts` | 요소 Z 터널, 회전 링, 바닥 그리드, 카메라 footprint, 카메라 XYZ 축 핸들 |
| `frustumGeometry.ts` | frustum 꼭짓점 계산의 단일 출처 (렌더링과 히트테스트 공용) |
| `elevationLabel.ts` | 뷰포트 tilt 각도 DOM 라벨 (15° 초과 시 빨간색) |

---

## 11. 인터랙션

### 11.1 포인터 처리 구조 (`interaction/usePointerHandlers.ts`)

- 상태는 유니온 타입이나 상태 머신이 아니라 **`useRef` 플래그 약 25개 + 우선순위 if 체인**이다.
- 세부 로직은 기능별 핸들러 파일로 분리되어 있다: `dragHandlers`, `resizeHandlers`, `drawHandlers`, `dragSelectHandlers`, `colorPickerHandlers`, `cameraPathHandlers`, `motionPathHandlers`, `splitElement`, `frameSelection`, `elementHelpers`, `hitTest`.

**pointerDown 히트 우선순위**

```
0. 좌클릭 아님 / Space 팬 중 → 무시
1. [디렉터 모드 · 비재생]
   a. 선택 카메라의 레일 핸들 (350ms 이내 재클릭 = linear ↔ circular 토글)
   b. 타겟 마커 (뷰 tilt 15° 초과 시 차단, Z 고정 평면 드래그, 부착 해제)
   c. 레일 슬라이더
   d. 카메라 축 터널 (확장되지 않은 축 직접 이동)
   e. 정면 정렬 마커 → alignCameraFront
   f. 카메라 바디 (다른 카메라면 선택, 선택된 카메라면 뷰 법선 평면 드래그)
   g. 아무것도 안 맞으면 카메라 선택 해제 → legacy keyframe 검사
   h. 요소 Z 터널 면 (레이-축 최근접점으로 Z 이동)
   i. 회전 링
   → 여기서 안 맞으면 아래 스케치 처리로 이어진다 (디렉터 모드에서도 XY 편집 가능)
2. 프리뷰 재생 중이면 click 트리거 실행
3. 컬러 피커
4. 모션 패스 핸들 (번들 편집 중 · 단일 선택 · motionPath 있음)
5. select 도구: Shift 토글 → 크기 모드 핀 → 레이아웃 핸들 → 코너/엣지 리사이즈 → 레이캐스트 그룹 드래그 → 박스 선택
6. 그리기 도구: 드래그로 생성 (사각형은 container, 프레임 도구면 safeInset 기본값)
```

- pointerUp: 타겟을 놓은 위치를 레이캐스트해 요소 위면 부착. 요소 편집·축 드래그·모션 패스·회전·키프레임은 `pushSnapshot` 호출.

### 11.2 기즈모

| 기즈모 | 조건 | 동작 |
|--------|------|------|
| Z 터널 | 디렉터 모드·비재생, 단일 선택, 뷰포트 카메라가 정면에서 30° 이상 기울었을 때(`canShowZTunnel`) | 터널 면을 잡고 끌면 레이-축 최근접점으로 Z 변경 |
| 회전 링 | 디렉터 모드·비재생, 단일 선택 (각도 조건 없음) | 화면 공간 각도를 `rotationY`에 기록 ([16.1 D7](#161-결함)) |
| 카메라 축 핸들 | 디렉터 모드, 카메라 선택 | Z 터널 비주얼을 카메라 XYZ로 일반화. 레일 확장 축은 슬라이더로 대체. Alt = 레일 제약 무시하고 anchor 함께 이동 |
| 모션 패스 핸들 | 번들 편집, 단일 선택, motionPath 있음 | 핸들 Z 평면 위에서 XY 드래그 |

### 11.3 키보드 (`interaction/hotkeyRegistry.ts`, `useKeyboardHandlers.ts`)

레지스트리는 `KeyboardEvent.code` 기반(IME 무관)이며 Ctrl은 Meta를 포함한다. INPUT/TEXTAREA/SELECT에 포커스가 있으면 무시한다.

| 키 | 동작 |
|----|------|
| V | 선택 도구 |
| R | 사각형 도구 |
| B / M | 브라우저 / 모바일 프레임 그리기 |
| N | 분할 모드 진입 (Shift = 방향 전환, 휠 = 개수, Enter = 확정) |
| Escape | 분할 취소 / 컬러 피커 닫기 |
| Delete, Backspace | 선택 요소 삭제 |
| Ctrl/Cmd + Z / Shift+Z | Undo / Redo |
| Ctrl/Cmd + C / V | 하위 트리 복사 / 붙여넣기(+20px) |
| Z | 선택 요소를 원점으로 옮기고 뷰포트 프레이밍 — **디렉터 모드에서는 동작 안 함** |
| S | Quick Skin Picker (`App.tsx`에서 직접 처리) |
| Q | 디렉터 frustum 스포트라이트 토글 (카메라 선택 시, `useAnimateLoop`에서 처리) |
| F | 디렉터 카메라 정면 정렬 (카메라 선택 시) |
| Space (누름) | 팬 |
| Alt (누름) | 거리 표시 / 형제 동기화 / 레일 제약 무시 |

디렉터 타임라인 패널은 별도로 Delete/Backspace를 받아 axis mark → camera mark → keyframe → 이벤트 마커 순으로 지운다.

### 11.4 스냅 (`utils/snapUtils.ts`)

- 임계값 6 ref px, 가이드 여백 20.
- `computeSnapMove`: 좌/중/우 × 상/중/하 조합 중 축별 최소 거리. 드래그 그룹을 제외한 모든 요소가 대상.
- `computeSnapResize`: 엣지/센터 + 같은 너비/높이.
- `computeDistances`: Alt 거리 측정 라벨.
- 카메라·레일·모션 패스 드래그에는 스냅이 없다. 디렉터 클립 스냅은 [10.5](#105-디렉터-타임라인-panelsdirectortimelinepaneltsx)의 별도 로직이다.

---

## 12. 내보내기

### 12.1 Markdown 스펙 (`export/toMarkdown.ts`)

`rules/specifics/S-export.md`가 정한 `core → render → platforms` 구조를 따른다.

```
toMarkdown(elements, bundles, platform = web)
 ├─ core/buildTree        평면 배열 → 트리, 형제는 z 순 정렬
 ├─ 헤더                   Platform, Viewport (루트 요소 bbox)
 ├─ render/renderTree     노드마다: 깊이별 제목, Layout, Size, Position(free 부모일 때만),
 │                         Style, Component(describeComponentState), On click → 트리거
 │   └─ core/groupSiblings  자식 중 같은 fingerprint 가 50% 초과면 [Pattern ×N] 대표 1개 +
 │                          [Exception #i] 차이점만 출력
 │       └─ core/fingerprint  id·label·x·y·z 를 뺀 구조·스타일·스킨·상태를 자식까지 직렬화
 ├─ render/renderAnimations  번들마다 Element | Property | From | To | Duration | Easing 표
 └─ platforms/            PlatformRenderer 인터페이스 (base.ts). web.ts 만 구현, ios/android 는 stub
```

- 앱 상단 툴바의 **Speak LLM**(클립보드 복사 + SDF 병합 연출)과 **.md 다운로드**가 호출한다. 플랫폼은 항상 web이다.
- **활성 씬만** 내보낸다. 모션 패스와 디렉터 타임라인은 출력에 포함되지 않는다.
- 출력 문구는 영어다(커밋 `9c3e4c5`에서 영문화).

### 12.2 .choan YAML (`export/toYaml.ts`)

```ts
interface ChoanFile { version: number /* 3 */; name; elements; animationBundles? }
```

- 단일 씬 구조다. `deserialize`는 version을 검사하지 않고 마이그레이션도 없다.
- **현재 앱에서 호출하지 않는다**(테스트에서만 사용). 실제 프로젝트 저장은 IndexedDB(5.5)다.

---

## 13. UI 셸

### 13.1 라우트

| 경로 | 페이지 |
|------|--------|
| `#/` | `LandingPage` |
| `#/app` | `AppPage` → `lazy(App)` |

`pages/FeaturesPage.tsx`는 있지만 라우트에 등록되어 있지 않다.

### 13.2 에디터 레이아웃 (`App.tsx`)

```
┌──────────────────────────── 상단 툴바: 로고 · Speak LLM · .md 다운로드 · 홈 ────────────────────────────┐
├──────────────┬───────────────────────────────────────────────────────────┬──────────────────────┤
│ 왼쪽 패널    │ SceneTabBar                                                 │ 오른쪽 패널          │
│ (80–320px)   ├───────────────────────────────────────────────────────────┤ (180–400px)          │
│ CanvasToolbar│ SDFCanvas  (data-theme="light")                             │ PropertiesPanel      │
│ LayerPanel   │   + ContextToolbar, NavigationGizmo, RenderSettingsPanel,   │  ├ Viewfinder        │
│              │     DistanceLabels, SplitLabels, PinOverlay, RailTimeLabels │  ├ Element / Skin    │
│              ├───────────────────────────────────────────────────────────┤  ├ ContainerLayout   │
│              │ TimelinePanel (80–600px) — UI Sketch / Director 전환         │  ├ Geometry          │
│              │   └ Director 모드면 DirectorTimelinePanel                    │  ├ Triggers          │
│              │                                                             │  └ MotionPathEditor  │
└──────────────┴───────────────────────────────────────────────────────────┴──────────────────────┘
오버레이: QuickSkinPicker (S), Toast            앱 루트는 data-theme="dark"
```

### 13.3 패널 역할

| 패널 | 역할 |
|------|------|
| `PropertiesPanel` | 선택 요소의 섹션 조합. 번들 편집 중이면 MotionPathEditor 표시 |
| `LayerPanel` | `buildLayerTree` 기반 계층 목록, 선택, 일괄 이름 추론(Rename All) |
| `TimelinePanel` | 번들 선택·생성·재생·고스트·영상 내보내기, 모드 전환 |
| `TimelineCanvas` / `TimelineSidebar` | 번들 타임라인 Canvas2D(`engine/timeline2d`) / 트랙 라벨 |
| `DirectorTimelinePanel` | 카메라 클립·레일 타이밍·이벤트 마커 타임라인, 프리셋, 영상 내보내기 |
| `SceneTabBar` | 씬 탭 |
| `ContextToolbar` | 선택 요소 위 플로팅 툴바(레이아웃, radius, 분할, 형제 동기화, 색, 스킨 옵션) |
| `RenderSettingsPanel` | 셰이딩·스프링 슬라이더 |

### 13.4 디자인 시스템

- `design-system/tokens.css`: 원시 토큰(gray/violet/red/green/yellow, 4px 간격 그리드, radius, 글자 크기, 그림자) → 의미 토큰(`--bg`, `--surface-*`, `--border*`, `--text-*`, `--accent*`, `--danger*`, `--toolbar-h`, `--panel-w`, 글꼴 Space Grotesk) → `[data-theme="light" | "dark"]` 재정의.
- `components/ui/`: Radix 프리미티브를 감싼 래퍼(Dialog, Popover, Tooltip, Toast, Select, Slider, Switch, Checkbox)와 자체 컴포넌트(Button, SegmentedControl, Section, PropRow, Input). 클래스는 `ui-` 접두사, 스타일은 `index.css`.
- 변형 관리는 CVA로 하며 현재 `Button`(variant: default/primary/ghost/danger, size: md/sm/icon)에만 쓴다. `cn()`은 `clsx` 별칭이다.
- 프론트엔드 UI 라벨은 영어로 표기한다.

---

## 14. 테스트

### 14.1 실행 결과 (기준 커밋, `npx vitest run`)

| 파일 | 결과 | 비고 |
|------|------|------|
| `animation/buildLayerTree`, `easing`, `interpolate`, `motionPathEvaluator` | 통과 | |
| `coords/coordinateSystem` | 통과 | 픽셀 ↔ 월드 왕복 |
| `store/useAnimationStore` | 통과 | |
| `export/toYaml` | 통과 | version 3, 왕복 |
| `export/export.snapshot` | **37건 실패** | 출력 영문화(`9c3e4c5`) 후 스냅샷 미갱신 |
| `export/toMarkdown` | **1건 실패** | 빈 캔버스 문구 기대값이 한국어 |
| `store/useElementStore` | **2건 실패** | 라벨 자동 번호("Box 1") 기대, `addElement`에 해당 로직 없음 |
| **합계** | **164 통과 / 40 실패 (204)** | `tsc -b` 타입 체크는 통과 |

### 14.2 커버리지 공백

테스트가 없는 영역: `useSceneStore`, `history`, `persistence`, `animationEvaluator`, `propagateDelta`, `keyframeEngine`, `autoLayout`, `containment`, `layout/animator`, 디렉터 평가기 전부(`cameraMarkEvaluator`, `cameraTimeTrack`, `directorEventEvaluator`, `resolveLane`/`assignLane`), 인터랙션 계층.

테스트 환경은 `node`라서 WebGL·DOM·IndexedDB를 쓰는 코드는 순수 함수로 분리된 부분만 검증할 수 있다.

---

## 15. 구현 규칙

코드 수정 시 `rules/INDEX.yaml`에서 적용 규칙을 찾아 먼저 읽는다. MUST / MUST NOT 위반은 금지다.

| 규칙 | 범위 | 핵심 |
|------|------|------|
| `principles.md` | 항상 | 단일 책임, 의존 방향, 공유 인스턴스 재사용, 상수 중앙화, 불변 업데이트, 타입 안전(`any` 금지) |
| C1 파일 구조 | 파일 생성/이동 | 컴포넌트 PascalCase, 함수 camelCase, 훅 `use*`, 테스트는 `__tests__/` 미러링 |
| C2 공유 자원 | engine/rendering/canvas | 렌더러는 SDFCanvas에서 1회 생성, 좌표는 `coordinateSystem`, rAF는 `useAnimateLoop` 하나 |
| C3 에러 처리 | try/catch, JSON.parse | 필수 시스템 실패는 throw, 빈 catch 금지 |
| C4 설정 | 상수·설정 | 2회 이상 쓰는 상수는 `constants/` 또는 `config/` |
| C5 UI 컴포넌트 | components/panels | Radix는 `components/ui/` 래퍼로만, `ui-` 접두사, CVA, `cn()` |
| S-engine | `engine/` | UI 레이어 import 금지, GPU 자원은 생성한 곳에서 dispose, 프레임마다 GPU 자원 생성 금지 |
| S-store | `store/` | 크로스 스토어 작업은 `useChoanStore.ts` 모듈 함수, 컴포넌트에서 `getState()`로 직접 변경 금지 (`history`/`persistence` 모듈 변수는 예외) |
| S-export | `export/` | core → render → platforms 유지, 출력 변경 시 스냅샷 갱신 |

현재 규칙과 맞지 않는 상태(16장에서 상세):

- S-export "출력 변경 시 스냅샷 갱신" — 영문화 이후 미갱신.
- C4 — `MAX_OBJECTS`가 두 곳에 정의, `sdf.ts`의 `elementToWorld`가 1920×1080을 직접 사용.
- 원칙 2 — `engine/`이 `store/`에서 타입을 import(런타임 의존은 없음).
- C1 PREFER(300줄) — `usePointerHandlers.ts`(1392), `DirectorTimelinePanel.tsx`(1363), `painters.ts`(1183), `useDirectorStore.ts`(944), `cameraPathOverlay.ts`(893).

---

## 16. 알려진 이슈와 기술 부채

이 장의 항목은 모두 기준 커밋에서 **직접 확인한 것**이다. "런타임"은 실제 실행으로, "정적"은 코드 경로를 따라가 확인했다는 뜻이다.

### 16.1 결함

| ID | 내용 | 위치 | 확인 |
|----|------|------|------|
| D1 | **자동 저장이 편집 없이도 300ms마다 무한 반복된다.** `save()`가 `syncActiveSceneData()` → `useSceneStore.setState()`를 부르고, 이 갱신이 다시 `scheduleSave`를 예약한다. 편집 없이 3초 동안 IndexedDB 쓰기 20회(프로젝트 + meta) 관찰 | `store/persistence.ts` `save`, `store/useChoanStore.ts` `syncActiveToScenes` | 런타임 |
| D2 | **자동 Undo 스냅샷이 생기지 않는다.** 500ms 디바운스가 D1의 300ms 갱신에 계속 밀린다. 명시적 `pushSnapshot` 없이 한 편집(패널 속성 변경 등)은 독립된 Undo 지점이 되지 않는다 | `store/history.ts` `schedulePush` | 런타임 |
| D3 | 씬 복제 시 번들 id는 새로 만들지만 요소의 `triggers.animationBundleId`는 그대로 복사해, 복제 씬의 트리거가 존재하지 않는 번들을 가리킨다 | `store/useSceneStore.ts` `duplicateScene` | 정적 |
| D4 | truck과 boom을 **둘 다 원형**으로 쓰면 boom 계산이 X·Y·Z를 모두 덮어써 truck 결과가 사라진다 | `animation/cameraMarkEvaluator.ts` `evaluateRailAnimation` | 정적 |
| D5 | 클립마다 `cameraSetup.targetMode`를 저장하지만, 평가 호출부는 모두 전역 `directorTargetMode`를 넘긴다 | `cameraTimeTrack` 호출부(`useAnimateLoop`, `Viewfinder`, `usePointerHandlers`), `DirectorTimelinePanel` export | 정적 |
| D6 | `catmullRomPoint`의 상수항이 `2·p1`(0.5배 누락)이라 t=0에서 `2·p1`을 반환한다. legacy 카메라 키프레임 평가와 경로 샘플링(`sampleCatmullRomPath3D`)이 영향을 받는다 | `engine/catmullRom.ts` | 정적(수식) |
| D7 | 회전 링은 XY 평면에 그려지고 값은 화면 공간 `atan2` 절대각으로 `rotationY`에 기록되는데, 셰이더는 이를 **Y축** 회전으로 적용한다. 보이는 조작 축과 실제 회전 축이 다르다 | `rendering/zTunnelOverlay.ts` `drawRotationRing`, `usePointerHandlers`, `engine/shaders.ts` | 정적 |
| D8 | 트리거 재생(`keyframeEngine.tick`)에서 모션 패스가 적용되지 않는다 | `animation/keyframeEngine.ts` | 정적 |
| D9 | 고스트 미리보기 중에는 BVH가 [고스트 + 요소] 배열로 만들어지지만 히트테스트는 고스트 없는 배열로 인덱싱해, 클릭이 다른 요소로 판정될 수 있다 | `rendering/ghostPreview.ts`, `useAnimateLoop`, `interaction/hitTest.ts` | 정적 |
| D10 | 스케치 번들 영상 내보내기는 `exporting` 플래그를 세우지 않아, 메인 rAF 루프가 같은 캔버스에 계속 그린다(오버레이 등이 녹화 프레임에 섞일 수 있음) | `panels/TimelinePanel.tsx` | 정적 |
| D11 | `hover` 트리거는 타입·UI만 있고 실행 경로가 없다 | `panels/TriggersSection.tsx`, `usePointerHandlers` | 정적 |

### 16.2 미연결·미사용 코드

| ID | 대상 | 상태 |
|----|------|------|
| U1 | 씬 전환 fade (`sceneManager.captureSnapshot` / `renderTransition`, `useSceneStore.beginTransition`) | 렌더 루프에 분기는 있으나 `beginTransition`·`captureSnapshot` 호출처가 없어 동작하지 않음. `endTransition`은 씬 데이터를 로드하지 않음 |
| U2 | DoF (`renderer.applyDoF`, `dofShaders.ts`의 DoF 부분) | 호출처 없음 |
| U3 | `.choan` YAML (`export/toYaml.ts`) | 테스트 전용 |
| U4 | `animation/autoKeyframe.ts` | 호출처 없음 |
| U5 | `pages/FeaturesPage.tsx` | 라우트 미등록 |
| U6 | `xstate`, `@xstate/react`, `perfect-freehand` | 의존성만 선언 |
| U7 | `sceneTypes.ts`의 `resolveGlobalTime`, `computeTotalDuration` | 테스트 외 호출처 없음 |
| U8 | `useDirectorStore`의 `resizeCameraClip`, `moveCameraClip` | 스토어 밖 호출처 없음 (패널은 `updateCameraClipsBatch` 사용) |
| U9 | `persistence.ts`의 `listProjects`, `deleteProject`, `setCurrentProject` | 다중 프로젝트 UI 없음 |
| U10 | `export/platforms/ios.ts`, `android.ts` | stub, 앱은 web 고정 |

### 16.3 테스트 부채

- T1 — 40건 실패([14.1](#141-실행-결과-기준-커밋-npx-vitest-run)). 영문화에 맞춘 스냅샷·기대값 갱신과, 라벨 자동 번호를 구현할지 테스트를 지울지 결정이 필요하다.
- T2 — 상태·평가·디렉터 계층 테스트 공백([14.2](#142-커버리지-공백)).

### 16.4 구조·성능 관찰

- P1 — 아틀라스는 키 하나만 바뀌어도 전체 재빌드 + 4096² 전체 업로드다. 재생 중인 image 스킨이 있으면 매 프레임 전체 업로드가 일어난다.
- P2 — `useChoanStore()` 훅이 셀렉터 없이 4개 스토어를 구독해 광범위한 리렌더를 일으킨다. 파사드 제거(호출부 이관)가 예정되어 있다.
- P3 — 요소 128개 상한 초과 시 무표시 절단. 사용자 안내가 없다.
- P4 — 대형 파일 5개가 C1 권장 크기를 크게 넘는다(15장).

---

## 17. 확장 제안 대비 구현 현황

`docs/choan-expansion-design.md`(2026-03) 제안과 기준 커밋 구현의 비교다.

| 제안 | 상태 | 실제 구현 |
|------|------|-----------|
| 멀티씬 — SceneManager, 씬별 렌더러·컨텍스트 | 다른 방식으로 부분 구현 | 단일 렌더러 + 공유 스토어에 씬 데이터를 load/sync(5.3). 씬 탭 UI 있음 |
| 멀티씬 — 전환 효과(fade/slide/zoom-blur/wipe) | 미완 | fade 셰이더와 스냅샷 FBO만 있고 미연결(U1) |
| 멀티씬 — 타임라인 씬 트랙, `.choan` v2 | 미구현 | 씬 간 전역 시간 함수만 정의(U7). YAML은 version 3 단일 씬(U3) |
| Subdivision 레이어 / PBR | 미구현 | — |
| 카메라 제어 — 키프레임 트랙 | 다른 방식으로 구현 | 레일 기반 디렉터 모드 + 카메라 클립 타임라인(10장). 키프레임은 legacy로만 존재 |
| 카메라 프리셋 5종 | 구현 | `cameraPresets.ts`(orbit, dolly, crane, flythrough, pan) — legacy 키프레임 생성 |
| 영상 Export — WebM | 구현 | MediaRecorder 실시간 캡처(10.8) |
| 영상 Export — MP4(ffmpeg.wasm), GIF, PNG 시퀀스, 해상도/품질 프리셋 | 미구현 | — |

제안서에 없던 구현: 모션 패스(`tasks/plan-motion-path.md`), Z 터널·회전 링 기즈모(`docs/plan-z-tunnel-gizmo.md`), 다중 카메라와 NLE식 lane 타임라인, 이벤트 마커, 뷰파인더, Frustum 스포트라이트.

---

## 부록 A. README와 코드의 차이

`README.md`는 사용자용 소개 문서라 이 문서와 역할이 다르지만, 아래 항목은 현재 코드와 다르다.

| README 서술 | 실제 |
|-------------|------|
| Tech Stack에 XState 5 | 의존성만 있고 사용하지 않음 |
| 렌더 파이프라인 "2x SS" | DPR ≥ 2면 1배, 아니면 2배. GBuffer에 깊이 RT, 조건부 FrustumMask 패스 존재 |
| UBO 표 5개 배열 | `uExtra`(rotationY) 포함 6개 배열 + 헤더 |
| Video Export "OffscreenCanvas 사용" | `canvas.captureStream` + `MediaRecorder` |
| Z 키: 디렉터 카메라 프레이밍 | 디렉터 모드에서 Z는 동작하지 않음. 스케치 모드에서 뷰포트 프레이밍 |
| 정면 정렬은 Director 패널 버튼 | F 키 또는 frustum 안쪽 정렬 마커 클릭 (단축키 표에 F 없음) |
| Locked 타겟은 카메라와 함께 회전 | 카메라 초기 위치 대비 **평행 이동 오프셋 유지** |
| `resolveLane()`이 가장 낮은 빈 lane 배정 | lane 배정은 `assignLane`, `resolveLane`은 같은 lane 안 겹침 해소 |
| 레일: 빨간 stub / 파란 확장 | 축별 색(빨강/초록/파랑) |
| 이벤트 마커는 핀 | 길이 있는 막대, lane과 길이 조절 지원 |
| "No keyframe UI" | legacy 키프레임 다이아몬드와 프리셋이 여전히 노출 |
| 모션 패스 | 언급 없음 (Phase 0~4 + 3D 핸들 구현됨) |

---

## 부록 B. 용어집

| 용어 | 뜻 |
|------|----|
| 번들 (AnimationBundle) | 한 인터랙션에 반응하는 요소별 클립 묶음. 트리거와 이벤트 마커의 참조 단위 |
| 클립 (AnimationClip) | 요소 하나의 트랙 묶음 + 선택적 모션 패스 |
| 스킨 (skin) | Canvas2D로 그린 UI 컴포넌트 외형(switch, button 등)을 요소 앞면에 입힌 것 |
| skinOnly / frameless | SDF 몸체 없이 스킨만 / 컨테이너 배경 숨김 |
| 프레임 (frame) | 브라우저·모바일 기기 외곽 요소. safeInset을 가진다 |
| 스크럽 hold | 번들 편집 중 직접 조작한 요소를 스크럽 오버라이드에서 잠시 빼는 것 |
| 고스트 미리보기 | 키프레임 사이 상태를 반투명 복제본으로 겹쳐 보여 주는 onion-skin |
| Speak LLM | Markdown 스펙을 클립보드에 복사하며 요소들이 SDF로 녹아 합쳐지는 연출을 재생하는 버튼 |
| 레일 (truck / boom / dolly) | 디렉터 카메라의 X / Y / Z 이동 범위. 확장량 + 시간 구간 + easing |
| railWorldAnchor | 레일이 붙어 있는 월드 기준점 |
| 카메라 클립 (CameraClip) | 타임라인 위 "이 카메라를 이 구간에" 블록. 리그 스냅샷을 가진다 |
| lane | 클립·마커가 겹치지 않게 쌓이는 타임라인 줄 |
| 이벤트 마커 (EventMarker) | 디렉터 타임라인에서 특정 시각에 번들을 재생하는 막대 |
| lastInteraction | 화면 카메라 포즈를 "플레이헤드 결과"로 볼지 "사용자 편집 상태"로 볼지 정하는 선택 우선순위 |
| 뷰파인더 | 선택한 디렉터 카메라의 시점을 보여 주는 속성 패널 상단 미리보기 |
| Frustum 스포트라이트 | Q 키로 디렉터 카메라 시야 밖을 어둡게 하는 마스크 |
