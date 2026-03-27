# 초안 (Choan) — 기능 확장 설계안

## 개요

현재 초안은 단일 씬 기반 SDF 렌더러로 60fps 안정 유지를 위해 오브젝트 수가 50~60개로 제한된다.
이 설계안은 세 가지 축으로 이 한계를 극복하고 도구의 표현 범위를 확장한다.

```
1. 멀티씬 구조     — 씬 단위로 오브젝트를 분리해 성능 한계 우회
2. Subdivision 레이어 — 유기적 3D 형태로 SDF의 표현 한계 보완
3. 카메라 제어 + 영상 Export — 영화적 연출과 결과물 공유
```

---

## 1. 멀티씬 구조

### 1.1 문제

SDF 렌더러는 매 프레임 모든 오브젝트를 픽셀마다 평가한다. 오브젝트 N개 = 픽셀당 N번 연산. 단일 씬에서 60fps를 유지하려면 50~60개가 실용적 한계다.

### 1.2 설계 원칙

씬을 독립된 렌더 단위로 분리한다. 각 씬은 자체 오브젝트 스토어와 렌더 타겟을 가지며, 활성화된 씬만 렌더링한다. 씬 전환 중에만 두 씬이 동시에 렌더링된다.

```
평상시
  활성 씬 하나만 렌더링 → 오브젝트 N개 평가

전환 중 (오버랩 구간)
  씬 A → OffscreenCanvas A → 텍스처 A
  씬 B → OffscreenCanvas B → 텍스처 B
  텍스처 A + B 블렌딩 → 화면 출력

전환 완료
  씬 A 언로드 → 메모리 해제
  씬 B 활성화
```

### 1.3 SceneManager 구조

```typescript
interface Scene {
  id: string
  label: string
  store: SceneStore          // 오브젝트, 레이아웃, 상태
  renderer: SDFRenderer      // 전용 WebGL 컨텍스트
  renderTarget: WebGLTexture // 오프스크린 렌더 결과
  status: 'idle' | 'active' | 'preloading' | 'transitioning'
}

class SceneManager {
  scenes: Map<string, Scene>
  activeScene: string
  transitionScene: string | null
  transitionProgress: number  // 0 ~ 1

  // 다음 씬을 전환 3초 전에 사전 컴파일
  preload(sceneId: string): void

  // 씬 전환 트리거
  transition(
    to: string,
    effect: 'fade' | 'slide' | 'zoom-blur' | 'wipe',
    duration: number
  ): void

  render(): void {
    if (this.transitionScene) {
      this.scenes.get(this.activeScene).renderer.render()
      this.scenes.get(this.transitionScene).renderer.render()
      this.blendScenes(this.transitionProgress)
    } else {
      this.scenes.get(this.activeScene).renderer.render()
    }
  }
}
```

### 1.4 전환 효과

씬이 텍스처로 존재하므로 전환 방식은 셰이더로 자유롭게 구현한다.

```glsl
// Fade
color = mix(sceneA, sceneB, progress);

// Slide (좌→우)
color = uv.x < progress ? sceneB : sceneA;

// Zoom blur (영화적)
color = mix(sceneA, blur(sceneB, 1.0 - progress), progress);

// Wipe + 경계 글로우
float edge = smoothstep(progress - 0.02, progress + 0.02, uv.x);
color = mix(sceneA, sceneB, edge);
color += glowColor * (1.0 - abs(edge - 0.5) * 2.0) * 0.4;
```

### 1.5 타임라인 통합

씬 전환을 타임라인의 트랙으로 표현한다. 오버랩 구간에서 두 씬이 동시 활성화된다.

```
Timeline
├── Scene 1  ──────────────────────────┤
│    ├── Camera                        │
│    ├── Box 1                         │
│    └── Box 2                         │
│                              ┌───────┤ Transition (fade, 1s)
└── Scene 2              ├─────┴────────────────────────────
      ├── Camera
      ├── Component A
      └── Component B
```

### 1.6 .choan 파일 포맷 확장

```yaml
version: 2
scenes:
  - id: scene_1
    label: "홈 화면"
    objects: [...]
    states: [...]

  - id: scene_2
    label: "상세 화면"
    objects: [...]
    states: [...]

timeline:
  duration: 8.0
  tracks:
    - type: scene
      sceneId: scene_1
      start: 0
      end: 4.5
    - type: transition
      from: scene_1
      to: scene_2
      start: 4.0
      end: 5.0
      effect: zoom-blur
    - type: scene
      sceneId: scene_2
      start: 4.5
      end: 8.0
```

---

## 2. Subdivision 레이어

### 2.1 SDF의 한계와 보완

SDF는 수식으로 형태를 정의하므로 외곽선, 불리언 연산, 툰쉐이딩이 자연스럽다. 반면 유기적인 자유 형태나 복잡한 곡면 표현은 어렵다. Subdivision Surface가 이를 보완한다.

```
SDF가 잘하는 것           Subdivision이 잘하는 것
──────────────────────    ──────────────────────────
UI 컴포넌트 표현          유기적 배경 오브젝트
정확한 외곽선             자유로운 곡면
불리언 연산, smin         Spline 스타일 형태
툰쉐이딩                  PBR 머터리얼 풍부함
```

### 2.2 렌더링 구조

두 렌더러를 레이어로 합성한다.

```
SDF 렌더러
  → 렌더 타겟 A (UI 오브젝트, 툰쉐이딩)

Subdivision 렌더러 (Three.js / WebGPU)
  → 렌더 타겟 B (배경 오브젝트, PBR 머터리얼)

합성
  → depth buffer 기반으로 두 레이어 합성
  → 최종 출력
```

### 2.3 smin 블렌딩 연동

Subdivision 메시를 SDF로 베이크해두면 smin 블렌딩이 두 타입 사이에서도 동작한다. SDF UI 박스와 Subdivision 오브젝트가 자연스럽게 녹아드는 연출이 가능하다.

```glsl
// 메시 SDF 샘플링 (3D 텍스처에 베이크)
float sdMesh(vec3 p) {
  return texture3D(uMeshSDF, p / uBounds).r;
}

float map(vec3 p) {
  float box  = sdRoundBox(p, size, r);     // SDF 프리미티브
  float mesh = sdMesh(p - meshOffset);     // 베이크된 메시
  return smin(box, mesh, 0.08);            // 두 형태가 녹아듦
}
```

### 2.4 에디터 통합

레이어 패널에 Subdivision 레이어 타입을 추가한다.

```
Layers
├── [SDF]  Box 1
├── [SDF]  Box 2
├── [SUB]  Background Blob    ← Subdivision 오브젝트
└── [SUB]  Decoration Sphere
```

Subdivision 오브젝트 선택 시 Properties 패널에 제어점 편집 UI 표시. 베지어 핸들처럼 정점을 드래그해 형태를 조정한다.

### 2.5 머터리얼 시스템

Subdivision 레이어에는 PBR 머터리얼을 적용한다.

```yaml
material:
  type: pbr
  baseColor: "#A9DBF5"
  roughness: 0.15
  metalness: 0.0
  transmission: 0.6    # 반투명
  ior: 1.45            # 굴절률
  clearcoat: 0.8       # 클리어코트
```

SDF 레이어는 기존 툰쉐이딩 머터리얼을 유지한다. 두 스타일이 한 씬에 공존하는 것이 초안의 독특한 비주얼 언어가 된다.

---

## 3. 카메라 제어 + 영상 Export

### 3.1 카메라 파라미터

카메라를 타임라인에서 편집 가능한 오브젝트로 취급한다.

```typescript
interface Camera {
  position: Vec3      // 카메라 위치
  target: Vec3        // 바라보는 지점
  fov: number         // 시야각 (도)
  rotation: Vec3      // 카메라 자체 회전
  zoom: number        // 직교 줌 배율
}
```

### 3.2 타임라인 카메라 트랙

기존 오브젝트 트랙과 동일한 방식으로 키프레임을 편집한다.

```
Timeline
├── Camera                        ← 카메라 트랙
│   ├── position.z  0s:500 → 2s:100   (줌인)
│   ├── position.y  0s:0   → 1s:30    (틸트업)
│   ├── rotation.y  0s:0   → 3s:-15°  (회전)
│   └── fov         0s:60  → 2s:45    (시야 좁힘)
├── Box 1
│   └── position.y
└── Switch
    └── state
```

키프레임 보간은 오브젝트와 동일하게 Spring / Bezier 선택 가능.

### 3.3 카메라 프리셋

자주 쓰는 카메라 무브를 프리셋으로 제공한다.

```
Overview    전체 씬 조감 → 특정 오브젝트 줌인
Orbit       오브젝트 주위를 360° 회전
Z-Reveal    정면 2D → Z축 회전으로 레이어 구조 공개
Push        카메라가 앞으로 이동하며 씬 진입
Pull        씬에서 멀어지며 다음 씬 전환 준비
```

### 3.4 영상 Export 파이프라인

```
타임라인 Export 버튼 클릭
    ↓
Export 설정 다이얼로그
  해상도: 1080p / 2K / 4K
  fps: 30 / 60
  포맷: MP4 / WebM / GIF / PNG 시퀀스
  품질: 낮음 / 보통 / 높음
    ↓
캔버스 크기를 export 해상도로 변경
    ↓
MediaRecorder로 WebGL 캔버스 스트림 캡처
  canvas.captureStream(fps)
    ↓
타임라인 처음부터 자동 재생
  카메라 무브 + 오브젝트 애니메이션 + 씬 전환
    ↓
재생 완료 → 녹화 종료
    ↓
ffmpeg.wasm으로 포맷 변환 (브라우저 내)
    ↓
파일 다운로드
```

### 3.5 구현 코드 구조

```typescript
class VideoExporter {
  async export(options: ExportOptions): Promise<Blob> {
    // 1. 캔버스 해상도 변경
    this.renderer.resize(options.width, options.height)

    // 2. 스트림 캡처 시작
    const stream = this.canvas.captureStream(options.fps)
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: options.quality * 1_000_000
    })

    // 3. 타임라인 재생
    const chunks: Blob[] = []
    recorder.ondataavailable = e => chunks.push(e.data)
    recorder.start()
    await this.timeline.playFull()
    recorder.stop()

    // 4. WebM → MP4 변환 (ffmpeg.wasm)
    const webm = new Blob(chunks, { type: 'video/webm' })
    if (options.format === 'mp4') {
      return await this.convertToMp4(webm)
    }
    return webm
  }

  // GIF export
  async exportGif(options: ExportOptions): Promise<Blob> {
    const gif = new GIF({ workers: 4, quality: 10 })
    const frameInterval = 1000 / options.fps

    await this.timeline.playFull({
      onFrame: (canvas) => {
        gif.addFrame(canvas, { delay: frameInterval })
      }
    })

    return new Promise(resolve => {
      gif.on('finished', resolve)
      gif.render()
    })
  }
}
```

### 3.6 투명 배경 PNG 시퀀스

배경 없이 오브젝트만 있는 PNG 시퀀스를 export하면 다른 영상 편집 도구에서 합성 소재로 활용 가능하다.

```typescript
// 알파 채널 포함 PNG 시퀀스
async exportPngSequence(): Promise<void> {
  for (let frame = 0; frame < totalFrames; frame++) {
    this.timeline.seek(frame / fps)
    this.renderer.render()
    const dataUrl = this.canvas.toDataURL('image/png')  // 알파 포함
    downloadFile(dataUrl, `frame_${String(frame).padStart(4, '0')}.png`)
  }
}
```

---

## 4. 구현 우선순위

```
Phase 1 — 멀티씬 (핵심 성능 문제 해결)
  SceneManager 구조 구현
  씬 전환 (fade) 기본 구현
  타임라인 씬 트랙 추가
  .choan 포맷 v2 업데이트

Phase 2 — 카메라 제어
  카메라 파라미터 타임라인 연결
  카메라 키프레임 UI
  카메라 프리셋 5종

Phase 3 — 영상 Export
  MediaRecorder 기반 WebM export
  ffmpeg.wasm MP4 변환
  GIF export
  Export 설정 UI

Phase 4 — Subdivision 레이어 (선택적)
  Three.js Subdivision 렌더러 통합
  레이어 패널 SUB 타입 추가
  PBR 머터리얼 시스템
  SDF-Subdivision smin 블렌딩
```

---

## 5. 기대 효과

```
멀티씬 구조    씬당 50~60개 제한 → 씬 수 제한 없이 확장
               복잡한 앱 플로우를 여러 씬으로 자연스럽게 표현

카메라 제어    정적 스케치 → 영화적 연출 가능
               "이 앱은 이런 레이어 구조"를 카메라 무브로 설명

영상 Export    결과물을 팀과 공유 가능
               프레젠테이션, SNS, 문서에 바로 활용

Subdivision    배경 오브젝트의 표현 범위 확장
               Spline 스타일 유기적 형태 + SDF 툰쉐이딩 공존
```
