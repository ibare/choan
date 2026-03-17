# Choan

**UI 스케치를 LLM 프롬프트로 변환하는 디자인 도구**

Choan은 캔버스 위에 UI를 빠르게 스케치하고, 그 구조와 인터랙션 의도를 LLM(Claude, GPT 등)에 바로 붙여넣을 수 있는 마크다운 스펙으로 변환하는 도구입니다.

디자이너와 개발자가 "이 버튼을 누르면 이 패널이 열린다"는 의도를 LLM에게 정확하게 전달하기 위해 만들었습니다. 와이어프레임 도구도, 프로토타이핑 도구도 아닙니다. **LLM 인풋 생성기**입니다.

---

## 왜 만들었나

LLM에게 UI 맥락을 설명할 때 스크린샷이나 긴 글보다 **구조화된 스펙**이 훨씬 효과적입니다. 하지만 기존 디자인 도구(Figma, Sketch 등)의 export는 LLM 친화적이지 않고, 손으로 쓰기엔 번거롭습니다.

Choan은 캔버스에서 도형을 배치하고 인터랙션을 연결하면, 다음과 같은 마크다운을 자동으로 생성합니다:

```markdown
## UI Spec

### Elements
- `카드` — rectangle / card / z:1
- `닫기 버튼` — circle / button
- `배경` — rectangle / container

### Layout
- 카드: x:320, y:180, z:1, size:400×280
- 닫기 버튼: x:680, y:160, z:2, size:40×40

### Triggers
- 닫기 버튼.click → 카드 닫기

### Animations
- **카드 닫기** (2 elements)
  - 카드: opacity: 1→0 (0-200ms, ease-out); y: 180→220 (0-200ms, ease-out)
```

---

## 주요 기능

### 캔버스
- **도형 도구**: Rectangle, Circle, Line 직접 드로잉
- **선택 / 이동 / 리사이즈**: 핸들 조작 및 키보드 단축키
- **스냅 & 거리 측정**: Alt 키로 인접 요소와의 거리 표시
- **Z-order 레이어링**: 요소별 깊이 설정

### 3D 렌더러 — 커스텀 WebGL2 SDF 엔진

표준 2D 캔버스나 Three.js 대신 **SDF(Signed Distance Field) Ray Marching** 기반의 완전 커스텀 WebGL2 렌더러를 씁니다. [Adobe Project Neo](https://projectneo.adobe.com/)와 동일한 렌더링 접근법입니다.

- **수학적으로 완벽한 엣지**: 해상도 무관, 균일한 아웃라인
- **Toon shading**: 2밴드 셀 셰이딩 + 워밍 톤 조정
- **2-pass 렌더링**: Geometry(MRT) → Edge detection(Roberts Cross) → Downsample
- **HiDPI 최적화**: Retina 디스플레이에서 DPR을 고려한 적응형 슈퍼샘플링

### 애니메이션 타임라인
- **키프레임 편집**: x, y, width, height, opacity, color, radius 애니메이션
- **이징**: linear / ease / ease-in / ease-out / ease-in-out / spring(물리 기반)
- **스프링 물리**: stiffness · damping · squash 파라미터 실시간 조정
- **프리뷰 & 스크러빙**: 타임라인 플레이헤드 드래그로 프레임 확인
- **Ghost preview**: 어니언 스킨 방식의 전후 프레임 오버레이

### Properties 패널
- 레이블, 역할(button / input / card / image / container), 색상, 모서리 반경, 투명도
- 컨테이너 자동 레이아웃 (row / column, gap, padding)
- Trigger 바인딩: click · hover → 애니메이션 번들 연결

### Export
- **Markdown**: LLM에 바로 붙여넣을 수 있는 구조화된 UI 스펙
- **YAML**: `.choan` 파일 저장 / 불러오기

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| UI 프레임워크 | React 19 + TypeScript |
| 상태 관리 | Zustand 5 |
| 상태 머신 | XState 5 |
| 렌더링 엔진 | 커스텀 WebGL2 (SDF Ray Marching) |
| 빌드 | Vite 8 |
| 아이콘 | Phosphor Icons |

---

## 렌더링 엔진 상세

### 렌더 파이프라인

```
Ray March Pass (GBuffer, 2× SS)
  └─ Per-pixel ray → sceneSDF(N) → Toon shade
       ↓
Edge Detection Pass (GBuffer textures)
  └─ Roberts Cross on Normal + ObjectID → outline
       ↓
Downsample (blitFramebuffer 2×→1×)
       ↓
Overlay Pass (native res)
  └─ Selection handles, snap guides, distance labels
```

### SDF 프리미티브

```glsl
// Extruded Rounded Rect (Rectangle, Circle)
float sdExtrudedRoundRect(vec3 p, vec3 b, float r) {
  vec2 q = abs(p.xy) - b.xy + r;
  float d2d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return max(d2d, abs(p.z) - b.z);
}

// Capsule (Line)
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
```

### 법선 계산 — O(1), 히트 오브젝트만 평가

일반적인 tetrahedron 법선은 전체 sceneSDF를 4번 호출해 오브젝트 수 N에 비례하는 비용이 발생합니다. Choan은 히트한 오브젝트 하나에 대해서만 SDF를 평가하는 `singleSDF`를 사용해 비용을 O(N) → O(1)로 줄입니다.

```glsl
vec3 calcNormal(vec3 p, int objId) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * singleSDF(p + k.xyy * h, objId) +
    k.yyx * singleSDF(p + k.yyx * h, objId) +
    k.yxy * singleSDF(p + k.yxy * h, objId) +
    k.xxx * singleSDF(p + k.xxx * h, objId)
  );
}
```

---

## 프로젝트 구조

```
src/
├── engine/                 # WebGL2 SDF 렌더링 엔진
│   ├── renderer.ts         # 2-pass 렌더러 (GBuffer → Edge → Overlay)
│   ├── shaders.ts          # GLSL 셰이더 소스 (ray march + edge detection)
│   ├── scene.ts            # ChoanElement[] → UBO 변환 (std140)
│   ├── camera.ts           # Perspective 카메라 + ray 파라미터
│   ├── controls.ts         # OrbitControls (pan / rotate / zoom + damping)
│   ├── overlay.ts          # UI 오버레이 (선택 핸들, 스냅 가이드)
│   └── picking.ts          # CPU-side SDF 피킹 (click 히트 테스트)
│
├── canvas/                 # React 캔버스 레이어
│   ├── SDFCanvas.tsx       # 메인 캔버스 컴포넌트
│   ├── CanvasToolbar.tsx
│   └── FrameIndicator.tsx  # FPS / 프레임 인디케이터
│
├── rendering/              # rAF 루프 및 애니메이션 평가
│   ├── useAnimateLoop.ts   # RequestAnimationFrame 루프
│   ├── kfAnimator.ts       # 키프레임 애니메이터
│   └── ghostPreview.ts     # 어니언 스킨 프리뷰
│
├── animation/              # 애니메이션 시스템
│   ├── types.ts            # Keyframe, AnimationClip, AnimationBundle
│   ├── animationEvaluator.ts
│   └── interpolate.ts
│
├── panels/                 # 우측/하단 패널 UI
│   ├── PropertiesPanel.tsx
│   ├── TimelinePanel.tsx
│   └── TimelineCanvas.tsx
│
├── store/                  # Zustand 상태 스토어
│   ├── useElementStore.ts
│   ├── useAnimationStore.ts
│   └── usePreviewStore.ts
│
├── export/                 # Export 로직
│   ├── toMarkdown.ts       # UI Spec 마크다운 생성
│   └── toYaml.ts           # .choan 파일 직렬화
│
└── coords/                 # 좌표 변환 (픽셀 ↔ 월드)
```

---

## 시작하기

```bash
npm install
npm run dev    # 개발 서버 (localhost:5173)
npm run build  # 프로덕션 빌드
```

---

## 사용 방법

1. **도형 그리기** — 상단 툴바에서 Rectangle / Circle / Line 선택 후 캔버스에 드래그
2. **속성 편집** — 요소 선택 후 우측 Properties 패널에서 레이블, 역할, 색상 등 설정
3. **애니메이션 만들기** — 하단 타임라인에서 `+` 버튼으로 애니메이션 번들 추가, 키프레임 편집
4. **트리거 연결** — Properties 패널 하단 Triggers 섹션에서 click / hover → 애니메이션 번들 바인딩
5. **Export** — 상단 툴바 Export 버튼으로 마크다운 클립보드 복사 또는 `.choan` 파일 저장

---

## 현재 범위 (MVP)

| 기능 | 상태 |
|---|---|
| WebGL2 SDF 렌더러 | ✅ |
| 도형 도구 (rect / circle / line) | ✅ |
| 선택 / 이동 / 리사이즈 | ✅ |
| Properties 패널 | ✅ |
| 스프링 물리 애니메이션 | ✅ |
| 키프레임 타임라인 | ✅ |
| Trigger / 인터랙션 바인딩 | ✅ |
| Markdown export | ✅ |
| `.choan` 파일 저장 / 불러오기 | ✅ |
| 텍스트 요소 (MSDF) | 🔜 |
| Undo / Redo | 🔜 |
| 그룹핑 | 🔜 |

---

## 레퍼런스

- [Inigo Quilez — Distance Functions](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez — SDF Normals](https://iquilezles.org/articles/normalsSDF/)
- [Adobe Project Neo](https://projectneo.adobe.com/) — SDF 기반 렌더링의 상용 레퍼런스
