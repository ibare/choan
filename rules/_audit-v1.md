## AUDIT-v1 결과

감사일: 2026-03-26

### 요약
- 총 위반: 17건
- Critical: 2건 / High: 3건 / Medium: 9건 / Low: 3건
- 준수율: ~88% (141개 파일 중 14개 파일에서 위반 발견)

---

### 위반 목록

| # | 규칙 | 파일 | Severity | 내용 |
|---|------|------|:--------:|------|
| 1 | P2 | `src/engine/scene.ts` | Critical | engine → canvas 역방향 의존 (PALETTE, getExportAnim, phaseProgress import) |
| 2 | P2 | `src/engine/colorWheel.ts` | Critical | engine → canvas 역방향 의존 (COLOR_FAMILIES import) |
| 3 | P2 | `src/rendering/useAnimateLoop.ts` | High | rendering → canvas 역방향 의존 (hoveredHistoryColor, exportAnimation import) |
| 4 | C5 | `src/canvas/ContextToolbar.tsx` | High | @radix-ui/react-popover 직접 import (components/ui/ 래퍼 우회) |
| 5 | C3 | `src/store/history.ts` | High | JSON.parse()에 catch 없음 — 파싱 실패 시 undo/redo 크래시 가능 |
| 6 | P2 | `src/interaction/splitElement.ts` | Medium | interaction → canvas 역방향 의존 (nanoid import) |
| 7 | P2 | `src/interaction/usePointerHandlers.ts` | Medium | interaction → canvas 역방향 의존 (SnapLine, nanoid import) |
| 8 | P2 | `src/interaction/useKeyboardHandlers.ts` | Medium | interaction → canvas 역방향 의존 (nanoid import) |
| 9 | P2 | `src/interaction/colorPickerHandlers.ts` | Medium | interaction → canvas 역방향 의존 (COLOR_FAMILIES import) |
| 10 | P2 | `src/interaction/resizeHandlers.ts` | Medium | interaction → canvas 역방향 의존 (SnapLine, computeSnapResize import) |
| 11 | P2 | `src/interaction/dragHandlers.ts` | Medium | interaction → canvas 역방향 의존 (SnapLine, computeSnapMove import) |
| 12 | P4/C4 | `src/store/useElementStore.ts` 외 4파일 | Medium | layoutGap/layoutPadding/layoutColumns 기본값(8,8,2) 5개 파일에 하드코딩 |
| 13 | S-engine | `src/engine/shaders.ts` | Medium | GLSL SDF 프리미티브가 sdf.ts가 아닌 셰이더 문자열 내에 인라인 정의 |
| 14 | S-engine | `src/engine/overlayShaders.ts` | Medium | 셰이더 소스가 shaders.ts 한 곳이 아닌 overlayShaders.ts에 분산 관리 |
| 15 | P4/C4 | `src/canvas/ContextToolbar.tsx` | Low | 기본 색상 0xe0e0e0 같은 파일 내 2회 하드코딩 |
| 16 | S-export | `src/export/toYaml.ts` | Low | 파이프라인(core→render→platforms) 구조 밖 최상위에 위치 |
| 17 | S-export | `src/export/` 전체 | Low | 스냅샷 테스트 미존재로 출력 변경 시 갱신 규칙 준수 불가 |

---

### 예외 판정

| # | 위반 | 판정 | 사유 |
|---|------|------|------|
| 13 | S-engine: GLSL SDF in shaders.ts | **Exception** | GLSL 함수는 셰이더 문자열 안에 있어야 GPU에서 실행됨. TypeScript 모듈 분리 규칙을 GLSL 코드에 적용하는 것은 부적절 |
| 14 | S-engine: overlayShaders.ts 분리 | **Exception** | 메인 렌더링 셰이더와 오버레이 셰이더는 관심사가 다름. 파일 분리가 단일 책임 원칙에 부합 |
| 16 | S-export: toYaml.ts 위치 | **Exception** | toYaml.ts는 toMarkdown.ts와 대칭되는 진입점. 파이프라인 구조 밖에 있는 것이 적절 |

→ 예외 제외 후 실질 위반: **14건** (Critical 2, High 3, Medium 7, Low 2)

---

### 근본 원인 분석

**P2 위반 (11건)의 근본 원인**: `canvas/` 디렉터리에 공유 유틸리티 성격의 파일이 위치함
- `canvas/nanoid.ts` → `utils/`로 이동 필요
- `canvas/snapUtils.ts` → `utils/`로 이동 필요
- `canvas/materials.ts` (PALETTE, COLOR_FAMILIES) → `config/` 또는 `constants/`로 이동 필요
- `canvas/exportAnimation.ts` → `animation/` 또는 `rendering/`으로 이동 필요
- `canvas/colorHistoryHover.ts` → `utils/` 또는 `store/`로 이동 필요

이 5개 파일을 이동하면 P2 위반 11건 중 대부분이 해소됨.
